'use strict';

// Stream Manager: orchestrates the continuous playback queue for a channel.
//
// Playback order for each channel:
//   [seek to current position in video N] → video N → [commercial break] →
//   video N+1 → [commercial break] → video N+2 → ... (infinite loop)
//
// Each HTTP request to /stream/:channelId gets its own isolated pipeline.
// If the client disconnects, the FFmpeg process is killed immediately.
//
// Failure handling (what keeps a channel "just working"):
//   - yt-dlp says the video is gone            → mark isDead in db, never retried
//   - yt-dlp/ffmpeg fails for another reason   → remembered for 30 min, skipped
//   - FFmpeg exits almost immediately with ~0 bytes (403 from the CDN etc.)
//                                              → counts as a failure, not a
//                                                 successful "video ended"
//   - 5 consecutive failures                   → stream ends so the client can
//                                                 retry instead of hanging

const ytdlp = require('./ytdlp');
const ffmpeg = require('./ffmpeg');
const commercials = require('./commercials');
const virtualClock = require('../channels/virtualClock');
const { getDb } = require('../db/lowdb');

// Active stream registry: channelId → Set<ChildProcess>
const activeProcs = new Map();

// videoId → expiry timestamp. Transient failures are skipped for a while so a
// channel doesn't hammer one broken video every time the queue wraps around.
const recentlyFailed = new Map();
const FAIL_TTL_MS = 30 * 60 * 1000;

// A video "played" if FFmpeg exited cleanly with output, ran for a while, or
// produced a meaningful amount of MPEG-TS. A CDN 403 / bad URL exits non-zero
// within a second with 0 bytes — that is the case we must NOT treat as "ended".
const MIN_SUCCESS_MS = 8000;
const MIN_SUCCESS_BYTES = 256 * 1024;
const MAX_CONSECUTIVE_ERRORS = 5;

function isRecentlyFailed(videoId) {
  const exp = recentlyFailed.get(videoId);
  if (!exp) return false;
  if (Date.now() > exp) {
    recentlyFailed.delete(videoId);
    return false;
  }
  return true;
}

function rememberFailure(videoId) {
  recentlyFailed.set(videoId, Date.now() + FAIL_TTL_MS);
  if (recentlyFailed.size > 5000) {
    const now = Date.now();
    for (const [id, exp] of recentlyFailed) if (exp < now) recentlyFailed.delete(id);
  }
}

// Debounced db.write so a burst of dead videos doesn't thrash the JSON file
let writeTimer = null;
function scheduleDbWrite() {
  if (writeTimer) return;
  writeTimer = setTimeout(async () => {
    writeTimer = null;
    try {
      await getDb().write();
    } catch (err) {
      console.error('[Stream] db write failed:', err.message);
    }
  }, 2000);
}

function markVideoDead(channel, videoId, reason) {
  const video = (channel.cachedVideos || []).find((v) => v.id === videoId);
  if (video && !video.isDead) {
    video.isDead = true;
    video.deadReason = String(reason || '').slice(0, 200);
    video.lastVerified = Date.now();
    scheduleDbWrite();
    console.warn(`[Stream] ${channel.id}: marked ${videoId} dead (${video.deadReason})`);
  }
}

function playableQueue(channel, count) {
  return virtualClock
    .getUpcomingQueue(channel, Date.now(), count)
    .filter((item) => item.video && item.video.id && !item.video.isDead && !isRecentlyFailed(item.video.id));
}

/**
 * Start streaming a channel to an HTTP response.
 *
 * @param {string} channelId
 * @param {import('http').ServerResponse} res
 */
async function startChannelStream(channelId, res) {
  const db = getDb();
  const channel = db.data.channels.find((c) => c.id === channelId);

  if (!channel) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  if (!channel.enabled) {
    return res.status(403).json({ error: 'Channel is disabled' });
  }

  if (channel.isLive) {
    return startLiveChannelStream(channel, res);
  }

  if (!channel.cachedVideos || channel.cachedVideos.length === 0) {
    return res.status(503).json({ error: 'No videos available for this channel. Run a sync first.' });
  }

  // Build the queue BEFORE setting headers — if empty we can still return a proper
  // JSON 503 rather than a 0-byte video/MP2T response (causes NS_BINDING_ABORTED).
  let queue = playableQueue(channel, 20);

  // Fallback: virtualClock needs a valid startEpoch and videos with duration > 0.
  // If it returns nothing, fall back to sequential playback so the channel is still
  // watchable even without full metadata.
  if (!queue.length) {
    const playable = channel.cachedVideos.filter((v) => v && v.id && !v.isDead && !isRecentlyFailed(v.id));
    if (!playable.length) {
      return res.status(503).json({ error: 'No playable videos found. All videos are dead or failed recently.' });
    }
    queue = playable.slice(0, 20).map((v) => ({ video: v, seekSeconds: 0 }));
    console.warn(`[Stream] ${channelId}: virtualClock returned no queue (startEpoch or duration missing), falling back to sequential playback`);
  }

  // Safe to set MPEG-TS response headers now that we have content
  res.setHeader('Content-Type', 'video/MP2T');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  if (!activeProcs.has(channelId)) {
    activeProcs.set(channelId, new Set());
  }

  let currentProc = null;
  let isClosed = false;
  let consecutiveErrors = 0;

  function cleanup() {
    if (isClosed) return;
    isClosed = true;
    if (currentProc) {
      try { currentProc.kill('SIGTERM'); } catch {}
      activeProcs.get(channelId)?.delete(currentProc);
      currentProc = null;
    }
  }

  res.on('close', cleanup);
  res.on('error', cleanup);

  function endStream() {
    cleanup();
    try { res.end(); } catch {}
  }

  function noteFailure(videoId, reason, permanent) {
    consecutiveErrors++;
    if (permanent) markVideoDead(channel, videoId, reason);
    else rememberFailure(videoId);
    console.error(`[Stream] ${channelId}: skipping ${videoId} — ${reason}`);
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      console.error(`[Stream] ${channelId}: ${MAX_CONSECUTIVE_ERRORS} consecutive failures — ending stream`);
      endStream();
      return false;
    }
    return true;
  }

  async function playNext() {
    if (isClosed) return;

    // Refill queue if running low
    if (queue.length < 3) {
      const more = playableQueue(channel, 20);
      queue.push(...more.slice(1)); // skip first (already played or current)
    }

    const item = queue.shift();
    if (!item) {
      console.warn(`[Stream] ${channelId}: nothing left to play`);
      endStream();
      return;
    }

    if (item.video.isDead || isRecentlyFailed(item.video.id)) {
      setImmediate(playNext);
      return;
    }

    // Play commercial break before the video (except when joining mid-video)
    if (channel.settings?.includeCommercials && item.seekSeconds === 0) {
      try {
        const breaks = await commercials.getCommercialBreak(channelId, Date.now());
        for (const clip of breaks) {
          if (isClosed) return;
          await playLocalFile(clip.path);
        }
      } catch {
        // Commercial errors are non-fatal — continue to next video
      }
    }

    if (isClosed) return;

    let resolved;
    try {
      resolved = await ytdlp.resolveYouTubeUrl(item.video.id, db.data.settings.streamQuality);
    } catch (err) {
      if (isClosed) return;
      if (err.code === 'SPAWN') {
        // Nothing will work without yt-dlp — fail fast and loudly.
        console.error(`[Stream] ${err.message}`);
        endStream();
        return;
      }
      if (noteFailure(item.video.id, err.message, !!err.permanent)) setImmediate(playNext);
      return;
    }

    if (isClosed) return;

    const proc = ffmpeg.createStream(resolved, item.seekSeconds || 0, res);
    currentProc = proc;
    activeProcs.get(channelId).add(proc);

    res.once('videoEnd', (code, info = {}) => {
      activeProcs.get(channelId)?.delete(proc);
      if (currentProc === proc) currentProc = null;
      if (isClosed) return;

      const played = (code === 0 && info.bytes > 0) || info.elapsedMs >= MIN_SUCCESS_MS || info.bytes >= MIN_SUCCESS_BYTES;
      if (played) {
        consecutiveErrors = 0;
        setImmediate(playNext);
        return;
      }
      const reason = `ffmpeg exited ${code} after ${info.elapsedMs}ms / ${info.bytes}B ${info.stderrTail ? '— ' + info.stderrTail.trim().split('\n').pop() : ''}`;
      if (noteFailure(item.video.id, reason, false)) setImmediate(playNext);
    });
  }

  function playLocalFile(filePath) {
    return new Promise((resolve) => {
      if (isClosed) return resolve();
      const proc = ffmpeg.createLocalStream(filePath, res);
      currentProc = proc;
      activeProcs.get(channelId).add(proc);

      res.once('videoEnd', () => {
        activeProcs.get(channelId)?.delete(proc);
        if (currentProc === proc) currentProc = null;
        resolve();
      });
    });
  }

  // Kick off the stream
  playNext();
}

// ---------------------------------------------------------------------------
// Live channels (24/7 YouTube streams)
//
// No queue, no clock: resolve the live HLS URL, relay it, and if the relay
// drops (YouTube rotates segments/URLs every few hours) re-resolve and
// reconnect. Copy mode first; if copy dies immediately the channel is
// remembered as needing a transcode.
// ---------------------------------------------------------------------------
const liveNeedsTranscode = new Set();
const LIVE_MAX_RETRIES = 6;
const LIVE_RETRY_DELAY_MS = 4000;

async function startLiveChannelStream(channel, res) {
  const db = getDb();
  const channelId = channel.id;

  if (!channel.liveVideoId) {
    return res.status(503).json({ error: 'Live channel has no stream ID yet. Run a sync.' });
  }
  if (channel.liveOnline === false) {
    return res.status(503).json({ error: `${channel.name} is offline right now.` });
  }

  // Resolve BEFORE sending headers so an offline stream is a clean 503
  let resolved;
  try {
    resolved = await ytdlp.resolveLiveUrl(channel.liveVideoId, db.data.settings.streamQuality, channel.liveYoutubeChannel);
  } catch (err) {
    console.error(`[Live] ${channelId}: ${err.message}`);
    if (err.code === 'OFFLINE') {
      channel.liveOnline = false;
      scheduleDbWrite();
    }
    return res.status(err.code === 'SPAWN' ? 500 : 503).json({ error: err.message, code: err.code || 'OTHER' });
  }

  // Stream ID rotated? Remember the new one so the guide/player follow.
  if (resolved.videoId && resolved.videoId !== channel.liveVideoId) {
    console.log(`[Live] ${channelId}: stream ID ${channel.liveVideoId} → ${resolved.videoId}`);
    channel.liveVideoId = resolved.videoId;
    channel.liveUrl = `https://www.youtube.com/live/${resolved.videoId}`;
    channel.cachedVideos = [{ id: resolved.videoId, title: resolved.title || channel.name, description: '', duration: 0, thumbnailUrl: channel.thumbnailUrl || '', isLive: true, isDead: false, lastVerified: Date.now() }];
    scheduleDbWrite();
  }
  channel.liveOnline = true;
  if (resolved.title && channel.cachedVideos[0]) channel.cachedVideos[0].title = resolved.title;

  res.setHeader('Content-Type', 'video/MP2T');
  res.setHeader('Cache-Control', 'no-cache, no-store');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  if (!activeProcs.has(channelId)) activeProcs.set(channelId, new Set());

  let currentProc = null;
  let isClosed = false;
  let retries = 0;

  function cleanup() {
    if (isClosed) return;
    isClosed = true;
    if (currentProc) {
      try { currentProc.kill('SIGTERM'); } catch {}
      activeProcs.get(channelId)?.delete(currentProc);
      currentProc = null;
    }
  }
  res.on('close', cleanup);
  res.on('error', cleanup);

  function relay(source) {
    if (isClosed) return;
    const mode = liveNeedsTranscode.has(channelId) ? 'transcode' : 'copy';
    const proc = ffmpeg.createLiveStream(source, res, mode);
    currentProc = proc;
    activeProcs.get(channelId).add(proc);

    res.once('videoEnd', async (code, info = {}) => {
      activeProcs.get(channelId)?.delete(proc);
      if (currentProc === proc) currentProc = null;
      if (isClosed) return;

      const ranOk = info.elapsedMs >= 20000 || info.bytes >= 2 * 1024 * 1024 || (code === 0 && info.bytes >= 64 * 1024);
      if (ranOk) retries = 0;

      // Copy mode died at once with an error → this stream needs a transcode
      if (!ranOk && mode === 'copy' && (code !== 0 || info.bytes < 64 * 1024)) {
        console.warn(`[Live] ${channelId}: stream-copy failed (${(info.stderrTail || '').trim().split('\n').pop() || 'exit ' + code}) — switching to transcode`);
        liveNeedsTranscode.add(channelId);
      } else if (!ranOk) {
        retries++;
      }

      if (retries >= LIVE_MAX_RETRIES) {
        console.error(`[Live] ${channelId}: ${LIVE_MAX_RETRIES} consecutive failures — ending stream`);
        cleanup();
        try { res.end(); } catch {}
        return;
      }

      // Re-resolve: YouTube live URLs expire, and the stream may have rotated IDs
      await new Promise((r) => setTimeout(r, ranOk ? 500 : LIVE_RETRY_DELAY_MS));
      if (isClosed) return;
      try {
        const next = await ytdlp.resolveLiveUrl(channel.liveVideoId, db.data.settings.streamQuality, channel.liveYoutubeChannel);
        if (next.videoId && next.videoId !== channel.liveVideoId) {
          channel.liveVideoId = next.videoId;
          channel.liveUrl = `https://www.youtube.com/live/${next.videoId}`;
          if (channel.cachedVideos[0]) channel.cachedVideos[0].id = next.videoId;
          scheduleDbWrite();
        }
        relay(next);
      } catch (err) {
        console.error(`[Live] ${channelId}: reconnect failed — ${err.message}`);
        if (err.code === 'OFFLINE') {
          channel.liveOnline = false;
          scheduleDbWrite();
          cleanup();
          try { res.end(); } catch {}
          return;
        }
        retries++;
        if (!isClosed) setTimeout(() => { if (!isClosed) relay(source); }, LIVE_RETRY_DELAY_MS);
      }
    });
  }

  relay(resolved);
}

function getActiveStreamCount() {
  let count = 0;
  for (const set of activeProcs.values()) {
    count += set.size;
  }
  return count;
}

function getRecentlyFailedCount() {
  let n = 0;
  for (const id of recentlyFailed.keys()) if (isRecentlyFailed(id)) n++;
  return n;
}

module.exports = { startChannelStream, getActiveStreamCount, getRecentlyFailedCount, markVideoDead };

'use strict';

// Stream Manager: orchestrates the continuous playback queue for a channel.
//
// Playback order for each channel:
//   [seek to current position in video N] → video N → [commercial break] →
//   video N+1 → [commercial break] → video N+2 → ... (infinite loop)
//
// Each HTTP request to /stream/:channelId gets its own isolated pipeline.
// If the client disconnects, the FFmpeg process is killed immediately.

const ytdlp = require('./ytdlp');
const ffmpeg = require('./ffmpeg');
const commercials = require('./commercials');
const virtualClock = require('../channels/virtualClock');
const { getDb } = require('../db/lowdb');

// Active stream registry: channelId → Set<ChildProcess>
// Allows multiple simultaneous viewers on the same channel (up to tunerCount)
const activeProcs = new Map();

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

  if (!channel.cachedVideos || channel.cachedVideos.length === 0) {
    return res.status(503).json({ error: 'No videos available for this channel. Run a sync first.' });
  }

  // Build the queue BEFORE setting headers — if empty we can still return a proper
  // JSON 503 rather than a 0-byte video/MP2T response (causes NS_BINDING_ABORTED).
  let queue = virtualClock.getUpcomingQueue(channel, Date.now(), 20);

  // Fallback: virtualClock needs a valid startEpoch and videos with duration > 0.
  // If it returns nothing, fall back to sequential playback so the channel is still
  // watchable even without full metadata.
  if (!queue.length) {
    const playable = channel.cachedVideos.filter((v) => v && v.id);
    if (!playable.length) {
      return res.status(503).json({ error: 'No playable videos found. Check video duration metadata.' });
    }
    queue = playable.slice(0, 20).map((v) => ({ video: v, seekSeconds: 0 }));
    console.warn(`[Stream] ${channelId}: virtualClock returned no queue (startEpoch or duration missing), falling back to sequential playback`);
  }

  // Safe to set MPEG-TS response headers now that we have content
  res.setHeader('Content-Type', 'video/MP2T');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Track this stream's active process for cleanup
  if (!activeProcs.has(channelId)) {
    activeProcs.set(channelId, new Set());
  }

  let currentProc = null;
  let isClosed = false;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 5;

  function cleanup() {
    isClosed = true;
    if (currentProc) {
      try { currentProc.kill('SIGTERM'); } catch {}
      activeProcs.get(channelId)?.delete(currentProc);
      currentProc = null;
    }
  }

  res.on('close', cleanup);
  res.on('error', cleanup);

  async function playNext() {
    if (isClosed) return;

    // Refill queue if running low
    if (queue.length < 3) {
      const more = virtualClock.getUpcomingQueue(channel, Date.now(), 20);
      queue.push(...more.slice(1)); // skip first (already played or current)
    }

    if (!queue.length) {
      res.end();
      return;
    }

    const item = queue.shift();

    // Play commercial break before the video (except the very first one)
    if (channel.settings.includeCommercials && item.seekSeconds === 0) {
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

    try {
      const urls = await ytdlp.resolveYouTubeUrl(item.video.id, db.data.settings.streamQuality);
      if (isClosed) return;

      consecutiveErrors = 0; // reset on successful yt-dlp resolve
      currentProc = ffmpeg.createStream(urls, item.seekSeconds || 0, res);
      activeProcs.get(channelId).add(currentProc);

      res.once('videoEnd', () => {
        activeProcs.get(channelId)?.delete(currentProc);
        currentProc = null;
        setImmediate(playNext);
      });
    } catch (err) {
      console.error(`[Stream] Skipping ${item.video.id}: ${err.message}`);
      consecutiveErrors++;
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error(`[Stream] ${channelId}: ${MAX_CONSECUTIVE_ERRORS} consecutive failures — ending stream`);
        cleanup();
        res.end();
        return;
      }
      // Skip dead/unavailable video and move to next
      setImmediate(playNext);
    }
  }

  function playLocalFile(filePath) {
    return new Promise((resolve) => {
      if (isClosed) return resolve();
      const proc = ffmpeg.createLocalStream(filePath, res);
      currentProc = proc;
      activeProcs.get(channelId).add(proc);

      res.once('videoEnd', () => {
        activeProcs.get(channelId)?.delete(proc);
        currentProc = null;
        resolve();
      });

      proc.on('error', () => {
        activeProcs.get(channelId)?.delete(proc);
        currentProc = null;
        resolve();
      });
    });
  }

  // Kick off the stream
  playNext();
}

function getActiveStreamCount() {
  let count = 0;
  for (const set of activeProcs.values()) {
    count += set.size;
  }
  return count;
}

module.exports = { startChannelStream, getActiveStreamCount };
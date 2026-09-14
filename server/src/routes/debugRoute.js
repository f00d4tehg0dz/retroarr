'use strict';

// GET /api/debug/binaries          — are yt-dlp / ffmpeg usable on this host?
// GET /api/debug/stream/:channelId — JSON diagnostics for a channel's stream readiness
// GET /api/debug/resolve/:videoId  — run yt-dlp for one video and show what FFmpeg would get
// GET /api/debug/db                — quick DB health overview
//
// Open these in a browser to diagnose "channel won't tune" problems.

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/lowdb');
const virtualClock = require('../channels/virtualClock');
const config = require('../config');
const ytdlp = require('../streaming/ytdlp');
const { probeVersion } = require('../binaries');
const streamManager = require('../streaming/streamManager');

async function binaryReport() {
  const ffmpeg = probeVersion(config.ffmpegPath, [], '-version');
  const ffprobe = probeVersion(config.ffprobePath, [], '-version');
  const yt = await ytdlp.probe();
  return {
    platform: `${process.platform}/${process.arch}`,
    node: process.version,
    ffmpeg: { path: config.ffmpegPath, source: config.ffmpegSource, ...ffmpeg },
    ffprobe: { path: config.ffprobePath, ...ffprobe },
    ytdlp: {
      path: [config.ytdlpPath, ...config.ytdlpPrefixArgs].join(' '),
      source: config.ytdlpSource,
      ok: yt.ok,
      version: yt.version,
      error: yt.error,
      supportsJsRuntimes: yt.supportsJsRuntimes,
      jsRuntimeArgs: yt.jsRuntimeArgs,
      cookies: config.ytdlpCookies,
      extraArgs: config.ytdlpExtraArgs,
    },
    warnings: config.binaryWarnings,
    env: {
      YTDLP_PATH: process.env.YTDLP_PATH || process.env.YT_DLP_PATH || null,
      FFMPEG_PATH: process.env.FFMPEG_PATH || null,
    },
  };
}

router.get('/binaries', async (req, res) => {
  res.json(await binaryReport());
});

router.get('/stream/:channelId', async (req, res) => {
  const db = getDb();
  const { channelId } = req.params;

  const channel = db.data.channels.find((c) => c.id === channelId);
  if (!channel) {
    return res.status(404).json({ error: `Channel '${channelId}' not found` });
  }

  const totalVideos = channel.cachedVideos?.length ?? 0;
  const deadVideos = channel.cachedVideos?.filter((v) => v.isDead).length ?? 0;
  const validVideos = virtualClock.playableVideos(channel.cachedVideos).length;
  const startEpoch = db.data.startEpoch;
  const queue = virtualClock.getUpcomingQueue(channel, Date.now(), 5);
  const bins = await binaryReport();

  const issues = [];
  if (!channel.enabled) issues.push('Channel is disabled');
  if (channel.isLive) {
    if (!channel.liveVideoId) issues.push('Live channel has no stream ID — run a sync');
    if (channel.liveOnline === false) issues.push('Live stream was offline at last check — run a sync or tune to re-check');
  } else if (totalVideos === 0) issues.push('No cached videos — run a sync from Settings');
  if (!channel.isLive && validVideos === 0 && totalVideos > 0) issues.push('No playable videos — all are dead or have duration=0');
  if (!startEpoch) issues.push('startEpoch is 0 — restart the server to auto-repair');
  if (!bins.ffmpeg.ok) issues.push(`ffmpeg not working at '${config.ffmpegPath}' — install ffmpeg or set FFMPEG_PATH`);
  if (!bins.ytdlp.ok) issues.push(`yt-dlp not working at '${bins.ytdlp.path}' — install yt-dlp or set YTDLP_PATH`);
  for (const w of config.binaryWarnings) issues.push(w);
  if (!channel.isLive && queue.length === 0 && validVideos > 0 && startEpoch) {
    issues.push('virtualClock returned empty queue even with videos + startEpoch — check video duration metadata');
  }

  res.json({
    channelId,
    name: channel.name,
    channelNumber: channel.channelNumber,
    enabled: channel.enabled,
    decade: channel.decade,
    category: channel.category,
    isLive: !!channel.isLive,
    live: channel.isLive ? { videoId: channel.liveVideoId, url: channel.liveUrl, youtubeChannel: channel.liveYoutubeChannel, online: channel.liveOnline !== false } : undefined,
    videos: { total: totalVideos, playable: validVideos, dead: deadVideos, withoutDuration: totalVideos - deadVideos - validVideos },
    startEpoch,
    startEpochDate: startEpoch ? new Date(startEpoch).toISOString() : null,
    queueLength: queue.length,
    queuePreview: queue.slice(0, 3).map((q) => ({
      id: q.video.id,
      title: q.video.title,
      duration: q.video.duration,
      seekSeconds: q.seekSeconds,
    })),
    binaries: bins,
    activeStreams: streamManager.getActiveStreamCount(),
    streamUrl: `http://${config.getLocalIp()}:${config.port}/stream/${channelId}`,
    ready: issues.length === 0,
    issues,
  });
});

// Resolve one video exactly as the stream would (no transcoding) — the fastest
// way to see whether YouTube is blocking this host.
router.get('/resolve/:videoId', async (req, res) => {
  const videoId = String(req.params.videoId || '').trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'videoId must be an 11-character YouTube ID' });
  }
  const started = Date.now();
  try {
    const r = await ytdlp.resolveYouTubeUrl(videoId, req.query.quality || getDb().data.settings.streamQuality);
    res.json({
      ok: true,
      ms: Date.now() - started,
      title: r.title,
      duration: r.duration,
      isDash: r.isDash,
      inputs: r.inputs.map((i) => ({
        formatId: i.formatId,
        protocol: i.protocol,
        height: i.height,
        hasVideo: i.hasVideo,
        hasAudio: i.hasAudio,
        userAgent: i.headers['User-Agent'] || i.headers['user-agent'] || null,
        url: i.url.slice(0, 120) + (i.url.length > 120 ? '…' : ''),
      })),
    });
  } catch (err) {
    res.status(502).json({ ok: false, ms: Date.now() - started, code: err.code || 'OTHER', permanent: !!err.permanent, error: err.message });
  }
});

router.get('/db', (req, res) => {
  const db = getDb();
  const channels = db.data.channels || [];
  const synced = channels.filter((c) => c.cachedVideos?.length > 0).length;
  const withDuration = channels.filter((c) => c.cachedVideos?.some((v) => v.duration > 0)).length;
  let deadTotal = 0;
  for (const c of channels) deadTotal += (c.cachedVideos || []).filter((v) => v.isDead).length;

  res.json({
    deviceId: db.data.deviceId,
    startEpoch: db.data.startEpoch,
    startEpochDate: db.data.startEpoch ? new Date(db.data.startEpoch).toISOString() : null,
    lastSync: db.data.lastSync,
    channelCount: channels.length,
    enabledChannels: channels.filter((c) => c.enabled).length,
    syncedChannels: synced,
    channelsWithDuration: withDuration,
    deadVideos: deadTotal,
    reportCount: db.data.reports?.length ?? 0,
    dbPath: config.dbPath,
    pluginsDir: config.pluginsDir,
  });
});

module.exports = router;

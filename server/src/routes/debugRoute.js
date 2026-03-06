'use strict';

// GET /api/debug/stream/:channelId
// Returns JSON diagnostics for a channel's stream readiness.
// Open in the browser to diagnose NS_BINDING_ABORTED and other stream failures.

const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const { getDb } = require('../db/lowdb');
const virtualClock = require('../channels/virtualClock');
const config = require('../config');

function checkBinary(bin) {
  return new Promise((resolve) => {
    const proc = spawn(bin, ['--version'], { stdio: 'pipe' });
    let out = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.stderr.on('data', (d) => (out += d.toString()));
    proc.on('close', (code) => resolve({ ok: code === 0, version: out.split('\n')[0].trim() }));
    proc.on('error', () => resolve({ ok: false, version: null }));
  });
}

router.get('/stream/:channelId', async (req, res) => {
  const db = getDb();
  const { channelId } = req.params;

  const channel = db.data.channels.find((c) => c.id === channelId);
  if (!channel) {
    return res.status(404).json({ error: `Channel '${channelId}' not found` });
  }

  const totalVideos = channel.cachedVideos?.length ?? 0;
  const validVideos = channel.cachedVideos?.filter((v) => v.duration > 0).length ?? 0;
  const startEpoch = db.data.startEpoch;
  const queue = virtualClock.getUpcomingQueue(channel, Date.now(), 5);

  const [ffmpegCheck, ytdlpCheck] = await Promise.all([
    checkBinary(config.ffmpegPath),
    checkBinary(config.ytdlpPath),
  ]);

  const issues = [];
  if (!channel.enabled) issues.push('Channel is disabled');
  if (totalVideos === 0) issues.push('No cached videos — run a sync from Settings');
  if (validVideos === 0 && totalVideos > 0) issues.push('All videos have duration=0 — the VPS API may not be returning duration metadata');
  if (!startEpoch) issues.push('startEpoch is 0 — restart the server to auto-repair');
  if (!ffmpegCheck.ok) issues.push(`ffmpeg not found at '${config.ffmpegPath}' — install ffmpeg or set FFMPEG_PATH`);
  if (!ytdlpCheck.ok) issues.push(`yt-dlp not found at '${config.ytdlpPath}' — install yt-dlp or set YTDLP_PATH`);
  if (queue.length === 0 && totalVideos > 0 && startEpoch) {
    issues.push('virtualClock returned empty queue even with videos + startEpoch — check video duration metadata');
  }

  res.json({
    channelId,
    name: channel.name,
    enabled: channel.enabled,
    decade: channel.decade,
    category: channel.category,
    videos: { total: totalVideos, withDuration: validVideos, withoutDuration: totalVideos - validVideos },
    startEpoch,
    startEpochDate: startEpoch ? new Date(startEpoch).toISOString() : null,
    queueLength: queue.length,
    queuePreview: queue.slice(0, 3).map((q) => ({
      id: q.video.id,
      title: q.video.title,
      duration: q.video.duration,
      seekSeconds: q.seekSeconds,
    })),
    binaries: {
      ffmpeg: { path: config.ffmpegPath, ...ffmpegCheck },
      ytdlp: { path: config.ytdlpPath, ...ytdlpCheck },
    },
    streamUrl: `http://${config.getLocalIp()}:${config.port}/stream/${channelId}`,
    ready: issues.length === 0,
    issues,
  });
});

// GET /api/debug/db — quick DB health overview
router.get('/db', (req, res) => {
  const db = getDb();
  const channels = db.data.channels || [];
  const synced = channels.filter((c) => c.cachedVideos?.length > 0).length;
  const withDuration = channels.filter((c) =>
    c.cachedVideos?.some((v) => v.duration > 0)
  ).length;

  res.json({
    startEpoch: db.data.startEpoch,
    startEpochDate: db.data.startEpoch ? new Date(db.data.startEpoch).toISOString() : null,
    lastSync: db.data.lastSync,
    channelCount: channels.length,
    enabledChannels: channels.filter((c) => c.enabled).length,
    syncedChannels: synced,
    channelsWithDuration: withDuration,
    reportCount: db.data.reports?.length ?? 0,
  });
});

module.exports = router;
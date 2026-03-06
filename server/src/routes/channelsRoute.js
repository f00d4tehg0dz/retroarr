'use strict';

// GET  /api/channels          — list all channels
// GET  /api/channels/:id      — single channel
// PATCH /api/channels/:id     — update channel settings (enabled, shuffle, etc.)
// GET  /api/channels/nowplaying — current playhead for all enabled channels

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/lowdb');

// List all channels (with optional decade/category filters)
router.get('/', (req, res) => {
  const db = getDb();
  let channels = db.data.channels;

  if (req.query.decade) {
    channels = channels.filter((c) => c.decade === req.query.decade);
  }
  if (req.query.category) {
    channels = channels.filter((c) => c.category === req.query.category);
  }
  if (req.query.enabled !== undefined) {
    const enabled = req.query.enabled === 'true';
    channels = channels.filter((c) => c.enabled === enabled);
  }
  if (req.query.type === 'plugin') {
    channels = channels.filter((c) => c.isPlugin);
  } else if (req.query.type === 'grid') {
    channels = channels.filter((c) => !c.isPlugin);
  }

  res.json(channels);
});

// Now-playing for all enabled channels (lightweight — no cachedVideos array)
router.get('/nowplaying', (req, res) => {
  const db = getDb();
  // Lazy-require to avoid circular dependency at startup
  const virtualClock = require('../channels/virtualClock');

  const result = db.data.channels
    .filter((ch) => ch.enabled && ch.cachedVideos.length > 0)
    .map((ch) => {
      const playhead = virtualClock.getPlayheadForChannel(ch);
      return {
        id: ch.id,
        channelNumber: ch.channelNumber,
        name: ch.name,
        decade: ch.decade,
        category: ch.category,
        isPlugin: ch.isPlugin || false,
        nowPlaying: playhead
          ? {
              videoId: playhead.video.id,
              title: playhead.video.title,
              seekSeconds: Math.floor(playhead.seekSeconds),
              duration: playhead.video.duration,
            }
          : null,
      };
    });

  res.json(result);
});

// Single channel detail
router.get('/:id', (req, res) => {
  const db = getDb();
  const channel = db.data.channels.find((c) => c.id === req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  res.json(channel);
});

// Update channel settings (enabled toggle, shuffle, includeCommercials)
router.patch('/:id', async (req, res) => {
  const db = getDb();
  const channel = db.data.channels.find((c) => c.id === req.params.id);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const allowed = ['enabled', 'settings'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === 'settings' && typeof req.body.settings === 'object') {
        Object.assign(channel.settings, req.body.settings);
      } else {
        channel[key] = req.body[key];
      }
    }
  }

  await db.write();
  res.json(channel);
});

module.exports = router;
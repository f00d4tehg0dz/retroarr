'use strict';

// GET /stream/:channelId
// Returns a continuous MPEG-TS stream for the requested channel.
// Plex/Jellyfin request this URL when the user tunes to a channel.

const express = require('express');
const router = express.Router();
const streamManager = require('../streaming/streamManager');
const { getDb } = require('../db/lowdb');
const config = require('../config');

router.get('/:channelId', async (req, res) => {
  const db = getDb();
  const settings = db.data.settings;

  // Enforce tuner count limit
  const activeCount = streamManager.getActiveStreamCount();
  const maxTuners = settings.tunerCount || config.tunerCount;

  if (activeCount >= maxTuners) {
    return res.status(503).json({
      error: `All ${maxTuners} tuners are in use. Try again later.`,
    });
  }

  try {
    await streamManager.startChannelStream(req.params.channelId, res);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

module.exports = router;
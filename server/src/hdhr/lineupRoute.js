'use strict';

// GET /lineup.json — Channel list for Plex/Jellyfin tuner
// GET /lineup_status.json — Tuner scan status
//
// Each entry in lineup.json maps a channel number to a stream URL.
// Plex will GET that URL when the user tunes to the channel.

const express = require('express');
const router = express.Router();
const config = require('../config');
const { getDb } = require('../db/lowdb');

router.get('/lineup.json', (req, res) => {
  const db = getDb();
  const hostIp = config.getLocalIp();

  const enabledChannels = db.data.channels.filter((ch) => ch.enabled);

  const lineup = enabledChannels.map((ch) => ({
    GuideNumber: String(ch.channelNumber),
    GuideName: ch.name,
    URL: `http://${hostIp}:${config.port}/stream/${ch.id}`,
  }));

  res.json(lineup);
});

router.get('/lineup_status.json', (req, res) => {
  res.json({
    ScanInProgress: 0,
    ScanPossible: 1,
    Source: 'Cable',
    SourceList: ['Cable'],
  });
});

module.exports = router;
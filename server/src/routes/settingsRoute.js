'use strict';

// GET  /api/settings         — return current settings
// PUT  /api/settings         — update settings
// POST /api/settings/sync    — trigger manual remote API sync immediately

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/lowdb');

router.get('/', (req, res) => {
  const db = getDb();
  const settings = { ...db.data.settings };
  res.json({
    ...settings,
    lastSync: db.data.lastSync,
    startEpoch: db.data.startEpoch,
    channelCount: db.data.channels.length,
    enabledChannelCount: db.data.channels.filter((c) => c.enabled).length,
  });
});

router.put('/', async (req, res) => {
  const db = getDb();
  const allowed = [
    'remoteApiUrl',
    'deviceName',
    'streamQuality',
    'tunerCount',
  ];
  const { FORMAT_MAP } = require('../streaming/ytdlp');
  for (const key of allowed) {
    if (req.body[key] === undefined) continue;
    let value = req.body[key];
    if (key === 'streamQuality' && !FORMAT_MAP[value]) {
      return res.status(400).json({ error: `streamQuality must be one of ${Object.keys(FORMAT_MAP).join(', ')}` });
    }
    if (key === 'tunerCount') {
      value = parseInt(value, 10);
      if (!Number.isFinite(value) || value < 1 || value > 32) {
        return res.status(400).json({ error: 'tunerCount must be between 1 and 32' });
      }
    }
    db.data.settings[key] = value;
  }
  // Quality is read by the ffmpeg scaler from config at stream start
  if (req.body.streamQuality) require('../config').streamQuality = req.body.streamQuality;
  await db.write();
  res.json({ ok: true });
});

// Trigger a manual sync with the remote API
router.post('/sync', async (req, res) => {
  const { runDailySync } = require('../jobs/dailySync');
  try {
    const result = await runDailySync();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
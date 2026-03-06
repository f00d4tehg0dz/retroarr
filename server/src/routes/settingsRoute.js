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
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      db.data.settings[key] = req.body[key];
    }
  }
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
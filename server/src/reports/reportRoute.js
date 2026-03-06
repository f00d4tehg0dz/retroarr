'use strict';

// POST /api/reports — submit a broken video report
// GET  /api/reports — list all reports (admin view)
// DELETE /api/reports/:videoId — dismiss/clear a report

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/lowdb');
const { validateVideo } = require('./validator');

// Submit a new report
router.post('/', async (req, res) => {
  const { videoId, channelId, reason } = req.body;

  if (!videoId) {
    return res.status(400).json({ error: 'videoId is required' });
  }

  const db = getDb();

  // Check for duplicate pending reports
  const existing = db.data.reports.find(
    (r) => r.videoId === videoId && r.status === 'pending'
  );
  if (existing) {
    return res.json({ ok: true, message: 'Already reported', report: existing });
  }

  // Immediately validate the video — if it's already dead, mark it confirmed
  let status = 'pending';
  try {
    const { valid } = await validateVideo(videoId);
    status = valid ? 'pending' : 'confirmed-dead';
  } catch {
    // Validation error — leave as pending for the cron job to handle
  }

  const report = {
    id: `report-${Date.now()}-${videoId}`,
    videoId,
    channelId: channelId || null,
    reason: reason || '',
    reportedAt: new Date().toISOString(),
    status,
  };

  db.data.reports.push(report);
  await db.write();

  res.json({ ok: true, report });
});

// List all reports
router.get('/', (req, res) => {
  const db = getDb();
  let reports = db.data.reports;

  if (req.query.status) {
    reports = reports.filter((r) => r.status === req.query.status);
  }

  res.json(reports);
});

// Dismiss a report (admin resolved it manually)
router.delete('/:videoId', async (req, res) => {
  const db = getDb();
  const before = db.data.reports.length;
  db.data.reports = db.data.reports.filter(
    (r) => r.videoId !== req.params.videoId
  );
  await db.write();
  res.json({ ok: true, removed: before - db.data.reports.length });
});

module.exports = router;
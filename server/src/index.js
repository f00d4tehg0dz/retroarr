'use strict';

// RetroArr Server — Boot sequence:
//   1. Load config + .env
//   2. Initialize LowDB (create/seed db.json if absent)
//   3. Start SSDP broadcaster (UDP must bind before HTTP)
//   4. Start Express HTTP server
//   5. Register all routes
//   6. Register cron jobs (dailySync, cleanup, EPG refresh)

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const config = require('./config');
const { initDb } = require('./db/lowdb');
const { initSSDP } = require('./hdhr/ssdp');
const { initScheduler } = require('./jobs/scheduler');
const streamManager = require('./streaming/streamManager');

// Routes
const discoverRoute = require('./hdhr/discoverRoute');
const lineupRoute = require('./hdhr/lineupRoute');
const epgRoute = require('./epg/epgRoute');
const m3uRoute = require('./routes/m3uRoute');
const channelsRoute = require('./routes/channelsRoute');
const settingsRoute = require('./routes/settingsRoute');
const streamRoute = require('./routes/streamRoute');
const reportsRoute = require('./reports/reportRoute');
const debugRoute = require('./routes/debugRoute');
const pluginRepoRoute = require('./routes/pluginRepoRoute');

async function main() {
  console.log('🎬 RetroArr starting...');

  // --- Step 1: Database ---
  await initDb();
  console.log('[Boot] Database ready.');

  // --- Step 2: SSDP (UDP) ---
  const hostIp = config.getLocalIp();
  try {
    initSSDP(hostIp, config.port, config.deviceId);
  } catch (err) {
    console.warn('[Boot] SSDP failed to start (non-fatal):', err.message);
  }

  // --- Step 3: Express ---
  const app = express();

  app.use(cors());
  app.use(express.json());

  // HDHomeRun device endpoints (no /api prefix — Plex/Jellyfin expect root paths)
  app.use('/', discoverRoute);
  app.use('/', lineupRoute);
  app.use('/', epgRoute);
  app.use('/', m3uRoute);

  // Stream endpoint
  app.use('/stream', streamRoute);

  // JSON API for the React dashboard
  app.use('/api/channels', channelsRoute);
  app.use('/api/settings', settingsRoute);
  app.use('/api/reports', reportsRoute);
  app.use('/api/debug', debugRoute);
  app.use('/api/plugins', pluginRepoRoute);

  // Status endpoint
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'ok',
      deviceId: config.deviceId,
      deviceName: config.deviceName,
      activeStreams: streamManager.getActiveStreamCount(),
      uptime: Math.floor(process.uptime()),
    });
  });

  // Serve React dashboard (production build)
  const clientDist = path.join(__dirname, '../public');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    const indexPath = path.join(clientDist, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) res.status(404).send('Dashboard not built yet. Run: npm run build in client/');
    });
  });

  app.listen(config.port, config.host, () => {
    console.log(`[Boot] HTTP server listening on http://${hostIp}:${config.port}`);
    console.log(`[Boot] HDHomeRun device ID: ${config.deviceId}`);
    console.log(`[Boot] Dashboard: http://${hostIp}:${config.port}`);
    console.log(`[Boot] EPG:       http://${hostIp}:${config.port}/epg.xml`);
    console.log(`[Boot] M3U:       http://${hostIp}:${config.port}/playlist.m3u`);
  });

  // --- Step 4: Cron jobs ---
  initScheduler();

  console.log('✅ RetroArr ready.\n');
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
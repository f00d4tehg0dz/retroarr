'use strict';

// Registers all cron jobs using node-cron.
// Schedule overview:
//   3:00 AM  — Daily sync from remote VPS API → LowDB cachedVideos
//   4:00 AM  — Dead-link cleanup (checks reports + validates videos)
//   Every 1h — Refresh EPG cache (pre-generate XMLTV for the next 24h)

const cron = require('node-cron');

function initScheduler() {
  // Daily remote API sync at 3 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('[Scheduler] Running daily sync...');
    const { runDailySync } = require('./dailySync');
    await runDailySync().catch((err) =>
      console.error('[Scheduler] Daily sync failed:', err.message)
    );
  });

  // Dead-link cleanup at 4 AM (after sync populates fresh data)
  cron.schedule('0 4 * * *', async () => {
    console.log('[Scheduler] Running dead-link cleanup...');
    const { runCleanup } = require('../reports/cleanup');
    await runCleanup().catch((err) =>
      console.error('[Scheduler] Cleanup failed:', err.message)
    );
  });

  // EPG cache refresh every hour
  cron.schedule('0 * * * *', () => {
    console.log('[Scheduler] Refreshing EPG cache...');
    const epgGenerator = require('../epg/generator');
    epgGenerator.invalidateCache();
  });

  console.log('[Scheduler] Cron jobs registered.');
}

module.exports = { initScheduler };
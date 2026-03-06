'use strict';

// Daily dead-link cleanup job.
// Runs at 4 AM (via scheduler.js), after the 3 AM sync.
//
// Actions:
//   1. Validate all videos in confirmed-dead reports against yt-dlp
//   2. Remove confirmed-dead videos from channel.cachedVideos in LowDB
//   3. Mark resolved reports as 'resolved'
//   4. Also validate a sample of unreported videos (proactive check)

const { batchValidate } = require('./validator');
const { getDb } = require('../db/lowdb');

async function runCleanup() {
  const db = getDb();
  let removedCount = 0;
  let checkedCount = 0;

  console.log('[Cleanup] Starting dead-link check...');

  // Step 1: Process reported videos
  const pendingReports = db.data.reports.filter(
    (r) => r.status === 'pending' || r.status === 'confirmed-dead'
  );

  if (pendingReports.length > 0) {
    const reportedIds = [...new Set(pendingReports.map((r) => r.videoId))];
    const validationResults = await batchValidate(reportedIds);

    for (const [videoId, isAlive] of validationResults) {
      if (!isAlive) {
        // Remove from all channels
        for (const channel of db.data.channels) {
          const before = channel.cachedVideos.length;
          channel.cachedVideos = channel.cachedVideos.filter(
            (v) => v.id !== videoId
          );
          removedCount += before - channel.cachedVideos.length;
        }

        // Mark all reports for this video as resolved
        for (const report of db.data.reports) {
          if (report.videoId === videoId) {
            report.status = 'resolved';
          }
        }
      } else {
        // Video is alive — dismiss the report
        for (const report of db.data.reports) {
          if (report.videoId === videoId && report.status !== 'resolved') {
            report.status = 'dismissed-alive';
          }
        }
      }
      checkedCount++;
    }
  }

  // Step 2: Proactively check videos already flagged as isDead in LowDB
  const deadVideos = [];
  for (const channel of db.data.channels) {
    for (const video of channel.cachedVideos) {
      if (video.isDead) {
        deadVideos.push({ channelId: channel.id, videoId: video.id });
      }
    }
  }

  if (deadVideos.length > 0) {
    const deadIds = [...new Set(deadVideos.map((d) => d.videoId))];
    const results = await batchValidate(deadIds);

    for (const channel of db.data.channels) {
      const before = channel.cachedVideos.length;
      channel.cachedVideos = channel.cachedVideos.filter((v) => {
        if (v.isDead) {
          return results.get(v.id) === true; // keep only if alive
        }
        return true;
      });
      removedCount += before - channel.cachedVideos.length;
      checkedCount += deadIds.length;
    }
  }

  await db.write();
  console.log(
    `[Cleanup] Done. Checked: ${checkedCount}, Removed: ${removedCount} dead videos.`
  );
  return { checkedCount, removedCount };
}

module.exports = { runCleanup };
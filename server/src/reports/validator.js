'use strict';

// YouTube video availability validator.
// Uses yt-dlp --simulate to check if a video is accessible
// without downloading any content.

const ytdlp = require('../streaming/ytdlp');

/**
 * Check if a YouTube video is still accessible.
 *
 * @param {string} videoId
 * @returns {Promise<{ valid: boolean, videoId: string }>}
 */
async function validateVideo(videoId) {
  const valid = await ytdlp.validateVideo(videoId);
  return { valid, videoId };
}

/**
 * Batch validate an array of video IDs.
 * Runs sequentially to avoid rate-limiting YouTube.
 *
 * @param {string[]} videoIds
 * @param {number} [delayMs] — pause between checks (default 500ms)
 * @returns {Promise<Map<string, boolean>>} — videoId → isAlive
 */
async function batchValidate(videoIds, delayMs) {
  delayMs = delayMs || 500;
  const results = new Map();

  for (const id of videoIds) {
    const { valid } = await validateVideo(id);
    results.set(id, valid);
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return results;
}

module.exports = { validateVideo, batchValidate };
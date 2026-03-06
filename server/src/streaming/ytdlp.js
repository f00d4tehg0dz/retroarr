'use strict';

// yt-dlp wrapper — resolves YouTube video IDs into direct CDN stream URLs.
// Uses child_process.spawn so it runs as an external binary (no npm package).
//
// YouTube often serves video and audio as separate DASH streams.
// --get-url may return TWO lines: [videoUrl, audioUrl].
// FFmpeg handles both via separate -i inputs.

const { spawn } = require('child_process');
const config = require('../config');

// Format selector per quality setting
const FORMAT_MAP = {
  '1080p': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]',
  '720p': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
};

/**
 * Resolves a YouTube video ID into one or two direct CDN stream URLs.
 *
 * @param {string} videoId — YouTube video ID (e.g. "dQw4w9WgXcQ")
 * @param {string} [quality] — '720p' | '1080p'
 * @returns {Promise<string[]>} — array of 1 (progressive) or 2 (DASH) URLs
 */
function resolveYouTubeUrl(videoId, quality) {
  quality = quality || config.streamQuality || '720p';
  const formatString = FORMAT_MAP[quality] || FORMAT_MAP['720p'];

  return new Promise((resolve, reject) => {
    const proc = spawn(config.ytdlpPath, [
      '--get-url',
      '-f', formatString,
      '--no-playlist',
      '--no-warnings',
      `https://www.youtube.com/watch?v=${videoId}`,
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));

    proc.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        const urls = stdout
          .trim()
          .split('\n')
          .map((u) => u.trim())
          .filter(Boolean);
        resolve(urls); // 1 URL (progressive) or 2 URLs (DASH video+audio)
      } else {
        reject(new Error(`yt-dlp exited ${code}: ${stderr.trim()}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}. Is yt-dlp installed?`));
    });
  });
}

/**
 * Validate a YouTube video is still accessible without downloading.
 * Exit code 0 = available, non-zero = dead/private/age-restricted.
 *
 * @param {string} videoId
 * @returns {Promise<boolean>}
 */
function validateVideo(videoId) {
  return new Promise((resolve) => {
    const proc = spawn(config.ytdlpPath, [
      '--simulate',
      '--quiet',
      '--no-warnings',
      `https://www.youtube.com/watch?v=${videoId}`,
    ]);
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

module.exports = { resolveYouTubeUrl, validateVideo };
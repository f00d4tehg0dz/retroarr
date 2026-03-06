'use strict';

// Commercial injection between YouTube videos.
// Users place their own commercial video files in /data/commercials/.
// Files are selected deterministically via seeded shuffle so the EPG
// can account for commercial break durations.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const config = require('../config');
const { seededShuffle } = require('../channels/seededShuffle');

const BREAK_DURATION_MS = 2.5 * 60 * 1000; // ~2.5 minute commercial break
const VIDEO_EXTENSIONS = /\.(mp4|mkv|avi|ts|mov|wmv)$/i;

let cachedCommercialList = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // re-scan every 5 minutes

function getCommercialFiles() {
  if (cachedCommercialList && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cachedCommercialList;
  }
  if (!fs.existsSync(config.commercialsDir)) {
    cachedCommercialList = [];
    return [];
  }
  cachedCommercialList = fs
    .readdirSync(config.commercialsDir)
    .filter((f) => VIDEO_EXTENSIONS.test(f));
  cacheTime = Date.now();
  return cachedCommercialList;
}

// Use ffprobe to get duration of a local file in seconds
function getFileDuration(filePath) {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      filePath,
    ]);
    let out = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.on('close', () => {
      try {
        const data = JSON.parse(out);
        resolve(parseFloat(data.format.duration) || 0);
      } catch {
        resolve(0);
      }
    });
    proc.on('error', () => resolve(0));
  });
}

/**
 * Returns a list of commercial files to play during a break.
 * Total duration of selected files approximates BREAK_DURATION_MS.
 *
 * @param {string} channelId
 * @param {number} seed — timestamp-based seed for determinism
 * @returns {Promise<Array<{ path, duration }>>}
 */
async function getCommercialBreak(channelId, seed) {
  const files = getCommercialFiles();
  if (!files.length) return [];

  const shuffled = seededShuffle(files, `${channelId}-commercial-${seed}`);

  const selected = [];
  let totalMs = 0;

  for (const filename of shuffled) {
    if (totalMs >= BREAK_DURATION_MS) break;
    const filePath = path.join(config.commercialsDir, filename);
    const duration = await getFileDuration(filePath);
    if (duration > 0) {
      selected.push({ path: filePath, duration });
      totalMs += duration * 1000;
    }
  }

  return selected;
}

function hasCommercials() {
  return getCommercialFiles().length > 0;
}

module.exports = { getCommercialBreak, hasCommercials };
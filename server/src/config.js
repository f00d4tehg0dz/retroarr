'use strict';

require('dotenv').config();

const os = require('os');
const crypto = require('crypto');
const path = require('path');

// Derive a stable 8-char hex device ID from the host machine's MAC address.
// HDHomeRun devices must present a consistent ID — Plex treats a changed ID
// as a brand new tuner device.
function generateStableDeviceId() {
  const interfaces = os.networkInterfaces();
  for (const ifaces of Object.values(interfaces)) {
    for (const addr of ifaces) {
      if (!addr.internal && addr.mac && addr.mac !== '00:00:00:00:00:00') {
        const hash = crypto.createHash('md5').update(addr.mac).digest('hex');
        return hash.substring(0, 8).toUpperCase();
      }
    }
  }
  return 'RETRO001';
}

// Resolve the host machine's non-loopback IPv4 address for SSDP announcements
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const ifaces of Object.values(interfaces)) {
    for (const addr of ifaces) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }
  return '127.0.0.1';
}

const config = {
  port: parseInt(process.env.PORT, 10) || 8888,
  host: process.env.HOST || '0.0.0.0',
  remoteApiUrl: process.env.REMOTE_API_URL || '',
  deviceId: generateStableDeviceId(),
  deviceName: process.env.DEVICE_NAME || 'RetroArr',
  streamQuality: process.env.STREAM_QUALITY || '720p',
  tunerCount: parseInt(process.env.TUNER_COUNT, 10) || 4,
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  ytdlpPath: process.env.YTDLP_PATH || 'yt-dlp',
  dbPath: process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.join(__dirname, '../db/db.json'),
  commercialsDir: process.env.COMMERCIALS_DIR
    ? path.resolve(process.env.COMMERCIALS_DIR)
    : path.join(__dirname, '../data/commercials'),
  cacheRefreshHours: parseInt(process.env.CACHE_REFRESH_HOURS, 10) || 24,
  getLocalIp,
};

module.exports = config;
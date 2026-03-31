'use strict';

// Daily sync job: pulls fresh video metadata from the remote VPS API
// and writes it into LowDB channel.cachedVideos[].
//
// For plugin channels, fetches metadata directly via yt-dlp instead.
//
// Run schedule: 3 AM daily (via node-cron in scheduler.js)
// Can also be triggered manually via POST /api/settings/sync

const { spawn } = require('child_process');
const remoteClient = require('../api/remoteClient');
const memCache = require('../api/cache');
const { getDb } = require('../db/lowdb');
const config = require('../config');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch video metadata from a single YouTube playlist via yt-dlp.
 * Returns array of { id, title, description, duration, thumbnailUrl }.
 */
function fetchPlaylistVideos(url) {
  return new Promise((resolve, reject) => {
    const videos = [];
    const proc = spawn(config.ytdlpPath, [
      '--flat-playlist',
      '--print-json',
      '--no-warnings',
      '--ignore-errors',
      '--sleep-interval', '1',
      url,
    ]);

    let buffer = '';

    proc.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (!data.id || data._type === 'playlist') continue;
          videos.push({
            id: data.id,
            title: data.title || 'Untitled',
            description: (data.description || '').slice(0, 500),
            duration: parseInt(data.duration, 10) || 0,
            thumbnailUrl: data.thumbnail || (data.thumbnails && data.thumbnails[0]?.url) || '',
          });
        } catch (e) {
          // skip unparseable lines
        }
      }
    });

    proc.stderr.on('data', () => {}); // suppress stderr noise

    proc.on('close', () => {
      // Flush remaining buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.id && data._type !== 'playlist') {
            videos.push({
              id: data.id,
              title: data.title || 'Untitled',
              description: (data.description || '').slice(0, 500),
              duration: parseInt(data.duration, 10) || 0,
              thumbnailUrl: data.thumbnail || (data.thumbnails && data.thumbnails[0]?.url) || '',
            });
          }
        } catch (e) {
          // skip
        }
      }
      resolve(videos);
    });

    proc.on('error', (err) => {
      reject(new Error(`yt-dlp failed: ${err.message}`));
    });
  });
}

/**
 * Sync a plugin channel by expanding all its YAML playlist entries via yt-dlp.
 */
async function syncPluginChannel(channel) {
  const sources = channel.pluginConfig?.videoSources || [];
  if (sources.length === 0) {
    console.log(`[Sync] Plugin "${channel.name}": no video sources in YAML`);
    return 0;
  }

  const allVideos = [];
  const seen = new Set();

  for (const source of sources) {
    try {
      const videos = await fetchPlaylistVideos(source.url);
      for (const v of videos) {
        if (!seen.has(v.id)) {
          seen.add(v.id);
          allVideos.push(v);
        }
      }
      // Rate limit between playlists
      await sleep(2000);
    } catch (err) {
      console.warn(`[Sync] Plugin "${channel.name}" — error fetching ${source.url}: ${err.message}`);
    }
  }

  channel.cachedVideos = allVideos.map((v) => ({
    id: v.id,
    title: v.title,
    description: v.description,
    duration: v.duration,
    thumbnailUrl: v.thumbnailUrl,
    lastVerified: Date.now(),
    isDead: false,
  }));
  channel.lastVideoSync = new Date().toISOString();

  return allVideos.length;
}

async function runDailySync() {
  const db = getDb();
  console.log('[Sync] Starting daily sync...');
  let syncedCount = 0;
  let pluginSyncedCount = 0;
  let errorCount = 0;

  for (const channel of db.data.channels) {
    if (!channel.enabled) continue;

    // Standalone channels (e.g., Classic Nickelodeon, Saturday Morning, Unsolved Mysteries)
    // These have dedicated IDs and fetch from the plugin videos API
    const STANDALONE_IDS = {
      'ch-classic-nickelodeon': 'classic-nickelodeon',
      'ch-saturday-morning': 'saturday-morning',
      'ch-unsolved-mysteries': 'unsolved-mysteries',
      'ch-fox-kids': 'fox-kids',
    };

    if (STANDALONE_IDS[channel.id]) {
      try {
        const pluginId = STANDALONE_IDS[channel.id];
        const videos = await remoteClient.fetchPluginVideos(pluginId);
        if (videos && videos.length > 0) {
          const localDeadIds = new Set(
            (channel.cachedVideos || []).filter((v) => v.isDead).map((v) => v.id)
          );
          channel.cachedVideos = videos
            .filter((v) => !localDeadIds.has(v.id))
            .map((v) => ({
              id: v.id,
              title: v.title || 'Untitled',
              description: v.description || '',
              duration: parseInt(v.duration, 10) || 0,
              thumbnailUrl: v.thumbnailUrl || '',
              lastVerified: Date.now(),
              isDead: false,
            }));
          channel.lastVideoSync = new Date().toISOString();
          console.log(`[Sync] Standalone "${channel.name}": ${channel.cachedVideos.length} videos from API`);
          syncedCount++;
        } else {
          console.warn(`[Sync] Standalone "${channel.name}": no videos from API`);
        }
      } catch (err) {
        console.error(`[Sync] Standalone "${channel.name}" failed: ${err.message}`);
        errorCount++;
      }
      continue;
    }

    // Plugin channels: try remote API first, fall back to yt-dlp
    if (channel.isPlugin) {
      try {
        // Extract pluginId from channel id (e.g., "ch-plugin-classic-nickelodeon" → "classic-nickelodeon")
        const pluginId = channel.id.replace(/^ch-plugin-/, '');
        let videos = null;

        // Try remote API first
        try {
          videos = await remoteClient.fetchPluginVideos(pluginId);
          if (videos && videos.length > 0) {
            // Preserve locally-marked dead videos so they don't get revived
            const localDeadIds = new Set(
              (channel.cachedVideos || []).filter((v) => v.isDead).map((v) => v.id)
            );

            channel.cachedVideos = videos
              .filter((v) => !localDeadIds.has(v.id))
              .map((v) => ({
                id: v.id,
                title: v.title || 'Untitled',
                description: v.description || '',
                duration: parseInt(v.duration, 10) || 0,
                thumbnailUrl: v.thumbnailUrl || '',
                lastVerified: Date.now(),
                isDead: false,
              }));
            channel.lastVideoSync = new Date().toISOString();
            console.log(`[Sync] Plugin "${channel.name}": ${channel.cachedVideos.length} videos from API`);
            pluginSyncedCount++;
            continue;
          }
        } catch {
          // API unavailable — fall back to yt-dlp
        }

        // Fallback: sync via yt-dlp directly
        const count = await syncPluginChannel(channel);
        console.log(`[Sync] Plugin "${channel.name}": ${count} videos via yt-dlp (API fallback)`);
        pluginSyncedCount++;
      } catch (err) {
        console.error(`[Sync] Plugin "${channel.name}" failed: ${err.message}`);
        errorCount++;
      }
      continue;
    }

    // Grid channels: sync from remote API
    let videos = memCache.get(channel.decade, channel.category);

    if (!videos) {
      try {
        videos = await remoteClient.fetchChannelVideos(channel.decade, channel.category);
        memCache.set(channel.decade, channel.category, videos);
      } catch (err) {
        console.error(`[Sync] Failed for ${channel.id}: ${err.message}`);
        errorCount++;
        continue;
      }
    }

    channel.cachedVideos = (videos || []).map((v) => ({
      id: v.id || v.videoId,
      title: v.title || 'Untitled',
      description: v.description || '',
      duration: parseInt(v.duration, 10) || 0,
      thumbnailUrl: v.thumbnailUrl || v.thumbnail || '',
      lastVerified: Date.now(),
      isDead: false,
    }));
    channel.lastVideoSync = new Date().toISOString();
    syncedCount++;
  }

  db.data.lastSync = new Date().toISOString();
  await db.write();

  console.log(
    `[Sync] Done. Grid: ${syncedCount}, Plugins: ${pluginSyncedCount}, Errors: ${errorCount}`
  );
  return { syncedCount, pluginSyncedCount, errorCount };
}

module.exports = { runDailySync };
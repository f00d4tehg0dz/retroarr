'use strict';

// LowDB v3 is the last CommonJS-compatible version.
// Provides a simple JSON file database for user configuration and
// cached video data. All runtime reads/writes go through this module.

const { Low, JSONFile } = require('lowdb');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { getDefaultSchema } = require('./schema');
const { buildChannelGrid } = require('../channels/channelGrid');
const { loadPlugins } = require('../plugins/pluginLoader');
const { fetchPluginChannels } = require('../api/remoteClient');

let db = null;

async function initDb() {
  // Ensure the directory for db.json exists
  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const adapter = new JSONFile(config.dbPath);
  db = new Low(adapter);

  // Read existing data (or null if file doesn't exist yet)
  await db.read();

  if (!db.data) {
    // First boot: seed with defaults
    db.data = getDefaultSchema();
    db.data.startEpoch = Date.now();
    await db.write();
    console.log('[DB] First boot — database initialized at', config.dbPath);
  } else if (!db.data.startEpoch) {
    // Migration: startEpoch missing or 0 from a previous version
    db.data.startEpoch = Date.now();
    await db.write();
    console.log('[DB] Migration: startEpoch was unset, initialized to', db.data.startEpoch);
  }

  // Reconcile channel grid + plugins: add new channels, remove stale ones,
  // preserve existing data (cachedVideos, settings, enabled) for channels that stay.
  if (db.data && db.data.channels) {
    const expectedGrid = buildChannelGrid();
    const localPlugins = loadPlugins();

    // Also fetch plugin channels from the remote API (non-blocking)
    let remotePlugins = [];
    try {
      const apiPlugins = await fetchPluginChannels();
      remotePlugins = apiPlugins
        .filter((p) => !localPlugins.some((lp) => lp.id === `plugin-${p.pluginId}`))
        .map((p) => ({
          id: `plugin-${p.pluginId}`,
          name: p.name,
          channelNumber: p.channelNumber,
          isPlugin: true,
          enabled: true,
          settings: p.settings || { shuffle: true, includeCommercials: false },
          cachedVideos: [],
          lastVideoSync: null,
          pluginConfig: { videoSources: [] },
        }));
    } catch {
      // API not available — continue with local plugins only
    }

    const pluginChannels = [...localPlugins, ...remotePlugins];
    const allExpected = [...expectedGrid, ...pluginChannels];
    const expectedIds = new Set(allExpected.map((c) => c.id));
    const existingMap = new Map(db.data.channels.map((c) => [c.id, c]));

    const reconciled = allExpected.map((expected) => {
      const existing = existingMap.get(expected.id);
      if (existing) {
        // Keep user data (cachedVideos, settings, enabled); refresh structural fields
        const merged = { ...existing, channelNumber: expected.channelNumber, name: expected.name };
        // For plugins, also refresh pluginConfig (YAML may have changed)
        if (expected.isPlugin) {
          merged.isPlugin = true;
          merged.pluginConfig = expected.pluginConfig;
        }
        return merged;
      }
      return expected;
    });

    const added = reconciled.filter((c) => !existingMap.has(c.id));
    const removed = db.data.channels.filter((c) => !expectedIds.has(c.id));

    if (added.length > 0 || removed.length > 0) {
      db.data.channels = reconciled;
      await db.write();
      const pluginCount = pluginChannels.length;
      console.log(`[DB] Channels reconciled: +${added.length} added, -${removed.length} removed (${pluginCount} plugins)`);
    }
  }

  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

module.exports = { initDb, getDb };
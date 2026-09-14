'use strict';

// Remote channel definitions — the API's /config is the single source of truth
// for which channels exist (grid, standalone, live). It is fetched at boot and
// on every sync, and the last good copy is cached in db.json so an instance
// that boots offline (or while the API is down) keeps its lineup instead of
// silently falling back to an older code-defined grid.
//
// REMOTE_CONFIG_MAX_AGE_HOURS (default 168 = 7 days): a cached copy older than
// this is still used, but a warning is logged so stale lineups are visible.

const remoteClient = require('../api/remoteClient');
const config = require('../config');

const MAX_AGE_MS = (parseInt(process.env.REMOTE_CONFIG_MAX_AGE_HOURS, 10) || 168) * 3600 * 1000;

/**
 * Refresh db.data.remoteConfig from the API. Returns the config to use
 * (fresh, cached, or null → local fallback) plus where it came from.
 */
async function refreshRemoteConfig(db) {
  if (!config.remoteApiUrl) {
    return { remoteConfig: null, source: 'local (REMOTE_API_URL not set)' };
  }

  try {
    const fresh = await remoteClient.fetchConfig();
    const stored = {
      fetchedAt: new Date().toISOString(),
      startEpoch: fresh.startEpoch,
      decades: fresh.decades,
      categories: fresh.categories,
      channelGrid: fresh.channelGrid,
      liveChannels: fresh.liveChannels || [],
      pluginChannels: fresh.pluginChannels || [],
    };
    db.data.remoteConfig = stored;
    return { remoteConfig: stored, source: 'api' };
  } catch (err) {
    const cached = db.data.remoteConfig;
    if (cached && Array.isArray(cached.channelGrid)) {
      const age = Date.now() - new Date(cached.fetchedAt || 0).getTime();
      const hours = Math.round(age / 3600000);
      if (age > MAX_AGE_MS) {
        console.warn(`[Channels] API unreachable (${err.message}); using cached lineup from ${hours}h ago`);
      }
      return { remoteConfig: cached, source: `cache (${hours}h old)` };
    }
    console.warn(`[Channels] API unreachable (${err.message}) and no cached lineup — using built-in grid`);
    return { remoteConfig: null, source: 'local (API unreachable)' };
  }
}

module.exports = { refreshRemoteConfig };

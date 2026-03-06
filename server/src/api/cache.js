'use strict';

// In-memory cache layer between remoteClient and the rest of the app.
// Reduces repeated API calls for the same decade+category within a session.
// The authoritative persistent cache is LowDB channel.cachedVideos[].
// This cache is just for request deduplication during a single server run.

const config = require('../config');

const store = new Map(); // key: `${decade}:${category}` → { data, expiresAt }

function cacheKey(decade, category) {
  return `${decade}:${category}`;
}

function get(decade, category) {
  const entry = store.get(cacheKey(decade, category));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(cacheKey(decade, category));
    return null;
  }
  return entry.data;
}

function set(decade, category, data) {
  store.set(cacheKey(decade, category), {
    data,
    expiresAt: Date.now() + config.cacheRefreshHours * 3600 * 1000,
  });
}

function invalidate(decade, category) {
  if (decade && category) {
    store.delete(cacheKey(decade, category));
  } else {
    store.clear();
  }
}

function size() {
  return store.size;
}

module.exports = { get, set, invalidate, size };
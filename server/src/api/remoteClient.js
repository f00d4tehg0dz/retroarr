'use strict';

// Read-only HTTP client for the user's VPS MongoDB API.
// RetroArr NEVER writes to the remote API — it only reads video metadata.
// The remote API is expected to return arrays of video objects per decade+category.

const axios = require('axios');
const config = require('../config');

function createClient() {
  return axios.create({
    baseURL: config.remoteApiUrl,
    timeout: 15000,
  });
}

// Fetch all videos for a specific decade + category combination.
// Expected response shape: [{ id, title, description, duration, thumbnailUrl }, ...]
async function fetchChannelVideos(decade, category) {
  if (!config.remoteApiUrl) {
    throw new Error('REMOTE_API_URL is not configured');
  }
  const client = createClient();
  const response = await client.get('/videos', {
    params: { decade, category },
  });
  return response.data;
}

// Fetch all videos in a YouTube playlist by playlist ID.
async function fetchPlaylistVideos(playlistId) {
  if (!config.remoteApiUrl) {
    throw new Error('REMOTE_API_URL is not configured');
  }
  const client = createClient();
  const response = await client.get(`/playlists/${playlistId}/videos`);
  return response.data;
}

// Health check: ping the remote API to verify connectivity.
async function pingRemoteApi() {
  if (!config.remoteApiUrl) return false;
  try {
    const client = createClient();
    await client.get('/health', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

module.exports = { fetchChannelVideos, fetchPlaylistVideos, pingRemoteApi };
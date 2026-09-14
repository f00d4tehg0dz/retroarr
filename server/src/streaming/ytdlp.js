'use strict';

// yt-dlp wrapper.
//
// Three jobs:
//   resolveYouTubeUrl(videoId)  → direct CDN input(s) for FFmpeg, WITH the HTTP
//                                 headers yt-dlp negotiated (User-Agent etc.).
//                                 YouTube 403s FFmpeg's default UA on many
//                                 formats, so passing headers through is what
//                                 makes playback reliable.
//   validateVideo(videoId)      → is the video still watchable?
//   listPlaylist(url)           → flat metadata for a playlist / channel / video
//
// yt-dlp is always spawned through spawnYtdlp() so the resolved binary, the
// optional python fallback, cookies, extra args and the JS runtime are applied
// uniformly. Every call has a hard timeout — a hung yt-dlp must never hang a
// tuner.

const { spawn } = require('child_process');
const config = require('../config');
const { findOnPath, probeVersion } = require('../binaries');

// Format selector per quality setting. Always ends in a bare "best" so that
// SOMETHING plays even when YouTube withholds mp4/m4a for a client.
const FORMAT_MAP = {
  '360p': 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]/best',
  '480p': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]/best',
  '720p': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]/best',
  '1080p': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]/best',
};

// ---------------------------------------------------------------------------
// Capability probe (once per process)
// ---------------------------------------------------------------------------
let probePromise = null;

function probe() {
  if (probePromise) return probePromise;
  probePromise = new Promise((resolve) => {
    const version = probeVersion(config.ytdlpPath, config.ytdlpPrefixArgs);
    const result = {
      ok: version.ok,
      version: version.version,
      error: version.error,
      supportsJsRuntimes: false,
      jsRuntimeArgs: [],
    };
    if (!version.ok) return resolve(result);

    const proc = spawn(config.ytdlpPath, [...config.ytdlpPrefixArgs, '--help'], { windowsHide: true });
    let out = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.stderr.on('data', (d) => (out += d.toString()));
    const timer = setTimeout(() => proc.kill(), 20000);
    proc.on('error', () => {
      clearTimeout(timer);
      resolve(result);
    });
    proc.on('close', () => {
      clearTimeout(timer);
      result.supportsJsRuntimes = out.includes('--js-runtimes');
      result.jsRuntimeArgs = pickJsRuntimeArgs(result.supportsJsRuntimes);
      resolve(result);
    });
  });
  return probePromise;
}

// Modern yt-dlp needs an external JavaScript runtime to solve YouTube's
// signature / n-parameter challenges. Deno is its default; Node (>= 22) is
// supported when explicitly enabled. We run inside Node, so if the node binary
// is reachable we opt it in as an *additional* runtime — harmless when Deno is
// also installed.
function pickJsRuntimeArgs(supported) {
  if (!supported) return [];
  const mode = config.ytdlpJsRuntime;
  if (mode === 'none') return ['--no-js-runtimes'];
  if (mode === 'deno') return []; // default behaviour
  if (mode === 'node' || mode === 'auto') {
    const major = parseInt(process.versions.node.split('.')[0], 10);
    const nodeBin = process.execPath || findOnPath('node');
    if (nodeBin && major >= 22) return ['--js-runtimes', `node:${nodeBin}`];
    if (mode === 'node') return ['--js-runtimes', 'node'];
    return [];
  }
  // Anything else is passed through verbatim (e.g. "quickjs")
  return ['--js-runtimes', mode];
}

function baseArgs(caps) {
  const args = [...config.ytdlpPrefixArgs, '--no-warnings', '--no-color', '--no-progress'];
  if (caps && caps.jsRuntimeArgs.length) args.push(...caps.jsRuntimeArgs);
  if (config.ytdlpCookies) args.push('--cookies', config.ytdlpCookies);
  if (config.ytdlpExtraArgs.length) args.push(...config.ytdlpExtraArgs);
  return args;
}

/**
 * Spawn yt-dlp with a hard timeout. Resolves { code, stdout, stderr, timedOut }.
 */
function runYtdlp(args, { timeoutMs, onLine } = {}) {
  timeoutMs = timeoutMs || config.ytdlpTimeoutMs;
  return new Promise((resolve, reject) => {
    let proc;
    try {
      proc = spawn(config.ytdlpPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      return reject(spawnError(err));
    }

    let stdout = '';
    let stderr = '';
    let buffer = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try { proc.kill('SIGKILL'); } catch {}
    }, timeoutMs);

    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      if (onLine) {
        buffer += text;
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) if (line.trim()) onLine(line);
      } else {
        stdout += text;
      }
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 20000) stderr = stderr.slice(-20000);
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(spawnError(err));
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (onLine && buffer.trim()) onLine(buffer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

function spawnError(err) {
  const e = new Error(
    `Failed to spawn yt-dlp (${config.ytdlpPath}): ${err.message}. ` +
      'Install yt-dlp or set YTDLP_PATH to a valid binary for this OS.'
  );
  e.code = 'SPAWN';
  e.permanent = false;
  return e;
}

// Classify yt-dlp stderr so callers can decide between "skip this video for
// good" and "temporary, retry later".
const PERMANENT_PATTERNS = [
  /video unavailable/i,
  /private video/i,
  /has been removed/i,
  /this video is not available/i,
  /no longer available/i,
  /video is unavailable/i,
  /members-only/i,
  /join this channel/i,
  /account associated with this video has been terminated/i,
  /copyright/i,
  /is not a valid url/i,
  /incomplete youtube id/i,
  /this live event/i,
  /premieres in/i,
  /is unavailable in your country/i,
  /blocked it in your country/i,
];

const BOT_PATTERNS = [/sign in to confirm/i, /not a bot/i, /confirm your age/i, /age-restricted/i, /login required/i];

function classify(stderr, timedOut) {
  const msg = (stderr || '').split('\n').filter((l) => /ERROR/i.test(l)).pop() || (stderr || '').trim().split('\n').pop() || '';
  if (timedOut) return { code: 'TIMEOUT', permanent: false, message: `yt-dlp timed out after ${config.ytdlpTimeoutMs}ms` };
  if (BOT_PATTERNS.some((re) => re.test(stderr))) {
    return {
      code: 'BOT_CHECK',
      permanent: false,
      message: `${msg} — YouTube is asking for a sign-in. Export browser cookies to a file and set YTDLP_COOKIES.`,
    };
  }
  if (PERMANENT_PATTERNS.some((re) => re.test(stderr))) return { code: 'UNAVAILABLE', permanent: true, message: msg };
  return { code: 'OTHER', permanent: false, message: msg || 'yt-dlp failed' };
}

function ytdlpError(result) {
  const info = classify(result.stderr, result.timedOut);
  const err = new Error(`yt-dlp exited ${result.code}: ${info.message}`);
  err.code = info.code;
  err.permanent = info.permanent;
  return err;
}

// Turn yt-dlp's per-format JSON into an FFmpeg input descriptor
function formatToInput(f) {
  const headers = { ...(f.http_headers || {}) };
  // FFmpeg sets these itself; forwarding them can break range handling
  delete headers['Accept-Encoding'];
  delete headers['accept-encoding'];
  return {
    url: f.url,
    headers,
    protocol: f.protocol || '',
    formatId: f.format_id || '',
    height: f.height || null,
    hasVideo: f.vcodec !== 'none',
    hasAudio: f.acodec !== 'none',
  };
}

/**
 * Resolve a YouTube video ID into FFmpeg inputs.
 *
 * @param {string} videoId
 * @param {string} [quality] — '360p' | '480p' | '720p' | '1080p'
 * @returns {Promise<{inputs: Array<{url, headers}>, isDash: boolean, title: string, duration: number}>}
 */
async function resolveYouTubeUrl(videoId, quality) {
  quality = quality || config.streamQuality || '720p';
  const formatString = FORMAT_MAP[quality] || FORMAT_MAP['720p'];
  const caps = await probe();

  const args = [
    ...baseArgs(caps),
    '--dump-single-json',
    '--no-playlist',
    '--skip-download',
    '-f', formatString,
    `https://www.youtube.com/watch?v=${videoId}`,
  ];

  const result = await runYtdlp(args);
  if (result.code !== 0 || !result.stdout.trim()) throw ytdlpError(result);

  let info;
  try {
    info = JSON.parse(result.stdout);
  } catch {
    const err = new Error('yt-dlp returned unparseable JSON');
    err.code = 'OTHER';
    throw err;
  }

  let inputs;
  if (Array.isArray(info.requested_formats) && info.requested_formats.length) {
    inputs = info.requested_formats.map(formatToInput);
  } else if (info.url) {
    inputs = [formatToInput(info)];
  } else {
    const err = new Error('yt-dlp returned no stream URL');
    err.code = 'OTHER';
    throw err;
  }

  return {
    inputs,
    isDash: inputs.length === 2,
    title: info.title || '',
    duration: parseInt(info.duration, 10) || 0,
    isLive: !!info.is_live,
  };
}

// Live streams: prefer a single muxed HLS rendition — one input, no DASH
// pairing, and FFmpeg can stream-copy it straight into MPEG-TS.
const LIVE_FORMAT_MAP = {
  '360p': 'best[height<=360][protocol^=m3u8]/best[height<=360]/best[protocol^=m3u8]/best',
  '480p': 'best[height<=480][protocol^=m3u8]/best[height<=480]/best[protocol^=m3u8]/best',
  '720p': 'best[height<=720][protocol^=m3u8]/best[height<=720]/best[protocol^=m3u8]/best',
  '1080p': 'best[height<=1080][protocol^=m3u8]/best[height<=1080]/best[protocol^=m3u8]/best',
};

/**
 * Resolve a YouTube LIVE stream into an FFmpeg input (usually an HLS URL).
 * Rejects with code 'OFFLINE' when the stream is not live right now.
 *
 * @param {string} videoId
 * @param {string} [quality]
 * @param {string} [fallbackChannelUrl] — YouTube channel URL; if the stored
 *        stream ended, <channel>/live is tried to find the current one.
 */
async function resolveLiveUrl(videoId, quality, fallbackChannelUrl) {
  quality = quality || config.streamQuality || '720p';
  const formatString = LIVE_FORMAT_MAP[quality] || LIVE_FORMAT_MAP['720p'];
  const caps = await probe();

  const attempt = async (url) => {
    const result = await runYtdlp([
      ...baseArgs(caps),
      '--dump-single-json',
      '--no-playlist',
      '--skip-download',
      '-f', formatString,
      url,
    ]);
    if (result.code !== 0 || !result.stdout.trim()) throw ytdlpError(result);
    let info;
    try {
      info = JSON.parse(result.stdout);
    } catch {
      const err = new Error('yt-dlp returned unparseable JSON');
      err.code = 'OTHER';
      throw err;
    }
    const isLive = info.is_live === true || info.live_status === 'is_live';
    if (!isLive) {
      const err = new Error(`stream ${info.id} is not live (${info.live_status || 'ended'})`);
      err.code = 'OFFLINE';
      err.permanent = false;
      throw err;
    }
    let inputs;
    if (Array.isArray(info.requested_formats) && info.requested_formats.length) inputs = info.requested_formats.map(formatToInput);
    else if (info.url) inputs = [formatToInput(info)];
    else {
      const err = new Error('yt-dlp returned no stream URL for live stream');
      err.code = 'OTHER';
      throw err;
    }
    return { inputs, isDash: inputs.length === 2, title: info.title || '', videoId: info.id, isLive: true, isHls: /m3u8/i.test(inputs[0].protocol || '') || /\.m3u8/i.test(inputs[0].url) };
  };

  try {
    return await attempt(`https://www.youtube.com/watch?v=${videoId}`);
  } catch (err) {
    if (err.code === 'OFFLINE' || err.code === 'UNAVAILABLE') {
      if (fallbackChannelUrl) {
        try {
          return await attempt(fallbackChannelUrl.replace(/\/+$/, '') + '/live');
        } catch (err2) {
          if (err2.code !== 'OFFLINE') throw err2;
        }
      }
      const e = new Error(`live stream ${videoId} is offline`);
      e.code = 'OFFLINE';
      e.permanent = false;
      throw e;
    }
    throw err;
  }
}

/**
 * Validate a YouTube video is still accessible without downloading.
 * @returns {Promise<boolean>}
 */
async function validateVideo(videoId) {
  const caps = await probe();
  try {
    const result = await runYtdlp(
      [...baseArgs(caps), '--simulate', '--quiet', '--no-playlist', `https://www.youtube.com/watch?v=${videoId}`],
      { timeoutMs: Math.min(config.ytdlpTimeoutMs, 60000) }
    );
    if (result.code === 0) return true;
    // Only treat *permanent* failures as dead. A bot-check, timeout or network
    // blip must not delete videos from the lineup.
    const info = classify(result.stderr, result.timedOut);
    return !info.permanent;
  } catch {
    return true; // spawn failure ≠ dead video
  }
}

// ---------------------------------------------------------------------------
// Playlist / channel listing
// ---------------------------------------------------------------------------

/**
 * Normalise a YouTube URL for flat listing:
 *   - channel pages (/@handle, /channel/ID, /c/name, /user/name) with no tab
 *     → append /videos so yt-dlp lists uploads instead of a tab index
 *   - playlist IDs / watch?v=…&list=… are passed through
 */
function normalizeSourceUrl(raw) {
  let url = String(raw || '').trim();
  if (!url) return url;
  if (/^PL|^UU|^OL|^FL|^RD/.test(url) && !/^https?:/i.test(url) && url.length > 10) {
    return `https://www.youtube.com/playlist?list=${url}`;
  }
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    if (!/(^|\.)youtube\.com$/i.test(u.hostname) && !/(^|\.)youtu\.be$/i.test(u.hostname)) return url;
    const p = u.pathname.replace(/\/+$/, '');
    const channelRe = /^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)$/;
    if (channelRe.test(p)) {
      u.pathname = `${p}/videos`;
      return u.toString();
    }
  } catch {
    // leave as-is
  }
  return url;
}

function entryToVideo(data) {
  const thumb =
    data.thumbnail ||
    (Array.isArray(data.thumbnails) && data.thumbnails.length ? data.thumbnails[data.thumbnails.length - 1].url : '') ||
    '';
  return {
    id: data.id,
    title: data.title || 'Untitled',
    description: (data.description || '').slice(0, 500),
    duration: Math.round(parseFloat(data.duration)) || 0,
    thumbnailUrl: thumb,
    uploader: data.uploader || data.channel || '',
    liveStatus: data.live_status || null,
  };
}

/**
 * List the videos of a playlist, channel or single video URL.
 *
 * @param {string} url
 * @param {{limit?: number}} [opts]
 * @returns {Promise<Array<{id,title,description,duration,thumbnailUrl}>>}
 */
async function listPlaylist(url, opts = {}) {
  const caps = await probe();
  const limit = opts.limit || config.ytdlpPlaylistLimit;
  const target = normalizeSourceUrl(url);
  const videos = [];
  const seen = new Set();

  const args = [
    ...baseArgs(caps),
    '--flat-playlist',
    '--dump-json',
    '--ignore-errors',
    '--playlist-end', String(limit),
    '--sleep-requests', '0.5',
    target,
  ];

  const result = await runYtdlp(args, {
    // Long playlists can take a while; scale the timeout with the limit.
    timeoutMs: Math.max(config.ytdlpTimeoutMs, 30000 + limit * 200),
    onLine: (line) => {
      let data;
      try {
        data = JSON.parse(line);
      } catch {
        return;
      }
      if (!data || !data.id) return;
      if (data._type === 'playlist') return;
      // Channel roots yield tab entries (Videos / Shorts / Live) as _type=url
      // pointing at another tab — we already normalised to /videos, skip these.
      if (data._type === 'url' && data.ie_key && /tab/i.test(data.ie_key)) return;
      if (!/^[A-Za-z0-9_-]{11}$/.test(data.id)) return;
      if (data.live_status === 'is_live' || data.live_status === 'is_upcoming') return;
      if (seen.has(data.id)) return;
      seen.add(data.id);
      videos.push(entryToVideo(data));
    },
  });

  if (!videos.length && result.code !== 0) throw ytdlpError(result);
  return videos;
}

module.exports = {
  resolveYouTubeUrl,
  resolveLiveUrl,
  validateVideo,
  listPlaylist,
  normalizeSourceUrl,
  probe,
  FORMAT_MAP,
};

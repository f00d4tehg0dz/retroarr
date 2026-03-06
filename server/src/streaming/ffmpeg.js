'use strict';

// FFmpeg pipeline: transcodes a YouTube CDN stream → MPEG-TS for HDHomeRun.
//
// Key design decisions:
//   - -ss BEFORE -i: fast keyframe-based seek (±10s accuracy acceptable for live TV)
//   - -reconnect flags: auto-reconnect if YouTube CDN drops the connection
//   - MPEG-TS output: required for HDHomeRun compatibility with Plex/Jellyfin
//   - DASH handling: if yt-dlp returned 2 URLs, pass both as separate -i inputs

const { spawn } = require('child_process');
const config = require('../config');

const SCALE_MAP = {
  '1080p': '1920:1080',
  '720p': '1280:720',
};

/**
 * Spawns FFmpeg to transcode a stream to MPEG-TS, piping output to a writable.
 *
 * @param {string[]} urls — 1 (progressive) or 2 (DASH) CDN URLs from yt-dlp
 * @param {number} seekSeconds — start position in seconds (0 = from beginning)
 * @param {import('stream').Writable} outputStream — HTTP response or passthrough
 * @returns {import('child_process').ChildProcess}
 */
function createStream(urls, seekSeconds, outputStream) {
  const isDash = Array.isArray(urls) && urls.length === 2;
  const videoUrl = urls[0];
  const audioUrl = isDash ? urls[1] : null;

  const scale = SCALE_MAP[config.streamQuality] || SCALE_MAP['720p'];

  const args = [];

  // -ss BEFORE each -i applies seek independently to each input stream.
  // For DASH (separate video + audio URLs), failing to seek the audio input
  // causes audio to start at t=0 while video jumps to seekSeconds — the
  // exact "audio from beginning, video mid-show" desync the user sees.
  const seekArgs = seekSeconds > 0 ? ['-ss', String(seekSeconds)] : [];

  args.push(
    ...seekArgs,
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-i', videoUrl
  );

  if (isDash && audioUrl) {
    args.push(
      ...seekArgs,          // seek audio to the same position as video
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-i', audioUrl,
      '-map', '0:v:0',
      '-map', '1:a:0'
    );
  }

  args.push(
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-vf', `scale=${scale}`,
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    // Regenerate PTS/DTS from scratch. YouTube DASH streams often have very large
    // PCR values (not starting near 0). Without this flag the browser's MSE sees
    // a discontinuity at every segment boundary, causing A/V desync and jumping.
    '-fflags', '+genpts',
    // Push any negative timestamps up so the stream starts at t=0. Required when
    // -ss (seek) produces audio frames with negative DTS values.
    '-avoid_negative_ts', 'make_zero',
    '-f', 'mpegts',
    '-muxdelay', '0',
    '-muxpreload', '0',
    'pipe:1' // write to stdout
  );

  const proc = spawn(config.ffmpegPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.stdout.pipe(outputStream, { end: false });

  proc.stderr.on('data', (d) => {
    // FFmpeg is chatty — only log actual errors (lines starting with 'Error')
    const line = d.toString();
    if (line.toLowerCase().includes('error') && !line.includes('Output')) {
      console.error('[FFmpeg]', line.trim());
    }
  });

  proc.on('error', (err) => {
    console.error('[FFmpeg] Process error:', err.message);
    outputStream.emit('ffmpegError', err);
  });

  proc.on('close', (code) => {
    outputStream.emit('videoEnd', code);
  });

  return proc;
}

/**
 * Transcode a local video file (e.g. a commercial) to MPEG-TS.
 *
 * @param {string} filePath — absolute path to local video file
 * @param {import('stream').Writable} outputStream
 * @returns {import('child_process').ChildProcess}
 */
function createLocalStream(filePath, outputStream) {
  const args = [
    '-i', filePath,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-f', 'mpegts',
    '-muxdelay', '0',
    'pipe:1',
  ];

  const proc = spawn(config.ffmpegPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.stdout.pipe(outputStream, { end: false });

  proc.on('error', (err) => {
    console.error('[FFmpeg] Local stream error:', err.message);
    outputStream.emit('ffmpegError', err);
  });

  proc.on('close', (code) => {
    outputStream.emit('videoEnd', code);
  });

  return proc;
}

module.exports = { createStream, createLocalStream };
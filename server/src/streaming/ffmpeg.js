'use strict';

// FFmpeg pipeline: transcodes a YouTube CDN stream → MPEG-TS for HDHomeRun.
//
// Key design decisions:
//   - -ss BEFORE -i: fast keyframe-based seek (±10s accuracy acceptable for live TV)
//   - -reconnect flags: auto-reconnect if YouTube CDN drops the connection
//   - Per-input -user_agent / -headers: the exact headers yt-dlp negotiated.
//     Google CDN 403s requests whose UA doesn't match the client that
//     obtained the URL — this is the #1 cause of "yt-dlp works, ffmpeg dies".
//   - MPEG-TS output: required for HDHomeRun compatibility with Plex/Jellyfin
//   - DASH handling: 2 inputs (video + audio) mapped explicitly

const { spawn } = require('child_process');
const config = require('../config');

const SCALE_MAP = {
  '360p': '640:360',
  '480p': '854:480',
  '720p': '1280:720',
  '1080p': '1920:1080',
};

function isHttp(url) {
  return /^https?:\/\//i.test(url);
}

// Build the per-input option block for one FFmpeg input.
function inputArgs(input, seekSeconds) {
  const args = [];
  if (seekSeconds > 0) args.push('-ss', String(seekSeconds));

  if (isHttp(input.url)) {
    args.push('-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5');
    const headers = input.headers || {};
    const ua = headers['User-Agent'] || headers['user-agent'];
    if (ua) args.push('-user_agent', ua);
    const headerLines = Object.entries(headers)
      .filter(([k]) => !/^user-agent$/i.test(k))
      .map(([k, v]) => `${k}: ${v}`);
    if (headerLines.length) args.push('-headers', headerLines.join('\r\n') + '\r\n');
  }

  args.push('-i', input.url);
  return args;
}

// Accept both the new descriptor ({inputs:[{url,headers}]}) and the legacy
// string[] of URLs so nothing else has to change at once.
function normalizeInputs(source) {
  if (Array.isArray(source)) return source.map((url) => ({ url, headers: {} }));
  if (source && Array.isArray(source.inputs)) return source.inputs;
  if (typeof source === 'string') return [{ url: source, headers: {} }];
  throw new Error('createStream: no inputs');
}

/**
 * Spawns FFmpeg to transcode a stream to MPEG-TS, piping output to a writable.
 *
 * Emits on outputStream:
 *   'videoEnd'    (code, { bytes, elapsedMs, stderrTail })
 *   'ffmpegError' (err)
 *
 * @param {object|string[]} source — resolver result or legacy URL list
 * @param {number} seekSeconds — start position in seconds (0 = from beginning)
 * @param {import('stream').Writable} outputStream — HTTP response or passthrough
 * @returns {import('child_process').ChildProcess}
 */
function createStream(source, seekSeconds, outputStream) {
  const inputs = normalizeInputs(source);
  const scale = SCALE_MAP[config.streamQuality] || SCALE_MAP['720p'];
  const args = ['-hide_banner', '-nostdin', '-loglevel', 'error'];

  // -ss BEFORE each -i applies the seek independently to each input. For DASH
  // (separate video + audio URLs), failing to seek the audio input causes
  // audio from t=0 under video from seekSeconds.
  for (const input of inputs) args.push(...inputArgs(input, seekSeconds));

  if (inputs.length >= 2) {
    args.push('-map', '0:v:0', '-map', '1:a:0');
  } else {
    args.push('-map', '0:v:0?', '-map', '0:a:0?');
  }

  args.push(
    '-sn', '-dn',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-vf', `scale=${scale}:force_original_aspect_ratio=decrease,pad=${scale}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
    // Regenerate PTS/DTS from scratch. YouTube DASH streams often have very large
    // PCR values (not starting near 0). Without this flag MSE/Plex sees a
    // discontinuity at every segment boundary, causing A/V desync and jumping.
    '-fflags', '+genpts',
    // Push any negative timestamps up so the stream starts at t=0. Required when
    // -ss (seek) produces audio frames with negative DTS values.
    '-avoid_negative_ts', 'make_zero',
    '-max_muxing_queue_size', '1024',
    '-f', 'mpegts',
    '-muxdelay', '0',
    '-muxpreload', '0',
    'pipe:1'
  );

  return spawnFfmpeg(args, outputStream);
}

/**
 * Relay a LIVE stream (YouTube HLS) to MPEG-TS.
 *
 * mode 'copy'      — no re-encode: near-zero CPU, exactly what YouTube sends
 *                    (h264/aac in TS segments, which is HDHomeRun-compatible)
 * mode 'transcode' — same libx264 pipeline as VOD, for players that choke on
 *                    the copied stream or when the source isn't h264/aac
 *
 * The stream manager tries copy first and falls back to transcode if copy
 * dies within a few seconds.
 */
function createLiveStream(source, outputStream, mode) {
  const inputs = normalizeInputs(source);
  const scale = SCALE_MAP[config.streamQuality] || SCALE_MAP['720p'];
  const args = ['-hide_banner', '-nostdin', '-loglevel', 'error'];

  for (const input of inputs) {
    if (isHttp(input.url)) {
      const headers = input.headers || {};
      const ua = headers['User-Agent'] || headers['user-agent'];
      if (ua) args.push('-user_agent', ua);
      const headerLines = Object.entries(headers)
        .filter(([k]) => !/^user-agent$/i.test(k))
        .map(([k, v]) => `${k}: ${v}`);
      if (headerLines.length) args.push('-headers', headerLines.join('\r\n') + '\r\n');
      // Live HLS: start near the live edge, keep re-reading the playlist
      args.push('-live_start_index', '-3', '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5');
    }
    args.push('-i', input.url);
  }

  if (inputs.length >= 2) args.push('-map', '0:v:0', '-map', '1:a:0');
  else args.push('-map', '0:v:0?', '-map', '0:a:0?');
  args.push('-sn', '-dn');

  if (mode === 'transcode') {
    args.push(
      '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
      '-vf', `scale=${scale}:force_original_aspect_ratio=decrease,pad=${scale}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2'
    );
  } else {
    args.push('-c:v', 'copy', '-c:a', 'copy');
  }

  args.push(
    '-fflags', '+genpts',
    '-avoid_negative_ts', 'make_zero',
    '-max_muxing_queue_size', '1024',
    '-f', 'mpegts',
    '-muxdelay', '0',
    '-muxpreload', '0',
    'pipe:1'
  );

  return spawnFfmpeg(args, outputStream);
}

/**
 * Transcode a local video file (e.g. a commercial) to MPEG-TS.
 */
function createLocalStream(filePath, outputStream) {
  const scale = SCALE_MAP[config.streamQuality] || SCALE_MAP['720p'];
  const args = [
    '-hide_banner', '-nostdin', '-loglevel', 'error',
    '-re',
    '-i', filePath,
    '-map', '0:v:0?', '-map', '0:a:0?',
    '-sn', '-dn',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-vf', `scale=${scale}:force_original_aspect_ratio=decrease,pad=${scale}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
    '-fflags', '+genpts',
    '-avoid_negative_ts', 'make_zero',
    '-f', 'mpegts',
    '-muxdelay', '0',
    '-muxpreload', '0',
    'pipe:1',
  ];
  return spawnFfmpeg(args, outputStream);
}

function spawnFfmpeg(args, outputStream) {
  const startedAt = Date.now();
  let bytes = 0;
  let stderrTail = '';

  const proc = spawn(config.ffmpegPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  proc.stdout.on('data', (chunk) => {
    bytes += chunk.length;
  });
  proc.stdout.pipe(outputStream, { end: false });

  proc.stderr.on('data', (d) => {
    const line = d.toString();
    stderrTail = (stderrTail + line).slice(-2000);
    console.error('[FFmpeg]', line.trim());
  });

  let ended = false;
  const end = (code, tail) => {
    if (ended) return;
    ended = true;
    outputStream.emit('videoEnd', code, { bytes, elapsedMs: Date.now() - startedAt, stderrTail: tail });
  };

  proc.on('error', (err) => {
    console.error('[FFmpeg] Process error:', err.message);
    outputStream.emit('ffmpegError', err);
    // Depending on the Node version 'close' may or may not follow a spawn
    // failure — surface exactly one videoEnd either way.
    setImmediate(() => end(-1, err.message));
  });

  proc.on('close', (code) => end(code, stderrTail));

  return proc;
}

module.exports = { createStream, createLiveStream, createLocalStream };

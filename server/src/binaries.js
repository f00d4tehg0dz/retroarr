'use strict';

// Cross-platform external binary resolution for yt-dlp, ffmpeg and ffprobe.
//
// Why this exists: a Windows-only path (C:/.../yt-dlp_x86.exe) once leaked into
// the Docker image via a stray server/.env and every spawn() on Linux failed
// with ENOENT. Resolution is now defensive:
//
//   1. Explicit env var (YTDLP_PATH / YT_DLP_PATH, FFMPEG_PATH, FFPROBE_PATH)
//      — used only if it actually exists on THIS machine. A Windows drive-letter
//      path on Linux/macOS (or any path that does not exist) is rejected with a
//      loud warning and we fall through to auto-detection instead of dying.
//   2. Well-known local locations (repo ./scripts, ./server/bin, /usr/local/bin).
//   3. Anything on PATH (honouring PATHEXT on Windows).
//   4. For yt-dlp only: `python3 -m yt_dlp` if the module is importable.
//
// The result is { command, prefixArgs, source, warnings[] } so callers can
// spawn(command, [...prefixArgs, ...args]) without caring how it was found.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const IS_WIN = process.platform === 'win32';
const REPO_ROOT = path.resolve(__dirname, '../..');
const SERVER_ROOT = path.resolve(__dirname, '..');

function isWindowsStylePath(p) {
  return /^[A-Za-z]:[\\/]/.test(p) || /^\\\\/.test(p);
}

function isExecutableFile(p) {
  try {
    const st = fs.statSync(p);
    if (!st.isFile()) return false;
    if (!IS_WIN) fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function windowsExts() {
  const raw = process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM';
  return ['', ...raw.split(';').filter(Boolean)];
}

// Find `name` on PATH. On Windows tries every PATHEXT extension.
function findOnPath(name) {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const exts = IS_WIN ? windowsExts() : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      if (isExecutableFile(candidate)) return candidate;
    }
  }
  return null;
}

// Check an explicit user-supplied path. Returns { ok, resolved, warning }.
function checkExplicitPath(label, value) {
  if (!value) return { ok: false };
  const trimmed = String(value).trim().replace(/^"(.*)"$/, '$1');
  if (!trimmed) return { ok: false };

  if (!IS_WIN && isWindowsStylePath(trimmed)) {
    return {
      ok: false,
      warning: `${label}="${trimmed}" is a Windows path but this is ${os.platform()} — ignoring it and auto-detecting instead.`,
    };
  }

  // Bare command name (no slashes) → PATH lookup
  if (!trimmed.includes('/') && !trimmed.includes('\\')) {
    const found = findOnPath(trimmed);
    if (found) return { ok: true, resolved: found };
    return { ok: false, warning: `${label}="${trimmed}" was not found on PATH — auto-detecting instead.` };
  }

  const abs = path.resolve(trimmed);
  if (isExecutableFile(abs)) return { ok: true, resolved: abs };
  if (IS_WIN) {
    for (const ext of windowsExts()) {
      if (ext && isExecutableFile(abs + ext)) return { ok: true, resolved: abs + ext };
    }
  }
  return { ok: false, warning: `${label}="${trimmed}" does not exist on this machine — auto-detecting instead.` };
}

function firstExisting(candidates) {
  for (const c of candidates) {
    if (c && isExecutableFile(c)) return c;
  }
  return null;
}

const LOCAL_DIRS = [
  path.join(REPO_ROOT, 'scripts'),
  path.join(REPO_ROOT, 'bin'),
  path.join(SERVER_ROOT, 'bin'),
  path.join(SERVER_ROOT, 'scripts'),
];
const SYSTEM_DIRS = IS_WIN ? [] : ['/usr/local/bin', '/usr/bin', '/opt/homebrew/bin', '/opt/local/bin', '/snap/bin'];

function candidatesIn(dirs, baseNames) {
  const exts = IS_WIN ? windowsExts() : [''];
  const out = [];
  for (const dir of dirs) {
    for (const name of baseNames) {
      for (const ext of exts) out.push(path.join(dir, name + ext));
    }
  }
  return out;
}

// Search repo-local dirs, then well-known system dirs, then PATH.
function autoDetect(baseNames) {
  const local = firstExisting(candidatesIn(LOCAL_DIRS, baseNames));
  if (local) return { command: local, source: 'local' };
  const system = firstExisting(candidatesIn(SYSTEM_DIRS, baseNames));
  if (system) return { command: system, source: 'system' };
  for (const name of baseNames) {
    const found = findOnPath(name);
    if (found) return { command: found, source: 'PATH' };
  }
  return null;
}

function pythonYtDlpFallback() {
  const pythons = IS_WIN ? ['python', 'py', 'python3'] : ['python3', 'python'];
  for (const py of pythons) {
    const exe = findOnPath(py);
    if (!exe) continue;
    try {
      const r = spawnSync(exe, ['-m', 'yt_dlp', '--version'], { encoding: 'utf8', timeout: 15000 });
      if (r.status === 0) return { command: exe, prefixArgs: ['-m', 'yt_dlp'] };
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Resolve yt-dlp.
 * @returns {{command:string, prefixArgs:string[], source:string, warnings:string[]}}
 */
function resolveYtDlp() {
  const warnings = [];
  const envValue = process.env.YTDLP_PATH || process.env.YT_DLP_PATH;

  const explicit = checkExplicitPath('YTDLP_PATH', envValue);
  if (explicit.ok) return { command: explicit.resolved, prefixArgs: [], source: 'env', warnings };
  if (explicit.warning) warnings.push(explicit.warning);

  const names = IS_WIN
    ? ['yt-dlp', 'yt-dlp_x86', 'yt-dlp_x64', 'yt-dlp_win', 'yt-dlp_min']
    : ['yt-dlp', 'yt-dlp_linux', 'yt-dlp_linux_aarch64', 'yt-dlp_linux_armv7l', 'yt-dlp_macos'];

  const found = autoDetect(names);
  if (found) return { command: found.command, prefixArgs: [], source: found.source, warnings };

  const py = pythonYtDlpFallback();
  if (py) return { ...py, source: 'python -m yt_dlp', warnings };

  warnings.push(
    'yt-dlp could not be found. Install it (https://github.com/yt-dlp/yt-dlp#installation) or set YTDLP_PATH. Streams will fail until it is available.'
  );
  return { command: 'yt-dlp', prefixArgs: [], source: 'missing', warnings };
}

/**
 * Resolve ffmpeg (and ffprobe next to it).
 */
function resolveFfmpeg() {
  const warnings = [];
  const explicit = checkExplicitPath('FFMPEG_PATH', process.env.FFMPEG_PATH);
  let ffmpeg = null;
  let source = 'missing';

  if (explicit.ok) {
    ffmpeg = explicit.resolved;
    source = 'env';
  } else {
    if (explicit.warning) warnings.push(explicit.warning);
    const found = autoDetect(['ffmpeg']);
    if (found) {
      ffmpeg = found.command;
      source = found.source;
    }
  }

  if (!ffmpeg) {
    warnings.push('ffmpeg could not be found. Install it or set FFMPEG_PATH. Streams will fail until it is available.');
    ffmpeg = 'ffmpeg';
  }

  // ffprobe: explicit, else sibling of ffmpeg, else PATH
  let ffprobe = null;
  const explicitProbe = checkExplicitPath('FFPROBE_PATH', process.env.FFPROBE_PATH);
  if (explicitProbe.ok) {
    ffprobe = explicitProbe.resolved;
  } else {
    if (explicitProbe.warning) warnings.push(explicitProbe.warning);
    const sibling = path.join(path.dirname(ffmpeg), IS_WIN ? 'ffprobe.exe' : 'ffprobe');
    if (source !== 'missing' && isExecutableFile(sibling)) ffprobe = sibling;
    else ffprobe = findOnPath('ffprobe') || 'ffprobe';
  }

  return { command: ffmpeg, ffprobe, source, warnings };
}

/**
 * Run `<binary> --version` (or -version for ffmpeg/ffprobe) synchronously.
 * Used at boot and by /api/debug.
 * @returns {{ok:boolean, version:string|null, error?:string}}
 */
function probeVersion(command, prefixArgs, versionFlag) {
  // yt-dlp wants --version; ffmpeg/ffprobe want -version (they print the
  // banner but exit non-zero on --version).
  const flag = versionFlag || (/ffmpeg|ffprobe/i.test(String(command)) ? '-version' : '--version');
  try {
    const r = spawnSync(command, [...(prefixArgs || []), flag], {
      encoding: 'utf8',
      timeout: 20000,
      windowsHide: true,
    });
    if (r.error) return { ok: false, version: null, error: r.error.message };
    const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
    const firstLine = out.split(/\r?\n/)[0] || '';
    // ffmpeg prints "ffmpeg version 6.1.1 ..." — keep it short
    const m = firstLine.match(/version\s+(\S+)/i);
    return { ok: r.status === 0, version: m ? m[1] : firstLine.slice(0, 80), error: r.status === 0 ? undefined : firstLine };
  } catch (err) {
    return { ok: false, version: null, error: err.message };
  }
}

module.exports = {
  resolveYtDlp,
  resolveFfmpeg,
  probeVersion,
  findOnPath,
  isWindowsStylePath,
  IS_WIN,
  REPO_ROOT,
};

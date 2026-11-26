'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const https = require('node:https');
const crypto = require('node:crypto');
const { execFile, spawn } = require('node:child_process');
const { createHardware } = require('./hardware-main');
const savesStore = require('./saves');

// Permite que as rádios comecem junto com o launcher, sem exigir um clique
// antes (o Chromium bloqueia áudio automático por padrão).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// ---------------------------------------------------------------------------
// Caminhos e constantes
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.join(__dirname, 'app');
const DATA_DIR = path.join(__dirname, 'data');
const CACHE_DIR = path.join(DATA_DIR, 'cache');
const TMP_DIR = path.join(DATA_DIR, 'tmp');
const LOGS_DIR = path.join(DATA_DIR, 'logs');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const TRACKER_CACHE = path.join(CACHE_DIR, 'tracker.json');
const FORKS_CACHE = path.join(CACHE_DIR, 'forks.json');
const ICON_ICO = path.join(APP_DIR, 'assets', 'icon.ico');
const ICON_PNG = path.join(APP_DIR, 'assets', 'icon.png');

const SITE_URL = 'https://portwatch-vi.xyz/';
const TRACKER_REPO = '4lwayz/portwatch-vi';
const TRACKER_GITHUB = `https://github.com/${TRACKER_REPO}`;
const TRACKER_RAW = `https://raw.githubusercontent.com/${TRACKER_REPO}/main/data/tracker.json`;
const FORKS_API = `https://api.github.com/repos/${TRACKER_REPO}/forks?per_page=100&sort=newest`;
const UA = 'PortWatch-Hub/2.0 (+https://portwatch-vi.xyz)';

const DEFAULT_DOWNLOADS = path.join(__dirname, 'Downloads');
const DEXNOM_SETUP_FILE = 'Setup-DexNomRuntime.ps1';
const DEXNOM_PLAYER = 'victory-play.exe';
const DEXNOM_SETUP_LOG = path.join(LOGS_DIR, 'dexnom-setup.log');
const MSVC_INSTALL_LOG = path.join(LOGS_DIR, 'msvc-install.log');
const VS_BUILDTOOLS_URL = 'https://aka.ms/vs/17/release/vs_BuildTools.exe';

const DEFAULTS = {
  language: null,
  theme: 'vice',
  downloadsDir: DEFAULT_DOWNLOADS,
  refreshMinutes: 5,
  githubToken: '',
  uiSounds: true,
  radioOn: true,
  radioStation: 'neon',
  musicVolume: 55,
  startFullscreen: false,
  reduceMotion: false,
  gameExe: '',
  runtimeFork: '',
  runtimeSources: {},
  forkInstalls: {},
  dexnomSource: '',
  dexnomRuntime: '',
  dexnomInstallDir: '',
  msvcDir: '',
  dexnomRayTracing: false,
};

const CONFIG_KEYS = Object.keys(DEFAULTS);

const MAIN_I18N = {
  'pt-BR': {
    chooseDownloads: 'Escolher pasta de downloads',
    pickDownloadFolder: 'Escolha onde salvar esta fork',
    chooseGameExe: 'Escolha o executável do GTA VI (Xbox Series X|S)',
    chooseForkFolder: 'Escolha a pasta da fork DexNom',
    chooseInstallDir: 'Escolha onde instalar o runtime DexNom',
    chooseMsvcDir: 'Escolha a pasta do Visual Studio Build Tools',
    chooseSaveZip: 'Escolha o ZIP do save do jogo',
    chooseSaveFolder: 'Escolha a pasta do save do jogo',
    saveZipFilter: 'Save do jogo (ZIP)',
    downloadFailed: 'Não foi possível baixar o projeto.',
    extractFailed: 'O download terminou, mas não foi possível extrair o ZIP.',
    invalidRepo: 'Repositório inválido.',
  },
  en: {
    chooseDownloads: 'Choose downloads folder',
    pickDownloadFolder: 'Choose where to save this fork',
    chooseGameExe: 'Choose the GTA VI executable (Xbox Series X|S)',
    chooseForkFolder: 'Choose the DexNom fork folder',
    chooseInstallDir: 'Choose where to install the DexNom runtime',
    chooseMsvcDir: 'Choose the Visual Studio Build Tools folder',
    chooseSaveZip: 'Choose the game save ZIP',
    chooseSaveFolder: 'Choose the game save folder',
    saveZipFilter: 'Game save (ZIP)',
    downloadFailed: 'Could not download the project.',
    extractFailed: 'The download finished, but the ZIP could not be extracted.',
    invalidRepo: 'Invalid repository.',
  },
  es: {
    chooseDownloads: 'Elegir carpeta de descargas',
    pickDownloadFolder: 'Elige dónde guardar esta fork',
    chooseGameExe: 'Elige el ejecutable de GTA VI (Xbox Series X|S)',
    chooseForkFolder: 'Elige la carpeta de la fork DexNom',
    chooseInstallDir: 'Elige dónde instalar el runtime DexNom',
    chooseMsvcDir: 'Elige la carpeta de Visual Studio Build Tools',
    chooseSaveZip: 'Elige el ZIP del save del juego',
    chooseSaveFolder: 'Elige la carpeta del save del juego',
    saveZipFilter: 'Save del juego (ZIP)',
    downloadFailed: 'No se pudo descargar el proyecto.',
    extractFailed: 'La descarga terminó, pero no se pudo extraer el ZIP.',
    invalidRepo: 'Repositorio inválido.',
  },
};

let win = null;
let cfg = { ...DEFAULTS };

const hardware = createHardware({
  root: ROOT,
  getConfig: () => cfg,
  defaultDownloads: DEFAULT_DOWNLOADS,
});

function mt(key) {
  const lang = cfg.language && MAIN_I18N[cfg.language] ? cfg.language : 'pt-BR';
  return (MAIN_I18N[lang] && MAIN_I18N[lang][key]) || MAIN_I18N['pt-BR'][key] || key;
}

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

function ensureDirs() {
  for (const dir of [DATA_DIR, CACHE_DIR, TMP_DIR, LOGS_DIR]) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      /* sem permissão: segue com defaults em memória */
    }
  }
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function sanitizeConfig(patch) {
  const next = { ...patch };
  if (next.theme !== 'losSantos') next.theme = 'vice';
  if (next.refreshMinutes != null) {
    next.refreshMinutes = clampNumber(next.refreshMinutes, 1, 60, DEFAULTS.refreshMinutes);
  }
  if (next.musicVolume != null) {
    next.musicVolume = clampNumber(next.musicVolume, 0, 100, DEFAULTS.musicVolume);
  }
  if (next.downloadsDir != null && typeof next.downloadsDir !== 'string') {
    next.downloadsDir = DEFAULT_DOWNLOADS;
  }
  for (const key of ['gameExe', 'runtimeFork', 'dexnomSource', 'dexnomRuntime', 'dexnomInstallDir', 'msvcDir']) {
    if (next[key] != null && typeof next[key] !== 'string') next[key] = '';
  }
  for (const key of ['runtimeSources', 'forkInstalls']) {
    const value = next[key];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      next[key] = {};
      continue;
    }
    const clean = {};
    for (const [id, dir] of Object.entries(value)) {
      if (typeof dir === 'string' && dir.trim()) clean[String(id)] = dir;
    }
    next[key] = clean;
  }
  if (next.dexnomRayTracing != null) next.dexnomRayTracing = Boolean(next.dexnomRayTracing);
  if (next.githubToken != null) next.githubToken = String(next.githubToken).slice(0, 300);
  return next;
}

function loadConfig() {
  ensureDirs();
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const merged = { ...DEFAULTS };
    for (const key of CONFIG_KEYS) {
      if (Object.prototype.hasOwnProperty.call(raw, key)) merged[key] = raw[key];
    }
    return sanitizeConfig(merged);
  } catch {
    return { ...DEFAULTS };
  }
}

function saveConfig(patch) {
  const merged = { ...cfg };
  for (const key of CONFIG_KEYS) {
    if (patch && Object.prototype.hasOwnProperty.call(patch, key)) {
      merged[key] = patch[key];
    }
  }
  cfg = sanitizeConfig(merged);
  try {
    ensureDirs();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (err) {
    console.error('Falha ao salvar config:', err.message);
  }
  return cfg;
}

// ---------------------------------------------------------------------------
// HTTP / cache
// ---------------------------------------------------------------------------

function request(url, { headers = {}, timeout = 25000, redirects = 6 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': UA,
          Accept: 'application/json, text/plain, */*',
          ...headers,
        },
      },
      (res) => {
        if (
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location &&
          redirects > 0
        ) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          resolve(request(next, { headers, timeout, redirects: redirects - 1 }));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          })
        );
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
  });
}

function readCache(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeCache(file, value) {
  try {
    ensureDirs();
    fs.writeFileSync(file, JSON.stringify(value), 'utf8');
  } catch {
    /* cache é opcional */
  }
}

function githubHeaders(extra = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...extra,
  };
  if (cfg.githubToken) headers.Authorization = `Bearer ${cfg.githubToken}`;
  return headers;
}

let trackerCache = null;
let trackerTask = null;

async function fetchTracker(force = false) {
  if (!force && trackerCache && Date.now() - trackerCache.fetchedAt < 60 * 1000) {
    return trackerCache;
  }
  if (trackerTask) return trackerTask;

  trackerTask = (async () => {
    try {
      const res = await request(TRACKER_RAW, { headers: { 'Cache-Control': 'no-cache' } });
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const data = JSON.parse(res.body.toString('utf8'));
      if (!data || !Array.isArray(data.efforts)) throw new Error('tracker inválido');
      trackerCache = {
        ok: true,
        data,
        fetchedAt: Date.now(),
        updated: data.updated || null,
        source: TRACKER_RAW,
        cached: false,
      };
      writeCache(TRACKER_CACHE, { fetchedAt: trackerCache.fetchedAt, data });
      return trackerCache;
    } catch (err) {
      if (trackerCache) {
        return { ...trackerCache, cached: true, stale: true, error: String(err.message || err) };
      }
      const disk = readCache(TRACKER_CACHE);
      if (disk && disk.data && Array.isArray(disk.data.efforts)) {
        trackerCache = {
          ok: true,
          data: disk.data,
          fetchedAt: Number(disk.fetchedAt) || 0,
          updated: disk.data.updated || null,
          source: TRACKER_RAW,
          cached: true,
          stale: true,
          error: String(err.message || err),
        };
        return trackerCache;
      }
      return { ok: false, error: String(err.message || err) };
    } finally {
      trackerTask = null;
    }
  })();

  return trackerTask;
}

let forksCache = null;
let forksTask = null;

async function fetchForks(force = false) {
  if (!force && forksCache && Date.now() - forksCache.fetchedAt < 10 * 60 * 1000) {
    return forksCache;
  }
  if (forksTask) return forksTask;

  forksTask = (async () => {
    try {
      const all = [];
      for (let page = 1; page <= 3; page += 1) {
        const res = await request(`${FORKS_API}&page=${page}`, { headers: githubHeaders() });
        if (res.status === 403 || res.status === 429) {
          throw new Error(`GitHub API ${res.status} (rate limit)`);
        }
        if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
        const list = JSON.parse(res.body.toString('utf8'));
        if (!Array.isArray(list)) throw new Error('resposta inválida');
        all.push(...list);
        if (list.length < 100) break;
      }
      const forks = all
        .filter((repo) => repo && repo.full_name)
        .map((repo) => ({
          fullName: repo.full_name,
          name: repo.name,
          owner: repo.owner ? repo.owner.login : String(repo.full_name).split('/')[0],
          url: repo.html_url,
          description: repo.description || '',
          stars: Number(repo.stargazers_count) || 0,
          forks: Number(repo.forks_count) || 0,
          pushedAt: repo.pushed_at || null,
          branch: repo.default_branch || 'main',
          archived: Boolean(repo.archived),
          disabled: Boolean(repo.disabled),
        }))
        .sort((a, b) => Date.parse(b.pushedAt || 0) - Date.parse(a.pushedAt || 0));

      forksCache = {
        ok: true,
        forks,
        fetchedAt: Date.now(),
        cached: false,
        count: forks.length,
      };
      writeCache(FORKS_CACHE, { fetchedAt: forksCache.fetchedAt, forks });
      return forksCache;
    } catch (err) {
      if (forksCache) {
        return { ...forksCache, cached: true, stale: true, error: String(err.message || err) };
      }
      const disk = readCache(FORKS_CACHE);
      if (disk && Array.isArray(disk.forks)) {
        forksCache = {
          ok: true,
          forks: disk.forks,
          fetchedAt: Number(disk.fetchedAt) || 0,
          cached: true,
          stale: true,
          count: disk.forks.length,
          error: String(err.message || err),
        };
        return forksCache;
      }
      return { ok: false, error: String(err.message || err) };
    } finally {
      forksTask = null;
    }
  })();

  return forksTask;
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function safeName(value) {
  return (
    String(value || '')
      .replace(/[^\w.-]+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 80) || 'repo'
  );
}

function sendDownload(payload) {
  if (win && !win.isDestroyed()) win.webContents.send('download:progress', payload);
}

function downloadFile(url, dest, onProgress, headers = {}, redirects = 6) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': UA, Accept: 'application/octet-stream', ...headers } },
      (res) => {
        if (
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location &&
          redirects > 0
        ) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          resolve(downloadFile(next, dest, onProgress, headers, redirects - 1));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const total = Number(res.headers['content-length']) || 0;
        let received = 0;
        let lastSent = 0;
        const file = fs.createWriteStream(dest);
        res.on('data', (chunk) => {
          received += chunk.length;
          const now = Date.now();
          if (onProgress && now - lastSent > 220) {
            lastSent = now;
            onProgress(received, total);
          }
        });
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve({ received, total })));
        file.on('error', reject);
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.setTimeout(90000, () => req.destroy(new Error('timeout')));
  });
}

function extractZip(zipPath, destination) {
  const quotedZip = zipPath.replace(/'/g, "''");
  const quotedDest = destination.replace(/'/g, "''");
  const script =
    "$ErrorActionPreference='Stop'; " +
    `Expand-Archive -LiteralPath '${quotedZip}' -DestinationPath '${quotedDest}' -Force`;
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: 300000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) reject(new Error(String(stderr || err.message).trim()));
        else resolve(String(stdout || '').trim());
      }
    );
  });
}

function flattenExtracted(dir) {
  try {
    const entries = fs.readdirSync(dir).filter((name) => name !== '__MACOSX');
    if (entries.length !== 1) return;
    const inner = path.join(dir, entries[0]);
    if (!fs.statSync(inner).isDirectory()) return;
    for (const child of fs.readdirSync(inner)) {
      fs.renameSync(path.join(inner, child), path.join(dir, child));
    }
    fs.rmdirSync(inner);
  } catch {
    /* mantém a pasta como veio */
  }
}

async function downloadRepo({ repo, branch, name, dir } = {}) {
  if (typeof repo !== 'string' || !REPO_RE.test(repo)) {
    return { ok: false, error: 'invalid', detail: mt('invalidRepo') };
  }

  const label = safeName(name || repo.split('/')[1]);
  const baseDir =
    typeof dir === 'string' && dir.trim()
      ? path.resolve(dir)
      : path.resolve(cfg.downloadsDir || DEFAULT_DOWNLOADS);
  const destination = path.join(baseDir, label);
  const zipPath = path.join(TMP_DIR, `${label}-${Date.now()}.zip`);
  ensureDirs();
  fs.mkdirSync(path.dirname(destination), { recursive: true });

  const urls = [];
  if (branch) {
    urls.push(`https://codeload.github.com/${repo}/zip/refs/heads/${encodeURIComponent(branch)}`);
  }
  if (!branch || branch !== 'main') {
    urls.push(`https://codeload.github.com/${repo}/zip/refs/heads/main`);
  }
  if (!branch || branch !== 'master') {
    urls.push(`https://codeload.github.com/${repo}/zip/refs/heads/master`);
  }
  urls.push(`https://api.github.com/repos/${repo}/zipball`);

  sendDownload({ repo, phase: 'download', percent: 0, received: 0, total: 0 });
  let lastError = null;
  let downloaded = false;

  for (const url of urls) {
    try {
      fs.rmSync(zipPath, { force: true });
      const isApi = url.includes('api.github.com');
      await downloadFile(
        url,
        zipPath,
        (received, total) => {
          const percent = total > 0 ? Math.min(99, Math.round((received / total) * 100)) : 0;
          sendDownload({ repo, phase: 'download', percent, received, total });
        },
        isApi ? githubHeaders({ Accept: 'application/vnd.github+json' }) : {}
      );
      downloaded = true;
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!downloaded) {
    fs.rmSync(zipPath, { force: true });
    sendDownload({ repo, phase: 'error', percent: 0 });
    return {
      ok: false,
      error: 'download',
      detail: `${mt('downloadFailed')} ${lastError ? String(lastError.message || lastError) : ''}`.trim(),
    };
  }

  sendDownload({ repo, phase: 'extract', percent: 100 });
  try {
    fs.mkdirSync(destination, { recursive: true });
    await extractZip(zipPath, destination);
    flattenExtracted(destination);
    const source = victorySourceIn(destination);
    if (source) {
      const profile = buildForkProfile(source);
      saveConfig({
        runtimeFork: profile.id,
        runtimeSources: { ...(cfg.runtimeSources || {}), [profile.id]: source },
      });
    }
    fs.rmSync(zipPath, { force: true });
    sendDownload({ repo, phase: 'done', percent: 100 });
    return { ok: true, path: destination, name: label, repo };
  } catch (err) {
    fs.rmSync(zipPath, { force: true });
    sendDownload({ repo, phase: 'error', percent: 0 });
    return {
      ok: false,
      error: 'extract',
      detail: `${mt('extractFailed')} ${String(err.message || err)}`.trim(),
    };
  }
}

function listDownloads() {
  try {
    const dir = cfg.downloadsDir || DEFAULT_DOWNLOADS;
    if (!fs.existsSync(dir)) return { ok: true, dir, items: [] };
    const items = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const full = path.join(dir, entry.name);
        let mtime = null;
        try {
          mtime = fs.statSync(full).mtime.toISOString();
        } catch {
          /* ignore */
        }
        return { name: entry.name, path: full, mtime };
      })
      .sort((a, b) => Date.parse(b.mtime || 0) - Date.parse(a.mtime || 0));
    return { ok: true, dir, items };
  } catch (err) {
    return { ok: false, error: String(err.message || err), items: [] };
  }
}

function openDownloaded(name) {
  const dir = path.resolve(cfg.downloadsDir || DEFAULT_DOWNLOADS);
  const target = path.resolve(dir, safeName(name));
  if (!target.startsWith(dir + path.sep)) return Promise.resolve({ ok: false, error: 'path' });
  if (!fs.existsSync(target)) return Promise.resolve({ ok: false, missing: true, path: target });
  return shell.openPath(target).then((error) => (error ? { ok: false, error } : { ok: true }));
}

// ---------------------------------------------------------------------------
// DexNom Runtime — preparar e jogar
// ---------------------------------------------------------------------------

let dexnomSetup = null;
let dexnomGame = null;
let msvcInstall = null;
let savesBusy = false;

function isFile(target) {
  try {
    return Boolean(target) && fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

function isDir(target) {
  try {
    return Boolean(target) && fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function sendToWindow(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function sendSetup(payload) {
  sendToWindow('dexnom:setup', payload);
}

function sendGame(payload) {
  sendToWindow('dexnom:game', payload);
}

function sendMsvc(payload) {
  sendToWindow('dexnom:msvc', payload);
}

function execText(file, args, timeout = 15000) {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { timeout, windowsHide: true, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          stdout: String(stdout || '').trim(),
          stderr: String(stderr || '').trim(),
          error: err ? String(err.message || err) : '',
        });
      }
    );
  });
}

function forkSlug(dir) {
  return (
    path
      .basename(path.resolve(dir))
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'fork'
  );
}

function forkId(dir) {
  const hash = crypto.createHash('sha1').update(path.resolve(dir).toLowerCase()).digest('hex').slice(0, 6);
  return `${forkSlug(dir)}-${hash}`;
}

function forkDisplayName(dir) {
  const base = path.basename(path.resolve(dir));
  const match = /^([a-z0-9][a-z0-9._-]*?)-(.+)$/i.exec(base);
  if (match && match[1].toLowerCase() !== 'setup') return `${match[1]}/${match[2]}`;
  return base;
}

function isDexnomSource(source, setupScript) {
  return /dexnom/i.test(path.basename(source)) || /dexnom/i.test(setupScript || '');
}

function victorySourceIn(dir) {
  if (!isDir(dir)) return null;
  if (isFile(path.join(dir, '.victory-root'))) return path.resolve(dir);
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const matches = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const child = path.join(dir, entry.name);
    if (isFile(path.join(child, '.victory-root'))) matches.push(child);
  }
  return matches.length === 1 ? path.resolve(matches[0]) : null;
}

function setupScriptIn(dir) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return '';
  }
  const scripts = entries
    .filter((entry) => entry.isFile() && /^setup.*\.ps1$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => {
      const dexnom = /dexnom/i.test(a) ? 0 : 1;
      const other = /dexnom/i.test(b) ? 0 : 1;
      return dexnom - other || a.localeCompare(b);
    });
  return scripts.length ? path.join(dir, scripts[0]) : '';
}

function playScriptIn(dir) {
  const script = path.join(dir, 'scripts', 'play.ps1');
  return isFile(script) ? script : '';
}

function builtVictoryExe(dir, consoleOnly = false) {
  const names = consoleOnly ? ['victory.exe'] : ['victory-play.exe', 'victory.exe'];
  const folders = ['target\\diag', 'target\\release', ''];
  for (const folder of folders) {
    for (const name of names) {
      const exe = path.join(dir, folder, name);
      if (isFile(exe)) return exe;
    }
  }
  return '';
}

function hasVictoryRoot(dir) {
  let current = path.resolve(dir);
  for (;;) {
    if (isFile(path.join(current, '.victory-root'))) return true;
    const parent = path.dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

function forkCandidateDirs() {
  const candidates = [];
  const seen = new Set();
  const add = (dir) => {
    if (!dir) return;
    const resolved = path.resolve(dir);
    const key = resolved.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(resolved);
  };

  for (const root of [cfg.downloadsDir || DEFAULT_DOWNLOADS, DEFAULT_DOWNLOADS]) {
    add(root);
    try {
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory()) add(path.join(root, entry.name));
      }
    } catch {
      /* pasta de downloads ainda não existe */
    }
  }
  add(cfg.dexnomSource);
  for (const dir of Object.values(cfg.runtimeSources || {})) add(dir);
  return candidates;
}

function setupInstallTarget(id, source, setupScript) {
  const chosen = cfg.forkInstalls && cfg.forkInstalls[id];
  if (chosen) return path.resolve(chosen);
  if (isDexnomSource(source, setupScript)) {
    if (cfg.dexnomInstallDir) return path.resolve(cfg.dexnomInstallDir);
    if (cfg.dexnomRuntime) return path.resolve(cfg.dexnomRuntime);
  }
  const local = process.env.LOCALAPPDATA || '';
  const name = forkDisplayName(source)
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return local ? path.join(local, `${name || 'VIctory'} Runtime`) : '';
}

function victoryDataDir() {
  const local = process.env.LOCALAPPDATA || '';
  return local ? path.join(local, 'victory', 'data') : '';
}

function victoryCacheDir() {
  const local = process.env.LOCALAPPDATA || '';
  return local ? path.join(local, 'victory', 'cache') : '';
}

function forkLogPath(profile) {
  if (profile && isDexnomSource(profile.sourceDir, profile.setupScript)) return DEXNOM_SETUP_LOG;
  if (!profile) return path.join(LOGS_DIR, 'runtime-setup.log');
  return path.join(LOGS_DIR, `${profile.id}-setup.log`);
}

function buildForkProfile(source) {
  const setupScript = setupScriptIn(source);
  const playScript = playScriptIn(source);
  const builtExe = builtVictoryExe(source);
  let strategy = 'build';
  if (setupScript) strategy = 'setup';
  else if (playScript) strategy = 'script';
  else if (builtExe) strategy = 'exe';

  const id = forkId(source);
  const installDir = strategy === 'setup' ? setupInstallTarget(id, source, setupScript) : '';
  const dataDir = strategy === 'setup' ? path.join(installDir, 'state') : victoryDataDir();
  const cacheDir = strategy === 'setup' ? path.join(installDir, 'cache') : victoryCacheDir();
  const scriptBuild = isFile(path.join(source, 'target', 'diag', 'victory.exe'))
    ? 'diag'
    : isFile(path.join(source, 'target', 'release', 'victory.exe'))
      ? 'release'
      : '';

  return {
    id,
    name: forkDisplayName(source),
    folder: path.basename(source),
    sourceDir: source,
    strategy,
    setupScript,
    playScript,
    builtExe,
    scriptBuild,
    installDir,
    dataDir,
    cacheDir,
    logPath: forkLogPath({ id, sourceDir: source, setupScript }),
  };
}

function runtimeProfiles() {
  const profiles = [];
  const seen = new Set();
  for (const candidate of forkCandidateDirs()) {
    const source = victorySourceIn(candidate);
    if (!source) continue;
    const key = source.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    profiles.push(buildForkProfile(source));
  }
  profiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return profiles;
}

function profileRuntime(profile) {
  if (!profile) return null;
  if (profile.strategy === 'setup') {
    if (!profile.installDir) return null;
    for (const name of [DEXNOM_PLAYER, 'victory-play.exe', 'victory.exe']) {
      const exe = path.join(profile.installDir, name);
      if (isFile(exe)) return { dir: profile.installDir, exe, kind: 'installed' };
    }
    return null;
  }
  const exe =
    profile.strategy === 'script'
      ? builtVictoryExe(profile.sourceDir, true)
      : profile.builtExe || builtVictoryExe(profile.sourceDir);
  if (!exe) return null;
  return {
    dir: path.dirname(exe),
    exe,
    kind: profile.strategy === 'script' ? 'script' : 'exe',
    playScript: profile.playScript || '',
    buildProfile: profile.scriptBuild || '',
    dataDir: profile.dataDir,
    cacheDir: profile.cacheDir,
  };
}

function selectedRuntimeProfile(profiles) {
  const list = profiles || runtimeProfiles();
  if (!list.length) return null;
  if (cfg.runtimeFork) {
    const chosen = list.find((profile) => profile.id === cfg.runtimeFork);
    if (chosen) return chosen;
  }
  if (cfg.dexnomSource) {
    const source = path.resolve(cfg.dexnomSource).toLowerCase();
    const legacy = list.find((profile) => profile.sourceDir.toLowerCase() === source);
    if (legacy) return legacy;
  }
  const ready = list.find((profile) => profileRuntime(profile));
  return ready || list[0];
}

function findDexnomSource() {
  const profile = runtimeProfiles().find((item) => isDexnomSource(item.sourceDir, item.setupScript));
  return profile ? profile.sourceDir : null;
}

function dexnomGameExe() {
  return isFile(cfg.gameExe) && /\.exe$/i.test(cfg.gameExe) ? cfg.gameExe : '';
}

function dexnomInstallTarget() {
  const profile = runtimeProfiles().find((item) => isDexnomSource(item.sourceDir, item.setupScript));
  if (profile) return profile.installDir;
  const local = process.env.LOCALAPPDATA || '';
  const chosen = cfg.dexnomInstallDir ? path.resolve(cfg.dexnomInstallDir) : '';
  if (chosen) return chosen;
  return local ? path.join(local, 'DexNom Runtime') : '';
}

function dexnomRuntime() {
  return profileRuntime(selectedRuntimeProfile());
}

async function checkRust() {
  const cargo = await execText('where.exe', ['cargo']);
  const rustup = await execText('where.exe', ['rustup']);
  if (!cargo.ok || !rustup.ok) {
    return {
      ok: false,
      cargo: cargo.ok ? cargo.stdout.split(/\r?\n/)[0] : '',
      rustup: rustup.ok ? rustup.stdout.split(/\r?\n/)[0] : '',
    };
  }
  let version = '';
  const info = await execText('cargo', ['--version']);
  if (info.ok) version = info.stdout.split(/\r?\n/)[0];
  return {
    ok: true,
    version,
    cargo: cargo.stdout.split(/\r?\n/)[0],
    rustup: rustup.stdout.split(/\r?\n/)[0],
  };
}

function msvcInfoFromRoot(root, source) {
  if (!root) return null;
  const resolved = path.resolve(root);
  const tools = path.join(resolved, 'VC', 'Tools', 'MSVC');
  let entries = [];
  try {
    entries = fs.readdirSync(tools, { withFileTypes: true });
  } catch {
    return null;
  }
  const versions = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  const vcvars = path.join(resolved, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat');
  for (const version of versions) {
    const link = path.join(tools, version, 'bin', 'Hostx64', 'x64', 'link.exe');
    const runtime = path.join(tools, version, 'include', 'vcruntime.h');
    if (isFile(link) && isFile(runtime)) {
      return {
        root: resolved,
        version,
        link,
        vcvars: isFile(vcvars) ? vcvars : '',
        source,
      };
    }
  }
  return null;
}

function msvcRootFromPath(target) {
  if (!target) return null;
  let current = path.resolve(target);
  for (let depth = 0; depth < 10; depth += 1) {
    const info = msvcInfoFromRoot(current, 'manual');
    if (info) return info;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function vsInstancePaths() {
  const base = path.join(
    process.env.ProgramData || 'C:\\ProgramData',
    'Microsoft',
    'VisualStudio',
    'Packages',
    '_Instances'
  );
  let entries = [];
  try {
    entries = fs.readdirSync(base, { withFileTypes: true });
  } catch {
    return [];
  }
  const instances = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = path.join(base, entry.name, 'state.json');
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const root = data.resolvedInstallationPath || data.installationPath;
      if (!root) continue;
      const date = Date.parse(data.installDate || data.updateDate || '') || 0;
      instances.push({ root, date });
    } catch {
      /* estado ilegível: segue para os outros candidatos */
    }
  }
  instances.sort((a, b) => b.date - a.date);
  return instances.map((item) => item.root);
}

function windowsSdkInfo() {
  const roots = [];
  const seen = new Set();
  const add = (dir) => {
    if (!dir) return;
    const resolved = path.resolve(dir);
    const key = resolved.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    roots.push(resolved);
  };
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  add(process.env.WindowsSdkDir);
  add(path.join(pf86, 'Windows Kits', '10'));
  add(path.join(pf, 'Windows Kits', '10'));

  for (const root of roots) {
    const libRoot = path.join(root, 'Lib');
    let entries = [];
    try {
      entries = fs.readdirSync(libRoot, { withFileTypes: true });
    } catch {
      continue;
    }
    const versions = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const version of versions) {
      const kernel = path.join(libRoot, version, 'um', 'x64', 'kernel32.lib');
      const ucrt = path.join(libRoot, version, 'ucrt', 'x64', 'ucrt.lib');
      if (isFile(kernel) && isFile(ucrt)) {
        return { sdk: true, version, root };
      }
    }
  }
  return { sdk: false, version: '', root: '' };
}

async function checkMsvc() {
  const candidates = [];
  const seen = new Set();
  const add = (root, source) => {
    if (!root) return;
    let resolved;
    try {
      resolved = path.resolve(root);
    } catch {
      return;
    }
    const key = resolved.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ root: resolved, source });
  };

  if (cfg.msvcDir) add(cfg.msvcDir, 'manual');

  const vswhere = path.join(
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    'Microsoft Visual Studio',
    'Installer',
    'vswhere.exe'
  );
  if (isFile(vswhere)) {
    const result = await execText(vswhere, [
      '-all',
      '-products',
      '*',
      '-requires',
      'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
      '-property',
      'installationPath',
    ]);
    if (result.ok && result.stdout) {
      for (const line of result.stdout.split(/\r?\n/)) add(line.trim(), 'vswhere');
    }
  }

  for (const root of vsInstancePaths()) add(root, 'state');

  const programDirs = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles].filter(Boolean);
  for (const base of programDirs) {
    for (const year of ['2022', '2019']) {
      for (const edition of ['BuildTools', 'Community', 'Professional', 'Enterprise']) {
        add(path.join(base, 'Microsoft Visual Studio', year, edition), 'path');
      }
    }
  }

  if (process.env.VSINSTALLDIR) add(process.env.VSINSTALLDIR, 'env');
  if (process.env.VCINSTALLDIR) add(path.dirname(path.resolve(process.env.VCINSTALLDIR)), 'env');
  if (process.env.VCToolsInstallDir) {
    add(path.resolve(process.env.VCToolsInstallDir, '..', '..', '..', '..'), 'env');
  }

  const whereLink = await execText('where.exe', ['link.exe']);
  if (whereLink.ok && whereLink.stdout) {
    for (const line of whereLink.stdout.split(/\r?\n/)) {
      const dir = path.dirname(line.trim());
      const match = /^(.*)\\VC\\Tools\\MSVC\\[^\\]+\\bin\\Hostx64\\x64$/i.exec(dir);
      if (match) add(match[1], 'path');
    }
  }

  let best = null;
  for (const candidate of candidates) {
    const info = msvcInfoFromRoot(candidate.root, candidate.source);
    if (info) {
      best = info;
      break;
    }
  }

  const sdk = windowsSdkInfo();
  return {
    ok: Boolean(best),
    path: best ? best.root : '',
    link: best ? best.link : '',
    vcvars: best ? best.vcvars : '',
    version: best ? best.version : '',
    source: best ? best.source : '',
    sdk: sdk.sdk,
    sdkVersion: sdk.version,
    sdkRoot: sdk.root,
  };
}

function freeSpaceGB(dir) {
  try {
    const stats = fs.statfsSync(dir);
    return Math.round((stats.bavail * stats.bsize) / 1024 ** 3);
  } catch {
    return null;
  }
}

async function runtimeStatus() {
  const profiles = runtimeProfiles();
  const selected = selectedRuntimeProfile(profiles);
  const runtime = profileRuntime(selected);
  const gameExe = dexnomGameExe();
  const installDir = selected ? (selected.strategy === 'setup' ? selected.installDir : selected.dataDir) : '';
  const installExists = isDir(installDir);
  const installOverride =
    Boolean(selected) &&
    selected.strategy === 'setup' &&
    Boolean(
      (cfg.forkInstalls && cfg.forkInstalls[selected.id]) ||
        (isDexnomSource(selected.sourceDir, selected.setupScript) &&
          (cfg.dexnomInstallDir || cfg.dexnomRuntime))
    );
  const [rust, msvc] = await Promise.all([checkRust(), checkMsvc()]);

  return {
    ok: true,
    platform: process.platform,
    forks: profiles.map((profile) => {
      const ready = profileRuntime(profile);
      return {
        id: profile.id,
        name: profile.name,
        folder: profile.folder,
        sourceDir: profile.sourceDir,
        strategy: profile.strategy,
        setupScript: profile.setupScript,
        playScript: profile.playScript,
        builtExe: profile.builtExe,
        installDir: profile.installDir,
        dataDir: profile.dataDir,
        cacheDir: profile.cacheDir,
        logPath: profile.logPath,
        ready: Boolean(ready),
        runtime: ready ? { dir: ready.dir, exe: ready.exe, kind: ready.kind } : null,
      };
    }),
    selectedId: selected ? selected.id : '',
    strategy: selected ? selected.strategy : '',
    source: selected
      ? { dir: selected.sourceDir, setup: selected.setupScript, playScript: selected.playScript }
      : null,
    gameExe,
    installDir,
    installKind: selected && selected.strategy === 'setup' ? 'install' : 'data',
    installExists,
    installDefault: !installOverride,
    runtime: runtime
      ? {
          dir: runtime.dir,
          exe: runtime.exe,
          kind: runtime.kind,
          playScript: runtime.playScript || '',
          dataDir: runtime.dataDir || '',
          cacheDir: runtime.cacheDir || '',
        }
      : null,
    rust,
    msvc,
    diskFreeGB: freeSpaceGB(
      (selected && selected.sourceDir) || installDir || cfg.downloadsDir || DEFAULT_DOWNLOADS
    ),
    systemFreeGB: freeSpaceGB(process.env.SystemDrive ? `${process.env.SystemDrive}\\` : 'C:\\'),
    setup: dexnomSetup
      ? { running: true, startedAt: dexnomSetup.startedAt, lines: dexnomSetup.lines.slice(-600) }
      : { running: false },
    game: dexnomGame ? { running: true, pid: dexnomGame.pid } : { running: false },
    msvcInstall: msvcInstall
      ? { running: true, startedAt: msvcInstall.startedAt, lines: msvcInstall.lines.slice(-200) }
      : { running: false },
    msvcLogPath: MSVC_INSTALL_LOG,
    msvcLogExists: fs.existsSync(MSVC_INSTALL_LOG),
    rt: Boolean(cfg.dexnomRayTracing),
    logPath: selected ? selected.logPath : path.join(LOGS_DIR, 'runtime-setup.log'),
  };
}

async function dexnomStatus() {
  return runtimeStatus();
}

// ---------------------------------------------------------------------------
// Saves do jogo (runtime selecionado)
// ---------------------------------------------------------------------------

const DEXNOM_TITLE_FALLBACK = '7952987A';

function dexnomTitleId() {
  const exe = dexnomGameExe();
  if (!exe) return DEXNOM_TITLE_FALLBACK;
  const file = path.join(path.dirname(exe), 'MicrosoftGame.config');
  try {
    const text = fs.readFileSync(file, 'utf8');
    const match = /<TitleId>\s*([0-9a-f]{8})\s*<\/TitleId>/i.exec(text);
    if (match) return match[1].toUpperCase();
  } catch {
    /* config ausente: usa o TitleId conhecido */
  }
  return DEXNOM_TITLE_FALLBACK;
}

function dexnomSavesPaths() {
  const profile = selectedRuntimeProfile();
  const dataDir = profile
    ? profile.dataDir
    : dexnomInstallTarget()
      ? path.join(dexnomInstallTarget(), 'state')
      : '';
  const titleId = dexnomTitleId();
  const titleDir = dataDir ? path.join(dataDir, titleId) : '';
  const savesDir = titleDir ? path.join(titleDir, 'saves') : '';
  const backupsDir = titleDir ? path.join(titleDir, 'saves-backups') : '';
  const xuid = savesStore.detectXuid(savesDir);
  return {
    installDir: dataDir,
    dataDir,
    titleId,
    titleDir,
    savesDir,
    backupsDir,
    xuid,
    userDir: savesDir ? path.join(savesDir, xuid) : '',
  };
}

async function dexnomGameActive() {
  if (dexnomGame) return true;
  const profile = selectedRuntimeProfile();
  const runtime = profileRuntime(profile);
  if (!profile || !runtime) return false;
  const script =
    "Get-Process -Name victory,victory-play -ErrorAction SilentlyContinue | ForEach-Object { $_.Path }";
  const result = await execText(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
    8000
  );
  if (!result.ok || !result.stdout) return false;
  const targets = new Set([
    runtime.exe.toLowerCase(),
    path.join(runtime.dir, DEXNOM_PLAYER).toLowerCase(),
  ]);
  const roots = [profile.sourceDir, runtime.dir]
    .filter(Boolean)
    .map((dir) => path.resolve(dir).toLowerCase() + path.sep);
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .some((line) => targets.has(line) || roots.some((root) => line.startsWith(root)));
}

async function savesStatus() {
  const profile = selectedRuntimeProfile();
  const paths = dexnomSavesPaths();
  const runtime = dexnomRuntime();
  const gameRunning = await dexnomGameActive();
  const configs = savesStore.listConfigs(paths.savesDir, paths.xuid);
  const backups = savesStore.listBackups(paths.backupsDir);
  let totalBytes = 0;
  let containerCount = 0;
  let modified = 0;
  for (const config of configs) {
    totalBytes += config.bytes;
    containerCount += config.containers.length;
    modified = Math.max(modified, config.modified);
  }
  return {
    ok: true,
    titleId: paths.titleId,
    installDir: paths.installDir,
    savesDir: paths.savesDir,
    backupsDir: paths.backupsDir,
    xuid: paths.xuid,
    exists: isDir(paths.savesDir),
    fork: profile ? { id: profile.id, name: profile.name, strategy: profile.strategy } : null,
    runtime: runtime ? { dir: runtime.dir, exe: runtime.exe } : null,
    gameExe: dexnomGameExe(),
    gameRunning,
    setupRunning: Boolean(dexnomSetup),
    busy: savesBusy,
    configs,
    backups,
    totalBytes,
    containerCount,
    modified,
    quotaBytes: savesStore.SAVE_MAX_BYTES,
    maxBackups: savesStore.SAVE_BACKUP_LIMIT,
  };
}

function appendSetupLog(line, logPath = DEXNOM_SETUP_LOG) {
  try {
    fs.appendFileSync(logPath, line + '\r\n', 'utf8');
  } catch {
    /* log é opcional */
  }
}

function killTree(pid) {
  if (!pid) return;
  execFile('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => {});
}

function startMsvcInstall() {
  ensureDirs();
  const scriptPath = path.join(TMP_DIR, 'install-msvc.ps1');
  const logPath = MSVC_INSTALL_LOG.replace(/'/g, "''");
  const script = `$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$log = '${logPath}'
function Log([string]$Message) {
  [IO.File]::AppendAllText($log, $Message + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
  Write-Output $Message
}
Log 'Baixando o instalador oficial do Visual Studio Build Tools...'
$installer = Join-Path $env:TEMP 'vs_BuildTools_PortWatch.exe'
try {
  Invoke-WebRequest -Uri '${VS_BUILDTOOLS_URL}' -OutFile $installer -UseBasicParsing -TimeoutSec 180
  $sig = Get-AuthenticodeSignature -FilePath $installer
  if (-not $sig.SignerCertificate -or $sig.SignerCertificate.Subject -notmatch 'Microsoft') {
    throw 'O instalador baixado nao tem assinatura da Microsoft.'
  }
  if ($sig.Status -eq 'HashMismatch' -or $sig.Status -eq 'NotSigned') {
    throw "Assinatura digital invalida: $($sig.Status)"
  }
  Log 'Assinatura digital verificada. O Windows vai pedir permissao de administrador.'
  Log 'Instalando a carga C++ e o Windows SDK. Pode levar de 10 a 30 minutos...'
  $arguments = @('--quiet','--wait','--norestart','--nocache','--add','Microsoft.VisualStudio.Workload.VCTools','--includeRecommended')
  $process = Start-Process -FilePath $installer -ArgumentList $arguments -Verb RunAs -Wait -PassThru
  if ($process.ExitCode -eq 3010) {
    Log 'Instalacao concluida. Reinicie o Windows para finalizar.'
    exit 0
  }
  if ($process.ExitCode -ne 0) {
    throw "O instalador saiu com codigo $($process.ExitCode)."
  }
  Log 'Instalacao concluida com sucesso.'
  exit 0
} catch {
  Log "ERRO: $($_.Exception.Message)"
  exit 1
} finally {
  Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue
}
`;

  fs.writeFileSync(scriptPath, '\ufeff' + script, 'utf8');
  try {
    fs.writeFileSync(
      MSVC_INSTALL_LOG,
      `PortWatch Hub - instalacao do Visual Studio Build Tools\r\n${new Date().toISOString()}\r\n\r\n`,
      'utf8'
    );
  } catch {
    /* o script tambem grava o log */
  }

  const child = spawn(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
    { windowsHide: true, env: { ...process.env } }
  );
  const run = { child, startedAt: Date.now(), lines: [], finished: false };
  msvcInstall = run;
  sendMsvc({ type: 'start', at: run.startedAt });

  let buffer = '';
  const onChunk = (chunk) => {
    buffer += chunk.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const parts = buffer.split('\n');
    buffer = parts.pop();
    for (const raw of parts) {
      const line = raw.replace(/\u0000/g, '').trimEnd();
      if (!line) continue;
      run.lines.push(line);
      if (run.lines.length > 300) run.lines.shift();
      sendMsvc({ type: 'line', line });
    }
  };
  child.stdout.on('data', onChunk);
  child.stderr.on('data', onChunk);

  const finish = (payload) => {
    if (run.finished) return;
    run.finished = true;
    if (buffer.trim()) {
      const line = buffer.trim();
      run.lines.push(line);
      sendMsvc({ type: 'line', line });
    }
    if (msvcInstall === run) msvcInstall = null;
    sendMsvc(payload);
  };

  child.on('error', (err) => {
    const detail = String(err && err.message ? err.message : err);
    try {
      fs.appendFileSync(MSVC_INSTALL_LOG, detail + '\r\n', 'utf8');
    } catch {
      /* log opcional */
    }
    finish({ type: 'error', error: detail, tail: run.lines.slice(-14).join('\n') });
  });

  child.on('close', (code) => {
    if (code === 0) {
      finish({ type: 'done', code, lines: run.lines.slice(-30) });
      return;
    }
    finish({
      type: 'error',
      code,
      tail: run.lines.slice(-14).join('\n'),
      detail: `O instalador terminou com codigo ${code}.`,
    });
  });
}

function mergeEnv(base, extra) {
  const merged = { ...base };
  const keys = new Map(Object.keys(merged).map((key) => [key.toLowerCase(), key]));
  for (const [key, value] of Object.entries(extra || {})) {
    const lower = key.toLowerCase();
    const previous = keys.get(lower);
    if (previous && previous !== key) delete merged[previous];
    merged[key] = value;
    keys.set(lower, key);
  }
  return merged;
}

async function vcvarsEnvironment(vcvars) {
  if (!vcvars || !isFile(vcvars)) return null;
  const result = await execText(
    'cmd.exe',
    ['/d', '/c', 'call', vcvars, '&&', 'set'],
    30000
  );
  if (!result.ok || !result.stdout) return null;
  const env = {};
  for (const line of result.stdout.split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index > 0) env[line.slice(0, index)] = line.slice(index + 1);
  }
  return Object.keys(env).length ? env : null;
}

async function runtimeBuildEnv(msvc, logPath) {
  if (!msvc || !msvc.vcvars) {
    if (msvc) appendSetupLog('AVISO: vcvars64.bat nao encontrado; usando o PATH atual.', logPath);
    return { ...process.env };
  }
  const extra = await vcvarsEnvironment(msvc.vcvars);
  if (!extra) {
    appendSetupLog('AVISO: nao foi possivel carregar o ambiente do Build Tools.', logPath);
    return { ...process.env };
  }
  return mergeEnv(process.env, extra);
}

function writeRuntimeLog(logPath, title, details) {
  ensureDirs();
  try {
    fs.writeFileSync(
      logPath,
      `PortWatch Hub - ${title}\r\n${new Date().toISOString()}\r\n${details.join('\r\n')}\r\n\r\n`,
      'utf8'
    );
  } catch {
    /* segue sem arquivo de log */
  }
}

function startRuntimeProcess(profile, command, args, options) {
  const run = {
    child: null,
    canceled: false,
    startedAt: Date.now(),
    lines: [],
    logPath: profile.logPath,
    profileId: profile.id,
    phase: options.phase,
  };
  const child = spawn(command, args, {
    cwd: options.cwd,
    windowsHide: true,
    env: options.env,
  });
  run.child = child;
  dexnomSetup = run;
  sendSetup({ type: 'start', at: run.startedAt, fork: profile.id, phase: options.phase });

  let buffer = '';
  const onChunk = (stream) => (chunk) => {
    buffer += chunk.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const parts = buffer.split('\n');
    buffer = parts.pop();
    for (const raw of parts) {
      const line = raw
        .replace(/\u001b\[[0-9;]*m/g, '')
        .replace(/\u0000/g, '')
        .trimEnd();
      if (!line) continue;
      run.lines.push(line);
      if (run.lines.length > 400) run.lines.shift();
      appendSetupLog(line, run.logPath);
      sendSetup({ type: 'line', stream, line, fork: profile.id });
    }
  };

  child.stdout.on('data', onChunk('stdout'));
  child.stderr.on('data', onChunk('stderr'));

  child.on('error', (err) => {
    const line = String(err && err.message ? err.message : err);
    appendSetupLog(line, run.logPath);
    sendSetup({ type: 'line', stream: 'stderr', line, fork: profile.id });
  });

  child.on('close', (code) => {
    if (buffer.trim()) {
      const line = buffer.trim();
      run.lines.push(line);
      appendSetupLog(line, run.logPath);
      sendSetup({ type: 'line', stream: 'stdout', line, fork: profile.id });
    }
    if (dexnomSetup === run) dexnomSetup = null;

    if (run.canceled) {
      sendSetup({ type: 'done', canceled: true, code, fork: profile.id });
      return;
    }

    const fresh = runtimeProfiles().find((item) => item.id === profile.id) || profile;
    const runtime = profileRuntime(fresh);
    if (code === 0 && runtime) {
      const patch = { runtimeFork: fresh.id };
      if (fresh.strategy === 'setup') {
        patch.forkInstalls = { ...(cfg.forkInstalls || {}), [fresh.id]: fresh.installDir };
        if (isDexnomSource(fresh.sourceDir, fresh.setupScript)) patch.dexnomRuntime = runtime.dir;
      }
      saveConfig(patch);
      sendSetup({ type: 'done', ok: true, code, runtime, fork: fresh.id });
      return;
    }

    sendSetup({
      type: 'error',
      code: code === 0 ? 'missing' : 'build',
      exitCode: code,
      fork: fresh.id,
      tail: run.lines.slice(-14).join('\n'),
    });
  });

  return run;
}

async function startSetupRuntime(profile, gameExe, msvc) {
  writeRuntimeLog(profile.logPath, `preparacao de ${profile.name}`, [
    `fonte: ${profile.sourceDir}`,
    `jogo: ${gameExe}`,
    `instalacao: ${profile.installDir}`,
    `script: ${profile.setupScript}`,
  ]);
  const env = await runtimeBuildEnv(msvc, profile.logPath);
  const args = [
    '-NoLogo',
    '-NoProfile',
    '-STA',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    profile.setupScript,
    '-GamePath',
    gameExe,
    '-InstallDir',
    profile.installDir,
  ];
  startRuntimeProcess(profile, 'powershell.exe', args, {
    cwd: profile.sourceDir,
    env,
    phase: 'setup',
  });
}

async function startBuildRuntime(profile, msvc) {
  writeRuntimeLog(profile.logPath, `compilacao de ${profile.name}`, [
    `fonte: ${profile.sourceDir}`,
    `estrategia: ${profile.strategy}`,
    `script: ${profile.playScript || '(executavel direto)'}`,
  ]);
  const env = await runtimeBuildEnv(msvc, profile.logPath);
  const args = ['build', '--locked', '--profile', 'diag', '-p', 'victory', '--features', 'diagnostics'];
  startRuntimeProcess(profile, 'cargo', args, {
    cwd: profile.sourceDir,
    env,
    phase: 'build',
  });
}

async function startRuntimeSetup(profile, gameExe, msvc) {
  if (!profile) throw new Error('fork ausente');
  if (profile.strategy === 'setup') return startSetupRuntime(profile, gameExe, msvc);
  if (profile.strategy === 'script' || profile.strategy === 'build') return startBuildRuntime(profile, msvc);
  saveConfig({ runtimeFork: profile.id });
  sendSetup({ type: 'start', at: Date.now(), fork: profile.id, phase: 'exe' });
  sendSetup({ type: 'done', ok: true, code: 0, runtime: profileRuntime(profile), fork: profile.id });
  return null;
}

// ---------------------------------------------------------------------------
// Janela
// ---------------------------------------------------------------------------

function createWindow() {
  cfg = loadConfig();

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(1440, Math.max(1080, sw - 80));
  const height = Math.min(810, Math.max(660, sh - 80));

  win = new BrowserWindow({
    width,
    height,
    minWidth: 1080,
    minHeight: 660,
    center: true,
    show: false,
    frame: false,
    backgroundColor: '#07030d',
    title: 'PortWatch Hub',
    icon: fs.existsSync(ICON_ICO) ? ICON_ICO : fs.existsSync(ICON_PNG) ? ICON_PNG : undefined,
    fullscreen: Boolean(cfg.startFullscreen),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(APP_DIR, 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });

  win.on('closed', () => {
    win = null;
  });
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

function snapshotState() {
  return {
    config: cfg,
    defaults: DEFAULTS,
    platform: process.platform,
    appVersion: app.getVersion(),
    site: SITE_URL,
    tracker: TRACKER_GITHUB,
    paths: {
      root: ROOT,
      launcher: __dirname,
      data: DATA_DIR,
      cache: CACHE_DIR,
      downloads: cfg.downloadsDir || DEFAULT_DOWNLOADS,
    },
    downloadsDir: cfg.downloadsDir || DEFAULT_DOWNLOADS,
  };
}

ipcMain.handle('app:state', () => snapshotState());
ipcMain.handle('portwatch:race', (_event, force) => fetchTracker(Boolean(force)));
ipcMain.handle('portwatch:forks', (_event, force) => fetchForks(Boolean(force)));
ipcMain.handle('system:hardware', (_event, refresh) => hardware.get(Boolean(refresh)));

ipcMain.handle('config:save', (_event, patch) => saveConfig(patch));
ipcMain.handle('config:reset', () => {
  cfg = { ...DEFAULTS };
  try {
    ensureDirs();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch {
    /* ignore */
  }
  return cfg;
});

ipcMain.handle('download:repo', (_event, payload) => downloadRepo(payload || {}));
ipcMain.handle('download:list', () => listDownloads());
ipcMain.handle('download:open', (_event, name) => openDownloaded(name));

ipcMain.handle('download:pick-dir', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: mt('pickDownloadFolder'),
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: cfg.downloadsDir || DEFAULT_DOWNLOADS,
  });
  if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
  return { ok: true, dir: result.filePaths[0] };
});

ipcMain.handle('download:choose-dir', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: mt('chooseDownloads'),
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: cfg.downloadsDir || DEFAULT_DOWNLOADS,
  });
  if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
  const saved = saveConfig({ downloadsDir: result.filePaths[0] });
  return { ok: true, dir: saved.downloadsDir };
});

// ---------------------------------------------------------------------------
// Runtime / forks
// ---------------------------------------------------------------------------

ipcMain.handle('dexnom:status', () => dexnomStatus());
ipcMain.handle('runtime:status', () => runtimeStatus());

ipcMain.handle('runtime:select', async (_event, id) => {
  const profile = runtimeProfiles().find((item) => item.id === String(id || ''));
  if (!profile) return { ok: false, error: 'source', status: await runtimeStatus() };
  saveConfig({ runtimeFork: profile.id });
  return { ok: true, status: await runtimeStatus() };
});

ipcMain.handle('dexnom:choose-game', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: mt('chooseGameExe'),
    properties: ['openFile'],
    filters: [{ name: 'Executável', extensions: ['exe'] }],
    defaultPath: cfg.gameExe ? path.dirname(cfg.gameExe) : cfg.downloadsDir || DEFAULT_DOWNLOADS,
  });
  if (result.canceled || !result.filePaths.length) {
    return { ok: false, canceled: true, status: await dexnomStatus() };
  }
  const chosen = result.filePaths[0];
  if (!isFile(chosen) || !/\.exe$/i.test(chosen)) {
    return { ok: false, error: 'game', status: await dexnomStatus() };
  }
  saveConfig({ gameExe: chosen });
  return { ok: true, status: await dexnomStatus() };
});

ipcMain.handle('dexnom:choose-source', async () => {
  const selected = selectedRuntimeProfile();
  const result = await dialog.showOpenDialog(win, {
    title: mt('chooseForkFolder'),
    properties: ['openDirectory'],
    defaultPath: selected
      ? path.dirname(selected.sourceDir)
      : cfg.dexnomSource
        ? path.dirname(cfg.dexnomSource)
        : cfg.downloadsDir || DEFAULT_DOWNLOADS,
  });
  if (result.canceled || !result.filePaths.length) {
    return { ok: false, canceled: true, status: await runtimeStatus() };
  }
  const source = victorySourceIn(result.filePaths[0]);
  if (!source) return { ok: false, error: 'source', status: await runtimeStatus() };
  const profile = buildForkProfile(source);
  const patch = {
    runtimeFork: profile.id,
    runtimeSources: { ...(cfg.runtimeSources || {}), [profile.id]: source },
  };
  if (isDexnomSource(source, profile.setupScript)) patch.dexnomSource = source;
  saveConfig(patch);
  return { ok: true, status: await runtimeStatus() };
});

ipcMain.handle('dexnom:choose-install', async () => {
  const profile = selectedRuntimeProfile();
  if (!profile) return { ok: false, error: 'source', status: await runtimeStatus() };
  if (profile.strategy !== 'setup') {
    return { ok: false, error: 'install', status: await runtimeStatus() };
  }
  const result = await dialog.showOpenDialog(win, {
    title: mt('chooseInstallDir'),
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: profile.installDir || cfg.downloadsDir || DEFAULT_DOWNLOADS,
  });
  if (result.canceled || !result.filePaths.length) {
    return { ok: false, canceled: true, status: await runtimeStatus() };
  }
  const chosen = result.filePaths[0];
  if (hasVictoryRoot(chosen)) {
    return { ok: false, error: 'install', status: await runtimeStatus() };
  }
  const patch = {
    forkInstalls: { ...(cfg.forkInstalls || {}), [profile.id]: chosen },
  };
  if (isDexnomSource(profile.sourceDir, profile.setupScript)) {
    patch.dexnomInstallDir = chosen;
    patch.dexnomRuntime = '';
  }
  saveConfig(patch);
  return { ok: true, status: await runtimeStatus() };
});

ipcMain.handle('dexnom:choose-msvc', async () => {
  const result = await dialog.showOpenDialog(win, {
    title: mt('chooseMsvcDir'),
    properties: ['openDirectory'],
    defaultPath: cfg.msvcDir || process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
  });
  if (result.canceled || !result.filePaths.length) {
    return { ok: false, canceled: true, status: await dexnomStatus() };
  }
  const info = msvcRootFromPath(result.filePaths[0]);
  if (!info) return { ok: false, error: 'msvc', status: await dexnomStatus() };
  saveConfig({ msvcDir: info.root });
  return { ok: true, status: await dexnomStatus() };
});

ipcMain.handle('dexnom:install-msvc', () => {
  if (msvcInstall) return { ok: false, error: 'busy' };
  const systemFreeGB = freeSpaceGB(process.env.SystemDrive ? `${process.env.SystemDrive}\\` : 'C:\\');
  if (systemFreeGB != null && systemFreeGB < 6) {
    return { ok: false, error: 'disk', freeGB: systemFreeGB };
  }
  try {
    startMsvcInstall();
    return { ok: true, started: true };
  } catch (err) {
    return { ok: false, error: 'spawn', detail: String(err.message || err) };
  }
});

ipcMain.handle('dexnom:prepare', async () => {
  if (dexnomSetup) return { ok: false, error: 'busy' };
  const status = await dexnomStatus();
  const profile = selectedRuntimeProfile();
  if (!profile || !status.source) return { ok: false, error: 'source' };
  if (!status.gameExe) return { ok: false, error: 'game' };
  if (profile.strategy === 'setup') {
    if (!profile.installDir) return { ok: false, error: 'install' };
    if (hasVictoryRoot(profile.installDir)) return { ok: false, error: 'install' };
  }
  if (profile.strategy !== 'exe') {
    if (!status.rust.ok) return { ok: false, error: 'rust' };
    if (!status.msvc.ok || !status.msvc.sdk) return { ok: false, error: 'msvc' };
  }
  const free = freeSpaceGB(
    profile.strategy === 'setup' ? profile.installDir || profile.sourceDir : profile.sourceDir
  );
  if (free != null && free < 5) {
    return { ok: false, error: 'disk', freeGB: free };
  }
  try {
    const started = await startRuntimeSetup(profile, status.gameExe, status.msvc);
    return { ok: true, started: Boolean(started) };
  } catch (err) {
    return { ok: false, error: 'spawn', detail: String(err.message || err) };
  }
});

ipcMain.handle('dexnom:cancel', () => {
  if (!dexnomSetup) return { ok: false, error: 'idle' };
  dexnomSetup.canceled = true;
  killTree(dexnomSetup.child.pid);
  return { ok: true };
});

ipcMain.handle('dexnom:launch', async () => {
  if (dexnomGame) return { ok: false, error: 'running' };
  if (savesBusy) return { ok: false, error: 'saves' };
  const profile = selectedRuntimeProfile();
  if (!profile) return { ok: false, error: 'source' };
  const runtime = profileRuntime(profile);
  if (!runtime) return { ok: false, error: 'runtime' };
  const gameExe = dexnomGameExe();
  if (!gameExe) return { ok: false, error: 'game' };
  const rt = Boolean(cfg.dexnomRayTracing);

  let child;
  try {
    if (profile.strategy === 'setup') {
      const isPlay = /victory-play\.exe$/i.test(runtime.exe);
      if (isPlay) {
        // Mantém o jogo escolhido no launcher sincronizado com o runtime.
        try {
          fs.writeFileSync(path.join(runtime.dir, 'game-path.txt'), gameExe, 'utf8');
        } catch {
          /* o runtime ainda pode usar o caminho gravado pelo setup */
        }
      }
      const env = { ...process.env };
      let args;
      if (isPlay) {
        args = rt ? ['--rt', gameExe] : [gameExe];
      } else {
        args = ['run', gameExe, '--execute', '--console', 'series-x', '--unimplemented', 'trap'];
        env.VICTORY_DATA_DIR = path.join(runtime.dir, 'state');
        env.VICTORY_CACHE_DIR = path.join(runtime.dir, 'cache');
        env.VICTORY_GAME_DIR = path.dirname(gameExe);
        if (rt) {
          env.VICTORY_BVH_BUILDER = '1';
          env.VICTORY_BVH_QUARANTINE = '0';
          env.VICTORY_ACTIVATE_RAYS = '1';
          env.VICTORY_RT_RESOLVE = '1';
        }
      }
      child = spawn(runtime.exe, args, {
        cwd: runtime.dir,
        windowsHide: false,
        env,
      });
    } else if (profile.strategy === 'script') {
      const args = [
        '-NoLogo',
        '-NoProfile',
        '-STA',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        runtime.playScript || profile.playScript,
        '-Exe',
        gameExe,
      ];
      if (runtime.buildProfile === 'release') args.push('-Build', 'release');
      if (rt) args.push('-RayTracing');
      child = spawn('powershell.exe', args, {
        cwd: profile.sourceDir,
        windowsHide: true,
        env: {
          ...process.env,
          VICTORY_DATA_DIR: runtime.dataDir || profile.dataDir,
          VICTORY_CACHE_DIR: runtime.cacheDir || profile.cacheDir,
          VICTORY_GAME_DIR: path.dirname(gameExe),
        },
      });
    } else {
      const env = {
        ...process.env,
        VICTORY_DATA_DIR: runtime.dataDir || profile.dataDir,
        VICTORY_CACHE_DIR: runtime.cacheDir || profile.cacheDir,
        VICTORY_GAME_DIR: path.dirname(gameExe),
      };
      if (rt) {
        env.VICTORY_BVH_BUILDER = '1';
        env.VICTORY_BVH_QUARANTINE = '0';
        env.VICTORY_ACTIVATE_RAYS = '1';
        env.VICTORY_RT_RESOLVE = '1';
      }
      const isPlay = /victory-play\.exe$/i.test(runtime.exe);
      const args = isPlay
        ? rt
          ? ['--rt', gameExe]
          : [gameExe]
        : ['run', gameExe, '--execute', '--console', 'series-x', '--unimplemented', 'trap'];
      child = spawn(runtime.exe, args, {
        cwd: runtime.dir,
        windowsHide: false,
        env,
      });
    }
  } catch (err) {
    return { ok: false, error: 'spawn', detail: String(err.message || err) };
  }

  const run = { child, pid: child.pid, startedAt: Date.now(), fork: profile.id };
  dexnomGame = run;
  sendGame({ running: true, pid: run.pid, startedAt: run.startedAt, fork: profile.id });

  child.on('error', (err) => {
    if (dexnomGame === run) dexnomGame = null;
    sendGame({ running: false, error: String(err.message || err), fork: profile.id });
  });

  child.on('close', (code) => {
    if (dexnomGame === run) dexnomGame = null;
    sendGame({ running: false, code, fork: profile.id });
  });

  return { ok: true, pid: run.pid, fork: profile.id };
});

ipcMain.handle('dexnom:stop', () => {
  if (!dexnomGame) return { ok: false, error: 'idle' };
  const pid = dexnomGame.pid;
  killTree(pid);
  return { ok: true, pid };
});

ipcMain.handle('dexnom:open', async (_event, kind) => {
  try {
    const profile = selectedRuntimeProfile();
    if (kind === 'log') {
      const logPath = profile ? profile.logPath : path.join(LOGS_DIR, 'runtime-setup.log');
      if (!fs.existsSync(logPath)) return { ok: false, missing: true };
      shell.showItemInFolder(logPath);
      return { ok: true };
    }
    if (kind === 'msvc-log') {
      if (!fs.existsSync(MSVC_INSTALL_LOG)) return { ok: false, missing: true };
      shell.showItemInFolder(MSVC_INSTALL_LOG);
      return { ok: true };
    }
    const target =
      kind === 'source'
        ? profile?.sourceDir
        : kind === 'runtime'
          ? profileRuntime(profile)?.dir
          : kind === 'data'
            ? profile?.dataDir
            : '';
    if (!target) return { ok: false, missing: true };
    if (!fs.existsSync(target)) return { ok: false, missing: true };
    const error = await shell.openPath(target);
    return error ? { ok: false, error } : { ok: true };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});

ipcMain.handle('saves:status', () => savesStatus());

ipcMain.handle('saves:install', async (_event, kind) => {
  if (savesBusy) return { ok: false, error: 'busy' };
  if (dexnomSetup) return { ok: false, error: 'setup' };
  if (kind !== 'zip' && kind !== 'folder') return { ok: false, error: 'format' };
  if (await dexnomGameActive()) {
    return { ok: false, error: 'running', status: await savesStatus() };
  }

  const options = {
    title: kind === 'zip' ? mt('chooseSaveZip') : mt('chooseSaveFolder'),
    defaultPath: cfg.downloadsDir || DEFAULT_DOWNLOADS,
  };
  if (kind === 'zip') {
    options.properties = ['openFile'];
    options.filters = [{ name: mt('saveZipFilter'), extensions: ['zip'] }];
  } else {
    options.properties = ['openDirectory'];
  }

  const picked = await dialog.showOpenDialog(win, options);
  if (picked.canceled || !picked.filePaths.length) {
    return { ok: false, canceled: true, status: await savesStatus() };
  }
  if (await dexnomGameActive()) {
    return { ok: false, error: 'running', status: await savesStatus() };
  }

  const paths = dexnomSavesPaths();
  if (!paths.installDir) {
    return { ok: false, error: 'install', status: await savesStatus() };
  }

  savesBusy = true;
  let result;
  try {
    result = await savesStore.installSave(paths, picked.filePaths[0], { tmpDir: TMP_DIR });
  } catch (err) {
    result = { ok: false, error: 'copy', detail: String(err.message || err) };
  } finally {
    savesBusy = false;
  }
  return { ...result, status: await savesStatus() };
});

ipcMain.handle('saves:delete', async () => {
  if (savesBusy) return { ok: false, error: 'busy' };
  if (dexnomSetup) return { ok: false, error: 'setup' };
  if (await dexnomGameActive()) {
    return { ok: false, error: 'running', status: await savesStatus() };
  }
  savesBusy = true;
  let result;
  try {
    result = savesStore.deleteSaves(dexnomSavesPaths(), {
      backupLimit: savesStore.SAVE_BACKUP_LIMIT,
    });
  } catch (err) {
    result = { ok: false, error: 'copy', detail: String(err.message || err) };
  } finally {
    savesBusy = false;
  }
  return { ...result, status: await savesStatus() };
});

ipcMain.handle('saves:restore', async (_event, name) => {
  if (savesBusy) return { ok: false, error: 'busy' };
  if (dexnomSetup) return { ok: false, error: 'setup' };
  if (await dexnomGameActive()) {
    return { ok: false, error: 'running', status: await savesStatus() };
  }
  savesBusy = true;
  let result;
  try {
    result = savesStore.restoreSaves(dexnomSavesPaths(), name, {
      backupLimit: savesStore.SAVE_BACKUP_LIMIT,
    });
  } catch (err) {
    result = { ok: false, error: 'copy', detail: String(err.message || err) };
  } finally {
    savesBusy = false;
  }
  return { ...result, status: await savesStatus() };
});

ipcMain.handle('saves:open', async (_event, kind) => {
  if (kind !== 'saves' && kind !== 'backups') return { ok: false, error: 'format' };
  const paths = dexnomSavesPaths();
  const target = kind === 'backups' ? paths.backupsDir : paths.savesDir;
  try {
    fs.mkdirSync(target, { recursive: true });
    const error = await shell.openPath(target);
    return error ? { ok: false, error } : { ok: true };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
});

ipcMain.handle('shell:openPath', async (_event, kind) => {
  const targets = {
    downloads: cfg.downloadsDir || DEFAULT_DOWNLOADS,
    data: DATA_DIR,
    cache: CACHE_DIR,
    launcher: __dirname,
    root: ROOT,
  };
  const target = targets[kind];
  if (!target) return { ok: false };
  try {
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
    const error = await shell.openPath(target);
    return error ? { ok: false, error } : { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('shell:openExternal', async (_event, url) => {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false;
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('window:minimize', () => win && win.minimize());
ipcMain.handle('window:maximize', () => {
  if (!win) return false;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
  return win.isMaximized();
});
ipcMain.handle('window:close', () => win && win.close());
ipcMain.handle('window:hide', () => win && win.hide());
ipcMain.handle('window:fullscreen', () => {
  if (!win) return false;
  win.setFullScreen(!win.isFullScreen());
  return win.isFullScreen();
});
ipcMain.handle('window:isFullscreen', () => (win ? win.isFullScreen() : false));

// ---------------------------------------------------------------------------
// Ciclo de vida
// ---------------------------------------------------------------------------

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.setAppUserModelId('com.portwatch.hub');

  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

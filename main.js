'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const https = require('node:https');
const { execFile } = require('node:child_process');
const { createHardware } = require('./hardware-main');

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
};

const CONFIG_KEYS = Object.keys(DEFAULTS);

const MAIN_I18N = {
  'pt-BR': {
    chooseDownloads: 'Escolher pasta de downloads',
    pickDownloadFolder: 'Escolha onde salvar esta fork',
    downloadFailed: 'Não foi possível baixar o projeto.',
    extractFailed: 'O download terminou, mas não foi possível extrair o ZIP.',
    invalidRepo: 'Repositório inválido.',
  },
  en: {
    chooseDownloads: 'Choose downloads folder',
    pickDownloadFolder: 'Choose where to save this fork',
    downloadFailed: 'Could not download the project.',
    extractFailed: 'The download finished, but the ZIP could not be extracted.',
    invalidRepo: 'Invalid repository.',
  },
  es: {
    chooseDownloads: 'Elegir carpeta de descargas',
    pickDownloadFolder: 'Elige dónde guardar esta fork',
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
  for (const dir of [DATA_DIR, CACHE_DIR, TMP_DIR]) {
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

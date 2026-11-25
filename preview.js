'use strict';

// Servidor estático mínimo para pré-visualizar a interface no navegador.
// Uso: npm run preview  →  http://localhost:4317
// Inclui proxies same-origin para o tracker e os forks (a CSP do app só
// permite conexões para 'self').

const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, 'app');
const DATA = path.join(__dirname, 'data');
const CACHE = path.join(DATA, 'cache');
const PORT = Number(process.env.PORT || 4317);

const TRACKER_URL = 'https://raw.githubusercontent.com/4lwayz/portwatch-vi/main/data/tracker.json';
const FORKS_URL = 'https://api.github.com/repos/4lwayz/portwatch-vi/forks?per_page=100&sort=newest';
const UA = 'PortWatch-Hub-preview/2.0 (+https://portwatch-vi.xyz)';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

function request(url, { headers = {}, timeout = 25000, redirects = 6 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', ...headers } },
      (res) => {
        if (
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location &&
          redirects > 0
        ) {
          res.resume();
          resolve(request(new URL(res.headers.location, url).toString(), { headers, timeout, redirects: redirects - 1 }));
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks) })
        );
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
  });
}

function readCache(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(CACHE, name), 'utf8'));
  } catch {
    return null;
  }
}

function writeCache(name, value) {
  try {
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(path.join(CACHE, name), JSON.stringify(value), 'utf8');
  } catch {
    /* cache opcional */
  }
}

function sendJson(res, status, value, extra = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extra,
  });
  res.end(body);
}

async function trackerPayload(force) {
  const cached = readCache('tracker.json');
  if (!force && cached && Date.now() - Number(cached.fetchedAt || 0) < 60 * 1000) {
    return { value: cached.data, cached: true };
  }
  try {
    const res = await request(TRACKER_URL, { headers: { 'Cache-Control': 'no-cache' } });
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    const data = JSON.parse(res.body.toString('utf8'));
    if (!data || !Array.isArray(data.efforts)) throw new Error('tracker inválido');
    writeCache('tracker.json', { fetchedAt: Date.now(), data });
    return { value: data, cached: false };
  } catch (err) {
    if (cached && cached.data) return { value: cached.data, cached: true, error: String(err.message || err) };
    throw err;
  }
}

async function forksPayload(force) {
  const cached = readCache('forks.json');
  if (!force && cached && Date.now() - Number(cached.fetchedAt || 0) < 10 * 60 * 1000) {
    return { value: cached.forks, cached: true };
  }
  try {
    const all = [];
    for (let page = 1; page <= 3; page += 1) {
      const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
      if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      const res = await request(`${FORKS_URL}&page=${page}`, { headers });
      if (res.status !== 200) throw new Error(`GitHub API ${res.status}`);
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

    writeCache('forks.json', { fetchedAt: Date.now(), forks });
    return { value: forks, cached: false };
  } catch (err) {
    if (cached && Array.isArray(cached.forks)) return { value: cached.forks, cached: true, error: String(err.message || err) };
    throw err;
  }
}

async function serveApi(req, res, url) {
  const force = url.searchParams.get('force') === '1';
  try {
    if (url.pathname === '/api/tracker') {
      const result = await trackerPayload(force);
      sendJson(res, 200, result.value, result.cached ? { 'X-Portwatch-Cache': 'stale' } : {});
      return;
    }
    if (url.pathname === '/api/forks') {
      const result = await forksPayload(force);
      sendJson(
        res,
        200,
        { ok: true, forks: result.value, count: result.value.length, cached: Boolean(result.cached) },
        result.cached ? { 'X-Portwatch-Cache': 'stale' } : {}
      );
      return;
    }
  } catch (err) {
    sendJson(res, 502, { ok: false, error: String(err.message || err) });
    return;
  }
  sendJson(res, 404, { ok: false, error: 'not found' });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith('/api/')) {
    serveApi(req, res, url);
    return;
  }

  let filePath = pathname;
  if (filePath === '/') filePath = '/index.html';

  const target = path.resolve(ROOT, `.${filePath}`);
  if (!target.startsWith(ROOT + path.sep) && target !== ROOT) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`PortWatch Hub preview: http://localhost:${PORT}`);
});

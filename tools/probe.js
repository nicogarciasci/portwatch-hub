'use strict';

// Teste de fumaça do PortWatch Hub via Chrome DevTools Protocol.
// Uso: npx electron . --remote-debugging-port=9222  (em outro terminal)
//      node tools/probe.js

const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.CDP_PORT || 9222);
const CONFIG_FILE = path.join(__dirname, '..', 'data', 'config.json');

async function main() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page' && /index\.html/.test(t.url));
  if (!page) throw new Error('janela do launcher não encontrada');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('falha no WebSocket do CDP'));
  });

  let id = 0;
  const pending = new Map();
  const problems = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      problems.push(
        `exception: ${d.text} ${d.exception && d.exception.description ? d.exception.description : ''}`.trim()
      );
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      problems.push(`console.error: ${msg.params.args.map((a) => a.value || a.description).join(' ')}`);
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      problems.push(`log: ${msg.params.entry.text}`);
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  await send('Runtime.enable');
  await send('Log.enable');

  const expression = `(async () => {
    const api = window.portwatch;
    if (!api) return { error: 'window.portwatch ausente' };

    const before = await api.getState();
    const dom = {
      ready: document.body.classList.contains('ready'),
      theme: document.body.dataset.theme,
      leader: document.querySelector('#homeLeader')?.textContent.trim(),
      stage: document.querySelector('#homeLeaderStage')?.textContent.trim(),
      efforts: document.querySelector('#homeEfforts')?.textContent.trim(),
      projects: document.querySelector('#homeProjects')?.textContent.trim(),
      forks: document.querySelector('#homeForks')?.textContent.trim(),
      version: document.querySelector('#versionTag')?.textContent.trim(),
    };

    const race = await api.race(true);
    const raceOk = Boolean(race && race.ok && race.data && Array.isArray(race.data.efforts));
    const raceCount = raceOk ? race.data.efforts.length : 0;
    const raceUpdated = raceOk ? race.updated || race.data.updated || null : null;

    const forks = await api.forks(true);
    const forksOk = Boolean(forks && forks.ok && Array.isArray(forks.forks));
    const forksCount = forksOk ? forks.forks.length : 0;

    const downloads = await api.downloads();
    const downloadsOk = Boolean(downloads && downloads.ok);

    const toggled = await api.saveConfig({ uiSounds: !before.config.uiSounds });
    const toggleWorked = toggled.uiSounds === !before.config.uiSounds;
    await api.saveConfig({ uiSounds: before.config.uiSounds });
    const restored = await api.getState();

    return {
      desktop: Boolean(api.isDesktop),
      dom,
      raceOk,
      raceCount,
      raceUpdated,
      forksOk,
      forksCount,
      downloadsOk,
      downloadsDir: downloads && downloads.dir,
      downloadsCount: downloads && Array.isArray(downloads.items) ? downloads.items.length : 0,
      toggleWorked,
      restored: JSON.stringify(restored.config) === JSON.stringify(before.config),
      config: restored.config,
      site: restored.site,
      tracker: restored.tracker,
      appVersion: restored.appVersion,
    };
  })()`;

  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text);
  }

  const value = result.result.value;
  let disk = null;
  try {
    disk = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (err) {
    problems.push(`config.json: ${err.message}`);
  }

  const summary = {
    desktop: value.desktop,
    dom: value.dom,
    raceOk: value.raceOk,
    raceCount: value.raceCount,
    raceUpdated: value.raceUpdated,
    forksOk: value.forksOk,
    forksCount: value.forksCount,
    downloadsOk: value.downloadsOk,
    downloadsDir: value.downloadsDir,
    downloadsCount: value.downloadsCount,
    toggleWorked: value.toggleWorked,
    restored: value.restored,
    configOnDiskMatches: disk ? JSON.stringify(disk) === JSON.stringify(value.config) : false,
    site: value.site,
    tracker: value.tracker,
    appVersion: value.appVersion,
    problems,
  };

  console.log(JSON.stringify(summary, null, 2));
  ws.close();
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});

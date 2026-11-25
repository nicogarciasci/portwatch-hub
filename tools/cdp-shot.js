'use strict';

// Captura a janela real do launcher via CDP (com composição da GPU).
// Uso: node tools/cdp-shot.js [saida]

const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.CDP_PORT || 9222);
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'shots', 'desktop.png'));
const action = process.argv[3] || '';

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
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  await send('Page.enable');
  if (action) {
    await send('Runtime.evaluate', { expression: action, awaitPromise: true });
    await new Promise((resolve) => setTimeout(resolve, Number(process.env.CDP_WAIT || 900)));
  }
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(`ok -> ${out}`);
  ws.close();
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});

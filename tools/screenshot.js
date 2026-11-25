'use strict';

// Utilitário de desenvolvimento: renderiza a interface e salva um PNG.
// Uso: npx electron tools/screenshot.js [largura] [altura] [saida] [acaoJS]
// Ex.: ... 1440 810 shot.png "document.querySelector('[data-nav=\\\"race\\\"]').click()"

const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const width = Number(process.argv[2]) || 1440;
const height = Number(process.argv[3]) || 810;
const out = path.resolve(process.argv[4] || path.join(__dirname, '..', 'preview.png'));
const action = process.argv[5] || '';
const settle = Number(process.env.SETTLE || 1200);

app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    backgroundColor: '#07030d',
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false,
    },
  });

  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) console.log(`[console:${level}] ${message}`);
  });

  await win.loadURL('http://localhost:4317/');
  await new Promise((resolve) => setTimeout(resolve, 1800));

  if (action) {
    try {
      await win.webContents.executeJavaScript(action, true);
    } catch (err) {
      console.error(`[action] ${err.message}`);
    }
  }

  await new Promise((resolve) => setTimeout(resolve, settle));

  const image = await win.webContents.capturePage();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, image.toPNG());
  console.log(`ok ${width}x${height} -> ${out}`);
  app.quit();
});

'use strict';

/* =========================================================================
   PORTWATCH HUB — módulo separado
   ========================================================================= */

/* =========================================================================
   HARDWARE — "roda no meu PC?"
   ========================================================================= */

const HW_TARGETS = {
  low: { thresholds: { gpu: 45, cpu: 45, ram: 50, storage: 50 } },
  high: { thresholds: { gpu: 65, cpu: 63, ram: 65, storage: 65 } },
  1440: { thresholds: { gpu: 78, cpu: 72, ram: 76, storage: 72 } },
  '4k': { thresholds: { gpu: 90, cpu: 82, ram: 85, storage: 82 } },
};

const HW_TARGET_KEYS = {
  low: 'hw.targetLow',
  high: 'hw.targetHigh',
  1440: 'hw.target1440',
  '4k': 'hw.target4k',
};

const HW_KEYS = ['gpu', 'cpu', 'ram', 'storage'];
const HW_WEIGHTS = { gpu: 0.4, cpu: 0.28, ram: 0.18, storage: 0.14 };
const HW_SELECTS = {
  gpu: '#hwGpuSelect',
  cpu: '#hwCpuSelect',
  ram: '#hwRamSelect',
  storage: '#hwStorageSelect',
};

const HW_GPUS = [
  { id: 'vega8', label: 'Radeon Vega 8 (integrada)', score: 22, match: /vega\s*8/i },
  { id: 'gtx1050ti', label: 'GeForce GTX 1050 Ti 4 GB', score: 30, match: /gtx\s*1050/i },
  { id: 'rx570', label: 'Radeon RX 570 8 GB', score: 38, match: /rx\s*570/i },
  { id: 'gtx1060', label: 'GeForce GTX 1060 6 GB', score: 40, match: /gtx\s*1060/i },
  { id: 'rx580', label: 'Radeon RX 580 8 GB', score: 44, match: /rx\s*580/i },
  { id: 'gtx1660s', label: 'GeForce GTX 1660 Super 6 GB', score: 52, match: /gtx\s*1660/i },
  { id: 'rtx2060', label: 'GeForce RTX 2060 6 GB', score: 58, match: /rtx\s*2060/i },
  { id: 'rx6600', label: 'Radeon RX 6600 8 GB', score: 66, match: /rx\s*6600/i },
  { id: 'rtx3060', label: 'GeForce RTX 3060 12 GB', score: 70, match: /rtx\s*3060/i },
  { id: 'rtx4060', label: 'GeForce RTX 4060 8 GB', score: 78, match: /rtx\s*4060/i },
  { id: 'rx6700xt', label: 'Radeon RX 6700 XT 12 GB', score: 79, match: /rx\s*6700/i },
  { id: 'rtx4070', label: 'GeForce RTX 4070 12 GB', score: 88, match: /rtx\s*4070/i },
  { id: 'rx7800xt', label: 'Radeon RX 7800 XT 16 GB', score: 91, match: /rx\s*7800/i },
  { id: 'rtx4080', label: 'GeForce RTX 4080 16 GB', score: 96, match: /rtx\s*4080/i },
  { id: 'rtx4090', label: 'GeForce RTX 4090 24 GB', score: 100, match: /rtx\s*4090/i },
];

const HW_CPUS = [
  { id: 'r3-4350g', label: 'AMD Ryzen 3 PRO 4350G', score: 45, match: /4350g/i },
  { id: 'i5-10400f', label: 'Intel Core i5-10400F', score: 54, match: /10400/i },
  { id: 'r5-3600', label: 'AMD Ryzen 5 3600', score: 60, match: /ryzen\s*5\s*3600/i },
  { id: 'r5-5600', label: 'AMD Ryzen 5 5600', score: 68, match: /ryzen\s*5\s*5600/i },
  { id: 'i5-12400f', label: 'Intel Core i5-12400F', score: 72, match: /12400/i },
  { id: 'r7-5800x3d', label: 'AMD Ryzen 7 5800X3D', score: 82, match: /5800x3d/i },
  { id: 'r5-7600', label: 'AMD Ryzen 5 7600', score: 85, match: /ryzen\s*5\s*7600/i },
  { id: 'i7-13700k', label: 'Intel Core i7-13700K', score: 92, match: /13700/i },
  { id: 'r7-7800x3d', label: 'AMD Ryzen 7 7800X3D', score: 96, match: /7800x3d/i },
  { id: 'i9-13900k', label: 'Intel Core i9-13900K', score: 98, match: /13900/i },
];

const HW_RAM = [
  { id: '8-ddr3-1600', label: '8 GB DDR3 1600', score: 24 },
  { id: '8-ddr4-2400', label: '8 GB DDR4 2400', score: 34 },
  { id: '16-ddr4-2400', label: '16 GB DDR4 2400', score: 52 },
  { id: '16-ddr4-3200', label: '16 GB DDR4 3200', score: 66 },
  { id: '32-ddr4-3600', label: '32 GB DDR4 3600', score: 80 },
  { id: '16-ddr5-5600', label: '16 GB DDR5 5600', score: 82 },
  { id: '32-ddr5-6000', label: '32 GB DDR5 6000', score: 92 },
];

const HW_STORAGE = [
  { id: 'hdd-500', label: 'HDD · 500 GB', score: 40 },
  { id: 'ssd-100', label: 'SSD SATA · 100 GB', score: 52 },
  { id: 'ssd-250', label: 'SSD SATA · 250 GB', score: 64 },
  { id: 'ssd-350', label: 'SSD SATA · 350 GB', score: 75 },
  { id: 'nvme3-350', label: 'NVMe Gen 3 · 350 GB', score: 84 },
  { id: 'nvme4-500', label: 'NVMe Gen 4 · 500 GB', score: 94 },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function capKey(key) {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function gbFromBytes(bytes) {
  return (Number(bytes) || 0) / 1024 ** 3;
}

function matchEntry(list, name) {
  const text = String(name || '');
  return list.find((item) => item.match && item.match.test(text)) || null;
}

function closestEntry(list, score) {
  let best = list[0];
  let distance = Infinity;
  for (const item of list) {
    const current = Math.abs(item.score - score);
    if (current < distance) {
      distance = current;
      best = item;
    }
  }
  return best;
}

function autoGpuScore(gpu) {
  if (!gpu) return 0;
  const hit = matchEntry(HW_GPUS, gpu.name);
  if (hit) return hit.score;
  const vram = gbFromBytes(gpu.vramBytes);
  if (vram >= 16) return 88;
  if (vram >= 12) return 80;
  if (vram >= 8) return 62;
  if (vram >= 6) return 50;
  if (vram >= 4) return 36;
  return 20;
}

function autoCpuScore(cpu) {
  if (!cpu) return 0;
  const hit = matchEntry(HW_CPUS, cpu.name);
  if (hit) return hit.score;
  const threads = Number(cpu.threads) || 1;
  const cores = Number(cpu.cores) || 1;
  const clock = Number(cpu.maxClockMhz) || 3000;
  return Math.round(clamp(threads * 3 + cores * 2 + (clock - 2500) / 100, 10, 100));
}

function ramTotalBytes(ram) {
  if (!ram) return 0;
  const modules = ram.modules || [];
  const moduleBytes = modules.reduce((sum, module) => sum + (Number(module.capacityBytes) || 0), 0);
  return moduleBytes || Number(ram.totalBytes) || 0;
}

function autoRamScore(ram) {
  if (!ram || !ram.totalBytes) return 0;
  const total = Math.ceil(gbFromBytes(ramTotalBytes(ram)));
  let base = 24;
  if (total >= 64) base = 84;
  else if (total >= 32) base = 70;
  else if (total >= 24) base = 62;
  else if (total >= 16) base = 50;
  else if (total >= 12) base = 38;
  const speed = Number(ram.speedMhz) || 2133;
  const speedBonus = clamp((speed - 2133) / 200, 0, 16);
  const typeBonus = String(ram.type || '').toUpperCase() === 'DDR5' ? 5 : 0;
  return Math.round(clamp(base + speedBonus + typeBonus, 5, 100));
}

function storageDrive(data) {
  const drives = (data && data.drives) || [];
  const gameDrive = drives.find((drive) => (drive.roles || []).includes('downloads'));
  if (gameDrive) return gameDrive;
  return drives.slice().sort((a, b) => (b.freeBytes || 0) - (a.freeBytes || 0))[0] || null;
}

function storageMediaLabel(drive) {
  if (!drive) return t('hw.unknown');
  const media = String(drive.mediaType || '').toLowerCase();
  const bus = String(drive.busType || '').toLowerCase();
  const model = String(drive.model || '');
  if (media.includes('ssd')) {
    return t(bus.includes('nvme') || /nvme/i.test(model) ? 'hw.mediaNvme' : 'hw.mediaSsd');
  }
  return t('hw.mediaHdd');
}

function autoStorageScore(data) {
  const drive = storageDrive(data);
  if (!drive) return 0;
  const free = gbFromBytes(drive.freeBytes);
  const media = String(drive.mediaType || '').toLowerCase();
  const bus = String(drive.busType || '').toLowerCase();
  const model = String(drive.model || '');
  let score;
  if (media.includes('ssd')) {
    if (free >= 350) score = 75;
    else if (free >= 250) score = 68;
    else if (free >= 100) score = 58;
    else score = 48;
    if (bus.includes('nvme') || /nvme/i.test(model)) score += 8;
  } else if (free >= 350) score = 42;
  else if (free >= 250) score = 38;
  else if (free >= 100) score = 30;
  else score = 20;
  return Math.round(clamp(score, 0, 100));
}

function autoHardwareScores(data) {
  return {
    gpu: autoGpuScore(data && data.gpu),
    cpu: autoCpuScore(data && data.cpu),
    ram: autoRamScore(data && data.ram),
    storage: autoStorageScore(data),
  };
}

function autoHardwareParts(data) {
  const gpu = data && data.gpu;
  const cpu = data && data.cpu;
  const ram = data && data.ram;
  const drive = storageDrive(data);
  const ramGb = Math.ceil(gbFromBytes(ramTotalBytes(ram)));
  const vramGb = Math.round(gbFromBytes(gpu && gpu.vramBytes));

  return {
    gpu: {
      name: (gpu && gpu.name) || t('hw.unknown'),
      meta: gpu ? t('hw.vram', { gb: vramGb }) : '—',
    },
    cpu: {
      name: (cpu && cpu.name) || t('hw.unknown'),
      meta: cpu
        ? `${cpu.cores}C/${cpu.threads}T · ${(Number(cpu.maxClockMhz) / 1000).toFixed(1)} GHz`
        : '—',
    },
    ram: {
      name:
        ram && ram.totalBytes
          ? `${ramGb} GB ${ram.type || 'RAM'}${ram.speedMhz ? ` · ${ram.speedMhz} MHz` : ''}`
          : t('hw.unknown'),
      meta: ram && ram.modules && ram.modules.length ? t('hw.modules', { count: ram.modules.length }) : '—',
    },
    storage: {
      name: drive ? `${drive.letter}: ${storageMediaLabel(drive)}` : t('hw.unknown'),
      meta: drive ? t('hw.free', { free: fmtBytes(drive.freeBytes) }) : '—',
    },
  };
}

function manualEntry(list, id) {
  return list.find((item) => item.id === id) || list[0];
}

function manualHardwareModel() {
  const selection = state.hw.selection;
  const gpu = manualEntry(HW_GPUS, selection.gpu);
  const cpu = manualEntry(HW_CPUS, selection.cpu);
  const ram = manualEntry(HW_RAM, selection.ram);
  const storage = manualEntry(HW_STORAGE, selection.storage);
  const meta = t('hw.manualBadge');
  return {
    scores: { gpu: gpu.score, cpu: cpu.score, ram: ram.score, storage: storage.score },
    parts: {
      gpu: { name: gpu.label, meta },
      cpu: { name: cpu.label, meta },
      ram: { name: ram.label, meta },
      storage: { name: storage.label, meta },
    },
  };
}

function initializeHardwareSelection(data) {
  const scores = autoHardwareScores(data);
  const gpuHit = matchEntry(HW_GPUS, data && data.gpu && data.gpu.name);
  const cpuHit = matchEntry(HW_CPUS, data && data.cpu && data.cpu.name);
  state.hw.selection = {
    gpu: (gpuHit || closestEntry(HW_GPUS, scores.gpu)).id,
    cpu: (cpuHit || closestEntry(HW_CPUS, scores.cpu)).id,
    ram: closestEntry(HW_RAM, scores.ram).id,
    storage: closestEntry(HW_STORAGE, scores.storage).id,
  };
}

function buildHardwareSelects() {
  for (const key of HW_KEYS) {
    const select = $(HW_SELECTS[key]);
    if (!select || select.dataset.filled === '1') continue;
    select.dataset.filled = '1';
    const list = key === 'gpu' ? HW_GPUS : key === 'cpu' ? HW_CPUS : key === 'ram' ? HW_RAM : HW_STORAGE;
    for (const item of list) {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.label;
      select.appendChild(option);
    }
  }

  if (!state.hw.selection.gpu) state.hw.selection.gpu = 'rx580';
  if (!state.hw.selection.cpu) state.hw.selection.cpu = 'r3-4350g';
  if (!state.hw.selection.ram) state.hw.selection.ram = '16-ddr4-2400';
  if (!state.hw.selection.storage) state.hw.selection.storage = 'ssd-350';
}

async function ensureHardware(refresh = false) {
  if (state.hw.loading) return;
  if (state.hw.data && !refresh) {
    renderHardware();
    return;
  }

  state.hw.loading = true;
  state.hw.error = null;
  renderHardware();

  try {
    let data;
    if (IS_DESKTOP) {
      data = await window.portwatch.hardware(refresh);
    } else {
      await sleep(520);
      data = mockHardware();
    }
    if (!data) throw new Error('empty');
    state.hw.data = data;
    initializeHardwareSelection(data);
  } catch (err) {
    state.hw.error = String(err && err.message ? err.message : err);
  } finally {
    state.hw.loading = false;
    renderHardware();
  }
}

function fillHardwareParts(parts) {
  const set = (nameId, metaId, part) => {
    const name = document.getElementById(nameId);
    const meta = document.getElementById(metaId);
    if (name) {
      name.textContent = part ? part.name : '—';
      name.title = part ? part.name : '';
    }
    if (meta) {
      meta.textContent = part ? part.meta : '—';
      meta.title = part ? part.meta : '';
    }
  };
  set('hwGpuName', 'hwGpuMeta', parts && parts.gpu);
  set('hwCpuName', 'hwCpuMeta', parts && parts.cpu);
  set('hwRamName', 'hwRamMeta', parts && parts.ram);
  set('hwStorageName', 'hwStorageMeta', parts && parts.storage);
}

function resetHardwareBars() {
  for (const key of HW_KEYS) {
    const fill = document.getElementById(`hw${capKey(key)}Fill`);
    const marker = document.getElementById(`hw${capKey(key)}Need`);
    const score = document.getElementById(`hw${capKey(key)}Score`);
    const needText = document.getElementById(`hw${capKey(key)}NeedText`);
    const bar = fill && fill.closest('.hw-bar');
    if (fill) fill.style.width = '0%';
    if (marker) marker.style.left = '0%';
    if (score) score.textContent = '—';
    if (needText) needText.textContent = '—';
    if (bar) bar.classList.remove('state-ok', 'state-warn', 'state-bad');
  }
}

function renderHardwareResult(model) {
  const target = HW_TARGETS[state.hw.target] || HW_TARGETS.low;
  const ratios = {};
  let weighted = 0;

  for (const key of HW_KEYS) {
    const score = Math.round(clamp(Number(model.scores[key]) || 0, 0, 100));
    const need = target.thresholds[key];
    ratios[key] = need ? score / need : 0;
    weighted += (need ? score / need : 0) * HW_WEIGHTS[key];

    const fill = document.getElementById(`hw${capKey(key)}Fill`);
    const marker = document.getElementById(`hw${capKey(key)}Need`);
    const scoreEl = document.getElementById(`hw${capKey(key)}Score`);
    const needText = document.getElementById(`hw${capKey(key)}NeedText`);
    const bar = fill && fill.closest('.hw-bar');

    if (fill) fill.style.width = `${score}%`;
    if (marker) marker.style.left = `${Math.min(100, need)}%`;
    if (scoreEl) scoreEl.innerHTML = `${score}<em>/100</em>`;
    if (needText) needText.textContent = t('hw.need', { need });
    if (bar) {
      bar.classList.remove('state-ok', 'state-warn', 'state-bad');
      bar.classList.add(ratios[key] >= 1 ? 'state-ok' : ratios[key] >= 0.75 ? 'state-warn' : 'state-bad');
    }
  }

  const minRatio = Math.min(...HW_KEYS.map((key) => ratios[key]));
  let kind = 'below';
  if (minRatio >= 1) kind = 'ready';
  else if (minRatio >= 0.75 && weighted >= 0.82) kind = 'adjust';

  const verdict = $('#hwVerdict');
  if (verdict) {
    verdict.classList.remove('is-ready', 'is-adjust', 'is-below');
    verdict.classList.add(`is-${kind}`);
  }

  const targetName = t(HW_TARGET_KEYS[state.hw.target] || 'hw.targetLow');
  const titleKey = kind === 'ready' ? 'hw.verdictReady' : kind === 'adjust' ? 'hw.verdictAdjust' : 'hw.verdictBelow';
  const textKey =
    kind === 'ready'
      ? 'hw.verdictReadyText'
      : kind === 'adjust'
        ? 'hw.verdictAdjustText'
        : 'hw.verdictBelowText';

  const title = $('#hwVerdictTitle');
  const text = $('#hwVerdictText');
  const pct = $('#hwVerdictPct');
  const use = $('#hwVerdictUse');
  if (title) title.textContent = t(titleKey);
  if (text) text.textContent = t(textKey, { target: targetName });
  if (pct) pct.textContent = t('hw.ofTarget', { pct: Math.round(weighted * 100) });
  if (use) use.setAttribute('href', kind === 'ready' ? '#i-check' : kind === 'adjust' ? '#i-sliders' : '#i-alert');
}

function renderHardware() {
  const view = $('.view[data-view="hardware"]');
  if (!view) return;

  const data = state.hw.data;
  const loading = state.hw.loading;
  const manual = state.hw.manual;
  const source = $('#hwSource');
  if (source) {
    source.classList.toggle('is-manual', manual);
    source.textContent = manual
      ? t('hw.manualBadge')
      : loading
        ? t('hw.refreshing')
        : data
          ? t('hw.detected')
          : t('hw.detectFailed');
  }

  const errorEl = $('#hwError');
  if (errorEl) {
    errorEl.hidden = !state.hw.error;
    errorEl.textContent = state.hw.error ? t('hw.detectFailed') : '';
  }

  const toggle = $('#hwAutoToggle');
  if (toggle) toggle.checked = !manual;

  for (const key of HW_KEYS) {
    const select = $(HW_SELECTS[key]);
    if (!select) continue;
    select.disabled = !manual;
    if (state.hw.selection[key]) select.value = state.hw.selection[key];
  }

  $$('.hw-target').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.target === state.hw.target);
  });

  const refreshBtn = $('#hwRefreshBtn');
  if (refreshBtn) {
    refreshBtn.disabled = loading;
    refreshBtn.classList.toggle('is-busy', loading);
  }

  const model = manual ? manualHardwareModel() : data ? { scores: autoHardwareScores(data), parts: autoHardwareParts(data) } : null;

  if (!model) {
    fillHardwareParts(null);
    resetHardwareBars();
    const verdict = $('#hwVerdict');
    if (verdict) verdict.classList.remove('is-ready', 'is-adjust', 'is-below');
    const title = $('#hwVerdictTitle');
    const text = $('#hwVerdictText');
    const pct = $('#hwVerdictPct');
    const use = $('#hwVerdictUse');
    if (title) title.textContent = loading ? t('hw.loading') : t('hw.detectFailed');
    if (text) text.textContent = '—';
    if (pct) pct.textContent = '—';
    if (use) use.setAttribute('href', '#i-sliders');
    return;
  }

  fillHardwareParts(model.parts);
  renderHardwareResult(model);
}

function bindHardware() {
  buildHardwareSelects();

  const toggle = $('#hwAutoToggle');
  if (toggle) {
    toggle.addEventListener('change', () => {
      state.hw.manual = !toggle.checked;
      if (state.hw.data) initializeHardwareSelection(state.hw.data);
      renderHardware();
    });
  }

  for (const key of HW_KEYS) {
    const select = $(HW_SELECTS[key]);
    if (!select) continue;
    select.addEventListener('change', () => {
      state.hw.selection[key] = select.value;
      state.hw.manual = true;
      const auto = $('#hwAutoToggle');
      if (auto) auto.checked = false;
      renderHardware();
    });
  }

  $$('.hw-target').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.hw.target = btn.dataset.target;
      renderHardware();
      blip({ freq: 980, dur: 0.04, gain: 0.012, type: 'triangle' });
    });
  });

  const refresh = $('#hwRefreshBtn');
  if (refresh) {
    refresh.addEventListener('click', () => {
      state.hw.manual = false;
      ensureHardware(true);
    });
  }
}

function mockHardware() {
  const gb = 1024 ** 3;
  return {
    detectedAt: new Date().toISOString(),
    os: { platform: 'win32', release: '10.0.19045', label: 'Windows 10' },
    cpu: {
      name: 'AMD Ryzen 3 PRO 4350G with Radeon Graphics',
      cores: 4,
      threads: 8,
      maxClockMhz: 3801,
    },
    gpu: {
      name: 'AMD Radeon RX 580 2048SP',
      driver: '31.0.21925.1001',
      vramBytes: 8 * gb,
      adapters: [{ name: 'AMD Radeon RX 580 2048SP', driver: '31.0.21925.1001', vramBytes: 8 * gb }],
    },
    ram: {
      totalBytes: 16 * gb,
      type: 'DDR4',
      speedMhz: 2400,
      modules: [
        { capacityBytes: 8 * gb, speedMhz: 2400, type: 'DDR4' },
        { capacityBytes: 8 * gb, speedMhz: 2400, type: 'DDR4' },
      ],
    },
    drives: [
      { root: 'C:\\', letter: 'C', freeBytes: 6 * gb, totalBytes: 255 * gb, mediaType: 'SSD', busType: 'SATA', model: 'GC256', roles: ['disk'] },
      { root: 'D:\\', letter: 'D', freeBytes: 262 * gb, totalBytes: 499 * gb, mediaType: 'Unspecified', busType: 'SATA', model: 'WDC WD5000AVDS', roles: ['project', 'disk'] },
      { root: 'G:\\', letter: 'G', freeBytes: 376 * gb, totalBytes: 960 * gb, mediaType: 'SSD', busType: 'SATA', model: 'KINGSTON SA400S37960G', roles: ['game', 'disk'] },
    ],
    warnings: [],
  };
}

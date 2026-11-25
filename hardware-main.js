'use strict';

// Detecção de hardware do Windows, isolada do processo principal.
// Retorna CPU, GPU, VRAM, RAM e discos para a aba Hardware.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');

function createHardware({ root, getConfig, defaultDownloads }) {
﻿const PS_HARDWARE = `
$ErrorActionPreference = 'SilentlyContinue'
$cpu = Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed
$memory = Get-CimInstance Win32_PhysicalMemory | Select-Object Capacity,Speed,ConfiguredClockSpeed,SMBIOSMemoryType
$gpus = Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion
$vram = Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0*' | Select-Object DriverDesc,'HardwareInformation.qwMemorySize'
$parts = Get-Partition | Where-Object { $_.DriveLetter } | ForEach-Object {
  $partition = $_
  $disk = Get-PhysicalDisk -DeviceNumber $partition.DiskNumber
  [pscustomobject]@{
    Letter = [string]$partition.DriveLetter
    Model = $disk.FriendlyName
    MediaType = $disk.MediaType
    BusType = $disk.BusType
  }
}
[pscustomobject]@{
  cpu = @($cpu)
  memory = @($memory)
  gpus = @($gpus)
  vram = @($vram)
  parts = @($parts)
} | ConvertTo-Json -Depth 6 -Compress
`;

function runPowerShell(script, timeout = 18000) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        script,
      ],
      { timeout, windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(String(stderr || err.message).trim()));
          return;
        }
        const raw = String(stdout || '').trim();
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
          reject(new Error('Resposta de hardware vazia.'));
          return;
        }
        try {
          resolve(JSON.parse(raw.slice(start, end + 1)));
        } catch (parseError) {
          reject(parseError);
        }
      }
    );
  });
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function ramTypeName(code) {
  const types = {
    20: 'DDR',
    21: 'DDR2',
    24: 'DDR3',
    26: 'DDR4',
    27: 'LPDDR',
    28: 'LPDDR2',
    29: 'LPDDR3',
    30: 'LPDDR4',
    34: 'DDR5',
    35: 'LPDDR5',
  };
  return types[Number(code)] || null;
}

const VIRTUAL_GPU = /parsec|virtual|remote|spacedesk|basic display|microsoft|vmware|virtualbox|citrix|meta quest/i;
const INTEGRATED_GPU = /intel.*(uhd|iris|hd graphics)|radeon\(tm\) graphics|vega \d+ graphics|radeon graphics/i;

async function readHardware() {
  const warnings = [];
  let payload = null;

  try {
    payload = await runPowerShell(PS_HARDWARE);
  } catch {
    warnings.push('powershell');
  }

  const osCpus = os.cpus();
  const payloadCpu = asArray(payload && payload.cpu)[0] || {};
  const threads =
    Number(payloadCpu.NumberOfLogicalProcessors) || osCpus.length || 1;
  const cores =
    Number(payloadCpu.NumberOfCores) || Math.max(1, Math.round(threads / 2));
  const cpu = {
    name: String(payloadCpu.Name || (osCpus[0] && osCpus[0].model) || 'CPU').trim(),
    cores,
    threads,
    maxClockMhz:
      Number(payloadCpu.MaxClockSpeed) ||
      Number(osCpus[0] && osCpus[0].speed) ||
      0,
  };

  const modules = asArray(payload && payload.memory)
    .map((module) => ({
      capacityBytes: Number(module.Capacity) || 0,
      speedMhz:
        Number(module.ConfiguredClockSpeed) || Number(module.Speed) || 0,
      type: ramTypeName(module.SMBIOSMemoryType),
    }))
    .filter((module) => module.capacityBytes > 0);

  const ramType = modules.find((module) => module.type)?.type || null;
  const ramSpeed = modules.reduce(
    (max, module) => Math.max(max, module.speedMhz || 0),
    0
  );
  const ram = {
    totalBytes: os.totalmem(),
    type: ramType,
    speedMhz: ramSpeed || null,
    modules,
  };

  const vramRows = asArray(payload && payload.vram);
  const adapters = asArray(payload && payload.gpus)
    .map((gpu) => {
      const name = String(gpu.Name || '').trim();
      const row = vramRows.find(
        (entry) =>
          String(entry.DriverDesc || '').trim().toLowerCase() ===
          name.toLowerCase()
      );
      return {
        name,
        driver: String(gpu.DriverVersion || '').trim() || null,
        vramBytes:
          Number(row && row['HardwareInformation.qwMemorySize']) || 0,
        adapterRamBytes: Number(gpu.AdapterRAM) || 0,
      };
    })
    .filter((gpu) => gpu.name);

  const usableAdapters = adapters.filter((gpu) => !VIRTUAL_GPU.test(gpu.name));
  const discrete = usableAdapters.filter(
    (gpu) => !INTEGRATED_GPU.test(gpu.name)
  );
  const gpuPool = discrete.length ? discrete : usableAdapters;
  gpuPool.sort(
    (a, b) =>
      (b.vramBytes || b.adapterRamBytes) - (a.vramBytes || a.adapterRamBytes)
  );

  const primary = gpuPool[0] || null;
  if (primary && !primary.vramBytes) primary.vramBytes = primary.adapterRamBytes;

  const gpu = primary
    ? {
        name: primary.name,
        driver: primary.driver,
        vramBytes: primary.vramBytes || 0,
        adapters: adapters.map((adapter) => ({
          name: adapter.name,
          driver: adapter.driver,
          vramBytes: adapter.vramBytes || adapter.adapterRamBytes || 0,
        })),
      }
    : null;

  const parts = asArray(payload && payload.parts)
    .map((part) => ({
      letter: String(part.Letter || '')
        .replace(':', '')
        .toUpperCase(),
      model: part.Model || null,
      mediaType: part.MediaType || null,
      busType: part.BusType || null,
    }))
    .filter((part) => part.letter);

  const drives = [];
  const addDrive = (target, roles = []) => {
    const root = path.parse(target || '').root;
    if (!root) return;

    let drive = drives.find(
      (entry) => entry.root.toUpperCase() === root.toUpperCase()
    );

    if (!drive) {
      try {
        const stats = fs.statfsSync(root);
        drive = {
          root,
          letter: root.slice(0, 1).toUpperCase(),
          freeBytes: Number(stats.bavail) * Number(stats.bsize),
          totalBytes: Number(stats.blocks) * Number(stats.bsize),
          mediaType: null,
          busType: null,
          model: null,
          roles: [],
        };
        drives.push(drive);
      } catch {
        return;
      }
    }

    const part = parts.find((entry) => entry.letter === drive.letter);
    if (part) {
      drive.mediaType = part.mediaType || drive.mediaType;
      drive.busType = part.busType || drive.busType;
      drive.model = part.model || drive.model;
    }

    for (const role of roles) {
      if (!drive.roles.includes(role)) drive.roles.push(role);
    }
  };

  addDrive(root, ['project']);
  addDrive(getConfig().downloadsDir || defaultDownloads, ['downloads']);
  for (const part of parts) addDrive(`${part.letter}:\\`, ['disk']);

  const systemRelease = process.getSystemVersion
    ? process.getSystemVersion()
    : os.release();
  const buildNumber = Number(String(systemRelease).split('.')[2] || 0);
  const osLabel =
    process.platform === 'win32'
      ? buildNumber >= 22000
        ? 'Windows 11'
        : 'Windows 10'
      : `${os.type()} ${os.release()}`;

  return {
    detectedAt: new Date().toISOString(),
    os: {
      platform: process.platform,
      release: systemRelease,
      label: osLabel,
    },
    cpu,
    gpu,
    ram,
    drives,
    warnings,
  };
}

let hardwareCache = null;
let hardwareTask = null;

async function getHardware(refresh = false) {
  if (refresh) hardwareCache = null;
  if (hardwareCache) return hardwareCache;
  if (hardwareTask) return hardwareTask;

  hardwareTask = readHardware()
    .then((data) => {
      hardwareCache = data;
      return data;
    })
    .finally(() => {
      hardwareTask = null;
    });

  return hardwareTask;
}

  return { get: getHardware, read: readHardware };
}

module.exports = { createHardware };

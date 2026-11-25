'use strict';

// ---------------------------------------------------------------------------
// Saves do DexNom
//
// O runtime grava os saves em <InstallDir>\state\<TitleId>\saves, com um
// provedor por usuário (XUID) e uma pasta por configuração. Cada container de
// save é uma pasta versionada dentro da configuração. Este módulo só mexe em
// arquivos locais: instala, faz backup, restaura e deleta saves, sem tocar na
// pasta do jogo.
// ---------------------------------------------------------------------------

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFile } = require('node:child_process');

const SAVE_MAX_BYTES = 256 * 1024 * 1024; // quota do xgamesave no runtime
const SAVE_MAX_FILES = 20000;
const SAVE_BACKUP_LIMIT = 8;
const XUID_FALLBACK = '0009000000000001';
const XUID_PATTERN = /^[0-9a-f]{16}$/i;
const CONTAINER_PATTERN = /~[0-9a-f]{16}$/i;
const VERSION_PATTERN = /^v\d+$/i;
const BACKUP_PATTERN = /^\d{8}-\d{6}-(install|delete|restore)(-\d+)?$/;

function readEntries(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function isDir(target) {
  try {
    return Boolean(target) && fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function isFile(target) {
  try {
    return Boolean(target) && fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function backupStamp(date = new Date()) {
  return (
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}` +
    `-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`
  );
}

/// O runtime codifica nomes como `file_name` (`%XX`); decodifica para exibir.
function decodeName(name) {
  if (!name || name.includes('.')) return name || '';
  const bytes = [];
  for (let index = 0; index < name.length; index += 1) {
    if (name[index] === '%') {
      const hex = name.slice(index + 1, index + 3);
      if (!/^[0-9a-f]{2}$/i.test(hex)) return name;
      bytes.push(parseInt(hex, 16));
      index += 2;
    } else {
      const code = name.charCodeAt(index);
      if (code > 0x7f) return name;
      bytes.push(code);
    }
  }
  try {
    return Buffer.from(bytes).toString('utf8') || name;
  } catch {
    return name;
  }
}

function containerName(folder) {
  const match = /^(.*)~[0-9a-f]{16}$/i.exec(folder);
  return decodeName(match ? match[1] : folder) || folder;
}

function detectXuid(savesDir, fallback = XUID_FALLBACK) {
  const entries = readEntries(savesDir)
    .filter((entry) => entry.isDirectory() && XUID_PATTERN.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  return entries.length ? entries[0].name.toUpperCase() : fallback;
}

function scanTree(dir, depth = 0) {
  const out = { files: 0, dirs: 0, bytes: 0, modified: 0 };
  if (!dir || depth > 16) return out;
  for (const entry of readEntries(dir)) {
    const full = path.join(dir, entry.name);
    let stat = null;
    try {
      stat = fs.lstatSync(full);
    } catch {
      continue;
    }
    out.modified = Math.max(out.modified, stat.mtimeMs || 0);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      out.dirs += 1;
      const child = scanTree(full, depth + 1);
      out.files += child.files;
      out.dirs += child.dirs;
      out.bytes += child.bytes;
      out.modified = Math.max(out.modified, child.modified);
    } else if (stat.isFile()) {
      out.files += 1;
      out.bytes += stat.size;
    }
  }
  return out;
}

function copyTree(source, target, totals, limits = {}) {
  const maxBytes = limits.maxBytes == null ? SAVE_MAX_BYTES : limits.maxBytes;
  const maxFiles = limits.maxFiles == null ? SAVE_MAX_FILES : limits.maxFiles;
  fs.mkdirSync(target, { recursive: true });
  for (const entry of readEntries(source)) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    let stat = null;
    try {
      stat = fs.lstatSync(from);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      copyTree(from, to, totals, limits);
      continue;
    }
    if (!stat.isFile()) continue;
    if (totals.files >= maxFiles || totals.bytes + stat.size > maxBytes) {
      const error = new Error('tooBig');
      error.code = 'toobig';
      throw error;
    }
    fs.copyFileSync(from, to);
    totals.files += 1;
    totals.bytes += stat.size;
  }
}

function hasVersionDir(dir) {
  return readEntries(dir).some((entry) => entry.isDirectory() && VERSION_PATTERN.test(entry.name));
}

function listContainers(configDir) {
  return readEntries(configDir)
    .filter(
      (entry) =>
        entry.isDirectory() && !entry.name.endsWith('.gone') && !entry.name.endsWith('.new')
    )
    .map((entry) => {
      const full = path.join(configDir, entry.name);
      const stats = scanTree(full);
      return {
        folder: entry.name,
        name: containerName(entry.name),
        bytes: stats.bytes,
        files: stats.files,
        modified: stats.modified,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function listConfigs(savesDir, xuid) {
  const userDir = path.join(savesDir, xuid);
  return readEntries(userDir)
    .filter((entry) => entry.isDirectory() && !entry.name.includes('.'))
    .map((entry) => {
      const full = path.join(userDir, entry.name);
      const stats = scanTree(full);
      return {
        folder: entry.name,
        name: decodeName(entry.name) || entry.name,
        path: full,
        bytes: stats.bytes,
        files: stats.files,
        modified: stats.modified,
        containers: listContainers(full),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function listBackups(backupsDir) {
  return readEntries(backupsDir)
    .filter((entry) => entry.isDirectory() && BACKUP_PATTERN.test(entry.name))
    .map((entry) => {
      const full = path.join(backupsDir, entry.name);
      const stats = scanTree(full);
      return {
        name: entry.name,
        bytes: stats.bytes,
        files: stats.files,
        modified: stats.modified,
      };
    })
    .sort((a, b) => b.name.localeCompare(a.name));
}

function pruneBackups(backupsDir, limit = SAVE_BACKUP_LIMIT) {
  const entries = readEntries(backupsDir)
    .filter((entry) => entry.isDirectory() && BACKUP_PATTERN.test(entry.name))
    .sort((a, b) => b.name.localeCompare(a.name));
  for (const entry of entries.slice(limit)) {
    try {
      fs.rmSync(path.join(backupsDir, entry.name), { recursive: true, force: true });
    } catch {
      /* backup antigo pode estar em uso; tenta na próxima */
    }
  }
}

/// Move os saves atuais para a pasta de backups, recriando a pasta vazia.
/// Retorna null quando não há nada para guardar.
function backupSaves(paths, reason, options = {}) {
  if (!isDir(paths.savesDir)) return null;
  const stats = scanTree(paths.savesDir);
  if (!stats.files && !stats.dirs) return null;
  fs.mkdirSync(paths.backupsDir, { recursive: true });
  const stamp = backupStamp();
  let name = `${stamp}-${reason}`;
  let counter = 2;
  while (fs.existsSync(path.join(paths.backupsDir, name))) {
    name = `${stamp}-${reason}-${counter}`;
    counter += 1;
  }
  const target = path.join(paths.backupsDir, name);
  try {
    fs.renameSync(paths.savesDir, target);
  } catch {
    const totals = { files: 0, bytes: 0 };
    try {
      copyTree(paths.savesDir, target, totals, {
        maxBytes: Number.MAX_SAFE_INTEGER,
        maxFiles: Number.MAX_SAFE_INTEGER,
      });
    } catch (error) {
      fs.rmSync(target, { recursive: true, force: true });
      throw error;
    }
    fs.rmSync(paths.savesDir, { recursive: true, force: true });
  }
  fs.mkdirSync(paths.savesDir, { recursive: true });
  pruneBackups(paths.backupsDir, options.backupLimit || SAVE_BACKUP_LIMIT);
  return { name, path: target, bytes: stats.bytes, files: stats.files };
}

function restoreSavesFrom(paths, backupPath) {
  fs.rmSync(paths.savesDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(paths.savesDir), { recursive: true });
  try {
    fs.renameSync(backupPath, paths.savesDir);
  } catch {
    copyTree(backupPath, paths.savesDir, { files: 0, bytes: 0 }, {
      maxBytes: Number.MAX_SAFE_INTEGER,
      maxFiles: Number.MAX_SAFE_INTEGER,
    });
  }
}

function classifySaveInput(source, depth = 0) {
  const entries = readEntries(source);
  if (!entries.length) return { error: 'empty' };
  const dirs = entries.filter((entry) => entry.isDirectory());

  const user = dirs.find((entry) => XUID_PATTERN.test(entry.name));
  if (user) return { kind: 'user', source: path.join(source, user.name) };

  const saves = dirs.find((entry) => entry.name.toLowerCase() === 'saves');
  if (saves) {
    const nested = path.join(source, saves.name);
    const nestedUser = readEntries(nested).find(
      (entry) => entry.isDirectory() && XUID_PATTERN.test(entry.name)
    );
    return nestedUser
      ? { kind: 'user', source: path.join(nested, nestedUser.name) }
      : { kind: 'root', source: nested };
  }

  if (dirs.some((entry) => entry.name.toLowerCase() === 'default')) {
    return { kind: 'root', source };
  }

  // Um container isolado não é um save completo; pedimos a pasta de configuração.
  if (dirs.some((entry) => VERSION_PATTERN.test(entry.name))) {
    return { error: 'container' };
  }

  if (dirs.some((entry) => CONTAINER_PATTERN.test(entry.name))) {
    return { kind: 'config', source };
  }

  if (dirs.length && dirs.every((entry) => hasVersionDir(path.join(source, entry.name)))) {
    return { kind: 'config', source };
  }

  if (depth < 2 && dirs.length === 1 && entries.length === 1) {
    return classifySaveInput(path.join(source, dirs[0].name), depth + 1);
  }

  if (dirs.length) return { kind: 'root', source };
  return { kind: 'config', source };
}

function targetFor(paths, kind) {
  if (kind === 'user' || kind === 'root') return paths.userDir;
  return path.join(paths.userDir, 'default');
}

function runPowerShell(scriptPath, timeout = 120000) {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
      ],
      { timeout, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: String(stdout || '').trim(),
          stderr: String(stderr || '').trim(),
          error: error ? String(error.message || error) : '',
        });
      }
    );
  });
}

async function extractZip(zipPath, dest, options = {}) {
  if (!isFile(zipPath)) return { ok: false, error: 'format' };
  const maxBytes = options.maxBytes == null ? SAVE_MAX_BYTES : options.maxBytes;
  const maxFiles = options.maxFiles == null ? SAVE_MAX_FILES : options.maxFiles;
  const tmpDir = options.tmpDir || os.tmpdir();
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.rmSync(dest, { recursive: true, force: true });
  const scriptPath = path.join(
    tmpDir,
    `portwatch-unzip-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`
  );
  const quote = (value) => String(value).replace(/'/g, "''");
  const script = `$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zipPath = '${quote(zipPath)}'
$dest = '${quote(dest)}'
$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $total = [int64]0
  $count = 0
  foreach ($entry in $archive.Entries) {
    $name = $entry.FullName
    if ([string]::IsNullOrWhiteSpace($name)) { continue }
    $count++
    if ($count -gt ${maxFiles}) { throw 'ZIP com arquivos demais.' }
    if ($name -match '^[A-Za-z]:' -or $name.StartsWith('/') -or $name.StartsWith('\\')) {
      throw "Entrada invalida: $name"
    }
    $parts = $name -split '[\\\\/]'
    if ($parts -contains '..') { throw "Entrada invalida: $name" }
    $total += $entry.Length
    if ($total -gt ${maxBytes}) { throw 'Save maior que o limite.' }
  }
} finally {
  $archive.Dispose()
}
[IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $dest)
`;
  fs.writeFileSync(scriptPath, script, 'utf8');
  try {
    const result = await runPowerShell(scriptPath);
    if (!result.ok) {
      return {
        ok: false,
        error: 'zip',
        detail: (result.stderr || result.error || '').slice(0, 2000),
      };
    }
    return { ok: true };
  } finally {
    try {
      fs.rmSync(scriptPath, { force: true });
    } catch {
      /* script temporario */
    }
  }
}

async function installSave(paths, inputPath, options = {}) {
  if (!paths || !paths.savesDir || !paths.userDir) return { ok: false, error: 'install' };
  const zip = isFile(inputPath) && /\.zip$/i.test(inputPath);
  if (!zip && !isDir(inputPath)) return { ok: false, error: 'format' };

  const maxBytes = options.maxBytes == null ? SAVE_MAX_BYTES : options.maxBytes;
  const maxFiles = options.maxFiles == null ? SAVE_MAX_FILES : options.maxFiles;
  const tmpDir = options.tmpDir || os.tmpdir();
  fs.mkdirSync(tmpDir, { recursive: true });
  const staging = path.join(
    tmpDir,
    `portwatch-save-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  try {
    let source = inputPath;
    if (zip) {
      const extraction = await extractZip(inputPath, staging, { tmpDir, maxBytes, maxFiles });
      if (!extraction.ok) return extraction;
      source = staging;
    }

    const classified = classifySaveInput(source);
    if (classified.error) return { ok: false, error: classified.error };

    const stats = scanTree(classified.source);
    if (!stats.files) return { ok: false, error: 'empty' };
    if (stats.bytes > maxBytes || stats.files > maxFiles) {
      return { ok: false, error: 'toobig' };
    }

    const backup = backupSaves(paths, 'install', options);
    const target = targetFor(paths, classified.kind);
    const totals = { files: 0, bytes: 0 };
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.rmSync(target, { recursive: true, force: true });
      copyTree(classified.source, target, totals, { maxBytes, maxFiles });
      if (!totals.files) {
        const error = new Error('empty');
        error.code = 'empty';
        throw error;
      }
    } catch (error) {
      if (backup) restoreSavesFrom(paths, backup.path);
      return {
        ok: false,
        error: error.code === 'empty' ? 'empty' : error.code === 'toobig' ? 'toobig' : 'copy',
        detail: String(error.message || error),
      };
    }

    return {
      ok: true,
      kind: classified.kind,
      files: totals.files,
      bytes: totals.bytes,
      backup: backup ? backup.name : '',
    };
  } catch (error) {
    return { ok: false, error: 'copy', detail: String(error.message || error) };
  } finally {
    try {
      fs.rmSync(staging, { recursive: true, force: true });
    } catch {
      /* pasta temporaria */
    }
  }
}

function deleteSaves(paths, options = {}) {
  if (!isDir(paths.savesDir)) return { ok: false, error: 'missing' };
  const stats = scanTree(paths.savesDir);
  if (!stats.files && !stats.dirs) return { ok: false, error: 'empty' };
  const backup = backupSaves(paths, 'delete', options);
  if (!backup) return { ok: false, error: 'empty' };
  return {
    ok: true,
    backup: backup.name,
    files: stats.files,
    bytes: stats.bytes,
  };
}

function restoreSaves(paths, name, options = {}) {
  if (typeof name !== 'string' || !BACKUP_PATTERN.test(name)) {
    return { ok: false, error: 'format' };
  }
  const backupPath = path.join(paths.backupsDir, name);
  if (!isDir(backupPath)) return { ok: false, error: 'missing' };
  const stats = scanTree(backupPath);
  const current = backupSaves(paths, 'restore', options);
  try {
    fs.rmSync(paths.savesDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(paths.savesDir), { recursive: true });
    copyTree(backupPath, paths.savesDir, { files: 0, bytes: 0 }, {
      maxBytes: Number.MAX_SAFE_INTEGER,
      maxFiles: Number.MAX_SAFE_INTEGER,
    });
    return {
      ok: true,
      backup: current ? current.name : '',
      files: stats.files,
      bytes: stats.bytes,
    };
  } catch (error) {
    try {
      fs.rmSync(paths.savesDir, { recursive: true, force: true });
    } catch {
      /* pasta parcial */
    }
    if (current) restoreSavesFrom(paths, current.path);
    return { ok: false, error: 'copy', detail: String(error.message || error) };
  }
}

module.exports = {
  SAVE_MAX_BYTES,
  SAVE_MAX_FILES,
  SAVE_BACKUP_LIMIT,
  detectXuid,
  listConfigs,
  listBackups,
  installSave,
  deleteSaves,
  restoreSaves,
  scanTree,
  classifySaveInput,
  extractZip,
};

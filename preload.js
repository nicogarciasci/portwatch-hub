'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('portwatch', {
  isDesktop: true,
  getState: () => ipcRenderer.invoke('app:state'),
  race: (force) => ipcRenderer.invoke('portwatch:race', force === true),
  forks: (force) => ipcRenderer.invoke('portwatch:forks', force === true),
  hardware: (refresh) => ipcRenderer.invoke('system:hardware', refresh === true),
  saveConfig: (patch) => ipcRenderer.invoke('config:save', patch),
  resetConfig: () => ipcRenderer.invoke('config:reset'),
  download: (payload) => ipcRenderer.invoke('download:repo', payload),
  pickDownloadDir: () => ipcRenderer.invoke('download:pick-dir'),
  downloads: () => ipcRenderer.invoke('download:list'),
  openDownload: (name) => ipcRenderer.invoke('download:open', name),
  chooseDownloadsDir: () => ipcRenderer.invoke('download:choose-dir'),
  updateState: () => ipcRenderer.invoke('update:state'),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateDownload: (payload) => ipcRenderer.invoke('update:download', payload),
  updateApply: () => ipcRenderer.invoke('update:apply'),
  runtimeStatus: () => ipcRenderer.invoke('runtime:status'),
  runtimeSelect: (id) => ipcRenderer.invoke('runtime:select', id),
  dexnomStatus: () => ipcRenderer.invoke('dexnom:status'),
  dexnomChooseGame: () => ipcRenderer.invoke('dexnom:choose-game'),
  dexnomChooseSource: () => ipcRenderer.invoke('dexnom:choose-source'),
  dexnomChooseInstall: () => ipcRenderer.invoke('dexnom:choose-install'),
  dexnomChooseMsvc: () => ipcRenderer.invoke('dexnom:choose-msvc'),
  dexnomInstallMsvc: () => ipcRenderer.invoke('dexnom:install-msvc'),
  dexnomPrepare: () => ipcRenderer.invoke('dexnom:prepare'),
  dexnomCancel: () => ipcRenderer.invoke('dexnom:cancel'),
  dexnomLaunch: () => ipcRenderer.invoke('dexnom:launch'),
  dexnomStop: () => ipcRenderer.invoke('dexnom:stop'),
  dexnomOpen: (kind) => ipcRenderer.invoke('dexnom:open', kind),
  savesStatus: () => ipcRenderer.invoke('saves:status'),
  savesInstall: (kind) => ipcRenderer.invoke('saves:install', kind),
  savesDelete: () => ipcRenderer.invoke('saves:delete'),
  savesRestore: (name) => ipcRenderer.invoke('saves:restore', name),
  savesOpen: (kind) => ipcRenderer.invoke('saves:open', kind),
  openPath: (kind) => ipcRenderer.invoke('shell:openPath', kind),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  win: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    hide: () => ipcRenderer.invoke('window:hide'),
    toggleFullscreen: () => ipcRenderer.invoke('window:fullscreen'),
    isFullscreen: () => ipcRenderer.invoke('window:isFullscreen'),
  },
  onDownloadProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('download:progress', listener);
    return () => ipcRenderer.removeListener('download:progress', listener);
  },
  onUpdateProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('update:progress', listener);
    return () => ipcRenderer.removeListener('update:progress', listener);
  },
  onDexnomSetup: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('dexnom:setup', listener);
    return () => ipcRenderer.removeListener('dexnom:setup', listener);
  },
  onDexnomGame: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('dexnom:game', listener);
    return () => ipcRenderer.removeListener('dexnom:game', listener);
  },
  onDexnomMsvc: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('dexnom:msvc', listener);
    return () => ipcRenderer.removeListener('dexnom:msvc', listener);
  },
});

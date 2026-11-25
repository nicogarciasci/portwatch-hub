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
  downloads: () => ipcRenderer.invoke('download:list'),
  openDownload: (name) => ipcRenderer.invoke('download:open', name),
  chooseDownloadsDir: () => ipcRenderer.invoke('download:choose-dir'),
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
});

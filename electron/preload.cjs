const { contextBridge, ipcRenderer } = require('electron');

// ── Expose safe APIs to the renderer (React app) ──
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // Platform info
  platform: process.platform,
  isElectron: true,
});

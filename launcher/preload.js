const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onExcelData: (callback) => {
    const subscription = (event, value) => callback(value);
    ipcRenderer.on('excel-data', subscription);
    return () => ipcRenderer.removeListener('excel-data', subscription);
  },
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close')
});

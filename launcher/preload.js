const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onExcelData: (callback) => {
    const subscription = (event, value) => callback(value);
    ipcRenderer.on('excel-data', subscription);
    return () => ipcRenderer.removeListener('excel-data', subscription);
  }
});

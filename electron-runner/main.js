const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const VITE_DEV_SERVER_URL = 'http://localhost:5173';

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 900,
    minHeight: 600,

    // Sin barra de título nativa
    frame: false,

    // Efecto Mica de Windows 11
    backgroundMaterial: 'mica',

    // Botones nativos de Windows coloreados para tema oscuro
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',       // Transparente (deja ver el mica)
      symbolColor: '#a1a1aa',   // Color zinc-400 (suave sobre oscuro)
      height: 44,
    },

    // Esquinas redondeadas (Windows 11)
    roundedCorners: true,

    show: false,

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // false solo en dev
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    // Abrimos DevTools desacopladas para no perder espacio
    // win.webContents.openDevTools({ mode: 'detach' });
  });

  win.loadURL(VITE_DEV_SERVER_URL);

  // IPC: controles de ventana desde React
  ipcMain.on('window-minimize', () => win.minimize());
  ipcMain.on('window-maximize', () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on('window-close', () => win.close());

  // Abrir links externos en el navegador
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

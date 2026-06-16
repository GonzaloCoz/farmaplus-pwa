const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const VITE_DEV_SERVER_URL = 'http://localhost:5173';
const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 900,
    minHeight: 600,

    // ── Sin barra de título nativa ──
    frame: false,

    // ── Efecto Mica de Windows 11 ──
    // backgroundMaterial requiere Windows 11 build 22621+
    backgroundMaterial: 'mica',

    // ── Botones nativos de Windows (min/max/close) coloreados ──
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',       // Fondo transparente (deja ver el mica)
      symbolColor: '#a1a1aa',   // Color de los íconos (zinc-400)
      height: 44,               // Altura de la zona de controles
    },

    // ── Esquinas redondeadas (Windows 11) ──
    roundedCorners: true,

    // ── Icono de la app ──
    // icon: path.join(__dirname, 'icons', 'icon.png'),

    show: false, // Mostrar solo cuando esté lista

    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: isDev ? false : true,
    },
  });

  // ── Mostrar la ventana una vez que el contenido cargó (evita flash blanco) ──
  win.once('ready-to-show', () => {
    win.show();
    if (isDev) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // ── Cargar la app ──
  if (isDev) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // ── IPC: controles de ventana desde React ──
  ipcMain.on('window-minimize', () => win.minimize());
  ipcMain.on('window-maximize', () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });
  ipcMain.on('window-close', () => win.close());

  // ── Abrir links externos en el navegador del sistema ──
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

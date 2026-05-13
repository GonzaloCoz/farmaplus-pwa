const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const xlsx = require('xlsx');
const chokidar = require('chokidar');

let mainWindow;
let tray = null;
let isQuitting = false;
let watcher = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false, // Don't show the window until it's ready, prevents white flash
    backgroundColor: '#0a0a0a', // Dark background matching the app theme
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const isDev = !app.isPackaged;
  const pwaUrl = isDev ? 'http://localhost:5173' : 'https://farmaplus.vercel.app/';
  
  const loadPWA = () => {
    mainWindow.loadURL(pwaUrl).catch(err => {
      console.error('Error al cargar la PWA:', err);
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
            
            body { 
              font-family: 'Outfit', sans-serif; 
              background: #09090b; 
              color: #fafafa; 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0; 
              text-align: center;
              overflow: hidden;
            }

            .background {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: radial-gradient(circle at 50% 50%, rgba(39, 39, 42, 0.5) 0%, rgba(9, 9, 11, 1) 100%);
              z-index: -1;
            }

            .container {
              max-width: 440px;
              padding: 3rem;
              border: 1px solid rgba(39, 39, 42, 0.8);
              border-radius: 2rem;
              background: rgba(24, 24, 27, 0.8);
              backdrop-filter: blur(20px);
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
              animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
            }

            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }

            .icon-wrapper {
              width: 80px;
              height: 80px;
              background: rgba(255, 255, 255, 0.05);
              border-radius: 1.5rem;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 2rem;
              border: 1px solid rgba(255, 255, 255, 0.1);
              font-size: 2.5rem;
            }

            h1 { 
              font-size: 1.75rem; 
              font-weight: 700;
              margin-bottom: 0.75rem; 
              color: #fff; 
              letter-spacing: -0.025em;
            }

            p { 
              color: #a1a1aa; 
              font-size: 1rem; 
              line-height: 1.6; 
              margin-bottom: 2rem; 
              font-weight: 400;
            }

            .error-details {
              font-family: 'JetBrains Mono', monospace;
              background: rgba(0, 0, 0, 0.3);
              padding: 0.75rem 1rem;
              border-radius: 0.75rem;
              font-size: 0.75rem;
              color: #ef4444;
              border: 1px solid rgba(239, 68, 68, 0.2);
              margin-bottom: 2rem;
              display: inline-block;
            }

            button { 
              background: #fff; 
              color: #000; 
              border: none; 
              padding: 1rem 2rem; 
              border-radius: 1rem; 
              font-weight: 600; 
              font-size: 1rem;
              cursor: pointer; 
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
              width: 100%;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            }

            button:hover { 
              transform: translateY(-2px);
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
              background: #f4f4f5;
            }

            button:active {
              transform: translateY(0);
            }
          </style>
        </head>
        <body>
          <div class="background"></div>
          <div class="container">
            <div class="icon-wrapper">📡</div>
            <h1>Error de Conexión</h1>
            <p>No se pudo conectar con el servidor de Farmaplus.<br>Verifica tu conexión a internet para continuar.</p>
            <div class="error-details">
              ${err.message}
            </div>
            <button onclick="window.location.reload()">Reintentar conexión</button>
          </div>
        </body>
        </html>
      `;
      mainWindow.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
    });
  };

  loadPWA();

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Abrir herramientas de desarrollo para debuggear
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on('did-finish-load', () => {
    handleFileArg(process.argv);
  });
}

function handleFileArg(argv) {
  if (!argv || argv.length === 0) return;

  const filePath = argv.find(arg => {
    if (typeof arg !== 'string') return false;
    const isExcel = arg.toLowerCase().endsWith('.xlsx') || 
                  arg.toLowerCase().endsWith('.xls') || 
                  arg.toLowerCase().endsWith('.csv') ||
                  arg.toLowerCase().endsWith('.tmp');
    return isExcel && fs.existsSync(arg);
  });

  if (filePath) {
    console.log(`[Launcher] Procesando archivo: ${filePath}`);
    
    const isTemp = filePath.toLowerCase().includes('temp') || filePath.toLowerCase().includes('appdata');
    
    // Si el archivo ya está siendo procesado o es de un evento de watcher, 
    // evitamos bucles infinitos si volvemos a disparar eventos
    if (global.lastProcessedFile === filePath && Date.now() - (global.lastProcessedTime || 0) < 2000) {
      return;
    }
    global.lastProcessedFile = filePath;
    global.lastProcessedTime = Date.now();

    if (isTemp) {
      const options = {
        title: 'Guardar Inventario Plex25',
        defaultPath: path.join(app.getPath('documents'), 'Inventario_' + path.basename(filePath)),
        buttonLabel: 'Guardar y Procesar',
        filters: [
          { name: 'Libro de Excel', extensions: ['xlsx'] },
          { name: 'Excel 97-2003', extensions: ['xls'] },
          { name: 'Archivo CSV', extensions: ['csv'] }
        ]
      };

      dialog.showSaveDialog(mainWindow, options).then(result => {
        if (!result.canceled && result.filePath) {
          try {
            fs.copyFileSync(filePath, result.filePath);
            console.log(`[Launcher] Copia guardada en: ${result.filePath}`);
            processFile(result.filePath);
            
            // Opcional: Intentar borrar el temporal para que Excel no lo abra
            try {
              fs.unlinkSync(filePath);
            } catch (e) {
              // Si falla (archivo bloqueado por Plex), no importa
            }
          } catch (err) {
            console.error("Error al guardar copia:", err);
            processFile(filePath);
          }
        } else {
          processFile(filePath);
        }
      });
    } else {
      processFile(filePath);
    }
  }
}

function parsePlexTmp(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    const content = buf.toString('latin1');
    const eanRegex = /\d{13}/g;
    let match;
    const records = [];

    while ((match = eanRegex.exec(content)) !== null) {
      const eanPos = match.index;
      const ean = match[0];
      
      // Buscar nombre del producto (aproximado)
      let prodName = '';
      let k = eanPos + 13;
      while (k < content.length && k < eanPos + 100) {
        const ch = content.charCodeAt(k);
        if (ch >= 0x20 && ch < 0x7F) prodName += content[k];
        else if (prodName.length > 3) break;
        k++;
      }
      
      // Buscar tipo de movimiento
      const context = content.substring(Math.max(0, eanPos - 20), Math.min(content.length, eanPos + 300));
      const movTypeMatch = context.match(/(Alta de Stock|Baja de Stock|Ajuste|Carga de Inventario|Modificado)/);
      const movementType = movTypeMatch ? movTypeMatch[0] : 'Desconocido';

      // Buscar cantidad (intentar leer double después del nombre)
      // En el análisis vimos que las cantidades suelen estar después del string del producto
      let cantidad = 1;
      try {
        // Buscamos un double razonable en los bytes siguientes
        for (let i = k; i < k + 100; i++) {
          const val = buf.readDoubleLE(i);
          if (val > 0 && val < 100000 && Number.isInteger(val)) {
            cantidad = val;
            break;
          }
        }
      } catch (e) {}

      records.push({
        ean,
        producto: prodName.trim(),
        movimiento: movementType,
        cantidad: cantidad
      });
    }
    return records;
  } catch (err) {
    console.error("Error parseando .tmp de Plex:", err);
    return [];
  }
}

function processFile(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    let data;
    let filename = path.basename(filePath);

    if (ext === '.tmp') {
      console.log(`[Launcher] Parseando archivo binario Plex: ${filePath}`);
      const records = parsePlexTmp(filePath);
      // Formatear para que la PWA lo reciba igual que un Excel (array de arrays)
      data = [
        ['EAN', 'Producto', 'Movimiento', 'Cantidad'],
        ...records.map(r => [r.ean, r.producto, r.movimiento, r.cantidad])
      ];
    } else {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    }
    
    console.log(`Enviando ${data.length} filas a la PWA`);
    if (mainWindow) {
      mainWindow.webContents.send('excel-data', {
        filename: filename,
        rows: data,
        size: fs.statSync(filePath).size
      });
      mainWindow.show();
    }
  } catch (error) {
    console.error("Error leyendo el archivo:", error);
  }
}

// Asegurar que solo haya una instancia corriendo
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      handleFileArg(commandLine);
    }
  });

  app.whenReady().then(() => {
    // Configurar inicio automático con Windows
    if (app.isPackaged) {
      app.setLoginItemSettings({
        openAtLogin: true,
        path: app.getPath('exe')
      });
    }

    createWindow();
    createTray();
    startWatcher();
  });
}

function startWatcher() {
  const tmpDir = os.tmpdir();
  const plexTmpDir = 'C:\\Plex 25\\Gestion\\Temp';
  
  const pathsToWatch = [tmpDir];
  if (fs.existsSync(plexTmpDir)) {
    pathsToWatch.push(plexTmpDir);
    console.log(`[Launcher] Añadida carpeta Plex25 al watcher: ${plexTmpDir}`);
  }
  
  console.log(`[Launcher] Iniciando auto-intercepción en: ${pathsToWatch.join(', ')}`);
  
  // Watcher para detectar exportaciones automáticas (ej. desde Plex25)
  watcher = chokidar.watch(pathsToWatch, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    depth: 1,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500, // Reducido para capturar archivos rápidos
      pollInterval: 100
    }
  });

  watcher.on('add', (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const isExcel = ext === '.xlsx' || ext === '.xls' || ext === '.csv' || ext === '.tmp';
    
    if (isExcel) {
      console.log(`[Watcher] Interceptada exportación: ${filePath}`);
      // Pequeño delay para asegurar que cualquier proceso externo (Plex) haya soltado el archivo
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          handleFileArg([filePath]);
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      }, 500);
    }
  });
}

function createTray() {
  // Intentar usar el icono de la app o uno por defecto
  const iconPath = path.join(__dirname, 'icon.png'); 
  let trayIcon;
  
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } else {
    // Icono vacío/fallback si no existe el archivo
    trayIcon = nativeImage.createEmpty(); 
  }

  tray = new Tray(trayIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Abrir Farmaplus', 
      click: () => {
        mainWindow.show();
      } 
    },
    { type: 'separator' },
    { 
      label: 'Sincronizar Plex25...', 
      click: () => {
        dialog.showOpenDialog({
          properties: ['openFile'],
          filters: [{ name: 'Archivos de Datos', extensions: ['xlsx', 'xls', 'csv', 'tmp'] }]
        }).then(result => {
          if (!result.canceled && result.filePaths.length > 0) {
            handleFileArg([result.filePaths[0]]);
            mainWindow.show();
          }
        });
      }
    },
    { type: 'separator' },
    { 
      label: 'Cerrar Completamente', 
      click: () => {
        isQuitting = true;
        app.quit();
      } 
    }
  ]);

  tray.setToolTip('Farmaplus Launcher - Activo en segundo plano');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
  });
}

// Modificar el comportamiento de cierre de la ventana principal
// Dentro de createWindow (línea 20 aprox) deberíamos añadir:
// mainWindow.on('close', (event) => {
//   if (!isQuitting) {
//     event.preventDefault();
//     mainWindow.hide();
//   }
//   return false;
// });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

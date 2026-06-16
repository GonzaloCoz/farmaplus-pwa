const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, screen } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const xlsx = require('xlsx');
const chokidar = require('chokidar');

let mainWindow;
let tray = null;
let isQuitting = false;
let watcher = null;

// ── Custom maximize state (avoids native DWM maximize that breaks Mica) ──
let isCustomMaximized = false;
let savedBounds = null;

// ── IPC Handlers for custom window controls ──
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;

  if (isCustomMaximized) {
    // Restore to previously saved bounds
    isCustomMaximized = false;
    if (savedBounds) {
      mainWindow.setBounds(savedBounds, true);
    }
    // Re-apply Acrylic after short delay to allow DWM to settle
    setTimeout(() => {
      if (mainWindow) mainWindow.setBackgroundMaterial('acrylic');
    }, 150);
  } else {
    // Save current bounds and expand to work area (not native maximize)
    savedBounds = mainWindow.getBounds();
    const { workArea } = screen.getDisplayMatching(savedBounds);
    isCustomMaximized = true;
    mainWindow.setBounds({
      x: workArea.x,
      y: workArea.y,
      width: workArea.width,
      height: workArea.height
    }, true);
    // Re-apply Acrylic after short delay to allow DWM to settle
    setTimeout(() => {
      if (mainWindow) mainWindow.setBackgroundMaterial('acrylic');
    }, 150);
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,

    // ── Sin barra de título nativa de Windows ──
    frame: false,

    // ── Efecto Acrílico (Windows 11) — más transparente que Mica, muestra el escritorio ──
    backgroundMaterial: 'acrylic',

    // ── Esquinas redondeadas (Windows 11) ──
    roundedCorners: true,

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

  // Re-apply Acrylic when restoring from minimized state
  mainWindow.on('restore', () => {
    setTimeout(() => {
      if (mainWindow) mainWindow.setBackgroundMaterial('acrylic');
    }, 200);
  });

  mainWindow.on('show', () => {
    setTimeout(() => {
      if (mainWindow) mainWindow.setBackgroundMaterial('acrylic');
    }, 200);
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

  // Filtrar argumentos que sean rutas de archivos válidas y soportadas
  const filePath = argv.find(arg => {
    if (typeof arg !== 'string' || arg.startsWith('--')) return false;
    const lowerArg = arg.toLowerCase();
    const isSupported = lowerArg.endsWith('.xlsx') || 
                       lowerArg.endsWith('.xls') || 
                       lowerArg.endsWith('.csv') ||
                       lowerArg.endsWith('.tmp');
    if (!isSupported) return false;
    try {
      return fs.existsSync(arg) && fs.statSync(arg).isFile();
    } catch (e) { return false; }
  });

  if (filePath) {
    // Evitar procesar el mismo archivo múltiples veces seguidas (debounce)
    const now = Date.now();
    if (global.lastProcessedFile === filePath && now - (global.lastProcessedTime || 0) < 3000) {
      return;
    }

    // Solo procesar si el archivo tiene un tamaño mínimo (evitar archivos vacíos de sistema)
    try {
      const stats = fs.statSync(filePath);
      if (stats.size === 0) return;
    } catch (e) { return; }

    console.log(`[Launcher] Evaluando archivo: ${filePath}`);
    
    // Un archivo se considera "temporal de Plex" solo si está en su carpeta específica
    // o si es un .tmp que contiene palabras clave como 'stock' o 'plex'
    const isPlexFolder = filePath.toLowerCase().includes('plex 25') || filePath.toLowerCase().includes('gestion\\temp');
    const isPlexFile = filePath.toLowerCase().includes('stock') || filePath.toLowerCase().includes('plex');
    const isTemp = (isPlexFolder || isPlexFile) && filePath.toLowerCase().endsWith('.tmp');
    const isStockOriginal = filePath.toLowerCase().endsWith('stock_original.tmp');

    global.lastProcessedFile = filePath;
    global.lastProcessedTime = now;

    if (isStockOriginal || isTemp) {
      // Prioridad máxima a stock_original.tmp (Captura instantánea de Plex25)
      const fileName = isStockOriginal ? 'Stock_Plex_Auto_' + Date.now() + '.xlsx' : path.basename(filePath);
      const options = {
        title: 'Guardar y Procesar Inventario',
        defaultPath: path.join(app.getPath('documents'), fileName.endsWith('.tmp') ? fileName.replace('.tmp', '.xlsx') : fileName),
        buttonLabel: 'Guardar y Procesar',
        filters: [
          { name: 'Archivos de Excel', extensions: ['xlsx', 'xls'] },
          { name: 'Todos los archivos', extensions: ['*'] }
        ]
      };

      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        
        dialog.showSaveDialog(mainWindow, options).then(result => {
          if (!result.canceled && result.filePath) {
            try {
              // Copiamos el archivo a la nueva ubicación elegida por el usuario
              fs.copyFileSync(filePath, result.filePath);
              processFile(result.filePath);
              console.log(`[Launcher] Archivo guardado por usuario y procesado: ${result.filePath}`);
            } catch (err) {
              console.error("Error al guardar/procesar archivo:", err);
              // Si falla la copia (ej. permisos), intentamos procesar el original igual
              processFile(filePath);
            }
          }
        });
      }
    } else {
      // Archivos abiertos manualmente o que no cumplen criterios de Plex
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
      
      // En stock_original.tmp, el nombre viene después del EAN (saltando metadatos)
      let prodName = '';
      let k = eanPos + 13;
      while (k < content.length && k < eanPos + 200) {
        const ch = content.charCodeAt(k);
        // Filtramos caracteres imprimibles básicos
        if (ch >= 0x20 && ch < 0x7F) prodName += content[k];
        else if (prodName.length > 5) break; 
        k++;
      }
      
      // Buscar cantidad (en stock_original suelen ser 4-8 bytes después del nombre)
      let cantidad = 1;
      try {
        // Buscamos un valor numérico cercano
        for (let i = k; i < k + 50; i++) {
          const val = buf.readInt32LE(i);
          if (val > 0 && val < 5000) {
            cantidad = val;
            break;
          }
        }
      } catch (e) {}

      records.push({
        ean,
        producto: prodName.trim(),
        movimiento: 'Stock Plex',
        cantidad: cantidad
      });
    }
    return records;
  } catch (err) {
    console.error("Error parseando .tmp de Plex:", err);
    return [];
  }
}

function processFile(filePath, savePath = null) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    let data;
    let filename = savePath ? path.basename(savePath) : path.basename(filePath);

    // 1. Detección de Laboratorio (Contexto)
    const detectLab = (name) => {
      const labs = ['bago', 'roemmers', 'gador', 'casasco', 'bernabo', 'montpellier', 'baliarda', 'elea', 'andromaco', 'ivax', 'raffo', 'sidus', 'bayer'];
      const found = labs.find(l => name.toLowerCase().includes(l));
      return found ? found.toUpperCase() : null;
    };
    const labHint = detectLab(filename);

    // 2. Backup automático para evitar pérdida de datos
    const exportDir = path.join(app.getPath('documents'), 'Farmaplus_Exports');
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
    const backupPath = path.join(exportDir, `${Date.now()}_${filename}`);
    
    try {
      fs.copyFileSync(filePath, backupPath);
    } catch (e) { console.error("No se pudo crear backup:", e); }

    if (ext === '.tmp') {
      console.log(`[Launcher] Parseando archivo binario Plex: ${filePath}`);
      const records = parsePlexTmp(filePath);
      data = [
        ['EAN', 'Producto', 'Movimiento', 'Cantidad'],
        ...records.map(r => [r.ean, r.producto, r.movimiento, r.cantidad])
      ];
    } else {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    }
    
    console.log(`Enviando ${data.length} filas a la PWA. Lab detectado: ${labHint || 'Ninguno'}`);
    if (mainWindow) {
      mainWindow.webContents.send('excel-data', {
        filename: filename,
        rows: data,
        size: fs.statSync(filePath).size,
        labHint: labHint,
        backupPath: backupPath
      });
      
      // Foco agresivo para que el usuario lo vea
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true);
      setTimeout(() => mainWindow.setAlwaysOnTop(false), 1000);
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
    ensureSystemIntegration();
  });
}

function ensureSystemIntegration() {
  if (!app.isPackaged) return;

  const exePath = app.getPath('exe');
  const script = `
    $LauncherPath = "${exePath}"
    
    # 1. Identidad Excel (Spoofing para Plex25)
    $AppPath = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\excel.exe"
    if (-not (Test-Path $AppPath)) { New-Item -Path $AppPath -Force | Out-Null }
    Set-ItemProperty -Path $AppPath -Name "(Default)" -Value $LauncherPath
    Set-ItemProperty -Path $AppPath -Name "Path" -Value (Split-Path $LauncherPath)

    $ProgID = "Excel.Application"
    $CLSID = "{00024500-0000-0000-C000-000000000046}"
    
    # Registrar Clases y CLSID
    foreach ($path in @("HKCU:\\Software\\Classes\\$ProgID", "HKCU:\\Software\\Classes\\CLSID\\$CLSID")) {
        if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
        Set-ItemProperty -Path $path -Name "(Default)" -Value "Farmaplus Excel Bridge"
    }
    
    $LocalServer = "HKCU:\\Software\\Classes\\CLSID\\$CLSID\\LocalServer32"
    if (-not (Test-Path $LocalServer)) { New-Item -Path $LocalServer -Force | Out-Null }
    Set-ItemProperty -Path $LocalServer -Name "(Default)" -Value "\`"$LauncherPath\`""

    # 2. Menú Contextual de Windows (Shell Integration)
    $Extensions = @(".xls", ".xlsx", ".csv", ".tmp")
    foreach ($ext in $Extensions) {
        $ShellPath = "HKCU:\\Software\\Classes\\SystemFileAssociations\\$ext\\shell\\Farmaplus"
        if (-not (Test-Path $ShellPath)) { New-Item -Path $ShellPath -Force | Out-Null }
        Set-ItemProperty -Path $ShellPath -Name "(Default)" -Value "Enviar a Farmaplus"
        Set-ItemProperty -Path $ShellPath -Name "Icon" -Value $LauncherPath
        
        $CommandPath = "$ShellPath\\command"
        if (-not (Test-Path $CommandPath)) { New-Item -Path $CommandPath -Force | Out-Null }
        Set-ItemProperty -Path $CommandPath -Name "(Default)" -Value "\`"$LauncherPath\`" \`"%1\`""
    }

    # 3. Protocolo farmaplus://
    $ProtoPath = "HKCU:\\Software\\Classes\\farmaplus"
    if (-not (Test-Path $ProtoPath)) { New-Item -Path $ProtoPath -Force | Out-Null }
    Set-ItemProperty -Path $ProtoPath -Name "(Default)" -Value "URL:Farmaplus Protocol"
    Set-ItemProperty -Path $ProtoPath -Name "URL Protocol" -Value ""
    
    $ProtoCmd = "$ProtoPath\\shell\\open\\command"
    if (-not (Test-Path $ProtoCmd)) { New-Item -Path $ProtoCmd -Force | Out-Null }
    Set-ItemProperty -Path $ProtoCmd -Name "(Default)" -Value "\`"$LauncherPath\`" \`"%1\`""
  `;
  
  const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
  exec(`powershell.exe -ExecutionPolicy Bypass -EncodedCommand ${encodedScript}`, (err) => {
    if (err) console.error('[Launcher] Error en integración pro:', err);
    else console.log('[Launcher] Integración de sistema completa');
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
    const isSupported = ext === '.xlsx' || ext === '.xls' || ext === '.csv' || ext === '.tmp';
    
    if (isSupported) {
      // Solo disparar handleFileArg si el nombre parece relevante para evitar ruido en el log
      const lowerPath = filePath.toLowerCase();
      const isRelevant = lowerPath.includes('stock') || lowerPath.includes('plex') || lowerPath.includes('inventario') || ext !== '.tmp';
      
      if (isRelevant) {
        setTimeout(() => {
          if (fs.existsSync(filePath)) {
            handleFileArg([filePath]);
          }
        }, 1000); // Aumentado a 1s para mayor estabilidad con archivos en uso
      }
    }
  });
}

function createTray() {
  // En Windows, .ico funciona mejor para el tray. En otros, .png.
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const iconPath = path.join(__dirname, iconName);
  let trayIcon;
  
  if (fs.existsSync(iconPath)) {
    // Si es .ico, nativeImage lo maneja bien. Si es .png muy grande, resize ayuda.
    trayIcon = nativeImage.createFromPath(iconPath);
    if (iconName.endsWith('.png')) {
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
    }
  } else {
    // Fallback: intentar el otro formato si el preferido no existe
    const fallbackPath = path.join(__dirname, process.platform === 'win32' ? 'icon.png' : 'icon.ico');
    if (fs.existsSync(fallbackPath)) {
      trayIcon = nativeImage.createFromPath(fallbackPath).resize({ width: 16, height: 16 });
    } else {
      trayIcon = nativeImage.createEmpty();
    }
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

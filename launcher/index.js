const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false, // Don't show the window until it's ready, prevents white flash
    backgroundColor: '#0a0a0a', // Dark background matching the app theme
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const isDev = !app.isPackaged;
  const pwaUrl = isDev ? 'http://localhost:5173' : 'http://localhost:5173'; // TODO: Cambiar a la URL real de producción
  
  const loadPWA = () => {
    mainWindow.loadURL(pwaUrl).catch(err => {
      console.error('Error al cargar la PWA:', err);
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              background: #0a0a0a; 
              color: #f5f5f5; 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0; 
              text-align: center;
            }
            .container {
              max-width: 400px;
              padding: 2rem;
              border: 1px solid #262626;
              border-radius: 1rem;
              background: #171717;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
            }
            h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #fff; }
            p { color: #a3a3a3; font-size: 0.875rem; line-height: 1.5; margin-bottom: 1.5rem; }
            .error-code { font-family: monospace; background: #262626; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; color: #f87171; }
            button { 
              background: #fff; 
              color: #000; 
              border: none; 
              padding: 0.75rem 1.5rem; 
              border-radius: 0.5rem; 
              font-weight: 600; 
              cursor: pointer; 
              transition: opacity 0.2s;
            }
            button:hover { opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div style="font-size: 3rem; margin-bottom: 1rem;">📡</div>
            <h1>Error de Conexión</h1>
            <p>No se pudo conectar con el servidor de Farmaplus.<br>Verifica tu conexión a internet.</p>
            <div style="margin-bottom: 1.5rem;">
              <span class="error-code">${err.message}</span>
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
  // Buscar un argumento que sea un archivo existente con las extensiones soportadas
  const filePath = argv.find(arg => {
    const isExcel = arg.toLowerCase().endsWith('.xlsx') || 
                  arg.toLowerCase().endsWith('.xls') || 
                  arg.toLowerCase().endsWith('.csv');
    return isExcel && fs.existsSync(arg);
  });

  if (filePath) {
    console.log(`[Launcher] Procesando archivo: ${filePath}`);
    try {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
      
      console.log(`Enviando ${data.length} filas a la PWA`);
      mainWindow.webContents.send('excel-data', {
        filename: path.basename(filePath),
        rows: data,
        size: fs.statSync(filePath).size
      });
    } catch (error) {
      console.error("Error leyendo el archivo:", error);
    }
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

  app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : main.js
// MÓDULO    : Núcleo de Aplicación de Escritorio (Electron Main)
// PROPÓSITO : Orquestación de ciclo de vida de la app, control de ventanas y comunicación IPC.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const { app, BrowserWindow, Tray, Menu, ipcMain, dialog } = require('electron');
const nodePath = require('path');
const http = require('http');


let mainWindow;
let splashWindow;
let tray;
let isQuitting = false;

// Bloqueo de instancia única. Se previene múltiples ejecuciones simultáneas.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // Listener para la segunda instancia: Enfoca la ventana principal si el usuario intenta abrir otra.
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.maximize();
      mainWindow.focus();
    }
  });

  // Carga de variables de entorno. Se obtienen desde el archivo .env.
  require('dotenv').config({ path: nodePath.join(__dirname, '.env') });

  const port = process.env.PORT || 3000;
  
  // ------------------------------------------------------------
  // FUNCIÓN  : checkExistingServer
  // PROPÓSITO: Verificar si el servidor backend ya está en ejecución antes de lanzarlo.
  // PARÁMETROS: Ninguno
  // RETORNA  : Nada
  // ------------------------------------------------------------
  const checkExistingServer = () => {
    const healthUrl = `http://127.0.0.1:${port}/health`;
    const req = http.get(healthUrl, (res) => {
      if (res.statusCode !== 200) require('./server/index.js');
    });

    req.setTimeout(2000, () => {
      req.destroy();
      require('./server/index.js');
    });

    req.on('error', () => {
      require('./server/index.js');
    });
  };

  checkExistingServer();

  // Orquestación de inicio. Se ejecuta al estar listo el entorno Electron (solo para la instancia principal).
  app.whenReady().then(() => {
    createTray();
    createSplash();
    createWindow();
  });
}

// ------------------------------------------------------------
// FUNCIÓN  : createTray
// PROPÓSITO: Crear y configurar el icono en el área de notificación (System Tray).
// PARÁMETROS: Ninguno
// RETORNA  : Nada
// ------------------------------------------------------------
function createTray() {
  try {
    const iconPath = nodePath.join(__dirname, 'build/icon.ico');
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Abrir SDA',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.maximize();
            mainWindow.focus();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Salir completamente',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setToolTip('SDA Sistema de Administración');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.maximize();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.error('[Tray] Error al crear icono:', err.message);
  }
}

// ------------------------------------------------------------
// FUNCIÓN  : createSplash
// PROPÓSITO: Inicializar la ventana de carga (Splash Screen).
// PARÁMETROS: Ninguno
// RETORNA  : Nada
// ------------------------------------------------------------
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 520,
    frame: false,
    resizable: false,
    show: false,
    backgroundColor: '#0a1a0f',
    alwaysOnTop: true,
    center: true,
    skipTaskbar: true,
    icon: nodePath.join(__dirname, 'build/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(nodePath.join(__dirname, 'splash.html'));

  splashWindow.once('ready-to-show', () => {
    if (splashWindow) splashWindow.show();
  });

  // Mecanismo de seguridad. Se muestra el splash si el evento ready-to-show no se dispara.
  setTimeout(() => {
    if (splashWindow && !splashWindow.isVisible()) splashWindow.show();
  }, 1500);
}

// ------------------------------------------------------------
// FUNCIÓN  : checkServerReady
// PROPÓSITO: Realizar peticiones cíclicas al endpoint de salud del servidor hasta que responda.
// PARÁMETROS: Ninguno
// RETORNA  : Promise<Boolean> — True si el servidor está listo, False tras agotar intentos.
// ------------------------------------------------------------
function checkServerReady() {
  return new Promise((resolve) => {
    const port = process.env.PORT || 3000;
    const healthUrl = `http://127.0.0.1:${port}/health`;
    let attempts = 0;
    
    const attempt = () => {
      attempts++;
      // Tras agotar los intentos (15 segundos), se resuelve para permitir mostrar el error en la ventana
      if (attempts > 30) return resolve(false);

      const req = http.get(healthUrl, (res) => {
        if (res.statusCode === 200) resolve(true);
        else setTimeout(attempt, 500);
      });

      req.setTimeout(1500, () => {
        req.destroy();
        setTimeout(attempt, 500);
      });

      req.on('error', () => {
        setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

// ------------------------------------------------------------
// FUNCIÓN  : createWindow
// PROPÓSITO: Configurar e inicializar la ventana principal de la aplicación.
// PARÁMETROS: Ninguno
// RETORNA  : Nada
// ------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    show: false,
    backgroundColor: '#ffffff',
    title: 'SDA Sistema de Administración — IMSS OOAD Sinaloa',
    icon: nodePath.join(__dirname, 'build/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      sandbox: false,
      preload: nodePath.join(__dirname, 'preload.js')
    }
  });

  mainWindow.setMenuBarVisibility(false);

  // Prevención del cierre de la aplicación. Se oculta en el área de notificación (Tray).
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  const minSplashTime = new Promise(resolve => setTimeout(resolve, 3000));

  const isDev = !app.isPackaged;

  Promise.all([checkServerReady(), minSplashTime]).then(() => {
    if (isDev) {
      mainWindow.loadURL('http://localhost:5173');
    } else {
      mainWindow.loadURL(`http://127.0.0.1:${process.env.PORT || 3000}`);
    }

    const showMain = () => {
      if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
      }
      if (mainWindow) {
        mainWindow.show();
        mainWindow.maximize();
        mainWindow.focus();
      }
    };

    mainWindow.once('ready-to-show', showMain);
    // Mecanismo de seguridad: se fuerza el despliegue tras 10 segundos de carga
    setTimeout(showMain, 10000);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}


// ------------------------------------------------------------
// FUNCIÓN : select-save-path (IPC)
// PROPÓSITO: Abrir el diálogo para elegir la ubicación del respaldo.
// PARÁMETROS:
//   - defaultName (String): Nombre sugerido para el archivo.
// RETORNA : String — Ruta seleccionada o undefined.
// ------------------------------------------------------------
ipcMain.handle('select-save-path', async (event, defaultName) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Seleccionar ubicación del respaldo',
    defaultPath: defaultName || 'SDA_Respaldo.dump',
    filters: [{ name: 'Postgres Dump', extensions: ['dump'] }]
  });
  return filePath;
});

// ------------------------------------------------------------
// FUNCIÓN : select-open-path (IPC)
// PROPÓSITO: Abrir el diálogo para seleccionar un archivo .dump existente.
// PARÁMETROS: Ninguno.
// RETORNA : String — Ruta del archivo seleccionado.
// ------------------------------------------------------------
ipcMain.handle('select-open-path', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar archivo de respaldo para restaurar',
    filters: [{ name: 'Postgres Dump', extensions: ['dump'] }],
    properties: ['openFile']
  });
  return filePaths[0];
});

// ------------------------------------------------------------
// FUNCIÓN : relaunch-app (IPC)
// PROPÓSITO: Forzar el reinicio de la aplicación tras procesos de restauración.
// PARÁMETROS: Ninguno.
// RETORNA : Nada.
// ------------------------------------------------------------
ipcMain.on('relaunch-app', () => {
  app.relaunch();
  app.exit();
});



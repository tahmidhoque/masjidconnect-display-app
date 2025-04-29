const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const url = require('url');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
log.info('App starting...');

// Performance optimization flags - optimized for Raspberry Pi
log.info('Setting up performance optimizations for Raspberry Pi');

// Enable hardware acceleration with controlled settings to prevent thermal throttling
app.commandLine.appendSwitch('enable-features', 'HardwareAcceleration');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

// Limit resource usage to prevent overheating
app.commandLine.appendSwitch('num-raster-threads', '2');  // Limit threads on RPi
app.commandLine.appendSwitch('renderer-process-limit', '1');  // Limit processes
app.commandLine.appendSwitch('max-active-webgl-contexts', '4');

// Use appropriate GL implementation for Raspberry Pi
app.commandLine.appendSwitch('use-gl', 'desktop');  // Better for RPi
app.commandLine.appendSwitch('ignore-gpu-blocklist');

// Explicitly enable hardware acceleration
app.disableHardwareAcceleration = false;

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

// Update check interval (1 hour)
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

// Configure auto updater options
autoUpdater.autoDownload = true;         // Download updates automatically
autoUpdater.allowDowngrade = false;      // Prevent downgrading to older versions
autoUpdater.allowPrerelease = false;     // Ignore pre-release versions
autoUpdater.autoInstallOnAppQuit = true; // Install when app quits

function createWindow() {
  log.info('Creating browser window...');
  
  // In development mode, explicitly use the dev server URL
  const isDev = process.env.ELECTRON_DEBUG === 'true';
  const startUrl = isDev 
    ? 'http://localhost:3001'
    : url.format({
        pathname: path.join(__dirname, '../build/index.html'),
        protocol: 'file:',
        slashes: true
      });
  
  log.info(`Running in ${isDev ? 'development' : 'production'} mode`);
  log.info(`Will load: ${startUrl}`);

  // Set up CSP for development
  if (isDev) {
    log.info('Setting up CSP for development environment');
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' http://localhost:* ws://localhost:*; " +
            "script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:*; " +
            "style-src 'self' 'unsafe-inline'; " +
            "font-src 'self'; " +
            "connect-src 'self' ws://localhost:* http://localhost:* https://localhost:* http://localhost:3000 https://localhost:3000 https://*.masjidconnect.com https://api.aladhan.com; " +
            "img-src 'self' data: https://*.masjidconnect.com;"
          ]
        }
      });
    });
  }
  
  // Allow specific external API requests in both dev and production
  log.info('Setting up permissions for external API requests');
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    
    // Allow Hijri date API requests
    if (url.includes('api.aladhan.com')) {
      log.info(`Allowing external API request to: ${url}`);
      callback({ cancel: false });
    } else {
      callback({ cancel: false });
    }
  });
  
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Add devTools support in development
      devTools: isDev,
      // Allow mixed content (http/https)
      webSecurity: !isDev
    },
    // By default, start fullscreen for display purposes
    fullscreen: !isDev,
    // Kiosk mode for Raspberry Pi deployments (uncomment for production)
    kiosk: !isDev,
    // Hide menu bar in production
    autoHideMenuBar: !isDev,
    // Ensure app doesn't show in taskbar in production
    skipTaskbar: !isDev,
    // Custom app icon
    icon: path.join(__dirname, '../assets/icon.png'),
    // Basic performance settings
    backgroundColor: '#000000',
    show: false // Don't show window until it's ready
  });

  // and load the index.html of the app
  log.info(`Loading URL: ${startUrl}`);
  mainWindow.loadURL(startUrl);

  // Open DevTools if in debug mode
  if (isDev) {
    log.info('Opening DevTools (debug mode)');
    mainWindow.webContents.openDevTools();
  }

  // Only show the window when it's fully loaded to avoid flicker
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Emitted when the window is closed
  mainWindow.on('closed', function () {
    log.info('Main window closed');
    // Dereference the window object
    mainWindow = null;
  });

  // Check for updates only in production mode
  if (!isDev) {
    sendStatusToWindow('Checking for updates...');
    checkForUpdates();
  } else {
    log.info('Skipping update check in development mode');
  }
}

// Regular update checks
function setupUpdateChecks() {
  // Skip update checks in development mode
  if (process.env.ELECTRON_DEBUG === 'true') {
    log.info('Skipping update checks setup in development mode');
    return;
  }
  
  log.info(`Setting up automatic update checks every ${UPDATE_CHECK_INTERVAL/1000/60} minutes`);
  
  // Initial check on startup
  checkForUpdates();
  
  // Schedule regular checks
  setInterval(() => {
    log.info('Running scheduled update check');
    checkForUpdates();
  }, UPDATE_CHECK_INTERVAL);
}

// Check for updates
function checkForUpdates() {
  try {
    log.info('Checking for updates...');
    autoUpdater.checkForUpdatesAndNotify();
  } catch (error) {
    log.error('Error checking for updates:', error);
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  log.info('App ready, creating window');
  createWindow();
  
  // Setup scheduled update checks
  setupUpdateChecks();
  
  app.on('activate', function () {
    // On macOS it's common to re-create a window when the dock icon is clicked
    if (mainWindow === null) {
      log.info('Re-creating window (macOS activate)');
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  log.info('All windows closed');
  if (process.platform !== 'darwin') {
    log.info('Quitting app (non-macOS)');
    app.quit();
  }
});

// Auto updater events
function sendStatusToWindow(text) {
  log.info(text);
  if (mainWindow) {
    mainWindow.webContents.send('update-message', text);
  }
}

autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  const message = `Update available: v${info.version}`;
  log.info(message, info);
  sendStatusToWindow(message);
});

autoUpdater.on('update-not-available', (info) => {
  log.info('No update available', info);
  sendStatusToWindow('No update available.');
});

autoUpdater.on('error', (err) => {
  const message = `Error in auto-updater: ${err.message}`;
  log.error(message, err);
  sendStatusToWindow(message);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = `Download speed: ${progressObj.bytesPerSecond}`;
  log_message = `${log_message} - Downloaded ${progressObj.percent.toFixed(2)}%`;
  log_message = `${log_message} (${progressObj.transferred}/${progressObj.total})`;
  log.info(log_message);
  sendStatusToWindow(log_message);
});

autoUpdater.on('update-downloaded', (info) => {
  const message = `Update v${info.version} downloaded. Will install on restart.`;
  log.info(message, info);
  sendStatusToWindow(message);
});

// IPC handlers for communicating with the renderer process
ipcMain.handle('check-for-updates', async () => {
  log.info('Manual update check requested');
  checkForUpdates();
  return 'Checking for updates...';
});

ipcMain.handle('restart-app', async () => {
  log.info('App restart requested to install update');
  autoUpdater.quitAndInstall();
}); 

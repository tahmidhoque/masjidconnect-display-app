const { app, BrowserWindow, ipcMain, session, Menu, protocol } = require('electron');
const path = require('path');
const url = require('url');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const fs = require('fs');

// Configure logging
log.transports.file.level = 'info';
log.info('App starting...');

// Performance optimization flags - optimized for Raspberry Pi
log.info('Setting up performance optimizations for Raspberry Pi');

// Enable hardware acceleration optimizations for Raspberry Pi
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');

// Force software rendering for consistent performance
app.commandLine.appendSwitch('use-gl', 'swiftshader');
app.commandLine.appendSwitch('disable-direct-composition');

// Disable other features that might depend on GPU
app.commandLine.appendSwitch('disable-smooth-scrolling');
app.commandLine.appendSwitch('disable-reading-from-canvas');
app.commandLine.appendSwitch('disable-accelerated-video-decode');
app.commandLine.appendSwitch('disable-accelerated-video-encode');
app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-webgl');

// Memory optimization for Raspberry Pi
app.commandLine.appendSwitch('num-raster-threads', '1');
app.commandLine.appendSwitch('renderer-process-limit', '1');
app.commandLine.appendSwitch('max-old-space-size', '512');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

// Update check interval (1 hour)
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

// Configure auto updater options
autoUpdater.autoDownload = false;      // Disable auto download for now
autoUpdater.allowDowngrade = false;    // Prevent downgrading to older versions
autoUpdater.allowPrerelease = false;   // Ignore pre-release versions
autoUpdater.autoInstallOnAppQuit = false; // Don't auto install on quit

// Find the best path for a resource
function findResourcePath(resourcePath) {
  const possibleBasePaths = [
    path.join(app.getAppPath(), 'build'),
    path.join(app.getAppPath(), 'resources', 'build'),
    path.join(path.dirname(app.getPath('exe')), 'resources', 'build'),
    path.join(path.dirname(app.getPath('exe')), 'build'),
    path.join(app.getAppPath())
  ];

  for (const basePath of possibleBasePaths) {
    const fullPath = path.join(basePath, resourcePath);
    if (fs.existsSync(fullPath)) {
      log.info(`Found resource at: ${fullPath}`);
      return fullPath;
    }
  }

  // Fallback to electron directory
  const electronPath = path.join(app.getAppPath(), 'electron', resourcePath);
  if (fs.existsSync(electronPath)) {
    log.info(`Found resource in electron dir: ${electronPath}`);
    return electronPath;
  }

  log.warn(`Resource not found: ${resourcePath}`);
  return null;
}

// Register protocol handler before app is ready
app.whenReady().then(() => {
  // Register protocol handler with better path resolution
  protocol.registerFileProtocol('app', (request, callback) => {
    const url = request.url.substr(6); // Remove 'app://'
    
    const resolvedPath = findResourcePath(url);
    if (resolvedPath) {
      callback({ path: resolvedPath });
    } else {
      // If no path exists, log error
      log.error(`Protocol handler failed to resolve: ${url}`);
      callback({ error: -2 /* net::FAILED */ });
    }
  });
  
  log.info('App ready, creating window');
  
  // Disable the application menu
  Menu.setApplicationMenu(null);
  
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

function createWindow() {
  log.info('Creating browser window...');
  
  // In development mode, explicitly use the dev server URL
  const isDev = process.env.ELECTRON_DEBUG === 'true';
  
  // Get the app directory and ensure we can find our files
  const appDirectory = app.getAppPath();
  log.info(`App directory: ${appDirectory}`);
  
  // Log the contents of some key directories for debugging
  const possibleBuildDirs = [
    path.join(appDirectory, 'build'),
    path.join(appDirectory, 'dist/build'),
    path.join(path.dirname(app.getPath('exe')), 'build'),
    path.join(path.dirname(app.getPath('exe')), 'resources', 'build'),
    path.join(appDirectory, 'resources', 'build')
  ];
  
  for (const dir of possibleBuildDirs) {
    if (fs.existsSync(dir)) {
      log.info(`Found build directory: ${dir}`);
      try {
        const files = fs.readdirSync(dir);
        log.info(`Files in ${dir}: ${files.join(', ')}`);
        
        // Also log static directory contents if it exists
        const staticDir = path.join(dir, 'static');
        if (fs.existsSync(staticDir)) {
          const staticFiles = fs.readdirSync(staticDir);
          log.info(`Static directory found with: ${staticFiles.join(', ')}`);
          
          // Log JS and CSS directories
          const jsDir = path.join(staticDir, 'js');
          const cssDir = path.join(staticDir, 'css');
          
          if (fs.existsSync(jsDir)) {
            const jsFiles = fs.readdirSync(jsDir);
            log.info(`JS files: ${jsFiles.join(', ')}`);
          }
          
          if (fs.existsSync(cssDir)) {
            const cssFiles = fs.readdirSync(cssDir);
            log.info(`CSS files: ${cssFiles.join(', ')}`);
          }
        } else {
          log.warn(`No static directory found in ${dir}`);
        }
      } catch (err) {
        log.error(`Error reading directory ${dir}: ${err.message}`);
      }
    }
  }
  
  // Use a direct file path approach without protocol
  let indexPath = null;
  let indexContent = null;
  
  // First, check the standard build directory
  const standardBuildPath = path.join(appDirectory, 'build/index.html');
  if (fs.existsSync(standardBuildPath)) {
    indexPath = `file://${standardBuildPath}`;
    log.info(`Using standard build path: ${standardBuildPath}`);
    
    try {
      indexContent = fs.readFileSync(standardBuildPath, 'utf8');
      log.info(`Index.html content length: ${indexContent.length} bytes`);
    } catch (err) {
      log.error(`Error reading index.html: ${err.message}`);
    }
  } else {
    // Try finding the index.html in various locations
    const possibleIndexPaths = [
      path.join(appDirectory, 'build/index.html'),
      path.join(appDirectory, 'build/main.html'),
      path.join(appDirectory, 'electron/index.html'),
      path.join(appDirectory, 'index.html'),
      path.join(path.dirname(app.getPath('exe')), 'resources/app/build/index.html'),
      path.join(path.dirname(app.getPath('exe')), 'resources/app/build/main.html'),
      path.join(path.dirname(app.getPath('exe')), 'resources/app/electron/index.html')
    ];
    
    for (const idxPath of possibleIndexPaths) {
      if (fs.existsSync(idxPath)) {
        indexPath = `file://${idxPath}`;
        log.info(`Found index.html at: ${idxPath}`);
        
        try {
          indexContent = fs.readFileSync(idxPath, 'utf8');
          log.info(`Index.html content length: ${indexContent.length} bytes`);
        } catch (err) {
          log.error(`Error reading index.html: ${err.message}`);
        }
        
        break;
      }
    }
    
    // If still not found, use a fallback
    if (!indexPath) {
      indexPath = `file://${path.join(appDirectory, 'electron/index.html')}`;
      log.warn(`No index.html found, using fallback: ${indexPath}`);
    }
  }
  
  // For development, use the localhost URL
  if (isDev) {
    indexPath = 'http://localhost:3001';
    log.info(`Using development server: ${indexPath}`);
  }

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Add devTools support in development
      devTools: true, // Temporarily enable devTools in all modes for debugging
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

  // Register custom protocols for assets if needed
  if (!protocol.isProtocolRegistered('static')) {
    protocol.registerFileProtocol('static', (request, callback) => {
      const url = request.url.substr(9); // Remove 'static://'
      const resolvedPath = findResourcePath(`static/${url}`);
      
      if (resolvedPath) {
        callback({ path: resolvedPath });
      } else {
        // Try electron/static as fallback
        const electronStaticPath = path.join(app.getAppPath(), 'electron/static', url);
        if (fs.existsSync(electronStaticPath)) {
          callback({ path: electronStaticPath });
        } else {
          callback({ error: -2 /* net::FAILED */ });
        }
      }
    });
  }
  
  // Set up content security policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' file: data: static:; script-src 'self' 'unsafe-inline' file: static:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com file: static:; font-src 'self' https://fonts.gstatic.com static:; connect-src 'self' http://localhost:3000 https://localhost:3000 https://*.masjidconnect.co.uk; img-src 'self' data: https://*.masjidconnect.co.uk file: static:;"]
      }
    });
  });

  // Load the app
  log.info(`Loading URL: ${indexPath}`);
  
  try {
    // Open DevTools immediately for troubleshooting
    if (!isDev) {
      mainWindow.webContents.openDevTools();
      log.info("Developer tools opened for debugging");
    }
    
    // Show window when ready
    mainWindow.webContents.on('did-finish-load', () => {
      log.info('Window finished loading');
      mainWindow.show();
    });
    
    // Log any console messages from the renderer
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      const levels = ['debug', 'info', 'warning', 'error'];
      log.info(`[${levels[level] || 'info'}] ${message} (${sourceId}:${line})`);
    });
    
    // Check if we need to fix the index.html content for static paths
    if (indexContent && !isDev) {
      // Check if paths need fixing
      if (indexContent.includes('src="/static/') || indexContent.includes('href="/static/')) {
        log.info('Fixing static asset paths in index.html content');
        
        // Fix static asset paths to be relative
        const fixedContent = indexContent
          .replace(/src="\/static\//g, 'src="./static/')
          .replace(/href="\/static\//g, 'href="./static/');
          
        // Add base tag if not present
        const hasBaseTag = fixedContent.includes('<base href="./"/>') || 
                          fixedContent.includes('<base href="./">');
                          
        let finalContent = fixedContent;
        if (!hasBaseTag) {
          finalContent = fixedContent.replace('</head>', '<base href="./" /></head>');
        }
        
        // Load the fixed content directly
        log.info('Loading index.html with fixed paths');
        mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(finalContent)}`);
      } else {
        // Use normal loading if paths look correct
        mainWindow.loadURL(indexPath);
      }
    } else {
      // Normal loading if no content or in dev mode
      mainWindow.loadURL(indexPath);
    }
  } catch (err) {
    log.error(`Failed to load application: ${err.message}`);
    displayErrorInWindow(mainWindow, `Failed to load application: ${err.message}`);
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
    // Only check for updates when running in actual production environment
    if (process.env.NODE_ENV === 'production' && !process.env.DISABLE_UPDATES) {
      log.info('Checking for updates...');
      autoUpdater.checkForUpdatesAndNotify();
    } else {
      log.info('Update checks disabled in development or testing environment');
    }
  } catch (error) {
    log.error('Error checking for updates:', error);
  }
}

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

// Function to display errors directly in the window
function displayErrorInWindow(window, errorMessage) {
  if (!window) return;
  
  const errorHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>MasjidConnect Display - Error</title>
        <style>
          body {
            font-family: sans-serif;
            background-color: black;
            color: white;
            text-align: center;
            padding: 20px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          h1 { color: #f1c40f; }
          .error { color: #e74c3c; margin: 20px 0; }
          .info { margin-top: 30px; font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>MasjidConnect Display</h1>
        <div class="error">${errorMessage}</div>
        <div class="info">Please check the application logs or reinstall the application.</div>
      </body>
    </html>
  `;
  
  window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHTML)}`).catch(err => {
    log.error(`Failed to display error page: ${err.message}`);
  });
} 

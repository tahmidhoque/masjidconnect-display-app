const { app, BrowserWindow, ipcMain, session, Menu, protocol } = require('electron');
const path = require('path');
const url = require('url');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const fs = require('fs');
const { exec } = require('child_process');

// Configure logging
// Reduce log verbosity in production to minimize disk writes
log.transports.file.level = process.env.ELECTRON_DEBUG === 'true' ? 'info' : 'warn';
log.info('App starting...');

// Performance optimization flags - optimized for Raspberry Pi
log.info('Setting up performance optimizations for Raspberry Pi');

// Enable selective hardware acceleration for better performance
// Only disable specific GPU features that cause issues on RPi
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-gpu-sandbox');

// Enable basic hardware acceleration for UI rendering
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

// Memory and performance optimizations
app.commandLine.appendSwitch('num-raster-threads', '2');
app.commandLine.appendSwitch('renderer-process-limit', '1');
app.commandLine.appendSwitch('max_old_space_size', '256');

// Disable features that aren't needed for display app
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

// Production stability improvements - prevent network service crashes
if (process.env.NODE_ENV === 'production') {
  log.info('Applying production stability optimizations');

  // Disable debugging features that can cause instability
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-web-security');
  app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');

  // Network service stability
  app.commandLine.appendSwitch('disable-extensions');
  app.commandLine.appendSwitch('disable-plugins');
  app.commandLine.appendSwitch('disable-default-apps');

  // Prevent inspector/debugger from starting
  app.commandLine.appendSwitch('disable-dev-tools');

  // Reduce logging to prevent disk I/O issues
  log.transports.file.level = 'error';
  log.transports.console.level = 'error';
}

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

// Update check interval (1 hour)
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

// Track update state
let updateState = {
  status: 'idle', // idle, checking, available, downloading, downloaded, error, not-available
  version: null,
  progress: 0,
  error: null
};

// Configure auto updater options
autoUpdater.autoDownload = true; // Enable auto download
autoUpdater.allowDowngrade = false; // Prevent downgrading to older versions
autoUpdater.allowPrerelease = false; // Ignore pre-release versions
autoUpdater.autoInstallOnAppQuit = false; // Keep manual control - don't auto install on quit

// Configure update channel (stable by default, can be overridden via environment variable)
// For GitHub releases, electron-updater automatically detects releases from package.json config
// Update channel can be: 'latest' (stable), 'beta', or 'alpha'
const updateChannel = process.env.UPDATE_CHANNEL || 'latest';
log.info(`Update channel configured: ${updateChannel}`);

// Note: electron-updater with GitHub provider automatically uses the repository
// configured in package.json build.publish section. No explicit setFeedURL needed
// for GitHub releases - it will use: https://github.com/masjidSolutions/masjidconnect-display-app/releases

// Find the best path for a resource
function findResourcePath(resourcePath) {
  const possibleBasePaths = [
    path.join(app.getAppPath(), 'build'),
    path.join(app.getAppPath(), 'resources', 'build'),
    path.join(path.dirname(app.getPath('exe')), 'resources', 'build'),
    path.join(path.dirname(app.getPath('exe')), 'build'),
    path.join(app.getAppPath()),
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
      path.join(path.dirname(app.getPath('exe')), 'resources/app/electron/index.html'),
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

  // Create the browser window with optimized settings
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Enable DevTools only during development to reduce overhead in production
      devTools: isDev,
      // Allow mixed content (http/https)
      webSecurity: !isDev,
      // Enable hardware acceleration
      hardwareAcceleration: true,
      // Optimize for performance
      backgroundThrottling: false,
      // Disable node in renderer for security
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      // Enable experimental features for better performance
      experimentalFeatures: true,
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
    // Optimize startup performance
    backgroundColor: '#0A2647', // Match the loading screen background
    show: false, // Don't show window until it's ready
    // Improve rendering performance
    paintWhenInitiallyHidden: false,
    // Disable transparency for better performance
    transparent: false,
    // Enable double buffering
    enableLargerThanScreen: false,
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
    // Allow localhost:3000 in development for fonts, images, and styles
    // Include WebSocket support (ws: and wss: protocols) for realtime connections
    // Allow fly.io domains and all HTTPS connections for WebSocket server deployment
    // More permissive CSP for production to allow any HTTPS WebSocket connection
    const cspDirectives = isDev
      ? "default-src 'self' 'unsafe-inline' file: data: static: http://localhost:3000; script-src 'self' 'unsafe-inline' file: static: http://localhost:3000; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com file: static: http://localhost:3000; font-src 'self' https://fonts.gstatic.com static: http://localhost:3000; connect-src 'self' http://localhost:3000 https://localhost:3000 ws://localhost:* wss://localhost:* ws://*:* wss://*:* ws: wss: https: http: http://*.fly.dev https://*.fly.dev https://masjidconnect-realtime.fly.dev wss://masjidconnect-realtime.fly.dev http://realtime.masjidconnect.co.uk https://realtime.masjidconnect.co.uk http://*.masjidconnect.co.uk https://*.masjidconnect.co.uk https://1.1.1.1 https://httpbin.org; img-src 'self' data: blob: https://*.masjidconnect.co.uk file: static: http://localhost:3000;"
      : "default-src 'self' 'unsafe-inline' file: data: static:; script-src 'self' 'unsafe-inline' file: static:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com file: static:; font-src 'self' https://fonts.gstatic.com static:; connect-src 'self' ws://*:* wss://*:* ws: wss: https: http: http://*.fly.dev https://*.fly.dev https://masjidconnect-realtime.fly.dev wss://masjidconnect-realtime.fly.dev http://realtime.masjidconnect.co.uk https://realtime.masjidconnect.co.uk http://*.masjidconnect.co.uk https://*.masjidconnect.co.uk https://1.1.1.1 https://httpbin.org; img-src 'self' data: blob: https://*.masjidconnect.co.uk file: static:;";
    
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspDirectives],
      },
    });
  });

  // Optimize window showing for faster startup
  mainWindow.once('ready-to-show', () => {
    log.info('Window ready to show');
    mainWindow.show();

    // Focus the window to ensure it's active
    if (!isDev) {
      mainWindow.focus();
    }
  });

  // Handle loading events
  mainWindow.webContents.on('did-start-loading', () => {
    log.info('Window started loading');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    log.info('Window finished loading');

    // Inject performance optimizations into the page
    mainWindow.webContents
      .executeJavaScript(
        `
      // Ensure the page is optimized for display app
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      // Disable context menu globally
      document.addEventListener('contextmenu', (e) => e.preventDefault());
      
      // Disable text selection
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
      
      // Add hardware acceleration hints
      document.body.style.transform = 'translateZ(0)';
      document.body.style.backfaceVisibility = 'hidden';
      
      console.log('Electron optimizations applied');
    `
      )
      .catch((err) => {
        log.error('Failed to inject optimizations:', err);
      });
  });

  // Load the app
  log.info(`Loading URL: ${indexPath}`);

  try {
    // Open DevTools only when running in development mode
    if (isDev) {
      mainWindow.webContents.openDevTools();
      log.info('Developer tools opened for debugging');
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
        const hasBaseTag = fixedContent.includes('<base href="./"/>') || fixedContent.includes('<base href="./">');

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

  log.info(`Setting up automatic update checks every ${UPDATE_CHECK_INTERVAL / 1000 / 60} minutes`);

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

// Helper function to send update state to renderer
function sendUpdateStateToRenderer() {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-state-changed', updateState);
  }
}

// Auto updater events
function sendStatusToWindow(text) {
  log.info(text);
  if (mainWindow) {
    mainWindow.webContents.send('update-message', text);
  }
}

autoUpdater.on('checking-for-update', () => {
  updateState = { status: 'checking', version: null, progress: 0, error: null };
  sendStatusToWindow('Checking for update...');
  sendUpdateStateToRenderer();
});

autoUpdater.on('update-available', (info) => {
  updateState = { status: 'available', version: info.version, progress: 0, error: null };
  const message = `Update available: v${info.version}`;
  log.info(message, info);
  sendStatusToWindow(message);
  sendUpdateStateToRenderer();

  // Send structured event to renderer
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-available', { 
      version: info.version,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate
    });
  }
  
  // Automatically start download
  autoUpdater.downloadUpdate();
});

autoUpdater.on('update-not-available', (info) => {
  updateState = { status: 'not-available', version: null, progress: 0, error: null };
  log.info('No update available', info);
  sendStatusToWindow('No update available.');
  sendUpdateStateToRenderer();
});

autoUpdater.on('error', (err) => {
  updateState = { status: 'error', version: null, progress: 0, error: err.message };
  const message = `Error in auto-updater: ${err.message}`;
  log.error(message, err);
  sendStatusToWindow(message);
  sendUpdateStateToRenderer();

  // Send error event to renderer
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-error', { 
      message: err.message, 
      stack: err.stack 
    });
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  updateState = { 
    status: 'downloading', 
    version: updateState.version,
    progress: progressObj.percent,
    error: null 
  };
  
  let log_message = `Download speed: ${progressObj.bytesPerSecond}`;
  log_message = `${log_message} - Downloaded ${progressObj.percent.toFixed(2)}%`;
  log_message = `${log_message} (${progressObj.transferred}/${progressObj.total})`;
  log.info(log_message);
  sendStatusToWindow(log_message);
  sendUpdateStateToRenderer();

  // Send progress event to renderer
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('download-progress', {
      bytesPerSecond: progressObj.bytesPerSecond,
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  updateState = { 
    status: 'downloaded', 
    version: info.version,
    progress: 100,
    error: null 
  };
  
  const message = `Update v${info.version} downloaded. Will install on restart.`;
  log.info(message, info);
  sendStatusToWindow(message);
  sendUpdateStateToRenderer();

  // Send downloaded event to renderer
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-downloaded', { 
      version: info.version,
      releaseNotes: info.releaseNotes
    });
  }
});

// IPC handlers for communicating with the renderer process

// Update check handler
ipcMain.handle('check-for-updates', async () => {
  log.info('Manual update check requested');
  try {
    checkForUpdates();
    return { success: true, message: 'Checking for updates...' };
  } catch (error) {
    log.error('Error in manual update check:', error);
    return { success: false, error: error.message };
  }
});

// Download update handler
ipcMain.handle('download-update', async () => {
  log.info('Manual update download requested');
  try {
    await autoUpdater.downloadUpdate();
    return { success: true, message: 'Downloading update...' };
  } catch (error) {
    log.error('Error downloading update:', error);
    return { success: false, error: error.message };
  }
});

// Install update and restart handler
ipcMain.handle('install-update', async () => {
  log.info('App restart requested to install update');
  try {
    autoUpdater.quitAndInstall(false, true);
    return { success: true, message: 'Installing update...' };
  } catch (error) {
    log.error('Error installing update:', error);
    return { success: false, error: error.message };
  }
});

// Get app version handler
ipcMain.handle('get-app-version', async () => {
  return app.getVersion();
});

// IPC handler to get current update state
ipcMain.handle('get-update-state', async () => {
  return updateState;
});

// Restart app handler (without installing update)
ipcMain.handle('restart-app', async () => {
  log.info('App restart requested');
  try {
    // Check if update is downloaded
    if (updateState.status === 'downloaded') {
      log.info('Installing update and restarting');
      autoUpdater.quitAndInstall(false, true);
    } else {
      // Normal restart
      app.relaunch();
      app.exit(0);
    }
    return { success: true, message: 'Restarting app...' };
  } catch (error) {
    log.error('Error restarting app:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// WiFi Configuration IPC Handlers (for Raspberry Pi with NetworkManager)
// ============================================================================

/**
 * Execute a shell command and return a promise
 * @param {string} command - The command to execute
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * Parse nmcli wifi list output into structured data
 * @param {string} output - Raw nmcli output
 * @returns {Array} - Array of network objects
 */
function parseWifiList(output) {
  const networks = [];
  const lines = output.trim().split('\n');
  
  // Skip header line if present
  const startIndex = lines[0] && lines[0].includes('IN-USE') ? 1 : 0;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Parse the line - format: IN-USE:BSSID:SSID:MODE:CHAN:RATE:SIGNAL:BARS:SECURITY
    // Using -t flag gives us colon-separated values
    const parts = line.split(':');
    
    if (parts.length >= 8) {
      const inUse = parts[0] === '*';
      const ssid = parts[2];
      const signal = parseInt(parts[6], 10) || 0;
      const security = parts[8] || 'Open';
      
      // Skip hidden networks (empty SSID)
      if (!ssid || ssid === '--') continue;
      
      // Check if network already in list (avoid duplicates from multiple access points)
      const existingIndex = networks.findIndex(n => n.ssid === ssid);
      if (existingIndex >= 0) {
        // Keep the one with stronger signal
        if (signal > networks[existingIndex].signal) {
          networks[existingIndex] = { ssid, signal, security, inUse };
        }
      } else {
        networks.push({ ssid, signal, security, inUse });
      }
    }
  }
  
  // Sort by signal strength (descending)
  networks.sort((a, b) => b.signal - a.signal);
  
  return networks;
}

/**
 * Check if NetworkManager is available on this system
 * @returns {Promise<boolean>}
 */
async function isNetworkManagerAvailable() {
  try {
    await execCommand('which nmcli');
    return true;
  } catch {
    return false;
  }
}

// WiFi scan handler - List available WiFi networks
ipcMain.handle('wifi-scan', async () => {
  log.info('[WiFi] Scanning for available networks...');
  
  try {
    // Check if NetworkManager is available
    const nmAvailable = await isNetworkManagerAvailable();
    if (!nmAvailable) {
      log.warn('[WiFi] NetworkManager (nmcli) not available on this system');
      return { 
        success: false, 
        error: 'WiFi configuration is only available on Raspberry Pi with NetworkManager',
        networks: [] 
      };
    }
    
    // Scan for networks with rescan
    const { stdout } = await execCommand('nmcli -t -f IN-USE,BSSID,SSID,MODE,CHAN,RATE,SIGNAL,BARS,SECURITY device wifi list --rescan yes');
    
    const networks = parseWifiList(stdout);
    log.info(`[WiFi] Found ${networks.length} networks`);
    
    return { success: true, networks };
  } catch (error) {
    log.error('[WiFi] Scan failed:', error);
    return { 
      success: false, 
      error: error.error?.message || 'Failed to scan for WiFi networks',
      networks: [] 
    };
  }
});

// WiFi connect handler - Connect to a WiFi network
ipcMain.handle('wifi-connect', async (event, { ssid, password }) => {
  log.info(`[WiFi] Attempting to connect to: ${ssid}`);
  
  if (!ssid) {
    return { success: false, error: 'SSID is required' };
  }
  
  try {
    // Check if NetworkManager is available
    const nmAvailable = await isNetworkManagerAvailable();
    if (!nmAvailable) {
      return { 
        success: false, 
        error: 'WiFi configuration is only available on Raspberry Pi with NetworkManager'
      };
    }
    
    // Build the connect command
    // Escape special characters in SSID and password
    const escapedSsid = ssid.replace(/'/g, "'\\''");
    const escapedPassword = password ? password.replace(/'/g, "'\\''") : '';
    
    let command;
    if (password) {
      command = `nmcli device wifi connect '${escapedSsid}' password '${escapedPassword}'`;
    } else {
      command = `nmcli device wifi connect '${escapedSsid}'`;
    }
    
    await execCommand(command);
    
    log.info(`[WiFi] Successfully connected to: ${ssid}`);
    return { success: true, message: `Connected to ${ssid}` };
  } catch (error) {
    log.error(`[WiFi] Connection failed for ${ssid}:`, error);
    
    // Parse common error messages for user-friendly feedback
    const stderr = error.stderr || '';
    let userMessage = 'Failed to connect to network';
    
    if (stderr.includes('Secrets were required') || stderr.includes('password')) {
      userMessage = 'Incorrect password. Please try again.';
    } else if (stderr.includes('No network with SSID')) {
      userMessage = 'Network not found. Please scan again.';
    } else if (stderr.includes('Connection activation failed')) {
      userMessage = 'Connection failed. Please check the password and try again.';
    }
    
    return { success: false, error: userMessage };
  }
});

// WiFi status handler - Get current connection status
ipcMain.handle('wifi-status', async () => {
  log.info('[WiFi] Checking connection status...');
  
  try {
    // Check if NetworkManager is available
    const nmAvailable = await isNetworkManagerAvailable();
    if (!nmAvailable) {
      return { 
        success: true,
        status: {
          state: 'unknown',
          connectivity: 'unknown',
          wifi: 'unavailable',
          wifiHw: 'unavailable'
        }
      };
    }
    
    // Get general NetworkManager status
    const { stdout } = await execCommand('nmcli -t general status');
    const parts = stdout.trim().split(':');
    
    const status = {
      state: parts[0] || 'unknown',        // connected, disconnected, connecting, etc.
      connectivity: parts[1] || 'unknown', // full, limited, none, portal
      wifi: parts[2] || 'unknown',         // enabled, disabled
      wifiHw: parts[3] || 'unknown'        // enabled, disabled (hardware switch)
    };
    
    log.info('[WiFi] Status:', status);
    return { success: true, status };
  } catch (error) {
    log.error('[WiFi] Status check failed:', error);
    return { 
      success: false, 
      error: error.error?.message || 'Failed to get WiFi status',
      status: null 
    };
  }
});

// WiFi current network handler - Get currently connected network info
ipcMain.handle('wifi-current', async () => {
  log.info('[WiFi] Getting current network info...');
  
  try {
    // Check if NetworkManager is available
    const nmAvailable = await isNetworkManagerAvailable();
    if (!nmAvailable) {
      return { success: true, network: null };
    }
    
    // Get active WiFi connection
    const { stdout } = await execCommand('nmcli -t -f ACTIVE,SSID,SIGNAL,SECURITY dev wifi');
    const lines = stdout.trim().split('\n');
    
    for (const line of lines) {
      const parts = line.split(':');
      if (parts[0] === 'yes' && parts[1]) {
        const network = {
          ssid: parts[1],
          signal: parseInt(parts[2], 10) || 0,
          security: parts[3] || 'Open',
          connected: true
        };
        
        log.info('[WiFi] Currently connected to:', network.ssid);
        return { success: true, network };
      }
    }
    
    log.info('[WiFi] Not connected to any network');
    return { success: true, network: null };
  } catch (error) {
    log.error('[WiFi] Failed to get current network:', error);
    return { 
      success: false, 
      error: error.error?.message || 'Failed to get current network',
      network: null 
    };
  }
});

// WiFi disconnect handler - Disconnect from current network
ipcMain.handle('wifi-disconnect', async () => {
  log.info('[WiFi] Disconnecting from current network...');
  
  try {
    // Check if NetworkManager is available
    const nmAvailable = await isNetworkManagerAvailable();
    if (!nmAvailable) {
      return { success: false, error: 'NetworkManager not available' };
    }
    
    // Get the WiFi device name (usually wlan0)
    const { stdout: deviceOutput } = await execCommand('nmcli -t -f DEVICE,TYPE dev');
    const devices = deviceOutput.trim().split('\n');
    let wifiDevice = 'wlan0';
    
    for (const device of devices) {
      const [name, type] = device.split(':');
      if (type === 'wifi') {
        wifiDevice = name;
        break;
      }
    }
    
    await execCommand(`nmcli device disconnect ${wifiDevice}`);
    
    log.info('[WiFi] Successfully disconnected');
    return { success: true, message: 'Disconnected from WiFi' };
  } catch (error) {
    log.error('[WiFi] Disconnect failed:', error);
    return { 
      success: false, 
      error: error.error?.message || 'Failed to disconnect from WiFi'
    };
  }
});

// Check if running on Raspberry Pi
ipcMain.handle('wifi-is-available', async () => {
  try {
    const nmAvailable = await isNetworkManagerAvailable();
    return { available: nmAvailable };
  } catch {
    return { available: false };
  }
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

  window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHTML)}`).catch((err) => {
    log.error(`Failed to display error page: ${err.message}`);
  });
}

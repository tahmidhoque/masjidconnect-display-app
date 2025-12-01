const { contextBridge, ipcRenderer } = require('electron');
let store = null;

// Enhanced robust storage implementation
class MemoryStore {
  constructor() {
    this.data = {};
    console.log('📦 Created MemoryStore fallback storage');
  }

  get(key, defaultValue) {
    return key in this.data ? this.data[key] : defaultValue;
  }

  set(key, value) {
    this.data[key] = value;
    // Persist to localStorage as second fallback when possible
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const serialized = JSON.stringify(value);
        window.localStorage.setItem(`electron-store-${key}`, serialized);
      }
    } catch (err) {
      console.error('Failed to persist to localStorage:', err.message);
    }
  }

  delete(key) {
    delete this.data[key];
    // Clean localStorage too when possible
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(`electron-store-${key}`);
      }
    } catch (err) {
      console.error('Failed to remove from localStorage:', err.message);
    }
  }

  has(key) {
    return key in this.data;
  }

  clear() {
    this.data = {};
    // Clean localStorage too when possible
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Only clear our keys, not all localStorage
        Object.keys(window.localStorage)
          .filter((k) => k.startsWith('electron-store-'))
          .forEach((k) => window.localStorage.removeItem(k));
      }
    } catch (err) {
      console.error('Failed to clear localStorage:', err.message);
    }
  }

  keys() {
    return Object.keys(this.data);
  }
}

// Try to load electron-store, handle failure gracefully
try {
  const Store = require('electron-store');
  // Create a store instance
  store = new Store({
    name: 'masjidconnect-storage',
    // Make sure to encode/decode JSON for complex objects
    serialize: (value) => JSON.stringify(value),
    deserialize: (value) => JSON.parse(value),
  });
  console.log('Successfully loaded electron-store');
} catch (error) {
  console.error('Failed to load electron-store:', error.message);
  // Create memory-based fallback store with localStorage support
  store = new MemoryStore();
  // Try to recover data from localStorage if it exists
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith('electron-store-'))
        .forEach((k) => {
          const actualKey = k.replace('electron-store-', '');
          try {
            const storedValue = window.localStorage.getItem(k);
            const parsedValue = JSON.parse(storedValue);
            store.data[actualKey] = parsedValue;
            console.log(`Recovered value for ${actualKey} from localStorage`);
          } catch (err) {
            console.error(`Failed to recover data for ${actualKey}:`, err.message);
          }
        });
    }
  } catch (err) {
    console.error('Failed to recover from localStorage:', err.message);
  }
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  app: {
    getVersion: () => ipcRenderer.invoke('get-app-version'),
  },
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  ipcRenderer: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, callback) => {
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    },
    removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback),
  },
  updater: {
    // Check for updates
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

    // Download update
    downloadUpdate: () => ipcRenderer.invoke('download-update'),

    // Install update and restart
    installUpdate: () => ipcRenderer.invoke('install-update'),

    // Restart app without installing update
    restartApp: () => ipcRenderer.invoke('restart-app'),

    // Listen for update messages
    onUpdateMessage: (callback) => {
      const subscription = (event, text) => callback(text);
      ipcRenderer.on('update-message', subscription);
      return () => ipcRenderer.removeListener('update-message', subscription);
    },

    // Listen for update available
    onUpdateAvailable: (callback) => {
      const subscription = (event, info) => callback(info);
      ipcRenderer.on('update-available', subscription);
      return () => ipcRenderer.removeListener('update-available', subscription);
    },

    // Listen for download progress
    onDownloadProgress: (callback) => {
      const subscription = (event, progress) => callback(progress);
      ipcRenderer.on('download-progress', subscription);
      return () => ipcRenderer.removeListener('download-progress', subscription);
    },

    // Listen for update downloaded
    onUpdateDownloaded: (callback) => {
      const subscription = (event, info) => callback(info);
      ipcRenderer.on('update-downloaded', subscription);
      return () => ipcRenderer.removeListener('update-downloaded', subscription);
    },

    // Listen for update errors
    onUpdateError: (callback) => {
      const subscription = (event, error) => callback(error);
      ipcRenderer.on('update-error', subscription);
      return () => ipcRenderer.removeListener('update-error', subscription);
    },
  },
  store: {
    // Get a value from store
    get: (key, defaultValue) => store.get(key, defaultValue),
    // Set a value in store
    set: (key, value) => store.set(key, value),
    // Delete a key from store
    delete: (key) => store.delete(key),
    // Check if store has a key
    has: (key) => store.has(key),
    // Clear the entire store
    clear: () => store.clear(),
    // Get all keys in store
    keys: () => store.keys(),
  },

  // WiFi configuration API (for Raspberry Pi with NetworkManager)
  wifi: {
    /**
     * Check if WiFi configuration is available on this system
     * @returns {Promise<{available: boolean}>}
     */
    isAvailable: () => ipcRenderer.invoke('wifi-is-available'),

    /**
     * Scan for available WiFi networks
     * @returns {Promise<{success: boolean, networks?: Array, error?: string}>}
     */
    scan: () => ipcRenderer.invoke('wifi-scan'),

    /**
     * Connect to a WiFi network
     * @param {string} ssid - The network SSID
     * @param {string} password - The network password (optional for open networks)
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    connect: (ssid, password) => ipcRenderer.invoke('wifi-connect', { ssid, password }),

    /**
     * Get current WiFi connection status
     * @returns {Promise<{success: boolean, status?: object, error?: string}>}
     */
    getStatus: () => ipcRenderer.invoke('wifi-status'),

    /**
     * Get currently connected network info
     * @returns {Promise<{success: boolean, network?: object, error?: string}>}
     */
    getCurrentNetwork: () => ipcRenderer.invoke('wifi-current'),

    /**
     * Disconnect from current WiFi network
     * @returns {Promise<{success: boolean, message?: string, error?: string}>}
     */
    disconnect: () => ipcRenderer.invoke('wifi-disconnect'),
  },
});

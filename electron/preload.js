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
          .filter(k => k.startsWith('electron-store-'))
          .forEach(k => window.localStorage.removeItem(k));
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
    deserialize: (value) => JSON.parse(value)
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
        .filter(k => k.startsWith('electron-store-'))
        .forEach(k => {
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
contextBridge.exposeInMainWorld(
  'electron', {
    updater: {
      // Listen for update messages
      onUpdateMessage: (callback) => {
        ipcRenderer.on('update-message', (event, text) => callback(text));
      },
      // Check for updates
      checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
      // Restart app to install update
      restartApp: () => ipcRenderer.invoke('restart-app')
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
      keys: () => store.keys()
    }
  }
); 
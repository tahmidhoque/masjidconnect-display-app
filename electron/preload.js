const { contextBridge, ipcRenderer } = require('electron');
const Store = require('electron-store');

// Create a store instance
const store = new Store({
  name: 'masjidconnect-storage',
  // Make sure to encode/decode JSON for complex objects
  serialize: (value) => JSON.stringify(value),
  deserialize: (value) => JSON.parse(value)
});

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
      keys: () => Object.keys(store.store || {})
    }
  }
); 
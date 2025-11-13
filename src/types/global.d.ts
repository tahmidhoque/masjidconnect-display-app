interface Window {
  electron?: {
    app?: {
      getVersion: () => Promise<string>;
      relaunch: () => void;
      exit: () => void;
    };
    versions?: {
      electron: string;
      chrome: string;
      node: string;
    };
    ipcRenderer?: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, callback: (...args: any[]) => void) => () => void;
      removeListener: (channel: string, callback: (...args: any[]) => void) => void;
    };
    updater: {
      // Methods
      checkForUpdates: () => Promise<{ success: boolean; message?: string; error?: string }>;
      downloadUpdate: () => Promise<{ success: boolean; message?: string; error?: string }>;
      installUpdate: () => Promise<{ success: boolean; message?: string; error?: string }>;
      restartApp: () => Promise<{ success: boolean; message?: string; error?: string }>;
      relaunch: () => Promise<void>;
      exit: () => Promise<void>;
      
      // Event listeners (all return unsubscribe functions)
      onUpdateMessage: (callback: (text: string) => void) => () => void;
      onUpdateAvailable: (callback: (info: { version: string }) => void) => () => void;
      onDownloadProgress: (callback: (progress: {
        bytesPerSecond: number;
        percent: number;
        transferred: number;
        total: number;
      }) => void) => () => void;
      onUpdateDownloaded: (callback: (info: { version: string }) => void) => () => void;
      onUpdateError: (callback: (error: Error) => void) => () => void;
    };
    store?: {
      get: (key: string, defaultValue?: any) => any;
      set: (key: string, value: any) => void;
      delete: (key: string) => void;
      has: (key: string) => boolean;
      clear: () => void;
      keys: () => string[];
    };
  };
  process?: {
    type?: string;
  };
} 
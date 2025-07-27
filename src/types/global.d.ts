interface Window {
  electron?: {
    app?: {
      relaunch: () => void;
      exit: () => void;
    };
    updater: {
      onUpdateMessage: (callback: (text: string) => void) => void;
      checkForUpdates: () => Promise<string>;
      restartApp: () => Promise<void>;
      relaunch: () => Promise<void>;
      exit: () => Promise<void>;
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
interface Window {
  electron?: {
    updater: {
      onUpdateMessage: (callback: (text: string) => void) => void;
      checkForUpdates: () => Promise<string>;
      restartApp: () => Promise<void>;
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
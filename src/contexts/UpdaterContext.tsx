import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import logger from '../utils/logger';

// Define the interface for the electron object exposed in preload.js
declare global {
  interface Window {
    electron?: {
      updater: {
        onUpdateMessage: (callback: (message: string) => void) => void;
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
  }
}

// Define the context type
interface UpdaterContextType {
  updateAvailable: boolean;
  updateMessage: string;
  checkForUpdates: () => Promise<void>;
  restartApp: () => Promise<void>;
  isElectron: boolean;
}

// Create the context
const UpdaterContext = createContext<UpdaterContextType | undefined>(undefined);

// Create a hook to use the context
export const useUpdater = (): UpdaterContextType => {
  const context = useContext(UpdaterContext);
  if (context === undefined) {
    throw new Error('useUpdater must be used within an UpdaterProvider');
  }
  return context;
};

interface UpdaterProviderProps {
  children: ReactNode;
}

// Create the provider component
export const UpdaterProvider: React.FC<UpdaterProviderProps> = ({ children }) => {
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [updateMessage, setUpdateMessage] = useState<string>('');
  
  // Determine if running in Electron
  const isElectron = !!(window.electron && window.electron.updater);

  useEffect(() => {
    if (isElectron) {
      // Listen for update messages from the main process
      window.electron?.updater.onUpdateMessage((message: string) => {
        logger.info('Update message received:', { message });
        setUpdateMessage(message);
        
        // If update is available or downloaded, set flag to true
        if (
          message.includes('Update available') ||
          message.includes('Update downloaded')
        ) {
          setUpdateAvailable(true);
        }
      });
      
      // Initial check for updates
      checkForUpdates();
    }
  }, [isElectron]);

  // Function to check for updates
  const checkForUpdates = async (): Promise<void> => {
    if (isElectron) {
      try {
        const message = await window.electron?.updater.checkForUpdates();
        logger.info('Checking for updates:', { message });
      } catch (error) {
        logger.error('Error checking for updates:', { error });
      }
    } else {
      logger.info('Not running in Electron, update check skipped');
    }
  };

  // Function to restart the app and install updates
  const restartApp = async (): Promise<void> => {
    if (isElectron) {
      try {
        logger.info('Restarting app to install updates');
        await window.electron?.updater.restartApp();
      } catch (error) {
        logger.error('Error restarting app:', { error });
      }
    } else {
      logger.info('Not running in Electron, restart skipped');
    }
  };

  // Context value
  const value: UpdaterContextType = {
    updateAvailable,
    updateMessage,
    checkForUpdates,
    restartApp,
    isElectron
  };

  return (
    <UpdaterContext.Provider value={value}>
      {children}
    </UpdaterContext.Provider>
  );
}; 
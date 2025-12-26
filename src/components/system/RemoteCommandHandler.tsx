/**
 * Remote Command Handler
 * 
 * This component listens to custom events dispatched by remoteControlService
 * and executes the appropriate actions (Redux dispatches, Electron IPC calls, etc.)
 * 
 * It bridges the gap between the service layer (remoteControlService) and the
 * application layer (Redux store, Electron, etc.)
 */

import { useEffect } from 'react';
import { useAppDispatch } from '../../store/hooks';
import { refreshAllContent, refreshPrayerTimes } from '../../store/slices/contentSlice';
import { setCurrentAlert } from '../../store/slices/emergencySlice';
import logger from '../../utils/logger';

const RemoteCommandHandler: React.FC = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    logger.info('[RemoteCommandHandler] Setting up command handlers');

    /**
     * RELOAD_CONTENT handler
     * Dispatches Redux action to reload all content
     */
    const handleReloadContent = (event: Event) => {
      const customEvent = event as CustomEvent;
      const commandId = customEvent.detail?.commandId;
      
      logger.info('[RemoteCommandHandler] Handling RELOAD_CONTENT', { commandId });
      
      // Dispatch Redux action to reload all content
      dispatch(refreshAllContent({ forceRefresh: true }))
        .then((result: any) => {
          logger.info('[RemoteCommandHandler] Content reloaded successfully');
        })
        .catch((error: any) => {
          logger.error('[RemoteCommandHandler] Failed to reload content', { error: error.message });
        });
    };

    /**
     * REFRESH_PRAYER_TIMES handler
     * Dispatches Redux action to refresh prayer times
     */
    const handleRefreshPrayerTimes = (event: Event) => {
      const customEvent = event as CustomEvent;
      const commandId = customEvent.detail?.commandId;
      
      logger.info('[RemoteCommandHandler] Handling REFRESH_PRAYER_TIMES', { commandId });
      
      // Dispatch Redux action to refresh prayer times
      dispatch(refreshPrayerTimes({ forceRefresh: true }))
        .then((result: any) => {
          logger.info('[RemoteCommandHandler] Prayer times refreshed successfully');
        })
        .catch((error: any) => {
          logger.error('[RemoteCommandHandler] Failed to refresh prayer times', { error: error.message });
        });
    };

    /**
     * RESTART_APP handler
     * Calls Electron IPC to restart the app
     */
    const handleRestartApp = (event: Event) => {
      const customEvent = event as CustomEvent;
      const commandId = customEvent.detail?.commandId;
      const countdown = customEvent.detail?.countdown || 10;
      
      logger.info('[RemoteCommandHandler] Handling RESTART_APP', { commandId, countdown });
      
      // Check if running in Electron
      const isElectron = typeof window !== 'undefined' && 
                         window.electron !== undefined && 
                         window.electron.ipcRenderer !== undefined;
      
      if (!isElectron) {
        logger.warn('[RemoteCommandHandler] Not running in Electron, cannot restart app');
        return;
      }
      
      // Use setTimeout to respect countdown
      setTimeout(() => {
        logger.info('[RemoteCommandHandler] Executing app restart');
        window.electron!.ipcRenderer!.invoke('restart-app')
          .then((result: any) => {
            logger.info('[RemoteCommandHandler] Restart initiated', result);
          })
          .catch((error: any) => {
            logger.error('[RemoteCommandHandler] Failed to restart app', { error });
          });
      }, countdown * 1000);
    };

    /**
     * FACTORY_RESET handler
     * Performs factory reset by clearing all storage
     */
    const handleFactoryReset = (event: Event) => {
      const customEvent = event as CustomEvent;
      const commandId = customEvent.detail?.commandId;
      const countdown = customEvent.detail?.countdown || 30;
      
      logger.info('[RemoteCommandHandler] Handling FACTORY_RESET', { commandId, countdown });
      
      // Use setTimeout to respect countdown
      setTimeout(async () => {
        try {
          logger.info('[RemoteCommandHandler] Executing factory reset');
          
          // Clear all localStorage
          localStorage.clear();
          
          // Clear all IndexedDB
          if ('indexedDB' in window) {
            const databases = await window.indexedDB.databases();
            for (const db of databases) {
              if (db.name) {
                window.indexedDB.deleteDatabase(db.name);
              }
            }
          }
          
          // Clear all caches
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((name) => caches.delete(name)));
          }
          
          logger.info('[RemoteCommandHandler] Factory reset complete, reloading');
          
          // Reload the app
          window.location.reload();
        } catch (error) {
          logger.error('[RemoteCommandHandler] Factory reset failed', { error });
        }
      }, countdown * 1000);
    };

    /**
     * REBOOT_DEVICE handler  
     * Calls Electron IPC to reboot the device
     */
    const handleRebootDevice = (event: Event) => {
      const customEvent = event as CustomEvent;
      const commandId = customEvent.detail?.commandId;
      const countdown = customEvent.detail?.countdown || 5;
      
      logger.info('[RemoteCommandHandler] Handling REBOOT_DEVICE', { commandId, countdown });
      
      // Check if running in Electron
      const isElectron = typeof window !== 'undefined' && 
                         window.electron !== undefined && 
                         window.electron.app !== undefined;
      
      if (!isElectron) {
        logger.warn('[RemoteCommandHandler] Not running in Electron, falling back to app reload');
        setTimeout(() => {
          window.location.reload();
        }, countdown * 1000);
        return;
      }
      
      // Use setTimeout to respect countdown
      setTimeout(() => {
        logger.info('[RemoteCommandHandler] Executing device reboot');
        
        if (window.electron?.app?.relaunch && window.electron?.app?.exit) {
          window.electron.app.relaunch();
          window.electron.app.exit();
        } else {
          // Fallback to reload
          window.location.reload();
        }
      }, countdown * 1000);
    };

    /**
     * DISPLAY_MESSAGE handler
     * Shows an emergency alert with the provided message
     */
    const handleDisplayMessage = (event: Event) => {
      const customEvent = event as CustomEvent;
      const commandId = customEvent.detail?.commandId;
      const message = customEvent.detail?.message;
      const title = customEvent.detail?.title || 'Message';
      const duration = customEvent.detail?.duration || 10000; // Default 10 seconds
      
      logger.info('[RemoteCommandHandler] Handling DISPLAY_MESSAGE', { commandId, title, message });
      
      if (!message) {
        logger.warn('[RemoteCommandHandler] No message provided for DISPLAY_MESSAGE');
        return;
      }
      
      // Create emergency alert to display the message
      const alert = {
        id: `message-${commandId}-${Date.now()}`,
        title,
        message,
        color: '#2196f3', // Info blue
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + duration).toISOString(),
        timing: {
          duration,
          remaining: duration,
          autoCloseAt: new Date(Date.now() + duration).toISOString(),
        },
        masjidId: '', // Will be filled by the slice
        colorScheme: undefined,
      };
      
      // Dispatch to emergency slice to show as alert
      dispatch(setCurrentAlert(alert as any));
      
      // Auto-clear after duration
      setTimeout(() => {
        dispatch(setCurrentAlert(null));
      }, duration);
    };

    /**
     * UPDATE_ORIENTATION handler
     * This is already handled by realtimeMiddleware and remoteControlService
     * but we log it here for completeness
     */
    const handleUpdateOrientation = (event: Event) => {
      const customEvent = event as CustomEvent;
      const commandId = customEvent.detail?.commandId;
      const orientation = customEvent.detail?.orientation;
      
      logger.info('[RemoteCommandHandler] Orientation update handled', { commandId, orientation });
      // No action needed - already handled by middleware
    };

    // Register all event listeners
    window.addEventListener('remote:reload-content', handleReloadContent);
    window.addEventListener('remote:refresh-prayer-times', handleRefreshPrayerTimes);
    window.addEventListener('remote:restart-app', handleRestartApp as EventListener);
    window.addEventListener('remote:factory-reset', handleFactoryReset as EventListener);
    window.addEventListener('remote:reboot-device', handleRebootDevice as EventListener);
    window.addEventListener('remote:display-message', handleDisplayMessage as EventListener);
    window.addEventListener('remote:update-orientation', handleUpdateOrientation as EventListener);

    logger.info('[RemoteCommandHandler] Command handlers registered');

    // Cleanup on unmount
    return () => {
      logger.debug('[RemoteCommandHandler] Cleaning up command handlers');
      
      window.removeEventListener('remote:reload-content', handleReloadContent);
      window.removeEventListener('remote:refresh-prayer-times', handleRefreshPrayerTimes);
      window.removeEventListener('remote:restart-app', handleRestartApp as EventListener);
      window.removeEventListener('remote:factory-reset', handleFactoryReset as EventListener);
      window.removeEventListener('remote:reboot-device', handleRebootDevice as EventListener);
      window.removeEventListener('remote:display-message', handleDisplayMessage as EventListener);
      window.removeEventListener('remote:update-orientation', handleUpdateOrientation as EventListener);
    };
  }, [dispatch]);

  // This component doesn't render anything
  return null;
};

export default RemoteCommandHandler;


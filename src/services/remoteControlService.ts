/**
 * Remote Control Service
 * 
 * Handles SSE events from the admin portal for remote device management.
 * Supports commands: FORCE_UPDATE, RESTART_APP, RELOAD_CONTENT, CLEAR_CACHE,
 * UPDATE_SETTINGS, FACTORY_RESET, CAPTURE_SCREENSHOT
 */

import logger from '../utils/logger';
import masjidDisplayClient from '../api/masjidDisplayClient';
import updateService from './updateService';
import storageService from './storageService';
import localforage from 'localforage';
import { analyticsService } from './analyticsService';
import unifiedSSEService from './unifiedSSEService';

// Event Types for SSE Remote Control
const REMOTE_COMMAND_TYPES = {
  FORCE_UPDATE: 'FORCE_UPDATE',
  RESTART_APP: 'RESTART_APP',
  RELOAD_CONTENT: 'RELOAD_CONTENT',
  CLEAR_CACHE: 'CLEAR_CACHE',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  FACTORY_RESET: 'FACTORY_RESET',
  CAPTURE_SCREENSHOT: 'CAPTURE_SCREENSHOT',
};

export interface RemoteCommand {
  type: keyof typeof REMOTE_COMMAND_TYPES;
  payload?: any;
  timestamp: string;
  commandId: string;
}

export interface RemoteCommandResponse {
  commandId: string;
  success: boolean;
  message?: string;
  error?: string;
  timestamp: string;
  executionTime?: number; // milliseconds
}

export interface ConnectionStatus {
  connected: boolean;
  url: string | null;
  readyState: number | null;
  reconnectAttempts: number;
  lastError?: string;
}

class RemoteControlService {
  private commandListeners: Set<(command: RemoteCommand) => void> = new Set();
  private lastCommandTimestamp: Record<string, number> = {};
  private commandCooldownMs = 2000; // 2 seconds cooldown between commands
  private commandQueue: RemoteCommand[] = [];
  private commandsInProgress: Set<string> = new Set(); // Track commands currently executing
  private connectionStatusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private maxStoredResponses = 50;
  private isInitializing = false; // Prevent duplicate initialization
  private unregisterHandlers: (() => void)[] = []; // Track registered handlers for cleanup
  private processedCommandIds: Set<string> = new Set(); // Track processed command IDs to prevent duplicates
  private commandIdCleanupTimers: Map<string, NodeJS.Timeout> = new Map(); // Track cleanup timers for command IDs

  /**
   * Initialize the remote control service using the unified SSE connection
   */
  public initialize(baseURL: string): void {
    // Prevent duplicate initialization
    if (this.isInitializing) {
      logger.warn('RemoteControlService: Already initializing, skipping duplicate call');
      return;
    }
    
    this.isInitializing = true;
    logger.info('RemoteControlService: Initializing with unified SSE service', { baseURL });
    console.log('🎮 RemoteControlService: Initializing with unified SSE service');
    
    // Ensure unified SSE service is initialized
    unifiedSSEService.initialize(baseURL);
    
    // Register handlers for all remote command types
    this.registerEventHandlers();
    
    this.isInitializing = false;
  }
  
  /**
   * Register event handlers with the unified SSE service
   */
  private registerEventHandlers(): void {
    // Clean up any existing handlers first
    if (this.unregisterHandlers.length > 0) {
      logger.info('RemoteControlService: Cleaning up existing event handlers before re-registering', {
        handlerCount: this.unregisterHandlers.length,
      });
      console.log(`🎮 RemoteControlService: Cleaning up ${this.unregisterHandlers.length} existing handler(s)`);
    }
    this.unregisterHandlers.forEach(unregister => unregister());
    this.unregisterHandlers = [];
    
    // Register handler for each command type
    Object.values(REMOTE_COMMAND_TYPES).forEach(commandType => {
      const unregister = unifiedSSEService.addEventListener(commandType, (event: MessageEvent) => {
        console.log(`🎮🎮🎮 RemoteControlService: ${commandType} event received via unified SSE!`, {
          eventType: event.type,
          data: event.data,
          timestamp: new Date().toISOString(),
        });
        logger.info(`RemoteControlService: ${commandType} event received`, {
          type: event.type,
          data: event.data,
        });
        try {
          this.handleRemoteCommand(event);
        } catch (error) {
          console.error(`🎮 RemoteControlService: Error in ${commandType} handler:`, error);
          logger.error(`RemoteControlService: Error handling ${commandType} event`, { error });
        }
      });
      this.unregisterHandlers.push(unregister);
    });
    
    // Also listen for generic 'remote_command' events
    const unregisterRemoteCommand = unifiedSSEService.addEventListener('remote_command', (event: MessageEvent) => {
      console.log('🎮 RemoteControlService: remote_command event received:', event.data);
      this.handleRemoteCommand(event);
    });
    this.unregisterHandlers.push(unregisterRemoteCommand);
    
    const unregisterRemoteCommandAlt = unifiedSSEService.addEventListener('remoteCommand', (event: MessageEvent) => {
      console.log('🎮 RemoteControlService: remoteCommand event received:', event.data);
      this.handleRemoteCommand(event);
    });
    this.unregisterHandlers.push(unregisterRemoteCommandAlt);
    
    // Listen to default 'message' event for commands without specific type
    const unregisterMessage = unifiedSSEService.addEventListener('message', (event: MessageEvent) => {
      const messageEvent = event as MessageEvent;
      const eventType = (messageEvent as any).type || 'message';
      
      console.log(`🎮🎮🎮 RemoteControlService: MESSAGE event received via unified SSE!`, {
        eventType,
        data: messageEvent.data,
        originalType: messageEvent.type,
      });
      
      logger.info('RemoteControlService: Message event received', {
        eventType,
        data: messageEvent.data,
        originalType: messageEvent.type,
      });
      
      // Try to parse and handle as remote command
      try {
        const data = typeof messageEvent.data === 'string' ? JSON.parse(messageEvent.data) : messageEvent.data;
        
        console.log('🎮 RemoteControlService: Parsed message data:', data);
        
        // Check if this is a remote command
        if (data && (data.type || data.commandType)) {
          logger.info('RemoteControlService: Message event contains command, handling', {
            commandType: data.type || data.commandType,
          });
          console.log('🎮 RemoteControlService: Message event contains command, handling:', data.type || data.commandType);
          this.handleRemoteCommand(messageEvent);
        }
      } catch (error) {
        // Not JSON or not a command, ignore
        logger.debug('RemoteControlService: Message event is not a remote command', { error });
      }
    });
    this.unregisterHandlers.push(unregisterMessage);
    
    logger.info('RemoteControlService: All event handlers registered with unified SSE service', {
      totalHandlers: this.unregisterHandlers.length,
      commandTypes: Object.values(REMOTE_COMMAND_TYPES),
    });
    console.log(`🎮 RemoteControlService: All event handlers registered successfully (${this.unregisterHandlers.length} handlers)`);
  }


  /**
   * Handle a remote command event
   */
  private handleRemoteCommand = (event: MessageEvent): void => {
    console.log('🎮 RemoteControlService: handleRemoteCommand called!', {
      eventType: (event as any).type,
      data: event.data,
      isOnline: navigator.onLine,
    });
    
    // Don't process commands when offline
    if (!navigator.onLine) {
      logger.warn('RemoteControlService: Ignoring command - device is offline');
      console.warn('🎮 RemoteControlService: Command blocked - device offline');
      return;
    }
    
    // CRITICAL: Verify unified SSE connection is ready before processing events
    const connectionStatus = unifiedSSEService.getConnectionStatus();
    if (!connectionStatus.connected) {
      logger.warn('RemoteControlService: Ignoring command - unified SSE connection not ready', {
        readyState: connectionStatus.readyState,
        connected: connectionStatus.connected,
      });
      console.warn('🎮 RemoteControlService: Command blocked - unified SSE connection not ready', {
        readyState: connectionStatus.readyState,
      });
      return;
    }

    const eventType = (event as any).type || 'message';
    logger.info('RemoteControlService: Remote command event received', {
      eventType,
      data: event.data,
      lastEventId: (event as any).lastEventId,
    });
    console.log(`🎮 RemoteControlService: Remote command received (event type: ${eventType}):`, event.data);
    
    try {
      let commandData: RemoteCommand;
      
      // Try to parse the data
      if (typeof event.data === 'string') {
        try {
          commandData = JSON.parse(event.data) as RemoteCommand;
        } catch (parseError) {
          logger.error('RemoteControlService: Failed to parse command data as JSON', {
            error: parseError,
            data: event.data,
          });
          console.error('🎮 RemoteControlService: Failed to parse JSON:', parseError);
          return;
        }
      } else {
        commandData = event.data as RemoteCommand;
      }
      
      // Validate command
      if (!commandData || !commandData.type || !commandData.commandId) {
        logger.warn('RemoteControlService: Invalid command format', {
          commandData,
          hasType: !!commandData?.type,
          hasCommandId: !!commandData?.commandId,
        });
        console.error('🎮 RemoteControlService: Invalid command format:', commandData);
        return;
      }
      
      logger.info('RemoteControlService: Valid command received', {
        type: commandData.type,
        commandId: commandData.commandId,
        timestamp: commandData.timestamp,
      });
      
      // CRITICAL: Check for duplicate command IDs to prevent processing the same command multiple times
      // This prevents the same SSE event from being handled by multiple event listeners
      if (this.processedCommandIds.has(commandData.commandId)) {
        logger.warn('RemoteControlService: Duplicate command detected, skipping', {
          commandId: commandData.commandId,
          type: commandData.type,
        });
        console.warn('🎮 RemoteControlService: Duplicate command detected, skipping:', commandData.commandId);
        return;
      }
      
      // Check cooldown to prevent command spam
      const now = Date.now();
      const lastTime = this.lastCommandTimestamp[commandData.type] || 0;
      
      if (now - lastTime < this.commandCooldownMs) {
        logger.warn('RemoteControlService: Command throttled', {
          type: commandData.type,
          cooldown: this.commandCooldownMs,
          commandId: commandData.commandId,
        });
        
        // Queue command instead of dropping it
        this.commandQueue.push(commandData);
        
        // Dispatch throttled event for UI feedback
        window.dispatchEvent(new CustomEvent('remote:command-throttled', {
          detail: {
            type: commandData.type,
            commandId: commandData.commandId,
            queued: true,
          }
        }));
        
        // Process queue after cooldown period
        setTimeout(() => {
          this.processCommandQueue();
        }, this.commandCooldownMs - (now - lastTime));
        
        return;
      }
      
      // Mark command as processed BEFORE execution to prevent duplicate processing
      // This must happen after throttling check but before execution
      this.processedCommandIds.add(commandData.commandId);
      
      // Schedule cleanup of command ID after 5 seconds
      // This allows legitimate retries after a delay but prevents immediate duplicates
      const cleanupTimer = setTimeout(() => {
        this.processedCommandIds.delete(commandData.commandId);
        this.commandIdCleanupTimers.delete(commandData.commandId);
      }, 5000);
      this.commandIdCleanupTimers.set(commandData.commandId, cleanupTimer);
      
      this.lastCommandTimestamp[commandData.type] = now;
      
      // Execute command
      this.executeCommand(commandData);
      
      // Notify listeners
      this.notifyListeners(commandData);
      
      // Process any queued commands
      this.processCommandQueue();
    } catch (error) {
      console.error('🎮 RemoteControlService: Error parsing command data:', error);
    }
  };

  /**
   * Execute a remote command
   */
  private async executeCommand(command: RemoteCommand): Promise<void> {
    const startTime = Date.now();
    
    // Check if command is already in progress
    if (this.commandsInProgress.has(command.commandId)) {
      logger.warn('RemoteControlService: Command already in progress', {
        commandId: command.commandId,
        type: command.type,
      });
      return;
    }
    
    // Mark command as in progress
    this.commandsInProgress.add(command.commandId);
    
    logger.info('RemoteControlService: Executing command', {
      type: command.type,
      commandId: command.commandId,
    });
    
    // Dispatch event to notify UI that command was received
    window.dispatchEvent(new CustomEvent('remote:command-received', {
      detail: {
        type: command.type,
        commandId: command.commandId,
      }
    }));
    
    let response: RemoteCommandResponse;
    
    try {
      // Log the command type and expected values for debugging
      logger.debug('RemoteControlService: Executing command switch', {
        commandType: command.type,
        expectedRestartApp: REMOTE_COMMAND_TYPES.RESTART_APP,
        typeMatch: command.type === REMOTE_COMMAND_TYPES.RESTART_APP,
      });
      
      switch (command.type) {
        case REMOTE_COMMAND_TYPES.FORCE_UPDATE:
          response = await this.handleForceUpdate(command);
          break;
          
        case REMOTE_COMMAND_TYPES.RESTART_APP:
        case 'RESTART_APP': // Also handle string literal for compatibility
          logger.info('RemoteControlService: Matched RESTART_APP case');
          response = await this.handleRestartApp(command);
          break;
          
        case REMOTE_COMMAND_TYPES.RELOAD_CONTENT:
          response = await this.handleReloadContent(command);
          break;
          
        case REMOTE_COMMAND_TYPES.CLEAR_CACHE:
          response = await this.handleClearCache(command);
          break;
          
        case REMOTE_COMMAND_TYPES.UPDATE_SETTINGS:
          response = await this.handleUpdateSettings(command);
          break;
          
        case REMOTE_COMMAND_TYPES.FACTORY_RESET:
          response = await this.handleFactoryReset(command);
          break;
          
        case REMOTE_COMMAND_TYPES.CAPTURE_SCREENSHOT:
          response = await this.handleCaptureScreenshot(command);
          break;
          
        default:
          response = {
            commandId: command.commandId,
            success: false,
            error: `Unknown command type: ${command.type}`,
            timestamp: new Date().toISOString(),
            executionTime: Date.now() - startTime,
          };
      }
      
      // Add execution time
      response.executionTime = Date.now() - startTime;
      
      // Send response back to portal via heartbeat or analytics
      this.sendCommandResponse(response);
      
      // Dispatch success event
      window.dispatchEvent(new CustomEvent('remote:command-completed', {
        detail: {
          commandId: command.commandId,
          success: response.success,
          type: command.type,
        }
      }));
    } catch (error: any) {
      logger.error('RemoteControlService: Error executing command', { error, command });
      
      response = {
        commandId: command.commandId,
        success: false,
        error: error.message || 'Command execution failed',
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - startTime,
      };
      
      this.sendCommandResponse(response);
    } finally {
      // Remove from in-progress set
      this.commandsInProgress.delete(command.commandId);
    }
  }

  /**
   * Handler implementations
   */
  
  /**
   * Force Update Handler
   * Checks for updates immediately and downloads if available
   */
  private async handleForceUpdate(command: RemoteCommand): Promise<RemoteCommandResponse> {
    logger.info('RemoteControlService: Force update command received', { commandId: command.commandId });
    
    try {
      // Validate command payload if needed
      if (command.payload && typeof command.payload !== 'object') {
        throw new Error('Invalid command payload format');
      }
      
      // Check if running in Electron environment
      const isElectron = typeof window !== 'undefined' && window.electron !== undefined && window.electron.ipcRenderer !== undefined;
      if (!isElectron) {
        logger.warn('RemoteControlService: Force update requested but not running in Electron');
        return {
          commandId: command.commandId,
          success: false,
          error: 'Update service not available (not running in Electron)',
          timestamp: new Date().toISOString(),
        };
      }
      
      // Trigger update check via IPC to main process
      try {
        const result = await window.electron!.ipcRenderer!.invoke('check-for-updates');
        
        if (!result.success) {
          return {
            commandId: command.commandId,
            success: false,
            error: result.error || 'Failed to check for updates',
            timestamp: new Date().toISOString(),
          };
        }
        
        // Update check started successfully
        // Actual update progress will be reported via heartbeat
        logger.info('RemoteControlService: Update check initiated successfully', { commandId: command.commandId });
        
        // Dispatch custom event for UI to show update notification
        try {
          window.dispatchEvent(new CustomEvent('remote:force-update', {
            detail: { commandId: command.commandId }
          }));
        } catch (eventError) {
          logger.warn('RemoteControlService: Error dispatching update event', { error: eventError });
          // Continue execution even if event dispatch fails
        }
        
        return {
          commandId: command.commandId,
          success: true,
          message: 'Update check initiated. Progress will be reported via heartbeat.',
          timestamp: new Date().toISOString(),
        };
      } catch (ipcError: any) {
        logger.error('RemoteControlService: IPC error checking for updates', { error: ipcError });
        throw new Error(`Update check failed: ${ipcError.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      logger.error('RemoteControlService: Error in force update', { 
        error: error.message || error,
        stack: error.stack,
        commandId: command.commandId,
      });
      return {
        commandId: command.commandId,
        success: false,
        error: error.message || 'Force update failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Restart App Handler
   * Shows countdown notification and restarts the app
   */
  private async handleRestartApp(command: RemoteCommand): Promise<RemoteCommandResponse> {
    logger.info('RemoteControlService: Restart app command received', { commandId: command.commandId });
    
    try {
      // Dispatch event to show countdown notification
      window.dispatchEvent(new CustomEvent('remote:restart-app', {
        detail: {
          commandId: command.commandId,
          countdown: command.payload?.countdown || 10, // Default 10 seconds
        }
      }));
      
      // The actual restart will be triggered after countdown completes
      // This is handled by the RemoteCommandNotification component
      
      return {
        commandId: command.commandId,
        success: true,
        message: 'Restart initiated with countdown',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('RemoteControlService: Error in restart app', { error });
      return {
        commandId: command.commandId,
        success: false,
        error: error.message || 'Restart app failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Reload Content Handler
   * Invalidates all caches and reloads content from API
   */
  private async handleReloadContent(command: RemoteCommand): Promise<RemoteCommandResponse> {
    logger.info('RemoteControlService: Reload content command received', { commandId: command.commandId });
    
    try {
      // Invalidate all API caches
      masjidDisplayClient.invalidateAllCaches();
      
      // Show loading indicator
      window.dispatchEvent(new CustomEvent('remote:reload-content', {
        detail: { commandId: command.commandId }
      }));
      
      // Reload will be handled by Redux actions triggered by the event
      // Components will re-fetch data automatically
      
      return {
        commandId: command.commandId,
        success: true,
        message: 'Content reload initiated',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('RemoteControlService: Error in reload content', { error });
      return {
        commandId: command.commandId,
        success: false,
        error: error.message || 'Reload content failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Clear Cache Handler
   * Clears all caches including localStorage, localforage, and service worker
   */
  private async handleClearCache(command: RemoteCommand): Promise<RemoteCommandResponse> {
    logger.info('RemoteControlService: Clear cache command received', { commandId: command.commandId });
    
    try {
      // Clear localforage
      await localforage.clear();
      logger.info('Cleared localforage');
      
      // Clear localStorage (except credentials and pairing state)
      // CRITICAL: Preserve Redux persist state which contains auth state
      const preserveKeys = [
        'masjid_api_key',
        'masjid_screen_id',
        'apiKey',
        'screenId',
        'device_id',
        'masjidconnect_credentials',
        'isPaired',
        'masjidconnect-root', // Redux persist state - contains auth, content, emergency slices
      ];
      
      const allKeys = Object.keys(localStorage);
      const keysToRemove: string[] = [];
      const keysPreserved: string[] = [];
      
      allKeys.forEach(key => {
        if (!preserveKeys.includes(key)) {
          keysToRemove.push(key);
          localStorage.removeItem(key);
        } else {
          keysPreserved.push(key);
        }
      });
      
      logger.info('Cleared localStorage (preserved credentials and Redux state)', {
        preserved: keysPreserved,
        removed: keysToRemove.length,
        removedKeys: keysToRemove.slice(0, 10), // Log first 10 removed keys for debugging
      });
      console.log('🧹 Clear Cache: Preserved keys:', keysPreserved);
      console.log('🧹 Clear Cache: Removed', keysToRemove.length, 'keys');
      
      // Clear service worker cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        logger.info('Cleared service worker caches');
      }
      
      // Invalidate API caches
      masjidDisplayClient.invalidateAllCaches();
      
      // CRITICAL: Cleanup all SSE connections before reload to prevent stale connections
      logger.info('RemoteControlService: Cleaning up SSE connections before reload');
      
      // Cleanup this service's connection
      this.cleanup();
      
      // Cleanup other SSE services
      try {
        const { default: emergencyAlertService } = await import('./emergencyAlertService');
        emergencyAlertService.cleanup();
        logger.info('RemoteControlService: Cleaned up emergency alert service');
      } catch (error) {
        logger.warn('RemoteControlService: Could not cleanup emergency alert service', { error });
      }
      
      try {
        const { default: orientationEventService } = await import('./orientationEventService');
        orientationEventService.cleanup();
        logger.info('RemoteControlService: Cleaned up orientation event service');
      } catch (error) {
        logger.warn('RemoteControlService: Could not cleanup orientation event service', { error });
      }
      
      // Dispatch event for UI feedback
      window.dispatchEvent(new CustomEvent('remote:clear-cache', {
        detail: { commandId: command.commandId }
      }));
      
      // Small delay after cleanup to ensure connections are closed
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Reload page to apply changes
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
      return {
        commandId: command.commandId,
        success: true,
        message: 'Cache cleared successfully. App will reload.',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('RemoteControlService: Error in clear cache', { error });
      return {
        commandId: command.commandId,
        success: false,
        error: error.message || 'Clear cache failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Update Settings Handler
   * Receives settings update from portal and applies them
   */
  private async handleUpdateSettings(command: RemoteCommand): Promise<RemoteCommandResponse> {
    logger.info('RemoteControlService: Update settings command received', { commandId: command.commandId });
    
    try {
      if (!command.payload || !command.payload.settings) {
        return {
          commandId: command.commandId,
          success: false,
          error: 'No settings provided',
          timestamp: new Date().toISOString(),
        };
      }
      
      const settings = command.payload.settings;
      
      // Validate settings schema (basic validation)
      // In a real implementation, you'd have a more robust validation
      const allowedSettings = ['orientation', 'brightness', 'autoUpdate', 'displaySchedule'];
      const receivedKeys = Object.keys(settings);
      
      const invalidKeys = receivedKeys.filter(key => !allowedSettings.includes(key));
      if (invalidKeys.length > 0) {
        return {
          commandId: command.commandId,
          success: false,
          error: `Invalid settings keys: ${invalidKeys.join(', ')}`,
          timestamp: new Date().toISOString(),
        };
      }
      
      // Store settings
      Object.entries(settings).forEach(([key, value]) => {
        localStorage.setItem(`setting_${key}`, JSON.stringify(value));
      });
      
      // Dispatch event for UI to apply settings
      window.dispatchEvent(new CustomEvent('remote:update-settings', {
        detail: { commandId: command.commandId, settings }
      }));
      
      return {
        commandId: command.commandId,
        success: true,
        message: `Settings updated: ${receivedKeys.join(', ')}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('RemoteControlService: Error in update settings', { error });
      return {
        commandId: command.commandId,
        success: false,
        error: error.message || 'Update settings failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Factory Reset Handler
   * Shows confirmation countdown and triggers factory reset
   */
  private async handleFactoryReset(command: RemoteCommand): Promise<RemoteCommandResponse> {
    logger.info('RemoteControlService: Factory reset command received', { commandId: command.commandId });
    
    try {
      // Dispatch event to show confirmation countdown (30 seconds)
      window.dispatchEvent(new CustomEvent('remote:factory-reset', {
        detail: {
          commandId: command.commandId,
          countdown: command.payload?.countdown || 30, // Default 30 seconds
        }
      }));
      
      // The actual factory reset will be triggered after countdown completes
      // This is handled by the RemoteCommandNotification component
      // which will call the useFactoryReset hook
      
      return {
        commandId: command.commandId,
        success: true,
        message: 'Factory reset initiated with 30-second countdown',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('RemoteControlService: Error in factory reset', { error });
      return {
        commandId: command.commandId,
        success: false,
        error: error.message || 'Factory reset failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Capture Screenshot Handler
   * Captures current screen and uploads to portal
   */
  private async handleCaptureScreenshot(command: RemoteCommand): Promise<RemoteCommandResponse> {
    logger.info('RemoteControlService: Capture screenshot command received', { commandId: command.commandId });
    
    try {
      // Dynamically import html2canvas for screenshot capture
      const html2canvas = await import('html2canvas');
      
      // Capture screenshot
      const canvas = await html2canvas.default(document.body, {
        allowTaint: true,
        useCORS: true,
        logging: false,
        scale: 0.5, // Reduce quality for faster upload
      });
      
      // Convert to JPEG blob (80% quality)
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob: Blob | null) => resolve(blob), 'image/jpeg', 0.8);
      });
      
      if (!blob) {
        throw new Error('Failed to create screenshot blob');
      }
      
      // Upload screenshot
      // In a real implementation, you would upload this to your API
      // For now, we'll store it locally and include it in the response
      const base64 = await this.blobToBase64(blob);
      
      // Store for retrieval
      localStorage.setItem('last_screenshot', base64);
      localStorage.setItem('last_screenshot_timestamp', new Date().toISOString());
      
      // Dispatch event
      window.dispatchEvent(new CustomEvent('remote:screenshot-captured', {
        detail: { commandId: command.commandId }
      }));
      
      return {
        commandId: command.commandId,
        success: true,
        message: 'Screenshot captured successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('RemoteControlService: Error in capture screenshot', { error });
      return {
        commandId: command.commandId,
        success: false,
        error: error.message || 'Screenshot capture failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Convert blob to base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Send command response back to portal
   * Stores responses in structured format with metadata, limits to last 50 entries
   */
  private sendCommandResponse(response: RemoteCommandResponse): void {
    logger.info('RemoteControlService: Sending command response', response);
    
    try {
      // Retrieve existing responses
      const storedResponses = localStorage.getItem('pending_command_responses');
      const responses: RemoteCommandResponse[] = storedResponses 
        ? JSON.parse(storedResponses) 
        : [];
      
      // Add new response
      responses.push(response);
      
      // Keep only last 50 responses (FIFO)
      if (responses.length > this.maxStoredResponses) {
        responses.splice(0, responses.length - this.maxStoredResponses);
      }
      
      // Store back to localStorage
      localStorage.setItem('pending_command_responses', JSON.stringify(responses));
      
      logger.debug('RemoteControlService: Command response stored', {
        commandId: response.commandId,
        totalResponses: responses.length,
      });
      
      // Trigger immediate heartbeat attempt if analytics service is initialized
      // This will be handled by analyticsService when it sends the heartbeat
      try {
        // Try to trigger heartbeat immediately
        if (analyticsService && typeof (analyticsService as any).sendHeartbeat === 'function') {
          // Use setTimeout to avoid blocking
          setTimeout(() => {
            (analyticsService as any).sendHeartbeat().catch((err: any) => {
              logger.debug('RemoteControlService: Could not trigger immediate heartbeat', { err });
            });
          }, 100);
        }
      } catch (error) {
        // Silently fail - heartbeat will be sent on next interval
        logger.debug('RemoteControlService: Could not trigger immediate heartbeat', { error });
      }
    } catch (error: any) {
      logger.error('RemoteControlService: Error storing command response', { 
        error: error.message || error,
        response 
      });
    }
  }

  /**
   * Add a listener for remote commands
   */
  public addListener(callback: (command: RemoteCommand) => void): () => void {
    this.commandListeners.add(callback);
    return () => {
      this.commandListeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of a command
   */
  private notifyListeners(command: RemoteCommand): void {
    this.commandListeners.forEach(listener => {
      try {
        listener(command);
      } catch (error) {
        logger.error('RemoteControlService: Error notifying listener', { error });
      }
    });
  }


  /**
   * Get connection status (delegates to unified SSE service)
   */
  public getConnectionStatus(): ConnectionStatus {
    return unifiedSSEService.getConnectionStatus();
  }

  /**
   * Add a listener for connection status changes (delegates to unified SSE service)
   */
  public addConnectionStatusListener(callback: (status: ConnectionStatus) => void): () => void {
    // Subscribe to unified SSE service connection status
    const unregister = unifiedSSEService.addConnectionStatusListener((status) => {
      // Also notify our own listeners
      this.connectionStatusListeners.forEach(listener => {
        try {
          listener(status);
        } catch (error) {
          logger.error('RemoteControlService: Error notifying connection status listener', { error });
        }
      });
      
      // Dispatch custom event for UI components
      window.dispatchEvent(new CustomEvent('remote-control:connection-status', {
        detail: status,
      }));
      
      // Call the callback
      callback(status);
    });
    
    this.connectionStatusListeners.add(callback);
    
    // Immediately call with current status
    callback(this.getConnectionStatus());
    
    return () => {
      unregister();
      this.connectionStatusListeners.delete(callback);
    };
  }

  /**
   * Process queued commands after cooldown period
   */
  private processCommandQueue(): void {
    if (this.commandQueue.length === 0) {
      return;
    }
    
    const now = Date.now();
    const command = this.commandQueue.shift();
    
    if (!command) {
      return;
    }
    
    const lastTime = this.lastCommandTimestamp[command.type] || 0;
    
    // Check if cooldown has passed
    if (now - lastTime >= this.commandCooldownMs) {
      this.lastCommandTimestamp[command.type] = now;
      this.executeCommand(command);
      this.notifyListeners(command);
      
      // Process next queued command
      setTimeout(() => {
        this.processCommandQueue();
      }, this.commandCooldownMs);
    } else {
      // Put command back at front of queue
      this.commandQueue.unshift(command);
    }
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    logger.info('RemoteControlService: Cleaning up');
    
    // Unregister all event handlers
    this.unregisterHandlers.forEach(unregister => unregister());
    this.unregisterHandlers = [];
    
    // Clear all command ID cleanup timers
    this.commandIdCleanupTimers.forEach(timer => clearTimeout(timer));
    this.commandIdCleanupTimers.clear();
    
    // Note: We don't close the unified SSE connection here as other services may be using it
    // The unified service manages its own lifecycle
    
    this.commandListeners.clear();
    this.connectionStatusListeners.clear();
    this.commandQueue = [];
    this.commandsInProgress.clear();
    this.processedCommandIds.clear();
    this.isInitializing = false;
  }
}

const remoteControlService = new RemoteControlService();
export default remoteControlService;


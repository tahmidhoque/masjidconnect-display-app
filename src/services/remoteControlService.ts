/**
 * Remote Control Service
 * 
 * Handles SSE events from the admin portal for remote device management.
 * Supports commands: FORCE_UPDATE, RESTART_APP, RELOAD_CONTENT, CLEAR_CACHE,
 * UPDATE_SETTINGS, FACTORY_RESET, CAPTURE_SCREENSHOT
 */

import logger from '../utils/logger';
import { DebugEventSource } from '../utils/debugEventSource';
import masjidDisplayClient from '../api/masjidDisplayClient';
import updateService from './updateService';
import storageService from './storageService';
import localforage from 'localforage';

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
}

class RemoteControlService {
  private eventSource: EventSource | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 5000; // 5 seconds
  private commandListeners: Set<(command: RemoteCommand) => void> = new Set();
  private connectionUrl: string | null = null;
  private lastCommandTimestamp: Record<string, number> = {};
  private commandCooldownMs = 2000; // 2 seconds cooldown between commands

  /**
   * Initialize the SSE connection for remote control
   */
  public initialize(baseURL: string): void {
    logger.info('RemoteControlService: Initializing', { baseURL });
    console.log('🎮 RemoteControlService: Initializing with baseURL:', baseURL);
    
    this.connectToEventSource(baseURL);
  }

  /**
   * Connect to the SSE endpoint for remote commands
   */
  private connectToEventSource(baseURL: string): void {
    try {
      // Close existing connection if any
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      
      // Get credentials for authentication
      const credentials = this.getCredentials();
      
      // Use the SSE endpoint (same as emergency alerts)
      const endpoint = '/api/sse';
      
      // Build URL with authentication parameters
      let connectionUrl = `${baseURL}${endpoint}`;
      
      if (credentials && credentials.screenId) {
        const params = new URLSearchParams();
        params.append('screenId', credentials.screenId);
        
        if (credentials.apiKey) {
          params.append('apiKey', credentials.apiKey);
        }
        
        connectionUrl = `${connectionUrl}?${params.toString()}`;
        
        logger.info(`RemoteControlService: Connecting to SSE with authentication`, {
          hasScreenId: !!credentials.screenId,
          hasApiKey: !!credentials.apiKey
        });
        console.log(`🎮 RemoteControlService: Connecting to SSE with screenId: ${credentials.screenId}`);
      } else {
        logger.warn('RemoteControlService: No credentials available for SSE connection');
        console.warn('🎮 RemoteControlService: Connecting to SSE without credentials');
      }
      
      this.connectionUrl = connectionUrl;
      
      logger.info(`RemoteControlService: Connecting to SSE at ${this.connectionUrl}`);
      
      // Create a new EventSource
      let eventSource: EventSource;
      if (process.env.NODE_ENV === 'development') {
        eventSource = new DebugEventSource(this.connectionUrl, {
          withCredentials: true,
        }) as unknown as EventSource;
      } else {
        eventSource = new EventSource(this.connectionUrl, {
          withCredentials: true,
        });
      }
      
      this.eventSource = eventSource;
      
      // Setup event listeners for remote commands
      this.setupEventListeners(eventSource);
      
      // Handle open event
      eventSource.onopen = this.handleConnectionOpen;
      
      // Handle error events
      eventSource.onerror = (error) => {
        console.error('🎮 RemoteControlService: SSE connection error:', error);
        this.handleConnectionError(error);
      };
    } catch (error) {
      logger.error('RemoteControlService: Error connecting to SSE', { error });
      console.error('🎮 RemoteControlService: Error connecting to SSE:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Set up event listeners for remote command events
   */
  private setupEventListeners(eventSource: EventSource): void {
    // Listen for each type of remote command
    Object.values(REMOTE_COMMAND_TYPES).forEach(commandType => {
      eventSource.addEventListener(commandType, this.handleRemoteCommand);
    });
    
    // Also listen for generic 'remote_command' event
    eventSource.addEventListener('remote_command', this.handleRemoteCommand);
    eventSource.addEventListener('remoteCommand', this.handleRemoteCommand);
  }

  /**
   * Get credentials for authentication
   */
  private getCredentials() {
    try {
      const apiKey = localStorage.getItem('masjid_api_key') || localStorage.getItem('apiKey');
      const screenId = localStorage.getItem('masjid_screen_id') || localStorage.getItem('screenId');
      
      if (apiKey && screenId) {
        return { apiKey, screenId };
      }
      
      return null;
    } catch (error) {
      logger.error('RemoteControlService: Error getting credentials', { error });
      return null;
    }
  }

  /**
   * Handle successful connection
   */
  private handleConnectionOpen = (): void => {
    this.reconnectAttempts = 0;
    logger.info('RemoteControlService: SSE connection established');
    console.log('🎮 RemoteControlService: SSE connection established!');
  };

  /**
   * Handle connection errors
   */
  private handleConnectionError = (error: Event): void => {
    logger.error('RemoteControlService: SSE connection error', { error });
    console.error('🎮 RemoteControlService: SSE connection error:', error);
    
    // Clean up existing connection
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.scheduleReconnect();
  };

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn('RemoteControlService: Maximum reconnect attempts reached');
      return;
    }

    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      60000 // Max 1 minute
    ) * (0.8 + Math.random() * 0.4); // Add 20% jitter

    logger.info(`RemoteControlService: Scheduling reconnect in ${delay / 1000}s (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimeout = setTimeout(() => {
      if (this.eventSource) {
        this.eventSource.close();
      }
      this.reconnectAttempts++;
      
      const baseURL = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000' 
        : (process.env.REACT_APP_API_URL || 'https://api.masjid.app');
        
      this.connectToEventSource(baseURL);
    }, delay);
  }

  /**
   * Handle a remote command event
   */
  private handleRemoteCommand = (event: MessageEvent): void => {
    console.log('🎮 RemoteControlService: Remote command received:', event.data);
    
    try {
      let commandData: RemoteCommand;
      
      // Try to parse the data
      if (typeof event.data === 'string') {
        commandData = JSON.parse(event.data) as RemoteCommand;
      } else {
        commandData = event.data as RemoteCommand;
      }
      
      // Validate command
      if (!commandData || !commandData.type || !commandData.commandId) {
        console.error('🎮 RemoteControlService: Invalid command format:', commandData);
        return;
      }
      
      // Check cooldown to prevent command spam
      const now = Date.now();
      const lastTime = this.lastCommandTimestamp[commandData.type] || 0;
      
      if (now - lastTime < this.commandCooldownMs) {
        logger.warn('RemoteControlService: Command throttled', {
          type: commandData.type,
          cooldown: this.commandCooldownMs,
        });
        return;
      }
      
      this.lastCommandTimestamp[commandData.type] = now;
      
      // Execute command
      this.executeCommand(commandData);
      
      // Notify listeners
      this.notifyListeners(commandData);
    } catch (error) {
      console.error('🎮 RemoteControlService: Error parsing command data:', error);
    }
  };

  /**
   * Execute a remote command
   */
  private async executeCommand(command: RemoteCommand): Promise<void> {
    logger.info('RemoteControlService: Executing command', {
      type: command.type,
      commandId: command.commandId,
    });
    
    let response: RemoteCommandResponse;
    
    try {
      switch (command.type) {
        case REMOTE_COMMAND_TYPES.FORCE_UPDATE:
          response = await this.handleForceUpdate(command);
          break;
          
        case REMOTE_COMMAND_TYPES.RESTART_APP:
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
          };
      }
      
      // Send response back to portal via heartbeat or analytics
      this.sendCommandResponse(response);
    } catch (error: any) {
      logger.error('RemoteControlService: Error executing command', { error, command });
      
      response = {
        commandId: command.commandId,
        success: false,
        error: error.message || 'Command execution failed',
        timestamp: new Date().toISOString(),
      };
      
      this.sendCommandResponse(response);
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
      // Check for updates
      const currentVersion = updateService.getCurrentVersion();
      const updateCheck = await masjidDisplayClient.checkForUpdate(currentVersion);
      
      if (!updateCheck.success || !updateCheck.data) {
        return {
          commandId: command.commandId,
          success: false,
          error: 'Failed to check for updates',
          timestamp: new Date().toISOString(),
        };
      }
      
      if (!updateCheck.data.updateAvailable) {
        return {
          commandId: command.commandId,
          success: true,
          message: 'No update available, already on latest version',
          timestamp: new Date().toISOString(),
        };
      }
      
      // Trigger update check and download
      await updateService.checkForUpdates();
      
      // Dispatch custom event for UI to show update notification
      window.dispatchEvent(new CustomEvent('remote:force-update', {
        detail: { commandId: command.commandId }
      }));
      
      return {
        commandId: command.commandId,
        success: true,
        message: `Update available: ${updateCheck.data.latestVersion?.version}. Download initiated.`,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('RemoteControlService: Error in force update', { error });
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
      
      // Clear localStorage (except credentials)
      const preserveKeys = [
        'masjid_api_key',
        'masjid_screen_id',
        'apiKey',
        'screenId',
        'device_id',
        'masjidconnect_credentials',
        'isPaired',
      ];
      
      Object.keys(localStorage).forEach(key => {
        if (!preserveKeys.includes(key)) {
          localStorage.removeItem(key);
        }
      });
      logger.info('Cleared localStorage (preserved credentials)');
      
      // Clear service worker cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        logger.info('Cleared service worker caches');
      }
      
      // Invalidate API caches
      masjidDisplayClient.invalidateAllCaches();
      
      // Dispatch event for UI feedback
      window.dispatchEvent(new CustomEvent('remote:clear-cache', {
        detail: { commandId: command.commandId }
      }));
      
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
   */
  private sendCommandResponse(response: RemoteCommandResponse): void {
    logger.info('RemoteControlService: Sending command response', response);
    
    // Store response in local storage for next heartbeat
    try {
      const responses = JSON.parse(localStorage.getItem('pending_command_responses') || '[]');
      responses.push(response);
      localStorage.setItem('pending_command_responses', JSON.stringify(responses));
    } catch (error) {
      logger.error('RemoteControlService: Error storing command response', { error });
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
   * Get connection status
   */
  public getConnectionStatus(): { connected: boolean, url: string | null, readyState: number | null } {
    return {
      connected: this.eventSource !== null && this.eventSource.readyState === 1,
      url: this.connectionUrl,
      readyState: this.eventSource ? this.eventSource.readyState : null
    };
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    logger.info('RemoteControlService: Cleaning up');
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.commandListeners.clear();
  }
}

const remoteControlService = new RemoteControlService();
export default remoteControlService;


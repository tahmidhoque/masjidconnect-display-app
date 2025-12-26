/**
 * WebSocket Service
 * 
 * Socket.io client for real-time bidirectional communication.
 * Handles connection, authentication, reconnection, and event handling.
 * 
 * Features:
 * - Automatic authentication on connect
 * - Exponential backoff reconnection
 * - Event subscription system
 * - Heartbeat via WebSocket
 * - Command acknowledgement
 */

import { io, Socket } from 'socket.io-client';
import credentialService from './credentialService';
import environment from '../config/environment';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

/**
 * Emergency alert from server
 */
export interface EmergencyAlert {
  id: string;
  title: string;
  message: string;
  type: 'emergency' | 'warning' | 'info';
  priority: number;
  createdAt: string;
  expiresAt?: string;
}

/**
 * Remote command from server
 */
export interface RemoteCommand {
  id: string;
  type: CommandType;
  payload?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Command types
 */
export type CommandType =
  | 'RESTART_APP'
  | 'RELOAD_CONTENT'
  | 'CLEAR_CACHE'
  | 'UPDATE_ORIENTATION'
  | 'REFRESH_PRAYER_TIMES'
  | 'DISPLAY_MESSAGE'
  | 'REBOOT_DEVICE'
  | 'CAPTURE_SCREENSHOT'
  | 'UPDATE_SETTINGS'
  | 'FORCE_UPDATE'
  | 'FACTORY_RESET';

/**
 * Orientation change event
 */
export interface OrientationChange {
  orientation: 'landscape' | 'portrait';
  source: string;
}

/**
 * Display status for heartbeat
 */
export interface DisplayStatus {
  status: 'online' | 'offline' | 'error';
  appVersion: string;
  currentView?: string;
  uptime?: number;
  memoryUsage?: number;
}

/**
 * Event listener types
 */
export type WebSocketEventType =
  | 'connect'
  | 'disconnect'
  | 'reconnect'
  | 'error'
  | 'emergency:alert'
  | 'emergency:clear'
  | 'command'
  | 'orientation:change'
  | 'content:update'
  | 'prayer-times:update';

export type WebSocketEventListener<T = unknown> = (data: T) => void;

// ============================================================================
// WebSocket Service Class
// ============================================================================

class WebSocketService {
  private socket: Socket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private maxReconnectDelay: number = 30000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private listeners: Map<WebSocketEventType, Set<WebSocketEventListener>> = new Map();
  private isIntentionalDisconnect: boolean = false;

  constructor() {
    logger.info('[WebSocketService] Created');
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  /**
   * Connect to the WebSocket server
   */
  public connect(): void {
    if (this.socket?.connected) {
      logger.debug('[WebSocketService] Already connected');
      return;
    }

    // Check credentials
    const credentials = credentialService.getCredentials();
    if (!credentials) {
      logger.error('[WebSocketService] Cannot connect: No credentials');
      this.setConnectionState('error');
      return;
    }

    if (!credentials.masjidId) {
      logger.warn('[WebSocketService] Missing masjidId - WebSocket may not authenticate properly');
    }

    this.isIntentionalDisconnect = false;
    this.setConnectionState('connecting');

    const serverUrl = environment.realtimeUrl;
    const authToken = environment.authToken;
    
    logger.info('[WebSocketService] Connecting to', { 
      serverUrl,
      screenId: credentials.screenId,
      masjidId: credentials.masjidId,
      hasAuthToken: !!authToken,
    });

    // Create socket with auth
    // Note: WebSocket uses a separate auth token from env, not the API key
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: false, // We handle reconnection ourselves
      timeout: 10000,
      auth: {
        type: 'display',
        screenId: credentials.screenId,
        masjidId: credentials.masjidId || '',
        token: authToken, // Use auth token from environment, not API key
      },
    });

    this.setupSocketListeners();
  }

  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    this.isIntentionalDisconnect = true;
    this.stopHeartbeat();

    if (this.socket) {
      logger.info('[WebSocketService] Disconnecting');
      this.socket.disconnect();
      this.socket = null;
    }

    this.setConnectionState('disconnected');
    this.reconnectAttempts = 0;
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.isIntentionalDisconnect) {
      logger.debug('[WebSocketService] Skipping reconnect - intentional disconnect');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[WebSocketService] Max reconnect attempts reached');
      this.setConnectionState('error');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    logger.info('[WebSocketService] Reconnecting', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay,
    });

    this.setConnectionState('reconnecting');

    setTimeout(() => {
      if (!this.isIntentionalDisconnect) {
        // Clean up old socket
        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket = null;
        }
        this.connect();
      }
    }, delay);
  }

  /**
   * Set connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState): void {
    const previousState = this.connectionState;
    this.connectionState = state;

    if (previousState !== state) {
      logger.debug('[WebSocketService] Connection state changed', {
        from: previousState,
        to: state,
      });

      // Emit state change events
      if (state === 'connected') {
        this.emitEvent('connect', null);
      } else if (state === 'disconnected') {
        this.emitEvent('disconnect', null);
      } else if (state === 'reconnecting') {
        this.emitEvent('reconnect', { attempt: this.reconnectAttempts });
      }
    }
  }

  // ==========================================================================
  // Socket Event Listeners
  // ==========================================================================

  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      logger.info('[WebSocketService] Connected', { socketId: this.socket?.id });
      this.reconnectAttempts = 0;
      this.setConnectionState('connected');
      this.startHeartbeat();
    });

    this.socket.on('disconnect', (reason: string) => {
      logger.info('[WebSocketService] Disconnected', { reason });
      this.stopHeartbeat();
      this.setConnectionState('disconnected');

      if (!this.isIntentionalDisconnect) {
        this.attemptReconnect();
      }
    });

    this.socket.on('connect_error', (error: Error) => {
      logger.error('[WebSocketService] Connection error', { error: error.message });
      this.setConnectionState('error');

      if (!this.isIntentionalDisconnect) {
        this.attemptReconnect();
      }
    });

    // Server confirms connection
    this.socket.on('display:connected', (data: Record<string, unknown>) => {
      logger.info('[WebSocketService] Server confirmed connection', data);
    });

    // Emergency alerts
    this.socket.on('EMERGENCY_ALERT', (alert: EmergencyAlert) => {
      logger.info('[WebSocketService] Emergency alert received', { id: alert.id, type: alert.type });
      this.emitEvent('emergency:alert', alert);
    });

    this.socket.on('emergency:clear', () => {
      logger.info('[WebSocketService] Emergency cleared');
      this.emitEvent('emergency:clear', null);
    });

    // Orientation changes
    this.socket.on('SCREEN_ORIENTATION', (data: OrientationChange) => {
      logger.info('[WebSocketService] Orientation change', data);
      this.emitEvent('orientation:change', data);
    });

    // Remote commands - listen for various command types
    const commandTypes: CommandType[] = [
      'RESTART_APP',
      'RELOAD_CONTENT',
      'CLEAR_CACHE',
      'UPDATE_ORIENTATION',
      'REFRESH_PRAYER_TIMES',
      'DISPLAY_MESSAGE',
      'REBOOT_DEVICE',
      'CAPTURE_SCREENSHOT',
      'UPDATE_SETTINGS',
      'FORCE_UPDATE',
      'FACTORY_RESET',
    ];

    commandTypes.forEach((type) => {
      this.socket?.on(`screen:command:${type}`, (command: RemoteCommand) => {
        logger.info('[WebSocketService] Command received', { type, id: command.id });
        this.emitEvent('command', { ...command, type });
      });
    });

    // Generic command handler
    this.socket.on('screen:command', (command: RemoteCommand) => {
      logger.info('[WebSocketService] Generic command received', command);
      this.emitEvent('command', command);
    });

    // Content updates
    this.socket.on('content:update', () => {
      logger.info('[WebSocketService] Content update notification');
      this.emitEvent('content:update', null);
    });

    // Prayer times updates
    this.socket.on('prayer-times:update', () => {
      logger.info('[WebSocketService] Prayer times update notification');
      this.emitEvent('prayer-times:update', null);
    });
  }

  // ==========================================================================
  // Heartbeat
  // ==========================================================================

  private startHeartbeat(): void {
    this.stopHeartbeat();

    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, environment.heartbeatInterval);

    // Send initial heartbeat
    this.sendHeartbeat();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send heartbeat to server
   */
  public sendHeartbeat(status?: DisplayStatus): void {
    if (!this.socket?.connected) {
      logger.debug('[WebSocketService] Cannot send heartbeat - not connected');
      return;
    }

    const heartbeat: DisplayStatus = status || {
      status: 'online',
      appVersion: '1.0.0', // TODO: Get from environment
      uptime: performance.now(),
    };

    this.socket.emit('display:heartbeat', heartbeat);
    logger.debug('[WebSocketService] Heartbeat sent');
  }

  // ==========================================================================
  // Outgoing Messages
  // ==========================================================================

  /**
   * Acknowledge a command
   */
  public acknowledgeCommand(commandId: string, success: boolean = true, message?: string): void {
    if (!this.socket?.connected) {
      logger.warn('[WebSocketService] Cannot acknowledge command - not connected');
      return;
    }

    this.socket.emit('display:command:ack', {
      commandId,
      success,
      message,
      timestamp: new Date().toISOString(),
    });

    logger.debug('[WebSocketService] Command acknowledged', { commandId, success });
  }

  /**
   * Report an error to the server
   */
  public reportError(error: { type: string; message: string; stack?: string }): void {
    if (!this.socket?.connected) {
      logger.warn('[WebSocketService] Cannot report error - not connected');
      return;
    }

    this.socket.emit('display:error', {
      ...error,
      timestamp: new Date().toISOString(),
      screenId: credentialService.getScreenId(),
    });

    logger.debug('[WebSocketService] Error reported', { type: error.type });
  }

  /**
   * Update display status
   */
  public updateStatus(status: Partial<DisplayStatus>): void {
    if (!this.socket?.connected) {
      logger.warn('[WebSocketService] Cannot update status - not connected');
      return;
    }

    this.socket.emit('display:status', {
      ...status,
      timestamp: new Date().toISOString(),
    });

    logger.debug('[WebSocketService] Status updated');
  }

  /**
   * Request a full sync
   */
  public requestSync(): void {
    if (!this.socket?.connected) {
      logger.warn('[WebSocketService] Cannot request sync - not connected');
      return;
    }

    this.socket.emit('display:sync:request');
    logger.info('[WebSocketService] Sync requested');
  }

  // ==========================================================================
  // Event Subscription
  // ==========================================================================

  /**
   * Subscribe to an event
   */
  public on<T = unknown>(event: WebSocketEventType, listener: WebSocketEventListener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(listener as WebSocketEventListener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener as WebSocketEventListener);
    };
  }

  /**
   * Emit an event to all listeners
   */
  private emitEvent<T>(event: WebSocketEventType, data: T): void {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return;

    eventListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (error) {
        logger.error('[WebSocketService] Error in event listener', { event, error });
      }
    });
  }

  // ==========================================================================
  // Status Methods
  // ==========================================================================

  /**
   * Get current connection state
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.connectionState === 'connected' && this.socket?.connected === true;
  }

  /**
   * Get socket ID
   */
  public getSocketId(): string | null {
    return this.socket?.id || null;
  }

  /**
   * Get reconnect attempt count
   */
  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Reset reconnect attempts (call after successful operations)
   */
  public resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
  }
}

// Export singleton instance
const websocketService = new WebSocketService();
export default websocketService;


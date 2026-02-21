/**
 * Realtime Service (Consolidated)
 *
 * Single WebSocket service using Socket.io for real-time communication.
 * Handles: emergency alerts, orientation changes, remote commands,
 * content update notifications, and heartbeat.
 *
 * Uses server contract: screen:command / screen:command:${type}, display:command:ack.
 * Single-socket guard and manual reconnection to avoid multiple connections.
 */

import { io, Socket } from 'socket.io-client';
import credentialService from './credentialService';
import { realtimeUrl, heartbeatInterval } from '../config/environment';
import logger from '../utils/logger';

type EventCallback<T = unknown> = (data: T) => void;

/** Command types the server may send (screen:command:${type}) */
const COMMAND_TYPES = [
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
] as const;

class RealtimeService {
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<EventCallback<any>>>();
  private isConnected = false;
  private isIntentionalDisconnect = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelayMin = 1_000;
  private readonly reconnectDelayMax = 30_000;

  /** Connect to the realtime server. No-op if a socket already exists (connecting or connected). */
  connect(): void {
    if (this.socket !== null) {
      logger.debug('[Realtime] Already have socket (connecting or connected), skip');
      return;
    }

    const credentials = credentialService.getCredentials();
    if (!credentials?.screenId || !credentials?.apiKey) {
      logger.warn('[Realtime] No credentials, cannot connect');
      return;
    }

    this.isIntentionalDisconnect = false;
    const url = realtimeUrl;
    // Use apiKey from paired-credentials (POST /api/screens/paired-credentials). Ids must be strings or server rejects.
    const screenId = String(credentials.screenId);
    const masjidId = String(credentials.masjidId ?? credentialService.getMasjidId() ?? '');
    const token = credentials.apiKey;

    logger.info('[Realtime] Connecting', { url, screenId });

    try {
      this.socket = io(url, {
        auth: {
          type: 'display',
          screenId,
          masjidId,
          token,
        },
        reconnection: false,
        timeout: 20_000,
        transports: ['websocket', 'polling'],
        withCredentials: false,
        upgrade: true,
        path: '/socket.io/',
        autoConnect: true,
      });

      this.setupSocketHandlers();
    } catch (err) {
      logger.error('[Realtime] Connection creation failed', { error: String(err) });
    }
  }

  /** Disconnect from the realtime server */
  disconnect(): void {
    this.isIntentionalDisconnect = true;
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket.removeAllListeners();
      this.socket = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
      logger.info('[Realtime] Disconnected');
    }
  }

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<T = unknown>(event: string, cb: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb as EventCallback<any>);
    return () => this.listeners.get(event)?.delete(cb as EventCallback<any>);
  }

  /**
   * Acknowledge a command to the server.
   * Emits display:command:ack with { commandId, commandType, success, error } per server contract.
   */
  acknowledgeCommand(
    commandId: string,
    success: boolean,
    error?: string,
    commandType?: string,
  ): void {
    this.socket?.emit('display:command:ack', {
      commandId,
      commandType: commandType ?? undefined,
      success,
      error: error ?? null,
    });
  }

  /** Send heartbeat metrics */
  sendHeartbeat(metrics: Record<string, unknown>): void {
    this.socket?.emit('display:heartbeat', { timestamp: new Date().toISOString(), ...metrics });
  }

  /** Check connection status */
  get connected(): boolean {
    return this.isConnected;
  }

  /* ------------------------------------------------------------------ */
  /*  Heartbeat                                                          */
  /* ------------------------------------------------------------------ */

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat({ status: 'online', uptime: performance.now() });
    }, heartbeatInterval);
    this.sendHeartbeat({ status: 'online', uptime: performance.now() });
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Manual reconnection                                                */
  /* ------------------------------------------------------------------ */

  private scheduleReconnect(): void {
    if (this.isIntentionalDisconnect) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[Realtime] Max reconnect attempts reached');
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelayMin * Math.pow(2, this.reconnectAttempts - 1),
      this.reconnectDelayMax,
    );
    logger.info('[Realtime] Reconnecting', { attempt: this.reconnectAttempts, delayMs: delay });
    this.emit('reconnect', { attempt: this.reconnectAttempts });
    setTimeout(() => {
      if (this.isIntentionalDisconnect) return;
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket = null;
      }
      this.isConnected = false;
      this.connect();
    }, delay);
  }

  /* ------------------------------------------------------------------ */
  /*  Internal event wiring                                             */
  /* ------------------------------------------------------------------ */

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info('[Realtime] Connected');
      this.startHeartbeat();
      this.emit('connect', {});
    });

    this.socket.on('disconnect', (reason: string) => {
      this.isConnected = false;
      this.stopHeartbeat();
      logger.info('[Realtime] Disconnected', { reason });
      this.emit('disconnect', { reason });
      this.scheduleReconnect();
    });

    this.socket.on('connect_error', (err: Error) => {
      logger.error('[Realtime] Connection error', { error: err.message });
      this.emit('error', { message: err.message });
      this.scheduleReconnect();
    });

    // Emergency alerts
    this.socket.on('emergency:alert', (data: unknown) => this.emit('emergency:alert', data));
    this.socket.on('emergency:clear', (data: unknown) => this.emit('emergency:clear', data));

    // Screen orientation
    this.socket.on('screen:orientation', (data: unknown) => this.emit('orientation:change', data));

    // Commands: server sends screen:command (generic) and screen:command:${type}
    const forwardCommand = (data: unknown, type?: string) => {
      const payload = data && typeof data === 'object' ? { ...(data as object), type } : { type };
      this.emit('command', payload);
    };
    this.socket.on('screen:command', (data: unknown) => forwardCommand(data));
    for (const type of COMMAND_TYPES) {
      this.socket.on(`screen:command:${type}`, (data: unknown) => forwardCommand(data, type));
    }

    // Content update notifications
    this.socket.on('content:update', (data: unknown) => this.emit('content:update', data));
    this.socket.on('prayer-times:update', (data: unknown) => this.emit('prayer-times:update', data));
  }

  /** Emit to internal listeners (not to the socket) */
  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((cb) => {
      try { cb(data); } catch (err) { logger.error('[Realtime] Listener error', { event, error: String(err) }); }
    });
  }
}

const realtimeService = new RealtimeService();
export default realtimeService;

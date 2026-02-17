/**
 * Realtime Service (Consolidated)
 *
 * Single WebSocket service using Socket.io for real-time communication.
 * Handles: emergency alerts, orientation changes, remote commands,
 * content update notifications, and heartbeat.
 */

import { io, Socket } from 'socket.io-client';
import credentialService from './credentialService';
import { realtimeUrl } from '../config/environment';
import logger from '../utils/logger';

type EventCallback<T = unknown> = (data: T) => void;

class RealtimeService {
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<EventCallback<any>>>();
  private isConnected = false;

  /** Connect to the realtime server */
  connect(): void {
    if (this.socket?.connected) {
      logger.debug('[Realtime] Already connected');
      return;
    }

    const credentials = credentialService.getCredentials();
    if (!credentials?.screenId || !credentials?.apiKey) {
      logger.warn('[Realtime] No credentials, cannot connect');
      return;
    }

    const url = realtimeUrl;
    logger.info('[Realtime] Connecting', { url, screenId: credentials.screenId });

    try {
      this.socket = io(url, {
        auth: {
          type: 'display',
          screenId: credentials.screenId,
          masjidId: credentialService.getMasjidId() || '',
          token: credentials.apiKey,
        },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1_000,
        reconnectionDelayMax: 30_000,
        randomizationFactor: 0.5,
        timeout: 20_000,
        transports: ['polling', 'websocket'],
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
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      logger.info('[Realtime] Disconnected');
    }
  }

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<T = unknown>(event: string, cb: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb as EventCallback<any>);
    return () => this.listeners.get(event)?.delete(cb as EventCallback<any>);
  }

  /** Acknowledge a command to the server */
  acknowledgeCommand(commandId: string, success: boolean, error?: string): void {
    this.socket?.emit('command:acknowledge', { commandId, success, error, timestamp: new Date().toISOString() });
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
  /*  Internal event wiring                                             */
  /* ------------------------------------------------------------------ */

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnected = true;
      logger.info('[Realtime] Connected');
      this.emit('connect', {});
    });

    this.socket.on('disconnect', (reason: string) => {
      this.isConnected = false;
      logger.info('[Realtime] Disconnected', { reason });
      this.emit('disconnect', { reason });
    });

    this.socket.io.on('reconnect_attempt', (attempt: number) => {
      this.emit('reconnect', { attempt });
    });

    this.socket.on('connect_error', (err: Error) => {
      logger.error('[Realtime] Connection error', { error: err.message });
      this.emit('error', { message: err.message });
    });

    // Emergency alerts
    this.socket.on('emergency:alert', (data: unknown) => this.emit('emergency:alert', data));
    this.socket.on('emergency:clear', (data: unknown) => this.emit('emergency:clear', data));

    // Screen orientation
    this.socket.on('screen:orientation', (data: unknown) => this.emit('orientation:change', data));

    // Remote commands
    this.socket.on('remote:command', (data: unknown) => this.emit('command', data));

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

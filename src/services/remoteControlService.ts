/**
 * Remote Control Service
 *
 * Handles remote commands for device management.
 * Commands are received via heartbeat polling or WebSocket.
 */

import logger from '../utils/logger';
import realtimeService from './realtimeService';
import type { RemoteCommand as ApiRemoteCommand } from '../api/models';

export interface RemoteCommand {
  type: string;
  payload?: unknown;
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
  private commandListeners = new Set<(cmd: RemoteCommand) => void>();
  private processedIds = new Set<string>();
  private cooldownMs = 2_000;
  private lastCommandTimestamp: Record<string, number> = {};

  /** Handle a command from heartbeat or WebSocket */
  public async handleCommand(cmd: RemoteCommand | ApiRemoteCommand): Promise<RemoteCommandResponse> {
    const commandId = (cmd as any).commandId || `cmd-${Date.now()}`;
    const type = cmd.type;
    const timestamp = (cmd as any).timestamp || new Date().toISOString();
    const payload = (cmd as any).payload;

    // Deduplicate
    if (this.processedIds.has(commandId)) {
      return { commandId, success: true, message: 'Already processed', timestamp };
    }

    // Cooldown check
    const now = Date.now();
    if (this.lastCommandTimestamp[type] && now - this.lastCommandTimestamp[type] < this.cooldownMs) {
      return { commandId, success: false, message: 'Cooldown active', timestamp };
    }

    this.processedIds.add(commandId);
    this.lastCommandTimestamp[type] = now;

    // Clean old IDs after 60s
    setTimeout(() => this.processedIds.delete(commandId), 60_000);

    logger.info('[RemoteControl] Executing command', { type, commandId });

    try {
      await this.executeCommand(type, payload);
      this.notifyListeners({ type, payload, timestamp, commandId });

      // Acknowledge to backend
      try {
        realtimeService.acknowledgeCommand(commandId, true);
      } catch { /* best effort */ }

      return { commandId, success: true, timestamp: new Date().toISOString() };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error('[RemoteControl] Command failed', { type, error: errMsg });
      return { commandId, success: false, error: errMsg, timestamp: new Date().toISOString() };
    }
  }

  /** Subscribe to incoming commands */
  public onCommand(cb: (cmd: RemoteCommand) => void): () => void {
    this.commandListeners.add(cb);
    return () => this.commandListeners.delete(cb);
  }

  private notifyListeners(cmd: RemoteCommand): void {
    this.commandListeners.forEach((cb) => {
      try { cb(cmd); } catch (err) { logger.error('[RemoteControl] Listener error', { error: String(err) }); }
    });
  }

  private async executeCommand(type: string, payload?: unknown): Promise<void> {
    switch (type) {
      case 'RELOAD_CONTENT':
        window.location.reload();
        break;
      case 'RESTART_APP':
        window.location.reload();
        break;
      case 'CLEAR_CACHE':
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        localStorage.clear();
        window.location.reload();
        break;
      case 'FORCE_UPDATE':
        // Forward to companion service (if available)
        logger.info('[RemoteControl] FORCE_UPDATE requested', { payload: String(payload) });
        break;
      case 'FACTORY_RESET':
        localStorage.clear();
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        window.location.reload();
        break;
      default:
        logger.warn('[RemoteControl] Unknown command type', { type });
    }
  }
}

const remoteControlService = new RemoteControlService();
export default remoteControlService;

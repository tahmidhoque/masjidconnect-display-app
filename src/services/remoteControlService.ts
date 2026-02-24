/**
 * Remote Control Service
 *
 * Handles remote commands for device management.
 * Commands are received via heartbeat polling or WebSocket.
 * Supports delayed restart/reload via payload.countdown (seconds); notifies UI via onScheduledRestart.
 */

import logger from '../utils/logger';
import realtimeService from './realtimeService';
import apiClient from '../api/apiClient';
import { checkAndApplyUpdate } from '../pwa';
import type { RemoteCommand as ApiRemoteCommand } from '../api/models';

export interface RemoteCommand {
  type: string;
  payload?: unknown;
  timestamp: string;
  commandId: string;
}

/** Callback when a delayed restart/reload is scheduled (so UI can show countdown). */
export type OnScheduledRestart = (delaySeconds: number, label: string) => void;

/** Phase from /internal/update-status. */
export type DeviceUpdatePhase =
  | 'checking'
  | 'no_update'
  | 'downloading'
  | 'installing'
  | 'countdown'
  | 'done';

/** Callback to push device update status to Redux (phase, message, restartAt ms). */
export type OnUpdateStatus = (
  phase: DeviceUpdatePhase,
  message: string,
  restartAt: number | null,
) => void;

export interface RemoteCommandResponse {
  commandId: string;
  success: boolean;
  message?: string;
  error?: string;
  timestamp: string;
}

const INTERNAL_BASE = 'http://localhost:3001';
const UPDATE_STATUS_POLL_MS = 1_500;

class RemoteControlService {
  private commandListeners = new Set<(cmd: RemoteCommand) => void>();
  private processedIds = new Set<string>();
  private cooldownMs = 2_000;
  private lastCommandTimestamp: Record<string, number> = {};
  private onScheduledRestart: OnScheduledRestart | null = null;
  private scheduledRestartTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private onUpdateStatus: OnUpdateStatus | null = null;
  private updatePollIntervalId: ReturnType<typeof setInterval> | null = null;

  /** Register callback to show on-screen countdown when a delayed restart/reload is scheduled. */
  public setOnScheduledRestart(cb: OnScheduledRestart | null): void {
    this.onScheduledRestart = cb;
  }

  /** Register callback to push device update status (FORCE_UPDATE flow) to Redux. */
  public setOnUpdateStatus(cb: OnUpdateStatus | null): void {
    this.onUpdateStatus = cb;
  }

  /** Stop polling /internal/update-status (e.g. on logout). */
  public clearDeviceUpdatePolling(): void {
    this.stopUpdatePolling();
  }

  private stopUpdatePolling(): void {
    if (this.updatePollIntervalId) {
      clearInterval(this.updatePollIntervalId);
      this.updatePollIntervalId = null;
    }
  }

  private notifyUpdateStatus(phase: DeviceUpdatePhase, message: string, restartAt: number | null): void {
    try {
      this.onUpdateStatus?.(phase, message, restartAt);
    } catch (err) {
      logger.error('[RemoteControl] onUpdateStatus error', { error: String(err) });
    }
  }

  /** Trigger device update script and poll /internal/update-status until no_update or done. */
  private async triggerDeviceUpdateAndPoll(): Promise<void> {
    this.notifyUpdateStatus('checking', 'Checking for update…', null);
    try {
      const res = await fetch(`${INTERNAL_BASE}/internal/trigger-update`, { method: 'POST' });
      if (res.status !== 202) {
        this.notifyUpdateStatus('no_update', 'Up to date', null);
        return;
      }
    } catch {
      this.notifyUpdateStatus('no_update', 'Up to date', null);
      return;
    }

    const poll = async (): Promise<void> => {
      try {
        const res = await fetch(`${INTERNAL_BASE}/internal/update-status`);
        if (res.status === 204 || res.status === 404) return;
        const data = (await res.json()) as { phase?: string; message?: string; restartAt?: number };
        const phase = (data.phase ?? '') as DeviceUpdatePhase;
        const message = typeof data.message === 'string' ? data.message : '';
        const restartAt = typeof data.restartAt === 'number' ? data.restartAt : null;
        this.notifyUpdateStatus(phase, message, restartAt);
        if (phase === 'no_update' || phase === 'done') {
          this.stopUpdatePolling();
        }
      } catch {
        // ignore
      }
    };

    await poll();
    this.updatePollIntervalId = setInterval(poll, UPDATE_STATUS_POLL_MS);
  }

  /** Cancel any scheduled restart/reload (e.g. on logout). */
  public clearScheduledRestart(): void {
    if (this.scheduledRestartTimeoutId) {
      clearTimeout(this.scheduledRestartTimeoutId);
      this.scheduledRestartTimeoutId = null;
      logger.debug('[RemoteControl] Cleared scheduled restart');
    }
  }

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

  /**
   * Read delay in seconds from command payload (server may send countdown, delaySeconds, or delay).
   */
  private getDelaySeconds(payload: unknown): number {
    if (payload == null || typeof payload !== 'object') return 0;
    const p = payload as Record<string, unknown>;
    const n = p.countdown ?? p.delaySeconds ?? p.delay;
    if (typeof n === 'number' && n > 0) return Math.min(Math.floor(n), 300);
    if (typeof n === 'string') {
      const parsed = parseInt(n, 10);
      if (!Number.isNaN(parsed) && parsed > 0) return Math.min(parsed, 300);
    }
    return 0;
  }

  private scheduleReload(delaySeconds: number, label: string): void {
    if (this.scheduledRestartTimeoutId) {
      clearTimeout(this.scheduledRestartTimeoutId);
      this.scheduledRestartTimeoutId = null;
    }
    const delayMs = delaySeconds * 1_000;
    this.onScheduledRestart?.(delaySeconds, label);
    this.scheduledRestartTimeoutId = setTimeout(() => {
      this.scheduledRestartTimeoutId = null;
      window.location.reload();
    }, delayMs);
    logger.info('[RemoteControl] Scheduled reload', { label, delaySeconds });
  }

  private async executeCommand(type: string, payload?: unknown): Promise<void> {
    const delaySeconds = this.getDelaySeconds(payload);

    switch (type) {
      case 'RELOAD_CONTENT':
        if (delaySeconds > 0) {
          this.scheduleReload(delaySeconds, 'Reloading');
        } else {
          window.location.reload();
        }
        break;
      case 'RESTART_APP':
        if (delaySeconds > 0) {
          this.scheduleReload(delaySeconds, 'Restarting');
        } else {
          window.location.reload();
        }
        break;
      case 'CLEAR_CACHE':
        await apiClient.clearCache();
        logger.info('[RemoteControl] Display content cache cleared; refetch is triggered by middleware');
        break;
      case 'UPDATE_ORIENTATION':
        // Orientation is applied by realtimeMiddleware from command payload (WebSocket + heartbeat).
        break;
      case 'REFRESH_PRAYER_TIMES':
        // Refetch is dispatched by realtimeMiddleware (WebSocket + heartbeat).
        logger.info('[RemoteControl] REFRESH_PRAYER_TIMES: refetch triggered by middleware');
        break;
      case 'UPDATE_SETTINGS':
        // Full content/settings refetch is dispatched by realtimeMiddleware (WebSocket + heartbeat).
        logger.info('[RemoteControl] UPDATE_SETTINGS: refetch triggered by middleware');
        break;
      case 'DISPLAY_MESSAGE':
        // No UI for remote display message in kiosk; acknowledge only.
        logger.info('[RemoteControl] DISPLAY_MESSAGE received (no-op)', { payload });
        break;
      case 'REBOOT_DEVICE':
        logger.warn('[RemoteControl] REBOOT_DEVICE not supported in browser');
        break;
      case 'CAPTURE_SCREENSHOT':
        logger.info('[RemoteControl] CAPTURE_SCREENSHOT not implemented');
        break;
      case 'FORCE_UPDATE':
        logger.info('[RemoteControl] FORCE_UPDATE: triggering device update and PWA check');
        await checkAndApplyUpdate();
        void this.triggerDeviceUpdateAndPoll();
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

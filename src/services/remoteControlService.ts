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
import storageService from './storageService';
import credentialService from './credentialService';
import { isPiPlatform } from '../config/platform';
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
  private isUpdateInProgress = false;

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

  /**
   * Trigger an update check. Used by daily scheduler and FORCE_UPDATE command.
   * Pi: POSTs to /internal/trigger-update (runs update-from-github.sh).
   * Non-Pi (laptop, hosted): Performs a cache-busting hard reload to fetch fresh content,
   * equivalent to Cmd+Shift+R / Ctrl+Shift+R.
   * Re-entry guard: returns immediately if an update flow is already running.
   */
  public triggerUpdateCheck(): void {
    if (this.isUpdateInProgress) {
      logger.debug('[RemoteControl] Update check already in progress, skipping');
      return;
    }
    this.isUpdateInProgress = true;

    if (isPiPlatform) {
      logger.info('[RemoteControl] Daily update check: triggering device update');
      void this.triggerDeviceUpdateAndPoll();
    } else {
      logger.info('[RemoteControl] FORCE_UPDATE on non-Pi: triggering hard reload');
      this.hardReload();
      this.isUpdateInProgress = false;
    }
  }

  /**
   * Cache-busting reload — mimics hard refresh (Cmd+Shift+R).
   * Forces the browser to fetch fresh HTML/JS instead of serving from cache.
   */
  private hardReload(): void {
    const url = new URL(window.location.href);
    url.searchParams.set('_', String(Date.now()));
    window.location.replace(url.toString());
  }

  private stopUpdatePolling(): void {
    if (this.updatePollIntervalId) {
      clearInterval(this.updatePollIntervalId);
      this.updatePollIntervalId = null;
    }
    this.isUpdateInProgress = false;
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
        this.isUpdateInProgress = false;
        return;
      }
    } catch {
      this.notifyUpdateStatus('no_update', 'Up to date', null);
      this.isUpdateInProgress = false;
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
    const raw = cmd as { type?: string; command?: string };
    const type = raw.type ?? raw.command;
    const timestamp = (cmd as any).timestamp || new Date().toISOString();
    const payload = (cmd as any).payload;

    if (!type) {
      logger.warn('[RemoteControl] Command missing type/command', { commandId });
      return { commandId, success: false, error: 'Missing command type', timestamp };
    }

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

  /**
   * Clear all local app storage and reload — same behaviour as remote FACTORY_RESET.
   * Used when the screen no longer exists server-side (e.g. invalid screen token on WebSocket).
   * Unregisters service workers after clearing caches so Workbox is not left controlling the
   * origin with an empty precache (which can yield a blank white page on the next load).
   * Cache API / SW failures must not block navigation.
   */
  public async performFactoryReset(): Promise<void> {
    logger.warn('[RemoteControl] Factory reset — clearing storage and reloading');
    try {
      realtimeService.disconnect();
    } catch (e) {
      logger.warn('[RemoteControl] Disconnect during factory reset failed (continuing)', {
        error: String(e),
      });
    }
    try {
      credentialService.clearCredentials();
    } catch (e) {
      logger.warn('[RemoteControl] credential clear failed (continuing)', { error: String(e) });
    }
    try {
      await storageService.clear();
    } catch (e) {
      logger.warn('[RemoteControl] IndexedDB storage clear failed (continuing)', { error: String(e) });
    }
    try {
      localStorage.clear();
    } catch (e) {
      logger.warn('[RemoteControl] localStorage.clear failed (continuing)', { error: String(e) });
    }
    try {
      sessionStorage.clear();
    } catch (e) {
      logger.warn('[RemoteControl] sessionStorage.clear failed (continuing)', { error: String(e) });
    }
    try {
      if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) {
      logger.warn('[RemoteControl] Cache clear failed during factory reset (continuing)', {
        error: String(e),
      });
    }
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
        logger.info('[RemoteControl] Service workers unregistered for factory reset');
      }
    } catch (e) {
      logger.warn('[RemoteControl] Service worker unregister failed (continuing)', {
        error: String(e),
      });
    }

    /** Same path as current app, no query string — avoids ?_fr= and works with non-root deploys. */
    const nextUrl = `${window.location.origin}${window.location.pathname}`;
    try {
      window.location.replace(nextUrl);
    } catch (e) {
      logger.warn('[RemoteControl] location.replace failed, using reload', { error: String(e) });
      window.location.reload();
    }
  }

  private async executeCommand(type: string, payload?: unknown): Promise<void> {
    const delaySeconds = this.getDelaySeconds(payload);

    switch (type) {
      case 'RELOAD_CONTENT':
        await apiClient.clearCache();
        logger.info('[RemoteControl] RELOAD_CONTENT: cache cleared; refetch is triggered by middleware');
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
        logger.info('[RemoteControl] FORCE_UPDATE: triggering update check');
        this.triggerUpdateCheck();
        break;
      case 'FACTORY_RESET':
        await this.performFactoryReset();
        break;
      default:
        logger.warn('[RemoteControl] Unknown command type', { type });
    }
  }
}

const remoteControlService = new RemoteControlService();
export default remoteControlService;

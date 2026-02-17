/**
 * Emergency Alert Service
 *
 * Manages emergency alert state, persistence, and expiration.
 * Alert events are received via WebSocket through the realtimeMiddleware.
 */

import { EmergencyAlert } from '../api/models';
import logger from '../utils/logger';

const STORAGE_KEY = 'emergency_alert';

class EmergencyAlertService {
  private listeners = new Set<(alert: EmergencyAlert | null) => void>();
  private currentAlert: EmergencyAlert | null = null;
  private expirationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.loadSavedAlert();
  }

  /** Set an emergency alert (called by middleware when WebSocket event received) */
  public setAlert(alertData: EmergencyAlert): void {
    // If action is "clear" or "hide", clear instead
    if ((alertData as any).action === 'clear' || (alertData as any).action === 'hide') {
      this.clearAlert();
      return;
    }

    if (!alertData?.title || !alertData?.message) {
      logger.error('[Emergency] Invalid alert data', { alertData: String(alertData) });
      return;
    }

    if (!alertData.id) alertData.id = `alert-${Date.now()}`;
    if (!alertData.expiresAt) {
      alertData.expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    }

    // Check if already expired
    if (new Date(alertData.expiresAt) <= new Date()) {
      logger.debug('[Emergency] Alert already expired, ignoring');
      return;
    }

    this.currentAlert = alertData;
    this.saveAlert(alertData);
    this.startExpirationTimer(alertData);
    this.notifyListeners(alertData);

    logger.info('[Emergency] Alert set', { id: alertData.id, title: alertData.title });
  }

  /** Clear the current alert */
  public clearAlert(): void {
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }
    this.currentAlert = null;
    this.removeSavedAlert();
    this.notifyListeners(null);
    logger.info('[Emergency] Alert cleared');
  }

  /** Get the currently active alert */
  public getCurrentAlert(): EmergencyAlert | null {
    return this.currentAlert;
  }

  /** Register a listener for alert changes */
  public addListener(cb: (alert: EmergencyAlert | null) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Clean up the service */
  public cleanup(): void {
    if (this.expirationTimer) clearTimeout(this.expirationTimer);
    this.listeners.clear();
    this.currentAlert = null;
  }

  private notifyListeners(alert: EmergencyAlert | null): void {
    this.listeners.forEach((cb) => {
      try { cb(alert); } catch (err) { logger.error('[Emergency] Listener error', { error: String(err) }); }
    });
  }

  private startExpirationTimer(alert: EmergencyAlert): void {
    if (this.expirationTimer) clearTimeout(this.expirationTimer);
    if (!alert.expiresAt) return;

    const ms = new Date(alert.expiresAt).getTime() - Date.now();
    if (ms <= 0) {
      this.clearAlert();
      return;
    }

    this.expirationTimer = setTimeout(() => {
      logger.info('[Emergency] Alert expired', { id: alert.id });
      this.clearAlert();
    }, ms);
  }

  private saveAlert(alert: EmergencyAlert): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(alert)); } catch { /* noop */ }
  }

  private removeSavedAlert(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }

  private loadSavedAlert(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      const alert: EmergencyAlert = JSON.parse(saved);
      if (alert.expiresAt && new Date(alert.expiresAt) > new Date()) {
        this.currentAlert = alert;
        this.startExpirationTimer(alert);
        logger.info('[Emergency] Restored saved alert', { id: alert.id });
      } else {
        this.removeSavedAlert();
      }
    } catch {
      this.removeSavedAlert();
    }
  }
}

const emergencyAlertService = new EmergencyAlertService();
export default emergencyAlertService;

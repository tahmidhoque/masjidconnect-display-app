/**
 * Network Status Service
 *
 * Monitors online/offline state and API reachability.
 * Notifies listeners on status changes.
 */

import { apiUrl } from '../config/environment';
import logger from '../utils/logger';

export interface NetworkStatus {
  isOnline: boolean;
  isApiReachable: boolean;
  lastChecked: string | null;
}

export type NetworkStatusCallback = (status: NetworkStatus) => void;

class NetworkStatusService {
  private callbacks = new Set<NetworkStatusCallback>();
  private status: NetworkStatus = {
    isOnline: navigator.onLine,
    isApiReachable: false,
    lastChecked: null,
  };
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private CHECK_INTERVAL = 30_000; // 30 seconds

  /** Start monitoring network status */
  start(): void {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Initial check
    this.checkApiReachability();

    this.checkInterval = setInterval(() => {
      this.checkApiReachability();
    }, this.CHECK_INTERVAL);

    logger.info('[Network] Monitoring started');
  }

  /** Stop monitoring */
  stop(): void {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /** Subscribe to status changes */
  subscribe(cb: NetworkStatusCallback): () => void {
    this.callbacks.add(cb);
    cb(this.status); // Emit current state immediately
    return () => this.callbacks.delete(cb);
  }

  /** Get current status */
  getStatus(): NetworkStatus {
    return { ...this.status };
  }

  private handleOnline = () => {
    this.update({ isOnline: true });
    this.checkApiReachability();
  };

  private handleOffline = () => {
    this.update({ isOnline: false, isApiReachable: false });
  };

  private async checkApiReachability(): Promise<void> {
    if (!navigator.onLine) {
      this.update({ isOnline: false, isApiReachable: false });
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);

      const resp = await fetch(`${apiUrl}/api/health`, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeout);

      this.update({
        isOnline: true,
        isApiReachable: resp.ok,
        lastChecked: new Date().toISOString(),
      });
    } catch {
      this.update({
        isOnline: navigator.onLine,
        isApiReachable: false,
        lastChecked: new Date().toISOString(),
      });
    }
  }

  private update(partial: Partial<NetworkStatus>): void {
    const prev = { ...this.status };
    this.status = { ...this.status, ...partial };

    // Only notify if something changed
    if (prev.isOnline !== this.status.isOnline || prev.isApiReachable !== this.status.isApiReachable) {
      logger.info('[Network] Status changed', this.status as unknown as Record<string, unknown>);
      this.callbacks.forEach((cb) => cb(this.status));
    }
  }
}

const networkStatusService = new NetworkStatusService();
export default networkStatusService;

/**
 * Metrics Collector
 *
 * Gathers available device and browser metrics for inclusion in WebSocket heartbeat
 * payloads. All metrics are optional — only fields that can actually be read on this
 * device are returned.
 *
 * Sources:
 * - Standard browser APIs (screen, navigator, performance)
 * - Chrome/Chromium non-standard extensions (performance.memory, navigator.connection)
 * - RPi companion service REST API (cpu, temperature, storage) when available
 *
 * This is a pure async utility — it carries no state and can be called freely.
 */

import type { HeartbeatPayload } from '../types/realtime';
import logger from './logger';

// ────────────────────────────────────────────────────────────────────────────
// Browser extension type declarations (non-standard Chrome APIs)
// ────────────────────────────────────────────────────────────────────────────

interface ChromeMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface ChromePerformance extends Performance {
  memory?: ChromeMemory;
}

interface NetworkInformation {
  effectiveType?: string;
  type?: string;
  downlink?: number;
  rtt?: number;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}

// ────────────────────────────────────────────────────────────────────────────
// Companion service REST API types (RPi local service at window.companionService)
// ────────────────────────────────────────────────────────────────────────────

interface CompanionSystemInfo {
  cpuUsage?: number;
  temperature?: number;
  storageUsed?: number;
  memoryUsage?: number;
  powerConsumption?: number;
  ambientLight?: number;
}

const COMPANION_TIMEOUT_MS = 2_000;

/** Fetch RPi hardware metrics from the local companion service if it is available. */
async function fetchCompanionMetrics(): Promise<Partial<CompanionSystemInfo>> {
  const baseUrl = (window as Window).companionService?.baseUrl;
  if (!baseUrl) return {};

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), COMPANION_TIMEOUT_MS);

    const res = await fetch(`${baseUrl}/system-info`, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return {};
    const json = await res.json() as CompanionSystemInfo;
    return json;
  } catch {
    // Companion service not running or request timed out — not an error condition
    return {};
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Collect all available device/browser metrics.
 *
 * @param currentContentId - Optional content ID currently being displayed.
 *   Pass this in from the Redux store if available.
 * @returns A partial HeartbeatPayload (excluding `timestamp`) with only the
 *   fields that could be read on this device.
 */
export async function collectMetrics(
  currentContentId?: string,
): Promise<Omit<HeartbeatPayload, 'timestamp'>> {
  const metrics: Omit<HeartbeatPayload, 'timestamp'> = {
    status: 'ONLINE',
  };

  // Resolution — available on all browsers
  try {
    metrics.resolution = `${screen.width}x${screen.height}`;
  } catch {
    // ignore
  }

  // Memory — Chrome/Chromium only (performance.memory is non-standard)
  try {
    const perf = performance as ChromePerformance;
    if (perf.memory) {
      const { usedJSHeapSize, jsHeapSizeLimit } = perf.memory;
      if (jsHeapSizeLimit > 0) {
        metrics.memoryUsage = Math.round((usedJSHeapSize / jsHeapSizeLimit) * 100);
      }
    }
  } catch {
    // ignore
  }

  // Network info — Chrome/Chromium (navigator.connection)
  try {
    const nav = navigator as NavigatorWithConnection;
    const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
    if (conn) {
      const type = conn.type ?? conn.effectiveType;
      if (type) {
        // Normalise to uppercase for consistency with backend schema
        metrics.connectionType = type.toUpperCase();
      }
      if (conn.rtt !== undefined && conn.rtt > 0) {
        metrics.networkLatency = conn.rtt;
      }
      if (conn.downlink !== undefined && conn.downlink > 0) {
        metrics.bandwidthUsage = conn.downlink;
      }
    }
  } catch {
    // ignore
  }

  // Current content
  if (currentContentId) {
    metrics.currentContent = currentContentId;
  }

  // RPi companion service (cpu, temperature, storage, etc.)
  try {
    const companion = await fetchCompanionMetrics();
    if (companion.cpuUsage !== undefined) metrics.cpuUsage = companion.cpuUsage;
    if (companion.temperature !== undefined) metrics.temperature = companion.temperature;
    if (companion.storageUsed !== undefined) metrics.storageUsed = companion.storageUsed;
    if (companion.memoryUsage !== undefined && metrics.memoryUsage === undefined) {
      // Only override if performance.memory was unavailable
      metrics.memoryUsage = companion.memoryUsage;
    }
    if (companion.powerConsumption !== undefined) metrics.powerConsumption = companion.powerConsumption;
    if (companion.ambientLight !== undefined) metrics.ambientLight = companion.ambientLight;
  } catch (err) {
    logger.debug('[MetricsCollector] Companion metrics unavailable', { error: String(err) });
  }

  return metrics;
}

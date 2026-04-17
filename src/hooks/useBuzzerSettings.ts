/**
 * useBuzzerSettings
 *
 * Local, device-only settings for the jamaat buzzer (enabled + volume).
 * Backed by `localStorage` and exposed via `useSyncExternalStore` so any
 * component that calls this hook re-renders when settings change anywhere
 * (e.g., the settings overlay updates and the buzzer hook picks it up
 * without a remount).
 *
 * Storage key: `mc.buzzer.settings` — JSON `{ enabled: boolean, volume: number }`.
 *   - `enabled` defaults to `true`.
 *   - `volume` is clamped to [0, 1]; defaults to `0.8`.
 *
 * No portal/API involvement — kiosk-local on purpose.
 */

import { useCallback, useSyncExternalStore } from 'react';

export interface BuzzerSettings {
  enabled: boolean;
  volume: number;
}

export interface BuzzerSettingsApi extends BuzzerSettings {
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
}

const STORAGE_KEY = 'mc.buzzer.settings';
const DEFAULTS: BuzzerSettings = { enabled: true, volume: 0.8 };

/**
 * Cached snapshot — must be a stable object reference between writes so
 * `useSyncExternalStore` does not loop. A new object is constructed only
 * inside `write`.
 */
let cached: BuzzerSettings | null = null;
const subscribers = new Set<() => void>();

function clampVolume(v: unknown): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return DEFAULTS.volume;
  return Math.max(0, Math.min(1, v));
}

function readFromStorage(): BuzzerSettings {
  if (typeof localStorage === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<BuzzerSettings> | null;
    return {
      enabled: typeof parsed?.enabled === 'boolean' ? parsed.enabled : DEFAULTS.enabled,
      volume: clampVolume(parsed?.volume),
    };
  } catch {
    return DEFAULTS;
  }
}

function getSnapshot(): BuzzerSettings {
  if (cached === null) cached = readFromStorage();
  return cached;
}

function getServerSnapshot(): BuzzerSettings {
  return DEFAULTS;
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function write(next: BuzzerSettings): void {
  cached = next;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    /* quota / private mode — ignore, in-memory cache still updated */
  }
  subscribers.forEach((cb) => cb());
}

/**
 * React hook returning the live buzzer settings plus setters.
 * Re-renders whenever any consumer (or this hook itself) updates the values.
 */
export function useBuzzerSettings(): BuzzerSettingsApi {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setEnabled = useCallback((enabled: boolean) => {
    write({ ...getSnapshot(), enabled });
  }, []);

  const setVolume = useCallback((volume: number) => {
    write({ ...getSnapshot(), volume: clampVolume(volume) });
  }, []);

  return { enabled: settings.enabled, volume: settings.volume, setEnabled, setVolume };
}

export default useBuzzerSettings;

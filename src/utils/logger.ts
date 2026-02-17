/**
 * Structured Logger
 *
 * Lightweight logging utility with in-memory history and level filtering.
 * Production: only errors and warnings are output to console.
 * Development: all levels are output.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  screenId?: string;
  [key: string]: unknown;
}

const logHistory: LogEntry[] = [];
const MAX_LOG_HISTORY = 100;

const isProd = (): boolean => {
  try {
    return import.meta.env.PROD;
  } catch {
    return true;
  }
};

const shouldLog = (level: LogLevel): boolean => {
  if (!isProd()) return true;
  return level === 'error' || level === 'warn';
};

export function log(
  level: LogLevel,
  message: string,
  data: Record<string, unknown> = {},
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };

  try {
    const screenId = localStorage.getItem('masjid_screen_id');
    if (screenId) entry.screenId = screenId;
  } catch {
    // localStorage may not be available
  }

  const max = isProd() ? 50 : MAX_LOG_HISTORY;
  logHistory.push(entry);
  if (logHistory.length > max) logHistory.shift();

  if (!shouldLog(level)) return;

  const str = JSON.stringify(entry);
  switch (level) {
    case 'debug': console.debug(str); break;
    case 'info':  console.info(str);  break;
    case 'warn':  console.warn(str);  break;
    case 'error':
      console.error(str);
      setLastError(typeof data.error === 'string' ? `${message}: ${data.error}` : message);
      break;
  }
}

export function setLastError(msg: string): void {
  try { localStorage.setItem('masjid_last_error', msg); } catch { /* noop */ }
}

export function getLastError(): string | null {
  try { return localStorage.getItem('masjid_last_error'); } catch { return null; }
}

export function getLogHistory(): LogEntry[] {
  return [...logHistory];
}

export function clearLogHistory(): void {
  logHistory.length = 0;
}

export const debug = (msg: string, data: Record<string, unknown> = {}): void => log('debug', msg, data);
export const info  = (msg: string, data: Record<string, unknown> = {}): void => log('info', msg, data);
export const warn  = (msg: string, data: Record<string, unknown> = {}): void => log('warn', msg, data);
export const error = (msg: string, data: Record<string, unknown> = {}): void => log('error', msg, data);

export default { log, debug, info, warn, error, getLogHistory, clearLogHistory, getLastError, setLastError };

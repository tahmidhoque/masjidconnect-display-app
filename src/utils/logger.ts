// Log levels
export type LogLevel = "debug" | "info" | "warn" | "error";

// Log entry interface
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  screenId?: string;
  [key: string]: any;
}

// In-memory log storage (limited to last 100 entries)
const logHistory: LogEntry[] = [];
const MAX_LOG_HISTORY = 100;

/**
 * Check if we're in production mode
 */
const isProduction = (): boolean => {
  return (
    process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test"
  );
};

/**
 * Check if a log level should be output in the current environment
 * Production: only errors and critical warnings
 * Development: all levels
 */
const shouldLog = (level: LogLevel): boolean => {
  if (!isProduction()) {
    // Development: log everything
    return true;
  }

  // Production: only log errors and warnings
  return level === "error" || level === "warn";
};

/**
 * Structured logging function
 * @param level Log level
 * @param message Log message
 * @param data Additional data to include in the log
 */
export function log(
  level: LogLevel,
  message: string,
  data: Record<string, any> = {},
): void {
  // Create log entry
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };

  // Add screenId if available in localStorage
  const screenId = localStorage.getItem("masjid_screen_id");
  if (screenId) {
    logEntry.screenId = screenId;
  }

  // Always store in history (for debugging purposes, even in production)
  // But limit history size more aggressively in production
  const maxHistory = isProduction() ? 50 : MAX_LOG_HISTORY;
  logHistory.push(logEntry);
  if (logHistory.length > maxHistory) {
    logHistory.shift();
  }

  // Only output to console if log level is appropriate for environment
  if (!shouldLog(level)) {
    return;
  }

  // Output to console with appropriate styling
  const logString = JSON.stringify(logEntry);

  switch (level) {
    case "debug":
      console.debug(`%c${logString}`, "color: gray");
      break;
    case "info":
      console.info(`%c${logString}`, "color: blue");
      break;
    case "warn":
      console.warn(`%c${logString}`, "color: orange");
      break;
    case "error":
      console.error(`%c${logString}`, "color: red");
      // Store last error for heartbeat
      if (typeof data.error === "string") {
        setLastError(`${message}: ${data.error}`);
      } else {
        setLastError(message);
      }
      break;
  }
}

/**
 * Set the last error for heartbeat reporting
 * @param errorMessage Error message
 */
export function setLastError(errorMessage: string): void {
  // Store in localStorage for persistence
  localStorage.setItem("masjid_last_error", errorMessage);
}

/**
 * Get the last error for heartbeat reporting
 * @returns Last error message or null
 */
export function getLastError(): string | null {
  return localStorage.getItem("masjid_last_error");
}

/**
 * Get log history
 * @returns Array of log entries
 */
export function getLogHistory(): LogEntry[] {
  return [...logHistory];
}

/**
 * Clear log history
 */
export function clearLogHistory(): void {
  logHistory.length = 0;
}

// Convenience methods
export const debug = (message: string, data: Record<string, any> = {}): void =>
  log("debug", message, data);
export const info = (message: string, data: Record<string, any> = {}): void =>
  log("info", message, data);
export const warn = (message: string, data: Record<string, any> = {}): void =>
  log("warn", message, data);
export const error = (message: string, data: Record<string, any> = {}): void =>
  log("error", message, data);

export default {
  log,
  debug,
  info,
  warn,
  error,
  getLogHistory,
  clearLogHistory,
  getLastError,
  setLastError,
};

/**
 * Unit tests for logger utility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  log,
  debug,
  info,
  warn,
  error,
  getLogHistory,
  clearLogHistory,
  setLastError,
  getLastError,
} from './logger';

describe('logger', () => {
  let consoleSpy: { debug: ReturnType<typeof vi.spyOn>; info: ReturnType<typeof vi.spyOn>; warn: ReturnType<typeof vi.spyOn>; error: ReturnType<typeof vi.spyOn> };

  beforeEach(() => {
    clearLogHistory();
    try {
      localStorage.removeItem('masjid_last_error');
    } catch {
      // ignore
    }
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    consoleSpy.debug.mockRestore();
    consoleSpy.info.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
    vi.restoreAllMocks();
  });

  describe('log', () => {
    it('pushes entry to history with timestamp and level', () => {
      log('info', 'Test message', { key: 'value' });
      const history = getLogHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ level: 'info', message: 'Test message', key: 'value' });
      expect(history[0].timestamp).toBeDefined();
    });

    it('includes screenId from localStorage when available', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('screen-123');
      log('info', 'Msg');
      const history = getLogHistory();
      expect(history[0].screenId).toBe('screen-123');
    });

    it('handles localStorage unavailable', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage disabled');
      });
      log('info', 'Msg');
      const history = getLogHistory();
      expect(history[0]).toMatchObject({ message: 'Msg' });
      expect(history[0].screenId).toBeUndefined();
    });

    it('calls setLastError with message and data.error when level is error and data.error is string', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
      log('error', 'Something failed', { error: 'Network error' });
      expect(setItemSpy).toHaveBeenCalledWith('masjid_last_error', 'Something failed: Network error');
    });

    it('calls setLastError with message only when level is error and data.error is not string', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
      log('error', 'Something failed', { code: 500 });
      expect(setItemSpy).toHaveBeenCalledWith('masjid_last_error', 'Something failed');
    });
  });

  describe('convenience methods', () => {
    it('debug calls log with debug level', () => {
      debug('Debug msg', { x: 1 });
      expect(getLogHistory()[0]).toMatchObject({ level: 'debug', message: 'Debug msg', x: 1 });
    });

    it('info calls log with info level', () => {
      info('Info msg');
      expect(getLogHistory()[0]).toMatchObject({ level: 'info', message: 'Info msg' });
    });

    it('warn calls log with warn level', () => {
      warn('Warn msg');
      expect(getLogHistory()[0]).toMatchObject({ level: 'warn', message: 'Warn msg' });
    });

    it('error calls log with error level', () => {
      error('Error msg');
      expect(getLogHistory()[0]).toMatchObject({ level: 'error', message: 'Error msg' });
    });
  });

  describe('getLogHistory', () => {
    it('returns a copy of log history', () => {
      log('info', 'One');
      const first = getLogHistory();
      const second = getLogHistory();
      expect(second).not.toBe(first);
      expect(second).toEqual(first);
    });
  });

  describe('clearLogHistory', () => {
    it('clears all entries', () => {
      log('info', 'One');
      log('info', 'Two');
      expect(getLogHistory()).toHaveLength(2);
      clearLogHistory();
      expect(getLogHistory()).toHaveLength(0);
    });
  });

  describe('setLastError / getLastError', () => {
    it('stores and retrieves last error', () => {
      setLastError('Test error message');
      expect(getLastError()).toBe('Test error message');
    });

    it('getLastError returns null when no error set', () => {
      expect(getLastError()).toBeNull();
    });

    it('getLastError returns null when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('unavailable');
      });
      expect(getLastError()).toBeNull();
    });

    it('setLastError no-ops when localStorage throws', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });
      setLastError('Err');
      expect(setItemSpy).toHaveBeenCalled();
    });
  });
});

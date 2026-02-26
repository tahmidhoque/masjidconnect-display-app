/**
 * API endpoints and URL helpers tests.
 */

import { describe, it, expect } from 'vitest';
import {
  PAIRING_ENDPOINTS,
  SCREEN_ENDPOINTS,
  buildUrl,
  buildUrlWithParams,
} from './endpoints';

describe('endpoints', () => {
  describe('PAIRING_ENDPOINTS', () => {
    it('has REQUEST_PAIRING_CODE path', () => {
      expect(PAIRING_ENDPOINTS.REQUEST_PAIRING_CODE).toBe('/api/screens/unpaired');
    });
    it('has CHECK_PAIRING_STATUS path', () => {
      expect(PAIRING_ENDPOINTS.CHECK_PAIRING_STATUS).toBe('/api/screens/check-simple');
    });
  });

  describe('SCREEN_ENDPOINTS', () => {
    it('has HEARTBEAT and GET_CONTENT paths', () => {
      expect(SCREEN_ENDPOINTS.HEARTBEAT).toBe('/api/screen/heartbeat');
      expect(SCREEN_ENDPOINTS.GET_CONTENT).toBe('/api/screen/content');
    });
  });

  describe('buildUrl', () => {
    it('concatenates base and endpoint', () => {
      expect(buildUrl('https://api.test', '/path')).toBe('https://api.test/path');
    });
    it('strips trailing slash from base', () => {
      expect(buildUrl('https://api.test/', '/path')).toBe('https://api.test/path');
    });
    it('adds leading slash to endpoint if missing', () => {
      expect(buildUrl('https://api.test', 'path')).toBe('https://api.test/path');
    });
  });

  describe('buildUrlWithParams', () => {
    it('returns url without query when params empty', () => {
      expect(buildUrlWithParams('https://api.test', '/path', {})).toBe('https://api.test/path');
    });
    it('appends query string for defined params', () => {
      const url = buildUrlWithParams('https://api.test', '/path', { a: '1', b: 2 });
      expect(url).toContain('https://api.test/path?');
      expect(url).toMatch(/a=1/);
      expect(url).toMatch(/b=2/);
    });
    it('filters out undefined params', () => {
      const url = buildUrlWithParams('https://api.test', '/path', {
        a: '1',
        b: undefined,
      });
      expect(url).toBe('https://api.test/path?a=1');
    });
  });
});

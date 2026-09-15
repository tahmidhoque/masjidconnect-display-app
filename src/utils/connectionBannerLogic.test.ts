import { describe, it, expect } from 'vitest';
import {
  shouldSuppressWifiWarning,
  resolveConnectivityBanner,
  isLiveUpdatesPausedStatus,
  LIVE_UPDATES_PAUSED_COPY,
} from './connectionBannerLogic';

const baseWifi = {
  state: 'no-adapter',
  ssid: '',
  signal: 0,
  ip: '',
  hotspotActive: false,
  ethernetConnected: false,
  ethernetIp: '',
};

describe('shouldSuppressWifiWarning', () => {
  it('suppresses when Ethernet is connected (no WiFi adapter)', () => {
    expect(
      shouldSuppressWifiWarning('no-internet', {
        ...baseWifi,
        ethernetConnected: true,
        ethernetIp: '192.168.1.50',
      }),
    ).toBe(true);
  });

  it('suppresses no-adapter warning when app connectivity is healthy', () => {
    expect(shouldSuppressWifiWarning('connected', baseWifi)).toBe(true);
  });

  it('suppresses WiFi warnings while live updates are only paused', () => {
    expect(shouldSuppressWifiWarning('reconnecting', baseWifi)).toBe(true);
    expect(shouldSuppressWifiWarning('server-unreachable', baseWifi)).toBe(true);
  });

  it('shows warning when offline with no Ethernet and no WiFi adapter', () => {
    expect(shouldSuppressWifiWarning('no-internet', baseWifi)).toBe(false);
  });
});

describe('isLiveUpdatesPausedStatus', () => {
  it('treats reconnecting and server-unreachable as the same quiet degraded state', () => {
    expect(isLiveUpdatesPausedStatus('reconnecting')).toBe(true);
    expect(isLiveUpdatesPausedStatus('server-unreachable')).toBe(true);
    expect(isLiveUpdatesPausedStatus('connected')).toBe(false);
    expect(isLiveUpdatesPausedStatus('no-internet')).toBe(false);
  });
});

describe('resolveConnectivityBanner', () => {
  it('returns calm paused copy for reconnecting and unreachable, not panic wording', () => {
    expect(resolveConnectivityBanner('reconnecting', false)).toEqual({
      variant: 'muted',
      message: LIVE_UPDATES_PAUSED_COPY,
    });
    expect(resolveConnectivityBanner('server-unreachable', false)).toEqual({
      variant: 'muted',
      message: LIVE_UPDATES_PAUSED_COPY,
    });
    expect(LIVE_UPDATES_PAUSED_COPY).toBe('Live updates paused');
  });

  it('returns null for the healthy connected state (green dot only)', () => {
    expect(resolveConnectivityBanner('connected', false)).toBeNull();
  });

  it('keeps no-internet as a distinct red state', () => {
    expect(resolveConnectivityBanner('no-internet', false)).toEqual({
      variant: 'red',
      message: 'No Internet',
    });
    expect(resolveConnectivityBanner('no-internet', true)).toEqual({
      variant: 'red',
      message: 'No internet — press Ctrl+Shift+W for WiFi settings',
    });
  });
});

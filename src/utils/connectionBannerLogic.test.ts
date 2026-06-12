import { describe, it, expect } from 'vitest';
import { shouldSuppressWifiWarning } from './connectionBannerLogic';

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

  it('shows warning when offline with no Ethernet and no WiFi adapter', () => {
    expect(shouldSuppressWifiWarning('no-internet', baseWifi)).toBe(false);
  });
});

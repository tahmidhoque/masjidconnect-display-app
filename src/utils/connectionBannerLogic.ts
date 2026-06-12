import type { ConnectionStatusType } from '@/hooks/useConnectionStatus';
import type { UIState } from '@/store/slices/uiSlice';

export type WifiStatusSnapshot = NonNullable<UIState['wifiStatus']>;

/**
 * Ethernet-only or WS-healthy kiosks should not show WiFi adapter/disconnect warnings.
 */
export function shouldSuppressWifiWarning(
  connectionStatus: ConnectionStatusType,
  wifiStatus: WifiStatusSnapshot | null,
): boolean {
  if (wifiStatus?.ethernetConnected) return true;
  return connectionStatus === 'connected'
    || connectionStatus === 'reconnecting'
    || connectionStatus === 'server-unreachable';
}

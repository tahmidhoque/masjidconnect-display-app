import type { ConnectionStatusType } from '@/hooks/useConnectionStatus';
import type { UIState } from '@/store/slices/uiSlice';

export type WifiStatusSnapshot = NonNullable<UIState['wifiStatus']>;

/** Calm copy when the WebSocket is down but persisted content still shows. */
export const LIVE_UPDATES_PAUSED_COPY = 'Live updates paused';

export type ConnectivityBannerVariant = 'muted' | 'red';

export interface ConnectivityBannerPresentation {
  variant: ConnectivityBannerVariant;
  message: string;
}

/**
 * True when the display still has network but live (WebSocket) updates are not flowing.
 * Both reconnecting and unreachable map to the same quiet UI so the banner does not flap.
 */
export function isLiveUpdatesPausedStatus(status: ConnectionStatusType): boolean {
  return status === 'reconnecting' || status === 'server-unreachable';
}

/**
 * Presentation for general connectivity (after update/WiFi-specific states).
 * Returns null when the banner should show the healthy green dot only.
 */
export function resolveConnectivityBanner(
  status: ConnectionStatusType,
  isPi: boolean,
): ConnectivityBannerPresentation | null {
  if (status === 'no-internet' || status === 'no-connection') {
    return {
      variant: 'red',
      message: isPi
        ? 'No internet — press Ctrl+Shift+W for WiFi settings'
        : 'No Internet',
    };
  }

  if (isLiveUpdatesPausedStatus(status)) {
    return {
      variant: 'muted',
      message: LIVE_UPDATES_PAUSED_COPY,
    };
  }

  return null;
}

/**
 * Ethernet-only or WS-healthy kiosks should not show WiFi adapter/disconnect warnings.
 * Live-updates-paused is still "app connectivity is fine" — only live push is off.
 */
export function shouldSuppressWifiWarning(
  connectionStatus: ConnectionStatusType,
  wifiStatus: WifiStatusSnapshot | null,
): boolean {
  if (wifiStatus?.ethernetConnected) return true;
  return connectionStatus === 'connected'
    || isLiveUpdatesPausedStatus(connectionStatus);
}

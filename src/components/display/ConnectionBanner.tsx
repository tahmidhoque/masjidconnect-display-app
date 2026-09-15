/**
 * ConnectionBanner
 *
 * A persistent, colour-coded indicator that shows WiFi and WebSocket
 * connectivity status. Visible on all screens (Loading, Pairing, Display).
 *
 * Two render modes:
 *  - Dot only (no message): a small coloured dot, used for the healthy state
 *    so the user can confirm "all good" at a glance without screen clutter.
 *  - Pill: the full coloured chip (icon + message + tinted background) used
 *    whenever there's something to communicate.
 *
 * States:
 *  - Green (dot only): WiFi + WS connected
 *  - Green (pill): "Up to date" after a successful update check
 *  - Muted: live (WebSocket) updates paused — display still showing saved content
 *  - Orange: weak signal, or update in progress
 *  - Red: WiFi disconnected, no internet, or no adapter
 *  - Blue: hotspot active (user reconfiguring WiFi)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Wifi, WifiOff, AlertTriangle, Radio, Settings, Pause } from 'lucide-react';
import { isPiPlatform } from '../../config/platform';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import { useAppSelector } from '../../store/hooks';
import {
  selectWifiStatus,
  selectPendingRestart,
  selectUpdatePhase,
  selectUpdateMessage,
  selectUpdateRestartAt,
} from '../../store/slices/uiSlice';
import {
  resolveConnectivityBanner,
  shouldSuppressWifiWarning,
} from '../../utils/connectionBannerLogic';
import type { ConnectionStatusType } from '@/hooks/useConnectionStatus';

/** Delay before showing the banner to prevent startup flash */
export const DISPLAY_DELAY_MS = 5_000;

const DEV_BANNER_STATUSES: readonly ConnectionStatusType[] = [
  'connected',
  'reconnecting',
  'server-unreachable',
  'no-internet',
  'no-connection',
];

/**
 * Dev-only `?banner=` override so footer states can be previewed without a live
 * WebSocket. Stripped from production builds.
 */
function readDevBannerOverride(): ConnectionStatusType | null {
  if (!import.meta.env.DEV) return null;
  const value = new URLSearchParams(window.location.search).get('banner');
  return DEV_BANNER_STATUSES.includes(value as ConnectionStatusType)
    ? (value as ConnectionStatusType)
    : null;
}

type BannerVariant = 'green' | 'orange' | 'red' | 'blue' | 'muted';

interface BannerState {
  variant: BannerVariant;
  icon: React.ReactNode;
  message: string;
}

const ConnectionBanner: React.FC = () => {
  const { status: liveStatus } = useConnectionStatus();
  const status = readDevBannerOverride() ?? liveStatus;
  const wifiStatus = useAppSelector(selectWifiStatus);
  const pendingRestart = useAppSelector(selectPendingRestart);
  const updatePhase = useAppSelector(selectUpdatePhase);
  const updateMessage = useAppSelector(selectUpdateMessage);
  const updateRestartAt = useAppSelector(selectUpdateRestartAt);
  const [canShow, setCanShow] = useState(() => readDevBannerOverride() !== null);
  const [updateSecondsLeft, setUpdateSecondsLeft] = useState<number | null>(null);
  const [restartSecondsLeft, setRestartSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setCanShow(true), DISPLAY_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // Update countdown
  useEffect(() => {
    if (updatePhase !== 'countdown' || updateRestartAt == null) {
      setUpdateSecondsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((updateRestartAt - Date.now()) / 1_000));
      setUpdateSecondsLeft(left);
      if (left <= 0) window.location.reload();
    };
    tick();
    const interval = setInterval(tick, 1_000);
    return () => clearInterval(interval);
  }, [updatePhase, updateRestartAt]);

  // Pending restart countdown
  useEffect(() => {
    if (!pendingRestart) {
      setRestartSecondsLeft(null);
      return;
    }
    const tick = () => {
      setRestartSecondsLeft(Math.max(0, Math.ceil((pendingRestart.at - Date.now()) / 1_000)));
    };
    tick();
    const interval = setInterval(tick, 1_000);
    return () => clearInterval(interval);
  }, [pendingRestart]);

  const iconSize = 'w-4 h-4';

  const bannerState = useMemo((): BannerState => {
    // Update/restart states take priority
    if (updatePhase !== 'idle' && updatePhase !== 'done') {
      if (updatePhase === 'countdown' && updateSecondsLeft !== null) {
        return {
          variant: 'orange',
          icon: <Settings className={`${iconSize} animate-spin`} />,
          message: `Restarting in ${updateSecondsLeft}s`,
        };
      }
      if (updatePhase === 'no_update') {
        return { variant: 'green', icon: <Wifi className={iconSize} />, message: 'Up to date' };
      }
      return {
        variant: 'orange',
        icon: <Settings className={`${iconSize} animate-spin`} />,
        message: updateMessage || 'Updating…',
      };
    }

    if (pendingRestart && restartSecondsLeft !== null) {
      return {
        variant: 'orange',
        icon: <Settings className={iconSize} />,
        message: `${pendingRestart.label} in ${restartSecondsLeft}s`,
      };
    }

    // WiFi-specific states (Pi only). Skip when Ethernet or app connectivity is healthy.
    const suppressWifiWarning = shouldSuppressWifiWarning(status, wifiStatus);

    if (isPiPlatform && wifiStatus) {
      if (wifiStatus.hotspotActive) {
        return {
          variant: 'blue',
          icon: <Radio className={iconSize} />,
          message: 'Connect to MasjidConnect-Setup WiFi, open 192.168.4.1',
        };
      }

      if (!suppressWifiWarning && wifiStatus.state === 'no-adapter') {
        return {
          variant: 'red',
          icon: <WifiOff className={iconSize} />,
          message: 'No network adapter detected — connect via Ethernet',
        };
      }

      if (!suppressWifiWarning && (wifiStatus.state === 'disconnected' || wifiStatus.state === 'unavailable')) {
        return {
          variant: 'red',
          icon: <WifiOff className={iconSize} />,
          message: 'WiFi disconnected — press Ctrl+Shift+W for WiFi settings',
        };
      }

      if (!suppressWifiWarning && wifiStatus.signal > 0 && wifiStatus.signal < 30) {
        return {
          variant: 'orange',
          icon: <AlertTriangle className={iconSize} />,
          message: `Weak WiFi signal${wifiStatus.ssid ? ` (${wifiStatus.ssid})` : ''}`,
        };
      }
    }

    // WebSocket / general connectivity states
    const connectivity = resolveConnectivityBanner(status, isPiPlatform);
    if (connectivity) {
      if (connectivity.variant === 'muted') {
        return {
          variant: 'muted',
          icon: <Pause className={iconSize} />,
          message: connectivity.message,
        };
      }
      return {
        variant: 'red',
        icon: <WifiOff className={iconSize} />,
        message: connectivity.message,
      };
    }

    return { variant: 'green', icon: null, message: '' };
  }, [
    status, wifiStatus, updatePhase, updateMessage, updateSecondsLeft,
    pendingRestart, restartSecondsLeft,
  ]);

  if (!canShow) return null;

  const dotColour: Record<BannerVariant, string> = {
    green: 'bg-alert-green',
    orange: 'bg-alert-orange',
    red: 'bg-alert-red',
    blue: 'bg-[#3b82f6]',
    muted: 'bg-text-muted',
  };

  // Dot-only mode: healthy state with nothing to say. Render a small coloured
  // dot so users can confirm connectivity at a glance without screen clutter.
  if (!bannerState.message) {
    const dotLabel: Record<BannerVariant, string> = {
      green: 'Connected',
      orange: 'Connection warning',
      red: 'Disconnected',
      blue: 'WiFi setup mode',
      muted: 'Live updates paused',
    };
    return (
      <span
        className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${dotColour[bannerState.variant]} animate-fade-in`}
        role="status"
        aria-label={dotLabel[bannerState.variant]}
      />
    );
  }

  const bgClass: Record<BannerVariant, string> = {
    green: 'bg-alert-green/15 border-alert-green/30',
    orange: 'bg-alert-orange/15 border-alert-orange/30',
    red: 'bg-alert-red/15 border-alert-red/30',
    blue: 'bg-[#3b82f6]/15 border-[#3b82f6]/30',
    muted: 'bg-surface border-border',
  };

  const textClass: Record<BannerVariant, string> = {
    green: 'text-alert-green',
    orange: 'text-alert-orange',
    red: 'text-alert-red',
    blue: 'text-[#93c5fd]',
    muted: 'text-text-muted',
  };

  const iconColour: Record<BannerVariant, string> = {
    green: 'text-alert-green',
    orange: 'text-alert-orange',
    red: 'text-alert-red',
    blue: 'text-[#93c5fd]',
    muted: 'text-text-muted',
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${bgClass[bannerState.variant]} animate-fade-in`}
      role="status"
      aria-live="polite"
    >
      <span className={iconColour[bannerState.variant]}>{bannerState.icon}</span>
      <span className={`text-caption font-medium truncate ${textClass[bannerState.variant]}`}>
        {bannerState.message}
      </span>
    </div>
  );
};

export default React.memo(ConnectionBanner);

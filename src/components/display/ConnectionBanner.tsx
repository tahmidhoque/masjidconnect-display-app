/**
 * ConnectionBanner
 *
 * A persistent, colour-coded banner that shows WiFi and WebSocket connectivity
 * status. Visible on all screens (Loading, Pairing, Display) but only when
 * there is an issue — hidden when everything is connected.
 *
 * States:
 *  - Green (hidden): WiFi + WS connected
 *  - Orange: reconnecting, weak signal, or update in progress
 *  - Red: WiFi disconnected, no internet, or no adapter
 *  - Blue: hotspot active (user reconfiguring WiFi)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Wifi, WifiOff, AlertTriangle, Radio, Settings } from 'lucide-react';
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

/** Delay before showing the banner to prevent startup flash */
const DISPLAY_DELAY_MS = 5_000;

type BannerVariant = 'hidden' | 'green' | 'orange' | 'red' | 'blue';

interface BannerState {
  variant: BannerVariant;
  icon: React.ReactNode;
  message: string;
}

const ConnectionBanner: React.FC = () => {
  const { status } = useConnectionStatus();
  const wifiStatus = useAppSelector(selectWifiStatus);
  const pendingRestart = useAppSelector(selectPendingRestart);
  const updatePhase = useAppSelector(selectUpdatePhase);
  const updateMessage = useAppSelector(selectUpdateMessage);
  const updateRestartAt = useAppSelector(selectUpdateRestartAt);
  const [canShow, setCanShow] = useState(false);
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

    // WiFi-specific states (Pi only)
    if (isPiPlatform && wifiStatus) {
      if (wifiStatus.hotspotActive) {
        return {
          variant: 'blue',
          icon: <Radio className={iconSize} />,
          message: 'Connect to MasjidConnect-Setup WiFi, open 192.168.4.1',
        };
      }

      if (wifiStatus.state === 'no-adapter') {
        return {
          variant: 'red',
          icon: <WifiOff className={iconSize} />,
          message: 'No WiFi adapter detected. Connect via Ethernet',
        };
      }

      if (wifiStatus.state === 'disconnected' || wifiStatus.state === 'unavailable') {
        return {
          variant: 'red',
          icon: <WifiOff className={iconSize} />,
          message: 'WiFi disconnected — press Ctrl+Shift+W for WiFi settings',
        };
      }

      if (wifiStatus.signal > 0 && wifiStatus.signal < 30) {
        return {
          variant: 'orange',
          icon: <AlertTriangle className={iconSize} />,
          message: `Weak WiFi signal${wifiStatus.ssid ? ` (${wifiStatus.ssid})` : ''}`,
        };
      }
    }

    // WebSocket / general connectivity states
    if (status === 'no-internet' || status === 'no-connection') {
      return {
        variant: 'red',
        icon: <WifiOff className={iconSize} />,
        message: isPiPlatform
          ? 'No internet — press Ctrl+Shift+W for WiFi settings'
          : 'No Internet',
      };
    }

    if (status === 'reconnecting') {
      return {
        variant: 'orange',
        icon: <Wifi className={`${iconSize} animate-subtle-pulse`} />,
        message: 'Reconnecting…',
      };
    }

    if (status === 'server-unreachable') {
      return {
        variant: 'orange',
        icon: <AlertTriangle className={iconSize} />,
        message: 'Server Unreachable',
      };
    }

    return { variant: 'hidden', icon: null, message: '' };
  }, [
    status, wifiStatus, updatePhase, updateMessage, updateSecondsLeft,
    pendingRestart, restartSecondsLeft,
  ]);

  if (!canShow || bannerState.variant === 'hidden') return null;

  const bgClass = {
    green: 'bg-alert-green/15 border-alert-green/30',
    orange: 'bg-alert-orange/15 border-alert-orange/30',
    red: 'bg-alert-red/15 border-alert-red/30',
    blue: 'bg-[#3b82f6]/15 border-[#3b82f6]/30',
    hidden: '',
  }[bannerState.variant];

  const textClass = {
    green: 'text-alert-green',
    orange: 'text-alert-orange',
    red: 'text-alert-red',
    blue: 'text-[#93c5fd]',
    hidden: '',
  }[bannerState.variant];

  const iconColour = {
    green: 'text-alert-green',
    orange: 'text-alert-orange',
    red: 'text-alert-red',
    blue: 'text-[#93c5fd]',
    hidden: '',
  }[bannerState.variant];

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${bgClass} animate-fade-in`}
      role="status"
      aria-live="polite"
    >
      <span className={iconColour}>{bannerState.icon}</span>
      <span className={`text-caption font-medium truncate ${textClass}`}>
        {bannerState.message}
      </span>
    </div>
  );
};

export default React.memo(ConnectionBanner);

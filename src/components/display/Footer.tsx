/**
 * Footer
 *
 * Shows "MasjidConnect" in gold (Masjid bold, Connect regular), connection
 * status, and version. Also shows device update progress (FORCE_UPDATE) or
 * pending restart countdown when active. Uses larger, heavier text for
 * readability at low resolutions.
 */

import React, { useState, useEffect } from 'react';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import {
  selectPendingRestart,
  selectUpdatePhase,
  selectUpdateMessage,
  selectUpdateRestartAt,
  clearUpdateStatus,
} from '../../store/slices/uiSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

/** Delay before showing connection status to prevent startup flash */
const STATUS_DISPLAY_DELAY_MS = 5_000;
/** After showing "Up to date", clear the message after this delay (ms). */
const NO_UPDATE_CLEAR_MS = 8_000;

/** Injected at build time by Vite (from package.json); also available in dev. */
const APP_VERSION = import.meta.env.VITE_APP_VERSION;

const Footer: React.FC = () => {
  const dispatch = useAppDispatch();
  const { status, message } = useConnectionStatus();
  const pendingRestart = useAppSelector(selectPendingRestart);
  const updatePhase = useAppSelector(selectUpdatePhase);
  const updateMessage = useAppSelector(selectUpdateMessage);
  const updateRestartAt = useAppSelector(selectUpdateRestartAt);
  const [canShowStatus, setCanShowStatus] = useState(false);
  const [pendingSecondsLeft, setPendingSecondsLeft] = useState<number | null>(null);
  const [updateSecondsLeft, setUpdateSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setCanShowStatus(true), STATUS_DISPLAY_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Pending restart countdown (from remote command)
  useEffect(() => {
    if (!pendingRestart) {
      setPendingSecondsLeft(null);
      return;
    }
    const tick = () => {
      setPendingSecondsLeft(Math.max(0, Math.ceil((pendingRestart.at - Date.now()) / 1_000)));
    };
    tick();
    const interval = setInterval(tick, 1_000);
    return () => clearInterval(interval);
  }, [pendingRestart]);

  // Device update countdown (FORCE_UPDATE flow)
  useEffect(() => {
    if (updatePhase !== 'countdown' || updateRestartAt == null) {
      setUpdateSecondsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((updateRestartAt - Date.now()) / 1_000));
      setUpdateSecondsLeft(left);
      if (left <= 0) {
        window.location.reload();
      }
    };
    tick();
    const interval = setInterval(tick, 1_000);
    return () => clearInterval(interval);
  }, [updatePhase, updateRestartAt]);

  // Clear "Up to date" after delay
  useEffect(() => {
    if (updatePhase !== 'no_update') return;
    const timer = setTimeout(() => {
      dispatch(clearUpdateStatus());
    }, NO_UPDATE_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [updatePhase, dispatch]);

  const showPendingRestart = pendingRestart && pendingSecondsLeft !== null;
  const showUpdate =
    updatePhase !== 'idle' &&
    updatePhase !== 'done' &&
    (updatePhase !== 'countdown' || updateSecondsLeft !== null);

  const statusMessage = ((): string => {
    if (showUpdate) {
      if (updatePhase === 'countdown' && updateSecondsLeft !== null) {
        return `Restarting in ${updateSecondsLeft}s`;
      }
      return updateMessage || 'Updating…';
    }
    if (showPendingRestart) return `${pendingRestart.label} in ${pendingSecondsLeft}s`;
    return message;
  })();

  const dotColour = ((): string => {
    if (showUpdate) {
      if (updatePhase === 'no_update') return 'bg-alert-green';
      return 'bg-alert-orange';
    }
    if (showPendingRestart) return 'bg-alert-orange';
    if (status === 'connected') return 'bg-alert-green';
    if (status === 'reconnecting') return 'bg-alert-orange';
    return 'bg-alert-red';
  })();

  const showStatusArea = canShowStatus || showPendingRestart || showUpdate;

  return (
    <div className="flex items-center justify-between text-body font-medium">
      <div className="flex items-center gap-2 min-w-0">
        {showStatusArea && (
          <>
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColour}`} />
            {statusMessage && (
              <span className="text-text-muted truncate font-medium" role="status" aria-live="polite">
                {statusMessage}
              </span>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-text-muted font-medium">Powered by</span>
        <span className="text-gold font-medium" aria-label="MasjidConnect">
          <span className="font-bold">Masjid</span>Connect
        </span>
        {APP_VERSION && (
          <span className="text-text-muted/70 text-[0.85em] font-medium tabular-nums" aria-hidden="true">
            v{APP_VERSION}
          </span>
        )}
      </div>
    </div>
  );
};

export default React.memo(Footer);

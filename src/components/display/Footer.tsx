/**
 * Footer
 *
 * Shows the gold MasjidConnect logo, branding text, and a connection
 * status indicator (or pending restart countdown when a delayed restart
 * is scheduled). Uses the same dot + message style for both.
 */

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import { selectPendingRestart } from '../../store/slices/uiSlice';
import logoGold from '../../assets/logos/logo-gold.svg';

/** Delay before showing connection status to prevent startup flash */
const STATUS_DISPLAY_DELAY_MS = 5_000;

const Footer: React.FC = () => {
  const { status, message } = useConnectionStatus();
  const pendingRestart = useSelector(selectPendingRestart);
  const [canShowStatus, setCanShowStatus] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setCanShowStatus(true), STATUS_DISPLAY_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!pendingRestart) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((pendingRestart.at - Date.now()) / 1_000)));
    };
    tick();
    const interval = setInterval(tick, 1_000);
    return () => clearInterval(interval);
  }, [pendingRestart]);

  const showPendingRestart = pendingRestart && secondsLeft !== null;
  const statusMessage = showPendingRestart
    ? `${pendingRestart.label} in ${secondsLeft}s`
    : message;
  const dotColour =
    showPendingRestart
      ? 'bg-alert-orange'
      : status === 'connected'
        ? 'bg-alert-green'
        : status === 'reconnecting'
          ? 'bg-alert-orange'
          : 'bg-alert-red';

  return (
    <div className="flex items-center justify-between text-caption">
      {/* Connection status or pending restart (same style as server unreachable) */}
      <div className="flex items-center gap-2 min-w-0">
        {(canShowStatus || showPendingRestart) && (
          <>
            <span className={`w-2 h-2 rounded-full shrink-0 ${dotColour}`} />
            {statusMessage && (
              <span className="text-text-muted truncate" role="status" aria-live="polite">
                {statusMessage}
              </span>
            )}
          </>
        )}
      </div>

      {/* Branding with logo */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-text-muted">Powered by</span>
        <img src={logoGold} alt="MasjidConnect" className="h-5 w-auto" />
      </div>
    </div>
  );
};

export default React.memo(Footer);

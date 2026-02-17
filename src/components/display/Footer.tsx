/**
 * Footer
 *
 * Shows the gold MasjidConnect logo, branding text, and a connection
 * status indicator. The status dot is delayed by 5 s after mount to
 * avoid a flash of "disconnected" during startup (matching old behaviour).
 */

import React, { useState, useEffect } from 'react';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import logoGold from '../../assets/logos/logo-gold.svg';

/** Delay before showing connection status to prevent startup flash */
const STATUS_DISPLAY_DELAY_MS = 5_000;

const Footer: React.FC = () => {
  const { status, message } = useConnectionStatus();
  const [canShowStatus, setCanShowStatus] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setCanShowStatus(true), STATUS_DISPLAY_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const dotColour =
    status === 'connected'
      ? 'bg-alert-green'
      : status === 'reconnecting'
        ? 'bg-alert-orange'
        : 'bg-alert-red';

  return (
    <div className="flex items-center justify-between text-caption">
      {/* Connection status (delayed) */}
      <div className="flex items-center gap-2 min-w-0">
        {canShowStatus && (
          <>
            <span className={`w-2 h-2 rounded-full shrink-0 ${dotColour}`} />
            {message && <span className="text-text-muted truncate">{message}</span>}
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

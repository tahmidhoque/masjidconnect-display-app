/**
 * Footer
 *
 * Shows "Powered by MasjidConnect" branding in gold (Masjid bold, Connect regular)
 * with version number. Connectivity status has been moved to ConnectionBanner.
 *
 * Also renders a ConnectionBanner on the left side when there is an issue,
 * keeping all footer information in a single bar for the DisplayScreen layout.
 */

import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectUpdatePhase, clearUpdateStatus } from '../../store/slices/uiSlice';
import ConnectionBanner from './ConnectionBanner';

/** After showing "Up to date", clear the message after this delay (ms). */
const NO_UPDATE_CLEAR_MS = 8_000;

/** Injected at build time by Vite (from package.json). */
const APP_VERSION = import.meta.env.VITE_APP_VERSION;

const Footer: React.FC = () => {
  const dispatch = useAppDispatch();
  const updatePhase = useAppSelector(selectUpdatePhase);

  // Clear "Up to date" after delay
  useEffect(() => {
    if (updatePhase !== 'no_update') return;
    const timer = setTimeout(() => dispatch(clearUpdateStatus()), NO_UPDATE_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [updatePhase, dispatch]);

  return (
    <div className="flex items-center justify-between text-body font-medium w-full">
      <div className="min-w-0 flex-1">
        <ConnectionBanner />
      </div>

      <div className="footer-branding flex items-center gap-2 shrink-0 ml-auto">
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

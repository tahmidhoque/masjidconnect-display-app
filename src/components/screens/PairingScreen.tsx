/**
 * PairingScreen
 *
 * Handles the pairing process for new devices:
 *  1. Displays a pairing code (large, readable from a distance)
 *  2. Renders a QR code linking to the admin portal pairing URL
 *  3. Polls the backend every 5 s to check if pairing has completed
 *  4. Automatically refreshes the code when it expires
 *
 * Layout: two-column in landscape (instructions left, code + QR right).
 * All styling uses Tailwind — no MUI.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { QRCodeSVG } from 'qrcode.react';
import type { RootState, AppDispatch } from '../../store';
import {
  requestPairingCode,
  checkPairingStatus,
  setPairingCodeExpired,
} from '../../store/slices/authSlice';
import { IslamicPattern } from '../display';
import { getAdminBaseUrl, getPairingUrl } from '../../utils/adminUrlUtils';
import logoGold from '../../assets/logos/logo-gold.svg';
import logoBlue from '../../assets/logos/logo-notext-blue.svg';
import logger from '../../utils/logger';

/** Polling interval for checking pairing status (ms) */
const POLL_INTERVAL_MS = 5_000;
/** Retry delay after a polling error (ms) */
const POLL_ERROR_DELAY_MS = 10_000;

/* ------------------------------------------------------------------ */
/*  Countdown Hook                                                     */
/* ------------------------------------------------------------------ */

/**
 * Returns a human-readable "M:SS" countdown string.
 * Returns "Expired" when the time has passed.
 */
function useCountdown(expiresAt: string | null): string {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft('');
      return;
    }

    const expirationMs = new Date(expiresAt).getTime();

    const tick = () => {
      const distance = expirationMs - Date.now();
      if (distance <= 0) {
        setTimeLeft('Expired');
        return;
      }
      const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((distance % (1000 * 60)) / 1000);
      setTimeLeft(`${m}:${s < 10 ? '0' : ''}${s}`);
    };

    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return timeLeft;
}

/* ------------------------------------------------------------------ */
/*  PairingScreen Component                                            */
/* ------------------------------------------------------------------ */

const PairingScreen: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  /* ---- Redux state ---- */
  const pairingCode = useSelector((s: RootState) => s.auth.pairingCode);
  const pairingCodeExpiresAt = useSelector((s: RootState) => s.auth.pairingCodeExpiresAt);
  const isPairingCodeExpired = useSelector((s: RootState) => s.auth.isPairingCodeExpired);
  const isRequestingPairingCode = useSelector((s: RootState) => s.auth.isRequestingPairingCode);
  const isAuthenticated = useSelector((s: RootState) => s.auth.isAuthenticated);

  /* ---- Countdown ---- */
  const timeLeft = useCountdown(pairingCodeExpiresAt);

  /* ---- Detect expiry from the countdown ---- */
  useEffect(() => {
    if (timeLeft === 'Expired' && !isPairingCodeExpired) {
      dispatch(setPairingCodeExpired(true));
    }
  }, [timeLeft, isPairingCodeExpired, dispatch]);

  /* ---- Refs for polling lifecycle ---- */
  const mountedRef = useRef(true);
  const pollingRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pollingRef.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  /* ---- Polling loop ---- */
  const startPolling = useCallback(
    async (code: string) => {
      if (pollingRef.current || !code || !mountedRef.current) return;

      pollingRef.current = true;

      try {
        const result = await dispatch(checkPairingStatus(code)).unwrap();

        if (!mountedRef.current) return;

        if (result.isPaired) {
          logger.info('[PairingScreen] Device paired successfully');
          pollingRef.current = false;
          return; // Auth state change triggers screen transition via useAppLoader
        }

        // Not paired yet — schedule next poll
        pollingRef.current = false;
        pollTimerRef.current = setTimeout(() => {
          if (mountedRef.current) startPolling(code);
        }, POLL_INTERVAL_MS);
      } catch (err) {
        logger.error('[PairingScreen] Polling error', {
          error: err instanceof Error ? err.message : String(err),
        });
        pollingRef.current = false;

        // Retry with a longer delay on error
        pollTimerRef.current = setTimeout(() => {
          if (mountedRef.current) startPolling(code);
        }, POLL_ERROR_DELAY_MS);
      }
    },
    [dispatch],
  );

  /* ---- Start polling when a valid code exists ---- */
  useEffect(() => {
    if (
      pairingCode &&
      !isPairingCodeExpired &&
      !pollingRef.current &&
      !isAuthenticated
    ) {
      const delay = setTimeout(() => {
        if (mountedRef.current) startPolling(pairingCode);
      }, 1_500); // Small initial delay to let the UI settle

      return () => clearTimeout(delay);
    }
  }, [pairingCode, isPairingCodeExpired, isAuthenticated, startPolling]);

  /* ---- Auto-refresh when code expires ---- */
  useEffect(() => {
    if (isPairingCodeExpired && !isRequestingPairingCode) {
      logger.info('[PairingScreen] Code expired, requesting new one');
      const delay = setTimeout(() => {
        if (mountedRef.current) {
          dispatch(requestPairingCode('LANDSCAPE'));
        }
      }, 2_000);
      return () => clearTimeout(delay);
    }
  }, [isPairingCodeExpired, isRequestingPairingCode, dispatch]);

  /* ---- Refresh handler (manual) ---- */
  const handleRefresh = useCallback(() => {
    if (!isRequestingPairingCode) {
      dispatch(requestPairingCode('LANDSCAPE'));
    }
  }, [dispatch, isRequestingPairingCode]);

  /* ---- Derived values ---- */
  const adminBaseUrl = useMemo(() => getAdminBaseUrl(), []);
  const qrCodeUrl = useMemo(
    () => (pairingCode ? getPairingUrl(pairingCode) : ''),
    [pairingCode],
  );

  /** Format code with spaces between characters for legibility */
  const formattedCode = useMemo(() => {
    if (!pairingCode) return null;
    return pairingCode.split('').join(' ');
  }, [pairingCode]);

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="fullscreen flex flex-col bg-midnight relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <IslamicPattern opacity={0.03} />
      </div>

      {/* Gold logo — top-left */}
      <div className="absolute top-6 left-8 z-10 w-16 max-w-[80px] min-w-[50px]">
        <img src={logoGold} alt="MasjidConnect" className="w-full h-auto" />
      </div>

      {/* Main content — two-column layout */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-8 py-6 gap-16 animate-fade-in">
        {/* ---- Left column: Instructions ---- */}
        <div className="flex-1 max-w-md flex flex-col gap-6">
          <h1 className="text-3xl font-bold text-gold leading-tight">
            Pair Your Display
          </h1>

          <p className="text-base text-text-secondary leading-relaxed">
            Follow these steps to connect this display to your MasjidConnect account:
          </p>

          <ol className="flex flex-col gap-5 mt-2">
            <li className="flex flex-col gap-1">
              <span className="text-lg font-semibold text-text-primary">
                1. Go to MasjidConnect Dashboard
              </span>
              <span className="text-sm text-text-muted">
                Visit{' '}
                <span className="text-gold break-all">{adminBaseUrl}</span>
              </span>
            </li>

            <li className="flex flex-col gap-1">
              <span className="text-lg font-semibold text-text-primary">
                2. Enter the Pairing Code or Scan QR
              </span>
              <span className="text-sm text-text-muted">
                Use the code shown or scan the QR code with your phone
              </span>
            </li>

            <li className="flex flex-col gap-1">
              <span className="text-lg font-semibold text-text-primary">
                3. Configure Display Settings
              </span>
              <span className="text-sm text-text-muted">
                Set the display name, orientation and other options
              </span>
            </li>
          </ol>

          <p className="text-xs text-text-muted mt-4">
            Need help? Visit{' '}
            <a
              href="https://masjidconnect.co.uk/support"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold hover:underline"
            >
              masjidconnect.co.uk/support
            </a>
          </p>
        </div>

        {/* ---- Right column: Pairing code + QR ---- */}
        <div className="flex-1 max-w-md flex flex-col items-center gap-6">
          {/* Pairing Code heading */}
          <h2 className="text-2xl font-bold text-text-primary">Pairing Code</h2>

          {/* Code display */}
          <div className="h-[100px] flex flex-col items-center justify-center">
            {formattedCode ? (
              <>
                <span className="text-5xl font-bold tracking-[0.3em] text-gold select-all tabular-nums">
                  {formattedCode}
                </span>

                {/* Countdown / expiry */}
                {pairingCodeExpiresAt && (
                  <div className="flex items-center gap-3 mt-3">
                    <span
                      className={`text-sm ${
                        isPairingCodeExpired || timeLeft === 'Expired'
                          ? 'text-red-400'
                          : 'text-text-muted'
                      }`}
                    >
                      {isPairingCodeExpired || timeLeft === 'Expired'
                        ? 'Code expired'
                        : `Expires in ${timeLeft}`}
                    </span>

                    {(isPairingCodeExpired || timeLeft === 'Expired') && (
                      <button
                        onClick={handleRefresh}
                        disabled={isRequestingPairingCode}
                        className="text-sm text-gold font-semibold hover:underline disabled:opacity-50"
                      >
                        Refresh
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* Shimmer placeholder while code loads */
              <div className="w-64 h-14 animate-shimmer rounded-xl" />
            )}
          </div>

          {/* QR Code */}
          <div className="relative w-[260px] h-[260px] bg-white rounded-2xl p-4 flex items-center justify-center shadow-lg">
            {/* Loading overlay */}
            {isRequestingPairingCode && (
              <div className="absolute inset-0 bg-white/70 rounded-2xl flex items-center justify-center z-10">
                <div className="w-10 h-10 border-4 border-midnight/20 border-t-midnight rounded-full animate-spin" />
              </div>
            )}

            {pairingCode ? (
              <QRCodeSVG
                key={`qr-${pairingCode}`}
                value={qrCodeUrl}
                size={220}
                bgColor="#ffffff"
                fgColor="#0A2647"
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: logoBlue,
                  x: undefined,
                  y: undefined,
                  height: 44,
                  width: 44,
                  excavate: true,
                }}
              />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 border-4 border-midnight/20 border-t-midnight rounded-full animate-spin" />
                <span className="text-sm text-midnight/60">Generating QR code…</span>
              </div>
            )}
          </div>

          {/* QR helper text */}
          <p className="text-xs text-text-muted text-center max-w-xs">
            Scan this QR code or visit{' '}
            <span className="text-gold break-all">{adminBaseUrl}/pair</span>
          </p>

          {/* Polling status */}
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald animate-subtle-pulse" />
            <span className="text-text-secondary">Waiting for pairing…</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PairingScreen;

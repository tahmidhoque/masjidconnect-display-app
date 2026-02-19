/**
 * App — Root component for MasjidConnect Display.
 *
 * Responsibilities:
 *  1. Online/offline detection (dispatches to uiSlice).
 *  2. App lifecycle via useAppLoader (startup → pairing → loading → ready).
 *  3. Smooth screen transitions between Loading, Pairing, and Display screens.
 *  4. Emergency alert overlay (reads from emergencySlice).
 *  5. Error boundary wrapping.
 */

import React, { useEffect, useState, useRef, useMemo, useCallback, Suspense, lazy } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ErrorBoundary } from 'react-error-boundary';

import type { RootState } from './store';
import { setOffline } from './store/slices/uiSlice';
import { clearCurrentAlert } from './store/slices/emergencySlice';
import useAppLoader from './hooks/useAppLoader';
import useDevKeyboard, { ORIENTATION_FORCE_EVENT } from './hooks/useDevKeyboard';
import { useRotationHandling } from './hooks/useRotationHandling';
import { OrientationWrapper } from './components/layout';
import logger from './utils/logger';

/* ------------------------------------------------------------------
   Lazy-loaded screen components (created in Phase 3d)
   ------------------------------------------------------------------ */
const LoadingScreen = lazy(() => import('./components/screens/LoadingScreen'));
const PairingScreen = lazy(() => import('./components/screens/PairingScreen'));
const DisplayScreen = lazy(() => import('./components/screens/DisplayScreen'));

/* ------------------------------------------------------------------
   Constants
   ------------------------------------------------------------------ */
const TRANSITION_MS = 700;
const MIN_LOADING_MS = 3500;
const POST_READY_DELAY = 400;

/* ------------------------------------------------------------------
   Types
   ------------------------------------------------------------------ */
type ScreenType = 'loading' | 'pairing' | 'display';

/* ------------------------------------------------------------------
   ErrorFallback — shown when an unrecoverable error occurs
   ------------------------------------------------------------------ */
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary,
}) => (
  <div className="fullscreen flex flex-col items-center justify-center bg-midnight text-text-primary p-8">
    <h1 className="text-heading mb-4">Something went wrong</h1>
    <p className="text-body text-text-secondary mb-6 max-w-md text-center">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="px-6 py-3 rounded-xl bg-emerald text-white font-semibold text-body
                 transition-opacity duration-normal hover:opacity-80 active:opacity-60"
    >
      Reload
    </button>
  </div>
);

/* ------------------------------------------------------------------
   EmergencyOverlay — full-screen emergency alert

   Replicates the original pre-overhaul design:
     • Gradient colour schemes (RED / ORANGE / AMBER / BLUE / GREEN / PURPLE / DARK)
     • Fade-in-scale + pulse animation on the card
     • Smooth fade-in / fade-out of the overlay
     • Orientation rotation via useRotationHandling
     • Auto-clear once expiresAt passes
   ------------------------------------------------------------------ */

type AlertScheme = 'red' | 'orange' | 'amber' | 'blue' | 'green' | 'purple' | 'dark';

/** Map API colorScheme to our CSS suffix */
function resolveScheme(alert: { colorScheme?: string; color?: string }): AlertScheme {
  const raw = (alert.colorScheme ?? '').toUpperCase();
  const map: Record<string, AlertScheme> = {
    RED: 'red', ORANGE: 'orange', AMBER: 'amber',
    BLUE: 'blue', GREEN: 'green', PURPLE: 'purple', DARK: 'dark',
  };
  if (map[raw]) return map[raw];

  // Fallback: match hex colour
  const c = (alert.color ?? '').toLowerCase();
  if (c.includes('ff9800') || c.includes('orange')) return 'orange';
  if (c.includes('ffc107') || c.includes('amber'))  return 'amber';
  if (c.includes('2196f3') || c.includes('blue'))   return 'blue';
  if (c.includes('4caf50') || c.includes('green'))  return 'green';
  if (c.includes('9c27b0') || c.includes('purple')) return 'purple';
  if (c.includes('37474f') || c.includes('263238')) return 'dark';
  return 'red';
}

const EmergencyOverlay: React.FC = () => {
  const dispatch = useDispatch();
  const alert = useSelector((s: RootState) => s.emergency.currentAlert);

  /* Dev-mode orientation override (Ctrl+Shift+O) */
  const [orientationOverride, setOrientationOverride] = useState<
    'LANDSCAPE' | 'PORTRAIT' | undefined
  >(() => window.__ORIENTATION_FORCE);

  useEffect(() => {
    const handler = () => setOrientationOverride(window.__ORIENTATION_FORCE);
    window.addEventListener(ORIENTATION_FORCE_EVENT, handler);
    return () => window.removeEventListener(ORIENTATION_FORCE_EVENT, handler);
  }, []);

  const storeOrientation = useSelector(
    (s: RootState) => s.content.screenContent?.screen?.orientation,
  );
  const orientation: 'LANDSCAPE' | 'PORTRAIT' =
    orientationOverride ?? storeOrientation ?? 'LANDSCAPE';

  const { shouldRotate } = useRotationHandling(orientation);

  // Animation states: mount → visible → fade-out → unmount
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (alert) {
      setMounted(true);
      // Slight delay so the DOM mounts before we trigger the CSS transition
      requestAnimationFrame(() => setVisible(true));

      // Auto-clear when expiresAt passes
      if (alert.expiresAt) {
        const ms = new Date(alert.expiresAt).getTime() - Date.now();
        if (ms > 0) {
          expiryTimerRef.current = setTimeout(() => {
            dispatch(clearCurrentAlert());
          }, ms);
        } else {
          dispatch(clearCurrentAlert());
        }
      }
    } else {
      // Fade out, then unmount
      setVisible(false);
      fadeTimerRef.current = setTimeout(() => setMounted(false), 350);
    }

    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    };
  }, [alert, dispatch]);

  if (!mounted) return null;

  const scheme = alert ? resolveScheme(alert) : 'red';

  const AlertContent = () => (
    <div className={`emergency-overlay ${visible ? '' : 'fade-out'} alert-bg-${scheme}`}>
      <div className={`alert-card alert-scheme-${scheme}`}>

        {/* Icon + badge */}
        <div className="flex flex-col items-center gap-3 pt-8 pb-2">
          <span className="text-[3.5rem] leading-none">⚠️</span>
          <span
            className="inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
            style={{ background: 'var(--alert-accent)', color: '#fff' }}
          >
            Emergency Alert
          </span>
        </div>

        {/* Title */}
        <div className="px-8 pt-4 pb-2 text-center">
          <h1 className="text-heading text-text-primary font-bold">
            {alert?.title ?? 'Emergency Alert'}
          </h1>
        </div>

        {/* Divider */}
        <div className="mx-auto w-24 h-px opacity-30" style={{ background: 'var(--alert-accent)' }} />

        {/* Body */}
        <div className="flex-1 flex items-center justify-center px-10 py-8">
          <p className="text-body text-text-secondary text-center leading-relaxed whitespace-pre-wrap max-w-2xl">
            {alert?.message ?? 'Emergency alert details not available'}
          </p>
        </div>

      </div>
    </div>
  );

  if (shouldRotate) {
    return (
      <div
        className="fixed inset-0 gpu-accelerated"
        style={{
          zIndex: 9999,
          top: '50%',
          left: '50%',
          width: '100vh',
          height: '100vw',
          transform: 'translate(-50%, -50%) rotate(90deg)',
          transformOrigin: 'center center',
          overflow: 'hidden',
          backfaceVisibility: 'hidden',
        }}
      >
        <AlertContent />
      </div>
    );
  }

  return <AlertContent />;
};

/* ------------------------------------------------------------------
   AppRoutes — manages screen transitions
   ------------------------------------------------------------------ */
/** Orientation for loading overlay: match display (from content or stored at pairing). */
function useLoadingOrientation(): 'LANDSCAPE' | 'PORTRAIT' {
  const fromContent = useSelector(
    (s: RootState) => s.content.screenContent?.screen?.orientation,
  );
  const fromStorage =
    typeof localStorage !== 'undefined'
      ? (localStorage.getItem('screen_orientation') as 'LANDSCAPE' | 'PORTRAIT' | null)
      : null;
  return fromContent ?? fromStorage ?? 'LANDSCAPE';
}

const AppRoutes: React.FC = () => {
  const { phase, overallProgress, currentTask, tasks, hasPairingCode } = useAppLoader();
  const loadingOrientation = useLoadingOrientation();

  const [activeScreen, setActiveScreen] = useState<ScreenType>('loading');
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [overlayMounted, setOverlayMounted] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const loadStartRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Determine which screen we should be on */
  const targetScreen = useMemo((): ScreenType => {
    if ((phase === 'pairing') && hasPairingCode) return 'pairing';
    if (phase === 'ready') return 'display';
    return 'loading';
  }, [phase, hasPairingCode]);

  /** Clear pending timeouts */
  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (fadeRef.current) { clearTimeout(fadeRef.current); fadeRef.current = null; }
  }, []);

  /** Handle transitions between screens */
  useEffect(() => {
    if (isTransitioning || targetScreen === activeScreen) return;

    const elapsed = Date.now() - loadStartRef.current;

    if (activeScreen === 'loading' && targetScreen !== 'loading') {
      const wait = Math.max(0, MIN_LOADING_MS - elapsed) + POST_READY_DELAY;

      clearTimers();
      timerRef.current = setTimeout(() => {
        setIsTransitioning(true);
        setOverlayVisible(false);

        fadeRef.current = setTimeout(() => {
          setActiveScreen(targetScreen);
          setOverlayMounted(false);
          setIsTransitioning(false);
          logger.info('[App] Transition complete', { to: targetScreen });
        }, TRANSITION_MS);
      }, wait);
    } else {
      clearTimers();
      setIsTransitioning(true);
      timerRef.current = setTimeout(() => {
        setActiveScreen(targetScreen);
        setIsTransitioning(false);
        if (targetScreen === 'loading') {
          loadStartRef.current = Date.now(); // Ensures MIN_LOADING_MS applies to initial and post-pairing load
          setOverlayMounted(true);
          setOverlayVisible(true);
        }
      }, TRANSITION_MS / 2);
    }

    return clearTimers;
  }, [targetScreen, activeScreen, isTransitioning, clearTimers]);

  /** Cleanup on unmount */
  useEffect(() => clearTimers, [clearTimers]);

  /* ---- Content screen ---- */
  const renderContent = () => {
    if (activeScreen === 'loading' && !isTransitioning) return null;
    const screen = isTransitioning ? targetScreen : activeScreen;
    if (screen === 'loading') return null;

    return (
      <div className="fullscreen">
        <Suspense fallback={null}>
          {screen === 'pairing' && <PairingScreen />}
          {screen === 'display' && <DisplayScreen />}
        </Suspense>
      </div>
    );
  };

  /* ---- Loading overlay — same orientation as display ---- */
  const renderLoadingOverlay = () => {
    if (!overlayMounted) return null;

    return (
      <div
        className="fullscreen z-50 gpu-accelerated"
        style={{
          opacity: overlayVisible ? 1 : 0,
          transition: `opacity ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
          pointerEvents: overlayVisible ? 'auto' : 'none',
        }}
      >
        <OrientationWrapper orientation={loadingOrientation}>
          <Suspense fallback={null}>
            <LoadingScreen progress={overallProgress} message={currentTask} tasks={tasks} />
          </Suspense>
        </OrientationWrapper>
      </div>
    );
  };

  return (
    <>
      {renderContent()}
      {renderLoadingOverlay()}
    </>
  );
};

/* ------------------------------------------------------------------
   App — top-level wrapper
   ------------------------------------------------------------------ */
const App: React.FC = () => {
  const dispatch = useDispatch();

  /** Dev-only keyboard shortcuts (Alt+1–7 for alerts, Escape to clear) */
  useDevKeyboard();

  /** Online / Offline listener */
  useEffect(() => {
    dispatch(setOffline(!navigator.onLine));

    const goOnline = () => {
      dispatch(setOffline(false));
      logger.info('[App] Network restored');
    };
    const goOffline = () => {
      dispatch(setOffline(true));
      logger.warn('[App] Network lost');
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [dispatch]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => logger.error('[App] Unhandled error', { error: error.message, stack: info.componentStack })}
      onReset={() => window.location.reload()}
    >
      <div className="fullscreen bg-midnight gpu-accelerated">
        <AppRoutes />
        <EmergencyOverlay />
      </div>
    </ErrorBoundary>
  );
};

export default App;

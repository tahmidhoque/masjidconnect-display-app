/**
 * App — Root component for MasjidConnect Display.
 *
 * Responsibilities:
 *  1. Online/offline detection (dispatches to uiSlice).
 *  2. App lifecycle via useAppLoader (startup → pairing → loading → ready).
 *  3. Smooth screen transitions between Loading, Pairing, and Display screens.
 *  4. Emergency alert overlay (reads from emergencySlice via EmergencyAlertOverlay).
 *  5. Error boundary wrapping.
 */

import React, { useEffect, useState, useRef, useMemo, useCallback, Suspense, lazy } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ErrorBoundary } from 'react-error-boundary';

import type { RootState } from './store';
import { getLastError, getLogHistory } from './utils/logger';
import { setOffline } from './store/slices/uiSlice';
import useAppLoader from './hooks/useAppLoader';
import useDevKeyboard from './hooks/useDevKeyboard';
import { OrientationWrapper } from './components/layout';
import { EmergencyAlertOverlay } from './components/display';
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
   AppRoutes — manages screen transitions
   ------------------------------------------------------------------ */
/** Rotation degrees for loading overlay: ui state or localStorage fallback. */
function useLoadingRotationDegrees(): 0 | 90 | 180 | 270 {
  const fromUi = useSelector((s: RootState) => s.ui.rotationDegrees);
  if (fromUi !== undefined && [0, 90, 180, 270].includes(fromUi)) return fromUi as 0 | 90 | 180 | 270;
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('screen_rotation_degrees');
    const n = stored != null ? parseInt(stored, 10) : NaN;
    if (Number.isInteger(n) && [0, 90, 180, 270].includes(n)) return n as 0 | 90 | 180 | 270;
  }
  return 0;
}

const AppRoutes: React.FC = () => {
  const { phase, overallProgress, currentTask, tasks, hasPairingCode } = useAppLoader();
  const loadingRotationDegrees = useLoadingRotationDegrees();

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
    } else if (activeScreen === 'pairing' && targetScreen === 'loading') {
      // Premium pairing-complete transition: fade the loading overlay IN over
      // the pairing screen, then silently swap the underlying content once the
      // overlay is fully opaque (so the swap is invisible to the viewer).
      clearTimers();
      setIsTransitioning(true);
      loadStartRef.current = Date.now(); // MIN_LOADING_MS measured from pairing completion

      // Mount the overlay at opacity 0 first, then trigger the CSS fade via rAF
      // so the browser has a rendered frame at opacity 0 to transition from.
      setOverlayMounted(true);
      setOverlayVisible(false);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOverlayVisible(true));
      });

      timerRef.current = setTimeout(() => {
        // Overlay is now fully opaque — swap the underlying screen invisibly
        setActiveScreen('loading');
        setIsTransitioning(false);
        logger.info('[App] Transition complete', { to: 'loading' });
      }, TRANSITION_MS);

    } else {
      clearTimers();
      setIsTransitioning(true);
      timerRef.current = setTimeout(() => {
        setActiveScreen(targetScreen);
        setIsTransitioning(false);
        if (targetScreen === 'loading') {
          loadStartRef.current = Date.now();
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
    // When transitioning TO loading (overlay fading in), keep the current screen
    // visible underneath so pairing never flashes to black.
    const screen = (isTransitioning && targetScreen === 'loading')
      ? activeScreen
      : (isTransitioning ? targetScreen : activeScreen);
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
        <OrientationWrapper rotationDegrees={loadingRotationDegrees}>
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

  /** Debug overlay: show last error and recent logs when ?debug=1 (e.g. on Pi without DevTools). */
  const showDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
  const lastError = showDebug ? getLastError() : null;
  const logHistory = showDebug ? getLogHistory() : [];

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, info) => logger.error('[App] Unhandled error', { error: error.message, stack: info.componentStack })}
      onReset={() => window.location.reload()}
    >
      <div className="fullscreen bg-midnight gpu-accelerated">
        <AppRoutes />
        <EmergencyAlertOverlay />
        {showDebug && (
          <div className="fixed bottom-0 left-0 right-0 z-[9998] max-h-[40vh] overflow-auto bg-black/90 text-white p-3 font-mono text-xs border-t border-white/20">
            <div className="font-semibold mb-1">Debug (?debug=1)</div>
            {lastError ? (
              <pre className="whitespace-pre-wrap break-all text-red-300 mb-2">{lastError}</pre>
            ) : (
              <p className="text-gray-400 mb-2">No last error stored.</p>
            )}
            <details>
              <summary className="cursor-pointer">Recent logs ({logHistory.length})</summary>
              <pre className="whitespace-pre-wrap mt-1 text-gray-400">
                {logHistory.slice(-15).map((e, i) => `${e.timestamp} [${e.level}] ${e.message}`).join('\n')}
              </pre>
            </details>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;

/**
 * useAppLoader Hook
 *
 * Manages app initialisation lifecycle: credential check -> pairing -> data loading -> ready.
 * Simplified from the original 700-line version; no WiFi slice or performance profiling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import { initializeFromStorage, requestPairingCode } from '../store/slices/authSlice';
import { refreshAllContent } from '../store/slices/contentSlice';
import { setInitializing, setInitializationStage, setLoadingMessage } from '../store/slices/uiSlice';
import logger from '../utils/logger';

export interface LoadingTask {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'complete' | 'error' | 'skipped';
  progress: number;
  error?: string;
}

export type AppLoadingPhase = 'startup' | 'pairing' | 'loading' | 'ready';

export interface AppLoaderState {
  phase: AppLoadingPhase;
  overallProgress: number;
  currentTask: string;
  tasks: LoadingTask[];
  needsPairing: boolean;
  needsWiFiSetup: boolean;
  hasPairingCode: boolean;
  error: string | null;
}

const DEFAULT_TASKS: LoadingTask[] = [
  { id: 'credentials', label: 'Checking credentials', status: 'pending', progress: 0 },
  { id: 'content', label: 'Loading content', status: 'pending', progress: 0 },
  { id: 'prayer-times', label: 'Fetching prayer times', status: 'pending', progress: 0 },
];

/**
 * Drives the app through startup -> pairing -> loading -> ready.
 */
export const useAppLoader = (): AppLoaderState => {
  const dispatch = useDispatch<AppDispatch>();

  const isAuthenticated = useSelector((s: RootState) => s.auth.isAuthenticated);
  const isPairing = useSelector((s: RootState) => s.auth.isPairing);
  const pairingCode = useSelector((s: RootState) => s.auth.pairingCode);
  const prayerTimes = useSelector((s: RootState) => s.content.prayerTimes);
  const screenContent = useSelector((s: RootState) => s.content.screenContent);
  const isContentLoading = useSelector((s: RootState) => s.content.isLoading);

  const [phase, setPhase] = useState<AppLoadingPhase>('startup');
  const [tasks, setTasks] = useState<LoadingTask[]>(DEFAULT_TASKS);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  /** Update a task's status */
  const updateTask = useCallback((id: string, update: Partial<LoadingTask>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...update } : t)),
    );
  }, []);

  /** Compute overall progress from tasks */
  const overallProgress = tasks.reduce((sum, t) => sum + t.progress, 0) / tasks.length;
  const currentTask = tasks.find((t) => t.status === 'loading')?.label ?? '';

  /* ------------------------------------------------------------------ */
  /*  Phase: STARTUP — check credentials from storage                   */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      logger.info('[AppLoader] Starting initialisation');
      dispatch(setInitializing(true));
      dispatch(setInitializationStage('credentials'));
      dispatch(setLoadingMessage('Checking credentials...'));

      updateTask('credentials', { status: 'loading', progress: 10 });

      try {
        await dispatch(initializeFromStorage()).unwrap();
        updateTask('credentials', { status: 'complete', progress: 100 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('[AppLoader] Credential init failed', { error: msg });
        updateTask('credentials', { status: 'error', progress: 100, error: msg });
        setError(msg);
      }
    };

    run();
  }, [dispatch, updateTask]);

  /* ------------------------------------------------------------------ */
  /*  Phase: PAIRING — request pairing code if not authenticated        */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (phase !== 'startup') return;

    // Credentials loaded — decide next step
    const credentialsTask = tasks.find((t) => t.id === 'credentials');
    if (!credentialsTask || credentialsTask.status === 'loading' || credentialsTask.status === 'pending') return;

    if (isAuthenticated) {
      logger.info('[AppLoader] Authenticated, loading data');
      setPhase('loading');
    } else if (isPairing && pairingCode) {
      logger.info('[AppLoader] Resuming pairing');
      setPhase('pairing');
    } else {
      logger.info('[AppLoader] Not authenticated, requesting pairing code');
      dispatch(requestPairingCode('LANDSCAPE'));
      setPhase('pairing');
    }
  }, [phase, tasks, isAuthenticated, isPairing, pairingCode, dispatch]);

  /* ------------------------------------------------------------------ */
  /*  Phase: LOADING — fetch content and prayer times                   */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (phase !== 'loading') return;

    dispatch(setInitializationStage('content'));
    dispatch(setLoadingMessage('Loading content...'));

    updateTask('content', { status: 'loading', progress: 20 });
    updateTask('prayer-times', { status: 'loading', progress: 20 });

    dispatch(refreshAllContent({ forceRefresh: true }));
  }, [phase, dispatch, updateTask]);

  /** Track content load progress */
  useEffect(() => {
    if (phase !== 'loading') return;

    if (screenContent) updateTask('content', { status: 'complete', progress: 100 });
    if (prayerTimes) updateTask('prayer-times', { status: 'complete', progress: 100 });

    if (screenContent && prayerTimes) {
      logger.info('[AppLoader] All data loaded');
      dispatch(setInitializing(false));
      setPhase('ready');
    }
  }, [phase, screenContent, prayerTimes, dispatch, updateTask]);

  /** If content loading takes >15s, proceed anyway with whatever we have */
  useEffect(() => {
    if (phase !== 'loading') return;
    const timeout = setTimeout(() => {
      if (phase === 'loading') {
        logger.warn('[AppLoader] Loading timeout, proceeding anyway');
        dispatch(setInitializing(false));
        setPhase('ready');
      }
    }, 15_000);
    return () => clearTimeout(timeout);
  }, [phase, dispatch]);

  /** Transition from pairing to loading when authentication completes */
  useEffect(() => {
    if (phase === 'pairing' && isAuthenticated) {
      logger.info('[AppLoader] Paired, loading data');
      setPhase('loading');
    }
  }, [phase, isAuthenticated]);

  return {
    phase,
    overallProgress,
    currentTask,
    tasks,
    needsPairing: !isAuthenticated && !isPairing,
    needsWiFiSetup: false,
    hasPairingCode: !!pairingCode,
    error,
  };
};

export default useAppLoader;

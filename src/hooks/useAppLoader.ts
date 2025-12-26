import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../store";
import { initializeFromStorage, requestPairingCode } from "../store/slices/authSlice";
import { refreshAllContent } from "../store/slices/contentSlice";
import {
  checkWiFiAvailability,
  checkInternetConnectivity,
  selectIsWiFiAvailable,
  selectConnectionStatus,
} from "../store/slices/wifiSlice";
import { setInitializing, setInitializationStage, setLoadingMessage } from "../store/slices/uiSlice";
import logger from "../utils/logger";
import {
  getDevicePerformanceProfile,
  isHighStrainDevice,
} from "../utils/performanceUtils";

/**
 * Loading task definition
 */
export interface LoadingTask {
  id: string;
  label: string;
  weight: number;
  status: "pending" | "loading" | "complete" | "error" | "skipped";
  progress: number; // 0-100 for the individual task
  error?: string;
}

/**
 * App phase - simplified states
 */
export type AppLoadingPhase =
  | "startup" // Initial boot and credential check
  | "wifi-setup" // WiFi configuration required
  | "pairing" // Authentication required (pairing code is ready)
  | "loading" // Data loading with real progress
  | "ready"; // Display ready

/**
 * Loading state returned by the hook
 */
export interface AppLoaderState {
  phase: AppLoadingPhase;
  overallProgress: number; // 0-100
  currentTask: string;
  tasks: LoadingTask[];
  isComplete: boolean;
  needsWiFiSetup: boolean;
  needsPairing: boolean;
  hasPairingCode: boolean;
  error: string | null;
}

/**
 * Default loading tasks with weights (must sum to 100)
 * For authenticated flow: credentials + network + content + prayer-times + schedule + ui-prep
 * For pairing flow: credentials + network + pairing-code
 */
const DEFAULT_TASKS: LoadingTask[] = [
  { id: "credentials", label: "Checking credentials", weight: 15, status: "pending", progress: 0 },
  { id: "network", label: "Checking network", weight: 15, status: "pending", progress: 0 },
  { id: "pairing-code", label: "Preparing pairing", weight: 20, status: "pending", progress: 0 },
  { id: "content", label: "Loading content", weight: 20, status: "pending", progress: 0 },
  { id: "prayer-times", label: "Loading prayer times", weight: 15, status: "pending", progress: 0 },
  { id: "schedule", label: "Loading schedule", weight: 10, status: "pending", progress: 0 },
  { id: "ui-prep", label: "Preparing display", weight: 5, status: "pending", progress: 0 },
];

/**
 * Timing configuration for smooth loading experience
 */
interface TimingConfig {
  minStepDuration: number;      // Minimum time each step shows (ms)
  minSplashDuration: number;    // Minimum total splash screen time (ms)
  progressAnimationStep: number; // Time between progress animation steps (ms)
}

const getTimingConfig = (isHighStrain: boolean): TimingConfig => {
  if (isHighStrain) {
    return {
      minStepDuration: 1000,      // Each step visible for at least 1s (increased from 800ms)
      minSplashDuration: 3000,    // Splash for at least 3s (increased from 2s)
      progressAnimationStep: 100, // Faster progress updates
    };
  }
  return {
    minStepDuration: 1500,        // Each step visible for at least 1.5s (increased from 1.2s)
    minSplashDuration: 4500,      // Splash for at least 4.5s (increased from 3s)
    progressAnimationStep: 80,    // Smooth progress animation
  };
};

/**
 * useAppLoader - Unified loading orchestrator
 * 
 * This hook provides a single source of truth for the app loading state.
 * It tracks individual loading tasks with weighted progress to provide
 * meaningful, data-driven progress updates.
 * 
 * Key improvements:
 * - Shows loading screen while fetching pairing code
 * - Enforces minimum display times for each step to prevent flashing
 * - Smooth progress animation between steps
 */
export default function useAppLoader(): AppLoaderState & {
  startLoading: () => Promise<void>;
  retryLoading: () => Promise<void>;
} {
  const dispatch = useDispatch<AppDispatch>();

  // Performance settings
  const isHighStrain = useMemo(() => isHighStrainDevice(), []);
  const timingConfig = useMemo(() => getTimingConfig(isHighStrain), [isHighStrain]);

  // Redux state
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const isPairing = useSelector((state: RootState) => state.auth.isPairing);
  const pairingCode = useSelector((state: RootState) => state.auth.pairingCode);
  const screenContent = useSelector((state: RootState) => state.content.screenContent);
  const prayerTimes = useSelector((state: RootState) => state.content.prayerTimes);
  const schedule = useSelector((state: RootState) => state.content.schedule);
  const contentLoading = useSelector((state: RootState) => state.content.isLoading);
  const wifiConnectionStatus = useSelector(selectConnectionStatus);

  // Local state
  const [phase, setPhase] = useState<AppLoadingPhase>("startup");
  const [tasks, setTasks] = useState<LoadingTask[]>(DEFAULT_TASKS);
  const [error, setError] = useState<string | null>(null);
  const [needsWiFiSetup, setNeedsWiFiSetup] = useState(false);
  const [needsPairing, setNeedsPairing] = useState(false);
  const [loadingStarted, setLoadingStarted] = useState(false);
  const [pairingCodeReady, setPairingCodeReady] = useState(false);

  // Refs
  const loadingInProgress = useRef(false);
  const hasInitialized = useRef(false);
  const loadingStartTime = useRef<number>(Date.now());

  /**
   * Update a specific task's status and progress
   */
  const updateTask = useCallback((taskId: string, updates: Partial<LoadingTask>) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    );
  }, []);

  /**
   * Calculate overall progress from individual tasks
   * Only count tasks that are relevant to the current flow
   */
  const overallProgress = useMemo(() => {
    // Determine which tasks are relevant
    const relevantTaskIds = needsPairing 
      ? ["credentials", "network", "pairing-code"]
      : ["credentials", "network", "content", "prayer-times", "schedule", "ui-prep"];
    
    const relevantTasks = tasks.filter(t => relevantTaskIds.includes(t.id));
    const totalWeight = relevantTasks.reduce((sum, t) => sum + t.weight, 0);
    
    const progress = relevantTasks.reduce((total, task) => {
      if (task.status === "complete" || task.status === "skipped") {
        return total + task.weight;
      } else if (task.status === "loading") {
        return total + (task.weight * task.progress) / 100;
      }
      return total;
    }, 0);
    
    // Normalise to 100%
    return totalWeight > 0 ? Math.round((progress / totalWeight) * 100) : 0;
  }, [tasks, needsPairing]);

  /**
   * Get the current task label for display
   */
  const currentTask = useMemo(() => {
    const loadingTask = tasks.find((t) => t.status === "loading");
    if (loadingTask) return loadingTask.label;
    
    const pendingTask = tasks.find((t) => t.status === "pending");
    if (pendingTask) return pendingTask.label;
    
    if (phase === "ready") return "Ready";
    if (phase === "pairing") return "Ready to pair";
    if (phase === "wifi-setup") return "WiFi setup required";
    
    return "Loading...";
  }, [tasks, phase]);

  /**
   * Check if all critical tasks are complete
   */
  const isComplete = useMemo(() => {
    if (needsPairing) {
      // For pairing flow, we're complete when pairing code is ready
      const pairingTask = tasks.find(t => t.id === "pairing-code");
      return pairingTask?.status === "complete";
    }
    
    // For authenticated flow, check essential tasks
    const essentialTasks = ["credentials", "content", "prayer-times"];
    return essentialTasks.every((taskId) => {
      const task = tasks.find((t) => t.id === taskId);
      return task && (task.status === "complete" || task.status === "skipped");
    });
  }, [tasks, needsPairing]);

  /**
   * Run a task with minimum display time and smooth progress animation
   * This ensures the task is visible for at least minDuration milliseconds
   */
  const runTaskWithMinDuration = useCallback(
    async <T,>(
      taskId: string,
      operation: () => Promise<T>,
      minDuration: number = timingConfig.minStepDuration
    ): Promise<T> => {
      const startTime = Date.now();
      
      // Start the task as loading
      updateTask(taskId, { status: "loading", progress: 0 });
      logger.info(`[AppLoader] Starting task: ${taskId}`);

      // Start progress animation
      let currentProgress = 0;
      const targetProgress = 90; // Animate to 90%, complete on finish
      const animationInterval = setInterval(() => {
        if (currentProgress < targetProgress) {
          // Smooth easing - slow down as we approach target
          const increment = Math.max(1, (targetProgress - currentProgress) / 10);
          currentProgress = Math.min(targetProgress, currentProgress + increment);
          updateTask(taskId, { progress: Math.round(currentProgress) });
        }
      }, timingConfig.progressAnimationStep);

      try {
        // Run the actual operation
        const result = await operation();
        
        // Stop progress animation
        clearInterval(animationInterval);
        
        // Calculate remaining time to meet minimum duration
        const elapsed = Date.now() - startTime;
        const remainingTime = Math.max(0, minDuration - elapsed);
        
        if (remainingTime > 0) {
          logger.debug(`[AppLoader] Task ${taskId} completed quickly, waiting ${remainingTime}ms`);
          
          // Animate progress to 100% during the remaining wait time
          const steps = Math.ceil(remainingTime / timingConfig.progressAnimationStep);
          const progressIncrement = (100 - currentProgress) / steps;
          
          for (let i = 0; i < steps; i++) {
            currentProgress = Math.min(100, currentProgress + progressIncrement);
            updateTask(taskId, { progress: Math.round(currentProgress) });
            await new Promise(resolve => setTimeout(resolve, timingConfig.progressAnimationStep));
          }
        }
        
        // Mark as complete
        updateTask(taskId, { status: "complete", progress: 100 });
        logger.info(`[AppLoader] Task ${taskId} complete (took ${Date.now() - startTime}ms)`);
        
        return result;
      } catch (err: any) {
        clearInterval(animationInterval);
        updateTask(taskId, { status: "error", error: err.message });
        throw err;
      }
    },
    [updateTask, timingConfig]
  );

  /**
   * Check credentials from storage
   */
  const checkCredentials = useCallback(async (): Promise<boolean> => {
    return runTaskWithMinDuration("credentials", async () => {
      logger.info("[AppLoader] Checking credentials...");
      
      const result: any = await dispatch(initializeFromStorage());
      
      if (result.payload?.credentials) {
        logger.info("[AppLoader] Valid credentials found");
        return true;
      } else {
        logger.info("[AppLoader] No valid credentials found");
        return false;
      }
    });
  }, [dispatch, runTaskWithMinDuration]);

  /**
   * Check network connectivity
   */
  const checkNetwork = useCallback(async (): Promise<boolean> => {
    return runTaskWithMinDuration("network", async () => {
      logger.info("[AppLoader] Checking network connectivity...");
      
      // Check WiFi availability
      await dispatch(checkWiFiAvailability());

      // Check internet connectivity
      const hasInternet = await dispatch(checkInternetConnectivity()).unwrap();

      if (hasInternet) {
        logger.info("[AppLoader] Network connectivity confirmed");
        return true;
      } else {
        logger.warn("[AppLoader] No internet connectivity");
        // Check if WiFi management is available
        const wifiResult = await dispatch(checkWiFiAvailability()).unwrap();
        
        if (wifiResult) {
          logger.info("[AppLoader] WiFi management available, setup required");
          setNeedsWiFiSetup(true);
          return false;
        }

        // No WiFi management, proceed offline
        logger.info("[AppLoader] Proceeding in offline mode");
        return true; // Allow offline operation
      }
    });
  }, [dispatch, runTaskWithMinDuration]);

  /**
   * Request a pairing code - stays on loading screen until code is ready
   */
  const fetchPairingCode = useCallback(async (): Promise<boolean> => {
    dispatch(setLoadingMessage("Preparing pairing code..."));
    
    return runTaskWithMinDuration("pairing-code", async () => {
      logger.info("[AppLoader] Requesting pairing code...");
      
      // Request the pairing code
      const result = await dispatch(requestPairingCode("LANDSCAPE"));
      
      if (requestPairingCode.fulfilled.match(result)) {
        logger.info("[AppLoader] Pairing code received successfully");
        setPairingCodeReady(true);
        return true;
      } else {
        logger.error("[AppLoader] Failed to get pairing code", { result });
        setError("Failed to generate pairing code. Please check your network connection.");
        return false;
      }
    }, timingConfig.minStepDuration * 1.5); // Pairing code step shows a bit longer
  }, [dispatch, runTaskWithMinDuration, timingConfig.minStepDuration]);

  /**
   * Load all content data
   */
  const loadContent = useCallback(async (): Promise<void> => {
    logger.info("[AppLoader] Loading content...");

    // Mark content tasks as loading
    updateTask("content", { status: "loading", progress: 0 });
    updateTask("prayer-times", { status: "loading", progress: 0 });
    updateTask("schedule", { status: "loading", progress: 0 });

    const contentStartTime = Date.now();

    try {
      // Start content refresh - load from cache first, then refresh from API
      const contentPromise = dispatch(refreshAllContent({ forceRefresh: false }));

      // Animate progress while content loads
      let animationProgress = 0;
      const animationInterval = setInterval(() => {
        if (animationProgress < 80) {
          animationProgress += 5;
          updateTask("content", { progress: animationProgress });
          updateTask("prayer-times", { progress: animationProgress });
          updateTask("schedule", { progress: Math.min(60, animationProgress) });
        }
      }, timingConfig.progressAnimationStep * 2);

      await contentPromise;
      clearInterval(animationInterval);

      // Wait for minimum duration
      const elapsed = Date.now() - contentStartTime;
      const remainingTime = Math.max(0, timingConfig.minStepDuration * 2 - elapsed);
      
      if (remainingTime > 0) {
        logger.debug(`[AppLoader] Content loaded quickly, waiting ${remainingTime}ms`);
        
        // Animate to 100% during wait
        const steps = Math.ceil(remainingTime / timingConfig.progressAnimationStep);
        for (let i = 0; i < steps; i++) {
          const progress = 80 + (20 * (i + 1)) / steps;
          updateTask("content", { progress: Math.round(progress) });
          updateTask("prayer-times", { progress: Math.round(progress) });
          updateTask("schedule", { progress: Math.round(Math.min(100, 60 + (40 * (i + 1)) / steps)) });
          await new Promise(resolve => setTimeout(resolve, timingConfig.progressAnimationStep));
        }
      }

      // Mark tasks complete
      updateTask("content", { status: "complete", progress: 100 });
      updateTask("prayer-times", { status: "complete", progress: 100 });
      updateTask("schedule", { status: "complete", progress: 100 });
      
      logger.info("[AppLoader] Content refresh complete");
    } catch (err: any) {
      logger.error("[AppLoader] Error loading content", { error: err });
      setError("Failed to load content. Using cached data.");
      
      // Mark as complete anyway to allow proceeding
      updateTask("content", { status: "complete", progress: 100 });
      updateTask("prayer-times", { status: "complete", progress: 100 });
      updateTask("schedule", { status: "skipped", progress: 100 });
    }
  }, [dispatch, updateTask, timingConfig]);

  /**
   * Prepare UI for display
   */
  const prepareUI = useCallback(async (): Promise<void> => {
    await runTaskWithMinDuration("ui-prep", async () => {
      logger.info("[AppLoader] Preparing UI...");
      // Brief actual preparation (the minimum time is enforced by wrapper)
      await new Promise(resolve => setTimeout(resolve, 100));
    }, timingConfig.minStepDuration);
  }, [runTaskWithMinDuration, timingConfig.minStepDuration]);

  /**
   * Ensure minimum splash duration has passed
   */
  const ensureMinSplashTime = useCallback(async () => {
    const elapsed = Date.now() - loadingStartTime.current;
    const remaining = timingConfig.minSplashDuration - elapsed;
    
    if (remaining > 0) {
      logger.info(`[AppLoader] Ensuring minimum splash time, waiting ${remaining}ms`);
      await new Promise(resolve => setTimeout(resolve, remaining));
    }
  }, [timingConfig.minSplashDuration]);

  /**
   * Main loading sequence
   */
  const startLoading = useCallback(async (): Promise<void> => {
    if (loadingInProgress.current) {
      logger.info("[AppLoader] Loading already in progress, skipping");
      return;
    }

    loadingInProgress.current = true;
    setLoadingStarted(true);
    setError(null);
    setPairingCodeReady(false);
    
    // Record start time for minimum splash duration
    loadingStartTime.current = Date.now();

    // Reset tasks
    setTasks(DEFAULT_TASKS.map((t) => ({ ...t, status: "pending", progress: 0 })));

    logger.info("[AppLoader] === Starting App Loading Sequence ===");
    dispatch(setInitializing(true));
    dispatch(setInitializationStage("checking"));
    dispatch(setLoadingMessage("Starting up..."));

    try {
      // Step 1: Check credentials (with minimum display time)
      const hasCredentials = await checkCredentials();

      // Step 2: Check network (with minimum display time)
      const hasNetwork = await checkNetwork();

      // If WiFi setup is needed, stop here (but ensure minimum splash time first)
      if (needsWiFiSetup) {
        await ensureMinSplashTime();
        setPhase("wifi-setup");
        dispatch(setInitializationStage("wifi-setup"));
        dispatch(setLoadingMessage("WiFi setup required"));
        loadingInProgress.current = false;
        return;
      }

      // Step 3: If no credentials, fetch pairing code BEFORE showing pairing screen
      if (!hasCredentials) {
        logger.info("[AppLoader] No credentials - fetching pairing code");
        setNeedsPairing(true);
        dispatch(setInitializationStage("pairing"));
        
        // Skip content tasks for pairing flow
        updateTask("content", { status: "skipped" });
        updateTask("prayer-times", { status: "skipped" });
        updateTask("schedule", { status: "skipped" });
        updateTask("ui-prep", { status: "skipped" });
        
        // Fetch pairing code while still showing loading screen
        const gotPairingCode = await fetchPairingCode();
        
        // Ensure minimum splash time has passed before transitioning
        await ensureMinSplashTime();
        
        if (gotPairingCode) {
          // Now we can show the pairing screen
          logger.info("[AppLoader] Transitioning to pairing screen");
          setPhase("pairing");
          dispatch(setLoadingMessage("Ready to pair"));
          dispatch(setInitializing(false));
        } else {
          // Error getting pairing code - stay on loading with error
          setPhase("startup");
          dispatch(setLoadingMessage("Failed to get pairing code"));
        }
        
        loadingInProgress.current = false;
        return;
      }

      // Step 4: Load content (authenticated user)
      // Skip pairing-code task for authenticated flow
      updateTask("pairing-code", { status: "skipped" });
      
      setPhase("loading");
      dispatch(setInitializationStage("fetching"));
      dispatch(setLoadingMessage("Loading your content..."));
      
      await loadContent();

      // Step 5: Prepare UI
      await prepareUI();

      // Ensure minimum splash time has passed before showing display
      await ensureMinSplashTime();

      // Complete!
      logger.info("[AppLoader] Transitioning to display");
      setPhase("ready");
      dispatch(setInitializationStage("ready"));
      dispatch(setInitializing(false));
      dispatch(setLoadingMessage("Ready"));
      
      logger.info("[AppLoader] === Loading Sequence Complete ===");
    } catch (err: any) {
      logger.error("[AppLoader] Loading sequence failed", { error: err });
      setError(err.message || "Loading failed");
    } finally {
      loadingInProgress.current = false;
    }
  }, [
    dispatch,
    checkCredentials,
    checkNetwork,
    fetchPairingCode,
    loadContent,
    prepareUI,
    updateTask,
    needsWiFiSetup,
    ensureMinSplashTime,
  ]);

  /**
   * Retry loading after an error
   */
  const retryLoading = useCallback(async (): Promise<void> => {
    setError(null);
    loadingInProgress.current = false;
    await startLoading();
  }, [startLoading]);

  /**
   * Update task completion based on Redux state changes
   */
  useEffect(() => {
    if (!loadingStarted || phase !== "loading") return;

    // Update content task based on screenContent
    if (screenContent !== null) {
      const contentTask = tasks.find(t => t.id === "content");
      if (contentTask && contentTask.status === "loading") {
        updateTask("content", { status: "complete", progress: 100 });
      }
    }

    // Update prayer times task
    if (prayerTimes !== null) {
      const prayerTask = tasks.find(t => t.id === "prayer-times");
      if (prayerTask && prayerTask.status === "loading") {
        updateTask("prayer-times", { status: "complete", progress: 100 });
      }
    }

    // Update schedule task
    if (schedule !== null) {
      const scheduleTask = tasks.find(t => t.id === "schedule");
      if (scheduleTask && scheduleTask.status === "loading") {
        updateTask("schedule", { status: "complete", progress: 100 });
      }
    } else if (!contentLoading && screenContent !== null) {
      // If content is done loading but no schedule, mark as skipped
      const scheduleTask = tasks.find(t => t.id === "schedule");
      if (scheduleTask && scheduleTask.status === "loading") {
        updateTask("schedule", { status: "skipped", progress: 100 });
      }
    }
  }, [screenContent, prayerTimes, schedule, contentLoading, loadingStarted, phase, updateTask, tasks]);

  /**
   * Auto-transition to ready when complete (for authenticated flow)
   */
  useEffect(() => {
    if (phase === "loading" && isComplete && isAuthenticated) {
      logger.info("[AppLoader] All tasks complete, transitioning to ready");
      
      // Ensure UI prep is complete
      const uiTask = tasks.find((t) => t.id === "ui-prep");
      if (!uiTask || uiTask.status === "pending") {
        prepareUI().then(() => {
          ensureMinSplashTime().then(() => {
            setPhase("ready");
            dispatch(setInitializationStage("ready"));
            dispatch(setInitializing(false));
          });
        });
      } else {
        ensureMinSplashTime().then(() => {
          setPhase("ready");
          dispatch(setInitializationStage("ready"));
          dispatch(setInitializing(false));
        });
      }
    }
  }, [phase, isComplete, isAuthenticated, tasks, prepareUI, dispatch, ensureMinSplashTime]);

  /**
   * Handle pairing completion - when user pairs successfully
   */
  useEffect(() => {
    if (phase === "pairing" && isAuthenticated && !isPairing) {
      logger.info("[AppLoader] Pairing completed, starting content load");
      setNeedsPairing(false);
      setPairingCodeReady(false);
      
      // Reset tasks for content loading
      setTasks((prev) =>
        prev.map((task) => {
          if (task.id === "credentials" || task.id === "network" || task.id === "pairing-code") {
            return { ...task, status: "complete", progress: 100 };
          }
          return { ...task, status: "pending", progress: 0 };
        })
      );
      
      // Reset loading start time for content loading phase
      loadingStartTime.current = Date.now();
      
      // Continue with content loading
      setPhase("loading");
      dispatch(setInitializationStage("fetching"));
      dispatch(setLoadingMessage("Loading your content..."));
      
      loadContent().then(() => {
        prepareUI();
      });
    }
  }, [phase, isAuthenticated, isPairing, loadContent, prepareUI, dispatch]);

  /**
   * Handle WiFi reconnection
   */
  useEffect(() => {
    if (phase === "wifi-setup" && wifiConnectionStatus === "connected") {
      logger.info("[AppLoader] WiFi connected, resuming loading");
      setNeedsWiFiSetup(false);
      loadingInProgress.current = false;
      startLoading();
    }
  }, [phase, wifiConnectionStatus, startLoading]);

  /**
   * Auto-start loading on mount
   */
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      startLoading();
    }
  }, [startLoading]);

  return {
    phase,
    overallProgress,
    currentTask,
    tasks,
    isComplete,
    needsWiFiSetup,
    needsPairing,
    hasPairingCode: pairingCodeReady || !!pairingCode,
    error,
    startLoading,
    retryLoading,
  };
}

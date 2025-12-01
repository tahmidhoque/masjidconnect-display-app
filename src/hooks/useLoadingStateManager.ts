import { useState, useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../store";
import logger from "../utils/logger";
import {
  getDevicePerformanceProfile,
  isHighStrainDevice,
} from "../utils/performanceUtils";

export type AppPhase =
  | "initializing" // App is starting up
  | "wifi-check" // Checking network connectivity
  | "wifi-setup" // WiFi configuration required
  | "checking" // Checking credentials
  | "pairing" // Showing pairing screen
  | "loading-content" // Loading display content
  | "preparing" // Content loaded, preparing display
  | "ready" // Display is ready to show
  | "displaying"; // Actively displaying content

interface LoadingStateManagerOptions {
  minimumLoadingDuration?: number;
  contentReadyDelay?: number;
  transitionDuration?: number;
}

interface LoadingStateManager {
  currentPhase: AppPhase;
  isLoading: boolean;
  shouldShowLoadingScreen: boolean;
  shouldShowDisplay: boolean;
  isTransitioning: boolean;
  progress: number;
  statusMessage: string;
  forcePhase: (phase: AppPhase) => void;
}

/**
 * Get performance-aware loading durations
 */
const getLoadingDurations = () => {
  const profile = getDevicePerformanceProfile();
  const isHighStrain = isHighStrainDevice();

  if (isHighStrain) {
    // Much faster loading for 4K RPi displays
    return {
      minimumLoadingDuration: 800,
      contentReadyDelay: 300,
      transitionDuration: 200,
    };
  } else if (profile.profile === "low") {
    // Slightly faster for low-power devices
    return {
      minimumLoadingDuration: 1500,
      contentReadyDelay: 600,
      transitionDuration: 400,
    };
  } else {
    // Standard durations for more powerful devices
    return {
      minimumLoadingDuration: 2500,
      contentReadyDelay: 1000,
      transitionDuration: 600,
    };
  }
};

/**
 * useLoadingStateManager - Unified loading state management
 *
 * Coordinates all loading states across the app to provide smooth,
 * predictable transitions without rapid state changes or flashing.
 * Enhanced with 4K display optimizations and better stability.
 */
export default function useLoadingStateManager(
  options: LoadingStateManagerOptions = {},
): LoadingStateManager {
  const performanceDurations = getLoadingDurations();
  const isHighStrain = isHighStrainDevice();

  const {
    minimumLoadingDuration = performanceDurations.minimumLoadingDuration,
    contentReadyDelay = performanceDurations.contentReadyDelay,
    transitionDuration = performanceDurations.transitionDuration,
  } = options;

  // Redux state
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated,
  );
  const isPairing = useSelector((state: RootState) => state.auth.isPairing);
  const pairingCode = useSelector((state: RootState) => state.auth.pairingCode);
  const isInitializing = useSelector(
    (state: RootState) => state.ui.isInitializing,
  );
  const initializationStage = useSelector(
    (state: RootState) => state.ui.initializationStage,
  );
  const contentLoading = useSelector(
    (state: RootState) => state.content.isLoading,
  );
  const screenContent = useSelector(
    (state: RootState) => state.content.screenContent,
  );
  const prayerTimes = useSelector(
    (state: RootState) => state.content.prayerTimes,
  );

  // CRITICAL FIX: Validate phase to ensure it's always valid
  const validatePhase = useCallback(
    (phase: AppPhase | undefined | null): AppPhase => {
      const validPhases: AppPhase[] = [
        "initializing",
        "wifi-check",
        "wifi-setup",
        "checking",
        "pairing",
        "loading-content",
        "preparing",
        "ready",
        "displaying",
      ];
      if (phase && validPhases.includes(phase)) {
        return phase;
      }
      logger.warn(
        "[LoadingStateManager] Invalid phase detected, resetting to initializing",
        {
          invalidPhase: phase,
        },
      );
      return "initializing";
    },
    [],
  );

  // Internal state - ensure phase is always valid
  const [currentPhase, setCurrentPhase] = useState<AppPhase>(() =>
    validatePhase("initializing"),
  );
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [shouldShowLoadingScreen, setShouldShowLoadingScreen] = useState(true);
  const [shouldShowDisplay, setShouldShowDisplay] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Starting up...");

  // Refs for timing control and debouncing
  const phaseStartTime = useRef<number>(Date.now());
  const transitionTimer = useRef<NodeJS.Timeout | null>(null);
  const contentReadyTimer = useRef<NodeJS.Timeout | null>(null);
  const forcePhaseRef = useRef<AppPhase | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const lastPhaseChangeTime = useRef<number>(Date.now());
  const pendingPhaseRef = useRef<AppPhase | null>(null);
  const failsafeTimer = useRef<NodeJS.Timeout | null>(null);

  // Check if we have minimum content to display
  const hasMinimumContent = useCallback(() => {
    return screenContent !== null || prayerTimes !== null;
  }, [screenContent, prayerTimes]);

  // Calculate progress based on current phase
  const calculateProgress = useCallback((phase: AppPhase) => {
    switch (phase) {
      case "initializing":
        return 5;
      case "wifi-check":
        return 8;
      case "wifi-setup":
        return 10;
      case "checking":
        return 20;
      case "pairing":
        return 35;
      case "loading-content":
        return 65;
      case "preparing":
        return 85;
      case "ready":
        return 95;
      case "displaying":
        return 100;
      default:
        return 0;
    }
  }, []);

  // Get status message for current phase
  const getStatusMessage = useCallback((phase: AppPhase) => {
    switch (phase) {
      case "initializing":
        return "Starting up...";
      case "wifi-check":
        return "Checking network connection...";
      case "wifi-setup":
        return "WiFi setup required";
      case "checking":
        return "Checking credentials...";
      case "pairing":
        return "Ready to pair";
      case "loading-content":
        return "Loading content...";
      case "preparing":
        return "Preparing display...";
      case "ready":
        return "Almost ready...";
      case "displaying":
        return "Connected";
      default:
        return "Loading...";
    }
  }, []);

  // Force a specific phase (for external control)
  const forcePhase = useCallback((phase: AppPhase) => {
    logger.info(`[LoadingStateManager] Force phase: ${phase}`);
    forcePhaseRef.current = phase;
  }, []);

  // Debounced phase transition to prevent rapid changes
  const transitionToPhaseDebounced = useCallback(
    (newPhase: AppPhase, skipMinimumDuration = false) => {
      const now = Date.now();
      const timeSinceLastChange = now - lastPhaseChangeTime.current;
      const minimumChangeInterval = 500; // Minimum time between phase changes

      // Clear any pending transitions
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      pendingPhaseRef.current = newPhase;

      const executeTransition = () => {
        const pendingPhase = pendingPhaseRef.current;
        if (!pendingPhase || pendingPhase === currentPhase) return;

        const currentTime = Date.now();
        const elapsedTime = currentTime - phaseStartTime.current;
        const minimumTimeRemaining = skipMinimumDuration
          ? 0
          : Math.max(0, minimumLoadingDuration - elapsedTime);

        logger.info(
          `[LoadingStateManager] Transitioning: ${currentPhase} -> ${pendingPhase}`,
          {
            elapsedTime,
            minimumTimeRemaining,
            skipMinimumDuration,
          },
        );

        const doTransition = () => {
          // CRITICAL FIX: Validate phase before setting
          const validatedPhase = validatePhase(pendingPhase);
          setIsTransitioning(true);
          setCurrentPhase(validatedPhase);
          setProgress(calculateProgress(validatedPhase));
          setStatusMessage(getStatusMessage(validatedPhase));
          phaseStartTime.current = Date.now();
          lastPhaseChangeTime.current = Date.now();

          // Handle specific phase transitions
          setTimeout(() => {
            setIsTransitioning(false);

            // Update display flags based on new phase
            if (
              pendingPhase === "pairing" ||
              pendingPhase === "wifi-setup"
            ) {
              // Pairing and WiFi setup screens are handled separately
              setShouldShowLoadingScreen(false);
              setShouldShowDisplay(false);
            } else if (pendingPhase === "wifi-check") {
              // Brief WiFi check phase - show loading
              setShouldShowLoadingScreen(true);
              setShouldShowDisplay(false);
            } else if (pendingPhase === "preparing") {
              // Auto-transition from preparing to ready
              setShouldShowLoadingScreen(true);
              setShouldShowDisplay(false);

              contentReadyTimer.current = setTimeout(() => {
                setCurrentPhase("ready");
                setProgress(95);
                setStatusMessage("Almost ready...");

                // Then transition to displaying
                setTimeout(() => {
                  setShouldShowLoadingScreen(false);
                  setShouldShowDisplay(true);
                  setCurrentPhase("displaying");
                  setProgress(100);
                  setStatusMessage("Connected");
                }, 800);
              }, 1000);
            } else if (pendingPhase === "ready") {
              // Direct transition to displaying from ready
              setShouldShowLoadingScreen(true);
              setShouldShowDisplay(false);

              contentReadyTimer.current = setTimeout(() => {
                setShouldShowLoadingScreen(false);
                setShouldShowDisplay(true);
                setCurrentPhase("displaying");
                setProgress(100);
                setStatusMessage("Connected");
              }, contentReadyDelay);
            } else if (pendingPhase === "displaying") {
              setShouldShowLoadingScreen(false);
              setShouldShowDisplay(true);
            } else {
              setShouldShowLoadingScreen(true);
              setShouldShowDisplay(false);
            }
          }, transitionDuration);
        };

        if (minimumTimeRemaining > 0) {
          transitionTimer.current = setTimeout(
            doTransition,
            minimumTimeRemaining,
          );
        } else {
          doTransition();
        }
      };

      // If enough time has passed since last change, execute immediately
      if (timeSinceLastChange >= minimumChangeInterval || skipMinimumDuration) {
        executeTransition();
      } else {
        // Otherwise, debounce it
        const delay = minimumChangeInterval - timeSinceLastChange;
        debounceTimer.current = setTimeout(executeTransition, delay);
      }
    },
    [
      currentPhase,
      minimumLoadingDuration,
      contentReadyDelay,
      transitionDuration,
      calculateProgress,
      getStatusMessage,
      validatePhase,
    ],
  );

  // Main phase determination logic with stability improvements
  useEffect(() => {
    // CRITICAL FIX: Validate current phase first
    const validatedCurrentPhase = validatePhase(currentPhase);
    if (validatedCurrentPhase !== currentPhase) {
      logger.warn(
        "[LoadingStateManager] Current phase was invalid, correcting",
        {
          invalid: currentPhase,
          corrected: validatedCurrentPhase,
        },
      );
      setCurrentPhase(validatedCurrentPhase);
    }

    // Check for forced phase first
    if (
      forcePhaseRef.current &&
      forcePhaseRef.current !== validatedCurrentPhase
    ) {
      const forcedPhase = validatePhase(forcePhaseRef.current);
      forcePhaseRef.current = null;
      transitionToPhaseDebounced(forcedPhase, true);
      return;
    }

    let targetPhase: AppPhase;

    // Determine target phase based on app state with better logic
    if (!isAuthenticated && !isPairing && !pairingCode) {
      // No authentication, not pairing
      if (isInitializing) {
        // Handle WiFi check/setup stages
        if (initializationStage === "wifi-check") {
          targetPhase = "wifi-check";
        } else if (initializationStage === "wifi-setup") {
          targetPhase = "wifi-setup";
        } else if (initializationStage === "checking") {
          targetPhase = "checking";
        } else {
          targetPhase = "initializing";
        }
      } else {
        // Not initializing - check for wifi-setup stage
        if (initializationStage === "wifi-setup") {
          targetPhase = "wifi-setup";
        } else {
          targetPhase = "checking";
        }
      }
    } else if (!isAuthenticated && (isPairing || pairingCode)) {
      // In pairing mode
      targetPhase = "pairing";
    } else if (isAuthenticated && (contentLoading || !hasMinimumContent())) {
      // Authenticated but content not ready
      // CRITICAL FIX: Don't show loading screen for routine prayer time updates
      if (currentPhase === "displaying" && hasMinimumContent()) {
        // If we're already displaying and have content, stay displaying
        // This prevents loading screen during routine prayer time updates
        targetPhase = "displaying";
        logger.debug(
          `[LoadingStateManager] Staying in display mode during routine update`,
          {
            contentLoading,
            hasContent: hasMinimumContent(),
            currentPhase,
          },
        );
      } else if (!contentLoading && hasMinimumContent()) {
        // CRITICAL FIX: If not loading and we have content, proceed to preparing
        // This handles the case after pairing completes
        targetPhase = "preparing";
        logger.info(
          "[LoadingStateManager] Content available after auth, proceeding to preparing",
        );
      } else {
        // Only show loading if we truly don't have content to display
        targetPhase = "loading-content";
      }
    } else if (isAuthenticated && hasMinimumContent()) {
      // Authenticated with content - ready to display
      if (currentPhase === "displaying") {
        targetPhase = "displaying"; // Stay displaying
      } else if (currentPhase === "ready") {
        targetPhase = "ready"; // Let the timer handle transition to displaying
      } else if (currentPhase === "preparing") {
        targetPhase = "preparing"; // Let the timer handle transition to ready
      } else {
        // CRITICAL FIX: Fast-track to preparing when authenticated with content
        targetPhase = "preparing";
        logger.info("[LoadingStateManager] Fast-tracking to preparing phase");
      }
    } else {
      // Fallback
      targetPhase = "checking";
    }

    // CRITICAL FIX: Validate target phase before transitioning
    const validatedTargetPhase = validatePhase(targetPhase);

    // Only transition if phase actually needs to change and we're not currently transitioning
    if (validatedTargetPhase !== validatedCurrentPhase && !isTransitioning) {
      logger.info(
        `[LoadingStateManager] Phase change needed: ${validatedCurrentPhase} -> ${validatedTargetPhase}`,
        {
          isAuthenticated,
          isPairing,
          pairingCode: !!pairingCode,
          isInitializing,
          initializationStage,
          contentLoading,
          hasContent: hasMinimumContent(),
        },
      );

      transitionToPhaseDebounced(validatedTargetPhase);
    }
  }, [
    isAuthenticated,
    isPairing,
    pairingCode,
    isInitializing,
    initializationStage,
    contentLoading,
    hasMinimumContent,
    currentPhase,
    isTransitioning,
    transitionToPhaseDebounced,
    validatePhase,
  ]);

  // CRITICAL FIX: Enhanced failsafe timeout to prevent infinite loading
  // Timeouts increased for RPi compatibility - slower hardware needs more time
  useEffect(() => {
    // Clear any existing failsafe
    if (failsafeTimer.current) {
      clearTimeout(failsafeTimer.current);
    }

    // Increased timeouts for RPi stability - slower hardware needs more time
    // High-strain (4K) displays get slightly shorter timeouts since they have optimisations
    const FAILSAFE_TIMEOUT = isHighStrain ? 10000 : 15000; // 10-15 seconds max
    const STUCK_PHASE_TIMEOUT = isHighStrain ? 20000 : 30000; // 20-30 seconds for stuck phases

    // If we're in a loading phase and have content and authentication, set a failsafe
    const loadingPhases: AppPhase[] = ["loading-content", "preparing", "ready"];
    if (
      loadingPhases.includes(currentPhase) &&
      isAuthenticated &&
      hasMinimumContent()
    ) {
      logger.info("[LoadingStateManager] Setting failsafe timeout", {
        currentPhase,
        timeout: FAILSAFE_TIMEOUT,
        isAuthenticated,
        hasContent: hasMinimumContent(),
        isHighStrain,
      });

      failsafeTimer.current = setTimeout(() => {
        logger.warn(
          "[LoadingStateManager] ⚠️ FAILSAFE TRIGGERED - Forcing transition to display",
          {
            currentPhase,
            isAuthenticated,
            hasContent: hasMinimumContent(),
            elapsedTime: Date.now() - phaseStartTime.current,
          },
        );

        // Force immediate transition to displaying
        setCurrentPhase("displaying");
        setShouldShowLoadingScreen(false);
        setShouldShowDisplay(true);
        setProgress(100);
        setStatusMessage("Connected");
      }, FAILSAFE_TIMEOUT);
    }

    // Also set failsafe for stuck initializing/checking phases
    const stuckPhases: AppPhase[] = ["initializing", "checking"];
    if (stuckPhases.includes(currentPhase)) {
      logger.info("[LoadingStateManager] Setting stuck phase failsafe", {
        currentPhase,
        timeout: STUCK_PHASE_TIMEOUT,
        isHighStrain,
      });

      failsafeTimer.current = setTimeout(() => {
        logger.warn(
          "[LoadingStateManager] ⚠️ STUCK PHASE FAILSAFE - Forcing recovery",
          {
            currentPhase,
            elapsedTime: Date.now() - phaseStartTime.current,
          },
        );

        // Force transition to checking phase to restart initialization
        setCurrentPhase("checking");
        setShouldShowLoadingScreen(true);
        setShouldShowDisplay(false);
        setProgress(20);
        setStatusMessage("Checking credentials...");
      }, STUCK_PHASE_TIMEOUT);
    }

    return () => {
      if (failsafeTimer.current) {
        clearTimeout(failsafeTimer.current);
      }
    };
  }, [currentPhase, isAuthenticated, hasMinimumContent, isHighStrain]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (transitionTimer.current) {
        clearTimeout(transitionTimer.current);
      }
      if (contentReadyTimer.current) {
        clearTimeout(contentReadyTimer.current);
      }
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (failsafeTimer.current) {
        clearTimeout(failsafeTimer.current);
      }
    };
  }, []);

  // CRITICAL FIX: Ensure returned phase is always valid
  const safeCurrentPhase = validatePhase(currentPhase);

  // Calculate derived loading state - be more conservative about when to hide loading
  const isLoading =
    safeCurrentPhase !== "displaying" &&
    safeCurrentPhase !== "pairing" &&
    safeCurrentPhase !== "wifi-setup";
  const actualShouldShowLoading =
    shouldShowLoadingScreen &&
    safeCurrentPhase !== "displaying" &&
    safeCurrentPhase !== "wifi-setup";
  const actualShouldShowDisplay =
    shouldShowDisplay && safeCurrentPhase === "displaying";

  return {
    currentPhase: safeCurrentPhase,
    isLoading,
    shouldShowLoadingScreen: actualShouldShowLoading,
    shouldShowDisplay: actualShouldShowDisplay,
    isTransitioning,
    progress,
    statusMessage,
    forcePhase,
  };
}

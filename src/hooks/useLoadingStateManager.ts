import { useState, useEffect, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../store";
import logger from "../utils/logger";
import {
  getDevicePerformanceProfile,
  isHighStrainDevice,
} from "../utils/performanceUtils";

/**
 * App phases - simplified from 9 to 5 essential states
 * These map to the visual states the user sees
 */
export type AppPhase =
  | "initializing" // Initial startup
  | "wifi-setup" // WiFi configuration required
  | "pairing" // Authentication required
  | "loading" // Data loading with progress
  | "displaying"; // Ready and showing content

/**
 * Configuration options for the loading state manager
 */
interface LoadingStateManagerOptions {
  transitionDuration?: number;
}

/**
 * Return type for the loading state manager
 */
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
 * Get performance-aware transition durations
 */
const getTransitionDuration = (): number => {
  const profile = getDevicePerformanceProfile();
  const isHighStrain = isHighStrainDevice();

  if (isHighStrain) {
    return 200; // Fast for 4K RPi
  } else if (profile.profile === "low") {
    return 400; // Moderate for low-power
  }
  return 600; // Standard for powerful devices
};

/**
 * useLoadingStateManager - Simplified loading state management
 *
 * This hook now focuses purely on UI transition states.
 * It derives its state from Redux and provides simple phase transitions.
 * 
 * The complex loading logic has been moved to useAppLoader.
 */
export default function useLoadingStateManager(
  options: LoadingStateManagerOptions = {}
): LoadingStateManager {
  const { transitionDuration = getTransitionDuration() } = options;

  const isHighStrain = useMemo(() => isHighStrainDevice(), []);

  // Redux state - single source of truth
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );
  const isPairing = useSelector((state: RootState) => state.auth.isPairing);
  const pairingCode = useSelector((state: RootState) => state.auth.pairingCode);
  const isInitializing = useSelector(
    (state: RootState) => state.ui.isInitializing
  );
  const initializationStage = useSelector(
    (state: RootState) => state.ui.initializationStage
  );
  const contentLoading = useSelector(
    (state: RootState) => state.content.isLoading
  );
  const screenContent = useSelector(
    (state: RootState) => state.content.screenContent
  );
  const prayerTimes = useSelector(
    (state: RootState) => state.content.prayerTimes
  );
  const loadingMessage = useSelector(
    (state: RootState) => state.ui.loadingMessage
  );

  // Local state for transitions
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [forcedPhase, setForcedPhase] = useState<AppPhase | null>(null);

  /**
   * Check if we have minimum content to display
   */
  const hasMinimumContent = useMemo(() => {
    return screenContent !== null || prayerTimes !== null;
  }, [screenContent, prayerTimes]);

  /**
   * Derive the current phase from Redux state
   */
  const derivedPhase = useMemo((): AppPhase => {
    // WiFi setup takes priority
    if (initializationStage === "wifi-setup") {
      return "wifi-setup";
    }

    // Not authenticated - show pairing
    if (!isAuthenticated && (isPairing || pairingCode)) {
      return "pairing";
    }

    // Not authenticated and not pairing - still initializing
    if (!isAuthenticated && !isPairing && !pairingCode) {
      if (isInitializing) {
        return "initializing";
      }
      return "pairing"; // Default to pairing if not authenticated
    }

    // Authenticated but loading content
    if (isAuthenticated && (contentLoading || !hasMinimumContent)) {
      return "loading";
    }

    // Authenticated with content - ready to display
    if (isAuthenticated && hasMinimumContent) {
      return "displaying";
    }

    // Default fallback
    return "initializing";
  }, [
    isAuthenticated,
    isPairing,
    pairingCode,
    isInitializing,
    initializationStage,
    contentLoading,
    hasMinimumContent,
  ]);

  /**
   * Current phase (with forced override support)
   */
  const currentPhase = forcedPhase || derivedPhase;

  /**
   * Calculate progress based on initialization stage and content loading
   */
  const progress = useMemo((): number => {
    switch (initializationStage) {
      case "start":
        return 5;
      case "wifi-check":
        return 10;
      case "wifi-setup":
        return 15;
      case "checking":
        return 25;
      case "welcome":
        return 35;
      case "pairing":
        return 40;
      case "fetching":
        // When fetching, base progress on what content we have
        let fetchProgress = 50;
        if (screenContent !== null) fetchProgress += 15;
        if (prayerTimes !== null) fetchProgress += 15;
        return Math.min(fetchProgress, 80);
      case "ready":
        return 95;
      default:
        // If displaying, we're at 100%
        if (currentPhase === "displaying") return 100;
        return 0;
    }
  }, [initializationStage, screenContent, prayerTimes, currentPhase]);

  /**
   * Status message based on phase and stage
   */
  const statusMessage = useMemo((): string => {
    // Use Redux loading message if available and meaningful
    if (loadingMessage && loadingMessage !== "Initializing...") {
      return loadingMessage;
    }

    switch (currentPhase) {
      case "initializing":
        return "Starting up...";
      case "wifi-setup":
        return "WiFi setup required";
      case "pairing":
        return "Ready to pair";
      case "loading":
        if (screenContent === null && prayerTimes === null) {
          return "Loading content...";
        }
        if (screenContent === null) {
          return "Loading screen content...";
        }
        if (prayerTimes === null) {
          return "Loading prayer times...";
        }
        return "Preparing display...";
      case "displaying":
        return "Connected";
      default:
        return "Loading...";
    }
  }, [currentPhase, loadingMessage, screenContent, prayerTimes]);

  /**
   * Derived boolean states
   */
  const isLoading = currentPhase !== "displaying" && currentPhase !== "pairing" && currentPhase !== "wifi-setup";
  const shouldShowLoadingScreen = currentPhase === "initializing" || currentPhase === "loading";
  const shouldShowDisplay = currentPhase === "displaying";

  /**
   * Force a specific phase (for external control)
   */
  const forcePhase = useCallback((phase: AppPhase) => {
    logger.info(`[LoadingStateManager] Force phase: ${phase}`);
    setForcedPhase(phase);
  }, []);

  /**
   * Clear forced phase when derived phase matches
   */
  useEffect(() => {
    if (forcedPhase && forcedPhase === derivedPhase) {
      setForcedPhase(null);
    }
  }, [forcedPhase, derivedPhase]);

  /**
   * Handle phase transitions with brief animation flag
   */
  useEffect(() => {
    if (isHighStrain) return; // Skip transitions for 4K

    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, transitionDuration);

    return () => clearTimeout(timer);
  }, [currentPhase, transitionDuration, isHighStrain]);

  /**
   * Log phase changes for debugging
   */
  useEffect(() => {
    logger.info("[LoadingStateManager] Phase changed:", {
      currentPhase,
      derivedPhase,
      forcedPhase,
      progress,
      isAuthenticated,
      hasMinimumContent,
      initializationStage,
    });
  }, [
    currentPhase,
    derivedPhase,
    forcedPhase,
    progress,
    isAuthenticated,
    hasMinimumContent,
    initializationStage,
  ]);

  return {
    currentPhase,
    isLoading,
    shouldShowLoadingScreen,
    shouldShowDisplay,
    isTransitioning,
    progress,
    statusMessage,
    forcePhase,
  };
}

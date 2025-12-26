import { useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store";
import {
  requestPairingCode,
  checkPairingStatus,
} from "../store/slices/authSlice";
import { refreshAllContent } from "../store/slices/contentSlice";
import {
  setInitializing,
  setInitializationStage,
  setLoadingMessage,
} from "../store/slices/uiSlice";
import {
  selectConnectionStatus,
} from "../store/slices/wifiSlice";
import logger from "../utils/logger";

/**
 * Simplified initialization stages
 */
export type InitStage =
  | "wifi-check"
  | "wifi-setup"
  | "checking"
  | "pairing"
  | "fetching"
  | "ready";

/**
 * useInitializationFlow - Orchestrates the app startup sequence
 * 
 * This hook has been simplified to focus on:
 * 1. Managing pairing code requests and polling
 * 2. Coordinating with useAppLoader for content loading
 * 3. Handling WiFi connection state changes
 * 
 * The heavy lifting of loading orchestration is now in useAppLoader.
 */
export default function useInitializationFlow() {
  const dispatch = useDispatch<AppDispatch>();

  // Redux state
  const { isAuthenticated, pairingCode, isPairingCodeExpired, isPairing } = useSelector(
    (state: RootState) => state.auth
  );
  const { initializationStage } = useSelector((state: RootState) => state.ui);
  const { screenContent, prayerTimes } = useSelector(
    (state: RootState) => state.content
  );
  const wifiConnectionStatus = useSelector(selectConnectionStatus);

  const stage = initializationStage as InitStage;

  // Refs for managing timers and state
  const pairingPollingActive = useRef(false);
  const pairingPollTimer = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);

  /**
   * Check if we have minimum required data
   */
  const hasMinimumData = useCallback(() => {
    if (isAuthenticated) {
      return screenContent !== null || prayerTimes !== null;
    }
    return true;
  }, [isAuthenticated, screenContent, prayerTimes]);

  /**
   * Request a pairing code
   */
  const requestNewPairingCode = useCallback(async () => {
    logger.info("[InitFlow] Requesting pairing code");
    dispatch(setLoadingMessage("Generating pairing code..."));

    try {
      await dispatch(requestPairingCode("LANDSCAPE"));
      dispatch(setLoadingMessage("Ready to pair"));
      dispatch(setInitializing(false));
    } catch (error) {
      logger.error("[InitFlow] Error requesting pairing code", { error });
      dispatch(setLoadingMessage("Failed to generate pairing code"));
    }
  }, [dispatch]);

  /**
   * Fetch content after authentication
   */
  const fetchContent = useCallback(async () => {
    logger.info("[InitFlow] Fetching content after authentication");
    dispatch(setLoadingMessage("Loading your content..."));
    dispatch(setInitializationStage("fetching"));

    try {
      // Load from cache first, then refresh from API
      await dispatch(refreshAllContent({ forceRefresh: false })).unwrap();
      
      logger.info("[InitFlow] Content loaded successfully");
      dispatch(setInitializationStage("ready"));
      dispatch(setLoadingMessage("Ready"));
      dispatch(setInitializing(false));
    } catch (error) {
      logger.error("[InitFlow] Error loading content", { error });
      // Still mark as ready - we can use cached content
      dispatch(setInitializationStage("ready"));
      dispatch(setLoadingMessage("Ready (using cached content)"));
      dispatch(setInitializing(false));
    }
  }, [dispatch]);

  /**
   * Poll for pairing status
   */
  const pollPairingStatus = useCallback(async (code: string) => {
    if (pairingPollingActive.current || !code || !isMounted.current) {
      return;
    }

    pairingPollingActive.current = true;
    logger.info("[InitFlow] Polling pairing status", { code });

    const poll = async () => {
      if (!isMounted.current || !pairingPollingActive.current) return;

      try {
        const result: any = await dispatch(checkPairingStatus(code));

        if (!isMounted.current) return;

        if (checkPairingStatus.fulfilled.match(result) && result.payload?.isPaired) {
          logger.info("[InitFlow] 🎉 Pairing successful!");
          pairingPollingActive.current = false;

          if (pairingPollTimer.current) {
            clearTimeout(pairingPollTimer.current);
            pairingPollTimer.current = null;
          }

          dispatch(setLoadingMessage("Pairing successful! Loading content..."));

          // Start content loading after brief success message
          setTimeout(() => {
            if (isMounted.current) {
              fetchContent();
            }
          }, 1000);
        } else if (pairingPollingActive.current && isMounted.current) {
          // Continue polling
          pairingPollTimer.current = setTimeout(poll, 4000);
        }
      } catch (error) {
        logger.error("[InitFlow] Pairing poll error", { error });
        if (pairingPollingActive.current && isMounted.current) {
          pairingPollTimer.current = setTimeout(poll, 5000);
        }
      }
    };

    // Start polling after initial delay
    pairingPollTimer.current = setTimeout(poll, 2000);
  }, [dispatch, fetchContent]);

  /**
   * Handle pairing code expiration
   */
  useEffect(() => {
    if (stage === "pairing" && isPairingCodeExpired) {
      logger.info("[InitFlow] Pairing code expired, requesting new one");
      requestNewPairingCode();
    }
  }, [stage, isPairingCodeExpired, requestNewPairingCode]);

  /**
   * Start pairing polling when we have a code
   */
  useEffect(() => {
    if (
      stage === "pairing" &&
      pairingCode &&
      !isPairingCodeExpired &&
      !pairingPollingActive.current &&
      !isAuthenticated
    ) {
      pollPairingStatus(pairingCode);
    }
  }, [stage, pairingCode, isPairingCodeExpired, isAuthenticated, pollPairingStatus]);

  /**
   * Handle transition to pairing mode
   */
  useEffect(() => {
    if (stage === "pairing" && !pairingCode && !isAuthenticated && isPairing) {
      requestNewPairingCode();
    }
  }, [stage, pairingCode, isAuthenticated, isPairing, requestNewPairingCode]);

  /**
   * Handle WiFi reconnection
   */
  useEffect(() => {
    if (stage === "wifi-setup" && wifiConnectionStatus === "connected") {
      logger.info("[InitFlow] WiFi connected, resuming initialization");
      dispatch(setInitializationStage("checking"));
      dispatch(setInitializing(true));
    }
  }, [stage, wifiConnectionStatus, dispatch]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      pairingPollingActive.current = false;

      if (pairingPollTimer.current) {
        clearTimeout(pairingPollTimer.current);
        pairingPollTimer.current = null;
      }
    };
  }, []);

  // Determine if WiFi setup is needed
  const needsWiFiSetup = stage === "wifi-setup";

  return {
    stage,
    needsWiFiSetup,
    hasMinimumData,
    requestNewPairingCode,
    fetchContent,
  };
}

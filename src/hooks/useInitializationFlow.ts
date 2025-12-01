import { useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store";
import {
  initializeFromStorage,
  requestPairingCode,
  checkPairingStatus,
} from "../store/slices/authSlice";
import { refreshAllContent } from "../store/slices/contentSlice";
import {
  setInitializing,
  setInitializationStage,
  setLoadingMessage,
} from "../store/slices/uiSlice";
import logger from "../utils/logger";

export type InitStage =
  | "checking"
  | "welcome"
  | "pairing"
  | "fetching"
  | "ready";

/**
 * useInitializationFlow manages the application startup sequence.
 * Optimized to work with the new loading state manager for smooth transitions.
 */
export default function useInitializationFlow() {
  const dispatch = useDispatch<AppDispatch>();

  // Redux state
  const { isAuthenticated, pairingCode, isPairingCodeExpired } = useSelector(
    (state: RootState) => state.auth,
  );
  const { initializationStage } = useSelector((state: RootState) => state.ui);
  const { isLoading, screenContent, prayerTimes } = useSelector(
    (state: RootState) => state.content,
  );

  const stage = initializationStage as InitStage;

  // Refs for managing timers and preventing rapid state changes
  const initializationStarted = useRef(false);
  const pairingPollingActive = useRef(false);
  const stageTransitionTimer = useRef<NodeJS.Timeout | null>(null);
  const contentFetchTimer = useRef<NodeJS.Timeout | null>(null);
  const pairingPollTimer = useRef<NodeJS.Timeout | null>(null);
  const initializationTimeout = useRef<NodeJS.Timeout | null>(null);

  // Debounced stage transition to prevent rapid changes
  const setStageDebounced = useCallback(
    (newStage: InitStage, message: string, delay = 0) => {
      if (stageTransitionTimer.current) {
        clearTimeout(stageTransitionTimer.current);
      }

      const doTransition = () => {
        logger.info(`[InitFlow] Stage transition: ${stage} -> ${newStage}`, {
          message,
        });
        dispatch(setInitializationStage(newStage));
        dispatch(setLoadingMessage(message));
      };

      if (delay > 0) {
        stageTransitionTimer.current = setTimeout(doTransition, delay);
      } else {
        doTransition();
      }
    },
    [dispatch, stage],
  );

  // Content fetching with improved error handling
  const fetchContent = useCallback(async () => {
    logger.info("[InitFlow] Starting content fetch sequence");

    setStageDebounced("fetching", "Loading your content...");

    try {
      // Add a small delay to ensure the loading state is visible
      await new Promise((resolve) => setTimeout(resolve, 500));

      logger.info("[InitFlow] Dispatching content refresh...");
      const result = await dispatch(
        refreshAllContent({ forceRefresh: true }),
      ).unwrap();

      logger.info("[InitFlow] Content refresh completed", { result });

      // CRITICAL FIX: Ensure content is actually loaded before proceeding
      // Wait a moment for Redux state to fully update, then verify we have content
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Clear the timer and transition to ready state immediately
      if (contentFetchTimer.current) {
        clearTimeout(contentFetchTimer.current);
        contentFetchTimer.current = null;
      }

      logger.info("[InitFlow] Content ready, transitioning to ready state");
      setStageDebounced("ready", "Ready");
      dispatch(setInitializing(false));
    } catch (error) {
      logger.error("[InitFlow] Error loading content:", { error });

      // Clear any existing timer
      if (contentFetchTimer.current) {
        clearTimeout(contentFetchTimer.current);
        contentFetchTimer.current = null;
      }

      // Still mark as ready to prevent getting stuck, but note the issue
      logger.warn(
        "[InitFlow] Proceeding to ready state despite error to prevent hang",
      );
      setStageDebounced("ready", "Ready (using cached content)");
      dispatch(setInitializing(false));
    }
  }, [dispatch, setStageDebounced]);

  // Check if we have minimum required data to show the display
  const hasMinimumData = useCallback(() => {
    if (isAuthenticated) {
      return screenContent !== null || prayerTimes !== null;
    }
    return true;
  }, [isAuthenticated, screenContent, prayerTimes]);

  // Enhanced credential checking with better persistence detection
  const checkCredentialsPersistence = useCallback(() => {
    logger.info("[InitFlow] === Credential Storage Check ===");

    // Check all possible credential storage formats
    const credentialSources = [
      {
        apiKey: localStorage.getItem("masjid_api_key"),
        screenId: localStorage.getItem("masjid_screen_id"),
        source: "masjid_*",
      },
      {
        apiKey: localStorage.getItem("apiKey"),
        screenId: localStorage.getItem("screenId"),
        source: "simple",
      },
    ];

    // Try JSON format
    try {
      const jsonCreds = localStorage.getItem("masjidconnect_credentials");
      if (jsonCreds) {
        const parsed = JSON.parse(jsonCreds);
        credentialSources.push({
          apiKey: parsed.apiKey,
          screenId: parsed.screenId,
          source: "JSON",
        });
      }
    } catch (error) {
      logger.warn("[InitFlow] Failed to parse JSON credentials:", { error });
    }

    // Find the first valid credential set
    for (const source of credentialSources) {
      if (source.apiKey && source.screenId) {
        logger.info(
          `[InitFlow] ✅ Found valid credentials from ${source.source} format`,
        );
        return true;
      }
    }

    logger.warn("[InitFlow] ❌ No valid credentials found");
    return false;
  }, []);

  // Start pairing process with better error handling
  const startPairingProcess = useCallback(async () => {
    logger.info("[InitFlow] Starting pairing process");

    setStageDebounced("pairing", "Preparing pairing...", 500);

    try {
      // Wait for stage transition, then request pairing code
      setTimeout(async () => {
        logger.info("[InitFlow] Requesting pairing code");
        dispatch(setLoadingMessage("Generating pairing code..."));

        await dispatch(requestPairingCode("LANDSCAPE"));

        setTimeout(() => {
          dispatch(setLoadingMessage("Ready to pair"));
          dispatch(setInitializing(false));
        }, 500);
      }, 1000);
    } catch (error) {
      logger.error("[InitFlow] Error starting pairing:", { error });
      setStageDebounced("pairing", "Pairing error - please refresh");
    }
  }, [dispatch, setStageDebounced]);

  // Pairing status polling with better control
  const startPairingPolling = useCallback(() => {
    if (pairingPollingActive.current || !pairingCode) return;

    pairingPollingActive.current = true;
    logger.info("[InitFlow] Starting pairing status polling");

    const poll = async () => {
      if (!pairingPollingActive.current) return;

      try {
        const res: any = await dispatch(checkPairingStatus(pairingCode));

        if (checkPairingStatus.fulfilled.match(res) && res.payload?.isPaired) {
          logger.info("[InitFlow] 🎉 Pairing successful!");

          // CRITICAL FIX: Immediately stop polling and clear all timers
          pairingPollingActive.current = false;
          if (pairingPollTimer.current) {
            clearTimeout(pairingPollTimer.current);
            pairingPollTimer.current = null;
          }

          dispatch(setLoadingMessage("Pairing successful! Loading content..."));

          // Start content loading after a brief success message display
          setTimeout(() => {
            fetchContent();
          }, 1000);
        } else if (pairingPollingActive.current) {
          // Continue polling
          pairingPollTimer.current = setTimeout(poll, 4000);
        }
      } catch (error) {
        logger.error("[InitFlow] Pairing polling error:", { error });
        if (pairingPollingActive.current) {
          pairingPollTimer.current = setTimeout(poll, 5000);
        }
      }
    };

    // Start polling after initial delay
    pairingPollTimer.current = setTimeout(poll, 3000);
  }, [pairingCode, dispatch, fetchContent]);

  // Main initialization effect
  useEffect(() => {
    if (initializationStarted.current) return;

    initializationStarted.current = true;
    logger.info("[InitFlow] === Starting App Initialization ===");

    // CRITICAL FIX: Set initialization timeout (max 15 seconds)
    const INITIALIZATION_TIMEOUT = 15000;
    initializationTimeout.current = setTimeout(() => {
      logger.error(
        "[InitFlow] 🚨 INITIALIZATION TIMEOUT - Forcing recovery after 15 seconds",
      );

      // Force initialization to complete
      dispatch(setInitializing(false));

      // If not authenticated, force pairing mode
      if (!isAuthenticated) {
        logger.warn(
          "[InitFlow] Not authenticated after timeout, forcing pairing",
        );
        startPairingProcess();
      } else {
        // If authenticated but no content, try to fetch content
        if (!hasMinimumData()) {
          logger.warn(
            "[InitFlow] Authenticated but no content after timeout, attempting content fetch",
          );
          fetchContent();
        } else {
          logger.info(
            "[InitFlow] Initialization timeout but app appears ready",
          );
        }
      }
    }, INITIALIZATION_TIMEOUT);

    const initializeApp = async () => {
      // Stage 1: Check credentials
      setStageDebounced("checking", "Checking credentials...");

      const hasStoredCredentials = checkCredentialsPersistence();

      // CRITICAL FIX: Clear any stale pairing codes if we have valid credentials
      if (hasStoredCredentials) {
        logger.info(
          "[InitFlow] Clearing any stale pairing codes since we have credentials",
        );
        localStorage.removeItem("pairingCode");
        localStorage.removeItem("pairingCodeExpiresAt");
        localStorage.removeItem("lastPairingCodeRequestTime");
      }

      try {
        // Wait minimum time to show checking stage
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const action: any = await dispatch(initializeFromStorage());

        // CRITICAL FIX: Clear timeout on successful initialization
        if (initializationTimeout.current) {
          clearTimeout(initializationTimeout.current);
          initializationTimeout.current = null;
        }

        if (action.payload?.credentials) {
          logger.info("[InitFlow] Authentication successful from storage");
          setStageDebounced("welcome", "Welcome back!", 500);

          // Start content loading after welcome message
          setTimeout(() => {
            fetchContent();
          }, 1200);
        } else {
          logger.info("[InitFlow] No valid credentials, starting pairing");
          startPairingProcess();
        }
      } catch (error) {
        logger.error("[InitFlow] Initialization error:", { error });

        // CRITICAL FIX: Clear timeout on error and attempt recovery
        if (initializationTimeout.current) {
          clearTimeout(initializationTimeout.current);
          initializationTimeout.current = null;
        }

        // Attempt to recover by clearing potentially corrupted state
        try {
          logger.warn(
            "[InitFlow] Attempting recovery by clearing potentially corrupted state",
          );
          // Clear only non-critical localStorage items
          const criticalKeys = [
            "masjid_api_key",
            "masjid_screen_id",
            "apiKey",
            "screenId",
            "masjidconnect_credentials",
            "masjidconnect-root",
          ];
          const allKeys = Object.keys(localStorage);
          allKeys.forEach((key) => {
            if (!criticalKeys.includes(key)) {
              localStorage.removeItem(key);
            }
          });
          logger.info("[InitFlow] Cleared non-critical localStorage items");
        } catch (recoveryError) {
          logger.error("[InitFlow] Recovery attempt failed", {
            error: recoveryError,
          });
        }

        startPairingProcess();
      }
    };

    initializeApp();
  }, [
    dispatch,
    fetchContent,
    startPairingProcess,
    checkCredentialsPersistence,
    setStageDebounced,
    isAuthenticated,
    hasMinimumData,
  ]);

  // Handle pairing code availability
  useEffect(() => {
    // CRITICAL FIX: Don't start pairing polling if already authenticated
    if (isAuthenticated) {
      logger.info("[InitFlow] Skipping pairing poll - already authenticated");
      return;
    }

    if (stage === "pairing" && pairingCode && !pairingPollingActive.current) {
      startPairingPolling();
    }
  }, [stage, pairingCode, isAuthenticated, startPairingPolling]);

  // Handle pairing code expiration
  useEffect(() => {
    if (stage === "pairing" && isPairingCodeExpired) {
      logger.info("[InitFlow] Pairing code expired, requesting new one");
      dispatch(setLoadingMessage("Refreshing pairing code..."));

      dispatch(requestPairingCode("LANDSCAPE")).then(() => {
        dispatch(setLoadingMessage("Ready to pair"));
      });
    }
  }, [stage, isPairingCodeExpired, dispatch]);

  // Content readiness validation
  useEffect(() => {
    if (
      stage === "ready" &&
      isAuthenticated &&
      isLoading &&
      !hasMinimumData()
    ) {
      logger.info(
        "[InitFlow] Content still loading, reverting to fetching state",
      );
      setStageDebounced("fetching", "Loading content...");
    }
  }, [stage, isAuthenticated, isLoading, hasMinimumData, setStageDebounced]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Cleanup all timers
      if (stageTransitionTimer.current) {
        clearTimeout(stageTransitionTimer.current);
      }
      if (contentFetchTimer.current) {
        clearTimeout(contentFetchTimer.current);
      }
      if (pairingPollTimer.current) {
        clearTimeout(pairingPollTimer.current);
      }
      if (initializationTimeout.current) {
        clearTimeout(initializationTimeout.current);
      }

      // Stop polling
      pairingPollingActive.current = false;
    };
  }, []);

  return { stage };
}

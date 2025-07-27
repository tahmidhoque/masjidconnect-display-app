import { useEffect, useCallback } from "react";
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
  setLoadingMessage 
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
 * It checks for saved credentials, handles pairing and polls for
 * success, then loads display content once authenticated.
 */
export default function useInitializationFlow() {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, pairingCode, isPairingCodeExpired } = useSelector(
    (state: RootState) => state.auth
  );
  const { initializationStage } = useSelector((state: RootState) => state.ui);
  const { isLoading, screenContent, prayerTimes } = useSelector(
    (state: RootState) => state.content
  );

  const stage = initializationStage as InitStage;

  const fetchContent = useCallback(async () => {
    dispatch(setInitializationStage("fetching"));
    dispatch(setLoadingMessage("Loading your content..."));
    
    try {
      logger.info('[InitFlow] Starting content fetch...');
      await dispatch(refreshAllContent({ forceRefresh: true })).unwrap();
      
      // Wait a moment for state to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      logger.info('[InitFlow] Content fetch completed');
      dispatch(setLoadingMessage("Ready"));
      dispatch(setInitializationStage("ready"));
      dispatch(setInitializing(false));
    } catch (error) {
      logger.error('[InitFlow] Error loading content:', { error });
      // Still mark as ready to prevent getting stuck, but show warning message
      dispatch(setLoadingMessage("Ready (some content may be cached)"));
      dispatch(setInitializationStage("ready"));
      dispatch(setInitializing(false));
    }
  }, [dispatch]);

  // Check if we have minimum required data to show the display
  const hasMinimumData = useCallback(() => {
    // For authenticated users, we should have at least screen content OR prayer times
    if (isAuthenticated) {
      return screenContent !== null || prayerTimes !== null;
    }
    return true; // For non-authenticated users (pairing), we don't need content data
  }, [isAuthenticated, screenContent, prayerTimes]);

  // Enhanced credential checking with better persistence detection
  const checkCredentialsPersistence = useCallback(() => {
    logger.info('[InitFlow] === Credential Storage Debug ===');
    
    // Log all localStorage entries related to credentials
    const allLocalStorageEntries = {
      'masjid_api_key': localStorage.getItem('masjid_api_key'),
      'masjid_screen_id': localStorage.getItem('masjid_screen_id'),
      'apiKey': localStorage.getItem('apiKey'),
      'screenId': localStorage.getItem('screenId'),
      'masjidconnect_credentials': localStorage.getItem('masjidconnect_credentials'),
      'isPaired': localStorage.getItem('isPaired'),
    };

    logger.info('[InitFlow] All credential-related localStorage entries:', allLocalStorageEntries);

    // Check all possible credential storage formats
    const credentialSources = [
      {
        apiKey: localStorage.getItem('masjid_api_key'),
        screenId: localStorage.getItem('masjid_screen_id'),
        source: 'masjid_*'
      },
      {
        apiKey: localStorage.getItem('apiKey'),
        screenId: localStorage.getItem('screenId'),
        source: 'simple'
      }
    ];

    // Try JSON format
    try {
      const jsonCreds = localStorage.getItem('masjidconnect_credentials');
      if (jsonCreds) {
        const parsed = JSON.parse(jsonCreds);
        credentialSources.push({
          apiKey: parsed.apiKey,
          screenId: parsed.screenId,
          source: 'JSON'
        });
      }
    } catch (error) {
      logger.warn('[InitFlow] Failed to parse JSON credentials:', { error });
    }

    // Log all credential sources found
    logger.info('[InitFlow] Credential sources found:', credentialSources);

    // Find the first valid credential set
    for (const source of credentialSources) {
      if (source.apiKey && source.screenId) {
        logger.info(`[InitFlow] ✅ Found valid credentials from ${source.source} format`, {
          apiKeyLength: source.apiKey.length,
          screenIdLength: source.screenId.length,
          apiKeyPreview: source.apiKey.substring(0, 8) + '...',
          screenIdPreview: source.screenId.substring(0, 8) + '...',
        });
        return true;
      }
    }

    logger.warn('[InitFlow] ❌ No valid credentials found in any format');
    return false;
  }, []);

  // Check local credentials on first load with improved logic
  useEffect(() => {
    let mounted = true;

    const initializeApp = async () => {
      if (!mounted) return;

      dispatch(setInitializationStage("checking"));
      dispatch(setLoadingMessage("Checking credentials..."));
      
      // First check if credentials exist in localStorage directly
      const hasStoredCredentials = checkCredentialsPersistence();
      
      // Also check Redux-Persist state
      logger.info('[InitFlow] Checking Redux persist state...');
      const persistRoot = localStorage.getItem('persist:root') || localStorage.getItem('persist:masjidconnect-root');
      if (persistRoot) {
        try {
          const parsed = JSON.parse(persistRoot);
          logger.info('[InitFlow] Redux persist root found:', {
            keys: Object.keys(parsed),
            authKeys: parsed.auth ? Object.keys(JSON.parse(parsed.auth)) : 'no auth'
          });
          
          if (parsed.auth) {
            const authState = JSON.parse(parsed.auth);
            logger.info('[InitFlow] Redux auth persist state:', {
              isAuthenticated: authState.isAuthenticated,
              isPaired: authState.isPaired,
              hasScreenId: !!authState.screenId,
              hasApiKey: !!authState.apiKey
            });
            
            // If Redux-Persist shows authenticated but localStorage doesn't have credentials,
            // copy them from Redux state to localStorage
            if (authState.isAuthenticated && authState.apiKey && authState.screenId && !hasStoredCredentials) {
              logger.info('[InitFlow] 🔄 Restoring credentials from Redux-Persist to localStorage');
              localStorage.setItem('masjid_api_key', authState.apiKey);
              localStorage.setItem('masjid_screen_id', authState.screenId);
              localStorage.setItem('apiKey', authState.apiKey);
              localStorage.setItem('screenId', authState.screenId);
              localStorage.setItem('masjidconnect_credentials', JSON.stringify({
                apiKey: authState.apiKey,
                screenId: authState.screenId
              }));
            }
          }
        } catch (error) {
          logger.warn('[InitFlow] Failed to parse Redux persist state:', { error });
        }
      } else {
        logger.warn('[InitFlow] No Redux persist root found');
      }
      
      if (hasStoredCredentials) {
        logger.info('[InitFlow] Credentials detected, initializing from storage...');
      } else {
        logger.warn('[InitFlow] No credentials detected in localStorage');
      }

      try {
        const action: any = await dispatch(initializeFromStorage());
        
        if (!mounted) return;

        logger.info('[InitFlow] initializeFromStorage result:', {
          hasCredentials: !!action.payload?.credentials,
          hasPairingData: !!action.payload?.pairingData,
          actionType: action.type
        });

        if (action.payload?.credentials) {
          logger.info('[InitFlow] Authentication successful, loading content...');
          dispatch(setLoadingMessage("Credentials found, loading content..."));
          fetchContent();
        } else {
          logger.info('[InitFlow] No valid credentials, starting pairing process...');
          // Smooth transition to pairing without intermediate "welcome" stage
          dispatch(setInitializationStage("pairing"));
          dispatch(setLoadingMessage("Preparing pairing..."));
          
          // Request pairing code after a brief delay to prevent flashing
          setTimeout(() => {
            if (mounted) {
              dispatch(setLoadingMessage("Generating pairing code..."));
              dispatch(requestPairingCode("LANDSCAPE")).then(() => {
                if (mounted) {
                  dispatch(setLoadingMessage("Ready to pair"));
                  dispatch(setInitializing(false)); // App is ready for pairing
                }
              });
            }
          }, 800); // Reduced delay to prevent long loading
        }
      } catch (error) {
        logger.error('[InitFlow] Error during initialization:', { error });
        if (mounted) {
          dispatch(setInitializationStage("pairing"));
          dispatch(setLoadingMessage("Initialization error, starting pairing..."));
        }
      }
    };

    initializeApp();

    return () => {
      mounted = false;
    };
  }, [dispatch, fetchContent, checkCredentialsPersistence]);

  // Watch for authentication state changes to transition from pairing to content loading
  useEffect(() => {
    logger.info('[InitFlow] Auth/Stage effect triggered', {
      stage,
      isAuthenticated,
      shouldTransition: stage === "pairing" && isAuthenticated
    });
    
    // If we're in pairing stage and authentication becomes successful, transition to content loading
    if (stage === "pairing" && isAuthenticated) {
      logger.info('[InitFlow] 🎉 Authentication successful during pairing, transitioning to content loading');
      dispatch(setInitializationStage("fetching"));
      dispatch(setLoadingMessage("Pairing successful! Loading content..."));
      fetchContent();
    }
  }, [stage, isAuthenticated, dispatch, fetchContent]);

  // Poll pairing status when waiting for pairing
  useEffect(() => {
    if (stage !== "pairing" || !pairingCode) return;
    
    let active = true;
    const poll = async () => {
      if (!active) return;
      
      const res: any = await dispatch(checkPairingStatus(pairingCode));
      
      logger.info('[InitFlow] Polling result', {
        fulfilled: checkPairingStatus.fulfilled.match(res),
        isPaired: res.payload?.isPaired,
        payload: res.payload
      });
      
      if (checkPairingStatus.fulfilled.match(res) && res.payload?.isPaired) {
        logger.info('[InitFlow] Pairing successful, loading content...');
        dispatch(setLoadingMessage("Pairing successful! Loading content..."));
        fetchContent();
      } else if (active) {
        setTimeout(poll, 5000);
      }
    };
    
    // Start polling after pairing code is established
    const timer = setTimeout(poll, 3000); // Increased delay for stability
    
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [stage, pairingCode, dispatch, fetchContent]);

  // Regenerate pairing code if it expires
  useEffect(() => {
    if (stage === "pairing" && isPairingCodeExpired) {
      dispatch(setLoadingMessage("Refreshing pairing code..."));
      dispatch(requestPairingCode("LANDSCAPE")).then(() => {
        dispatch(setLoadingMessage("Ready to pair"));
      });
    }
  }, [stage, isPairingCodeExpired, dispatch]);

  // Ensure we don't mark as ready too early if content is still loading
  useEffect(() => {
    if (stage === "ready" && isAuthenticated && isLoading && !hasMinimumData()) {
      logger.info('[InitFlow] Content still loading, reverting to fetching state');
      dispatch(setInitializationStage("fetching"));
      dispatch(setLoadingMessage("Loading content..."));
    }
  }, [stage, isAuthenticated, isLoading, hasMinimumData, dispatch]);

  // Prevent rapid stage transitions by debouncing stage changes
  useEffect(() => {
    let stageTransitionTimer: NodeJS.Timeout | undefined;
    
    // Clear any pending transitions when stage changes
    return () => {
      if (stageTransitionTimer) {
        clearTimeout(stageTransitionTimer);
      }
    };
  }, [stage]);

  return { stage };
}

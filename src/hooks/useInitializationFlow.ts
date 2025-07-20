import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store";
import {
  initializeFromStorage,
  requestPairingCode,
  checkPairingStatus,
} from "../store/slices/authSlice";
import { refreshAllContent } from "../store/slices/contentSlice";
import { setInitializing } from "../store/slices/uiSlice";

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
  const [stage, setStage] = useState<InitStage>("checking");

  const fetchContent = useCallback(async () => {
    setStage("fetching");
    await dispatch(refreshAllContent({ forceRefresh: true }));
    dispatch(setInitializing(false));
    setStage("ready");
  }, [dispatch]);

  // Check local credentials on first load
  useEffect(() => {
    dispatch(initializeFromStorage()).then((action: any) => {
      if (action.payload?.credentials) {
        fetchContent();
      } else {
        setStage("welcome");
        setTimeout(() => {
          dispatch(requestPairingCode("LANDSCAPE")).then(() => {
            setStage("pairing");
          });
        }, 1500);
      }
    });
  }, [dispatch, fetchContent]);

  // Poll pairing status when waiting for pairing
  useEffect(() => {
    if (stage !== "pairing" || !pairingCode) return;
    let active = true;
    const poll = async () => {
      if (!active) return;
      const res: any = await dispatch(checkPairingStatus(pairingCode));
      if (checkPairingStatus.fulfilled.match(res) && res.payload?.isPaired) {
        fetchContent();
      } else if (active) {
        setTimeout(poll, 5000);
      }
    };
    poll();
    return () => {
      active = false;
    };
  }, [stage, pairingCode, dispatch, fetchContent]);

  // regenerate pairing code if it expires
  useEffect(() => {
    if (stage === "pairing" && isPairingCodeExpired) {
      dispatch(requestPairingCode("LANDSCAPE"));
    }
  }, [stage, isPairingCodeExpired, dispatch]);

  return { stage };
}

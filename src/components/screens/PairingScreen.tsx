import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Container,
  Typography,
  Button,
  Fade,
  Paper,
  IconButton,
  Tooltip,
} from "@mui/material";
import { Refresh as RefreshIcon } from "@mui/icons-material";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../../store";

import {
  requestPairingCode,
  checkPairingStatus,
  clearPairingError,
} from "../../store/slices/authSlice";

import PairingScreenLayout from "./pairing/PairingScreenLayout";
import QRCodeDisplay from "./pairing/QRCodeDisplay";
import PairingInstructions from "./pairing/PairingInstructions";
import PairingCode from "./pairing/PairingCode";

import {
  reportError,
  ErrorCode,
  ErrorSeverity,
} from "../../store/slices/errorSlice";
import logger from "../../utils/logger";
import logoNoTextBlue from "../../assets/logos/logo-notext-blue.svg";
import { getAdminBaseUrl, getPairingUrl } from "../../utils/adminUrlUtils";

/**
 * PairingScreen Component
 *
 * Handles the pairing process for new devices by:
 * 1. Displaying a QR code with pairing instructions
 * 2. Polling the server to check if pairing has been completed
 * 3. Redirecting to the main display once paired
 *
 * Note: This is a non-interactive display, so the pairing is done through another device.
 */
export interface PairingScreenProps {
  onPairingComplete?: () => void;
}

const PairingScreen: React.FC<PairingScreenProps> = ({ onPairingComplete }) => {
  // Redux selectors
  const dispatch = useDispatch<AppDispatch>();
  const {
    pairingCode,
    pairingCodeExpiresAt,
    isPairingCodeExpired,
    pairingError,
    isRequestingPairingCode,
    isCheckingPairingStatus,
    isAuthenticated,
    isPaired,
  } = useSelector((state: RootState) => state.auth);

  // Local state
  const [fadeIn, setFadeIn] = useState<boolean>(false);
  const [pairingAttempts, setPairingAttempts] = useState<number>(0);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const requestInProgress = useRef<boolean>(false);
  const pollingRef = useRef<boolean>(false);

  // Track if component is mounted
  const isMounted = useRef<boolean>(true);

  // Add separate state for QR code loading
  const [isQrLoading, setIsQrLoading] = useState<boolean>(false);

  // Remove navigation effect since we use Redux state management for screen transitions
  // The useInitializationFlow hook handles the transition to "ready" state when authenticated

  // Handle refresh functionality
  const handleRefresh = useCallback(async () => {
    try {
      setIsQrLoading(true);
      requestInProgress.current = true;
      await dispatch(requestPairingCode("LANDSCAPE")); // Use default orientation
      setPairingAttempts((prev) => prev + 1);
    } catch (error: any) {
      // Show blocking network error overlay ONLY if this is the initial pairing attempt
      if (
        pairingAttempts === 0 &&
        error?.message?.includes("ERR_CONNECTION_REFUSED")
      ) {
        dispatch(
          reportError({
            code: ErrorCode.NET_CONNECTION_FAILED,
            message: "Unable to connect to the server",
            severity: ErrorSeverity.CRITICAL,
          })
        );
      }
    } finally {
      setIsQrLoading(false);
      requestInProgress.current = false;
    }
  }, [dispatch, pairingAttempts]);

  // Start polling for pairing status
  const startPolling = useCallback(
    async (code: string) => {
      if (pollingRef.current || !code) {
        console.log(
          "[PairingScreen] Polling already active or no code provided"
        );
        return;
      }

      console.log("[PairingScreen] Starting polling for code:", code);
      pollingRef.current = true;
      setIsPolling(true);

      try {
        const resultAction = await dispatch(checkPairingStatus(code));

        if (!isMounted.current) {
          console.log("[PairingScreen] Component unmounted during polling");
          return;
        }

        console.log("[PairingScreen] checkPairingStatus result:", {
          type: resultAction.type,
          payload: resultAction.payload,
          meta: resultAction.meta,
        });

        // Check if the action was fulfilled and pairing was actually successful
        if (
          checkPairingStatus.fulfilled.match(resultAction) &&
          resultAction.payload?.isPaired === true
        ) {
          console.log("[PairingScreen] Device paired successfully!");
          pollingRef.current = false;
          setIsPolling(false);

          // Call the onPairingComplete callback if provided
          if (onPairingComplete) {
            console.log("[PairingScreen] Calling onPairingComplete callback");
            onPairingComplete();
          }

          // Screen transition is now handled by useInitializationFlow automatically
          // But let's also log the current auth state to verify
          console.log(
            "[PairingScreen] Pairing complete - checking current auth state"
          );
        } else {
          console.log(
            "[PairingScreen] Device not yet paired, continuing to poll...",
            {
              actionFulfilled: checkPairingStatus.fulfilled.match(resultAction),
              isPaired: (resultAction.payload as any)?.isPaired,
              payload: resultAction.payload,
            }
          );
          pollingRef.current = false; // Allow next poll
          setTimeout(() => {
            if (isMounted.current && !pollingRef.current) {
              startPolling(code);
            }
          }, 5000); // Poll every 5 seconds
        }
      } catch (error) {
        console.error("[PairingScreen] Error during polling:", error);
        pollingRef.current = false;
        setIsPolling(false);

        if (isMounted.current) {
          dispatch(
            reportError({
              code: ErrorCode.AUTH_PAIRING_FAILED,
              message: "Failed to check pairing status",
              severity: ErrorSeverity.MEDIUM,
            })
          );

          // Retry after delay
          setTimeout(() => {
            if (isMounted.current && !pollingRef.current) {
              startPolling(code);
            }
          }, 10000); // Retry after 10 seconds on error
        }
      }
    },
    [dispatch, onPairingComplete]
  );

  // Request a new code if the current one expires
  useEffect(() => {
    if (
      isPairingCodeExpired &&
      !isRequestingPairingCode &&
      !pollingRef.current &&
      !requestInProgress.current
    ) {
      console.log(
        "[PairingScreen] Detected expired code, requesting a new one"
      );
      handleRefresh();
    }
  }, [isPairingCodeExpired, isRequestingPairingCode, handleRefresh]);

  // Initial pairing code request on mount
  useEffect(() => {
    console.log("[PairingScreen] Component mounted");

    // Set mounted flag and animate in immediately
    isMounted.current = true;
    setFadeIn(true);

    // If we already have a valid pairing code, start polling
    if (pairingCode && !isPairingCodeExpired) {
      console.log(
        "[PairingScreen] Valid pairing code exists, will start polling"
      );

      // Start polling after a reasonable delay
      const pollTimer = setTimeout(() => {
        if (isMounted.current && !pollingRef.current) {
          startPolling(pairingCode);
        }
      }, 2000);

      return () => {
        clearTimeout(pollTimer);
        isMounted.current = false;
        pollingRef.current = false;
      };
    }

    // If no pairing code, the initialization flow will handle requesting one
    console.log(
      "[PairingScreen] Waiting for pairing code from initialization flow..."
    );

    return () => {
      isMounted.current = false;
      pollingRef.current = false;
    };
  }, []); // Empty dependency array - only run once on mount

  // Start polling when we have a valid code but aren't polling
  useEffect(() => {
    // Only start polling if we have all the right conditions
    if (
      pairingCode &&
      !isPairingCodeExpired &&
      !pollingRef.current &&
      !isRequestingPairingCode &&
      !requestInProgress.current &&
      isMounted.current
    ) {
      console.log("[PairingScreen] Auto-starting polling with valid code");

      const timer = setTimeout(() => {
        if (isMounted.current && !pollingRef.current) {
          startPolling(pairingCode);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [
    pairingCode,
    isPairingCodeExpired,
    isRequestingPairingCode,
    startPolling,
  ]);

  // Cleanup effect to ensure polling stops when component unmounts
  useEffect(() => {
    return () => {
      console.log("[PairingScreen] Cleanup - stopping all polling");
      pollingRef.current = false;
      setIsPolling(false);
      isMounted.current = false;
    };
  }, []);

  // Handle pairing errors
  useEffect(() => {
    if (pairingError) {
      // Show on-brand error overlay
      dispatch(
        reportError({
          code: ErrorCode.API_SERVER_DOWN,
          message: pairingError,
          severity: ErrorSeverity.MEDIUM,
          source: "PairingScreen",
          metadata: { pairingError },
        })
      );

      // Only request a new code if the error is about an expired code
      if (
        pairingError.includes("expired") &&
        !isRequestingPairingCode &&
        !requestInProgress.current
      ) {
        setTimeout(() => {
          if (
            isMounted.current &&
            !requestInProgress.current &&
            !isRequestingPairingCode
          ) {
            handleRefresh();
          }
        }, 3000);
      }
    }
  }, [pairingError, dispatch, handleRefresh, isRequestingPairingCode]);

  // Generate the QR code URL for pairing
  const qrCodeUrl = pairingCode ? getPairingUrl(pairingCode) : "";

  // Get the admin base URL for instructions
  const adminBaseUrl = getAdminBaseUrl();

  // Left section (instructions)
  const leftSection = <PairingInstructions adminBaseUrl={adminBaseUrl} />;

  // Right section (pairing code and QR code)
  const rightSection = (
    <>
      <PairingCode
        pairingCode={pairingCode}
        expiresAt={pairingCodeExpiresAt}
        isExpired={isPairingCodeExpired}
        onRefresh={handleRefresh}
        isLoading={isRequestingPairingCode}
      />

      <QRCodeDisplay
        qrCodeUrl={qrCodeUrl}
        pairingCode={pairingCode}
        isPairing={isQrLoading} // Use specific QR loading state
        logoSrc={logoNoTextBlue}
        adminBaseUrl={adminBaseUrl}
      />
    </>
  );

  // If already authenticated, redirect to the main screen
  useEffect(() => {
    if (isAuthenticated && isPaired) {
      // Screen transition is now handled by useInitializationFlow automatically
    }
  }, [isAuthenticated, isPaired]);

  return (
    <PairingScreenLayout
      orientation="LANDSCAPE"
      fadeIn={fadeIn}
      leftSection={leftSection}
      rightSection={rightSection}
    />
  );
};

export default PairingScreen;

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Typography, Grid, Paper, Box, Alert } from "@mui/material";
import { useSnackbar } from "notistack";
import QRCodeDisplay from "./pairing/QRCodeDisplay";
import PairingCode from "./pairing/PairingCode";
import PairingInstructions from "./pairing/PairingInstructions";
import PairingScreenLayout from "./pairing/PairingScreenLayout";
// Remove context imports and replace with Redux
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store";
import {
  requestPairingCode,
  checkPairingStatus,
  clearPairingError,
} from "../../store/slices/authSlice";
import {
  reportError,
  ErrorCode,
  ErrorSeverity,
} from "../../store/slices/errorSlice";
import logger from "../../utils/logger";
import logoNoTextBlue from "../../assets/logos/logo-notext-blue.svg";
import { getAdminBaseUrl, getPairingUrl } from "../../utils/adminUrlUtils";

/**
 * The Pairing Screen component
 *
 * This screen is shown when the display is not yet paired with a masjid.
 * It shows pairing instructions and a QR code that administrators need to scan
 * to pair this display with their masjid account.
 *
 * Note: This is a non-interactive display, so the pairing is done through another device.
 */
interface PairingScreenProps {
  onPairingSuccess?: () => void;
}

const PairingScreen: React.FC<PairingScreenProps> = ({ onPairingSuccess }) => {
  // Redux selectors
  const dispatch = useDispatch<AppDispatch>();
  const {
    isPairing,
    pairingError,
    pairingCode,
    pairingCodeExpiresAt,
    isPairingCodeExpired,
    isAuthenticated,
    isPaired,
    isRequestingPairingCode,
    isCheckingPairingStatus,
  } = useSelector((state: RootState) => state.auth);

  const orientation = useSelector((state: RootState) => state.ui.orientation);

  const [fadeIn, setFadeIn] = useState<boolean>(false);
  const [pairingAttempts, setPairingAttempts] = useState<number>(0);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const requestInProgress = useRef<boolean>(false);
  const pollingRef = useRef<boolean>(false);
  const navigate = useNavigate();

  // Track if component is mounted
  const isMounted = useRef<boolean>(true);

  // Add separate state for QR code loading
  const [isQrLoading, setIsQrLoading] = useState<boolean>(false);

  // Navigation effect to redirect when authentication is successful
  useEffect(() => {
    if (isAuthenticated && isPaired) {
      console.log(
        "[PairingScreen] Authentication successful, redirecting to display screen"
      );
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, isPaired, navigate]);

  // Start polling for pairing status
  const startPolling = useCallback(
    async (code: string) => {
      if (pollingRef.current || !code) return;

      pollingRef.current = true;
      setIsPolling(true);
      console.log("[PairingScreen] Starting to poll for pairing status...");

      try {
        const resultAction = await dispatch(checkPairingStatus(code));

        if (!isMounted.current) return;

        // Check if the action was fulfilled and pairing was successful
        if (
          checkPairingStatus.fulfilled.match(resultAction) &&
          resultAction.payload
        ) {
          console.log("[PairingScreen] Device paired successfully!");
          pollingRef.current = false;
          setIsPolling(false);

          // Call the onPairingSuccess callback if provided
          if (onPairingSuccess) {
            console.log("[PairingScreen] Calling onPairingSuccess callback");
            onPairingSuccess();
          }

          // Navigate to the display screen
          navigate("/", { replace: true });
        } else {
          console.log(
            "[PairingScreen] Device not yet paired, continuing to poll..."
          );
          // Continue polling with a timeout
          setTimeout(() => {
            if (pollingRef.current && isMounted.current) {
              startPolling(code);
            }
          }, 3000); // Poll every 3 seconds
        }
      } catch (error) {
        console.error("[PairingScreen] Error checking pairing status:", error);
        pollingRef.current = false;
        setIsPolling(false);
      }
    },
    [dispatch, navigate, onPairingSuccess]
  );

  // Enhanced handleRefresh for initial pairing
  const handleRefresh = useCallback(async () => {
    try {
      setIsQrLoading(true);
      requestInProgress.current = true;
      await dispatch(requestPairingCode(orientation));
      setPairingAttempts((prev) => prev + 1);
    } catch (error: any) {
      // Show blocking network error overlay ONLY if this is the initial pairing attempt
      if (
        pairingAttempts === 0 &&
        error?.message?.includes("ERR_CONNECTION_REFUSED")
      ) {
        dispatch(
          reportError({
            code: ErrorCode.NET_OFFLINE,
            message:
              "Unable to connect to the MasjidConnect server. Please check your internet connection or try again later.",
            severity: ErrorSeverity.HIGH,
            source: "PairingScreen",
            metadata: {
              attemptedUrl: "http://localhost:3000",
              time: new Date().toISOString(),
              error: error?.message,
            },
          })
        );
      } else {
        // Non-blocking error for retries or other errors
        dispatch(
          reportError({
            code: ErrorCode.API_SERVER_DOWN,
            message: "Failed to request pairing code. Please try again.",
            severity: ErrorSeverity.MEDIUM,
            source: "PairingScreen",
            metadata: { error: error instanceof Error ? error.message : error },
          })
        );
      }
    } finally {
      setIsQrLoading(false);
      requestInProgress.current = false;
    }
  }, [dispatch, orientation, pairingAttempts]);

  // Request a new code if the current one expires
  useEffect(() => {
    if (
      isPairingCodeExpired &&
      !isPairing &&
      !pollingRef.current &&
      !requestInProgress.current
    ) {
      console.log(
        "[PairingScreen] Detected expired code, requesting a new one"
      );
      handleRefresh();
    }
  }, [isPairingCodeExpired, isPairing, handleRefresh]);

  // Initial pairing code request on mount
  useEffect(() => {
    console.log("[PairingScreen] Initial mount useEffect");
    let isMounted = true;

    // Check if we already have a valid pairing code before doing anything
    if (pairingCode && !isPairingCodeExpired) {
      console.log(
        "[PairingScreen] Already have a valid pairing code, skipping request"
      );
      // Start polling with existing code
      if (pairingCode && !pollingRef.current) {
        console.log("[PairingScreen] Starting polling with existing code");
        setTimeout(() => {
          if (isMounted) {
            startPolling(pairingCode);
          }
        }, 2000);
      }
      // Just animate and return
      setTimeout(() => {
        if (isMounted) {
          setFadeIn(true);
        }
      }, 300);
      return () => {
        isMounted = false;
      };
    }

    const initiatePairing = async () => {
      if (!isMounted) return;

      // Prevent multiple simultaneous requests
      if (requestInProgress.current) {
        console.log("[PairingScreen] Request already in progress, skipping");
        return;
      }

      // Only request a new pairing code if we need one
      if (
        (!pairingCode || isPairingCodeExpired) &&
        !isPairing &&
        !pollingRef.current
      ) {
        console.log(
          "[PairingScreen] Will initiate pairing process after delay..."
        );

        // Add a delay before requesting a pairing code to prevent rapid requests
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!isMounted) return;

        console.log("[PairingScreen] Initiating pairing process...");
        // Increment pairing attempts before making the request
        setPairingAttempts((prev) => prev + 1);

        try {
          requestInProgress.current = true;
          setIsQrLoading(true); // Set QR loading state to true when requesting code
          console.log(
            "[PairingScreen] Requesting pairing code with orientation:",
            orientation
          );
          const resultAction = await dispatch(requestPairingCode(orientation));

          // Check if the action was rejected
          if (requestPairingCode.rejected.match(resultAction)) {
            console.log(
              "[PairingScreen] Pairing code request was rejected:",
              resultAction.payload
            );
            throw new Error(resultAction.payload as string);
          }

          if (requestPairingCode.fulfilled.match(resultAction)) {
            console.log("[PairingScreen] Pairing code received");
          }
          requestInProgress.current = false;
          setIsQrLoading(false); // Clear QR loading state after code is received

          if (requestPairingCode.fulfilled.match(resultAction) && isMounted) {
            console.log(
              "[PairingScreen] Pairing code received:",
              resultAction.payload.pairingCode
            );
          } else {
            console.warn("[PairingScreen] Failed to get a valid pairing code");
          }
        } catch (error: any) {
          console.error("[PairingScreen] Error in pairing process:", error);
          console.log("[PairingScreen] Error details:", {
            message: error?.message,
            pairingAttempts,
            isConnectionRefused: error?.message?.includes(
              "ERR_CONNECTION_REFUSED"
            ),
            isNetworkError: error?.message?.includes("Network Error"),
          });
          requestInProgress.current = false;
          setIsQrLoading(false); // Clear QR loading state on error

          // Show blocking network error overlay for initial pairing attempt
          if (
            pairingAttempts === 0 &&
            (error?.message?.includes("ERR_CONNECTION_REFUSED") ||
              error?.message?.includes("Network Error"))
          ) {
            console.log(
              "[PairingScreen] Dispatching HIGH severity network error overlay"
            );
            dispatch(
              reportError({
                code: ErrorCode.NET_OFFLINE,
                message:
                  "Unable to connect to the MasjidConnect server. Please check your internet connection or try again later.",
                severity: ErrorSeverity.HIGH,
                source: "PairingScreen",
                metadata: {
                  attemptedUrl: "http://localhost:3000",
                  time: new Date().toISOString(),
                  error: error?.message,
                },
              })
            );
          } else {
            console.log("[PairingScreen] Dispatching MEDIUM severity error");
            // Non-blocking error for retries or other errors
            dispatch(
              reportError({
                code: ErrorCode.API_SERVER_DOWN,
                message: "Failed to request pairing code. Please try again.",
                severity: ErrorSeverity.MEDIUM,
                source: "PairingScreen",
                metadata: {
                  error: error instanceof Error ? error.message : error,
                },
              })
            );
          }
        }
      }
    };

    // Start the pairing process with a delay
    console.log("[PairingScreen] Will start pairing process after delay...");
    const startupTimer = setTimeout(() => {
      if (isMounted) {
        console.log("[PairingScreen] Starting pairing process after delay...");
        initiatePairing();
      }
    }, 1000);

    // Animate elements
    setTimeout(() => {
      if (isMounted) {
        setFadeIn(true);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(startupTimer);
      // Clean up polling on unmount
      pollingRef.current = false;
    };
  }, [
    pairingCode,
    isPairingCodeExpired,
    isPairing,
    orientation,
    dispatch,
    startPolling,
  ]);

  // Start polling when we have a valid code but aren't polling
  useEffect(() => {
    // Add a debounce to prevent rapid polling starts
    let pollingTimer: NodeJS.Timeout | null = null;

    if (
      pairingCode &&
      !pollingRef.current &&
      !isPairing &&
      !requestInProgress.current
    ) {
      console.log(
        "[PairingScreen] We have a valid code but not polling, will start polling after delay..."
      );

      // Add a delay before starting polling to prevent rapid requests
      pollingTimer = setTimeout(() => {
        if (
          pairingCode &&
          !pollingRef.current &&
          !isPairing &&
          !requestInProgress.current
        ) {
          console.log("[PairingScreen] Starting polling after delay");
          startPolling(pairingCode);
        }
      }, 2000); // 2 second delay
    }

    // Clean up timer on unmount or when dependencies change
    return () => {
      if (pollingTimer) {
        clearTimeout(pollingTimer);
      }
    };
  }, [pairingCode, isPairing, startPolling]);

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
        !isPairing &&
        !requestInProgress.current
      ) {
        setTimeout(() => {
          if (isMounted.current && !requestInProgress.current && !isPairing) {
            handleRefresh();
          }
        }, 3000);
      }
    }
  }, [pairingError, dispatch, handleRefresh, isPairing]);

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
        isLoading={isPairing}
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

  // Force authentication if credentials already exist in localStorage
  useEffect(() => {
    const alreadyChecked = localStorage.getItem("credentials_check_done");
    if (alreadyChecked === "true") {
      return; // Skip if we've already done this check in this session
    }

    console.log(
      "[PairingScreen] Checking if credentials already exist in localStorage"
    );

    // Check for credentials in any format
    const apiKey =
      localStorage.getItem("masjid_api_key") || localStorage.getItem("apiKey");
    const screenId =
      localStorage.getItem("masjid_screen_id") ||
      localStorage.getItem("screenId");

    if (apiKey && screenId) {
      console.log(
        "[PairingScreen] Found existing credentials, forcing authentication"
      );

      // Credentials found - authentication will be handled by Redux initialization
      // The redirect will happen via the useEffect above

      // Redirect to the main display screen
      navigate("/", { replace: true });

      // Mark that we've done this check to avoid loops
      localStorage.setItem("credentials_check_done", "true");
    } else {
      console.log("[PairingScreen] No existing credentials found");
      localStorage.setItem("credentials_check_done", "true");
    }
  }, [dispatch, navigate]);

  // If already authenticated, redirect to the main screen
  useEffect(() => {
    if (isAuthenticated && isPaired) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, isPaired, navigate]);

  return (
    <PairingScreenLayout
      orientation={orientation}
      fadeIn={fadeIn}
      leftSection={leftSection}
      rightSection={rightSection}
    />
  );
};

export default PairingScreen;

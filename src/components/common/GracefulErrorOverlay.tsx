import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Fade,
  LinearProgress,
  Chip,
  useTheme,
  alpha,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store";
import {
  startRecovery,
  completeRecovery,
  testNetworkConnectivity,
  selectCurrentError,
  selectIsRecovering,
  ErrorCode,
  ErrorSeverity,
  ErrorCategory,
} from "../../store/slices/errorSlice";
import IslamicPatternBackground from "./IslamicPatternBackground";
import { refreshAllContent } from "../../store/slices/contentSlice";
import logger from "../../utils/logger";

interface GracefulErrorOverlayProps {
  position?: "center" | "top" | "bottom";
  autoHide?: boolean;
  maxWidth?: number;
}

/**
 * GracefulErrorOverlay - Shows user-friendly error messages with automatic recovery
 *
 * Displays errors in an on-brand overlay with Islamic pattern background.
 * Provides automatic recovery actions - no user interaction required.
 */
const GracefulErrorOverlay: React.FC<GracefulErrorOverlayProps> = ({
  position = "center",
  autoHide = true,
  maxWidth = 600,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch<AppDispatch>();

  // Redux selectors
  const currentError = useSelector(selectCurrentError);
  const isRecovering = useSelector(selectIsRecovering);
  const networkStatus = useSelector(
    (state: RootState) => state.errors.networkStatus
  );

  // Local state
  const [isVisible, setIsVisible] = useState(false);
  const [recoveryProgress, setRecoveryProgress] = useState(0);
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(
    null
  );

  // Handle recovery actions
  const handleRecovery = async () => {
    if (!currentError) return;

    dispatch(startRecovery());
    setRecoveryProgress(10);

    try {
      let success = false;

      // Different recovery actions based on error code
      switch (currentError.code) {
        case ErrorCode.NET_OFFLINE:
        case ErrorCode.NET_CONNECTION_FAILED:
          // Test network connectivity
          const result = await dispatch(testNetworkConnectivity());
          success = testNetworkConnectivity.fulfilled.match(result);
          break;

        case ErrorCode.DATA_PRAYER_TIMES_MISSING:
        case ErrorCode.DATA_CONTENT_MISSING:
        case ErrorCode.DATA_SYNC_FAILED:
          // Refresh content
          await dispatch(refreshAllContent({ forceRefresh: true }));
          success = true;
          break;

        case ErrorCode.SYS_MEMORY_EXCEEDED:
          // Trigger garbage collection and optimization
          if (window.gc) {
            window.gc();
          }
          success = true;
          break;

        case ErrorCode.AUTH_TOKEN_EXPIRED:
        case ErrorCode.AUTH_INVALID_TOKEN:
          // Clear credentials and redirect to pairing
          localStorage.removeItem("masjid_api_key");
          localStorage.removeItem("masjid_screen_id");
          window.location.href = "/pair";
          success = true;
          break;

        default:
          // Generic retry
          await new Promise((resolve) => setTimeout(resolve, 2000));
          success = true;
      }

      setRecoveryProgress(100);

      setTimeout(() => {
        dispatch(
          completeRecovery({
            success,
            message: success
              ? "Recovery completed successfully"
              : "Recovery failed",
          })
        );

        if (success) {
          setIsVisible(false);
        }
      }, 1000);
    } catch (error) {
      logger.error("[GracefulErrorOverlay] Recovery failed", { error });
      dispatch(
        completeRecovery({
          success: false,
          message:
            error instanceof Error ? error.message : "Unknown recovery error",
        })
      );
    }
  };

  // Show/hide logic
  useEffect(() => {
    if (currentError) {
      setIsVisible(true);

      // Auto-hide for low severity errors
      if (autoHide && currentError.severity === ErrorSeverity.LOW) {
        const timer = setTimeout(() => {
          setIsVisible(false);
        }, 8000);
        setAutoHideTimer(timer);
      }

      // Auto-trigger recovery for recoverable errors
      if (currentError.isRecoverable && !isRecovering) {
        setTimeout(() => {
          handleRecovery();
        }, 2000); // Wait 2 seconds before attempting recovery
      }
    } else {
      setIsVisible(false);
    }

    return () => {
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
      }
    };
  }, [currentError, autoHide, isRecovering]);

  // Recovery progress simulation
  useEffect(() => {
    if (isRecovering) {
      setRecoveryProgress(0);
      const interval = setInterval(() => {
        setRecoveryProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      return () => clearInterval(interval);
    }
  }, [isRecovering]);

  // Don't render if no error or not visible
  if (!currentError || !isVisible) {
    return null;
  }

  // Get icon based on severity and category
  const getErrorIcon = (): React.ElementType => {
    if (currentError.category === ErrorCategory.NETWORK) {
      return networkStatus.isOnline ? WifiIcon : WifiOffIcon;
    }

    switch (currentError.severity) {
      case ErrorSeverity.CRITICAL:
        return ErrorIcon;
      case ErrorSeverity.HIGH:
        return WarningIcon;
      case ErrorSeverity.MEDIUM:
        return InfoIcon;
      case ErrorSeverity.LOW:
      default:
        return InfoIcon;
    }
  };

  // Get colors based on severity
  const getErrorColors = () => {
    switch (currentError.severity) {
      case ErrorSeverity.CRITICAL:
        return {
          primary: theme.palette.error.main,
          secondary: theme.palette.error.light,
          background: alpha(theme.palette.error.main, 0.08),
          border: alpha(theme.palette.error.main, 0.3),
        };
      case ErrorSeverity.HIGH:
        return {
          primary: theme.palette.warning.main,
          secondary: theme.palette.warning.light,
          background: alpha(theme.palette.warning.main, 0.08),
          border: alpha(theme.palette.warning.main, 0.3),
        };
      case ErrorSeverity.MEDIUM:
        return {
          primary: theme.palette.info.main,
          secondary: theme.palette.info.light,
          background: alpha(theme.palette.info.main, 0.08),
          border: alpha(theme.palette.info.main, 0.3),
        };
      case ErrorSeverity.LOW:
      default:
        return {
          primary: theme.palette.primary.main,
          secondary: theme.palette.primary.light,
          background: alpha(theme.palette.primary.main, 0.08),
          border: alpha(theme.palette.primary.main, 0.3),
        };
    }
  };

  // Position styles
  const getPositionStyles = () => {
    const baseStyles = {
      position: "fixed" as const,
      zIndex: 1500,
      left: "50%",
      transform: "translateX(-50%)",
      width: "90%",
      maxWidth: `${maxWidth}px`,
    };

    switch (position) {
      case "top":
        return { ...baseStyles, top: theme.spacing(3) };
      case "bottom":
        return { ...baseStyles, bottom: theme.spacing(3) };
      case "center":
      default:
        return {
          ...baseStyles,
          top: "50%",
          transform: "translate(-50%, -50%)",
          maxHeight: "80vh",
          overflowY: "auto" as const,
        };
    }
  };

  const ErrorIcon = getErrorIcon();
  const colors = getErrorColors();

  return (
    <Fade in={isVisible} timeout={300}>
      <Box
        sx={getPositionStyles()}
        data-testid="graceful-error-overlay"
        data-error-id={currentError?.id}
        data-error-severity={currentError?.severity}
        data-error-code={currentError?.code}
      >
        {/* Background overlay for center position */}
        {position === "center" && (
          <Box
            sx={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: alpha(theme.palette.common.black, 0.7),
              backdropFilter: "blur(8px)",
              zIndex: 1450,
            }}
          />
        )}

        <Card
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 3,
            border: `2px solid ${colors.border}`,
            backgroundColor: theme.palette.background.paper,
            boxShadow: `0 20px 40px ${alpha(theme.palette.common.black, 0.3)}`,
            opacity: 1,
            "&::before": {
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `linear-gradient(135deg, ${alpha(
                colors.primary,
                0.05
              )} 0%, ${alpha(colors.primary, 0.02)} 100%)`,
              pointerEvents: "none",
              zIndex: 0,
            },
          }}
        >
          {/* Islamic Pattern Background */}
          <IslamicPatternBackground
            opacity={0.02}
            patternColor={colors.primary}
            variant="subtle"
          />

          {/* Recovery Progress */}
          {isRecovering && (
            <LinearProgress
              variant="determinate"
              value={recoveryProgress}
              sx={{
                height: 4,
                backgroundColor: alpha(colors.primary, 0.15),
                "& .MuiLinearProgress-bar": {
                  backgroundColor: colors.primary,
                  borderRadius: 2,
                },
              }}
            />
          )}

          <CardContent sx={{ p: 4, position: "relative", zIndex: 1 }}>
            {/* Header */}
            <Box
              sx={{ display: "flex", alignItems: "flex-start", gap: 3, mb: 3 }}
            >
              {/* Error Icon */}
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  backgroundColor: colors.background,
                  border: `1px solid ${alpha(colors.primary, 0.2)}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 64,
                  height: 64,
                }}
              >
                <ErrorIcon sx={{ fontSize: 32, color: colors.primary }} />
              </Box>

              {/* Error Content */}
              <Box sx={{ flex: 1 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    mb: 1.5,
                  }}
                >
                  <Typography
                    variant="h5"
                    fontWeight={600}
                    color={colors.primary}
                    sx={{ letterSpacing: "0.5px" }}
                  >
                    {currentError.code === ErrorCode.NET_OFFLINE
                      ? "No Internet Connection"
                      : currentError.code === ErrorCode.AUTH_SCREEN_NOT_PAIRED
                      ? "Device Not Paired"
                      : currentError.code === ErrorCode.API_SERVER_DOWN
                      ? "Server Unavailable"
                      : "System Notice"}
                  </Typography>

                  <Chip
                    label={currentError.code}
                    size="small"
                    sx={{
                      backgroundColor: alpha(colors.primary, 0.1),
                      color: colors.primary,
                      border: `1px solid ${alpha(colors.primary, 0.2)}`,
                      fontFamily: "monospace",
                      fontSize: "0.7rem",
                      fontWeight: 500,
                      height: 24,
                    }}
                  />
                </Box>

                <Typography
                  variant="body1"
                  color="text.primary"
                  sx={{
                    mb: 2,
                    lineHeight: 1.6,
                    fontSize: "1rem",
                    opacity: 0.9,
                  }}
                >
                  {currentError.userFriendlyMessage || currentError.message}
                </Typography>

                {/* Recovery Status */}
                {isRecovering && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      mb: 2,
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: alpha(colors.primary, 0.05),
                      border: `1px solid ${alpha(colors.primary, 0.1)}`,
                    }}
                  >
                    <RefreshIcon
                      sx={{
                        fontSize: 18,
                        color: colors.primary,
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    <Typography
                      variant="body2"
                      color={colors.primary}
                      fontWeight={500}
                    >
                      Attempting to resolve automatically... {recoveryProgress}%
                    </Typography>
                  </Box>
                )}

                {/* Auto-recovery message for non-recovering errors */}
                {!isRecovering && currentError.isRecoverable && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      mb: 2,
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: alpha(colors.primary, 0.05),
                      border: `1px solid ${alpha(colors.primary, 0.1)}`,
                    }}
                  >
                    <InfoIcon
                      sx={{
                        fontSize: 18,
                        color: colors.primary,
                      }}
                    />
                    <Typography
                      variant="body2"
                      color={colors.primary}
                      fontWeight={500}
                    >
                      Will attempt automatic recovery shortly...
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            {/* Additional Info */}
            {currentError.metadata &&
              Object.keys(currentError.metadata).length > 0 && (
                <Box
                  sx={{
                    mt: 3,
                    pt: 2,
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Error ID: {currentError.id} • Time:{" "}
                    {new Date(currentError.timestamp).toLocaleTimeString()}
                  </Typography>
                </Box>
              )}
          </CardContent>
        </Card>
      </Box>
    </Fade>
  );
};

export default GracefulErrorOverlay;

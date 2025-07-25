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
  IconButton,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../../store";
import {
  startRecovery,
  completeRecovery,
  testNetworkConnectivity,
  selectCurrentError,
  selectIsRecovering,
  dismissError,
  ErrorCode,
  ErrorSeverity,
  ErrorCategory,
} from "../../store/slices/errorSlice";
import IslamicPatternBackground from "./IslamicPatternBackground";
import { refreshAllContent } from "../../store/slices/contentSlice";
import logger from "../../utils/logger";
import logoGold from "../../assets/logos/logo-notext-gold.svg";

interface GracefulErrorOverlayProps {
  position?: "center" | "top" | "bottom";
  autoHide?: boolean;
  maxWidth?: number;
}

/**
 * GracefulErrorOverlay - Shows MasjidConnect-branded error messages
 *
 * Critical/High: Full overlay with backdrop blur
 * Medium/Low: Corner notification that doesn't interfere with display
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

  // Handle recovery process
  const handleRecovery = async () => {
    if (!currentError || isRecovering) return;

    try {
      dispatch(startRecovery());

      // Recovery actions based on error type
      switch (currentError.code) {
        case ErrorCode.NET_OFFLINE:
          await dispatch(testNetworkConnectivity()).unwrap();
          break;
        case ErrorCode.DATA_SYNC_FAILED:
          await dispatch(refreshAllContent({ forceRefresh: true })).unwrap();
          break;
        default:
          // Generic recovery - wait and try again
          await new Promise((resolve) => setTimeout(resolve, 3000));
          break;
      }

      dispatch(
        completeRecovery({
          success: true,
          message: "Issue resolved successfully",
        })
      );
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

  // Determine if this should be a full overlay or corner notification
  const isFullOverlay =
    currentError?.severity === ErrorSeverity.CRITICAL ||
    currentError?.severity === ErrorSeverity.HIGH;

  // Show/hide logic
  useEffect(() => {
    if (currentError) {
      setIsVisible(true);

      // Auto-hide for medium/low severity errors
      if (
        autoHide &&
        (currentError.severity === ErrorSeverity.MEDIUM ||
          currentError.severity === ErrorSeverity.LOW)
      ) {
        const timer = setTimeout(() => {
          setIsVisible(false);
        }, 8000);
        setAutoHideTimer(timer);
      }

      // Auto-trigger recovery for recoverable errors
      if (currentError.isRecoverable && !isRecovering) {
        setTimeout(() => {
          handleRecovery();
        }, 2000);
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
        return CheckCircleIcon;
    }
  };

  // Get MasjidConnect-branded colors based on severity
  const getErrorColors = () => {
    switch (currentError.severity) {
      case ErrorSeverity.CRITICAL:
        return {
          primary: "#E76F51", // Error Red
          secondary: "#FF8A65",
          background: alpha("#E76F51", 0.1),
          border: alpha("#E76F51", 0.3),
          gradient: "linear-gradient(135deg, #E76F51 0%, #FF8A65 100%)",
        };
      case ErrorSeverity.HIGH:
        return {
          primary: "#E9C46A", // Golden Yellow
          secondary: "#F1C40F",
          background: alpha("#E9C46A", 0.1),
          border: alpha("#E9C46A", 0.3),
          gradient: "linear-gradient(135deg, #E9C46A 0%, #F1C40F 100%)",
        };
      case ErrorSeverity.MEDIUM:
        return {
          primary: "#66D1FF", // Sky Blue
          secondary: "#87CEEB",
          background: alpha("#66D1FF", 0.1),
          border: alpha("#66D1FF", 0.3),
          gradient: "linear-gradient(135deg, #66D1FF 0%, #87CEEB 100%)",
        };
      case ErrorSeverity.LOW:
      default:
        return {
          primary: "#2A9D8F", // Emerald Green
          secondary: "#20B2AA",
          background: alpha("#2A9D8F", 0.1),
          border: alpha("#2A9D8F", 0.3),
          gradient: "linear-gradient(135deg, #2A9D8F 0%, #20B2AA 100%)",
        };
    }
  };

  const ErrorIcon = getErrorIcon();
  const colors = getErrorColors();

  // Handle dismiss
  const handleDismiss = () => {
    if (currentError) {
      dispatch(dismissError(currentError.id));
    }
  };

  // Full overlay layout for critical/high severity
  if (isFullOverlay) {
    return (
      <Fade in={isVisible} timeout={300}>
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1500,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 3,
          }}
        >
          {/* Backdrop with Islamic pattern */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "linear-gradient(135deg, #0A2647 0%, #144272 100%)",
              backdropFilter: "blur(12px)",
              zIndex: 1,
            }}
          >
            <IslamicPatternBackground
              opacity={0.05}
              patternColor="#F1C40F"
              variant="subtle"
            />
          </Box>

          {/* Main error card */}
          <Card
            sx={{
              position: "relative",
              zIndex: 2,
              maxWidth: 600,
              width: "100%",
              overflow: "hidden",
              borderRadius: 4,
              background: `linear-gradient(135deg, 
                rgba(255, 255, 255, 0.95) 0%, 
                rgba(255, 255, 255, 0.9) 100%)`,
              backdropFilter: "blur(20px)",
              border: `2px solid ${colors.border}`,
              boxShadow: `0 30px 60px rgba(0, 0, 0, 0.3), 
                         0 0 0 1px rgba(255, 255, 255, 0.2),
                         inset 0 1px 0 rgba(255, 255, 255, 0.3)`,
            }}
          >
            {/* Recovery Progress */}
            {isRecovering && (
              <LinearProgress
                variant="determinate"
                value={recoveryProgress}
                sx={{
                  height: 6,
                  background: colors.gradient,
                  "& .MuiLinearProgress-bar": {
                    background:
                      "linear-gradient(90deg, #F1C40F 0%, #DAA520 100%)",
                    borderRadius: 3,
                  },
                }}
              />
            )}

            <CardContent sx={{ p: 4 }}>
              {/* Header with MasjidConnect branding */}
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 3, mb: 4 }}
              >
                {/* MasjidConnect Logo */}
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 3,
                    background: colors.gradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 1.5,
                    boxShadow: `0 8px 24px ${alpha(colors.primary, 0.3)}`,
                  }}
                >
                  <img
                    src={logoGold}
                    alt="MasjidConnect"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      filter: "brightness(0) invert(1)",
                    }}
                  />
                </Box>

                <Box sx={{ flex: 1 }}>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 700,
                      background: colors.gradient,
                      backgroundClip: "text",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      mb: 0.5,
                    }}
                  >
                    {currentError.code === ErrorCode.NET_OFFLINE
                      ? "Connection Lost"
                      : currentError.code === ErrorCode.AUTH_SCREEN_NOT_PAIRED
                      ? "Pairing Required"
                      : currentError.code === ErrorCode.API_SERVER_DOWN
                      ? "Service Unavailable"
                      : "System Alert"}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontWeight: 500 }}
                  >
                    MasjidConnect Display System
                  </Typography>
                </Box>
              </Box>

              {/* Error Message */}
              <Typography
                variant="h6"
                color="text.primary"
                sx={{
                  mb: 3,
                  lineHeight: 1.6,
                  fontWeight: 500,
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
                    gap: 2,
                    p: 3,
                    borderRadius: 3,
                    background: `linear-gradient(135deg, 
                      ${alpha(colors.primary, 0.1)} 0%, 
                      ${alpha(colors.primary, 0.05)} 100%)`,
                    border: `2px solid ${colors.border}`,
                    mb: 3,
                  }}
                >
                  <RefreshIcon
                    sx={{
                      fontSize: 24,
                      color: colors.primary,
                      animation: "spin 2s linear infinite",
                    }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="body1"
                      color={colors.primary}
                      fontWeight={600}
                    >
                      Resolving Issue Automatically
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Progress: {recoveryProgress}% • Please wait...
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Footer */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  pt: 2,
                  borderTop: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                }}
              >
                <Chip
                  label={`Error: ${currentError.code}`}
                  size="small"
                  sx={{
                    backgroundColor: alpha(colors.primary, 0.1),
                    color: colors.primary,
                    fontFamily: "monospace",
                    fontWeight: 600,
                  }}
                />

                <Typography variant="caption" color="text.secondary">
                  {new Date(currentError.timestamp).toLocaleTimeString()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Fade>
    );
  }

  // Corner notification for medium/low severity
  return (
    <Fade in={isVisible} timeout={300}>
      <Box
        sx={{
          position: "fixed",
          top: 24,
          right: 24,
          zIndex: 1300,
          maxWidth: 400,
          width: "auto",
        }}
      >
        <Card
          sx={{
            overflow: "hidden",
            borderRadius: 3,
            background: `linear-gradient(135deg, 
              rgba(255, 255, 255, 0.98) 0%, 
              rgba(255, 255, 255, 0.95) 100%)`,
            backdropFilter: "blur(20px)",
            border: `2px solid ${colors.border}`,
            boxShadow: `0 12px 32px rgba(0, 0, 0, 0.15), 
                       0 0 0 1px rgba(255, 255, 255, 0.2)`,
            "&::before": {
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: colors.gradient,
            },
          }}
        >
          {/* Recovery Progress */}
          {isRecovering && (
            <LinearProgress
              variant="determinate"
              value={recoveryProgress}
              sx={{
                height: 4,
                background: alpha(colors.primary, 0.2),
                "& .MuiLinearProgress-bar": {
                  background: colors.gradient,
                  borderRadius: 2,
                },
              }}
            />
          )}

          <CardContent sx={{ p: 3, pt: 4 }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
              {/* Icon */}
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  background: colors.gradient,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 40,
                  height: 40,
                }}
              >
                <ErrorIcon
                  sx={{
                    fontSize: 20,
                    color: "white",
                  }}
                />
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      color: colors.primary,
                      fontSize: "0.9rem",
                    }}
                  >
                    {currentError.code === ErrorCode.NET_OFFLINE
                      ? "Connection Issue"
                      : currentError.code === ErrorCode.DATA_SYNC_FAILED
                      ? "Data Sync Issue"
                      : "System Notice"}
                  </Typography>

                  {!isRecovering && (
                    <IconButton
                      size="small"
                      onClick={handleDismiss}
                      sx={{
                        ml: "auto",
                        color: "text.secondary",
                        "&:hover": { color: colors.primary },
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>

                <Typography
                  variant="body2"
                  color="text.primary"
                  sx={{
                    mb: isRecovering ? 2 : 1,
                    lineHeight: 1.4,
                    fontSize: "0.85rem",
                  }}
                >
                  {currentError.userFriendlyMessage || currentError.message}
                </Typography>

                {/* Recovery status for corner notification */}
                {isRecovering && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <RefreshIcon
                      sx={{
                        fontSize: 16,
                        color: colors.primary,
                        animation: "spin 1.5s linear infinite",
                      }}
                    />
                    <Typography
                      variant="caption"
                      color={colors.primary}
                      fontWeight={600}
                    >
                      Auto-resolving... {recoveryProgress}%
                    </Typography>
                  </Box>
                )}

                {/* Timestamp */}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: "0.75rem", mt: 0.5, display: "block" }}
                >
                  {new Date(currentError.timestamp).toLocaleTimeString()}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Fade>
  );
};

export default GracefulErrorOverlay;

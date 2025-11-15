import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Collapse,
  Card,
  CardContent,
  Divider,
  Tooltip,
  useTheme,
  Button,
} from "@mui/material";
import {
  CheckCircle as HealthyIcon,
  Warning as DegradedIcon,
  Error as CriticalIcon,
  Wifi as NetworkIcon,
  Storage as StorageIcon,
  Memory as MemoryIcon,
  Api as ApiIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  WifiOff,
  SignalWifiStatusbarConnectedNoInternet4,
  BugReport as TestIcon,
} from "@mui/icons-material";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../../store";
import {
  selectSystemHealth,
  selectNetworkStatus,
  reportError,
  ErrorCode,
  ErrorSeverity,
} from "../../store/slices/errorSlice";
import networkStatusService from "../../services/networkStatusService";

interface SystemStatusIndicatorProps {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  compact?: boolean;
  autoHide?: boolean;
}

/**
 * SystemStatusIndicator - Shows overall system health and network status
 *
 * Displays a small indicator that can be expanded to show detailed status.
 * Uses MasjidConnect branding colors and Islamic design elements.
 */
const SystemStatusIndicator: React.FC<SystemStatusIndicatorProps> = ({
  position = "bottom-right",
  compact = true,
  autoHide = true,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const [expanded, setExpanded] = useState(false);
  const [shouldShow, setShouldShow] = useState(!autoHide);

  // Redux selectors
  const systemHealth = useSelector(selectSystemHealth);
  const networkStatus = useSelector(selectNetworkStatus);
  const activeErrors = useSelector(
    (state: RootState) => state.errors.activeErrors,
  );

  // Auto-hide logic
  useEffect(() => {
    if (autoHide) {
      const hasIssues =
        systemHealth.overall !== "healthy" ||
        !networkStatus.isOnline ||
        !networkStatus.isApiReachable ||
        activeErrors.length > 0;
      setShouldShow(hasIssues);
    }
  }, [systemHealth, networkStatus, activeErrors, autoHide]);

  // Don't render if should be hidden
  if (!shouldShow) return null;

  // Get position styles
  const getPositionStyles = () => {
    const baseStyles = {
      position: "fixed" as const,
      zIndex: 1300,
      margin: theme.spacing(2),
    };

    switch (position) {
      case "top-left":
        return { ...baseStyles, top: 0, left: 0 };
      case "top-right":
        return { ...baseStyles, top: 0, right: 0 };
      case "bottom-left":
        return { ...baseStyles, bottom: 0, left: 0 };
      case "bottom-right":
      default:
        return { ...baseStyles, bottom: 0, right: 0 };
    }
  };

  // Get health icon and color
  const getHealthDisplay = (health: string) => {
    switch (health) {
      case "healthy":
        return {
          icon: HealthyIcon,
          color: theme.palette.success.main,
          label: "Healthy",
        };
      case "degraded":
        return {
          icon: DegradedIcon,
          color: theme.palette.warning.main,
          label: "Degraded",
        };
      case "critical":
      case "down":
      case "full":
        return {
          icon: CriticalIcon,
          color: theme.palette.error.main,
          label: "Critical",
        };
      default:
        return {
          icon: DegradedIcon,
          color: theme.palette.warning.main,
          label: "Unknown",
        };
    }
  };

  // Get network icon
  const getNetworkIcon = () => {
    if (!networkStatus.isOnline) return WifiOff;
    if (!networkStatus.isApiReachable)
      return SignalWifiStatusbarConnectedNoInternet4;
    return NetworkIcon;
  };

  const overallHealth = getHealthDisplay(systemHealth.overall);
  const NetworkIconComponent = getNetworkIcon();

  // Compact indicator
  if (compact && !expanded) {
    return (
      <Box sx={getPositionStyles()}>
        <Tooltip
          title={`System Status: ${overallHealth.label}${
            !networkStatus.isOnline
              ? " (Offline)"
              : !networkStatus.isApiReachable
                ? " (API Unreachable)"
                : ""
          }`}
          arrow
          placement={position.includes("right") ? "left" : "right"}
        >
          <IconButton
            onClick={() => setExpanded(true)}
            sx={{
              backgroundColor: theme.palette.background.paper,
              boxShadow: theme.shadows[4],
              border: `2px solid ${overallHealth.color}`,
              "&:hover": {
                backgroundColor: theme.palette.background.default,
                transform: "scale(1.05)",
              },
              transition: "all 0.2s ease-in-out",
            }}
          >
            <Box sx={{ position: "relative" }}>
              <overallHealth.icon
                sx={{ color: overallHealth.color, fontSize: 24 }}
              />
              {(!networkStatus.isOnline || !networkStatus.isApiReachable) && (
                <NetworkIconComponent
                  sx={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    fontSize: 14,
                    color: theme.palette.error.main,
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: "50%",
                  }}
                />
              )}
            </Box>
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  // Expanded status panel
  return (
    <Box sx={getPositionStyles()}>
      <Card
        sx={{
          minWidth: 300,
          maxWidth: 400,
          backgroundColor: theme.palette.background.paper,
          boxShadow: theme.shadows[8],
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
        }}
      >
        <CardContent sx={{ p: 2 }}>
          {/* Header */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <overallHealth.icon
                sx={{ color: overallHealth.color, fontSize: 20 }}
              />
              <Typography
                variant="h6"
                sx={{ fontSize: "1rem", fontWeight: 600 }}
              >
                System Status
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Chip
                label={overallHealth.label}
                size="small"
                sx={{
                  backgroundColor: `${overallHealth.color}20`,
                  color: overallHealth.color,
                  border: `1px solid ${overallHealth.color}`,
                  fontWeight: 600,
                }}
              />
              <IconButton
                size="small"
                onClick={() => setExpanded(false)}
                sx={{ ml: 1 }}
              >
                <CollapseIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Network Status */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <NetworkIconComponent
                sx={{
                  color:
                    networkStatus.isOnline && networkStatus.isApiReachable
                      ? theme.palette.success.main
                      : theme.palette.error.main,
                  fontSize: 18,
                }}
              />
              <Typography variant="body2" fontWeight={500}>
                Network
              </Typography>
              <Chip
                label={
                  !networkStatus.isOnline
                    ? "Offline"
                    : !networkStatus.isApiReachable
                      ? "API Unreachable"
                      : "Connected"
                }
                size="small"
                color={
                  networkStatus.isOnline && networkStatus.isApiReachable
                    ? "success"
                    : "error"
                }
                variant="outlined"
              />
            </Box>

            {networkStatus.latency !== null && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ ml: 3 }}
              >
                Latency: {networkStatus.latency}ms
              </Typography>
            )}

            {networkStatus.failedAttempts > 0 && (
              <Typography
                variant="caption"
                color="error.main"
                sx={{ ml: 3, display: "block" }}
              >
                Failed attempts: {networkStatus.failedAttempts}
              </Typography>
            )}
          </Box>

          <Divider sx={{ my: 1 }} />

          {/* System Components */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {/* API Health */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ApiIcon
                sx={{
                  color: getHealthDisplay(systemHealth.api).color,
                  fontSize: 16,
                }}
              />
              <Typography variant="body2" sx={{ flex: 1 }}>
                API Server
              </Typography>
              <Chip
                label={systemHealth.api}
                size="small"
                color={
                  systemHealth.api === "healthy"
                    ? "success"
                    : systemHealth.api === "degraded"
                      ? "warning"
                      : "error"
                }
                variant="outlined"
              />
            </Box>

            {/* Storage Health */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <StorageIcon
                sx={{
                  color: getHealthDisplay(systemHealth.storage).color,
                  fontSize: 16,
                }}
              />
              <Typography variant="body2" sx={{ flex: 1 }}>
                Storage
              </Typography>
              <Chip
                label={systemHealth.storage}
                size="small"
                color={systemHealth.storage === "healthy" ? "success" : "error"}
                variant="outlined"
              />
            </Box>

            {/* Memory Health */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <MemoryIcon
                sx={{
                  color: getHealthDisplay(systemHealth.memory).color,
                  fontSize: 16,
                }}
              />
              <Typography variant="body2" sx={{ flex: 1 }}>
                Memory
              </Typography>
              <Chip
                label={systemHealth.memory}
                size="small"
                color={
                  systemHealth.memory === "healthy"
                    ? "success"
                    : systemHealth.memory === "high"
                      ? "warning"
                      : "error"
                }
                variant="outlined"
              />
            </Box>
          </Box>

          {/* Active Errors Summary */}
          {activeErrors.length > 0 && (
            <>
              <Divider sx={{ my: 1 }} />
              <Box>
                <Typography
                  variant="body2"
                  fontWeight={500}
                  color="error.main"
                  sx={{ mb: 1 }}
                >
                  Active Issues ({activeErrors.length})
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {activeErrors.slice(0, 3).map((error) => (
                    <Chip
                      key={error.id}
                      label={error.code}
                      size="small"
                      color="error"
                      variant="outlined"
                      sx={{ fontSize: "0.7rem" }}
                    />
                  ))}
                  {activeErrors.length > 3 && (
                    <Chip
                      label={`+${activeErrors.length - 3} more`}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: "0.7rem" }}
                    />
                  )}
                </Box>
              </Box>
            </>
          )}

          {/* Test Error Button (Development Only) */}
          {process.env.NODE_ENV === "development" && (
            <>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography
                  variant="body2"
                  fontWeight={500}
                  color="text.secondary"
                >
                  Test Error System
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<TestIcon />}
                    onClick={() => {
                      dispatch(
                        reportError({
                          code: ErrorCode.NET_OFFLINE,
                          message:
                            "Test network error from SystemStatusIndicator",
                          severity: ErrorSeverity.MEDIUM,
                          source: "SystemStatusIndicator",
                          metadata: {
                            test: true,
                            timestamp: new Date().toISOString(),
                          },
                        }),
                      );
                    }}
                    sx={{ fontSize: "0.7rem" }}
                  >
                    Test Network Error
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<TestIcon />}
                    onClick={() => {
                      dispatch(
                        reportError({
                          code: ErrorCode.AUTH_SCREEN_NOT_PAIRED,
                          message: "Test critical error - Screen not paired",
                          severity: ErrorSeverity.CRITICAL,
                          source: "SystemStatusIndicator",
                          metadata: {
                            test: true,
                            timestamp: new Date().toISOString(),
                          },
                        }),
                      );
                    }}
                    sx={{ fontSize: "0.7rem" }}
                  >
                    Test Critical Error
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<TestIcon />}
                    onClick={() => {
                      dispatch(
                        reportError({
                          code: ErrorCode.API_SERVER_DOWN,
                          message:
                            "Test high severity error - Server unavailable",
                          severity: ErrorSeverity.HIGH,
                          source: "SystemStatusIndicator",
                          metadata: {
                            test: true,
                            timestamp: new Date().toISOString(),
                          },
                        }),
                      );
                    }}
                    sx={{ fontSize: "0.7rem" }}
                  >
                    Test High Error
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<TestIcon />}
                    onClick={() => {
                      networkStatusService.triggerTestError();
                    }}
                    sx={{ fontSize: "0.7rem" }}
                  >
                    Test Service Error
                  </Button>
                </Box>
              </Box>
            </>
          )}

          {/* Last Updated */}
          <Box
            sx={{
              mt: 2,
              pt: 1,
              borderTop: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Last updated: {new Date().toLocaleTimeString()}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SystemStatusIndicator;

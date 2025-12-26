/**
 * WiFiReconnectOverlay Component
 *
 * Modal overlay shown when WiFi connection drops during normal operation.
 * Features auto-reconnection countdown and option to manually configure WiFi.
 *
 * Keyboard controls:
 * - Tab: Navigate between elements
 * - Enter: Select action
 * - Arrow keys: Navigate network list (when shown)
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Fade,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  InputAdornment,
  IconButton,
  LinearProgress,
  alpha,
  useTheme,
} from "@mui/material";
import {
  WifiOff as WifiOffIcon,
  Wifi as WifiIcon,
  SignalWifi4Bar as Signal4Icon,
  SignalWifi3Bar as Signal3Icon,
  SignalWifi2Bar as Signal2Icon,
  SignalWifi1Bar as Signal1Icon,
  SignalWifi0Bar as Signal0Icon,
  Refresh as RefreshIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
} from "@mui/icons-material";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch } from "../../store";
import {
  scanNetworks,
  connectToNetwork,
  selectAvailableNetworks,
  selectIsScanning,
  selectIsConnecting,
  selectConnectionStatus,
  selectWiFiError,
  selectShowReconnectOverlay,
  selectReconnectAttempts,
  selectMaxReconnectAttempts,
  setShowReconnectOverlay,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  clearError,
} from "../../store/slices/wifiSlice";
import IslamicPatternBackground from "./IslamicPatternBackground";
import { WiFiService } from "../../services/wifiService";
import logger from "../../utils/logger";

// Auto-reconnect countdown duration (seconds)
const AUTO_RECONNECT_DURATION = 30;

/**
 * Get the appropriate signal icon based on signal strength
 */
const getSignalIcon = (signal: number): React.ReactElement => {
  if (signal >= 80)
    return <Signal4Icon sx={{ color: "#4CAF50", fontSize: 24 }} />;
  if (signal >= 60)
    return <Signal3Icon sx={{ color: "#8BC34A", fontSize: 24 }} />;
  if (signal >= 40)
    return <Signal2Icon sx={{ color: "#FFC107", fontSize: 24 }} />;
  if (signal >= 20)
    return <Signal1Icon sx={{ color: "#FF9800", fontSize: 24 }} />;
  return <Signal0Icon sx={{ color: "#F44336", fontSize: 24 }} />;
};

interface WiFiReconnectOverlayProps {
  /** Called when connection is restored */
  onReconnected?: () => void;
  /** Last known network SSID to attempt auto-reconnect */
  lastNetwork?: string | null;
}

const WiFiReconnectOverlay: React.FC<WiFiReconnectOverlayProps> = ({
  onReconnected,
  lastNetwork,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch<AppDispatch>();

  // Redux state
  const isVisible = useSelector(selectShowReconnectOverlay);
  const networks = useSelector(selectAvailableNetworks);
  const isScanning = useSelector(selectIsScanning);
  const isConnecting = useSelector(selectIsConnecting);
  const connectionStatus = useSelector(selectConnectionStatus);
  const error = useSelector(selectWiFiError);
  const reconnectAttempts = useSelector(selectReconnectAttempts);
  const maxReconnectAttempts = useSelector(selectMaxReconnectAttempts);

  // Local state
  const [showNetworkList, setShowNetworkList] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_RECONNECT_DURATION);
  const [selectedNetworkIndex, setSelectedNetworkIndex] = useState(0);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Refs
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Auto-reconnect logic
  useEffect(() => {
    if (!isVisible) {
      // Reset state when hidden
      setShowNetworkList(false);
      setCountdown(AUTO_RECONNECT_DURATION);
      setSelectedNetwork(null);
      setPassword("");
      return;
    }

    // Start countdown for auto-reconnect
    setCountdown(AUTO_RECONNECT_DURATION);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Attempt auto-reconnect
          handleAutoReconnect();
          return AUTO_RECONNECT_DURATION;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [isVisible]);

  // Handle successful reconnection
  useEffect(() => {
    if (connectionStatus === "connected" && isVisible) {
      logger.info("[WiFiReconnectOverlay] Connection restored");
      dispatch(resetReconnectAttempts());

      // Brief delay to show success, then hide
      setTimeout(() => {
        dispatch(setShowReconnectOverlay(false));
        onReconnected?.();
      }, 1500);
    }
  }, [connectionStatus, isVisible, dispatch, onReconnected]);

  // Auto-reconnect handler
  const handleAutoReconnect = useCallback(() => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      logger.warn("[WiFiReconnectOverlay] Max reconnect attempts reached");
      setShowNetworkList(true);
      return;
    }

    dispatch(incrementReconnectAttempts());

    if (lastNetwork) {
      logger.info(
        `[WiFiReconnectOverlay] Auto-reconnect attempt ${reconnectAttempts + 1}/${maxReconnectAttempts} to: ${lastNetwork}`,
      );
      dispatch(connectToNetwork({ ssid: lastNetwork }));
    } else {
      // No last network, scan and show list
      dispatch(scanNetworks());
      setShowNetworkList(true);
    }
  }, [dispatch, lastNetwork, reconnectAttempts, maxReconnectAttempts]);

  // Manual network selection
  const handleNetworkSelect = useCallback(
    (ssid: string) => {
      setSelectedNetwork(ssid);
      setPassword("");
      dispatch(clearError());

      const network = networks.find((n) => n.ssid === ssid);
      if (network && !WiFiService.requiresPassword(network.security)) {
        // Open network, connect immediately
        dispatch(connectToNetwork({ ssid }));
      } else {
        // Focus password field
        setTimeout(() => passwordRef.current?.focus(), 100);
      }
    },
    [dispatch, networks],
  );

  // Connect with password
  const handleConnect = useCallback(() => {
    if (!selectedNetwork) return;
    dispatch(connectToNetwork({ ssid: selectedNetwork, password }));
  }, [dispatch, selectedNetwork, password]);

  // Manual scan
  const handleScan = useCallback(() => {
    dispatch(clearError());
    dispatch(scanNetworks());
  }, [dispatch]);

  // Switch to manual network selection
  const handleShowNetworks = useCallback(() => {
    setShowNetworkList(true);
    dispatch(scanNetworks());
  }, [dispatch]);

  // Keyboard navigation for network list
  useEffect(() => {
    if (!showNetworkList || !isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedNetwork) return; // Let password field handle keys

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedNetworkIndex((prev) =>
            Math.min(prev + 1, networks.length - 1),
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedNetworkIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (networks[selectedNetworkIndex]) {
            handleNetworkSelect(networks[selectedNetworkIndex].ssid);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showNetworkList, isVisible, networks, selectedNetworkIndex, selectedNetwork, handleNetworkSelect]);

  // Get selected network object
  const selectedNetworkObj = selectedNetwork
    ? networks.find((n) => n.ssid === selectedNetwork)
    : null;
  const needsPassword = Boolean(
    selectedNetworkObj && WiFiService.requiresPassword(selectedNetworkObj.security)
  );

  if (!isVisible) return null;

  return (
    <Fade in={isVisible} timeout={300}>
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 3,
        }}
      >
        {/* Backdrop with pattern */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "linear-gradient(135deg, #0A2647 0%, #144272 100%)",
            zIndex: 1,
          }}
        >
          <IslamicPatternBackground
            opacity={0.05}
            patternColor="#F1C40F"
            variant="subtle"
          />
        </Box>

        {/* Content Card */}
        <Paper
          elevation={24}
          sx={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            maxWidth: showNetworkList ? 500 : 450,
            maxHeight: "85vh",
            overflow: "hidden",
            borderRadius: 3,
            background: alpha("#fff", 0.98),
          }}
        >
          {/* Progress bar for auto-reconnect */}
          {!showNetworkList && (
            <LinearProgress
              variant="determinate"
              value={(countdown / AUTO_RECONNECT_DURATION) * 100}
              sx={{
                height: 6,
                backgroundColor: alpha(theme.palette.warning.main, 0.2),
                "& .MuiLinearProgress-bar": {
                  background: `linear-gradient(90deg, ${theme.palette.warning.main} 0%, #F1C40F 100%)`,
                },
              }}
            />
          )}

          <Box sx={{ p: 4 }}>
            {/* Success State */}
            {connectionStatus === "connected" ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: alpha(theme.palette.success.main, 0.1),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto",
                    mb: 3,
                  }}
                >
                  <CheckIcon
                    sx={{ fontSize: 48, color: theme.palette.success.main }}
                  />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                  Connection Restored
                </Typography>
                <Typography color="text.secondary">
                  Returning to display...
                </Typography>
              </Box>
            ) : showNetworkList ? (
              /* Network List View */
              <>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 3,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <WifiIcon sx={{ fontSize: 32, color: theme.palette.primary.main }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Select Network
                    </Typography>
                  </Box>
                  <IconButton onClick={handleScan} disabled={isScanning}>
                    {isScanning ? (
                      <CircularProgress size={24} />
                    ) : (
                      <RefreshIcon />
                    )}
                  </IconButton>
                </Box>

                {/* Network List */}
                <Box
                  sx={{
                    maxHeight: 250,
                    overflow: "auto",
                    border: `1px solid ${alpha("#000", 0.1)}`,
                    borderRadius: 2,
                    mb: 2,
                  }}
                >
                  {networks.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: "center" }}>
                      <Typography color="text.secondary">
                        {isScanning ? "Scanning..." : "No networks found"}
                      </Typography>
                    </Box>
                  ) : (
                    <List disablePadding>
                      {networks.map((network, index) => {
                        const isSelected = selectedNetwork === network.ssid;
                        const isFocused =
                          !selectedNetwork && index === selectedNetworkIndex;
                        const requiresPwd = WiFiService.requiresPassword(
                          network.security,
                        );

                        return (
                          <ListItem
                            key={network.ssid}
                            disablePadding
                            sx={{
                              borderBottom: `1px solid ${alpha("#000", 0.05)}`,
                            }}
                          >
                            <ListItemButton
                              selected={isSelected}
                              onClick={() => handleNetworkSelect(network.ssid)}
                              sx={{
                                outline: isFocused
                                  ? `2px solid ${theme.palette.primary.main}`
                                  : "none",
                                outlineOffset: -2,
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 40 }}>
                                {getSignalIcon(network.signal)}
                              </ListItemIcon>
                              <ListItemText
                                primary={network.ssid}
                                secondary={network.security}
                              />
                              {requiresPwd ? (
                                <LockIcon
                                  sx={{ color: "text.secondary", fontSize: 20 }}
                                />
                              ) : (
                                <LockOpenIcon
                                  sx={{ color: "text.disabled", fontSize: 20 }}
                                />
                              )}
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                    </List>
                  )}
                </Box>

                {/* Password Entry */}
                {selectedNetwork && needsPassword && (
                  <Box sx={{ mb: 2 }}>
                    <TextField
                      inputRef={passwordRef}
                      fullWidth
                      type={showPassword ? "text" : "password"}
                      label={`Password for ${selectedNetwork}`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                      disabled={isConnecting}
                      autoComplete="off"
                      sx={{ mb: 2 }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword(!showPassword)}
                              tabIndex={-1}
                            >
                              {showPassword ? (
                                <VisibilityOffIcon />
                              ) : (
                                <VisibilityIcon />
                              )}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={handleConnect}
                      disabled={isConnecting || !password}
                    >
                      {isConnecting ? (
                        <>
                          <CircularProgress
                            size={20}
                            color="inherit"
                            sx={{ mr: 1 }}
                          />
                          Connecting...
                        </>
                      ) : (
                        "Connect"
                      )}
                    </Button>
                  </Box>
                )}

                {/* Error Message */}
                {error && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      p: 1.5,
                      borderRadius: 1,
                      background: alpha(theme.palette.error.main, 0.1),
                      color: theme.palette.error.main,
                    }}
                  >
                    <ErrorIcon fontSize="small" />
                    <Typography variant="body2">{error}</Typography>
                  </Box>
                )}
              </>
            ) : (
              /* Auto-Reconnect View */
              <>
                <Box sx={{ textAlign: "center", mb: 3 }}>
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: "50%",
                      background: alpha(theme.palette.warning.main, 0.1),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto",
                      mb: 3,
                    }}
                  >
                    <WifiOffIcon
                      sx={{ fontSize: 48, color: theme.palette.warning.main }}
                    />
                  </Box>

                  <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                    Connection Lost
                  </Typography>

                  <Typography color="text.secondary" sx={{ mb: 2 }}>
                    {lastNetwork
                      ? `Attempting to reconnect to "${lastNetwork}"...`
                      : "Unable to connect to the internet."}
                  </Typography>

                  {isConnecting ? (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 2,
                        my: 3,
                      }}
                    >
                      <CircularProgress size={24} />
                      <Typography>Connecting...</Typography>
                    </Box>
                  ) : (
                    <Typography
                      variant="h4"
                      sx={{
                        fontWeight: 700,
                        color: theme.palette.warning.main,
                        my: 2,
                      }}
                    >
                      {countdown}s
                    </Typography>
                  )}

                  <Typography variant="body2" color="text.secondary">
                    Attempt {reconnectAttempts + 1} of {maxReconnectAttempts}
                  </Typography>
                </Box>

                {error && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      p: 1.5,
                      mb: 3,
                      borderRadius: 1,
                      background: alpha(theme.palette.error.main, 0.1),
                      color: theme.palette.error.main,
                    }}
                  >
                    <ErrorIcon fontSize="small" />
                    <Typography variant="body2">{error}</Typography>
                  </Box>
                )}

                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleShowNetworks}
                  sx={{ mb: 2 }}
                >
                  Choose Different Network
                </Button>

                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleAutoReconnect}
                  disabled={isConnecting}
                >
                  Try Now
                </Button>
              </>
            )}
          </Box>
        </Paper>
      </Box>
    </Fade>
  );
};

export default WiFiReconnectOverlay;





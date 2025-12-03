/**
 * WiFiSetupScreen Component
 *
 * Full-screen WiFi setup interface for first boot when no internet connection.
 * Supports keyboard-only navigation for display devices without mouse/touch.
 *
 * Keyboard controls:
 * - Tab / Shift+Tab: Navigate between elements
 * - Arrow Up/Down: Navigate network list
 * - Enter: Select network or submit
 * - Escape: Cancel / Go back
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Button,
  CircularProgress,
  Fade,
  Paper,
  IconButton,
  InputAdornment,
  alpha,
  useTheme,
} from "@mui/material";
import {
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  SignalWifi4Bar as Signal4Icon,
  SignalWifi3Bar as Signal3Icon,
  SignalWifi2Bar as Signal2Icon,
  SignalWifi1Bar as Signal1Icon,
  SignalWifi0Bar as Signal0Icon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Refresh as RefreshIcon,
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
  clearError,
} from "../../store/slices/wifiSlice";
import ModernIslamicBackground from "../common/ModernIslamicBackground";
import logoGold from "../../assets/logos/logo-gold.svg";
import logger from "../../utils/logger";
import { WiFiService } from "../../services/wifiService";

interface WiFiSetupScreenProps {
  /** Called when WiFi connection is successful */
  onConnected?: () => void;
  /** Called when user requests to skip (if allowed) */
  onSkip?: () => void;
  /** Whether to show skip option */
  allowSkip?: boolean;
}

/**
 * Get the appropriate signal icon based on signal strength
 */
const getSignalIcon = (signal: number): React.ReactElement => {
  if (signal >= 80)
    return <Signal4Icon sx={{ color: "#4CAF50", fontSize: 28 }} />;
  if (signal >= 60)
    return <Signal3Icon sx={{ color: "#8BC34A", fontSize: 28 }} />;
  if (signal >= 40)
    return <Signal2Icon sx={{ color: "#FFC107", fontSize: 28 }} />;
  if (signal >= 20)
    return <Signal1Icon sx={{ color: "#FF9800", fontSize: 28 }} />;
  return <Signal0Icon sx={{ color: "#F44336", fontSize: 28 }} />;
};

const WiFiSetupScreen: React.FC<WiFiSetupScreenProps> = ({
  onConnected,
  onSkip,
  allowSkip = false,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch<AppDispatch>();

  // Redux state
  const networks = useSelector(selectAvailableNetworks);
  const isScanning = useSelector(selectIsScanning);
  const isConnecting = useSelector(selectIsConnecting);
  const connectionStatus = useSelector(selectConnectionStatus);
  const error = useSelector(selectWiFiError);

  // Local state
  const [fadeIn, setFadeIn] = useState(false);
  const [selectedNetworkIndex, setSelectedNetworkIndex] = useState(0);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedElement, setFocusedElement] = useState<
    "list" | "password" | "connect" | "rescan"
  >("list");

  // Refs for keyboard navigation
  const listRef = useRef<HTMLUListElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const connectButtonRef = useRef<HTMLButtonElement>(null);
  const rescanButtonRef = useRef<HTMLButtonElement>(null);

  // Start scanning on mount
  useEffect(() => {
    setFadeIn(true);
    dispatch(scanNetworks());
    logger.info("[WiFiSetupScreen] Component mounted, scanning networks");
  }, [dispatch]);

  // Focus management
  useEffect(() => {
    switch (focusedElement) {
      case "password":
        passwordRef.current?.focus();
        break;
      case "connect":
        connectButtonRef.current?.focus();
        break;
      case "rescan":
        rescanButtonRef.current?.focus();
        break;
      case "list":
      default:
        // Focus is handled by the list items
        break;
    }
  }, [focusedElement]);

  // Handle successful connection
  useEffect(() => {
    if (connectionStatus === "connected" && onConnected) {
      logger.info("[WiFiSetupScreen] Connection successful, calling onConnected");
      setTimeout(() => {
        onConnected();
      }, 1500); // Brief delay to show success state
    }
  }, [connectionStatus, onConnected]);

  // Handle network selection
  const handleNetworkSelect = useCallback((ssid: string) => {
    setSelectedNetwork(ssid);
    setPassword("");
    dispatch(clearError());

    // Find network to check if it needs password
    const network = networks.find((n) => n.ssid === ssid);
    if (network && WiFiService.requiresPassword(network.security)) {
      setFocusedElement("password");
    } else {
      setFocusedElement("connect");
    }
  }, [dispatch, networks]);

  // Handle connect
  const handleConnect = useCallback(() => {
    if (!selectedNetwork) return;

    logger.info(`[WiFiSetupScreen] Connecting to: ${selectedNetwork}`);
    dispatch(
      connectToNetwork({
        ssid: selectedNetwork,
        password: password || undefined,
      }),
    );
  }, [dispatch, selectedNetwork, password]);

  // Handle rescan
  const handleRescan = useCallback(() => {
    dispatch(clearError());
    dispatch(scanNetworks());
    setSelectedNetwork(null);
    setPassword("");
    setFocusedElement("list");
  }, [dispatch]);

  // Global keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in password field
      if (focusedElement === "password" && e.key !== "Escape" && e.key !== "Tab") {
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (focusedElement === "list") {
            setSelectedNetworkIndex((prev) =>
              Math.min(prev + 1, networks.length - 1),
            );
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          if (focusedElement === "list") {
            setSelectedNetworkIndex((prev) => Math.max(prev - 1, 0));
          }
          break;

        case "Enter":
          e.preventDefault();
          if (focusedElement === "list" && networks[selectedNetworkIndex]) {
            handleNetworkSelect(networks[selectedNetworkIndex].ssid);
          } else if (focusedElement === "connect" || focusedElement === "password") {
            handleConnect();
          } else if (focusedElement === "rescan") {
            handleRescan();
          }
          break;

        case "Escape":
          e.preventDefault();
          if (selectedNetwork) {
            setSelectedNetwork(null);
            setPassword("");
            setFocusedElement("list");
          }
          break;

        case "Tab":
          if (!e.shiftKey) {
            e.preventDefault();
            if (focusedElement === "list" && selectedNetwork) {
              const network = networks.find((n) => n.ssid === selectedNetwork);
              if (network && WiFiService.requiresPassword(network.security)) {
                setFocusedElement("password");
              } else {
                setFocusedElement("connect");
              }
            } else if (focusedElement === "password") {
              setFocusedElement("connect");
            } else if (focusedElement === "connect") {
              setFocusedElement("rescan");
            } else if (focusedElement === "rescan") {
              setFocusedElement("list");
            }
          } else {
            e.preventDefault();
            if (focusedElement === "rescan") {
              setFocusedElement("connect");
            } else if (focusedElement === "connect") {
              const network = networks.find((n) => n.ssid === selectedNetwork);
              if (network && WiFiService.requiresPassword(network.security)) {
                setFocusedElement("password");
              } else {
                setFocusedElement("list");
              }
            } else if (focusedElement === "password") {
              setFocusedElement("list");
            }
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    focusedElement,
    networks,
    selectedNetworkIndex,
    selectedNetwork,
    handleNetworkSelect,
    handleConnect,
    handleRescan,
  ]);

  // Get the currently selected network object
  const selectedNetworkObj = selectedNetwork
    ? networks.find((n) => n.ssid === selectedNetwork)
    : null;
  const needsPassword = Boolean(
    selectedNetworkObj && WiFiService.requiresPassword(selectedNetworkObj.security)
  );

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <ModernIslamicBackground>
        {/* Logo */}
        <Box
          sx={{
            position: "absolute",
            top: theme.spacing(3),
            left: theme.spacing(4),
            width: "6vw",
            maxWidth: "80px",
            minWidth: "60px",
            zIndex: 10,
          }}
        >
          <img
            src={logoGold}
            alt="MasjidConnect Logo"
            style={{
              width: "100%",
              height: "auto",
              objectFit: "contain",
            }}
          />
        </Box>

        <Fade in={fadeIn} timeout={800}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              gap: 6,
              padding: theme.spacing(4),
            }}
          >
            {/* Left Section - Instructions */}
            <Box
              sx={{
                flex: "0 0 35%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                color: "#fff",
                gap: 3,
              }}
            >
              <WifiIcon sx={{ fontSize: 80, color: "#F1C40F" }} />

              <Typography
                variant="h3"
                sx={{
                  fontWeight: 700,
                  background: "linear-gradient(90deg, #F1C40F 0%, #DAA520 100%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  mb: 1,
                }}
              >
                WiFi Setup Required
              </Typography>

              <Typography
                variant="body1"
                sx={{
                  color: alpha("#fff", 0.9),
                  maxWidth: 400,
                  lineHeight: 1.8,
                }}
              >
                To complete the display setup, please connect to your WiFi network.
                Use the <strong>arrow keys</strong> to navigate,{" "}
                <strong>Enter</strong> to select, and <strong>Tab</strong> to move
                between sections.
              </Typography>

              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  borderRadius: 2,
                  background: alpha("#fff", 0.1),
                  border: `1px solid ${alpha("#fff", 0.2)}`,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ color: alpha("#fff", 0.8), fontFamily: "monospace" }}
                >
                  ↑↓ Navigate • Enter Select • Tab Switch • Esc Back
                </Typography>
              </Box>

              {allowSkip && (
                <Button
                  variant="text"
                  onClick={onSkip}
                  sx={{
                    mt: 2,
                    color: alpha("#fff", 0.6),
                    "&:hover": { color: "#fff" },
                  }}
                >
                  Skip for now
                </Button>
              )}
            </Box>

            {/* Right Section - Network List & Connection */}
            <Paper
              elevation={8}
              sx={{
                flex: "0 0 45%",
                maxWidth: 500,
                maxHeight: "80vh",
                display: "flex",
                flexDirection: "column",
                borderRadius: 3,
                overflow: "hidden",
                background: alpha("#fff", 0.95),
              }}
            >
              {/* Header */}
              <Box
                sx={{
                  p: 2,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography variant="h6" sx={{ color: "#fff", fontWeight: 600 }}>
                  Available Networks
                </Typography>
                <IconButton
                  ref={rescanButtonRef}
                  onClick={handleRescan}
                  disabled={isScanning}
                  sx={{
                    color: "#fff",
                    border:
                      focusedElement === "rescan"
                        ? "2px solid #F1C40F"
                        : "2px solid transparent",
                  }}
                >
                  {isScanning ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    <RefreshIcon />
                  )}
                </IconButton>
              </Box>

              {/* Network List */}
              <Box sx={{ flex: 1, overflow: "auto", minHeight: 200 }}>
                {isScanning && networks.length === 0 ? (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 200,
                      gap: 2,
                    }}
                  >
                    <CircularProgress size={24} />
                    <Typography color="text.secondary">
                      Scanning for networks...
                    </Typography>
                  </Box>
                ) : networks.length === 0 ? (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 200,
                      gap: 2,
                    }}
                  >
                    <WifiOffIcon sx={{ fontSize: 48, color: "text.disabled" }} />
                    <Typography color="text.secondary">
                      No networks found
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={handleRescan}
                    >
                      Scan Again
                    </Button>
                  </Box>
                ) : (
                  <List ref={listRef} sx={{ p: 0 }}>
                    {networks.map((network, index) => {
                      const isSelected = selectedNetwork === network.ssid;
                      const isFocused =
                        focusedElement === "list" && index === selectedNetworkIndex;
                      const requiresPwd = WiFiService.requiresPassword(
                        network.security,
                      );

                      return (
                        <ListItem
                          key={network.ssid}
                          disablePadding
                          sx={{
                            borderBottom: `1px solid ${alpha("#000", 0.08)}`,
                          }}
                        >
                          <ListItemButton
                            selected={isSelected}
                            onClick={() => handleNetworkSelect(network.ssid)}
                            sx={{
                              py: 1.5,
                              outline: isFocused
                                ? `3px solid ${theme.palette.primary.main}`
                                : "none",
                              outlineOffset: -3,
                              "&.Mui-selected": {
                                backgroundColor: alpha(
                                  theme.palette.primary.main,
                                  0.1,
                                ),
                                "&:hover": {
                                  backgroundColor: alpha(
                                    theme.palette.primary.main,
                                    0.15,
                                  ),
                                },
                              },
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 48 }}>
                              {getSignalIcon(network.signal)}
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Typography
                                  variant="body1"
                                  sx={{
                                    fontWeight: isSelected ? 600 : 400,
                                    color: isSelected
                                      ? theme.palette.primary.main
                                      : "text.primary",
                                  }}
                                >
                                  {network.ssid}
                                </Typography>
                              }
                              secondary={
                                <Typography variant="caption" color="text.secondary">
                                  {network.security} •{" "}
                                  {WiFiService.getSignalStrengthLabel(network.signal)}
                                </Typography>
                              }
                            />
                            {requiresPwd ? (
                              <LockIcon sx={{ color: "text.secondary", mr: 1 }} />
                            ) : (
                              <LockOpenIcon
                                sx={{ color: "text.disabled", mr: 1 }}
                              />
                            )}
                            {network.inUse && (
                              <CheckIcon sx={{ color: "success.main" }} />
                            )}
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </Box>

              {/* Password & Connect Section */}
              {selectedNetwork && (
                <Box
                  sx={{
                    p: 2,
                    borderTop: `1px solid ${alpha("#000", 0.1)}`,
                    background: alpha(theme.palette.primary.main, 0.02),
                  }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                    Connect to "{selectedNetwork}"
                  </Typography>

                  {needsPassword && (
                    <TextField
                      inputRef={passwordRef}
                      fullWidth
                      type={showPassword ? "text" : "password"}
                      label="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedElement("password")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleConnect();
                        }
                      }}
                      disabled={isConnecting}
                      autoComplete="off"
                      sx={{
                        mb: 2,
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 2,
                          outline:
                            focusedElement === "password"
                              ? `3px solid ${theme.palette.primary.main}`
                              : "none",
                        },
                      }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
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
                  )}

                  {error && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 2,
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

                  {connectionStatus === "connected" && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 2,
                        p: 1.5,
                        borderRadius: 1,
                        background: alpha(theme.palette.success.main, 0.1),
                        color: theme.palette.success.main,
                      }}
                    >
                      <CheckIcon fontSize="small" />
                      <Typography variant="body2">
                        Successfully connected!
                      </Typography>
                    </Box>
                  )}

                  <Button
                    ref={connectButtonRef}
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={handleConnect}
                    disabled={isConnecting || (needsPassword && !password)}
                    onFocus={() => setFocusedElement("connect")}
                    sx={{
                      py: 1.5,
                      borderRadius: 2,
                      fontWeight: 600,
                      outline:
                        focusedElement === "connect"
                          ? `3px solid ${theme.palette.warning.main}`
                          : "none",
                      outlineOffset: 2,
                    }}
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
                    ) : connectionStatus === "connected" ? (
                      <>
                        <CheckIcon sx={{ mr: 1 }} />
                        Connected!
                      </>
                    ) : (
                      "Connect"
                    )}
                  </Button>
                </Box>
              )}
            </Paper>
          </Box>
        </Fade>
      </ModernIslamicBackground>
    </Box>
  );
};

export default WiFiSetupScreen;


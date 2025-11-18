/**
 * NotificationBar Component
 *
 * Displays notifications in a corner/footer position matching the screen design style.
 * Replaces Snackbar popups with inline notifications that respect orientation.
 */

import React, { useEffect, useCallback, useRef } from "react";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import CachedIcon from "@mui/icons-material/Cached";
import SettingsIcon from "@mui/icons-material/Settings";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import DownloadIcon from "@mui/icons-material/Download";
import logger from "../../utils/logger";
import updateService from "../../services/updateService";
import useFactoryReset from "../../hooks/useFactoryReset";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  selectUpdateState,
  downloadUpdate,
  installUpdate,
  dismissUpdateNotification,
} from "../../store/slices/updateSlice";
import { useNotifications } from "../../contexts/NotificationContext";

interface NotificationBarProps {
  /**
   * Filter which notification types to show.
   * If not provided, shows all notifications.
   */
  types?: ("remote-command" | "update")[];
}

const NotificationBar: React.FC<NotificationBarProps> = ({ types }) => {
  const dispatch = useAppDispatch();
  const updateState = useAppSelector(selectUpdateState);
  const { confirmReset } = useFactoryReset();
  const { addNotification, removeNotification, getCurrentNotification } =
    useNotifications();

  // Refs for tracking
  const currentCommandIdRef = useRef<string | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [countdownSeconds, setCountdownSeconds] = React.useState<number | null>(
    null,
  );
  const [countdownType, setCountdownType] = React.useState<
    "restart" | "factory-reset" | null
  >(null);

  // Handle countdown timer
  useEffect(() => {
    if (countdownSeconds === null || countdownSeconds <= 0) {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }

      if (countdownSeconds === 0 && countdownType) {
        executeCountdownCommand();
      }
      return;
    }

    countdownTimerRef.current = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev === null || prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [countdownSeconds, countdownType]);

  // Execute countdown command
  const executeCountdownCommand = useCallback(async () => {
    if (!countdownType) return;

    logger.info("Executing countdown command", { type: countdownType });

    try {
      if (countdownType === "restart") {
        await updateService.restartApp();
      } else if (countdownType === "factory-reset") {
        await confirmReset();
      }
    } catch (error) {
      logger.error("Error executing countdown command", { error });
    }

    currentCommandIdRef.current = null;
    setCountdownType(null);
    setCountdownSeconds(null);
  }, [countdownType, confirmReset]);

  // Cancel countdown
  const cancelCountdown = useCallback(() => {
    logger.info("Countdown cancelled by user", { type: countdownType });
    currentCommandIdRef.current = null;
    setCountdownType(null);
    setCountdownSeconds(null);
    const current = getCurrentNotification();
    if (current && current.key === "countdown") {
      removeNotification(current.id);
    }
  }, [countdownType, getCurrentNotification, removeNotification]);

  // Listen for remote command events
  useEffect(() => {
    if (types && !types.includes("remote-command")) {
      return;
    }
    const handleRestartApp = (event: CustomEvent) => {
      const incomingCommandId = event.detail?.commandId || "unknown";
      const countdown = event.detail?.countdown || 10;

      if (currentCommandIdRef.current === incomingCommandId) {
        return;
      }

      currentCommandIdRef.current = incomingCommandId;
      setCountdownType("restart");
      setCountdownSeconds(countdown);

      addNotification({
        type: "warning",
        title: "Restarting App",
        message: `Restarting in ${countdown}s`,
        icon: <RestartAltIcon />,
        autoHide: 0,
        key: "countdown",
      });
    };

    const handleFactoryReset = (event: CustomEvent) => {
      const incomingCommandId = event.detail?.commandId || "unknown";
      const countdown = event.detail?.countdown || 30;

      if (currentCommandIdRef.current === incomingCommandId) {
        return;
      }

      currentCommandIdRef.current = incomingCommandId;
      setCountdownType("factory-reset");
      setCountdownSeconds(countdown);

      addNotification({
        type: "warning",
        title: "Factory Reset",
        message: `Resetting in ${countdown}s`,
        icon: <DeleteForeverIcon />,
        autoHide: 0,
        key: "countdown",
      });
    };

    const handleReloadContent = () => {
      addNotification({
        type: "info",
        title: "Reloading Content",
        message: "Refreshing...",
        icon: <CachedIcon />,
        autoHide: 3000,
      });
    };

    const handleUpdateSettings = () => {
      addNotification({
        type: "success",
        title: "Settings Updated",
        message: "Updated",
        icon: <SettingsIcon />,
        autoHide: 3000,
      });
    };

    const handleScreenshot = () => {
      addNotification({
        type: "success",
        title: "Screenshot Captured",
        message: "Sent",
        icon: <CameraAltIcon />,
        autoHide: 3000,
      });
    };

    const handleCommandThrottled = (event: CustomEvent) => {
      addNotification({
        type: "warning",
        title: "Command Queued",
        message: "Queued",
        icon: <WarningIcon />,
        autoHide: 3000,
      });
    };

    const handleCommandCompleted = (event: CustomEvent) => {
      const commandType = event.detail?.type || "unknown";
      const success = event.detail?.success !== false;

      const commandsWithSpecificNotifications = [
        "FORCE_UPDATE",
        "RESTART_APP",
        "RELOAD_CONTENT",
        "UPDATE_SETTINGS",
        "FACTORY_RESET",
        "CAPTURE_SCREENSHOT",
        "CLEAR_CACHE",
      ];

      if (commandsWithSpecificNotifications.includes(commandType)) {
        return;
      }

      addNotification({
        type: success ? "success" : "error",
        title: success ? "Command Completed" : "Command Failed",
        message: success ? "Completed" : "Failed",
        icon: <CheckCircleIcon />,
        autoHide: 3000,
      });
    };

    const handleForceUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const action = detail?.action || "checking";
      const version = detail?.version;

      if (action === "installing") {
        addNotification({
          type: "success",
          title: "Installing Update",
          message: version ? `Installing ${version}...` : "Installing...",
          icon: <SystemUpdateIcon />,
          autoHide: 0, // Don't auto-hide during installation
        });
      } else {
        addNotification({
          type: "info",
          title: "Checking for Updates",
          message: "Checking for updates...",
          icon: <SystemUpdateIcon />,
          progress: 0,
          autoHide: 5000,
        });
      }
    };

    window.addEventListener(
      "remote:restart-app",
      handleRestartApp as EventListener,
    );
    window.addEventListener(
      "remote:factory-reset",
      handleFactoryReset as EventListener,
    );
    window.addEventListener("remote:reload-content", handleReloadContent);
    window.addEventListener("remote:update-settings", handleUpdateSettings);
    window.addEventListener("remote:screenshot-captured", handleScreenshot);
    window.addEventListener(
      "remote:command-throttled",
      handleCommandThrottled as EventListener,
    );
    window.addEventListener(
      "remote:command-completed",
      handleCommandCompleted as EventListener,
    );
    window.addEventListener("remote:force-update", handleForceUpdate);

    return () => {
      window.removeEventListener(
        "remote:restart-app",
        handleRestartApp as EventListener,
      );
      window.removeEventListener(
        "remote:factory-reset",
        handleFactoryReset as EventListener,
      );
      window.removeEventListener("remote:reload-content", handleReloadContent);
      window.removeEventListener(
        "remote:update-settings",
        handleUpdateSettings,
      );
      window.removeEventListener(
        "remote:screenshot-captured",
        handleScreenshot,
      );
      window.removeEventListener(
        "remote:command-throttled",
        handleCommandThrottled as EventListener,
      );
      window.removeEventListener(
        "remote:command-completed",
        handleCommandCompleted as EventListener,
      );
      window.removeEventListener("remote:force-update", handleForceUpdate);
    };
  }, [addNotification, cancelCountdown, types]);

  // Handle update notifications
  useEffect(() => {
    if (types && !types.includes("update")) {
      return;
    }
    if (
      updateState.updateAvailable &&
      !updateState.downloading &&
      !updateState.updateDownloaded
    ) {
      const current = getCurrentNotification();
      if (!current || current.key !== "update-available") {
        addNotification({
          type: "info",
          title: "Update Available",
          message: `Update ${updateState.latestVersion}`,
          icon: <SystemUpdateIcon />,
          autoHide: 5000,
          key: "update-available",
        });
      }
    } else if (updateState.downloading) {
      const current = getCurrentNotification();
      if (current && current.key === "update-downloading") {
        // Update existing notification
        removeNotification(current.id);
      }
      addNotification({
        type: "info",
        title: "Downloading Update",
        message: `${updateState.downloadProgress.toFixed(0)}%`,
        icon: <DownloadIcon />,
        autoHide: 0,
        key: "update-downloading",
      });
    } else if (updateState.updateReady) {
      const current = getCurrentNotification();
      if (!current || current.key !== "update-ready") {
        addNotification({
          type: "success",
          title: "Update Ready",
          message: `Ready: ${updateState.latestVersion}`,
          icon: <SystemUpdateIcon />,
          autoHide: 5000,
          key: "update-ready",
        });
      }
    } else if (updateState.error) {
      addNotification({
        type: "error",
        title: "Update Error",
        message:
          updateState.error.length > 30
            ? updateState.error.substring(0, 30) + "..."
            : updateState.error,
        icon: <WarningIcon />,
        autoHide: 6000,
      });
    }
  }, [
    updateState,
    addNotification,
    removeNotification,
    dispatch,
    types,
    getCurrentNotification,
  ]);

  // Update countdown notification
  useEffect(() => {
    if (countdownSeconds !== null && countdownType) {
      const current = getCurrentNotification();
      if (current && current.key === "countdown") {
        // Remove old notification and add updated one
        removeNotification(current.id);
        addNotification({
          type: "warning",
          title:
            countdownType === "restart" ? "Restarting App" : "Factory Reset",
          message:
            countdownType === "restart"
              ? `${countdownSeconds}s`
              : `${countdownSeconds}s`,
          icon:
            countdownType === "restart" ? (
              <RestartAltIcon />
            ) : (
              <DeleteForeverIcon />
            ),
          autoHide: 0,
          key: "countdown",
        });
      }
    }
  }, [
    countdownSeconds,
    countdownType,
    getCurrentNotification,
    removeNotification,
    addNotification,
    cancelCountdown,
  ]);

  // This component doesn't render anything - it just manages notifications via context
  return null;
};

export default NotificationBar;

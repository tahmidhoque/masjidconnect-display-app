/**
 * Remote Command Notification Component
 *
 * Displays notifications and countdown timers for remote control commands
 * from the admin portal. Allows users to cancel destructive operations.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Snackbar, Alert, AlertTitle, Button, Box, Typography, LinearProgress, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import CachedIcon from '@mui/icons-material/Cached';
import SettingsIcon from '@mui/icons-material/Settings';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import logger from '../../utils/logger';
import updateService from '../../services/updateService';
import useFactoryReset from '../../hooks/useFactoryReset';
import { useAppDispatch } from '../../store/hooks';
import { addNotification } from '../../store/slices/uiSlice';

interface RemoteCommandNotificationProps {
  position?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
}

interface CountdownCommand {
  type: 'restart' | 'factory-reset';
  countdown: number;
  commandId: string;
}

const RemoteCommandNotification: React.FC<RemoteCommandNotificationProps> = ({
  position = { vertical: 'top', horizontal: 'center' },
}) => {
  const dispatch = useAppDispatch();
  const [countdownCommand, setCountdownCommand] = useState<CountdownCommand | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [showReloadMessage, setShowReloadMessage] = useState(false);
  const [showSettingsMessage, setShowSettingsMessage] = useState(false);
  const [showScreenshotMessage, setShowScreenshotMessage] = useState(false);
  const [showForceUpdateProgress, setShowForceUpdateProgress] = useState(false);
  const [showCommandReceived, setShowCommandReceived] = useState(false);
  const [showCommandThrottled, setShowCommandThrottled] = useState(false);
  const [showCommandCompleted, setShowCommandCompleted] = useState(false);
  const [commandReceivedType, setCommandReceivedType] = useState<string>('');
  const [commandCompletedType, setCommandCompletedType] = useState<string>('');
  const [commandCompletedSuccess, setCommandCompletedSuccess] = useState<boolean>(true);

  const { confirmReset } = useFactoryReset();

  // Handle countdown timer
  useEffect(() => {
    if (!countdownCommand || secondsRemaining <= 0) return;

    const timer = setTimeout(() => {
      const newSeconds = secondsRemaining - 1;
      setSecondsRemaining(newSeconds);

      if (newSeconds <= 0) {
        executeCountdownCommand();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdownCommand, secondsRemaining]);

  // Execute the command after countdown completes
  const executeCountdownCommand = useCallback(async () => {
    if (!countdownCommand) return;

    logger.info('Executing countdown command', { type: countdownCommand.type });

    try {
      if (countdownCommand.type === 'restart') {
        await updateService.restartApp();
      } else if (countdownCommand.type === 'factory-reset') {
        await confirmReset();
      }
    } catch (error) {
      logger.error('Error executing countdown command', { error });
    }

    setCountdownCommand(null);
    setSecondsRemaining(0);
  }, [countdownCommand, confirmReset]);

  // Cancel countdown
  const cancelCountdown = useCallback(() => {
    logger.info('Countdown cancelled by user', { type: countdownCommand?.type });
    setCountdownCommand(null);
    setSecondsRemaining(0);
  }, [countdownCommand]);

  // Listen for remote command events
  useEffect(() => {
    const handleCommandReceived = (event: CustomEvent) => {
      logger.info('Remote command received event', { type: event.detail?.type });
      const commandType = event.detail?.type || 'unknown';
      setCommandReceivedType(commandType);
      setShowCommandReceived(true);
      
      // Also add to Redux notifications
      dispatch(addNotification({
        type: 'info',
        message: `Remote command received: ${commandType}`,
        duration: 3000,
      }));
      
      setTimeout(() => setShowCommandReceived(false), 3000);
    };

    const handleCommandThrottled = (event: CustomEvent) => {
      logger.info('Remote command throttled event', { type: event.detail?.type });
      setShowCommandThrottled(true);
      
      dispatch(addNotification({
        type: 'warning',
        message: `Command ${event.detail?.type || 'unknown'} is queued (throttled)`,
        duration: 3000,
      }));
      
      setTimeout(() => setShowCommandThrottled(false), 3000);
    };

    const handleCommandCompleted = (event: CustomEvent) => {
      logger.info('Remote command completed event', { 
        type: event.detail?.type,
        success: event.detail?.success 
      });
      const commandType = event.detail?.type || 'unknown';
      const success = event.detail?.success !== false;
      
      setCommandCompletedType(commandType);
      setCommandCompletedSuccess(success);
      setShowCommandCompleted(true);
      
      dispatch(addNotification({
        type: success ? 'success' : 'error',
        message: `Command ${commandType} ${success ? 'completed successfully' : 'failed'}`,
        duration: 3000,
      }));
      
      setTimeout(() => setShowCommandCompleted(false), 3000);
    };

    const handleRestartApp = (event: CustomEvent) => {
      logger.info('Remote restart app event received');
      const countdown = event.detail?.countdown || 10;
      setCountdownCommand({
        type: 'restart',
        countdown,
        commandId: event.detail?.commandId || 'unknown',
      });
      setSecondsRemaining(countdown);
    };

    const handleFactoryReset = (event: CustomEvent) => {
      logger.info('Remote factory reset event received');
      const countdown = event.detail?.countdown || 30;
      setCountdownCommand({
        type: 'factory-reset',
        countdown,
        commandId: event.detail?.commandId || 'unknown',
      });
      setSecondsRemaining(countdown);
    };

    const handleReloadContent = () => {
      logger.info('Remote reload content event received');
      setShowReloadMessage(true);
      setTimeout(() => setShowReloadMessage(false), 3000);
    };

    const handleUpdateSettings = () => {
      logger.info('Remote update settings event received');
      setShowSettingsMessage(true);
      setTimeout(() => setShowSettingsMessage(false), 3000);
    };

    const handleScreenshot = () => {
      logger.info('Remote screenshot captured event received');
      setShowScreenshotMessage(true);
      setTimeout(() => setShowScreenshotMessage(false), 3000);
    };

    const handleForceUpdate = () => {
      logger.info('Remote force update event received');
      setShowForceUpdateProgress(true);
      // Hide after 5 seconds or when update completes
      setTimeout(() => setShowForceUpdateProgress(false), 5000);
    };

    window.addEventListener('remote:command-received', handleCommandReceived as EventListener);
    window.addEventListener('remote:command-throttled', handleCommandThrottled as EventListener);
    window.addEventListener('remote:command-completed', handleCommandCompleted as EventListener);
    window.addEventListener('remote:restart-app', handleRestartApp as EventListener);
    window.addEventListener('remote:factory-reset', handleFactoryReset as EventListener);
    window.addEventListener('remote:reload-content', handleReloadContent);
    window.addEventListener('remote:update-settings', handleUpdateSettings);
    window.addEventListener('remote:screenshot-captured', handleScreenshot);
    window.addEventListener('remote:force-update', handleForceUpdate);

    return () => {
      window.removeEventListener('remote:command-received', handleCommandReceived as EventListener);
      window.removeEventListener('remote:command-throttled', handleCommandThrottled as EventListener);
      window.removeEventListener('remote:command-completed', handleCommandCompleted as EventListener);
      window.removeEventListener('remote:restart-app', handleRestartApp as EventListener);
      window.removeEventListener('remote:factory-reset', handleFactoryReset as EventListener);
      window.removeEventListener('remote:reload-content', handleReloadContent);
      window.removeEventListener('remote:update-settings', handleUpdateSettings);
      window.removeEventListener('remote:screenshot-captured', handleScreenshot);
      window.removeEventListener('remote:force-update', handleForceUpdate);
    };
  }, [dispatch]);

  // Render countdown notification
  if (countdownCommand) {
    const isFactoryReset = countdownCommand.type === 'factory-reset';
    const progress = ((countdownCommand.countdown - secondsRemaining) / countdownCommand.countdown) * 100;

    return (
      <Snackbar open={true} anchorOrigin={position} sx={{ maxWidth: '600px' }}>
        <Alert
          icon={isFactoryReset ? <DeleteForeverIcon /> : <RestartAltIcon />}
          severity="warning"
          action={
            <Button
              color="inherit"
              size="small"
              variant="outlined"
              onClick={cancelCountdown}
              sx={{ fontWeight: 600, borderColor: 'currentColor' }}
            >
              Cancel
            </Button>
          }
          sx={{
            width: '100%',
            borderRadius: '8px',
            '& .MuiAlert-message': {
              width: '100%',
            },
          }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>
            {isFactoryReset ? 'Factory Reset in Progress' : 'Restarting App'}
          </AlertTitle>
          <Box sx={{ width: '100%', mt: 1 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {isFactoryReset
                ? 'All data will be erased and app will reset to initial state.'
                : 'The application will restart to apply changes.'}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" fontWeight={600}>
                Time remaining:
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {secondsRemaining}s
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                },
              }}
            />
          </Box>
        </Alert>
      </Snackbar>
    );
  }

  // Render reload content message
  if (showReloadMessage) {
    return (
      <Snackbar
        open={showReloadMessage}
        autoHideDuration={3000}
        onClose={() => setShowReloadMessage(false)}
        anchorOrigin={position}
      >
        <Alert
          icon={<CachedIcon />}
          severity="info"
          onClose={() => setShowReloadMessage(false)}
          sx={{ borderRadius: '8px' }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>Content Reloading</AlertTitle>
          Refreshing all content from server...
        </Alert>
      </Snackbar>
    );
  }

  // Render settings updated message
  if (showSettingsMessage) {
    return (
      <Snackbar
        open={showSettingsMessage}
        autoHideDuration={3000}
        onClose={() => setShowSettingsMessage(false)}
        anchorOrigin={position}
      >
        <Alert
          icon={<SettingsIcon />}
          severity="success"
          onClose={() => setShowSettingsMessage(false)}
          sx={{ borderRadius: '8px' }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>Settings Updated</AlertTitle>
          Display settings have been updated remotely.
        </Alert>
      </Snackbar>
    );
  }

  // Render screenshot captured message
  if (showScreenshotMessage) {
    return (
      <Snackbar
        open={showScreenshotMessage}
        autoHideDuration={3000}
        onClose={() => setShowScreenshotMessage(false)}
        anchorOrigin={position}
      >
        <Alert
          icon={<CameraAltIcon />}
          severity="success"
          onClose={() => setShowScreenshotMessage(false)}
          sx={{ borderRadius: '8px' }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>Screenshot Captured</AlertTitle>
          Screen capture sent to admin portal.
        </Alert>
      </Snackbar>
    );
  }

  // Render command received notification
  if (showCommandReceived) {
    return (
      <Snackbar
        open={showCommandReceived}
        autoHideDuration={3000}
        onClose={() => setShowCommandReceived(false)}
        anchorOrigin={position}
      >
        <Alert
          icon={<SystemUpdateIcon />}
          severity="info"
          onClose={() => setShowCommandReceived(false)}
          sx={{ borderRadius: '8px' }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>Remote Command Received</AlertTitle>
          Processing command: {commandReceivedType}
        </Alert>
      </Snackbar>
    );
  }

  // Render command throttled notification
  if (showCommandThrottled) {
    return (
      <Snackbar
        open={showCommandThrottled}
        autoHideDuration={3000}
        onClose={() => setShowCommandThrottled(false)}
        anchorOrigin={position}
      >
        <Alert
          icon={<WarningIcon />}
          severity="warning"
          onClose={() => setShowCommandThrottled(false)}
          sx={{ borderRadius: '8px' }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>Command Queued</AlertTitle>
          Command is queued due to rate limiting. It will execute shortly.
        </Alert>
      </Snackbar>
    );
  }

  // Render command completed notification
  if (showCommandCompleted) {
    return (
      <Snackbar
        open={showCommandCompleted}
        autoHideDuration={3000}
        onClose={() => setShowCommandCompleted(false)}
        anchorOrigin={position}
      >
        <Alert
          icon={<CheckCircleIcon />}
          severity={commandCompletedSuccess ? 'success' : 'error'}
          onClose={() => setShowCommandCompleted(false)}
          sx={{ borderRadius: '8px' }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>
            {commandCompletedSuccess ? 'Command Completed' : 'Command Failed'}
          </AlertTitle>
          Command {commandCompletedType} {commandCompletedSuccess ? 'executed successfully' : 'failed to execute'}.
        </Alert>
      </Snackbar>
    );
  }

  // Render force update progress
  if (showForceUpdateProgress) {
    return (
      <Snackbar
        open={showForceUpdateProgress}
        anchorOrigin={position}
        sx={{ maxWidth: '500px' }}
      >
        <Alert
          icon={<SystemUpdateIcon />}
          severity="info"
          sx={{ borderRadius: '8px', width: '100%' }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>Checking for Updates</AlertTitle>
          <Box sx={{ width: '100%', mt: 1 }}>
            <LinearProgress sx={{ borderRadius: 4, height: 6 }} />
            <Typography variant="body2" sx={{ mt: 1 }}>
              Downloading update if available...
            </Typography>
          </Box>
        </Alert>
      </Snackbar>
    );
  }

  return null;
};

export default RemoteCommandNotification;

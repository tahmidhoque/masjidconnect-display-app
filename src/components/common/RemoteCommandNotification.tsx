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
import logger from '../../utils/logger';
import updateService from '../../services/updateService';
import useFactoryReset from '../../hooks/useFactoryReset';

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
  const [countdownCommand, setCountdownCommand] = useState<CountdownCommand | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [showReloadMessage, setShowReloadMessage] = useState(false);
  const [showSettingsMessage, setShowSettingsMessage] = useState(false);
  const [showScreenshotMessage, setShowScreenshotMessage] = useState(false);

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

    window.addEventListener('remote:restart-app', handleRestartApp as EventListener);
    window.addEventListener('remote:factory-reset', handleFactoryReset as EventListener);
    window.addEventListener('remote:reload-content', handleReloadContent);
    window.addEventListener('remote:update-settings', handleUpdateSettings);
    window.addEventListener('remote:screenshot-captured', handleScreenshot);

    return () => {
      window.removeEventListener('remote:restart-app', handleRestartApp as EventListener);
      window.removeEventListener('remote:factory-reset', handleFactoryReset as EventListener);
      window.removeEventListener('remote:reload-content', handleReloadContent);
      window.removeEventListener('remote:update-settings', handleUpdateSettings);
      window.removeEventListener('remote:screenshot-captured', handleScreenshot);
    };
  }, []);

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

  return null;
};

export default RemoteCommandNotification;

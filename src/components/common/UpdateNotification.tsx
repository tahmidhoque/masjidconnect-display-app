/**
 * Update Notification Component
 *
 * Displays notifications for OTA updates including:
 * - Update available notification
 * - Download progress
 * - Update ready to install notification
 */

import React, { useState, useEffect } from 'react';
import { Snackbar, Alert, AlertTitle, Button, Box, LinearProgress, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import DownloadIcon from '@mui/icons-material/Download';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectUpdateState,
  downloadUpdate,
  installUpdate,
  dismissUpdateNotification,
} from '../../store/slices/updateSlice';
import logger from '../../utils/logger';

interface UpdateNotificationProps {
  position?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  position = { vertical: 'top', horizontal: 'right' },
}) => {
  const dispatch = useAppDispatch();
  const updateState = useAppSelector(selectUpdateState);

  const [showAvailable, setShowAvailable] = useState(false);
  const [showDownloading, setShowDownloading] = useState(false);
  const [showReady, setShowReady] = useState(false);
  const [showError, setShowError] = useState(false);

  // Show appropriate notification based on update state
  useEffect(() => {
    if (updateState.updateAvailable && !updateState.downloading && !updateState.updateDownloaded) {
      setShowAvailable(true);
      setShowDownloading(false);
      setShowReady(false);
      setShowError(false);
    } else if (updateState.downloading) {
      setShowAvailable(false);
      setShowDownloading(true);
      setShowReady(false);
      setShowError(false);
    } else if (updateState.updateReady) {
      setShowAvailable(false);
      setShowDownloading(false);
      setShowReady(true);
      setShowError(false);
    } else if (updateState.error) {
      setShowError(true);
    }
  }, [updateState]);

  // Handle download button click
  const handleDownload = () => {
    logger.info('User initiated update download');
    dispatch(downloadUpdate());
    setShowAvailable(false);
  };

  // Handle install button click
  const handleInstall = () => {
    logger.info('User initiated update installation');
    dispatch(installUpdate());
    setShowReady(false);
  };

  // Handle dismiss (Later button)
  const handleDismiss = () => {
    logger.info('User dismissed update notification');
    dispatch(dismissUpdateNotification());
    setShowAvailable(false);
    setShowDownloading(false);
    setShowReady(false);
  };

  // Handle error dismiss
  const handleErrorDismiss = () => {
    setShowError(false);
  };

  // Update Available Notification
  if (showAvailable) {
    return (
      <Snackbar open={showAvailable} anchorOrigin={position} sx={{ maxWidth: '500px' }}>
        <Alert
          icon={<SystemUpdateIcon />}
          severity="info"
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button color="inherit" size="small" onClick={handleDismiss} sx={{ fontWeight: 600 }}>
                Later
              </Button>
              <Button
                color="inherit"
                size="small"
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleDownload}
                sx={{ fontWeight: 600, borderColor: 'currentColor' }}
              >
                Download
              </Button>
              <IconButton size="small" aria-label="close" color="inherit" onClick={handleDismiss}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          }
          sx={{
            width: '100%',
            borderRadius: '8px',
            '& .MuiAlert-message': {
              flex: 1,
            },
          }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>Update Available</AlertTitle>A new version ({updateState.latestVersion})
          is available.
        </Alert>
      </Snackbar>
    );
  }

  // Downloading Notification
  if (showDownloading) {
    return (
      <Snackbar open={showDownloading} anchorOrigin={position} sx={{ maxWidth: '500px' }}>
        <Alert
          icon={<DownloadIcon />}
          severity="info"
          sx={{
            width: '100%',
            borderRadius: '8px',
            '& .MuiAlert-message': {
              width: '100%',
            },
          }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>Downloading Update</AlertTitle>
          <Box sx={{ width: '100%', mt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2">{updateState.latestVersion}</Typography>
              <Typography variant="body2">{updateState.downloadProgress.toFixed(1)}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={updateState.downloadProgress}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                },
              }}
            />
            {updateState.downloadSpeed > 0 && (
              <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                {(updateState.downloadSpeed / 1024 / 1024).toFixed(2)} MB/s
              </Typography>
            )}
          </Box>
        </Alert>
      </Snackbar>
    );
  }

  // Update Ready Notification
  if (showReady) {
    return (
      <Snackbar open={showReady} anchorOrigin={position} sx={{ maxWidth: '500px' }}>
        <Alert
          icon={<SystemUpdateIcon />}
          severity="success"
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button color="inherit" size="small" onClick={handleDismiss} sx={{ fontWeight: 600 }}>
                Later
              </Button>
              <Button
                color="inherit"
                size="small"
                variant="outlined"
                startIcon={<RestartAltIcon />}
                onClick={handleInstall}
                sx={{ fontWeight: 600, borderColor: 'currentColor' }}
              >
                Install Now
              </Button>
              <IconButton size="small" aria-label="close" color="inherit" onClick={handleDismiss}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          }
          sx={{
            width: '100%',
            borderRadius: '8px',
            '& .MuiAlert-message': {
              flex: 1,
            },
          }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>Update Ready</AlertTitle>
          Version {updateState.latestVersion} has been downloaded. Restart to install.
        </Alert>
      </Snackbar>
    );
  }

  // Error Notification
  if (showError && updateState.error) {
    return (
      <Snackbar
        open={showError}
        autoHideDuration={6000}
        onClose={handleErrorDismiss}
        anchorOrigin={position}
        sx={{ maxWidth: '500px' }}
      >
        <Alert
          severity="error"
          onClose={handleErrorDismiss}
          sx={{
            width: '100%',
            borderRadius: '8px',
          }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>Update Error</AlertTitle>
          {updateState.error}
        </Alert>
      </Snackbar>
    );
  }

  return null;
};

export default UpdateNotification;

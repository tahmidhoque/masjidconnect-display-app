import React, { useState, useEffect } from 'react';
import { Box, Typography, Snackbar, Alert, AlertTitle } from '@mui/material';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import { formatDistanceToNow } from 'date-fns';

interface OfflineNotificationProps {
  position?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
  showNotification?: boolean;
}

const OfflineNotification: React.FC<OfflineNotificationProps> = ({
  position = { vertical: 'top', horizontal: 'right' },
  showNotification = true
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);

  // Handle network status changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastSyncTime(new Date());
      setSnackbarOpen(true);
      setTimeout(() => setSnackbarOpen(false), 3000);
      console.log('[OfflineIndicator] Connection restored');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('[OfflineIndicator] Connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Don't show if always online and never had a sync time
  if (isOnline && !lastSyncTime && !showNotification) {
    return null;
  }

  // Show success snackbar when coming back online
  if (isOnline && snackbarOpen) {
    return (
      <Snackbar 
        open={snackbarOpen} 
        autoHideDuration={3000} 
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          <AlertTitle>Connection Restored</AlertTitle>
          You are back online.
        </Alert>
      </Snackbar>
    );
  }

  // Don't show offline indicator if showNotification is false
  if (!showNotification) {
    return null;
  }

  // Enhanced offline/online indicator
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 16,
        right: 16,
        backgroundColor: isOnline ? 'success.main' : 'error.main',
        color: 'white',
        padding: 2,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        zIndex: 9999,
        boxShadow: 3,
      }}
    >
      {isOnline ? (
        <>
          <CloudDoneIcon />
          <Typography variant="body2">
            Online{lastSyncTime && ` • Synced ${formatDistanceToNow(lastSyncTime, { addSuffix: true })}`}
          </Typography>
        </>
      ) : (
        <>
          <CloudOffIcon />
          <Typography variant="body2">
            Offline Mode • Showing cached content
          </Typography>
        </>
      )}
    </Box>
  );
};

export default OfflineNotification; 
import React, { useState, useEffect } from 'react';
import { Box, Typography, Snackbar, Alert, AlertTitle, Tooltip } from '@mui/material';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useTheme } from '@mui/material/styles';

interface OfflineNotificationProps {
  position?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
  showNotification?: boolean;
}

const OfflineNotification: React.FC<OfflineNotificationProps> = ({
  position = { vertical: 'bottom', horizontal: 'left' },
  showNotification = true
}) => {
  const theme = useTheme();
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [lastOfflineTime, setLastOfflineTime] = useState<Date | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);

  // Handle network status changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setSnackbarOpen(true);
      setTimeout(() => setSnackbarOpen(false), 3000);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setLastOfflineTime(new Date());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Format time since offline
  const formatTimeSinceOffline = (): string => {
    if (!lastOfflineTime) return '';
    
    const now = new Date();
    const diffInMs = now.getTime() - lastOfflineTime.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes === 1) return '1 minute ago';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours === 1) return '1 hour ago';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return '1 day ago';
    return `${diffInDays} days ago`;
  };

  if (!isOffline) {
    return (
      <Snackbar 
        open={snackbarOpen} 
        autoHideDuration={3000} 
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: position.vertical, horizontal: position.horizontal }}
      >
        <Alert severity="success" sx={{ width: '100%' }}>
          <AlertTitle>Connection Restored</AlertTitle>
          You are back online.
        </Alert>
      </Snackbar>
    );
  }

  if (!showNotification) {
    return null;
  }

  // Footer-integrated indicator for offline status
  return (
    <Box
      sx={{
        position: 'fixed',
        [position.vertical]: 8,
        [position.horizontal]: 8,
        zIndex: 999,
      }}
    >
      <Tooltip
        title={
          <Box>
            <Typography variant="body2" fontWeight="bold">Offline Mode</Typography>
            {lastOfflineTime && (
              <Typography variant="caption" component="div">
                Disconnected {formatTimeSinceOffline()}
              </Typography>
            )}
          </Box>
        }
        arrow
        placement="top"
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: theme.palette.primary.dark,
            color: theme.palette.primary.contrastText,
            fontSize: '0.75rem',
            opacity: 0.8,
            '&:hover': {
              opacity: 1,
            }
          }}
        >
          <WifiOffIcon 
            sx={{ 
              fontSize: '0.875rem',
              marginRight: '4px' 
            }} 
          />
          <Typography variant="caption">Offline</Typography>
        </Box>
      </Tooltip>
    </Box>
  );
};

export default OfflineNotification; 
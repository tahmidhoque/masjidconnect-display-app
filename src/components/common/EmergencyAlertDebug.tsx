import React from 'react';
import { Box, Button, Tooltip } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import { useEmergencyAlert } from '../../contexts/EmergencyAlertContext';

/**
 * EmergencyAlertDebug
 * 
 * A debug component that shows a button in the corner of the screen
 * to trigger a test emergency alert. Only shown in development mode.
 */
const EmergencyAlertDebug: React.FC = () => {
  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  const { createTestAlert } = useEmergencyAlert();
  
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 1000,
      }}
    >
      <Tooltip title="Test Emergency Alert System">
        <Button
          variant="contained"
          color="error"
          size="small"
          onClick={createTestAlert}
          startIcon={<WarningIcon />}
          sx={{
            borderRadius: 8,
            opacity: 0.7,
            '&:hover': {
              opacity: 1
            }
          }}
        >
          Test Alert
        </Button>
      </Tooltip>
    </Box>
  );
};

export default EmergencyAlertDebug; 
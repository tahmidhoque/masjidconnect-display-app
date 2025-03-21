import React from 'react';
import { useEmergencyAlert } from '../../contexts/EmergencyAlertContext';
import { Paper, Typography, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { keyframes } from '@mui/system';

// Define the fade-in animation
const fadeInAnimation = keyframes`
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const EmergencyAlert: React.FC = () => {
  const { currentAlert, hasActiveAlert, clearAlert } = useEmergencyAlert();

  return (
    <>
      {hasActiveAlert && (
        <Paper
          elevation={3}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            bgcolor: currentAlert?.color || '#f44336',
            color: 'white',
            p: 2,
            borderRadius: 0,
            animation: `${fadeInAnimation} 0.5s ease-in-out`
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
              {currentAlert?.title || 'Emergency Alert'}
            </Typography>
            <IconButton
              size="small"
              aria-label="close"
              color="inherit"
              onClick={clearAlert}
              sx={{ ml: 2 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Typography variant="body1">
            {currentAlert?.message || 'Emergency alert details not available'}
          </Typography>
        </Paper>
      )}
    </>
  );
};

export default EmergencyAlert; 
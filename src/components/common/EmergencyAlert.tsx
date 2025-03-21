import React, { useState } from 'react';
import { useEmergencyAlert } from '../../contexts/EmergencyAlertContext';
import { Alert, Button, Paper, Typography, Box, IconButton, Menu, MenuItem } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MoreVertIcon from '@mui/icons-material/MoreVert';
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
  const { currentAlert, hasActiveAlert, clearAlert, createTestAlert, testSSEConnection } = useEmergencyAlert();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      {/* This hidden debug button is only visible in development mode */}
      {process.env.NODE_ENV === 'development' && !hasActiveAlert && (
        <Box position="fixed" bottom={20} right={20} zIndex={9999}>
          <IconButton
            color="primary"
            size="small"
            onClick={handleMenuClick}
            aria-controls={openMenu ? 'emergency-debug-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={openMenu ? 'true' : undefined}
            sx={{ bgcolor: 'rgba(255,255,255,0.8)', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}
          >
            <MoreVertIcon />
          </IconButton>
          <Menu
            id="emergency-debug-menu"
            anchorEl={anchorEl}
            open={openMenu}
            onClose={handleMenuClose}
            MenuListProps={{
              'aria-labelledby': 'emergency-debug-button',
            }}
          >
            <MenuItem onClick={() => { createTestAlert(); handleMenuClose(); }}>
              Create Test Alert
            </MenuItem>
            <MenuItem onClick={() => { testSSEConnection(); handleMenuClose(); }}>
              Test SSE Connection
            </MenuItem>
          </Menu>
        </Box>
      )}

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
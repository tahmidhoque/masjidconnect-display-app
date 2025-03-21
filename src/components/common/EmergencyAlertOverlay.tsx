import React, { useEffect } from 'react';
import { Box, Typography, Paper, IconButton, alpha } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WarningIcon from '@mui/icons-material/Warning';
import { useEmergencyAlert } from '../../contexts/EmergencyAlertContext';
import { useTheme } from '@mui/material/styles';

/**
 * EmergencyAlertOverlay Component
 * 
 * Displays an emergency alert as an overlay. The component should be placed high in
 * the component tree to ensure it can overlay all other content but still respect
 * headers and footers.
 */
const EmergencyAlertOverlay: React.FC = () => {
  const theme = useTheme();
  const { currentAlert, clearAlert } = useEmergencyAlert();

  // Add debug logging
  console.log('🚨 EmergencyAlertOverlay rendering, hasAlert:', !!currentAlert);
  
  useEffect(() => {
    console.log('🚨 EmergencyAlertOverlay: Alert state changed:', currentAlert);
  }, [currentAlert]);

  if (!currentAlert) return null;

  // Log when we're about to render an alert
  console.log('🚨 EmergencyAlertOverlay: Rendering alert:', {
    id: currentAlert.id,
    title: currentAlert.title,
    color: currentAlert.color,
    expiresAt: currentAlert.expiresAt
  });

  // Function to determine text color based on background color brightness
  const getTextColor = (bgColor: string) => {
    // Default to white if no color provided
    if (!bgColor) return theme.palette.common.white;
    
    // For hex colors
    let r, g, b;
    if (bgColor.startsWith('#')) {
      // Convert hex to rgb
      const hex = bgColor.substring(1);
      const rgb = parseInt(hex, 16);
      r = (rgb >> 16) & 0xff;
      g = (rgb >> 8) & 0xff;
      b = (rgb >> 0) & 0xff;
    } else if (bgColor.startsWith('rgb')) {
      // Parse rgb/rgba format
      const matches = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (matches) {
        r = parseInt(matches[1]);
        g = parseInt(matches[2]);
        b = parseInt(matches[3]);
      } else {
        // Default values if parsing fails
        r = 0;
        g = 0;
        b = 0;
      }
    } else {
      // Unknown format, default to dark color
      return theme.palette.common.white;
    }
    
    // Calculate luminance - standard formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return white for dark backgrounds, black for light backgrounds
    return luminance > 0.5 ? 'rgba(0, 0, 0, 0.87)' : theme.palette.common.white;
  };
  
  // Get background and text colors
  const backgroundColor = currentAlert.color || theme.palette.error.main;
  const textColor = getTextColor(backgroundColor);
  
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 4,
        zIndex: 1200, // Above most content but below modal dialogs
        backgroundColor: alpha(theme.palette.common.black, 0.5),
      }}
    >
      <Paper
        elevation={24}
        sx={{
          backgroundColor: backgroundColor,
          color: textColor,
          width: '85%',
          maxWidth: '900px',
          maxHeight: '80vh',
          borderRadius: 4,
          padding: 5,
          position: 'relative',
          overflow: 'auto',
          animation: 'fadeInAlert 0.5s ease-out',
          '@keyframes fadeInAlert': {
            '0%': {
              opacity: 0,
              transform: 'translateY(-20px)'
            },
            '100%': {
              opacity: 1,
              transform: 'translateY(0)'
            }
          }
        }}
      >
        <IconButton
          onClick={clearAlert}
          aria-label="close alert"
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: textColor,
            backgroundColor: alpha(textColor, 0.1),
            '&:hover': {
              backgroundColor: alpha(textColor, 0.2),
            }
          }}
        >
          <CloseIcon />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
          <WarningIcon sx={{ fontSize: 50, mr: 2 }} />
          <Typography
            variant="h3"
            component="h2"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '1.75rem', sm: '2.25rem' },
              lineHeight: 1.2,
              mb: 1
            }}
          >
            {currentAlert.title}
          </Typography>
        </Box>

        <Typography
          variant="body1"
          sx={{
            fontSize: { xs: '1.2rem', sm: '1.5rem' },
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            maxHeight: '50vh',
            overflow: 'auto',
          }}
        >
          {currentAlert.message}
        </Typography>
      </Paper>
    </Box>
  );
};

export default EmergencyAlertOverlay; 
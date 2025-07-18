import React from 'react';
import { Typography, Box, useTheme } from '@mui/material';

interface PairingInstructionsProps {
  adminBaseUrl: string;
}

/**
 * Static instructions for pairing a display
 */
const PairingInstructions: React.FC<PairingInstructionsProps> = ({ adminBaseUrl }) => {
  const theme = useTheme();
  
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h4" gutterBottom color="white" sx={{ fontWeight: 'bold' }}>
        Pair Your Display
      </Typography>
      
      <Typography variant="body1" paragraph color="white">
        Follow these steps to connect this display to your MasjidConnect account:
      </Typography>
      
      <Box sx={{ mt: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" color="white" gutterBottom sx={{ fontWeight: 'bold' }}>
            1. Go to MasjidConnect Dashboard
          </Typography>
          <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
            Visit {adminBaseUrl}
          </Typography>
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" color="white" gutterBottom sx={{ fontWeight: 'bold' }}>
            2. Enter the Pairing Code or Scan QR
          </Typography>
          <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
            Use the code shown or scan the QR code
          </Typography>
        </Box>
        
        <Box sx={{ mb: 1 }}>
          <Typography variant="h6" color="white" gutterBottom sx={{ fontWeight: 'bold' }}>
            3. Configure Display Settings
          </Typography>
          <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
            Set the display name, orientation and other options
          </Typography>
        </Box>
      </Box>
      
      <Box sx={{ mt: 4 }}>
        <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
          Need help? Visit <a href="https://masjidconnect.co.uk/support" target="_blank" rel="noopener" style={{ color: theme.palette.warning.main }}>masjidconnect.co.uk/support</a>
        </Typography>
      </Box>
    </Box>
  );
};

export default PairingInstructions; 
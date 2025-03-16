import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, CircularProgress, Container, Grid } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { useOrientation } from '../../contexts/OrientationContext';

/**
 * The Pairing Screen component
 * 
 * This screen is shown when the display is not yet paired with a masjid.
 * It shows a pairing code that administrators need to enter in the MasjidConnect
 * management portal to pair this display.
 * 
 * Note: This is a non-interactive display, so the pairing is done on another device.
 */
const PairingScreen: React.FC = () => {
  const { pairScreen, isPairing, pairingError } = useAuth();
  const { orientation } = useOrientation();
  const [pairingCode, setPairingCode] = useState<string>('');
  
  // Generate a random 6-digit pairing code
  useEffect(() => {
    const generatePairingCode = () => {
      // Generate a random 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setPairingCode(code);
      
      // After generating the code, initiate pairing with the backend
      pairScreen(code);
    };
    
    generatePairingCode();
    
    // Refresh the code every 5 minutes if not paired
    const interval = setInterval(() => {
      generatePairingCode();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Full-screen container
  return (
    <Box
      sx={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F4F4F4',
        overflow: 'hidden',
      }}
    >
      <Container maxWidth="md">
        <Paper
          elevation={3}
          sx={{
            p: 6,
            borderRadius: 4,
            textAlign: 'center',
            backgroundColor: '#fff',
          }}
        >
          <Grid container spacing={4} direction={orientation === 'PORTRAIT' ? 'column' : 'row'}>
            <Grid item xs={12} md={6}>
              <Typography variant="h2" color="primary" gutterBottom>
                MasjidConnect
              </Typography>
              
              <Typography variant="h5" gutterBottom>
                Display Pairing
              </Typography>
              
              <Typography variant="body1" paragraph sx={{ mb: 4 }}>
                This screen needs to be paired with your masjid account.
                Please enter the pairing code shown below in the MasjidConnect management portal.
              </Typography>
              
              {pairingError && (
                <Typography color="error" sx={{ mb: 2 }}>
                  Error: {pairingError}
                </Typography>
              )}
            </Grid>
            
            <Grid item xs={12} md={6} 
              sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                alignItems: 'center' 
              }}
            >
              <Paper
                elevation={2}
                sx={{
                  p: 4,
                  borderRadius: 2,
                  backgroundColor: '#0A2647',
                  width: '100%',
                  maxWidth: 300,
                  mx: 'auto',
                }}
              >
                <Typography variant="h3" sx={{ color: '#fff', letterSpacing: 8, fontWeight: 'bold' }}>
                  {isPairing ? (
                    <CircularProgress size={60} sx={{ color: '#fff' }} />
                  ) : (
                    pairingCode
                  )}
                </Typography>
              </Paper>
              
              <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
                This code will refresh in 5 minutes if not paired
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      </Container>
      
      <Box sx={{ position: 'fixed', bottom: 16, width: '100%', textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          MasjidConnect Display v1.0.0 • {orientation} Mode
        </Typography>
      </Box>
    </Box>
  );
};

export default PairingScreen; 
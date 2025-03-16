import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  CircularProgress, 
  Container, 
  Grid, 
  Divider,
  useTheme,
  Card,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Fade
} from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrientation } from '../../contexts/OrientationContext';
import logoNoTextGold from '../../assets/logos/logo-notext-gold.svg';
import logoGold from '../../assets/logos/logo-gold.svg';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DevicesIcon from '@mui/icons-material/Devices';
import QrCodeIcon from '@mui/icons-material/QrCode';
import SettingsIcon from '@mui/icons-material/Settings';

/**
 * The Pairing Screen component
 * 
 * This screen is shown when the display is not yet paired with a masjid.
 * It shows pairing instructions and a QR code that administrators need to scan
 * to pair this display with their masjid account.
 * 
 * Note: This is a non-interactive display, so the pairing is done through another device.
 */
const PairingScreen: React.FC = () => {
  const { pairScreen, isPairing, pairingError } = useAuth();
  const { orientation } = useOrientation();
  const theme = useTheme();
  const [pairingCode, setPairingCode] = useState<string>('');
  const [pairingStep, setPairingStep] = useState<number>(1);
  const [fadeIn, setFadeIn] = useState<boolean>(false);
  
  // Generate a random 6-digit pairing code
  useEffect(() => {
    const generatePairingCode = () => {
      // Generate a random 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setPairingCode(code);
      
      // After generating the code, initiate pairing with the backend
      // This will start listening for pairing requests with this code
      pairScreen(code);
    };
    
    generatePairingCode();
    
    // Refresh the code every 5 minutes if not paired
    const interval = setInterval(() => {
      generatePairingCode();
    }, 5 * 60 * 1000);

    // Animate elements
    setTimeout(() => {
      setFadeIn(true);
    }, 300);
    
    return () => clearInterval(interval);
  }, [pairScreen]);

  // Simulate pairing steps to provide visual feedback
  useEffect(() => {
    if (isPairing) {
      // Move through the pairing steps for visual feedback
      const stepInterval = setInterval(() => {
        setPairingStep(current => {
          if (current < 3) return current + 1;
          clearInterval(stepInterval);
          return current;
        });
      }, 3000);
      
      return () => clearInterval(stepInterval);
    } else {
      setPairingStep(1);
    }
  }, [isPairing]);

  // Generate the QR code URL
  const qrCodeUrl = `https://dashboard.masjidconnect.com/pair/${pairingCode}`;

  // Custom QR code with logo in the center
  const QRCodeWithLogo = () => (
    <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', marginY: 2 }}>
      <Box sx={{ 
        backgroundColor: 'white', 
        padding: 2, 
        borderRadius: 2,
        width: 200,
        height: 200,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <QRCodeSVG
          value={qrCodeUrl}
          size={200}
          bgColor={"#ffffff"}
          fgColor={"#0A2647"}
          level={"H"}
          includeMargin={false}
          imageSettings={{
            src: logoNoTextGold,
            x: undefined,
            y: undefined,
            height: 40,
            width: 40,
            excavate: true,
          }}
        />
      </Box>
    </Box>
  );

  // Pairing steps display
  const PairingSteps = () => (
    <Card elevation={4} sx={{ 
      backgroundColor: 'rgba(255, 255, 255, 0.1)', 
      py: 2, 
      px: 3, 
      borderRadius: 2, 
      backdropFilter: 'blur(5px)',
      maxWidth: 500,
    }}>
      <Typography variant="h6" color="white" gutterBottom>
        How to Pair Your Display
      </Typography>
      <List>
        <ListItem sx={{ opacity: 1, color: 'white' }}>
          <ListItemIcon sx={{ color: pairingStep >= 1 ? theme.palette.warning.main : 'white' }}>
            {pairingStep > 1 ? <CheckCircleOutlineIcon /> : <DevicesIcon />}
          </ListItemIcon>
          <ListItemText 
            primary="Go to MasjidConnect Dashboard" 
            secondary={
              <Typography component="span" variant="body2" color="rgba(255, 255, 255, 0.7)">
                Visit dashboard.masjidconnect.com
              </Typography>
            }
          />
        </ListItem>
        
        <ListItem sx={{ opacity: pairingStep >= 2 ? 1 : 0.6, color: 'white' }}>
          <ListItemIcon sx={{ color: pairingStep >= 2 ? theme.palette.warning.main : 'white' }}>
            {pairingStep > 2 ? <CheckCircleOutlineIcon /> : <QrCodeIcon />}
          </ListItemIcon>
          <ListItemText 
            primary="Enter the Pairing Code or Scan QR" 
            secondary={
              <Typography component="span" variant="body2" color="rgba(255, 255, 255, 0.7)">
                Use the code shown below or scan the QR code
              </Typography>
            }
          />
        </ListItem>
        
        <ListItem sx={{ opacity: pairingStep >= 3 ? 1 : 0.6, color: 'white' }}>
          <ListItemIcon sx={{ color: pairingStep >= 3 ? theme.palette.warning.main : 'white' }}>
            {pairingStep > 3 ? <CheckCircleOutlineIcon /> : <SettingsIcon />}
          </ListItemIcon>
          <ListItemText 
            primary="Configure Display Settings" 
            secondary={
              <Typography component="span" variant="body2" color="rgba(255, 255, 255, 0.7)">
                Set the display name, orientation and other options
              </Typography>
            }
          />
        </ListItem>
      </List>
    </Card>
  );

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
        backgroundColor: theme.palette.primary.main, // Midnight Blue background
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Logo at the top */}
      <Fade in={fadeIn} timeout={1000}>
        <Box 
          sx={{ 
            position: 'absolute',
            top: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '180px'
          }}
        >
          <img 
            src={logoGold} 
            alt="MasjidConnect Logo" 
            style={{ width: '100%', height: 'auto' }} 
          />
        </Box>
      </Fade>

      <Container maxWidth="lg">
        <Grid 
          container 
          spacing={4} 
          direction={orientation === 'PORTRAIT' ? 'column' : 'row'}
          justifyContent="center"
          alignItems="center"
          sx={{ pt: orientation === 'PORTRAIT' ? 10 : 0 }}
        >
          <Grid item xs={12} md={6}>
            <Fade in={fadeIn} timeout={1200}>
              <Box>
                <Typography 
                  variant="h4" 
                  color="white" 
                  gutterBottom 
                  sx={{ 
                    fontWeight: 'bold',
                    textAlign: orientation === 'PORTRAIT' ? 'center' : 'left',
                    mb: 3,
                  }}
                >
                  Connect Your Display
                </Typography>
                
                <PairingSteps />
                
                {pairingError && (
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 2, 
                      mt: 3, 
                      backgroundColor: 'rgba(231, 111, 81, 0.2)', 
                      borderRadius: 2,
                      borderLeft: '4px solid #E76F51',
                    }}
                  >
                    <Typography color="#E76F51" variant="body2">
                      Error: {pairingError}. The code will refresh in 5 minutes.
                    </Typography>
                  </Paper>
                )}
              </Box>
            </Fade>
          </Grid>
          
          <Grid item xs={12} md={6} 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              alignItems: 'center',
            }}
          >
            <Fade in={fadeIn} timeout={1400}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography 
                  variant="h6" 
                  color="white" 
                  gutterBottom
                  sx={{ opacity: 0.9 }}
                >
                  Scan this QR code or enter the pairing code
                </Typography>
                
                <QRCodeWithLogo />
                
                <Box sx={{ mt: 3 }}>
                  <Paper
                    elevation={4}
                    sx={{
                      p: 3,
                      borderRadius: 2,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(5px)',
                      width: '100%',
                      maxWidth: 300,
                      mx: 'auto',
                    }}
                  >
                    {isPairing && pairingStep > 1 ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60px' }}>
                        <CircularProgress size={40} sx={{ color: theme.palette.warning.main }} />
                        <Typography 
                          variant="body1" 
                          sx={{ color: 'white', ml: 2, fontWeight: 'light' }}
                        >
                          Pairing...
                        </Typography>
                      </Box>
                    ) : (
                      <Typography 
                        variant="h3" 
                        sx={{ 
                          color: theme.palette.warning.main, 
                          letterSpacing: 8, 
                          fontWeight: 'bold',
                          textAlign: 'center',
                        }}
                      >
                        {pairingCode}
                      </Typography>
                    )}
                  </Paper>
                  
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      mt: 2, 
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontStyle: 'italic',
                    }}
                  >
                    This code will refresh in 5 minutes if not paired
                  </Typography>
                </Box>
              </Box>
            </Fade>
          </Grid>
        </Grid>
      </Container>
      
      <Box sx={{ position: 'fixed', bottom: 16, width: '100%', textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
          MasjidConnect Display v1.0.0 • {orientation} Mode
        </Typography>
      </Box>
    </Box>
  );
};

export default PairingScreen; 
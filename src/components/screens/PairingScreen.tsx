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
  Fade,
  Alert,
  Link
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
  const [pairingAttempts, setPairingAttempts] = useState<number>(0);
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Generate a random 6-digit pairing code and initiate pairing
  useEffect(() => {
    let isMounted = true;
    let initialPairingDone = false;
    
    const generatePairingCode = async () => {
      if (!isMounted) return;
      
      // Generate a random 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setPairingCode(code);
      setPairingAttempts(prev => prev + 1);
      
      console.log(`Generated pairing code: ${code} (Attempt #${pairingAttempts + 1})`);
      
      // Only initiate pairing if we're not already in the process of pairing
      if (!isPairing) {
        console.log(`Initiating pairing with code: ${code}`);
        
        try {
          const result = await pairScreen(code);
          console.log('Pairing result:', result);
          
          // If pairing was successful, we don't need to refresh the code
          if (result && isMounted) {
            console.log('Pairing successful! Transitioning to DisplayScreen.');
            return;
          }
        } catch (error) {
          console.error('Error in pairing process:', error);
        }
      } else {
        console.log('Already in pairing process, not initiating a new request');
      }
    };
    
    // Generate initial pairing code only once
    if (!initialPairingDone) {
      generatePairingCode();
      initialPairingDone = true;
    }
    
    // Set up polling to check pairing status every 60 seconds (reduced frequency)
    const pollingInterval = setInterval(() => {
      if (!isPairing && isMounted) {
        console.log('Checking pairing status...');
        generatePairingCode();
      }
    }, 60 * 1000); // 60 seconds
    
    // Refresh the code every 5 minutes if not paired
    const refreshInterval = setInterval(() => {
      if (isMounted && !isPairing) {
        console.log('Refreshing pairing code after 5 minutes');
        generatePairingCode();
      }
    }, 5 * 60 * 1000);

    // Animate elements
    setTimeout(() => {
      if (isMounted) {
        setFadeIn(true);
      }
    }, 300);
    
    return () => {
      isMounted = false;
      clearInterval(pollingInterval);
      clearInterval(refreshInterval);
    };
  }, [isPairing, pairScreen, pairingAttempts]);

  // Simulate pairing steps to provide visual feedback
  useEffect(() => {
    const timer = setTimeout(() => {
      if (pairingStep < 3) {
        setPairingStep(prev => prev + 1);
      }
    }, 8000);
    
    return () => clearTimeout(timer);
  }, [pairingStep]);

  // Generate the QR code URL
  const qrCodeUrl = isDevelopment 
    ? `http://localhost:3000/pair/${pairingCode}`
    : `https://dashboard.masjidconnect.com/pair/${pairingCode}`;

  useEffect(() => {
    // Log the QR code URL for debugging
    console.log('QR Code URL:', qrCodeUrl);
  }, [qrCodeUrl]);

  // Pairing steps display
  const PairingSteps = ({ currentStep }: { currentStep: number }) => (
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
        <ListItem sx={{ opacity: currentStep >= 1 ? 1 : 0.6, color: 'white' }}>
          <ListItemIcon sx={{ color: currentStep > 1 ? theme.palette.warning.main : 'white' }}>
            {currentStep > 1 ? <CheckCircleOutlineIcon /> : <DevicesIcon />}
          </ListItemIcon>
          <ListItemText 
            primary="Go to MasjidConnect Dashboard" 
            secondary={
              <Typography component="span" variant="body2" color="rgba(255, 255, 255, 0.7)">
                {isDevelopment 
                  ? 'Visit http://localhost:3000'
                  : 'Visit dashboard.masjidconnect.com'
                }
              </Typography>
            }
          />
        </ListItem>
        
        <ListItem sx={{ opacity: currentStep >= 2 ? 1 : 0.6, color: 'white' }}>
          <ListItemIcon sx={{ color: currentStep > 2 ? theme.palette.warning.main : 'white' }}>
            {currentStep > 2 ? <CheckCircleOutlineIcon /> : <QrCodeIcon />}
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
        
        <ListItem sx={{ opacity: currentStep >= 3 ? 1 : 0.6, color: 'white' }}>
          <ListItemIcon sx={{ color: currentStep > 3 ? theme.palette.warning.main : 'white' }}>
            {currentStep > 3 ? <CheckCircleOutlineIcon /> : <SettingsIcon />}
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

  // Get orientation style
  const getOrientationStyle = () => {
    return {
      transform: orientation === 'LANDSCAPE' ? 'none' : 'rotate(90deg)',
      transformOrigin: 'center center',
      height: orientation === 'LANDSCAPE' ? '100vh' : '100vw',
      width: orientation === 'LANDSCAPE' ? '100vw' : '100vh',
    };
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        ...getOrientationStyle(),
        backgroundColor: theme.palette.background.default,
      }}
    >
      <Fade in={fadeIn} timeout={1000}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            height: '100%',
            padding: 4,
          }}
        >
          {/* Left side - Instructions */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-start',
              pr: 4,
            }}
          >
            <Typography variant="h3" gutterBottom>
              Pair Your Display
            </Typography>
            
            <Typography variant="body1" paragraph>
              Follow these steps to connect this display to your MasjidConnect account:
            </Typography>
            
            <PairingSteps currentStep={pairingStep} />
            
            {isDevelopment && (
              <Alert severity="info" sx={{ mt: 2, width: '100%' }}>
                <Typography variant="body2">
                  Development mode: Connecting to <strong>http://localhost:3000</strong>
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Make sure the admin dashboard is running on this URL
                </Typography>
              </Alert>
            )}
            
            {isPairing && (
              <Alert severity="info" sx={{ mt: 2, width: '100%' }}>
                Waiting for pairing... This display will automatically connect once paired.
              </Alert>
            )}
            
            {pairingError && (
              <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
                {pairingError}
                {isDevelopment && (
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Development mode: Using mock API responses. Check console for details.
                  </Typography>
                )}
              </Alert>
            )}
            
            {pairingAttempts > 1 && (
              <Alert severity="warning" sx={{ mt: 2, width: '100%' }}>
                Pairing code refreshed. Attempt #{pairingAttempts}
              </Alert>
            )}
            
            <Box sx={{ mt: 4 }}>
              <Typography variant="body2" color="text.secondary">
                Need help? Visit <Link href="https://masjidconnect.com/support" target="_blank" rel="noopener">masjidconnect.com/support</Link>
              </Typography>
            </Box>
          </Box>
          
          {/* Right side - QR Code */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: theme.palette.background.paper,
              borderRadius: 4,
              p: 4,
              boxShadow: 3,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                mb: 3,
              }}
            >
              <Typography variant="h4" gutterBottom align="center">
                Pairing Code
              </Typography>
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 'bold',
                  letterSpacing: 4,
                  color: theme.palette.primary.main,
                }}
              >
                {pairingCode}
              </Typography>
            </Box>
            
            <Box
              sx={{
                position: 'relative',
                width: 280,
                height: 280,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <QRCodeSVG
                value={qrCodeUrl}
                size={250}
                bgColor={"#ffffff"}
                fgColor={"#0A2647"}
                level={"H"}
                includeMargin={false}
                imageSettings={{
                  src: logoNoTextGold,
                  x: undefined,
                  y: undefined,
                  height: 50,
                  width: 50,
                  excavate: true,
                }}
              />
            </Box>
            
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 3 }}>
              Scan this QR code with the MasjidConnect app or visit{' '}
              <Link 
                href={isDevelopment ? 'http://localhost:3000/pair' : 'https://masjidconnect.com/pair'} 
                target="_blank" 
                rel="noopener"
              >
                {isDevelopment ? 'localhost:3000/pair' : 'masjidconnect.com/pair'}
              </Link>
            </Typography>
          </Box>
        </Box>
      </Fade>
    </Box>
  );
};

export default PairingScreen; 
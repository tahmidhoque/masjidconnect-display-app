import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  useTheme,
  Card,
  Fade,
  Alert,
  Link,
  Stepper,
  Step,
  StepLabel,
  Button
} from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrientation } from '../../contexts/OrientationContext';
import logoNoTextGold from '../../assets/logos/logo-notext-gold.svg';
import RefreshIcon from '@mui/icons-material/Refresh';

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
  const { 
    requestPairingCode, 
    checkPairingStatus, 
    isPairing, 
    pairingError, 
    pairingCode, 
    pairingCodeExpiresAt,
    isPairingCodeExpired
  } = useAuth();
  const { orientation } = useOrientation();
  const theme = useTheme();
  const [pairingStep, setPairingStep] = useState<number>(1);
  const [fadeIn, setFadeIn] = useState<boolean>(false);
  const [pairingAttempts, setPairingAttempts] = useState<number>(0);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  
  // Check if we're in development mode
  // First try the NODE_ENV environment variable
  let isDevelopment = process.env.NODE_ENV === 'development';
  // If NODE_ENV is not set, check if we're using localhost
  if (!isDevelopment && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    isDevelopment = false;
    console.log('Detected localhost, but not setting development mode');
  }
  
  console.log('PairingScreen - Current NODE_ENV:', process.env.NODE_ENV);
  console.log('PairingScreen - isDevelopment:', isDevelopment);
  console.log('PairingScreen - window.location.hostname:', window.location.hostname);
  
  // Start polling for pairing status
  const startPolling = useCallback((code: string) => {
    if (isPolling) return;
    
    setIsPolling(true);
    console.log('Starting to poll for pairing status...');
    
    // Initial check
    checkPairingStatus(code)
      .then(isPaired => {
        if (isPaired) {
          console.log('Device paired successfully!');
          setIsPolling(false);
        } else {
          console.log('Device not yet paired, continuing to poll...');
          
          // Set up polling at the interval recommended by the API
          // This is handled by the AuthContext, so we don't need to set up a timer here
        }
      })
      .catch(error => {
        console.error('Error checking pairing status:', error);
        setIsPolling(false);
      });
  }, [isPolling, checkPairingStatus]);
  
  // Step 1: Request a pairing code when the component mounts
  useEffect(() => {
    let isMounted = true;
    
    const initiatePairing = async () => {
      if (!isMounted) return;
      
      // Only request a pairing code if we don't already have one and it's not expired
      // and we're not already in the process of pairing or polling
      if (!pairingCode && !isPairing && !isPolling && !isPairingCodeExpired) {
        console.log('Initiating pairing process...');
        setPairingAttempts(prev => prev + 1);
        
        try {
          const code = await requestPairingCode();
          console.log('Pairing code received:', code);
          
          if (code && isMounted) {
            // Start polling for pairing status
            startPolling(code);
          }
        } catch (error) {
          console.error('Error in pairing process:', error);
        }
      }
    };
    
    // Only initiate pairing if we don't have a valid pairing code
    if (!pairingCode || isPairingCodeExpired) {
      initiatePairing();
    } else if (pairingCode && !isPolling && !isPairing) {
      // If we already have a valid code but aren't polling, restart polling
      console.log('Restarting polling with existing code:', pairingCode);
      startPolling(pairingCode);
    }
    
    // Animate elements
    setTimeout(() => {
      if (isMounted) {
        setFadeIn(true);
      }
    }, 300);
    
    return () => {
      isMounted = false;
    };
  }, [pairingCode, isPairing, isPolling, isPairingCodeExpired, requestPairingCode, startPolling]);
  
  // Handle refresh button click
  const handleRefresh = async () => {
    console.log('Refreshing pairing code...');
    setPairingAttempts(prev => prev + 1);
    
    try {
      const code = await requestPairingCode();
      console.log('New pairing code received:', code);
      
      if (code) {
        // Start polling for pairing status
        startPolling(code);
      }
    } catch (error) {
      console.error('Error refreshing pairing code:', error);
    }
  };

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
    if (pairingCode) {
      console.log('QR Code URL:', qrCodeUrl);
    }
  }, [qrCodeUrl, pairingCode]);

  // Format expiration time
  const formatExpirationTime = () => {
    if (!pairingCodeExpiresAt) return null;
    
    const expiresAt = new Date(pairingCodeExpiresAt);
    return expiresAt.toLocaleTimeString();
  };

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
      
      <Stepper activeStep={currentStep - 1} orientation="vertical" sx={{ mt: 2 }}>
        <Step completed={currentStep > 1}>
          <StepLabel 
            StepIconProps={{ 
              sx: { color: currentStep > 1 ? theme.palette.warning.main : 'white' } 
            }}
          >
            <Typography color="white">Go to MasjidConnect Dashboard</Typography>
            <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
              {isDevelopment 
                ? 'Visit http://localhost:3000'
                : 'Visit dashboard.masjidconnect.com'
              }
            </Typography>
          </StepLabel>
        </Step>
        
        <Step completed={currentStep > 2}>
          <StepLabel 
            StepIconProps={{ 
              sx: { color: currentStep > 2 ? theme.palette.warning.main : 'white' } 
            }}
          >
            <Typography color="white">Enter the Pairing Code or Scan QR</Typography>
            <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
              Use the code shown below or scan the QR code
            </Typography>
          </StepLabel>
        </Step>
        
        <Step completed={currentStep > 3}>
          <StepLabel 
            StepIconProps={{ 
              sx: { color: currentStep > 3 ? theme.palette.warning.main : 'white' } 
            }}
          >
            <Typography color="white">Configure Display Settings</Typography>
            <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
              Set the display name, orientation and other options
            </Typography>
          </StepLabel>
        </Step>
      </Stepper>
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

  // Get pairing status message
  const getPairingStatusMessage = () => {
    if (isPairing) {
      return (
        <Alert severity="info" sx={{ mt: 2, width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CircularProgress size={20} sx={{ mr: 2 }} />
            <Typography>
              {!pairingCode ? 'Requesting pairing code...' : 'Checking pairing status...'}
            </Typography>
          </Box>
        </Alert>
      );
    }
    
    if (isPolling) {
      return (
        <Alert severity="info" sx={{ mt: 2, width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CircularProgress size={20} sx={{ mr: 2 }} />
            <Typography>Waiting for pairing... This display will automatically connect once paired.</Typography>
          </Box>
        </Alert>
      );
    }
    
    if (isPairingCodeExpired) {
      return (
        <Alert severity="warning" sx={{ mt: 2, width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography>Pairing code has expired. Please request a new code.</Typography>
            <Button 
              variant="outlined" 
              size="small" 
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={isPairing}
              sx={{ ml: 2 }}
            >
              Refresh
            </Button>
          </Box>
        </Alert>
      );
    }
    
    return null;
  };

  // Blue background style to match loading screen
  const backgroundStyle = {
    background: 'linear-gradient(135deg, #0A2647 0%, #144272 100%)',
    color: 'white',
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
        ...backgroundStyle,
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
              color: 'white',
            }}
          >
            <Typography variant="h3" gutterBottom color="white">
              Pair Your Display
            </Typography>
            
            <Typography variant="body1" paragraph color="white">
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
            
            {getPairingStatusMessage()}
            
            {pairingError && (
              <Alert severity="error" sx={{ mt: 2, width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography>{pairingError}</Typography>
                  {pairingError.includes('expired') && (
                    <Button 
                      variant="outlined" 
                      size="small" 
                      startIcon={<RefreshIcon />}
                      onClick={handleRefresh}
                      disabled={isPairing}
                      sx={{ ml: 2 }}
                    >
                      Refresh
                    </Button>
                  )}
                </Box>
                {isDevelopment && (
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Development mode: Using mock API responses. Check console for details.
                  </Typography>
                )}
              </Alert>
            )}
            
            {pairingAttempts > 1 && !isPairing && !isPolling && (
              <Alert severity="warning" sx={{ mt: 2, width: '100%' }}>
                Pairing code refreshed. Attempt #{pairingAttempts}
              </Alert>
            )}
            
            <Box sx={{ mt: 4 }}>
              <Typography variant="body2" color="rgba(255, 255, 255, 0.7)">
                Need help? Visit <Link href="https://masjidconnect.com/support" target="_blank" rel="noopener" sx={{ color: theme.palette.warning.main }}>masjidconnect.com/support</Link>
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
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 4,
              p: 4,
              boxShadow: 3,
              backdropFilter: 'blur(10px)',
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
              <Typography variant="h4" gutterBottom align="center" color="white">
                Pairing Code
              </Typography>
              {pairingCode ? (
                <>
                  <Typography
                    variant="h2"
                    sx={{
                      fontWeight: 'bold',
                      letterSpacing: 4,
                      color: theme.palette.warning.main,
                    }}
                  >
                    {pairingCode}
                  </Typography>
                  {pairingCodeExpiresAt && (
                    <Typography variant="body2" color="rgba(255, 255, 255, 0.7)" sx={{ mt: 1 }}>
                      Expires at {formatExpirationTime()}
                      {isPairingCodeExpired && (
                        <Button 
                          variant="text" 
                          size="small" 
                          startIcon={<RefreshIcon />}
                          onClick={handleRefresh}
                          disabled={isPairing}
                          sx={{ ml: 2, color: theme.palette.warning.main }}
                        >
                          Refresh
                        </Button>
                      )}
                    </Typography>
                  )}
                </>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                  <CircularProgress size={40} />
                </Box>
              )}
            </Box>
            
            <Box
              sx={{
                position: 'relative',
                width: 280,
                height: 280,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'white',
                borderRadius: 2,
                p: 2,
              }}
            >
              {(isPairing || !pairingCode) ? (
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 2 }}>
                  <CircularProgress size={60} />
                </Box>
              ) : null}
              {pairingCode ? (
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
              ) : (
                <Typography variant="body1" color="text.secondary" align="center">
                  Generating QR code...
                </Typography>
              )}
            </Box>
            
            <Typography variant="body2" color="rgba(255, 255, 255, 0.7)" align="center" sx={{ mt: 3 }}>
              Scan this QR code with the MasjidConnect app or visit{' '}
              <Link 
                href={isDevelopment ? 'http://localhost:3000/pair' : 'https://masjidconnect.com/pair'} 
                target="_blank" 
                rel="noopener"
                sx={{ color: theme.palette.warning.main }}
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
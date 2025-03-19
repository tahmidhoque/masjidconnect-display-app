import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { useSnackbar } from 'notistack';

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
    isPairingCodeExpired,
    setIsPaired
  } = useAuth();
  const { orientation } = useOrientation();
  const theme = useTheme();
  const [pairingStep, setPairingStep] = useState<number>(1);
  const [fadeIn, setFadeIn] = useState<boolean>(false);
  const [pairingAttempts, setPairingAttempts] = useState<number>(0);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const requestInProgress = useRef<boolean>(false);
  const pollingRef = useRef<boolean>(false);
  const { enqueueSnackbar } = useSnackbar();
  
  // Track if component is mounted
  const isMounted = useRef<boolean>(true);
  // Track the pairing code expiration time
  const expirationTimeRef = useRef<number | null>(null);
  // Track the last time we checked the pairing status
  const lastPairingCheckRef = useRef<number>(0);
  
  // Start polling for pairing status - follows Step 3 in the guide
  const startPolling = useCallback(async (code: string) => {
    if (pollingRef.current || !code) return;
    
    pollingRef.current = true;
    setIsPolling(true);
    console.log('[PairingScreen] Starting to poll for pairing status...');
    
    try {
      // Record the time of this check
      lastPairingCheckRef.current = Date.now();
      
      const isPaired = await checkPairingStatus(code);
      
      if (!isMounted.current) return;
      
      if (isPaired) {
        console.log('[PairingScreen] Device paired successfully!');
        pollingRef.current = false;
        setIsPolling(false);
        
        // Instead of using navigate directly, we'll let the App component handle the navigation
        // based on the authentication state
        console.log('[PairingScreen] Pairing successful, App will redirect based on auth state');
        
        // Force a re-render of the App component by updating the isPaired state in AuthContext
        // The App component will show DisplayScreen when isAuthenticated is true
        setIsPaired(true);
      } else {
        console.log('[PairingScreen] Device not yet paired, continuing to poll...');
        // The polling continues in the AuthContext through interval-based checks
        // We don't need to trigger additional polls from here
      }
    } catch (error) {
      console.error('[PairingScreen] Error checking pairing status:', error);
      pollingRef.current = false;
      setIsPolling(false);
    }
  }, [checkPairingStatus, setIsPaired]);
  
  // Handle refresh button click
  const handleRefresh = useCallback(async () => {
    console.log('Refresh button clicked');
    
    // Increment pairing attempts
    setPairingAttempts(prev => prev + 1);
    
    // Reset polling state
    pollingRef.current = false;
    setIsPolling(false);
    
    // Don't request a new code if already requesting one
    if (isPairing) {
      console.log('Already requesting a pairing code, skipping duplicate request');
      return;
    }
    
    try {
      // Request a new pairing code
      await requestPairingCode(orientation);
    } catch (error) {
      console.error('Error requesting pairing code:', error);
      enqueueSnackbar('Failed to request pairing code. Please try again.', { 
        variant: 'error',
        autoHideDuration: 5000
      });
    }
  }, [isPairing, requestPairingCode, orientation, enqueueSnackbar]);
  
  // Separate useEffect to handle code expiration and restart pairing if needed
  useEffect(() => {
    if (isPairingCodeExpired && !isPairing && !pollingRef.current && !requestInProgress.current) {
      console.log('[PairingScreen] Detected expired code, requesting a new one');
      handleRefresh();
    }
  }, [isPairingCodeExpired, isPairing, handleRefresh]);
  
  // Step 1: Request a pairing code when the component mounts - RUNS ONCE
  useEffect(() => {
    console.log('[PairingScreen] Initial mount useEffect');
    let isMounted = true;
    
    // Debug: Log localStorage contents
    console.log('[DEBUG] localStorage contents:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        console.log(`${key}: ${localStorage.getItem(key)}`);
      }
    }
    
    // Clear any stored pairing code to force a new request
    console.log('[PairingScreen] Clearing stored pairing code from localStorage');
    localStorage.removeItem('pairingCode');
    localStorage.removeItem('pairingCodeExpiresAt');
    localStorage.removeItem('lastPairingCodeRequestTime');
    
    const initiatePairing = async () => {
      if (!isMounted) return;
      
      // Prevent multiple simultaneous requests
      if (requestInProgress.current) {
        console.log('[PairingScreen] Request already in progress, skipping');
        return;
      }
      
      // Only request a new pairing code if we need one
      if ((!pairingCode || isPairingCodeExpired) && !isPairing && !pollingRef.current) {
        console.log('[PairingScreen] Will initiate pairing process after delay...');
        
        // Add a delay before requesting a pairing code to prevent rapid requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!isMounted) return;
        
        console.log('[PairingScreen] Initiating pairing process...');
        setPairingAttempts(prev => prev + 1);
        
        try {
          requestInProgress.current = true;
          console.log('[PairingScreen] Requesting pairing code with orientation:', orientation);
          const code = await requestPairingCode(orientation);
          requestInProgress.current = false;
          
          if (code && isMounted) {
            console.log('[PairingScreen] Pairing code received:', code);
            
            // Don't start polling immediately - the other useEffect will handle this
            // with a delay to prevent rapid requests
          } else {
            console.warn('[PairingScreen] Failed to get a valid pairing code');
          }
        } catch (error) {
          console.error('[PairingScreen] Error in pairing process:', error);
          requestInProgress.current = false;
        }
      } else if (pairingCode && !pollingRef.current && !isPairing) {
        // We have a valid code but aren't polling - the other useEffect will handle this
        console.log('[PairingScreen] Have existing code, polling will be handled by other useEffect');
      } else {
        console.log('[PairingScreen] No pairing action needed at this time:', {
          hasPairingCode: !!pairingCode,
          isPairing,
          isPolling: pollingRef.current,
          isPairingCodeExpired
        });
      }
    };
    
    // Start the pairing process with a delay
    console.log('[PairingScreen] Will start pairing process after delay...');
    const startupTimer = setTimeout(() => {
      if (isMounted) {
        console.log('[PairingScreen] Starting pairing process after delay...');
        initiatePairing();
      }
    }, 1000);
    
    // Animate elements
    setTimeout(() => {
      if (isMounted) {
        setFadeIn(true);
      }
    }, 300);
    
    return () => {
      isMounted = false;
      clearTimeout(startupTimer);
      // Clean up polling on unmount
      pollingRef.current = false;
    };
  // Run ONLY on component mount - empty dependency array
  }, []);
  
  // Start polling when we have a valid code but aren't polling
  useEffect(() => {
    // Add a debounce to prevent rapid polling starts
    let pollingTimer: NodeJS.Timeout | null = null;
    
    if (pairingCode && !pollingRef.current && !isPairing && !requestInProgress.current) {
      console.log('[PairingScreen] We have a valid code but not polling, will start polling after delay...');
      
      // Add a delay before starting polling to prevent rapid requests
      pollingTimer = setTimeout(() => {
        if (pairingCode && !pollingRef.current && !isPairing && !requestInProgress.current) {
          console.log('[PairingScreen] Starting polling after delay');
          startPolling(pairingCode);
        }
      }, 2000); // 2 second delay
    }
    
    // Clean up timer on unmount or when dependencies change
    return () => {
      if (pollingTimer) {
        clearTimeout(pollingTimer);
      }
    };
  }, [pairingCode, isPairing, startPolling]);
  
  // Simulate pairing steps to provide visual feedback
  useEffect(() => {
    const timer = setTimeout(() => {
      if (pairingStep < 3) {
        setPairingStep(prev => prev + 1);
      }
    }, 8000);
    
    return () => clearTimeout(timer);
  }, [pairingStep]);

  // Generate the QR code URL for pairing
  const qrCodeUrl = useMemo(() => {
    if (!pairingCode) return '';
    
    // According to the Screen Pairing Guide, the admin enters the code in the management interface
    // The URL should point to the admin dashboard's pairing page
    const currentHostname = window.location.hostname;
    console.log('[PairingScreen] Current hostname:', currentHostname);
    
    // If we're on localhost, use localhost for the admin dashboard too
    if (currentHostname === 'localhost') {
      // The admin dashboard is likely running on port 3000
      // But our display app might be on a different port
      const port = '3000'; // Default port for the admin dashboard
      const url = `http://${currentHostname}:${port}/pair/${pairingCode}`;
      console.log('[PairingScreen] Generated QR code URL for localhost:', url);
      return url;
    }
    
    // For production, use the dashboard subdomain
    // Replace 'display' with 'dashboard' in the hostname if it exists
    const adminHostname = currentHostname.includes('display') 
      ? currentHostname.replace('display', 'dashboard') 
      : `dashboard.${currentHostname.split('.').slice(1).join('.')}`;
    
    // Use the same protocol as the current page
    const protocol = window.location.protocol;
    
    const url = `${protocol}//${adminHostname}/pair/${pairingCode}`;
    console.log('[PairingScreen] Generated QR code URL for production:', url);
    return url;
  }, [pairingCode]);

  // Log QR code URL only when it changes
  useEffect(() => {
    if (pairingCode && qrCodeUrl) {
      console.log('QR Code URL:', qrCodeUrl);
    }
  }, [qrCodeUrl, pairingCode]);

  // Effect to handle pairing errors
  useEffect(() => {
    if (pairingError) {
      // Show error notification
      enqueueSnackbar(pairingError, { 
        variant: 'error',
        autoHideDuration: 5000
      });
      
      // Only request a new code if the error is about an expired code
      // and we're not already in the process of requesting a new one
      if (pairingError.includes('expired') && !isPairing && !requestInProgress.current) {
        console.log('[PairingScreen] Error indicates expired code, requesting new one');
        // Wait a moment before requesting a new code
        setTimeout(() => {
          if (isMounted.current && !requestInProgress.current && !isPairing) {
            handleRefresh();
          }
        }, 3000); // Longer delay to prevent rapid requests
      }
      // Don't automatically request a new code for "invalid" errors
      // as this can cause an infinite loop
    }
  }, [pairingError, enqueueSnackbar, handleRefresh, isPairing]);

  // Memoize the QR code component to prevent unnecessary re-renders
  const QRCodeComponent = useMemo(() => {
    if (!pairingCode) return null;
    
    // Use a stable key to prevent re-renders
    const stableKey = `qr-${pairingCode}`;
    
    return (
      <Box 
        key={stableKey}
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
        {isPairing ? (
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 2 }}>
            <CircularProgress size={60} />
          </Box>
        ) : null}
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
    );
  }, [pairingCode, qrCodeUrl, logoNoTextGold, isPairing]);

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
              Visit dashboard.masjidconnect.com
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

  // Right side QR code section - memoized to prevent re-renders
  const QRCodeSection = useMemo(() => {
    return (
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
        
        {pairingCode ? QRCodeComponent : (
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
            <Typography variant="body1" color="text.secondary" align="center">
              Generating QR code...
            </Typography>
          </Box>
        )}
        
        <Typography variant="body2" color="rgba(255, 255, 255, 0.7)" align="center" sx={{ mt: 3 }}>
          Scan this QR code with the MasjidConnect app or visit{' '}
          <Link 
            href="https://masjidconnect.com/pair"
            target="_blank" 
            rel="noopener"
            sx={{ color: theme.palette.warning.main }}
          >
            masjidconnect.com/pair
          </Link>
        </Typography>
      </Box>
    );
  }, [pairingCode, pairingCodeExpiresAt, isPairingCodeExpired, isPairing, theme, handleRefresh, QRCodeComponent, formatExpirationTime]);

  // Force authentication if credentials already exist in localStorage
  useEffect(() => {
    const alreadyChecked = localStorage.getItem('credentials_check_done');
    if (alreadyChecked === 'true') {
      return; // Skip if we've already done this check in this session
    }
    
    console.log('[PairingScreen] Checking if credentials already exist in localStorage');
    
    // Check for credentials in any format
    const apiKey = localStorage.getItem('masjid_api_key') || 
                  localStorage.getItem('apiKey');
    const screenId = localStorage.getItem('masjid_screen_id') || 
                    localStorage.getItem('screenId');
    
    if (apiKey && screenId) {
      console.log('[PairingScreen] Found existing credentials, forcing authentication');
      
      // Force immediate authentication by calling setIsPaired(true)
      setIsPaired(true);
      
      // Mark that we've done this check to avoid loops
      localStorage.setItem('credentials_check_done', 'true');
    } else {
      console.log('[PairingScreen] No existing credentials found');
      localStorage.setItem('credentials_check_done', 'true');
    }
  }, [setIsPaired]);

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
          {QRCodeSection}
        </Box>
      </Fade>
    </Box>
  );
};

export default PairingScreen; 
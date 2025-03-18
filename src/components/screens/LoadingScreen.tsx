import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, useTheme, Fade } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { useOrientation } from '../../contexts/OrientationContext';
import { useContent } from '../../contexts/ContentContext';
import useAppInitialization from '../../hooks/useAppInitialization';
import useRotationHandling from '../../hooks/useRotationHandling';
import logoGold from '../../assets/logos/logo-gold.svg';

interface LoadingScreenProps {
  onComplete?: () => void;
}

/**
 * LoadingScreen component
 * 
 * Displays a loading screen with the MasjidConnect logo and a loading animation
 * while the app checks pairing status and fetches content.
 * Shows different messages based on authentication status.
 */
const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const theme = useTheme();
  const { isAuthenticated } = useAuth();
  const { isInitializing, initializationStage } = useAppInitialization();
  const { orientation } = useOrientation();
  const { masjidName, screenContent } = useContent();
  const [rotationAngle, setRotationAngle] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'initializing' | 'setting-up' | 'ready' | 'complete'>('initializing');
  
  // Use the same pattern as DisplayScreen for orientation tracking
  const [currentOrientation, setCurrentOrientation] = useState(orientation);
  const prevOrientationRef = useRef(orientation);
  
  // Use our rotation handling hook to determine if we need to rotate
  const { shouldRotate, physicalOrientation } = useRotationHandling(currentOrientation);
  
  // Calculate viewport dimensions for portrait mode
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  
  // Use refs to track loading time and transition state
  const loadingStartTimeRef = useRef<number>(Date.now());
  const transitionTriggeredRef = useRef<boolean>(false);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update current orientation when orientation context changes
  useEffect(() => {
    // If orientation has changed
    if (prevOrientationRef.current !== orientation) {
      console.log("LoadingScreen: Orientation changed from", prevOrientationRef.current, "to", orientation);
      
      // Wait for a brief moment, then update orientation
      const timer = setTimeout(() => {
        setCurrentOrientation(orientation);
        prevOrientationRef.current = orientation;
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [orientation]);
  
  // Animation effect for the custom loader
  useEffect(() => {
    const animationInterval = setInterval(() => {
      setRotationAngle(prevAngle => (prevAngle + 1) % 360);
    }, 20);

    return () => clearInterval(animationInterval);
  }, []);

  // Handle transition to next screen with improved timing
  const triggerTransition = useCallback(() => {
    if (transitionTriggeredRef.current || !onComplete) return;
    
    console.log("LoadingScreen: Triggering transition to next screen");
    transitionTriggeredRef.current = true;
    
    // Calculate how long we've been loading
    const loadingTime = Date.now() - loadingStartTimeRef.current;
    
    // Ensure minimum loading time for a premium feel
    const minLoadingTime = isAuthenticated ? 3000 : 2000; // Longer for authenticated users
    const remainingTime = Math.max(0, minLoadingTime - loadingTime);
    
    console.log(`LoadingScreen: Loading time ${loadingTime}ms, waiting additional ${remainingTime}ms for premium feel`);
    
    // Call onComplete with a delay for a more premium experience
    // Store the timeout reference so we can clear it if needed
    completionTimeoutRef.current = setTimeout(() => {
      if (onComplete) {
        console.log("LoadingScreen: Calling onComplete callback NOW");
        onComplete();
      }
    }, remainingTime);
  }, [isAuthenticated, onComplete]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
      }
    };
  }, []);

  // Watch for initialization completion
  useEffect(() => {
    if (!isInitializing && !transitionTriggeredRef.current) {
      console.log("LoadingScreen: Detected initialization complete");
      setLoadingStage('complete');
      
      // Add a slight delay before triggering transition for a more premium feel
      const timer = setTimeout(() => {
        triggerTransition();
      }, 1200); // Increased delay for a smoother transition
      
      return () => clearTimeout(timer);
    }
  }, [isInitializing, triggerTransition]);

  // Handle loading stage updates based on initialization stage
  useEffect(() => {
    console.log("LoadingScreen: Current initialization stage:", initializationStage);
    
    // Initial fade-in animation
    const fadeTimer = setTimeout(() => {
      setShowContent(true);
    }, 300);

    // Update loading stage based on initialization stage
    if (initializationStage === 'auth') {
      setLoadingStage('initializing');
    } else if (initializationStage === 'orientation' || initializationStage === 'content') {
      setLoadingStage('setting-up');
    } else if (initializationStage === 'complete') {
      setLoadingStage('ready');
      
      // Show "Ready" message briefly before completing
      const readyTimer = setTimeout(() => {
        setLoadingStage('complete');
      }, 1000); // Longer delay for premium feel
      
      return () => clearTimeout(readyTimer);
    }
    
    return () => clearTimeout(fadeTimer);
  }, [initializationStage]);

  // Guaranteed transition after a maximum time
  useEffect(() => {
    const forceTransitionTimer = setTimeout(() => {
      if (!transitionTriggeredRef.current) {
        console.log("LoadingScreen: Force transition timer triggered");
        triggerTransition();
      }
    }, isAuthenticated ? 8000 : 6000); // Longer timeout for a premium feel
    
    return () => clearTimeout(forceTransitionTimer);
  }, [isAuthenticated, triggerTransition]);

  // Get display message based on loading stage and authentication status
  const getDisplayMessage = () => {
    if (isAuthenticated) {
      switch (loadingStage) {
        case 'initializing':
          return 'Loading your dashboard...';
        case 'setting-up':
          return 'Fetching latest content...';
        case 'ready':
          return 'Preparing your display...';
        case 'complete':
          // Show mosque name if available, otherwise fallback to a generic welcome message
          return masjidName 
            ? `Welcome to ${masjidName}` 
            : 'Welcome to MasjidConnect';
        default:
          return 'Loading...';
      }
    } else {
      switch (loadingStage) {
        case 'initializing':
          return 'Initializing...';
        case 'setting-up':
          return 'Setting up display...';
        case 'ready':
          return 'Ready to connect';
        case 'complete':
          return 'Welcome to MasjidConnect';
        default:
          return 'Loading...';
      }
    }
  };

  // Custom Islamic geometric pattern loader - original version
  const CustomLoader = () => {
    const goldColor = theme.palette.warning.main; // Gold color
    const emeraldColor = '#2A9D8F'; // Emerald Green from brand guidelines
    const skyBlueColor = '#66D1FF'; // Sky Blue from brand guidelines

    return (
      <Box sx={{ position: 'relative', width: 80, height: 80, marginBottom: 2 }}>
        {/* Outer rotating ring */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            border: `3px solid ${goldColor}`,
            borderTopColor: 'transparent',
            transform: `rotate(${rotationAngle}deg)`,
          }}
        />
        
        {/* Middle rotating ring */}
        <Box
          sx={{
            position: 'absolute',
            top: '15%',
            left: '15%',
            width: '70%',
            height: '70%',
            borderRadius: '50%',
            border: `3px solid ${emeraldColor}`,
            borderRightColor: 'transparent',
            transform: `rotate(${-rotationAngle * 1.5}deg)`,
          }}
        />
        
        {/* Inner geometric pattern */}
        <Box
          sx={{
            position: 'absolute',
            top: '30%',
            left: '30%',
            width: '40%',
            height: '40%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* Eight-pointed star - central Islamic motif */}
          <svg width="100%" height="100%" viewBox="0 0 40 40">
            <polygon
              points="20,0 25,15 40,20 25,25 20,40 15,25 0,20 15,15"
              fill={skyBlueColor}
              transform={`rotate(${rotationAngle * 0.5})`}
              style={{ transformOrigin: 'center' }}
            />
          </svg>
        </Box>
      </Box>
    );
  };

  // Main content to be displayed in the appropriate orientation container
  const LoadingContent = () => (
    <Box
      sx={{
        backgroundColor: theme.palette.primary.main,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        padding: '5vh 0',
      }}
    >
      {/* Empty top space for balance */}
      <Box sx={{ flexGrow: 1 }} />
      
      {/* Logo container */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexGrow: 2,
        }}
      >
        <Box sx={{ 
          width: 280, 
          height: 240, 
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: theme.palette.warning.main,
        }}>
          <img 
            src={logoGold}
            alt="MasjidConnect Logo"
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              animation: loadingStage === 'complete' ? 'logoGlow 2s infinite' : 'none',
            }} 
          />
        </Box>
      </Box>

      {/* Bottom section */}
      <Box
        sx={{ 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: 'auto',
          flexGrow: 1,
          justifyContent: 'flex-end',
          '@keyframes logoGlow': {
            '0%': { filter: 'brightness(1)' },
            '50%': { filter: 'brightness(1.3)' },
            '100%': { filter: 'brightness(1)' },
          },
        }}
      >
        {loadingStage !== 'complete' && <CustomLoader />}

        <Typography
          variant="body1" 
          sx={{
            color: '#fff',
            textAlign: 'center',
            fontWeight: 300,
            letterSpacing: '0.05em',
            fontSize: loadingStage === 'complete' ? '1.2rem' : '1rem',
            transition: 'font-size 0.3s ease',
            mt: 2,
            mb: 4,
          }}
        >
          {getDisplayMessage()}
        </Typography>
      </Box>
    </Box>
  );

  console.log("LoadingScreen: Rendering with orientation:", currentOrientation, "shouldRotate:", shouldRotate);

  return (
    <Box
      sx={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        backgroundColor: theme.palette.background.default,
      }}
    >
      <Fade in={showContent} timeout={800}>
        {currentOrientation === 'LANDSCAPE' || !shouldRotate ? (
          // Landscape orientation or no rotation needed
          <Box sx={{ width: '100%', height: '100%' }}>
            <LoadingContent />
          </Box>
        ) : (
          // Portrait orientation with rotation transform
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: windowHeight,
              height: windowWidth,
              transform: 'translate(-50%, -50%) rotate(90deg)',
              transformOrigin: 'center',
            }}
          >
            <LoadingContent />
          </Box>
        )}
      </Fade>
    </Box>
  );
};

export default LoadingScreen; 
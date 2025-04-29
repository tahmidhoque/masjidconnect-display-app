import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, useTheme, Fade } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { useOrientation } from '../../contexts/OrientationContext';
import { useContent } from '../../contexts/ContentContext';
import useAppInitialization from '../../hooks/useAppInitialization';
import useRotationHandling from '../../hooks/useRotationHandling';
import logoGold from '../../assets/logos/logo-gold.svg';

interface LoadingScreenProps {
  onComplete?: () => void;
  isSuspenseFallback?: boolean;
}

/**
 * LoadingScreen component
 * 
 * Displays a loading screen with the MasjidConnect logo and a loading animation
 * while the app checks pairing status and fetches content.
 * Shows different messages based on authentication status.
 */
const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete, isSuspenseFallback = false }) => {
  const theme = useTheme();
  const { isAuthenticated } = useAuth();
  const { orientation } = useOrientation();
  const { masjidName, isLoading: contentLoading, prayerTimes } = useContent();
  const { loadingMessage, initializationStage, isInitializing } = useAppInitialization();
  
  // Animation and content states
  const [rotationAngle, setRotationAngle] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'initializing' | 'setting-up' | 'ready' | 'complete'>('initializing');
  const [showSpinner, setShowSpinner] = useState(true);
  const [spinnerOpacity, setSpinnerOpacity] = useState(1);
  const [loadingContentMessage, setLoadingContentMessage] = useState('Initializing...');
  
  // Reference to track if we've already triggered completion
  const hasCompletedRef = useRef(false);
  
  // Track orientation for proper rendering
  const { shouldRotate } = useRotationHandling(orientation);
  
  // Calculate viewport dimensions
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  // Simple spinner animation effect - runs independently
  useEffect(() => {
    const animationInterval = setInterval(() => {
      setRotationAngle(prev => (prev + 2) % 360);
    }, 30);
    
    return () => clearInterval(animationInterval);
  }, []);

  // Fade in the content initially
  useEffect(() => {
    setTimeout(() => {
      setShowContent(true);
    }, 300);
  }, []);
  
  // Update loading message based on content loading status
  useEffect(() => {
    if (contentLoading) {
      setLoadingContentMessage('Loading content...');
    } else if (prayerTimes) {
      setLoadingContentMessage('Loading prayer times...');
    }
  }, [contentLoading, prayerTimes]);

  // Progress through loading stages with timeouts for premium feel
  useEffect(() => {
    // Set initial loading stage
    setLoadingStage('initializing');
    
    // Progress through stages with timeouts
    const stageTimers: NodeJS.Timeout[] = [];
    
    // Stage 1: Setting up
    stageTimers.push(setTimeout(() => {
      setLoadingStage('setting-up');
    }, 2500));
    
    // Stage 2: Ready
    stageTimers.push(setTimeout(() => {
      setLoadingStage('ready');
    }, 5000));
    
    // Stage 3: Complete - fade spinner gradually
    stageTimers.push(setTimeout(() => {
      setLoadingStage('complete');
      
      // Gradually fade out the spinner over 2 seconds
      const fadeStart = Date.now();
      const fadeDuration = 2000;
      const fadeInterval = setInterval(() => {
        const elapsed = Date.now() - fadeStart;
        const progress = Math.min(elapsed / fadeDuration, 1);
        setSpinnerOpacity(1 - progress);
        
        if (progress >= 1) {
          clearInterval(fadeInterval);
          // Only hide spinner completely after fade completes
          setShowSpinner(false);
        }
      }, 50); // Update every 50ms for smooth animation
    }, 7500));
    
    if (isSuspenseFallback) {
      // If used as a Suspense fallback, keep showing the spinner indefinitely
      setShowSpinner(true);
      setSpinnerOpacity(1);
      setLoadingStage('initializing');
      
      // Ensure cleanup doesn't hide spinner
      return () => {};
    }

    // Clean up all timers on unmount
    return () => {
      stageTimers.forEach(timer => clearTimeout(timer));
    };
  }, [isSuspenseFallback]);

  // Get display message based on loading stage, auth status and data loading
  const getDisplayMessage = () => {
    // If used as Suspense fallback, show a simple message
    if (isSuspenseFallback) {
      return 'Loading...';
    }

    // For final stage, always show the Salam greeting with mosque name if available
    if (loadingStage === 'complete' || initializationStage === 'complete') {
      if (isAuthenticated && masjidName) {
        return `السلام عليكم - ${masjidName}`;
      }
      return 'السلام عليكم';
    }
    
    // For other stages, use app initialization message if available
    if (loadingMessage && initializationStage !== 'complete') {
      return loadingMessage;
    }
    
    if (isAuthenticated) {
      // Show more specific loading messages when authenticated
      if (contentLoading) {
        return 'Loading latest content...';
      } else if (!prayerTimes) {
        return 'Loading prayer times...';
      }
      
      switch (loadingStage) {
        case 'initializing':
          return 'Loading your dashboard...';
        case 'setting-up':
          return 'Fetching latest content...';
        case 'ready':
          return 'Preparing your display...';
        default:
          return 'Loading...';
      }
    } else {
      // Not authenticated
      const isPaired = localStorage.getItem('masjid_screen_id') !== null;
      
      switch (loadingStage) {
        case 'initializing':
          return 'Initializing...';
        case 'setting-up':
          return isPaired ? 'Reconnecting to your masjid...' : 'Setting up display...';
        case 'ready':
          return isPaired ? 'Ready to reconnect' : 'Ready to pair';
        default:
          return 'Loading...';
      }
    }
  };

  // Custom Islamic geometric pattern loader
  const CustomLoader = () => {
    const goldColor = theme.palette.warning.main; // Gold color
    const emeraldColor = '#2A9D8F'; // Emerald Green from brand guidelines
    const skyBlueColor = '#66D1FF'; // Sky Blue from brand guidelines

    return (
      <Box sx={{ position: 'relative', width: 120, height: 120, marginBottom: 3 }}>
        {/* Outer rotating ring */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            border: `4px solid ${goldColor}`,
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
            border: `4px solid ${emeraldColor}`,
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

  // Main content to be displayed
  const LoadingContent = () => (
    <Box
      sx={{
        background: 'linear-gradient(135deg, #0A2647 0%, #144272 100%)',
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
      
      {/* Logo container - fixed height to prevent movement */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexGrow: 2,
          position: 'relative', // Keep position stable
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

      {/* Bottom section with fixed height to prevent layout shifts */}
      <Box
        sx={{ 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: 'auto',
          flexGrow: 1,
          justifyContent: 'flex-end',
          minHeight: '240px', // Increased height for better spacing
          position: 'relative', // Create a containing context
          '@keyframes logoGlow': {
            '0%': { filter: 'brightness(1)' },
            '50%': { filter: 'brightness(1.3)' },
            '100%': { filter: 'brightness(1)' },
          },
        }}
      >
        {/* Fixed position spinner container with smooth opacity transition */}
        <Box 
          sx={{ 
            height: 'auto',
            width: '100%', 
            display: 'flex',
            alignItems: 'center', 
            justifyContent: 'center',
            position: 'relative', // Changed to relative positioning
            marginBottom: 4, // Add space between spinner and text
            opacity: spinnerOpacity,
            transition: 'opacity 2s ease',
            visibility: showSpinner ? 'visible' : 'hidden',
          }}
        >
          <CustomLoader />
        </Box>

        {/* Message container - central and more prominent */}
        <Box
          sx={{
            width: '100%',
            position: 'relative',
            textAlign: 'center',
            padding: '0 24px',
            marginBottom: 4, // Add space at bottom
          }}
        >
          <Typography
            variant="body1" 
            sx={{
              color: '#fff',
              textAlign: 'center',
              fontWeight: 400,
              letterSpacing: '0.05em',
              fontSize: loadingStage === 'complete' ? '1.8rem' : '1.4rem',
              transition: 'font-size 0.5s ease',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)', // Add shadow for better visibility
            }}
          >
            {getDisplayMessage()}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

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
        // Use opacity transition for entire component to fade out
        opacity: 1,
        transition: 'opacity 1.2s ease-in-out',
        '&.fade-out': {
          opacity: 0,
        },
        zIndex: 9999, // Ensure loading screen is above other content
      }}
      // Add className conditionally to avoid type errors
      className={!isInitializing ? 'fade-out' : undefined}
    >
      <Fade in={showContent} timeout={800}>
        {shouldRotate ? (
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
        ) : (
          // Landscape orientation or no rotation needed
          <Box sx={{ width: '100%', height: '100%' }}>
            <LoadingContent />
          </Box>
        )}
      </Fade>
    </Box>
  );
};

export default LoadingScreen; 
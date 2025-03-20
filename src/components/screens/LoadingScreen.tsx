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
  const { orientation, setAdminOrientation } = useOrientation();
  const { masjidName, screenContent } = useContent();
  
  // Animation and content states
  const [rotationAngle, setRotationAngle] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'initializing' | 'setting-up' | 'ready' | 'complete'>('initializing');
  
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

  // Simple, deterministic loading sequence
  useEffect(() => {
    console.log('Initializing loading sequence');
    
    // Set initial loading stage
    setLoadingStage('initializing');
    
    // Progress through stages with timeouts
    const stageTimers: NodeJS.Timeout[] = [];
    
    // Stage 1: Setting up
    stageTimers.push(setTimeout(() => {
      console.log('Advancing to setting-up stage');
      setLoadingStage('setting-up');
    }, 2500));
    
    // Stage 2: Ready
    stageTimers.push(setTimeout(() => {
      console.log('Advancing to ready stage');
      setLoadingStage('ready');
    }, 5000));
    
    // Stage 3: Complete
    stageTimers.push(setTimeout(() => {
      console.log('Advancing to complete stage');
      setLoadingStage('complete');
    }, 7500));
    
    // Stage 4: Call onComplete to transition
    stageTimers.push(setTimeout(() => {
      if (onComplete && !hasCompletedRef.current) {
        console.log('Loading sequence complete, transitioning...');
        hasCompletedRef.current = true;
        onComplete();
      }
    }, 10000));
    
    // Clean up all timers on unmount
    return () => {
      console.log('Cleaning up loading sequence timers');
      stageTimers.forEach(timer => clearTimeout(timer));
    };
  }, []); // Empty dependency array ensures this only runs once

  // Update orientation from screen content when it changes
  useEffect(() => {
    if (!screenContent) return;
    
    const newOrientation = screenContent?.data?.screen?.orientation ?? screenContent?.screen?.orientation;
    
    if (newOrientation && newOrientation !== orientation) {
      setAdminOrientation(newOrientation);
    }
  }, [screenContent, setAdminOrientation, orientation]);

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
          // Show mosque name with Assalamualaikum in Arabic
          return masjidName 
            ? `السلام عليكم - ${masjidName}` 
            : 'السلام عليكم';
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
          return 'السلام عليكم';
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

  // Main content to be displayed
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
            fontSize: loadingStage === 'complete' ? '1.5rem' : '1.2rem',
            transition: 'font-size 0.5s ease',
            mt: 2,
            mb: 4,
          }}
        >
          {getDisplayMessage()}
        </Typography>
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
      }}
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
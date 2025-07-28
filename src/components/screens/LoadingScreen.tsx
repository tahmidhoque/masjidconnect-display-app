import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Box, Typography, useTheme, Fade } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { useOrientation } from '../../contexts/OrientationContext';
import { useContent } from '../../contexts/ContentContext';
import useAppInitialization from '../../hooks/useAppInitialization';
import useRotationHandling from '../../hooks/useRotationHandling';
import logoGold from '../../assets/logos/logo-gold.svg';
import logger from '../../utils/logger';

interface LoadingScreenProps {
  onComplete?: () => void;
  isSuspenseFallback?: boolean;
}

// Interface for the display message object
interface DisplayMessage {
  text: string;
  isArabic: boolean;
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
  
  // Simplified animation and content states
  const [rotationAngle, setRotationAngle] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'initializing' | 'setting-up' | 'ready' | 'complete'>('initializing');
  const [showSpinner, setShowSpinner] = useState(true);
  const [spinnerOpacity, setSpinnerOpacity] = useState(1);
  
  // Reference to track if we've already triggered completion
  const hasCompletedRef = useRef(false);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track orientation for proper rendering
  const { shouldRotate } = useRotationHandling(orientation);
  
  // Calculate viewport dimensions (memoized to prevent recalculation)
  const viewportDimensions = useMemo(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }), []);

  // Optimized spinner animation effect - reduced frequency for RPi
  useEffect(() => {
    if (!animationIntervalRef.current) {
      animationIntervalRef.current = setInterval(() => {
        setRotationAngle(prev => (prev + 3) % 360); // Slower rotation, less frequent updates
      }, 50); // Reduced frequency from 30ms to 50ms for better RPi performance
    }
    
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
    };
  }, []);

  // Single effect for showing content
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(timer);
  }, []);
  
  // Memoized display message to prevent recalculation on every render
  const displayMessage = useMemo((): DisplayMessage => {
    // If used as Suspense fallback, show a simple message
    if (isSuspenseFallback) {
      return { text: 'Loading...', isArabic: false };
    }

    // For final stage, always show the Salam greeting with mosque name if available
    if (loadingStage === 'complete' || initializationStage === 'complete') {
      if (isAuthenticated && masjidName) {
        return { text: `السلام عليكم - ${masjidName}`, isArabic: true };
      }
      return { text: 'السلام عليكم', isArabic: true };
    }
    
    // For other stages, use app initialization message if available
    if (loadingMessage && initializationStage !== 'complete') {
      return { text: loadingMessage, isArabic: false };
    }
    
    if (isAuthenticated) {
      // Show more specific loading messages when authenticated
      if (contentLoading) {
        return { text: 'Loading latest content...', isArabic: false };
      } else if (!prayerTimes) {
        return { text: 'Loading prayer times...', isArabic: false };
      }
      
      switch (loadingStage) {
        case 'initializing':
          return { text: 'Loading your dashboard...', isArabic: false };
        case 'setting-up':
          return { text: 'Fetching latest content...', isArabic: false };
        case 'ready':
          return { text: 'Preparing your display...', isArabic: false };
        default:
          return { text: 'Loading...', isArabic: false };
      }
    } else {
      // Not authenticated
      const isPaired = localStorage.getItem('masjid_screen_id') !== null;
      
      switch (loadingStage) {
        case 'initializing':
          return { text: 'Initializing...', isArabic: false };
        case 'setting-up':
          return { text: isPaired ? 'Reconnecting to your masjid...' : 'Setting up display...', isArabic: false };
        case 'ready':
          return { text: isPaired ? 'Ready to reconnect' : 'Ready to pair', isArabic: false };
        default:
          return { text: 'Loading...', isArabic: false };
      }
    }
  }, [isSuspenseFallback, loadingStage, initializationStage, loadingMessage, isAuthenticated, masjidName, contentLoading, prayerTimes]);

  // Simplified loading progression effect
  useEffect(() => {
    if (isSuspenseFallback) return;
    
    // Set a timeout to move past loading state even if prayer times aren't loaded
    const loadingTimeout = setTimeout(() => {
      if (contentLoading === false && loadingStage === 'initializing') {
        logger.info('Loading timeout reached, proceeding anyway');
        setLoadingStage('setting-up');
      }
    }, 5000); // 5 second timeout

    // Force progression if all data is loaded
    if (!contentLoading && prayerTimes) {
      setLoadingStage(prevStage => 
        prevStage === 'initializing' ? 'setting-up' : prevStage
      );
    }

    return () => clearTimeout(loadingTimeout);
  }, [contentLoading, prayerTimes, loadingStage, isSuspenseFallback]);

  // Progress through loading stages with timeouts for premium feel
  useEffect(() => {
    if (isSuspenseFallback) return;
    
    const stageTimers: NodeJS.Timeout[] = [];
    
    // Stage 1: Setting up (reduced timing for RPi)
    stageTimers.push(setTimeout(() => {
      setLoadingStage('setting-up');
    }, 2000)); // Reduced from 2500ms
    
    // Stage 2: Ready
    stageTimers.push(setTimeout(() => {
      setLoadingStage('ready');
    }, 4000)); // Reduced from 5000ms
    
    // Stage 3: Complete - fade spinner gradually
    stageTimers.push(setTimeout(() => {
      setLoadingStage('complete');
      
      // Gradually fade out the spinner over 1.5 seconds (reduced for RPi)
      const fadeStart = Date.now();
      const fadeDuration = 1500;
      const fadeInterval = setInterval(() => {
        const elapsed = Date.now() - fadeStart;
        const progress = Math.min(elapsed / fadeDuration, 1);
        setSpinnerOpacity(1 - progress);
        
        if (progress >= 1) {
          clearInterval(fadeInterval);
          setShowSpinner(false);
          
          // Notify parent that loading is complete - ensure we only do this once
          if (!hasCompletedRef.current && onComplete) {
            hasCompletedRef.current = true;
            onComplete();
          }
        }
      }, 100); // Update every 100ms for smoother but less frequent updates
    }, 6000)); // Reduced from 7500ms
    
    // Clean up all timers on unmount
    return () => {
      stageTimers.forEach(timer => clearTimeout(timer));
    };
  }, [isSuspenseFallback, onComplete]);

  // Custom Islamic geometric pattern loader (optimized for RPi)
  const CustomLoader = useCallback(() => {
    const goldColor = theme.palette.warning.main;
    const emeraldColor = '#2A9D8F';
    const skyBlueColor = '#66D1FF';

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
            transition: 'transform 0.05s linear', // Smooth transition
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
            transition: 'transform 0.05s linear', // Smooth transition
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
  }, [theme.palette.warning.main, rotationAngle]);

  // Main content to be displayed (memoized)
  const LoadingContent = useMemo(() => (
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
          position: 'relative',
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
          minHeight: '240px',
          position: 'relative',
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
            position: 'relative',
            marginBottom: 4,
            opacity: spinnerOpacity,
            transition: 'opacity 1.5s ease', // Smoother transition
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
            marginBottom: 4,
          }}
        >
          <Typography
            variant={displayMessage.isArabic ? "arabicText" : "body1"}
            sx={{
              color: '#fff',
              textAlign: 'center',
              fontWeight: 400,
              letterSpacing: '0.05em',
              fontSize: loadingStage === 'complete' ? '1.8rem' : '1.4rem',
              transition: 'font-size 0.5s ease',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            }}
          >
            {displayMessage.text}
          </Typography>
        </Box>
      </Box>
    </Box>
  ), [theme.palette.warning.main, loadingStage, CustomLoader, spinnerOpacity, showSpinner, displayMessage]);

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
        opacity: 1,
        transition: 'opacity 1.2s ease-in-out',
        '&.fade-out': {
          opacity: 0,
        },
        zIndex: 9999,
      }}
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
              width: viewportDimensions.height,
              height: viewportDimensions.width,
              transform: 'translate(-50%, -50%) rotate(90deg)',
              transformOrigin: 'center',
            }}
          >
            {LoadingContent}
          </Box>
        ) : (
          // Landscape orientation or no rotation needed
          <Box sx={{ width: '100%', height: '100%' }}>
            {LoadingContent}
          </Box>
        )}
      </Fade>
    </Box>
  );
};

export default LoadingScreen; 
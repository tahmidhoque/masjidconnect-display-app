import React, { useEffect, useState } from 'react';
import { Box, Typography, useTheme, Fade } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { Orientation } from '../../contexts/OrientationContext';
import useAppInitialization from '../../hooks/useAppInitialization';
import logoGold from '../../assets/logos/logo-gold.svg';

interface LoadingScreenProps {
  onComplete?: () => void;
}

/**
 * LoadingScreen component
 * 
 * Displays a loading screen with the MasjidConnect logo and a loading animation
 * while the app checks pairing status and fetches content.
 */
const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const theme = useTheme();
  const { isAuthenticated } = useAuth();
  const { loadingMessage, orientation } = useAppInitialization();
  const [rotationAngle, setRotationAngle] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'initializing' | 'setting-up' | 'ready' | 'complete'>('initializing');

  // Animation effect for the custom loader
  useEffect(() => {
    const animationInterval = setInterval(() => {
      setRotationAngle(prevAngle => (prevAngle + 1) % 360);
    }, 20);

    return () => clearInterval(animationInterval);
  }, []);

  // Simplified loading stage management
  useEffect(() => {
    console.log("LoadingScreen: Current loading message:", loadingMessage);
    
    // Initial fade-in animation
    setTimeout(() => {
      setShowContent(true);
    }, 500);

    // Simplified loading stages
    if (loadingMessage.includes("check") || loadingMessage.includes("fetch")) {
      setLoadingStage('setting-up');
    } else if (loadingMessage === "Ready" || loadingMessage.includes("Complete")) {
      setLoadingStage('ready');
      
      // Show "Welcome to MasjidConnect" message briefly
      setTimeout(() => {
        setLoadingStage('complete');
        
        // Call onComplete after a longer delay to ensure initialization is complete
        if (onComplete) {
          console.log("LoadingScreen: Will call onComplete in 3 seconds");
          setTimeout(() => {
            console.log("LoadingScreen: Calling onComplete callback NOW");
            onComplete();
          }, 3000);
        }
      }, 2000);
    }
  }, [loadingMessage, onComplete]);

  // Guaranteed transition after a maximum time - increased to 10 seconds
  useEffect(() => {
    const forceTransitionTimer = setTimeout(() => {
      if (onComplete) {
        console.log("LoadingScreen: Force transition timer triggered after 10 seconds");
        onComplete();
      }
    }, 10000);
    
    return () => clearTimeout(forceTransitionTimer);
  }, [onComplete]);

  // Get display message based on loading stage
  const getDisplayMessage = () => {
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
  };

  // Determine orientation style
  const getOrientationStyle = () => {
    // Force landscape for unpaired devices, otherwise use the set orientation
    const useOrientation: Orientation = isAuthenticated ? orientation : 'LANDSCAPE';
    
    if (useOrientation === 'PORTRAIT') {
      return {
        transform: 'rotate(90deg)',
        width: '100vh',
        height: '100vw',
      };
    }
    
    return {
      width: '100vw',
      height: '100vh',
    };
  };

  // Custom Islamic geometric pattern loader
  const CustomLoader = () => {
    const goldColor = theme.palette.warning.main; // Gold color
    const blueColor = theme.palette.primary.main; // Midnight Blue
    const emeraldColor = '#2A9D8F'; // Emerald Green from brand guidelines
    const skyBlueColor = '#66D1FF'; // Sky Blue from brand guidelines

    return (
      <Box sx={{ position: 'relative', width: 80, height: 80, marginBottom: 2 }}>
        {/* Outer rotating ring - represents connectivity */}
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
        
        {/* Middle rotating ring - represents innovation */}
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
        
        {/* Inner geometric pattern - represents tradition */}
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

  return (
    <Fade in={showContent} timeout={800}>
      <Box
        sx={{
          height: '100vh',
          width: '100vw',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            backgroundColor: theme.palette.primary.main, // Midnight Blue background
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'absolute',
            top: 0,
            left: 0,
            padding: '5vh 0',
            ...getOrientationStyle(),
          }}
        >
          {/* Empty top space for balance */}
          <Box sx={{ flexGrow: 1 }} />
          
          {/* Logo container - centered and larger */}
          <Fade in={showContent} timeout={1000}>
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
                color: theme.palette.warning.main, // Gold color
              }}>
                <img 
                  src={logoGold} 
                  alt="MasjidConnect Logo" 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'contain' 
                  }} 
                />
              </Box>
            </Box>
          </Fade>
          
          {/* Bottom section with loading animation and message */}
          <Fade in={showContent} timeout={1500}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginTop: 'auto',
                flexGrow: 1,
                justifyContent: 'flex-end',
              }}
            >
              {/* Hide loader when complete */}
              {loadingStage !== 'complete' && <CustomLoader />}
              
              {/* Loading message */}
              <Typography 
                variant="body1" 
                sx={{ 
                  color: '#fff',
                  textAlign: 'center',
                  fontWeight: 300,
                  letterSpacing: '0.05em',
                  fontSize: loadingStage === 'complete' ? '1.2rem' : '1rem',
                  transition: 'font-size 0.3s ease',
                }}
              >
                {getDisplayMessage()}
              </Typography>
            </Box>
          </Fade>
        </Box>
      </Box>
    </Fade>
  );
};

export default LoadingScreen; 
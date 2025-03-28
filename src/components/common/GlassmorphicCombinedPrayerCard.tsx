import React, { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { Box, Typography, useTheme, alpha, CircularProgress } from '@mui/material';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import GlassmorphicCard from './GlassmorphicCard';
import PrayerCountdown from './PrayerCountdown';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';
import { goldGradient } from '../../theme/theme';
import IslamicPatternBackground from './IslamicPatternBackground';
import { useContent } from '../../contexts/ContentContext';
import logger from '../../utils/logger';

interface GlassmorphicCombinedPrayerCardProps {
  orientation?: 'portrait' | 'landscape';
  onCountdownComplete?: (isJamaat: boolean) => void;
}

/**
 * GlassmorphicCombinedPrayerCard component
 * 
 * A unified glassmorphic card that combines the prayer countdown and prayer times
 * for better space utilization and visual coherence.
 */
const GlassmorphicCombinedPrayerCard: React.FC<GlassmorphicCombinedPrayerCardProps> = ({
  orientation = 'landscape',
  onCountdownComplete
}) => {
  const theme = useTheme();
  const { fontSizes, layout, screenSize, getSizeRem } = useResponsiveFontSize();
  const { 
    todaysPrayerTimes,
    nextPrayer,
    isJumuahToday,
    jumuahDisplayTime,
    jumuahKhutbahTime
  } = usePrayerTimes();
  
  const { refreshPrayerTimes, prayerTimes, isLoading } = useContent();
  
  // Local state to handle initial loading and retry logic
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [localLoading, setLocalLoading] = useState(true);
  
  // Use refs to track component state between renders
  const lastRefreshTimeRef = useRef<number>(Date.now());
  const dataCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const MIN_REFRESH_INTERVAL = 5000; // 5 seconds minimum between refreshes

  // Effect to handle retry logic if prayer times don't load properly
  useEffect(() => {
    // Clean up any existing timeout to prevent multiple refreshes
    if (dataCheckTimeoutRef.current) {
      clearTimeout(dataCheckTimeoutRef.current);
      dataCheckTimeoutRef.current = null;
    }

    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTimeRef.current;
    
    // Check if we have the necessary data, if not, retry the refresh
    if (!isLoading && (!nextPrayer || !todaysPrayerTimes.length)) {
      logger.warn('[GlassmorphicCombinedPrayerCard] Prayer times data missing or incomplete', {
        retryCount,
        hasPrayerTimes: !!prayerTimes,
        hasNextPrayer: !!nextPrayer,
        hasFormattedTimes: todaysPrayerTimes.length,
        prayerTimesData: prayerTimes ? JSON.stringify(prayerTimes).substring(0, 100) + '...' : 'null',
        timeSinceLastRefresh: `${Math.round(timeSinceLastRefresh / 1000)}s`
      });
      
      // Only retry if sufficient time has passed since last refresh
      if (timeSinceLastRefresh > MIN_REFRESH_INTERVAL) {
        setIsRetrying(true);
        lastRefreshTimeRef.current = now;
        
        // Add a delay before retrying that increases with retry count, but keep trying indefinitely
        // This is important for kiosk mode where manual intervention is not possible
        const retryDelay = Math.min(1000 * Math.min(retryCount + 1, 10), 10000); // Exponential backoff, max 10 seconds
        
        dataCheckTimeoutRef.current = setTimeout(() => {
          logger.info(`[GlassmorphicCombinedPrayerCard] Executing refresh attempt ${retryCount + 1}`);
          // Force-clear the cache on retries to avoid stale data
          refreshPrayerTimes();
          setRetryCount(prev => prev + 1);
          setIsRetrying(false);
        }, retryDelay);
      } else {
        // If we're trying to refresh too frequently, wait a bit
        logger.debug(`[GlassmorphicCombinedPrayerCard] Throttling refresh, will retry in ${Math.ceil((MIN_REFRESH_INTERVAL - timeSinceLastRefresh) / 1000)}s`);
        
        dataCheckTimeoutRef.current = setTimeout(() => {
          // This will trigger a re-run of this effect
          setIsRetrying(prev => !prev);
        }, MIN_REFRESH_INTERVAL - timeSinceLastRefresh + 100);
      }
    } else {
      // Once we have data, switch local loading off
      if (!isLoading && (nextPrayer || todaysPrayerTimes.length)) {
        logger.info('[GlassmorphicCombinedPrayerCard] Prayer times loaded successfully', {
          hasNextPrayer: !!nextPrayer,
          prayerTimesCount: todaysPrayerTimes.length,
          retryCount
        });
        setLocalLoading(false);
        
        // Reset retry count when successful
        if (retryCount > 0) {
          setRetryCount(0);
        }
      }
    }
    
    // Cleanup function
    return () => {
      if (dataCheckTimeoutRef.current) {
        clearTimeout(dataCheckTimeoutRef.current);
        dataCheckTimeoutRef.current = null;
      }
    };
  }, [isLoading, nextPrayer, todaysPrayerTimes, retryCount, refreshPrayerTimes, prayerTimes]);

  // Force refresh when mounted to ensure we have fresh data
  useEffect(() => {
    logger.info('[GlassmorphicCombinedPrayerCard] Component mounted, triggering initial data refresh');
    lastRefreshTimeRef.current = Date.now();
    refreshPrayerTimes();
    
    // Set up visibility change listener - important for focus/blur cycles
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        logger.info('[GlassmorphicCombinedPrayerCard] Window became visible, refreshing data');
        lastRefreshTimeRef.current = Date.now();
        refreshPrayerTimes();
      }
    };
    
    // Add visibility and focus event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    
    // Cleanup on unmount
    return () => {
      if (dataCheckTimeoutRef.current) {
        clearTimeout(dataCheckTimeoutRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [refreshPrayerTimes]);

  // Listen for content updates
  useEffect(() => {
    const handleContentUpdate = (event: CustomEvent) => {
      if (event.detail.type === 'prayerTimes') {
        logger.info('[GlassmorphicCombinedPrayerCard] Prayer times update detected', {
          timestamp: new Date(event.detail.timestamp).toISOString(),
          hasNextPrayer: !!nextPrayer,
          hasFormattedTimes: todaysPrayerTimes.length
        });
      }
    };

    window.addEventListener('contentUpdated', handleContentUpdate as EventListener);
    
    return () => {
      window.removeEventListener('contentUpdated', handleContentUpdate as EventListener);
    };
  }, [nextPrayer, todaysPrayerTimes.length]);

  // Periodically check and refresh data if needed - less frequently than before
  useEffect(() => {
    // Set up an interval to refresh prayer times every 15 minutes
    // This ensures the display is always up to date, even if other mechanisms fail
    const refreshInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastRefreshTimeRef.current > 15 * 60 * 1000) { // Only if last refresh was >15 min ago
        logger.debug('[GlassmorphicCombinedPrayerCard] Performing periodic data refresh check');
        lastRefreshTimeRef.current = now;
        refreshPrayerTimes();
      }
    }, 15 * 60 * 1000); // 15 minutes
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [refreshPrayerTimes]);

  // Animation for the shimmer effect
  const cardAnimation = useMemo(() => `
    @keyframes shimmer {
      0% {
        background-position: -100% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }
    
    @keyframes pulseGlow {
      0% {
        box-shadow: 0 4px 10px rgba(42, 157, 143, 0.4), 0 0 15px rgba(42, 157, 143, 0.3);
      }
      50% {
        box-shadow: 0 4px 18px rgba(42, 157, 143, 0.6), 0 0 25px rgba(42, 157, 143, 0.5);
      }
      100% {
        box-shadow: 0 4px 10px rgba(42, 157, 143, 0.4), 0 0 15px rgba(42, 157, 143, 0.3);
      }
    }
    
    @keyframes currentPrayerGlow {
      0% {
        box-shadow: 0 2px 8px rgba(20, 66, 114, 0.4);
      }
      50% {
        box-shadow: 0 2px 15px rgba(20, 66, 114, 0.7);
      }
      100% {
        box-shadow: 0 2px 8px rgba(20, 66, 114, 0.4);
      }
    }

    @keyframes subtlePulse {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      50% {
        transform: scale(1.01);
        opacity: 0.96;
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }
  `, []);
  
  const isPortrait = orientation === 'portrait';
  const is720p = screenSize.is720p || screenSize.isSmallerThan720p;
  
  // Calculate row height based on screen size
  const rowHeight = isPortrait 
    ? (is720p ? getSizeRem(3.2) : getSizeRem(3.5)) 
    : getSizeRem(2.8);
    
  // Common padding for consistent spacing across header and rows
  const commonPadding = {
    px: isPortrait ? getSizeRem(1.2) : getSizeRem(1),
    py: isPortrait ? getSizeRem(0.5) : getSizeRem(0.4)
  };
  
  // Check if Jumuah data is available
  const hasJumuahData = useMemo(() => {
    return Boolean(
      isJumuahToday && (
        jumuahDisplayTime || 
        jumuahKhutbahTime ||
        (prayerTimes && 
          (prayerTimes.jummahKhutbah || 
           prayerTimes.jummahJamaat ||
           (prayerTimes.data && 
            prayerTimes.data[0] && 
            (prayerTimes.data[0].jummahKhutbah || 
             prayerTimes.data[0].jummahJamaat))))
      )
    );
  }, [isJumuahToday, jumuahDisplayTime, jumuahKhutbahTime, prayerTimes]);
  
  // Handle countdown completion
  const handleCountdownComplete = useCallback((isJamaat: boolean) => {
    logger.info(`[GlassmorphicCombinedPrayerCard] Countdown completed for ${isJamaat ? 'jamaat' : 'adhan'} time`);
    
    // Ensure we immediately refresh prayer times to get the next prayer
    refreshPrayerTimes();
    
    // Pass the event up to parent component if provided
    if (onCountdownComplete) {
      onCountdownComplete(isJamaat);
    }
  }, [refreshPrayerTimes, onCountdownComplete]);

  // Helper to get background color for prayer row
  const getPrayerBackgroundColor = (prayer: any) => {
    if (prayer.isNext) {
      return alpha(theme.palette.warning.main, 0.2);
    } else if (prayer.isCurrent) {
      return alpha(theme.palette.secondary.dark, 0.2);
    } 
    return 'transparent';
  };

  // Helper to get border for prayer row
  const getPrayerBorder = (prayer: any) => {
    if (prayer.isNext) {
      return `1px solid ${alpha(theme.palette.warning.main, 0.3)}`;
    } else if (prayer.isCurrent) {
      return `1px solid ${alpha(theme.palette.secondary.dark, 0.3)}`;
    } 
    return 'none';
  };
  
  // Early return with loading state
  if (isLoading || localLoading || isRetrying) {
    return (
      <GlassmorphicCard
        opacity={0.2}
        blurIntensity={8}
        borderRadius={4}
        borderWidth={1}
        borderOpacity={0.3}
        borderColor={theme.palette.warning.main}
        shadowIntensity={0.35}
        sx={{
          width: '100%',
          height: '100%',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.7)} 0%, ${alpha(theme.palette.primary.main, 0.7)} 100%)`,
        }}
      >
        <CircularProgress color="warning" size={40} thickness={4} />
        <Typography 
          sx={{ 
            mt: 2, 
            fontSize: fontSizes.h6,
            fontWeight: 600,
            textAlign: 'center'
          }}
        >
          Loading Prayer Times...
        </Typography>
      </GlassmorphicCard>
    );
  }
  
  // Fallback for when retries are exhausted but still no data
  if (!nextPrayer) {
    logger.error('[GlassmorphicCombinedPrayerCard] Failed to load prayer times after retries');
    return (
      <GlassmorphicCard
        opacity={0.2}
        blurIntensity={8}
        borderRadius={4}
        borderWidth={1}
        borderOpacity={0.3}
        borderColor={theme.palette.warning.main}
        shadowIntensity={0.35}
        sx={{
          width: '100%',
          height: '100%',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.7)} 0%, ${alpha(theme.palette.primary.main, 0.7)} 100%)`,
          p: 3
        }}
      >
        <Typography 
          sx={{ 
            fontSize: fontSizes.h5, 
            fontWeight: 600,
            textAlign: 'center',
            mb: 2
          }}
        >
          Prayer Times Unavailable
        </Typography>
        <Typography 
          sx={{ 
            fontSize: fontSizes.body1,
            textAlign: 'center',
            mb: 2
          }}
        >
          Unable to load prayer times. Please check your connection and try again.
        </Typography>
        <Box 
          onClick={() => {
            setLocalLoading(true);
            setRetryCount(0);
            refreshPrayerTimes();
          }}
          sx={{
            cursor: 'pointer',
            p: 1,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.warning.main, 0.3),
            '&:hover': {
              bgcolor: alpha(theme.palette.warning.main, 0.4),
            }
          }}
        >
          <Typography color="warning.light" fontWeight={600}>
            Tap to Retry
          </Typography>
        </Box>
      </GlassmorphicCard>
    );
  }
  
  return (
    <>
      <style>{cardAnimation}</style>
      <GlassmorphicCard
        opacity={0.2}
        blurIntensity={8}
        borderRadius={4}
        borderWidth={1}
        borderOpacity={0.3}
        borderColor={theme.palette.warning.main}
        shadowIntensity={0.35}
        sx={{
          width: '100%',
          height: '100%', // Fill available height
          color: '#fff',
          overflow: 'hidden',
          ml: isPortrait ? 0 : 1, // No left margin in portrait
          mr: isPortrait ? 0 : 0.5, // No right margin in portrait
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.7)} 0%, ${alpha(theme.palette.primary.main, 0.7)} 100%)`,
          borderTop: `1px solid ${alpha('#ffffff', 0.5)}`,
          borderLeft: `1px solid ${alpha('#ffffff', 0.5)}`,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '200%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent)',
            animation: 'shimmer 4s infinite linear',
            zIndex: 0
          }
        }}
      >
        {/* Countdown Section */}
        <Box sx={{ 
          p: isPortrait ? getSizeRem(1.2) : getSizeRem(1),
          pb: isPortrait ? getSizeRem(0.8) : getSizeRem(0.6),
          borderBottom: `1px solid ${alpha(theme.palette.warning.main, 0.25)}`,
          position: 'relative',
          zIndex: 1,
          background: `linear-gradient(to bottom, ${alpha(theme.palette.secondary.dark, 0.2)}, transparent)`,
        }}>
          <Typography 
            sx={{ 
              fontSize: isPortrait ? fontSizes.h4 : fontSizes.h5,
              fontWeight: 700,
              backgroundImage: goldGradient,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: isPortrait ? getSizeRem(0.5) : getSizeRem(0.5),
              fontFamily: "'Poppins', sans-serif",
              letterSpacing: '0.5px',
              textAlign: 'center',
              textShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
            }}
          >
            Next Prayer: <strong>{nextPrayer.name}</strong>
          </Typography>
          
          <PrayerCountdown
            prayerName={nextPrayer.name}
            prayerTime={nextPrayer.time}
            jamaatTime={nextPrayer.name === 'Zuhr' && isJumuahToday && jumuahDisplayTime ? jumuahDisplayTime : nextPrayer.jamaat}
            timeUntilNextPrayer={nextPrayer.timeUntil}
            onCountdownComplete={handleCountdownComplete}
          />
        </Box>
        
        {/* Prayer Times Section */}
        <Box sx={{ 
          p: isPortrait ? getSizeRem(0.8) : getSizeRem(0.8),
          pt: isPortrait ? getSizeRem(0.8) : getSizeRem(0.8),
          position: 'relative',
          zIndex: 1,
          flex: 1, // Flexbox to expand and fill available space
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'hidden', // Always allow scrolling if needed
        }}>
          {/* Headers */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              mb: getSizeRem(0.4),
              ...commonPadding,
              backgroundColor: alpha(theme.palette.info.main, 0.25), // Sky blue header
              borderRadius: '6px',
              border: 'none',
              alignItems: 'center', // Vertically center content
              height: rowHeight,
            }}
          >
            <Typography 
              sx={{ 
                fontSize: isPortrait ? fontSizes.body1 : fontSizes.body2,
                fontWeight: 700,
                opacity: 0.95,
                fontFamily: "'Poppins', sans-serif",
                textAlign: 'start',
                color: '#ffffff',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                height: '100%',
              }}
            >
              Start Time
            </Typography>
            <Typography 
              sx={{ 
                fontSize: isPortrait ? fontSizes.body1 : fontSizes.body2,
                fontWeight: 700,
                opacity: 0.95,
                textAlign: 'center',
                fontFamily: "'Poppins', sans-serif",
                color: '#ffffff',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              Prayer
            </Typography>
            <Typography 
              sx={{ 
                fontSize: isPortrait ? fontSizes.body1 : fontSizes.body2,
                fontWeight: 700,
                opacity: 0.95,
                textAlign: 'end',
                fontFamily: "'Poppins', sans-serif",
                color: '#ffffff',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: '100%',
              }}
            >
              Jamaa't
            </Typography>
          </Box>
          
          {/* Prayer Time Rows */}
          <Box sx={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            gap: 0, // No gap between rows
            backgroundImage: 'none', // Remove the background pattern
            mt: getSizeRem(0.2),
            pb: getSizeRem(0.2),
          }}>
            {todaysPrayerTimes.map((prayer, index) => (
              <Box key={prayer.name} 
                sx={{ 
                  mb: getSizeRem(0.3), // Add spacing between rows
                  transition: 'all 0.3s ease',
                  zIndex: prayer.isNext ? 5 : 1,
                }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    ...commonPadding,
                    borderRadius: prayer.isNext || prayer.isCurrent ? '8px' : '4px',
                    backgroundColor: getPrayerBackgroundColor(prayer),
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    border: getPrayerBorder(prayer),
                    boxShadow: prayer.isNext ? `0 2px 12px ${alpha(theme.palette.warning.main, 0.35)}` : 'none', // Add shadow for next prayer
                    height: rowHeight,
                    alignItems: 'center', // Vertically center content
                    animation: prayer.isNext ? 'subtlePulse 3s infinite ease-in-out' : 'none', // Add pulse animation for next prayer
                  }}
                >
                  <Box 
                    sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      height: '100%',
                      gap: getSizeRem(0.5),
                    }}
                  >
                    <Typography 
                      sx={{ 
                        fontSize: isPortrait ? fontSizes.h6 : fontSizes.body1,
                        fontWeight: (prayer.isNext || prayer.isCurrent || (prayer.name === 'Zuhr' && isJumuahToday && hasJumuahData)) ? 700 : 600,
                        color: prayer.isNext 
                          ? theme.palette.warning.light
                          : prayer.name === 'Zuhr' && isJumuahToday && hasJumuahData
                          ? theme.palette.warning.light
                          : '#ffffff',
                        fontFamily: "'Poppins', sans-serif",
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                        textAlign: 'start',
                      }}
                    >
                      {prayer.name === 'Zuhr' && isJumuahToday && hasJumuahData && jumuahKhutbahTime 
                        ? jumuahKhutbahTime
                        : prayer.displayTime}
                    </Typography>
                    
                    {prayer.name === 'Zuhr' && isJumuahToday && (
                      <GlassmorphicCard
                        opacity={0.15}
                        blurIntensity={6}
                        borderRadius={8}
                        borderWidth={1}
                        borderOpacity={0.3}
                        borderColor={theme.palette.warning.main}
                        shadowIntensity={0.2}
                        sx={{ 
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          px: getSizeRem(0.6),
                          py: getSizeRem(0.1),
                          background: `linear-gradient(135deg, ${alpha(theme.palette.warning.dark, 0.4)} 0%, ${alpha(theme.palette.warning.main, 0.4)} 100%)`,
                        }}
                      >
                        <Typography sx={{ 
                          fontSize: fontSizes.caption,
                          color: theme.palette.warning.light,
                          fontWeight: 700,
                          textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                        }}>
                          Khutbah
                        </Typography>
                      </GlassmorphicCard>
                    )}
                  </Box>
                  
                  <Typography 
                    sx={{ 
                      fontSize: isPortrait ? fontSizes.h6 : fontSizes.body1,
                      textAlign: 'center',
                      fontWeight: prayer.isNext || (prayer.name === 'Zuhr' && isJumuahToday && hasJumuahData) ? 700 : 600,
                      fontFamily: "'Poppins', sans-serif",
                      color: '#ffffff',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: isPortrait ? getSizeRem(1) : getSizeRem(0.8), // Increased gap for Jumu'ah tag
                      height: '100%',
                    }}
                  >
                    {prayer.name}
                    {prayer.name === 'Zuhr' && isJumuahToday && (
                      <GlassmorphicCard
                        opacity={0.15}
                        blurIntensity={6}
                        borderRadius={8}
                        borderWidth={1}
                        borderOpacity={0.3}
                        borderColor={theme.palette.warning.main}
                        shadowIntensity={0.2}
                        sx={{ 
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          px: getSizeRem(0.6),
                          py: getSizeRem(0.1),
                          background: `linear-gradient(135deg, ${alpha(theme.palette.warning.dark, 0.4)} 0%, ${alpha(theme.palette.warning.main, 0.4)} 100%)`,
                        }}
                      >
                        <Typography sx={{ 
                          fontSize: fontSizes.caption,
                          color: theme.palette.warning.light,
                          fontWeight: 700,
                          textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                        }}>
                          Jumu'ah
                        </Typography>
                      </GlassmorphicCard>
                    )}
                  </Typography>
                  
                  <Typography 
                    sx={{ 
                      fontSize: isPortrait ? fontSizes.h6 : fontSizes.body1,
                      textAlign: 'end',
                      fontWeight: prayer.isNext || (prayer.name === 'Zuhr' && isJumuahToday && hasJumuahData) ? 700 : 600,
                      color: (prayer.displayJamaat || (prayer.name === 'Zuhr' && isJumuahToday && jumuahDisplayTime)) ? '#ffffff' : alpha('#ffffff', 0.5),
                      fontFamily: "'Poppins', sans-serif",
                      textShadow: (prayer.displayJamaat || (prayer.name === 'Zuhr' && isJumuahToday && jumuahDisplayTime)) ? '0 1px 2px rgba(0, 0, 0, 0.3)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      height: '100%',
                    }}
                  >
                    {prayer.name === 'Zuhr' && isJumuahToday && jumuahDisplayTime ? jumuahDisplayTime : prayer.displayJamaat || 'N/A'}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </GlassmorphicCard>
    </>
  );
};

export default GlassmorphicCombinedPrayerCard; 
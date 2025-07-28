import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Fade } from '@mui/material';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';
import { parseTimeString } from '../../utils/dateUtils';
import logger from '../../utils/logger';
import dayjs from 'dayjs';

interface PrayerCountdownProps {
  prayerName: string;
  prayerTime: string;
  jamaatTime?: string;
  timeUntilNextPrayer: string;
  onCountdownComplete?: (isJamaat: boolean) => void;
}

/**
 * PrayerCountdown component
 * 
 * Displays a countdown timer to the next prayer time or jamaat time.
 * Formats the remaining time as hours, minutes, and seconds.
 * Transitions between prayer time and jamaat time automatically.
 */
const PrayerCountdown: React.FC<PrayerCountdownProps> = ({
  prayerName,
  prayerTime,
  jamaatTime,
  timeUntilNextPrayer,
  onCountdownComplete
}) => {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [displayTimes, setDisplayTimes] = useState(true);
  const [countingDownToJamaat, setCountingDownToJamaat] = useState(false);
  const [textTransition, setTextTransition] = useState(false);
  const { fontSizes, layout, screenSize, getSizeRem } = useResponsiveFontSize();
  const isPortrait = screenSize.width < screenSize.height;
  const initializingRef = useRef<boolean>(true);
  const prayerTimePassedRef = useRef<boolean>(false);
  const jamaatTimePassedRef = useRef<boolean>(false);
  const initialLoadTimestampRef = useRef<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Calculate remaining time and update countdown
  useEffect(() => {
    if (!prayerTime) {
      console.error('No prayer time provided for countdown');
      return;
    }
    
    // Validate prayer time format - must be HH:MM format
    const isValidTimeFormat = /^\d{1,2}:\d{2}$/.test(prayerTime);
    if (!isValidTimeFormat) {
      logger.error(`Invalid prayer time format for ${prayerName}: ${prayerTime}`);
      return;
    }
    
    // Set up initial time using pre-calculated value if available
    if (initializingRef.current && timeUntilNextPrayer) {
      try {
        if (timeUntilNextPrayer.includes('hr') || timeUntilNextPrayer.includes('min')) {
          const hourMatch = timeUntilNextPrayer.match(/(\d+)\s*hr/);
          const minuteMatch = timeUntilNextPrayer.match(/(\d+)\s*min/);
          
          const h = hourMatch ? parseInt(hourMatch[1], 10) : 0;
          const m = minuteMatch ? parseInt(minuteMatch[1], 10) : 0;
          
          setHours(h);
          setMinutes(m);
          setSeconds(0);
          
          logger.debug(`[PrayerCountdown] Initial time set for ${prayerName} from pre-calculated value: ${h}hr ${m}min`);
        }
        
        // EDGE CASE: Check if we're starting between prayer time and jamaat time
        // If so, immediately enter jamaat countdown mode
        const now = dayjs();
        
        // Parse prayer time using dayjs
        let prayerDayjs = dayjs().hour(0).minute(0).second(0).millisecond(0);
        
        // Safety check for valid time format 
        const [prayerHours, prayerMinutes] = prayerTime.split(':').map(Number);
        
        if (isNaN(prayerHours) || isNaN(prayerMinutes)) {
          logger.error(`[PrayerCountdown] Invalid prayer time format for ${prayerName}: ${prayerTime}`);
          // Provide fallback values to avoid crashing
          setHours(0);
          setMinutes(30);
          setSeconds(0);
          return;
        }
        
        prayerDayjs = prayerDayjs.hour(prayerHours).minute(prayerMinutes);
        
        // Check if the prayer time has already passed
        if (now.isAfter(prayerDayjs) && jamaatTime) {
          // Parse jamaat time
          let jamaatDayjs = dayjs().hour(0).minute(0).second(0).millisecond(0);
          // Validate jamaat time format
          const jamaatTimeParts = jamaatTime.split(':');
          
          if (jamaatTimeParts.length !== 2) {
            logger.error(`[PrayerCountdown] Invalid jamaat time format for ${prayerName}: ${jamaatTime}`);
            return;
          }
          
          const jamaatHours = parseInt(jamaatTimeParts[0], 10);
          const jamaatMinutes = parseInt(jamaatTimeParts[1], 10);
          
          if (isNaN(jamaatHours) || isNaN(jamaatMinutes)) {
            logger.error(`[PrayerCountdown] Invalid jamaat time values for ${prayerName}: ${jamaatTime}`);
            return;
          }
          
          jamaatDayjs = jamaatDayjs.hour(jamaatHours).minute(jamaatMinutes);
          
          // If now is between prayer time and jamaat time, count down to jamaat
          if (now.isBefore(jamaatDayjs)) {
            setCountingDownToJamaat(true);
            logger.info(`[PrayerCountdown] Starting in jamaat countdown mode for ${prayerName}`);
          }
        }
      } catch (error) {
        logger.error('[PrayerCountdown] Error in initialization', { error, prayerName, prayerTime, jamaatTime });
        // Provide fallback values to avoid crashing
        setHours(0);
        setMinutes(20);
        setSeconds(0);
      } finally {
        // Mark initialization as complete either way
        initializingRef.current = false;
      }
    }
    
    const calculateRemainingTime = () => {
      try {
        // Create dayjs objects for easier date handling
        const now = dayjs();
        
        // Create prayer time for today
        let prayerDayjs = dayjs().hour(0).minute(0).second(0).millisecond(0);
        const [prayerHours, prayerMinutes] = prayerTime.split(':').map(Number);
        
        if (isNaN(prayerHours) || isNaN(prayerMinutes)) {
          logger.error(`[PrayerCountdown] Invalid prayer time parts for ${prayerName}: ${prayerTime}`);
          return;
        }
        
        prayerDayjs = prayerDayjs.hour(prayerHours).minute(prayerMinutes);
        
        // Initialize targetTime with prayer date as default
        let targetDayjs = prayerDayjs.clone();
        
        // IMPROVED LOGIC: Determine countdown target more accurately
        if (countingDownToJamaat && jamaatTime) {
          // Counting down to jamaat time
          try {
            const [jamaatHours, jamaatMinutes] = jamaatTime.split(':').map(Number);
            
            if (isNaN(jamaatHours) || isNaN(jamaatMinutes)) {
              logger.error(`[PrayerCountdown] Invalid jamaat time for ${prayerName}: ${jamaatTime}`);
              // Fall back to prayer time
              setCountingDownToJamaat(false);
              targetDayjs = prayerDayjs.clone();
              if (now.isAfter(targetDayjs)) {
                targetDayjs = targetDayjs.add(1, 'day');
              }
            } else {
              let jamaatDayjs = dayjs().hour(0).minute(0).second(0).millisecond(0);
              jamaatDayjs = jamaatDayjs.hour(jamaatHours).minute(jamaatMinutes);
              
              targetDayjs = jamaatDayjs.clone();
              
              // If jamaat time has passed, switch to next prayer
              if (now.isAfter(targetDayjs)) {
                logger.info(`[PrayerCountdown] Jamaat time passed for ${prayerName}, switching to next prayer`);
                if (onCountdownComplete) {
                  onCountdownComplete(true);
                }
                return;
              }
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error processing jamaat time';
            logger.error(`[PrayerCountdown] Error processing jamaat time: ${errorMessage}`, {
              prayerName,
              jamaatTime,
              countingDownToJamaat
            });
            
            // Fall back to prayer time countdown
            setCountingDownToJamaat(false);
            targetDayjs = prayerDayjs.clone();
            if (now.isAfter(targetDayjs)) {
              targetDayjs = targetDayjs.add(1, 'day');
            }
          }
        } else {
          // Counting down to prayer time (adhan)
          targetDayjs = prayerDayjs.clone();
          
          // If prayer time has already passed today
          if (now.isAfter(prayerDayjs)) {
            // Check if we should transition to jamaat time
            if (!prayerTimePassedRef.current && jamaatTime) {
              prayerTimePassedRef.current = true;
              logger.info(`[PrayerCountdown] Prayer time passed for ${prayerName}, checking jamaat countdown`);
              
              try {
                let jamaatDayjs = dayjs().hour(0).minute(0).second(0).millisecond(0);
                const [jamaatHours, jamaatMinutes] = jamaatTime.split(':').map(Number);
                
                if (isNaN(jamaatHours) || isNaN(jamaatMinutes)) {
                  logger.error(`[PrayerCountdown] Invalid jamaat time format for ${prayerName}: ${jamaatTime}`);
                  // Set target to tomorrow's prayer
                  targetDayjs = prayerDayjs.clone().add(1, 'day');
                } else {
                  jamaatDayjs = jamaatDayjs.hour(jamaatHours).minute(jamaatMinutes);
                  
                  // If jamaat time is still in the future, switch to counting down to jamaat
                  if (now.isBefore(jamaatDayjs)) {
                    // Smooth transition to jamaat countdown
                    setTextTransition(true);
                    setTimeout(() => {
                      setCountingDownToJamaat(true);
                      setTextTransition(false);
                      setDisplayTimes(true);
                      logger.info(`[PrayerCountdown] Transitioning from ${prayerName} adhan to jamaat countdown`);
                    }, 300); // Faster transition
                    
                    targetDayjs = jamaatDayjs.clone();
                  } else {
                    // Both prayer and jamaat times have passed - move to next prayer
                    jamaatTimePassedRef.current = true;
                    
                    // Trigger countdown completion for jamaat if it just passed
                    const jamaatJustPassed = Math.abs(now.diff(jamaatDayjs, 'millisecond')) <= 30000;
                    const timeSinceLoad = Date.now() - initialLoadTimestampRef.current;
                    if (jamaatJustPassed && displayTimes && timeSinceLoad > 5000) {
                      logger.info(`[CRITICAL] ${prayerName} jamaat time has just passed (${jamaatTime})`);
                      triggerCountdownComplete(true);
                      return;
                    }
                    
                    // Set future prayer time for tomorrow
                    targetDayjs = prayerDayjs.clone().add(1, 'day');
                  }
                }
              } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error in prayer-to-jamaat transition';
                logger.error(`[PrayerCountdown] Error handling prayer-to-jamaat transition: ${errorMessage}`, {
                  prayerName,
                  prayerTime,
                  jamaatTime
                });
                // Default to tomorrow's prayer time on error
                targetDayjs = prayerDayjs.clone().add(1, 'day');
              }
            } else {
              // Set target to tomorrow if no jamaat time or already processed
              targetDayjs = prayerDayjs.clone().add(1, 'day');
            }
          }
        }
        
        // Calculate time difference - ensure we never show negative values
        const diffMs = Math.max(0, targetDayjs.diff(now, 'millisecond'));
        const totalSeconds = Math.floor(diffMs / 1000);
        
        // Update state with new countdown values
        const newHours = Math.floor(totalSeconds / 3600);
        const newMinutes = Math.floor((totalSeconds % 3600) / 60);
        const newSeconds = totalSeconds % 60;
        
        setHours(newHours);
        setMinutes(newMinutes);
        setSeconds(newSeconds);
        
        // Debug log every minute or when any value changes significantly
        if (newSeconds === 0 || Math.abs(newHours - hours) > 0 || Math.abs(newMinutes - minutes) > 0) {
          logger.debug(`[PrayerCountdown] ${prayerName} countdown: ${formatRemainingTimeLog(newHours, newMinutes, newSeconds)}`, {
            prayerName,
            prayerTime,
            jamaatTime,
            countingDownToJamaat,
            targetTime: targetDayjs.format('YYYY-MM-DD HH:mm:ss')
          });
        }
        
        // Check if countdown has reached zero
        if (totalSeconds === 0 && displayTimes) {
          // Only trigger events if not during initial page load
          const timeSinceLoad = Date.now() - initialLoadTimestampRef.current;
          if (timeSinceLoad > 5000) {
            if (countingDownToJamaat) {
              logger.info(`[CRITICAL] ${prayerName} jamaat time has arrived`);
              triggerCountdownComplete(true);
            } else {
              logger.info(`[CRITICAL] ${prayerName} time has arrived`);
              
              // If there's a jamaat time, we need to transition to jamaat countdown
              if (jamaatTime) {
                const now = dayjs();
                let jamaatDayjs = dayjs().hour(0).minute(0).second(0).millisecond(0);
                const [jamaatHours, jamaatMinutes] = jamaatTime.split(':').map(Number);
                
                if (!isNaN(jamaatHours) && !isNaN(jamaatMinutes)) {
                  jamaatDayjs = jamaatDayjs.hour(jamaatHours).minute(jamaatMinutes);
                  
                  // If jamaat time is still in the future
                  if (now.isBefore(jamaatDayjs)) {
                    // Trigger the prayer time completion but don't hide the countdown
                    triggerCountdownComplete(false);
                    
                    // Transition to jamaat countdown after a short delay
                    setTimeout(() => {
                      setTextTransition(true);
                      
                      // Change to jamaat countdown after the transition effect
                      setTimeout(() => {
                        setCountingDownToJamaat(true);
                        setTextTransition(false);
                        logger.info(`[PrayerCountdown] Transitioning from ${prayerName} adhan to jamaat countdown`);
                      }, 300); // Faster transition
                    }, 1000); // Shorter wait
                  } else {
                    // If jamaat time has already passed
                    triggerCountdownComplete(false);
                  }
                } else {
                  // Invalid jamaat time format
                  triggerCountdownComplete(false);
                }
              } else {
                // No jamaat time
                triggerCountdownComplete(false);
              }
            }
          }
        }
      } catch (error) {
        logger.error('[PrayerCountdown] Error calculating remaining time', { error });
      }
    };
    
    // Calculate time immediately
    calculateRemainingTime();
    
    // Clear any existing interval before setting a new one
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Set up interval for countdown
    intervalRef.current = setInterval(calculateRemainingTime, 1000);
    
    // Clean up interval on component unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [prayerTime, jamaatTime, prayerName, onCountdownComplete, displayTimes, countingDownToJamaat, hours, minutes, seconds]);
  
  // Format time for display
  const formatTimeDisplay = (value: number) => {
    return value.toString().padStart(2, '0');
  };

  const triggerCountdownComplete = useCallback((isForJamaat: boolean) => {
    logger.info('[PrayerCountdown] Triggering countdown complete', {
      prayerName,
      jamaatTime,
      isForJamaat,
      currentTime: new Date().toISOString()
    });
    
    // Display zeros briefly
    setHours(0);
    setMinutes(0);
    setSeconds(0);
    
    // Execute the callback immediately to ensure it runs
    if (onCountdownComplete) {
      try {
        // Always use a timeout to ensure this runs outside current execution stack
        setTimeout(() => {
          if (onCountdownComplete) {
            logger.info('[PrayerCountdown] Calling onCountdownComplete callback', { 
              isForJamaat,
              prayerName
            });
            onCountdownComplete(isForJamaat);
          }
        }, 0);
      } catch (error) {
        logger.error('[PrayerCountdown] Error in countdown complete callback', { error });
      }
    }
    
    // Then update display state after a brief delay
    // If this is for adhan and we have jamaat time, don't update display state
    // as we'll be transitioning to jamaat countdown
    if (isForJamaat || !jamaatTime) {
      setTimeout(() => {
        setDisplayTimes(false);
      }, 1000);  // Show zeros for 1 second
    }
  }, [prayerName, jamaatTime, onCountdownComplete]);

  // Format remaining time for console display
  const formatRemainingTimeLog = (h: number, m: number, s: number): string => {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!displayTimes) {
    return (
      <Typography sx={{ 
        fontWeight: 'bold',
        fontSize: fontSizes.h3,
        textAlign: 'center',
        color: '#F1C40F',
        my: getSizeRem(1.5),
        // REMOVED: Jarring animation that causes issues on RPi
        // animation: 'pulseScale 3s infinite ease-in-out',
      }}>
        {countingDownToJamaat ? `It's ${prayerName} Jamaa't time!` : `It's ${prayerName} time!`}
      </Typography>
    );
  }

  return (
    <Fade in={displayTimes} timeout={300}> {/* Faster transition */}
      <Box sx={{ 
        mt: 0,
        mb: getSizeRem(0.3),
        opacity: textTransition ? 0.7 : 1, // Less dramatic opacity change
        transition: 'opacity 0.3s ease', // Faster, smoother transition
      }}>
        <Typography sx={{ 
          fontSize: isPortrait 
            ? (screenSize.is720p ? fontSizes.h5 : fontSizes.h6) 
            : fontSizes.body1,
          fontWeight: 600,
          textAlign: 'center',
          opacity: 0.9,
          fontFamily: "'Poppins', sans-serif",
          mb: isPortrait ? getSizeRem(0.4) : getSizeRem(0.3),
          color: '#fff',
          letterSpacing: '0.5px',
        }}>
          {countingDownToJamaat 
            ? `${prayerName} Jamaa't will be in` 
            : `${prayerName} will be in`}
        </Typography>

        <Box sx={{ 
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: isPortrait ? getSizeRem(0.1) : getSizeRem(0.1),
        }}>
          {/* Hours */}
          <Box sx={{ 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: isPortrait ? getSizeRem(4) : getSizeRem(3),
          }}>
            <Typography sx={{ 
              fontSize: isPortrait 
                ? (screenSize.is720p ? fontSizes.h2 : fontSizes.h3) 
                : fontSizes.h3,
              fontWeight: 'bold',
              lineHeight: 1,
              fontFamily: "'Poppins', sans-serif",
              color: '#F1C40F',
              letterSpacing: '0px',
              textShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
            }}>
              {formatTimeDisplay(hours)}
            </Typography>
            <Typography sx={{ 
              fontSize: isPortrait 
                ? (screenSize.is720p ? fontSizes.body1 : fontSizes.body2) 
                : fontSizes.caption,
              fontWeight: 'bold',
              textTransform: 'uppercase',
              opacity: 0.9,
              mt: isPortrait ? getSizeRem(-0.2) : getSizeRem(-0.1),
              color: 'rgba(255, 255, 255, 0.9)',
              letterSpacing: '0.5px',
            }}>
              HOURS
            </Typography>
          </Box>
          
          {/* Separator */}
          <Typography sx={{ 
            fontSize: isPortrait 
              ? (screenSize.is720p ? fontSizes.h2 : fontSizes.h3) 
              : fontSizes.h3,
            fontWeight: 'bold', 
            lineHeight: 1,
            fontFamily: "'Poppins', sans-serif",
            color: '#F1C40F',
            alignSelf: 'flex-start',
            mt: getSizeRem(0),
            opacity: 0.9,
            mx: isPortrait ? getSizeRem(0.2) : getSizeRem(0.1),
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          }}>:</Typography>
          
          {/* Minutes */}
          <Box sx={{ 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: isPortrait ? getSizeRem(4) : getSizeRem(3),
          }}>
            <Typography sx={{ 
              fontSize: isPortrait 
                ? (screenSize.is720p ? fontSizes.h2 : fontSizes.h3) 
                : fontSizes.h3,
              fontWeight: 'bold',
              lineHeight: 1,
              fontFamily: "'Poppins', sans-serif",
              color: '#F1C40F',
              letterSpacing: '0px',
              textShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
            }}>
              {formatTimeDisplay(minutes)}
            </Typography>
            <Typography sx={{ 
              fontSize: isPortrait 
                ? (screenSize.is720p ? fontSizes.body1 : fontSizes.body2) 
                : fontSizes.caption,
              fontWeight: 'bold',
              textTransform: 'uppercase',
              opacity: 0.9,
              mt: isPortrait ? getSizeRem(-0.2) : getSizeRem(-0.1),
              color: 'rgba(255, 255, 255, 0.9)',
              letterSpacing: '0.5px',
            }}>
              MINUTES
            </Typography>
          </Box>
          
          {/* Separator */}
          <Typography sx={{ 
            fontSize: isPortrait 
              ? (screenSize.is720p ? fontSizes.h2 : fontSizes.h3) 
              : fontSizes.h3,
            fontWeight: 'bold', 
            lineHeight: 1,
            fontFamily: "'Poppins', sans-serif",
            color: '#F1C40F',
            alignSelf: 'flex-start',
            mt: getSizeRem(0),
            opacity: 0.9,
            mx: isPortrait ? getSizeRem(0.2) : getSizeRem(0.1),
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          }}>:</Typography>
          
          {/* Seconds */}
          <Box sx={{ 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: isPortrait ? getSizeRem(4) : getSizeRem(3),
          }}>
            <Typography sx={{ 
              fontSize: isPortrait 
                ? (screenSize.is720p ? fontSizes.h2 : fontSizes.h3) 
                : fontSizes.h3,
              fontWeight: 'bold',
              lineHeight: 1,
              fontFamily: "'Poppins', sans-serif",
              color: '#F1C40F',
              letterSpacing: '0px',
              textShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
            }}>
              {formatTimeDisplay(seconds)}
            </Typography>
            <Typography sx={{ 
              fontSize: isPortrait 
                ? (screenSize.is720p ? fontSizes.body1 : fontSizes.body2) 
                : fontSizes.caption,
              fontWeight: 'bold',
              textTransform: 'uppercase',
              opacity: 0.9,
              mt: isPortrait ? getSizeRem(-0.2) : getSizeRem(-0.1),
              color: 'rgba(255, 255, 255, 0.9)',
              letterSpacing: '0.5px',
            }}>
              SECONDS
            </Typography>
          </Box>
        </Box>
        
        <Typography sx={{ 
          fontSize: isPortrait 
            ? (screenSize.is720p ? fontSizes.body1 : fontSizes.body2) 
            : fontSizes.caption,
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.8)',
          mt: isPortrait ? getSizeRem(0.4) : getSizeRem(0.3),
          fontStyle: 'italic',
          fontWeight: 500,
          letterSpacing: '0.3px',
        }}>
          {countingDownToJamaat ? 'Jamaa\'t' : 'Adhan'} Time
        </Typography>
      </Box>
    </Fade>
  );
};

export default PrayerCountdown; 
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Fade } from '@mui/material';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';
import { parseTimeString } from '../../utils/dateUtils';
import logger from '../../utils/logger';
import moment from 'moment';

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
        const now = moment();
        
        // Parse prayer time using moment
        const prayerMoment = moment().hours(0).minutes(0).seconds(0);
        
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
        
        prayerMoment.hours(prayerHours).minutes(prayerMinutes);
        
        // Check if the prayer time has already passed
        if (now.isAfter(prayerMoment) && jamaatTime) {
          // Parse jamaat time
          const jamaatMoment = moment().hours(0).minutes(0).seconds(0);
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
          
          jamaatMoment.hours(jamaatHours).minutes(jamaatMinutes);
          
          // If now is between prayer time and jamaat time, count down to jamaat
          if (now.isBefore(jamaatMoment)) {
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
        // Create moment objects for easier date handling
        const now = moment();
        
        // Create prayer time for today
        const prayerMoment = moment().hours(0).minutes(0).seconds(0);
        const [prayerHours, prayerMinutes] = prayerTime.split(':').map(Number);
        
        if (isNaN(prayerHours) || isNaN(prayerMinutes)) {
          logger.error(`[PrayerCountdown] Invalid prayer time parts for ${prayerName}: ${prayerTime}`);
          return;
        }
        
        prayerMoment.hours(prayerHours).minutes(prayerMinutes);
        
        // Initialize targetTime with prayer date as default
        let targetMoment = prayerMoment.clone();
        
        // If already counting down to jamaat, continue with jamaat countdown
        if (countingDownToJamaat && jamaatTime) {
          // Don't lose current focus for error logging
          try {
            const [jamaatHours, jamaatMinutes] = jamaatTime.split(':').map(Number);
            
            if (isNaN(jamaatHours) || isNaN(jamaatMinutes)) {
              logger.error(`[PrayerCountdown] Invalid jamaat time for ${prayerName}: ${jamaatTime}`);
              return;
            }
            
            const jamaatMoment = moment().hours(0).minutes(0).seconds(0);
            jamaatMoment.hours(jamaatHours).minutes(jamaatMinutes);
            
            // Use jamaat time as the target
            targetMoment = jamaatMoment.clone();
            
            // If jamaat time has passed, switch to next day's prayer time
            if (now.isAfter(targetMoment)) {
              logger.debug(`[PrayerCountdown] Jamaat time passed for ${prayerName}, using tomorrow's prayer time`);
              targetMoment.add(1, 'day');
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error 
              ? error.message 
              : 'Unknown error processing jamaat time';
              
            logger.error(`[PrayerCountdown] Error processing jamaat time: ${errorMessage}`, {
              prayerName,
              jamaatTime,
              countingDownToJamaat
            });
            
            // Since we can't modify countingDownToJamaat directly, we'll set it
            // on the next render cycle using a state update
            setCountingDownToJamaat(false);
            
            // Use prayer time as fallback
            targetMoment = prayerMoment.clone();
            if (now.isAfter(targetMoment)) {
              targetMoment.add(1, 'day');
            }
          }
        } else { // Counting down to prayer time (adhan)
          // If prayer time has already passed today
          if (now.isAfter(prayerMoment)) {
            // Check if we should transition to jamaat time, but only if we haven't already
            if (!prayerTimePassedRef.current && jamaatTime) {
              prayerTimePassedRef.current = true;
              logger.info(`[PrayerCountdown] Prayer time passed for ${prayerName}, checking jamaat countdown`);
              
              try {
                const jamaatMoment = moment().hours(0).minutes(0).seconds(0);
                const [jamaatHours, jamaatMinutes] = jamaatTime.split(':').map(Number);
                
                if (isNaN(jamaatHours) || isNaN(jamaatMinutes)) {
                  logger.error(`[PrayerCountdown] Invalid jamaat time format for ${prayerName}: ${jamaatTime}`);
                  // Set target to tomorrow's prayer
                  targetMoment = prayerMoment.clone().add(1, 'day');
                } else {
                  jamaatMoment.hours(jamaatHours).minutes(jamaatMinutes);
                  
                  // If jamaat time is still in the future, switch to counting down to jamaat
                  if (now.isBefore(jamaatMoment)) {
                    // Trigger transition animation with a slight delay
                    setTextTransition(true);
                    setTimeout(() => {
                      setCountingDownToJamaat(true);
                      setTextTransition(false);
                      setDisplayTimes(true); // Ensure display is on for jamaat countdown
                      logger.info(`[PrayerCountdown] Transitioning from ${prayerName} adhan to jamaat countdown`);
                    }, 500); // Match fade out duration
                    
                    targetMoment = jamaatMoment.clone();
                  } else {
                    // Both prayer and jamaat times have passed
                    jamaatTimePassedRef.current = true;
                    
                    // Trigger countdown completion for jamaat if it just passed - not during initial load
                    const jamaatJustPassed = Math.abs(now.diff(jamaatMoment, 'milliseconds')) <= 30000;
                    const timeSinceLoad = Date.now() - initialLoadTimestampRef.current;
                    if (jamaatJustPassed && displayTimes && timeSinceLoad > 5000) {
                      logger.info(`[CRITICAL] ${prayerName} jamaat time has just passed (${jamaatTime})`);
                      triggerCountdownComplete(true);
                      return; // Stop execution
                    }
                    
                    // Set future prayer time for tomorrow
                    targetMoment = prayerMoment.clone().add(1, 'day');
                  }
                }
              } catch (error: unknown) {
                const errorMessage = error instanceof Error 
                  ? error.message 
                  : 'Unknown error in prayer-to-jamaat transition';
                  
                logger.error(`[PrayerCountdown] Error handling prayer-to-jamaat transition: ${errorMessage}`, {
                  prayerName,
                  prayerTime,
                  jamaatTime
                });
                // Default to tomorrow's prayer time on error
                targetMoment = prayerMoment.clone().add(1, 'day');
              }
            } else {
              // Set target to tomorrow if:
              // - There's no jamaat time, OR
              // - We've already processed the prayer-to-jamaat transition
              targetMoment = prayerMoment.clone().add(1, 'day');
            }
          }
        }
        
        // Calculate time difference - ensure we never show negative values
        const diffMs = Math.max(0, targetMoment.diff(now, 'milliseconds'));
        const totalSeconds = Math.floor(diffMs / 1000);
        
        // Update state with new countdown values
        const newHours = Math.floor(totalSeconds / 3600);
        const newMinutes = Math.floor((totalSeconds % 3600) / 60);
        const newSeconds = totalSeconds % 60;
        
        setHours(newHours);
        setMinutes(newMinutes);
        setSeconds(newSeconds);
        
        // Debug log every minute or when any value changes
        if (newSeconds === 0 || newHours !== hours || newMinutes !== minutes || newSeconds !== seconds) {
          logger.debug(`[PrayerCountdown] ${prayerName} countdown: ${formatRemainingTimeLog(newHours, newMinutes, newSeconds)}`, {
            prayerName,
            prayerTime,
            jamaatTime,
            countingDownToJamaat,
            targetTime: targetMoment.format('YYYY-MM-DD HH:mm:ss')
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
                // Create moment object for jamaat time
                const jamaatMoment = moment().hours(0).minutes(0).seconds(0);
                const [jamaatHours, jamaatMinutes] = jamaatTime.split(':').map(Number);
                
                if (!isNaN(jamaatHours) && !isNaN(jamaatMinutes)) {
                  jamaatMoment.hours(jamaatHours).minutes(jamaatMinutes);
                  
                  // If jamaat time is still in the future
                  if (now.isBefore(jamaatMoment)) {
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
                      }, 500); // Duration for the fade transition
                    }, 2000); // Wait a bit before transitioning
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
    
    // Set up interval for countdown
    const intervalId = setInterval(calculateRemainingTime, 1000);
    
    // Clean up interval on component unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [prayerTime, jamaatTime, prayerName, onCountdownComplete, displayTimes, countingDownToJamaat, hours, minutes, seconds]);
  
  // Format time for display
  const formatTimeDisplay = (value: number) => {
    return value.toString().padStart(2, '0');
  };

  const triggerCountdownComplete = (isForJamaat: boolean) => {
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
  };

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
        animation: 'pulseScale 3s infinite ease-in-out',
      }}>
        {countingDownToJamaat ? `It's ${prayerName} Jamaa't time!` : `It's ${prayerName} time!`}
      </Typography>
    );
  }

  return (
    <Fade in={displayTimes} timeout={500}>
      <Box sx={{ 
        mt: 0,
        mb: getSizeRem(0.3),
        opacity: textTransition ? 0.3 : 1,
        transition: 'opacity 0.5s ease',
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
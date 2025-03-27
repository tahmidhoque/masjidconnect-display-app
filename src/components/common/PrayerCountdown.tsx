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
        }
        
        // EDGE CASE: Check if we're starting between prayer time and jamaat time
        // If so, immediately enter jamaat countdown mode
        const now = moment();
        
        // Parse prayer time using moment
        const prayerMoment = moment().hours(0).minutes(0).seconds(0);
        const [prayerHours, prayerMinutes] = prayerTime.split(':').map(Number);
        
        if (!isNaN(prayerHours) && !isNaN(prayerMinutes)) {
          prayerMoment.hours(prayerHours).minutes(prayerMinutes);
          
          // If prayer time has passed but jamaat hasn't
          if (now.isAfter(prayerMoment) && jamaatTime) {
            const jamaatMoment = moment().hours(0).minutes(0).seconds(0);
            const [jamaatHours, jamaatMinutes] = jamaatTime.split(':').map(Number);
            
            if (!isNaN(jamaatHours) && !isNaN(jamaatMinutes)) {
              jamaatMoment.hours(jamaatHours).minutes(jamaatMinutes);
              
              // Handle after midnight special case
              if (now.hours() < 6 && prayerName === 'Isha') {
                if (jamaatMoment.isAfter(prayerMoment)) {
                  jamaatMoment.subtract(1, 'day');
                }
              }
              
              if (now.isBefore(jamaatMoment)) {
                logger.info(`[PrayerCountdown] Starting between ${prayerName} time and jamaat time, entering jamaat countdown mode`);
                setCountingDownToJamaat(true);
                prayerTimePassedRef.current = true;
              }
            }
          }
        }
        
        initializingRef.current = false;
      } catch (error) {
        logger.error('[PrayerCountdown] Error parsing initial time', { error });
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
          return;
        }
        
        prayerMoment.hours(prayerHours).minutes(prayerMinutes);
        
        // Initialize targetTime with prayer date as default
        let targetMoment = prayerMoment.clone();
        
        // If already counting down to jamaat, continue with jamaat countdown
        if (countingDownToJamaat && jamaatTime) {
          const [jamaatHours, jamaatMinutes] = jamaatTime.split(':').map(Number);
          if (!isNaN(jamaatHours) && !isNaN(jamaatMinutes)) {
            const jamaatMoment = moment().hours(0).minutes(0).seconds(0)
              .hours(jamaatHours).minutes(jamaatMinutes);
            
            // Special handling for after midnight
            const isAfterMidnightBeforeFajr = now.hours() < 6 && prayerName === 'Isha';
            if (isAfterMidnightBeforeFajr) {
              // Handle Isha jamaat that's after midnight
              if (jamaatMoment.hours() < 6) {
                // If jamaatTime is small hours (like 01:30), it's meant for today not tomorrow
                // No adjustment needed
              } else {
                // If jamaatTime is in the evening (like 20:30), we've crossed to new day
                jamaatMoment.subtract(1, 'day');
              }
              
              // If jamaat is in the past, mark as passed
              if (now.isAfter(jamaatMoment) && !jamaatTimePassedRef.current) {
                jamaatTimePassedRef.current = true;
                logger.info(`[CRITICAL] After midnight: ${prayerName} jamaat time has passed (${jamaatTime})`);
                
                // Only trigger events if not during initial page load
                const timeSinceLoad = Date.now() - initialLoadTimestampRef.current;
                if (displayTimes && timeSinceLoad > 5000) {
                  triggerCountdownComplete(true);
                  return;
                }
              }
            } else {
              // Regular jamaat time check for non-midnight scenario
              if (now.isAfter(jamaatMoment) && !jamaatTimePassedRef.current) {
                jamaatTimePassedRef.current = true;
                
                // Trigger callback only once and not during initial load
                const timeSinceLoad = Date.now() - initialLoadTimestampRef.current;
                if (displayTimes && timeSinceLoad > 5000) {
                  logger.info(`[CRITICAL] ${prayerName} jamaat time has just arrived (${jamaatTime})`);
                  triggerCountdownComplete(true);
                  return;
                }
              }
            }
            
            targetMoment = jamaatMoment.clone();
            
            // If target is in the past, set it for tomorrow
            if (now.isAfter(targetMoment)) {
              targetMoment.add(1, 'day');
            }
          }
        }
        // Not counting down to jamaat yet, handle prayer/jamaat transitions
        else {
          // Check if prayer time has already passed today
          const prayerHasPassed = now.isAfter(prayerMoment);
          
          // Special handling for Isha after midnight when Fajr is next
          const isAfterMidnightBeforeFajr = now.hours() < 6 && prayerName === 'Isha';
          
          if (isAfterMidnightBeforeFajr) {
            prayerTimePassedRef.current = true;
            
            // If this is Isha after midnight and Isha jamaat has passed
            if (jamaatTime) {
              const jamaatMoment = moment().hours(0).minutes(0).seconds(0);
              const [jamaatHours, jamaatMinutes] = jamaatTime.split(':').map(Number);
              
              if (!isNaN(jamaatHours) && !isNaN(jamaatMinutes)) {
                jamaatMoment.hours(jamaatHours).minutes(jamaatMinutes);
                
                // Adjust jamaat time for after midnight scenario
                if (jamaatMoment.hours() >= 18) { // If jamaat is PM time
                  jamaatMoment.subtract(1, 'day'); // It was from yesterday
                }
                
                // If we're after jamaat, mark it as passed if we haven't already
                if (now.isAfter(jamaatMoment) && !jamaatTimePassedRef.current) {
                  jamaatTimePassedRef.current = true;
                  logger.info(`[CRITICAL] After midnight: ${prayerName} jamaat time has passed (${jamaatTime})`);
                  
                  // Only trigger events if not during initial page load
                  const timeSinceLoad = Date.now() - initialLoadTimestampRef.current;
                  if (displayTimes && timeSinceLoad > 5000) {
                    triggerCountdownComplete(true);
                    return;
                  }
                }
              }
            }
            
            // Set up for tomorrow's prayer
            targetMoment = prayerMoment.clone().add(1, 'day');
          }
          // Regular flow for regular times
          else if (prayerHasPassed && !prayerTimePassedRef.current) {
            // Prayer time has just passed
            prayerTimePassedRef.current = true;
            
            // Trigger completion callback for prayer time - but not during initial page load
            const timeSinceLoad = Date.now() - initialLoadTimestampRef.current;
            if (displayTimes && timeSinceLoad > 5000) {
              logger.info(`[CRITICAL] ${prayerName} time has just arrived (${prayerTime})`);
              triggerCountdownComplete(false);
              
              // If there's no jamaat time, return after triggering completion
              if (!jamaatTime) {
                return;
              }
            }
            
            // If we have a jamaatTime and we're not already counting down to it
            if (jamaatTime) {
              const jamaatMoment = moment().hours(0).minutes(0).seconds(0);
              const [jamaatHours, jamaatMinutes] = jamaatTime.split(':').map(Number);
              
              if (!isNaN(jamaatHours) && !isNaN(jamaatMinutes)) {
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
            } else {
              // Set future prayer time for tomorrow if no jamaat time
              targetMoment = prayerMoment.clone().add(1, 'day');
            }
          } else if (prayerTimePassedRef.current && !jamaatTimePassedRef.current && !countingDownToJamaat && jamaatTime) {
            // Late transition to jamaat countdown if needed
            const jamaatMoment = moment().hours(0).minutes(0).seconds(0);
            const [jamaatHours, jamaatMinutes] = jamaatTime.split(':').map(Number);
            
            if (!isNaN(jamaatHours) && !isNaN(jamaatMinutes)) {
              jamaatMoment.hours(jamaatHours).minutes(jamaatMinutes);
              
              if (now.isBefore(jamaatMoment)) {
                // Explicitly transition to jamaat countdown
                setTextTransition(true);
                setTimeout(() => {
                  setCountingDownToJamaat(true);
                  setTextTransition(false);
                  logger.info(`[PrayerCountdown] Late transition to ${prayerName} jamaat countdown`);
                }, 500);
                
                targetMoment = jamaatMoment.clone();
              } else {
                // Jamaat time has passed, prepare for tomorrow
                targetMoment = prayerMoment.clone().add(1, 'day');
              }
            }
          } else if (!prayerHasPassed) {
            // Simple case: prayer time is still in the future
            targetMoment = prayerMoment.clone();
          } else {
            // Default: set to tomorrow's prayer time
            targetMoment = prayerMoment.clone().add(1, 'day');
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
          fontSize: fontSizes.body1,
          fontWeight: 500,
          textAlign: 'center',
          opacity: 0.9,
          fontFamily: "'Poppins', sans-serif",
          mb: getSizeRem(0.3),
          color: '#fff',
        }}>
          {countingDownToJamaat 
            ? `${prayerName} Jamaa't will be in` 
            : `${prayerName} will be in`}
        </Typography>

        <Box sx={{ 
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: getSizeRem(0.1),
        }}>
          {/* Hours */}
          <Box sx={{ 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: getSizeRem(3),
          }}>
            <Typography sx={{ 
              fontSize: fontSizes.h3,
              fontWeight: 'bold',
              lineHeight: 1,
              fontFamily: "'Poppins', sans-serif",
              color: '#F1C40F',
              letterSpacing: '0px',
              textShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
            }}>
              {formatTimeDisplay(hours)}
            </Typography>
            <Typography sx={{ 
              fontSize: fontSizes.caption,
              fontWeight: 'bold',
              textTransform: 'uppercase',
              opacity: 0.9,
              mt: getSizeRem(-0.1),
              color: 'rgba(255, 255, 255, 0.8)',
              letterSpacing: '0.3px',
            }}>
              HOURS
            </Typography>
          </Box>
          
          {/* Separator */}
          <Typography sx={{ 
            fontSize: fontSizes.h3,
            fontWeight: 'bold', 
            lineHeight: 1,
            fontFamily: "'Poppins', sans-serif",
            color: '#F1C40F',
            alignSelf: 'flex-start',
            mt: getSizeRem(0),
            opacity: 0.9,
            mx: getSizeRem(0.1),
          }}>:</Typography>
          
          {/* Minutes */}
          <Box sx={{ 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: getSizeRem(3),
          }}>
            <Typography sx={{ 
              fontSize: fontSizes.h3,
              fontWeight: 'bold',
              lineHeight: 1,
              fontFamily: "'Poppins', sans-serif",
              color: '#F1C40F',
              letterSpacing: '0px',
              textShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
            }}>
              {formatTimeDisplay(minutes)}
            </Typography>
            <Typography sx={{ 
              fontSize: fontSizes.caption,
              fontWeight: 'bold',
              textTransform: 'uppercase',
              opacity: 0.9,
              mt: getSizeRem(-0.1),
              color: 'rgba(255, 255, 255, 0.8)',
              letterSpacing: '0.3px',
            }}>
              MINUTES
            </Typography>
          </Box>
          
          {/* Separator */}
          <Typography sx={{ 
            fontSize: fontSizes.h3,
            fontWeight: 'bold', 
            lineHeight: 1,
            fontFamily: "'Poppins', sans-serif",
            color: '#F1C40F',
            alignSelf: 'flex-start',
            mt: getSizeRem(0),
            opacity: 0.9,
            mx: getSizeRem(0.1),
          }}>:</Typography>
          
          {/* Seconds */}
          <Box sx={{ 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: getSizeRem(3),
          }}>
            <Typography sx={{ 
              fontSize: fontSizes.h3,
              fontWeight: 'bold',
              lineHeight: 1,
              fontFamily: "'Poppins', sans-serif",
              color: '#F1C40F',
              letterSpacing: '0px',
              textShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
            }}>
              {formatTimeDisplay(seconds)}
            </Typography>
            <Typography sx={{ 
              fontSize: fontSizes.caption,
              fontWeight: 'bold',
              textTransform: 'uppercase',
              opacity: 0.9,
              mt: getSizeRem(-0.1),
              color: 'rgba(255, 255, 255, 0.8)',
              letterSpacing: '0.3px',
            }}>
              SECONDS
            </Typography>
          </Box>
        </Box>
        
        <Typography sx={{ 
          fontSize: fontSizes.caption,
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.7)',
          mt: getSizeRem(0.3),
          fontStyle: 'italic',
          fontWeight: 500,
        }}>
          {countingDownToJamaat ? 'Jamaa\'t' : 'Adhan'} Time
        </Typography>
      </Box>
    </Fade>
  );
};

export default PrayerCountdown; 
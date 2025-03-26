import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Fade } from '@mui/material';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';
import { parseTimeString } from '../../utils/dateUtils';
import logger from '../../utils/logger';

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
  const { fontSizes, layout, getSizeRem } = useResponsiveFontSize();
  const initializingRef = useRef<boolean>(true);
  const prayerTimePassedRef = useRef<boolean>(false);
  const jamaatTimePassedRef = useRef<boolean>(false);
  
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
        const now = new Date();
        const [timeHoursStr, timeMinutesStr] = prayerTime.split(':');
        
        if (timeHoursStr && timeMinutesStr && jamaatTime) {
          const timeHours = parseInt(timeHoursStr, 10);
          const timeMinutes = parseInt(timeMinutesStr, 10);
          
          const prayerDate = new Date();
          prayerDate.setHours(timeHours, timeMinutes, 0, 0);
          
          const [jamaatHoursStr, jamaatMinutesStr] = jamaatTime.split(':');
          if (jamaatHoursStr && jamaatMinutesStr) {
            const jamaatHours = parseInt(jamaatHoursStr, 10);
            const jamaatMinutes = parseInt(jamaatMinutesStr, 10);
            
            const jamaatDate = new Date();
            jamaatDate.setHours(jamaatHours, jamaatMinutes, 0, 0);
            
            // We're between prayer time and jamaat time, switch to jamaat countdown
            if (now > prayerDate && now < jamaatDate) {
              prayerTimePassedRef.current = true;
              setCountingDownToJamaat(true);
              logger.info(`[CRITICAL] Starting countdown between ${prayerName} adhan (${prayerTime}) and jamaat (${jamaatTime})`);
            }
          }
        }
      } catch (e) {
        console.error("Error parsing pre-calculated time", e);
      }
      
      initializingRef.current = false;
    }
    
    const calculateRemainingTime = () => {
      try {
        // Parse prayer time
        const [timeHoursStr, timeMinutesStr] = prayerTime.split(':');
        if (!timeHoursStr || !timeMinutesStr) {
          return;
        }
        
        const timeHours = parseInt(timeHoursStr, 10);
        const timeMinutes = parseInt(timeMinutesStr, 10);
        
        if (isNaN(timeHours) || isNaN(timeMinutes)) {
          return;
        }
        
        // Create date objects
        const now = new Date();
        
        // Create prayer time for today
        const prayerDate = new Date();
        prayerDate.setHours(timeHours, timeMinutes, 0, 0);
        
        // Initialize targetTime with prayer date as default
        let targetTime = prayerDate;
        
        // If already counting down to jamaat, continue with jamaat countdown
        if (countingDownToJamaat && jamaatTime) {
          const [jamaatHoursStr, jamaatMinutesStr] = jamaatTime.split(':');
          if (jamaatHoursStr && jamaatMinutesStr) {
            const jamaatHours = parseInt(jamaatHoursStr, 10);
            const jamaatMinutes = parseInt(jamaatMinutesStr, 10);
            
            if (!isNaN(jamaatHours) && !isNaN(jamaatMinutes)) {
              const jamaatDate = new Date();
              jamaatDate.setHours(jamaatHours, jamaatMinutes, 0, 0);
              
              // Handle after midnight case for Isha's Jamaat
              const isAfterMidnightBeforeFajr = now.getHours() < 6 && prayerName === 'Isha';
              if (isAfterMidnightBeforeFajr && now > jamaatDate) {
                jamaatTimePassedRef.current = true;
                
                if (displayTimes) {
                  logger.info(`[CRITICAL] After midnight: ${prayerName} jamaat time has passed`);
                  triggerCountdownComplete(true);
                  return;
                }
              }
              
              // If jamaat time has passed and we haven't completed the countdown
              if (now >= jamaatDate && !jamaatTimePassedRef.current) {
                jamaatTimePassedRef.current = true;
                
                // Trigger callback only once
                if (displayTimes) {
                  logger.info(`[CRITICAL] ${prayerName} jamaat time has just arrived (${jamaatTime})`);
                  triggerCountdownComplete(true);
                }
                return; // Don't continue processing
              }
              
              targetTime = jamaatDate;
            }
          }
        }
        // Not counting down to jamaat yet, handle prayer/jamaat transitions
        else {
          // Check if prayer time has already passed today
          const prayerHasPassed = now >= prayerDate;
          
          // Special handling for Isha after midnight when Fajr is next
          const isAfterMidnightBeforeFajr = now.getHours() < 6 && prayerName === 'Isha';
          
          if (isAfterMidnightBeforeFajr) {
            prayerTimePassedRef.current = true;
            
            // If this is Isha after midnight and Isha jamaat has passed
            if (jamaatTime) {
              const [jamaatHoursStr, jamaatMinutesStr] = jamaatTime.split(':');
              if (jamaatHoursStr && jamaatMinutesStr) {
                const jamaatHours = parseInt(jamaatHoursStr, 10);
                const jamaatMinutes = parseInt(jamaatMinutesStr, 10);
                
                const jamaatDate = new Date();
                jamaatDate.setHours(jamaatHours, jamaatMinutes, 0, 0);
                
                // If we're after jamaat, mark it as passed if we haven't already
                if (now > jamaatDate && !jamaatTimePassedRef.current) {
                  jamaatTimePassedRef.current = true;
                  logger.info(`[CRITICAL] After midnight: ${prayerName} jamaat time has passed (${jamaatTime})`);
                  if (displayTimes) {
                    triggerCountdownComplete(true);
                    return;
                  }
                }
              }
            }
            
            // Set up for tomorrow's prayer
            prayerDate.setDate(prayerDate.getDate() + 1);
            targetTime = prayerDate;
          }
          // Normal time passing check
          else if (prayerHasPassed) {
            // Only trigger the event if we're just now detecting that the prayer time has passed
            if (!prayerTimePassedRef.current) {
              // Set the flag first to prevent multiple triggers
              prayerTimePassedRef.current = true;
              
              // CRITICAL FIX: Make sure we log and trigger the adhan announcement
              logger.info(`[CRITICAL] ${prayerName} adhan time has just arrived (${prayerTime})`);
              
              // Trigger the event for prayer time immediately if we're at the exact time
              // or if we're within 30 seconds after the prayer time
              const justPassed = Math.abs(now.getTime() - prayerDate.getTime()) <= 30000;
              if (justPassed && displayTimes) {
                triggerCountdownComplete(false);
                return; // Stop execution to prevent further calculations
              }
            } else {
              // Prayer time already passed in a previous calculation
              prayerTimePassedRef.current = true;
            }
            
            // If we have a jamaatTime and we're not already counting down to it
            if (jamaatTime) {
              const [jamaatHoursStr, jamaatMinutesStr] = jamaatTime.split(':');
              if (jamaatHoursStr && jamaatMinutesStr) {
                const jamaatHours = parseInt(jamaatHoursStr, 10);
                const jamaatMinutes = parseInt(jamaatMinutesStr, 10);
                
                if (!isNaN(jamaatHours) && !isNaN(jamaatMinutes)) {
                  // Set up jamaat date
                  const jamaatDate = new Date();
                  jamaatDate.setHours(jamaatHours, jamaatMinutes, 0, 0);
                  
                  // If jamaat time is still in the future, switch to counting down to jamaat
                  if (now < jamaatDate) {
                    // Trigger transition animation
                    setTextTransition(true);
                    setTimeout(() => {
                      setCountingDownToJamaat(true);
                      setTextTransition(false);
                      logger.info(`[PrayerCountdown] Transitioning from ${prayerName} adhan to jamaat countdown`);
                    }, 500); // Match fade out duration
                    
                    targetTime = jamaatDate;
                  } else {
                    // Both prayer and jamaat times have passed
                    jamaatTimePassedRef.current = true;
                    
                    // Trigger countdown completion for jamaat if it just passed
                    const jamaatJustPassed = Math.abs(now.getTime() - jamaatDate.getTime()) <= 30000;
                    if (jamaatJustPassed && displayTimes) {
                      logger.info(`[CRITICAL] ${prayerName} jamaat time has just passed (${jamaatTime})`);
                      triggerCountdownComplete(true);
                      return; // Stop execution
                    }
                    
                    // Set future prayer time for tomorrow
                    prayerDate.setDate(prayerDate.getDate() + 1);
                    targetTime = prayerDate;
                  }
                }
              }
            } else if (!jamaatTimePassedRef.current) {
              // Set future prayer time for tomorrow if no jamaat time or jamaat already passed
              prayerDate.setDate(prayerDate.getDate() + 1);
              targetTime = prayerDate;
            }
          } else if (prayerTimePassedRef.current && !jamaatTimePassedRef.current && !countingDownToJamaat && jamaatTime) {
            // Late transition to jamaat countdown if needed
            const [jamaatHoursStr, jamaatMinutesStr] = jamaatTime.split(':');
            if (jamaatHoursStr && jamaatMinutesStr) {
              const jamaatHours = parseInt(jamaatHoursStr, 10);
              const jamaatMinutes = parseInt(jamaatMinutesStr, 10);
              
              if (!isNaN(jamaatHours) && !isNaN(jamaatMinutes)) {
                const jamaatDate = new Date();
                jamaatDate.setHours(jamaatHours, jamaatMinutes, 0, 0);
                
                if (now < jamaatDate) {
                  // Explicitly transition to jamaat countdown
                  setTextTransition(true);
                  setTimeout(() => {
                    setCountingDownToJamaat(true);
                    setTextTransition(false);
                    logger.info(`[PrayerCountdown] Late transition to ${prayerName} jamaat countdown`);
                  }, 500);
                  
                  targetTime = jamaatDate;
                }
              }
            }
          }
        }
        
        // Calculate time difference - ensure we never show negative values
        const diffMs = Math.max(0, targetTime.getTime() - now.getTime());
        
        // Check for exact zero moment
        if (diffMs === 0) {
          // If we haven't triggered for the prayer time yet and we're not counting to jamaat
          if (!prayerTimePassedRef.current && !countingDownToJamaat) {
            prayerTimePassedRef.current = true;
            logger.info(`[CRITICAL] ${prayerName} adhan countdown reached zero (${prayerTime})`);
            triggerCountdownComplete(false);
            return;
          }
          // If we're at jamaat time and haven't triggered for jamaat yet
          else if (countingDownToJamaat && !jamaatTimePassedRef.current) {
            jamaatTimePassedRef.current = true;
            logger.info(`[CRITICAL] ${prayerName} jamaat countdown reached zero (${jamaatTime})`);
            triggerCountdownComplete(true);
            return;
          }
        }
        
        // Calculate hours, minutes, seconds
        const diffSec = Math.floor(diffMs / 1000);
        const h = Math.floor(diffSec / 3600);
        const m = Math.floor((diffSec % 3600) / 60);
        const s = diffSec % 60;
        
        // Log detailed time information occasionally for debugging only
        if (diffSec % 60 === 0) { // Only log once per minute to reduce noise
          console.log(`Countdown for ${prayerName}: ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        }
        
        setHours(h);
        setMinutes(m);
        setSeconds(s);
        
        // Reset completion state if we have time remaining
        if (!displayTimes && diffMs > 0) {
          setDisplayTimes(true);
        }
      } catch (error) {
        console.error('Error calculating prayer countdown:', error);
      }
    };
    
    // Calculate initially
    calculateRemainingTime();
    
    // Update every second
    const timer = setInterval(calculateRemainingTime, 1000);
    
    return () => clearInterval(timer);
  }, [prayerTime, prayerName, jamaatTime, onCountdownComplete, timeUntilNextPrayer, displayTimes, countingDownToJamaat]);

  // Debug key handler
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    // Press 'D' key to trigger debug countdown completion
    if (event.key.toLowerCase() === 'd') {
      logger.info('[PrayerCountdown] Debug key pressed - triggering countdown completion');
      
      const isCurrentlyForJamaat = countingDownToJamaat;
      
      // Log detailed information for debugging
      logger.info('[PrayerCountdown] Debug key pressed with detailed state', {
        prayerName,
        jamaatTime,
        countingDownToJamaat: isCurrentlyForJamaat,
        showingDisplayTimes: displayTimes,
        prayerTimePassed: prayerTimePassedRef.current,
        jamaatTimePassed: jamaatTimePassedRef.current
      });
      
      triggerCountdownComplete(isCurrentlyForJamaat);
    }
  }, [prayerName, jamaatTime, countingDownToJamaat, displayTimes]);

  useEffect(() => {
    // Add debug key listener
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

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
    setTimeout(() => {
      setDisplayTimes(false);
    }, 1000);  // Show zeros for 1 second
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
        animation: 'pulseScale 1s infinite ease-in-out',
      }}>
        {countingDownToJamaat ? `It's ${prayerName} Jamaa't time!` : `It's ${prayerName} time!`}
      </Typography>
    );
  }

  return (
    <Box>
      <Fade in={!textTransition} timeout={500}>
        <Typography sx={{
          fontWeight: 'bold', 
          fontSize: fontSizes.caption,
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.9)',
          mb: getSizeRem(0.5)
        }}>
          {countingDownToJamaat 
            ? `${prayerName} Jamaa't will be in` 
            : `${prayerName} will be in`}
        </Typography>
      </Fade>
      
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center',
        gap: getSizeRem(0.2),
        alignItems: 'center',
        mt: getSizeRem(0.2),
        mb: getSizeRem(0.2),
      }}>
        {/* Hours */}
        <Box sx={{ 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: getSizeRem(4),
        }}>
          <Typography sx={{ 
            fontSize: fontSizes.countdownDigit,
            fontWeight: 'bold',
            lineHeight: 1,
            fontFamily: "'Poppins', sans-serif",
            color: '#F1C40F',
            letterSpacing: '0px',
            textShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
          }}>
            {hours.toString().padStart(2, '0')}
          </Typography>
          <Typography sx={{ 
            fontSize: fontSizes.countdownLabel,
            fontWeight: 'bold',
            textTransform: 'uppercase',
            opacity: 0.9,
            mt: getSizeRem(-0.2),
            color: 'rgba(255, 255, 255, 0.7)',
            letterSpacing: '0.3px',
          }}>
            HOURS
          </Typography>
        </Box>
        
        {/* Separator */}
        <Typography sx={{ 
          fontSize: fontSizes.countdownDigit,
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
          minWidth: getSizeRem(4),
        }}>
          <Typography sx={{ 
            fontSize: fontSizes.countdownDigit,
            fontWeight: 'bold',
            lineHeight: 1,
            fontFamily: "'Poppins', sans-serif",
            color: '#F1C40F',
            letterSpacing: '0px',
            textShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
          }}>
            {minutes.toString().padStart(2, '0')}
          </Typography>
          <Typography sx={{ 
            fontSize: fontSizes.countdownLabel,
            fontWeight: 'bold',
            textTransform: 'uppercase',
            opacity: 0.9,
            mt: getSizeRem(-0.2),
            color: 'rgba(255, 255, 255, 0.7)',
            letterSpacing: '0.3px',
          }}>
            MINUTES
          </Typography>
        </Box>
        
        {/* Separator */}
        <Typography sx={{ 
          fontSize: fontSizes.countdownDigit,
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
          minWidth: getSizeRem(4),
        }}>
          <Typography sx={{ 
            fontSize: fontSizes.countdownDigit,
            fontWeight: 'bold',
            lineHeight: 1,
            fontFamily: "'Poppins', sans-serif",
            color: '#F1C40F',
            letterSpacing: '0px',
            textShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
          }}>
            {seconds.toString().padStart(2, '0')}
          </Typography>
          <Typography sx={{ 
            fontSize: fontSizes.countdownLabel,
            fontWeight: 'bold',
            textTransform: 'uppercase',
            opacity: 0.9,
            mt: getSizeRem(-0.1),
            color: 'rgba(255, 255, 255, 0.7)',
            letterSpacing: '0.3px',
          }}>
            SECONDS
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default PrayerCountdown; 
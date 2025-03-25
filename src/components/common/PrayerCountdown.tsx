import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Fade } from '@mui/material';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';
import { parseTimeString } from '../../utils/dateUtils';

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
      console.log("Initializing countdown with pre-calculated value:", timeUntilNextPrayer);
      
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
              console.log(`EDGE CASE: Starting between ${prayerName} time and jamaat time. Switching to jamaat countdown.`);
              prayerTimePassedRef.current = true;
              setCountingDownToJamaat(true);
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
          console.error('Invalid prayer time format:', prayerTime);
          return;
        }
        
        const timeHours = parseInt(timeHoursStr, 10);
        const timeMinutes = parseInt(timeMinutesStr, 10);
        
        if (isNaN(timeHours) || isNaN(timeMinutes)) {
          console.error('Invalid prayer time values:', prayerTime);
          return;
        }
        
        // Create date objects with proper debugging
        const now = new Date();
        console.log(`Current time: ${now.toLocaleTimeString()}`);
        
        // Create prayer time for today
        const prayerDate = new Date();
        prayerDate.setHours(timeHours, timeMinutes, 0, 0);
        console.log(`Prayer time: ${prayerName} at ${prayerDate.toLocaleTimeString()}`);
        
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
                console.log(`After midnight: Isha jamaat from yesterday has passed`);
                jamaatTimePassedRef.current = true;
                
                // If we're displaying times, trigger completion
                if (displayTimes) {
                  triggerCountdownComplete(true);
                  return;
                }
              }
              
              // If jamaat time has passed and we haven't completed the countdown
              if (now > jamaatDate && !jamaatTimePassedRef.current) {
                console.log(`Jamaat time reached: ${jamaatTime}`);
                jamaatTimePassedRef.current = true;
                
                // Trigger callback only once
                if (displayTimes) {
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
          const prayerHasPassed = now > prayerDate;
          console.log(`Has ${prayerName} time passed? ${prayerHasPassed}`);
          
          // Special handling for Isha after midnight when Fajr is next
          const isAfterMidnightBeforeFajr = now.getHours() < 6 && prayerName === 'Isha';
          
          if (isAfterMidnightBeforeFajr) {
            console.log('After midnight, before Fajr, and evaluating Isha');
            // If it's after midnight and before Fajr, and we're checking Isha,
            // we should consider Isha from yesterday as having passed
            prayerTimePassedRef.current = true;
            
            // Set up for tomorrow's prayer
            prayerDate.setDate(prayerDate.getDate() + 1);
            console.log(`Setting Isha to tomorrow: ${prayerDate.toLocaleTimeString()}`);
            targetTime = prayerDate;
          }
          // Normal time passing check
          else if (prayerHasPassed) {
            prayerTimePassedRef.current = true;
            
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
                  console.log(`Jamaat time: ${jamaatDate.toLocaleTimeString()}`);
                  
                  // If jamaat time is still in the future, switch to counting down to jamaat
                  if (now < jamaatDate) {
                    console.log(`Switching from prayer time ${prayerTime} to jamaat time ${jamaatTime}`);
                    
                    // Trigger transition animation
                    setTextTransition(true);
                    setTimeout(() => {
                      setCountingDownToJamaat(true);
                      setTextTransition(false);
                    }, 500); // Match fade out duration
                    
                    targetTime = jamaatDate;
                  } else {
                    // Both prayer and jamaat times have passed
                    jamaatTimePassedRef.current = true;
                    console.log(`Both prayer time ${prayerTime} and jamaat time ${jamaatTime} have passed`);
                    
                    // Trigger countdown completion for jamaat (if it just passed)
                    const jamaatJustPassed = Math.abs(now.getTime() - jamaatDate.getTime()) < 60000; // Within 1 minute
                    if (jamaatJustPassed && !displayTimes) {
                      console.log(`Jamaat time just passed, triggering callback`);
                      if (onCountdownComplete) {
                        onCountdownComplete(true);
                      }
                    }
                    
                    // Set future prayer time for tomorrow
                    prayerDate.setDate(prayerDate.getDate() + 1);
                    console.log(`Setting prayer to tomorrow: ${prayerDate.toLocaleTimeString()}`);
                    targetTime = prayerDate;
                  }
                }
              }
            } else if (!jamaatTimePassedRef.current) {
              // Set future prayer time for tomorrow if no jamaat time or jamaat already passed
              prayerDate.setDate(prayerDate.getDate() + 1);
              console.log(`No jamaat, setting prayer to tomorrow: ${prayerDate.toLocaleTimeString()}`);
              targetTime = prayerDate;
            }
          } else if (prayerTimePassedRef.current && !jamaatTimePassedRef.current && !countingDownToJamaat && jamaatTime) {
            // If the prayer time just passed in a previous interval and we have jamaat time, 
            // but haven't switched to jamaat countdown yet
            const [jamaatHoursStr, jamaatMinutesStr] = jamaatTime.split(':');
            if (jamaatHoursStr && jamaatMinutesStr) {
              const jamaatHours = parseInt(jamaatHoursStr, 10);
              const jamaatMinutes = parseInt(jamaatMinutesStr, 10);
              
              if (!isNaN(jamaatHours) && !isNaN(jamaatMinutes)) {
                const jamaatDate = new Date();
                jamaatDate.setHours(jamaatHours, jamaatMinutes, 0, 0);
                
                if (now < jamaatDate) {
                  // Explicitly transition to jamaat countdown
                  console.log(`Late transition to jamaat time ${jamaatTime}`);
                  setTextTransition(true);
                  setTimeout(() => {
                    setCountingDownToJamaat(true);
                    setTextTransition(false);
                  }, 500);
                  
                  targetTime = jamaatDate;
                }
              }
            }
          }
        }
        
        // Calculate time difference
        const diffMs = targetTime.getTime() - now.getTime();
        
        if (diffMs <= 0 && !countingDownToJamaat && !prayerTimePassedRef.current) {
          console.log(`Prayer time reached: ${prayerTime}`);
          prayerTimePassedRef.current = true;
          triggerCountdownComplete(false);
          return;
        }
        
        // Calculate hours, minutes, seconds
        const diffSec = Math.floor(diffMs / 1000);
        const h = Math.floor(diffSec / 3600);
        const m = Math.floor((diffSec % 3600) / 60);
        const s = diffSec % 60;
        
        // Log detailed time information
        if (diffSec % 30 === 0) { // Only log every 30 seconds to reduce noise
          console.log(`Countdown for ${prayerName}: ${formatRemainingTimeLog(h, m, s)}`);
          console.log(`Target time: ${targetTime.toLocaleTimeString()}, Current time: ${now.toLocaleTimeString()}`);
          console.log(`Time difference: ${diffMs}ms (${diffSec}s)`);
          console.log(`Prayer passed: ${prayerTimePassedRef.current}, Jamaat passed: ${jamaatTimePassedRef.current}, Counting to jamaat: ${countingDownToJamaat}`);
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

  // Trigger callback when countdown reaches zero
  const triggerCountdownComplete = (isForJamaat: boolean) => {
    console.log(`==== COUNTDOWN COMPLETE ====`);
    console.log(`Prayer: ${prayerName}, Jamaat: ${isForJamaat}`);
    console.log(`Current time: ${new Date().toLocaleTimeString()}`);
    setHours(0);
    setMinutes(0);
    setSeconds(0);
    setDisplayTimes(false);
    
    if (onCountdownComplete) {
      console.log(`Triggering onCountdownComplete with isJamaat=${isForJamaat}`);
      onCountdownComplete(isForJamaat);
    } else {
      console.log('No onCountdownComplete handler provided');
    }
    console.log(`============================`);
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
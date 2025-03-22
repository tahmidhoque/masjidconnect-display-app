import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';
import { parseTimeString } from '../../utils/dateUtils';

interface PrayerCountdownProps {
  prayerName: string;
  prayerTime: string;
  timeUntilNextPrayer: string;
  onCountdownComplete?: () => void;
}

/**
 * PrayerCountdown component
 * 
 * Displays a countdown timer to the next prayer time.
 * Formats the remaining time as hours, minutes, and seconds.
 */
const PrayerCountdown: React.FC<PrayerCountdownProps> = ({
  prayerName,
  prayerTime,
  timeUntilNextPrayer,
  onCountdownComplete
}) => {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [displayTimes, setDisplayTimes] = useState(true);
  const { fontSizes, screenSize } = useResponsiveFontSize();
  const initializingRef = useRef<boolean>(true);
  
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
        
        // Create date objects
        const now = new Date();
        const prayerDate = new Date();
        prayerDate.setHours(timeHours, timeMinutes, 0, 0);
        
        // If prayer time has already passed today, set to tomorrow
        if (now > prayerDate) {
          prayerDate.setDate(prayerDate.getDate() + 1);
        }
        
        // Calculate time difference
        const diffMs = prayerDate.getTime() - now.getTime();
        
        if (diffMs <= 0) {
          setHours(0);
          setMinutes(0);
          setSeconds(0);
          
          if (!displayTimes) {
            setDisplayTimes(true);
            if (onCountdownComplete) {
              onCountdownComplete();
            }
          }
          return;
        }
        
        // Calculate hours, minutes, seconds
        const diffSec = Math.floor(diffMs / 1000);
        const h = Math.floor(diffSec / 3600);
        const m = Math.floor((diffSec % 3600) / 60);
        const s = diffSec % 60;
        
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
  }, [prayerTime, prayerName, onCountdownComplete, timeUntilNextPrayer, displayTimes]);

  if (!displayTimes) {
    return (
      <Typography sx={{ 
        fontWeight: 'bold',
        fontSize: fontSizes.h3,
        textAlign: 'center',
        color: '#F1C40F',
        my: 2,
        animation: 'pulseScale 1s infinite ease-in-out',
      }}>
        It's {prayerName} time!
      </Typography>
    );
  }

  return (
    <Box>      
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center',
        gap: screenSize.is720p ? 1 : 2, 
        alignItems: 'center',
        mt: 0.5,
      }}>
        {/* Hours */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ 
            fontSize: screenSize.is720p ? fontSizes.huge : '5.5rem',
            fontWeight: 'bold',
            lineHeight: 1.1,
            fontFamily: "'Poppins', sans-serif",
            color: '#F1C40F',
            letterSpacing: '-2px',
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          }}>
            {hours.toString().padStart(2, '0')}
          </Typography>
          <Typography sx={{ 
            fontSize: fontSizes.body2,
            fontWeight: 'bold',
            textTransform: 'uppercase',
            opacity: 0.9,
            mt: -0.5,
            color: 'rgba(255, 255, 255, 0.7)',
            letterSpacing: '1px',
          }}>
            HOURS
          </Typography>
        </Box>
        
        {/* Separator */}
        <Typography sx={{ 
          fontSize: screenSize.is720p ? fontSizes.huge : '5.5rem',
          fontWeight: 'bold',
          lineHeight: 1,
          fontFamily: "'Poppins', sans-serif",
          color: '#F1C40F',
          alignSelf: 'flex-start',
          mt: 0,
          opacity: 0.9
        }}>:</Typography>
        
        {/* Minutes */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ 
            fontSize: screenSize.is720p ? fontSizes.huge : '5.5rem',
            fontWeight: 'bold',
            lineHeight: 1.1,
            fontFamily: "'Poppins', sans-serif",
            color: '#F1C40F',
            letterSpacing: '-2px',
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          }}>
            {minutes.toString().padStart(2, '0')}
          </Typography>
          <Typography sx={{ 
            fontSize: fontSizes.body2,
            fontWeight: 'bold',
            textTransform: 'uppercase',
            opacity: 0.9,
            mt: -0.5,
            color: 'rgba(255, 255, 255, 0.7)',
            letterSpacing: '1px',
          }}>
            MINUTES
          </Typography>
        </Box>
        
        {/* Separator */}
        <Typography sx={{ 
          fontSize: screenSize.is720p ? fontSizes.huge : '5.5rem',
          fontWeight: 'bold',
          lineHeight: 1,
          fontFamily: "'Poppins', sans-serif",
          color: '#F1C40F',
          alignSelf: 'flex-start',
          mt: 0,
          opacity: 0.9
        }}>:</Typography>
        
        {/* Seconds */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ 
            fontSize: screenSize.is720p ? fontSizes.huge : '5.5rem',
            fontWeight: 'bold',
            lineHeight: 1.1,
            fontFamily: "'Poppins', sans-serif",
            color: '#F1C40F',
            letterSpacing: '-2px',
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          }}>
            {seconds.toString().padStart(2, '0')}
          </Typography>
          <Typography sx={{ 
            fontSize: fontSizes.body2,
            fontWeight: 'bold',
            textTransform: 'uppercase',
            opacity: 0.9,
            mt: -0.5,
            color: 'rgba(255, 255, 255, 0.7)',
            letterSpacing: '1px',
          }}>
            SECONDS
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default PrayerCountdown; 
import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import useResponsiveFontSize from '../../hooks/useResponsiveFontSize';

interface PrayerCountdownProps {
  prayerName: string;
  prayerTime: string;
  onCountdownComplete?: () => void;
}

/**
 * PrayerCountdown component
 * 
 * Displays a live countdown to the next prayer time.
 * Triggers onCountdownComplete when countdown reaches zero.
 */
const PrayerCountdown: React.FC<PrayerCountdownProps> = ({ 
  prayerName, 
  prayerTime, 
  onCountdownComplete 
}) => {
  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(0);
  const [seconds, setSeconds] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const { fontSizes } = useResponsiveFontSize();
  
  // Calculate remaining time and update countdown
  useEffect(() => {
    const calculateRemainingTime = () => {
      try {
        // Parse prayer time
        const [timeHoursStr, timeMinutesStr] = prayerTime.split(':');
        const timeHours = parseInt(timeHoursStr, 10);
        const timeMinutes = parseInt(timeMinutesStr, 10);
        
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
          
          if (!isCompleted) {
            setIsCompleted(true);
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
        if (isCompleted && diffMs > 0) {
          setIsCompleted(false);
        }
      } catch (error) {
        console.error('Error calculating prayer countdown:', error);
      }
    };
    
    // Initial calculation
    calculateRemainingTime();
    
    // Update every second
    const timer = setInterval(calculateRemainingTime, 1000);
    
    return () => clearInterval(timer);
  }, [prayerTime, onCountdownComplete, isCompleted]);
  
  return (
    <Box sx={{ 
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      my: 2,
      gap: 1
    }}>
      {/* Hours */}
      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        p: 0.5,
      }}>
        <Typography 
          sx={{
            fontWeight: 'bold',
            fontSize: fontSizes.huge,
            lineHeight: 1,
            color: '#F1C40F',
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          {hours.toString().padStart(2, '0')}
        </Typography>
        <Typography 
          sx={{ 
            fontSize: fontSizes.caption,
            opacity: 0.8,
            color: 'rgba(255, 255, 255, 0.9)',
            letterSpacing: 1,
            fontFamily: "'Poppins', sans-serif",
            textTransform: 'uppercase',
            mt: 0.5
          }}
        >
          hours
        </Typography>
      </Box>
      
      <Typography 
        sx={{ 
          fontSize: fontSizes.huge, 
          fontWeight: 'bold',
          opacity: 0.9,
          color: '#F1C40F',
          mb: fontSizes.caption,
          lineHeight: 1,
        }}
      >
        :
      </Typography>
      
      {/* Minutes */}
      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        p: 0.5,
      }}>
        <Typography 
          sx={{
            fontWeight: 'bold',
            fontSize: fontSizes.huge,
            lineHeight: 1,
            color: '#F1C40F',
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          {minutes.toString().padStart(2, '0')}
        </Typography>
        <Typography 
          sx={{ 
            fontSize: fontSizes.caption,
            opacity: 0.8,
            color: 'rgba(255, 255, 255, 0.9)',
            letterSpacing: 1,
            fontFamily: "'Poppins', sans-serif",
            textTransform: 'uppercase',
            mt: 0.5
          }}
        >
          minutes
        </Typography>
      </Box>
      
      <Typography 
        sx={{ 
          fontSize: fontSizes.huge, 
          fontWeight: 'bold',
          opacity: 0.9,
          color: '#F1C40F',
          mb: fontSizes.caption,
          lineHeight: 1,
        }}
      >
        :
      </Typography>
      
      {/* Seconds */}
      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        p: 0.5,
      }}>
        <Typography 
          sx={{
            fontWeight: 'bold',
            fontSize: fontSizes.huge,
            lineHeight: 1,
            color: '#F1C40F',
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          {seconds.toString().padStart(2, '0')}
        </Typography>
        <Typography 
          sx={{ 
            fontSize: fontSizes.caption,
            opacity: 0.8,
            color: 'rgba(255, 255, 255, 0.9)',
            letterSpacing: 1,
            fontFamily: "'Poppins', sans-serif",
            textTransform: 'uppercase',
            mt: 0.5
          }}
        >
          seconds
        </Typography>
      </Box>
    </Box>
  );
};

export default PrayerCountdown; 
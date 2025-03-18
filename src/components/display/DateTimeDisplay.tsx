import React, { useState, useEffect } from 'react';
import { Box, Typography, styled } from '@mui/material';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';

interface DateTimeDisplayProps {
  variant?: 'large' | 'medium' | 'small';
  showSeconds?: boolean;
}

// Styled components
const DateTimeContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: theme.spacing(2),
  borderRadius: theme.spacing(1),
  background: 'rgba(0, 0, 0, 0.05)',
}));

const TimeText = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  lineHeight: 1.2,
  marginBottom: theme.spacing(1),
}));

const DateText = styled(Typography)(({ theme }) => ({
  fontWeight: 500,
  lineHeight: 1.2,
}));

const HijriDateText = styled(Typography)(({ theme }) => ({
  fontWeight: 400,
  opacity: 0.8,
  marginTop: theme.spacing(0.5),
}));

/**
 * DateTimeDisplay component
 * 
 * Displays the current date and time in both Gregorian and Hijri calendars
 */
const DateTimeDisplay: React.FC<DateTimeDisplayProps> = ({
  variant = 'medium',
  showSeconds = true,
}) => {
  const { currentDate, hijriDate } = usePrayerTimes();
  const [time, setTime] = useState<string>('');
  
  // Update time every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      
      setTime(showSeconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`);
    };
    
    // Update immediately
    updateTime();
    
    // Set interval to update every second
    const interval = setInterval(updateTime, 1000);
    
    // Cleanup
    return () => clearInterval(interval);
  }, [showSeconds]);
  
  // Define sizes based on variant
  const getTimeSize = () => {
    switch (variant) {
      case 'large': return '3rem';
      case 'small': return '1.5rem';
      default: return '2.2rem';
    }
  };
  
  const getDateSize = () => {
    switch (variant) {
      case 'large': return '1.5rem';
      case 'small': return '0.9rem';
      default: return '1.2rem';
    }
  };
  
  const getHijriDateSize = () => {
    switch (variant) {
      case 'large': return '1.2rem';
      case 'small': return '0.8rem';
      default: return '1rem';
    }
  };

  return (
    <DateTimeContainer>
      <TimeText sx={{ fontSize: getTimeSize() }}>
        {time}
      </TimeText>
      
      <DateText sx={{ fontSize: getDateSize() }}>
        {currentDate}
      </DateText>
      
      {hijriDate && (
        <HijriDateText sx={{ fontSize: getHijriDateSize() }}>
          {hijriDate}
        </HijriDateText>
      )}
    </DateTimeContainer>
  );
};

export default DateTimeDisplay; 
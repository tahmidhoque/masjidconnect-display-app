import React from 'react';
import { Box, Typography, styled } from '@mui/material';

interface CountdownTimerProps {
  hours: number;
  minutes: number;
  seconds: number;
  prayerName: string;
  variant?: 'large' | 'medium' | 'small';
  showLabel?: boolean;
}

// Styled components for different timer parts
const TimerContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
}));

const TimerWrapper = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
}));

const TimeUnit = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  background: 'rgba(255, 255, 255, 0.1)',
  borderRadius: theme.spacing(1),
  padding: theme.spacing(1),
  minWidth: '80px',
}));

const TimeDigit = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  lineHeight: 1,
  textAlign: 'center',
}));

const TimeLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.8rem',
  opacity: 0.8,
  textAlign: 'center',
}));

const TimeSeparator = styled(Typography)(({ theme }) => ({
  fontSize: '2rem',
  fontWeight: 700,
  lineHeight: 1,
  opacity: 0.6,
  marginTop: theme.spacing(1),
}));

const PrayerNameText = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  marginBottom: theme.spacing(1),
  opacity: 0.9,
}));

/**
 * CountdownTimer component
 * 
 * Displays a countdown timer for the next prayer
 */
const CountdownTimer: React.FC<CountdownTimerProps> = ({
  hours,
  minutes,
  seconds,
  prayerName,
  variant = 'medium',
  showLabel = true,
}) => {
  // Define sizes based on variant
  const getDigitSize = () => {
    switch (variant) {
      case 'large': return '3.5rem';
      case 'small': return '1.8rem';
      default: return '2.5rem';
    }
  };
  
  const getSeparatorSize = () => {
    switch (variant) {
      case 'large': return '3rem';
      case 'small': return '1.5rem';
      default: return '2rem';
    }
  };

  return (
    <TimerContainer>
      {showLabel && (
        <PrayerNameText 
          variant={variant === 'large' ? 'h5' : variant === 'small' ? 'body1' : 'h6'}
        >
          {prayerName} in
        </PrayerNameText>
      )}
      
      <TimerWrapper>
        <TimeUnit>
          <TimeDigit sx={{ fontSize: getDigitSize() }}>
            {hours.toString().padStart(2, '0')}
          </TimeDigit>
          <TimeLabel>HOURS</TimeLabel>
        </TimeUnit>

        <TimeSeparator sx={{ fontSize: getSeparatorSize() }}>:</TimeSeparator>
        
        <TimeUnit>
          <TimeDigit sx={{ fontSize: getDigitSize() }}>
            {minutes.toString().padStart(2, '0')}
          </TimeDigit>
          <TimeLabel>MINUTES</TimeLabel>
        </TimeUnit>

        <TimeSeparator sx={{ fontSize: getSeparatorSize() }}>:</TimeSeparator>
        
        <TimeUnit>
          <TimeDigit sx={{ fontSize: getDigitSize() }}>
            {seconds.toString().padStart(2, '0')}
          </TimeDigit>
          <TimeLabel>SECONDS</TimeLabel>
        </TimeUnit>
      </TimerWrapper>
    </TimerContainer>
  );
};

export default CountdownTimer; 
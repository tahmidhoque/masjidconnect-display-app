import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, styled } from '@mui/material';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import CountdownTimer from './CountdownTimer';

interface PrayerTimesPanelProps {
  variant?: 'full' | 'compact';
  showCountdown?: boolean;
  onPrayerTimeReached?: (prayerName: string) => void;
}

// Styled components
const PanelContainer = styled(Box)(({ theme }) => ({
  borderRadius: theme.spacing(1.5),
  overflow: 'hidden',
  background: theme.palette.background.paper,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
}));

const PanelHeader = styled(Box)(({ theme }) => ({
  background: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  padding: theme.spacing(2, 3),
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent)',
  backgroundSize: '10px 10px',
}));

const PrayerItem = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isActive' && prop !== 'isNext',
})<{ isActive?: boolean; isNext?: boolean }>(({ theme, isActive, isNext }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.spacing(1),
  marginBottom: theme.spacing(1),
  display: 'flex',
  alignItems: 'center',
  transition: 'all 0.2s ease',
  backgroundColor: isActive 
    ? theme.palette.secondary.main
    : isNext 
      ? theme.palette.primary.main 
      : 'rgba(0, 0, 0, 0.03)',
  color: (isActive || isNext) ? '#fff' : 'inherit',
  boxShadow: (isActive || isNext) 
    ? '0 4px 10px rgba(0, 0, 0, 0.15)' 
    : 'none',
  '&:last-child': {
    marginBottom: 0,
  },
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.1)',
  },
}));

const PrayerName = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  fontSize: '1.1rem',
}));

const PrayerTime = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '1.25rem',
}));

const JamaatTime = styled(Typography)(({ theme }) => ({
  fontWeight: 500,
  opacity: 0.9,
}));

const CountdownContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  background: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  borderTopLeftRadius: theme.spacing(1.5),
  borderTopRightRadius: theme.spacing(1.5),
}));

/**
 * PrayerTimesPanel component
 * 
 * Displays prayer times in a modern panel with Islamic design elements
 */
const PrayerTimesPanel: React.FC<PrayerTimesPanelProps> = ({
  variant = 'full',
  showCountdown = true,
  onPrayerTimeReached,
}) => {
  const {
    todaysPrayerTimes,
    nextPrayer,
    currentPrayer,
    isJumuahToday,
    jumuahDisplayTime,
  } = usePrayerTimes();
  
  const [countdownTime, setCountdownTime] = useState({ hours: 0, minutes: 0, seconds: 0 });
  
  // Periodically check if prayer time has been reached
  useEffect(() => {
    if (!nextPrayer || !onPrayerTimeReached) return;
    
    const checkPrayerTimeReached = () => {
      const now = new Date();
      const [hours, minutes] = nextPrayer.time.split(':').map(Number);
      
      const prayerTime = new Date();
      prayerTime.setHours(hours, minutes, 0, 0);
      
      // If prayer time has been reached (with 30 seconds buffer)
      if (now >= prayerTime && (now.getTime() - prayerTime.getTime()) < 30000) {
        onPrayerTimeReached(nextPrayer.name);
      }
    };
    
    // Check immediately
    checkPrayerTimeReached();
    
    // Then check every 15 seconds
    const interval = setInterval(checkPrayerTimeReached, 15000);
    
    return () => clearInterval(interval);
  }, [nextPrayer, onPrayerTimeReached]);
  
  // Update countdown timer
  useEffect(() => {
    if (!nextPrayer) return;
    
    const updateCountdown = () => {
      const now = new Date();
      const [prayerHours, prayerMinutes] = nextPrayer.time.split(':').map(Number);
      
      const prayerTime = new Date();
      prayerTime.setHours(prayerHours, prayerMinutes, 0, 0);
      
      // If prayer time has passed, set to next day
      if (prayerTime < now) {
        prayerTime.setDate(prayerTime.getDate() + 1);
      }
      
      // Calculate difference
      let diff = prayerTime.getTime() - now.getTime();
      
      // Convert to hours, minutes, seconds
      const countdownHours = Math.floor(diff / (1000 * 60 * 60));
      diff -= countdownHours * (1000 * 60 * 60);
      
      const countdownMinutes = Math.floor(diff / (1000 * 60));
      diff -= countdownMinutes * (1000 * 60);
      
      const seconds = Math.floor(diff / 1000);
      
      setCountdownTime({ 
        hours: countdownHours, 
        minutes: countdownMinutes, 
        seconds 
      });
    };
    
    // Update immediately
    updateCountdown();
    
    // Update every second
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [nextPrayer]);
  
  // If no prayer times available
  if (!todaysPrayerTimes.length) {
    return (
      <Paper elevation={2} sx={{ p: 3, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h6">Prayer times not available</Typography>
      </Paper>
    );
  }
  
  return (
    <PanelContainer>
      {/* Show countdown if enabled and a next prayer exists */}
      {showCountdown && nextPrayer && (
        <CountdownContainer>
          <CountdownTimer
            hours={countdownTime.hours}
            minutes={countdownTime.minutes}
            seconds={countdownTime.seconds}
            prayerName={nextPrayer.name}
            variant={variant === 'full' ? 'medium' : 'small'}
          />
        </CountdownContainer>
      )}
      
      <PanelHeader>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Prayer Times
        </Typography>
      </PanelHeader>
      
      <Box sx={{ 
        p: 2, 
        flex: 1, 
        overflowY: 'auto',
        '&::-webkit-scrollbar': { width: '8px' },
        '&::-webkit-scrollbar-track': { background: 'rgba(0,0,0,0.05)' },
        '&::-webkit-scrollbar-thumb': { background: 'rgba(0,0,0,0.2)', borderRadius: '4px' },
      }}>
        {/* Prayer times */}
        {todaysPrayerTimes.map((prayer, index) => (
          <PrayerItem 
            key={prayer.name}
            isActive={prayer.isCurrent}
            isNext={prayer.isNext}
          >
            <Grid container alignItems="center" spacing={2}>
              <Grid item xs={variant === 'full' ? 4 : 6}>
                <PrayerName>
                  {prayer.name}
                </PrayerName>
              </Grid>
              <Grid item xs={variant === 'full' ? 4 : 6}>
                <PrayerTime>
                  {prayer.displayTime}
                </PrayerTime>
              </Grid>
              {variant === 'full' && (
                <Grid item xs={4}>
                  <JamaatTime>
                    {prayer.displayJamaat || '-'}
                  </JamaatTime>
                </Grid>
              )}
            </Grid>
          </PrayerItem>
        ))}
        
        {/* Jumu'ah time if today is Friday */}
        {isJumuahToday && jumuahDisplayTime && (
          <PrayerItem 
            sx={{ 
              background: 'linear-gradient(135deg, #E9C46A 0%, #F4A261 100%)',
              color: '#fff',
            }}
          >
            <Grid container alignItems="center" spacing={2}>
              <Grid item xs={variant === 'full' ? 4 : 6}>
                <PrayerName>
                  Jumu'ah
                </PrayerName>
              </Grid>
              <Grid item xs={variant === 'full' ? 8 : 6}>
                <PrayerTime>
                  {jumuahDisplayTime}
                </PrayerTime>
              </Grid>
            </Grid>
          </PrayerItem>
        )}
      </Box>
    </PanelContainer>
  );
};

export default PrayerTimesPanel; 
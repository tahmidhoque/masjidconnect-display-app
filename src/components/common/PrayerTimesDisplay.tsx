import React from 'react';
import { Box, Typography, Grid, Paper, Divider } from '@mui/material';
import { usePrayerTimes } from '../../hooks/usePrayerTimes';

interface PrayerTimesDisplayProps {
  simplified?: boolean;
}

/**
 * PrayerTimesDisplay component
 * 
 * Displays the prayer times for the day with optional jamaat times.
 * Highlights the current and next prayers.
 */
const PrayerTimesDisplay: React.FC<PrayerTimesDisplayProps> = ({ simplified = false }) => {
  const {
    todaysPrayerTimes,
    nextPrayer,
    currentPrayer,
    currentDate,
    hijriDate,
    isJumuahToday,
    jumuahDisplayTime,
  } = usePrayerTimes();

  if (simplified) {
    // Simplified view (for sidebar or compact display)
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
          {currentDate}
          {hijriDate && (
            <Typography component="span" variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              {hijriDate}
            </Typography>
          )}
        </Typography>
        
        <Grid container spacing={1} sx={{ mt: 1 }}>
          {todaysPrayerTimes.map((prayer) => (
            <Grid item xs={4} key={prayer.name}>
              <Box sx={{ 
                p: 1, 
                textAlign: 'center',
                bgcolor: prayer.isNext ? 'success.main' : prayer.isCurrent ? 'primary.main' : 'background.paper',
                color: (prayer.isNext || prayer.isCurrent) ? 'white' : 'inherit',
                borderRadius: 1,
                transform: prayer.isNext ? 'scale(1.05)' : 'none',
                transition: 'transform 0.2s ease-in-out'
              }}>
                <Typography variant="caption" component="div">
                  {prayer.name}
                </Typography>
                <Typography variant="body2" component="div" sx={{ fontWeight: 'bold' }}>
                  {prayer.displayTime}
                </Typography>
              </Box>
            </Grid>
          ))}
          
          {isJumuahToday && (
            <Grid item xs={12} sx={{ mt: 1 }}>
              <Box sx={{ 
                p: 1, 
                textAlign: 'center', 
                bgcolor: 'warning.main', 
                color: 'warning.contrastText',
                borderRadius: 1
              }}>
                <Typography variant="caption" component="div">
                  Jumu'ah
                </Typography>
                <Typography variant="body2" component="div" sx={{ fontWeight: 'bold' }}>
                  {jumuahDisplayTime}
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>
        
        {nextPrayer && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="body2">
              Next Prayer: <strong>{nextPrayer.name}</strong> in <strong>{nextPrayer.timeUntil}</strong>
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

  // Full view
  return (
    <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', p: 2 }}>
        <Typography variant="h6">Prayer Times</Typography>
        <Typography variant="body2">{currentDate}</Typography>
        {hijriDate && (
          <Typography variant="body2">{hijriDate}</Typography>
        )}
      </Box>
      
      <Box sx={{ p: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            {nextPrayer && (
              <Paper 
                elevation={1} 
                sx={{ 
                  p: 2, 
                  mb: 2, 
                  textAlign: 'center', 
                  bgcolor: 'success.main', 
                  color: 'success.contrastText' 
                }}
              >
                <Typography variant="subtitle1">
                  Next Prayer: {nextPrayer.name}
                </Typography>
                <Typography variant="h4">
                  {nextPrayer.displayTime}
                </Typography>
                <Typography variant="body2">
                  {nextPrayer.timeUntil} remaining
                </Typography>
                {nextPrayer.displayJamaat && (
                  <Typography variant="body2">
                    Jamaat: {nextPrayer.displayJamaat}
                  </Typography>
                )}
              </Paper>
            )}
            
            {currentPrayer && (
              <Paper 
                elevation={1} 
                sx={{ 
                  p: 1, 
                  mb: 2, 
                  textAlign: 'center', 
                  bgcolor: 'primary.main', 
                  color: 'primary.contrastText' 
                }}
              >
                <Typography variant="subtitle2">
                  Current Prayer: {currentPrayer.name}
                </Typography>
                <Typography variant="h6">
                  {currentPrayer.displayTime}
                </Typography>
                {currentPrayer.displayJamaat && (
                  <Typography variant="body2">
                    Jamaat: {currentPrayer.displayJamaat}
                  </Typography>
                )}
              </Paper>
            )}
            
            {/* Prayer times table */}
            <Grid container spacing={1}>
              <Grid item xs={4}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Prayer</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Adhan</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Jamaat</Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Divider />
              </Grid>
              
              {todaysPrayerTimes.map((prayer) => (
                <React.Fragment key={prayer.name}>
                  <Grid item xs={4}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: prayer.isNext || prayer.isCurrent ? 'bold' : 'normal',
                        color: prayer.isNext ? 'success.main' : prayer.isCurrent ? 'primary.main' : 'inherit'
                      }}
                    >
                      {prayer.name}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography 
                      variant="body2"
                      sx={{ 
                        fontWeight: prayer.isNext || prayer.isCurrent ? 'bold' : 'normal',
                        color: prayer.isNext ? 'success.main' : prayer.isCurrent ? 'primary.main' : 'inherit'
                      }}
                    >
                      {prayer.displayTime}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography 
                      variant="body2"
                      sx={{ 
                        fontWeight: prayer.isNext || prayer.isCurrent ? 'bold' : 'normal',
                        color: prayer.isNext ? 'success.main' : prayer.isCurrent ? 'primary.main' : 'inherit'
                      }}
                    >
                      {prayer.displayJamaat || '-'}
                    </Typography>
                  </Grid>
                </React.Fragment>
              ))}
              
              {isJumuahToday && (
                <React.Fragment>
                  <Grid item xs={12}>
                    <Divider />
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                      Jumu'ah
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                      -
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                      {jumuahDisplayTime}
                    </Typography>
                  </Grid>
                </React.Fragment>
              )}
            </Grid>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
};

export default PrayerTimesDisplay; 
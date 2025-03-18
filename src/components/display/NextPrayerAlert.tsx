import React, { useEffect, useState } from 'react';
import { Box, Typography, Fade, styled } from '@mui/material';
import MosqueIcon from '@mui/icons-material/Mosque';
import PhoneAndroidOffIcon from '@mui/icons-material/PhoneAndroid';

interface NextPrayerAlertProps {
  prayerName: string;
  onAlertEnd?: () => void;
  duration?: number; // Duration in seconds
}

// Styled components
const AlertContainer = styled(Box)(({ theme }) => ({
  height: '100%',
  width: '100%',
  background: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  padding: theme.spacing(4),
  textAlign: 'center',
  borderRadius: theme.spacing(1),
}));

const IconContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  marginBottom: theme.spacing(4),
  animation: 'pulse 2s infinite ease-in-out',
  '@keyframes pulse': {
    '0%': { opacity: 0.7, transform: 'scale(0.95)' },
    '50%': { opacity: 1, transform: 'scale(1.05)' },
    '100%': { opacity: 0.7, transform: 'scale(0.95)' },
  },
}));

/**
 * NextPrayerAlert component
 * 
 * Displays an alert when a prayer time is reached
 */
const NextPrayerAlert: React.FC<NextPrayerAlertProps> = ({
  prayerName,
  onAlertEnd,
  duration = 30, // Default 30 seconds
}) => {
  const [visible, setVisible] = useState(true);
  
  // Set timeout to hide alert after duration
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      
      // Notify parent after fade out
      setTimeout(() => {
        if (onAlertEnd) onAlertEnd();
      }, 1000);
    }, duration * 1000);
    
    return () => clearTimeout(timer);
  }, [duration, onAlertEnd]);

  return (
    <Fade in={visible} timeout={1000}>
      <AlertContainer>
        <IconContainer>
          <MosqueIcon sx={{ fontSize: 80, mr: 2 }} />
          <PhoneAndroidOffIcon sx={{ fontSize: 80 }} />
        </IconContainer>
        
        <Typography variant="h2" gutterBottom sx={{ fontWeight: 700 }}>
          {prayerName} Prayer
        </Typography>
        
        <Typography variant="h4" sx={{ mb: 4 }}>
          Time to Pray
        </Typography>
        
        <Typography variant="h5" sx={{ opacity: 0.9 }}>
          Please switch off your mobile phones
        </Typography>
      </AlertContainer>
    </Fade>
  );
};

export default NextPrayerAlert; 
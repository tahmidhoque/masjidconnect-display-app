import React, { ReactNode, useState } from 'react';
import { Box, Grid, styled } from '@mui/material';
import { useContent } from '../../contexts/ContentContext';
import PrayerTimesPanel from '../display/PrayerTimesPanel';
import ContentCarousel from '../display/ContentCarousel';
import DateTimeDisplay from '../display/DateTimeDisplay';
import NextPrayerAlert from '../display/NextPrayerAlert';
import MasjidConnectLogo from '../display/MasjidConnectLogo';

interface PortraitLayoutProps {
  children?: ReactNode;
}

// Styled components
const LayoutContainer = styled(Box)(({ theme }) => ({
  height: '100vh',
  width: '100vw',
  overflow: 'hidden',
  background: `linear-gradient(135deg, ${theme.palette.background.default} 0%, #FFFFFF 100%)`,
  display: 'flex',
  flexDirection: 'column',
}));

const MainContent = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}));

const Header = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: `1px solid rgba(0, 0, 0, 0.05)`,
}));

const Footer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1, 2),
  background: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}));

// Subtle Islamic pattern background
const IslamicPatternOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23${theme.palette.primary.main.replace('#', '')}' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
  opacity: 0.5,
  zIndex: 0,
  pointerEvents: 'none',
}));

/**
 * PortraitLayout component
 * 
 * Modern layout for displays in portrait orientation.
 */
const PortraitLayout: React.FC<PortraitLayoutProps> = ({ children }) => {
  const { masjidName } = useContent();
  const [showPrayerAlert, setShowPrayerAlert] = useState(false);
  const [alertPrayerName, setAlertPrayerName] = useState('');
  
  // Handle prayer time reached
  const handlePrayerTimeReached = (prayerName: string) => {
    setAlertPrayerName(prayerName);
    setShowPrayerAlert(true);
  };
  
  // Handle alert end
  const handleAlertEnd = () => {
    setShowPrayerAlert(false);
  };

  return (
    <LayoutContainer>
      <IslamicPatternOverlay />
      
      <Header>
        <DateTimeDisplay variant="medium" />
        <MasjidConnectLogo variant="icon" size="small" color="blue" />
      </Header>
      
      <MainContent>
        <Grid container spacing={2} sx={{ zIndex: 1, height: '100%' }}>
          {/* Top section - Prayer times */}
          <Grid item xs={12} sx={{ height: '45%', minHeight: '300px' }}>
            <PrayerTimesPanel 
              variant="compact" 
              onPrayerTimeReached={handlePrayerTimeReached}
            />
          </Grid>
          
          {/* Bottom section - Content carousel */}
          <Grid item xs={12} sx={{ height: '55%' }}>
            <ContentCarousel 
              isOverrideActive={showPrayerAlert}
              overrideContent={
                showPrayerAlert && (
                  <NextPrayerAlert 
                    prayerName={alertPrayerName} 
                    onAlertEnd={handleAlertEnd}
                  />
                )
              }
            />
          </Grid>
        </Grid>
      </MainContent>
      
      <Footer>
        <Box>{masjidName || 'MasjidConnect Display'}</Box>
        <Box>Portrait Mode</Box>
      </Footer>
    </LayoutContainer>
  );
};

export default PortraitLayout; 
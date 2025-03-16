import React, { ReactNode } from 'react';
import { Box, Container, Typography } from '@mui/material';
import { useContent } from '../../contexts/ContentContext';
import PrayerTimesDisplay from '../common/PrayerTimesDisplay';

interface PortraitLayoutProps {
  children: ReactNode;
}

/**
 * PortraitLayout component
 * 
 * Layout for displays in portrait orientation.
 * Provides a header with prayer times and a main content area.
 */
const PortraitLayout: React.FC<PortraitLayoutProps> = ({ children }) => {
  const { masjidName } = useContent();

  return (
    <Box sx={{ 
      height: '100vh', 
      width: '100vw', 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <Box sx={{ 
        bgcolor: 'primary.main', 
        color: 'primary.contrastText',
        p: 1,
        boxShadow: 1,
        zIndex: 10
      }}>
        <Container maxWidth={false}>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            {masjidName || 'MasjidConnect Display'}
          </Typography>
        </Container>
      </Box>
      
      {/* Prayer Times Header */}
      <Box sx={{ 
        bgcolor: 'background.default',
        borderBottom: 1,
        borderColor: 'divider',
        p: 1
      }}>
        <PrayerTimesDisplay simplified />
      </Box>
      
      {/* Main Content */}
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto',
        p: 2
      }}>
        {children}
      </Box>
      
      {/* Footer */}
      <Box sx={{ 
        bgcolor: 'background.paper', 
        p: 0.5,
        borderTop: 1,
        borderColor: 'divider',
        textAlign: 'center'
      }}>
        <Typography variant="caption" color="text.secondary">
          MasjidConnect Display v1.0.0 • Portrait Mode
        </Typography>
      </Box>
    </Box>
  );
};

export default PortraitLayout; 
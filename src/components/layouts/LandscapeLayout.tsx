import React, { ReactNode } from 'react';
import { Box, Grid, Container, Typography } from '@mui/material';
import { useContent } from '../../contexts/ContentContext';
import PrayerTimesDisplay from '../common/PrayerTimesDisplay';

interface LandscapeLayoutProps {
  children: ReactNode;
}

/**
 * LandscapeLayout component
 * 
 * Layout for displays in landscape orientation.
 * Provides a sidebar for prayer times and a main content area.
 */
const LandscapeLayout: React.FC<LandscapeLayoutProps> = ({ children }) => {
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
      
      {/* Main Content */}
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'hidden',
        display: 'flex'
      }}>
        {/* Prayer Times Sidebar */}
        <Box sx={{ 
          width: '350px', 
          borderRight: 1, 
          borderColor: 'divider',
          overflow: 'auto',
          bgcolor: 'background.default'
        }}>
          <PrayerTimesDisplay />
        </Box>
        
        {/* Main Content Area */}
        <Box sx={{ 
          flexGrow: 1, 
          overflow: 'auto',
          p: 2
        }}>
          {children}
        </Box>
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
          MasjidConnect Display v1.0.0 • Landscape Mode
        </Typography>
      </Box>
    </Box>
  );
};

export default LandscapeLayout; 
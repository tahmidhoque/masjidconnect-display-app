import React, { useEffect } from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import { useContent } from '../../contexts/ContentContext';
import { useOrientation } from '../../contexts/OrientationContext';
import LandscapeLayout from '../layouts/LandscapeLayout';
import PortraitLayout from '../layouts/PortraitLayout';
import LoadingScreen from './LoadingScreen';

/**
 * DisplayScreen component
 * 
 * The main display screen shown after successful authentication.
 * Shows prayer times, current content, and other information.
 * Adapts to the screen orientation (portrait/landscape).
 */
const DisplayScreen: React.FC = () => {
  const { 
    isLoading, 
    refreshContent, 
    schedule, 
    events, 
    lastUpdated,
    masjidName 
  } = useContent();
  const { orientation } = useOrientation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  // Placeholder content (to be replaced with actual content components)
  const contentPlaceholder = (
    <Box>
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Welcome to {masjidName || 'MasjidConnect'}
        </Typography>
        <Typography variant="body1">
          This display shows prayer times, announcements, events, and other information
          for your masjid. Content is managed through the MasjidConnect management portal.
        </Typography>
      </Paper>
      
      {schedule && (
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            Current Schedule: {schedule.name}
          </Typography>
          <Typography variant="body1" paragraph>
            {schedule.items.length} items in the content rotation
          </Typography>
          
          <Grid container spacing={2}>
            {schedule.items.map((item) => (
              <Grid item xs={12} key={item.id}>
                <Paper elevation={1} sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {item.contentItem.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Type: {item.contentItem.type}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}
      
      {events && events.length > 0 && (
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Upcoming Events
          </Typography>
          
          <Grid container spacing={2}>
            {events.map((event) => (
              <Grid item xs={12} key={event.id}>
                <Paper elevation={1} sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {event.title}
                  </Typography>
                  <Typography variant="body2" paragraph>
                    {event.description}
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Date: {new Date(event.startDate).toLocaleDateString()}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Location: {event.location}
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}
    </Box>
  );

  // Render layout based on orientation
  return orientation === 'LANDSCAPE' ? (
    <LandscapeLayout>
      {contentPlaceholder}
    </LandscapeLayout>
  ) : (
    <PortraitLayout>
      {contentPlaceholder}
    </PortraitLayout>
  );
};

export default DisplayScreen; 
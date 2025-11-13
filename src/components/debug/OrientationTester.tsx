import React, { useState } from 'react';
import { Box, Button, ButtonGroup, Paper, Typography } from '@mui/material';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../store';
import { setOrientation, Orientation } from '../../store/slices/uiSlice';
import logger from '../../utils/logger';

/**
 * OrientationTester component
 * 
 * Development tool for manually testing orientation changes.
 * Only visible in development mode.
 * 
 * Provides buttons to switch between LANDSCAPE and PORTRAIT orientations
 * without needing the admin portal or SSE events.
 */
export function OrientationTester() {
  const dispatch = useDispatch<AppDispatch>();
  const [testOrientation, setTestOrientation] = useState<Orientation>('LANDSCAPE');
  
  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  const handleTest = (orientation: Orientation) => {
    logger.debug('[OrientationTester] Manual orientation test triggered', { orientation });
    console.log(`🧪 OrientationTester: Manually changing orientation to ${orientation}`);
    
    setTestOrientation(orientation);
    
    // Update Redux store
    dispatch(setOrientation(orientation));
    
    // Store in localStorage
    try {
      localStorage.setItem('screen_orientation', orientation);
    } catch (error) {
      logger.error('[OrientationTester] Error storing orientation in localStorage', { error });
    }
    
    // Dispatch custom event to simulate SSE event
    window.dispatchEvent(new CustomEvent('orientation-changed', {
      detail: {
        orientation,
        screenId: 'test-screen',
        timestamp: Date.now()
      }
    }));
  };
  
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 9999,
      }}
    >
      <Paper
        elevation={4}
        sx={{
          padding: 2,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          borderRadius: 2,
        }}
      >
        <Typography variant="caption" sx={{ display: 'block', marginBottom: 1, fontWeight: 600 }}>
          Orientation Tester
        </Typography>
        <ButtonGroup variant="contained" size="small">
          <Button
            onClick={() => handleTest('LANDSCAPE')}
            sx={{
              backgroundColor: testOrientation === 'LANDSCAPE' ? 'primary.main' : 'grey.700',
              '&:hover': {
                backgroundColor: testOrientation === 'LANDSCAPE' ? 'primary.dark' : 'grey.600',
              },
            }}
          >
            Landscape
          </Button>
          <Button
            onClick={() => handleTest('PORTRAIT')}
            sx={{
              backgroundColor: testOrientation === 'PORTRAIT' ? 'primary.main' : 'grey.700',
              '&:hover': {
                backgroundColor: testOrientation === 'PORTRAIT' ? 'primary.dark' : 'grey.600',
              },
            }}
          >
            Portrait
          </Button>
        </ButtonGroup>
      </Paper>
    </Box>
  );
}

export default OrientationTester;


import React from 'react';
import { Box, Typography, Paper, Container, Button } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';

interface ErrorScreenProps {
  message?: string;
  details?: string;
  onRetry?: () => void;
}

/**
 * ErrorScreen component
 * 
 * Displays an error message with optional details and a retry button.
 * Used when the app encounters a fatal error.
 */
const ErrorScreen: React.FC<ErrorScreenProps> = ({ 
  message = 'An error occurred', 
  details,
  onRetry 
}) => {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      // Default retry behavior - reload the page
      window.location.reload();
    }
  };

  return (
    <Box
      sx={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F4F4F4',
      }}
    >
      <Container maxWidth="md">
        <Paper
          elevation={3}
          sx={{
            p: 6,
            borderRadius: 4,
            textAlign: 'center',
            backgroundColor: '#fff',
          }}
        >
          <ErrorOutlineIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
          
          <Typography variant="h3" color="error" gutterBottom>
            {message}
          </Typography>
          
          {details && (
            <Typography variant="body1" sx={{ mt: 2, mb: 4 }}>
              {details}
            </Typography>
          )}
          
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<RefreshIcon />}
            onClick={handleRetry}
            sx={{ mt: 4 }}
          >
            Retry
          </Button>
        </Paper>
      </Container>
      
      <Box sx={{ position: 'fixed', bottom: 16, width: '100%', textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          MasjidConnect Display v1.0.0
        </Typography>
      </Box>
    </Box>
  );
};

export default ErrorScreen; 
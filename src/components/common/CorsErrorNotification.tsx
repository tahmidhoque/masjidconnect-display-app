import React, { useState, useEffect } from 'react';
import { 
  Alert, 
  AlertTitle, 
  Box, 
  Button, 
  Dialog, 
  DialogActions, 
  DialogContent, 
  DialogTitle, 
  Typography,
  Collapse
} from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

interface CorsErrorNotificationProps {
  onClose?: () => void;
}

const CorsErrorNotification: React.FC<CorsErrorNotificationProps> = ({ onClose }) => {
  const [open, setOpen] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [errorDetails, setErrorDetails] = useState<{ endpoint: string, message: string } | null>(null);

  useEffect(() => {
    // Listen for CORS errors from the API client
    const handleCorsError = (event: CustomEvent) => {
      setErrorDetails(event.detail);
      setOpen(true);
    };

    window.addEventListener('api:corserror', handleCorsError as EventListener);

    return () => {
      window.removeEventListener('api:corserror', handleCorsError as EventListener);
    };
  }, []);

  const handleClose = () => {
    setOpen(false);
    if (onClose) onClose();
  };

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      aria-labelledby="cors-error-dialog-title"
    >
      <DialogTitle id="cors-error-dialog-title" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ErrorOutlineIcon color="error" />
        <Typography variant="h6" component="span">
          Cross-Origin Resource Sharing (CORS) Error
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>API Server Configuration Issue</AlertTitle>
          The application cannot connect to the API server due to CORS policy restrictions.
          {errorDetails && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Failed endpoint: <strong>{errorDetails.endpoint}</strong>
            </Typography>
          )}
        </Alert>

        <Typography variant="body1" gutterBottom>
          This is a server configuration issue that needs to be fixed on the backend. The API server is not allowing requests from this application's origin.
        </Typography>

        <Box sx={{ mt: 2, mb: 1 }}>
          <Button 
            variant="outlined" 
            size="small" 
            endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={toggleExpanded}
            sx={{ mb: 1 }}
          >
            {expanded ? 'Hide Technical Details' : 'Show Technical Details'}
          </Button>
        </Box>

        <Collapse in={expanded}>
          <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, mt: 1, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              How to Fix This Issue
            </Typography>
            
            <Typography variant="body2" gutterBottom>
              The server needs to add the following headers to all API responses:
            </Typography>
            
            <Box 
              component="pre" 
              sx={{ 
                bgcolor: 'background.paper', 
                p: 2, 
                borderRadius: 1, 
                overflow: 'auto',
                fontSize: '0.85rem'
              }}
            >
{`Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Screen-ID
Access-Control-Max-Age: 86400`}
            </Box>
            
            <Typography variant="body2" gutterBottom sx={{ mt: 2 }}>
              For more detailed instructions, please refer to the CORS Configuration guide.
            </Typography>
            
            <Typography variant="body2" gutterBottom sx={{ mt: 2 }}>
              Temporary workaround for testing: Enable the CORS proxy in your .env file by setting:
            </Typography>
            
            <Box 
              component="pre" 
              sx={{ 
                bgcolor: 'background.paper', 
                p: 2, 
                borderRadius: 1, 
                overflow: 'auto',
                fontSize: '0.85rem'
              }}
            >
{`REACT_APP_USE_CORS_PROXY=true
REACT_APP_CORS_PROXY_URL=https://cors-anywhere.herokuapp.com/`}
            </Box>
            
            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
              Note: This is only a development workaround and should not be used in production.
            </Typography>
          </Box>
        </Collapse>
      </DialogContent>
      
      <DialogActions>
        <Button 
          onClick={handleClose} 
          color="primary"
          variant="contained"
        >
          Understand
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CorsErrorNotification; 
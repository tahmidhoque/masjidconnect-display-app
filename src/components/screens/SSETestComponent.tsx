import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, TextField, Typography, Paper, Switch, FormControlLabel, List, ListItem, Divider } from '@mui/material';

const SSETestComponent: React.FC = () => {
  const [baseUrl, setBaseUrl] = useState<string>(process.env.REACT_APP_API_URL || 'http://localhost:3000');
  const [endpoint, setEndpoint] = useState<string>('/api/sse');
  const [withCredentials, setWithCredentials] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [messages, setMessages] = useState<Array<{text: string; type: string; timestamp: Date}>>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Clean up EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const addMessage = (text: string, type: string = 'info') => {
    setMessages(prev => [...prev, { text, type, timestamp: new Date() }]);
  };

  const connect = () => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      // Format the URL properly
      const formattedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const url = `${formattedBaseUrl}${formattedEndpoint}`;

      addMessage(`Connecting to ${url}${withCredentials ? ' with credentials' : ''}`, 'connection');

      // Create new EventSource
      const eventSource = new EventSource(url, { withCredentials });
      eventSourceRef.current = eventSource;

      // Set up event handlers
      eventSource.onopen = () => {
        addMessage('Connection opened successfully', 'success');
        setIsConnected(true);
      };

      eventSource.onerror = (error) => {
        addMessage(`Connection error: ${JSON.stringify(error)}`, 'error');
        setIsConnected(false);

        // Provide CORS troubleshooting info
        addMessage('Possible CORS solutions:', 'info');
        addMessage('1. Ensure server sends these headers:', 'info');
        addMessage('   Access-Control-Allow-Origin: *', 'info');
        addMessage('   Access-Control-Allow-Methods: GET', 'info');
        addMessage('   Access-Control-Allow-Headers: Content-Type', 'info');
        addMessage('2. If you\'re using auth, try with withCredentials=true', 'info');

        // Close connection on error
        eventSource.close();
        eventSourceRef.current = null;
      };

      // Listen for emergency alert events
      eventSource.addEventListener('EMERGENCY_ALERT', (event) => {
        addMessage(`EMERGENCY_ALERT event received: ${event.data}`, 'event');
      });

      eventSource.addEventListener('EMERGENCY_UPDATE', (event) => {
        addMessage(`EMERGENCY_UPDATE event received: ${event.data}`, 'event');
      });

      eventSource.addEventListener('EMERGENCY_CANCEL', (event) => {
        addMessage(`EMERGENCY_CANCEL event received: ${event.data}`, 'event');
      });

      // Generic message handler
      eventSource.onmessage = (event) => {
        addMessage(`Generic message: ${event.data}`, 'message');
      };

    } catch (error) {
      if (error instanceof Error) {
        addMessage(`Error creating connection: ${error.message}`, 'error');
      }
      setIsConnected(false);
    }
  };

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      addMessage('Connection closed', 'connection');
      setIsConnected(false);
    }
  };

  // Test CORS headers manually
  const testCors = async () => {
    try {
      const formattedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const testUrl = `${formattedBaseUrl}/health`; // Use a simple endpoint to test CORS
      
      addMessage(`Testing CORS with fetch to ${testUrl}`, 'info');
      
      const response = await fetch(testUrl, {
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // Fix TypeScript errors by using a record type and Array.from
      const headers: Record<string, string> = {};
      Array.from(response.headers).forEach(([key, value]) => {
        headers[key] = value;
      });
      
      addMessage(`CORS test success - Status: ${response.status}`, 'success');
      addMessage(`Response headers: ${JSON.stringify(headers)}`, 'info');
    } catch (error) {
      if (error instanceof Error) {
        addMessage(`CORS test failed: ${error.message}`, 'error');
      }
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: '800px', margin: '0 auto' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        SSE Connection Test
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ mb: 2 }}>
          <TextField
            label="API Base URL"
            variant="outlined"
            fullWidth
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            margin="normal"
          />
        </Box>
        
        <Box sx={{ mb: 2 }}>
          <TextField
            label="SSE Endpoint"
            variant="outlined"
            fullWidth
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            margin="normal"
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={withCredentials}
                onChange={(e) => setWithCredentials(e.target.checked)}
              />
            }
            label="Use withCredentials"
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="contained" 
            onClick={connect}
            disabled={isConnected}
          >
            Connect
          </Button>
          <Button 
            variant="outlined" 
            onClick={disconnect}
            disabled={!isConnected}
          >
            Disconnect
          </Button>
          <Button 
            variant="outlined" 
            onClick={testCors}
            color="secondary"
          >
            Test CORS
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="h6" component="h2" gutterBottom>
          Connection Status: {isConnected ? 'Connected' : 'Disconnected'}
        </Typography>
        
        <Typography variant="h6" component="h2" gutterBottom>
          Connection Log:
        </Typography>
        
        <Paper 
          elevation={1} 
          sx={{
            maxHeight: '400px',
            overflow: 'auto',
            p: 1,
            backgroundColor: '#f5f5f5'
          }}
        >
          <List>
            {messages.map((msg, index) => (
              <React.Fragment key={index}>
                <ListItem sx={{
                  color: 
                    msg.type === 'error' ? 'error.main' :
                    msg.type === 'success' ? 'success.main' :
                    msg.type === 'event' ? 'info.main' :
                    'text.primary',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  py: 0.5
                }}>
                  <Typography variant="body2" component="span" sx={{ mr: 1 }}>
                    [{msg.timestamp.toLocaleTimeString()}]
                  </Typography>
                  {msg.text}
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}
            <div ref={messagesEndRef} />
          </List>
        </Paper>
      </Paper>
    </Box>
  );
};

export default SSETestComponent; 
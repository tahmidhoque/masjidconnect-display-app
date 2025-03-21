/**
 * SSE Testing Utilities
 * 
 * This file contains helper functions to test Server-Sent Events (SSE) connections.
 * Run these tests from the browser console to diagnose SSE connection issues.
 */

// Test SSE connection with various options
export const testSSEConnection = (baseUrl = null, withCredentials = false) => {
  // Use provided baseUrl or get from environment
  const url = baseUrl || process.env.REACT_APP_API_URL || 'https://api.masjid.app';
  const endpoint = '/api/sse';
  const fullUrl = `${url}${endpoint}`;
  
  console.log(`===== TESTING SSE CONNECTION =====`);
  console.log(`URL: ${fullUrl}`);
  console.log(`withCredentials: ${withCredentials}`);
  
  // Create a div to display results
  const resultDiv = document.createElement('div');
  resultDiv.id = 'sse-test-results';
  resultDiv.style.position = 'fixed';
  resultDiv.style.top = '50px';
  resultDiv.style.left = '50px';
  resultDiv.style.zIndex = '10000';
  resultDiv.style.backgroundColor = '#fff';
  resultDiv.style.border = '1px solid #ccc';
  resultDiv.style.padding = '10px';
  resultDiv.style.maxWidth = '80%';
  resultDiv.style.maxHeight = '80%';
  resultDiv.style.overflow = 'auto';
  resultDiv.style.fontFamily = 'monospace';
  resultDiv.style.fontSize = '12px';
  
  // Add a close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '5px';
  closeButton.style.right = '5px';
  closeButton.addEventListener('click', () => {
    document.body.removeChild(resultDiv);
    if (eventSource) {
      eventSource.close();
    }
  });
  
  resultDiv.appendChild(closeButton);
  
  // Add a title
  const title = document.createElement('h3');
  title.textContent = 'SSE Connection Test';
  resultDiv.appendChild(title);
  
  // Add status display
  const statusDisplay = document.createElement('div');
  statusDisplay.id = 'sse-status';
  statusDisplay.textContent = 'Connecting...';
  resultDiv.appendChild(statusDisplay);
  
  // Add log display
  const logDisplay = document.createElement('pre');
  logDisplay.id = 'sse-log';
  logDisplay.style.maxHeight = '400px';
  logDisplay.style.overflow = 'auto';
  logDisplay.style.backgroundColor = '#f5f5f5';
  logDisplay.style.padding = '5px';
  logDisplay.style.border = '1px solid #ddd';
  resultDiv.appendChild(logDisplay);
  
  document.body.appendChild(resultDiv);
  
  // Function to add log entries
  const log = (message, type = 'info') => {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.style.borderBottom = '1px solid #eee';
    entry.style.padding = '2px 0';
    
    // Set color based on type
    if (type === 'error') {
      entry.style.color = 'red';
    } else if (type === 'success') {
      entry.style.color = 'green';
    } else if (type === 'event') {
      entry.style.color = 'blue';
    }
    
    // Add timestamp
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${message}`;
    
    const logDisplay = document.getElementById('sse-log');
    if (logDisplay) {
      logDisplay.appendChild(entry);
      logDisplay.scrollTop = logDisplay.scrollHeight;
    }
    
    // Also log to console
    if (type === 'error') {
      console.error(message);
    } else {
      console.log(message);
    }
  };
  
  // Create the EventSource
  log(`Creating EventSource for ${fullUrl}`);
  
  let eventSource;
  try {
    eventSource = new EventSource(fullUrl, { withCredentials });
    
    // Update status display
    const updateStatus = (status, color = 'black') => {
      const statusDisplay = document.getElementById('sse-status');
      if (statusDisplay) {
        statusDisplay.textContent = status;
        statusDisplay.style.color = color;
      }
    };
    
    // Set up event handlers
    eventSource.onopen = (event) => {
      log(`Connection opened`, 'success');
      updateStatus('Connected', 'green');
    };
    
    eventSource.onerror = (error) => {
      log(`Connection error: ${JSON.stringify(error)}`, 'error');
      updateStatus('Error connecting', 'red');
      
      // Suggest CORS fixes
      log('Possible solutions for CORS issues:', 'info');
      log('1. Ensure server has these headers:', 'info');
      log('   Access-Control-Allow-Origin: *', 'info');
      log('   Access-Control-Allow-Methods: GET', 'info');
      log('   Access-Control-Allow-Headers: Content-Type', 'info');
      log('2. Try using withCredentials=true if authentication is required', 'info');
      log('3. Check if your URL is correct', 'info');
    };
    
    // Listen for all types of alerts
    eventSource.addEventListener('EMERGENCY_ALERT', (event) => {
      log(`EMERGENCY_ALERT event received: ${event.data}`, 'event');
    });
    
    eventSource.addEventListener('EMERGENCY_UPDATE', (event) => {
      log(`EMERGENCY_UPDATE event received: ${event.data}`, 'event');
    });
    
    eventSource.addEventListener('EMERGENCY_CANCEL', (event) => {
      log(`EMERGENCY_CANCEL event received: ${event.data}`, 'event');
    });
    
    // Generic message handler
    eventSource.onmessage = (event) => {
      log(`Generic message received: ${event.data}`, 'event');
    };
    
    log('EventSource initialized with event listeners');
    
    // Add a button to close the connection
    const closeEventButton = document.createElement('button');
    closeEventButton.textContent = 'Close Connection';
    closeEventButton.addEventListener('click', () => {
      if (eventSource) {
        eventSource.close();
        log('Connection closed by user', 'info');
        updateStatus('Disconnected', 'red');
      }
    });
    resultDiv.appendChild(closeEventButton);
    
    // Return the eventSource for further inspection
    return eventSource;
  } catch (error) {
    log(`Error creating EventSource: ${error.message}`, 'error');
    return null;
  }
};

// Make function available on window for console access
if (typeof window !== 'undefined') {
  window.sseTest = {
    testSSEConnection
  };
  console.log('SSE testing utility loaded. Use window.sseTest.testSSEConnection() in the console to test.');
}

export default {
  testSSEConnection
}; 
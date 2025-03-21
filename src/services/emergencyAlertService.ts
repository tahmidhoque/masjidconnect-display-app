import { EmergencyAlert } from '../api/models';
import logger from '../utils/logger';
import storageService from './storageService';
import { DebugEventSource } from '../utils/debugEventSource';

// Event Types for SSE
const EVENT_TYPES = {
  ALERT: 'EMERGENCY_ALERT',
  UPDATE: 'EMERGENCY_UPDATE',
  CANCEL: 'EMERGENCY_CANCEL'
};

// Storage key for offline persistence
const STORAGE_KEY = 'emergency_alert';

class EmergencyAlertService {
  private eventSource: EventSource | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 5000; // 5 seconds
  private listeners: Set<(alert: EmergencyAlert | null) => void> = new Set();
  private currentAlert: EmergencyAlert | null = null;
  private expirationTimer: NodeJS.Timeout | null = null;
  private connectionUrl: string | null = null;

  /**
   * Initialize the SSE connection to listen for emergency alerts
   */
  public initialize(baseURL: string): void {
    logger.info('EmergencyAlertService: Initializing', { baseURL });
    console.log('🚨 EmergencyAlertService: Initializing with baseURL:', baseURL);
    this.loadSavedAlert();
    
    // Try connecting with both endpoints to ensure compatibility
    this.connectToEventSource(baseURL);
  }

  /**
   * Connect to the SSE endpoint
   */
  private connectToEventSource(baseURL: string): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    try {
      // Make sure we have no duplicate slashes in the URL
      const base = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
      
      // Use the correct endpoint for SSE
      const endpoint = '/api/sse'; 
      this.connectionUrl = `${base}${endpoint}`;
      
      logger.info(`EmergencyAlertService: Connecting to SSE at ${this.connectionUrl}`);
      console.log(`🚨 EmergencyAlertService: Connecting to SSE at ${this.connectionUrl}`);
      
      // Use our enhanced DebugEventSource for better debugging
      const options = { withCredentials: false };
      const eventSource = process.env.NODE_ENV === 'development'
        ? new DebugEventSource(this.connectionUrl, options) as unknown as EventSource
        : new EventSource(this.connectionUrl, options);
        
      this.eventSource = eventSource;
      
      console.log('🚨 EmergencyAlertService: EventSource created', eventSource);
      
      // Add connection status UI indicator
      this.addConnectionIndicator(this.connectionUrl);

      // Set up event handlers as in the working test
      eventSource.onopen = () => {
        console.log('🚨 EmergencyAlertService: Connection opened successfully');
        logger.info('EmergencyAlertService: SSE connection established');
        this.updateConnectionIndicator(true);
        this.reconnectAttempts = 0; // Reset reconnect attempts on success
      };
      
      // Add additional test events to catch different formats from the server
      eventSource.addEventListener('EMERGENCY_ALERT', this.handleAlertEvent);
      eventSource.addEventListener('EMERGENCY_UPDATE', this.handleUpdateEvent);
      eventSource.addEventListener('EMERGENCY_CANCEL', this.handleCancelEvent);
      
      // Add lowercase variants
      eventSource.addEventListener('emergency_alert', this.handleAlertEvent);
      eventSource.addEventListener('emergency_update', this.handleUpdateEvent);
      eventSource.addEventListener('emergency_cancel', this.handleCancelEvent);
      
      // Add camelCase variants
      eventSource.addEventListener('emergencyAlert', this.handleAlertEvent);
      eventSource.addEventListener('emergencyUpdate', this.handleUpdateEvent);
      eventSource.addEventListener('emergencyCancel', this.handleCancelEvent);
      
      // Generic message handler for any unhandled messages
      eventSource.onmessage = this.handleGenericMessage;
      
      // Standard error handler
      // Add standard error handler
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        this.updateConnectionIndicator(false);
        this.handleConnectionError(error);
      };
    } catch (error) {
      logger.error('EmergencyAlertService: Error connecting to SSE', { error });
      console.error('🚨 EmergencyAlertService: Error connecting to SSE:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Add a visual indicator for SSE connection status
   */
  private addConnectionIndicator(url: string): void {
    // Check if we already have an indicator
    let indicator = document.getElementById('sse-connection-indicator');
    
    if (!indicator) {
      // Create the indicator element
      indicator = document.createElement('div');
      indicator.id = 'sse-connection-indicator';
      indicator.style.position = 'fixed';
      indicator.style.top = '10px';
      indicator.style.right = '10px';
      indicator.style.padding = '5px 10px';
      indicator.style.borderRadius = '4px';
      indicator.style.fontSize = '12px';
      indicator.style.fontFamily = 'monospace';
      indicator.style.zIndex = '10000';
      indicator.style.cursor = 'pointer';
      indicator.title = 'SSE Connection Status';
      
      // Add a click handler to show more details
      indicator.onclick = () => {
        alert(`SSE Connection Details:
URL: ${url}
Status: ${this.eventSource ? 'Connected' : 'Disconnected'}
Ready State: ${this.eventSource ? this.eventSource.readyState : 'N/A'}
Reconnect Attempts: ${this.reconnectAttempts}`);
      };
      
      document.body.appendChild(indicator);
    }
    
    // Initial state
    this.updateConnectionIndicator(false);
  }

  /**
   * Update the connection indicator status
   */
  private updateConnectionIndicator(connected: boolean): void {
    const indicator = document.getElementById('sse-connection-indicator');
    if (!indicator) return;
    
    if (connected) {
      indicator.style.backgroundColor = '#4caf50';
      indicator.style.color = 'white';
      indicator.textContent = '● SSE Connected';
    } else {
      indicator.style.backgroundColor = '#f44336';
      indicator.style.color = 'white';
      indicator.textContent = '○ SSE Disconnected';
    }
  }

  /**
   * Handle generic messages (non-specific events)
   */
  private handleGenericMessage = (event: MessageEvent): void => {
    console.log('🚨 EmergencyAlertService: Received generic message:', event.data);
    
    try {
      const data = JSON.parse(event.data);
      
      // Check if this looks like an alert
      if (data && data.title && data.message && data.expiresAt) {
        console.log('🚨 EmergencyAlertService: Generic message appears to be an alert:', data);
        this.setCurrentAlert(data);
      }
    } catch (error) {
      console.log('🚨 EmergencyAlertService: Not a JSON message or not an alert format:', event.data);
    }
  };

  /**
   * Set up event listeners for the EventSource
   */
  private setupEventListeners(eventSource: EventSource): void {
    // Set up event listeners for different alert types
    eventSource.addEventListener(EVENT_TYPES.ALERT, this.handleAlertEvent);
    eventSource.addEventListener(EVENT_TYPES.UPDATE, this.handleUpdateEvent);
    eventSource.addEventListener(EVENT_TYPES.CANCEL, this.handleCancelEvent);
    
    // Add listeners for alternative event names
    eventSource.addEventListener('emergency_alert', this.handleAlertEvent);
    eventSource.addEventListener('emergencyAlert', this.handleAlertEvent);
    eventSource.addEventListener('emergency', this.handleAlertEvent);
    eventSource.addEventListener('alert', this.handleAlertEvent);
  }

  /**
   * Get credentials for authentication
   */
  private getCredentials() {
    try {
      // First try to get from storage service
      const apiKey = localStorage.getItem('masjid_api_key') || localStorage.getItem('apiKey');
      const screenId = localStorage.getItem('masjid_screen_id') || localStorage.getItem('screenId');
      
      if (apiKey && screenId) {
        return { apiKey, screenId };
      }
      
      return null;
    } catch (error) {
      logger.error('EmergencyAlertService: Error getting credentials', { error });
      return null;
    }
  }

  /**
   * Handle successful connection
   */
  private handleConnectionOpen = (): void => {
    logger.info('EmergencyAlertService: SSE connection established');
    console.log('🚨 EmergencyAlertService: SSE connection established!');
    // Reset reconnect attempts on successful connection
    this.reconnectAttempts = 0;
  };

  /**
   * Handle connection errors
   */
  private handleConnectionError = (error: Event): void => {
    logger.error('EmergencyAlertService: SSE connection error', { error });
    console.error('🚨 EmergencyAlertService: SSE connection error:', error);
    
    // Clean up existing connection
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.scheduleReconnect();
  };

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn('EmergencyAlertService: Maximum reconnect attempts reached');
      return;
    }

    // Calculate backoff time with exponential increase and jitter
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      60000 // Max 1 minute
    ) * (0.8 + Math.random() * 0.4); // Add 20% jitter

    logger.info(`EmergencyAlertService: Scheduling reconnect in ${delay / 1000}s (attempt ${this.reconnectAttempts + 1})`);
    
    // Follow exact reconnection logic from documentation
    this.reconnectTimeout = setTimeout(() => {
      if (this.eventSource) {
        this.eventSource.close();
      }
      this.reconnectAttempts++;
      
      // Use the development URL in development mode for consistency
      const baseURL = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000' 
        : (process.env.REACT_APP_API_URL || 'https://api.masjid.app');
        
      this.connectToEventSource(baseURL);
    }, delay);
  }

  /**
   * Handle a new emergency alert
   */
  private handleAlertEvent = (event: MessageEvent): void => {
    console.log('🚨 EmergencyAlertService: EMERGENCY_ALERT event received:', event.data);
    try {
      let alertData: EmergencyAlert;
      
      // Try to parse the data - handle both string and object formats
      if (typeof event.data === 'string') {
        alertData = JSON.parse(event.data) as EmergencyAlert;
      } else {
        alertData = event.data as EmergencyAlert;
      }
      
      // Validate required fields
      if (!alertData || !alertData.title || !alertData.message) {
        console.error('🚨 EmergencyAlertService: Invalid alert data format:', alertData);
        return;
      }
      
      // Ensure id exists (generate one if missing)
      if (!alertData.id) {
        alertData.id = `alert-${Date.now()}`;
      }
      
      // Ensure expiresAt exists (default to 30 minutes if missing)
      if (!alertData.expiresAt) {
        alertData.expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      }
      
      // Ensure createdAt exists
      if (!alertData.createdAt) {
        alertData.createdAt = new Date().toISOString();
      }
      
      console.log('🚨 EmergencyAlertService: Parsed alert data:', alertData);
      // Display the alert
      this.setCurrentAlert(alertData);
    } catch (error) {
      console.error('🚨 EmergencyAlertService: Error parsing alert data:', error);
      // Try to extract any useful information from the raw event
      this.tryParseRawAlert(event.data);
    }
  };

  /**
   * Handle an update to an existing alert
   */
  private handleUpdateEvent = (event: MessageEvent): void => {
    try {
      let alertData: EmergencyAlert;
      
      // Try to parse the data - handle both string and object formats
      if (typeof event.data === 'string') {
        alertData = JSON.parse(event.data) as EmergencyAlert;
      } else {
        alertData = event.data as EmergencyAlert;
      }
      
      console.log('🚨 EmergencyAlertService: EMERGENCY_UPDATE event received:', alertData);
      
      // Only update if we have the required fields
      if (alertData && alertData.id) {
        this.setCurrentAlert(alertData);
      }
    } catch (error) {
      console.error('🚨 EmergencyAlertService: Error parsing alert update data:', error);
    }
  };

  /**
   * Handle a canceled alert
   */
  private handleCancelEvent = (event: MessageEvent): void => {
    console.log('🚨 EmergencyAlertService: EMERGENCY_CANCEL event received, raw data:', event.data);
    
    try {
      // Handle different formats of cancel data
      let alertId: string | undefined;
      
      if (typeof event.data === 'string') {
        try {
          // Try to parse as JSON
          const data = JSON.parse(event.data);
          alertId = data.id || data.alertId;
        } catch (parseError) {
          // If it's not JSON, it might be just the ID as a string
          alertId = event.data;
        }
      } else if (typeof event.data === 'object' && event.data !== null) {
        // It's already an object
        const data = event.data;
        alertId = data.id || data.alertId;
      }
      
      console.log('🚨 EmergencyAlertService: Extracted alert ID for cancellation:', alertId);
      
      // If we have a current alert and the ID matches, clear it
      if (alertId && this.currentAlert) {
        if (this.currentAlert.id === alertId || alertId === '*') {
          console.log('🚨 EmergencyAlertService: Canceling alert with ID:', this.currentAlert.id);
          this.clearCurrentAlert();
        } else {
          console.log('🚨 EmergencyAlertService: Cancel ID does not match current alert ID:', {
            cancelId: alertId,
            currentAlertId: this.currentAlert.id
          });
        }
      } else {
        console.log('🚨 EmergencyAlertService: No current alert to cancel or no ID provided');
      }
    } catch (error) {
      console.error('🚨 EmergencyAlertService: Error processing alert cancellation:', error);
    }
  };

  /**
   * Set the current alert and schedule its expiration
   * This follows the displayEmergencyAlert pattern from documentation
   */
  private setCurrentAlert(alert: EmergencyAlert): void {
    // Clear any existing expiration timer
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }
    
    // Set the new alert
    this.currentAlert = alert;
    
    // Save to local storage for offline fallback - exactly as shown in documentation
    localStorage.setItem('emergencyAlert', JSON.stringify(alert));
    
    // Schedule automatic expiration - exactly as shown in documentation
    const expiresAt = new Date(alert.expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = Math.max(0, expiresAt - now);
    
    if (timeUntilExpiry > 0) {
      console.log(`EmergencyAlertService: Alert will expire in ${timeUntilExpiry / 1000}s`);
      this.expirationTimer = setTimeout(() => {
        console.log('EmergencyAlertService: Alert expired automatically');
        this.clearCurrentAlert();
      }, timeUntilExpiry);
    } else {
      console.warn('EmergencyAlertService: Received already expired alert');
      this.clearCurrentAlert();
      return;
    }
    
    // Notify all listeners
    this.notifyListeners();
  }

  /**
   * Clear the current alert
   */
  private clearCurrentAlert(): void {
    this.currentAlert = null;
    
    // Clear from storage - using the exact localStorage method from the documentation
    localStorage.removeItem('emergencyAlert');
    
    // Clear any existing expiration timer
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }
    
    // Notify all listeners
    this.notifyListeners();
  }

  /**
   * Add a listener for alert changes
   */
  public addListener(callback: (alert: EmergencyAlert | null) => void): () => void {
    this.listeners.add(callback);
    
    // Immediately call with current state
    if (this.currentAlert) {
      callback(this.currentAlert);
    }
    
    // Return a function to remove the listener
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of the current alert state
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentAlert);
      } catch (error) {
        logger.error('EmergencyAlertService: Error notifying listener', { error });
      }
    });
  }

  /**
   * Load any saved alert from storage on startup
   * Follows the exact pattern in the documentation
   */
  private async loadSavedAlert(): Promise<void> {
    try {
      // Follow exactly the pattern in the documentation
      const savedAlertJson = localStorage.getItem('emergencyAlert');
      if (!savedAlertJson) return;
      
      const savedAlert = JSON.parse(savedAlertJson);
      
      if (savedAlert) {
        const expiresAt = new Date(savedAlert.expiresAt).getTime();
        const now = Date.now();
        
        // Only restore if the alert hasn't expired
        if (expiresAt > now) {
          console.log('EmergencyAlertService: Restoring saved alert from storage', savedAlert);
          this.setCurrentAlert(savedAlert);
        } else {
          console.log('EmergencyAlertService: Saved alert has expired, removing from storage');
          localStorage.removeItem('emergencyAlert');
        }
      }
    } catch (error) {
      console.error('EmergencyAlertService: Error loading saved alert', error);
    }
  }

  /**
   * Get the current alert
   */
  public getCurrentAlert(): EmergencyAlert | null {
    return this.currentAlert;
  }

  /**
   * Clean up resources on unmount
   */
  public cleanup(): void {
    logger.info('EmergencyAlertService: Cleaning up');
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }
    
    this.listeners.clear();
  }

  /**
   * Create a test alert for debugging purposes
   */
  public createTestAlert(): void {
    console.log('🚨 EmergencyAlertService: Creating test alert');
    
    const testAlert: EmergencyAlert = {
      id: 'test-alert-' + Date.now(),
      title: 'Test Emergency Alert',
      message: 'This is a test of the emergency alert system. If you can see this message, the alert display is working properly.',
      color: '#e74c3c', // Red color
      expiresAt: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
      createdAt: new Date().toISOString(),
      masjidId: 'test-masjid-id'
    };
    
    console.log('🚨 EmergencyAlertService: Test alert created:', testAlert);
    this.setCurrentAlert(testAlert);
  }

  /**
   * Get the current connection status and URL
   */
  public getConnectionStatus(): { connected: boolean, url: string | null, readyState: number | null } {
    return {
      connected: !!this.eventSource && this.eventSource.readyState === EventSource.OPEN,
      url: this.connectionUrl,
      readyState: this.eventSource ? this.eventSource.readyState : null
    };
  }

  /**
   * Test the SSE connection and provide detailed diagnostic information
   */
  public testConnection(): void {
    console.log('🚨 EmergencyAlertService: Testing SSE connection...');
    
    // Check if we have an active event source
    if (!this.eventSource) {
      console.error('🚨 EmergencyAlertService: No active EventSource connection!');
      console.log('🚨 Trying to create a new connection...');
      
      // Try to reinitialize
      this.initialize(process.env.REACT_APP_API_URL || 'https://api.masjid.app');
      return;
    }
    
    // Check EventSource readyState
    const readyStateMap = {
      0: 'CONNECTING',
      1: 'OPEN',
      2: 'CLOSED'
    };
    
    const readyState = this.eventSource.readyState;
    const readyStateText = readyStateMap[readyState as keyof typeof readyStateMap] || 'UNKNOWN';
    
    console.log('🚨 EventSource ready state:', readyStateText, `(${readyState})`);
    console.log('🚨 Connection URL:', this.connectionUrl);
    
    // Get credentials to check if they might be the issue
    const credentials = this.getCredentials();
    console.log('🚨 Credentials available:', !!credentials);
    
    if (credentials) {
      console.log('🚨 API Key (masked):', 
        credentials.apiKey ? `${credentials.apiKey.substring(0, 3)}...${credentials.apiKey.slice(-3)}` : 'None');
      console.log('🚨 Screen ID (masked):', 
        credentials.screenId ? `${credentials.screenId.substring(0, 3)}...${credentials.screenId.slice(-3)}` : 'None');
    }
    
    // Check if we're connected and the Network tab shows the connection
    console.log(`
🚨 TROUBLESHOOTING:
1. Check Network tab: You should see a persistent connection to ${this.connectionUrl}
2. The connection should have status 200 and type "event-stream"
3. If you don't see it, make sure there are no CORS issues
4. If you see error 401, check your credentials

Try to manually create a test alert to verify the UI works: emergencyAlertService.createTestAlert()
    `);
    
    // Update the connection indicator
    this.updateConnectionIndicator(readyState === 1);
  }

  /**
   * Try to extract alert information from raw data
   */
  private tryParseRawAlert(data: any): void {
    console.log('🚨 EmergencyAlertService: Attempting to parse raw alert data:', data);
    
    try {
      // If it's a string but not JSON, use it as a message
      if (typeof data === 'string' && data.trim() !== '') {
        // Create a simple alert from the string
        const simpleAlert: EmergencyAlert = {
          id: `raw-alert-${Date.now()}`,
          title: 'Emergency Alert',
          message: data,
          color: '#e74c3c',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
          masjidId: 'unknown'
        };
        
        console.log('🚨 EmergencyAlertService: Created simple alert from string:', simpleAlert);
        this.setCurrentAlert(simpleAlert);
      } 
      // If it's an object with useful fields but not matching our exact format
      else if (typeof data === 'object' && data !== null) {
        const message = data.message || data.text || data.content || data.body || 'Emergency alert received';
        const title = data.title || data.subject || data.name || 'Emergency Alert';
        
        const reconstructedAlert: EmergencyAlert = {
          id: data.id || `reconstructed-alert-${Date.now()}`,
          title: title,
          message: message,
          color: data.color || '#e74c3c',
          expiresAt: data.expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          createdAt: data.createdAt || new Date().toISOString(),
          masjidId: data.masjidId || 'unknown'
        };
        
        console.log('🚨 EmergencyAlertService: Reconstructed alert from object:', reconstructedAlert);
        this.setCurrentAlert(reconstructedAlert);
      }
    } catch (error) {
      console.error('🚨 EmergencyAlertService: Failed to extract alert from raw data:', error);
    }
  }
}

const emergencyAlertService = new EmergencyAlertService();

// Make service available in global scope for testing via console
if (typeof window !== 'undefined') {
  (window as any).emergencyAlertService = emergencyAlertService;
}

export default emergencyAlertService; 
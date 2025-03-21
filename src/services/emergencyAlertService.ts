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
    try {
      // Close existing connection if any
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      
      // Use the correct endpoint for SSE
      const endpoint = '/api/sse';
      this.connectionUrl = `${baseURL}${endpoint}`;
      
      logger.info(`EmergencyAlertService: Connecting to SSE at ${this.connectionUrl}`);
      console.log(`🚨 EmergencyAlertService: Connecting to SSE at ${this.connectionUrl}`);
      
      // Create a new EventSource
      let eventSource: EventSource;
      if (process.env.NODE_ENV === 'development') {
        // Cast DebugEventSource to EventSource for compatibility
        eventSource = new DebugEventSource(this.connectionUrl, {
          withCredentials: true,
        }) as unknown as EventSource;
      } else {
        eventSource = new EventSource(this.connectionUrl, {
          withCredentials: true,
        });
      }
      
      this.eventSource = eventSource;
      
      // Setup event listeners
      this.setupEventListeners(eventSource);
      
      // Handle open event
      eventSource.onopen = this.handleConnectionOpen;
      
      // Handle error events
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        this.handleConnectionError(error);
      };
    } catch (error) {
      logger.error('EmergencyAlertService: Error connecting to SSE', { error });
      console.error('🚨 EmergencyAlertService: Error connecting to SSE:', error);
      this.scheduleReconnect();
    }
  }

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
    this.reconnectAttempts = 0;
    logger.info('EmergencyAlertService: SSE connection established');
    console.log('🚨 EmergencyAlertService: SSE connection established!');
    
    // Load any saved alert data
    this.loadSavedAlert();
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
   * Get current connection status for debugging
   */
  public getConnectionStatus(): { connected: boolean, url: string | null, readyState: number | null } {
    return {
      connected: this.eventSource !== null && this.eventSource.readyState === 1,
      url: this.connectionUrl,
      readyState: this.eventSource ? this.eventSource.readyState : null
    };
  }

  /**
   * Handle an alert that comes in via the API instead of SSE
   */
  private tryParseRawAlert(data: any): void {
    try {
      // Check if it's already a valid object
      if (typeof data === 'object' && data !== null) {
        if (data.id && data.title && data.message && data.expiresAt) {
          this.setCurrentAlert(data as EmergencyAlert);
          return;
        }
      }
      
      // Try to parse as JSON string
      if (typeof data === 'string') {
        const parsed = JSON.parse(data);
        if (parsed && parsed.id && parsed.title && parsed.message && parsed.expiresAt) {
          this.setCurrentAlert(parsed as EmergencyAlert);
          return;
        }
      }
      
      logger.warn('EmergencyAlertService: Raw alert data not valid for emergency alert', { data });
    } catch (e) {
      logger.error('EmergencyAlertService: Error parsing raw alert data', { error: e });
    }
  }
}

const emergencyAlertService = new EmergencyAlertService();

// Make service available in global scope for testing via console
if (typeof window !== 'undefined') {
  (window as any).emergencyAlertService = emergencyAlertService;
}

export default emergencyAlertService; 
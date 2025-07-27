import logger from '../utils/logger';
import { DebugEventSource } from '../utils/debugEventSource';

// Define Orientation type locally instead of importing from context
type Orientation = 'LANDSCAPE' | 'PORTRAIT';

// Event Types for SSE
const EVENT_TYPES = {
  PRIMARY: 'SCREEN_ORIENTATION'
};

// Interface for orientation event payload
interface OrientationEventPayload {
  id: string;            // Screen ID
  orientation: Orientation;   // Either 'LANDSCAPE' or 'PORTRAIT'
  updatedAt: string;     // ISO date string when the orientation was updated
}

class OrientationEventService {
  private eventSource: EventSource | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 5000; // 5 seconds
  private listeners: Set<(orientation: Orientation, screenId: string) => void> = new Set();
  private connectionUrl: string | null = null;
  private currentScreenId: string | null = null;
  private lastOrientationUpdate: { orientation: Orientation, timestamp: number } | null = null;
  private orientationUpdateDebounceTime = 2000; // 2 seconds debounce

  /**
   * Set the current screen ID
   */
  public setScreenId(screenId: string): void {
    this.currentScreenId = screenId;
  }

  /**
   * Initialize the SSE connection to listen for orientation updates
   * This reuses the same SSE connection as emergency alerts
   */
  public initialize(baseURL: string): void {
    logger.info('OrientationEventService: Initializing', { baseURL });
    
    // Try connecting with endpoint
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
      
      // Use the correct endpoint for SSE with required query parameters
      const endpoint = '/api/sse';
      
      // Get masjidId from localStorage (needed according to the documentation)
      const masjidId = localStorage.getItem('masjidId');
      
      // Build the URL with required query parameters
      let url = `${baseURL}${endpoint}`;
      const params = new URLSearchParams();
      
      if (this.currentScreenId) {
        params.append('screenId', this.currentScreenId);
      }
      
      if (masjidId) {
        params.append('masjidId', masjidId);
      }
      
      // Add the query parameters if we have any
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      this.connectionUrl = url;
      
      logger.info(`OrientationEventService: Connecting to SSE at ${this.connectionUrl}`);
      console.log(`🔌 OrientationEventService: Connecting to SSE at ${this.connectionUrl}`);
      
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
        console.error('OrientationEventService: SSE connection error:', error);
        this.handleConnectionError(error);
      };
    } catch (error) {
      logger.error('OrientationEventService: Error connecting to SSE', { error });
      this.scheduleReconnect();
    }
  }

  /**
   * Set up event listeners for the EventSource
   */
  private setupEventListeners(eventSource: EventSource): void {
    // Set up event listener for the primary orientation update event
    // This is the event documented by the backend team
    eventSource.addEventListener(EVENT_TYPES.PRIMARY, this.handleOrientationEvent);
    
    // Log which event we're listening for
    console.log(`🔍 OrientationEventService: Registered listener for primary event: ${EVENT_TYPES.PRIMARY}`);
  }

  /**
   * Handle successful connection
   */
  private handleConnectionOpen = (): void => {
    this.reconnectAttempts = 0;
    logger.info('OrientationEventService: SSE connection established');
    console.log('🔌 OrientationEventService: SSE connection established', {
      url: this.connectionUrl,
      readyState: this.eventSource?.readyState,
      registeredEventTypes: EVENT_TYPES
    });
    
    // Log available event types
    if (this.eventSource) {
      console.log('🔍 OrientationEventService: Registered event listeners for:', [
        EVENT_TYPES.PRIMARY
      ]);
    }
  };

  /**
   * Handle connection errors
   */
  private handleConnectionError = (error: Event): void => {
    logger.error('OrientationEventService: SSE connection error', { error });
    
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
      logger.warn('OrientationEventService: Maximum reconnect attempts reached');
      return;
    }

    // Calculate backoff time with exponential increase and jitter
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      60000 // Max 1 minute
    ) * (0.8 + Math.random() * 0.4); // Add 20% jitter

    logger.info(`OrientationEventService: Scheduling reconnect in ${delay / 1000}s (attempt ${this.reconnectAttempts + 1})`);
    
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
   * Handle an orientation update event
   */
  private handleOrientationEvent = (event: MessageEvent): void => {
    // Log the raw event data for debugging
    console.log('🔍 OrientationEventService: SCREEN_ORIENTATION event received:', {
      type: event.type,
      data: typeof event.data === 'string' ? event.data.substring(0, 100) : event.data,
    });
    
    try {
      // Parse the data according to the expected payload format
      let orientationData: OrientationEventPayload;
      
      // Try to parse the data - handle both string and object formats
      if (typeof event.data === 'string') {
        orientationData = JSON.parse(event.data) as OrientationEventPayload;
      } else {
        orientationData = event.data as OrientationEventPayload;
      }
      
      // Log the parsed data
      console.log('🔍 OrientationEventService: Parsed orientation data:', orientationData);
      
      // Validate that we have the necessary data
      if (!orientationData || !orientationData.id || !orientationData.orientation) {
        logger.error('OrientationEventService: Invalid orientation data format', { orientationData });
        console.error('❌ OrientationEventService: Missing required fields in orientation data');
        return;
      }
      
      // Validate the orientation value
      if (orientationData.orientation !== 'LANDSCAPE' && orientationData.orientation !== 'PORTRAIT') {
        logger.error('OrientationEventService: Invalid orientation value', { 
          orientation: orientationData.orientation 
        });
        console.error(`❌ OrientationEventService: Invalid orientation value: ${orientationData.orientation}`);
        return;
      }
      
      // Check if this event is for our screen
      if (this.currentScreenId && orientationData.id !== this.currentScreenId) {
        logger.debug('OrientationEventService: Ignoring orientation update for different screen', { 
          receivedId: orientationData.id, 
          currentId: this.currentScreenId 
        });
        console.log(`⏭️ OrientationEventService: Ignoring orientation update for screen ${orientationData.id} (we are ${this.currentScreenId})`);
        return;
      }
      
      // Check for debounce - if we've received the same orientation recently, ignore it
      const now = Date.now();
      if (this.lastOrientationUpdate && 
          this.lastOrientationUpdate.orientation === orientationData.orientation &&
          now - this.lastOrientationUpdate.timestamp < this.orientationUpdateDebounceTime) {
        console.log(`⏭️ OrientationEventService: Debouncing orientation update to ${orientationData.orientation} (last update was ${(now - this.lastOrientationUpdate.timestamp) / 1000}s ago)`);
        return;
      }
      
      // We've validated the data, now notify listeners
      console.log(`✅ OrientationEventService: Updating orientation to ${orientationData.orientation} for screen ${orientationData.id}`);
      
      // Update last orientation update tracker
      this.lastOrientationUpdate = {
        orientation: orientationData.orientation,
        timestamp: now
      };
      
      // Store the event time in localStorage to coordinate with content updates
      try {
        localStorage.setItem('last_orientation_sse_event', now.toString());
      } catch (error) {
        console.error('Error setting last SSE event time:', error);
      }
      
      // Notify all listeners
      this.notifyListeners(orientationData.orientation, orientationData.id);
      
    } catch (error) {
      logger.error('OrientationEventService: Error processing orientation event', { error });
      console.error('❌ OrientationEventService: Error processing event:', error);
      if (typeof event.data === 'string') {
        console.error('Raw data:', event.data);
      }
    }
  };

  /**
   * Notify all listeners about the orientation update
   */
  private notifyListeners(orientation: Orientation, screenId: string): void {
    this.listeners.forEach(listener => {
      try {
        listener(orientation, screenId);
      } catch (error) {
        logger.error('OrientationEventService: Error in listener callback', { error });
      }
    });
  }

  /**
   * Add a listener for orientation updates
   * @returns A function to remove the listener
   */
  public addListener(listener: (orientation: Orientation, screenId: string) => void): () => void {
    this.listeners.add(listener);
    
    // Return a function to remove this listener
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Cleanup resources when the service is no longer needed
   */
  public cleanup(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.listeners.clear();
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
}

const orientationEventService = new OrientationEventService();
export default orientationEventService; 
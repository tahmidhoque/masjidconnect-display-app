import logger from '../utils/logger';
import unifiedSSEService from './unifiedSSEService';

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
  private listeners: Set<(orientation: Orientation, screenId: string) => void> = new Set();
  private currentScreenId: string | null = null;
  private currentOrientation: Orientation | null = null;
  private lastOrientationUpdate: { orientation: Orientation, timestamp: number } | null = null;
  private orientationUpdateDebounceTime = 2000; // 2 seconds debounce
  private isInitializing = false; // Prevent duplicate initialization
  private unregisterHandlers: (() => void)[] = []; // Track registered handlers for cleanup

  /**
   * Set the current screen ID
   */
  public setScreenId(screenId: string): void {
    this.currentScreenId = screenId;
  }

  /**
   * Initialize the orientation service using the unified SSE connection
   */
  public initialize(baseURL: string): void {
    // Prevent duplicate initialization
    if (this.isInitializing) {
      logger.warn('OrientationEventService: Already initializing, skipping duplicate call');
      return;
    }
    
    this.isInitializing = true;
    logger.info('OrientationEventService: Initializing with unified SSE service', { baseURL });
    console.log('🔄 OrientationEventService: Initializing with unified SSE service');
    
    // Load saved orientation from localStorage if available
    try {
      const savedOrientation = localStorage.getItem('screen_orientation');
      if (savedOrientation === 'LANDSCAPE' || savedOrientation === 'PORTRAIT') {
        this.currentOrientation = savedOrientation as Orientation;
        logger.debug('OrientationEventService: Loaded saved orientation from localStorage', {
          orientation: savedOrientation
        });
        console.log(`📦 OrientationEventService: Loaded saved orientation: ${savedOrientation}`);
      }
    } catch (error) {
      logger.warn('OrientationEventService: Could not load saved orientation from localStorage', { error });
    }
    
    // Ensure unified SSE service is initialized
    unifiedSSEService.initialize(baseURL);
    
    // Register handlers for orientation events
    this.registerEventHandlers();
    
    this.isInitializing = false;
  }
  
  /**
   * Register event handlers with the unified SSE service
   */
  private registerEventHandlers(): void {
    // Clean up any existing handlers first
    this.unregisterHandlers.forEach(unregister => unregister());
    this.unregisterHandlers = [];
    
    // Register handler for primary orientation event type
    const unregisterPrimary = unifiedSSEService.addEventListener(EVENT_TYPES.PRIMARY, (event: MessageEvent) => {
      console.log(`🔄 OrientationEventService: ${EVENT_TYPES.PRIMARY} event received via unified SSE!`, event.data);
      this.handleOrientationEvent(event);
    });
    this.unregisterHandlers.push(unregisterPrimary);
    
    // Also listen for alternative event names
    const altNames = ['SCREEN_ORIENTATION', 'screen_orientation', 'orientation'];
    altNames.forEach(eventName => {
      const unregister = unifiedSSEService.addEventListener(eventName, (event: MessageEvent) => {
        console.log(`🔄 OrientationEventService: ${eventName} event received via unified SSE!`, event.data);
        this.handleOrientationEvent(event);
      });
      this.unregisterHandlers.push(unregister);
    });
    
    // Listen to default 'message' event for orientation events without specific type
    const unregisterMessage = unifiedSSEService.addEventListener('message', (event: MessageEvent) => {
      const messageEvent = event as MessageEvent;
      
      logger.debug('OrientationEventService: Received default message event via unified SSE', {
        data: messageEvent.data,
        type: messageEvent.type,
      });
      console.log('🔄 OrientationEventService: Default message event received:', messageEvent.data);
      
      // Try to parse and handle as orientation event
      try {
        const data = typeof messageEvent.data === 'string' ? JSON.parse(messageEvent.data) : messageEvent.data;
        if (data && (data.orientation || data.type === 'SCREEN_ORIENTATION')) {
          // It looks like an orientation event, handle it
          this.handleOrientationEvent(messageEvent);
        }
      } catch (error) {
        // Not JSON or not an orientation event, ignore
        logger.debug('OrientationEventService: Message event is not an orientation event');
      }
    });
    this.unregisterHandlers.push(unregisterMessage);
    
    logger.info('OrientationEventService: All event handlers registered with unified SSE service');
    console.log('🔄 OrientationEventService: All event handlers registered successfully');
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
    
    // CRITICAL: Verify unified SSE connection is ready before processing events
    const connectionStatus = unifiedSSEService.getConnectionStatus();
    if (!connectionStatus.connected) {
      logger.warn('OrientationEventService: Ignoring orientation event - unified SSE connection not ready', {
        readyState: connectionStatus.readyState,
        connected: connectionStatus.connected,
      });
      console.warn('🔍 OrientationEventService: Orientation event blocked - unified SSE connection not ready');
      return;
    }
    
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
      
      // Get previous orientation for logging
      const previousOrientation = this.currentOrientation;
      
      // We've validated the data, now update state and notify listeners
      const transitionType = previousOrientation 
        ? `${previousOrientation} → ${orientationData.orientation}`
        : `initial → ${orientationData.orientation}`;
      
      console.log(`✅ OrientationEventService: Changing orientation from ${previousOrientation || 'unknown'} to ${orientationData.orientation} for screen ${orientationData.id}`);
      logger.info('OrientationEventService: Orientation change', {
        previousOrientation,
        newOrientation: orientationData.orientation,
        transitionType,
        screenId: orientationData.id,
        timestamp: now,
        transitionTime: previousOrientation ? (now - (this.lastOrientationUpdate?.timestamp || now)) : 0,
      });
      
      // Update current orientation
      this.currentOrientation = orientationData.orientation;
      
      // Update last orientation update tracker
      this.lastOrientationUpdate = {
        orientation: orientationData.orientation,
        timestamp: now
      };
      
      // Store orientation in localStorage for persistence
      try {
        localStorage.setItem('screen_orientation', orientationData.orientation);
        localStorage.setItem('last_orientation_sse_event', now.toString());
        logger.debug('OrientationEventService: Stored orientation in localStorage', {
          orientation: orientationData.orientation
        });
      } catch (error) {
        logger.error('OrientationEventService: Error storing orientation in localStorage', { error });
        console.error('❌ OrientationEventService: Error storing orientation:', error);
      }
      
      // Dispatch custom event for React components
      try {
        window.dispatchEvent(new CustomEvent('orientation-changed', {
          detail: {
            orientation: orientationData.orientation,
            screenId: orientationData.id,
            timestamp: now
          }
        }));
        logger.debug('OrientationEventService: Dispatched orientation-changed custom event');
        console.log('📢 OrientationEventService: Dispatched orientation-changed event');
      } catch (error) {
        logger.error('OrientationEventService: Error dispatching custom event', { error });
        console.error('❌ OrientationEventService: Error dispatching custom event:', error);
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
    logger.info('OrientationEventService: Cleaning up');
    
    // Unregister all event handlers
    this.unregisterHandlers.forEach(unregister => unregister());
    this.unregisterHandlers = [];
    
    // Note: We don't close the unified SSE connection here as other services may be using it
    // The unified service manages its own lifecycle
    
    this.listeners.clear();
    this.isInitializing = false;
  }

  /**
   * Get current connection status (delegates to unified SSE service)
   */
  public getConnectionStatus(): { connected: boolean, url: string | null, readyState: number | null, currentOrientation: Orientation | null } {
    const status = unifiedSSEService.getConnectionStatus();
    return {
      connected: status.connected,
      url: status.url,
      readyState: status.readyState,
      currentOrientation: this.currentOrientation
    };
  }

  /**
   * Get current orientation
   */
  public getCurrentOrientation(): Orientation | null {
    return this.currentOrientation;
  }
}

const orientationEventService = new OrientationEventService();
export default orientationEventService; 
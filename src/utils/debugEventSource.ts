/**
 * DebugEventSource - A wrapper around EventSource with enhanced debugging
 * 
 * This class wraps the native EventSource to add additional logging and 
 * debugging capabilities to help troubleshoot SSE connections.
 */
export class DebugEventSource {
  private nativeEventSource: EventSource;
  private url: string;
  private options?: EventSourceInit;
  private eventListeners: Map<string, Set<Function>> = new Map();
  
  // EventSource constants
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  
  constructor(url: string, options?: EventSourceInit) {
    this.url = url;
    this.options = options;
    
    console.log('🔍 DebugEventSource: Creating new connection to', url, 'with options:', options);
    this.nativeEventSource = new EventSource(url, options);
    
    // Set up native event forwarding with debugging
    this.setupNativeEventForwarding();
  }
  
  // EventSource interface getters
  get readyState(): number {
    return this.nativeEventSource.readyState;
  }
  
  get withCredentials(): boolean {
    return this.nativeEventSource.withCredentials;
  }
  
  get onopen(): ((ev: Event) => any) | null {
    return this.nativeEventSource.onopen;
  }
  
  set onopen(callback: ((ev: Event) => any) | null) {
    console.log('🔍 DebugEventSource: Setting onopen handler');
    this.nativeEventSource.onopen = (ev: Event) => {
      console.log('🔍 DebugEventSource: Connection opened', {
        url: this.url,
        readyState: this.readyState,
        timestamp: new Date().toISOString()
      });
      if (callback) callback.call(this, ev);
    };
  }
  
  get onmessage(): ((ev: MessageEvent) => any) | null {
    return this.nativeEventSource.onmessage;
  }
  
  set onmessage(callback: ((ev: MessageEvent) => any) | null) {
    console.log('🔍 DebugEventSource: Setting onmessage handler');
    this.nativeEventSource.onmessage = (ev: MessageEvent) => {
      const data = this.logMessageData(ev.data);
      console.log('🔍 DebugEventSource: Message received', {
        data,
        type: ev.type,
        timestamp: new Date().toISOString()
      });
      if (callback) callback.call(this, ev);
    };
  }
  
  get onerror(): ((ev: Event) => any) | null {
    return this.nativeEventSource.onerror;
  }
  
  set onerror(callback: ((ev: Event) => any) | null) {
    console.log('🔍 DebugEventSource: Setting onerror handler');
    this.nativeEventSource.onerror = (ev: Event) => {
      console.error('🔍 DebugEventSource: Error occurred', {
        url: this.url,
        readyState: this.readyState,
        timestamp: new Date().toISOString(),
        error: ev
      });
      if (callback) callback.call(this, ev);
    };
  }
  
  // Methods from EventSource interface
  close(): void {
    console.log('🔍 DebugEventSource: Closing connection to', this.url);
    this.nativeEventSource.close();
  }
  
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    console.log('🔍 DebugEventSource: Adding event listener for event type:', type);
    
    // Store the event listener for debugging
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    
    // Only add if it's a function
    if (typeof listener === 'function') {
      this.eventListeners.get(type)?.add(listener);
    }
    
    // Create a wrapped listener that logs events
    const wrappedListener = (event: Event) => {
      if (event instanceof MessageEvent) {
        const data = this.logMessageData(event.data);
        console.log(`🔍 DebugEventSource: Event '${type}' received`, {
          data,
          timestamp: new Date().toISOString()
        });
      } else {
        console.log(`🔍 DebugEventSource: Non-message event '${type}' received`, {
          event,
          timestamp: new Date().toISOString()
        });
      }
      
      // Call the original listener
      if (typeof listener === 'function') {
        listener.call(this, event);
      } else if (listener && typeof listener === 'object' && 'handleEvent' in listener) {
        listener.handleEvent(event);
      }
    };
    
    // Add the wrapped listener to the native event source
    this.nativeEventSource.addEventListener(type, wrappedListener, options);
  }
  
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void {
    console.log('🔍 DebugEventSource: Removing event listener for event type:', type);
    
    // Remove from our tracking
    if (this.eventListeners.has(type) && typeof listener === 'function') {
      this.eventListeners.get(type)?.delete(listener);
    }
    
    // Remove from native event source
    this.nativeEventSource.removeEventListener(type, listener, options);
  }
  
  dispatchEvent(event: Event): boolean {
    console.log('🔍 DebugEventSource: Dispatching event:', event.type);
    return this.nativeEventSource.dispatchEvent(event);
  }
  
  // Additional debugging methods
  private setupNativeEventForwarding(): void {
    // Forward native events to our wrapper with debugging
    this.nativeEventSource.onopen = (ev) => {
      console.log('🔍 DebugEventSource: Native onopen fired');
      if (this.onopen) this.onopen.call(this, ev);
    };
    
    this.nativeEventSource.onmessage = (ev) => {
      const data = this.logMessageData(ev.data);
      console.log('🔍 DebugEventSource: Native onmessage fired', { data });
      if (this.onmessage) this.onmessage.call(this, ev);
    };
    
    this.nativeEventSource.onerror = (ev) => {
      console.error('🔍 DebugEventSource: Native onerror fired');
      if (this.onerror) this.onerror.call(this, ev);
    };
  }
  
  // Helper to safely log message data in various formats
  private logMessageData(data: any): any {
    if (typeof data === 'string') {
      try {
        // Try to parse as JSON for better logging
        return JSON.parse(data);
      } catch (e) {
        // Not JSON, return as is
        return data;
      }
    } else {
      return data;
    }
  }
  
  // Utility method to log current state
  public logState(): void {
    const readyStateMap = {
      [0]: 'CONNECTING',
      [1]: 'OPEN',
      [2]: 'CLOSED'
    };
    
    console.log('🔍 DebugEventSource: Current state', {
      url: this.url,
      readyState: this.readyState,
      readyStateText: readyStateMap[this.readyState as keyof typeof readyStateMap],
      withCredentials: this.withCredentials,
      registeredEventTypes: Array.from(this.eventListeners.keys()),
      timestamp: new Date().toISOString()
    });
  }
} 
/**
 * Orientation Event Service
 *
 * Manages screen orientation state and persistence.
 * Orientation events are received via WebSocket through the realtimeMiddleware.
 * This service handles local state management and listener notifications.
 */

import logger from "../utils/logger";

// Define Orientation type locally
type Orientation = "LANDSCAPE" | "PORTRAIT";

class OrientationEventService {
  private listeners: Set<(orientation: Orientation, screenId: string) => void> =
    new Set();
  private currentScreenId: string | null = null;
  private currentOrientation: Orientation | null = null;
  private lastOrientationUpdate: {
    orientation: Orientation;
    timestamp: number;
  } | null = null;
  private orientationUpdateDebounceTime = 2000; // 2 seconds debounce

  constructor() {
    // Load saved orientation from localStorage if available
    this.loadSavedOrientation();

    // Listen for orientation-changed events from realtimeMiddleware
    window.addEventListener(
      "orientation-changed",
      this.handleOrientationChanged as EventListener,
    );
  }

  /**
   * Handle orientation change from window event
   */
  private handleOrientationChanged = (
    event: CustomEvent<{
      orientation: Orientation;
      screenId: string;
      timestamp: number;
      source?: string;
    }>,
  ): void => {
    const { orientation, screenId, timestamp } = event.detail;

    console.log(
      `🔄 OrientationEventService: Received orientation-changed event`,
      { orientation, screenId },
    );

    // Check for debounce
    const now = Date.now();
    if (
      this.lastOrientationUpdate &&
      this.lastOrientationUpdate.orientation === orientation &&
      now - this.lastOrientationUpdate.timestamp < this.orientationUpdateDebounceTime
    ) {
      console.log(
        `⏭️ OrientationEventService: Debouncing orientation update to ${orientation}`,
      );
      return;
    }

    // Update state
    const previousOrientation = this.currentOrientation;
    this.currentOrientation = orientation;
    this.lastOrientationUpdate = { orientation, timestamp: now };

    console.log(
      `✅ OrientationEventService: Orientation changed from ${previousOrientation || "unknown"} to ${orientation}`,
    );

    // Notify all listeners
    this.notifyListeners(orientation, screenId);
  };

  /**
   * Load saved orientation from localStorage
   */
  private loadSavedOrientation(): void {
    try {
      const savedOrientation = localStorage.getItem("screen_orientation");
      if (savedOrientation === "LANDSCAPE" || savedOrientation === "PORTRAIT") {
        this.currentOrientation = savedOrientation as Orientation;
        logger.debug(
          "OrientationEventService: Loaded saved orientation from localStorage",
          { orientation: savedOrientation },
        );
        console.log(
          `📦 OrientationEventService: Loaded saved orientation: ${savedOrientation}`,
        );
      }
    } catch (error) {
      logger.warn(
        "OrientationEventService: Could not load saved orientation from localStorage",
        { error },
      );
    }
  }

  /**
   * Set the current screen ID
   */
  public setScreenId(screenId: string): void {
    this.currentScreenId = screenId;
  }

  /**
   * Set orientation directly (called by middleware)
   */
  public setOrientation(orientation: Orientation, screenId: string): void {
    console.log(`🔄 OrientationEventService: Setting orientation to ${orientation}`);

    // Check if this event is for our screen
    if (this.currentScreenId && screenId !== this.currentScreenId) {
      console.log(
        `⏭️ OrientationEventService: Ignoring orientation update for screen ${screenId} (we are ${this.currentScreenId})`,
      );
      return;
    }

    // Check for debounce
    const now = Date.now();
    if (
      this.lastOrientationUpdate &&
      this.lastOrientationUpdate.orientation === orientation &&
      now - this.lastOrientationUpdate.timestamp < this.orientationUpdateDebounceTime
    ) {
      console.log(
        `⏭️ OrientationEventService: Debouncing orientation update to ${orientation}`,
      );
      return;
    }

    // Update state
    const previousOrientation = this.currentOrientation;
    this.currentOrientation = orientation;
    this.lastOrientationUpdate = { orientation, timestamp: now };

    // Store in localStorage
    try {
      localStorage.setItem("screen_orientation", orientation);
    } catch (error) {
      logger.error(
        "OrientationEventService: Error storing orientation in localStorage",
        { error },
      );
    }

    console.log(
      `✅ OrientationEventService: Orientation changed from ${previousOrientation || "unknown"} to ${orientation}`,
    );

    // Notify listeners
    this.notifyListeners(orientation, screenId);
  }

  /**
   * Notify all listeners about the orientation update
   */
  private notifyListeners(orientation: Orientation, screenId: string): void {
    this.listeners.forEach((listener) => {
      try {
        listener(orientation, screenId);
      } catch (error) {
        logger.error("OrientationEventService: Error in listener callback", {
          error,
        });
      }
    });
  }

  /**
   * Add a listener for orientation updates
   * @returns A function to remove the listener
   */
  public addListener(
    listener: (orientation: Orientation, screenId: string) => void,
  ): () => void {
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
    logger.info("OrientationEventService: Cleaning up");

    window.removeEventListener(
      "orientation-changed",
      this.handleOrientationChanged as EventListener,
    );

    this.listeners.clear();
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

import {
  AnalyticsRequest,
  HeartbeatAnalyticsData,
  ContentViewAnalyticsData,
  ErrorAnalyticsData,
  ScheduleEventAnalyticsData,
  AnalyticsResponse,
  ErrorType,
  ScheduleEventType,
} from '../api/models';
import { systemMetrics } from '../utils/systemMetrics';
import logger from '../utils/logger';
import localforage from 'localforage';
import masjidDisplayClient from '../api/masjidDisplayClient';
import { RemoteCommandResponse } from './remoteControlService';

// Analytics configuration
const ANALYTICS_CONFIG = {
  HEARTBEAT_INTERVAL: 30000, // 30 seconds as specified
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAYS: [1000, 2000, 4000], // Exponential backoff: 1s, 2s, 4s
  QUEUE_STORAGE_KEY: 'analytics_queue',
  MAX_QUEUE_SIZE: 100,
};

interface QueuedAnalyticsData {
  id: string;
  data: AnalyticsRequest;
  timestamp: number;
  retryCount: number;
}

/**
 * Analytics service for collecting and sending analytics data
 * Implements the comprehensive analytics specification
 */
export class AnalyticsService {
  private apiKey: string | null = null;
  private baseUrl: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private queue: QueuedAnalyticsData[] = [];
  private isProcessingQueue = false;

  constructor() {
    this.baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
    this.loadQueueFromStorage();
  }

  /**
   * Initialize the analytics service with API credentials
   */
  async initialize(apiKey: string): Promise<void> {
    this.apiKey = apiKey;
    this.isInitialized = true;
    
    logger.info('Analytics service initialized', { hasApiKey: !!apiKey });
    
    // Start heartbeat collection
    this.startHeartbeat();
    
    // Process any queued data
    await this.processQueue();
  }

  /**
   * Stop the analytics service
   */
  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    this.isInitialized = false;
    logger.info('Analytics service stopped');
  }

  /**
   * Start periodic heartbeat collection
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(async () => {
      await this.sendHeartbeat();
    }, ANALYTICS_CONFIG.HEARTBEAT_INTERVAL);
    
    // Send initial heartbeat immediately
    setTimeout(() => this.sendHeartbeat(), 1000);
  }

  /**
   * Collect and send heartbeat data
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      const heartbeatData = await this.collectHeartbeatData();
      const result = await this.sendAnalyticsData('heartbeat', heartbeatData);
      
      // If heartbeat was sent successfully and contained command responses, clear them
      if (result && heartbeatData.commandResponses && heartbeatData.commandResponses.length > 0) {
        this.clearSentCommandResponses();
        logger.debug('Cleared sent command responses', { 
          count: heartbeatData.commandResponses.length 
        });
      }
      
      // Reset content errors after successful heartbeat
      systemMetrics.resetContentErrors();
    } catch (error) {
      logger.error('Failed to send heartbeat', { error });
    }
  }

  /**
   * Collect comprehensive heartbeat data
   */
  private async collectHeartbeatData(): Promise<HeartbeatAnalyticsData & { commandResponses?: RemoteCommandResponse[] }> {
    const [
      cpuUsage,
      storageUsed,
      networkLatency,
      displayBrightness,
      temperature,
      powerConsumption,
      ambientLight,
    ] = await Promise.all([
      systemMetrics.getCPUUsage(),
      systemMetrics.getStorageUsage(),
      systemMetrics.measureNetworkLatency(),
      systemMetrics.getDisplayBrightness(),
      systemMetrics.getTemperature(),
      systemMetrics.getPowerConsumption(),
      systemMetrics.getAmbientLight(),
    ]);

    // Get pending command responses
    const commandResponses = this.getPendingCommandResponses();

    const heartbeatData: HeartbeatAnalyticsData & { commandResponses?: RemoteCommandResponse[] } = {
      // System Performance (REQUIRED)
      cpuUsage,
      memoryUsage: systemMetrics.getMemoryUsage(),
      
      // Storage & Network (REQUIRED)
      storageUsed,
      networkLatency: Math.max(networkLatency, 0), // Ensure non-negative
      bandwidthUsage: systemMetrics.getBandwidthUsage(),
      
      // Display Metrics (REQUIRED)
      frameRate: systemMetrics.getFrameRate(),
      displayBrightness,
      resolution: systemMetrics.getResolution(),
      
      // Hardware Monitoring (OPTIONAL)
      ...(temperature !== undefined && { temperature }),
      ...(powerConsumption !== undefined && { powerConsumption }),
      ...(ambientLight !== undefined && { ambientLight }),
      
      // Content Information (REQUIRED)
      currentContent: systemMetrics.getCurrentContent() || 'none',
      contentLoadTime: systemMetrics.getContentLoadTime(),
      contentErrors: systemMetrics.getContentErrors(),
      
      // Network Details (REQUIRED)
      signalStrength: systemMetrics.getSignalStrength(),
      connectionType: systemMetrics.getConnectionType(),
      
      // Command Responses (OPTIONAL - included if any pending)
      ...(commandResponses.length > 0 && { commandResponses }),
    };

    logger.debug('Collected heartbeat data', { 
      cpuUsage, 
      memoryUsage: heartbeatData.memoryUsage,
      currentContent: heartbeatData.currentContent,
      commandResponseCount: commandResponses.length,
    });

    return heartbeatData;
  }

  /**
   * Send content view analytics
   */
  async sendContentView(data: ContentViewAnalyticsData): Promise<void> {
    await this.sendAnalyticsData('content_view', data);
  }

  /**
   * Send error analytics
   */
  async sendError(data: ErrorAnalyticsData): Promise<void> {
    await this.sendAnalyticsData('error', data);
  }

  /**
   * Send schedule event analytics
   */
  async sendScheduleEvent(data: ScheduleEventAnalyticsData): Promise<void> {
    await this.sendAnalyticsData('schedule_event', data);
  }

  /**
   * Helper method to create and send analytics data
   */
  private async sendAnalyticsData(
    type: AnalyticsRequest['type'], 
    data: any
  ): Promise<boolean> {
    if (!this.isInitialized || !this.apiKey) {
      logger.warn('Analytics service not initialized, queuing data', { type });
      await this.queueData(type, data);
      return false;
    }

    const analyticsRequest: AnalyticsRequest = {
      type,
      timestamp: new Date().toISOString(),
      data,
    } as AnalyticsRequest;

    try {
      await this.sendToAPI(analyticsRequest);
      logger.debug('Analytics data sent successfully', { type });
      return true;
    } catch (error) {
      logger.error('Failed to send analytics data', { type, error });
      await this.queueData(type, data);
      return false;
    }
  }

  /**
   * Send data to the analytics API
   */
  private async sendToAPI(request: AnalyticsRequest, retryCount = 0): Promise<AnalyticsResponse> {
    if (!this.apiKey) {
      throw new Error('No API key available');
    }

    // Use the API client's sendAnalyticsData method
    const result = await masjidDisplayClient.sendAnalyticsData(request);

    if (!result.success) {
      throw new Error(`Analytics API error: ${result.error || 'Unknown error'}`);
    }

    return result.data || { success: true };
  }

  /**
   * Queue data for later sending
   */
  private async queueData(type: AnalyticsRequest['type'], data: any): Promise<void> {
    const queueItem: QueuedAnalyticsData = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data: {
        type,
        timestamp: new Date().toISOString(),
        data,
      } as AnalyticsRequest,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(queueItem);

    // Limit queue size
    if (this.queue.length > ANALYTICS_CONFIG.MAX_QUEUE_SIZE) {
      this.queue.shift(); // Remove oldest item
    }

    await this.saveQueueToStorage();
    logger.debug('Analytics data queued', { type, queueSize: this.queue.length });
  }

  /**
   * Process queued analytics data
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || !this.isInitialized || !this.apiKey) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const itemsToProcess = [...this.queue];
      this.queue = [];

      for (const item of itemsToProcess) {
        try {
          await this.sendToAPI(item.data);
          logger.debug('Queued analytics data sent successfully', { id: item.id, type: item.data.type });
        } catch (error) {
          item.retryCount++;
          
          if (item.retryCount < ANALYTICS_CONFIG.MAX_RETRY_ATTEMPTS) {
            // Re-queue with backoff
            const delay = ANALYTICS_CONFIG.RETRY_DELAYS[item.retryCount - 1] || ANALYTICS_CONFIG.RETRY_DELAYS[ANALYTICS_CONFIG.RETRY_DELAYS.length - 1];
            setTimeout(() => {
              this.queue.push(item);
            }, delay);
            
            logger.debug('Analytics data queued for retry', { 
              id: item.id, 
              type: item.data.type,
              retryCount: item.retryCount,
              delay 
            });
          } else {
            logger.error('Analytics data dropped after max retries', { 
              id: item.id, 
              type: item.data.type,
              error 
            });
          }
        }
      }

      await this.saveQueueToStorage();
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Save queue to persistent storage
   */
  private async saveQueueToStorage(): Promise<void> {
    try {
      await localforage.setItem(ANALYTICS_CONFIG.QUEUE_STORAGE_KEY, this.queue);
    } catch (error) {
      logger.error('Failed to save analytics queue to storage', { error });
    }
  }

  /**
   * Load queue from persistent storage
   */
  private async loadQueueFromStorage(): Promise<void> {
    try {
      const savedQueue = await localforage.getItem<QueuedAnalyticsData[]>(ANALYTICS_CONFIG.QUEUE_STORAGE_KEY);
      if (savedQueue && Array.isArray(savedQueue)) {
        this.queue = savedQueue;
        logger.info('Loaded analytics queue from storage', { queueSize: this.queue.length });
      }
    } catch (error) {
      logger.error('Failed to load analytics queue from storage', { error });
    }
  }

  /**
   * Utility methods for content tracking
   */
  setCurrentContent(contentId: string): void {
    systemMetrics.setCurrentContent(contentId);
  }

  trackContentLoadTime(loadTime: number): void {
    systemMetrics.setContentLoadTime(loadTime);
  }

  reportContentError(): void {
    systemMetrics.incrementContentErrors();
  }

  /**
   * Convenience method to report errors with proper typing
   */
  async reportError(
    errorType: ErrorType,
    message: string,
    errorCode?: string,
    stack?: string,
    resolved = false
  ): Promise<void> {
    const errorData: ErrorAnalyticsData = {
      errorType,
      message,
      resolved,
      ...(errorCode && { errorCode }),
      ...(stack && { stack }),
    };

    await this.sendError(errorData);
  }

  /**
   * Convenience method to report schedule events
   */
  async reportScheduleEvent(
    eventType: ScheduleEventType,
    expectedStartTime: string,
    actualStartTime: string,
    scheduleId?: string,
    contentId?: string
  ): Promise<void> {
    const eventData: ScheduleEventAnalyticsData = {
      eventType,
      expectedStartTime,
      actualStartTime,
      delay: new Date(actualStartTime).getTime() - new Date(expectedStartTime).getTime(),
      ...(scheduleId && { scheduleId }),
      ...(contentId && { contentId }),
    };

    await this.sendScheduleEvent(eventData);
  }

  /**
   * Get pending command responses from localStorage
   */
  private getPendingCommandResponses(): RemoteCommandResponse[] {
    try {
      const storedResponses = localStorage.getItem('pending_command_responses');
      if (!storedResponses) {
        return [];
      }
      
      const responses = JSON.parse(storedResponses) as RemoteCommandResponse[];
      
      // Validate that it's an array
      if (!Array.isArray(responses)) {
        logger.warn('AnalyticsService: Invalid command responses format in localStorage');
        return [];
      }
      
      return responses;
    } catch (error) {
      logger.error('AnalyticsService: Error retrieving pending command responses', { error });
      return [];
    }
  }

  /**
   * Clear sent command responses from localStorage
   */
  private clearSentCommandResponses(): void {
    try {
      localStorage.removeItem('pending_command_responses');
      logger.debug('AnalyticsService: Cleared sent command responses');
    } catch (error) {
      logger.error('AnalyticsService: Error clearing sent command responses', { error });
    }
  }

  /**
   * Get analytics service status
   */
  getStatus(): {
    isInitialized: boolean;
    hasApiKey: boolean;
    queueSize: number;
    heartbeatActive: boolean;
    pendingCommandResponses: number;
  } {
    return {
      isInitialized: this.isInitialized,
      hasApiKey: !!this.apiKey,
      queueSize: this.queue.length,
      heartbeatActive: !!this.heartbeatInterval,
      pendingCommandResponses: this.getPendingCommandResponses().length,
    };
  }
}

// Create singleton instance
export const analyticsService = new AnalyticsService(); 
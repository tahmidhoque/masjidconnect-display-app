import { useEffect, useRef, useCallback } from 'react';
import { analyticsService } from '../services/analyticsService';
import { ContentViewAnalyticsData } from '../api/models';
import logger from '../utils/logger';

interface ContentTrackingOptions {
  contentId: string;
  contentType: string;
  trackOnMount?: boolean;
  minimumViewDuration?: number; // in milliseconds
}

interface ContentAnalyticsHook {
  startTracking: () => void;
  stopTracking: (viewComplete?: boolean) => void;
  reportError: (errorMessage: string) => void;
  trackLoadTime: (loadTime: number) => void;
}

/**
 * Hook for tracking content analytics including view duration, load times, and errors
 */
export function useContentAnalytics(options: ContentTrackingOptions): ContentAnalyticsHook {
  const {
    contentId,
    contentType,
    trackOnMount = true,
    minimumViewDuration = 1000, // 1 second minimum
  } = options;

  const startTimeRef = useRef<string | null>(null);
  const isTrackingRef = useRef<boolean>(false);
  const viewCompleteRef = useRef<boolean>(false);

  /**
   * Start tracking content view
   */
  const startTracking = useCallback(() => {
    if (isTrackingRef.current) {
      logger.warn('Content tracking already started', { contentId, contentType });
      return;
    }

    startTimeRef.current = new Date().toISOString();
    isTrackingRef.current = true;
    viewCompleteRef.current = false;

    // Update analytics service about current content
    analyticsService.setCurrentContent(contentId);

    logger.debug('Started content tracking', { 
      contentId, 
      contentType, 
      startTime: startTimeRef.current 
    });
  }, [contentId, contentType]);

  /**
   * Stop tracking content view and send analytics
   */
  const stopTracking = useCallback(async (viewComplete = true) => {
    if (!isTrackingRef.current || !startTimeRef.current) {
      logger.warn('Content tracking not active', { contentId, contentType });
      return;
    }

    const endTime = new Date().toISOString();
    const duration = new Date(endTime).getTime() - new Date(startTimeRef.current).getTime();

    // Only track if minimum duration is met
    if (duration < minimumViewDuration) {
      logger.debug('Content view too short, not tracking', { 
        contentId, 
        contentType, 
        duration, 
        minimumViewDuration 
      });
      isTrackingRef.current = false;
      return;
    }

    viewCompleteRef.current = viewComplete;

    const contentViewData: ContentViewAnalyticsData = {
      contentId,
      contentType,
      startTime: startTimeRef.current,
      endTime,
      duration,
      viewComplete,
    };

    try {
      await analyticsService.sendContentView(contentViewData);
      logger.debug('Content view tracked successfully', { 
        contentId, 
        contentType, 
        duration, 
        viewComplete 
      });
    } catch (error) {
      logger.error('Failed to track content view', { 
        contentId, 
        contentType, 
        error 
      });
      // Report this as a content error
      analyticsService.reportContentError();
    }

    // Reset tracking state
    isTrackingRef.current = false;
    startTimeRef.current = null;
  }, [contentId, contentType, minimumViewDuration]);

  /**
   * Report a content error
   */
  const reportError = useCallback(async (errorMessage: string) => {
    try {
      await analyticsService.reportError(
        'CONTENT',
        errorMessage,
        undefined, // errorCode
        undefined, // stack
        false // resolved
      );

      // Also update system metrics
      analyticsService.reportContentError();

      logger.debug('Content error reported', { contentId, contentType, errorMessage });
    } catch (error) {
      logger.error('Failed to report content error', { 
        contentId, 
        contentType, 
        errorMessage, 
        error 
      });
    }
  }, [contentId, contentType]);

  /**
   * Track content load time
   */
  const trackLoadTime = useCallback((loadTime: number) => {
    analyticsService.trackContentLoadTime(loadTime);
    logger.debug('Content load time tracked', { contentId, contentType, loadTime });
  }, [contentId, contentType]);

  // Auto-start tracking on mount if enabled
  useEffect(() => {
    if (trackOnMount) {
      startTracking();
    }

    // Cleanup on unmount
    return () => {
      if (isTrackingRef.current) {
        stopTracking(viewCompleteRef.current);
      }
    };
  }, [trackOnMount, startTracking, stopTracking]);

  // Track content changes
  useEffect(() => {
    if (isTrackingRef.current) {
      // Content changed while tracking, stop previous and start new
      stopTracking(false); // Mark as incomplete since content changed
      setTimeout(() => {
        if (trackOnMount) {
          startTracking();
        }
      }, 100); // Small delay to ensure previous tracking is completed
    }
  }, [contentId, contentType, trackOnMount, startTracking, stopTracking]);

  return {
    startTracking,
    stopTracking,
    reportError,
    trackLoadTime,
  };
}

/**
 * Simplified hook for basic content tracking with minimal configuration
 */
export function useSimpleContentTracking(contentId: string, contentType: string) {
  return useContentAnalytics({
    contentId,
    contentType,
    trackOnMount: true,
    minimumViewDuration: 1000,
  });
} 
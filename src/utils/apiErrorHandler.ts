import { ApiResponse } from '../api/models';
import logger from './logger';
import { crashLogger } from './crashLogger';

/**
 * Creates a standardized error response object for API errors
 * Ensures all error responses have the required data property set to null
 */
export function createErrorResponse<T>(
  error: string, 
  status?: number, 
  details?: any
): ApiResponse<T> {
  // Log the error with any details provided
  if (details) {
    logger.error(`API Error: ${error}`, { status, details });
    
    // Also log to crash logger for network errors that might cause restarts
    if (status && (status >= 500 || status === 0)) {
      crashLogger.logNetworkError(
        { 
          message: error, 
          response: { status }, 
          config: details 
        }, 
        details?.url || 'unknown'
      );
    }
  }
  
  // Return a properly formatted error response
  return {
    success: false,
    error,
    data: null,
    status
  };
}

/**
 * Safely processes an API response to ensure it matches the ApiResponse interface
 * This helps prevent TypeScript errors when response structure is incomplete
 */
export function normalizeApiResponse<T>(
  response: Partial<ApiResponse<T>>
): ApiResponse<T> {
  // Check if data is an HTML string (common error case)
  if (response.data && typeof response.data === 'string' && 
      (response.data as string).trim().startsWith('<')) {
    logger.error('Received HTML in API response data', {
      preview: (response.data as string).substring(0, 200)
    });
    return createErrorResponse('API returned HTML instead of JSON');
  }
  
  // Ensure the response has all required fields
  const normalized: ApiResponse<T> = {
    success: response.success === true,
    data: response.data || null
  };
  
  // Copy optional fields if they exist
  if (response.error) normalized.error = response.error;
  if (response.status !== undefined) normalized.status = response.status;
  if (response.cached) normalized.cached = response.cached;
  if (response.offlineFallback) normalized.offlineFallback = response.offlineFallback;
  if (response.timestamp) normalized.timestamp = response.timestamp;
  if (response.cacheAge) normalized.cacheAge = response.cacheAge;
  
  return normalized;
}

/**
 * Utility to validate API responses before they're returned to components
 * This can be used as a final check before returning from API methods
 */
export function validateApiResponse<T>(response: any): ApiResponse<T> {
  // First check if response is a valid object (not string, not null, not array)
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    logger.error('Invalid API response: not an object', { response: typeof response });
    return createErrorResponse('Invalid API response format');
  }
  
  // Check if this is already a valid API response
  if (
    'success' in response &&
    ('data' in response || response.success === false)
  ) {
    // If success is false but data is missing, set data to null
    if (response.success === false && !('data' in response)) {
      response.data = null;
    }
    
    return response as ApiResponse<T>;
  }
  
  // If it's not a valid response, create an error response
  return createErrorResponse<T>('Invalid API response format');
} 
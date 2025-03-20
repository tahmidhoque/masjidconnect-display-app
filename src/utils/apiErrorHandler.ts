import { ApiResponse } from '../api/models';
import logger from './logger';

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
  // Ensure the response has all required fields
  const normalized: ApiResponse<T> = {
    success: response.success === true,
    data: response.data || null
  };
  
  // Copy optional fields if they exist
  if (response.error) normalized.error = response.error;
  if (response.status) normalized.status = response.status;
  if (response.cached) normalized.cached = response.cached;
  if (response.offlineFallback) normalized.offlineFallback = response.offlineFallback;
  
  return normalized;
}

/**
 * Utility to validate API responses before they're returned to components
 * This can be used as a final check before returning from API methods
 */
export function validateApiResponse<T>(response: any): ApiResponse<T> {
  // Check if this is already a valid API response
  if (
    response &&
    typeof response === 'object' &&
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
/**
 * Error Handling Integration Tests
 * Tests error handling across the application
 */

import {
  createErrorResponse,
  normalizeApiResponse,
  validateApiResponse,
} from '../../utils/apiErrorHandler';

describe('Error Handling Integration Tests', () => {
  describe('API Error Responses', () => {
    it('should create consistent error responses', () => {
      const errorCases = [
        { message: 'Network error', status: undefined },
        { message: 'Not found', status: 404 },
        { message: 'Server error', status: 500 },
        { message: 'Unauthorized', status: 401 },
      ];

      errorCases.forEach(({ message, status }) => {
        const response = createErrorResponse(message, status);

        expect(response.success).toBe(false);
        expect(response.data).toBeNull();
        expect(response.error).toBe(message);
        if (status) {
          expect(response.status).toBe(status);
        }
      });
    });

    it('should handle error details', () => {
      const details = { url: '/api/test', method: 'GET' };
      const response = createErrorResponse('Request failed', 500, details);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Request failed');
      expect(response.status).toBe(500);
    });
  });

  describe('Response Normalization', () => {
    it('should normalize successful responses', () => {
      const testData = { id: '1', name: 'Test' };
      const partial = {
        success: true,
        data: testData,
        cached: true,
        timestamp: 123456,
      };

      const normalized = normalizeApiResponse(partial);

      expect(normalized.success).toBe(true);
      expect(normalized.data).toEqual(testData);
      expect(normalized.cached).toBe(true);
      expect(normalized.timestamp).toBe(123456);
    });

    it('should normalize error responses', () => {
      const partial = {
        success: false,
        error: 'Something went wrong',
      };

      const normalized = normalizeApiResponse(partial);

      expect(normalized.success).toBe(false);
      expect(normalized.data).toBeNull();
      expect(normalized.error).toBe('Something went wrong');
    });

    it('should handle missing data field', () => {
      const partial = {
        success: true,
      };

      const normalized = normalizeApiResponse(partial);

      expect(normalized.success).toBe(true);
      expect(normalized.data).toBeNull();
    });
  });

  describe('Response Validation', () => {
    it('should validate correct API responses', () => {
      const validResponses = [
        { success: true, data: { test: 'value' } },
        { success: false, error: 'Failed', data: null },
        { success: true, data: null },
      ];

      validResponses.forEach(response => {
        const validated = validateApiResponse(response);

        expect(validated.success).toBeDefined();
        expect('data' in validated).toBe(true);
      });
    });

    it('should handle invalid response formats', () => {
      const invalidResponses = [
        null,
        undefined,
        { someField: 'value' },
        { wrongStructure: true },
      ];

      invalidResponses.forEach(response => {
        const validated = validateApiResponse(response);

        expect(validated.success).toBe(false);
        expect(validated.error).toBe('Invalid API response format');
        expect(validated.data).toBeNull();
      });
    });

    it('should add data field to error responses missing it', () => {
      const response = {
        success: false,
        error: 'Failed',
      };

      const validated = validateApiResponse(response);

      expect(validated.data).toBeNull();
      expect(validated.success).toBe(false);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle network timeout scenarios', () => {
      const error = createErrorResponse('Request timeout', 0);

      expect(error.success).toBe(false);
      expect(error.status).toBe(0);
      expect(error.error).toContain('timeout');
    });

    it('should handle authentication errors', () => {
      const error = createErrorResponse('Authentication failed', 401);

      expect(error.success).toBe(false);
      expect(error.status).toBe(401);
    });

    it('should handle server errors', () => {
      const error = createErrorResponse('Internal server error', 500);

      expect(error.success).toBe(false);
      expect(error.status).toBe(500);
    });

    it('should handle rate limiting', () => {
      const error = createErrorResponse('Too many requests', 429);

      expect(error.success).toBe(false);
      expect(error.status).toBe(429);
    });
  });

  describe('Error Response Consistency', () => {
    it('should ensure all error responses have required fields', () => {
      const errors = [
        createErrorResponse('Error 1'),
        createErrorResponse('Error 2', 404),
        createErrorResponse('Error 3', 500, { detail: 'info' }),
      ];

      errors.forEach(error => {
        expect(error).toHaveProperty('success');
        expect(error).toHaveProperty('data');
        expect(error).toHaveProperty('error');
        expect(error.success).toBe(false);
        expect(error.data).toBeNull();
      });
    });
  });
});


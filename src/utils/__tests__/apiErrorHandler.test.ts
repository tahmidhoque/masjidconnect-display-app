/**
 * Tests for apiErrorHandler utilities
 */

import {
  createErrorResponse,
  normalizeApiResponse,
  validateApiResponse,
} from "../apiErrorHandler";

describe("apiErrorHandler", () => {
  describe("createErrorResponse", () => {
    it("should create a proper error response", () => {
      const result = createErrorResponse("Network error");

      expect(result).toEqual({
        success: false,
        error: "Network error",
        data: null,
        status: undefined,
      });
    });

    it("should include status code when provided", () => {
      const result = createErrorResponse("Server error", 500);

      expect(result.status).toBe(500);
      expect(result.success).toBe(false);
    });

    it("should include details", () => {
      const details = { url: "/api/test" };
      const result = createErrorResponse("Error", 404, details);

      expect(result.status).toBe(404);
      expect(result.data).toBeNull();
    });
  });

  describe("normalizeApiResponse", () => {
    it("should normalize successful response", () => {
      const partial = {
        success: true,
        data: { test: "value" },
      };

      const result = normalizeApiResponse(partial);

      expect(result).toEqual({
        success: true,
        data: { test: "value" },
      });
    });

    it("should set data to null for unsuccessful response", () => {
      const partial = {
        success: false,
        error: "Failed",
      };

      const result = normalizeApiResponse(partial);

      expect(result).toEqual({
        success: false,
        data: null,
        error: "Failed",
      });
    });

    it("should preserve optional fields", () => {
      const partial = {
        success: true,
        data: { test: "value" },
        cached: true,
        timestamp: 123456,
        status: 200,
      };

      const result = normalizeApiResponse(partial);

      expect(result.cached).toBe(true);
      expect(result.timestamp).toBe(123456);
      expect(result.status).toBe(200);
    });

    it("should handle missing data field", () => {
      const partial = {
        success: true,
      };

      const result = normalizeApiResponse(partial);

      expect(result.data).toBeNull();
    });
  });

  describe("validateApiResponse", () => {
    it("should validate correct response", () => {
      const response = {
        success: true,
        data: { test: "value" },
      };

      const result = validateApiResponse(response);

      expect(result).toEqual(response);
    });

    it("should handle error response without data", () => {
      const response = {
        success: false,
        error: "Failed",
      };

      const result = validateApiResponse(response);

      expect(result.data).toBeNull();
      expect(result.success).toBe(false);
    });

    it("should create error response for invalid format", () => {
      const invalid = { someField: "value" };

      const result = validateApiResponse(invalid);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid API response format");
      expect(result.data).toBeNull();
    });

    it("should handle null input", () => {
      const result = validateApiResponse(null);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid API response format");
    });
  });
});

/**
 * CORS Testing Utilities
 * 
 * This file contains helper functions to test CORS configuration with the backend API.
 * Run these tests from the browser console to diagnose CORS issues.
 */

// Test a single endpoint for CORS compatibility
export const testCorsForEndpoint = async (endpoint, apiKey = null, screenId = null) => {
  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  
  // Add auth headers if provided
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  
  if (screenId) {
    headers['X-Screen-ID'] = screenId;
  }
  
  console.log(`Testing CORS for endpoint: ${baseUrl}${endpoint}`);
  console.log('Headers:', headers);
  
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers,
      mode: 'cors'
    });
    
    console.log(`✅ CORS request succeeded for ${endpoint}`);
    console.log('Status:', response.status);
    console.log('Content type:', response.headers.get('content-type'));
    
    return {
      success: true,
      status: response.status,
      endpoint
    };
  } catch (error) {
    console.error(`❌ CORS error for ${endpoint}:`, error.message);
    
    return {
      success: false,
      error: error.message,
      endpoint
    };
  }
};

// Test all main endpoints
export const testAllEndpoints = async (apiKey = null, screenId = null) => {
  const endpoints = [
    '/api/screens/content',
    '/api/prayer-status',
    '/api/screen/prayer-times',
    '/api/events'
  ];
  
  console.log('===== TESTING ALL ENDPOINTS FOR CORS COMPATIBILITY =====');
  console.log(`API URL: ${process.env.REACT_APP_API_URL || 'http://localhost:3000'}`);
  console.log(`Auth: ${apiKey ? 'Yes' : 'No'}, Screen ID: ${screenId ? 'Yes' : 'No'}`);
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testCorsForEndpoint(endpoint, apiKey, screenId);
    results.push(result);
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`===== COMPLETED: ${successCount}/${endpoints.length} endpoints passed =====`);
  
  return results;
};

// To use these functions from the browser console:
// 1. Import the module: import * as corsTest from './utils/cors-test.js'
// 2. Test all endpoints: corsTest.testAllEndpoints('your-api-key', 'your-screen-id')
// 3. Or test a specific endpoint: corsTest.testCorsForEndpoint('/api/screens/content', 'your-api-key', 'your-screen-id')

// Make functions available on window for console access
if (typeof window !== 'undefined') {
  window.corsTest = {
    testCorsForEndpoint,
    testAllEndpoints
  };
  console.log('CORS testing utilities loaded. Use window.corsTest.testAllEndpoints() in the console to test.');
} 
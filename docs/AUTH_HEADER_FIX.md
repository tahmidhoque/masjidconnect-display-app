# Authentication Header Fix

## Issue Summary

Content endpoint API calls were failing with 401 Unauthorized errors despite the API interceptor logs showing that the bearer token was being set correctly. The interceptor was logging that headers were being added, but the actual network requests were missing the `Authorization` header.

Interestingly, `X-Screen-ID` and `X-Masjid-ID` headers WERE being sent, but `Authorization` was NOT - despite all three being set using the same method in the interceptor.

## Root Cause

The issue was that setting headers in an axios request interceptor using `config.headers.set()` was not reliably propagating the `Authorization` header to the actual network request in axios 1.x. This appears to be related to how axios 1.x internally handles the `Authorization` header differently from custom headers.

## Solution: Use Axios Default Headers Instead of Interceptor

Instead of relying on the request interceptor to set headers on each request's config, we now set authentication headers as **default headers on the axios instance** itself. This ensures headers are always included in every request.

### Key Changes:

1. **New `setDefaultAuthHeaders()` method** - Sets headers on `this.client.defaults.headers.common`
2. **New `clearDefaultAuthHeaders()` method** - Removes headers when credentials are cleared
3. **Headers set in three places**:
   - `setCredentials()` - When pairing completes
   - `loadCredentials()` - On app startup
   - Interceptor fallback - Recovery mechanism if defaults not set

## The Fix

Changed the request interceptor to use the `set()` method provided by Axios 1.x's `AxiosHeaders` object instead of direct property assignment:

### Before:
```typescript
config.headers["Authorization"] = `Bearer ${this.credentials.apiKey}`;
config.headers["X-Screen-ID"] = this.credentials.screenId;
```

### After:
```typescript
if (typeof config.headers.set === 'function') {
  config.headers.set("Authorization", `Bearer ${this.credentials.apiKey}`);
  config.headers.set("X-Screen-ID", this.credentials.screenId);
  config.headers.set("Content-Type", "application/json");
  config.headers.set("Accept", "application/json");
} else {
  // Fallback to direct assignment for older Axios versions
  config.headers["Authorization"] = `Bearer ${this.credentials.apiKey}`;
  config.headers["X-Screen-ID"] = this.credentials.screenId;
}
```

## Changes Made

1. **New `setDefaultAuthHeaders()` Method**:
   ```typescript
   private setDefaultAuthHeaders(apiKey: string, screenId: string): void {
     this.client.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;
     this.client.defaults.headers.common['X-Screen-ID'] = screenId;
     // Also sets X-Masjid-ID if available in localStorage
   }
   ```

2. **New `clearDefaultAuthHeaders()` Method**:
   ```typescript
   private clearDefaultAuthHeaders(): void {
     delete this.client.defaults.headers.common['Authorization'];
     delete this.client.defaults.headers.common['X-Screen-ID'];
     delete this.client.defaults.headers.common['X-Masjid-ID'];
   }
   ```

3. **Updated `setCredentials()`** - Calls `setDefaultAuthHeaders()` immediately when credentials are set

4. **Updated `loadCredentials()`** - Calls `setDefaultAuthHeaders()` when credentials are loaded on app startup

5. **Updated `clearCredentials()`** - Calls `clearDefaultAuthHeaders()` when logging out

6. **Simplified Request Interceptor** - Now only serves as:
   - Fallback mechanism if defaults weren't set properly
   - Logging for debugging purposes

## Why This Works

Setting headers on `this.client.defaults.headers.common` ensures that:
- Headers are part of the axios instance configuration, not just request config
- Headers are automatically included in EVERY request made by that axios instance
- No reliance on interceptor timing or config object manipulation
- Headers cannot be accidentally overwritten by request options

## Testing

After this fix, you should see in the console:
1. `🔐 [MasjidDisplayClient] Default auth headers set on axios instance:` - When credentials are set
2. `🔑 [MasjidDisplayClient] Credentials loaded on startup:` - When app restarts with existing credentials
3. `🎯 [API] Request will be sent with default headers:` - For each request, showing Authorization is set
4. `✅ [API] Request completed:` - After each request, confirming auth header was sent

In the browser Network tab:
- The `Authorization: Bearer ...` header should now appear in request headers
- API endpoints should return 200 instead of 401

## Related Files

- `src/api/masjidDisplayClient.ts` - Main API client with request interceptor
- `src/services/dataSyncService.ts` - Service that calls content endpoints
- `src/store/slices/contentSlice.ts` - Redux slice that handles content state

## Additional Notes

- This fix maintains backwards compatibility with older Axios versions through the fallback
- All authentication headers (Authorization, X-Screen-ID, X-Masjid-ID) now use the same method
- The fix applies to all API requests, not just content endpoints
- Enhanced logging will help identify if this issue recurs


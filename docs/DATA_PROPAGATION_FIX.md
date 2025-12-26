# Data Propagation Fix - 26 Dec 2024

## Problem Summary

After the recent refactor of the communication and credentials system, the app could successfully:
- ✅ Pair with the backend
- ✅ Establish WebSocket connection
- ✅ Receive data from the API

BUT:
- ❌ Data was not propagating to the Redux store
- ❌ Display remained stuck on loading screen
- ❌ UI components had no data to render

## Root Cause

The `realtimeMiddleware` was calling `syncService` methods directly instead of dispatching Redux actions:

```typescript
// BEFORE (BROKEN):
websocketService.on('content:update', () => {
  syncService.syncContent(); // ❌ This bypassed Redux!
});

websocketService.on('prayer-times:update', () => {
  syncService.syncPrayerTimes(); // ❌ This bypassed Redux!
});
```

### The Data Flow Issue

**Broken Flow:**
1. WebSocket receives `content:update` event
2. Middleware calls `syncService.syncContent()` directly
3. SyncService fetches data from API
4. Data is cached in storage
5. **Redux store is NEVER updated** ❌
6. React components never re-render
7. Display stuck on loader

**Expected Flow:**
1. WebSocket receives `content:update` event
2. Middleware dispatches Redux action `refreshAllContent()`
3. Redux thunk calls `syncService.syncContent()`
4. SyncService fetches data from API
5. Redux reducer updates the store ✅
6. React components re-render ✅
7. Display shows data ✅

## The Fix

Changed the `realtimeMiddleware` to dispatch Redux actions instead of calling `syncService` directly:

### 1. Content Updates (line 193-202)
```typescript
// AFTER (FIXED):
websocketService.on('content:update', () => {
  logger.info('[RealtimeMiddleware] Content update notification - dispatching Redux action');
  import('../slices/contentSlice').then(({ refreshAllContent }) => {
    api.dispatch(refreshAllContent({ forceRefresh: true }));
  });
});
```

### 2. Prayer Times Updates (line 204-213)
```typescript
// AFTER (FIXED):
websocketService.on('prayer-times:update', () => {
  logger.info('[RealtimeMiddleware] Prayer times update notification - dispatching Redux action');
  import('../slices/contentSlice').then(({ refreshPrayerTimes }) => {
    api.dispatch(refreshPrayerTimes({ forceRefresh: true }));
  });
});
```

### 3. RELOAD_CONTENT Command (line 278-283)
```typescript
// AFTER (FIXED):
case 'RELOAD_CONTENT':
  logger.info('[RealtimeMiddleware] RELOAD_CONTENT command - dispatching Redux action');
  const { refreshAllContent: reloadContentAction } = await import('../slices/contentSlice');
  api.dispatch(reloadContentAction({ forceRefresh: true }));
  break;
```

### 4. CLEAR_CACHE Command (line 285-291)
```typescript
// AFTER (FIXED):
case 'CLEAR_CACHE':
  logger.info('[RealtimeMiddleware] CLEAR_CACHE command - dispatching Redux action');
  const { default: apiClientModule } = await import('../../api/apiClient');
  await apiClientModule.clearCache();
  const { refreshAllContent: clearCacheAction } = await import('../slices/contentSlice');
  api.dispatch(clearCacheAction({ forceRefresh: true }));
  break;
```

### 5. REFRESH_PRAYER_TIMES Command (line 308-313)
```typescript
// AFTER (FIXED):
case 'REFRESH_PRAYER_TIMES':
  logger.info('[RealtimeMiddleware] REFRESH_PRAYER_TIMES command - dispatching Redux action');
  const { refreshPrayerTimes: refreshPrayerAction } = await import('../slices/contentSlice');
  api.dispatch(refreshPrayerAction({ forceRefresh: true }));
  break;
```

## Why Dynamic Imports?

Used dynamic imports to avoid circular dependency issues:
```typescript
import('../slices/contentSlice').then(({ refreshAllContent }) => {
  api.dispatch(refreshAllContent({ forceRefresh: true }));
});
```

This ensures:
- No circular dependency between middleware and slices
- Redux store is always available before dispatch
- Clean separation of concerns

## Additional Fix Required: Storage Integration (26 Dec - Part 2)

### Second Issue Discovered

After fixing the middleware, the display showed but data wasn't loading. Investigation revealed:

**Root Cause:** `apiClient` and `storageService` used DIFFERENT storage databases:
- `apiClient` cached to default localforage database with keys like `cache_content`  
- `storageService` used "MasjidConnect" database with keys like `screenContent`
- Data was cached by API but Redux couldn't read it!

**Solution:** Modified `apiClient.getWithCache()` to also save to `storageService` AND extract nested data:

```typescript
// In apiClient.ts getWithCache() method:
if (response.success && response.data) {
  // Cache in apiClient's cache
  await this.cacheData(cacheKey, response.data, ttl);
  
  // CRITICAL FIX: Also save to storageService for Redux
  await this.saveToStorageService(cacheKey, response.data);
  
  return response;
}

// New method to bridge storage systems AND extract nested data:
private async saveToStorageService(cacheKey: string, data: unknown): Promise<void> {
  const { default: storageService } = await import('../services/storageService');
  
  if (cacheKey === CACHE_KEYS.CONTENT) {
    // Save full content
    await storageService.saveScreenContent(data as any);
    
    // CRITICAL: Extract nested data that Redux expects separately
    const contentResponse = data as any;
    if (contentResponse.schedule) {
      await storageService.saveSchedule(contentResponse.schedule);
    }
    if (contentResponse.prayerTimes) {
      await storageService.savePrayerTimes(contentResponse.prayerTimes);
    }
    if (contentResponse.events) {
      await storageService.saveEvents(contentResponse.events);
    }
  } else if (cacheKey.startsWith(CACHE_KEYS.PRAYER_TIMES)) {
    await storageService.savePrayerTimes(data as any);
  } else if (cacheKey === CACHE_KEYS.EVENTS) {
    await storageService.saveEvents(data as any);
  }
}
```

### Third Issue: Nested Data Not Extracted (26 Dec - Part 3)

**Problem:** Prayer times loaded but masjid name showed default "Masjid Connect" and content carousel was empty.

**Root Cause:** The `ScreenContent` from API has nested structure:
```typescript
{
  screen: { name, ... },
  masjid: { name, timezone },
  schedule: { items: [...] },      // ← Nested inside content
  prayerTimes: { ... },             // ← Nested inside content  
  events: [...]                     // ← Nested inside content
}
```

Redux expected to read these separately:
- `getScreenContent()` → full content
- `getSchedule()` → separate schedule ❌ didn't exist!
- `getPrayerTimes()` → separate times  

**Solution:** Extract and save nested data separately when saving content.

## Expected Outcome

After ALL THREE fixes:
1. ✅ WebSocket events properly trigger Redux updates (Fix #1)
2. ✅ Data flows from API → both caches → Redux store (Fix #2)
3. ✅ Nested data (schedule, events) extracted and saved separately (Fix #3)
4. ✅ Loading screen transitions to display screen
5. ✅ Masjid name shows correctly (not "Masjid Connect" default)
6. ✅ Prayer times display with countdown
7. ✅ Content carousel shows announcements/events
8. ✅ Real-time updates work as expected

## Testing

To verify ALL fixes work:

1. **Start the app** and check the console for:
   ```
   [RealtimeMiddleware] Content update notification - dispatching Redux action
   [ApiClient] Saved screen content to storageService
   [ApiClient] Extracted and saved schedule separately
   [ApiClient] Extracted and saved prayer times from content
   [ContentSlice] Content refresh complete, all loading finished
   ```

2. **Check Redux DevTools** - you should see:
   - `content/refreshAllContent/pending`
   - `content/refreshAllContent/fulfilled`
   - State updates with:
     - `screenContent` populated
     - `schedule` populated with items array
     - `prayerTimes` populated
     - `masjidName` NOT "Masjid Connect" (your actual masjid name)

3. **Inspect Network tab** - API calls should complete successfully:
   - `/api/screen/content` returns 200
   - Response includes schedule, prayerTimes, events

4. **Check the display** - ALL should work:
   - ✅ Loading screen transitions to display screen
   - ✅ Header shows actual masjid name (not "Masjid Connect")
   - ✅ Prayer times table shows all prayers
   - ✅ Countdown to next prayer works
   - ✅ Content carousel shows announcements/events (not "Welcome to Masjid Connect")
   - ✅ Carousel auto-rotates through items

## Files Modified

- `/src/store/middleware/realtimeMiddleware.ts` - Fixed 5 locations where syncService was called directly
- `/src/api/apiClient.ts` - Added `saveToStorageService()` method to:
  - Bridge storage systems (Fix #2)
  - Extract and save nested data (Fix #3: schedule, prayer times, events)

## Related Documentation

- [COMMUNICATION-FLOWS.md](./COMMUNICATION-FLOWS.md) - System architecture
- [DOCUMENTATION-SUMMARY.md](./DOCUMENTATION-SUMMARY.md) - Overall system docs
- [LOADING_AND_SSE_FIX_SUMMARY.md](./LOADING_AND_SSE_FIX_SUMMARY.md) - Previous loading fixes

## Prevention

To prevent these issues in the future:

### Issue 1: Middleware Bypass
1. **Always dispatch Redux actions** from middleware, never call services directly
2. **Test data flow end-to-end** when refactoring communication systems
3. **Monitor Redux DevTools** to ensure state updates are happening
4. **Add integration tests** that verify data propagation from WebSocket to UI

### Issue 2: Storage Fragmentation
1. **Use a single storage abstraction layer** - don't have multiple storage systems
2. **Document storage architecture** - make it clear what stores data where
3. **Test offline scenarios** - ensure cached data is actually accessible
4. **Consider consolidating** `apiClient`'s cache and `storageService` into one unified system

### Why This Happened

The system evolved with two separate concerns:
- **apiClient**: Focused on HTTP caching to reduce network requests
- **storageService**: Focused on persistent app state for Redux

Both independently chose localforage but configured it differently, creating isolated databases. The quick fix bridges them, but a better long-term solution would be to consolidate into a single storage service that both systems use.

---

**Fix Status:** ✅ COMPLETE
**Testing Required:** Manual testing recommended before deployment


/**
 * Test Redux store — same reducer and middleware as production, no persist.
 */

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import type { RootState } from '@/store';

import authSlice from '@/store/slices/authSlice';
import contentSlice from '@/store/slices/contentSlice';
import uiSlice from '@/store/slices/uiSlice';
import emergencySlice from '@/store/slices/emergencySlice';

import { emergencyMiddleware } from '@/store/middleware/emergencyMiddleware';
import { realtimeMiddleware } from '@/store/middleware/realtimeMiddleware';

const rootReducer = combineReducers({
  auth: authSlice,
  content: contentSlice,
  ui: uiSlice,
  emergency: emergencySlice,
});

export type TestRootState = RootState;

/**
 * Create a Redux store for tests. No persist; optional preloaded state.
 */
export function createTestStore(preloadedState?: Partial<TestRootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredPaths: [
            'auth.lastUpdated',
            'content.lastUpdated',
            'content.prayerTimes',
            'emergency.alertHistory',
          ],
        },
      })
        .concat(emergencyMiddleware)
        .concat(realtimeMiddleware),
  });
}

export type TestStore = ReturnType<typeof createTestStore>;

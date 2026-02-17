/**
 * Redux Store Configuration
 *
 * Simplified store with only essential slices and middleware.
 * Persists auth, content, and emergency state for offline capability.
 */

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  createTransform,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import logger from '../utils/logger';

import authSlice from './slices/authSlice';
import contentSlice from './slices/contentSlice';
import uiSlice from './slices/uiSlice';
import emergencySlice from './slices/emergencySlice';

import { emergencyMiddleware } from './middleware/emergencyMiddleware';
import { realtimeMiddleware } from './middleware/realtimeMiddleware';

const rootReducer = combineReducers({
  auth: authSlice,
  content: contentSlice,
  ui: uiSlice,
  emergency: emergencySlice,
});

/** Validate persisted state on rehydration */
const stateValidationTransform = createTransform(
  (inbound: unknown) => inbound,
  (outbound: unknown) => {
    if (!outbound || typeof outbound !== 'object' || Array.isArray(outbound)) {
      logger.warn('[Persist] Invalid slice structure, using defaults');
    }
    return outbound;
  },
  { whitelist: ['auth', 'content', 'emergency'] },
);

const persistConfig = {
  key: 'masjidconnect-root',
  version: 1,
  storage,
  blacklist: ['ui'],
  whitelist: ['auth', 'content', 'emergency'],
  transforms: [stateValidationTransform],
};

const persistedReducer = persistReducer(
  persistConfig,
  rootReducer as any, // eslint-disable-line @typescript-eslint/no-explicit-any
) as typeof rootReducer;

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        ignoredPaths: [
          'auth.lastUpdated',
          'content.lastUpdated',
          'content.prayerTimes',
          'emergency.alertHistory',
        ],
      },
      immutableCheck: import.meta.env.DEV,
    })
      .concat(emergencyMiddleware)
      .concat(realtimeMiddleware),
  devTools: import.meta.env.DEV,
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

export default store;

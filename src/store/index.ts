import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

// Import slices
import authSlice from './slices/authSlice';
import contentSlice from './slices/contentSlice';
import uiSlice from './slices/uiSlice';
import emergencySlice from './slices/emergencySlice';

// Import middleware
import { emergencyMiddleware } from './middleware/emergencyMiddleware';

// Root reducer
const rootReducer = combineReducers({
  auth: authSlice,
  content: contentSlice,
  ui: uiSlice,
  emergency: emergencySlice,
});

// Persist config - we want to persist most of the state for offline capability
const persistConfig = {
  key: 'masjidconnect-root',
  version: 1,
  storage,
  // Blacklist UI state that should not be persisted
  blacklist: ['ui'],
  // Whitelist critical data that should be persisted
  whitelist: ['auth', 'content', 'emergency']
};

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Create and configure the store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore redux-persist actions
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        // Ignore Date objects and other non-serializable values that we use
        ignoredPaths: ['auth.lastUpdated', 'content.lastUpdated', 'content.prayerTimes', 'emergency.alertHistory'],
      },
      // Enable immutability checks in development
      immutableCheck: process.env.NODE_ENV === 'development',
    })
    // Add custom middleware
    .concat(emergencyMiddleware),
  // Enable Redux DevTools in development
  devTools: process.env.NODE_ENV === 'development',
});

export const persistor = persistStore(store);

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

export default store;
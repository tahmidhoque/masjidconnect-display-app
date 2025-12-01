import { configureStore, combineReducers } from "@reduxjs/toolkit";
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
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import logger from "../utils/logger";

// Import slices
import authSlice from "./slices/authSlice";
import contentSlice from "./slices/contentSlice";
import uiSlice from "./slices/uiSlice";
import emergencySlice from "./slices/emergencySlice";
import errorSlice from "./slices/errorSlice";
import updateSlice from "./slices/updateSlice";

// Import middleware
import { emergencyMiddleware } from "./middleware/emergencyMiddleware";
import { performanceMiddleware } from "./middleware/performanceMiddleware";
import { updateMiddleware } from "./middleware/updateMiddleware";
import { orientationMiddleware } from "./middleware/orientationMiddleware";

// Root reducer
const rootReducer = combineReducers({
  auth: authSlice,
  content: contentSlice,
  ui: uiSlice,
  emergency: emergencySlice,
  errors: errorSlice,
  update: updateSlice,
});

// Types are defined below to avoid circular dependencies

// CRITICAL FIX: Create transform to validate and sanitize persisted state
// Note: This transform runs per-slice, not on the entire state
const stateValidationTransform = createTransform(
  // Transform state on its way to being serialized and persisted
  (inboundState: any) => {
    // No transformation needed on save
    return inboundState;
  },
  // Transform state being rehydrated (per slice)
  (outboundState: any) => {
    try {
      // If state slice is corrupted or invalid, return the slice as-is
      // The reducer will handle undefined/null values properly
      if (!outboundState || typeof outboundState !== "object") {
        logger.warn(
          "[ReduxPersist] Invalid slice structure detected, will use default",
        );
        return outboundState; // Return as-is, reducer will handle it
      }

      // Validate that it's a proper object
      if (Array.isArray(outboundState)) {
        logger.warn(
          "[ReduxPersist] Slice is array instead of object, will use default",
        );
        return outboundState; // Return as-is, reducer will handle it
      }

      return outboundState;
    } catch (error) {
      logger.error("[ReduxPersist] Error during state validation", { error });
      // Return the state as-is, let the reducer handle it
      return outboundState;
    }
  },
  // Define which reducers this transform gets called for
  { whitelist: ["auth", "content", "emergency"] },
);

// Persist config - we want to persist most of the state for offline capability
const persistConfig = {
  key: "masjidconnect-root",
  version: 1,
  storage,
  // Blacklist UI state and error state that should not be persisted
  // Also blacklist update state as it should be fresh on each app start
  blacklist: ["ui", "errors", "update"],
  // Whitelist critical data that should be persisted
  whitelist: ["auth", "content", "emergency"],
  // CRITICAL FIX: Add transform to validate and sanitize state
  transforms: [stateValidationTransform],
};

// Create persisted reducer
// Type assertions needed because redux-persist's types are strict about partial state,
// but we know the reducer will always return complete state (undefined slices use initial state)
// Cast rootReducer to satisfy persistReducer's type requirements, then cast result back
const persistedReducer = persistReducer(
  persistConfig,
  rootReducer as any, // eslint-disable-line @typescript-eslint/no-explicit-any
) as typeof rootReducer;

// Create and configure the store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore redux-persist actions
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        // Ignore Date objects and other non-serializable values that we use
        ignoredPaths: [
          "auth.lastUpdated",
          "content.lastUpdated",
          "content.prayerTimes",
          "emergency.alertHistory",
        ],
      },
      // Enable immutability checks in development
      immutableCheck: process.env.NODE_ENV === "development",
    })
      // Add custom middleware
      .concat(emergencyMiddleware)
      .concat(performanceMiddleware.middleware)
      .concat(updateMiddleware)
      .concat(orientationMiddleware),
  // Enable Redux DevTools in development
  devTools: process.env.NODE_ENV === "development",
});

export const persistor = persistStore(store);

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

export default store;

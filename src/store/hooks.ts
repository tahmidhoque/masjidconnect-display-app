import { useDispatch, useSelector, TypedUseSelectorHook } from "react-redux";
import { createSelector } from "@reduxjs/toolkit";
import type { RootState, AppDispatch } from "./index";

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Optimized memoized selectors for performance
// Note: Avoid selectors that return the entire state slice - they cause unnecessary re-renders

export const selectAuthStatus = createSelector(
  (state: RootState) => state.auth,
  (auth) => ({
    isAuthenticated: auth.isAuthenticated,
    isPairing: auth.isPairing,
    screenId: auth.screenId,
    pairingError: auth.pairingError,
  }),
);

export const selectContentData = createSelector(
  (state: RootState) => state.content,
  (content) => ({
    masjidName: content.masjidName,
    prayerTimes: content.prayerTimes,
    screenContent: content.screenContent,
    events: content.events,
    isLoading: content.isLoading,
    lastUpdated: content.lastUpdated,
  }),
);

// ✅ FIXED: Add proper transformation to avoid identity function warning
export const selectPrayerTimes = createSelector(
  (state: RootState) => state.content.prayerTimes,
  (prayerTimes) => ({
    data: prayerTimes,
    hasData: !!prayerTimes,
    timestamp: prayerTimes ? new Date().getTime() : null,
  }),
);

// ✅ FIXED: Add proper transformation
export const selectContentItems = createSelector(
  (state: RootState) => state.content.screenContent?.schedule?.items,
  (items) => ({
    items: items || [],
    count: items?.length || 0,
    hasItems: !!(items && items.length > 0),
  }),
);

// ✅ FIXED: Add proper transformation
export const selectSchedule = createSelector(
  (state: RootState) => state.content.schedule,
  (schedule) => ({
    data: schedule,
    hasSchedule: !!schedule,
    itemsCount: schedule?.items?.length || 0,
    name: schedule?.name || "Default Schedule",
  }),
);

// ✅ FIXED: Add proper transformation
export const selectEvents = createSelector(
  (state: RootState) => state.content.events,
  (events) => ({
    events: events || [],
    count: events?.length || 0,
    hasEvents: !!(events && events.length > 0),
  }),
);

// ✅ FIXED: Add proper transformation
export const selectMasjidName = createSelector(
  (state: RootState) => state.content.masjidName,
  (masjidName) => ({
    name: masjidName || "MasjidConnect",
    hasCustomName: !!masjidName,
  }),
);

export const selectUIStatus = createSelector(
  (state: RootState) => state.ui,
  (ui) => ({
    orientation: ui.orientation,
    isInitializing: ui.isInitializing,
    errorMessage: ui.errorMessage,
    initializationStage: ui.initializationStage,
  }),
);

export const selectCurrentAlert = createSelector(
  (state: RootState) => state.emergency.currentAlert,
  (currentAlert) => currentAlert,
);

export const selectActiveErrors = createSelector(
  (state: RootState) => state.errors.activeErrors,
  (activeErrors) => activeErrors || [],
);

// Prayer announcement selectors
export const selectPrayerAnnouncement = createSelector(
  (state: RootState) => state.content,
  (content) => ({
    showPrayerAnnouncement: content.showPrayerAnnouncement,
    prayerAnnouncementName: content.prayerAnnouncementName,
    isPrayerJamaat: content.isPrayerJamaat,
  }),
);

// Combined selectors for commonly used data combinations
export const selectDisplayData = createSelector(
  [selectContentData, selectUIStatus, selectCurrentAlert],
  (content, ui, currentAlert) => ({
    ...content,
    ...ui,
    currentAlert,
  }),
);

// ✅ FIXED: Optimized selector for content carousel - avoid spread operations that cause identity issues
export const selectCarouselData = createSelector(
  [
    (state: RootState) => state.content.schedule,
    (state: RootState) => state.content.events,
    (state: RootState) => state.content.masjidName,
    (state: RootState) => state.content.isLoading,
    (state: RootState) => state.emergency.currentAlert,
    (state: RootState) => state.content.carouselTime,
    (state: RootState) => state.content.showPrayerAnnouncement,
    (state: RootState) => state.content.prayerAnnouncementName,
    (state: RootState) => state.content.isPrayerJamaat,
    (state: RootState) => state.ui.orientation,
  ],
  (
    schedule,
    events,
    masjidName,
    isLoading,
    currentAlert,
    carouselTime,
    showPrayerAnnouncement,
    prayerAnnouncementName,
    isPrayerJamaat,
    orientation,
  ) => ({
    schedule,
    events: events || [],
    masjidName: masjidName || "MasjidConnect",
    isLoading,
    currentAlert,
    carouselTime,
    showPrayerAnnouncement,
    prayerAnnouncementName,
    isPrayerJamaat,
    orientation,
  }),
);

// ✅ FIXED: Performance-optimized selector for ModernLandscapeDisplay
export const selectLandscapeDisplayData = createSelector(
  [
    (state: RootState) => state.content.masjidName,
    (state: RootState) => state.content.prayerTimes,
    (state: RootState) => state.emergency.currentAlert,
    (state: RootState) => state.ui.orientation,
  ],
  (masjidName, prayerTimes, currentAlert, orientation) => ({
    masjidName: masjidName || "MasjidConnect",
    prayerTimes,
    currentAlert,
    orientation,
    hasPrayerTimes: !!prayerTimes,
  }),
);

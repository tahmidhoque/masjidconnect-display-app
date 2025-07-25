import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import type { RootState, AppDispatch } from './index';

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Memoized selectors for performance optimization
export const selectAuth = createSelector(
  (state: RootState) => state.auth,
  (auth) => auth
);

export const selectAuthStatus = createSelector(
  selectAuth,
  (auth) => ({
    isAuthenticated: auth.isAuthenticated,
    isPairing: auth.isPairing,
    screenId: auth.screenId,
    pairingError: auth.pairingError,
  })
);

export const selectContent = createSelector(
  (state: RootState) => state.content,
  (content) => content
);

export const selectContentData = createSelector(
  selectContent,
  (content) => ({
    masjidName: content.masjidName,
    prayerTimes: content.prayerTimes,
    screenContent: content.screenContent,
    events: content.events,
    isLoading: content.isLoading,
    lastUpdated: content.lastUpdated,
  })
);

export const selectPrayerTimes = createSelector(
  selectContent,
  (content) => content.prayerTimes
);

export const selectContentItems = createSelector(
  selectContent,
  (content) => content.screenContent?.schedule?.items || []
);

export const selectUI = createSelector(
  (state: RootState) => state.ui,
  (ui) => ui
);

export const selectUIStatus = createSelector(
  selectUI,
  (ui) => ({
    orientation: ui.orientation,
    isInitializing: ui.isInitializing,
    errorMessage: ui.errorMessage,
  })
);

export const selectEmergency = createSelector(
  (state: RootState) => state.emergency,
  (emergency) => emergency
);

export const selectCurrentAlert = createSelector(
  selectEmergency,
  (emergency) => emergency.currentAlert
);

export const selectErrors = createSelector(
  (state: RootState) => state.errors,
  (errors) => errors
);

// Combined selectors for commonly used data combinations
export const selectDisplayData = createSelector(
  [selectContentData, selectUIStatus, selectCurrentAlert],
  (content, ui, currentAlert) => ({
    ...content,
    ...ui,
    currentAlert,
  })
);

// Selector for content carousel specific data
export const selectCarouselData = createSelector(
  [selectContentItems, selectContent, selectCurrentAlert],
  (contentItems, content, currentAlert) => ({
    contentItems,
    masjidName: content.masjidName,
    isLoading: content.isLoading,
    currentAlert,
    carouselTime: content.carouselTime,
  })
);
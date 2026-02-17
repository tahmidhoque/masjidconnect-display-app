/**
 * Typed Redux Hooks & Memoised Selectors
 */

import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import type { RootState, AppDispatch } from './index';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

/* ------------------------------------------------------------------ */
/*  Memoised selectors                                                */
/* ------------------------------------------------------------------ */

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

export const selectPrayerTimes = createSelector(
  (state: RootState) => state.content.prayerTimes,
  (prayerTimes) => ({
    data: prayerTimes,
    hasData: !!prayerTimes,
  }),
);

export const selectSchedule = createSelector(
  (state: RootState) => state.content.schedule,
  (schedule) => ({
    data: schedule,
    hasSchedule: !!schedule,
    itemsCount: schedule?.items?.length || 0,
    name: schedule?.name || 'Default Schedule',
  }),
);

export const selectEvents = createSelector(
  (state: RootState) => state.content.events,
  (events) => ({
    events: events || [],
    count: events?.length || 0,
    hasEvents: !!(events && events.length > 0),
  }),
);

export const selectMasjidName = createSelector(
  (state: RootState) => state.content.masjidName,
  (name) => ({
    name: name || 'MasjidConnect',
    hasCustomName: !!name,
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
  (alert) => alert,
);

export const selectPrayerAnnouncement = createSelector(
  (state: RootState) => state.content,
  (content) => ({
    showPrayerAnnouncement: content.showPrayerAnnouncement,
    prayerAnnouncementName: content.prayerAnnouncementName,
    isPrayerJamaat: content.isPrayerJamaat,
  }),
);

/** Combined selector for the content carousel */
export const selectCarouselData = createSelector(
  [
    (s: RootState) => s.content.schedule,
    (s: RootState) => s.content.events,
    (s: RootState) => s.content.masjidName,
    (s: RootState) => s.content.isLoading,
    (s: RootState) => s.emergency.currentAlert,
    (s: RootState) => s.content.carouselTime,
    (s: RootState) => s.content.showPrayerAnnouncement,
    (s: RootState) => s.content.prayerAnnouncementName,
    (s: RootState) => s.content.isPrayerJamaat,
    (s: RootState) => s.ui.orientation,
  ],
  (schedule, events, masjidName, isLoading, currentAlert, carouselTime, showAnnouncement, announcementName, isJamaat, orientation) => ({
    schedule,
    events: events || [],
    masjidName: masjidName || 'MasjidConnect',
    isLoading,
    currentAlert,
    carouselTime,
    showPrayerAnnouncement: showAnnouncement,
    prayerAnnouncementName: announcementName,
    isPrayerJamaat: isJamaat,
    orientation,
  }),
);

/** Combined selector for the main display layout */
export const selectLandscapeDisplayData = createSelector(
  [
    (s: RootState) => s.content.masjidName,
    (s: RootState) => s.content.prayerTimes,
    (s: RootState) => s.emergency.currentAlert,
    (s: RootState) => s.ui.orientation,
  ],
  (masjidName, prayerTimes, currentAlert, orientation) => ({
    masjidName: masjidName || 'MasjidConnect',
    prayerTimes,
    currentAlert,
    orientation,
    hasPrayerTimes: !!prayerTimes,
  }),
);

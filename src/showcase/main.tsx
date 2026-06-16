/**
 * Brochure showcase harness (dev-only).
 *
 * Mounts the REAL DisplayScreen against a preloaded Redux store seeded from a
 * scenario (see scenarios.ts). Renders one representative display state at the
 * native reference resolution so scripts/capture-brochure.mjs can screenshot it.
 *
 * Usage: /showcase.html?s=<scenario-id>
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';

import authSlice from '../store/slices/authSlice';
import contentSlice from '../store/slices/contentSlice';
import uiSlice from '../store/slices/uiSlice';
import emergencySlice from '../store/slices/emergencySlice';

import DisplayScreen from '../components/screens/DisplayScreen';
import EmergencyAlertOverlay from '../components/display/EmergencyAlertOverlay';
import '../index.css';

import {
  SCENARIOS,
  PRAYER_TIMES,
  BASE_SETTINGS,
  MASJID_NAME,
  MASJID_TZ,
} from './scenarios';

/* eslint-disable @typescript-eslint/no-explicit-any */

const params = new URLSearchParams(window.location.search);
const id = params.get('s') ?? 'ls-stack-verse';
const scenario = SCENARIOS[id];

if (!scenario) {
  document.body.innerHTML =
    `<pre style="color:#fff;font:14px monospace;padding:24px">Unknown scenario: ${id}\n\nAvailable:\n  ${Object.keys(SCENARIOS).join('\n  ')}</pre>`;
  throw new Error(`Unknown showcase scenario: ${id}`);
}

/* Force a clean carousel state (no jamaat-soon / in-prayer takeover) and, when
 * requested, the seasonal Ramadan theme. Honoured by the real hooks in DEV. */
const w = window as any;
w.__PRAYER_PHASE_FORCE = 'countdown-adhan';
if (scenario.ramadan) w.__RAMADAN_FORCE = true;

/* Give the emergency alert a sensible live auto-close window so the overlay
 * shows a realistic countdown rather than a years-away expiry. */
const emergencyAlert = scenario.emergency
  ? {
      ...scenario.emergency,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 9 * 60_000).toISOString(),
    }
  : null;

const rootReducer = combineReducers({
  auth: authSlice,
  content: contentSlice,
  ui: uiSlice,
  emergency: emergencySlice,
});
type LocalRootState = ReturnType<typeof rootReducer>;

const initial = rootReducer(undefined as any, { type: '@@SHOWCASE_INIT' });

const settings = { ...BASE_SETTINGS, ...(scenario.settings ?? {}) };
const masjidName = scenario.masjidName ?? MASJID_NAME;

const screenContent = {
  screen: {
    id: 'demo-screen',
    name: 'Demo Screen',
    orientation: scenario.orientation,
    contentConfig: { carouselInterval: 999999 },
    masjid: { name: masjidName, timezone: MASJID_TZ },
  },
  masjid: { name: masjidName, timezone: MASJID_TZ },
  layout: {
    id: 'demo-layout',
    updatedAt: '2026-06-01T00:00:00.000Z',
    config: scenario.layout,
  },
} as any;

const preloadedState = {
  ...initial,
  content: {
    ...initial.content,
    screenContent,
    prayerTimes: PRAYER_TIMES,
    schedule: {
      id: 'demo-schedule',
      name: 'Showcase',
      items: scenario.scheduleItems as any,
    },
    scheduledPlaylists: null,
    events: [],
    masjidName,
    masjidTimezone: MASJID_TZ,
    timeFormat: settings.timeFormat,
    displaySettings: settings,
    isLoading: false,
    isLoadingContent: false,
    isLoadingPrayerTimes: false,
    isLoadingSchedule: false,
  },
  ui: {
    ...initial.ui,
    orientation: scenario.orientation,
    rotationDegrees: 0,
  },
  emergency: {
    ...initial.emergency,
    currentAlert: emergencyAlert,
  },
} as LocalRootState;

const store = configureStore({
  reducer: rootReducer,
  preloadedState,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
});

const ShowcaseApp: React.FC = () => (
  <Provider store={store}>
    <DisplayScreen />
    {scenario.emergency ? <EmergencyAlertOverlay /> : null}
  </Provider>
);

const root = createRoot(document.getElementById('showcase-root')!);
root.render(<ShowcaseApp />);

/* Signal readiness once fonts have loaded and lazy slides / QR / content-scaling
 * effects have had a moment to settle. The capture script waits on this flag. */
function signalReady(): void {
  const fontsReady: Promise<unknown> =
    (document as any).fonts?.ready ?? Promise.resolve();
  void Promise.resolve(fontsReady).then(() => {
    window.setTimeout(() => {
      requestAnimationFrame(() => {
        w.__SHOWCASE_READY = true;
      });
    }, 1300);
  });
}
signalReady();

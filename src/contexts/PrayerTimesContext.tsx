/**
 * PrayerTimesContext
 *
 * Provides prayer times data from a single usePrayerTimes call to avoid
 * multiple hook instances causing excessive re-renders and effect runs.
 * DisplayScreen wraps its content in this provider.
 */

import React, { createContext, useContext } from 'react';
import { usePrayerTimes } from '../hooks/usePrayerTimes';
import type { TomorrowsJamaatsMap } from '../hooks/usePrayerTimes';

export type PrayerTimesContextValue = ReturnType<typeof usePrayerTimes>;

const PrayerTimesContext = createContext<PrayerTimesContextValue | null>(null);

export const PrayerTimesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = usePrayerTimes();
  return (
    <PrayerTimesContext.Provider value={value}>
      {children}
    </PrayerTimesContext.Provider>
  );
};

export function usePrayerTimesContext(): PrayerTimesContextValue {
  const ctx = useContext(PrayerTimesContext);
  if (!ctx) {
    throw new Error('usePrayerTimesContext must be used within PrayerTimesProvider');
  }
  return ctx;
}

export type { TomorrowsJamaatsMap };

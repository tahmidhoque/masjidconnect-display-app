import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import { PrayerTimes, PrayerStatus, EventsResponse, ScreenContent } from '../api/models';

interface OfflineContextType {
  isOnline: boolean;
  lastOnlineTime: Date | null;
  offlineDuration: number; // in seconds
  isSyncPending: boolean;
  lastSyncTime: Date | null;
  offlineData: {
    prayerTimes: PrayerTimes[] | null;
    prayerStatus: PrayerStatus | null;
    events: EventsResponse | null;
    screenContent: ScreenContent | null;
  };
  syncOfflineData: () => Promise<void>;
  calculateOfflinePrayerStatus: () => PrayerStatus | null;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const useOffline = (): OfflineContextType => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [lastOnlineTime, setLastOnlineTime] = useState<Date | null>(isOnline ? new Date() : null);
  const [offlineDuration, setOfflineDuration] = useState<number>(0);
  const [isSyncPending, setIsSyncPending] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [offlineData, setOfflineData] = useState<OfflineContextType['offlineData']>({
    prayerTimes: null,
    prayerStatus: null,
    events: null,
    screenContent: null
  });

  // Load offline data from storage on init
  useEffect(() => {
    const loadOfflineData = async () => {
      try {
        const [prayerTimes, prayerStatus, events, screenContent] = await Promise.all([
          localforage.getItem<PrayerTimes[]>('prayerTimes'),
          localforage.getItem<PrayerStatus>('prayerStatus'),
          localforage.getItem<EventsResponse>('events'),
          localforage.getItem<ScreenContent>('screenContent')
        ]);

        setOfflineData({
          prayerTimes,
          prayerStatus,
          events,
          screenContent
        });

        // Get last sync time
        const lastUpdated = await localforage.getItem<Record<string, string>>('lastUpdated');
        if (lastUpdated) {
          const times = Object.values(lastUpdated);
          if (times.length > 0) {
            const mostRecent = new Date(Math.max(...times.map(t => new Date(t).getTime())));
            setLastSyncTime(mostRecent);
          }
        }
      } catch (error) {
        console.error('Error loading offline data:', error);
      }
    };

    loadOfflineData();
  }, []);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineTime(new Date());
      setIsSyncPending(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update offline duration
  useEffect(() => {
    if (!isOnline && lastOnlineTime) {
      const intervalId = setInterval(() => {
        const now = new Date();
        const durationInSeconds = Math.floor((now.getTime() - lastOnlineTime.getTime()) / 1000);
        setOfflineDuration(durationInSeconds);
      }, 1000);

      return () => clearInterval(intervalId);
    } else {
      setOfflineDuration(0);
    }
  }, [isOnline, lastOnlineTime]);

  // Listen for storage changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key && e.key.startsWith('masjid_')) {
        // Reload all offline data if any masjid-related storage changes
        try {
          const [prayerTimes, prayerStatus, events, screenContent] = await Promise.all([
            localforage.getItem<PrayerTimes[]>('prayerTimes'),
            localforage.getItem<PrayerStatus>('prayerStatus'),
            localforage.getItem<EventsResponse>('events'),
            localforage.getItem<ScreenContent>('screenContent')
          ]);

          setOfflineData({
            prayerTimes,
            prayerStatus,
            events,
            screenContent
          });
        } catch (error) {
          console.error('Error reloading offline data:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Calculate current prayer status based on stored data when offline
  const calculateOfflinePrayerStatus = useCallback((): PrayerStatus | null => {
    if (!offlineData.prayerStatus || !offlineData.prayerTimes) {
      return null;
    }

    // Create a copy to avoid modifying the original
    const calculatedStatus = { ...offlineData.prayerStatus };
    
    // Update the timestamp to current time
    calculatedStatus.timestamp = new Date().toISOString();
    
    // If we have a nextPrayer time, check if it's now in the past
    if (calculatedStatus.nextPrayer) {
      const now = new Date();
      const nextPrayerTime = new Date(calculatedStatus.nextPrayer.time);
      
      if (now > nextPrayerTime) {
        // We've passed the next prayer time
        
        // Use the prayer times to determine the new current and next prayers
        const prayerTimes = offlineData.prayerTimes;
        const today = new Date().toISOString().split('T')[0];
        const todayPrayers = prayerTimes.find(p => p.date === today);
        
        if (todayPrayers) {
          const prayerOrder = ['FAJR', 'SUNRISE', 'ZUHR', 'ASR', 'MAGHRIB', 'ISHA'];
          const currentIndex = prayerOrder.indexOf(calculatedStatus.nextPrayer.name);
          
          if (currentIndex >= 0 && currentIndex < prayerOrder.length - 1) {
            // Update current prayer to what was the next prayer
            calculatedStatus.currentPrayer = calculatedStatus.nextPrayer;
            
            // Set the next prayer
            const nextPrayerName = prayerOrder[currentIndex + 1];
            // Use a type-safe accessor function for prayer times
            const nextPrayerTime = getPrayerTimeByName(todayPrayers, nextPrayerName.toLowerCase());
            calculatedStatus.nextPrayer = {
              name: nextPrayerName as any,
              time: nextPrayerTime
            };
            
            // Update times
            calculatedStatus.currentPrayerTime = calculatedStatus.nextPrayerTime;
            calculatedStatus.nextPrayerTime = nextPrayerTime;
            
            // For simplicity, we'll set the iqamah times to be 10 minutes after the adhan
            if (calculatedStatus.currentPrayerTime) {
              calculatedStatus.currentJamaatTime = calculateJamaatTime(calculatedStatus.currentPrayerTime, 10);
            }
            if (calculatedStatus.nextPrayerTime) {
              calculatedStatus.nextJamaatTime = calculateJamaatTime(calculatedStatus.nextPrayerTime, 10);
            }
            
            // Calculate time until next prayer
            calculatedStatus.timeUntilNextPrayer = calculateTimeDifference(new Date(), new Date(nextPrayerTime));
            
            // Only calculate time until next jamaat if nextJamaatTime is defined
            if (calculatedStatus.nextJamaatTime) {
              calculatedStatus.timeUntilNextJamaat = calculateTimeDifference(new Date(), new Date(calculatedStatus.nextJamaatTime));
            } else {
              calculatedStatus.timeUntilNextJamaat = "00:00:00";
            }
            
            // Set isAfterIsha
            calculatedStatus.isAfterIsha = calculatedStatus.currentPrayer.name === 'ISHA';
          } else if (currentIndex === prayerOrder.length - 1) {
            // We were at Isha, now we're after Isha
            calculatedStatus.isAfterIsha = true;
          }
        }
      }
    }
    
    return calculatedStatus;
  }, [offlineData.prayerStatus, offlineData.prayerTimes]);

  // Helper function to calculate Jamaat time (just for demo purposes)
  const calculateJamaatTime = (prayerTime: string, minutesAfter: number): string => {
    const time = new Date(prayerTime);
    time.setMinutes(time.getMinutes() + minutesAfter);
    return time.toISOString();
  };

  // Helper function to calculate time difference in HH:MM:SS format
  const calculateTimeDifference = (start: Date, end: Date): string => {
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return '00:00:00';
    
    const diffSecs = Math.floor(diffMs / 1000);
    const hours = Math.floor(diffSecs / 3600);
    const minutes = Math.floor((diffSecs % 3600) / 60);
    const seconds = diffSecs % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Sync offline data with the server
  const syncOfflineData = async (): Promise<void> => {
    if (!isOnline) {
      console.log('Cannot sync while offline');
      return;
    }

    setIsSyncPending(false);
    setLastSyncTime(new Date());
    
    // The actual sync will be handled by dataSyncService in the background
    // This function is mostly to update the UI state
  };

  const value: OfflineContextType = {
    isOnline,
    lastOnlineTime,
    offlineDuration,
    isSyncPending,
    lastSyncTime,
    offlineData,
    syncOfflineData,
    calculateOfflinePrayerStatus
  };

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
};

export default OfflineContext;

// Helper function to safely access prayer times by name
function getPrayerTimeByName(prayerTimes: PrayerTimes, name: string): string {
  // Map prayer names to their property names in the PrayerTimes object
  const prayerTimeMap: Record<string, keyof PrayerTimes> = {
    'fajr': 'fajr',
    'sunrise': 'sunrise',
    'zuhr': 'zuhr',
    'asr': 'asr',
    'maghrib': 'maghrib',
    'isha': 'isha',
    'jummah': 'jummahJamaat'
  };

  const propertyName = prayerTimeMap[name.toLowerCase()];
  if (propertyName && propertyName in prayerTimes) {
    return prayerTimes[propertyName] as string;
  }
  
  // Fallback to current time if the prayer name is not found
  console.error(`Prayer time not found for name: ${name}`);
  return new Date().toISOString();
} 
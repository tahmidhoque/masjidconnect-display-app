import { useState, useEffect, useCallback } from 'react';
import { PrayerTimes, PrayerStatus } from '../api/models';
import { useContent } from '../contexts/ContentContext';
import { 
  formatTimeToDisplay, 
  getNextPrayerTime, 
  getTimeUntilNextPrayer,
  getTimeDifferenceInMinutes
} from '../utils/dateUtils';
import masjidDisplayClient from '../api/masjidDisplayClient';
import logger from '../utils/logger';

interface FormattedPrayerTime {
  name: string;
  time: string;
  jamaat?: string;
  displayTime: string;
  displayJamaat?: string;
  isNext: boolean;
  isCurrent: boolean;
  timeUntil: string;
}

interface PrayerTimesHook {
  todaysPrayerTimes: FormattedPrayerTime[];
  nextPrayer: FormattedPrayerTime | null;
  currentPrayer: FormattedPrayerTime | null;
  currentDate: string;
  hijriDate: string | null;
  isJumuahToday: boolean;
  jumuahTime: string | null;
  jumuahDisplayTime: string | null;
}

const PRAYER_NAMES = ['Fajr', 'Sunrise', 'Zuhr', 'Asr', 'Maghrib', 'Isha'];

export const usePrayerTimes = (): PrayerTimesHook => {
  const { prayerTimes, prayerStatus, refreshPrayerStatus, refreshPrayerTimes } = useContent();
  const [todaysPrayerTimes, setTodaysPrayerTimes] = useState<FormattedPrayerTime[]>([]);
  const [nextPrayer, setNextPrayer] = useState<FormattedPrayerTime | null>(null);
  const [currentPrayer, setCurrentPrayer] = useState<FormattedPrayerTime | null>(null);
  const [currentDate, setCurrentDate] = useState<string>('');
  const [hijriDate, setHijriDate] = useState<string | null>(null);
  const [isJumuahToday, setIsJumuahToday] = useState<boolean>(false);
  const [jumuahTime, setJumuahTime] = useState<string | null>(null);
  const [jumuahDisplayTime, setJumuahDisplayTime] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState<number>(new Date().getDate());
  const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false);

  // Get and update Hijri date
  const fetchHijriDate = useCallback(async () => {
    try {
      const response = await fetch(`https://api.aladhan.com/v1/gToH?date=${new Date().toISOString().split('T')[0]}`);
      const data = await response.json();
      
      if (data.code === 200 && data.data) {
        const hijri = data.data.hijri;
        setHijriDate(`${hijri.day} ${hijri.month.en} ${hijri.year} AH`);
      }
    } catch (error) {
      logger.error('Error fetching Hijri date:', { error });
    }
  }, []);

  // Force refresh prayer data if needed, especially at midnight
  const checkForDayChange = useCallback(() => {
    const now = new Date();
    const newDay = now.getDate();
    
    // If the day has changed, force refresh the prayer data
    if (newDay !== currentDay) {
      logger.info('Day changed - refreshing prayer data', { oldDay: currentDay, newDay });
      setCurrentDay(newDay);
      
      // Clear all caches first
      masjidDisplayClient.invalidateAllCaches();
      
      // Force refresh prayer times and status with high priority
      setTimeout(() => {
        // Run after a short delay to ensure UI doesn't freeze
        refreshPrayerTimes();
        setTimeout(() => {
          refreshPrayerStatus();
        }, 500);
      }, 100);
      
      // Update date information
      setCurrentDate(
        now.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );
      
      // Check if today is Friday (5)
      setIsJumuahToday(now.getDay() === 5);
      
      // Refresh Hijri date
      fetchHijriDate();
    }
  }, [currentDay, refreshPrayerTimes, refreshPrayerStatus, fetchHijriDate]);

  // Update current date and check for day change
  useEffect(() => {
    try {
      const date = new Date();
      
      setCurrentDate(
        date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );

      // Check if today is Friday (5)
      setIsJumuahToday(date.getDay() === 5);

      // Initial force refresh on component mount to ensure fresh data
      if (!initialLoadComplete) {
        logger.info('Initial prayer times load - forcing refresh');
        // Invalidate cache to ensure fresh data
        masjidDisplayClient.invalidateAllCaches();
        // Force refresh both prayer times and status
        refreshPrayerTimes();
        setTimeout(() => {
          refreshPrayerStatus();
        }, 500);
        
        setInitialLoadComplete(true);
      }

      // Update every minute and check for day change
      const timer = setInterval(() => {
        try {
          checkForDayChange();
          processPrayerTimes();
        } catch (error) {
          logger.error('Error in timer update', { error });
        }
      }, 60 * 1000);

      return () => clearInterval(timer);
    } catch (error) {
      logger.error('Error in date initialization', { error });
    }
  }, [checkForDayChange, initialLoadComplete, refreshPrayerTimes, refreshPrayerStatus]);

  // Process prayer times when data changes
  useEffect(() => {
    try {
      if (prayerTimes || prayerStatus) {
        processPrayerTimes();
      }
    } catch (error) {
      logger.error('Error processing prayer times or status update', { error });
    }
  }, [prayerTimes, prayerStatus]);

  const processPrayerTimes = useCallback(() => {
    if (!prayerTimes) {
      logger.warn('Cannot process prayer times: no data available');
      return;
    }
    
    try {
      const now = new Date();
      const prayers: FormattedPrayerTime[] = [];
      
      // Check if we need to refresh data (e.g., if day has changed)
      checkForDayChange();
      
      // Use prayer status if available
      let nextPrayerName = '';
      let currentPrayerName = '';
      
      if (prayerStatus) {
        nextPrayerName = prayerStatus.nextPrayer;
        currentPrayerName = prayerStatus.currentPrayer;
        logger.debug('Using prayer status from API', { nextPrayer: nextPrayerName, currentPrayer: currentPrayerName });
      } else {
        // Calculate next prayer if prayer status is not available
        // Create a record of prayer times for the getNextPrayerTime function
        logger.debug('No prayer status available, calculating locally');
        const prayerRecord: Record<string, string> = {
          fajr: prayerTimes.fajr || '',
          sunrise: prayerTimes.sunrise || '',
          zuhr: prayerTimes.zuhr || '',
          asr: prayerTimes.asr || '',
          maghrib: prayerTimes.maghrib || '',
          isha: prayerTimes.isha || '',
        };
        
        const { name } = getNextPrayerTime(now, prayerRecord);
        nextPrayerName = name.toUpperCase();
        logger.debug('Calculated next prayer locally', { nextPrayer: nextPrayerName });
      }
      
      // Process each prayer time
      PRAYER_NAMES.forEach((name, index) => {
        try {
          const lowerName = name.toLowerCase();
          const time = prayerTimes[lowerName as keyof PrayerTimes] as string;
          const jamaat = prayerTimes[`${lowerName}Jamaat` as keyof PrayerTimes] as string | undefined;
          
          const isNext = nextPrayerName === name.toUpperCase();
          const isCurrent = currentPrayerName === name.toUpperCase();
          
          // Calculate time until prayer
          let timeUntil = '';
          if (isNext) {
            timeUntil = getTimeUntilNextPrayer(time);
          }

          const prayer: FormattedPrayerTime = {
            name,
            time,
            jamaat,
            displayTime: formatTimeToDisplay(time),
            displayJamaat: jamaat ? formatTimeToDisplay(jamaat) : undefined,
            isNext,
            isCurrent,
            timeUntil,
          };

          prayers.push(prayer);
          
          if (isNext) {
            setNextPrayer(prayer);
          }
          
          if (isCurrent) {
            setCurrentPrayer(prayer);
          }
        } catch (error) {
          logger.error(`Error processing prayer ${name}`, { error });
        }
      });
      
      setTodaysPrayerTimes(prayers);
      
      // Set Jumuah time if it's Friday
      if (isJumuahToday && prayerTimes.jummahJamaat) {
        setJumuahTime(prayerTimes.jummahJamaat);
        setJumuahDisplayTime(formatTimeToDisplay(prayerTimes.jummahJamaat));
      }
    } catch (error) {
      logger.error('Error in processPrayerTimes', { error });
    }
  }, [prayerTimes, prayerStatus, checkForDayChange, isJumuahToday]);

  // Add back the useEffect for Hijri date fetching on initial load
  useEffect(() => {
    fetchHijriDate();
  }, [fetchHijriDate]);

  return {
    todaysPrayerTimes,
    nextPrayer,
    currentPrayer,
    currentDate,
    hijriDate,
    isJumuahToday,
    jumuahTime,
    jumuahDisplayTime,
  };
}; 
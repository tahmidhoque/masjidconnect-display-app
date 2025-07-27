import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PrayerTimes } from '../api/models';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store';
import { refreshPrayerTimes } from '../store/slices/contentSlice';
import { 
  formatTimeToDisplay, 
  getNextPrayerTime, 
  getTimeUntilNextPrayer,
  parseTimeString,
  fetchHijriDateElectronSafe,
  calculateApproximateHijriDate
} from '../utils/dateUtils';
import logger from '../utils/logger';
import dayjs from 'dayjs';

interface FormattedPrayerTime {
  name: string;
  time: string;
  jamaat?: string;
  displayTime: string;
  displayJamaat?: string;
  isNext: boolean;
  isCurrent: boolean;
  timeUntil: string;
  jamaatTime?: string;
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
  jumuahKhutbahTime: string | null;
}

const PRAYER_NAMES = ['Fajr', 'Sunrise', 'Zuhr', 'Asr', 'Maghrib', 'Isha'];
const SKIP_PRAYERS = ['Sunrise']; // Prayers to skip in countdown

// Memoization cache
const prayerTimesCache = new Map<string, {
  formatted: FormattedPrayerTime[];
  nextPrayer: FormattedPrayerTime | null;
  currentPrayer: FormattedPrayerTime | null;
  timestamp: number;
}>();

const CACHE_TTL = 30000; // 30 seconds cache

export const usePrayerTimesMemoized = (): PrayerTimesHook => {
  // Get prayerTimes from Redux store
  const dispatch = useDispatch<AppDispatch>();
  const prayerTimes = useSelector((state: RootState) => state.content.prayerTimes);
  
  // Memoized current date
  const currentDate = useMemo(() => dayjs().format('YYYY-MM-DD'), []);
  
  // Memoized cache key
  const cacheKey = useMemo(() => {
    if (!prayerTimes) return '';
    const minute = Math.floor(Date.now() / 60000); // Cache per minute
    return `${currentDate}-${prayerTimes.date}-${minute}`;
  }, [prayerTimes, currentDate]);
  
  // Create refresh function wrapper - memoized
  const refreshPrayerTimesHandler = useCallback((forceRefresh: boolean = false) => {
    dispatch(refreshPrayerTimes({ forceRefresh }));
  }, [dispatch]);
  
  // Memoized prayer times processing
  const processedPrayerTimes = useMemo(() => {
    if (!prayerTimes || !cacheKey) {
      return {
        formatted: [],
        nextPrayer: null,
        currentPrayer: null,
      };
    }

    // Check cache first
    const cached = prayerTimesCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug('Using cached prayer times calculation');
      return cached;
    }

    logger.debug('Calculating prayer times', { cacheKey });

    try {
      // Get today's prayer times
      const todayData = prayerTimes;
      if (!todayData) {
        logger.warn('No prayer times data available for today');
        return { formatted: [], nextPrayer: null, currentPrayer: null };
      }

      // Format prayer times
      const formatted: FormattedPrayerTime[] = PRAYER_NAMES.map((name) => {
        const lowerName = name.toLowerCase() as keyof PrayerTimes;
        const time = todayData[lowerName as keyof typeof todayData] as string;
        const jamaatKey = `${lowerName}Jamaat` as keyof PrayerTimes;
        const jamaat = todayData[jamaatKey as keyof typeof todayData] as string | undefined;

        if (!time) {
          logger.warn(`Missing time for prayer: ${name}`);
          return {
            name,
            time: '00:00',
            displayTime: '00:00',
            isNext: false,
            isCurrent: false,
            timeUntil: '',
          };
        }

        const displayTime = formatTimeToDisplay(time);
        const displayJamaat = jamaat ? formatTimeToDisplay(jamaat) : undefined;

        return {
          name,
          time,
          jamaat,
          displayTime,
          displayJamaat,
          isNext: false,
          isCurrent: false,
          timeUntil: '',
          jamaatTime: jamaat,
        };
      }).filter(prayer => prayer.time !== '00:00');

      // Find next and current prayer
      const now = dayjs();
      let nextPrayer: FormattedPrayerTime | null = null;
      let currentPrayer: FormattedPrayerTime | null = null;

      for (let i = 0; i < formatted.length; i++) {
        const prayer = formatted[i];
        const prayerTime = dayjs(`${currentDate} ${prayer.time}`);
        
        if (now.isBefore(prayerTime) && !SKIP_PRAYERS.includes(prayer.name)) {
          nextPrayer = prayer;
          nextPrayer.isNext = true;
                     // Calculate time until next prayer manually
           const prayerDateTime = dayjs(`${currentDate} ${prayer.time}`);
           const duration = prayerDateTime.diff(now);
           const hours = Math.floor(duration / (1000 * 60 * 60));
           const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
           nextPrayer.timeUntil = `${hours}h ${minutes}m`;
          break;
        } else if (now.isAfter(prayerTime)) {
          currentPrayer = prayer;
          currentPrayer.isCurrent = true;
        }
      }

      // If no next prayer found, it means all prayers for today have passed
      // Set next prayer to tomorrow's Fajr
      if (!nextPrayer && formatted.length > 0) {
        const fajr = formatted.find(p => p.name === 'Fajr');
        if (fajr) {
          nextPrayer = { ...fajr };
          nextPrayer.isNext = true;
          // Calculate time until tomorrow's Fajr
          const tomorrowFajr = dayjs(`${currentDate} ${fajr.time}`).add(1, 'day');
          const duration = tomorrowFajr.diff(now);
          const hours = Math.floor(duration / (1000 * 60 * 60));
          const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
          nextPrayer.timeUntil = `${hours}h ${minutes}m`;
        }
      }

      const result = {
        formatted,
        nextPrayer,
        currentPrayer,
        timestamp: Date.now(),
      };

      // Cache the result
      prayerTimesCache.set(cacheKey, result);

      // Clean up old cache entries (keep only last 10)
      if (prayerTimesCache.size > 10) {
        const keys = Array.from(prayerTimesCache.keys());
        keys.slice(0, -10).forEach(key => prayerTimesCache.delete(key));
      }

      return result;
    } catch (error) {
      logger.error('Error processing prayer times', { error });
      return { formatted: [], nextPrayer: null, currentPrayer: null };
    }
  }, [prayerTimes, cacheKey, currentDate]);

  // Hijri date with memoization
  const [hijriDate, setHijriDate] = useState<string | null>(null);
  const hijriDateCache = useRef<{ date: string; hijri: string | null; timestamp: number } | null>(null);
  
  useEffect(() => {
    const fetchHijriDate = async () => {
      // Check cache first (1 hour TTL for Hijri date)
      const now = Date.now();
      if (hijriDateCache.current && 
          hijriDateCache.current.date === currentDate && 
          now - hijriDateCache.current.timestamp < 3600000) { // 1 hour
        setHijriDate(hijriDateCache.current.hijri);
        return;
      }

             try {
         logger.info('Calculating accurate Hijri date');
         const hijri = await fetchHijriDateElectronSafe();
         
         hijriDateCache.current = {
           date: currentDate,
           hijri,
           timestamp: now,
         };
         
         setHijriDate(hijri);
         logger.info('Successfully calculated Hijri date', { hijriDate: hijri });
       } catch (error) {
         logger.warn('Failed to calculate Hijri date, using fallback', { error });
         const fallback = calculateApproximateHijriDate();
         setHijriDate(fallback);
       }
    };

    fetchHijriDate();
  }, [currentDate]);

  // Jumuah detection - memoized
  const { isJumuahToday, jumuahTime, jumuahDisplayTime, jumuahKhutbahTime } = useMemo(() => {
    const today = dayjs();
    const isFriday = today.day() === 5; // 5 = Friday
    
    if (!isFriday || !prayerTimes) {
      return {
        isJumuahToday: false,
        jumuahTime: null,
        jumuahDisplayTime: null,
        jumuahKhutbahTime: null,
      };
    }

    // Use Zuhr time as Jumuah time if available
    const zuhrTime = prayerTimes.zuhr;
    const jumuahDisplayTime = zuhrTime ? formatTimeToDisplay(zuhrTime) : null;
    
    return {
      isJumuahToday: true,
      jumuahTime: zuhrTime,
      jumuahDisplayTime,
      jumuahKhutbahTime: zuhrTime,
    };
  }, [prayerTimes, currentDate]);

  // Periodic refresh - throttled
  useEffect(() => {
    // Only refresh if no data or data is stale
    if (!prayerTimes) {
      logger.info('No prayer times data, requesting refresh');
      refreshPrayerTimesHandler(true);
      return;
    }

    // Refresh every 5 minutes in production, every minute in development
    const interval = process.env.NODE_ENV === 'development' ? 60000 : 300000;
    
    const timer = setInterval(() => {
             // Only refresh if we have stale data
       const lastUpdate = (prayerTimes as any).timestamp || 0;
       const isStale = Date.now() - Number(lastUpdate) > 300000; // 5 minutes
      
      if (isStale) {
        logger.debug('Prayer times data is stale, refreshing');
        refreshPrayerTimesHandler(false);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [prayerTimes, refreshPrayerTimesHandler]);

  return {
    todaysPrayerTimes: processedPrayerTimes.formatted,
    nextPrayer: processedPrayerTimes.nextPrayer,
    currentPrayer: processedPrayerTimes.currentPrayer,
    currentDate,
    hijriDate,
    isJumuahToday,
    jumuahTime,
    jumuahDisplayTime,
    jumuahKhutbahTime,
  };
}; 
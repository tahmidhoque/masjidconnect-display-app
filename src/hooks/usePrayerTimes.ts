import { useState, useEffect, useCallback, useRef } from 'react';
import { PrayerTimes } from '../api/models';
import { useContent } from '../contexts/ContentContext';
import moment from 'moment';
import { 
  formatTimeToDisplay, 
  getNextPrayerTime, 
  getTimeUntilNextPrayer,
  parseTimeString
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
  // Only get prayerTimes and refreshPrayerTimes from ContentContext
  const { prayerTimes, refreshPrayerTimes } = useContent();
  
  // State for UI display
  const [todaysPrayerTimes, setTodaysPrayerTimes] = useState<FormattedPrayerTime[]>([]);
  const [nextPrayer, setNextPrayer] = useState<FormattedPrayerTime | null>(null);
  const [currentPrayer, setCurrentPrayer] = useState<FormattedPrayerTime | null>(null);
  const [currentDate, setCurrentDate] = useState<string>('');
  const [hijriDate, setHijriDate] = useState<string | null>(null);
  const [isJumuahToday, setIsJumuahToday] = useState<boolean>(false);
  const [jumuahTime, setJumuahTime] = useState<string | null>(null);
  const [jumuahDisplayTime, setJumuahDisplayTime] = useState<string | null>(null);
  
  // Use refs to track internal state without causing rerenders
  const initializedRef = useRef<boolean>(false);
  const currentDayRef = useRef<number>(moment().date());
  const calculationsRef = useRef<{
    lastProcessTime: number;
    nextPrayerName: string;
    currentPrayerName: string;
    isProcessing: boolean;
  }>({
    lastProcessTime: 0,
    nextPrayerName: '',
    currentPrayerName: '',
    isProcessing: false
  });
  
  // Min interval between calculations to prevent excessive processing
  const MIN_PROCESS_INTERVAL = 5000; // 5 seconds

  // Get and update Hijri date - memoized to prevent rerenders
  const fetchHijriDate = useCallback(async () => {
    try {
      const response = await fetch(`https://api.aladhan.com/v1/gToH?date=${moment().format('DD-MM-YYYY')}`);
      const data = await response.json();
      
      if (data.code === 200 && data.data) {
        const hijri = data.data.hijri;
        setHijriDate(`${hijri.day} ${hijri.month.en} ${hijri.year} AH`);
      }
    } catch (error) {
      logger.error('Error fetching Hijri date:', { error });
    }
  }, []);

  // Check for day change and refresh data if needed - memoized
  const checkForDayChange = useCallback(() => {
    const now = moment();
    const newDay = now.date();
    
    // If the day has changed, force refresh the prayer data
    if (newDay !== currentDayRef.current) {
      logger.info('Day changed - refreshing prayer data', { oldDay: currentDayRef.current, newDay });
      currentDayRef.current = newDay;
      
      // Clear all caches first
      masjidDisplayClient.invalidateAllCaches();
      
      // Force refresh prayer times with high priority
      refreshPrayerTimes();
      
      // Update date information
      setCurrentDate(now.format('dddd, MMMM D, YYYY'));
      
      // Check if today is Friday (5)
      setIsJumuahToday(now.day() === 5);
      
      // Refresh Hijri date
      fetchHijriDate();
    }
  }, [refreshPrayerTimes, fetchHijriDate]);

  // Helper function to determine current prayer - memoized
  const calculateCurrentPrayer = useCallback((prayersList: {name: string, time: string}[]) => {
    const now = new Date();
    let currentPrayer = null;
    
    // Convert time strings to Date objects for today
    const prayerTimes = prayersList.map(p => ({
      name: p.name,
      time: p.time,
      date: parseTimeString(p.time)
    }));
    
    // Sort by time
    prayerTimes.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Find the last prayer that has occurred
    for (let i = prayerTimes.length - 1; i >= 0; i--) {
      if (prayerTimes[i].date <= now) {
        currentPrayer = prayerTimes[i].name;
        break;
      }
    }
    
    // If no prayer today yet, use last prayer from yesterday
    if (!currentPrayer && prayerTimes.length > 0) {
      currentPrayer = prayerTimes[prayerTimes.length - 1].name;
    }
    
    return currentPrayer;
  }, []);

  // Helper function to determine current and next prayer accurately - memoized
  const calculatePrayersAccurately = useCallback((prayers: FormattedPrayerTime[]) => {
    if (!prayers || prayers.length === 0) return { currentIndex: -1, nextIndex: -1 };
    
    const now = new Date();
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Sort prayers by time
    const sortedPrayers = [...prayers].sort((a, b) => a.time.localeCompare(b.time));
    
    // Current prayer: find the last prayer that has occurred
    let currentIndex = -1;
    for (let i = sortedPrayers.length - 1; i >= 0; i--) {
      if (sortedPrayers[i].time <= currentTimeStr) {
        currentIndex = prayers.findIndex(p => p.name === sortedPrayers[i].name);
        break;
      }
    }
    
    // If no current prayer found (all are in future), use the last prayer from yesterday
    if (currentIndex === -1 && sortedPrayers.length > 0) {
      const lastPrayer = sortedPrayers[sortedPrayers.length - 1];
      currentIndex = prayers.findIndex(p => p.name === lastPrayer.name);
    }
    
    // Next prayer: find the earliest prayer that hasn't occurred yet
    let nextIndex = -1;
    for (let i = 0; i < sortedPrayers.length; i++) {
      if (sortedPrayers[i].time > currentTimeStr) {
        nextIndex = prayers.findIndex(p => p.name === sortedPrayers[i].name);
        break;
      }
    }
    
    // If no next prayer found (all are in the past), use the first prayer for tomorrow
    if (nextIndex === -1 && sortedPrayers.length > 0) {
      const firstPrayer = sortedPrayers[0];
      nextIndex = prayers.findIndex(p => p.name === firstPrayer.name);
    }
    
    return { currentIndex, nextIndex };
  }, []);

  // Process prayer times function with improved performance - memoized
  const processPrayerTimes = useCallback(() => {
    // Skip if no prayer times data is available
    if (!prayerTimes) {
      logger.debug('No prayer times available to process');
      return;
    }
    
    // Skip if already processing or throttled
    if (calculationsRef.current.isProcessing) {
      return;
    }
    
    // Add throttling to prevent excessive processing
    const now = Date.now();
    if (now - calculationsRef.current.lastProcessTime < MIN_PROCESS_INTERVAL) {
      return;
    }
    
    // Update processing state
    calculationsRef.current.isProcessing = true;
    calculationsRef.current.lastProcessTime = now;
    
    try {
      // Check if we need to refresh data (e.g., if day has changed)
      checkForDayChange();
      
      // Create a new array for prayer times to avoid modifying existing state
      const prayers: FormattedPrayerTime[] = [];
      
      // Find today's prayer times from the data array
      const nowMoment = moment();
      const todayDateStr = nowMoment.format('YYYY-MM-DD');
      let todayData = prayerTimes;
      
      // Check if prayerTimes has data array (new format)
      if ('data' in prayerTimes && Array.isArray(prayerTimes.data)) {
        // Find today's prayer times in the array
        const todayEntry = prayerTimes.data.find(entry => {
          // Match entries by date (strip time part if present)
          if (entry.date && typeof entry.date === 'string') {
            return entry.date.substring(0, 10) === todayDateStr;
          }
          return false;
        });
        
        if (todayEntry) {
          todayData = todayEntry;
        } else if (prayerTimes.data.length > 0) {
          // If we can't find today's data, use the first entry as fallback
          todayData = prayerTimes.data[0];
        }
      }
      
      // Initialize variables for local calculations
      let nextPrayerName = '';
      let currentPrayerName = '';
      
      // Extract all prayer times for local calculations
      const prayerTimesForCalculation: {name: string, time: string}[] = [];
      
      // Extract prayer times safely, ensuring we have fallbacks
      const extractTime = (key: string): string => {
        if (typeof todayData === 'object' && todayData !== null) {
          return (todayData as any)[key] || '';
        }
        return '';
      };
      
      // Build prayer times for calculation
      PRAYER_NAMES.forEach(name => {
        const lowerName = name.toLowerCase();
        const time = extractTime(lowerName);
        if (time) {
          prayerTimesForCalculation.push({ name, time });
        }
      });
      
      // Calculate locally
      const prayerRecord: Record<string, string> = {};
      
      prayerRecord.fajr = extractTime('fajr');
      prayerRecord.sunrise = extractTime('sunrise');
      prayerRecord.zuhr = extractTime('zuhr');
      prayerRecord.asr = extractTime('asr');
      prayerRecord.maghrib = extractTime('maghrib');
      prayerRecord.isha = extractTime('isha');
      
      if (Object.values(prayerRecord).some(time => time)) {
        // Only calculate if we have at least one valid time
        try {
          const { name } = getNextPrayerTime(nowMoment.toDate(), prayerRecord);
          nextPrayerName = name;
          
          // Store in ref for later comparisons
          calculationsRef.current.nextPrayerName = nextPrayerName;
          
          // If we have prayer times array, also calculate current prayer
          if (prayerTimesForCalculation.length > 0) {
            currentPrayerName = calculateCurrentPrayer(prayerTimesForCalculation) || '';
            
            // Store in ref for later comparisons
            calculationsRef.current.currentPrayerName = currentPrayerName;
          }
        } catch (error) {
          logger.error('Error calculating next prayer', { error });
        }
      }
      
      // Process each prayer time
      PRAYER_NAMES.forEach((name) => {
        try {
          const lowerName = name.toLowerCase();
          const time = typeof todayData === 'object' && todayData !== null ? 
            (todayData[lowerName as keyof PrayerTimes] as string || '') : '';
          const jamaat = typeof todayData === 'object' && todayData !== null ? 
            (todayData[`${lowerName}Jamaat` as keyof PrayerTimes] as string | undefined) : undefined;
          
          // Compare case-insensitively and normalize names
          const isNext = nextPrayerName.toUpperCase() === name.toUpperCase();
          const isCurrent = currentPrayerName.toUpperCase() === name.toUpperCase();
          
          // Force isNext=true for Fajr if needed
          let forcedIsNext = isNext;
          if (name === 'Fajr' && (nextPrayerName.toUpperCase() === 'FAJR' || nextPrayerName === 'Fajr')) {
            forcedIsNext = true;
          }
          
          // Calculate time until prayer locally
          let timeUntil = '';
          if (forcedIsNext) {
            timeUntil = getTimeUntilNextPrayer(time);
          }

          const prayer: FormattedPrayerTime = {
            name,
            time,
            jamaat,
            displayTime: formatTimeToDisplay(time),
            displayJamaat: jamaat ? formatTimeToDisplay(jamaat) : undefined,
            isNext: forcedIsNext,
            isCurrent,
            timeUntil,
          };

          prayers.push(prayer);
          
          // Update state for next and current prayers only if they've changed
          if (forcedIsNext && (!nextPrayer || nextPrayer.name !== prayer.name)) {
            setNextPrayer(prayer);
          }
          
          if (isCurrent && (!currentPrayer || currentPrayer.name !== prayer.name)) {
            setCurrentPrayer(prayer);
          }
        } catch (error) {
          logger.error(`Error processing prayer ${name}`, { error });
        }
      });
      
      // Update the prayers array in state to trigger render
      setTodaysPrayerTimes(prayers);
      
      // Set Jumuah time if it's Friday
      if (isJumuahToday && todayData.jummahJamaat) {
        setJumuahTime(todayData.jummahJamaat);
        setJumuahDisplayTime(formatTimeToDisplay(todayData.jummahJamaat));
      }
      
      // Use the accurate calculation function to ensure proper flags
      const { currentIndex, nextIndex } = calculatePrayersAccurately(prayers);
      
      // Apply the flags based on calculated indices
      if (currentIndex >= 0 && (!currentPrayer || currentPrayer.name !== prayers[currentIndex].name)) {
        setCurrentPrayer(prayers[currentIndex]);
      }
      
      if (nextIndex >= 0 && (!nextPrayer || nextPrayer.name !== prayers[nextIndex].name)) {
        const updatedNextPrayer = {...prayers[nextIndex]};
        updatedNextPrayer.timeUntil = getTimeUntilNextPrayer(updatedNextPrayer.time);
        setNextPrayer(updatedNextPrayer);
      }
    } catch (error) {
      logger.error('Error processing prayer times', { error });
    } finally {
      // Reset processing flag
      calculationsRef.current.isProcessing = false;
    }
  }, [prayerTimes, checkForDayChange, isJumuahToday, calculateCurrentPrayer, calculatePrayersAccurately, nextPrayer, currentPrayer]);

  // Initial loading of data
  useEffect(() => {
    try {
      // Set current date
      const date = moment();
      setCurrentDate(date.format('dddd, MMMM D, YYYY'));

      // Check if today is Friday (5)
      setIsJumuahToday(date.day() === 5);

      // Initial force refresh on component mount to ensure fresh data
      if (!initializedRef.current) {
        logger.info('Initial prayer times load');
        initializedRef.current = true;
        
        // Fetch Hijri date
        fetchHijriDate();
        
        // Process prayer times if available
        if (prayerTimes) {
          setTimeout(() => processPrayerTimes(), 10);
        }
      }

      // Set up timer to update calculations every minute and check for day change
      const timer = setInterval(() => {
        try {
          processPrayerTimes();
        } catch (error) {
          logger.error('Error in timer update', { error });
        }
      }, 60 * 1000);

      return () => clearInterval(timer);
    } catch (error) {
      logger.error('Error in prayer times initialization', { error });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run once

  // Process prayer times whenever they change
  useEffect(() => {
    if (prayerTimes && initializedRef.current) {
      // Add a small timeout to avoid render loop
      const timerId = setTimeout(() => {
        processPrayerTimes();
      }, 50);
      
      return () => clearTimeout(timerId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prayerTimes]); // Only depend on prayerTimes

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
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
}

const PRAYER_NAMES = ['Fajr', 'Sunrise', 'Zuhr', 'Asr', 'Maghrib', 'Isha'];
const SKIP_PRAYERS = ['Sunrise']; // Prayers to skip in countdown

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
    const isAfterMidnightBeforeFajr = now.getHours() < 6;
    
    // Filter out prayers that should be skipped for the countdown
    const countdownPrayers = prayers.filter(p => !SKIP_PRAYERS.includes(p.name));
    
    // Sort prayers by time
    const sortedPrayers = [...countdownPrayers].sort((a, b) => a.time.localeCompare(b.time));
    
    // UPDATED LOGIC FOR CURRENT AND NEXT PRAYERS
    
    // Current prayer: The prayer whose adhan time has passed but the next prayer's adhan time hasn't arrived yet
    let currentIndex = -1;
    let nextIndex = -1;
    
    // Special handling for after midnight before Fajr
    if (isAfterMidnightBeforeFajr) {
      // When it's after midnight but before Fajr, the current prayer should be Isha from yesterday
      const ishaIndex = prayers.findIndex(p => p.name === 'Isha');
      if (ishaIndex >= 0) {
        currentIndex = ishaIndex;
        logger.info('After midnight before Fajr: Setting current prayer to Isha');
        
        // And next prayer should be Fajr
        const fajrIndex = prayers.findIndex(p => p.name === 'Fajr');
        if (fajrIndex >= 0) {
          nextIndex = fajrIndex;
          logger.info('After midnight before Fajr: Setting next prayer to Fajr');
        }
      }
    } else {
      // Find current prayer (last prayer whose adhan time has passed)
      for (let i = sortedPrayers.length - 1; i >= 0; i--) {
        if (sortedPrayers[i].time <= currentTimeStr) {
          currentIndex = prayers.findIndex(p => p.name === sortedPrayers[i].name);
          break;
        }
      }
      
      // Find next prayer (first prayer whose adhan time is in the future)
      for (let i = 0; i < sortedPrayers.length; i++) {
        if (sortedPrayers[i].time > currentTimeStr) {
          nextIndex = prayers.findIndex(p => p.name === sortedPrayers[i].name);
          break;
        }
      }
      
      // NEW LOGIC: Check if we're between a prayer's adhan and the next prayer's adhan
      if (currentIndex >= 0 && nextIndex >= 0) {
        const currentPrayer = prayers[currentIndex];
        
        // Check if the prayer's jamaat time has passed
        const jamaatTime = currentPrayer.jamaat;
        
        if (jamaatTime && jamaatTime <= currentTimeStr) {
          // If jamaat time has passed, keep current prayer as current
          // and keep next prayer as next
          logger.info(`${currentPrayer.name} jamaat (${jamaatTime}) has passed. It's current, and ${prayers[nextIndex].name} is next.`);
        } else if (jamaatTime && jamaatTime > currentTimeStr) {
          // If we're between adhan and jamaat times, 
          // this prayer should only be the next prayer (green) and NOT current (blue)
          logger.info(`Between ${currentPrayer.name} adhan (${currentPrayer.time}) and jamaat (${jamaatTime}), marking as next only.`);
          nextIndex = currentIndex;
          currentIndex = -1; // Clear current prayer to avoid blue highlight
        }
      }
      
      // NEW LOGIC: If a prayer's adhan time has arrived but the previous prayer's JAMAAT time hasn't passed yet
      // In this case, we need to clear the current prayer and only highlight the current prayer as next
      if (currentIndex >= 0 && currentIndex > 0) {
        const previousPrayerIndex = currentIndex - 1;
        const previousPrayer = prayers[previousPrayerIndex];
        
        // If the previous prayer exists and has a jamaat time that hasn't passed yet
        if (previousPrayer && previousPrayer.jamaat && previousPrayer.jamaat > currentTimeStr) {
          logger.info(`${prayers[currentIndex].name} adhan has arrived, but ${previousPrayer.name} jamaat hasn't passed yet. Setting only ${prayers[currentIndex].name} as next.`);
          nextIndex = currentIndex;
          currentIndex = -1; // Clear current prayer
        }
      }
    }
    
    // If no current prayer found (all are in future), there's no current prayer
    if (currentIndex === -1 && sortedPrayers.length > 0) {
      // This is a change from previous logic - we don't set a current prayer if all prayers are in the future
      logger.info('No current prayer - all prayers are in the future');
    }
    
    // If no next prayer found (all are in the past), use the first prayer for tomorrow
    if (nextIndex === -1 && sortedPrayers.length > 0) {
      const firstPrayer = sortedPrayers[0];
      nextIndex = prayers.findIndex(p => p.name === firstPrayer.name);
      logger.info(`All prayers for today have passed. Setting first prayer for tomorrow (${firstPrayer.name}) as next.`);
    }
    
    return { currentIndex, nextIndex };
  }, []);

  // Process prayer times function with improved performance - memoized
  const processPrayerTimes = useCallback(() => {
    // Set processing flag to prevent concurrent processing
    if (calculationsRef.current.isProcessing) {
      return;
    }
    calculationsRef.current.isProcessing = true;

    try {
      // Check for date change first
      checkForDayChange();
      
      // Get current date/time
      const now = Date.now();
      const prayers: FormattedPrayerTime[] = [];
      const prayerTimesForCalculation: { name: string; time: string }[] = [];
      
      // Initialize variables for calculations
      let todayData = prayerTimes;
      let nextPrayerName = '';
      let currentPrayerName = '';
      
      // Check if we have the data array format and extract today's prayer times if so
      if (prayerTimes && prayerTimes.data && Array.isArray(prayerTimes.data) && prayerTimes.data.length > 0) {
        todayData = prayerTimes.data[0];
      }
      
      // Helper function to safely extract time
      const extractTime = (key: string): string => {
        if (typeof todayData === 'object' && todayData !== null) {
          return (todayData as any)[key] || '';
        }
        return '';
      };
      
      // Build prayer times for calculation
      PRAYER_NAMES.forEach(name => {
        // Skip prayers in SKIP_PRAYERS for next prayer calculation
        if (SKIP_PRAYERS.includes(name)) {
          return;
        }
        
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
          const { name } = getNextPrayerTime(new Date(), prayerRecord);
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
      
      // Create base prayer objects with times
      PRAYER_NAMES.forEach((name) => {
        try {
          const lowerName = name.toLowerCase();
          const time = typeof todayData === 'object' && todayData !== null ? 
            (todayData[lowerName as keyof PrayerTimes] as string || '') : '';
          const jamaat = typeof todayData === 'object' && todayData !== null ? 
            (todayData[`${lowerName}Jamaat` as keyof PrayerTimes] as string | undefined) : undefined;
          
          // Initialize with default values - we'll update these flags later
          const prayer: FormattedPrayerTime = {
            name,
            time,
            jamaat,
            displayTime: formatTimeToDisplay(time),
            displayJamaat: jamaat ? formatTimeToDisplay(jamaat) : undefined,
            isNext: false,
            isCurrent: false,
            timeUntil: '',
            jamaatTime: jamaat,
          };

          prayers.push(prayer);
        } catch (error) {
          logger.error(`Error processing prayer ${name}`, { error });
        }
      });
      
      // Use the accurate calculation function to determine current and next prayers
      const { currentIndex, nextIndex } = calculatePrayersAccurately(prayers);
      
      // Apply the calculated flags
      if (currentIndex >= 0) {
        prayers[currentIndex].isCurrent = true;
        setCurrentPrayer(prayers[currentIndex]);
      } else {
        // Clear current prayer if none was found
        setCurrentPrayer(null);
      }
      
      if (nextIndex >= 0) {
        prayers[nextIndex].isNext = true;
        
        // Calculate time until next prayer or jamaat
        const nextPrayer = prayers[nextIndex];
        
        // If next prayer has jamaat time and it's after the adhan time and current time is between adhan and jamaat
        // then countdown to jamaat time, otherwise countdown to adhan time
        const currentTimeObj = new Date();
        const currentTimeStr = `${currentTimeObj.getHours().toString().padStart(2, '0')}:${currentTimeObj.getMinutes().toString().padStart(2, '0')}`;
        
        if (nextPrayer.jamaat && 
            nextPrayer.time <= currentTimeStr && 
            nextPrayer.jamaat > currentTimeStr) {
          // Countdown to jamaat time
          nextPrayer.timeUntil = getTimeUntilNextPrayer(nextPrayer.jamaat);
          logger.info(`Showing countdown to ${nextPrayer.name} jamaat time (${nextPrayer.jamaat})`);
          
          // Make sure this prayer is not also marked as current when it's between adhan and jamaat
          nextPrayer.isCurrent = false;
        } else {
          // Countdown to adhan time
          nextPrayer.timeUntil = getTimeUntilNextPrayer(nextPrayer.time);
          logger.info(`Showing countdown to ${nextPrayer.name} adhan time (${nextPrayer.time})`);
        }
        
        setNextPrayer(nextPrayer);
      } else {
        // Clear next prayer if none was found
        setNextPrayer(null);
      }
      
      // Update the prayers array in state to trigger render
      setTodaysPrayerTimes(prayers);
      
      // Set Jumuah time if it's Friday
      if (isJumuahToday && todayData && todayData.jummahJamaat) {
        setJumuahTime(todayData.jummahJamaat);
        setJumuahDisplayTime(formatTimeToDisplay(todayData.jummahJamaat));
      }
    } catch (error) {
      logger.error('Error processing prayer times', { error });
    } finally {
      // Reset processing flag
      calculationsRef.current.isProcessing = false;
    }
  }, [prayerTimes, checkForDayChange, isJumuahToday, calculateCurrentPrayer, calculatePrayersAccurately]);

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
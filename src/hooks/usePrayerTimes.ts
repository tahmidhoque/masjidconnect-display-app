import { useState, useEffect, useCallback, useRef } from 'react';
import { PrayerTimes } from '../api/models';
import { useContent } from '../contexts/ContentContext';
import { 
  formatTimeToDisplay, 
  getNextPrayerTime, 
  getTimeUntilNextPrayer,
  parseTimeString,
  fetchHijriDateElectronSafe,
  calculateApproximateHijriDate
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
  jumuahKhutbahTime: string | null;
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
  const [jumuahKhutbahTime, setJumuahKhutbahTime] = useState<string | null>(null);
  
  // Use refs to track internal state without causing rerenders
  const initializedRef = useRef<boolean>(false);
  const lastPrayerTimesDataRef = useRef<any>(null);
  const currentDayRef = useRef<number>(dayjs().date());
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

  // Listen for prayer times updates from data sync service
  useEffect(() => {
    const handlePrayerTimesUpdate = () => {
      logger.info('Prayer times update detected, refreshing data');
      refreshPrayerTimes();
    };

    window.addEventListener('prayerTimesUpdated', handlePrayerTimesUpdate);
    
    return () => {
      window.removeEventListener('prayerTimesUpdated', handlePrayerTimesUpdate);
    };
  }, [refreshPrayerTimes]);

  // Set up periodic refresh to ensure components always have fresh prayer time data
  useEffect(() => {
    // Update prayer times every minute to ensure we catch transitions
    const minuteInterval = setInterval(() => {
      // Process the prayer times data only if we need to (time has changed)
      if (prayerTimes && !calculationsRef.current.isProcessing) {
        processPrayerTimes();
      } else if (!prayerTimes && !calculationsRef.current.isProcessing) {
        // If no prayer times data, try to refresh
        logger.warn("No prayer times data available, requesting refresh");
        refreshPrayerTimes();
      }
    }, 60000); // Every minute

    // Perform an immediate check for prayer times data
    if (!prayerTimes) {
      logger.info("Immediate check: No prayer times data available, requesting refresh");
      refreshPrayerTimes();
    }

    return () => {
      clearInterval(minuteInterval);
    };
  }, [prayerTimes]);

  // Process prayer times data when it changes
  useEffect(() => {
    // Skip if data hasn't changed
    if (prayerTimes === lastPrayerTimesDataRef.current) {
      return;
    }

    // Update the ref to the new data
    lastPrayerTimesDataRef.current = prayerTimes;
    
    // Log the prayer times data to help with debugging
    logger.info('Prayer times data received in hook', {
      hasData: !!prayerTimes,
      dataType: prayerTimes ? typeof prayerTimes : 'none',
      hasDataArray: prayerTimes && 'data' in prayerTimes && Array.isArray((prayerTimes as any).data),
      dataFirstValues: prayerTimes ? 
        JSON.stringify({
          date: prayerTimes.date,
          fajr: prayerTimes.fajr,
          sunrise: prayerTimes.sunrise,
          zuhr: prayerTimes.zuhr
        }) : 'none'
    });
    
    // Validate the prayerTimes data
    const isDataValid = prayerTimes && 
      typeof prayerTimes === 'object' && 
      (prayerTimes.fajr || prayerTimes.zuhr || prayerTimes.asr || prayerTimes.maghrib || prayerTimes.isha);
    
    // Process the prayer times data if valid
    if (isDataValid) {
      logger.info('Prayer times data is valid, processing', {
        date: prayerTimes.date
      });
      setTimeout(() => processPrayerTimes(), 0);
    } else {
      // If we have invalid data, log details and request a refresh
      logger.warn('Invalid or incomplete prayer times data, requesting refresh', {
        prayerTimesKeys: prayerTimes ? Object.keys(prayerTimes).join(', ') : 'null',
        hasFajr: prayerTimes?.fajr,
        hasZuhr: prayerTimes?.zuhr,
        hasAsr: prayerTimes?.asr
      });
      refreshPrayerTimes();
    }
  }, [prayerTimes, refreshPrayerTimes]);

  // Check data validity periodically and refresh if needed
  useEffect(() => {
    // Check immediately after mounting if we need data
    const initialCheckTimer = setTimeout(() => {
      // Check if we have valid data in the expected format
      const dataIsValid = nextPrayer && todaysPrayerTimes.length > 0 &&
        todaysPrayerTimes.some(prayer => prayer.name && prayer.time);
      
      if (!prayerTimes || !dataIsValid) {
        logger.warn('Missing or invalid prayer times data after initial load, requesting refresh', {
          hasPrayerTimes: !!prayerTimes,
          hasPrayerNames: prayerTimes ? Object.keys(prayerTimes).join(', ') : 'none',
          nextPrayerName: nextPrayer?.name || 'none',
          formattedTimesCount: todaysPrayerTimes.length
        });
        refreshPrayerTimes();
      }
    }, 2000); // Check 2 seconds after mounting
    
    // Set up periodic check every 30 seconds
    const periodicCheckTimer = setInterval(() => {
      // Check if data is still valid
      const dataIsValid = nextPrayer && todaysPrayerTimes.length > 0 &&
        todaysPrayerTimes.some(prayer => prayer.name && prayer.time);
      
      if (!prayerTimes || !dataIsValid) {
        logger.warn('Missing or invalid prayer times data in periodic check, requesting refresh', {
          timestamp: new Date().toISOString(),
          hasPrayerTimes: !!prayerTimes,
          nextPrayerName: nextPrayer?.name || 'none'
        });
        refreshPrayerTimes();
      }
    }, 30000); // Check every 30 seconds
    
    return () => {
      clearTimeout(initialCheckTimer);
      clearInterval(periodicCheckTimer);
    };
  }, [prayerTimes, nextPrayer, todaysPrayerTimes, refreshPrayerTimes]);

  // Process prayer times data and update state
  const processPrayerTimes = useCallback(() => {
    if (!prayerTimes || calculationsRef.current.isProcessing) {
      return;
    }

    const now = Date.now();
    
    // Prevent excessive processing
    if (now - calculationsRef.current.lastProcessTime < MIN_PROCESS_INTERVAL) {
      return;
    }

    calculationsRef.current.isProcessing = true;
    calculationsRef.current.lastProcessTime = now;

    try {
      logger.debug('Processing prayer times data');

      // Check for date change first
      checkForDayChange();
      
      // Update formatted prayer times
      updateFormattedPrayerTimes();

    } catch (error) {
      logger.error('Error processing prayer times', { error });
    } finally {
      calculationsRef.current.isProcessing = false;
    }
  }, [prayerTimes]);

  // Get and update Hijri date - memoized to prevent rerenders
  const fetchHijriDate = useCallback(async () => {
    try {
      logger.info('Fetching Hijri date from API');
      // Set a temporary loading state immediately
      setHijriDate('Loading Hijri date...');
      
      // Always clear any existing cached Hijri date to force a fresh calculation
      localStorage.removeItem('hijriDate');
      localStorage.removeItem('hijriDateTimestamp');
      logger.info('Cleared cached Hijri date to ensure fresh calculation');
      
      // Use our Electron-safe function to get the Hijri date
      const formattedDate = dayjs().format('DD-MM-YYYY');
      logger.info(`Using Electron-safe method to fetch Hijri date for ${formattedDate}`);
      
      const hijriDateStr = await fetchHijriDateElectronSafe(formattedDate);
      
      // Cache the result in localStorage
      localStorage.setItem('hijriDate', hijriDateStr);
      localStorage.setItem('hijriDateTimestamp', Date.now().toString());
      
      logger.info('Successfully fetched Hijri date', { hijriDate: hijriDateStr });
      setHijriDate(hijriDateStr);
      
    } catch (error) {
      logger.error('Error fetching Hijri date:', { error });
      
      // Calculate approximate date as fallback
      try {
        const approximateDate = calculateApproximateHijriDate();
        logger.info('Using approximate Hijri date calculation', { approximateDate });
        setHijriDate(approximateDate);
        
        // Cache this approximate date
        localStorage.setItem('hijriDate', approximateDate);
        localStorage.setItem('hijriDateTimestamp', Date.now().toString());
      } catch (calcError) {
        // Last resort fallback if even calculation fails
        logger.error('Even approximate calculation failed:', { calcError });
        setHijriDate('Hijri date unavailable');
      }
      
      // Schedule a retry in 60 seconds
      setTimeout(() => {
        fetchHijriDate();
      }, 60000);
    }
  }, []);

  // Check for day change and refresh data if needed - memoized
  const checkForDayChange = useCallback(() => {
    const now = dayjs();
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
      
      // Check if today is Friday (Friday is 5 for dayjs, Sunday is 0)
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

  // Helper function to determine current and next prayer accurately - memoized and optimized for RPi
  const calculatePrayersAccurately = useCallback((prayers: FormattedPrayerTime[]) => {
    if (!prayers || prayers.length === 0) return { currentIndex: -1, nextIndex: -1 };
    
    let currentIndex = -1;
    let nextIndex = -1;
    
    // Get current time for comparison
    const now = dayjs();
    const currentTimeStr = now.format('HH:mm');
    
    logger.debug(`[calculatePrayersAccurately] Calculating prayer status at ${currentTimeStr}`, {
      prayerCount: prayers.length,
      currentTime: currentTimeStr
    });
    
    // IMPROVED: More stable sorting logic to prevent inconsistencies
    const sortedPrayers = prayers
      .map((p, originalIndex) => ({ 
        name: p.name, 
        time: p.time, 
        jamaat: p.jamaat, 
        originalIndex 
      }))
      .sort((a, b) => {
        // Convert time strings to minutes for more accurate comparison
        const getMinutes = (timeStr: string) => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours * 60 + minutes;
        };
        
        const aMinutes = getMinutes(a.time);
        const bMinutes = getMinutes(b.time);
        
        // Handle Fajr prayer that might be early morning (< 6 AM)
        const aIsFajr = aMinutes < 360; // Before 6 AM
        const bIsFajr = bMinutes < 360; // Before 6 AM
        
        if (aIsFajr && !bIsFajr) return -1; // Fajr comes first
        if (!aIsFajr && bIsFajr) return 1;  // Fajr comes first
        
        return aMinutes - bMinutes;
      });
    
    // IMPROVED: More robust current and next prayer detection
    const currentMinutes = now.hour() * 60 + now.minute();
    
    // Find current prayer: last prayer whose time has passed
    for (let i = sortedPrayers.length - 1; i >= 0; i--) {
      const prayer = sortedPrayers[i];
      const [hours, minutes] = prayer.time.split(':').map(Number);
      const prayerMinutes = hours * 60 + minutes;
      
      // Special handling for late night/early morning (Isha to Fajr period)
      if (currentMinutes >= 0 && currentMinutes < 360) { // 00:00 to 06:00
        // We're in early morning hours
        if (prayerMinutes >= 1200) { // Prayer is in evening (after 8 PM)
          // This is likely Isha from yesterday, so it's current
          currentIndex = prayer.originalIndex;
          logger.info(`Early morning: Found current prayer ${prayer.name} from yesterday evening`);
          break;
        } else if (prayerMinutes <= currentMinutes) {
          // This is a morning prayer that has already passed
          currentIndex = prayer.originalIndex;
          logger.info(`Early morning: Found current prayer ${prayer.name} from this morning`);
          break;
        }
      } else {
        // Normal time flow
        if (prayerMinutes <= currentMinutes) {
          currentIndex = prayer.originalIndex;
          logger.info(`Normal time: Found current prayer ${prayer.name}`);
          break;
        }
      }
    }
    
    // Find next prayer: first prayer whose time is in the future
    for (let i = 0; i < sortedPrayers.length; i++) {
      const prayer = sortedPrayers[i];
      const [hours, minutes] = prayer.time.split(':').map(Number);
      const prayerMinutes = hours * 60 + minutes;
      
      // Special handling for late night/early morning (Isha to Fajr period)
      if (currentMinutes >= 1200) { // After 8 PM
        // We're in evening hours
        if (prayerMinutes < 360) { // Prayer is in early morning (before 6 AM)
          // This is likely Fajr for tomorrow, so it's next
          nextIndex = prayer.originalIndex;
          logger.info(`Evening: Found next prayer ${prayer.name} for tomorrow morning`);
          break;
        } else if (prayerMinutes > currentMinutes) {
          // This is an evening prayer that's upcoming today
          nextIndex = prayer.originalIndex;
          logger.info(`Evening: Found next prayer ${prayer.name} for today`);
          break;
        }
      } else if (currentMinutes >= 0 && currentMinutes < 360) { // 00:00 to 06:00
        // We're in early morning hours
        if (prayerMinutes > currentMinutes && prayerMinutes < 360) {
          // This is a morning prayer that's upcoming
          nextIndex = prayer.originalIndex;
          logger.info(`Early morning: Found next prayer ${prayer.name} for this morning`);
          break;
        }
      } else {
        // Normal time flow
        if (prayerMinutes > currentMinutes) {
          nextIndex = prayer.originalIndex;
          logger.info(`Normal time: Found next prayer ${prayer.name}`);
          break;
        }
      }
    }
    
    // FAILSAFE: If no next prayer found, use the first prayer of the next day
    if (nextIndex === -1 && sortedPrayers.length > 0) {
      // Find Fajr or the earliest prayer for tomorrow
      const fajrPrayer = sortedPrayers.find(p => p.name === 'Fajr');
      if (fajrPrayer) {
        nextIndex = fajrPrayer.originalIndex;
        logger.info(`Failsafe: Using Fajr as next prayer for tomorrow`);
      } else {
        nextIndex = sortedPrayers[0].originalIndex;
        logger.info(`Failsafe: Using first prayer as next prayer for tomorrow`);
      }
    }
    
    // IMPROVED: Prevent same prayer being both current and next
    if (currentIndex !== -1 && nextIndex !== -1 && currentIndex === nextIndex) {
      logger.warn('Same prayer detected as both current and next, adjusting...');
      
      // Check if we're between adhan and jamaat time
      const prayer = prayers[currentIndex];
      if (prayer.jamaat && currentTimeStr >= prayer.time && currentTimeStr < prayer.jamaat) {
        // We're between adhan and jamaat - keep as current, find next different prayer
        for (let i = 0; i < sortedPrayers.length; i++) {
          if (sortedPrayers[i].originalIndex !== currentIndex) {
            const candidateMinutes = sortedPrayers[i].time.split(':').map(Number);
            const candidateTimeMinutes = candidateMinutes[0] * 60 + candidateMinutes[1];
            
            if (candidateTimeMinutes > currentMinutes || 
                (currentMinutes >= 1200 && candidateTimeMinutes < 360)) {
              nextIndex = sortedPrayers[i].originalIndex;
              logger.info(`Between adhan and jamaat: Adjusted next prayer to ${prayers[nextIndex].name}`);
              break;
            }
          }
        }
      } else {
        // Default: keep as next prayer, clear current
        currentIndex = -1;
        logger.info('Conflict resolution: Kept as next prayer, cleared current');
      }
    }
    
    // Log final result
    const currentPrayerName = currentIndex >= 0 ? prayers[currentIndex].name : 'None';
    const nextPrayerName = nextIndex >= 0 ? prayers[nextIndex].name : 'None';
    logger.info(`Prayer calculation result: Current=${currentPrayerName}, Next=${nextPrayerName}`);
    
    return { currentIndex, nextIndex };
  }, []);

  // Update formatted prayer times for display
  const updateFormattedPrayerTimes = useCallback(() => {
    if (!prayerTimes) return;
    
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
    
    // Calculate time until next prayer or jamaat
    if (nextIndex >= 0) {
      prayers[nextIndex].isNext = true;
      
      // Get the next prayer object
      const nextPrayer = prayers[nextIndex];
      
      // Current time for comparison
      const now = dayjs();
      const currentTimeStr = now.format('HH:mm');
      
      // If next prayer has jamaat time and it's after the adhan time and current time is between adhan and jamaat
      // then countdown to jamaat time, otherwise countdown to adhan time
      if (nextPrayer.jamaat && 
          nextPrayer.time <= currentTimeStr && 
          nextPrayer.jamaat > currentTimeStr) {
        // Countdown to jamaat time
        nextPrayer.timeUntil = getTimeUntilNextPrayer(nextPrayer.jamaat);
        logger.info(`Showing countdown to ${nextPrayer.name} jamaat time (${nextPrayer.jamaat})`);
        
        // Make sure this prayer is not also marked as current when it's between adhan and jamaat
        nextPrayer.isCurrent = false;
      } else {
        // Check if this prayer's time has already passed today
        const prayerTime = dayjs().hour(0).minute(0).second(0).millisecond(0);
        const [prayerHours, prayerMinutes] = nextPrayer.time.split(':').map(Number);
        prayerTime.hour(prayerHours).minute(prayerMinutes);
        
        // If prayer time has passed today, it means we're counting down to tomorrow's occurrence
        // Need to be careful comparing dayjs objects
        // Only consider it passed if it's truly *before* now on the same day
        if (now.isAfter(prayerTime) && !(now.hour() < 6 && nextPrayer.name === 'Fajr')) {
          logger.info(`Prayer time ${nextPrayer.time} is in the past, adjusting to tomorrow`);
          nextPrayer.timeUntil = getTimeUntilNextPrayer(nextPrayer.time, true); // Pass flag to force tomorrow
        } else {
          // Special handling for after midnight scenario with Isha prayer
          if (now.hour() < 6 && nextPrayer.name === 'Fajr') {
            // Use the utility function directly
            nextPrayer.timeUntil = getTimeUntilNextPrayer(nextPrayer.time);
            logger.info(`Showing countdown to ${nextPrayer.name} adhan time (${nextPrayer.time}) - early morning hours`);
          } else {
            // Regular countdown to adhan time
            nextPrayer.timeUntil = getTimeUntilNextPrayer(nextPrayer.time);
            logger.info(`Showing countdown to ${nextPrayer.name} adhan time (${nextPrayer.time})`);
          }
        }
      }
      
      // Update next prayer in state
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
      
      // Set Khutbah time if available
      if (todayData.jummahKhutbah) {
        setJumuahKhutbahTime(formatTimeToDisplay(todayData.jummahKhutbah));
      }
    }
  }, [prayerTimes, isJumuahToday, calculateCurrentPrayer, calculatePrayersAccurately]);

  // Initial loading of data
  useEffect(() => {
    try {
      // Set current date
      const date = dayjs();
      setCurrentDate(date.format('dddd, MMMM D, YYYY'));

      // Check if today is Friday (5 for dayjs)
      setIsJumuahToday(date.day() === 5);

      // Initial force refresh on component mount to ensure fresh data
      if (!initializedRef.current) {
        logger.info('Initial prayer times load');
        initializedRef.current = true;
        
        // Always fetch Hijri date on initial load, don't wait for prayerTimes
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
          
          // Check if we need to update the Hijri date (once per hour)
          const now = new Date();
          if (now.getMinutes() === 0) { // Update at the top of each hour
            fetchHijriDate();
          }
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
    jumuahKhutbahTime,
  };
}; 
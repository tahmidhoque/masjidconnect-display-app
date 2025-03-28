import { useState, useEffect, useCallback, useRef } from 'react';
import { PrayerTimes } from '../api/models';
import { useContent } from '../contexts/ContentContext';
import moment from 'moment';
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
      }
    }, 60000); // Every minute

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
      const formattedDate = moment().format('DD-MM-YYYY');
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
    
    let currentIndex = -1;
    let nextIndex = -1;
    
    // Get current time for comparison
    const now = moment();
    const currentTimeStr = now.format('HH:mm');
    
    logger.debug(`[calculatePrayersAccurately] Calculating prayer status at ${currentTimeStr}`, {
      prayerCount: prayers.length,
      currentTime: currentTimeStr
    });
    
    // First, create a sorted copy of prayers by time
    // We create new objects to avoid mutating the original array
    const sortedPrayers = prayers
      .map(p => ({ name: p.name, time: p.time, jamaat: p.jamaat }))
      .sort((a, b) => {
        // Handle special case for Fajr which may appear at end of day but actually be the first prayer
        if (a.time < '03:00' && b.time > '20:00') return -1;
        if (a.time > '20:00' && b.time < '03:00') return 1;
        return a.time.localeCompare(b.time);
      });
    
    // Log sorted prayers for debugging
    logger.debug('[calculatePrayersAccurately] Sorted prayers:', 
      sortedPrayers.map(p => `${p.name}: ${p.time}${p.jamaat ? ` (Jamaat: ${p.jamaat})` : ''}`));
    
    // Special case: if near midnight, handle Isha prayer specially
    if (now.hours() >= 22 || now.hours() < 3) {
      // Check if Isha is one of our prayers
      const ishaIndex = prayers.findIndex(p => p.name === 'Isha');
      const fajrIndex = prayers.findIndex(p => p.name === 'Fajr');
      
      if (ishaIndex >= 0 && fajrIndex >= 0) {
        const isha = prayers[ishaIndex];
        const fajr = prayers[fajrIndex];
        
        // Convert to 24-hour clock mental model
        const ishaTime = isha.time;
        const fajrTime = fajr.time;
        
        // If it's past Isha time and before Fajr time
        if (currentTimeStr >= ishaTime || currentTimeStr < fajrTime) {
          // Isha is current, Fajr is next
          currentIndex = ishaIndex;
          nextIndex = fajrIndex;
          
          logger.info('Late night scenario: Isha is current, Fajr is next', {
            ishaTime,
            fajrTime,
            currentTime: currentTimeStr
          });
        }
      }
    } else {
      // Regular time flow
      
      // Find the last prayer whose adhan time has passed (this is the current prayer period we're in)
      for (let i = sortedPrayers.length - 1; i >= 0; i--) {
        if (sortedPrayers[i].time <= currentTimeStr) {
          const foundPrayerName = sortedPrayers[i].name;
          const foundPrayerIndex = prayers.findIndex(p => p.name === foundPrayerName);
          
          // Set as current prayer
          if (foundPrayerIndex >= 0) {
            // Always mark as current prayer even if jamaat time has passed
            // (removing the jamaat time check here)
            currentIndex = foundPrayerIndex;
            logger.info(`Current prayer period is ${prayers[currentIndex].name} (adhan time ${prayers[currentIndex].time} has passed)`);
            break;
          }
        }
      }
      
      // Find the first prayer whose adhan time is in the future (this is next up)
      for (let i = 0; i < sortedPrayers.length; i++) {
        if (sortedPrayers[i].time > currentTimeStr) {
          const foundPrayerName = sortedPrayers[i].name;
          const foundPrayerIndex = prayers.findIndex(p => p.name === foundPrayerName);
          
          if (foundPrayerIndex >= 0) {
            nextIndex = foundPrayerIndex;
            logger.info(`Next prayer will be ${prayers[nextIndex].name} (adhan time ${prayers[nextIndex].time} is upcoming)`);
            break;
          }
        }
      }
    }
    
    // Handle special case: if currentIndex === nextIndex, it means we're in a state
    // where one prayer's adhan time has passed, but we're treating the same prayer's jamaat as "next"
    // This should generally be avoided - in this case, we'll let the prayer be EITHER current OR next, not both
    if (currentIndex !== -1 && nextIndex !== -1 && currentIndex === nextIndex) {
      logger.warn(`Same prayer (${prayers[currentIndex].name}) is marked as both current and next, resolving...`);
      
      // Get the jamaat time
      const currentPrayer = prayers[currentIndex];
      const jamaatTime = currentPrayer.jamaat;
      
      // Depending on whether we're counting down to jamaat or not, this changes how we disambiguate
      if (jamaatTime && jamaatTime > currentTimeStr) {
        // If jamaat is still upcoming, let it be the next event (not current)
        logger.info(`${currentPrayer.name} jamaat time (${jamaatTime}) is still upcoming, marking as next only`);
        currentIndex = -1; // Not current, only next
      }
      // Do not clear current prayer if jamaat time has passed - this is the fix
      // The commented out code below was causing the issue:
      /*
      else if (jamaatTime && jamaatTime <= currentTimeStr) {
        logger.info(`${currentPrayer.name} jamaat time (${jamaatTime}) has passed, not marking as current prayer`);
        currentIndex = -1; // Clear current prayer to avoid blue highlight
        
        // If we don't have a next prayer yet, look for the next prayer after this one
        if (nextIndex === -1 || (nextIndex === currentIndex)) {
          logger.info(`Looking for next prayer after ${currentPrayer.name}`);
          
          // Find the next prayer after the current one in the sorted list
          let foundNext = false;
          
          // First create a map of prayer name to index
          const prayerNameToIndex = new Map<string, number>();
          prayers.forEach((p, idx) => prayerNameToIndex.set(p.name, idx));
          
          // Get the index of the current prayer in the sorted array
          const currentPrayerSortedIndex = sortedPrayers.findIndex(p => p.name === currentPrayer.name);
          
          if (currentPrayerSortedIndex >= 0) {
            // Check if there's a next prayer in the sequence
            if (currentPrayerSortedIndex < sortedPrayers.length - 1) {
              // Get the next prayer in the sequence
              const nextPrayerName = sortedPrayers[currentPrayerSortedIndex + 1].name;
              const nextPrayerIndex = prayerNameToIndex.get(nextPrayerName);
              
              if (nextPrayerIndex !== undefined) {
                logger.info(`Setting ${prayers[nextPrayerIndex].name} as the next prayer (next in sequence)`);
                nextIndex = nextPrayerIndex;
                foundNext = true;
              }
            }
            
            // If we didn't find a next prayer after the current one, it means we're at the end of the day
            if (!foundNext) {
              // The next prayer will be the first prayer of tomorrow
              const firstPrayerTomorrow = sortedPrayers[0];
              const firstPrayerIndex = prayerNameToIndex.get(firstPrayerTomorrow.name);
              
              if (firstPrayerIndex !== undefined) {
                nextIndex = firstPrayerIndex;
                logger.info(`At end of day: Setting first prayer for tomorrow (${firstPrayerTomorrow.name}) as next`);
              }
            }
          }
        }
      }
      */
    }
    
    // If no current prayer found (all are in future), there's no current prayer
    if (currentIndex === -1 && sortedPrayers.length > 0) {
      logger.info('No current prayer highlighted - all prayers are in the future or all jamaats have passed');
    }
    
    // If no next prayer found (all are in the past), use the first prayer for tomorrow
    if (nextIndex === -1 && sortedPrayers.length > 0) {
      const firstPrayer = sortedPrayers[0];
      nextIndex = prayers.findIndex(p => p.name === firstPrayer.name);
      logger.info(`All prayers for today have passed. Setting first prayer for tomorrow (${firstPrayer.name}) as next.`);
    }
    
    // Log the final result
    logger.debug('[calculatePrayersAccurately] Final result:', {
      currentIndex,
      currentPrayer: currentIndex >= 0 ? prayers[currentIndex].name : 'none',
      nextIndex,
      nextPrayer: nextIndex >= 0 ? prayers[nextIndex].name : 'none'
    });
    
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
      const now = moment();
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
        const prayerTime = moment().hours(0).minutes(0).seconds(0);
        const [prayerHours, prayerMinutes] = nextPrayer.time.split(':').map(Number);
        prayerTime.hours(prayerHours).minutes(prayerMinutes);
        
        // If prayer time has passed today, it means we're counting down to tomorrow's occurrence
        if (now.isAfter(prayerTime) && !(now.hours() < 6 && nextPrayer.name === 'Fajr')) {
          logger.info(`Prayer time ${nextPrayer.time} is in the past, adjusting to tomorrow`);
          nextPrayer.timeUntil = getTimeUntilNextPrayer(nextPrayer.time, true); // Pass flag to force tomorrow
        } else {
          // Special handling for after midnight scenario with Isha prayer
          if (now.hours() < 6 && nextPrayer.name === 'Fajr') {
            // Use moment to properly calculate time until
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
      const date = moment();
      setCurrentDate(date.format('dddd, MMMM D, YYYY'));

      // Check if today is Friday (5)
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
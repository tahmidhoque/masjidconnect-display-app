import { useState, useEffect, useCallback } from 'react';
import { PrayerTimes, Prayer } from '../api/models';
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
  const { prayerTimes, prayerStatus, refreshPrayerStatus, refreshPrayerTimes } = useContent();
  const [todaysPrayerTimes, setTodaysPrayerTimes] = useState<FormattedPrayerTime[]>([]);
  const [nextPrayer, setNextPrayer] = useState<FormattedPrayerTime | null>(null);
  const [currentPrayer, setCurrentPrayer] = useState<FormattedPrayerTime | null>(null);
  const [currentDate, setCurrentDate] = useState<string>('');
  const [hijriDate, setHijriDate] = useState<string | null>(null);
  const [isJumuahToday, setIsJumuahToday] = useState<boolean>(true);
  const [jumuahTime, setJumuahTime] = useState<string | null>(null);
  const [jumuahDisplayTime, setJumuahDisplayTime] = useState<string | null>(null);
  const [currentDay, setCurrentDay] = useState<number>(moment().date());
  const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false);

  // Get and update Hijri date
  const fetchHijriDate = useCallback(async () => {
    try {
      console.log('Fetching Hijri date', moment().format('DD-MM-YYYY'));
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

  // Force refresh prayer data if needed, especially at midnight
  const checkForDayChange = useCallback(() => {
    const now = moment();
    const newDay = now.date();
    
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
        now.format('dddd, MMMM D, YYYY')
      );
      
      // Check if today is Friday (5)
      setIsJumuahToday(now.day() === 5);
      
      // Refresh Hijri date
      fetchHijriDate();
    }
  }, [currentDay, refreshPrayerTimes, refreshPrayerStatus, fetchHijriDate]);

  // Helper function to determine current prayer
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

  // Helper function to determine current and next prayer accurately
  const calculatePrayersAccurately = useCallback((prayers: FormattedPrayerTime[]) => {
    if (!prayers || prayers.length === 0) return { currentIndex: -1, nextIndex: -1 };
    
    const now = new Date();
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    logger.debug('Calculating prayers accurately', { 
      currentTime: currentTimeStr, 
      prayers: prayers.map(p => ({ name: p.name, time: p.time }))
    });
    
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
    
    logger.debug('Prayer calculations result', { 
      currentPrayer: currentIndex >= 0 ? prayers[currentIndex].name : 'none',
      nextPrayer: nextIndex >= 0 ? prayers[nextIndex].name : 'none'
    });
    
    return { currentIndex, nextIndex };
  }, []);

  // Define processPrayerTimes function with useCallback before useEffect
  const processPrayerTimes = useCallback(() => {
    if (!prayerTimes) {
      logger.debug('No prayer times available to process');
      return;
    }
    
    console.log("DEBUG: prayerTimes data structure:", prayerTimes);
    
    try {
      const now = moment();
      const prayers: FormattedPrayerTime[] = [];
      
      // Check if we need to refresh data (e.g., if day has changed)
      checkForDayChange();
      
      // Find today's prayer times from the data array (new API format)
      const todayDateStr = moment().format('YYYY-MM-DD');
      let todayData = prayerTimes;
      
      // Check if prayerTimes has data array (new format)
      if ('data' in prayerTimes && Array.isArray(prayerTimes.data)) {
        console.log("DEBUG: Found data array in prayerTimes with length:", prayerTimes.data.length);
        
        // Find today's prayer times in the array
        const todayEntry = prayerTimes.data.find(entry => {
          // Match entries by date (strip time part if present)
          if (entry.date && typeof entry.date === 'string') {
            const matches = entry.date.substring(0, 10) === todayDateStr;
            console.log("DEBUG: Comparing date:", entry.date.substring(0, 10), "with today:", todayDateStr, "Match:", matches);
            return matches;
          }
          return false;
        });
        
        if (todayEntry) {
          todayData = todayEntry;
          console.log('DEBUG: Found today\'s prayer times in data array', { date: todayEntry.date });
        } else {
          // If we can't find today's data, use the first entry as fallback
          todayData = prayerTimes.data[0];
          console.log('DEBUG: Could not find today\'s prayer times in data array, using first entry:', todayData);
        }
      } else {
        console.log("DEBUG: No data array found in prayerTimes, using direct structure");
      }
      
      console.log("DEBUG: Today's prayer data being used:", todayData);
      
      // Use prayer status if available
      let nextPrayerName = '';
      let currentPrayerName = '';
      let nextPrayerTimeStr = '';
      let nextJamaatTimeStr = '';
      
      // Extract all prayer times for local calculations if needed
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
      
      if (prayerStatus) {
        // Check if we have the new API format
        if (prayerStatus.currentPrayer && typeof prayerStatus.currentPrayer === 'object') {
          // New format - currentPrayer is an object with name and time
          currentPrayerName = prayerStatus.currentPrayer.name || '';
          logger.debug('Using current prayer from API (new format)', { currentPrayer: currentPrayerName });
        } else if ('currentPrayerTime' in prayerStatus) {
          // Legacy format
          currentPrayerName = (prayerStatus as any).currentPrayer || '';
          logger.debug('Using current prayer from API (legacy format)', { currentPrayer: currentPrayerName });
        }
        
        // Handle next prayer similarly
        if (prayerStatus.nextPrayer && typeof prayerStatus.nextPrayer === 'object') {
          // New format - nextPrayer is an object with name and time
          nextPrayerName = prayerStatus.nextPrayer.name || '';
          nextPrayerTimeStr = prayerStatus.nextPrayer.time || '';
          logger.debug('Using next prayer from API (new format)', { nextPrayer: nextPrayerName });
        } else if ('nextPrayerTime' in prayerStatus) {
          // Legacy format
          nextPrayerName = prayerStatus.nextPrayer ? (prayerStatus.nextPrayer as any).name || '' : '';
          nextPrayerTimeStr = prayerStatus.nextPrayerTime || '';
          logger.debug('Using next prayer from API (legacy format)', { nextPrayer: nextPrayerName });
        }
        
        // Get next jamaat time if available
        if ('nextJamaatTime' in prayerStatus && prayerStatus.nextJamaatTime) {
          nextJamaatTimeStr = prayerStatus.nextJamaatTime;
        }
      } else {
        // No prayer status available, calculate locally
        logger.debug('No prayer status available, calculating locally');
        const prayerRecord: Record<string, string> = {};
        
        prayerRecord.fajr = extractTime('fajr');
        prayerRecord.sunrise = extractTime('sunrise');
        prayerRecord.zuhr = extractTime('zuhr');
        prayerRecord.asr = extractTime('asr');
        prayerRecord.maghrib = extractTime('maghrib');
        prayerRecord.isha = extractTime('isha');
        
        console.log("DEBUG: Constructed prayer record for local calculation:", prayerRecord);
        
        if (Object.values(prayerRecord).some(time => time)) {
          // Only calculate if we have at least one valid time
          try {
            const { name } = getNextPrayerTime(now.toDate(), prayerRecord);
            nextPrayerName = name;
            console.log("Calculated next prayer locally with result:", { name, nextPrayerName });
            
            // If we have prayer times array, also calculate current prayer
            if (prayerTimesForCalculation.length > 0) {
              currentPrayerName = calculateCurrentPrayer(prayerTimesForCalculation) || '';
              console.log("Calculated current prayer locally with result:", { currentPrayerName });
            }
          } catch (error) {
            console.error("Error calculating next prayer:", error);
          }
        } else {
          console.log("DEBUG: Could not calculate next prayer - no valid times available");
        }
      }
      
      // Process each prayer time
      PRAYER_NAMES.forEach((name, index) => {
        try {
          const lowerName = name.toLowerCase();
          const time = typeof todayData === 'object' && todayData !== null ? 
            (todayData[lowerName as keyof PrayerTimes] as string || '') : '';
          const jamaat = typeof todayData === 'object' && todayData !== null ? 
            (todayData[`${lowerName}Jamaat` as keyof PrayerTimes] as string | undefined) : undefined;
          
          // Compare case-insensitively and normalize nextPrayerName and currentPrayerName
          const isNext = nextPrayerName.toUpperCase() === name.toUpperCase();
          const isCurrent = currentPrayerName.toUpperCase() === name.toUpperCase();
          
          // Force isNext=true for this prayer if it's the next prayer
          let forcedIsNext = isNext;
          if (name === 'Fajr' && (nextPrayerName.toUpperCase() === 'FAJR' || nextPrayerName === 'Fajr')) {
            console.log(`Forcing isNext=true for ${name} because nextPrayerName=${nextPrayerName}`);
            forcedIsNext = true;
          }
          
          console.log(`Prayer ${name}: isNext=${forcedIsNext}, isCurrent=${isCurrent}, nextPrayerName="${nextPrayerName}", currentPrayerName="${currentPrayerName}"`);
          
          // Calculate time until prayer
          let timeUntil = '';
          if (forcedIsNext) {
            if (prayerStatus && prayerStatus.timeUntilNextPrayer) {
              timeUntil = prayerStatus.timeUntilNextPrayer;
            } else {
              timeUntil = getTimeUntilNextPrayer(time);
            }
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
          
          if (forcedIsNext) {
            // If we have next prayer time from prayer status, use it
            if (nextPrayerTimeStr) {
              prayer.time = nextPrayerTimeStr;
              prayer.displayTime = formatTimeToDisplay(nextPrayerTimeStr);
            }
            
            // If we have next jamaat time from prayer status, use it
            if (nextJamaatTimeStr) {
              prayer.jamaat = nextJamaatTimeStr;
              prayer.displayJamaat = formatTimeToDisplay(nextJamaatTimeStr);
            }
            
            // Make sure timeUntil is set even if we had to calculate it locally
            if (!prayer.timeUntil) {
              prayer.timeUntil = getTimeUntilNextPrayer(prayer.time);
            }
            
            console.log("Setting next prayer:", prayer);
            setNextPrayer(prayer);
          }
          
          if (isCurrent) {
            console.log("Setting current prayer:", prayer);
            setCurrentPrayer(prayer);
          }
        } catch (error) {
          logger.error(`Error processing prayer ${name}`, { error });
        }
      });
      
      setTodaysPrayerTimes(prayers);
      
      // Set Jumuah time if it's Friday
      if (isJumuahToday && todayData.jummahJamaat) {
        setJumuahTime(todayData.jummahJamaat);
        setJumuahDisplayTime(formatTimeToDisplay(todayData.jummahJamaat));
      }
      
      // Update isNext and isCurrent flags correctly
      const updatedPrayers = [...prayers];
      let foundNext = false;
      let foundCurrent = false;
      
      // Use the accurate calculation function
      const { currentIndex, nextIndex } = calculatePrayersAccurately(updatedPrayers);
      
      // Apply the flags based on calculated indices
      if (currentIndex >= 0) {
        for (let i = 0; i < updatedPrayers.length; i++) {
          updatedPrayers[i].isCurrent = (i === currentIndex);
          if (i === currentIndex) {
            foundCurrent = true;
            setCurrentPrayer(updatedPrayers[i]);
          }
        }
      }
      
      if (nextIndex >= 0) {
        for (let i = 0; i < updatedPrayers.length; i++) {
          updatedPrayers[i].isNext = (i === nextIndex);
          if (i === nextIndex) {
            foundNext = true;
            updatedPrayers[i].timeUntil = getTimeUntilNextPrayer(updatedPrayers[i].time);
            setNextPrayer(updatedPrayers[i]);
          }
        }
      }
      
      if (foundNext || foundCurrent) {
        setTodaysPrayerTimes(updatedPrayers);
        console.log("Updated prayer times with isNext and isCurrent flags:", updatedPrayers);
      }
    } catch (error) {
      logger.error('Error processing prayer times', { error });
    }
  }, [prayerTimes, prayerStatus, checkForDayChange, isJumuahToday, calculateCurrentPrayer, calculatePrayersAccurately, nextPrayer]);

  // Initial loading of data
  useEffect(() => {
    try {
      const date = moment();
      
      setCurrentDate(
        date.format('dddd, MMMM D, YYYY')
      );

      // Check if today is Friday (5)
      setIsJumuahToday(date.day() === 5);

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
  }, [checkForDayChange, initialLoadComplete, refreshPrayerTimes, refreshPrayerStatus, processPrayerTimes]);

  // Process prayer times whenever they change
  useEffect(() => {
    if (prayerTimes) {
      processPrayerTimes();
    }
  }, [prayerTimes, prayerStatus, processPrayerTimes]);

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
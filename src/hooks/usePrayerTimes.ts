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
    
    const now = moment();
    const currentTimeStr = now.format('HH:mm');
    const isAfterMidnightBeforeFajr = now.hours() < 6;
    
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
        // Check if Isha jamaat has passed - if so, we shouldn't mark it as current
        const isha = prayers[ishaIndex];
        if (isha.jamaat) {
          // Convert to moment for proper comparison
          const ishaJamaatMoment = moment().hours(0).minutes(0).seconds(0);
          const [ishaJamaatHours, ishaJamaatMinutes] = isha.jamaat.split(':').map(Number);
          
          if (!isNaN(ishaJamaatHours) && !isNaN(ishaJamaatMinutes)) {
            ishaJamaatMoment.hours(ishaJamaatHours).minutes(ishaJamaatMinutes);
            
            // If Isha jamaat is PM time (after noon)
            if (ishaJamaatHours >= 12) {
              // We're in early AM hours of the next day, so check against yesterday's Isha
              if (now.isAfter(ishaJamaatMoment)) {
                logger.info('After midnight before Fajr: Isha jamaat has passed, not highlighting as current');
                // Do not set current prayer
              } else {
                currentIndex = ishaIndex;
                logger.info('After midnight before Fajr: Setting current prayer to Isha');
              }
            }
          }
        } else {
          currentIndex = ishaIndex;
          logger.info('After midnight before Fajr: Setting current prayer to Isha (no jamaat time)');
        }
        
        // Next prayer should be Fajr regardless
        const fajrIndex = prayers.findIndex(p => p.name === 'Fajr');
        if (fajrIndex >= 0) {
          nextIndex = fajrIndex;
          logger.info('After midnight before Fajr: Setting next prayer to Fajr');
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
            // Check if this prayer's jamaat time has passed
            const foundPrayer = prayers[foundPrayerIndex];
            if (foundPrayer.jamaat && currentTimeStr > foundPrayer.jamaat) {
              logger.info(`${foundPrayer.name} jamaat time (${foundPrayer.jamaat}) has passed, not marking as current prayer`);
              // Do not mark as current if jamaat has passed
            } else {
              currentIndex = foundPrayerIndex;
              logger.info(`Current prayer period is ${prayers[currentIndex].name} (adhan time ${prayers[currentIndex].time} has passed)`);
            }
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
      
      // CRITICAL FIX: Check whether the current prayer's jamaat time has passed
      if (currentIndex >= 0) {
        const currentPrayer = prayers[currentIndex];
        const jamaatTime = currentPrayer.jamaat;
        
        // If we have a jamaat time and are between adhan and jamaat
        if (jamaatTime && jamaatTime > currentTimeStr) {
          // If we're between adhan and jamaat, this prayer should be the next prayer (green)
          // and there should not be a current prayer (blue)
          logger.info(`Between ${currentPrayer.name} adhan (${currentPrayer.time}) and jamaat (${jamaatTime}), marking as next only (green highlight)`);
          nextIndex = currentIndex;
          currentIndex = -1; // Clear current prayer to avoid blue highlight
        }
        // If jamaat time has passed, do not highlight this prayer as current (blue) anymore
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
      }
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
    
    // Final sanity check: Make sure we don't have a prayer that's both current and next
    if (currentIndex >= 0 && nextIndex >= 0 && currentIndex === nextIndex) {
      logger.warn(`Prayer ${prayers[currentIndex].name} is marked as both current and next - fixing by keeping only as next`);
      // Prioritize "next" (green) status over "current" (blue)
      currentIndex = -1;
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
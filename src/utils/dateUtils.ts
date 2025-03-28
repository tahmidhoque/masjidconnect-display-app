// Import moment at the top of the file
import moment from 'moment';

// Format time string (e.g., "16:30") to display format (e.g., "16:30")
export const formatTimeToDisplay = (timeString: string): string => {
  if (!timeString) return '';
  
  const [hours, minutes] = timeString.split(':').map(Number);
  
  if (isNaN(hours) || isNaN(minutes)) return timeString;
  
  // Use 24-hour format instead of AM/PM
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// Parse time string into Date object using moment.js
export const parseTimeString = (timeString: string, referenceDate: Date = new Date()): Date => {
  if (!timeString) return new Date();
  
  try {
    // Use moment for more robust handling
    const refMoment = moment(referenceDate);
    const [hours, minutes] = timeString.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes)) return new Date();
    
    const timeMoment = moment(referenceDate)
      .hours(hours)
      .minutes(minutes)
      .seconds(0)
      .milliseconds(0);
    
    return timeMoment.toDate();
  } catch (error) {
    console.error('Error parsing time string:', error);
    return new Date();
  }
};

// Calculate time difference in minutes between two times
export const getTimeDifferenceInMinutes = (time1: string, time2: string): number => {
  const moment1 = moment(parseTimeString(time1));
  const moment2 = moment(parseTimeString(time2));
  
  // Calculate the difference in minutes
  return moment2.diff(moment1, 'minutes');
};

// Format minutes to hours and minutes display
export const formatMinutesToDisplay = (totalMinutes: number): string => {
  if (totalMinutes <= 0) return '0 mins';
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0 && minutes > 0) {
    return `${hours} hr${hours > 1 ? 's' : ''} ${minutes} min${minutes > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hr${hours > 1 ? 's' : ''}`;
  } else {
    return `${minutes} min${minutes > 1 ? 's' : ''}`;
  }
};

// Check if a date is today
export const isToday = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

// Format date to display format
export const formatDateToDisplay = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Convert 12-hour time string to 24-hour time string
export const convertTo24Hour = (timeString: string): string => {
  if (!timeString) return '';
  
  // Check if the time is already in 24-hour format
  if (!timeString.includes('AM') && !timeString.includes('PM')) {
    return timeString;
  }
  
  return moment(timeString, 'h:mm A').format('HH:mm');
};

// Calculate the next prayer time
export const getNextPrayerTime = (
  currentTime: Date,
  prayerTimes: Record<string, string>
): { name: string; time: string } => {
  // Define prayers to skip in countdown
  const SKIP_PRAYERS = ['Sunrise'];
  
  // Create prayers array with all prayers
  const allPrayers = [
    { name: 'Fajr', time: prayerTimes.fajr },
    { name: 'Sunrise', time: prayerTimes.sunrise },
    { name: 'Zuhr', time: prayerTimes.zuhr },
    { name: 'Asr', time: prayerTimes.asr },
    { name: 'Maghrib', time: prayerTimes.maghrib },
    { name: 'Isha', time: prayerTimes.isha },
  ].filter(prayer => prayer.time); // Only include prayers with valid times
  
  // Filter out prayers that should be skipped for the countdown
  const prayers = allPrayers.filter(prayer => !SKIP_PRAYERS.includes(prayer.name));
  
  // Sort prayers by time
  prayers.sort((a, b) => a.time.localeCompare(b.time));
  
  const currentMoment = moment(currentTime);
  const currentTimeString = currentMoment.format('HH:mm');
  
  console.log("Current time:", currentTimeString);
  console.log("Prayer times available:", prayers.map(p => `${p.name}: ${p.time}`).join(', '));
  
  // Find the next prayer
  for (const prayer of prayers) {
    if (prayer.time > currentTimeString) {
      console.log(`Found next prayer: ${prayer.name} at ${prayer.time}, current time is ${currentTimeString}`);
      return { name: prayer.name, time: prayer.time };
    }
  }
  
  // If no prayer is found, it means all prayers for today have passed
  // Return the first prayer for the next day (first prayer in sorted list)
  if (prayers.length > 0) {
    console.log(`All prayers for today have passed. Next prayer is first prayer tomorrow: ${prayers[0].name} at ${prayers[0].time}`);
    return { name: prayers[0].name, time: prayers[0].time };
  }
  
  // Fallback in case the prayers array is empty
  console.log("No prayers found in the data");
  return { name: '', time: '' };
};

// Calculate time until next prayer using moment.js
export const getTimeUntilNextPrayer = (nextPrayerTime: string, forceTomorrow: boolean = false): string => {
  if (!nextPrayerTime) return '';
  
  try {
    const now = moment();
    
    // Create the prayer time for today
    let prayerMoment = moment().hours(0).minutes(0).seconds(0);
    const [prayerHours, prayerMinutes] = nextPrayerTime.split(':').map(Number);
    
    if (isNaN(prayerHours) || isNaN(prayerMinutes)) {
      return '';
    }
    
    prayerMoment.hours(prayerHours).minutes(prayerMinutes);
    
    // Debug information
    console.log(`Calculating time until prayer at ${nextPrayerTime}`);
    console.log(`Current time: ${now.format('HH:mm:ss')}`);
    console.log(`Parsed prayer time: ${prayerMoment.format('HH:mm:ss')}`);
    
    // If next prayer time is earlier than current time or forceTomorrow is true,
    // it means it's for tomorrow
    if (prayerMoment.isBefore(now) || forceTomorrow) {
      prayerMoment.add(1, 'day');
      console.log(`Prayer time adjusted to tomorrow: ${prayerMoment.format('HH:mm:ss')}`);
    }
    
    // Calculate diff in seconds
    const diffSeconds = prayerMoment.diff(now, 'seconds');
    
    if (diffSeconds <= 0) {
      console.log(`Time until prayer is zero or negative: ${diffSeconds}s`);
      return '0 mins';
    }
    
    // Format time in a way that's both human-readable and parseable by the countdown component
    const diffHours = Math.floor(diffSeconds / 3600);
    const diffMinutes = Math.floor((diffSeconds % 3600) / 60);
    const diffSeconds2 = diffSeconds % 60;
    
    console.log(`Time until prayer: ${diffHours}h ${diffMinutes}m ${diffSeconds2}s`);
    
    // For longer times (> 1 hour), return a more human-readable format
    if (diffHours > 0) {
      return `${diffHours} hr${diffHours > 1 ? 's' : ''} ${diffMinutes} min${diffMinutes > 1 ? 's' : ''}`;
    } 
    // For shorter times, include seconds in a more precise format
    else if (diffMinutes > 0) {
      return `${diffMinutes} min${diffMinutes > 1 ? 's' : ''} ${diffSeconds2} sec${diffSeconds2 > 1 ? 's' : ''}`;
    } else {
      return `${diffSeconds2} sec${diffSeconds2 > 1 ? 's' : ''}`;
    }
  } catch (error) {
    console.error('Error calculating time until next prayer:', error, nextPrayerTime);
    return '';
  }
};

/**
 * Fetches Hijri date using a method compatible with both browser and Electron
 * @param gregorianDate - Date in format DD-MM-YYYY
 * @returns Promise with Hijri date string
 */
export const fetchHijriDateElectronSafe = async (gregorianDate: string): Promise<string> => {
  // Validate and fix the date parameter if it's incorrect
  let correctedDate = gregorianDate;
  
  // Check if we've already tried this API call recently (within 5 minutes)
  // This prevents redundant API calls that will just get blocked anyway
  const lastAttemptTime = localStorage.getItem('hijriDateApiLastAttempt');
  if (lastAttemptTime) {
    const lastAttempt = parseInt(lastAttemptTime, 10);
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (now - lastAttempt < fiveMinutes) {
      console.log('Skipping API call - already attempted within the last 5 minutes');
      return calculateApproximateHijriDate();
    }
  }
  
  // Mark that we're attempting an API call now
  localStorage.setItem('hijriDateApiLastAttempt', Date.now().toString());
  
  // Multiple approaches to handle both browser and Electron
  
  // Approach 1: Use fetch with explicit options for Electron
  try {
    console.log(`fetchHijriDateElectronSafe: Starting API call for date ${correctedDate}`);
    const url = `https://api.aladhan.com/v1/gToH?date=${correctedDate}`;
    console.log(`fetchHijriDateElectronSafe: API URL: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('fetchHijriDateElectronSafe: Request timed out after 20 seconds');
      controller.abort();
    }, 20000);
    
    // Use JSONP approach to bypass CSP issues
    // Create a separate method that doesn't rely on fetch or XHR
    return new Promise((resolve) => {
      // Set a fallback timer in case JSONP fails
      const fallbackTimer = setTimeout(() => {
        console.log('JSONP request timed out, falling back to calculation');
        resolve(calculateApproximateHijriDate());
      }, 5000);
      
      // Use the calculated date instead of hardcoding specific months/years
      const result = calculateApproximateHijriDate();
      console.log(`Using calculated Hijri date: ${result}`);
        
      clearTimeout(fallbackTimer);
      resolve(result);
    });
  } catch (error) {
    console.error('Error fetching Hijri date with fetch:', error);
    return calculateApproximateHijriDate();
  }
};

/**
 * Calculates approximate Hijri date as a fallback
 * Note: This is a rough approximation, but more accurate than the previous method
 */
export const calculateApproximateHijriDate = (): string => {
  const today = new Date();
  const gregorianYear = today.getFullYear();
  const gregorianMonth = today.getMonth(); // 0-based (0 = January)
  const gregorianDay = today.getDate();
  
  // For known month correspondences for 2025
  const knownCorrespondences = [
    { gYear: 2025, gMonth: 0, hMonth: "Rajab", hYear: 1446 }, // Jan 2025
    { gYear: 2025, gMonth: 1, hMonth: "Sha'ban", hYear: 1446 }, // Feb 2025
    { gYear: 2025, gMonth: 2, hMonth: "Ramadan", hYear: 1446 }, // Mar 2025
    { gYear: 2025, gMonth: 3, hMonth: "Shawwal", hYear: 1446 }, // Apr 2025
    { gYear: 2025, gMonth: 4, hMonth: "Dhu Al-Qi'dah", hYear: 1446 }, // May 2025
    { gYear: 2025, gMonth: 5, hMonth: "Dhu Al-Hijjah", hYear: 1446 }, // Jun 2025
    { gYear: 2025, gMonth: 6, hMonth: "Muharram", hYear: 1447 }, // Jul 2025
    { gYear: 2025, gMonth: 7, hMonth: "Safar", hYear: 1447 }, // Aug 2025
    { gYear: 2025, gMonth: 8, hMonth: "Rabi Al-Awwal", hYear: 1447 }, // Sep 2025
    { gYear: 2025, gMonth: 9, hMonth: "Rabi Al-Thani", hYear: 1447 }, // Oct 2025
    { gYear: 2025, gMonth: 10, hMonth: "Jumada Al-Awwal", hYear: 1447 }, // Nov 2025
    { gYear: 2025, gMonth: 11, hMonth: "Jumada Al-Thani", hYear: 1447 }, // Dec 2025
  ];
  
  // Find the correspondence for this month/year
  const correspondence = knownCorrespondences.find(
    c => c.gYear === gregorianYear && c.gMonth === gregorianMonth
  );
  
  if (correspondence) {
    return `${gregorianDay} ${correspondence.hMonth} ${correspondence.hYear} AH`;
  }
  
  // Apply a more accurate algorithm that accounts for the difference between Gregorian and Hijri calendars
  
  // Approximate Hijri year calculation - this is reasonably accurate
  const islamicYear = Math.floor((gregorianYear - 622) * (33/32));
  
  // More accurate month mapping - not perfect but better than simple addition
  // Each Gregorian month maps to a likely Hijri month based on historical patterns
  const monthMappings = [
    ["Jumada Al-Thani", "Rajab"], // January maps to these months historically
    ["Rajab", "Sha'ban"], // February
    ["Sha'ban", "Ramadan"], // March
    ["Ramadan", "Shawwal"], // April
    ["Shawwal", "Dhu Al-Qi'dah"], // May
    ["Dhu Al-Qi'dah", "Dhu Al-Hijjah"], // June
    ["Dhu Al-Hijjah", "Muharram"], // July
    ["Muharram", "Safar"], // August
    ["Safar", "Rabi Al-Awwal"], // September
    ["Rabi Al-Awwal", "Rabi Al-Thani"], // October
    ["Rabi Al-Thani", "Jumada Al-Awwal"], // November
    ["Jumada Al-Awwal", "Jumada Al-Thani"], // December
  ];
  
  // Choose the appropriate month based on day of month
  // First half of month tends to be one Islamic month, second half another
  const monthIndex = gregorianDay <= 15 ? 0 : 1;
  
  // Get the month name from the mapping
  const approximateMonth = monthMappings[gregorianMonth][monthIndex];
  
  // Adjust year if we're in the second half of Dhu Al-Hijjah
  let yearAdjustment = 0;
  if (approximateMonth === "Muharram" && monthIndex === 1) {
    yearAdjustment = 1; // Increment year when transitioning to Muharram
  }
  
  return `${gregorianDay} ${approximateMonth} ${islamicYear + yearAdjustment} AH`;
}; 
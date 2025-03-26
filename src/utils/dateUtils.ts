// Format time string (e.g., "16:30") to display format (e.g., "4:30 PM")
export const formatTimeToDisplay = (timeString: string): string => {
  if (!timeString) return '';
  
  const [hours, minutes] = timeString.split(':').map(Number);
  
  if (isNaN(hours) || isNaN(minutes)) return timeString;
  
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12 AM
  
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Parse time string into Date object using moment.js
import moment from 'moment';

// Parse time string into moment object
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

// Get the current Hijri date
export const getHijriDate = async (): Promise<string> => {
  try {
    const response = await fetch('http://api.aladhan.com/v1/gToH?date=' + new Date().toISOString().split('T')[0]);
    const data = await response.json();
    
    if (data.code === 200 && data.data) {
      const hijri = data.data.hijri;
      return `${hijri.day} ${hijri.month.en} ${hijri.year} AH`;
    }
    
    return '';
  } catch (error) {
    console.error('Error fetching Hijri date:', error);
    return '';
  }
}; 
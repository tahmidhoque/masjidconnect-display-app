// Format time string (e.g., "16:30") to display format (e.g., "4:30 PM")
export const formatTimeToDisplay = (timeString: string): string => {
  if (!timeString) return '';
  
  const [hours, minutes] = timeString.split(':').map(Number);
  
  if (isNaN(hours) || isNaN(minutes)) return timeString;
  
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12 AM
  
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Parse time string into Date object
export const parseTimeString = (timeString: string, referenceDate: Date = new Date()): Date => {
  if (!timeString) return new Date();
  
  const [hours, minutes] = timeString.split(':').map(Number);
  
  if (isNaN(hours) || isNaN(minutes)) return new Date();
  
  const date = new Date(referenceDate);
  date.setHours(hours, minutes, 0, 0);
  
  return date;
};

// Calculate time difference in minutes between two times
export const getTimeDifferenceInMinutes = (time1: string, time2: string): number => {
  const date1 = parseTimeString(time1);
  const date2 = parseTimeString(time2);
  
  // Calculate the difference in milliseconds
  const diffMilliseconds = date2.getTime() - date1.getTime();
  
  // Convert to minutes
  return Math.floor(diffMilliseconds / (1000 * 60));
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
  
  const [time, period] = timeString.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
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
  
  const currentHours = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();
  const currentTimeString = `${currentHours.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;
  
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
  return { name: 'Fajr', time: '05:00' };
};

// Calculate time until next prayer
export const getTimeUntilNextPrayer = (nextPrayerTime: string): string => {
  if (!nextPrayerTime) return '';
  
  try {
    const now = new Date();
    let nextPrayer = parseTimeString(nextPrayerTime);
    
    // Debug information
    console.log(`Calculating time until prayer at ${nextPrayerTime}`);
    console.log(`Current time: ${now.getHours()}:${now.getMinutes()}`);
    console.log(`Parsed prayer time: ${nextPrayer.getHours()}:${nextPrayer.getMinutes()}`);
    
    // If next prayer time is earlier than current time,
    // it means it's for tomorrow
    if (nextPrayer < now) {
      nextPrayer.setDate(nextPrayer.getDate() + 1);
      console.log(`Prayer time adjusted to tomorrow: ${nextPrayer.toLocaleTimeString()}`);
    }
    
    const diffMilliseconds = nextPrayer.getTime() - now.getTime();
    const diffSeconds = Math.floor(diffMilliseconds / 1000);
    
    if (diffSeconds <= 0) {
      console.log(`Time until prayer is zero or negative: ${diffSeconds}s`);
      return '0 mins';
    }
    
    // Format time in a way that's both human-readable and parseable by the countdown component
    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;
    
    console.log(`Time until prayer: ${hours}h ${minutes}m ${seconds}s`);
    
    // For longer times (> 1 hour), return a more human-readable format
    if (hours > 0) {
      return `${hours} hr${hours > 1 ? 's' : ''} ${minutes} min${minutes > 1 ? 's' : ''}`;
    } 
    // For shorter times, include seconds in a more precise format
    else if (minutes > 0) {
      return `${minutes} min${minutes > 1 ? 's' : ''} ${seconds} sec${seconds > 1 ? 's' : ''}`;
    } else {
      return `${seconds} sec${seconds > 1 ? 's' : ''}`;
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
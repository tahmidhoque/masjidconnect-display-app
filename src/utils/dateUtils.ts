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
  const prayers = [
    { name: 'Fajr', time: prayerTimes.fajr },
    { name: 'Sunrise', time: prayerTimes.sunrise },
    { name: 'Zuhr', time: prayerTimes.zuhr },
    { name: 'Asr', time: prayerTimes.asr },
    { name: 'Maghrib', time: prayerTimes.maghrib },
    { name: 'Isha', time: prayerTimes.isha },
  ];
  
  const currentHours = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();
  const currentTimeString = `${currentHours.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;
  
  // Find the next prayer
  for (const prayer of prayers) {
    if (prayer.time > currentTimeString) {
      return { name: prayer.name, time: prayer.time };
    }
  }
  
  // If no prayer is found, return Fajr for the next day
  return { name: 'Fajr (Tomorrow)', time: prayers[0].time };
};

// Calculate time until next prayer
export const getTimeUntilNextPrayer = (nextPrayerTime: string): string => {
  const now = new Date();
  const nextPrayer = parseTimeString(nextPrayerTime);
  
  // If next prayer is tomorrow's Fajr
  if (nextPrayer < now) {
    nextPrayer.setDate(nextPrayer.getDate() + 1);
  }
  
  const diffMilliseconds = nextPrayer.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMilliseconds / (1000 * 60));
  
  return formatMinutesToDisplay(diffMinutes);
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
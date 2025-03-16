import { useState, useEffect } from 'react';
import { PrayerTimes, PrayerStatus } from '../api/models';
import { useContent } from '../contexts/ContentContext';
import { 
  formatTimeToDisplay, 
  getNextPrayerTime, 
  getTimeUntilNextPrayer,
  getTimeDifferenceInMinutes
} from '../utils/dateUtils';

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
  const { prayerTimes, prayerStatus } = useContent();
  const [todaysPrayerTimes, setTodaysPrayerTimes] = useState<FormattedPrayerTime[]>([]);
  const [nextPrayer, setNextPrayer] = useState<FormattedPrayerTime | null>(null);
  const [currentPrayer, setCurrentPrayer] = useState<FormattedPrayerTime | null>(null);
  const [currentDate, setCurrentDate] = useState<string>('');
  const [hijriDate, setHijriDate] = useState<string | null>(null);
  const [isJumuahToday, setIsJumuahToday] = useState<boolean>(false);
  const [jumuahTime, setJumuahTime] = useState<string | null>(null);
  const [jumuahDisplayTime, setJumuahDisplayTime] = useState<string | null>(null);

  // Update current date
  useEffect(() => {
    const date = new Date();
    
    setCurrentDate(
      date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    );

    // Check if today is Friday (5)
    setIsJumuahToday(date.getDay() === 5);

    // Update every minute
    const timer = setInterval(() => {
      processPrayerTimes();
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  // Process prayer times when data changes
  useEffect(() => {
    processPrayerTimes();
  }, [prayerTimes, prayerStatus]);

  // Get and update Hijri date
  useEffect(() => {
    const fetchHijriDate = async () => {
      try {
        const response = await fetch(`https://api.aladhan.com/v1/gToH?date=${new Date().toISOString().split('T')[0]}`);
        const data = await response.json();
        
        if (data.code === 200 && data.data) {
          const hijri = data.data.hijri;
          setHijriDate(`${hijri.day} ${hijri.month.en} ${hijri.year} AH`);
        }
      } catch (error) {
        console.error('Error fetching Hijri date:', error);
      }
    };

    fetchHijriDate();
  }, []);

  const processPrayerTimes = () => {
    if (!prayerTimes) return;
    
    const now = new Date();
    const prayers: FormattedPrayerTime[] = [];
    
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Use prayer status if available
    let nextPrayerName = '';
    let currentPrayerName = '';
    
    if (prayerStatus) {
      nextPrayerName = prayerStatus.nextPrayer;
      currentPrayerName = prayerStatus.currentPrayer;
    } else {
      // Calculate next prayer if prayer status is not available
      // Create a record of prayer times for the getNextPrayerTime function
      const prayerRecord: Record<string, string> = {
        fajr: prayerTimes.fajr || '',
        sunrise: prayerTimes.sunrise || '',
        zuhr: prayerTimes.zuhr || '',
        asr: prayerTimes.asr || '',
        maghrib: prayerTimes.maghrib || '',
        isha: prayerTimes.isha || '',
      };
      
      const { name } = getNextPrayerTime(now, prayerRecord);
      nextPrayerName = name.toUpperCase();
    }
    
    // Process each prayer time
    PRAYER_NAMES.forEach((name, index) => {
      const lowerName = name.toLowerCase();
      const time = prayerTimes[lowerName as keyof PrayerTimes] as string;
      const jamaat = prayerTimes[`${lowerName}Jamaat` as keyof PrayerTimes] as string | undefined;
      
      const isNext = nextPrayerName === name.toUpperCase();
      const isCurrent = currentPrayerName === name.toUpperCase();
      
      // Calculate time until prayer
      let timeUntil = '';
      if (isNext) {
        timeUntil = getTimeUntilNextPrayer(time);
      }

      const prayer: FormattedPrayerTime = {
        name,
        time,
        jamaat,
        displayTime: formatTimeToDisplay(time),
        displayJamaat: jamaat ? formatTimeToDisplay(jamaat) : undefined,
        isNext,
        isCurrent,
        timeUntil,
      };

      prayers.push(prayer);
      
      if (isNext) {
        setNextPrayer(prayer);
      }
      
      if (isCurrent) {
        setCurrentPrayer(prayer);
      }
    });
    
    setTodaysPrayerTimes(prayers);
    
    // Set Jumuah time if it's Friday
    if (isJumuahToday && prayerTimes.jummahJamaat) {
      setJumuahTime(prayerTimes.jummahJamaat);
      setJumuahDisplayTime(formatTimeToDisplay(prayerTimes.jummahJamaat));
    }
  };

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
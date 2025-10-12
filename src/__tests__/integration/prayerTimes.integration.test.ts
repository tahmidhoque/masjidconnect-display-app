/**
 * Prayer Times Integration Tests
 * Tests prayer time calculations and formatting
 */

import {
  formatTimeToDisplay,
  parseTimeString,
  getTimeDifferenceInMinutes,
  formatMinutesToDisplay,
  getNextPrayerTime,
  getTimeUntilNextPrayer,
  calculateApproximateHijriDate,
  convertTo24Hour,
} from '../../utils/dateUtils';

describe('Prayer Times Integration Tests', () => {
  describe('Prayer Time Formatting', () => {
    it('should format complete prayer times correctly', () => {
      const prayerTimes = {
        fajr: '05:30',
        sunrise: '07:00',
        zuhr: '12:30',
        asr: '15:00',
        maghrib: '17:45',
        isha: '19:15',
      };

      Object.entries(prayerTimes).forEach(([prayer, time]) => {
        const formatted = formatTimeToDisplay(time);
        expect(formatted).toMatch(/\d{2}:\d{2}/);
      });
    });

    it('should handle 12-hour to 24-hour conversion', () => {
      const conversions = [
        { input: '6:00 AM', expected: '06:00' },
        { input: '12:00 PM', expected: '12:00' },
        { input: '6:00 PM', expected: '18:00' },
        { input: '11:59 PM', expected: '23:59' },
      ];

      conversions.forEach(({ input, expected }) => {
        const result = convertTo24Hour(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Next Prayer Calculation', () => {
    it('should calculate next prayer correctly during the day', () => {
      const prayerTimes = {
        fajr: '05:30',
        sunrise: '07:00',
        zuhr: '12:30',
        asr: '15:00',
        maghrib: '17:45',
        isha: '19:15',
      };

      // Test at different times of day
      const testTime = new Date();
      testTime.setHours(10, 0, 0, 0); // 10:00 AM

      const nextPrayer = getNextPrayerTime(testTime, prayerTimes);

      expect(nextPrayer.name).toBeTruthy();
      expect(nextPrayer.time).toBeTruthy();
    });

    it('should handle end of day (after Isha)', () => {
      const prayerTimes = {
        fajr: '05:30',
        sunrise: '07:00',
        zuhr: '12:30',
        asr: '15:00',
        maghrib: '17:45',
        isha: '19:15',
      };

      const testTime = new Date();
      testTime.setHours(23, 0, 0, 0); // 11:00 PM

      const nextPrayer = getNextPrayerTime(testTime, prayerTimes);

      // Should return Fajr for tomorrow
      expect(nextPrayer.name).toBe('Fajr');
    });
  });

  describe('Time Until Prayer', () => {
    it('should calculate time until prayer', () => {
      // Test with a prayer time 2 hours from now
      const now = new Date();
      const futureTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const timeString = `${futureTime.getHours().toString().padStart(2, '0')}:${futureTime.getMinutes().toString().padStart(2, '0')}`;

      const timeUntil = getTimeUntilNextPrayer(timeString);

      expect(timeUntil).toBeTruthy();
      expect(timeUntil).toContain('hr');
    });
  });

  describe('Time Differences', () => {
    it('should calculate duration between prayers', () => {
      const timeDiff = getTimeDifferenceInMinutes('12:00', '14:30');
      
      expect(timeDiff).toBe(150); // 2.5 hours = 150 minutes
    });

    it('should format minutes to readable format', () => {
      const testCases = [
        { minutes: 30, expected: '30 mins' },
        { minutes: 60, expected: '1 hr' },
        { minutes: 90, expected: '1 hr 30 mins' },
        { minutes: 120, expected: '2 hrs' },
      ];

      testCases.forEach(({ minutes, expected }) => {
        const result = formatMinutesToDisplay(minutes);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Hijri Date', () => {
    it('should calculate Hijri date for any Gregorian date', () => {
      const gregorianDate = new Date('2024-01-01');
      const hijriDate = calculateApproximateHijriDate(gregorianDate);

      expect(hijriDate).toBeTruthy();
      expect(hijriDate).toContain('AH');
      expect(hijriDate).toMatch(/\d+/); // Contains numbers
    });

    it('should calculate current Hijri date', () => {
      const hijriDate = calculateApproximateHijriDate();

      expect(hijriDate).toBeTruthy();
      expect(hijriDate).toContain('AH');
      
      // Should contain a valid Islamic month
      const islamicMonths = [
        'Muharram', 'Safar', 'Rabi Al-Awwal', 'Rabi Al-Thani',
        'Jumada Al-Awwal', 'Jumada Al-Thani', 'Rajab', "Sha'ban",
        'Ramadan', 'Shawwal', "Dhu Al-Qi'dah", 'Dhu Al-Hijjah'
      ];

      const hasValidMonth = islamicMonths.some(month => hijriDate.includes(month));
      expect(hasValidMonth).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle midnight transition', () => {
      const prayerTimes = {
        fajr: '05:30',
        sunrise: '07:00',
        zuhr: '12:30',
        asr: '15:00',
        maghrib: '17:45',
        isha: '19:15',
      };

      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);

      const nextPrayer = getNextPrayerTime(midnight, prayerTimes);

      expect(nextPrayer.name).toBe('Fajr');
    });

    it('should handle invalid time formats gracefully', () => {
      expect(formatTimeToDisplay('')).toBe('');
      expect(formatTimeToDisplay('invalid')).toBe('invalid');
    });
  });
});


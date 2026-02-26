// Import dayjs and plugins instead of moment
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat"; // For parsing specific formats like 'h:mm A'
import duration from "dayjs/plugin/duration"; // For diff calculations
import relativeTime from "dayjs/plugin/relativeTime"; // For human-readable durations
import { TimeFormat } from "../api/models";
import logger from "./logger";

dayjs.extend(customParseFormat);
dayjs.extend(duration);
dayjs.extend(relativeTime);

/**
 * Format a 24-hour time string to 12-hour format with AM/PM
 * 
 * @param timeString - Time in 24-hour format (e.g., "16:30")
 * @returns Time in 12-hour format (e.g., "4:30 PM")
 */
export const formatTimeTo12Hour = (timeString: string): string => {
  if (!timeString) return "";

  const [hours, minutes] = timeString.split(":").map(Number);

  if (isNaN(hours) || isNaN(minutes)) return timeString;

  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12; // Convert 0 to 12 for midnight, handle 12 for noon

  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
};

/**
 * Parts for rendering time with optional small AM/PM subtext (keeps numeric column aligned like 24h).
 *
 * @param timeString - Time in 24-hour format (e.g., "16:30")
 * @param format - Time format preference ('12h' or '24h')
 * @returns { main: "5:39" | "17:39", period: "pm" | "am" | null }
 */
export const getTimeDisplayParts = (
  timeString: string,
  format: TimeFormat,
): { main: string; period: string | null } => {
  if (!timeString) return { main: "", period: null };

  const [hours, minutes] = timeString.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return { main: timeString, period: null };

  if (format === "12h") {
    const period = hours >= 12 ? "pm" : "am";
    const displayHours = hours % 12 || 12;
    const main = `${displayHours}:${minutes.toString().padStart(2, "0")}`;
    return { main, period };
  }

  const main = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  return { main, period: null };
};

/**
 * Format time string to display format based on the specified format preference
 *
 * @param timeString - Time in 24-hour format (e.g., "16:30")
 * @param format - Time format preference ('12h' or '24h'), defaults to '12h'
 * @returns Formatted time string based on the format preference
 *
 * @example
 * formatTimeToDisplay("16:30", "24h") // Returns "16:30"
 * formatTimeToDisplay("16:30", "12h") // Returns "4:30 PM"
 */
export const formatTimeToDisplay = (
  timeString: string,
  format: TimeFormat = "12h",
): string => {
  if (!timeString) return "";

  const [hours, minutes] = timeString.split(":").map(Number);

  if (isNaN(hours) || isNaN(minutes)) return timeString;

  if (format === "12h") {
    return formatTimeTo12Hour(timeString);
  }

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

// Parse time string into Date object using dayjs
export const parseTimeString = (
  timeString: string,
  referenceDate: Date = new Date(),
): Date => {
  if (!timeString) return new Date();

  try {
    // Use dayjs
    const [hours, minutes] = timeString.split(":").map(Number);

    if (isNaN(hours) || isNaN(minutes)) return new Date();

    const timeDayjs = dayjs(referenceDate)
      .hour(hours)
      .minute(minutes)
      .second(0)
      .millisecond(0);

    return timeDayjs.toDate();
  } catch (error) {
    console.error("Error parsing time string:", error);
    return new Date();
  }
};

// Calculate time difference in minutes between two times using dayjs
export const getTimeDifferenceInMinutes = (
  time1: string,
  time2: string,
): number => {
  const dayjs1 = dayjs(parseTimeString(time1));
  const dayjs2 = dayjs(parseTimeString(time2));

  // Calculate the difference in minutes
  return dayjs2.diff(dayjs1, "minutes");
};

// Format minutes to hours and minutes display
export const formatMinutesToDisplay = (totalMinutes: number): string => {
  if (totalMinutes <= 0) return "0 mins";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} hr${hours > 1 ? "s" : ""} ${minutes} min${minutes > 1 ? "s" : ""}`;
  } else if (hours > 0) {
    return `${hours} hr${hours > 1 ? "s" : ""}`;
  } else {
    return `${minutes} min${minutes > 1 ? "s" : ""}`;
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
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Convert 12-hour time string to 24-hour time string using dayjs
export const convertTo24Hour = (timeString: string): string => {
  if (!timeString) return "";

  // Check if the time is already in 24-hour format
  if (!timeString.includes("AM") && !timeString.includes("PM")) {
    // Validate if it's potentially a 24h format before returning
    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeString)) {
      return timeString;
    }
    // Handle potentially invalid formats gracefully
    console.warn(
      `convertTo24Hour received potentially invalid time format: ${timeString}`,
    );
    return ""; // Or handle as appropriate
  }
  // Use dayjs for conversion, requires customParseFormat plugin
  const parsedTime = dayjs(timeString, "h:mm A");
  if (!parsedTime.isValid()) {
    console.warn(`convertTo24Hour failed to parse time: ${timeString}`);
    return ""; // Or handle invalid parse
  }
  return parsedTime.format("HH:mm");
};

// Calculate the next prayer time
export const getNextPrayerTime = (
  currentTime: Date,
  prayerTimes: Record<string, string>,
): { name: string; time: string } => {
  // Define prayers to skip in countdown
  const SKIP_PRAYERS = ["Sunrise"];

  // Create prayers array with all prayers
  const allPrayers = [
    { name: "Fajr", time: prayerTimes.fajr },
    { name: "Sunrise", time: prayerTimes.sunrise },
    { name: "Zuhr", time: prayerTimes.zuhr },
    { name: "Asr", time: prayerTimes.asr },
    { name: "Maghrib", time: prayerTimes.maghrib },
    { name: "Isha", time: prayerTimes.isha },
  ].filter((prayer) => prayer.time); // Only include prayers with valid times

  // Filter out prayers that should be skipped for the countdown
  const prayers = allPrayers.filter(
    (prayer) => !SKIP_PRAYERS.includes(prayer.name),
  );

  // Sort prayers by time
  prayers.sort((a, b) => a.time.localeCompare(b.time));

  const currentDayjs = dayjs(currentTime);
  const currentTimeString = currentDayjs.format("HH:mm");

  // Find the next prayer whose adhan hasn't passed yet
  for (const prayer of prayers) {
    if (prayer.time > currentTimeString) {
      return { name: prayer.name, time: prayer.time };
    }
  }

  // All prayers for today have passed — return first prayer for tomorrow
  if (prayers.length > 0) {
    return { name: prayers[0].name, time: prayers[0].time };
  }

  return { name: "", time: "" };
};

/** Options for countdown display. */
export interface GetTimeUntilNextPrayerOptions {
  /** When true, include seconds (e.g. 07h 05m 12s). Default false. */
  includeSeconds?: boolean;
  /** When set, include seconds only when remaining time is ≤ this many minutes (e.g. 5 for last 5 mins). */
  includeSecondsWhenUnderMinutes?: number;
}

/**
 * Calculate time until next prayer using dayjs.
 * Default (no options): always shows 2 units — hours+minutes when ≥1h, minutes+seconds when <1h.
 * Zero-padded for consistent width and alignment.
 */
export const getTimeUntilNextPrayer = (
  nextPrayerTime: string,
  forceTomorrow: boolean = false,
  options: GetTimeUntilNextPrayerOptions = {},
): string => {
  if (!nextPrayerTime) return "";

  const { includeSeconds = false, includeSecondsWhenUnderMinutes } = options;
  const hasExplicitOptions =
    includeSeconds || includeSecondsWhenUnderMinutes != null;

  try {
    const now = dayjs();

    const [prayerHours, prayerMinutes] = nextPrayerTime.split(":").map(Number);

    if (
      isNaN(prayerHours) ||
      isNaN(prayerMinutes) ||
      prayerHours < 0 ||
      prayerHours > 23 ||
      prayerMinutes < 0 ||
      prayerMinutes > 59
    ) {
      logger.error("[dateUtils] Invalid prayer time format", { nextPrayerTime });
      return "";
    }

    let prayerDayjs = dayjs()
      .hour(prayerHours)
      .minute(prayerMinutes)
      .second(0)
      .millisecond(0);

    if (prayerDayjs.isBefore(now) || forceTomorrow) {
      prayerDayjs = prayerDayjs.add(1, "day");
    }

    const diffSeconds = prayerDayjs.diff(now, "second");
    const diffHours = Math.floor(diffSeconds / 3600);
    const diffMinutes = Math.floor((diffSeconds % 3600) / 60);
    const diffSecondsRemainder = diffSeconds % 60;
    const pad2 = (n: number) => String(n).padStart(2, "0");

    if (diffSeconds <= 0) {
      if (!hasExplicitOptions) return "00m 00s";
      const showSeconds =
        includeSeconds ||
        (includeSecondsWhenUnderMinutes != null && diffSeconds <= includeSecondsWhenUnderMinutes * 60);
      return showSeconds ? "0s" : "0m";
    }

    /** Default: always 2 units — hours+minutes when ≥1h, minutes+seconds when <1h. */
    if (!hasExplicitOptions) {
      if (diffHours >= 1) {
        return `${pad2(diffHours)}h ${pad2(diffMinutes)}m`;
      }
      return `${pad2(diffMinutes)}m ${pad2(diffSecondsRemainder)}s`;
    }

    const showSeconds =
      includeSeconds ||
      (includeSecondsWhenUnderMinutes != null &&
        diffSeconds <= includeSecondsWhenUnderMinutes * 60);

    if (showSeconds) {
      if (diffHours > 0) {
        return `${pad2(diffHours)}h ${pad2(diffMinutes)}m ${pad2(diffSecondsRemainder)}s`;
      }
      return `${pad2(diffMinutes)}m ${pad2(diffSecondsRemainder)}s`;
    }

    if (diffHours > 0) {
      return `${pad2(diffHours)}h ${pad2(diffMinutes)}m`;
    }
    return `${pad2(diffMinutes)}m`;
  } catch (error) {
    logger.error("[dateUtils] Error calculating time until next prayer", {
      error: error instanceof Error ? error.message : String(error),
      nextPrayerTime,
    });
    return "";
  }
};

/**
 * Calculate accurate Hijri date using proper Islamic calendar algorithm
 * Based on the astronomical calculations and Julian Day Numbers
 */
export const calculateApproximateHijriDate = (date?: Date): string => {
  const targetDate = date || new Date();

  // Convert Gregorian date to Julian Day Number
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1; // JavaScript months are 0-based
  const day = targetDate.getDate();

  // Calculate Julian Day Number (JDN)
  const a = Math.floor((14 - month) / 12);
  const y = year - a;
  const m = month + 12 * a - 3;

  const jdn =
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) +
    1721119;

  // Convert Julian Day Number to Islamic Hijri date
  // The Islamic calendar epoch (1 Muharram 1 AH) corresponds to JDN 1948439.5
  // But we use 1948440 for integer calculations (July 16, 622 CE)
  const islamicEpoch = 1948440;

  // Calculate days since Islamic epoch
  const daysSinceEpoch = jdn - islamicEpoch;

  // Average length of Islamic year in days (354.36667 days)
  const averageIslamicYear = 354.36667;

  // Approximate Islamic year
  let islamicYear = Math.floor(daysSinceEpoch / averageIslamicYear) + 1;

  // Calculate the start of the Islamic year
  let yearStart =
    Math.floor((islamicYear - 1) * averageIslamicYear) + islamicEpoch;

  // Adjust if we're actually in the previous year
  if (jdn < yearStart) {
    islamicYear--;
    yearStart =
      Math.floor((islamicYear - 1) * averageIslamicYear) + islamicEpoch;
  }

  // Calculate day within the Islamic year
  const dayInYear = jdn - yearStart + 1;

  // Islamic months with their approximate lengths
  const islamicMonths = [
    { name: "Muharram", days: 30 },
    { name: "Safar", days: 29 },
    { name: "Rabi Al-Awwal", days: 30 },
    { name: "Rabi Al-Thani", days: 29 },
    { name: "Jumada Al-Awwal", days: 30 },
    { name: "Jumada Al-Thani", days: 29 },
    { name: "Rajab", days: 30 },
    { name: "Sha'ban", days: 29 },
    { name: "Ramadan", days: 30 },
    { name: "Shawwal", days: 29 },
    { name: "Dhu Al-Qi'dah", days: 30 },
    { name: "Dhu Al-Hijjah", days: 29 }, // 30 in leap years
  ];

  // Adjust Dhu Al-Hijjah for leap years (11 leap years in every 30-year cycle)
  const is30YearCycle = islamicYear % 30;
  const leapYears = [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29];
  if (leapYears.includes(is30YearCycle)) {
    islamicMonths[11].days = 30; // Dhu Al-Hijjah has 30 days in leap years
  }

  // Find the correct month and day
  let dayCount = 0;
  let islamicMonth = "Muharram";
  let islamicDay = 1;

  for (let i = 0; i < islamicMonths.length; i++) {
    const monthLength = islamicMonths[i].days;

    if (dayInYear <= dayCount + monthLength) {
      islamicMonth = islamicMonths[i].name;
      islamicDay = dayInYear - dayCount;
      break;
    }

    dayCount += monthLength;
  }

  // Handle edge cases where calculation might be off
  if (islamicDay <= 0) {
    islamicDay = 1;
  } else if (islamicDay > 30) {
    islamicDay = 30;
  }

  return `${islamicDay} ${islamicMonth} ${islamicYear} AH`;
};

/**
 * Fetch the Hijri date string, falling back to local calculation on error.
 */
export const fetchHijriDate = async (
  dateString?: string,
): Promise<string> => {
  const targetDate = dateString ? new Date(dateString) : new Date();

  try {
    return calculateApproximateHijriDate(targetDate);
  } catch {
    return calculateApproximateHijriDate(targetDate);
  }
};

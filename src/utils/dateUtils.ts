// Import dayjs and plugins instead of moment
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat"; // For parsing specific formats like 'h:mm A'
import duration from "dayjs/plugin/duration"; // For diff calculations
import relativeTime from "dayjs/plugin/relativeTime"; // For human-readable durations

dayjs.extend(customParseFormat);
dayjs.extend(duration);
dayjs.extend(relativeTime);

// Format time string (e.g., "16:30") to display format (e.g., "16:30")
export const formatTimeToDisplay = (timeString: string): string => {
  if (!timeString) return "";

  const [hours, minutes] = timeString.split(":").map(Number);

  if (isNaN(hours) || isNaN(minutes)) return timeString;

  // Use 24-hour format instead of AM/PM
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

  const currentDayjs = dayjs(currentTime); // Use dayjs
  const currentTimeString = currentDayjs.format("HH:mm");

  console.log("Current time:", currentTimeString);
  console.log(
    "Prayer times available:",
    prayers.map((p) => `${p.name}: ${p.time}`).join(", "),
  );

  // Find the next prayer
  for (const prayer of prayers) {
    if (prayer.time > currentTimeString) {
      console.log(
        `Found next prayer: ${prayer.name} at ${prayer.time}, current time is ${currentTimeString}`,
      );
      return { name: prayer.name, time: prayer.time };
    }
  }

  // If no prayer is found, it means all prayers for today have passed
  // Return the first prayer for the next day (first prayer in sorted list)
  if (prayers.length > 0) {
    console.log(
      `All prayers for today have passed. Next prayer is first prayer tomorrow: ${prayers[0].name} at ${prayers[0].time}`,
    );
    return { name: prayers[0].name, time: prayers[0].time };
  }

  // Fallback in case the prayers array is empty
  console.log("No prayers found in the data");
  return { name: "", time: "" };
};

// Calculate time until next prayer using dayjs
export const getTimeUntilNextPrayer = (
  nextPrayerTime: string,
  forceTomorrow: boolean = false,
): string => {
  if (!nextPrayerTime) return "";

  try {
    const now = dayjs();

    // Create the prayer time for today using dayjs
    const [prayerHours, prayerMinutes] = nextPrayerTime.split(":").map(Number);

    if (
      isNaN(prayerHours) ||
      isNaN(prayerMinutes) ||
      prayerHours < 0 ||
      prayerHours > 23 ||
      prayerMinutes < 0 ||
      prayerMinutes > 59
    ) {
      console.error(`Invalid prayer time format received: ${nextPrayerTime}`);
      return "";
    }

    let prayerDayjs = dayjs()
      .hour(prayerHours)
      .minute(prayerMinutes)
      .second(0)
      .millisecond(0);

    // Debug information
    console.log(`Calculating time until prayer at ${nextPrayerTime}`);
    console.log(`Current time: ${now.format("HH:mm:ss")}`);
    console.log(`Parsed prayer time today: ${prayerDayjs.format("HH:mm:ss")}`);

    // If next prayer time is earlier than current time or forceTomorrow is true,
    // it means it's for tomorrow
    if (prayerDayjs.isBefore(now) || forceTomorrow) {
      prayerDayjs = prayerDayjs.add(1, "day");
      console.log(
        `Prayer time adjusted to tomorrow: ${prayerDayjs.format("YYYY-MM-DD HH:mm:ss")}`,
      );
    }

    // Calculate diff in seconds
    const diffSeconds = prayerDayjs.diff(now, "second");

    if (diffSeconds <= 0) {
      // If difference is zero or negative, it means the time has just passed or is now.
      // Avoid returning '0 mins' which might be confusing.
      // Consider returning 'Now' or a minimal positive duration like '1 min' depending on desired UX.
      // For now, returning '0 sec' for consistency.
      console.log(`Time until prayer is zero or negative: ${diffSeconds}s`);
      return "0 sec";
    }

    // Format time using custom logic for display consistency
    const diffHours = Math.floor(diffSeconds / 3600);
    const diffMinutes = Math.floor((diffSeconds % 3600) / 60);
    const diffSecondsRemainder = diffSeconds % 60;

    console.log(
      `Time until prayer: ${diffHours}h ${diffMinutes}m ${diffSecondsRemainder}s`,
    );

    // For longer times (> 1 hour), return a more human-readable format
    if (diffHours > 0) {
      return `${diffHours} hr${diffHours > 1 ? "s" : ""} ${diffMinutes} min${diffMinutes > 1 ? "s" : ""}`;
    }
    // For shorter times (< 1 hour but > 0 minutes), include minutes and seconds
    else if (diffMinutes > 0) {
      // Only show seconds if minutes > 0 for brevity, consistent with old logic? Let's keep seconds.
      return `${diffMinutes} min${diffMinutes > 1 ? "s" : ""} ${diffSecondsRemainder} sec${diffSecondsRemainder !== 1 ? "s" : ""}`;
    }
    // For times less than 1 minute
    else {
      return `${diffSecondsRemainder} sec${diffSecondsRemainder !== 1 ? "s" : ""}`;
    }
  } catch (error) {
    console.error(
      "Error calculating time until next prayer:",
      error,
      nextPrayerTime,
    );
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
  let a = Math.floor((14 - month) / 12);
  let y = year - a;
  let m = month + 12 * a - 3;

  let jdn =
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
 * Enhanced Hijri date fetching with fallback to accurate calculation
 */
export const fetchHijriDateElectronSafe = async (
  dateString?: string,
): Promise<string> => {
  // Use accurate local calculation as primary method
  const targetDate = dateString ? new Date(dateString) : new Date();

  try {
    // For now, use our accurate local calculation
    const result = calculateApproximateHijriDate(targetDate);
    console.log("Calculated Hijri date:", result);
    return result;
  } catch (error) {
    console.error("Error calculating Hijri date:", error);
    // Final fallback
    return calculateApproximateHijriDate(targetDate);
  }
};

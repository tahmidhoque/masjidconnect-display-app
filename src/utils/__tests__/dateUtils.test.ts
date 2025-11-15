/**
 * Tests for dateUtils
 */

import {
  formatTimeToDisplay,
  parseTimeString,
  getTimeDifferenceInMinutes,
  formatMinutesToDisplay,
  isToday,
  convertTo24Hour,
  calculateApproximateHijriDate,
} from "../dateUtils";

describe("dateUtils", () => {
  describe("formatTimeToDisplay", () => {
    it("should format time correctly", () => {
      expect(formatTimeToDisplay("16:30")).toBe("16:30");
      expect(formatTimeToDisplay("09:05")).toBe("09:05");
      expect(formatTimeToDisplay("5:30")).toBe("05:30");
    });

    it("should handle invalid input", () => {
      expect(formatTimeToDisplay("")).toBe("");
      expect(formatTimeToDisplay("invalid")).toBe("invalid");
    });
  });

  describe("parseTimeString", () => {
    it("should parse time string into Date", () => {
      const result = parseTimeString("14:30");

      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });

    it("should use reference date", () => {
      const refDate = new Date("2024-01-15");
      const result = parseTimeString("10:00", refDate);

      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getHours()).toBe(10);
    });

    it("should handle invalid time string", () => {
      const result = parseTimeString("invalid");
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe("getTimeDifferenceInMinutes", () => {
    it("should calculate time difference", () => {
      const diff = getTimeDifferenceInMinutes("10:00", "11:30");
      expect(diff).toBe(90);
    });

    it("should handle negative differences", () => {
      const diff = getTimeDifferenceInMinutes("15:00", "14:00");
      expect(diff).toBeLessThan(0);
    });
  });

  describe("formatMinutesToDisplay", () => {
    it("should format zero minutes", () => {
      expect(formatMinutesToDisplay(0)).toBe("0 mins");
      expect(formatMinutesToDisplay(-5)).toBe("0 mins");
    });

    it("should format minutes only", () => {
      expect(formatMinutesToDisplay(30)).toBe("30 mins");
      expect(formatMinutesToDisplay(1)).toBe("1 min");
    });

    it("should format hours only", () => {
      expect(formatMinutesToDisplay(60)).toBe("1 hr");
      expect(formatMinutesToDisplay(120)).toBe("2 hrs");
    });

    it("should format hours and minutes", () => {
      expect(formatMinutesToDisplay(90)).toBe("1 hr 30 mins");
      expect(formatMinutesToDisplay(150)).toBe("2 hrs 30 mins");
      expect(formatMinutesToDisplay(61)).toBe("1 hr 1 min");
    });
  });

  describe("isToday", () => {
    it("should identify today", () => {
      const today = new Date();
      expect(isToday(today)).toBe(true);
    });

    it("should identify yesterday", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(isToday(yesterday)).toBe(false);
    });

    it("should identify tomorrow", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(isToday(tomorrow)).toBe(false);
    });
  });

  describe("convertTo24Hour", () => {
    it("should convert 12-hour format to 24-hour", () => {
      expect(convertTo24Hour("1:00 PM")).toBe("13:00");
      expect(convertTo24Hour("12:00 PM")).toBe("12:00");
      expect(convertTo24Hour("12:00 AM")).toBe("00:00");
      expect(convertTo24Hour("11:30 PM")).toBe("23:30");
    });

    it("should handle already 24-hour format", () => {
      expect(convertTo24Hour("14:30")).toBe("14:30");
      expect(convertTo24Hour("09:00")).toBe("09:00");
    });

    it("should handle invalid format", () => {
      expect(convertTo24Hour("invalid")).toBe("");
      expect(convertTo24Hour("")).toBe("");
    });
  });

  describe("calculateApproximateHijriDate", () => {
    it("should calculate Hijri date", () => {
      const result = calculateApproximateHijriDate(new Date("2024-01-15"));

      expect(result).toMatch(/\d+ .+ \d+ AH/);
      expect(result).toContain("AH");
    });

    it("should handle current date", () => {
      const result = calculateApproximateHijriDate();

      expect(result).toMatch(/\d+ .+ \d+ AH/);
      expect(result).toContain("AH");
    });

    it("should calculate correct month names", () => {
      const result = calculateApproximateHijriDate(new Date("2024-07-01"));

      const validMonths = [
        "Muharram",
        "Safar",
        "Rabi Al-Awwal",
        "Rabi Al-Thani",
        "Jumada Al-Awwal",
        "Jumada Al-Thani",
        "Rajab",
        "Sha'ban",
        "Ramadan",
        "Shawwal",
        "Dhu Al-Qi'dah",
        "Dhu Al-Hijjah",
      ];

      const hasValidMonth = validMonths.some((month) => result.includes(month));
      expect(hasValidMonth).toBe(true);
    });
  });
});

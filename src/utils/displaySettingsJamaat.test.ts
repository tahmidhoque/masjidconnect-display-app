/**
 * Unit tests for displaySettings jamaat timing helpers.
 */

import { describe, it, expect } from "vitest";
import type { DisplaySettings } from "@/api/models";
import {
  jamaatPhaseMinutesForSalah,
  prayerNameToSalahKey,
  postJamaatDelayMinutes,
  totalJamaatPhaseWindowForDisplayPrayer,
  jamaatPhaseMinutesForDisplayPrayer,
} from "./displaySettingsJamaat";

const baseSettings = (): DisplaySettings => ({
  ramadanMode: "auto",
  isRamadanActive: false,
  timeFormat: "12h",
  showImsak: false,
  showTomorrowJamaat: false,
  imsakOffset: 10,
  hijriDateAdjustment: 0,
  minutesAfterJamaatUntilNextPrayer: 10,
  defaultJamaatInProgressMinutes: 10,
  minutesAfterJamaatUntilNextPrayerBySalah: {},
});

describe("prayerNameToSalahKey", () => {
  it("maps display names to salah keys", () => {
    expect(prayerNameToSalahKey("Fajr")).toBe("fajr");
    expect(prayerNameToSalahKey("Zuhr")).toBe("zuhr");
    expect(prayerNameToSalahKey("Jumuah")).toBe("zuhr");
    expect(prayerNameToSalahKey("Asr")).toBe("asr");
    expect(prayerNameToSalahKey("Maghrib")).toBe("maghrib");
    expect(prayerNameToSalahKey("Isha")).toBe("isha");
  });

  it("returns null for unknown prayers", () => {
    expect(prayerNameToSalahKey("Sunrise")).toBeNull();
    expect(prayerNameToSalahKey("")).toBeNull();
  });
});

describe("jamaatPhaseMinutesForSalah", () => {
  it("uses per-salah override when set", () => {
    const s = {
      ...baseSettings(),
      defaultJamaatInProgressMinutes: 10,
      minutesAfterJamaatUntilNextPrayerBySalah: { maghrib: 8 },
    };
    expect(jamaatPhaseMinutesForSalah(s, "maghrib")).toBe(8);
    expect(jamaatPhaseMinutesForSalah(s, "fajr")).toBe(10);
  });

  it("falls back to default when override is NaN", () => {
    const s = {
      ...baseSettings(),
      defaultJamaatInProgressMinutes: 12,
      minutesAfterJamaatUntilNextPrayerBySalah: {
        zuhr: Number.NaN,
      },
    };
    expect(jamaatPhaseMinutesForSalah(s, "zuhr")).toBe(12);
  });

  it("uses 10 when settings are null", () => {
    expect(jamaatPhaseMinutesForSalah(null, "isha")).toBe(10);
  });
});

describe("postJamaatDelayMinutes", () => {
  it("returns clamped B from settings", () => {
    expect(postJamaatDelayMinutes({ ...baseSettings(), minutesAfterJamaatUntilNextPrayer: 15 })).toBe(
      15,
    );
    expect(postJamaatDelayMinutes(null)).toBe(10);
  });
});

describe("jamaatPhaseMinutesForDisplayPrayer", () => {
  it("uses default only for unmapped names", () => {
    const s = { ...baseSettings(), defaultJamaatInProgressMinutes: 14 };
    expect(jamaatPhaseMinutesForDisplayPrayer(s, "Sunrise")).toBe(14);
  });
});

describe("totalJamaatPhaseWindowForDisplayPrayer", () => {
  it("sums A and B for the prayer", () => {
    const s = {
      ...baseSettings(),
      defaultJamaatInProgressMinutes: 8,
      minutesAfterJamaatUntilNextPrayer: 12,
      minutesAfterJamaatUntilNextPrayerBySalah: { asr: 20 },
    };
    expect(totalJamaatPhaseWindowForDisplayPrayer(s, "Asr")).toBe(32);
    expect(totalJamaatPhaseWindowForDisplayPrayer(s, "Fajr")).toBe(20);
  });
});

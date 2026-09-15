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
  preJamaatLeadMinutes,
  DEFAULT_JAMAAT_LEAD_MIN,
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
    expect(prayerNameToSalahKey("Jumuah")).toBe("jumuah");
    expect(prayerNameToSalahKey("Jummah")).toBe("jumuah");
    expect(prayerNameToSalahKey("Jumu'ah")).toBe("jumuah");
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

  it("uses the jumuah key when present", () => {
    const s = {
      ...baseSettings(),
      defaultJamaatInProgressMinutes: 10,
      minutesAfterJamaatUntilNextPrayerBySalah: { zuhr: 5, jumuah: 22 },
    };
    expect(jamaatPhaseMinutesForSalah(s, "jumuah")).toBe(22);
    expect(jamaatPhaseMinutesForSalah(s, "zuhr")).toBe(5);
  });

  it("falls back from jumuah to zuhr when the Friday key is absent", () => {
    const s = {
      ...baseSettings(),
      defaultJamaatInProgressMinutes: 14,
      minutesAfterJamaatUntilNextPrayerBySalah: { zuhr: 8 },
    };
    expect(jamaatPhaseMinutesForSalah(s, "jumuah")).toBe(8);
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

  it("applies jumuah override for Friday Zuhr and Jumuah labels", () => {
    const s = {
      ...baseSettings(),
      defaultJamaatInProgressMinutes: 10,
      minutesAfterJamaatUntilNextPrayerBySalah: { zuhr: 6, jumuah: 18 },
    };
    expect(jamaatPhaseMinutesForDisplayPrayer(s, "Zuhr")).toBe(6);
    expect(jamaatPhaseMinutesForDisplayPrayer(s, "Zuhr", { isJumuah: true })).toBe(18);
    expect(jamaatPhaseMinutesForDisplayPrayer(s, "Jumuah")).toBe(18);
  });

  it("falls back to zuhr for Friday when jumuah key is missing", () => {
    const s = {
      ...baseSettings(),
      defaultJamaatInProgressMinutes: 10,
      minutesAfterJamaatUntilNextPrayerBySalah: { zuhr: 7 },
    };
    expect(jamaatPhaseMinutesForDisplayPrayer(s, "Jumuah")).toBe(7);
    expect(jamaatPhaseMinutesForDisplayPrayer(s, "Zuhr", { isJumuah: true })).toBe(7);
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

  it("includes post-jamaat supplication duration when enabled", () => {
    const s = {
      ...baseSettings(),
      defaultJamaatInProgressMinutes: 10,
      minutesAfterJamaatUntilNextPrayer: 10,
      postJamaatSupplication: { enabled: true, durationMinutes: 5 },
    };
    expect(totalJamaatPhaseWindowForDisplayPrayer(s, "Fajr")).toBe(25);
  });
});

describe("preJamaatLeadMinutes", () => {
  it("uses the 5-minute legacy lead when Portal settings are absent", () => {
    expect(preJamaatLeadMinutes(null)).toBe(DEFAULT_JAMAAT_LEAD_MIN);
    expect(preJamaatLeadMinutes(baseSettings())).toBe(5);
  });

  it("returns 0 when the Portal flag is disabled", () => {
    expect(
      preJamaatLeadMinutes({
        ...baseSettings(),
        preJamaatCountdownEnabled: false,
        preJamaatCountdownSeconds: 120,
      }),
    ).toBe(0);
  });

  it("converts Portal seconds to fractional minutes when enabled", () => {
    expect(
      preJamaatLeadMinutes({
        ...baseSettings(),
        preJamaatCountdownEnabled: true,
        preJamaatCountdownSeconds: 30,
      }),
    ).toBe(0.5);
    expect(
      preJamaatLeadMinutes({
        ...baseSettings(),
        preJamaatCountdownEnabled: true,
        preJamaatCountdownSeconds: 60,
      }),
    ).toBe(1);
    expect(
      preJamaatLeadMinutes({
        ...baseSettings(),
        preJamaatCountdownEnabled: true,
        preJamaatCountdownSeconds: 90,
      }),
    ).toBe(1.5);
    expect(
      preJamaatLeadMinutes({
        ...baseSettings(),
        preJamaatCountdownEnabled: true,
        preJamaatCountdownSeconds: 120,
      }),
    ).toBe(2);
  });

  it("defaults to 60 seconds when enabled but duration is missing", () => {
    expect(
      preJamaatLeadMinutes({
        ...baseSettings(),
        preJamaatCountdownEnabled: true,
      }),
    ).toBe(1);
  });
});

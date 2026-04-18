/**
 * Friday Jumu'ah jamaat substitution helpers.
 *
 * The API exposes `zuhrJamaat` and `jummahJamaat` independently. The display
 * keeps the Zuhr row in `PrayerTimesPanel` anchored to `zuhrJamaat` (with
 * `JumuahBar` surfacing the Friday time separately), but the live COUNTDOWN
 * and the IN-PRAYER phase must target `jummahJamaat` on Fridays so the
 * congregation sees "Jumu'ah Jamaat in 12m 34s" / "Jumu'ah Jamaat in progress"
 * rather than counting against the regular Zuhr time.
 *
 * This module is the single source of truth for that substitution so the
 * countdown component, phase hook, and any future consumer stay in lockstep.
 */
interface PrayerWithJamaat {
  name: string;
  jamaat?: string;
}

/**
 * Resolve the jamaat time that the live UI (countdown + phase machine) should
 * actually target for the given prayer, applying the Friday Zuhr → Jumu'ah
 * substitution when the API has supplied a separate `jummahJamaat`.
 *
 * Returns `prayer.jamaat` for every other case, including:
 *   - non-Friday days,
 *   - non-Zuhr prayers (Asr, Maghrib, Isha, Fajr),
 *   - Fridays where `jummahJamaat` is missing from the payload (we fall back
 *     to the regular Zuhr jamaat rather than blank the countdown).
 */
export function getEffectiveJamaat(
  prayer: PrayerWithJamaat | null | undefined,
  isJumuahToday: boolean,
  jumuahTime: string | null | undefined,
): string | undefined {
  if (!prayer) return undefined;
  if (isJumuahToday && prayer.name === 'Zuhr' && jumuahTime) {
    return jumuahTime;
  }
  return prayer.jamaat;
}

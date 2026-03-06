/**
 * Client-side scheduled playlist resolution.
 *
 * Resolves the active schedule from scheduledPlaylists assignments based on
 * current time and timezone. Supports DATE_RANGE, RECURRING (including
 * cross-midnight windows), and DEFAULT assignment types.
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';
import type { ScheduledPlaylistAssignment } from '@/api/models';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

const DEFAULT_TZ = 'UTC';

/**
 * Format the given date in the specified timezone as "HH:mm".
 */
function formatTimeInTz(date: Date, tz: string): string {
  return dayjs(date).tz(tz || DEFAULT_TZ).format('HH:mm');
}

/**
 * Normalise a time string to "HH:mm" for consistent comparison.
 * Handles "9:00", "09:00", "9:30" etc. from APIs that omit leading zeros.
 */
function normaliseTimeString(t: string | null): string | null {
  if (!t || typeof t !== 'string') return null;
  const parts = t.trim().split(':');
  const h = Math.max(0, Math.min(23, parseInt(parts[0] || '0', 10)));
  const m = Math.max(0, Math.min(59, parseInt(parts[1] || '0', 10)));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Get the day of week in the given timezone.
 * Returns ISO weekday (1 = Monday, 7 = Sunday) to match common API conventions.
 */
function getDayOfWeekInTz(date: Date, tz: string): number {
  return dayjs(date).tz(tz || DEFAULT_TZ).isoWeekday();
}

/**
 * Check if the current time is within a RECURRING time window.
 * Handles cross-midnight (e.g. 22:00–02:00).
 * Normalises time strings so "9:00" and "09:00" compare correctly.
 * API sends startTime/endTime in UTC; compare against current time in UTC.
 */
function isWithinTimeWindow(
  now: Date,
  startTime: string | null,
  endTime: string | null,
  _timezoneStr: string
): boolean {
  const start = normaliseTimeString(startTime);
  const end = normaliseTimeString(endTime);
  if (!start || !end) return true; // all-day
  const t = formatTimeInTz(now, 'UTC');
  if (start <= end) {
    return t >= start && t < end;
  }
  // Cross-midnight: e.g. 22:00–02:00
  return t >= start || t < end;
}

/**
 * For cross-midnight windows: when currentTime < endTime, the match belongs
 * to the previous calendar day for daysOfWeek. Return the day to check.
 */
function getEffectiveDayForRecurring(
  now: Date,
  startTime: string | null,
  endTime: string | null,
  timezoneStr: string
): number {
  if (!startTime || !endTime) {
    return getDayOfWeekInTz(now, timezoneStr);
  }
  const start = normaliseTimeString(startTime);
  const end = normaliseTimeString(endTime);
  if (!start || !end) return getDayOfWeekInTz(now, timezoneStr);
  const t = formatTimeInTz(now, 'UTC');
  if (start <= end) {
    return getDayOfWeekInTz(now, timezoneStr);
  }
  // Cross-midnight: if we're in the "after midnight" part (t < end) in UTC,
  // use previous UTC day for daysOfWeek
  if (t < end) {
    const prevDay = dayjs(now).utc().subtract(1, 'day');
    return prevDay.isoWeekday(); // Previous UTC day for cross-midnight in UTC
  }
  return getDayOfWeekInTz(now, timezoneStr);
}

/**
 * Check if a date string includes a time component (ISO datetime vs date-only).
 */
function hasTimeComponent(dateStr: string): boolean {
  return dateStr.includes('T') && /T\d/.test(dateStr);
}

/**
 * Check if now is within a DATE_RANGE assignment.
 * Supports both date-only (YYYY-MM-DD) and datetime (ISO with T) formats.
 * Date-only: full calendar day range. Datetime: exact start/end timestamps.
 */
function isWithinDateRange(
  now: Date,
  startDate: string | null,
  endDate: string | null,
  timezoneStr: string
): boolean {
  if (!startDate || !endDate) return false;
  const tz = timezoneStr || DEFAULT_TZ;
  const d = dayjs(now).tz(tz);

  if (hasTimeComponent(startDate) || hasTimeComponent(endDate)) {
    // Datetime: treat as exact timestamps (API sends ISO with time)
    const startParsed = dayjs(startDate).tz(tz);
    const endParsed = dayjs(endDate).tz(tz);
    return (d.isSame(startParsed) || d.isAfter(startParsed)) && (d.isSame(endParsed) || d.isBefore(endParsed));
  }

  // Date-only: full calendar day range
  const startOfDay = dayjs.tz(startDate, tz).startOf('day');
  const endOfDay = dayjs.tz(endDate, tz).endOf('day');
  return (d.isSame(startOfDay) || d.isAfter(startOfDay)) && (d.isSame(endOfDay) || d.isBefore(endOfDay));
}

/**
 * Check if a RECURRING assignment matches the current time.
 * Supports both daysOfWeek conventions: 0-6 (Sun-Sat) and 1-7 (ISO Mon-Sun).
 */
function matchesRecurring(
  now: Date,
  assignment: ScheduledPlaylistAssignment,
  timezoneStr: string
): boolean {
  const effectiveDayISO = getEffectiveDayForRecurring(
    now,
    assignment.startTime,
    assignment.endTime,
    timezoneStr
  );
  // Convert ISO (1-7) to JS (0-6) for API compatibility: ISO 7=Sun -> JS 0
  const effectiveDayJS = effectiveDayISO === 7 ? 0 : effectiveDayISO;
  // 1=Sunday convention (Sun=1, Mon=2, ..., Sat=7) used by some admin UIs
  const effectiveDay1BasedSun = effectiveDayISO === 7 ? 1 : effectiveDayISO + 1;
  const daysOfWeek = assignment.daysOfWeek ?? [];
  const dayMatches =
    daysOfWeek.length > 0 &&
    (daysOfWeek.includes(effectiveDayISO) ||
      daysOfWeek.includes(effectiveDayJS) ||
      daysOfWeek.includes(effectiveDay1BasedSun));
  if (!dayMatches) return false;
  return isWithinTimeWindow(
    now,
    assignment.startTime,
    assignment.endTime,
    timezoneStr
  );
}

/**
 * Resolve the active schedule assignment from scheduled playlist assignments.
 *
 * Priority: DATE_RANGE (by priority desc) > RECURRING (by priority desc) > DEFAULT.
 *
 * @param scheduledPlaylists - Array of playlist assignments from the API
 * @param now - Current time
 * @param timezoneStr - Masjid timezone (e.g. "Europe/London")
 * @returns The active assignment (with schedule and assignmentId), or null if none matches
 */
export function resolveActiveSchedule(
  scheduledPlaylists: ScheduledPlaylistAssignment[],
  now: Date,
  timezoneStr: string
): ScheduledPlaylistAssignment | null {
  const active = scheduledPlaylists.filter((a) => a.isActive);
  if (active.length === 0) return null;

  const tz = timezoneStr || DEFAULT_TZ;

  // DATE_RANGE: sort by priority desc, pick first match
  const dateRange = active
    .filter((a) => a.type === 'DATE_RANGE')
    .sort((a, b) => b.priority - a.priority);
  for (const a of dateRange) {
    if (isWithinDateRange(now, a.startDate, a.endDate, tz)) return a;
  }

  // RECURRING: sort by priority desc, pick first match
  const recurring = active
    .filter((a) => a.type === 'RECURRING')
    .sort((a, b) => b.priority - a.priority);
  for (const a of recurring) {
    if (matchesRecurring(now, a, tz)) return a;
  }

  // DEFAULT fallback
  const def = active.find((a) => a.type === 'DEFAULT');
  return def ?? null;
}

/**
 * Compute the next schedule boundary (nearest startTime/endTime/startDate/endDate).
 * Used to schedule a timer for re-evaluation.
 *
 * @param scheduledPlaylists - Array of playlist assignments
 * @param now - Current time
 * @param timezoneStr - Masjid timezone
 * @returns The Date of the next boundary, or null if none can be determined
 */
export function getNextBoundary(
  scheduledPlaylists: ScheduledPlaylistAssignment[],
  now: Date,
  timezoneStr: string
): Date | null {
  const active = scheduledPlaylists.filter((a) => a.isActive);
  if (active.length === 0) return null;

  const tz = timezoneStr || DEFAULT_TZ;
  const nowD = dayjs(now).tz(tz);
  const nowMs = now.getTime();
  let nearest: number | null = null;

  for (const a of active) {
    if (a.type === 'DATE_RANGE') {
      if (a.startDate) {
        const d = hasTimeComponent(a.startDate)
          ? dayjs(a.startDate).tz(tz).toDate().getTime()
          : dayjs.tz(a.startDate, tz).startOf('day').toDate().getTime();
        if (d > nowMs && (nearest === null || d < nearest)) nearest = d;
      }
      if (a.endDate) {
        const d = hasTimeComponent(a.endDate)
          ? dayjs(a.endDate).tz(tz).toDate().getTime()
          : dayjs.tz(a.endDate, tz).add(1, 'day').startOf('day').toDate().getTime();
        if (d > nowMs && (nearest === null || d < nearest)) nearest = d;
      }
    } else if (a.type === 'RECURRING' && a.startTime && a.endTime) {
      const startNorm = normaliseTimeString(a.startTime);
      const endNorm = normaliseTimeString(a.endTime);
      if (!startNorm || !endNorm) continue;
      const [sh, sm] = startNorm.split(':').map(Number);
      const [eh, em] = endNorm.split(':').map(Number);
      const isCrossMidnight = startNorm > endNorm;
      // API sends startTime/endTime in UTC; build boundaries in UTC to match isWithinTimeWindow
      const nowUtc = dayjs(now).utc();
      for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
        const dayStart = nowUtc.add(dayOffset, 'day');
        const startAt = dayStart.hour(sh).minute(sm).second(0).millisecond(0).toDate().getTime();
        const endAt = dayStart.hour(eh).minute(em).second(0).millisecond(0).toDate().getTime();
        if (isCrossMidnight) {
          const endNext = nowUtc.add(dayOffset + 1, 'day').hour(eh).minute(em).second(0).millisecond(0).toDate().getTime();
          if (endAt > nowMs && (nearest === null || endAt < nearest)) nearest = endAt;
          if (endNext > nowMs && (nearest === null || endNext < nearest)) nearest = endNext;
        }
        if (startAt > nowMs && (nearest === null || startAt < nearest)) nearest = startAt;
        if (endAt > nowMs && !isCrossMidnight && (nearest === null || endAt < nearest)) nearest = endAt;
      }
    } else if (a.type === 'RECURRING' && (!a.startTime || !a.endTime)) {
      const nextMidnight = nowD.add(1, 'day').startOf('day').toDate().getTime();
      if (nextMidnight > nowMs && (nearest === null || nextMidnight < nearest)) nearest = nextMidnight;
    }
  }

  return nearest !== null ? new Date(nearest) : null;
}

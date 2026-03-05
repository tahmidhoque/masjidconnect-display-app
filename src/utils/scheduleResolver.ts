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
import type { ScheduledPlaylistAssignment } from '@/api/models';

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_TZ = 'UTC';

/**
 * Format the given date in the specified timezone as "HH:mm".
 */
function formatTimeInTz(date: Date, tz: string): string {
  return dayjs(date).tz(tz || DEFAULT_TZ).format('HH:mm');
}

/**
 * Get the day of week in the given timezone (0 = Sunday, 6 = Saturday).
 */
function getDayOfWeekInTz(date: Date, tz: string): number {
  return dayjs(date).tz(tz || DEFAULT_TZ).day();
}

/**
 * Check if the current time is within a RECURRING time window.
 * Handles cross-midnight (e.g. 22:00–02:00).
 */
function isWithinTimeWindow(
  now: Date,
  startTime: string | null,
  endTime: string | null,
  timezoneStr: string
): boolean {
  if (!startTime || !endTime) return true; // all-day
  const t = formatTimeInTz(now, timezoneStr);
  if (startTime <= endTime) {
    return t >= startTime && t < endTime;
  }
  // Cross-midnight: e.g. 22:00–02:00
  return t >= startTime || t < endTime;
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
  const t = formatTimeInTz(now, timezoneStr);
  if (startTime <= endTime) {
    return getDayOfWeekInTz(now, timezoneStr);
  }
  // Cross-midnight: if we're in the "after midnight" part (t < endTime),
  // use previous day for daysOfWeek
  if (t < endTime) {
    const prevDay = dayjs(now).tz(timezoneStr || DEFAULT_TZ).subtract(1, 'day');
    return prevDay.day();
  }
  return getDayOfWeekInTz(now, timezoneStr);
}

/**
 * Check if now is within a DATE_RANGE assignment.
 * Parses dates in the target zone and includes the full end date (entire day).
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
  const startOfDay = dayjs.tz(startDate, tz).startOf('day');
  const endOfDay = dayjs.tz(endDate, tz).endOf('day');
  return (d.isSame(startOfDay) || d.isAfter(startOfDay)) && (d.isSame(endOfDay) || d.isBefore(endOfDay));
}

/**
 * Check if a RECURRING assignment matches the current time.
 */
function matchesRecurring(
  now: Date,
  assignment: ScheduledPlaylistAssignment,
  timezoneStr: string
): boolean {
  const effectiveDay = getEffectiveDayForRecurring(
    now,
    assignment.startTime,
    assignment.endTime,
    timezoneStr
  );
  if (!assignment.daysOfWeek?.includes(effectiveDay)) return false;
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
    if (isWithinDateRange(now, a.startDate, a.endDate, tz)) {
      return a;
    }
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
        const d = dayjs(a.startDate).tz(tz).toDate().getTime();
        if (d > nowMs && (nearest === null || d < nearest)) nearest = d;
      }
      if (a.endDate) {
        const d = dayjs(a.endDate).tz(tz).toDate().getTime();
        if (d > nowMs && (nearest === null || d < nearest)) nearest = d;
      }
    } else if (a.type === 'RECURRING' && a.startTime && a.endTime) {
      const [sh, sm] = a.startTime.split(':').map(Number);
      const [eh, em] = a.endTime.split(':').map(Number);
      for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
        const dayStart = nowD.add(dayOffset, 'day');
        const startAt = dayStart.hour(sh).minute(sm).second(0).millisecond(0).toDate().getTime();
        const endAt = dayStart.hour(eh).minute(em).second(0).millisecond(0).toDate().getTime();
        if (a.startTime > a.endTime) {
          const endNext = nowD.add(dayOffset + 1, 'day').hour(eh).minute(em).second(0).millisecond(0).toDate().getTime();
          if (endAt > nowMs && (nearest === null || endAt < nearest)) nearest = endAt;
          if (endNext > nowMs && (nearest === null || endNext < nearest)) nearest = endNext;
        }
        if (startAt > nowMs && (nearest === null || startAt < nearest)) nearest = startAt;
        if (endAt > nowMs && a.startTime <= a.endTime && (nearest === null || endAt < nearest)) nearest = endAt;
      }
    } else if (a.type === 'RECURRING' && (!a.startTime || !a.endTime)) {
      const nextMidnight = nowD.add(1, 'day').startOf('day').toDate().getTime();
      if (nextMidnight > nowMs && (nearest === null || nextMidnight < nearest)) nearest = nextMidnight;
    }
  }

  return nearest !== null ? new Date(nearest) : null;
}

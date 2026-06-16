/**
 * Prayer-relative playlist window resolution for the display app.
 * Mirrors packages/shared/src/lib/prayer-window-schedule.ts in the backend monorepo.
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type { PrayerTimes, PrayerBoundaryPrayer, PrayerTimeAnchor } from '@/api/models';

dayjs.extend(utc);
dayjs.extend(timezone);

export type { PrayerBoundaryPrayer, PrayerTimeAnchor };

export interface PrayerWindowFields {
  startPrayer: PrayerBoundaryPrayer;
  endPrayer: PrayerBoundaryPrayer;
  startPrayerAnchor: PrayerTimeAnchor;
  endPrayerAnchor: PrayerTimeAnchor;
  startPrayerOffsetMinutes: number;
  endPrayerOffsetMinutes: number;
}

function parseTimeToMinutes(time: string): number | null {
  if (!time || typeof time !== 'string') return null;
  const parts = time.trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function getLocalMinutesSinceMidnight(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'UTC',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  let hour = 0;
  let minute = 0;
  for (const part of parts) {
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
  }
  return hour * 60 + minute;
}

function resolveAnchorTime(
  prayer: PrayerBoundaryPrayer,
  anchor: PrayerTimeAnchor,
  times: PrayerTimes,
): string | null {
  switch (prayer) {
    case 'FAJR':
      return anchor === 'JAMAAT' && times.fajrJamaat ? times.fajrJamaat : times.fajr;
    case 'SUNRISE':
      return times.sunrise ?? null;
    case 'ZUHR':
      return anchor === 'JAMAAT' && times.zuhrJamaat ? times.zuhrJamaat : times.zuhr;
    case 'ASR':
      return anchor === 'JAMAAT' && times.asrJamaat ? times.asrJamaat : times.asr;
    case 'MAGHRIB':
      return anchor === 'JAMAAT' && times.maghribJamaat ? times.maghribJamaat : times.maghrib;
    case 'ISHA':
      return anchor === 'JAMAAT' && times.ishaJamaat ? times.ishaJamaat : times.isha;
    default:
      return null;
  }
}

function boundaryMinutes(
  prayer: PrayerBoundaryPrayer,
  anchor: PrayerTimeAnchor,
  offsetMinutes: number,
  times: PrayerTimes,
): number | null {
  const timeStr = resolveAnchorTime(prayer, anchor, times);
  if (!timeStr) return null;
  const base = parseTimeToMinutes(timeStr);
  if (base === null) return null;
  return base + offsetMinutes;
}

/** Minutes since local midnight for a prayer boundary (exported for tests). */
export function getPrayerWindowBoundaryMinutes(
  prayer: PrayerBoundaryPrayer,
  anchor: PrayerTimeAnchor,
  offsetMinutes: number,
  times: PrayerTimes,
): number | null {
  return boundaryMinutes(prayer, anchor, offsetMinutes, times);
}

/**
 * Upcoming start/end instants for a prayer window on `now`'s day and the next day.
 * Used by the display app to schedule playlist re-evaluation at window edges.
 */
export function getUpcomingPrayerWindowBoundaries(
  fields: PrayerWindowFields,
  times: PrayerTimes,
  now: Date,
  timezone: string,
): Date[] {
  const startMin = boundaryMinutes(
    fields.startPrayer,
    fields.startPrayerAnchor,
    fields.startPrayerOffsetMinutes,
    times,
  );
  const endMin = boundaryMinutes(
    fields.endPrayer,
    fields.endPrayerAnchor,
    fields.endPrayerOffsetMinutes,
    times,
  );
  if (startMin === null || endMin === null || startMin === endMin) {
    return [];
  }

  const tz = timezone || 'UTC';
  const nowMs = now.getTime();
  const upcoming: Date[] = [];

  for (let dayOffset = 0; dayOffset <= 1; dayOffset += 1) {
    const dayStart = dayjs(now).tz(tz).startOf('day').add(dayOffset, 'day');
    const startAt = dayStart.add(startMin, 'minute').toDate().getTime();
    const endAt =
      startMin < endMin
        ? dayStart.add(endMin, 'minute').toDate().getTime()
        : dayStart.add(1, 'day').add(endMin, 'minute').toDate().getTime();

    if (startAt > nowMs) upcoming.push(new Date(startAt));
    if (endAt > nowMs) upcoming.push(new Date(endAt));
  }

  return upcoming;
}

/** Returns true when `now` falls inside the prayer-relative window for today's timetable. */
export function isWithinPrayerWindow(
  now: Date,
  fields: PrayerWindowFields,
  times: PrayerTimes,
  timezone: string,
): boolean {
  const startMin = boundaryMinutes(
    fields.startPrayer,
    fields.startPrayerAnchor,
    fields.startPrayerOffsetMinutes,
    times,
  );
  const endMin = boundaryMinutes(
    fields.endPrayer,
    fields.endPrayerAnchor,
    fields.endPrayerOffsetMinutes,
    times,
  );
  if (startMin === null || endMin === null) return false;

  const currentMin = getLocalMinutesSinceMidnight(now, timezone);

  if (startMin === endMin) return false;

  if (startMin < endMin) {
    return currentMin >= startMin && currentMin < endMin;
  }

  return currentMin >= startMin || currentMin < endMin;
}

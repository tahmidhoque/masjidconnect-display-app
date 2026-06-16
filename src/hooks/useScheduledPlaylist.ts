/**
 * useScheduledPlaylist
 *
 * Resolves the active schedule from scheduledPlaylists when present, with
 * timer-based re-evaluation at schedule boundaries. Falls back to Redux
 * schedule when scheduledPlaylists is absent or empty.
 *
 * Schedule *content* is derived synchronously from Redux whenever playlists
 * change (item add/edit/remove). A lightweight boundary tick only handles
 * time-of-day / date-range switches without caching stale item payloads.
 *
 * Cleans up all timeouts on unmount (RPi memory rules).
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAppSelector } from '@/store/hooks';
import {
  selectSchedule,
  selectScheduledPlaylists,
  selectScreenContent,
  selectMasjidTimezone,
  selectPrayerTimes,
} from '@/store/slices/contentSlice';
import { normalizeScheduleData } from '@/store/slices/contentSlice';
import { resolveActiveSchedule, getNextBoundary } from '@/utils/scheduleResolver';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
import type { Schedule, ScheduledPlaylistAssignment, PrayerTimes } from '@/api/models';
import logger from '@/utils/logger';

export interface UseScheduledPlaylistResult {
  schedule: Schedule | null;
  activeAssignmentId: string | null;
}

/** Fingerprint playlist item payloads so item edits re-resolve without resetting boundary timers. */
export function buildPlaylistsContentRevision(
  playlists: ScheduledPlaylistAssignment[] | null | undefined,
): string {
  if (!playlists?.length) return '';
  return playlists
    .map((p) => {
      const items = p.schedule?.items ?? [];
      const itemSig = items
        .map((item) => {
          const row = item as {
            id?: string;
            contentItem?: { id?: string; updatedAt?: string };
            order?: number;
          };
          return `${row.id ?? ''}:${row.contentItem?.id ?? ''}:${row.contentItem?.updatedAt ?? ''}:${row.order ?? ''}`;
        })
        .join(',');
      return `${p.assignmentId}:${p.type}:${p.schedule?.id ?? ''}:${items.length}:${itemSig}`;
    })
    .sort()
    .join('|');
}

/** Assignment / boundary identity — item edits should not reset the boundary timer. */
export function buildPlaylistsBoundaryKey(
  playlists: ScheduledPlaylistAssignment[] | null | undefined,
): string {
  if (!playlists?.length) return '';
  return playlists
    .map((p) => {
      const prayerSig =
        p.type === 'PRAYER_WINDOW'
          ? `:${p.startPrayer ?? ''}:${p.endPrayer ?? ''}:${p.startPrayerAnchor ?? ''}:${p.endPrayerAnchor ?? ''}:${p.startPrayerOffsetMinutes ?? 0}:${p.endPrayerOffsetMinutes ?? 0}`
          : '';
      return `${p.assignmentId}:${p.type}:${p.schedule?.id ?? ''}${prayerSig}`;
    })
    .sort()
    .join('|');
}

/** Fingerprint prayer times so boundary timers reset when the timetable changes. */
export function buildPrayerTimesBoundaryKey(
  prayerTimes: PrayerTimes | null | undefined,
): string {
  if (!prayerTimes) return '';
  return [
    prayerTimes.fajr,
    prayerTimes.sunrise,
    prayerTimes.zuhr,
    prayerTimes.asr,
    prayerTimes.maghrib,
    prayerTimes.isha,
    prayerTimes.fajrJamaat,
    prayerTimes.zuhrJamaat,
    prayerTimes.asrJamaat,
    prayerTimes.maghribJamaat,
    prayerTimes.ishaJamaat,
  ].join('|');
}

/**
 * Hook that resolves the active schedule from scheduledPlaylists or falls back
 * to the server-resolved schedule. Schedules a timer to re-evaluate at the next
 * boundary (clock times, date ranges, or prayer-window edges).
 */
function useScheduledPlaylist(): UseScheduledPlaylistResult {
  const reduxSchedule = useAppSelector(selectSchedule);
  const scheduledPlaylists = useAppSelector(selectScheduledPlaylists);
  const screenContent = useAppSelector(selectScreenContent);
  const masjidTimezone = useAppSelector(selectMasjidTimezone);
  const prayerTimes = useAppSelector(selectPrayerTimes);

  /** Bumped at schedule boundaries so time-based assignment switches re-resolve. */
  const [boundaryTick, setBoundaryTick] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playlists =
    scheduledPlaylists ??
    screenContent?.scheduledPlaylists ??
    (screenContent as { data?: { scheduledPlaylists?: ScheduledPlaylistAssignment[] } })?.data?.scheduledPlaylists ??
    null;
  const useScheduledPlaylists = Array.isArray(playlists) && playlists.length > 0;
  const tz = masjidTimezone || 'UTC';

  const playlistsContentRevision = useMemo(
    () => buildPlaylistsContentRevision(playlists),
    [playlists],
  );
  const playlistsBoundaryKey = useMemo(
    () => buildPlaylistsBoundaryKey(playlists),
    [playlists],
  );
  const prayerTimesBoundaryKey = useMemo(
    () => buildPrayerTimesBoundaryKey(prayerTimes),
    [prayerTimes],
  );

  const resolution = useMemo((): UseScheduledPlaylistResult => {
    if (!useScheduledPlaylists || !playlists) {
      return { schedule: reduxSchedule, activeAssignmentId: null };
    }

    // boundaryTick — re-run at schedule boundaries (clock, date range, prayer window)
    void boundaryTick;
    void playlistsContentRevision;

    const assignment = resolveActiveSchedule(playlists, new Date(), tz, prayerTimes);
    if (assignment) {
      return {
        schedule: normalizeScheduleData(assignment.schedule),
        activeAssignmentId: assignment.assignmentId,
      };
    }

    const def = playlists.find((a) => a.isActive && a.type === 'DEFAULT');
    if (def) {
      return {
        schedule: normalizeScheduleData(def.schedule),
        activeAssignmentId: def.assignmentId,
      };
    }

    return { schedule: reduxSchedule, activeAssignmentId: null };
  }, [
    playlists,
    playlistsContentRevision,
    useScheduledPlaylists,
    tz,
    boundaryTick,
    reduxSchedule,
    prayerTimes,
  ]);

  useEffect(() => {
    if (!useScheduledPlaylists || !playlists) {
      return;
    }

    const scheduleNextTimer = () => {
      const now = new Date();
      let next = getNextBoundary(playlists, now, tz, prayerTimes);
      if (!next) {
        const nextMidnight = dayjs(now).tz(tz).add(1, 'day').startOf('day').toDate();
        next = nextMidnight;
        logger.debug('[useScheduledPlaylist] No boundary found, using next midnight fallback', {
          at: next.toISOString(),
        });
      }
      const delay = Math.max(0, next.getTime() - Date.now());
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        setBoundaryTick((n) => n + 1);
        scheduleNextTimer();
      }, delay);
      logger.debug('[useScheduledPlaylist] Next boundary scheduled', {
        at: next.toISOString(),
        delayMs: delay,
      });
    };

    scheduleNextTimer();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [playlistsBoundaryKey, prayerTimesBoundaryKey, useScheduledPlaylists, tz, playlists, prayerTimes]);

  return resolution;
}

export default useScheduledPlaylist;

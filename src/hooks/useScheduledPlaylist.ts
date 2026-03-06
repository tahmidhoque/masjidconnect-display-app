/**
 * useScheduledPlaylist
 *
 * Resolves the active schedule from scheduledPlaylists when present, with
 * timer-based re-evaluation at schedule boundaries. Falls back to Redux
 * schedule when scheduledPlaylists is absent or empty.
 *
 * Cleans up all timeouts on unmount (RPi memory rules).
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppSelector } from '@/store/hooks';
import {
  selectSchedule,
  selectScheduledPlaylists,
  selectScreenContent,
  selectMasjidTimezone,
} from '@/store/slices/contentSlice';
import { normalizeScheduleData } from '@/store/slices/contentSlice';
import { resolveActiveSchedule, getNextBoundary } from '@/utils/scheduleResolver';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
import type { Schedule, ScheduledPlaylistAssignment } from '@/api/models';
import logger from '@/utils/logger';

export interface UseScheduledPlaylistResult {
  schedule: Schedule | null;
  activeAssignmentId: string | null;
}

/**
 * Hook that resolves the active schedule from scheduledPlaylists or falls back
 * to the server-resolved schedule. Schedules a timer to re-evaluate at the next
 * boundary (startTime/endTime/startDate/endDate).
 */
function useScheduledPlaylist(): UseScheduledPlaylistResult {
  const reduxSchedule = useAppSelector(selectSchedule);
  const scheduledPlaylists = useAppSelector(selectScheduledPlaylists);
  const screenContent = useAppSelector(selectScreenContent);
  const masjidTimezone = useAppSelector(selectMasjidTimezone);

  const [resolvedSchedule, setResolvedSchedule] = useState<Schedule | null>(null);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playlists =
    scheduledPlaylists ??
    screenContent?.scheduledPlaylists ??
    (screenContent as { data?: { scheduledPlaylists?: ScheduledPlaylistAssignment[] } })?.data?.scheduledPlaylists ??
    null;
  const useScheduledPlaylists = Array.isArray(playlists) && playlists.length > 0;
  const tz = masjidTimezone || 'UTC';

  // Stable key: only re-run effect when assignments or schedules actually change (avoids clearing timer on every content refresh)
  const playlistsKey = useMemo(
    () =>
      playlists
        ?.map((p) => `${p.assignmentId}:${p.type}:${p.schedule?.id ?? ''}`)
        .sort()
        .join('|') ?? '',
    [playlists]
  );
  const playlistsRef = useRef(playlists);
  playlistsRef.current = playlists;

  const reEvaluate = useCallback(() => {
    const pl = playlistsRef.current;
    if (!useScheduledPlaylists || !pl) return;

    const now = new Date();
    const assignment = resolveActiveSchedule(pl, now, tz);
    if (assignment) {
      const normalised = normalizeScheduleData(assignment.schedule);
      setResolvedSchedule(normalised);
      setActiveAssignmentId(assignment.assignmentId);
    } else {
      setResolvedSchedule(null);
      setActiveAssignmentId(null);
    }
  }, [useScheduledPlaylists, tz]);

  useEffect(() => {
    if (!useScheduledPlaylists || !playlists) {
      setResolvedSchedule(null);
      setActiveAssignmentId(null);
      return;
    }

    reEvaluate();

    const scheduleNextTimer = () => {
      const pl = playlistsRef.current;
      if (!pl) return;
      const now = new Date();
      let next = getNextBoundary(pl, now, tz);
      // Fallback when no boundary found (e.g. only DEFAULT, or past all DATE_RANGE): re-evaluate at next midnight
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
        reEvaluate();
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
  }, [playlistsKey, useScheduledPlaylists, tz, reEvaluate]);

  if (!useScheduledPlaylists || !playlists) {
    return {
      schedule: reduxSchedule,
      activeAssignmentId: null,
    };
  }

  if (resolvedSchedule) {
    return {
      schedule: resolvedSchedule,
      activeAssignmentId,
    };
  }

  const def = playlists.find((a) => a.isActive && a.type === 'DEFAULT');
  if (def) {
    return {
      schedule: normalizeScheduleData(def.schedule),
      activeAssignmentId: def.assignmentId,
    };
  }

  return {
    schedule: reduxSchedule,
    activeAssignmentId: null,
  };
}

export default useScheduledPlaylist;

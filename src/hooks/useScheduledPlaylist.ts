/**
 * useScheduledPlaylist
 *
 * Resolves the active schedule from scheduledPlaylists when present, with
 * timer-based re-evaluation at schedule boundaries. Falls back to Redux
 * schedule when scheduledPlaylists is absent or empty.
 *
 * Cleans up all timeouts on unmount (RPi memory rules).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppSelector } from '@/store/hooks';
import {
  selectSchedule,
  selectScheduledPlaylists,
  selectScreenContent,
  selectMasjidTimezone,
} from '@/store/slices/contentSlice';
import { normalizeScheduleData } from '@/store/slices/contentSlice';
import { resolveActiveSchedule, getNextBoundary } from '@/utils/scheduleResolver';
import type { Schedule, ScheduledPlaylistAssignment } from '@/api/models';
import logger from '@/utils/logger';

export interface UseScheduledPlaylistResult {
  schedule: Schedule | null;
  activeAssignmentId: string | null;
}

function findAssignmentIdForSchedule(
  playlists: ScheduledPlaylistAssignment[],
  schedule: Schedule
): string | null {
  const active = playlists.filter((a) => a.isActive);
  const match = active.find((a) => a.schedule.id === schedule.id);
  return match?.assignmentId ?? null;
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

  const reEvaluate = useCallback(() => {
    if (!useScheduledPlaylists || !playlists) return;

    const now = new Date();
    const schedule = resolveActiveSchedule(playlists, now, tz);
    if (schedule) {
      const normalised = normalizeScheduleData(schedule);
      setResolvedSchedule(normalised);
      setActiveAssignmentId(findAssignmentIdForSchedule(playlists, schedule));
    } else {
      setResolvedSchedule(null);
      setActiveAssignmentId(null);
    }
  }, [playlists, useScheduledPlaylists, tz]);

  useEffect(() => {
    if (!useScheduledPlaylists || !playlists) {
      setResolvedSchedule(null);
      setActiveAssignmentId(null);
      return;
    }

    reEvaluate();

    const scheduleNextTimer = () => {
      const next = getNextBoundary(playlists, new Date(), tz);
      if (next) {
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
      }
    };
    scheduleNextTimer();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [playlists, useScheduledPlaylists, tz, reEvaluate]);

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

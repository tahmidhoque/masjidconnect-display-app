/**
 * useJamaatBuzzer
 *
 * Plays a short buzzer sound exactly once when the prayer phase transitions
 * into "jamaat in progress" — recreating the audible cue the old sign-board
 * mosque clocks used to make at jamaat time.
 *
 * Behaviour:
 *   - Edge-triggered off `usePrayerPhase`: fires when entering
 *     `{ phase: 'in-prayer', inPrayerSubPhase: 'jamaat' }` for a prayer that
 *     has not already been buzzed today.
 *   - Per-day dedupe in `localStorage` (key `mc.buzzer.lastFired`) prevents a
 *     refresh during the jamaat sub-phase from replaying the sound.
 *   - 5-second safety window: if the device boots / mounts more than 5 s after
 *     the actual jamaat time, the buzz is suppressed (no late blast). The
 *     prayer is still marked as buzzed so we do not retry on every tick. On
 *     Fridays the safety window is anchored on `jummahJamaat` (via
 *     `getEffectiveJamaat`) so the Zuhr slot beeps for Jumu'ah, not the
 *     regular `zuhrJamaat`.
 *   - Disabled / silent when `useBuzzerSettings().enabled === false`.
 *
 * The sound asset is served from `/public/sounds/jamaat-buzzer.mp3`. On the
 * Pi kiosk, Chromium is launched with `--autoplay-policy=no-user-gesture-required`
 * (see `deploy/xinitrc-kiosk`) so playback succeeds without a user gesture.
 *
 * Also exports `playBuzzerPreview(volume)` for the settings "Test sound" button.
 */

import { useEffect, useRef } from 'react';
import usePrayerPhase from './usePrayerPhase';
import { usePrayerTimesContext } from '../contexts/PrayerTimesContext';
import { useBuzzerSettings } from './useBuzzerSettings';
import { nowMinutesInTz, toMinutesFromMidnight } from '../utils/dateUtils';
import { useAppSelector } from '../store/hooks';
import { selectMasjidTimezone } from '../store/slices/contentSlice';
import { defaultMasjidTimezone } from '../config/environment';
import { getEffectiveJamaat } from '../utils/jumuahJamaat';
import logger from '../utils/logger';

/** Public so the settings overlay's "Test sound" button can play the same file. */
export const BUZZER_SOUND_URL = '/sounds/jamaat-buzzer.mp3';

/** Maximum seconds past the jamaat minute that the buzz is still allowed to fire. */
const SAFETY_WINDOW_SEC = 5;

/** localStorage key for the per-day dedupe map. */
const DEDUPE_KEY = 'mc.buzzer.lastFired';

interface DedupeState {
  /** Local-date key in `YYYY-MM-DD` format. */
  date: string;
  /** Prayer names already buzzed today. */
  prayers: string[];
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadDedupe(): DedupeState {
  if (typeof localStorage === 'undefined') return { date: todayKey(), prayers: [] };
  try {
    const raw = localStorage.getItem(DEDUPE_KEY);
    if (!raw) return { date: todayKey(), prayers: [] };
    const parsed = JSON.parse(raw) as Partial<DedupeState> | null;
    if (parsed?.date !== todayKey()) return { date: todayKey(), prayers: [] };
    const prayers = Array.isArray(parsed.prayers)
      ? parsed.prayers.filter((p): p is string => typeof p === 'string')
      : [];
    return { date: parsed.date, prayers };
  } catch {
    return { date: todayKey(), prayers: [] };
  }
}

function alreadyBuzzedToday(prayer: string): boolean {
  return loadDedupe().prayers.includes(prayer);
}

function markBuzzedToday(prayer: string): void {
  const state = loadDedupe();
  if (state.prayers.includes(prayer)) return;
  const next: DedupeState = { date: state.date, prayers: [...state.prayers, prayer] };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEDUPE_KEY, JSON.stringify(next));
    }
  } catch {
    /* quota / private mode — non-fatal */
  }
}

/**
 * Construct an `Audio` element and call `play()` immediately. Used by both
 * the buzzer hook and the settings overlay's "Test sound" button.
 *
 * Returns the underlying play promise so callers can `.catch` autoplay errors.
 */
export function playBuzzerPreview(volume: number): Promise<void> {
  if (typeof Audio === 'undefined') return Promise.resolve();
  const audio = new Audio(BUZZER_SOUND_URL);
  audio.volume = Math.max(0, Math.min(1, volume));
  return audio.play();
}

/**
 * Mount-once hook (call from a single top-level component such as
 * `DisplayScreenInner`). Has no return value — its only side effect is
 * playing the buzzer sound at the right moment.
 */
export function useJamaatBuzzer(): void {
  const { phase, prayerName, inPrayerSubPhase } = usePrayerPhase();
  const { currentPrayer, nextPrayer, isJumuahToday, jumuahTime } =
    usePrayerTimesContext();
  const { enabled, volume } = useBuzzerSettings();
  const masjidTz =
    useAppSelector(selectMasjidTimezone) || defaultMasjidTimezone;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevRef = useRef<{ phase?: string; sub?: string; prayer?: string }>({});

  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    if (!audioRef.current) {
      audioRef.current = new Audio(BUZZER_SOUND_URL);
      audioRef.current.preload = 'auto';
    }
    audioRef.current.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);

  useEffect(() => {
    const prev = prevRef.current;
    const enteringJamaat =
      phase === 'in-prayer' &&
      inPrayerSubPhase === 'jamaat' &&
      !!prayerName &&
      !(prev.phase === 'in-prayer' && prev.sub === 'jamaat' && prev.prayer === prayerName);

    prevRef.current = {
      phase,
      sub: inPrayerSubPhase,
      prayer: prayerName ?? undefined,
    };

    if (!enteringJamaat || !prayerName) return;
    if (!enabled) {
      logger.debug('[JamaatBuzzer] Skipped — disabled in settings', { prayerName });
      return;
    }
    if (alreadyBuzzedToday(prayerName)) {
      logger.debug('[JamaatBuzzer] Skipped — already buzzed today', { prayerName });
      return;
    }

    /* Resolve jamaat HH:mm string for the prayer that just entered jamaat phase.
     * Prefer `currentPrayer` (during the in-prayer window it is set to the
     * praying prayer); fall back to `nextPrayer` for the moment of transition.
     *
     * On Fridays the phase machine substitutes `jummahJamaat` for the Zuhr slot
     * via `getEffectiveJamaat` (see `usePrayerPhase`), so we MUST apply the same
     * substitution here. Otherwise the safety-window arithmetic compares the
     * Jumu'ah moment against the regular `zuhrJamaat`, which suppresses the
     * legitimate Jumu'ah beep and risks firing against the wrong Friday time. */
    const candidatePrayer =
      currentPrayer?.name === prayerName
        ? currentPrayer
        : nextPrayer?.name === prayerName
          ? nextPrayer
          : undefined;
    const jamaatStr = getEffectiveJamaat(
      candidatePrayer,
      isJumuahToday,
      jumuahTime,
    );

    if (jamaatStr) {
      const jamaatMin = toMinutesFromMidnight(jamaatStr, prayerName);
      if (jamaatMin >= 0) {
        // Compare in masjid wall-clock minutes; using `Date.getHours()` here
        // would be wrong when the device runs in UTC (e.g. the Pi kiosk).
        const nowMin = nowMinutesInTz(new Date(), masjidTz);
        const elapsedSec = (nowMin - jamaatMin) * 60;
        if (elapsedSec < 0 || elapsedSec > SAFETY_WINDOW_SEC) {
          logger.info('[JamaatBuzzer] Skipped — outside safety window', {
            prayerName,
            jamaatStr,
            elapsedSec: Math.round(elapsedSec),
          });
          /* Mark as buzzed so we don't keep checking on every 1 s tick while
           * the in-prayer phase persists. */
          markBuzzedToday(prayerName);
          return;
        }
      }
    }

    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    audio
      .play()
      .then(() => {
        logger.info('[JamaatBuzzer] Played', { prayerName });
        markBuzzedToday(prayerName);
      })
      .catch((err) => {
        logger.warn('[JamaatBuzzer] Play failed', {
          prayerName,
          error: err instanceof Error ? err.message : String(err),
        });
        /* Intentionally NOT marking as buzzed: if autoplay was blocked the
         * user may unlock audio (e.g. via the test button) and a future tick
         * could try again. */
      });
  }, [
    phase,
    inPrayerSubPhase,
    prayerName,
    enabled,
    currentPrayer,
    nextPrayer,
    masjidTz,
    isJumuahToday,
    jumuahTime,
  ]);
}

export default useJamaatBuzzer;

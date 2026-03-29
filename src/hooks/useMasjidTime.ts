/**
 * useMasjidTime
 *
 * Returns the current time expressed in the masjid's IANA timezone rather
 * than the device's system timezone (the Pi runs in UTC).
 *
 * Combines the global 1-second tick from useCurrentTime with the masjid
 * timezone stored in Redux, so every consumer automatically re-renders when
 * either the clock ticks or the timezone value changes.
 *
 * Usage:
 *   const now = useMasjidTime();
 *   now.hour()      // wall-clock hour in the masjid's zone
 *   now.format('HH:mm')  // masjid-local time string
 */

import { useMemo } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useCurrentTime } from './useCurrentTime';
import { useAppSelector } from '../store/hooks';
import { selectMasjidTimezone } from '../store/slices/contentSlice';
import { defaultMasjidTimezone } from '../config/environment';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Returns a dayjs object fixed to the masjid's IANA timezone, updated every
 * second via the global time manager.
 */
const useMasjidTime = (): Dayjs => {
  const now = useCurrentTime();
  const masjidTz = useAppSelector(selectMasjidTimezone);
  const tz = masjidTz || defaultMasjidTimezone;

  return useMemo(() => dayjs(now).tz(tz), [now, tz]);
};

export default useMasjidTime;

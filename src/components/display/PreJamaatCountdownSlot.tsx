/**
 * PreJamaatCountdownSlot
 *
 * Full-slot countdown overlay shown N seconds before jamaat begins.
 * Large digits counting down to zero, using existing gold / midnight tokens.
 * Pi-safe: Tailwind only, no backdrop-filter, GPU-accelerated.
 */

import React, { useMemo } from 'react';
import { usePrayerTimesContext } from '@/contexts/PrayerTimesContext';
import { useCurrentTime } from '@/hooks/useCurrentTime';
import { useAppSelector } from '@/store/hooks';
import { selectMasjidTimezone, selectDisplaySettings } from '@/store/slices/contentSlice';
import { defaultMasjidTimezone } from '@/config/environment';
import { getEffectiveJamaat } from '@/utils/jumuahJamaat';
import { nowMinutesInTz, toMinutesFromMidnight } from '@/utils/dateUtils';
import { resolvePhasePrayerLabel } from '@/utils/prayerTerminology';

interface PreJamaatCountdownSlotProps {
  compact?: boolean;
}

const PreJamaatCountdownSlot: React.FC<PreJamaatCountdownSlotProps> = ({ compact }) => {
  const { nextPrayer, isJumuahToday, jumuahTime } = usePrayerTimesContext();
  const currentTime = useCurrentTime();
  const masjidTz = useAppSelector(selectMasjidTimezone) || defaultMasjidTimezone;
  const displaySettings = useAppSelector(selectDisplaySettings);

  const effectiveJamaat = getEffectiveJamaat(
    nextPrayer ?? undefined,
    isJumuahToday,
    jumuahTime,
  );

  const remainingSeconds = useMemo(() => {
    if (!effectiveJamaat || !nextPrayer) return 0;
    const now = nowMinutesInTz(currentTime, masjidTz);
    const J = toMinutesFromMidnight(effectiveJamaat, nextPrayer.name);
    if (J < 0) return 0;
    const diff = (J - now) * 60;
    return Math.max(0, Math.ceil(diff));
  }, [currentTime, masjidTz, effectiveJamaat, nextPrayer]);

  const prayerLabel = resolvePhasePrayerLabel(
    nextPrayer?.name ?? null,
    displaySettings?.terminology,
    { isJumuahToday },
  );

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const display = minutes > 0
    ? `${minutes}:${seconds.toString().padStart(2, '0')}`
    : `${seconds}`;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gpu-accelerated">
      <p className={`text-gold font-semibold uppercase tracking-wider ${compact ? 'text-subheading' : 'text-heading'}`}>
        {prayerLabel ?? 'Jamaat'} begins in
      </p>
      <p
        className="text-text-primary font-bold tabular-nums leading-none mt-4 animate-subtle-pulse"
        style={{ fontSize: compact ? 'clamp(3rem, 8vmin, 6rem)' : 'clamp(4rem, 12vmin, 10rem)' }}
      >
        {display}
      </p>
      <p className={`text-text-muted mt-4 ${compact ? 'text-body' : 'text-subheading'}`}>
        Please silence your phones
      </p>
    </div>
  );
};

export default React.memo(PreJamaatCountdownSlot);

/**
 * JumuahBar
 *
 * Displays Jumuah (Friday prayer) Khutbah and Jamaat times in a compact bar
 * between the prayer times panel and the countdown. Only visible on Fridays
 * (and Thursday evening when the panel shows tomorrow's times).
 *
 * Uses gold-tinted styling to draw attention without overwhelming the display.
 * GPU-safe: no backdrop-filter, no box-shadow animations.
 */

import React from 'react';
import { usePrayerTimesContext } from '../../contexts/PrayerTimesContext';

interface JumuahBarProps {
  /** When true (landscape), use tighter spacing */
  compact?: boolean;
}

const JumuahBar: React.FC<JumuahBarProps> = ({ compact = false }) => {
  const { isJumuahToday, jumuahDisplayTime, jumuahKhutbahTime } =
    usePrayerTimesContext();

  if (!isJumuahToday) return null;

  const hasJamaat = !!jumuahDisplayTime;
  const hasKhutbah = !!jumuahKhutbahTime;

  if (!hasJamaat && !hasKhutbah) return null;

  const parts: string[] = [];
  if (hasKhutbah) parts.push(`Khutbah ${jumuahKhutbahTime}`);
  if (hasJamaat) parts.push(`Jamaat ${jumuahDisplayTime}`);
  const content = parts.join(' · ');

  return (
    <div
      className={`
        flex items-center justify-center rounded-lg border border-gold/20 bg-gold/5
        transition-opacity duration-normal
        ${compact ? 'px-3 py-1.5' : 'px-4 py-2'}
      `}
    >
      <span className="text-gold font-semibold uppercase tracking-wider text-subheading">
        Jumuah
      </span>
      <span className={`text-text-primary text-subheading ${compact ? 'ml-2' : 'ml-3'}`}>
        {content}
      </span>
    </div>
  );
};

export default React.memo(JumuahBar);

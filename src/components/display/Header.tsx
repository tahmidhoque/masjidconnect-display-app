/**
 * Header
 *
 * Displays the current date/time, Hijri date, and masjid name.
 * Features a subtle semi-transparent panel with a gold accent line
 * and a gold gradient on the masjid name — matching the original
 * ModernHeader design, but rendered with Tailwind (no MUI).
 */

import React, { useMemo } from 'react';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { calculateApproximateHijriDate } from '../../utils/dateUtils';
import logoGold from '../../assets/logos/logo-gold.svg';

interface HeaderProps {
  masjidName?: string | null;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const Header: React.FC<HeaderProps> = ({ masjidName }) => {
  const currentTime = useCurrentTime();

  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const seconds = currentTime.getSeconds();

  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const secStr = String(seconds).padStart(2, '0');
  const dateStr = `${DAYS[currentTime.getDay()]}, ${currentTime.getDate()} ${MONTHS[currentTime.getMonth()]} ${currentTime.getFullYear()}`;

  // Recalculate Hijri date once per calendar day
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hijriDate = useMemo(() => calculateApproximateHijriDate(), [currentTime.getDate()]);

  return (
    <div
      className="relative flex items-center justify-between rounded-lg px-5 py-3 overflow-hidden"
      style={{
        background: 'linear-gradient(90deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      }}
    >
      {/* Gold accent line at the bottom */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-[60px] rounded-sm"
        style={{
          background: 'linear-gradient(90deg, var(--color-gold), var(--color-gold-light))',
        }}
      />

      {/* Left — Logo + Masjid name + Hijri date */}
      <div className="flex items-center gap-3 min-w-0">
        <img
          src={logoGold}
          alt="MasjidConnect"
          className="h-8 w-auto shrink-0"
        />
        <div className="flex flex-col min-w-0">
          {masjidName && (
            <h1
              className="text-lg font-bold truncate leading-tight"
              style={{
                background: 'linear-gradient(90deg, var(--color-gold), var(--color-gold-light))',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {masjidName}
            </h1>
          )}
          <p className="text-xs text-text-muted truncate">{hijriDate}</p>
        </div>
      </div>

      {/* Centre — Gregorian date */}
      <div className="hidden md:flex flex-col items-center px-4">
        <p className="text-sm text-text-secondary whitespace-nowrap">{dateStr}</p>
      </div>

      {/* Right — Clock */}
      <div className="flex items-baseline gap-1 shrink-0">
        <span className="text-2xl font-semibold text-gold tabular-nums">{timeStr}</span>
        <span className="text-xs text-gold/60 tabular-nums">{secStr}</span>
      </div>
    </div>
  );
};

export default React.memo(Header);

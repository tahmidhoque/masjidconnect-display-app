/**
 * CountdownDisplay
 *
 * Renders a countdown string (e.g. "5h 19m 20s") with numbers at full size
 * and unit labels (h, m, s) in a smaller font so digits stay clear from
 * a distance on lower-resolution displays.
 *
 * If the value does not match the expected pattern, falls back to
 * rendering the raw string.
 */

import React, { useMemo } from 'react';

const COUNTDOWN_SEGMENT_REGEX = /(\d+)([hms])/g;

interface CountdownDisplayProps {
  /** Countdown string from getTimeUntilNextPrayer (e.g. "5h 19m 20s"). */
  value: string;
  /** Optional class names for the wrapper (e.g. text-gold, font-bold). */
  className?: string;
}

const CountdownDisplay: React.FC<CountdownDisplayProps> = ({ value, className = '' }) => {
  const segments = useMemo(() => {
    if (!value.trim()) return null;
    const matches = [...value.matchAll(COUNTDOWN_SEGMENT_REGEX)];
    if (matches.length === 0) return null;
    return matches.map((m) => ({ num: m[1], unit: m[2] }));
  }, [value]);

  if (segments == null) {
    return <span className={className}>{value || ''}</span>;
  }

  return (
    <span
      className={`countdown-stable tabular-nums ${className}`.trim()}
      aria-label={value}
    >
      {segments.map(({ num, unit }, i) => (
        <React.Fragment key={`${num}-${unit}-${i}`}>
          {i > 0 && ' '}
          <span>{num}</span>
          <span className="countdown-unit">{unit}</span>
        </React.Fragment>
      ))}
    </span>
  );
};

export default React.memo(CountdownDisplay);

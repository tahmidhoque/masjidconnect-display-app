/**
 * SilentPhonesGraphic
 *
 * Full-panel graphic displayed in place of the carousel when Jamaat is
 * imminent (within 5 minutes). Shows a UK-style prohibition sign
 * (red circle + diagonal slash) around a smartphone icon, with a clear
 * message asking congregants to silence or switch off their phones.
 *
 * `landscapeSplit` — landscape broadcast: 2×1 grid (graphic | copy) so the
 * icon can stay large while all text remains legible in the carousel band.
 *
 * Pure presentational — no state, no effects, no side effects.
 * Inline SVG so it works offline and scales to any display size.
 */

import React from 'react';

export interface SilentPhonesGraphicProps {
  /** Landscape: two-column row — large graphic left, message and badge right. */
  landscapeSplit?: boolean;
}

const ProhibitionSvg: React.FC<{ className: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 200 200"
    className={className}
    aria-hidden="true"
  >
    <circle
      cx="100"
      cy="100"
      r="90"
      fill="none"
      stroke="#E63946"
      strokeWidth="10"
    />
    <rect
      x="68"
      y="45"
      width="64"
      height="110"
      rx="8"
      ry="8"
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      className="text-text-primary"
    />
    <rect
      x="74"
      y="60"
      width="52"
      height="76"
      rx="2"
      ry="2"
      fill="rgba(255, 255, 255, 0.08)"
      stroke="none"
    />
    <line
      x1="88"
      y1="147"
      x2="112"
      y2="147"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      className="text-text-muted"
    />
    <line
      x1="92"
      y1="52"
      x2="108"
      y2="52"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="text-text-muted"
    />
    <line
      x1="36"
      y1="164"
      x2="164"
      y2="36"
      stroke="#E63946"
      strokeWidth="10"
      strokeLinecap="round"
    />
  </svg>
);

const SilentPhonesGraphic: React.FC<SilentPhonesGraphicProps> = ({
  landscapeSplit = false,
}) => {
  if (landscapeSplit) {
    return (
      <div className="silent-phones-graphic--split panel grid grid-cols-[1.12fr_1fr] h-full min-h-0 max-h-full overflow-hidden gap-x-5 items-center">
        <div className="flex items-center justify-center min-h-0 min-w-0 h-full py-1">
          <div className="animate-subtle-pulse flex items-center justify-center h-full max-h-[16rem] w-full max-w-[16rem]">
            <ProhibitionSvg className="h-full w-full max-h-[16rem] max-w-[16rem] drop-shadow-lg object-contain" />
          </div>
        </div>
        <div className="flex flex-col justify-center gap-y-5 min-w-0 min-h-0 py-1 text-left items-start">
          <div className="flex flex-col gap-y-4 w-full min-w-0">
            <h2 className="text-text-primary font-bold flex flex-col gap-y-2 silent-phones-graphic-split-title">
              <span className="block leading-snug">Please switch your phone to</span>
              <span className="block leading-snug">silent</span>
            </h2>
            <p className="leading-snug silent-phones-graphic-split-sub">
              or turn it off before Jamaat begins
            </p>
          </div>
          <span className="badge badge-gold text-caption uppercase tracking-widest shrink-0">
            Jamaat is about to begin
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="panel flex flex-col items-center justify-center h-full min-h-0 max-h-full overflow-hidden gap-y-10 text-center">
      <div className="animate-subtle-pulse shrink-0">
        <ProhibitionSvg className="w-[11rem] h-[11rem] drop-shadow-lg" />
      </div>
      <div className="flex flex-col items-center gap-y-6 max-w-lg w-full min-w-0">
        <h2 className="text-heading text-text-primary font-bold flex flex-col items-center gap-y-3">
          <span className="block leading-snug">Please switch your phone to</span>
          <span className="block leading-snug">silent</span>
        </h2>
        <p className="text-body text-text-secondary leading-relaxed">
          or turn it off before Jamaat begins
        </p>
      </div>
      <span className="badge badge-gold text-caption uppercase tracking-widest shrink-0">
        Jamaat is about to begin
      </span>
    </div>
  );
};

export default React.memo(SilentPhonesGraphic);

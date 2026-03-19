/**
 * LandscapeLayout
 *
 * Three-zone "Broadcast" layout for landscape orientation:
 *  ┌──────────────────────────────────────────────────┐
 *  │  Content Carousel (full width)                   │
 *  ├──────────────────────────────────────────────────┤
 *  │  Prayer Strip (Imsak + clock/date + 6 cards +     │
 *  │  countdown below, centred)                        │
 *  ├──────────────────────────────────────────────────┤
 *  │  Footer (connection status, branding) — edge      │
 *  └──────────────────────────────────────────────────┘
 *
 * Countdown is merged into the prayer strip; footer sits at bottom edge.
 */

import React from 'react';

export interface LandscapeLayoutProps {
  content: React.ReactNode;
  prayerStrip: React.ReactNode;
  footer: React.ReactNode;
  /** Optional background layer rendered behind everything */
  background?: React.ReactNode;
}

const LandscapeLayout: React.FC<LandscapeLayoutProps> = ({
  content,
  prayerStrip,
  footer,
  background,
}) => (
  <div className="relative w-full h-full flex flex-col bg-midnight gpu-accelerated overflow-hidden" data-orientation="landscape">
    {/* Background layer (e.g. subtle Islamic pattern) */}
    {background && (
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {background}
      </div>
    )}

    {/* Unified overlay — theme-aware tint (midnight default, green Ramadan) */}
    <div
      className="absolute inset-0 z-[5] pointer-events-none layout-overlay"
      aria-hidden
    />

    {/* Three-zone stack — pt/px padding only; pb-0 so footer sits at bottom edge */}
    <div className="relative z-10 flex flex-col w-full h-full pt-4 px-4 pb-0 gap-2">
      {/* Content carousel — full width, fills remaining space */}
      <main className="flex-1 min-h-0 flex flex-col" aria-label="Announcements and content">
        {content}
      </main>

      {/* Prayer strip — Imsak row + clock/date + 6 cards + countdown below; no overflow-hidden so countdown is never clipped */}
      <aside
        className="shrink-0 min-h-[10rem] max-h-[22rem]"
        aria-label="Prayer times and countdown"
      >
        {prayerStrip}
      </aside>

      {/* Footer — at bottom edge; no padding below */}
      <footer className="landscape-footer shrink-0 min-h-[1.5rem] py-0.5 flex items-center">
        {footer}
      </footer>
    </div>
  </div>
);

export default LandscapeLayout;

/**
 * LandscapeLayout
 *
 * Four-zone "Broadcast" layout for landscape orientation:
 *  ┌──────────────────────────────────────────────────┐
 *  │  Top bar — live clock, Gregorian/Hijri, countdown │
 *  ├──────────────────────────────────────────────────┤
 *  │  Content Carousel (full width)                   │
 *  ├──────────────────────────────────────────────────┤
 *  │  Prayer Strip (Imsak row + prayer cue cards)     │
 *  ├──────────────────────────────────────────────────┤
 *  │  Footer (connection status, branding) — edge       │
 *  └──────────────────────────────────────────────────┘
 *
 * When `topBar` is omitted, carousel remains the first content block (tests / legacy).
 */

import React from 'react';

export interface LandscapeLayoutProps {
  content: React.ReactNode;
  prayerStrip: React.ReactNode;
  footer: React.ReactNode;
  /** Optional background layer rendered behind everything */
  background?: React.ReactNode;
  /** Clock, dates, and prayer countdown — rendered above the carousel */
  topBar?: React.ReactNode;
}

const LandscapeLayout: React.FC<LandscapeLayoutProps> = ({
  content,
  prayerStrip,
  footer,
  background,
  topBar,
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

    {/* Stack — pt/px padding only; pb-0 so footer sits at bottom edge */}
    <div className="relative z-10 flex flex-col w-full h-full pt-4 px-4 pb-0 gap-2">
      {topBar ? (
        <div className="shrink-0 rounded-lg overflow-hidden" aria-label="Time and next prayer">
          {topBar}
        </div>
      ) : null}

      {/* Content carousel — full width, fills remaining space; clip so phase slides never paint over top bar / strip */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden" aria-label="Announcements and content">
        {content}
      </main>

      {/* Prayer strip — Imsak row + cue cards */}
      <aside
        className="shrink-0 min-h-[8rem] max-h-[18rem]"
        aria-label="Prayer times"
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

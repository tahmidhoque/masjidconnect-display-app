/**
 * LandscapeLayout
 *
 * Two-column layout for landscape orientation:
 *  ┌──────────────────────────────────────────────────┐
 *  │  Header (date, time, masjid name)                │
 *  ├─────────────────────────┬────────────────────────┤
 *  │  Left Column (50%)      │  Right Column (50%)    │
 *  │  Content Carousel       │  Prayer Times Panel    │
 *  │                         │  Next Prayer Countdown │
 *  ├─────────────────────────┴────────────────────────┤
 *  │  Footer (connection status, branding)            │
 *  └──────────────────────────────────────────────────┘
 *
 * All children are passed via named slots (props).
 */

import React from 'react';

export interface LandscapeLayoutProps {
  header: React.ReactNode;
  content: React.ReactNode;
  sidebar: React.ReactNode;
  footer: React.ReactNode;
  /** Optional background layer rendered behind everything */
  background?: React.ReactNode;
}

const LandscapeLayout: React.FC<LandscapeLayoutProps> = ({
  header,
  content,
  sidebar,
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

    {/* Content grid — compact in landscape so prayer times + carousel fit without overflow */}
    <div className="relative z-10 flex flex-col w-full h-full p-4 gap-2">
      <header className="shrink-0">
        {header}
      </header>

      {/* Main area — two columns: 50/50 split so prayer times panel uses half the screen */}
      <main className="flex-1 flex min-h-0 gap-3">
        {/* Left column — content carousel */}
        <section className="flex-1 min-w-0 flex flex-col">
          {content}
        </section>

        {/* Right column — prayer times + countdown */}
        <aside className="flex-1 min-w-0 flex flex-col gap-1.5">
          {sidebar}
        </aside>
      </main>

      <footer className="shrink-0">
        {footer}
      </footer>
    </div>
  </div>
);

export default LandscapeLayout;

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
  <div className="relative w-full h-full flex flex-col bg-midnight gpu-accelerated overflow-hidden">
    {/* Background layer (e.g. subtle Islamic pattern) */}
    {background && (
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {background}
      </div>
    )}

    {/* Unified frosted overlay — one continuous layer over content area */}
    <div
      className="absolute inset-0 z-[5] pointer-events-none"
      style={{ background: 'rgba(13, 59, 46, 0.35)' }}
      aria-hidden
    />

    {/* Content grid — sits above frosted layer */}
    <div className="relative z-10 flex flex-col w-full h-full">
      {/* Header */}
      <header className="shrink-0 px-6 py-2">
        {header}
      </header>

      {/* Main area — two columns: content gets more width to reduce text wrapping */}
      <main className="flex-1 flex min-h-0 px-6 gap-3">
        {/* Left column — content carousel (wider so hadith/announcements don't overflow vertically) */}
        <section className="flex-[58] min-w-0 flex flex-col">
          {content}
        </section>

        {/* Right column — prayer times + countdown */}
        <aside className="flex-[42] min-w-0 flex flex-col gap-2">
          {sidebar}
        </aside>
      </main>

      {/* Footer */}
      <footer className="shrink-0 px-6 py-1.5">
        {footer}
      </footer>
    </div>
  </div>
);

export default LandscapeLayout;

/**
 * PortraitLayout
 *
 * Single-column stacked layout for portrait orientation:
 *  ┌────────────────────────┐
 *  │  Header                │
 *  ├────────────────────────┤
 *  │  Prayer Times (auto)   │
 *  │  Next Prayer Countdown │
 *  ├────────────────────────┤
 *  │  Content Carousel (1fr)│
 *  ├────────────────────────┤
 *  │  Footer                │
 *  └────────────────────────┘
 *
 * The prayer section sizes to its content (shrink-0) so there is no
 * wasted whitespace. The carousel expands to fill whatever remains.
 *
 * All children are passed via named slots (props).
 */

import React from 'react';

export interface PortraitLayoutProps {
  header: React.ReactNode;
  prayerSection: React.ReactNode;
  content: React.ReactNode;
  footer: React.ReactNode;
  /** Optional background layer rendered behind everything */
  background?: React.ReactNode;
}

const PortraitLayout: React.FC<PortraitLayoutProps> = ({
  header,
  prayerSection,
  content,
  footer,
  background,
}) => (
  <div className="relative w-full h-full flex flex-col bg-midnight gpu-accelerated overflow-hidden">
    {/* Background layer */}
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

    {/* Content stack */}
    <div className="relative z-10 flex flex-col w-full h-full">
      {/* Header */}
      <header className="shrink-0 px-5 py-2">
        {header}
      </header>

      {/* Prayer times + countdown */}
      <section className="shrink-0 px-5 pb-1.5">
        {prayerSection}
      </section>

      {/* Content carousel — fills all remaining space */}
      <main className="flex-1 min-h-0 px-5 py-1.5">
        {content}
      </main>

      {/* Footer */}
      <footer className="shrink-0 px-5 py-1.5">
        {footer}
      </footer>
    </div>
  </div>
);

export default PortraitLayout;

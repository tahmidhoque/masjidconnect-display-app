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
  <div className="relative w-full h-full flex flex-col bg-midnight gpu-accelerated overflow-hidden" data-orientation="portrait">
    {/* Background layer */}
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

    {/* Content stack — generous padding for spatial drama, clear hierarchy */}
    <div className="relative z-10 flex flex-col w-full h-full p-6 gap-4">
      <header className="shrink-0">
        {header}
      </header>

      {/* Prayer times + countdown */}
      <section className="shrink-0">
        {prayerSection}
      </section>

      {/* Content carousel — fills all remaining space; flex so children can flex-1 / h-full and centre */}
      <main className="flex flex-1 flex-col min-h-0 w-full">
        {content}
      </main>

      <footer className="shrink-0">
        {footer}
      </footer>
    </div>
  </div>
);

export default PortraitLayout;

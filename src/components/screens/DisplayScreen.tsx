/**
 * DisplayScreen
 *
 * The main running display. Renders prayer times, countdown, content carousel,
 * header, and footer using either landscape or portrait layout depending on
 * the screen's configured orientation.
 *
 * During Ramadan mode (auto-detected from the Hijri calendar), the display:
 *  - Swaps the background pattern to a crescent/star motif
 *  - Inserts an IftarCountdown hero element during fasting hours
 *  - Passes Ramadan props to Header (day badge) and PrayerTimesPanel (labels)
 *  - Applies the green/gold theme via useRamadanMode's CSS side effect
 *
 * Data is sourced from Redux (contentSlice) and hooks.
 */

import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';

import { LandscapeLayout, PortraitLayout, OrientationWrapper } from '../layout';
import {
  Header,
  Footer,
  PrayerTimesPanel,
  PrayerCountdown,
  ContentCarousel,
  IslamicPattern,
  RamadanPattern,
  RamadanCountdownBar,
} from '../display';

import useRamadanMode from '../../hooks/useRamadanMode';
import type { CarouselItem } from '../display/ContentCarousel';

/**
 * Extract carousel items from the Redux screenContent.
 * Handles both array and object formats (see cursor rules §4).
 */
function buildCarouselItems(screenContent: any): CarouselItem[] {
  if (!screenContent) return [];

  const items: CarouselItem[] = [];

  // Schedule items
  const schedule = screenContent.schedule ?? screenContent.data?.schedule;
  const scheduleItems = Array.isArray(schedule) ? schedule : schedule?.items;
  if (Array.isArray(scheduleItems)) {
    for (const item of scheduleItems) {
      if (!item) continue;
      items.push({
        id: item.id ?? `sched-${items.length}`,
        type: item.type ?? 'Content',
        title: item.title ?? item.content?.title,
        body: item.content?.body ?? item.content?.translation ?? item.body,
        arabicBody: item.content?.arabicText ?? item.content?.arabic,
        source: item.content?.source ?? item.content?.reference,
      });
    }
  }

  // Events
  const rawEvents = screenContent.events ?? screenContent.data?.events;
  const events = Array.isArray(rawEvents) ? rawEvents : (rawEvents as any)?.data;
  if (Array.isArray(events)) {
    for (const evt of events) {
      if (!evt) continue;
      items.push({
        id: evt.id ?? `evt-${items.length}`,
        type: 'Event',
        title: evt.title ?? evt.name,
        body: evt.description,
      });
    }
  }

  return items;
}

const DisplayScreen: React.FC = () => {
  const screenContent = useSelector((s: RootState) => s.content.screenContent);
  const orientation: 'LANDSCAPE' | 'PORTRAIT' =
    screenContent?.screen?.orientation ?? 'LANDSCAPE';

  const masjidName =
    screenContent?.masjid?.name ??
    screenContent?.screen?.masjid?.name ??
    screenContent?.data?.masjid?.name ??
    null;

  const carouselInterval =
    screenContent?.screen?.contentConfig?.carouselInterval ?? 30;

  const carouselItems = useMemo(() => buildCarouselItems(screenContent), [screenContent]);

  /* ---- Ramadan mode (auto-detected from Hijri calendar) ---- */
  const ramadan = useRamadanMode();
  const isPortrait = orientation === 'PORTRAIT';

  /* ---- Compose slots ---- */
  const headerSlot = (
    <Header
      masjidName={masjidName}
      isRamadan={ramadan.isRamadan}
      ramadanDay={ramadan.ramadanDay}
    />
  );

  const footerSlot = <Footer />;
  const prayerPanel = <PrayerTimesPanel isRamadan={ramadan.isRamadan} />;
  const countdown = <PrayerCountdown />;
  const carousel = <ContentCarousel items={carouselItems} interval={carouselInterval} />;

  /* Background: crescent pattern during Ramadan, geometric otherwise */
  const bg = ramadan.isRamadan ? <RamadanPattern /> : <IslamicPattern />;

  /**
   * Countdown slot: during Ramadan, use the unified RamadanCountdownBar
   * which merges Suhoor/Iftar + Next Prayer into a single compact card.
   * Outside Ramadan, use the standard PrayerCountdown.
   */
  const countdownSlot = ramadan.isRamadan ? (
    <RamadanCountdownBar
      iftarTime={ramadan.iftarTime}
      suhoorEndTime={ramadan.suhoorEndTime}
      isFastingHours={ramadan.isFastingHours}
      compact={isPortrait}
    />
  ) : (
    countdown
  );

  return (
    <OrientationWrapper orientation={orientation}>
      {isPortrait ? (
        <PortraitLayout
          header={headerSlot}
          prayerSection={
            <div className="flex flex-col gap-3 h-full">
              {prayerPanel}
              {countdownSlot}
            </div>
          }
          content={carousel}
          footer={footerSlot}
          background={bg}
        />
      ) : (
        <LandscapeLayout
          header={headerSlot}
          content={carousel}
          sidebar={
            <>
              {prayerPanel}
              {countdownSlot}
            </>
          }
          footer={footerSlot}
          background={bg}
        />
      )}
    </OrientationWrapper>
  );
};

export default DisplayScreen;

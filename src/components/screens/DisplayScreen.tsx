/**
 * DisplayScreen
 *
 * The main running display. Renders prayer times, countdown, content carousel,
 * header, and footer using either landscape or portrait layout depending on
 * the screen's configured orientation.
 *
 * Data is sourced from Redux (contentSlice) and hooks (usePrayerTimes).
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
} from '../display';

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

  const headerSlot = <Header masjidName={masjidName} />;
  const footerSlot = <Footer />;
  const prayerPanel = <PrayerTimesPanel />;
  const countdown = <PrayerCountdown />;
  const carousel = <ContentCarousel items={carouselItems} interval={carouselInterval} />;
  const bg = <IslamicPattern />;

  return (
    <OrientationWrapper orientation={orientation}>
      {orientation === 'PORTRAIT' ? (
        <PortraitLayout
          header={headerSlot}
          prayerSection={
            <div className="flex flex-col gap-3 h-full">
              {prayerPanel}
              {countdown}
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
              {countdown}
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

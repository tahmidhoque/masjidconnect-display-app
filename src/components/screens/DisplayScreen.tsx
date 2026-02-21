/**
 * DisplayScreen
 *
 * The main running display. Renders prayer times, countdown, content carousel,
 * header, and footer using either landscape or portrait layout depending on
 * the screen's configured orientation.
 *
 * Prayer phase awareness:
 *  - `countdown-adhan` / `countdown-jamaat` — normal carousel
 *  - `jamaat-soon` — replaces carousel with phones-off graphic
 *  - `in-prayer` — replaces carousel with calm "Jamaat in progress" screen
 *
 * During Ramadan mode (auto-detected from the Hijri calendar), the display:
 *  - Inserts an IftarCountdown hero element during fasting hours
 *  - Passes Ramadan props to Header (day badge) and PrayerTimesPanel (labels)
 *  - Applies the green/gold theme via useRamadanMode's CSS side effect
 *
 * Data is sourced from Redux (contentSlice) and hooks.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { useAppSelector } from '../../store/hooks';
import { selectMasjidName } from '../../store/slices/contentSlice';
import { ORIENTATION_FORCE_EVENT } from '../../hooks/useDevKeyboard';

import { LandscapeLayout, PortraitLayout, OrientationWrapper, ReferenceViewport } from '../layout';
import {
  Header,
  Footer,
  PrayerTimesPanel,
  PrayerCountdown,
  ContentCarousel,
  IslamicPattern,
  RamadanCountdownBar,
  SilentPhonesGraphic,
  InPrayerScreen,
} from '../display';

import useRamadanMode from '../../hooks/useRamadanMode';
import usePrayerPhase from '../../hooks/usePrayerPhase';
import type { CarouselItem } from '../display/ContentCarousel';

/**
 * Map a single schedule item (normalized or raw) to a CarouselItem.
 * Normalized items have type, title, content (with body/description/arabicText/source/imageUrl).
 * Raw items may have contentItem wrapper — we read from both top-level and contentItem.
 * Supports common API shapes: body, description, message, text, and string content.
 */
function scheduleItemToCarouselItem(item: any, index: number): CarouselItem {
  const content = item.content ?? item.contentItem?.content ?? {};
  const title =
    item.title ??
    item.contentItem?.title ??
    content.title ??
    'No Title';
  const type = item.type ?? item.contentItem?.type ?? 'Content';

  // Body: try all common API field names (announcements often use message or text)
  const body =
    (typeof content === 'string' ? content : null) ??
    content.body ??
    content.description ??
    content.message ??
    content.text ??
    content.translation ??
    content.shortDescription ??
    (item as any).body ??
    (item as any).description ??
    (item as any).message ??
    (item.contentItem && typeof item.contentItem === 'object'
      ? (item.contentItem as any).body ?? (item.contentItem as any).message ?? (item.contentItem as any).description
      : undefined);

  // Image: try common field names
  const imageUrl =
    content.imageUrl ??
    content.bannerUrl ??
    content.image ??
    content.thumbnailUrl ??
    content.displayThumbnail ??
    (item as any).imageUrl ??
    (item as any).bannerUrl;

  // Duration: per-item display time in seconds (API/contentItem use seconds, e.g. 20, 30)
  const rawDuration = item.duration ?? item.contentItem?.duration ?? content.duration;
  const duration =
    typeof rawDuration === 'number' && rawDuration > 0
      ? rawDuration <= 300
        ? rawDuration
        : rawDuration / 1000
      : undefined;

  return {
    id: item.id ?? `sched-${index}`,
    type: typeof type === 'string' ? type : 'Content',
    title: typeof title === 'string' ? title : undefined,
    body: typeof body === 'string' ? body : undefined,
    arabicBody: content.arabicText ?? content.arabic,
    source: content.source ?? content.reference,
    imageUrl: typeof imageUrl === 'string' ? imageUrl : undefined,
    duration: duration,
  };
}

/**
 * Map a single event (from events array) to a CarouselItem.
 */
function eventToCarouselItem(evt: any, index: number): CarouselItem {
  const desc =
    evt.description ??
    evt.shortDescription ??
    (evt.content && (typeof evt.content === 'object'
      ? evt.content.description ?? evt.content.shortDescription
      : undefined));
  const imageUrl =
    evt.displayThumbnail ??
    evt.bannerImageUrl ??
    evt.thumbnailImageUrl ??
    (evt.content && typeof evt.content === 'object'
      ? evt.content.imageUrl ?? evt.content.bannerUrl
      : undefined);
  // Duration: display time in seconds (API may send displayDuration or duration)
  const rawDuration = evt.displayDuration ?? evt.duration ?? (evt.content && typeof evt.content === 'object' ? (evt.content as any).duration : undefined);
  const duration =
    typeof rawDuration === 'number' && rawDuration > 0
      ? rawDuration <= 300
        ? rawDuration
        : rawDuration / 1000
      : undefined;

  return {
    id: evt.id ?? `evt-${index}`,
    type: 'Event',
    title: evt.title ?? evt.name,
    body: typeof desc === 'string' ? desc : undefined,
    imageUrl: typeof imageUrl === 'string' ? imageUrl : undefined,
    duration,
  };
}

/**
 * Build carousel items from normalized schedule and events when available,
 * otherwise fall back to raw screenContent with contentItem and imageUrl support.
 */
function buildCarouselItems(
  schedule: { items?: any[] } | null,
  events: any[] | null,
  screenContent: any
): CarouselItem[] {
  const items: CarouselItem[] = [];

  // Prefer normalized schedule from state when it has items
  const scheduleItems = schedule?.items;
  if (Array.isArray(scheduleItems) && scheduleItems.length > 0) {
    scheduleItems.forEach((item, i) => {
      if (!item) return;
      items.push(scheduleItemToCarouselItem(item, items.length));
    });
  } else {
    // Fallback: build from raw screenContent schedule
    const rawSchedule = screenContent?.schedule ?? screenContent?.data?.schedule;
    const rawItems = Array.isArray(rawSchedule) ? rawSchedule : rawSchedule?.items;
    if (Array.isArray(rawItems)) {
      rawItems.forEach((item: any, i: number) => {
        if (!item) return;
        items.push(scheduleItemToCarouselItem(item, items.length));
      });
    }
  }

  // Prefer events from state when available
  let eventsList: any[] = [];
  if (Array.isArray(events) && events.length > 0) {
    eventsList = events;
  } else {
    const rawEvents = screenContent?.events ?? screenContent?.data?.events;
    eventsList = Array.isArray(rawEvents) ? rawEvents : (rawEvents as any)?.data ?? [];
  }
  eventsList.forEach((evt, i) => {
    if (!evt) return;
    items.push(eventToCarouselItem(evt, items.length));
  });

  return items;
}

const DisplayScreen: React.FC = () => {
  const screenContent = useSelector((s: RootState) => s.content.screenContent);
  const schedule = useSelector((s: RootState) => s.content.schedule);
  const events = useSelector((s: RootState) => s.content.events);

  /* Dev-mode orientation override (Ctrl+Shift+O) */
  const [orientationOverride, setOrientationOverride] = useState<
    'LANDSCAPE' | 'PORTRAIT' | undefined
  >(() => window.__ORIENTATION_FORCE);

  useEffect(() => {
    const handler = () => setOrientationOverride(window.__ORIENTATION_FORCE);
    window.addEventListener(ORIENTATION_FORCE_EVENT, handler);
    return () => window.removeEventListener(ORIENTATION_FORCE_EVENT, handler);
  }, []);

  /** Prefer ui.orientation (updated by WebSocket) so real-time orientation changes from admin are reflected. */
  const uiOrientation = useSelector((s: RootState) => s.ui.orientation);
  const orientation: 'LANDSCAPE' | 'PORTRAIT' =
    orientationOverride ?? uiOrientation ?? screenContent?.screen?.orientation ?? 'LANDSCAPE';

  // Primary: canonical name extracted by contentSlice (covers all API path variants)
  // Secondary: inline screenContent extraction for any path not yet covered
  // Fallback: localStorage set during the pairing handshake
  const masjidNameFromRedux = useAppSelector(selectMasjidName);
  const masjidNameFromContent =
    screenContent?.masjid?.name ??
    screenContent?.screen?.masjid?.name ??
    screenContent?.data?.masjid?.name ??
    null;
  const masjidName =
    masjidNameFromRedux ||
    masjidNameFromContent ||
    localStorage.getItem('masjid_name') ||
    null;

  const carouselInterval =
    screenContent?.screen?.contentConfig?.carouselInterval ?? 30;

  const carouselItems = useMemo(
    () => buildCarouselItems(schedule, events, screenContent),
    [schedule, events, screenContent]
  );

  /* ---- Ramadan mode (auto-detected from Hijri calendar) ---- */
  const ramadan = useRamadanMode();
  const isPortrait = orientation === 'PORTRAIT';

  /* ---- Prayer phase (jamaat-soon, in-prayer, etc.) ---- */
  const { phase: prayerPhase, prayerName: phasePrayerName } = usePrayerPhase();

  /* ---- Compose slots ---- */
  const headerSlot = (
    <Header
      masjidName={masjidName}
      isRamadan={ramadan.isRamadan}
      ramadanDay={ramadan.ramadanDay}
    />
  );

  const footerSlot = <Footer />;
  const prayerPanel = (
    <PrayerTimesPanel
      isRamadan={ramadan.isRamadan}
      imsakTime={ramadan.imsakDisplayTime}
    />
  );
  const countdown = <PrayerCountdown phase={prayerPhase} />;

  /**
   * Content slot: swapped based on the current prayer phase.
   *   jamaat-soon — phones-off prohibition graphic
   *   in-prayer   — calm "Jamaat in progress" screen
   *   otherwise   — normal content carousel
   */
  const contentSlot = useMemo(() => {
    switch (prayerPhase) {
      case 'jamaat-soon':
        return <SilentPhonesGraphic />;
      case 'in-prayer':
        return <InPrayerScreen prayerName={phasePrayerName} />;
      default:
        return <ContentCarousel items={carouselItems} interval={carouselInterval} />;
    }
  }, [prayerPhase, phasePrayerName, carouselItems, carouselInterval]);

  /* Background: geometric Islamic pattern (same for Ramadan and non-Ramadan) */
  const bg = <IslamicPattern />;

  /**
   * Countdown slot: during Ramadan, use the unified RamadanCountdownBar
   * which merges Suhoor/Iftar + Next Prayer into a single compact card.
   * Outside Ramadan, use the standard PrayerCountdown.
   */
  const countdownSlot = ramadan.isRamadan ? (
    <RamadanCountdownBar
      iftarTime={ramadan.iftarTime}
      suhoorEndTime={ramadan.imsakTime}
      isFastingHours={ramadan.isFastingHours}
      compact={isPortrait}
    />
  ) : (
    countdown
  );

  return (
    <OrientationWrapper orientation={orientation}>
      <ReferenceViewport orientation={orientation}>
        {isPortrait ? (
          <PortraitLayout
            header={headerSlot}
            prayerSection={
              <div className="flex flex-col gap-3 h-full">
                {prayerPanel}
                {countdownSlot}
              </div>
            }
            content={contentSlot}
            footer={footerSlot}
            background={bg}
          />
        ) : (
          <LandscapeLayout
            header={headerSlot}
            content={contentSlot}
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
      </ReferenceViewport>
    </OrientationWrapper>
  );
};

export default DisplayScreen;

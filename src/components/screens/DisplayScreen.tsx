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

import { orientationToLayoutMode, isPortraitLayout, parseScreenOrientation } from '../../utils/orientation';
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
import { usePrayerTimes } from '../../hooks/usePrayerTimes';
import { selectTimeFormat } from '../../store/slices/contentSlice';
import type { CarouselItem } from '../display/ContentCarousel';

/**
 * Resolve the per-item duration (seconds) from wherever the API sends it.
 * Returns undefined when no valid duration is found (carousel uses its default interval).
 */
function resolveItemDuration(item: any, content: any): number | undefined {
  const raw = item.duration ?? item.contentItem?.duration ?? content.duration;
  if (typeof raw !== 'number' || raw <= 0) return undefined;
  // API sometimes sends milliseconds (>300) — convert to seconds
  return raw <= 300 ? raw : raw / 1000;
}

/**
 * Map a single schedule item (normalized or raw) to one or more CarouselItems.
 *
 * Returns an ARRAY so that ASMA_AL_HUSNA items can be expanded into one slide
 * per divine name. All other item types return a single-element array.
 *
 * Normalized items have type, title, content (with body/description/arabicText/source/imageUrl).
 * Raw items may have a contentItem wrapper — we read from both top-level and contentItem.
 * Supports common API shapes: body, description, message, text, and string content.
 */
function scheduleItemToCarouselItems(item: any, index: number): CarouselItem[] {
  const content = item.content ?? item.contentItem?.content ?? {};
  const type = item.type ?? item.contentItem?.type ?? 'Content';
  const isAsmaAlHusna =
    typeof type === 'string' && type.toUpperCase() === 'ASMA_AL_HUSNA';

  // --- ASMA_AL_HUSNA: single slot with random name selection ---
  // Keep one carousel slot for the whole set. The ContentCarousel component
  // picks a random name from `names` each time this slide becomes active,
  // so a different name is shown every time the carousel cycles to this slot.
  if (isAsmaAlHusna) {
    const namesArray: any[] | undefined =
      content.names ??
      content.items ??
      content.asmaAlHusna ??
      content.asma;

    if (Array.isArray(namesArray) && namesArray.length > 0) {
      return [{
        id: item.id ?? `sched-${index}`,
        type,
        duration: resolveItemDuration(item, content),
        names: namesArray.map((name: any) => ({
          arabic:
            name.arabic ?? name.arabicName ?? name.arabic_name,
          transliteration:
            name.transliteration ?? name.romanized ?? name.name ??
            name.englishName ?? name.english_name,
          meaning:
            name.meaning ?? name.englishMeaning ?? name.english_meaning ??
            name.translation,
          number:
            typeof (name.number ?? name.id ?? name.index) === 'number'
              ? (name.number ?? name.id ?? name.index)
              : undefined,
        })),
      }];
    }
  }

  // --- Single-item fallback (all other types, or ASMA_AL_HUSNA without a names array) ---

  // Title: for Asma ul Husna with a flat single-name payload, prefer meaning as heading
  const rawTitle =
    item.title ??
    item.contentItem?.title ??
    content.title;
  const title =
    rawTitle && rawTitle !== 'No Title'
      ? rawTitle
      : isAsmaAlHusna
        ? (content.meaning ?? content.englishMeaning ?? rawTitle ?? 'No Title')
        : (rawTitle ?? 'No Title');

  // Body: try all common API field names. For Asma ul Husna the backend may
  // send `meaning` or `englishMeaning` as the English translation.
  const body =
    (typeof content === 'string' ? content : null) ??
    content.body ??
    content.description ??
    content.message ??
    content.text ??
    content.translation ??
    content.meaning ??
    content.englishMeaning ??
    content.shortDescription ??
    (item as any).body ??
    (item as any).description ??
    (item as any).message ??
    (item.contentItem && typeof item.contentItem === 'object'
      ? (item.contentItem as any).body ?? (item.contentItem as any).message ?? (item.contentItem as any).description
      : undefined);

  // Arabic body: for Asma ul Husna the backend may use `arabicName` or `name`
  // (the Arabic script of the divine name) rather than the generic `arabicText`.
  const arabicBody =
    content.arabicText ??
    content.arabic ??
    content.arabicName ??
    (isAsmaAlHusna ? content.name : undefined);

  // Image: try common field names
  const imageUrl =
    content.imageUrl ??
    content.bannerUrl ??
    content.image ??
    content.thumbnailUrl ??
    content.displayThumbnail ??
    (item as any).imageUrl ??
    (item as any).bannerUrl;

  return [{
    id: item.id ?? `sched-${index}`,
    type: typeof type === 'string' ? type : 'Content',
    title: typeof title === 'string' ? title : undefined,
    body: typeof body === 'string' ? body : undefined,
    arabicBody: typeof arabicBody === 'string' ? arabicBody : undefined,
    source: content.source ?? content.reference,
    imageUrl: typeof imageUrl === 'string' ? imageUrl : undefined,
    duration: resolveItemDuration(item, content),
  }];
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
    scheduleItems.forEach((item) => {
      if (!item) return;
      scheduleItemToCarouselItems(item, items.length).forEach((ci) => items.push(ci));
    });
  } else {
    // Fallback: build from raw screenContent schedule
    const rawSchedule = screenContent?.schedule ?? screenContent?.data?.schedule;
    const rawItems = Array.isArray(rawSchedule) ? rawSchedule : rawSchedule?.items;
    if (Array.isArray(rawItems)) {
      rawItems.forEach((item: any) => {
        if (!item) return;
        scheduleItemToCarouselItems(item, items.length).forEach((ci) => items.push(ci));
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
  const lastScheduleUpdate = useSelector((s: RootState) => s.content.lastScheduleUpdate);

  /* Dev-mode orientation override (Ctrl+Shift+O) */
  const [orientationOverride, setOrientationOverride] = useState<
    'LANDSCAPE' | 'PORTRAIT' | undefined
  >(() => window.__ORIENTATION_FORCE);

  useEffect(() => {
    const handler = () => setOrientationOverride(window.__ORIENTATION_FORCE);
    window.addEventListener(ORIENTATION_FORCE_EVENT, handler);
    return () => window.removeEventListener(ORIENTATION_FORCE_EVENT, handler);
  }, []);

  /** Prefer ui (WebSocket); fallback to content or default. Four-value orientation + rotationDegrees. */
  const uiOrientation = useAppSelector((s: RootState) => s.ui.orientation);
  const uiRotationDegrees = useAppSelector((s: RootState) => s.ui.rotationDegrees);
  const contentOrientation = screenContent?.screen?.orientation;
  const orientation =
    orientationOverride ?? uiOrientation ?? parseScreenOrientation(contentOrientation);
  const rotationDegrees =
    orientationOverride !== undefined
      ? orientationOverride === 'PORTRAIT'
        ? 90
        : 0
      : uiRotationDegrees;

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
  const isPortrait = isPortraitLayout(orientation);

  /* ---- Prayer phase (jamaat-soon, in-prayer, etc.) ---- */
  const { phase: prayerPhase, prayerName: phasePrayerName } = usePrayerPhase();

  /* ---- Forbidden (makruh) time for voluntary prayer ---- */
  const { forbiddenPrayer } = usePrayerTimes();
  const timeFormat = useAppSelector(selectTimeFormat);

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
      forbiddenPrayer={forbiddenPrayer}
      timeFormat={timeFormat}
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
        return (
          <ContentCarousel
            key={lastScheduleUpdate ?? schedule?.id ?? 'default'}
            items={carouselItems}
            interval={carouselInterval}
          />
        );
    }
  }, [prayerPhase, phasePrayerName, carouselItems, carouselInterval, lastScheduleUpdate, schedule?.id]);

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
      suhoorEndTime={ramadan.suhoorEndTime}
      imsakTime={ramadan.imsakTime}
      isFastingHours={ramadan.isFastingHours}
      compact={isPortrait}
    />
  ) : (
    countdown
  );

  const layoutMode = orientationOverride ?? orientationToLayoutMode(orientation);

  return (
    <OrientationWrapper rotationDegrees={rotationDegrees}>
      <ReferenceViewport orientation={layoutMode}>
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

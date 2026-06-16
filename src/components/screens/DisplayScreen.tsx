/**
 * DisplayScreen
 *
 * The main running display. Renders prayer times, countdown, content carousel,
 * header, and footer using either landscape or portrait layout depending on
 * the screen's configured orientation. In landscape, the live clock, dates,
 * Hijri line, and prayer countdown sit inside the prayer strip below the carousel;
 * portrait keeps Header, panel, Jumuah bar, and countdown stacked.
 *
 * Prayer phase awareness:
 *  - `countdown-adhan` / `countdown-jamaat` — normal carousel
 *  - `jamaat-soon` — replaces carousel with phones-off graphic
 *  - `in-prayer` — replaces carousel with calm "Jamaat in progress" screen
 *
 * During Ramadan mode (auto-detected from the Hijri calendar), the display:
 *  - Passes Ramadan props to Header (day badge) and PrayerTimesPanel (labels)
 *  - Applies the green/gold theme via useRamadanMode's CSS side effect
 *  - Countdown is unified: always PrayerCountdown (Maghrib = Iftar, Fajr = Suhoor end)
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
import { LayoutRenderer, OrientationWrapper, ReferenceViewport } from '../layout';
import type { RenderedZone } from '../layout';
import { buildThemeStyle } from '../../utils/displayTheme';
import type {
  LayoutZone,
  LayoutZoneComponent,
  LayoutZoneHeaderOptions,
} from '../../types/displayLayout';
import {
  inferPrayerTimesLayout,
  inferZoneRegion,
  isPrayerOnlyLayout,
  resolvePrayerFocusZoneSize,
} from '../../types/displayLayout';
import {
  Header,
  Footer,
  PrayerTimesPanel,
  PrayerTimesBar,
  PrayerCountdown,
  ContentCarousel,
  IslamicPattern,
  JumuahBar,
  JamaatSoonSlot,
  InPrayerScreen,
  SupplicationScreen,
  PostJamaatSupplicationSlot,
  JamaatBlackoutOverlay,
} from '../display';
import { POST_ADHAN_SUPPLICATION } from '@/constants/scheduledSupplications';
import { isJamaatBlackoutMode } from '@/utils/displaySettingsSupplications';
import {
  PRAYER_DISPLAY_DEV_EVENT,
  isJamaatBlackoutDevForced,
} from '@/dev/prayerDisplayDevOverride';

import useRamadanMode from '../../hooks/useRamadanMode';
import usePrayerPhase from '../../hooks/usePrayerPhase';
import useJamaatBuzzer from '../../hooks/useJamaatBuzzer';
import { PrayerTimesProvider, usePrayerTimesContext } from '../../contexts/PrayerTimesContext';
import useScheduledPlaylist from '../../hooks/useScheduledPlaylist';
import {
  selectTimeFormat,
  selectDisplaySettings,
  selectDisplayLayoutConfig,
  selectDisplayLayoutRevision,
} from '../../store/slices/contentSlice';
import { parseMediaFullscreenFlag, resolveMediaFit } from '../../utils/mediaSlide';
import { resolveTerminology } from '../../utils/prayerTerminology';
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
 * Exported for unit tests (DUA and other type mapping).
 */
export function scheduleItemToCarouselItems(item: any, index: number): CarouselItem[] {
  // Events V2: schedule item carries the full event object — render via EventSlide
  if (item.eventId && item.event && typeof item.event.startAt === 'string') {
    const evt = item.event as import('../../api/models').EventV2;
    const isFeatured = evt.featuredEvent === true || (typeof evt.displayPriority === 'number' && evt.displayPriority >= 8);
    const baseDuration = evt.displayDuration > 0 ? evt.displayDuration : (item.duration ?? 20);
    const duration = isFeatured ? Math.round(baseDuration * 1.5) : baseDuration;
    return [{
      id: item.id ?? `sched-${index}`,
      type: 'EVENT',
      title: evt.title,
      duration,
      event: evt,
    }];
  }

  const content = item.content ?? item.contentItem?.content ?? {};
  const type = item.type ?? item.contentItem?.type ?? 'Content';

  // --- MEDIA_SLIDE: poster / image / PDF — asset fills the slide (not legacy imageUrl banner) ---
  if (typeof type === 'string' && type.toUpperCase() === 'MEDIA_SLIDE') {
    const mediaUrl =
      typeof content.mediaUrl === 'string' ? content.mediaUrl.trim() : '';
    const mimeType =
      typeof content.mimeType === 'string' ? content.mimeType.trim() : '';
    const allowedMime = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
    ]);
    if (mediaUrl === '' || !allowedMime.has(mimeType)) {
      return [];
    }
    const mediaKind = mimeType === 'application/pdf' ? 'pdf' : 'image';
    const titleRaw = item.title ?? item.contentItem?.title;
    const title = typeof titleRaw === 'string' ? titleRaw : undefined;
    const fullscreen = parseMediaFullscreenFlag(content.fullscreen);
    const mediaFit = resolveMediaFit(content);
    return [{
      id: item.id ?? `sched-${index}`,
      type: 'MEDIA_SLIDE',
      title,
      duration: resolveItemDuration(item, content),
      mediaUrl,
      mediaKind,
      fullscreen,
      mediaFit,
    }];
  }

  // --- VIDEO: looping video clip (advances when the clip ends) ---
  if (typeof type === 'string' && type.toUpperCase() === 'VIDEO') {
    const videoUrl =
      typeof content.videoUrl === 'string' ? content.videoUrl.trim() : '';
    const mimeType =
      typeof content.mimeType === 'string' ? content.mimeType.trim() : '';
    const allowedMime = new Set(['video/mp4', 'video/webm']);
    if (videoUrl === '' || !allowedMime.has(mimeType)) {
      return [];
    }
    const titleRaw = item.title ?? item.contentItem?.title;
    const title = typeof titleRaw === 'string' ? titleRaw : undefined;
    const fullscreen = parseMediaFullscreenFlag(content.fullscreen);
    const mediaFit = resolveMediaFit(content);
    return [{
      id: item.id ?? `sched-${index}`,
      type: 'VIDEO',
      title,
      duration: resolveItemDuration(item, content),
      videoUrl,
      mediaFit,
      fullscreen,
      // Default muted unless explicitly opted into sound.
      muted: content.muted !== false,
    }];
  }

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

  // --- DUA: supplication with Arabic, transliteration, translation, reference ---
  const isDua = typeof type === 'string' && type.toUpperCase() === 'DUA';
  if (isDua) {
    const contentObj = typeof content === 'object' && content !== null ? content : {};
    const optStr = (v: unknown): string | undefined =>
      (typeof v === 'string' && v.trim() !== '' ? v : undefined);
    const arabicBody = optStr(contentObj.arabicText ?? contentObj.arabic);
    const transliteration = optStr(contentObj.transliteration ?? contentObj.latin);
    const body = optStr(contentObj.translation ?? contentObj.english ?? contentObj.text);
    const source = optStr(contentObj.reference ?? contentObj.source);
    const rawTitle =
      item.title ?? item.contentItem?.title ?? contentObj.title;
    const title =
      rawTitle && rawTitle !== 'No Title' ? rawTitle : (rawTitle ?? 'No Title');
    return [{
      id: item.id ?? `sched-${index}`,
      type: 'DUA',
      title: typeof title === 'string' ? title : undefined,
      body,
      arabicBody,
      transliteration,
      source,
      duration: resolveItemDuration(item, contentObj),
    }];
  }

  // --- DONATION: QR + optional campaign thermometer (resolved content from API) ---
  const isDonation = typeof type === 'string' && type.toUpperCase() === 'DONATION';
  if (isDonation) {
    const c = typeof content === 'object' && content !== null ? content : {};
    const rawUrl = (c as { donationUrl?: unknown }).donationUrl;
    let donationUrl: string | null = null;
    if (typeof rawUrl === 'string') {
      const t = rawUrl.trim();
      donationUrl = t !== '' ? t : null;
    } else if (rawUrl === null) {
      donationUrl = null;
    }

    const rawDonTitle = item.title ?? item.contentItem?.title;
    const title =
      typeof rawDonTitle === 'string' &&
      rawDonTitle.trim() !== '' &&
      rawDonTitle !== 'No Title'
        ? rawDonTitle
        : 'Donate';

    const layoutRaw = (c as { layout?: unknown }).layout;
    const donationLayout: 'qr_focus' | 'progress_focus' =
      layoutRaw === 'progress_focus' || layoutRaw === 'qr_focus' ? layoutRaw : 'qr_focus';

    const inst = (c as { instructionText?: unknown }).instructionText;
    const donationInstructionText =
      typeof inst === 'string' && inst.trim() !== '' ? inst : undefined;

    const showBadges = (c as { showWalletBadges?: unknown }).showWalletBadges;
    const donationShowWalletBadges = showBadges !== false;

    const showProg = (c as { showProgress?: unknown }).showProgress;
    const donationShowProgress = showProg !== false;

    const prov = (c as { donationProvider?: unknown }).donationProvider;
    let donationProvider: 'STRIPE' | 'SUMUP' | null | undefined;
    if (prov === 'STRIPE' || prov === 'SUMUP') {
      donationProvider = prov;
    } else if (prov === null) {
      donationProvider = null;
    }

    const camp = (c as { campaign?: unknown }).campaign;
    let donationCampaign: CarouselItem['donationCampaign'] = null;
    if (camp && typeof camp === 'object' && camp !== null) {
      const cm = camp as Record<string, unknown>;
      const id = typeof cm.id === 'string' ? cm.id : '';
      const campTitle = typeof cm.title === 'string' ? cm.title : '';
      const targetAmount = typeof cm.targetAmount === 'number' ? cm.targetAmount : NaN;
      const currentAmount = typeof cm.currentAmount === 'number' ? cm.currentAmount : NaN;
      const currency = typeof cm.currency === 'string' ? cm.currency : '';
      if (
        id !== '' &&
        campTitle !== '' &&
        !Number.isNaN(targetAmount) &&
        !Number.isNaN(currentAmount) &&
        currency !== ''
      ) {
        donationCampaign = {
          id,
          title: campTitle,
          targetAmount,
          currentAmount,
          currency,
          ...(typeof cm.campaignType === 'string' ? { campaignType: cm.campaignType } : {}),
          ...(cm.imageUrl === null || typeof cm.imageUrl === 'string'
            ? { imageUrl: cm.imageUrl as string | null }
            : {}),
        };
      }
    }

    return [{
      id: item.id ?? `sched-${index}`,
      type: 'DONATION',
      title,
      duration: resolveItemDuration(item, c),
      donationUrl,
      ...(donationInstructionText !== undefined ? { donationInstructionText } : {}),
      donationShowWalletBadges,
      donationLayout,
      ...(donationProvider !== undefined ? { donationProvider } : {}),
      donationShowProgress,
      donationCampaign,
    }];
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

  const bodyFontSize = content.fontSize;
  const validFontSize =
    bodyFontSize === 'small' || bodyFontSize === 'medium' || bodyFontSize === 'large'
      ? bodyFontSize
      : undefined;

  const textAlign = content.textAlign;
  const validTextAlign =
    textAlign === 'center' || textAlign === 'right' ? textAlign : undefined;

  return [{
    id: item.id ?? `sched-${index}`,
    type: typeof type === 'string' ? type : 'Content',
    title: typeof title === 'string' ? title : undefined,
    body: typeof body === 'string' ? body : undefined,
    bodyIsHTML: typeof body === 'string' && body.length > 0 && (content.isHTML === true || /<[a-z][^>]*>/i.test(body)) ? true : undefined,
    bodyFontSize: validFontSize,
    textAlign: validTextAlign,
    arabicBody: typeof arabicBody === 'string' ? arabicBody : undefined,
    source: content.source ?? content.reference,
    imageUrl: typeof imageUrl === 'string' ? imageUrl : undefined,
    duration: resolveItemDuration(item, content),
  }];
}

/**
 * Map a single event (from events array) to a CarouselItem.
 * When the object conforms to the EventV2 shape (has `startAt` field), the full
 * event object is attached so the carousel can render a rich EventSlide.
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

  // Duration: apply 1.5× multiplier for featured / high-priority events
  const rawDuration = evt.displayDuration ?? evt.duration ?? (evt.content && typeof evt.content === 'object' ? (evt.content as any).duration : undefined);
  let duration: number | undefined =
    typeof rawDuration === 'number' && rawDuration > 0
      ? rawDuration <= 300 ? rawDuration : rawDuration / 1000
      : undefined;

  const isFeatured = evt.featuredEvent === true || (typeof evt.displayPriority === 'number' && evt.displayPriority >= 8);
  if (isFeatured && duration !== undefined) {
    duration = Math.round(duration * 1.5);
  }

  // Attach the full EventV2 object when the response includes the V2 fields
  const isV2 = typeof evt.startAt === 'string';

  return {
    id: evt.id ?? `evt-${index}`,
    type: 'Event',
    title: evt.title ?? evt.name,
    body: typeof desc === 'string' ? desc : undefined,
    imageUrl: typeof imageUrl === 'string' ? imageUrl : undefined,
    duration,
    event: isV2 ? (evt as import('../../api/models').EventV2) : undefined,
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

  // data.events[] is intentionally NOT added here.
  // The PRD specifies data.schedule.items[] as the sole source for the carousel.
  // data.events[] is supplementary (sidebar widget, future use) — not carousel content.

  return items;
}

const DisplayScreenInner: React.FC = () => {
  const screenContent = useSelector((s: RootState) => s.content.screenContent);
  const { schedule } = useScheduledPlaylist();
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
  const {
    phase: prayerPhase,
    prayerName: phasePrayerName,
    inPrayerSubPhase,
    adhanSupplicationActive,
  } = usePrayerPhase();

  /* ---- Jamaat buzzer: plays a short sound once when jamaat begins ---- */
  useJamaatBuzzer();

  /* ---- Forbidden (makruh) time for voluntary prayer ---- */
  const { forbiddenPrayer, tomorrowsJamaats, isJumuahToday } = usePrayerTimesContext();
  const timeFormat = useAppSelector(selectTimeFormat);
  const displaySettings = useAppSelector(selectDisplaySettings);

  /**
   * On Fridays the in-prayer screen for the Zuhr slot must read "Jumu'ah" so
   * the congregation sees "Jumu'ah Jamaat in progress" rather than "Zuhr".
   * The label string itself is API-driven via `displaySettings.terminology`
   * (key: `jummah`); we only swap when the phase has resolved to the Zuhr
   * slot on a Friday so non-Zuhr prayers and non-Friday days are unchanged.
   */
  const inPrayerScreenName =
    isJumuahToday && phasePrayerName === 'Zuhr'
      ? resolveTerminology(displaySettings?.terminology, 'jummah', 'Jumuah')
      : phasePrayerName;

  /* ---- Layout config (admin layout editor; falls back to built-in default) ---- */
  const layoutConfig = useAppSelector(selectDisplayLayoutConfig);
  const layoutRevision = useAppSelector(selectDisplayLayoutRevision);
  const orientationLayout = isPortrait ? layoutConfig.portrait : layoutConfig.landscape;
  const layoutStructure = orientationLayout.structure ?? 'stack';
  const layoutStructureOptions = orientationLayout.structureOptions;
  const hasVisibleHeader = orientationLayout.zones.some(
    (zone) => zone.visible && zone.component === 'header',
  );
  const prayerOnly = isPrayerOnlyLayout(orientationLayout.zones);

  /* ---- Compose slots ---- */
  const hijriDateAdjustment = displaySettings?.hijriDateAdjustment ?? 0;

  const defaultShowDate = displaySettings?.showDate ?? true;
  const defaultShowHijriDate = displaySettings?.showHijriDate ?? true;
  const defaultShowMasjidName = displaySettings?.showMasjidName ?? false;

  const resolveHeaderFlags = (options?: LayoutZoneHeaderOptions) => ({
    showDate: options?.showDate ?? defaultShowDate,
    showHijriDate: options?.showHijriDate ?? defaultShowHijriDate,
    showMasjidName: options?.showMasjidName ?? defaultShowMasjidName,
  });

  const buildHeaderSlot = (zone: LayoutZone) => {
    const region = inferZoneRegion(layoutStructure, 'header', zone.region);
    const inSidebar = region === 'sidebar';
    const flags = resolveHeaderFlags(zone.options);
    return (
      <Header
        key={`header-${zone.id}-${hijriDateAdjustment}`}
        masjidName={masjidName}
        showMasjidName={flags.showMasjidName}
        showDate={flags.showDate}
        showHijriDate={flags.showHijriDate}
        compact={!isPortrait && inSidebar}
        isRamadan={ramadan.isRamadan}
        ramadanDay={ramadan.ramadanDay}
        ramadanTwoLines={isPortrait}
        showClockSeconds={!isPortrait && !inSidebar}
        timeFormat={timeFormat}
        hijriDateAdjustment={hijriDateAdjustment}
        layout={inSidebar ? 'vertical' : 'horizontal'}
      />
    );
  };

  const footerSlot = <Footer />;
  const prayerPanel = (
    <PrayerTimesPanel
      isRamadan={ramadan.isRamadan}
      imsakTime={ramadan.imsakTime}
      showImsak={displaySettings?.showImsak ?? false}
      forbiddenPrayer={forbiddenPrayer}
      timeFormat={timeFormat}
      compact={isPortrait}
      fillHeight={prayerOnly}
      showTomorrowJamaat={displaySettings?.showTomorrowJamaat ?? false}
      tomorrowJamaatMode={displaySettings?.tomorrowJamaatMode ?? 'off'}
      tomorrowsJamaats={tomorrowsJamaats}
    />
  );
  const countdown = (
    <PrayerCountdown
      phase={prayerPhase}
      inPrayerSubPhase={inPrayerSubPhase}
      variant={prayerOnly && isPortrait ? 'default' : undefined}
    />
  );

  /**
   * Content slot: swapped based on the current prayer phase.
   *   jamaat-soon — phones-off graphic, alternated with a "tomorrow's jamaat is changing"
   *                 slide for Zuhr / Asr / Isha when tomorrow's time differs (handled
   *                 inside JamaatSoonSlot)
   *   in-prayer   — calm "Jamaat in progress" screen
   *   otherwise   — normal content carousel
   */
  /** Key includes lastContentUpdate and lastScheduleUpdate so carousel remounts when
   *  content:invalidate or RELOAD_CONTENT refreshes data — ensures new content is shown. */
  const lastContentUpdate = useAppSelector((s: RootState) => s.content.lastContentUpdate);
  const lastScheduleUpdate = useAppSelector((s: RootState) => s.content.lastScheduleUpdate);
  const carouselItemsRevision = useMemo(() => {
    if (!schedule?.items?.length) return 'empty';
    return schedule.items
      .map((item) => {
        const row = item as { id?: string; contentItemId?: string; updatedAt?: string };
        return `${row.id ?? ''}:${row.contentItemId ?? ''}:${row.updatedAt ?? ''}`;
      })
      .join('|');
  }, [schedule?.items]);
  const carouselKey = schedule
    ? `${schedule.id}-${schedule.items?.length ?? 0}-${carouselItemsRevision}-${lastContentUpdate ?? ''}-${lastScheduleUpdate ?? ''}`
    : 'no-schedule';
  const [blackoutDevRevision, setBlackoutDevRevision] = useState(0);
  useEffect(() => {
    const bump = () => setBlackoutDevRevision((n) => n + 1);
    window.addEventListener(PRAYER_DISPLAY_DEV_EVENT, bump);
    return () => window.removeEventListener(PRAYER_DISPLAY_DEV_EVENT, bump);
  }, []);

  const jamaatBlackoutActive =
    prayerPhase === 'in-prayer' &&
    inPrayerSubPhase === 'jamaat' &&
    (isJamaatBlackoutMode(displaySettings) ||
      (blackoutDevRevision >= 0 && isJamaatBlackoutDevForced()));

  const contentSlot = useMemo(() => {
    if (adhanSupplicationActive) {
      return (
        <SupplicationScreen supplication={POST_ADHAN_SUPPLICATION} />
      );
    }

    switch (prayerPhase) {
      case 'jamaat-soon':
        return <JamaatSoonSlot landscapeSplit={!isPortrait} />;
      case 'in-prayer':
        if (inPrayerSubPhase === 'post-jamaat-supplication') {
          return (
            <PostJamaatSupplicationSlot />
          );
        }
        // post-jamaat delay: jamaat has finished — return to carousel but keep prayer highlighted
        if (inPrayerSubPhase === 'post-jamaat') {
          return (
            <ContentCarousel
              key={carouselKey}
              items={carouselItems}
              interval={carouselInterval}
              compact={isPortrait}
            />
          );
        }
        // jamaat subphase: blackout fills the viewport via overlay; slot stays black underneath
        if (
          isJamaatBlackoutMode(displaySettings) ||
          (blackoutDevRevision >= 0 && isJamaatBlackoutDevForced())
        ) {
          return <div className="h-full w-full bg-black" aria-hidden />;
        }
        return (
          <InPrayerScreen
            prayerName={inPrayerScreenName}
            statusMessage={inPrayerSubPhase}
            landscapeSplit={!isPortrait}
          />
        );
      default:
        return (
          <ContentCarousel
            key={carouselKey}
            items={carouselItems}
            interval={carouselInterval}
            compact={isPortrait}
          />
        );
    }
  }, [
    adhanSupplicationActive,
    prayerPhase,
    inPrayerScreenName,
    inPrayerSubPhase,
    displaySettings,
    blackoutDevRevision,
    carouselItems,
    carouselInterval,
    carouselKey,
    isPortrait,
  ]);

  /* Background: geometric Islamic pattern (same for Ramadan and non-Ramadan) */
  const bg = <IslamicPattern />;

  const layoutMode = orientationOverride ?? orientationToLayoutMode(orientation);

  /**
   * Custom theme colours (CSS-variable overrides on the layout root).
   * Skipped while Ramadan mode is active — the seasonal green/gold palette
   * (html[data-theme="ramadan"]) takes precedence over mosque customisation.
   */
  const themeStyle = useMemo(
    () => (ramadan.isRamadan ? undefined : buildThemeStyle(layoutConfig.theme)),
    [ramadan.isRamadan, layoutConfig.theme],
  );

  const buildPrayerTimesSlot = (zone: LayoutZone) => {
    const region = inferZoneRegion(layoutStructure, 'prayer-times', zone.region);
    const variant = inferPrayerTimesLayout(region);
    const showEmbeddedCountdown = zone.options?.showCountdown !== false;
    return (
      <PrayerTimesBar
        variant={variant}
        fillHeight={prayerOnly && variant === 'strip'}
        hideClock={hasVisibleHeader}
        masjidName={masjidName}
        isRamadan={ramadan.isRamadan}
        imsakTime={ramadan.imsakTime}
        showImsak={displaySettings?.showImsak ?? false}
        forbiddenPrayer={forbiddenPrayer}
        timeFormat={timeFormat}
        hijriDateAdjustment={hijriDateAdjustment}
        showDate={defaultShowDate}
        showHijriDate={defaultShowHijriDate}
        showMasjidName={defaultShowMasjidName}
        showTomorrowJamaat={displaySettings?.showTomorrowJamaat ?? false}
        tomorrowsJamaats={tomorrowsJamaats}
        clockPosition={layoutStructureOptions?.stripClockPosition ?? 'left'}
        countdownSlot={
          showEmbeddedCountdown ? (
            <PrayerCountdown
              phase={prayerPhase}
              inPrayerSubPhase={inPrayerSubPhase}
              variant={variant === 'sidebar' ? 'sidebar' : 'strip'}
            />
          ) : null
        }
      />
    );
  };

  /**
   * Component registry: maps a zone's component type to its rendered node and
   * any wrapper constraints carried over from the previous hardcoded layouts
   * (strip min/max height, landscape footer chrome, carousel overflow).
   */
  const zoneRegistry: Record<
    LayoutZoneComponent,
    { node: React.ReactNode; className?: string; label?: string }
  > = {
    header: { node: null, label: 'Portrait clock and dates' },
    'prayer-panel': { node: prayerPanel, label: 'Prayer times' },
    'prayer-times': {
      node: null,
      label: 'Prayer times',
    },
    'jumuah-bar': {
      node: <JumuahBar timeFormat={timeFormat} compact={!isPortrait} />,
      label: "Jumu'ah times",
    },
    countdown: {
      node: countdown,
      className: prayerOnly ? 'prayer-countdown-focus shrink-0' : undefined,
      label: 'Next prayer countdown',
    },
    content: {
      node: contentSlot,
      className: 'relative overflow-visible',
      label: 'Announcements and content',
    },
    footer: {
      node: footerSlot,
      className: isPortrait
        ? ''
        : 'landscape-footer min-h-[1.5rem] py-0.5 flex items-center',
    },
  };

  const renderedZones: RenderedZone[] = orientationLayout.zones
    .filter((zone) => zone.visible)
    .map((zone) => {
      const component = zone.component;
      const entry = zoneRegistry[component];
      const region = inferZoneRegion(layoutStructure, component, zone.region);
      const prayerVariant = component === 'prayer-times' ? inferPrayerTimesLayout(region) : null;
      const effectiveSize = resolvePrayerFocusZoneSize(
        zone,
        orientationLayout.zones,
        layoutStructure,
      );
      const node =
        component === 'header'
          ? buildHeaderSlot(zone)
          : component === 'prayer-times'
            ? buildPrayerTimesSlot(zone)
            : entry.node;
      let className = entry.className;
      if (component === 'prayer-panel') {
        className = prayerOnly
          ? 'flex-1 min-h-0 flex flex-col prayer-panel--focus'
          : className;
      } else if (prayerVariant === 'sidebar') {
        className = prayerOnly
          ? 'h-full min-h-0 flex flex-col prayer-sidebar--focus'
          : 'h-full min-h-0 flex flex-col';
      } else if (prayerVariant === 'strip') {
        className = prayerOnly
          ? 'flex-1 min-h-0 flex flex-col prayer-strip--focus'
          : 'min-h-[8rem] max-h-[18rem]';
      }
      return {
        id: zone.id,
        component,
        region: zone.region,
        size: effectiveSize,
        fontScale: zone.fontScale,
        className,
        label: entry.label,
        node,
      };
    });

  return (
    <OrientationWrapper rotationDegrees={rotationDegrees}>
      <ReferenceViewport orientation={layoutMode}>
        <LayoutRenderer
          key={`${layoutRevision}-${lastContentUpdate ?? ''}`}
          orientation={isPortrait ? 'portrait' : 'landscape'}
          structure={layoutStructure}
          structureOptions={layoutStructureOptions}
          zones={renderedZones}
          spacingScale={orientationLayout.spacingScale}
          prayerOnly={prayerOnly}
          background={bg}
          themeStyle={themeStyle}
        />
      </ReferenceViewport>
      {jamaatBlackoutActive ? <JamaatBlackoutOverlay /> : null}
    </OrientationWrapper>
  );
};

const DisplayScreen: React.FC = () => (
  <PrayerTimesProvider>
    <DisplayScreenInner />
  </PrayerTimesProvider>
);

export default DisplayScreen;

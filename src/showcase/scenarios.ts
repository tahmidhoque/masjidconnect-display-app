/**
 * Brochure showcase scenarios.
 *
 * Dev-only harness data: each scenario seeds the real Redux store with a layout
 * config, prayer times, display settings and a single content slide so the live
 * DisplayScreen renders one representative state. Captured to PNG by
 * scripts/capture-brochure.mjs and embedded into the product brochure.
 *
 * Not shipped in the production app — referenced only by src/showcase/main.tsx.
 */

import {
  DEFAULT_LAYOUT_CONFIG,
  type DisplayLayoutConfig,
  type OrientationLayoutConfig,
  type DisplayThemeOverrides,
} from '../types/displayLayout';
import type { PrayerTimes, DisplaySettings, EmergencyAlert } from '../api/models';

export interface Scenario {
  id: string;
  /** Capture orientation — drives window size and ui.orientation. */
  orientation: 'LANDSCAPE' | 'PORTRAIT';
  /** Force the seasonal Ramadan theme (sets window.__RAMADAN_FORCE). */
  ramadan?: boolean;
  /** Full-screen emergency takeover seeded into emergencySlice. */
  emergency?: EmergencyAlert;
  layout: DisplayLayoutConfig;
  /** Normalised schedule items (DisplayScreen reads content/contentItem). */
  scheduleItems: unknown[];
  /** Per-scenario display-settings overrides. */
  settings?: Partial<DisplaySettings>;
  masjidName?: string;
}

/* ------------------------------------------------------------------ */
/*  Shared data                                                        */
/* ------------------------------------------------------------------ */

const MASJID = 'Al-Falah Masjid';
const TZ = 'Europe/London';

/** Realistic UK June timetable. Phase is forced to countdown so exact values
 *  only affect what the strip/panel display, not which screen shows. */
export const PRAYER_TIMES: PrayerTimes = {
  date: '2026-06-19',
  fajr: '02:48',
  sunrise: '04:43',
  zuhr: '13:05',
  asr: '18:30',
  maghrib: '21:21',
  isha: '22:45',
  imsak: '02:38',
  fajrJamaat: '03:15',
  zuhrJamaat: '13:30',
  asrJamaat: '19:00',
  maghribJamaat: '21:26',
  ishaJamaat: '23:00',
  jummahKhutbah: '13:15',
  jummahJamaat: '13:30',
};

export const BASE_SETTINGS: DisplaySettings = {
  ramadanMode: 'auto',
  isRamadanActive: false,
  timeFormat: '12h',
  showImsak: false,
  showTomorrowJamaat: false,
  tomorrowJamaatMode: 'off',
  showDate: true,
  showHijriDate: true,
  showMasjidName: false,
  imsakOffset: 10,
  hijriDateAdjustment: 0,
  minutesAfterJamaatUntilNextPrayer: 10,
  defaultJamaatInProgressMinutes: 10,
  jamaatInProgressMode: 'screen',
};

const EMERALD_THEME: DisplayThemeOverrides = {
  background: '#0C3B35',
  accent: '#3DBFAE',
  highlight: '#F0D48A',
  textPrimary: '#FFFFFF',
  textSecondary: '#BFE0D9',
  tomorrowRoll: '#8BB8D9',
};

/* ------------------------------------------------------------------ */
/*  Layout builders                                                    */
/* ------------------------------------------------------------------ */

type Zone = OrientationLayoutConfig['zones'][number];

const z = (component: Zone['component'], extra: Partial<Zone> = {}): Zone => ({
  id: `zone-${component}`,
  component,
  visible: true,
  size: 0,
  fontScale: 1,
  ...extra,
});

function config(
  orientation: 'landscape' | 'portrait',
  orient: OrientationLayoutConfig,
  theme: DisplayThemeOverrides | null = null,
): DisplayLayoutConfig {
  return { ...DEFAULT_LAYOUT_CONFIG, [orientation]: orient, theme };
}

/** Landscape: content fills, prayer strip below. */
const LS_STACK: OrientationLayoutConfig = {
  structure: 'stack',
  spacingScale: 1,
  zones: [
    z('content', { size: 5 }),
    z('prayer-times', { size: 0 }),
    z('footer'),
  ],
};

/** Landscape with a Jumu'ah bar above the strip. */
const LS_STACK_JUMUAH: OrientationLayoutConfig = {
  structure: 'stack',
  spacingScale: 1,
  zones: [
    z('content', { size: 5 }),
    z('jumuah-bar'),
    z('prayer-times', { size: 0 }),
    z('footer'),
  ],
};

/** Sidebar layouts: clock and dates are part of the prayer sidebar — no header zone. */
const lsSidebar = (side: 'left' | 'right'): OrientationLayoutConfig => ({
  structure: side === 'left' ? 'sidebar-left' : 'sidebar-right',
  structureOptions: { sidebarWidth: 0.30 },
  spacingScale: 1,
  zones: [
    z('content', { size: 5 }),
    z('prayer-times', { region: 'sidebar', size: 1 }),
    z('footer'),
  ],
});

const LS_SPLIT_TOP: OrientationLayoutConfig = {
  structure: 'split-top',
  spacingScale: 1,
  zones: [
    z('header'),
    z('prayer-times', { size: 0 }),
    z('content', { size: 5 }),
    z('footer'),
  ],
};

/** Portrait: full stack (header, panel, jumuah, countdown, content, footer). */
const PT_FULL: OrientationLayoutConfig = {
  structure: 'stack',
  spacingScale: 1,
  zones: [
    z('header'),
    z('prayer-panel'),
    z('jumuah-bar'),
    z('countdown'),
    z('content', { size: 1 }),
    z('footer'),
  ],
};

/** Portrait: prayer-focused (no content carousel). */
const PT_PRAYER: OrientationLayoutConfig = {
  structure: 'stack',
  spacingScale: 1,
  zones: [
    z('header'),
    z('countdown'),
    z('prayer-panel', { size: 10 }),
    z('footer'),
  ],
};

/* ------------------------------------------------------------------ */
/*  Content slide builders (normalised schedule-item shape)            */
/* ------------------------------------------------------------------ */

const LONG = 999999; // keep one slide pinned (no rotation)

const verse = () => ({
  id: 'sc-verse',
  order: 0,
  type: 'VERSE_HADITH',
  title: 'Verse of the Day',
  duration: LONG,
  content: {
    arabicText: 'إِنَّ ٱلصَّلَوٰةَ كَانَتْ عَلَى ٱلْمُؤْمِنِينَ كِتَٰبًا مَّوْقُوتًا',
    body: '“Indeed, prayer has been decreed upon the believers a decree of specified times.”',
    source: 'Surah An-Nisa 4:103',
    textAlign: 'center',
  },
});

const hadith = () => ({
  id: 'sc-hadith',
  order: 0,
  type: 'VERSE_HADITH',
  title: 'Hadith',
  duration: LONG,
  content: {
    arabicText: 'الدِّينُ النَّصِيحَةُ',
    body: '“The religion is sincerity (naṣīḥah).”',
    source: 'Ṣaḥīḥ Muslim 55',
    textAlign: 'center',
  },
});

const dua = () => ({
  id: 'sc-dua',
  order: 0,
  type: 'DUA',
  title: 'Duʿāʾ',
  duration: LONG,
  content: {
    arabicText: 'رَبَّنَآ ءَاتِنَا فِى ٱلدُّنْيَا حَسَنَةً وَفِى ٱلْءَاخِرَةِ حَسَنَةً وَقِنَا عَذَابَ ٱلنَّارِ',
    transliteration: 'Rabbanā ātinā fi’d-dunyā ḥasanah, wa fi’l-ākhirati ḥasanah, wa qinā ʿadhāban-nār',
    translation: '“Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire.”',
    reference: 'Al-Baqarah 2:201',
  },
});

const asma = () => ({
  id: 'sc-asma',
  order: 0,
  type: 'ASMA_AL_HUSNA',
  title: 'Asmāʾ al-Ḥusnā',
  duration: LONG,
  content: {
    names: [
      { arabic: 'ٱلرَّحْمَٰن', transliteration: 'Ar-Raḥmān', meaning: 'The Most Gracious', number: 1 },
    ],
  },
});

const announcement = () => ({
  id: 'sc-ann',
  order: 0,
  type: 'ANNOUNCEMENT',
  title: 'New Sisters’ Section Now Open',
  duration: LONG,
  content: {
    body: 'Our refurbished first-floor sisters’ section is now open, with dedicated wudu facilities and prayer space. All welcome.',
    textAlign: 'center',
  },
});

/** Lye Ghausia Eid ul-Adha poster — generated by scripts/generate-brochure-media.mjs */
const eidMediaPoster = () => ({
  id: 'sc-eid-poster',
  order: 0,
  type: 'MEDIA_SLIDE',
  title: 'Eid ul-Adha',
  duration: LONG,
  content: {
    mediaUrl: '/brochure/lye-eid-ul-adha-poster.png',
    mimeType: 'image/png',
    fullscreen: true,
    mediaFit: 'cover',
  },
});

const jumuahReminder = () => ({
  id: 'sc-jumuah',
  order: 0,
  type: 'CUSTOM',
  title: 'Jumuʿah Reminder',
  duration: LONG,
  content: {
    body: 'Khutbah begins at 1:15pm. Please switch phones to silent, fill the front rows, and make room for latecomers.',
    textAlign: 'center',
  },
});

const eventItem = () => ({
  id: 'sc-event',
  order: 0,
  eventId: 'evt-iftar',
  duration: LONG,
  event: {
    id: 'evt-iftar',
    slug: 'community-iftar',
    title: 'Community Iftar Night',
    description: 'Join us for a free community iftar — all families welcome. Food provided. Please register so we can cater enough for everyone, insha’Allah.',
    shortDescription: 'Free community iftar for all families.',
    type: 'COMMUNITY',
    category: 'COMMUNITY',
    status: 'PUBLISHED',
    startAt: '2026-06-27T20:45:00.000Z',
    endAt: '2026-06-27T22:30:00.000Z',
    allDay: false,
    timezone: TZ,
    venue: 'Main Prayer Hall',
    isVirtual: false,
    isHybrid: false,
    virtualUrl: null,
    bannerImageUrl: null,
    thumbnailImageUrl: null,
    displayThumbnail: null,
    color: null,
    capacityTotal: 250,
    registeredCount: 168,
    isRegistrationOpen: true,
    registrationStartAt: null,
    registrationEndAt: null,
    registrationUrl: 'https://portal.masjidconnect.co.uk/e/community-iftar',
    displayDuration: 22,
    displayPriority: 9,
    featuredEvent: true,
    tags: ['community', 'ramadan'],
  },
});

/** In-situ MasjidConnect displays — generated by scripts/generate-brochure-media.mjs */
const videoSlide = () => ({
  id: 'sc-video',
  order: 0,
  type: 'VIDEO',
  title: 'Welcome',
  duration: LONG,
  content: {
    videoUrl: '/brochure/lye-display-showreel.mp4',
    mimeType: 'video/mp4',
    fullscreen: true,
    mediaFit: 'cover',
    muted: true,
  },
});

const eidAdhaAnnouncement = () => ({
  id: 'sc-eid-adha',
  order: 0,
  type: 'ANNOUNCEMENT',
  title: 'Eid ul-Adha',
  duration: LONG,
  content: {
    body:
      'Eid Jamaat will be at 9:30am\n\nThere is no parking on bath street\n\nThere will only be one Eid Jamaat this year so please plan accordingly',
    textAlign: 'center',
  },
});

const donation = () => ({
  id: 'sc-donation',
  order: 0,
  type: 'DONATION',
  title: 'New Wudu Facilities Appeal',
  duration: LONG,
  content: {
    donationUrl: 'https://portal.masjidconnect.co.uk/donate/wudu-appeal',
    layout: 'qr_focus',
    instructionText: 'Scan to give instantly by card, Apple Pay or Google Pay',
    showWalletBadges: true,
    showProgress: true,
    donationProvider: 'STRIPE',
    campaign: {
      id: 'camp-wudu',
      title: 'New Wudu Facilities',
      targetAmount: 25000,
      currentAmount: 18420,
      currency: 'GBP',
      campaignType: 'BUILD',
      imageUrl: null,
    },
  },
});

const REALTIME_ALERT: EmergencyAlert = {
  id: 'alert-demo',
  title: 'Janazah Prayer — This Afternoon',
  message:
    'Janazah prayer for our beloved brother will take place after Asr jamaat today. Please make wudu and assemble in the main carpark. Parking on Oak Street is reserved for funeral guests.',
  category: 'community',
  urgency: 'high',
  color: null,
  expiresAt: '2030-01-01T00:00:00.000Z',
  createdAt: '2026-06-19T12:00:00.000Z',
  masjidId: 'demo',
};

/* ------------------------------------------------------------------ */
/*  Scenario registry                                                  */
/* ------------------------------------------------------------------ */

export const SCENARIOS: Record<string, Scenario> = {
  /* ---- Landscape structures ---- */
  'ls-stack-verse': {
    id: 'ls-stack-verse',
    orientation: 'LANDSCAPE',
    layout: config('landscape', LS_STACK),
    scheduleItems: [verse()],
  },
  'ls-sidebar-right': {
    id: 'ls-sidebar-right',
    orientation: 'LANDSCAPE',
    layout: config('landscape', lsSidebar('right')),
    scheduleItems: [eidAdhaAnnouncement()],
  },
  'ls-sidebar-left': {
    id: 'ls-sidebar-left',
    orientation: 'LANDSCAPE',
    layout: config('landscape', lsSidebar('left')),
    scheduleItems: [asma()],
  },
  'ls-split-top': {
    id: 'ls-split-top',
    orientation: 'LANDSCAPE',
    layout: config('landscape', LS_SPLIT_TOP),
    scheduleItems: [announcement()],
  },

  /* ---- Content slide types (stack) ---- */
  'slide-verse': {
    id: 'slide-verse',
    orientation: 'LANDSCAPE',
    layout: config('landscape', LS_STACK),
    scheduleItems: [hadith()],
  },
  'slide-dua': {
    id: 'slide-dua',
    orientation: 'LANDSCAPE',
    layout: config('landscape', LS_STACK),
    scheduleItems: [dua()],
  },
  'slide-asma': {
    id: 'slide-asma',
    orientation: 'LANDSCAPE',
    layout: config('landscape', LS_STACK),
    scheduleItems: [asma()],
  },
  'slide-announcement': {
    id: 'slide-announcement',
    orientation: 'LANDSCAPE',
    layout: config('landscape', LS_STACK),
    scheduleItems: [announcement()],
  },
  'slide-event': {
    id: 'slide-event',
    orientation: 'LANDSCAPE',
    layout: config('landscape', LS_STACK),
    scheduleItems: [eventItem()],
  },
  'slide-donation': {
    id: 'slide-donation',
    orientation: 'LANDSCAPE',
    layout: config('landscape', LS_STACK),
    scheduleItems: [donation()],
  },
  'slide-eid': {
    id: 'slide-eid',
    orientation: 'LANDSCAPE',
    layout: config('landscape', LS_STACK),
    scheduleItems: [eidMediaPoster()],
  },
  'slide-jumuah': {
    id: 'slide-jumuah',
    orientation: 'LANDSCAPE',
    layout: config('landscape', LS_STACK_JUMUAH),
    scheduleItems: [jumuahReminder()],
  },
  'slide-video': {
    id: 'slide-video',
    orientation: 'LANDSCAPE',
    layout: config('landscape', LS_STACK),
    scheduleItems: [videoSlide()],
  },

  /* ---- Portrait ---- */
  'pt-full': {
    id: 'pt-full',
    orientation: 'PORTRAIT',
    layout: config('portrait', PT_FULL),
    scheduleItems: [verse()],
  },
  'pt-prayer-focus': {
    id: 'pt-prayer-focus',
    orientation: 'PORTRAIT',
    layout: config('portrait', PT_PRAYER),
    scheduleItems: [],
  },

  /* ---- Theming & Ramadan ---- */
  'ls-theme-emerald': {
    id: 'ls-theme-emerald',
    orientation: 'LANDSCAPE',
    layout: config('landscape', LS_STACK, EMERALD_THEME),
    scheduleItems: [verse()],
  },
  'ls-ramadan': {
    id: 'ls-ramadan',
    orientation: 'LANDSCAPE',
    ramadan: true,
    layout: config('landscape', LS_STACK),
    scheduleItems: [dua()],
    settings: { showImsak: true, ramadanMode: 'on', isRamadanActive: true },
  },

  /* ---- Real-time alert overlay ---- */
  'realtime-alert': {
    id: 'realtime-alert',
    orientation: 'LANDSCAPE',
    layout: config('landscape', LS_STACK),
    scheduleItems: [verse()],
    emergency: REALTIME_ALERT,
  },
  /** @deprecated Use realtime-alert — kept for older capture scripts */
  emergency: {
    id: 'emergency',
    orientation: 'LANDSCAPE',
    layout: config('landscape', LS_STACK),
    scheduleItems: [verse()],
    emergency: REALTIME_ALERT,
  },
};

export const MASJID_NAME = MASJID;
export const MASJID_TZ = TZ;

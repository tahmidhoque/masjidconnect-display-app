/**
 * eventUtils
 *
 * Pure utility functions for Events V2 data — registration badge logic, image
 * selection, location string, and timezone-aware date/time formatting.
 *
 * All functions are stateless and safe to call from any render context.
 * dayjs with utc + timezone plugins is initialised in dateUtils.ts, which must
 * be imported before these helpers are called (or imported alongside it).
 */

import dayjs from "dayjs";
import type { EventV2, EventType, EventCategory } from "../api/models";

// ---------------------------------------------------------------------------
// Registration badge
// ---------------------------------------------------------------------------

export type RegistrationBadge =
  | "REGISTER_NOW"
  | "ALMOST_FULL"
  | "SOLD_OUT"
  | "OPENS_SOON"
  | "CLOSED"
  | "FREE_ENTRY"
  | null;

/**
 * Determine which registration badge to display for an event.
 * Returns null when the event has no registration concept at all.
 */
export function getRegistrationBadge(event: EventV2): RegistrationBadge {
  const now = new Date();

  // No registration concept
  if (
    !event.isRegistrationOpen &&
    !event.registrationStartAt &&
    !event.registrationEndAt
  ) {
    return null;
  }

  // Registration hasn't opened yet
  if (
    event.registrationStartAt &&
    new Date(event.registrationStartAt) > now
  ) {
    return "OPENS_SOON";
  }

  // Registration window has closed
  if (
    event.registrationEndAt &&
    new Date(event.registrationEndAt) < now
  ) {
    return "CLOSED";
  }

  // Capacity-based logic
  if (event.isRegistrationOpen && event.capacityTotal !== null) {
    const fillRatio = event.registeredCount / event.capacityTotal;
    if (fillRatio >= 1) return "SOLD_OUT";
    if (fillRatio >= 0.8) return "ALMOST_FULL";
  }

  if (event.isRegistrationOpen) return "REGISTER_NOW";

  return "FREE_ENTRY";
}

export interface BadgeStyle {
  label: string;
  bgColor: string;
  textColor: string;
}

/** Map a RegistrationBadge value to display label and colours. */
export function getRegistrationBadgeStyle(
  badge: RegistrationBadge
): BadgeStyle | null {
  if (badge === null) return null;

  const styles: Record<NonNullable<RegistrationBadge>, BadgeStyle> = {
    REGISTER_NOW: { label: "Register Now", bgColor: "#27AE60", textColor: "#ffffff" },
    ALMOST_FULL:  { label: "Almost Full",  bgColor: "#F39C12", textColor: "#ffffff" },
    SOLD_OUT:     { label: "Sold Out",      bgColor: "#E74C3C", textColor: "#ffffff" },
    OPENS_SOON:   { label: "Registration Opens Soon", bgColor: "#2980B9", textColor: "#ffffff" },
    CLOSED:       { label: "Registration Closed",     bgColor: "#7F8C8D", textColor: "#ffffff" },
    FREE_ENTRY:   { label: "Free Entry",   bgColor: "#2C3E50", textColor: "#ffffff" },
  };

  return styles[badge];
}

/**
 * Whether a QR code should be shown for the given badge state.
 * Only show when registration is actively open and there is capacity remaining.
 */
export function shouldShowQrCode(badge: RegistrationBadge): boolean {
  return badge === "REGISTER_NOW" || badge === "ALMOST_FULL";
}

// ---------------------------------------------------------------------------
// Image selection
// ---------------------------------------------------------------------------

/**
 * Select the best image URL for an event slide, using the admin-priority chain
 * defined in PRD §5.2. Returns null when no image is available.
 */
export function getEventImage(event: EventV2): string | null {
  return (
    event.displayThumbnail ||
    event.bannerImageUrl ||
    event.thumbnailImageUrl ||
    null
  );
}

// ---------------------------------------------------------------------------
// Location string
// ---------------------------------------------------------------------------

/**
 * Derive the venue display string from event flags, per PRD §5.4.
 * Returns null when no location should be shown.
 */
export function getEventLocation(event: EventV2): string | null {
  if (event.isVirtual && !event.isHybrid) {
    return "Online Event";
  }
  if (event.isHybrid) {
    return event.venue ? `${event.venue} · Also online` : "In-person & online";
  }
  return event.venue || null;
}

// ---------------------------------------------------------------------------
// Date / time formatting
// ---------------------------------------------------------------------------

export interface EventDateTime {
  dateLine: string;
  timeLine: string;
}

const WEEKDAY_FORMAT = "dddd D MMMM YYYY"; // e.g. Wednesday 11 March 2026
const SHORT_DATE_FORMAT = "D MMM YYYY";     // e.g. 15 Mar 2026
const TIME_FORMAT = "HH:mm";               // 24-hour

function isMidnight(isoString: string, tz: string): boolean {
  const d = dayjs.utc(isoString).tz(tz);
  return d.hour() === 0 && d.minute() === 0 && d.second() === 0;
}

function isSameDay(startIso: string, endIso: string, tz: string): boolean {
  return (
    dayjs.utc(startIso).tz(tz).format("YYYY-MM-DD") ===
    dayjs.utc(endIso).tz(tz).format("YYYY-MM-DD")
  );
}

/**
 * Format an event's date and time lines for display, fully timezone-aware.
 * Uses the event's own `timezone` field (IANA, e.g. "Europe/London").
 */
export function formatEventDateTime(event: EventV2): EventDateTime {
  const tz = event.timezone || "UTC";
  const start = dayjs.utc(event.startAt).tz(tz);
  const end = dayjs.utc(event.endAt).tz(tz);

  const singleDay = isSameDay(event.startAt, event.endAt, tz);
  const startMidnight = isMidnight(event.startAt, tz);
  const endMidnight = isMidnight(event.endAt, tz);

  // All-day: explicit flag or both times are midnight
  if (event.allDay || (startMidnight && endMidnight)) {
    if (singleDay) {
      return {
        dateLine: start.format(WEEKDAY_FORMAT),
        timeLine: "All day",
      };
    }
    return {
      dateLine: `${start.format(SHORT_DATE_FORMAT)} – ${end.format(SHORT_DATE_FORMAT)}`,
      timeLine: "Multi-day",
    };
  }

  // Timed event — single day
  if (singleDay) {
    return {
      dateLine: start.format(WEEKDAY_FORMAT),
      timeLine: `${start.format(TIME_FORMAT)} – ${end.format(TIME_FORMAT)}`,
    };
  }

  // Timed event — multi-day
  return {
    dateLine: `${start.format(SHORT_DATE_FORMAT)} – ${end.format(SHORT_DATE_FORMAT)}`,
    timeLine: `${start.format(TIME_FORMAT)} – ${end.format(TIME_FORMAT)}`,
  };
}

// ---------------------------------------------------------------------------
// Type / category labels
// ---------------------------------------------------------------------------

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  PRAYER:     "Prayer",
  PROGRAM:    "Program",
  FUNDRAISER: "Fundraiser",
  SOCIAL:     "Social",
  COMMUNITY:  "Community",
  YOUTH:      "Youth",
  WOMEN:      "Women",
  COURSE:     "Course",
  WORKSHOP:   "Workshop",
  CONFERENCE: "Conference",
  VOLUNTEER:  "Volunteer",
  COMMITTEE:  "Committee",
  BOARD:      "Board",
  OTHER:      "Other",
};

const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  GENERAL:     "General",
  COMMUNITY:   "Community",
  RELIGIOUS:   "Religious",
  EDUCATIONAL: "Educational",
  SOCIAL:      "Social",
  FUNDRAISING: "Fundraising",
  YOUTH:       "Youth",
  FAMILY:      "Family",
  HEALTH:      "Health",
  INTERFAITH:  "Interfaith",
  CULTURAL:    "Cultural",
  BUSINESS:    "Business",
  SEASONAL:    "Seasonal",
};

export function getEventTypeLabel(type: EventType | string): string {
  return EVENT_TYPE_LABELS[type as EventType] ?? type;
}

export function getEventCategoryLabel(category: EventCategory | string): string {
  return EVENT_CATEGORY_LABELS[category as EventCategory] ?? category;
}

// ---------------------------------------------------------------------------
// Capacity
// ---------------------------------------------------------------------------

export interface CapacityInfo {
  text: string;
}

/**
 * Derive the capacity indicator text.
 * Shows total spaces only — registered count is intentionally not displayed.
 * Returns null when capacityTotal is null (unlimited).
 */
export function getCapacityInfo(event: EventV2): CapacityInfo | null {
  if (event.capacityTotal === null) return null;
  return {
    text: `${event.capacityTotal} spaces available`,
  };
}

// ---------------------------------------------------------------------------
// Display duration (with featured multiplier)
// ---------------------------------------------------------------------------

/**
 * Compute the slide display duration in seconds, applying the 1.5× multiplier
 * for featured events or events with displayPriority >= 8.
 */
export function getEventDisplayDuration(event: EventV2, defaultSeconds = 20): number {
  const base = event.displayDuration > 0 ? event.displayDuration : defaultSeconds;
  const featured = event.featuredEvent || event.displayPriority >= 8;
  return featured ? Math.round(base * 1.5) : base;
}

// ---------------------------------------------------------------------------
// QR caption
// ---------------------------------------------------------------------------

/**
 * Build the QR code caption based on the event's virtual/hybrid status.
 */
export function getQrCaption(event: EventV2): string {
  if (event.isVirtual || event.isHybrid) {
    return "Scan for details & to join online";
  }
  return "Scan to register";
}

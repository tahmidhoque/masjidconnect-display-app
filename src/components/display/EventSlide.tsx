/**
 * EventSlide
 *
 * Rich carousel slide for Events V2. Renders inside ContentCarousel when a
 * carousel item carries a full EventV2 object.
 *
 * Intentionally transparent — it relies on the layout's dark green background
 * (from LandscapeLayout / PortraitLayout) exactly like every other carousel
 * slide. No independent background, no overlay, no full-bleed treatment.
 *
 * Landscape layout (default):
 *  ┌─────────────────────────────────────────────────┐
 *  │  [BADGE: COURSE]                                │
 *  │                                                 │
 *  │  ┌──── left: details ──────────┐ ┌── right ─┐  │
 *  │  │  EVENT TITLE (2 lines max)  │ │ [IMAGE]  │  │
 *  │  │  Short description          │ │          │  │
 *  │  │  📅 Date · Time             │ │ ┌──────┐ │  │
 *  │  │  📍 Venue                   │ │ │  QR  │ │  │
 *  │  │  👥 Capacity bar            │ │ │      │ │  │
 *  │  │  [REGISTER NOW badge]       │ │ └──────┘ │  │
 *  │  └────────────────────────────-┘ └──────────┘  │
 *  └─────────────────────────────────────────────────┘
 *
 * Portrait layout (compact = true):
 *  ┌─────────────────────┐
 *  │  [BADGE]            │
 *  │  [IMAGE constrained]│
 *  │  TITLE              │
 *  │  📅 Date · Time     │
 *  │  📍 Venue           │
 *  │  👥 Capacity        │
 *  │  [REG BADGE]        │
 *  │  [QR centred]       │
 *  └─────────────────────┘
 */

import React, { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Calendar, MapPin, Users } from 'lucide-react';
import type { EventV2 } from '../../api/models';
import {
  getRegistrationBadge,
  getRegistrationBadgeStyle,
  shouldShowQrCode,
  getEventImage,
  getEventLocation,
  formatEventDateTime,
  getCapacityInfo,
  getEventTypeLabel,
  getQrCaption,
} from '../../utils/eventUtils';

// Ensure dayjs timezone plugins are initialised
import '../../utils/dateUtils';

export interface EventSlideProps {
  event: EventV2;
  /** True when rendered inside a portrait layout */
  compact?: boolean;
}

const EventSlide: React.FC<EventSlideProps> = ({ event, compact = false }) => {
  const image = useMemo(() => getEventImage(event), [event]);
  const location = useMemo(() => getEventLocation(event), [event]);
  const dateTime = useMemo(() => formatEventDateTime(event), [event]);
  const badge = useMemo(() => getRegistrationBadge(event), [event]);
  const badgeStyle = useMemo(() => getRegistrationBadgeStyle(badge), [badge]);
  const showQr = useMemo(
    () => shouldShowQrCode(badge) && !!event.registrationUrl,
    [badge, event.registrationUrl]
  );
  const capacity = useMemo(() => getCapacityInfo(event), [event]);
  const qrCaption = useMemo(() => getQrCaption(event), [event]);
  const typeLabel = getEventTypeLabel(event.type);

  const qrSecondaryLabel = event.title.length > 30
    ? `${event.title.slice(0, 30)}…`
    : event.title;

  if (compact) {
    return (
      <PortraitContent
        event={event}
        image={image}
        location={location}
        dateTime={dateTime}
        badge={badge}
        badgeStyle={badgeStyle}
        showQr={showQr}
        capacity={capacity}
        qrCaption={qrCaption}
        qrSecondaryLabel={qrSecondaryLabel}
        typeLabel={typeLabel}
      />
    );
  }

  return (
    <LandscapeContent
      event={event}
      image={image}
      location={location}
      dateTime={dateTime}
      badge={badge}
      badgeStyle={badgeStyle}
      showQr={showQr}
      capacity={capacity}
      qrCaption={qrCaption}
      qrSecondaryLabel={qrSecondaryLabel}
      typeLabel={typeLabel}
    />
  );
};

// ---------------------------------------------------------------------------
// Shared props
// ---------------------------------------------------------------------------

interface ContentProps {
  event: EventV2;
  image: string | null;
  location: string | null;
  dateTime: { dateLine: string; timeLine: string };
  badge: import('../../utils/eventUtils').RegistrationBadge;
  badgeStyle: import('../../utils/eventUtils').BadgeStyle | null;
  showQr: boolean;
  capacity: import('../../utils/eventUtils').CapacityInfo | null;
  qrCaption: string;
  qrSecondaryLabel: string;
  typeLabel: string;
}

// ---------------------------------------------------------------------------
// Landscape
// ---------------------------------------------------------------------------

const LandscapeContent: React.FC<ContentProps> = ({
  event,
  image,
  location,
  dateTime,
  badge,
  badgeStyle,
  showQr,
  capacity,
  qrCaption,
  qrSecondaryLabel,
  typeLabel,
}) => (
  <div className="flex flex-col gap-4 min-w-0 flex-shrink-0 w-full max-w-full">
    {/* Type badge — matches existing carousel badge styling */}
    <span className="badge badge-emerald self-start">{typeLabel}</span>

    {/* Main row: left details + right image/QR */}
    <div className="flex gap-5 items-start min-w-0">

      {/* Left column — all text content */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {/* Title */}
        <h2
          className="text-carousel-title text-text-primary"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {event.title}
        </h2>

        {/* Short description (preferred) or description */}
        {(event.shortDescription || event.description) && (
          <p
            className="text-carousel-body text-text-secondary"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {event.shortDescription ?? event.description}
          </p>
        )}

        {/* Date row */}
        <div className="flex items-center gap-2 text-text-secondary">
          <Calendar className="w-[1rem] h-[1rem] text-gold shrink-0" />
          <span className="text-carousel-body">
            {dateTime.dateLine}
          </span>
          <span className="text-text-muted">·</span>
          <span className="text-carousel-body">
            {dateTime.timeLine}
          </span>
        </div>

        {/* Venue row */}
        {location && (
          <div className="flex items-center gap-2 text-text-secondary">
            <MapPin className="w-[1rem] h-[1rem] text-gold shrink-0" />
            <span className="text-carousel-body">{location}</span>
          </div>
        )}

        {/* Capacity indicator — total spaces only */}
        {capacity && (
          <div className="flex items-center gap-2 text-text-secondary">
            <Users className="w-[1rem] h-[1rem] text-gold shrink-0" />
            <span className="text-carousel-body">{capacity.text}</span>
          </div>
        )}

        {/* Registration badge */}
        {badgeStyle && badge !== null && (
          <span
            className="self-start px-3 py-1 rounded-md font-semibold text-white text-carousel-body"
            style={{ backgroundColor: badgeStyle.bgColor }}
          >
            {badgeStyle.label}
          </span>
        )}

        {/* Opens soon sub-text */}
        {badge === 'OPENS_SOON' && event.registrationStartAt && (
          <p className="text-carousel-body text-text-muted">
            Opens{' '}
            {new Date(event.registrationStartAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </div>

      {/* Right column — image + QR stacked */}
      {(image || showQr) && (
        <div className="shrink-0 flex flex-col items-center gap-3">
          {image && (
            <div className="flex justify-center min-h-0 max-h-[8rem]">
              <img
                src={image}
                alt=""
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          )}
          {showQr && event.registrationUrl && (
            <QrBlock
              url={event.registrationUrl}
              caption={qrCaption}
              secondaryLabel={qrSecondaryLabel}
              size={130}
            />
          )}
        </div>
      )}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Portrait
// ---------------------------------------------------------------------------

const PortraitContent: React.FC<ContentProps> = ({
  event,
  image,
  location,
  dateTime,
  badge,
  badgeStyle,
  showQr,
  capacity,
  qrCaption,
  qrSecondaryLabel,
  typeLabel,
}) => (
  <div className="flex flex-col gap-3 min-w-0 flex-shrink-0 w-full max-w-full">
    {/* Type badge */}
    <span className="badge badge-emerald self-start">{typeLabel}</span>

    {/* Banner image — constrained */}
    {image && (
      <div className="flex justify-center min-h-0 max-h-[7rem] w-full">
        <img
          src={image}
          alt=""
          className="max-w-full max-h-full object-contain rounded-lg"
        />
      </div>
    )}

    {/* Title */}
    <h2
      className="text-carousel-title text-text-primary"
      style={{
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}
    >
      {event.title}
    </h2>

    {/* Date */}
    <div className="flex items-center gap-1.5 text-text-secondary">
      <Calendar className="w-4 h-4 text-gold shrink-0" />
      <span className="text-carousel-body">
        {dateTime.dateLine} · {dateTime.timeLine}
      </span>
    </div>

    {/* Venue */}
    {location && (
      <div className="flex items-center gap-1.5 text-text-secondary">
        <MapPin className="w-4 h-4 text-gold shrink-0" />
        <span className="text-carousel-body">{location}</span>
      </div>
    )}

    {/* Capacity — total spaces only */}
    {capacity && (
      <div className="flex items-center gap-1.5 text-text-secondary">
        <Users className="w-4 h-4 text-gold shrink-0" />
        <span className="text-carousel-body">{capacity.text}</span>
      </div>
    )}

    {/* Registration badge */}
    {badgeStyle && badge !== null && (
      <span
        className="self-start px-2.5 py-1 rounded-md font-semibold text-white text-carousel-body"
        style={{ backgroundColor: badgeStyle.bgColor }}
      >
        {badgeStyle.label}
      </span>
    )}

    {/* Opens soon sub-text */}
    {badge === 'OPENS_SOON' && event.registrationStartAt && (
      <p className="text-carousel-body text-text-muted">
        Opens{' '}
        {new Date(event.registrationStartAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
      </p>
    )}

    {/* QR code */}
    {showQr && event.registrationUrl && (
      <div className="flex justify-center pt-1">
        <QrBlock
          url={event.registrationUrl}
          caption={qrCaption}
          secondaryLabel={qrSecondaryLabel}
          size={110}
        />
      </div>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// QR block
// ---------------------------------------------------------------------------

interface QrBlockProps {
  url: string;
  caption: string;
  secondaryLabel: string;
  size: number;
}

const QrBlock: React.FC<QrBlockProps> = ({ url, caption, secondaryLabel, size }) => (
  <div className="flex flex-col items-center gap-1.5 shrink-0">
    {/* White surround ensures scanability against any background */}
    <div className="rounded-xl p-2 bg-white">
      <QRCodeSVG
        value={url}
        size={size}
        level="M"
        marginSize={1}
        fgColor="#000000"
        bgColor="#ffffff"
      />
    </div>
    <p className="text-carousel-body text-text-secondary text-center">
      {caption}
    </p>
    <p className="text-carousel-body text-text-muted text-center text-[0.85em]">
      {secondaryLabel}
    </p>
  </div>
);

export default React.memo(EventSlide);

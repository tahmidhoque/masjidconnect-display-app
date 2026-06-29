/**
 * CourseSlide
 *
 * Renders a COURSE playlist slide: a course's catalogue summary alongside a
 * branded QR code that opens the public enrolment page. The backend resolves
 * the live course data and builds the QR URL at serve time, so this component
 * only presents what it is given (mirrors DonationSlide's contract).
 *
 * Design: editorial layout in the app's gold-on-midnight language. The gold
 * title anchors the composition, a thin gold accent adds refinement, compact
 * meta rows (schedule, duration, fee, places) read clearly from a distance,
 * and the QR is proportionally sized — prominent without overwhelming the copy.
 * Typography uses the standard design-system classes (text-heading,
 * text-subheading, text-caption) since course slides skip the carousel fit loop.
 *
 * Landscape: two-column — left: title + meta → right: QR + caption.
 * Portrait: centred vertical stack — title → meta → QR.
 *
 * When enrolment is closed or the course is no longer available, the QR is
 * suppressed and a calm "Enrolment closed" state is shown instead, so screens
 * never advertise a dead or closed enrolment link.
 */

import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { GraduationCap, CalendarDays, Clock, Users, Tag } from 'lucide-react';
import logger from '@/utils/logger';
import type { CourseSlideData } from './ContentCarousel';
import logoBlue from '@/assets/logos/logo-notext-blue.svg';

/* ─── Constants ─────────────────────────────────────────────────── */

const DEFAULT_INSTRUCTION = 'Scan with your phone camera to enrol.';

/** Midnight blue modules — branded QR matching DonationSlide / PairingScreen. */
const QR_FG = '#0A2647';
const QR_BG = '#ffffff';

/* ─── Types ─────────────────────────────────────────────────────── */

export interface CourseSlideProps {
  course: CourseSlideData;
  /** Portrait layout — stacked composition. */
  compact?: boolean;
}

/* ─── Helpers ───────────────────────────────────────────────────── */

/** Centre logo sized proportionally to QR pixel dimensions. */
function logoSizeForQr(qrPx: number): number {
  return Math.min(48, Math.max(28, Math.round(qrPx * 0.16)));
}

/* ─── Sub-components ────────────────────────────────────────────── */

/** White-framed QR tile with branded MasjidConnect centre mark. */
const BrandedQrFrame: React.FC<{ url: string; measuredSize: number }> = ({
  url,
  measuredSize,
}) => {
  const logoPx = logoSizeForQr(measuredSize);
  return (
    <div
      className="
        flex h-full w-full items-center justify-center
        rounded-2xl bg-white p-3 gpu-accelerated
        shadow-[0_4px_24px_rgba(0,0,0,0.12)]
      "
    >
      <QRCodeSVG
        value={url}
        size={measuredSize}
        level="H"
        marginSize={1}
        fgColor={QR_FG}
        bgColor={QR_BG}
        imageSettings={{
          src: logoBlue,
          height: logoPx,
          width: logoPx,
          excavate: true,
        }}
      />
    </div>
  );
};

/** Thin decorative gold accent line — ties the slide to the app's gold language. */
const GoldAccent: React.FC<{ centered?: boolean }> = ({ centered = false }) => (
  <div
    className={`h-[0.15rem] w-[3rem] rounded-full bg-gradient-to-r from-gold to-gold-light ${
      centered ? 'mx-auto' : ''
    }`}
    aria-hidden
  />
);

/** A single icon + label meta row (schedule, duration, fee, places). */
const MetaRow: React.FC<{
  icon: React.ReactNode;
  children: React.ReactNode;
  centered?: boolean;
}> = ({ icon, children, centered = false }) => (
  <div
    className={`flex items-center gap-2 text-text-secondary ${
      centered ? 'justify-center' : ''
    }`}
  >
    <span className="text-gold shrink-0 flex">{icon}</span>
    <span className="text-subheading leading-snug">{children}</span>
  </div>
);

/* ─── Main component ────────────────────────────────────────────── */

const CourseSlide: React.FC<CourseSlideProps> = ({ course, compact = false }) => {
  const enrollmentUrl = course.enrollmentUrl ?? null;
  const layout = course.layout ?? 'qr_focus';
  const infoFocus = layout === 'info_focus';
  const isOpen = course.available !== false && course.enrolmentOpen && !!enrollmentUrl;

  const title =
    typeof course.title === 'string' && course.title.trim() !== ''
      ? course.title.trim()
      : 'Course enrolment';
  const teaser =
    course.shortDescription?.trim() ||
    course.description?.trim() ||
    undefined;
  const instruction =
    course.instructionText?.trim() || DEFAULT_INSTRUCTION;

  const feeText = course.isFree ? 'Free' : course.feeLabel?.trim() || undefined;
  const placesText =
    course.showCapacity &&
    typeof course.placesRemaining === 'number' &&
    course.placesRemaining >= 0
      ? course.placesRemaining === 0
        ? 'Fully booked'
        : `${course.placesRemaining} place${course.placesRemaining === 1 ? '' : 's'} left`
      : undefined;

  /* QR pixel-size observer — maps the CSS-sized container to actual pixels so
   * the QR scales with root font-size on any display. */
  const qrRef = useRef<HTMLDivElement>(null);
  const [qrPx, setQrPx] = useState(168);

  useEffect(() => {
    if (!isOpen) return;
    const el = qrRef.current;
    if (!el) return;

    const measure = () => {
      const side = Math.min(el.clientWidth, el.clientHeight);
      const padTotal = 28;
      setQrPx(Math.max(96, Math.min(280, Math.floor(side - padTotal))));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact, isOpen, layout]);

  useEffect(() => {
    if (
      typeof enrollmentUrl === 'string' &&
      enrollmentUrl.length > 0 &&
      !enrollmentUrl.startsWith('https:')
    ) {
      logger.warn('[CourseSlide] enrollmentUrl is not HTTPS', { id: course.id });
    }
  }, [enrollmentUrl, course.id]);

  /* Shared meta block — order tuned for glanceability from a distance. */
  const metaBlock = (centered: boolean) => (
    <div className={`flex flex-col gap-2 ${centered ? 'items-center' : ''}`}>
      {course.scheduleText && (
        <MetaRow
          icon={<CalendarDays className="w-[1.1rem] h-[1.1rem]" />}
          centered={centered}
        >
          {course.scheduleText}
        </MetaRow>
      )}
      {course.durationLabel && (
        <MetaRow
          icon={<Clock className="w-[1.1rem] h-[1.1rem]" />}
          centered={centered}
        >
          {course.durationLabel}
        </MetaRow>
      )}
      {feeText && (
        <MetaRow icon={<Tag className="w-[1.1rem] h-[1.1rem]" />} centered={centered}>
          {feeText}
        </MetaRow>
      )}
      {placesText && (
        <MetaRow
          icon={<Users className="w-[1.1rem] h-[1.1rem]" />}
          centered={centered}
        >
          {placesText}
        </MetaRow>
      )}
    </div>
  );

  /* Closed / unavailable badge shown instead of the QR. */
  const closedPill = (
    <span className="self-start rounded-md bg-surface px-3 py-1 text-caption font-semibold text-text-secondary">
      Enrolment closed
    </span>
  );

  /* Eyebrow with the course motif. */
  const eyebrow = (centered: boolean) => (
    <div
      className={`flex items-center gap-2 text-gold ${centered ? 'justify-center' : ''}`}
    >
      <GraduationCap className="w-[1.2rem] h-[1.2rem]" aria-hidden />
      <span className="text-caption font-semibold uppercase tracking-[0.2em]">
        {course.isFree ? 'Free course' : 'Course'}
      </span>
    </div>
  );

  /* ─── Portrait (compact) ───────────────────────────────────── */
  if (compact) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 text-center">
        {eyebrow(true)}
        <h2 className="text-heading font-semibold text-text-primary tracking-tight">
          {title}
        </h2>
        <GoldAccent centered />
        {teaser && (
          <p className="text-subheading font-medium text-text-secondary leading-snug max-w-[32rem] line-clamp-3">
            {teaser}
          </p>
        )}

        {metaBlock(true)}

        {isOpen && enrollmentUrl ? (
          <>
            <div
              ref={qrRef}
              className={`aspect-square shrink-0 ${infoFocus ? 'w-[9rem]' : 'w-[11rem]'}`}
            >
              <BrandedQrFrame url={enrollmentUrl} measuredSize={qrPx} />
            </div>
            <p className="text-caption text-text-muted">{instruction}</p>
          </>
        ) : (
          closedPill
        )}
      </div>
    );
  }

  /* ─── Landscape ────────────────────────────────────────────── */
  const landscapeQrClass = infoFocus ? 'w-[11rem]' : 'w-[14rem]';

  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center">
      <div className="flex w-full max-w-[56rem] items-center gap-10">
        {/* Left column — eyebrow, title, teaser, meta */}
        <div className="flex flex-1 min-w-0 flex-col justify-center gap-3">
          {eyebrow(false)}
          <div className="flex flex-col gap-2">
            <h2 className="text-heading font-semibold text-text-primary tracking-tight line-clamp-2">
              {title}
            </h2>
            <GoldAccent />
          </div>

          {teaser && (
            <p className="text-subheading font-medium text-text-secondary leading-relaxed line-clamp-3">
              {teaser}
            </p>
          )}

          {metaBlock(false)}

          {!isOpen && closedPill}
        </div>

        {/* Vertical divider */}
        <div className="h-[7rem] w-px shrink-0 bg-border" aria-hidden />

        {/* Right column — QR + caption, or closed message */}
        {isOpen && enrollmentUrl ? (
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div ref={qrRef} className={`aspect-square ${landscapeQrClass}`}>
              <BrandedQrFrame url={enrollmentUrl} measuredSize={qrPx} />
            </div>
            <p className="text-caption text-text-muted text-center max-w-[14rem]">
              {instruction}
            </p>
          </div>
        ) : (
          <div className="flex shrink-0 flex-col items-center justify-center gap-3 w-[14rem] text-center">
            <div
              className="flex aspect-square w-[8rem] items-center justify-center rounded-2xl bg-surface"
              aria-hidden
            >
              <GraduationCap className="w-[3rem] h-[3rem] text-text-muted" />
            </div>
            <p className="text-caption text-text-muted">
              Enrolment is not open at the moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(CourseSlide);

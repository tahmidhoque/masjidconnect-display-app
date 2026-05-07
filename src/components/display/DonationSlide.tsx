/**
 * DonationSlide
 *
 * Renders a DONATION playlist slide: branded QR code, call-to-action copy,
 * optional campaign thermometer, and wallet payment marks.
 *
 * Design: editorial layout with gold-accent hierarchy. The gold title anchors
 * the composition, a thin decorative accent line adds refinement, the QR is
 * proportionally sized (never overwhelming), and wallet badges sit compactly
 * near the action. Typography uses standard design-system classes (text-heading,
 * text-subheading, text-caption) since donation slides skip the carousel
 * fit loop entirely.
 *
 * Landscape: two-column — left: copy + thermometer + badges → right: QR + caption.
 * Portrait: centred vertical stack — copy → QR → badges → thermometer.
 */

import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import logger from '@/utils/logger';
import type { CarouselItem } from './ContentCarousel';
import logoBlue from '@/assets/logos/logo-notext-blue.svg';

/* ─── Constants ─────────────────────────────────────────────────── */

const DEFAULT_INSTRUCTION =
  'Scan with your phone camera to donate securely.';

/** Midnight blue modules — branded QR matching PairingScreen */
const QR_FG = '#0A2647';
const QR_BG = '#ffffff';

/* ─── Types ─────────────────────────────────────────────────────── */

export interface DonationSlideProps {
  item: CarouselItem;
  /** Portrait layout — stacked composition */
  compact?: boolean;
}

/* ─── Helpers ───────────────────────────────────────────────────── */

/** Locale-aware currency formatting with smart fraction handling. */
function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency.length === 3 ? currency : 'GBP',
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Centre logo sized proportionally to QR pixel dimensions. */
function logoSizeForQr(qrPx: number): number {
  return Math.min(48, Math.max(28, Math.round(qrPx * 0.16)));
}

/* ─── Sub-components ────────────────────────────────────────────── */

/**
 * White-framed QR tile with branded MasjidConnect centre mark.
 * Softer shadow than the original — blends with midnight without harsh edges.
 */
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

/**
 * Campaign fundraising thermometer — raised/goal with percentage
 * and a clean emerald progress bar.
 */
const ThermometerBlock: React.FC<{
  campaign: NonNullable<CarouselItem['donationCampaign']>;
}> = ({ campaign }) => {
  const ratio = Math.min(1, Math.max(0, campaign.currentAmount / campaign.targetAmount));
  const raised = formatMoney(campaign.currentAmount, campaign.currency);
  const goal = formatMoney(campaign.targetAmount, campaign.currency);
  const pct = Math.round(ratio * 100);

  return (
    <div className="flex w-full flex-col gap-2" data-donation-thermometer="">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-subheading font-semibold text-text-primary">
          {campaign.title}
        </p>
        <p className="text-body font-semibold text-emerald whitespace-nowrap">
          {pct}%
        </p>
      </div>

      <div
        className="h-[0.45rem] w-full overflow-hidden rounded-full bg-surface"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Campaign progress"
      >
        <div
          className="h-full rounded-full bg-emerald gpu-accelerated transition-[width] duration-normal"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>

      <div className="flex items-baseline justify-between gap-4">
        <p className="text-caption text-text-muted">{raised} raised</p>
        <p className="text-caption text-text-muted">Goal: {goal}</p>
      </div>
    </div>
  );
};

/**
 * Apple Pay / Google Pay trust marks — SVG versions rendered directly on
 * the midnight background. Both SVGs carry their own white rounded-rect
 * border as vector paths, so no container background is needed.
 *
 * Google Pay's viewBox includes ~130px of empty space above and below the
 * pill, so it is given a larger rendered height to match Apple Pay's
 * visual size.
 */
/*
 * Google Pay's SVG viewBox (1094×742) includes ~130px of empty space above
 * and below the actual pill mark (y=170–570), so the visible mark is only
 * ~54% of the rendered height. To appear at the same visual height as the
 * Apple Pay mark (1.85rem), Google Pay must be rendered at
 * 1.85 / 0.54 ≈ 3.4rem so both pills appear identical in height.
 */
const WALLET_BADGES: Array<{ src: string; heightClass: string; label: string }> = [
  { src: '/badges/apple-pay-mark.svg', heightClass: 'h-[1.85rem]', label: 'Apple Pay' },
  { src: '/badges/google-pay-mark.svg', heightClass: 'h-[3.4rem]', label: 'Google Pay' },
];

/**
 * Renders both badges in a flex row. `items-center` aligns the visual
 * pill midpoints on the same axis regardless of the differing CSS heights
 * (the Google Pay SVG has empty viewBox space that inflates its rendered
 * height). The parent flex-column's `items-center` keeps the strip
 * centred on the same axis as the QR code above it.
 */
const WalletBadgeStrip: React.FC<{ centered?: boolean }> = ({ centered = true }) => (
  <div
    className={`flex items-center gap-4 ${centered ? 'justify-center' : 'justify-start'}`}
    aria-hidden
  >
    {WALLET_BADGES.map(({ src, heightClass, label }) => (
      <img
        key={src}
        src={src}
        alt={label}
        className={`${heightClass} w-auto opacity-90`}
        decoding="async"
      />
    ))}
  </div>
);

/** Thin decorative gold accent line — ties the slide to the app's gold language. */
const GoldAccent: React.FC<{ centered?: boolean }> = ({ centered = false }) => (
  <div
    className={`h-[0.15rem] w-[3rem] rounded-full bg-gradient-to-r from-gold to-gold-light ${
      centered ? 'mx-auto' : ''
    }`}
    aria-hidden
  />
);

/* ─── Main component ────────────────────────────────────────────── */

const DonationSlide: React.FC<DonationSlideProps> = ({ item, compact = false }) => {
  const donationUrl = item.donationUrl ?? null;
  const layout = item.donationLayout ?? 'qr_focus';
  const showWalletBadges = item.donationShowWalletBadges !== false;
  const showProgress =
    item.donationShowProgress !== false &&
    item.donationCampaign != null &&
    item.donationCampaign.targetAmount > 0;
  const campaign = item.donationCampaign;
  const instruction =
    typeof item.donationInstructionText === 'string' &&
    item.donationInstructionText.trim() !== ''
      ? item.donationInstructionText.trim()
      : DEFAULT_INSTRUCTION;
  const title =
    typeof item.title === 'string' && item.title.trim() !== ''
      ? item.title
      : 'Donate now';

  const progressFocus = layout === 'progress_focus' && showProgress;

  /*
   * QR pixel-size observer — QRCodeSVG needs a pixel value; the
   * ResizeObserver maps the CSS-sized container to actual pixels
   * so the QR scales with root font-size on any display.
   */
  const qrRef = useRef<HTMLDivElement>(null);
  const [qrPx, setQrPx] = useState(168);

  useEffect(() => {
    if (!donationUrl) return;
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
  }, [compact, donationUrl, layout, showProgress]);

  useEffect(() => {
    if (
      typeof donationUrl === 'string' &&
      donationUrl.length > 0 &&
      !donationUrl.startsWith('https:')
    ) {
      logger.warn('[DonationSlide] donationUrl is not HTTPS', { id: item.id });
    }
  }, [donationUrl, item.id]);

  /* Resolved sub-elements */
  const thermometer =
    showProgress && campaign ? <ThermometerBlock campaign={campaign} /> : null;
  const badges = showWalletBadges ? (
    <WalletBadgeStrip centered={compact} />
  ) : null;

  /* ─── No URL fallback ──────────────────────────────────────── */
  if (!donationUrl) {
    return (
      <div
        className={`flex h-full min-h-0 w-full items-center ${
          compact
            ? 'flex-col justify-center gap-5 text-center'
            : 'justify-center gap-10'
        }`}
      >
        <div
          className={`flex flex-col gap-3 ${
            compact ? 'items-center' : 'flex-1 max-w-[55%]'
          }`}
        >
          <h2 className="text-heading font-semibold text-gold tracking-tight">
            {title}
          </h2>
          <GoldAccent centered={compact} />
          <p className="text-subheading font-medium text-text-secondary leading-relaxed">
            {instruction}
          </p>
          <p className="text-body text-text-muted max-w-[28rem]">
            Donations are not available for this screen yet. Ask your
            administrator to enable online donations.
          </p>
        </div>
        <div
          className={`aspect-square shrink-0 rounded-2xl bg-surface animate-shimmer ${
            compact ? 'w-[11rem]' : 'w-[10rem]'
          }`}
          aria-hidden
        />
      </div>
    );
  }

  /*
   * QR container class — sized proportionally so the code is prominent
   * without overwhelming the copy. Smaller when a thermometer is present
   * to leave room for the progress bar in the vertical stack.
   */
  const portraitQrClass = progressFocus
    ? 'w-[9rem]'
    : thermometer
      ? 'w-[10rem]'
      : 'w-[11rem]';

  const landscapeQrClass = progressFocus ? 'w-[11rem]' : 'w-[14rem]';

  /* ─── Portrait (compact) ───────────────────────────────────── */
  if (compact) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-3">
        {/* Copy block */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h2 className="text-heading font-semibold text-gold tracking-tight">
            {title}
          </h2>
          <GoldAccent centered />
          <p className="text-subheading font-medium text-text-secondary leading-snug max-w-[30rem] mt-0.5">
            {instruction}
          </p>
        </div>

        {/* Thermometer first when campaign progress is the focus */}
        {progressFocus && thermometer && (
          <div className="w-full max-w-[24rem] px-2">{thermometer}</div>
        )}

        {/* QR */}
        <div
          ref={qrRef}
          className={`aspect-square shrink-0 ${portraitQrClass}`}
        >
          <BrandedQrFrame url={donationUrl} measuredSize={qrPx} />
        </div>

        {/* Wallet badges */}
        {badges}

        {/* Thermometer in secondary position when QR is the focus */}
        {!progressFocus && thermometer && (
          <div className="w-full max-w-[24rem] px-2">{thermometer}</div>
        )}
      </div>
    );
  }

  /* ─── Landscape ────────────────────────────────────────────── */
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center">
      {/*
       * Inner block: constrained max-width so copy and QR sit close
       * together rather than being pushed to opposite edges of the
       * wide carousel band.
       */}
      <div className="flex w-full max-w-[56rem] items-center gap-10">
        {/* Left column — copy, thermometer, badges */}
        <div className="flex flex-1 min-w-0 flex-col justify-center gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-heading font-semibold text-gold tracking-tight">
              {title}
            </h2>
            <GoldAccent />
          </div>

          <p className="text-subheading font-medium text-text-secondary leading-relaxed">
            {instruction}
          </p>

          {thermometer && (
            <div className="w-full">{thermometer}</div>
          )}

          {badges}
        </div>

        {/* Vertical divider */}
        <div className="h-[7rem] w-px shrink-0 bg-border" aria-hidden />

        {/* Right column — QR + caption */}
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div
            ref={qrRef}
            className={`aspect-square ${landscapeQrClass}`}
          >
            <BrandedQrFrame url={donationUrl} measuredSize={qrPx} />
          </div>
          <p className="text-caption text-text-muted">Scan to donate</p>
        </div>
      </div>
    </div>
  );
};

export default React.memo(DonationSlide);

/**
 * MasjidLogo
 *
 * The mosque's own uploaded logo (Growth+ plan feature).
 *
 * Placement modes:
 *  - **LogoRail** — compact corner/crown strip inside the content zone only
 *    (carousel, supplications). Sizes are tuned for in-flow layout — smaller
 *    than the old floating overlay so content keeps most of the band.
 *  - **ContentLogoFrame** — wraps the content slot with LogoRail above it.
 *  - **Header dock** — inline in the header row when a full-width header is
 *    visible (see Header's `logo` prop).
 *  - **Footer** — inline badge via `FooterLeadingLogo`.
 *
 * The image is cached by the service worker's image cache, so it keeps
 * rendering offline.
 */

import React, { useEffect, useState } from 'react';
import type {
  DisplayLogoBackground,
  DisplayLogoConfig,
  DisplayLogoSize,
} from '../../types/displayLayout';

const FOOTER_HEIGHT: Record<DisplayLogoSize, string> = {
  small: 'h-6',
  medium: 'h-8',
  large: 'h-10',
};

/** In-flow rail marks — compact so the carousel band keeps height. */
const RAIL_MARK_HEIGHT: Record<DisplayLogoSize, string> = {
  small: 'h-8',
  medium: 'h-10',
  large: 'h-12',
};

const RAIL_MAX_WIDTH: Record<DisplayLogoSize, string> = {
  small: 'max-w-28',
  medium: 'max-w-36',
  large: 'max-w-44',
};

/** Portrait crown — slightly smaller than landscape. */
const PORTRAIT_RAIL_MARK_HEIGHT: Record<DisplayLogoSize, string> = {
  small: 'h-7',
  medium: 'h-9',
  large: 'h-10',
};

const PORTRAIT_HEADER_HEIGHT: Record<DisplayLogoSize, string> = {
  small: 'h-8',
  medium: 'h-10',
  large: 'h-12',
};

const BACKGROUND_CHIP: Record<DisplayLogoBackground, string> = {
  none: '',
  light: 'bg-white/90 rounded-lg px-1.5 py-1',
  dark: 'bg-black/35 rounded-lg px-1.5 py-1',
};

interface LogoBadgeProps {
  src: string;
  background: DisplayLogoBackground;
  heightClass: string;
  maxWidthClass: string;
  onError?: () => void;
}

/** Bare logo mark — reused by LogoRail, Header dock, and footer placement. */
export const LogoBadge: React.FC<LogoBadgeProps> = ({
  src,
  background,
  heightClass,
  maxWidthClass,
  onError,
}) => (
  <span
    className={`inline-flex items-center justify-center shrink-0 box-border ${heightClass} ${BACKGROUND_CHIP[background]}`}
  >
    <img
      src={src}
      alt="Masjid logo"
      draggable={false}
      onError={onError}
      className={`h-full w-auto object-contain ${maxWidthClass}`}
    />
  </span>
);

/** Height class for a logo badge docked inline in the header row. */
export function headerBadgeHeightClass(size: DisplayLogoSize): string {
  return FOOTER_HEIGHT[size];
}

/** Height class for a logo centred in the portrait header banner. */
export function portraitHeaderBadgeHeightClass(size: DisplayLogoSize): string {
  return PORTRAIT_HEADER_HEIGHT[size];
}

/** Height class for the mark inside a top brand rail. */
export function logoRailMarkHeightClass(size: DisplayLogoSize, portrait: boolean): string {
  return portrait ? PORTRAIT_RAIL_MARK_HEIGHT[size] : RAIL_MARK_HEIGHT[size];
}

export function logoRailMaxWidthClass(size: DisplayLogoSize, portrait: boolean): string {
  return portrait ? 'max-w-[min(55%,12rem)]' : RAIL_MAX_WIDTH[size];
}

interface LogoRailProps {
  src: string;
  config: DisplayLogoConfig;
  /** Portrait orientation — centres the mark in the rail. */
  portrait?: boolean;
}

/**
 * Compact brand rail — lives inside the content zone so prayer chrome and
 * headers are unaffected. Reserves only the logo's footprint in height.
 */
export const LogoRail: React.FC<LogoRailProps> = ({ src, config, portrait = false }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || config.position === 'footer') return null;

  const alignClass = portrait
    ? 'justify-center'
    : config.position === 'top-left'
      ? 'justify-start'
      : 'justify-end';

  return (
    <div
      className={`relative shrink-0 w-full flex items-center ${alignClass} px-0.5 py-0.5`}
      data-logo-rail=""
      data-logo-position={portrait ? 'top-centre' : config.position}
      data-logo-size={config.size}
    >
      <LogoBadge
        src={src}
        background={config.background}
        heightClass={logoRailMarkHeightClass(config.size, portrait)}
        maxWidthClass={logoRailMaxWidthClass(config.size, portrait)}
        onError={() => setFailed(true)}
      />
    </div>
  );
};

interface ContentLogoFrameProps {
  logo: React.ReactNode;
  children: React.ReactNode;
}

/** Wraps carousel / supplication slots with a compact logo rail above the content. */
export const ContentLogoFrame: React.FC<ContentLogoFrameProps> = ({ logo, children }) => (
  <div className="flex h-full min-h-0 w-full flex-col">
    {logo}
    <div className="flex min-h-0 flex-1 flex-col">{children}</div>
  </div>
);

interface FooterLeadingLogoProps {
  src: string;
  config: DisplayLogoConfig;
}

/** Inline footer badge when `config.position === 'footer'`. */
export const FooterLeadingLogo: React.FC<FooterLeadingLogoProps> = ({ src, config }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || config.position !== 'footer') return null;

  return (
    <LogoBadge
      src={src}
      background={config.background}
      heightClass={FOOTER_HEIGHT[config.size]}
      maxWidthClass="max-w-32"
      onError={() => setFailed(true)}
    />
  );
};

/** @deprecated Use LogoRail or FooterLeadingLogo — kept for import stability. */
interface MasjidLogoProps {
  src: string;
  config: DisplayLogoConfig;
  portrait?: boolean;
}

const MasjidLogo: React.FC<MasjidLogoProps> = ({ src, config, portrait = false }) => {
  if (config.position === 'footer') {
    return <FooterLeadingLogo src={src} config={config} />;
  }
  return <LogoRail src={src} config={config} portrait={portrait} />;
};

export default React.memo(MasjidLogo);

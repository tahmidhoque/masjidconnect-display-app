/**
 * JamaatContentOverlay
 *
 * Full logical-viewport library media during jamaat-in-progress when
 * `jamaatInProgressMode` is `content`. Portalled into `#orientation-portal-root`
 * so rotation-aware coverage matches the blackout overlay.
 *
 * Video loops muted for the congregation window. Missing assets stay on the
 * black underlay; callers fall back to InPrayerScreen when media does not resolve.
 */

import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCachedMediaUrl } from '@/hooks/useCachedMediaUrl';
import type { JamaatInProgressMedia } from '@/utils/jamaatInProgressContent';

const VideoSlide = lazy(() => import('./VideoSlide'));
const MediaPdfPage = lazy(() => import('./MediaPdfPage'));

export interface JamaatContentOverlayProps {
  media: JamaatInProgressMedia;
}

function resolvePortalRoot(): HTMLElement {
  return document.getElementById('orientation-portal-root') ?? document.body;
}

const JamaatContentOverlay: React.FC<JamaatContentOverlayProps> = ({ media }) => {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const resolvedUrl = useCachedMediaUrl(media.url) ?? media.url;

  useEffect(() => {
    setPortalRoot(resolvePortalRoot());
  }, []);

  if (!portalRoot || !resolvedUrl) return null;

  const fit = media.fit === 'cover' ? 'cover' : media.fit === 'smart' ? 'smart' : 'contain';

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] flex min-h-0 w-full flex-col overflow-hidden bg-black pointer-events-none gpu-accelerated"
      data-testid="jamaat-content-overlay"
      aria-label={media.title ?? 'Jamaat in progress'}
    >
      {media.kind === 'video' ? (
        <Suspense fallback={null}>
          <VideoSlide
            url={resolvedUrl}
            title={media.title}
            fit={fit === 'smart' ? 'contain' : fit}
            muted={media.muted}
            loop
            className="min-h-0 flex-1"
          />
        </Suspense>
      ) : media.kind === 'pdf' ? (
        <Suspense fallback={null}>
          <MediaPdfPage
            url={resolvedUrl}
            title={media.title ?? 'Poster'}
            fit={fit === 'cover' ? 'cover' : 'contain'}
            mode={fit === 'cover' ? 'cover' : 'contain'}
            className="min-h-0 flex-1"
          />
        </Suspense>
      ) : fit === 'smart' ? (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <img
            src={resolvedUrl}
            alt=""
            aria-hidden
            className="gpu-accelerated absolute inset-0 h-full w-full scale-110 object-cover object-center"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-black/40" aria-hidden />
          <img
            src={resolvedUrl}
            alt=""
            className="gpu-accelerated relative h-full w-full object-contain object-center"
            loading="eager"
            decoding="async"
          />
        </div>
      ) : (
        <img
          src={resolvedUrl}
          alt=""
          className={`gpu-accelerated h-full w-full ${
            fit === 'cover' ? 'object-cover' : 'object-contain'
          } object-center`}
          loading="eager"
          decoding="async"
        />
      )}
    </div>,
    portalRoot,
  );
};

export default React.memo(JamaatContentOverlay);

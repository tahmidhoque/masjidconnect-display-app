/**
 * Renders a looping video clip for the carousel (VIDEO content type).
 *
 * Autoplays muted by default — browsers only reliably autoplay muted video, and
 * most signage screens have no audio output. When `muted` is false we still try
 * to play with sound and fall back to muted playback if the browser blocks it.
 *
 * Plays once and fires `onEnded` so the carousel advances; when it is the only
 * slide (`loop`) it loops instead of ending. Follows the project memory rule:
 * all listeners are removed and the media buffer released on unmount.
 */

import React, { useEffect, useRef } from 'react';
import type { MediaFit } from '../../utils/mediaSlide';
import logger from '@/utils/logger';

export interface VideoSlideProps {
  url: string;
  title?: string;
  /** smart/contain letterbox on a dark stage; cover crops to fill. */
  fit: MediaFit;
  /** Play muted (default true). */
  muted: boolean;
  /** Loop in place instead of ending (used when this is the only slide). */
  loop: boolean;
  /** Fires once when the first frame is ready (or load failed) — gates the enter animation. */
  onReady?: () => void;
  /** Fires when the clip ends (not called while `loop` is true) — advances the carousel. */
  onEnded?: () => void;
  className?: string;
}

const VideoSlide: React.FC<VideoSlideProps> = ({
  url,
  title,
  fit,
  muted,
  loop,
  onReady,
  onEnded,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readyFiredRef = useRef(false);
  const onReadyRef = useRef(onReady);
  const onEndedRef = useRef(onEnded);
  onReadyRef.current = onReady;
  onEndedRef.current = onEnded;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    readyFiredRef.current = false;

    const fireReadyOnce = () => {
      if (readyFiredRef.current) return;
      readyFiredRef.current = true;
      onReadyRef.current?.();
    };

    const handleLoadedData = () => fireReadyOnce();
    const handleEnded = () => onEndedRef.current?.();
    const handleError = () => {
      logger.error('[VideoSlide] Failed to load video', { url });
      // Reveal + advance so a broken clip never freezes the carousel.
      fireReadyOnce();
      if (!loop) onEndedRef.current?.();
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    // Attempt autoplay; if sound is requested but blocked, retry muted.
    video.muted = muted;
    const tryPlay = () => {
      try {
        const p = video.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            if (!video.muted) {
              video.muted = true;
              const retry = video.play();
              if (retry && typeof retry.catch === 'function') {
                retry.catch(() => {
                  /* Autoplay still blocked — leave paused; safety-cap timer advances. */
                });
              }
            }
          });
        }
      } catch {
        /* play() not supported (e.g. jsdom) — listeners still drive ready/advance. */
      }
    };
    tryPlay();

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      // Release the decoded buffer (memory discipline).
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {
        /* no-op */
      }
    };
  }, [url, muted, loop]);

  const objectFit = fit === 'cover' ? 'object-cover' : 'object-contain';

  return (
    <div
      className={`relative flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-midnight ${className}`}
      aria-label={title ?? 'Video'}
    >
      <video
        ref={videoRef}
        src={url}
        autoPlay
        muted={muted}
        loop={loop}
        playsInline
        preload="auto"
        className={`gpu-accelerated h-full w-full ${objectFit}`}
      />
    </div>
  );
};

export default React.memo(VideoSlide);

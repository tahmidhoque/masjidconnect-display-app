/**
 * Tests for VideoSlide — autoplay attributes, ready + ended callbacks.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import VideoSlide from './VideoSlide';

// jsdom does not implement media playback — stub so play/pause/load are no-ops.
beforeAll(() => {
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
  HTMLMediaElement.prototype.load = vi.fn();
});

function getVideo(container: HTMLElement): HTMLVideoElement {
  const el = container.querySelector('video');
  if (!el) throw new Error('no <video> rendered');
  return el as HTMLVideoElement;
}

describe('VideoSlide', () => {
  it('renders a muted, looping video with the given url and cover fit', () => {
    const { container } = render(
      <VideoSlide url="https://cdn.example.com/a.mp4" fit="cover" muted loop />,
    );
    const video = getVideo(container);
    expect(video.getAttribute('src')).toBe('https://cdn.example.com/a.mp4');
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.className).toContain('object-cover');
  });

  it('uses object-contain for non-cover fits', () => {
    const { container } = render(
      <VideoSlide url="https://cdn.example.com/a.mp4" fit="contain" muted loop={false} />,
    );
    expect(getVideo(container).className).toContain('object-contain');
  });

  it('fires onReady once when the first frame loads', () => {
    const onReady = vi.fn();
    const { container } = render(
      <VideoSlide url="https://cdn.example.com/a.mp4" fit="contain" muted loop={false} onReady={onReady} />,
    );
    fireEvent(getVideo(container), new Event('loadeddata'));
    fireEvent(getVideo(container), new Event('loadeddata'));
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('advances via onEnded when the clip ends', () => {
    const onEnded = vi.fn();
    const { container } = render(
      <VideoSlide url="https://cdn.example.com/a.mp4" fit="contain" muted loop={false} onEnded={onEnded} />,
    );
    fireEvent(getVideo(container), new Event('ended'));
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('reveals and advances if the video errors (never freezes the carousel)', () => {
    const onReady = vi.fn();
    const onEnded = vi.fn();
    const { container } = render(
      <VideoSlide
        url="https://cdn.example.com/broken.mp4"
        fit="contain"
        muted
        loop={false}
        onReady={onReady}
        onEnded={onEnded}
      />,
    );
    fireEvent(getVideo(container), new Event('error'));
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onEnded).toHaveBeenCalledTimes(1);
  });
});

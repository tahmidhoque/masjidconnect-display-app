/**
 * Render tests for the jamaat-in-progress library media overlay.
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import JamaatContentOverlay from './JamaatContentOverlay';
import type { JamaatInProgressMedia } from '@/utils/jamaatInProgressContent';

vi.mock('@/hooks/useCachedMediaUrl', () => ({
  useCachedMediaUrl: (url: string) => url,
}));

describe('JamaatContentOverlay', () => {
  it('renders a fullscreen image overlay', () => {
    const media: JamaatInProgressMedia = {
      kind: 'image',
      url: 'https://cdn.example.com/salaah.webp',
      title: 'Salaah in progress',
      fit: 'cover',
      muted: true,
    };
    render(React.createElement(JamaatContentOverlay, { media }));
    const overlay = screen.getByTestId('jamaat-content-overlay');
    expect(overlay).toBeInTheDocument();
    const img = overlay.querySelector('img');
    expect(img).toHaveAttribute('src', media.url);
  });
});

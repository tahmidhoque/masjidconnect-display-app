/**
 * Tests for ContentCarousel — DUA content type and transliteration.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('./MediaPdfPage', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Vitest hoists mocks before ESM imports; need React in factory scope
  const React = require('react') as typeof import('react');
  return {
    default: function MockMediaPdfPage({
      url,
      title,
      onReady,
    }: {
      url: string;
      title?: string;
      onReady?: () => void;
    }) {
      React.useEffect(() => {
        onReady?.();
      }, [onReady]);
      return <div data-media-pdf-page="" data-url={url} title={title ?? undefined} />;
    },
  };
});

import ContentCarousel from './ContentCarousel';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn().mockImplementation((callback: () => void) => {
      callback();
      return { observe: vi.fn(), disconnect: vi.fn(), unobserve: vi.fn() };
    }),
  );
});

describe('ContentCarousel', () => {
  it('renders DUA title and body without a type chip', () => {
    const items = [
      {
        id: 'dua-1',
        type: 'DUA',
        title: 'Dua for guidance',
        arabicBody: 'اَهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ',
        transliteration: 'Ihdina as-sirata al-mustaqim',
        body: 'Guide us to the straight path',
        source: 'Surah Al-Fatiha',
        duration: 25,
      },
    ];
    render(<ContentCarousel items={items} interval={30} />);
    expect(screen.getByText('Dua for guidance')).toBeInTheDocument();
    expect(document.querySelector('.badge-dua')).not.toBeInTheDocument();
  });

  it('renders transliteration in an LTR paragraph when present', () => {
    const items = [
      {
        id: 'dua-1',
        type: 'DUA',
        title: 'Dua',
        transliteration: 'Ihdina as-sirata al-mustaqim',
        body: 'Guide us to the straight path',
        duration: 25,
      },
    ];
    render(<ContentCarousel items={items} interval={30} />);
    expect(screen.getByText('Ihdina as-sirata al-mustaqim')).toBeInTheDocument();
    const transliterationEl = screen.getByText('Ihdina as-sirata al-mustaqim');
    expect(transliterationEl).toHaveAttribute('dir', 'ltr');
  });

  it('renders non-DUA slide title without type chip', () => {
    const items = [
      {
        id: 'hadith-1',
        type: 'VERSE_HADITH',
        title: 'Hadith',
        body: 'A hadith text',
        duration: 30,
      },
    ];
    render(<ContentCarousel items={items} interval={30} />);
    expect(screen.getByText('Hadith')).toBeInTheDocument();
    expect(screen.queryByText('Verse & Hadith')).not.toBeInTheDocument();
    expect(document.querySelector('.badge-emerald')).not.toBeInTheDocument();
  });

  it('renders without crashing when items is empty', () => {
    const { container } = render(<ContentCarousel items={[]} interval={30} />);
    expect(container).toBeInTheDocument();
  });

  it('renders the same body content in landscape and portrait (compact) mode', () => {
    const items = [
      {
        id: 'ann-1',
        type: 'ANNOUNCEMENT',
        title: 'Masjid Email Address',
        body: 'admin@example-masjid.org',
        duration: 20,
      },
    ];
    const { unmount } = render(<ContentCarousel items={items} interval={30} compact={false} />);
    expect(screen.getByText('admin@example-masjid.org')).toBeInTheDocument();
    unmount();

    render(<ContentCarousel items={items} interval={30} compact={true} />);
    expect(screen.getByText('admin@example-masjid.org')).toBeInTheDocument();
  });

  it('holds the slide invisible until the fit loop reports done', async () => {
    const items = [
      {
        id: 'flash-1',
        type: 'ANNOUNCEMENT',
        title: 'Email',
        body: 'admin@example.org',
        duration: 20,
      },
    ];
    const { container } = render(<ContentCarousel items={items} interval={30} />);
    const wrapper = container.querySelector('.gpu-accelerated');
    // Before the fit loop has run, the wrapper should be held at opacity 0.
    // The fade-in animation must not be on the element yet, otherwise the
    // user would see the text scale up while the binary search runs.
    expect(wrapper?.className).toContain('opacity-0');
    expect(wrapper?.className).not.toContain('animate-fade-in');

    // After the fit loop schedules its first RAF and bails out (JSDOM
    // reports zero clientHeight), `isFitted` flips true and the standard
    // fade-in is applied for the reveal.
    await waitFor(() => {
      const w = container.querySelector('.gpu-accelerated');
      expect(w?.className).toContain('animate-fade-in');
    });
  });

  it('renders sanitised HTML body content in compact mode', () => {
    const items = [
      {
        id: 'html-1',
        type: 'ANNOUNCEMENT',
        title: 'Contact',
        body: '<ul><li>Phone</li><li>Email</li></ul>',
        bodyIsHTML: true,
        duration: 20,
      },
    ];
    render(<ContentCarousel items={items} interval={30} compact={true} />);
    // sanitiseHtml allows <ul>/<li>, so the markup should appear in the DOM.
    expect(document.querySelector('ul')).toBeInTheDocument();
    expect(screen.getByText('Phone')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders MEDIA_SLIDE image with object-cover when fullscreen', () => {
    const items = [
      {
        id: 'ms-img-1',
        type: 'MEDIA_SLIDE',
        title: 'Ramadan poster',
        mediaUrl: 'https://cdn.example.com/poster.webp',
        mediaKind: 'image' as const,
        fullscreen: true,
        duration: 25,
      },
    ];
    render(<ContentCarousel items={items} interval={30} />);
    const img = document.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://cdn.example.com/poster.webp');
    expect(img?.getAttribute('alt')).toBe('');
    expect(img?.className).toContain('object-cover');
  });

  it('renders MEDIA_SLIDE image with object-contain when not fullscreen', () => {
    const items = [
      {
        id: 'ms-img-2',
        type: 'MEDIA_SLIDE',
        title: 'Poster',
        mediaUrl: 'https://cdn.example.com/a.png',
        mediaKind: 'image' as const,
        fullscreen: false,
        duration: 20,
      },
    ];
    render(<ContentCarousel items={items} interval={30} />);
    const img = document.querySelector('img');
    expect(img?.className).toContain('object-contain');
  });

  it('renders MEDIA_SLIDE PDF with the canvas viewer (not an iframe)', () => {
    const items = [
      {
        id: 'ms-pdf',
        type: 'MEDIA_SLIDE',
        title: 'Fundraising leaflet',
        mediaUrl: 'https://cdn.example.com/info.pdf',
        mediaKind: 'pdf' as const,
        duration: 40,
      },
    ];
    render(<ContentCarousel items={items} interval={30} />);
    const pdfRoot = document.querySelector('[data-media-pdf-page]');
    expect(pdfRoot).toBeTruthy();
    expect(pdfRoot?.getAttribute('data-url')).toBe('https://cdn.example.com/info.pdf');
    expect(pdfRoot?.getAttribute('title')).toBe('Fundraising leaflet');
    expect(document.querySelector('iframe')).not.toBeInTheDocument();
  });

  it('renders viewport fullscreen portal for fullscreen MEDIA_SLIDE in landscape', async () => {
    const items = [
      {
        id: 'fs-1',
        type: 'MEDIA_SLIDE',
        mediaUrl: 'https://example.com/p.jpg',
        mediaKind: 'image' as const,
        fullscreen: true,
        duration: 15,
      },
    ];
    render(<ContentCarousel items={items} interval={30} compact={false} />);
    expect(document.querySelector('[data-fullscreen-media-overlay]')).toBeTruthy();
    const overlay = document.querySelector('[data-fullscreen-media-overlay]');
    expect(overlay?.className).toContain('fixed');
    expect(overlay?.className).toContain('inset-0');
    const img = overlay?.querySelector('img');
    expect(img).toBeTruthy();
    fireEvent.load(img!);
    const mediaLayer = document.querySelector('[data-fullscreen-portal-media]');
    await waitFor(() => {
      expect(mediaLayer?.className).toContain('animate-carousel-enter-from-right');
    });
  });

  it('shows carousel dots at the bottom of the fullscreen portal when multiple slides', () => {
    const items = [
      {
        id: 'fs-a',
        type: 'MEDIA_SLIDE',
        mediaUrl: 'https://example.com/a.jpg',
        mediaKind: 'image' as const,
        fullscreen: true,
        duration: 10,
      },
      {
        id: 'fs-b',
        type: 'MEDIA_SLIDE',
        mediaUrl: 'https://example.com/b.jpg',
        mediaKind: 'image' as const,
        fullscreen: true,
        duration: 10,
      },
    ];
    render(<ContentCarousel items={items} interval={30} compact={false} />);
    const bar = document.querySelector('[data-carousel-pagination="fullscreen"]');
    expect(bar).toBeTruthy();
    expect(bar?.querySelector('[data-carousel-pagination]')).toBeTruthy();
  });

  it('falls back to text layout when MEDIA_SLIDE row lacks mediaKind', () => {
    const items = [
      {
        id: 'bad-ms',
        type: 'MEDIA_SLIDE',
        title: 'Broken',
        mediaUrl: 'https://example.com/x.png',
        duration: 10,
      },
    ];
    render(<ContentCarousel items={items} interval={30} />);
    expect(document.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('Broken')).toBeInTheDocument();
  });

  it('renders DONATION slide with QR when donationUrl is set', async () => {
    const items = [
      {
        id: 'don-1',
        type: 'DONATION',
        title: 'Donate',
        donationUrl: 'https://portal.example.org/donate/m?source=screen_qr',
        donationShowWalletBadges: true,
        duration: 30,
      },
    ];
    render(<ContentCarousel items={items} interval={30} />);
    await waitFor(() => {
      expect(document.querySelector('svg')).toBeTruthy();
    });
  });

  it('renders DONATION empty state when donationUrl is null', async () => {
    const items = [
      {
        id: 'don-2',
        type: 'DONATION',
        title: 'Donate',
        donationUrl: null as string | null,
        duration: 20,
      },
    ];
    render(<ContentCarousel items={items} interval={30} />);
    await waitFor(() => {
      expect(screen.getByText(/not available for this screen/i)).toBeInTheDocument();
    });
  });
});

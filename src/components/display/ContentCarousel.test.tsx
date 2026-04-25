/**
 * Tests for ContentCarousel — DUA content type and transliteration.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
});

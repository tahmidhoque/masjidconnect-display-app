/**
 * Tests for ContentCarousel — DUA content type and transliteration.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});

/**
 * Tests for ContentCarousel — DUA content type, badge, and transliteration.
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
  it('renders DUA type label and badge-dua class for DUA items', () => {
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
    const badge = screen.getByText('Dua');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('badge-dua');
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

  it('uses badge-emerald for non-DUA types', () => {
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
    const badge = screen.getByText('Verse & Hadith');
    expect(badge).toHaveClass('badge-emerald');
    expect(badge).not.toHaveClass('badge-dua');
  });

  it('renders without crashing when items is empty', () => {
    const { container } = render(<ContentCarousel items={[]} interval={30} />);
    expect(container).toBeInTheDocument();
  });
});

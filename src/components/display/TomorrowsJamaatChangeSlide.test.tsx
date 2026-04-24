/**
 * Tests for TomorrowsJamaatChangeSlide.
 *
 * Pure presentational component — these tests pin the visible contract
 * (badge / title / time) for both layout variants. The portrait variant
 * deliberately mirrors the landscape split: no "make a note of the new
 * time" subnote on either, since the calendar motif already carries the
 * "this is for tomorrow" semantic and the time itself is the focal point.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, AllTheProviders } from '@/test-utils';
import TomorrowsJamaatChangeSlide from './TomorrowsJamaatChangeSlide';

const renderSlide = (
  props: React.ComponentProps<typeof TomorrowsJamaatChangeSlide>,
) =>
  render(
    React.createElement(
      AllTheProviders,
      null,
      React.createElement(TomorrowsJamaatChangeSlide, props),
    ),
  );

describe('TomorrowsJamaatChangeSlide — portrait variant', () => {
  it('renders the "From tomorrow" badge, title and time', () => {
    renderSlide({ prayerName: 'Zuhr', tomorrowTime: '13:30' });

    expect(screen.getByText('From tomorrow')).toBeInTheDocument();
    expect(screen.getByText(/Zuhr Jamaat will be at/i)).toBeInTheDocument();
    // Default time format is 12h → "13:30" → "1:30" + "pm".
    expect(screen.getByText('1:30')).toBeInTheDocument();
    expect(screen.getByText('pm')).toBeInTheDocument();
  });

  it('does not render the "make a note of the new time" subnote', () => {
    // Consistency contract: portrait must match the landscape split — no
    // subnote on either variant. The calendar motif and "From tomorrow"
    // badge already carry the "this is for tomorrow" semantic, and a
    // subnote would re-introduce the visual asymmetry between the two
    // layouts. Guard against well-meaning future copy/paste that re-adds it.
    renderSlide({ prayerName: 'Zuhr', tomorrowTime: '13:30' });
    expect(
      screen.queryByText('Please make a note of the new time'),
    ).not.toBeInTheDocument();
  });

  it('renders the calendar motif as a visual anchor', () => {
    // Regression: the portrait carousel band is `flex-1` (tall). Without a
    // visual anchor the text content collapses to the centre with large
    // empty margins. Mirrors SilentPhonesGraphic's prohibition SVG. The
    // motif lives on a wrapper with the dedicated sizing class so the
    // element MUST be present for the visual rhythm to hold.
    const { container } = renderSlide({
      prayerName: 'Zuhr',
      tomorrowTime: '13:30',
    });
    expect(
      container.querySelector('.tomorrows-jamaat-change-motif'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.tomorrows-jamaat-change-motif svg'),
    ).toBeInTheDocument();
  });

  it('uses the dedicated tomorrows-jamaat-change-title class on the title', () => {
    // Regression: the title was previously `text-heading` which was visibly
    // undersized next to the new motif. The dedicated class owns the
    // bumped size — losing it would re-introduce the imbalance.
    renderSlide({ prayerName: 'Zuhr', tomorrowTime: '13:30' });
    const title = screen.getByText(/Zuhr Jamaat will be at/i);
    expect(title).toHaveClass('tomorrows-jamaat-change-title');
    expect(title).not.toHaveClass('text-heading');
  });
});

describe('TomorrowsJamaatChangeSlide — landscape split variant', () => {
  it('renders the split wrapper, title and time but no subnote line', () => {
    const { container } = renderSlide({
      prayerName: 'Asr',
      tomorrowTime: '16:45',
      landscapeSplit: true,
    });

    expect(
      container.querySelector('.tomorrows-jamaat-change--split'),
    ).toBeInTheDocument();
    expect(screen.getByText('From tomorrow')).toBeInTheDocument();
    expect(screen.getByText(/Asr Jamaat will be at/i)).toBeInTheDocument();
    expect(screen.getByText('4:45')).toBeInTheDocument();
    expect(screen.getByText('pm')).toBeInTheDocument();
    // The split layout intentionally omits the "make a note" subnote — the
    // calendar motif on the left already carries that semantic, and the
    // narrower right column has no room for a third line. Guard against a
    // well-meaning future copy/paste that re-adds it.
    expect(
      screen.queryByText('Please make a note of the new time'),
    ).not.toBeInTheDocument();
    // The split layout has its own motif wrapper styling — the portrait
    // sizing class must NOT leak in (different aspect ratio target).
    expect(
      container.querySelector('.tomorrows-jamaat-change-motif'),
    ).not.toBeInTheDocument();
  });

  it('uses split-specific typography classes for title and time', () => {
    const { container } = renderSlide({
      prayerName: 'Isha',
      tomorrowTime: '21:30',
      landscapeSplit: true,
    });

    expect(
      container.querySelector('.tomorrows-jamaat-change-split-title'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.tomorrows-jamaat-change-split-time'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.tomorrows-jamaat-change-split-period'),
    ).toBeInTheDocument();
  });
});

describe('TomorrowsJamaatChangeSlide — Jumuah relabel', () => {
  it('uses the literal prayerName passed in (slot already resolved label)', () => {
    // JamaatSoonSlot resolves the "Jumuah" relabel upstream via
    // resolveTomorrowChange — by the time this slide renders, the prayer
    // name is final. Guard that we don't accidentally re-translate or
    // override it (e.g. if someone wires terminology to the wrong key).
    renderSlide({ prayerName: 'Jumuah', tomorrowTime: '13:15' });
    expect(screen.getByText(/Jumuah Jamaat will be at/i)).toBeInTheDocument();
  });
});

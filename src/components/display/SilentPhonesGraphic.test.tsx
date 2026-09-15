/**
 * SilentPhonesGraphic — announcement copy includes the active prayer name.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SilentPhonesGraphic from './SilentPhonesGraphic';
import { AllTheProviders, createTestStore } from '@/test-utils';
import { DEFAULT_DISPLAY_SETTINGS } from '@/store/slices/contentSlice';
import type { DisplaySettings } from '@/api/models';

function renderGraphic(
  props: React.ComponentProps<typeof SilentPhonesGraphic> = {},
  displaySettings: DisplaySettings | null = DEFAULT_DISPLAY_SETTINGS,
) {
  const store = createTestStore();
  const contentState = store.getState().content;
  const preloaded = {
    content: {
      ...contentState,
      displaySettings,
    },
  };

  return render(
    React.createElement(
      AllTheProviders,
      { preloadedState: preloaded } as React.ComponentProps<typeof AllTheProviders>,
      React.createElement(SilentPhonesGraphic, props),
    ),
  );
}

describe('SilentPhonesGraphic', () => {
  it('includes the active prayer name in the Jamaat announcement', () => {
    renderGraphic({ prayerName: 'Maghrib' });

    expect(
      screen.getByText('or turn it off before Maghrib Jamaat begins'),
    ).toBeInTheDocument();
    expect(screen.getByText('Maghrib Jamaat is about to begin')).toBeInTheDocument();
  });

  it('falls back to generic Jamaat when no prayer name is given', () => {
    renderGraphic();

    expect(screen.getByText('or turn it off before Jamaat begins')).toBeInTheDocument();
    expect(screen.getByText('Jamaat is about to begin')).toBeInTheDocument();
  });

  it('uses Jumuah terminology on Friday Zuhr', () => {
    renderGraphic({ prayerName: 'Zuhr', isJumuah: true });

    expect(
      screen.getByText('or turn it off before Jumuah Jamaat begins'),
    ).toBeInTheDocument();
    expect(screen.getByText('Jumuah Jamaat is about to begin')).toBeInTheDocument();
  });

  it('honours custom prayer and Jamaat terminology', () => {
    renderGraphic(
      { prayerName: 'Maghrib' },
      {
        ...DEFAULT_DISPLAY_SETTINGS,
        terminology: { maghrib: 'Sunset', jamaat: 'Congregation' },
      },
    );

    expect(
      screen.getByText('or turn it off before Sunset Congregation begins'),
    ).toBeInTheDocument();
    expect(screen.getByText('Sunset Congregation is about to begin')).toBeInTheDocument();
  });
});

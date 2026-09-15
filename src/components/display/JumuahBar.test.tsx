/**
 * Tests for JumuahBar — single legacy pair and dual jumuahSessions[].
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import JumuahBar from './JumuahBar';
import { AllTheProviders } from '@/test-utils';

const contextRef: {
  upcomingJumuahSessions: Array<{ label: string; khutbah: string | null; jamaat: string }>;
  upcomingJumuahJamaatRaw: string | null;
  upcomingJumuahKhutbahRaw: string | null;
} = {
  upcomingJumuahSessions: [],
  upcomingJumuahJamaatRaw: null,
  upcomingJumuahKhutbahRaw: null,
};

vi.mock('../../contexts/PrayerTimesContext', () => ({
  usePrayerTimesContext: () => contextRef,
}));

function renderBar() {
  return render(
    React.createElement(AllTheProviders, null, React.createElement(JumuahBar, { timeFormat: '12h' })),
  );
}

describe('JumuahBar', () => {
  it('renders nothing when no Jumu’ah times are available', () => {
    contextRef.upcomingJumuahSessions = [];
    contextRef.upcomingJumuahJamaatRaw = null;
    contextRef.upcomingJumuahKhutbahRaw = null;
    renderBar();
    expect(screen.queryByText(/Jumuah/i)).not.toBeInTheDocument();
  });

  it('falls back to the legacy single khutbah/jamaat pair', () => {
    contextRef.upcomingJumuahSessions = [];
    contextRef.upcomingJumuahJamaatRaw = '13:30';
    contextRef.upcomingJumuahKhutbahRaw = '13:00';
    renderBar();
    expect(screen.getByText(/Jumuah/i)).toBeInTheDocument();
    expect(screen.getByText(/Khutbah 1:00 PM/i)).toBeInTheDocument();
    expect(screen.getByText(/Jamaat 1:30 PM/i)).toBeInTheDocument();
  });

  it('renders every congregation in jumuahSessions[]', () => {
    contextRef.upcomingJumuahSessions = [
      { label: "1st Jumu'ah", khutbah: '13:00', jamaat: '13:30' },
      { label: "2nd Jumu'ah", khutbah: '14:15', jamaat: '14:45' },
    ];
    contextRef.upcomingJumuahJamaatRaw = '13:30';
    contextRef.upcomingJumuahKhutbahRaw = '13:00';
    renderBar();
    expect(screen.getByText("1st Jumu'ah")).toBeInTheDocument();
    expect(screen.getByText("2nd Jumu'ah")).toBeInTheDocument();
    expect(screen.getByText(/Khutbah 1:00 PM/i)).toBeInTheDocument();
    expect(screen.getByText(/Jamaat 1:30 PM/i)).toBeInTheDocument();
    expect(screen.getByText(/Khutbah 2:15 PM/i)).toBeInTheDocument();
    expect(screen.getByText(/Jamaat 2:45 PM/i)).toBeInTheDocument();
  });
});

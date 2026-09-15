/**
 * Tests for ConnectionBanner — healthy dot vs calm live-updates-paused pill.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import ConnectionBanner, { DISPLAY_DELAY_MS } from './ConnectionBanner';
import { AllTheProviders } from '@/test-utils';
import { LIVE_UPDATES_PAUSED_COPY } from '@/utils/connectionBannerLogic';
import type { ConnectionStatus } from '@/hooks/useConnectionStatus';

const mockConnection = vi.hoisted(() => ({
  value: {
    hasConnection: true,
    status: 'connected',
    message: '',
    severity: 'info',
    isReconnecting: false,
  } as ConnectionStatus,
}));

vi.mock('@/hooks/useConnectionStatus', () => ({
  __esModule: true,
  default: () => mockConnection.value,
}));

function renderBanner() {
  return render(
    React.createElement(AllTheProviders, null, React.createElement(ConnectionBanner)),
  );
}

async function flushDisplayDelay() {
  await act(async () => {
    vi.advanceTimersByTime(DISPLAY_DELAY_MS);
  });
}

describe('ConnectionBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockConnection.value = {
      hasConnection: true,
      status: 'connected',
      message: '',
      severity: 'info',
      isReconnecting: false,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hides the banner until the display delay elapses', () => {
    renderBanner();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a subtle connected indicator after the delay', async () => {
    renderBanner();
    await flushDisplayDelay();
    expect(screen.getByLabelText('Connected')).toBeInTheDocument();
    expect(screen.queryByText('Reconnecting…')).not.toBeInTheDocument();
    expect(screen.queryByText('Server Unreachable')).not.toBeInTheDocument();
  });

  it('shows calm Live updates paused copy when reconnecting, not Reconnecting…', async () => {
    mockConnection.value = {
      hasConnection: false,
      status: 'reconnecting',
      message: LIVE_UPDATES_PAUSED_COPY,
      severity: 'info',
      isReconnecting: true,
    };
    renderBanner();
    await flushDisplayDelay();
    expect(screen.getByText(LIVE_UPDATES_PAUSED_COPY)).toBeInTheDocument();
    expect(screen.queryByText('Reconnecting…')).not.toBeInTheDocument();
    expect(screen.queryByText(/Reconnecting/)).not.toBeInTheDocument();
  });

  it('shows the same paused copy when the realtime server is unreachable', async () => {
    mockConnection.value = {
      hasConnection: false,
      status: 'server-unreachable',
      message: LIVE_UPDATES_PAUSED_COPY,
      severity: 'info',
      isReconnecting: false,
    };
    renderBanner();
    await flushDisplayDelay();
    expect(screen.getByText(LIVE_UPDATES_PAUSED_COPY)).toBeInTheDocument();
    expect(screen.queryByText('Server Unreachable')).not.toBeInTheDocument();
  });

  it('still uses a distinct no-internet message, not live-updates-paused', async () => {
    mockConnection.value = {
      hasConnection: false,
      status: 'no-internet',
      message: 'No Internet',
      severity: 'error',
      isReconnecting: false,
    };
    renderBanner();
    await flushDisplayDelay();
    expect(screen.getByText(/No internet/i)).toBeInTheDocument();
    expect(screen.queryByText(LIVE_UPDATES_PAUSED_COPY)).not.toBeInTheDocument();
  });
});

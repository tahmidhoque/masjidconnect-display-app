/**
 * Tests for EmergencyAlertOverlay component.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmergencyAlertOverlay from './EmergencyAlertOverlay';
import { createTestStore, AllTheProviders } from '@/test-utils';
import { setCurrentAlert } from '@/store/slices/emergencySlice';
import { mockEmergencyAlert } from '@/test-utils/mocks';

vi.mock('@/utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe('EmergencyAlertOverlay', () => {
  it('renders nothing when no current alert', () => {
    const store = createTestStore();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        AllTheProviders,
        { preloadedState: store.getState() } as React.ComponentProps<typeof AllTheProviders>,
        children,
      );
    render(React.createElement(EmergencyAlertOverlay), { wrapper });
    expect(screen.queryByText(mockEmergencyAlert.title)).not.toBeInTheDocument();
  });

  it('renders alert title and message when currentAlert is set', () => {
    const store = createTestStore();
    store.dispatch(setCurrentAlert(mockEmergencyAlert));
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        AllTheProviders,
        { preloadedState: store.getState() } as React.ComponentProps<typeof AllTheProviders>,
        children,
      );
    render(React.createElement(EmergencyAlertOverlay), { wrapper });
    expect(screen.getByText(mockEmergencyAlert.title)).toBeInTheDocument();
    expect(screen.getByText(mockEmergencyAlert.message)).toBeInTheDocument();
  });
});

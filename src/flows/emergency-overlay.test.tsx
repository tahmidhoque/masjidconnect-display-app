/**
 * Integration test: emergency overlay appears and clears.
 */

import React from 'react';
import { Provider } from 'react-redux';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { createTestStore } from '@/test-utils';
import { setCurrentAlert, clearCurrentAlert } from '@/store/slices/emergencySlice';
import EmergencyAlertOverlay from '@/components/display/EmergencyAlertOverlay';
import { mockEmergencyAlert } from '@/test-utils/mocks';

vi.mock('@/utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe('Emergency overlay flow', () => {
  it('shows overlay when currentAlert is set and hides when cleared', async () => {
    const store = createTestStore();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(Provider, { store }, children);

    render(React.createElement(EmergencyAlertOverlay), { wrapper });
    expect(screen.queryByText(mockEmergencyAlert.title)).not.toBeInTheDocument();

    await act(async () => {
      store.dispatch(setCurrentAlert(mockEmergencyAlert));
    });
    await waitFor(() => {
      expect(screen.getByText(mockEmergencyAlert.title)).toBeInTheDocument();
    });
    expect(screen.getByText(mockEmergencyAlert.message)).toBeInTheDocument();

    await act(async () => {
      store.dispatch(clearCurrentAlert());
    });
    await waitFor(() => {
      expect(screen.queryByText(mockEmergencyAlert.title)).not.toBeInTheDocument();
    });
  });
});

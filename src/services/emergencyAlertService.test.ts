/**
 * Emergency alert service tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import emergencyAlertService from './emergencyAlertService';
import { mockEmergencyAlert } from '@/test-utils/mocks';

vi.mock('@/utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe('emergencyAlertService', () => {
  beforeEach(() => {
    emergencyAlertService.cleanup();
    vi.clearAllMocks();
  });

  it('getCurrentAlert returns null initially', () => {
    expect(emergencyAlertService.getCurrentAlert()).toBeNull();
  });

  it('setAlert and getCurrentAlert round-trip', () => {
    emergencyAlertService.setAlert(mockEmergencyAlert);
    expect(emergencyAlertService.getCurrentAlert()).toEqual(mockEmergencyAlert);
  });

  it('clearAlert clears current alert', () => {
    emergencyAlertService.setAlert(mockEmergencyAlert);
    emergencyAlertService.clearAlert();
    expect(emergencyAlertService.getCurrentAlert()).toBeNull();
  });

  it('addListener is notified when alert is set', () => {
    const listener = vi.fn();
    const unsub = emergencyAlertService.addListener(listener);
    emergencyAlertService.setAlert(mockEmergencyAlert);
    expect(listener).toHaveBeenCalledWith(mockEmergencyAlert);
    unsub();
  });

  it('addListener is notified when alert is cleared', () => {
    emergencyAlertService.setAlert(mockEmergencyAlert);
    const listener = vi.fn();
    const unsub = emergencyAlertService.addListener(listener);
    emergencyAlertService.clearAlert();
    expect(listener).toHaveBeenCalledWith(null);
    unsub();
  });

  it('cleanup clears current alert', () => {
    emergencyAlertService.setAlert(mockEmergencyAlert);
    emergencyAlertService.cleanup();
    expect(emergencyAlertService.getCurrentAlert()).toBeNull();
  });
});

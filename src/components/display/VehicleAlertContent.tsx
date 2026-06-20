/**
 * VehicleAlertContent
 *
 * Full-screen vehicle / parking alert: dark backdrop with an oversized UK rear
 * plate so worshippers recognise it instantly from across the carpark.
 */

import React from 'react';
import { Car } from 'lucide-react';
import UkRearNumberPlate from '@/components/display/UkRearNumberPlate';
import type { EmergencyAlert, TimeFormat } from '@/api/models';
import { useCurrentTime } from '@/hooks/useCurrentTime';
import { getTimeDisplayParts } from '@/utils/dateUtils';
import type { RotationDegrees } from '@/types/realtime';

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const MasjidConnectWordmark: React.FC = () => (
  <span className="vehicle-alert-wordmark font-bold tracking-wide text-white/60">
    MasjidConnect
  </span>
);

export interface VehicleAlertContentProps {
  alert: EmergencyAlert;
  isExiting: boolean;
  remainingMs: number;
  rotationDegrees: RotationDegrees;
  timeFormat: TimeFormat;
}

const VehicleAlertContent: React.FC<VehicleAlertContentProps> = ({
  alert,
  isExiting,
  remainingMs,
  rotationDegrees,
  timeFormat,
}) => {
  const isPortrait = rotationDegrees === 90 || rotationDegrees === 270;
  const currentTime = useCurrentTime();
  const timeStr24h = `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
  const { main: timeMain, period: timePeriod } = getTimeDisplayParts(timeStr24h, timeFormat);

  const overlayClasses = [
    'emergency-overlay',
    'vehicle-alert-overlay',
    'emergency-overlay--high',
    isPortrait ? 'vehicle-alert-overlay--portrait' : '',
    isExiting ? 'emergency-overlay--exiting' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={`${overlayClasses} gpu-accelerated`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div
        className="vehicle-alert-header emergency-zone-tint grid grid-cols-3 items-center"
        style={{ height: '12%', minHeight: 0 }}
      >
        <div className="vehicle-alert-header-label flex items-center text-white min-w-0">
          <Car className="vehicle-alert-header-icon shrink-0" aria-hidden="true" />
          <span className="emergency-category-label">VEHICLE NOTICE</span>
        </div>

        <div className="vehicle-alert-header-clock flex items-baseline justify-center text-white min-w-0">
          <span className="emergency-clock">{timeMain}</span>
          {timePeriod != null && (
            <span className="vehicle-alert-clock-period">{timePeriod}</span>
          )}
        </div>

        <div className="flex justify-end min-w-0">
          <span className="emergency-countdown text-white">
            {formatCountdown(remainingMs)}
          </span>
        </div>
      </div>

      <div
        className="vehicle-alert-body flex flex-col items-center justify-center text-center"
        style={{ flex: 1, minHeight: 0, minWidth: 0 }}
      >
        <UkRearNumberPlate registration={alert.message} />

        <p className="vehicle-alert-reason text-white">
          {alert.title}
        </p>
      </div>

      <div
        className="vehicle-alert-footer emergency-zone-tint flex items-center"
        style={{ height: '16%', minHeight: 0 }}
      >
        <MasjidConnectWordmark />
      </div>
    </div>
  );
};

export default VehicleAlertContent;

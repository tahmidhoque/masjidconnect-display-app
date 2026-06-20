/**
 * UkRearNumberPlate
 *
 * Renders a UK-style rear registration plate (yellow field, black lettering,
 * blue GB band) sized for long-distance legibility on mosque signage displays.
 */

import React, { useMemo } from 'react';
import { formatUkPlateForDisplay, normaliseUkPlateInput } from '@/utils/ukNumberPlate';

export interface UkRearNumberPlateProps {
  /** Raw or partially formatted registration mark */
  registration: string;
  className?: string;
}

const UkRearNumberPlate: React.FC<UkRearNumberPlateProps> = ({
  registration,
  className = '',
}) => {
  const displayText = useMemo(() => {
    const normalised = normaliseUkPlateInput(registration);
    return formatUkPlateForDisplay(normalised) || 'AB12 CDE';
  }, [registration]);

  return (
    <div
      className={`uk-rear-plate gpu-accelerated ${className}`.trim()}
      role="img"
      aria-label={`Vehicle registration ${displayText}`}
    >
      <div className="uk-rear-plate__band" aria-hidden="true">
        <span className="uk-rear-plate__gb">GB</span>
      </div>
      <div className="uk-rear-plate__registration">{displayText}</div>
    </div>
  );
};

export default UkRearNumberPlate;

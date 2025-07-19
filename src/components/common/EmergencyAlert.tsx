import React, { useState, useEffect } from "react";
import { Fade } from "@mui/material";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";
import { ALERT_COLOR_SCHEMES } from "./EmergencyAlertOverlay";
import EmergencyAlertOverlay from "./EmergencyAlertOverlay";

/**
 * EmergencyAlert component
 *
 * This component serves as a wrapper for the EmergencyAlertOverlay.
 * The alert is displayed as a full-screen overlay with an Islamic pattern background.
 *
 * The following predefined alert color schemes are available:
 *
 * - RED (#f44336): High urgency, critical emergency alerts
 * - ORANGE (#ff9800): Important alerts requiring attention
 * - AMBER (#ffb74d): Moderate urgency alerts
 * - BLUE (#2196f3): Informational emergency alerts
 * - GREEN (#4caf50): Status updates and resolutions
 * - PURPLE (#9c27b0): Special announcements during emergency situations
 * - DARK (#263238): Serious alerts requiring immediate attention
 *
 * Custom colors can also be used and will automatically determine appropriate contrast text colors.
 */
const EmergencyAlert: React.FC = () => {
  const hasActiveAlert = useSelector(
    (state: RootState) => state.emergency.currentAlert !== null
  );
  const [visible, setVisible] = useState(false);

  // Handle animation states
  useEffect(() => {
    // When alert becomes active, show it immediately
    if (hasActiveAlert) {
      setVisible(true);
    }
    // When alert becomes inactive, delay the removal to allow fade-out animation
    else {
      // If currently visible, start fade-out
      if (visible) {
        const timer = setTimeout(() => {
          setVisible(false);
        }, 500); // Match this to the Fade timeout

        return () => clearTimeout(timer);
      }
    }
  }, [hasActiveAlert, visible]);

  // Don't render anything if there's no alert and animation has completed
  if (!hasActiveAlert && !visible) return null;

  return (
    <Fade
      in={hasActiveAlert}
      timeout={500}
      onExited={() => console.log("Alert fade-out completed")}
    >
      <div>
        <EmergencyAlertOverlay />
      </div>
    </Fade>
  );
};

export default EmergencyAlert;

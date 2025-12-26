import React, { useState, useEffect } from "react";
import { Fade } from "@mui/material";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";
import EmergencyAlertOverlay from "./EmergencyAlertOverlay";

/**
 * EmergencyAlert component
 *
 * Modern emergency alert system with gradient backgrounds and smooth animations.
 * Coordinates with DisplayScreen for seamless dissolve transitions where the
 * display content fades out, background animates to alert color, then alert fades in.
 *
 * Available gradient alert types:
 *
 * - RED: Critical emergency alerts with deep red gradient
 * - ORANGE: Important alerts with vibrant orange gradient
 * - AMBER: Caution alerts with warm amber to yellow gradient
 * - BLUE: Informational alerts with calm blue gradient
 * - GREEN: Success/status updates with reassuring green gradient
 * - PURPLE: Special announcements with elegant purple gradient
 * - DARK: Urgent alerts with professional dark gradient
 *
 * The system automatically creates beautiful gradients and ensures proper
 * text contrast for optimal readability on display screens.
 *
 * Test shortcuts (when focused on display):
 * - Ctrl+Shift+1-7: Trigger different alert types
 * - Ctrl+Shift+C: Clear current alert
 * - Ctrl+Shift+R: Random alert type
 */
const EmergencyAlert: React.FC = () => {
  const hasActiveAlert = useSelector(
    (state: RootState) => state.emergency.currentAlert !== null,
  );
  const [visible, setVisible] = useState(false);
  const [delayedVisible, setDelayedVisible] = useState(false);

  // Handle smooth animation coordination with DisplayScreen
  useEffect(() => {
    if (hasActiveAlert) {
      // Alert is becoming active - delay showing until display components dissolve
      setVisible(true);

      // Delay the actual overlay appearance to coordinate with staggered dissolve
      // Wait for all components to finish dissolving (300ms max delay + 300ms duration)
      const showTimer = setTimeout(() => {
        setDelayedVisible(true);
      }, 600); // Matches staggered dissolve completion

      return () => clearTimeout(showTimer);
    } else {
      // Alert is clearing - hide immediately, let display animate back in
      setDelayedVisible(false);

      // Remove component after fade out completes
      const hideTimer = setTimeout(() => {
        setVisible(false);
      }, 500);

      return () => clearTimeout(hideTimer);
    }
  }, [hasActiveAlert]);

  // Don't render if no alert and animation completed
  if (!hasActiveAlert && !visible) return null;

  return (
    <Fade
      in={delayedVisible}
      timeout={{
        enter: 400,
        exit: 300,
      }}
      onExited={() => {
        console.log("Emergency alert fade-out completed");
        setVisible(false);
      }}
    >
      <div>
        <EmergencyAlertOverlay />
      </div>
    </Fade>
  );
};

export default EmergencyAlert;

import React from "react";
import { Box, Fade } from "@mui/material";
import { useOrientation } from "../../contexts/OrientationContext";

interface OrientationTransitionProps {
  children: React.ReactNode;
}

/**
 * OrientationTransition component
 *
 * Wraps content with smooth fade transition during orientation changes.
 * Prevents flickering and provides visual feedback during transitions.
 */
export function OrientationTransition({
  children,
}: OrientationTransitionProps) {
  const { isChanging } = useOrientation();

  return (
    <Fade in={!isChanging} timeout={300}>
      <Box
        sx={{
          width: "100%",
          height: "100%",
          transition: "opacity 0.3s ease-in-out, transform 0.3s ease-in-out",
          opacity: isChanging ? 0.7 : 1,
          transform: isChanging ? "scale(0.98)" : "scale(1)",
        }}
      >
        {children}
      </Box>
    </Fade>
  );
}

export default OrientationTransition;

import React from "react";
import { Box, Typography, useTheme, alpha } from "@mui/material";
import PrayerCountdown from "./PrayerCountdown";
import GlassmorphicCard from "./GlassmorphicCard";
import useResponsiveFontSize from "../../hooks/useResponsiveFontSize";
import { usePrayerTimes } from "../../hooks/usePrayerTimes";
import { goldGradient } from "../../theme/theme";

interface GlassmorphicPrayerCountdownProps {
  orientation?: "portrait" | "landscape";
  onCountdownComplete?: (isJamaat: boolean) => void;
}

/**
 * GlassmorphicPrayerCountdown component
 *
 * A glassmorphic container for the prayer countdown that displays
 * the time remaining until the next prayer.
 */
const GlassmorphicPrayerCountdown: React.FC<
  GlassmorphicPrayerCountdownProps
> = ({ orientation = "landscape", onCountdownComplete }) => {
  const theme = useTheme();
  const { fontSizes, getSizeRem } = useResponsiveFontSize();
  const { nextPrayer } = usePrayerTimes();

  const isPortrait = orientation === "portrait";

  if (!nextPrayer) {
    return null;
  }

  return (
    <GlassmorphicCard
      opacity={0.2}
      blurIntensity={8}
      borderRadius={4}
      borderWidth={1}
      borderOpacity={0.25}
      borderColor={alpha("#ffffff", 0.25)}
      shadowIntensity={0.3}
      sx={{
        width: "100%",
        color: "#fff",
        overflow: "hidden",
        mb: getSizeRem(1.5),
        backgroundColor: alpha(theme.palette.secondary.dark, 0.3),
        borderTop: `1px solid ${alpha("#ffffff", 0.5)}`,
        borderLeft: `1px solid ${alpha("#ffffff", 0.5)}`,
        minHeight: isPortrait ? "150px" : "180px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <Box sx={{ p: getSizeRem(2) }}>
        <Typography
          sx={{
            fontSize: fontSizes.h5,
            fontWeight: 700,
            backgroundImage: goldGradient,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            mb: getSizeRem(1),
            fontFamily: "'Poppins', sans-serif",
            letterSpacing: "0.5px",
            textAlign: "center",
            textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
          }}
        >
          Next Prayer: <strong>{nextPrayer.name}</strong>
        </Typography>

        <PrayerCountdown
          prayerName={nextPrayer.name}
          prayerTime={nextPrayer.time}
          jamaatTime={nextPrayer.jamaat}
          timeUntilNextPrayer={nextPrayer.timeUntil}
          onCountdownComplete={onCountdownComplete}
        />
      </Box>
    </GlassmorphicCard>
  );
};

export default GlassmorphicPrayerCountdown;

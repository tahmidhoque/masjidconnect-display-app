import React from "react";
import { Box, Typography, Divider, useTheme, alpha } from "@mui/material";
import { usePrayerTimes } from "../../hooks/usePrayerTimes";
import GlassmorphicCard from "./GlassmorphicCard";
import useResponsiveFontSize from "../../hooks/useResponsiveFontSize";
import { goldGradient } from "../../theme/theme";

interface GlassmorphicPrayerTimesPanelProps {
  orientation?: "portrait" | "landscape";
}

/**
 * GlassmorphicPrayerTimesPanel component
 *
 * A glassmorphic card that displays all prayer times for the day.
 * Shows Jummah time instead of Zuhr Jamaat on Fridays.
 */
const GlassmorphicPrayerTimesPanel: React.FC<
  GlassmorphicPrayerTimesPanelProps
> = ({ orientation = "landscape" }) => {
  const theme = useTheme();
  const { fontSizes, getSizeRem, layout } = useResponsiveFontSize();
  const { todaysPrayerTimes, isJumuahToday, jumuahDisplayTime } =
    usePrayerTimes();

  const isPortrait = orientation === "portrait";

  // Create a formatted prayer time list, filtering out Sunrise for portrait mode
  const filteredPrayerTimes = isPortrait
    ? todaysPrayerTimes.filter((prayer) => prayer.name !== "Sunrise")
    : todaysPrayerTimes;

  return (
    <GlassmorphicCard
      opacity={0.15}
      borderOpacity={0.3}
      blurIntensity={8}
      borderRadius={4}
      borderWidth={1}
      borderColor={theme.palette.warning.main}
      sx={{
        width: "100%",
        overflow: "hidden",
        mb: getSizeRem(1.5),
        color: "#fffffff",
        backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.7)} 0%, ${alpha(theme.palette.primary.main, 0.7)} 100%)`,
      }}
    >
      <Box sx={{ p: getSizeRem(1.2) }}>
        <Typography
          sx={{
            fontSize: fontSizes.h5,
            fontWeight: 700,
            backgroundImage: goldGradient,
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            mb: getSizeRem(0.8),
            textAlign: "center",
            fontFamily: "'Poppins', sans-serif",
            letterSpacing: "0.5px",
            textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
          }}
        >
          Prayer Times
        </Typography>

        {/* Headers */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            mb: getSizeRem(0.4),
            px: getSizeRem(0.5),
          }}
        >
          <Typography
            sx={{
              fontSize: isPortrait ? fontSizes.body2 : fontSizes.body1,
              fontWeight: 600,
              opacity: 0.7,
              fontFamily: "'Poppins', sans-serif",
              textAlign: "start",
            }}
          >
            Start Time
          </Typography>
          <Typography
            sx={{
              fontSize: isPortrait ? fontSizes.body2 : fontSizes.body1,
              fontWeight: 600,
              opacity: 0.7,
              textAlign: "center",
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            Prayer
          </Typography>
          <Typography
            sx={{
              fontSize: isPortrait ? fontSizes.body2 : fontSizes.body1,
              fontWeight: 600,
              opacity: 0.7,
              textAlign: "end",
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            Jamaa't
          </Typography>
        </Box>

        <Divider
          sx={{
            backgroundColor: alpha(theme.palette.warning.main, 0.3),
            mb: getSizeRem(0.8),
          }}
        />

        {/* Prayer Time Rows */}
        {filteredPrayerTimes.map((prayer, index) => (
          <Box key={prayer.name}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                py: getSizeRem(0.7),
                px: getSizeRem(0.5),
                borderRadius: 1.5,
                backgroundColor: prayer.isNext
                  ? alpha(theme.palette.secondary.main, 0.2)
                  : prayer.isCurrent
                    ? alpha(theme.palette.primary.light, 0.15)
                    : "transparent",
                transition: "background-color 0.3s ease",
                boxShadow: prayer.isNext
                  ? `0 2px 8px ${alpha(theme.palette.secondary.main, 0.3)}`
                  : prayer.isCurrent
                    ? `0 1px 4px ${alpha(theme.palette.primary.light, 0.2)}`
                    : "none",
                "&:hover": {
                  backgroundColor: prayer.isNext
                    ? alpha(theme.palette.secondary.main, 0.25)
                    : prayer.isCurrent
                      ? alpha(theme.palette.primary.light, 0.2)
                      : alpha(theme.palette.primary.light, 0.05),
                },
              }}
            >
              <Typography
                sx={{
                  fontSize: isPortrait ? fontSizes.body1 : fontSizes.h6,
                  fontWeight: prayer.isNext || prayer.isCurrent ? 700 : 500,
                  color: prayer.isNext ? theme.palette.warning.main : "#ffffff",
                  fontFamily: "'Poppins', sans-serif",
                  textShadow: prayer.isNext
                    ? "0 1px 3px rgba(0, 0, 0, 0.3)"
                    : "none",
                  textAlign: "start",
                }}
              >
                {prayer.displayTime}
              </Typography>

              <Typography
                sx={{
                  fontSize: isPortrait ? fontSizes.body1 : fontSizes.h6,
                  textAlign: "center",
                  fontWeight: prayer.isNext ? 600 : 500,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {prayer.name}
                {prayer.name === "Zuhr" && isJumuahToday && (
                  <Box
                    component="span"
                    sx={{
                      ml: 1,
                      fontSize: isPortrait
                        ? fontSizes.caption
                        : fontSizes.body2,
                      bgcolor: alpha(theme.palette.warning.main, 0.2),
                      color: theme.palette.warning.main,
                      px: 0.7,
                      py: 0.2,
                      borderRadius: 1,
                      fontWeight: 600,
                    }}
                  >
                    Jumu'ah
                  </Box>
                )}
              </Typography>

              <Typography
                sx={{
                  fontSize: isPortrait ? fontSizes.body1 : fontSizes.h6,
                  textAlign: "end",
                  fontWeight: prayer.isNext ? 600 : 500,
                  color:
                    prayer.isNext && prayer.displayJamaat
                      ? alpha(theme.palette.warning.light, 0.9)
                      : prayer.displayJamaat
                        ? "#ffffff"
                        : alpha("#ffffff", 0.5),
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {prayer.name === "Zuhr" && isJumuahToday
                  ? jumuahDisplayTime || "N/A"
                  : prayer.displayJamaat || "N/A"}
              </Typography>
            </Box>

            {index < filteredPrayerTimes.length - 1 && (
              <Divider
                sx={{
                  backgroundColor: alpha("#ffffff", 0.1),
                  my: 0.4,
                }}
              />
            )}
          </Box>
        ))}
      </Box>
    </GlassmorphicCard>
  );
};

export default GlassmorphicPrayerTimesPanel;

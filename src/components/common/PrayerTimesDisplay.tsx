import React from "react";
import { Box, Typography, Grid, Paper, Divider } from "@mui/material";
import { usePrayerTimes } from "../../hooks/usePrayerTimes";
import useResponsiveFontSize from "../../hooks/useResponsiveFontSize";

interface PrayerTimesDisplayProps {
  simplified?: boolean;
}

/**
 * PrayerTimesDisplay component
 *
 * Displays the prayer times for the day with optional jamaat times.
 * Highlights the current and next prayers.
 */
const PrayerTimesDisplay: React.FC<PrayerTimesDisplayProps> = ({
  simplified = false,
}) => {
  const {
    todaysPrayerTimes,
    nextPrayer,
    currentPrayer,
    currentDate,
    hijriDate,
    isJumuahToday,
    jumuahDisplayTime,
  } = usePrayerTimes();

  const { fontSizes, screenSize } = useResponsiveFontSize();

  if (simplified) {
    // Simplified view (for sidebar or compact display)
    return (
      <Box sx={{ p: screenSize.is720p ? 1.5 : 2 }}>
        <Typography
          variant="subtitle1"
          sx={{
            mb: 1,
            fontWeight: "bold",
            fontSize: screenSize.is720p ? "0.9rem" : "1rem",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {currentDate}
          {hijriDate && (
            <Typography
              component="span"
              variant="caption"
              sx={{
                display: "block",
                mt: 0.5,
                fontSize: screenSize.is720p ? "0.7rem" : "0.8rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {hijriDate}
            </Typography>
          )}
        </Typography>

        <Grid container spacing={screenSize.is720p ? 0.5 : 1} sx={{ mt: 1 }}>
          {todaysPrayerTimes.map((prayer) => (
            <Grid item xs={4} key={prayer.name}>
              <Box
                sx={{
                  p: screenSize.is720p ? 0.5 : 1,
                  textAlign: "center",
                  bgcolor: prayer.isNext
                    ? "#2A9D8F"
                    : prayer.isCurrent
                      ? "primary.main"
                      : "background.paper",
                  color: prayer.isNext || prayer.isCurrent ? "#fff" : "inherit",
                  borderRadius: 1,
                  transform: prayer.isNext ? "scale(1.05)" : "none",
                  transition: "transform 0.2s ease-in-out",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <Typography
                  variant="caption"
                  component="div"
                  sx={{
                    fontSize: screenSize.is720p ? "0.65rem" : "0.75rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {prayer.name}
                </Typography>
                <Typography
                  variant="body2"
                  component="div"
                  sx={{
                    fontWeight: "bold",
                    fontSize: screenSize.is720p ? "0.75rem" : "0.875rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {prayer.displayTime}
                </Typography>
              </Box>
            </Grid>
          ))}

          {isJumuahToday && (
            <Grid item xs={12} sx={{ mt: 1 }}>
              <Box
                sx={{
                  p: screenSize.is720p ? 0.5 : 1,
                  textAlign: "center",
                  bgcolor: "warning.main",
                  color: "warning.contrastText",
                  borderRadius: 1,
                }}
              >
                <Typography
                  variant="caption"
                  component="div"
                  sx={{
                    fontSize: screenSize.is720p ? "0.65rem" : "0.75rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Jumu'ah
                </Typography>
                <Typography
                  variant="body2"
                  component="div"
                  sx={{
                    fontWeight: "bold",
                    fontSize: screenSize.is720p ? "0.75rem" : "0.875rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {jumuahDisplayTime}
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>

        {nextPrayer && (
          <Box sx={{ mt: 2, textAlign: "center" }}>
            <Typography
              variant="body2"
              sx={{
                fontSize: screenSize.is720p ? "0.75rem" : "0.875rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Next Prayer: <strong>{nextPrayer.name}</strong> in{" "}
              <strong>{nextPrayer.timeUntil}</strong>
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

  // Full view
  return (
    <Paper elevation={2} sx={{ borderRadius: 2, overflow: "hidden" }}>
      <Box
        sx={{
          bgcolor: "primary.main",
          color: "primary.contrastText",
          p: screenSize.is720p ? 1.5 : 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontSize: screenSize.is720p ? "1.1rem" : "1.25rem",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          Prayer Times
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontSize: screenSize.is720p ? "0.75rem" : "0.875rem",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {currentDate}
        </Typography>
        {hijriDate && (
          <Typography
            variant="body2"
            sx={{
              fontSize: screenSize.is720p ? "0.75rem" : "0.875rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {hijriDate}
          </Typography>
        )}
      </Box>

      <Box sx={{ p: screenSize.is720p ? 1.5 : 2 }}>
        <Grid container spacing={screenSize.is720p ? 1 : 2}>
          <Grid item xs={12}>
            {nextPrayer && (
              <Paper
                elevation={1}
                sx={{
                  p: screenSize.is720p ? 1.5 : 2,
                  mb: screenSize.is720p ? 1.5 : 2,
                  textAlign: "center",
                  bgcolor: "#2A9D8F",
                  color: "success.contrastText",
                }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontSize: screenSize.is720p ? "0.9rem" : "1rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Next Prayer: {nextPrayer.name}
                </Typography>
                <Typography
                  variant="h4"
                  sx={{
                    fontSize: screenSize.is720p ? "1.8rem" : "2.125rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {nextPrayer.displayTime}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: screenSize.is720p ? "0.75rem" : "0.875rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {nextPrayer.timeUntil} remaining
                </Typography>
                {nextPrayer.displayJamaat && (
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: screenSize.is720p ? "0.75rem" : "0.875rem",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    Jamaat: {nextPrayer.displayJamaat}
                  </Typography>
                )}
              </Paper>
            )}

            {currentPrayer && (
              <Paper
                elevation={1}
                sx={{
                  p: screenSize.is720p ? 0.75 : 1,
                  mb: screenSize.is720p ? 1.5 : 2,
                  textAlign: "center",
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontSize: screenSize.is720p ? "0.8rem" : "0.875rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Current Prayer: {currentPrayer.name}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontSize: screenSize.is720p ? "1rem" : "1.25rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {currentPrayer.displayTime}
                </Typography>
                {currentPrayer.displayJamaat && (
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: screenSize.is720p ? "0.75rem" : "0.875rem",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    Jamaat: {currentPrayer.displayJamaat}
                  </Typography>
                )}
              </Paper>
            )}

            {/* Prayer times table */}
            <Grid container spacing={screenSize.is720p ? 0.5 : 1}>
              <Grid item xs={4}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: "bold",
                    fontSize: screenSize.is720p ? "0.8rem" : "0.875rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Prayer
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: "bold",
                    fontSize: screenSize.is720p ? "0.8rem" : "0.875rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Adhan
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: "bold",
                    fontSize: screenSize.is720p ? "0.8rem" : "0.875rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Jamaat
                </Typography>
              </Grid>

              <Grid item xs={12}>
                <Divider />
              </Grid>

              {todaysPrayerTimes.map((prayer) => (
                <React.Fragment key={prayer.name}>
                  <Grid item xs={4}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight:
                          prayer.isNext || prayer.isCurrent ? "bold" : "normal",
                        color: prayer.isNext
                          ? "#2A9D8F"
                          : prayer.isCurrent
                            ? "primary.main"
                            : "inherit",
                        fontSize: screenSize.is720p ? "0.75rem" : "0.875rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {prayer.name}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight:
                          prayer.isNext || prayer.isCurrent ? "bold" : "normal",
                        color: prayer.isNext
                          ? "#2A9D8F"
                          : prayer.isCurrent
                            ? "primary.main"
                            : "inherit",
                        fontSize: screenSize.is720p ? "0.75rem" : "0.875rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {prayer.displayTime}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight:
                          prayer.isNext || prayer.isCurrent ? "bold" : "normal",
                        color: prayer.isNext
                          ? "#2A9D8F"
                          : prayer.isCurrent
                            ? "primary.main"
                            : "inherit",
                        fontSize: screenSize.is720p ? "0.75rem" : "0.875rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {prayer.displayJamaat || "-"}
                    </Typography>
                  </Grid>
                </React.Fragment>
              ))}

              {isJumuahToday && (
                <React.Fragment>
                  <Grid item xs={12}>
                    <Divider sx={{ my: screenSize.is720p ? 0.5 : 0.75 }} />
                  </Grid>
                  <Grid item xs={4}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: "bold",
                        color: "warning.main",
                        fontSize: screenSize.is720p ? "0.75rem" : "0.875rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      Jumu'ah
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: "bold",
                        color: "warning.main",
                        fontSize: screenSize.is720p ? "0.75rem" : "0.875rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      -
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: "bold",
                        color: "warning.main",
                        fontSize: screenSize.is720p ? "0.75rem" : "0.875rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {jumuahDisplayTime}
                    </Typography>
                  </Grid>
                </React.Fragment>
              )}
            </Grid>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
};

export default PrayerTimesDisplay;

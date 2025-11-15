import React, {
  useMemo,
  useCallback,
  useEffect,
  useState,
  useRef,
} from "react";
import {
  Box,
  Typography,
  useTheme,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from "@mui/material";
import { usePrayerTimes } from "../../hooks/usePrayerTimes";
import PrayerCountdown from "./PrayerCountdown";
import useResponsiveFontSize from "../../hooks/useResponsiveFontSize";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../../store";
import { refreshPrayerTimes } from "../../store/slices/contentSlice";
import logger from "../../utils/logger";

interface ModernPrayerCardProps {
  orientation?: "portrait" | "landscape";
  onCountdownComplete?: (isJamaat: boolean) => void;
}

/**
 * ModernPrayerCard component
 *
 * A modern, performance-optimized prayer times card that replaces the
 * glassmorphic version with clean styling and better resource usage.
 */
const ModernPrayerCard: React.FC<ModernPrayerCardProps> = ({
  orientation = "landscape",
  onCountdownComplete,
}) => {
  const theme = useTheme();
  const { fontSizes, layout, screenSize, getSizeRem } = useResponsiveFontSize();
  const {
    todaysPrayerTimes,
    nextPrayer,
    isJumuahToday,
    jumuahDisplayTime,
    jumuahKhutbahTime,
  } = usePrayerTimes();

  const dispatch = useDispatch<AppDispatch>();

  // Redux selectors
  const prayerTimes = useSelector(
    (state: RootState) => state.content.prayerTimes,
  );
  const isLoading = useSelector(
    (state: RootState) => state.content.isLoadingPrayerTimes,
  );

  const isPortrait = orientation === "portrait";

  // Redux action wrapper
  const refreshPrayerTimesHandler = useCallback(
    (forceRefresh: boolean = false) => {
      dispatch(refreshPrayerTimes({ forceRefresh }));
    },
    [dispatch],
  );

  // Local state to handle initial loading and retry logic
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [localLoading, setLocalLoading] = useState(false);

  // Use refs to track component state between renders
  const lastRefreshTimeRef = useRef<number>(Date.now());
  const dataCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const MIN_REFRESH_INTERVAL = 5000; // 5 seconds minimum between refreshes

  // Effect to handle retry logic if prayer times don't load properly
  useEffect(() => {
    // Clean up any existing timeout to prevent multiple refreshes
    if (dataCheckTimeoutRef.current) {
      clearTimeout(dataCheckTimeoutRef.current);
      dataCheckTimeoutRef.current = null;
    }

    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTimeRef.current;

    // Check if we have the necessary data, if not, retry the refresh
    if (!isLoading && (!nextPrayer || !todaysPrayerTimes.length)) {
      logger.warn(
        "[ModernPrayerCard] Prayer times data missing or incomplete",
        {
          retryCount,
          hasPrayerTimes: !!prayerTimes,
          hasNextPrayer: !!nextPrayer,
          hasFormattedTimes: todaysPrayerTimes.length,
        },
      );

      // Only refresh if enough time has passed and we haven't exceeded retry limit
      if (
        timeSinceLastRefresh >= MIN_REFRESH_INTERVAL &&
        retryCount < 3 &&
        !isRetrying
      ) {
        setIsRetrying(true);
        setRetryCount((prev) => prev + 1);
        lastRefreshTimeRef.current = now;

        logger.debug("[ModernPrayerCard] Attempting to refresh prayer times", {
          retryCount: retryCount + 1,
          timeSinceLastRefresh,
        });

        refreshPrayerTimesHandler(true); // Force refresh to bypass debouncing

        // Set a timeout to check again if data is still missing
        dataCheckTimeoutRef.current = setTimeout(() => {
          setIsRetrying(false);
        }, 3000);
      } else if (retryCount >= 3) {
        logger.error(
          "[ModernPrayerCard] Maximum retry attempts reached for prayer times",
        );
        setLocalLoading(false); // Stop showing loading after max retries
      }
    } else if (nextPrayer && todaysPrayerTimes.length > 0) {
      // Data is available, stop loading and reset retry count
      setLocalLoading(false);
      setIsRetrying(false);
      setRetryCount(0);

      logger.debug("[ModernPrayerCard] Prayer times data loaded successfully", {
        nextPrayerName: nextPrayer?.name,
        timesCount: todaysPrayerTimes.length,
      });
    }

    return () => {
      if (dataCheckTimeoutRef.current) {
        clearTimeout(dataCheckTimeoutRef.current);
      }
    };
  }, [
    nextPrayer,
    todaysPrayerTimes,
    isLoading,
    retryCount,
    isRetrying,
    refreshPrayerTimesHandler,
    prayerTimes,
  ]);

  // Debug logging
  React.useEffect(() => {
    logger.debug("[ModernPrayerCard] Prayer times debug", {
      todaysPrayerTimesCount: todaysPrayerTimes.length,
      nextPrayerName: nextPrayer?.name,
      prayerNames: todaysPrayerTimes.map((p) => p.name),
      isLoading,
      localLoading,
      isRetrying,
    });
  }, [todaysPrayerTimes, nextPrayer, isLoading, localLoading, isRetrying]);

  // Only show loading if we truly have no data at all
  if (
    (localLoading || isLoading || isRetrying) &&
    !nextPrayer &&
    todaysPrayerTimes.length === 0
  ) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          background: `linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)`,
          borderRadius: "8px",
          border: `1px solid rgba(255,255,255,0.2)`,
        }}
      >
        <Box sx={{ textAlign: "center" }}>
          <CircularProgress sx={{ color: theme.palette.warning.main, mb: 1 }} />
          <Typography
            sx={{
              color: "rgba(255,255,255,0.8)",
              fontSize: fontSizes.body1,
            }}
          >
            Loading Prayer Times...
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)`,
        borderRadius: "12px",
        border: `1px solid rgba(255,255,255,0.2)`,
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Decorative accent */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: `linear-gradient(90deg, ${theme.palette.warning.main}, ${theme.palette.warning.light})`,
        }}
      />

      {/* Prayer Countdown Section - Compact */}
      {nextPrayer && (
        <Box
          sx={{
            p: getSizeRem(0.5),
            textAlign: "center",
            borderBottom: `1px solid rgba(255,255,255,0.1)`,
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{
              fontSize: fontSizes.body2,
              fontWeight: 600,
              color: theme.palette.warning.main,
              mb: 0.2,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            Next Prayer: {nextPrayer.name}
          </Typography>

          <PrayerCountdown
            prayerName={nextPrayer.name}
            prayerTime={nextPrayer.time}
            jamaatTime={nextPrayer.jamaat}
            timeUntilNextPrayer={nextPrayer.timeUntil}
            onCountdownComplete={onCountdownComplete}
          />
        </Box>
      )}

      {/* Prayer Times Table - Fitted */}
      <Box
        sx={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        <TableContainer
          sx={{
            flex: 1,
            "& .MuiTable-root": {
              height: "100%",
            },
          }}
        >
          <Table
            size="small"
            sx={{
              tableLayout: "fixed",
              height: "100%",
              "& .MuiTableHead-root": {
                "& .MuiTableRow-root": {
                  height: "auto",
                },
              },
              "& .MuiTableBody-root": {
                height: "100%",
                "& .MuiTableRow-root": {
                  height: `calc(100% / 6)`,
                },
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    background: "rgba(255,255,255,0.08)",
                    borderBottom: `2px solid ${theme.palette.warning.main}`,
                    color: theme.palette.warning.main,
                    fontWeight: 700,
                    fontSize: fontSizes.body2,
                    fontFamily: "'Poppins', sans-serif",
                    py: getSizeRem(0.3),
                    px: getSizeRem(0.5),
                    width: "35%",
                  }}
                >
                  Prayer
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    background: "rgba(255,255,255,0.08)",
                    borderBottom: `2px solid ${theme.palette.warning.main}`,
                    color: theme.palette.warning.main,
                    fontWeight: 700,
                    fontSize: fontSizes.body1,
                    fontFamily: "'Poppins', sans-serif",
                    py: getSizeRem(0.5),
                    px: getSizeRem(0.8),
                    width: "32.5%",
                  }}
                >
                  Start Time
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    background: "rgba(255,255,255,0.08)",
                    borderBottom: `2px solid ${theme.palette.warning.main}`,
                    color: theme.palette.warning.main,
                    fontWeight: 700,
                    fontSize: fontSizes.body2,
                    fontFamily: "'Poppins', sans-serif",
                    py: getSizeRem(0.3),
                    px: getSizeRem(0.5),
                    width: "32.5%",
                  }}
                >
                  Jamaat
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {todaysPrayerTimes.length > 0 ? (
                todaysPrayerTimes.map((prayer, index) => (
                  <TableRow
                    key={prayer.name}
                    sx={{
                      "&:hover": {
                        backgroundColor: "rgba(255,255,255,0.08)",
                      },
                      backgroundColor:
                        nextPrayer?.name === prayer.name
                          ? "rgba(233, 196, 106, 0.15)"
                          : "transparent",
                      borderLeft:
                        nextPrayer?.name === prayer.name
                          ? `4px solid ${theme.palette.warning.main}`
                          : "4px solid transparent",
                    }}
                  >
                    <TableCell
                      sx={{
                        color: "#fff",
                        fontSize: fontSizes.body1,
                        fontWeight:
                          nextPrayer?.name === prayer.name ? 700 : 600,
                        fontFamily: "'Poppins', sans-serif",
                        borderBottom: `1px solid rgba(255,255,255,0.1)`,
                        py: getSizeRem(0.4),
                        px: getSizeRem(0.5),
                      }}
                    >
                      {prayer.name}
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        color: "rgba(255,255,255,0.95)",
                        fontSize: fontSizes.body1,
                        fontWeight:
                          nextPrayer?.name === prayer.name ? 700 : 500,
                        fontFamily: "'Poppins', sans-serif",
                        borderBottom: `1px solid rgba(255,255,255,0.1)`,
                        py: getSizeRem(0.4),
                        px: getSizeRem(0.5),
                        letterSpacing: "1px",
                      }}
                    >
                      {prayer.displayTime}
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        color:
                          !prayer.displayJamaat ||
                          prayer.displayJamaat === "N/A"
                            ? "rgba(255,255,255,0.5)"
                            : "rgba(255,255,255,0.95)",
                        fontSize: fontSizes.body1,
                        fontWeight:
                          nextPrayer?.name === prayer.name ? 700 : 500,
                        fontFamily: "'Poppins', sans-serif",
                        borderBottom: `1px solid rgba(255,255,255,0.1)`,
                        py: getSizeRem(0.4),
                        px: getSizeRem(0.5),
                        letterSpacing: "1px",
                      }}
                    >
                      {prayer.displayJamaat || "N/A"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} sx={{ textAlign: "center", py: 4 }}>
                    <CircularProgress
                      sx={{ color: theme.palette.warning.main, mb: 1 }}
                      size={20}
                    />
                    <Typography
                      sx={{
                        color: "rgba(255,255,255,0.7)",
                        fontSize: fontSizes.caption,
                      }}
                    >
                      Loading prayer times...
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};

export default ModernPrayerCard;

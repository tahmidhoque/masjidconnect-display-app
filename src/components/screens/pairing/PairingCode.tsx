import React, { useState, useEffect } from "react";
import {
  Typography,
  Box,
  Button,
  CircularProgress,
  useTheme,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

interface PairingCodeProps {
  pairingCode: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  onRefresh: () => void;
  isLoading: boolean;
}

/**
 * Displays the pairing code with a countdown timer
 */
const PairingCode: React.FC<PairingCodeProps> = ({
  pairingCode,
  expiresAt,
  isExpired,
  onRefresh,
  isLoading,
}) => {
  const theme = useTheme();
  const [timeLeft, setTimeLeft] = useState<string>("");

  // Calculate and update countdown
  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft("");
      return;
    }

    const expirationTime = new Date(expiresAt).getTime();

    const updateTimeLeft = () => {
      const now = new Date().getTime();
      const distance = expirationTime - now;

      if (distance <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${minutes}:${seconds < 10 ? "0" : ""}${seconds}`);
    };

    // Update immediately
    updateTimeLeft();

    // Update every second
    const interval = setInterval(updateTimeLeft, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [expiresAt]);

  return (
    <Box sx={{ textAlign: "center", mb: 2 }}>
      <Typography
        variant="h4"
        gutterBottom
        color="white"
        sx={{ fontWeight: "bold" }}
      >
        Pairing Code
      </Typography>

      {/* Fixed height container to prevent layout shifts */}
      <Box
        sx={{
          height: "120px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {pairingCode ? (
          <>
            <Typography
              variant="h2"
              sx={{
                fontWeight: "bold",
                letterSpacing: 4,
                color: theme.palette.warning.main,
                mb: 1,
                // Add tracking for better readability
                "& > span": {
                  display: "inline-block",
                  mx: 0.5,
                },
              }}
            >
              {/* Add spaces between characters for better readability */}
              {pairingCode.split("").map((char, index) => (
                <span key={index}>{char}</span>
              ))}
            </Typography>

            {expiresAt && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mt: 1,
                }}
              >
                <Typography
                  variant="body2"
                  color={isExpired ? "error.light" : "rgba(255, 255, 255, 0.7)"}
                >
                  {isExpired ? "Code expired" : `Expires in ${timeLeft}`}
                </Typography>

                {isExpired && (
                  <Button
                    variant="text"
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={onRefresh}
                    disabled={isLoading}
                    sx={{ ml: 2, color: theme.palette.warning.main }}
                  >
                    Refresh
                  </Button>
                )}
              </Box>
            )}
          </>
        ) : (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <CircularProgress
              size={40}
              sx={{ color: theme.palette.warning.light }}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default PairingCode;

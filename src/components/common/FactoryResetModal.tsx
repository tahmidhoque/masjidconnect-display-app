import React, { useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  Paper,
  Fade,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  RestartAlt as ResetIcon,
  Warning as WarningIcon,
  Cancel as CancelIcon,
  CheckCircle as ConfirmIcon,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";

interface FactoryResetModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isResetting?: boolean;
}

/**
 * Factory Reset Confirmation Modal
 *
 * Styled to match the display app's glassmorphic branding
 * Controlled via keyboard shortcuts (Enter to confirm, Escape to cancel)
 */
const FactoryResetModal: React.FC<FactoryResetModalProps> = ({
  open,
  onConfirm,
  onCancel,
  isResetting = false,
}) => {
  const theme = useTheme();

  // Keyboard event handler
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (!open) return;

      switch (event.key) {
        case "Enter":
          event.preventDefault();
          onConfirm();
          break;
        case "Escape":
          event.preventDefault();
          onCancel();
          break;
        default:
          break;
      }
    },
    [open, onConfirm, onCancel],
  );

  // Set up keyboard listeners
  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyPress);
      return () => {
        document.removeEventListener("keydown", handleKeyPress);
      };
    }
  }, [open, handleKeyPress]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          background: "transparent",
          boxShadow: "none",
          overflow: "visible",
        },
      }}
      BackdropProps={{
        sx: {
          background: "rgba(0, 0, 0, 0.8)",
          backdropFilter: "blur(10px)",
        },
      }}
    >
      <Fade in={open} timeout={300}>
        <DialogContent sx={{ p: 0 }}>
          <Paper
            elevation={0}
            sx={{
              background:
                "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: 4,
              p: 4,
              position: "relative",
              overflow: "hidden",
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background:
                  "linear-gradient(45deg, rgba(212, 175, 55, 0.1) 0%, rgba(212, 175, 55, 0.05) 50%, transparent 100%)",
                pointerEvents: "none",
              },
            }}
          >
            {/* Header */}
            <Box sx={{ textAlign: "center", mb: 3 }}>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, rgba(244, 67, 54, 0.2) 0%, rgba(244, 67, 54, 0.1) 100%)",
                  border: "2px solid rgba(244, 67, 54, 0.3)",
                  mb: 2,
                }}
              >
                <WarningIcon
                  sx={{
                    fontSize: 40,
                    color: "#ff6b6b",
                  }}
                />
              </Box>

              <Typography
                variant="h4"
                sx={{
                  color: "white",
                  fontWeight: 700,
                  mb: 1,
                  textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
                }}
              >
                Factory Reset
              </Typography>

              <Typography
                variant="h6"
                sx={{
                  color: "rgba(255, 255, 255, 0.8)",
                  fontWeight: 400,
                }}
              >
                Reset Display to Factory Settings
              </Typography>
            </Box>

            {/* Warning Alert */}
            <Alert
              severity="warning"
              icon={<ResetIcon />}
              sx={{
                mb: 3,
                background:
                  "linear-gradient(135deg, rgba(255, 193, 7, 0.15) 0%, rgba(255, 193, 7, 0.05) 100%)",
                border: "1px solid rgba(255, 193, 7, 0.3)",
                borderRadius: 2,
                "& .MuiAlert-icon": {
                  color: "#ffc107",
                },
                "& .MuiAlert-message": {
                  color: "white",
                  fontWeight: 500,
                },
              }}
            >
              This action will permanently delete all display data and settings
            </Alert>

            {/* Content */}
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="body1"
                sx={{
                  color: "rgba(255, 255, 255, 0.9)",
                  lineHeight: 1.6,
                  mb: 2,
                }}
              >
                This will remove all stored data including:
              </Typography>

              <Box sx={{ ml: 2 }}>
                {[
                  "Screen pairing and authentication",
                  "Cached prayer times and content",
                  "Display preferences and settings",
                  "All locally stored data",
                ].map((item, index) => (
                  <Typography
                    key={index}
                    variant="body2"
                    sx={{
                      color: "rgba(255, 255, 255, 0.7)",
                      mb: 0.5,
                      "&::before": {
                        content: '"• "',
                        color: "#d4af37",
                        fontWeight: "bold",
                        mr: 1,
                      },
                    }}
                  >
                    {item}
                  </Typography>
                ))}
              </Box>

              <Typography
                variant="body2"
                sx={{
                  color: "rgba(255, 255, 255, 0.8)",
                  mt: 2,
                  fontStyle: "italic",
                }}
              >
                The display will return to the pairing screen and must be
                reconnected.
              </Typography>
            </Box>

            {/* Keyboard Instructions */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                gap: 3,
                mb: 3,
                p: 2,
                borderRadius: 2,
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <Box sx={{ textAlign: "center" }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: "rgba(255, 255, 255, 0.6)",
                    display: "block",
                    mb: 0.5,
                  }}
                >
                  Continue
                </Typography>
                <Box
                  sx={{
                    px: 2,
                    py: 0.5,
                    borderRadius: 1,
                    background: "rgba(76, 175, 80, 0.2)",
                    border: "1px solid rgba(76, 175, 80, 0.3)",
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: "#4caf50",
                      fontWeight: 600,
                      fontFamily: "monospace",
                    }}
                  >
                    ENTER
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ textAlign: "center" }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: "rgba(255, 255, 255, 0.6)",
                    display: "block",
                    mb: 0.5,
                  }}
                >
                  Cancel
                </Typography>
                <Box
                  sx={{
                    px: 2,
                    py: 0.5,
                    borderRadius: 1,
                    background: "rgba(244, 67, 54, 0.2)",
                    border: "1px solid rgba(244, 67, 54, 0.3)",
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: "#f44336",
                      fontWeight: 600,
                      fontFamily: "monospace",
                    }}
                  >
                    ESC
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Action Buttons */}
            <Box
              sx={{
                display: "flex",
                gap: 2,
                justifyContent: "center",
              }}
            >
              <Button
                variant="outlined"
                onClick={onCancel}
                startIcon={<CancelIcon />}
                disabled={isResetting}
                sx={{
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  border: "2px solid rgba(244, 67, 54, 0.5)",
                  color: "#ff6b6b",
                  background: "rgba(244, 67, 54, 0.1)",
                  fontWeight: 600,
                  fontSize: "1rem",
                  textTransform: "none",
                  "&:hover": {
                    border: "2px solid rgba(244, 67, 54, 0.8)",
                    background: "rgba(244, 67, 54, 0.2)",
                  },
                  "&:disabled": {
                    opacity: 0.5,
                    border: "2px solid rgba(244, 67, 54, 0.3)",
                  },
                }}
              >
                Cancel
              </Button>

              <Button
                variant="contained"
                onClick={onConfirm}
                disabled={isResetting}
                startIcon={
                  isResetting ? (
                    <CircularProgress size={20} sx={{ color: "#1a1a1a" }} />
                  ) : (
                    <ConfirmIcon />
                  )
                }
                sx={{
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  background: isResetting
                    ? "linear-gradient(135deg, #b8941f 0%, #d4af37 100%)"
                    : "linear-gradient(135deg, #d4af37 0%, #f4d03f 100%)",
                  color: "#1a1a1a",
                  fontWeight: 700,
                  fontSize: "1rem",
                  textTransform: "none",
                  boxShadow: "0 4px 15px rgba(212, 175, 55, 0.3)",
                  "&:hover": !isResetting
                    ? {
                        background:
                          "linear-gradient(135deg, #f4d03f 0%, #d4af37 100%)",
                        boxShadow: "0 6px 20px rgba(212, 175, 55, 0.4)",
                      }
                    : {},
                  "&:disabled": {
                    opacity: 0.8,
                  },
                }}
              >
                {isResetting ? "Resetting..." : "Reset Display"}
              </Button>
            </Box>
          </Paper>
        </DialogContent>
      </Fade>
    </Dialog>
  );
};

export default FactoryResetModal;

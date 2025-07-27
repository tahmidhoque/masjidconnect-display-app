import React, { Component, ErrorInfo, ReactNode } from "react";
import { Box, Typography, Button, Paper } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";

interface Props {
  children: ReactNode;
  fallbackComponent?: React.ComponentType<{
    error: Error;
    resetError: () => void;
  }>;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Wrapper component to use hooks inside class component
const WithOfflineStatus: React.FC<{
  error: Error | null;
  resetError: () => void;
}> = ({ error, resetError }) => {
  const isOnline = !useSelector((state: RootState) => state.ui.isOffline);

  return (
    <DefaultFallback
      error={error || new Error("Unknown error")}
      resetError={resetError}
      isOnline={isOnline}
    />
  );
};

// Default fallback UI
const DefaultFallback: React.FC<{
  error: Error;
  resetError: () => void;
  isOnline: boolean;
}> = ({ error, resetError, isOnline }) => {
  const isApiError =
    error.message.includes("API") ||
    error.message.includes("fetch") ||
    error.message.includes("network");

  const isCorsError =
    error.message.includes("CORS") ||
    error.message.includes("cross-origin") ||
    (error.name === "TypeError" && error.message.includes("Network"));

  // If it's a CORS error, don't show this fallback as we have a dedicated CORS notification
  if (isCorsError) {
    return (
      <Box
        sx={{
          p: 3,
          m: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Typography variant="body1" color="error">
          API communication error. Please check the network tab for details.
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          onClick={resetError}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Paper
      sx={{
        p: 3,
        m: 2,
        borderRadius: 2,
        backgroundColor: "error.light",
        color: "error.contrastText",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <ErrorOutlineIcon sx={{ fontSize: 60 }} />
      <Typography variant="h5" component="h2" align="center">
        {isOnline ? "Something went wrong" : "You are offline"}
      </Typography>

      <Typography variant="body1" align="center">
        {isApiError && !isOnline
          ? "The app is currently offline. Using cached data where available."
          : error.message}
      </Typography>

      <Box sx={{ mt: 2 }}>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<RefreshIcon />}
          onClick={resetError}
        >
          {isOnline ? "Try Again" : "Reload When Online"}
        </Button>
      </Box>
    </Paper>
  );
};

class ApiErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("API Error caught by boundary:", error, errorInfo);
  }

  public resetError = () => {
    this.setState({
      hasError: false,
      error: null,
    });

    // Refresh if the user explicitly requests it
    if (navigator.onLine) {
      window.location.reload();
    }
  };

  public render() {
    const { hasError, error } = this.state;
    const { children, fallbackComponent: FallbackComponent } = this.props;

    if (hasError) {
      if (FallbackComponent) {
        return (
          <FallbackComponent error={error!} resetError={this.resetError} />
        );
      }

      return <WithOfflineStatus error={error} resetError={this.resetError} />;
    }

    return children;
  }
}

export default ApiErrorBoundary;

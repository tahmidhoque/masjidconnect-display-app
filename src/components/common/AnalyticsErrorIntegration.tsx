import React, { useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../store";
import { selectActiveErrors } from "../../store/slices/errorSlice";
import { analyticsService } from "../../services/analyticsService";
import { ErrorType } from "../../api/models";
import logger from "../../utils/logger";

/**
 * Maps error categories from the error slice to analytics error types
 */
const mapErrorCategoryToAnalyticsType = (category: string): ErrorType => {
  switch (category) {
    case "network":
      return "NETWORK";
    case "data":
      return "CONTENT";
    case "system":
      return "SYSTEM";
    case "authentication":
      return "API";
    case "application":
    default:
      return "SYSTEM";
  }
};

/**
 * Component that integrates the error management system with analytics reporting
 * This component should be mounted once in the app root to automatically report errors
 */
const AnalyticsErrorIntegration: React.FC = () => {
  const activeErrors = useSelector(selectActiveErrors);
  const reportedErrorIds = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    // Report new errors to analytics
    activeErrors.forEach(async (error) => {
      // Skip if already reported
      if (reportedErrorIds.current.has(error.id)) {
        return;
      }

      try {
        const errorType = mapErrorCategoryToAnalyticsType(error.category);

        await analyticsService.reportError(
          errorType,
          error.userFriendlyMessage || error.message,
          error.code,
          error.metadata?.stack || undefined,
          false, // Initially not resolved
        );

        // Mark as reported
        reportedErrorIds.current.add(error.id);

        logger.debug("Error reported to analytics", {
          errorId: error.id,
          errorCode: error.code,
          errorType,
          message: error.message,
        });
      } catch (analyticsError) {
        logger.error("Failed to report error to analytics", {
          error: analyticsError,
          originalError: error,
        });
      }
    });

    // Clean up resolved errors from our tracking
    const activeErrorIds = new Set(activeErrors.map((error) => error.id));
    const resolvedErrorIds = Array.from(reportedErrorIds.current).filter(
      (id) => !activeErrorIds.has(id),
    );

    // Report resolved errors to analytics
    resolvedErrorIds.forEach(async (errorId) => {
      try {
        // We can't get the original error details, but we can report resolution
        await analyticsService.reportError(
          "SYSTEM",
          "Error resolved",
          errorId,
          undefined,
          true, // Resolved
        );

        logger.debug("Error resolution reported to analytics", { errorId });
      } catch (analyticsError) {
        logger.error("Failed to report error resolution to analytics", {
          error: analyticsError,
          errorId,
        });
      }
    });

    // Remove resolved errors from tracking
    resolvedErrorIds.forEach((id) => {
      reportedErrorIds.current.delete(id);
    });
  }, [activeErrors]);

  // This component doesn't render anything
  return null;
};

/**
 * Hook for manual error reporting with analytics integration
 */
export const useAnalyticsErrorReporting = () => {
  const reportError = React.useCallback(
    async (
      error: Error,
      errorType: ErrorType = "SYSTEM",
      errorCode?: string,
      resolved = false,
    ) => {
      try {
        await analyticsService.reportError(
          errorType,
          error.message,
          errorCode,
          error.stack,
          resolved,
        );

        logger.debug("Manual error reported to analytics", {
          errorType,
          errorCode,
          message: error.message,
        });
      } catch (analyticsError) {
        logger.error("Failed to report manual error to analytics", {
          error: analyticsError,
          originalError: error,
        });
      }
    },
    [],
  );

  const reportNetworkError = React.useCallback(
    async (message: string, errorCode?: string) => {
      await reportError(new Error(message), "NETWORK", errorCode);
    },
    [reportError],
  );

  const reportContentError = React.useCallback(
    async (message: string, errorCode?: string) => {
      await reportError(new Error(message), "CONTENT", errorCode);
    },
    [reportError],
  );

  const reportApiError = React.useCallback(
    async (message: string, errorCode?: string) => {
      await reportError(new Error(message), "API", errorCode);
    },
    [reportError],
  );

  const reportDisplayError = React.useCallback(
    async (message: string, errorCode?: string) => {
      await reportError(new Error(message), "DISPLAY", errorCode);
    },
    [reportError],
  );

  return {
    reportError,
    reportNetworkError,
    reportContentError,
    reportApiError,
    reportDisplayError,
  };
};

/**
 * Enhanced error boundary that reports errors to analytics
 */
export class AnalyticsErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
    fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: {
    children: React.ReactNode;
    fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  async componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Report to analytics
    try {
      await analyticsService.reportError(
        "SYSTEM",
        error.message,
        "COMPONENT_ERROR",
        error.stack,
        false,
      );

      logger.debug("Component error reported to analytics", {
        error: error.message,
        componentStack: errorInfo.componentStack,
      });
    } catch (analyticsError) {
      logger.error("Failed to report component error to analytics", {
        error: analyticsError,
        originalError: error,
      });
    }

    // Also log to console for development
    logger.error("Component error caught by analytics boundary", {
      error,
      errorInfo,
    });
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent
            error={this.state.error}
            resetError={this.resetError}
          />
        );
      }

      return (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            backgroundColor: "#f5f5f5",
            borderRadius: "8px",
            margin: "20px",
          }}
        >
          <h2>Something went wrong</h2>
          <p>{this.state.error.message}</p>
          <button
            onClick={this.resetError}
            style={{
              padding: "10px 20px",
              backgroundColor: "#1976d2",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AnalyticsErrorIntegration;

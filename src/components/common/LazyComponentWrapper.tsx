import React, {
  Suspense,
  lazy,
  memo,
  useRef,
  useEffect,
  useState,
} from "react";
import { Box, CircularProgress } from "@mui/material";
import { isLowPowerDevice } from "../../utils/performanceUtils";

interface LazyComponentWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  delay?: number;
  minHeight?: string | number;
  enableIntersectionObserver?: boolean;
}

/**
 * LazyComponentWrapper
 *
 * Provides lazy loading with intersection observer for better performance
 * Delays rendering heavy components until they're needed or visible
 */
const LazyComponentWrapper: React.FC<LazyComponentWrapperProps> = memo(
  ({
    children,
    fallback,
    delay = 0,
    minHeight = 200,
    enableIntersectionObserver = false,
  }) => {
    const [shouldRender, setShouldRender] = useState(
      !enableIntersectionObserver,
    );
    const [isDelayComplete, setIsDelayComplete] = useState(delay === 0);
    const containerRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Handle intersection observer for viewport-based lazy loading
    useEffect(() => {
      if (!enableIntersectionObserver || shouldRender) return;

      if ("IntersectionObserver" in window) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                setShouldRender(true);
                observerRef.current?.disconnect();
              }
            });
          },
          {
            rootMargin: "50px", // Start loading 50px before component comes into view
            threshold: 0.1,
          },
        );

        if (containerRef.current) {
          observerRef.current.observe(containerRef.current);
        }
      } else {
        // Fallback for browsers without IntersectionObserver
        setShouldRender(true);
      }

      return () => {
        observerRef.current?.disconnect();
      };
    }, [enableIntersectionObserver, shouldRender]);

    // Handle delay-based lazy loading
    useEffect(() => {
      if (delay > 0 && !isDelayComplete) {
        const timer = setTimeout(() => {
          setIsDelayComplete(true);
        }, delay);

        return () => clearTimeout(timer);
      }
    }, [delay, isDelayComplete]);

    // Default fallback component
    const defaultFallback = (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight,
          backgroundColor: "rgba(255, 255, 255, 0.02)",
          borderRadius: 2,
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <CircularProgress
          size={24}
          sx={{ color: "rgba(255, 255, 255, 0.6)" }}
        />
      </Box>
    );

    const renderFallback = fallback || defaultFallback;

    // Determine if we should render the component
    const canRender = shouldRender && isDelayComplete;

    return (
      <Box
        ref={containerRef}
        sx={{
          minHeight: enableIntersectionObserver ? minHeight : "auto",
          width: "100%",
        }}
      >
        {canRender ? (
          <Suspense fallback={renderFallback}>{children}</Suspense>
        ) : (
          renderFallback
        )}
      </Box>
    );
  },
);

LazyComponentWrapper.displayName = "LazyComponentWrapper";

/**
 * Helper function to create lazy-loaded components
 * Usage: const LazyComponent = createLazyComponent(() => import('./HeavyComponent'))
 */
export function createLazyComponent<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    delay?: number;
    fallback?: React.ReactNode;
    enableIntersectionObserver?: boolean;
  } = {},
) {
  const LazyComponent = lazy(importFn);

  return (props: React.ComponentProps<T>) => (
    <LazyComponentWrapper
      delay={options.delay}
      fallback={options.fallback}
      enableIntersectionObserver={options.enableIntersectionObserver}
    >
      <LazyComponent {...props} />
    </LazyComponentWrapper>
  );
}

/**
 * Staggered loading utility for multiple components
 */
export function useStaggeredLoading(
  count: number,
  baseDelay: number = 100,
  enabled: boolean = true,
) {
  const [loadedCount, setLoadedCount] = useState(enabled ? 0 : count);
  const isLowPower = useRef(isLowPowerDevice());

  useEffect(() => {
    if (!enabled || loadedCount >= count) return;

    const delay = baseDelay * (loadedCount + 1);
    const actualDelay = isLowPower.current ? delay * 2 : delay;

    const timer = setTimeout(() => {
      setLoadedCount((prev) => Math.min(prev + 1, count));
    }, actualDelay);

    return () => clearTimeout(timer);
  }, [loadedCount, count, baseDelay, enabled]);

  return {
    shouldLoad: (index: number) => index < loadedCount,
    isComplete: loadedCount >= count,
    progress: loadedCount / count,
  };
}

export default LazyComponentWrapper;

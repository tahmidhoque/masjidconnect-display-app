# Error Handling System - Usage Guide

This guide shows how to use the new graceful error handling system in the MasjidConnect Display App.

## Quick Start

### 1. Reporting Errors in Components

```typescript
import React from 'react';
import { useDispatch } from 'react-redux';
import { reportError, ErrorCode, ErrorSeverity } from '../store/slices/errorSlice';

const MyComponent: React.FC = () => {
  const dispatch = useDispatch();

  const handleDataFetch = async () => {
    try {
      const data = await fetchData();
      // Process data...
    } catch (error) {
      // Report the error to the system
      dispatch(reportError({
        code: ErrorCode.DATA_SYNC_FAILED,
        message: 'Failed to fetch prayer times data',
        severity: ErrorSeverity.MEDIUM,
        source: 'MyComponent',
        metadata: {
          timestamp: new Date().toISOString(),
          userId: getCurrentUserId(),
          attempt: retryCount
        }
      }));
    }
  };

  return (
    <div>
      {/* Component content */}
    </div>
  );
};
```

### 2. Listening to Error State

```typescript
import { useSelector } from 'react-redux';
import { selectActiveErrors, selectSystemHealth } from '../store/slices/errorSlice';

const StatusComponent: React.FC = () => {
  const activeErrors = useSelector(selectActiveErrors);
  const systemHealth = useSelector(selectSystemHealth);

  return (
    <div>
      <h3>System Status: {systemHealth.overall}</h3>
      {activeErrors.length > 0 && (
        <p>Active Issues: {activeErrors.length}</p>
      )}
    </div>
  );
};
```

### 3. Network Status Integration

```typescript
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import networkStatusService from '../services/networkStatusService';
import { updateNetworkStatus } from '../store/slices/errorSlice';

const NetworkAwareComponent: React.FC = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    // Subscribe to network status changes
    const unsubscribe = networkStatusService.subscribe((status) => {
      dispatch(updateNetworkStatus(status));

      // React to network changes
      if (!status.isOnline) {
        console.log('Gone offline, switching to cached data');
      } else if (status.isApiReachable) {
        console.log('Back online, refreshing data');
      }
    });

    return unsubscribe;
  }, [dispatch]);

  return <div>Network-aware component</div>;
};
```

## Error Categories & When to Use

### Network Errors (NET_xxx)

Use when dealing with connectivity issues:

```typescript
// Internet connectivity
dispatch(
  reportError({
    code: ErrorCode.NET_OFFLINE,
    message: "Device is offline",
    severity: ErrorSeverity.MEDIUM,
    source: "NetworkService",
  }),
);

// CORS issues
dispatch(
  reportError({
    code: ErrorCode.NET_CORS_BLOCKED,
    message: "CORS policy blocking API access",
    severity: ErrorSeverity.HIGH,
    source: "ApiClient",
  }),
);

// Connection timeouts
dispatch(
  reportError({
    code: ErrorCode.NET_TIMEOUT,
    message: "Request timed out after 30 seconds",
    severity: ErrorSeverity.LOW,
    source: "ApiClient",
    metadata: { timeout: 30000, endpoint: "/api/prayer-times" },
  }),
);
```

### Authentication Errors (AUTH_xxx)

Use for authentication and pairing issues:

```typescript
// Invalid credentials
dispatch(
  reportError({
    code: ErrorCode.AUTH_INVALID_TOKEN,
    message: "Authentication token is invalid",
    severity: ErrorSeverity.HIGH,
    source: "AuthService",
  }),
);

// Pairing required
dispatch(
  reportError({
    code: ErrorCode.AUTH_SCREEN_NOT_PAIRED,
    message: "Screen not paired with masjid account",
    severity: ErrorSeverity.CRITICAL,
    source: "AuthGuard",
  }),
);
```

### Data Errors (DATA_xxx)

Use for data loading and caching issues:

```typescript
// Missing prayer times
dispatch(
  reportError({
    code: ErrorCode.DATA_PRAYER_TIMES_MISSING,
    message: "Prayer times data not available",
    severity: ErrorSeverity.MEDIUM,
    source: "PrayerTimesService",
  }),
);

// Cache corruption
dispatch(
  reportError({
    code: ErrorCode.DATA_CACHE_CORRUPTED,
    message: "Local cache integrity check failed",
    severity: ErrorSeverity.MEDIUM,
    source: "StorageService",
    metadata: {
      cacheSize: 1024000,
      corruptedKeys: ["prayer-times", "content"],
    },
  }),
);
```

### System Errors (SYS_xxx)

Use for system resource issues:

```typescript
// Memory issues
dispatch(
  reportError({
    code: ErrorCode.SYS_MEMORY_EXCEEDED,
    message: "Memory usage above threshold",
    severity: ErrorSeverity.HIGH,
    source: "SystemMonitor",
    metadata: {
      memoryUsage: performance.memory?.usedJSHeapSize,
      threshold: 1000000000,
    },
  }),
);

// Storage full
dispatch(
  reportError({
    code: ErrorCode.SYS_STORAGE_FULL,
    message: "Device storage is full",
    severity: ErrorSeverity.CRITICAL,
    source: "StorageService",
  }),
);
```

## Error Recovery

### Automatic Recovery

Some errors trigger automatic recovery:

```typescript
import { startRecovery, completeRecovery } from "../store/slices/errorSlice";

const handleRecovery = async () => {
  dispatch(startRecovery());

  try {
    // Attempt recovery actions
    await refreshData();
    await clearCache();

    dispatch(
      completeRecovery({
        success: true,
        message: "Recovery completed successfully",
      }),
    );
  } catch (error) {
    dispatch(
      completeRecovery({
        success: false,
        message: "Recovery failed: " + error.message,
      }),
    );
  }
};
```

### Error Boundaries

Catch React component errors:

```typescript
import { ErrorCode, ErrorSeverity } from '../store/slices/errorSlice';

class ComponentErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Report component crashes
    store.dispatch(reportError({
      code: ErrorCode.APP_COMPONENT_CRASHED,
      message: error.message,
      severity: ErrorSeverity.MEDIUM,
      source: this.constructor.name,
      metadata: {
        componentStack: errorInfo.componentStack,
        errorStack: error.stack
      }
    }));
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
```

## Best Practices

### 1. Use Appropriate Severity Levels

- **CRITICAL**: App can't function (unpaired device, storage full)
- **HIGH**: Major features broken (auth failed, API down)
- **MEDIUM**: Some features affected (missing data, slow network)
- **LOW**: Minor issues (timeouts, rate limiting)

### 2. Provide Useful Metadata

```typescript
dispatch(
  reportError({
    code: ErrorCode.DATA_SYNC_FAILED,
    message: "Failed to sync prayer times",
    severity: ErrorSeverity.MEDIUM,
    source: "DataSyncService",
    metadata: {
      endpoint: "/api/prayer-times",
      lastSuccessfulSync: "2025-01-18T10:00:00Z",
      retryCount: 3,
      errorDetails: error.response?.data,
    },
  }),
);
```

### 3. Rate Limiting

The system automatically rate limits similar errors:

- Same error code within 30 seconds is suppressed
- After 5 identical errors, further reports are blocked
- Use different metadata to bypass rate limiting when needed

### 4. Recovery Actions

Provide clear recovery instructions:

```typescript
// Good: Specific recovery action
code: ErrorCode.AUTH_TOKEN_EXPIRED,
recoveryAction: 'Re-pair device'

// Bad: Generic recovery action
code: ErrorCode.AUTH_TOKEN_EXPIRED,
recoveryAction: 'Try again'
```

## UI Components

### System Status Indicator

Shows overall system health:

```typescript
<SystemStatusIndicator
  position="bottom-right"
  autoHide={true}  // Only show when there are issues
  compact={true}   // Small indicator that can be expanded
/>
```

### Graceful Error Overlay

Shows user-friendly error messages:

```typescript
<GracefulErrorOverlay
  position="center"
  autoHide={true}     // Auto-hide low severity errors
  maxWidth={600}      // Maximum overlay width
/>
```

## Testing Errors

### Manual Testing

```typescript
// Test network error
dispatch(
  reportError({
    code: ErrorCode.NET_OFFLINE,
    message: "Test offline error",
    severity: ErrorSeverity.MEDIUM,
    source: "TestComponent",
  }),
);

// Test critical error
dispatch(
  reportError({
    code: ErrorCode.AUTH_SCREEN_NOT_PAIRED,
    message: "Test pairing error",
    severity: ErrorSeverity.CRITICAL,
    source: "TestComponent",
  }),
);
```

### Error Simulation

```typescript
// Simulate network issues
networkStatusService.updateStatus({
  isOnline: false,
  isApiReachable: false,
});

// Simulate recovery
setTimeout(() => {
  networkStatusService.updateStatus({
    isOnline: true,
    isApiReachable: true,
  });
}, 5000);
```

## Monitoring & Debugging

### Console Logging

All errors are automatically logged with structured data:

```javascript
// Look for these in browser console:
[ErrorManager] NET_001: Device appears to be offline
[ErrorManager] AUTH_002: Authentication token expired
[ErrorManager] DATA_001: Prayer times data not available
```

### Error State Inspection

```typescript
// Get current error state
const state = store.getState();
console.log("Active errors:", state.errors.activeErrors);
console.log("System health:", state.errors.systemHealth);
console.log("Network status:", state.errors.networkStatus);
```

### Error Analytics

Access error history and patterns:

```typescript
// Get error counts
const errorCounts = useSelector((state) => state.errors.errorCounts);

// Get recovery attempts
const recoveryAttempts = useSelector((state) => state.errors.recoveryAttempts);

// Check if recovery in progress
const isRecovering = useSelector((state) => state.errors.isRecovering);
```

---

For more details, see the [Error Codes Documentation](./ERROR_CODES.md).

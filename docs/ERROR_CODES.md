# MasjidConnect Display App - Error Codes Documentation

This document provides a comprehensive reference for all error codes used in the MasjidConnect Display App. Each error code is designed to help developers quickly identify and resolve issues.

## Error Code Format

Error codes follow the format: `[CATEGORY]_[NUMBER]`

- **CATEGORY**: 3-4 letter category identifier
- **NUMBER**: 3-digit sequential number (001-999)

## Error Categories

### Network Errors (NET_xxx)
Issues related to network connectivity and internet access.

| Code | Name | Description | User Message | Recovery Action | Severity |
|------|------|-------------|--------------|-----------------|----------|
| NET_001 | OFFLINE | Device appears to be offline | "Your device appears to be offline. Please check your internet connection." | Check network connection | Medium |
| NET_002 | TIMEOUT | Network request timed out | "The connection is taking longer than usual. Please wait or try again." | Wait and retry automatically | Low |
| NET_003 | CONNECTION_FAILED | Unable to establish connection | "Unable to connect to the server. Please check your network settings." | Check network settings | Medium |
| NET_004 | DNS_FAILED | DNS resolution failed | "Cannot resolve server address. Please check your DNS settings." | Check DNS settings | Medium |
| NET_005 | CORS_BLOCKED | Cross-origin request blocked | "Server configuration issue. Please contact your system administrator." | Contact administrator | High |

### Authentication Errors (AUTH_xxx)
Issues related to device authentication and pairing.

| Code | Name | Description | User Message | Recovery Action | Severity |
|------|------|-------------|--------------|-----------------|----------|
| AUTH_001 | INVALID_TOKEN | Authentication token is invalid | "Authentication token is invalid. Please re-pair this device." | Re-pair device | High |
| AUTH_002 | TOKEN_EXPIRED | Authentication token has expired | "Authentication has expired. Please re-pair this device." | Re-pair device | High |
| AUTH_003 | SCREEN_NOT_PAIRED | Display not paired with masjid | "This display is not yet paired with a masjid account." | Pair device with masjid | Critical |
| AUTH_004 | PAIRING_FAILED | Device pairing process failed | "Failed to pair device. Please try again or contact support." | Try pairing again | High |
| AUTH_005 | API_KEY_INVALID | API key is invalid or revoked | "API credentials are invalid. Please re-pair this device." | Re-pair device | High |

### API Errors (API_xxx)
Issues related to API communication and server responses.

| Code | Name | Description | User Message | Recovery Action | Severity |
|------|------|-------------|--------------|-----------------|----------|
| API_001 | SERVER_DOWN | API server is unreachable | "The server is temporarily unavailable. Using cached data where possible." | Wait for server recovery | High |
| API_002 | RATE_LIMITED | Too many API requests | "Too many requests. The system will automatically retry in a moment." | Wait and retry automatically | Low |
| API_003 | INVALID_RESPONSE | Server returned invalid data | "Received unexpected data from server. Retrying..." | Retry automatically | Medium |
| API_004 | ENDPOINT_NOT_FOUND | API endpoint not found | "Server endpoint not found. Please check your configuration." | Check configuration | High |
| API_005 | INTERNAL_ERROR | Server internal error | "Server encountered an error. Using cached data where possible." | Wait and retry | Medium |

### Data Errors (DATA_xxx)
Issues related to data availability and integrity.

| Code | Name | Description | User Message | Recovery Action | Severity |
|------|------|-------------|--------------|-----------------|----------|
| DATA_001 | PRAYER_TIMES_MISSING | Prayer times data not available | "Prayer times are not available. Retrying..." | Retry data fetch | Medium |
| DATA_002 | CONTENT_MISSING | Display content not available | "Display content is not available. Using cached content." | Use cached content | Medium |
| DATA_003 | MASJID_INFO_MISSING | Masjid information not available | "Masjid information is not available. Using default settings." | Retry data fetch | Low |
| DATA_004 | CACHE_CORRUPTED | Local cache is corrupted | "Local data cache needs to be refreshed. Please wait..." | Refresh cache | Medium |
| DATA_005 | SYNC_FAILED | Data synchronization failed | "Failed to sync latest data. Using cached information." | Retry sync | Low |

### System Errors (SYS_xxx)
Issues related to system resources and hardware.

| Code | Name | Description | User Message | Recovery Action | Severity |
|------|------|-------------|--------------|-----------------|----------|
| SYS_001 | STORAGE_FULL | Device storage is full | "Device storage is full. Please free up space and restart." | Free up storage space | Critical |
| SYS_002 | MEMORY_EXCEEDED | System memory usage too high | "System memory is low. Optimizing performance..." | Optimize automatically | High |
| SYS_003 | RENDER_FAILED | Display rendering failed | "Display rendering error. Attempting to recover..." | Restart component | Medium |
| SYS_004 | SERVICE_WORKER_FAILED | Service worker crashed | "Background services failed. Restarting..." | Restart services | Medium |
| SYS_005 | ELECTRON_ERROR | Electron application error | "Application system error. Please restart the application." | Restart application | High |

### Application Errors (APP_xxx)
General application and component errors.

| Code | Name | Description | User Message | Recovery Action | Severity |
|------|------|-------------|--------------|-----------------|----------|
| APP_001 | INITIALIZATION_FAILED | App failed to initialize | "Failed to initialize application. Please restart." | Restart application | Critical |
| APP_002 | COMPONENT_CRASHED | React component crashed | "A component crashed. Attempting to recover..." | Restart component | Medium |
| APP_003 | CONFIGURATION_INVALID | Invalid app configuration | "Application configuration is invalid. Please contact support." | Contact support | Critical |
| APP_004 | UPDATE_FAILED | App update failed | "Application update failed. Continuing with current version." | Continue with current version | Low |
| APP_999 | UNKNOWN_ERROR | Unknown or unhandled error | "An unexpected error occurred. Please restart if the issue persists." | Restart if persists | Medium |

## Error Severity Levels

### Low
- Minor issues that don't significantly affect functionality
- App continues to work normally
- Automatic recovery usually possible
- User notification optional

### Medium  
- Issues that affect some functionality
- App continues to work with limitations
- Manual intervention may be required
- User should be notified

### High
- Issues that significantly impact functionality
- Core features may be unavailable
- Manual intervention usually required
- User must be notified immediately

### Critical
- Issues that prevent core functionality
- App may be unusable
- Immediate action required
- Full-screen notification required

## Error Recovery Strategies

### Automatic Recovery
The system attempts automatic recovery for:
- Network timeouts (NET_002)
- Rate limiting (API_002)
- Invalid responses (API_003)
- Memory optimization (SYS_002)

### Manual Recovery
User intervention required for:
- Authentication errors (AUTH_xxx)
- Configuration issues (APP_003)
- Storage full (SYS_001)

### System Recovery
Application restart required for:
- Initialization failures (APP_001)
- Electron errors (SYS_005)
- Critical configuration errors (APP_003)

## Implementation Guidelines

### Reporting Errors
```typescript
import { useDispatch } from 'react-redux';
import { reportError, ErrorCode, ErrorSeverity } from '../store/slices/errorSlice';

const dispatch = useDispatch();

// Report an error
dispatch(reportError({
  code: ErrorCode.NET_TIMEOUT,
  message: 'Request timed out after 30 seconds',
  severity: ErrorSeverity.LOW,
  source: 'ApiClient',
  metadata: { 
    endpoint: '/api/prayer-times',
    timeout: 30000 
  }
}));
```

### Error Boundaries
```typescript
// Catch React component errors
import { ErrorCode, ErrorSeverity } from '../store/slices/errorSlice';

componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  dispatch(reportError({
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
```

### Network Error Handling
```typescript
// Handle API errors
try {
  const response = await apiCall();
} catch (error) {
  if (error.name === 'NetworkError') {
    dispatch(reportError({
      code: ErrorCode.NET_CONNECTION_FAILED,
      message: error.message,
      severity: ErrorSeverity.MEDIUM,
      source: 'ApiClient'
    }));
  }
}
```

## Error Analytics

### Error Tracking
- All errors are logged with timestamps and metadata
- Error counts and frequency are tracked for patterns
- Rate limiting prevents error spam
- System health metrics are updated based on errors

### Debug Information
Each error includes:
- Unique error ID for tracking
- Timestamp of occurrence
- Source component/service
- Detailed metadata
- Recovery suggestions
- User-friendly messages

## Troubleshooting Guide

### Common Error Patterns

**Rapid Network Errors (NET_xxx)**
- Check internet connectivity
- Verify API server status
- Review network configuration
- Check firewall settings

**Authentication Loop (AUTH_xxx)**
- Clear localStorage credentials
- Re-pair the device
- Check API key validity
- Verify server time sync

**Data Loading Issues (DATA_xxx)**
- Check API endpoints
- Verify data format
- Clear application cache
- Check storage permissions

**System Performance (SYS_xxx)**
- Monitor memory usage
- Check available storage
- Review system logs
- Restart application

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-18 | Initial error code system |

---

For questions or updates to this documentation, please contact the development team. 
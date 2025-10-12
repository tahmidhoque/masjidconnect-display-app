# Remote Control API Documentation

This document describes the SSE (Server-Sent Events) API for remote control of MasjidConnect Display screens from the admin portal.

## Overview

The display app connects to the backend SSE endpoint to receive remote control commands. This allows administrators to manage devices remotely without physical access.

## SSE Connection

### Endpoint

```
GET /api/sse
```

### Authentication

The display app authenticates using query parameters (EventSource doesn't support custom headers):

```
GET /api/sse?screenId={screenId}&apiKey={apiKey}
```

- `screenId` (required): Unique identifier for the display screen
- `apiKey` (required): API key for authentication

### Connection Lifecycle

1. **Initial Connection**: Display app connects on startup after successful pairing
2. **Reconnection**: Automatic reconnection with exponential backoff (max 10 attempts)
3. **Heartbeat**: Connection maintained via SSE keep-alive messages

##Remote Control Commands

The display app listens for the following SSE event types. Each command should be sent as a named SSE event with JSON data.

### 1. FORCE_UPDATE

Triggers an immediate check for app updates and downloads if available.

**Event Type**: `FORCE_UPDATE`

**Payload**:

```json
{
  "type": "FORCE_UPDATE",
  "commandId": "uuid-v4",
  "timestamp": "2024-01-15T10:30:00Z",
  "payload": {}
}
```

**Display Response** (via heartbeat or analytics):

```json
{
  "commandId": "uuid-v4",
  "success": true,
  "message": "Update available: 1.2.3. Download initiated.",
  "timestamp": "2024-01-15T10:30:05Z"
}
```

**Use Cases**:

- Force specific screens to update immediately
- Push critical security updates
- Coordinate updates across multiple screens

---

### 2. RESTART_APP

Restarts the display application with a countdown notification.

**Event Type**: `RESTART_APP`

**Payload**:

```json
{
  "type": "RESTART_APP",
  "commandId": "uuid-v4",
  "timestamp": "2024-01-15T10:30:00Z",
  "payload": {
    "countdown": 10
  }
}
```

**Parameters**:

- `countdown` (optional): Countdown in seconds before restart (default: 10)

**Display Response**:

```json
{
  "commandId": "uuid-v4",
  "success": true,
  "message": "Restart initiated with countdown",
  "timestamp": "2024-01-15T10:30:05Z"
}
```

**Use Cases**:

- Apply configuration changes that require restart
- Fix frozen or unresponsive screens
- Coordinate scheduled restarts during non-prayer times

---

### 3. RELOAD_CONTENT

Invalidates all API caches and reloads content from the server.

**Event Type**: `RELOAD_CONTENT`

**Payload**:

```json
{
  "type": "RELOAD_CONTENT",
  "commandId": "uuid-v4",
  "timestamp": "2024-01-15T10:30:00Z",
  "payload": {}
}
```

**Display Response**:

```json
{
  "commandId": "uuid-v4",
  "success": true,
  "message": "Content reload initiated",
  "timestamp": "2024-01-15T10:30:05Z"
}
```

**Use Cases**:

- Force refresh after making changes to announcements/events
- Clear stale cached data
- Troubleshoot display issues

---

### 4. CLEAR_CACHE

Clears all caches including localStorage, localforage, and service worker caches. **Preserves authentication credentials**. App reloads after 2 seconds.

**Event Type**: `CLEAR_CACHE`

**Payload**:

```json
{
  "type": "CLEAR_CACHE",
  "commandId": "uuid-v4",
  "timestamp": "2024-01-15T10:30:00Z",
  "payload": {}
}
```

**Display Response**:

```json
{
  "commandId": "uuid-v4",
  "success": true,
  "message": "Cache cleared successfully. App will reload.",
  "timestamp": "2024-01-15T10:30:05Z"
}
```

**Use Cases**:

- Fix display rendering issues
- Clear corrupted cached data
- Troubleshoot app behavior

**Warning**: This is a destructive operation. Use sparingly.

---

### 5. UPDATE_SETTINGS

Updates display settings remotely.

**Event Type**: `UPDATE_SETTINGS`

**Payload**:

```json
{
  "type": "UPDATE_SETTINGS",
  "commandId": "uuid-v4",
  "timestamp": "2024-01-15T10:30:00Z",
  "payload": {
    "settings": {
      "orientation": "landscape",
      "brightness": 80,
      "autoUpdate": true,
      "displaySchedule": {
        "start": "05:00",
        "end": "23:00"
      }
    }
  }
}
```

**Allowed Settings**:

- `orientation`: "landscape" | "portrait"
- `brightness`: number (0-100)
- `autoUpdate`: boolean
- `displaySchedule`: { start: string, end: string }

**Display Response**:

```json
{
  "commandId": "uuid-v4",
  "success": true,
  "message": "Settings updated: orientation, brightness",
  "timestamp": "2024-01-15T10:30:05Z"
}
```

**Use Cases**:

- Remotely adjust screen orientation
- Control display schedules
- Enable/disable auto-updates

---

### 6. FACTORY_RESET

Performs a complete factory reset with a 30-second countdown. **This is irreversible**.

**Event Type**: `FACTORY_RESET`

**Payload**:

```json
{
  "type": "FACTORY_RESET",
  "commandId": "uuid-v4",
  "timestamp": "2024-01-15T10:30:00Z",
  "payload": {
    "countdown": 30
  }
}
```

**Parameters**:

- `countdown` (optional): Countdown in seconds before reset (default: 30)

**Display Response**:

```json
{
  "commandId": "uuid-v4",
  "success": true,
  "message": "Factory reset initiated with 30-second countdown",
  "timestamp": "2024-01-15T10:30:05Z"
}
```

**What Gets Reset**:

- All authentication credentials
- All cached data
- All settings and preferences
- App returns to pairing screen

**Use Cases**:

- Decommission a screen
- Reassign screen to different masjid
- Fix critical configuration issues

**Warning**: This is a **destructive operation**. User can cancel within the countdown period.

---

### 7. CAPTURE_SCREENSHOT

Captures a screenshot of the current display and stores it for retrieval.

**Event Type**: `CAPTURE_SCREENSHOT`

**Payload**:

```json
{
  "type": "CAPTURE_SCREENSHOT",
  "commandId": "uuid-v4",
  "timestamp": "2024-01-15T10:30:00Z",
  "payload": {}
}
```

**Display Response**:

```json
{
  "commandId": "uuid-v4",
  "success": true,
  "message": "Screenshot captured successfully",
  "timestamp": "2024-01-15T10:30:05Z"
}
```

**Screenshot Details**:

- Format: JPEG (80% quality)
- Scale: 0.5x (reduced for faster upload)
- Storage: Temporarily stored in localStorage as base64

**Use Cases**:

- Verify display is showing correct content
- Troubleshoot display issues
- Monitor screen status remotely

**Note**: Future versions will support automatic upload to the portal API.

---

## Response Handling

### Command Response Format

Displays send command responses via the analytics/heartbeat endpoint. Responses include:

```json
{
  "commandId": "uuid-v4",
  "success": boolean,
  "message": "string (if success)",
  "error": "string (if failure)",
  "timestamp": "ISO 8601 timestamp"
}
```

### Response Storage

Responses are stored in `localStorage.pending_command_responses` and sent with the next heartbeat/analytics call. After successful transmission, responses are cleared.

### Retrieving Responses

Backend should:

1. Include command responses in heartbeat/analytics data
2. Match responses to commands using `commandId`
3. Update command status in the database
4. Display response in admin portal

---

## Error Handling

### Command Throttling

Commands of the same type are throttled to prevent spam:

- Cooldown period: 2 seconds between commands of the same type
- Applies per command type (e.g., multiple RESTART_APP commands)

### Failed Commands

If a command fails:

```json
{
  "commandId": "uuid-v4",
  "success": false,
  "error": "Detailed error message",
  "timestamp": "ISO 8601 timestamp"
}
```

Common error scenarios:

- Invalid command format
- Missing required parameters
- Device offline
- Insufficient permissions
- User cancelled operation

---

## Implementation Example (Backend)

### Sending a Command

```typescript
// Express.js example
app.post('/api/admin/remote-command', async (req, res) => {
  const { screenIds, commandType, payload } = req.body;

  const command = {
    type: commandType,
    commandId: uuidv4(),
    timestamp: new Date().toISOString(),
    payload: payload || {},
  };

  // Send to specific screens via SSE
  screenIds.forEach((screenId) => {
    const connection = sseConnections.get(screenId);
    if (connection) {
      connection.write(`event: ${commandType}\n` + `data: ${JSON.stringify(command)}\n\n`);
    }
  });

  // Store command in database for tracking
  await db.commands.insert({
    ...command,
    screenIds,
    status: 'sent',
  });

  res.json({ success: true, command });
});
```

### Receiving Response

```typescript
// In heartbeat/analytics endpoint
app.post('/api/displays/heartbeat', async (req, res) => {
  const { screenId, commandResponses } = req.body;

  if (commandResponses && commandResponses.length > 0) {
    // Update command status in database
    for (const response of commandResponses) {
      await db.commands.update(
        { commandId: response.commandId },
        {
          status: response.success ? 'completed' : 'failed',
          response: response,
          completedAt: new Date(),
        }
      );
    }
  }

  res.json({ success: true });
});
```

---

## Security Considerations

1. **Authentication**: All SSE connections must be authenticated with valid `screenId` and `apiKey`
2. **Authorization**: Verify admin has permission to control specific screens
3. **Rate Limiting**: Implement rate limits to prevent abuse
4. **Command Validation**: Validate all command payloads before sending
5. **Audit Log**: Log all remote control commands for security auditing
6. **User Confirmation**: Destructive operations (FACTORY_RESET) have countdown periods allowing cancellation

---

## Testing

### Testing Individual Commands

You can test commands using curl or Postman:

```bash
# Send RELOAD_CONTENT command
curl -X POST https://your-api.com/api/admin/remote-command \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "screenIds": ["screen_123"],
    "commandType": "RELOAD_CONTENT",
    "payload": {}
  }'
```

### Monitoring Command Execution

Check command status via the admin portal or API:

```bash
curl https://your-api.com/api/admin/commands/uuid-v4 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## Future Enhancements

Potential future additions:

1. **Batch Operations**: Send commands to multiple screens efficiently
2. **Scheduled Commands**: Schedule commands for future execution
3. **Command History**: View complete command history per screen
4. **Remote Logs**: Fetch application logs remotely
5. **Live View**: Stream screenshot updates for real-time monitoring
6. **Custom Commands**: Plugin system for custom remote commands

---

## Support

For questions or issues with the Remote Control API:

- Technical Documentation: `/docs`
- Backend API: Check main API documentation
- Display App: Check display app documentation

---

**Last Updated**: 2024-01-15
**API Version**: 1.0.0

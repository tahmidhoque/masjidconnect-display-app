# Screen Pairing Process Guide

This document outlines the correct step-by-step process for pairing a display screen with the masjid management system.

## Overview of the Pairing Flow

1. Display device requests a pairing code
2. Display shows the code to the user
3. Display polls to check if the code has been paired
4. Admin enters the code in the management interface
5. Display receives confirmation and credentials
6. Display begins normal operation

## Detailed Steps with Examples

### Step 1: Request a Pairing Code (Display Device)

The display device must first request a pairing code from the server:

```bash
curl -X POST http://localhost:3000/api/screens/unpaired \
  -H "Content-Type: application/json" \
  -d '{"deviceType": "DISPLAY", "orientation": "LANDSCAPE"}'
```

**Response:**
```json
{
  "pairingCode": "123456",
  "expiresAt": "2023-04-01T12:15:00Z",
  "checkInterval": 5000
}
```

> **Important:** This step creates a new screen record in the database with the generated pairing code. The code expires after 15 minutes.

### Step 2: Display the Pairing Code (Display Device)

The display should show the pairing code prominently on screen for the user to see. The code should be clearly visible and easy to read.

### Step 3: Poll for Pairing Status (Display Device)

The display should periodically check if the code has been paired by an admin:

```bash
curl -X POST http://localhost:3000/api/screens/unpaired/check \
  -H "Content-Type: application/json" \
  -d '{"pairingCode": "123456"}'
```

**Response (if not yet paired):**
```json
{
  "paired": false,
  "checkAgainIn": 5000
}
```

**Response (if paired):**
```json
{
  "paired": true,
  "apiKey": "generated-api-key",
  "screenId": "screen-id"
}
```

> **Note:** The display should continue polling every 5 seconds until it receives a successful pairing response or until the code expires.

### Step 4: Admin Pairs the Device (Admin Interface)

Meanwhile, the admin enters the pairing code in the management interface:

```bash
curl -X POST http://localhost:3000/api/screens/pair \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {admin-token}" \
  -d '{
    "pairingCode": "123456",
    "name": "Lobby Display",
    "location": "Main Entrance"
  }'
```

**Response:**
```json
{
  "success": true,
  "screen": {
    "id": "screen-id",
    "name": "Lobby Display",
    "apiKey": "generated-api-key"
  }
}
```

### Step 5: Display Receives Pairing Confirmation (Display Device)

When the display's polling detects that it's been paired (from Step 3), it should:

1. Store the API key and screen ID securely
2. Show a success message to the user
3. Transition to the main display interface

### Step 6: Display Begins Normal Operation (Display Device)

After pairing, the display should use the API key for all future requests:

```bash
curl -X GET http://localhost:3000/api/screen/content \
  -H "Authorization: Bearer {apiKey}" \
  -H "X-Screen-ID: {screenId}"
```

**Response:**
```json
{
  "screen": { /* screen details */ },
  "masjid": { /* masjid details */ },
  "schedule": { /* content schedule */ },
  "prayerTimes": { /* prayer times data */ },
  "contentOverrides": [ /* any overrides */ ],
  "lastUpdated": "2023-04-01T12:30:00Z"
}
```

## Heartbeat Mechanism

The display should also send regular heartbeats to indicate it's online:

```bash
curl -X POST http://localhost:3000/api/screen/heartbeat \
  -H "Authorization: Bearer {apiKey}" \
  -H "X-Screen-ID: {screenId}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ONLINE",
    "metrics": {
      "uptime": 3600,
      "memoryUsage": 120,
      "lastError": null
    }
  }'
```

## Common Issues and Troubleshooting

### 1. "Invalid or expired pairing code" Error

This occurs when:
- The pairing code doesn't exist in the database
- The code has expired (codes expire after 15 minutes)
- The code has already been used

**Solution:** Request a new pairing code by repeating Step 1.

### 2. Authentication Failures After Pairing

If the display receives 401 errors after pairing:
- Verify the API key and screen ID are correct
- Check if the screen has been deleted or deactivated in the admin interface
- Re-pair the device if necessary

### 3. Pairing Process Timeout

If the admin doesn't enter the code within 15 minutes:
- The code will expire
- The display should request a new code
- The user should be notified that the previous code has expired

## Implementation Checklist

- [ ] Request a pairing code from `/api/screens/unpaired`
- [ ] Display the code to the user
- [ ] Poll `/api/screens/unpaired/check` until paired
- [ ] Store the API key and screen ID securely
- [ ] Use the API key for all subsequent requests
- [ ] Implement heartbeat mechanism
- [ ] Handle error cases and re-pairing when needed 
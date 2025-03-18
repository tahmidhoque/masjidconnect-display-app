# Pairing Endpoint Fixes

This document outlines the changes needed on the backend to fix issues with the screen pairing process.

## Current Issues

1. When a pairing code has been paired in the dashboard, the `/api/screens/unpaired/check` endpoint returns a 404 error with "Invalid or expired pairing code" instead of returning a successful pairing response.

2. The screen loses its pairing information when it's paired in the dashboard, causing it to be unable to recover.

## Required Backend Changes

### 1. New Endpoint: `/api/screens/paired-credentials`

Create a new endpoint that allows a device to retrieve its credentials using a pairing code that has already been paired in the dashboard.

**Request:**
```json
{
  "pairingCode": "6H65K8"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "apiKey": "generated-api-key",
    "screenId": "screen-id"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Invalid or expired pairing code",
  "status": 404
}
```

**Implementation Notes:**
- This endpoint should check if the pairing code exists in the database
- If the code exists and has been paired (has an associated screen record), return the API key and screen ID
- If the code doesn't exist or hasn't been paired, return an error
- The pairing code should be kept in the database even after it's been paired, with a flag indicating it's been used

### 2. Modify the Pairing Process

Update the pairing process to keep the pairing code in the database even after it's been paired:

1. When a pairing code is generated, store it in the database with a `paired: false` flag
2. When the code is paired in the dashboard, update the record to `paired: true` instead of deleting it
3. Add a reference to the screen ID that was created during pairing
4. Set an expiration time for paired codes (e.g., 24 hours) to clean up the database

### 3. Update the `/api/screens/unpaired/check` Endpoint

Modify the endpoint to handle paired codes more gracefully:

1. If the code exists and is paired, return the credentials instead of a 404 error:

```json
{
  "paired": true,
  "apiKey": "generated-api-key",
  "screenId": "screen-id"
}
```

2. If the code exists but isn't paired yet, return the current response:

```json
{
  "paired": false,
  "checkAgainIn": 5000
}
```

3. Only return a 404 error if the code doesn't exist in the database at all

## Frontend Changes Already Implemented

The frontend has been updated to:

1. Handle 404 errors from the `/api/screens/unpaired/check` endpoint by trying the new `/api/screens/paired-credentials` endpoint
2. Better manage the pairing state to prevent losing credentials
3. Improve error handling and user feedback during the pairing process

## Testing

After implementing these changes, please test the following scenarios:

1. Generate a new pairing code on a display device
2. Pair the code in the dashboard
3. Verify the display device successfully receives the credentials
4. Restart the display device and verify it can still retrieve its credentials

## Implementation Timeline

These changes are critical for the proper functioning of the display devices. Please prioritize implementing these fixes as soon as possible. 
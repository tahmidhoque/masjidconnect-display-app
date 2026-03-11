# PRD: Display App – Consuming Display Settings (Screen Customisation)

## 1. Overview

### 1.1 Purpose

Define exactly what the Display App must do to consume the new **display settings** (screen customisation) feature. This includes where to obtain the settings, how to react to real-time changes, and how to apply them to the prayer times UI.

### 1.2 Context

- The backend now stores masjid-level display settings (Ramadan mode, time format, show imsak, show tomorrow's jamaats).
- These settings are exposed in the content API response and pushed to displays in real time via WebSocket when an admin changes them.
- The Display App must read these settings, apply them to the prayer times display, and refetch when notified of changes.

### 1.3 Out of scope

- Backend or realtime server changes (already implemented).
- Admin UI for editing these settings (already implemented in the admin portal).

---

## 2. Where to Get Display Settings

### 2.1 Primary source: Content API

**The display settings are bundled in the content response.** There is no separate endpoint for display settings.

**Endpoint:** `GET /api/screens/content` (or `GET /api/screen/content` if your app uses that variant)

**Authentication:** Same as other screen APIs:
- Header: `Authorization: Bearer {apiKey}`
- Header: `X-Screen-ID: {screenId}`

**Response shape:** The `data` object includes a new `displaySettings` object:

```json
{
  "success": true,
  "data": {
    "screen": { ... },
    "masjid": { ... },
    "schedule": { ... },
    "prayerTimes": [ ... ],
    "events": [ ... ],
    "displaySettings": {
      "ramadanMode": "auto",
      "isRamadanActive": true,
      "timeFormat": "12h",
      "showImsak": true,
      "showTomorrowJamaat": false
    },
    "lastUpdated": "2025-03-10T12:00:00.000Z"
  }
}
```

### 2.2 displaySettings object (TypeScript)

```ts
interface DisplaySettings {
  /** Admin choice: "auto" = use Hijri calendar, "on" = force Ramadan mode, "off" = force off */
  ramadanMode: "auto" | "on" | "off";
  /** Resolved value: true if Ramadan mode should be shown (based on ramadanMode + Hijri date) */
  isRamadanActive: boolean;
  /** "12h" = 5:30 AM, "24h" = 05:30 */
  timeFormat: "12h" | "24h";
  /** Show imsak/sehri time in the prayer times section */
  showImsak: boolean;
  /** Show a column with tomorrow's jamaat times */
  showTomorrowJamaat: boolean;
}
```

### 2.3 Prayer times now include imsak

Each item in `data.prayerTimes` may now include `imsak`:

```json
{
  "date": "2025-03-10",
  "fajr": "05:30",
  "sunrise": "06:45",
  "zuhr": "12:15",
  "asr": "15:30",
  "maghrib": "18:00",
  "isha": "19:15",
  "imsak": "05:20",
  "fajrJamaat": "05:45",
  "zuhrJamaat": "12:30",
  "asrJamaat": "15:45",
  "maghribJamaat": "18:10",
  "ishaJamaat": "19:30",
  "jummahKhutbah": null,
  "jummahJamaat": null
}
```

- `imsak` is `string | null` (e.g. `"05:20"` or `null` if not calculated).
- The display app should only **show** imsak when `displaySettings.showImsak === true`; the data is always present when the masjid has it configured.

---

## 3. Real-Time Updates: content:invalidate

### 3.1 Event

When an admin saves display settings in the admin portal, the backend sends a WebSocket event to all screens in that masjid.

**Event name:** `content:invalidate`

**Payload (extended from existing content invalidation):**

```ts
interface ContentInvalidationPayload {
  type: "prayer_times" | "schedule" | "content_item" | "schedule_assignment" | "events" | "display_settings";
  masjidId: string;
  entityId?: string;
  screenId?: string;
  action: "created" | "updated" | "deleted";
  timestamp: string;
}
```

**New type:** `display_settings`

- When `type === "display_settings"`, the admin has changed Ramadan mode, time format, show imsak, or show tomorrow's jamaats.
- `action` will typically be `"updated"`.

### 3.2 What the display must do on content:invalidate

| `type` | Required behaviour |
|--------|--------------------|
| `display_settings` | Refetch full content (or the content that includes `displaySettings`). The content API returns the updated `displaySettings` and `imsak` in prayer times. After refetch, re-apply the new settings to the UI. |

**Implementation options:**

1. **Simplest:** Treat `display_settings` like other content types — refetch full content from `GET /api/screens/content` (or `/api/screen/content`). The response includes `displaySettings` and updated `prayerTimes` with `imsak`.
2. **If you already refetch full content for `prayer_times`, `schedule`, etc.:** Add `display_settings` to the same handler — refetch full content. No separate logic needed.

**Example handler (pseudo-code):**

```javascript
socket.on("content:invalidate", (payload) => {
  if (!payload?.type) return;

  const typesThatNeedFullContentRefetch = [
    "prayer_times",
    "schedule",
    "content_item",
    "schedule_assignment",
    "events",
    "display_settings",  // ADD THIS
  ];

  if (typesThatNeedFullContentRefetch.includes(payload.type)) {
    refetchFullContent().then((content) => {
      applyDisplaySettings(content.displaySettings);
      updatePrayerTimesDisplay(content.prayerTimes, content.displaySettings);
    });
  }
});
```

---

## 4. Applying Display Settings to the UI

### 4.1 Ramadan mode (`isRamadanActive`)

- **Use `isRamadanActive`, not `ramadanMode`.** The backend has already resolved "auto" into a boolean using the Hijri calendar.
- When `isRamadanActive === true`: show your existing Ramadan layout (suhoor/iftar emphasis, different colours, etc.). The display app already has this logic.
- When `isRamadanActive === false`: show the regular layout.

### 4.2 Time format (`timeFormat`)

- **`"12h"`:** Format all prayer times as 12-hour (e.g. `5:30 AM`, `6:45 PM`). Use locale-appropriate AM/PM.
- **`"24h"`:** Format as 24-hour (e.g. `05:30`, `18:45`).

Apply to:
- Prayer times (fajr, zuhr, maghrib, etc.)
- Jamaat times
- Imsak
- Any countdown or "next prayer" display
- Jumuah khutbah/jamaat times

### 4.3 Show imsak (`showImsak`)

- When `showImsak === true`: include imsak in the prayer times section (e.g. as a row or column, depending on your layout).
- When `showImsak === false`: do not show imsak.
- Use `pt.imsak` from the prayer times array; it may be `null` for some dates.

### 4.4 Show tomorrow's jamaats (`showTomorrowJamaat`)

- When `showTomorrowJamaat === true`: add a column (or equivalent) showing tomorrow's jamaat times for each prayer.
- The `prayerTimes` array includes multiple days; use the entry for `date === tomorrow` (YYYY-MM-DD) to get `fajrJamaat`, `zuhrJamaat`, etc.
- When `showTomorrowJamaat === false`: hide that column.

**Example:** If today is 2025-03-10, find the prayer time object where `date === "2025-03-11"` and use its jamaat fields.

---

## 5. Implementation Checklist (for the agent)

### 5.1 Data consumption

- [ ] Parse `data.displaySettings` from the content API response.
- [ ] Store `displaySettings` in app state or cache alongside other content.
- [ ] Parse `imsak` from each `prayerTimes` entry (it may be `null`).
- [ ] Ensure the content fetch uses the correct endpoint (`/api/screens/content` or `/api/screen/content`) and auth headers.

### 5.2 WebSocket: content:invalidate

- [ ] Add a listener for `content:invalidate` (if not already present).
- [ ] When `payload.type === "display_settings"`, trigger a refetch of full content.
- [ ] After refetch, apply the new `displaySettings` to the UI (see §4).
- [ ] Optionally debounce/coalesce multiple invalidations within a short window (e.g. 2 seconds) to avoid redundant refetches.

### 5.3 UI: Ramadan mode

- [ ] Use `displaySettings.isRamadanActive` to switch between Ramadan and regular layout.
- [ ] Do not compute Ramadan from the Hijri calendar in the display app; the backend has already done this.

### 5.4 UI: Time format

- [ ] Create or use a time-formatting helper that respects `displaySettings.timeFormat`.
- [ ] Apply to all displayed times: prayer times, jamaats, imsak, countdowns, etc.

### 5.5 UI: Imsak

- [ ] When `displaySettings.showImsak === true`, render imsak in the prayer times section.
- [ ] Use `pt.imsak` from the prayer times data; handle `null` gracefully (e.g. hide that row or show a placeholder).

### 5.6 UI: Tomorrow's jamaats

- [ ] When `displaySettings.showTomorrowJamaat === true`, add a column for tomorrow's jamaats.
- [ ] Derive tomorrow's date (YYYY-MM-DD) from the masjid timezone.
- [ ] Find the `prayerTimes` entry for tomorrow and display `fajrJamaat`, `zuhrJamaat`, `asrJamaat`, `maghribJamaat`, `ishaJamaat`.

### 5.7 Defaults and backward compatibility

- [ ] If `displaySettings` is missing from the response (e.g. old backend), use safe defaults:
  - `ramadanMode: "auto"`
  - `isRamadanActive: false` (or compute from local Hijri if you must)
  - `timeFormat: "12h"`
  - `showImsak: false`
  - `showTomorrowJamaat: false`
- [ ] If `imsak` is missing on a prayer time entry, treat as `null` and do not show it.

---

## 6. Endpoint Reference

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/screens/content` | GET | Bearer + X-Screen-ID | Full content including `displaySettings`, `prayerTimes` (with `imsak`), schedule, events. **This is the single source for display settings.** |
| `/api/screen/content` | GET | Bearer + X-Screen-ID | Alternative content endpoint (if your app uses this path). Ensure it returns `displaySettings`; if not, the backend may need to be updated to add it to this route as well. |
| `/api/screen/prayer-times` | GET | Bearer + X-Screen-ID | Prayer times only; now includes `imsak`. Use if you fetch prayer times separately. |

**Note:** If your display app uses `/api/screen/content` (singular) and that route does not yet return `displaySettings`, you have two options:
1. Switch to `/api/screens/content` (plural), which includes `displaySettings`.
2. Request a backend change to add `displaySettings` to `/api/screen/content`.

---

## 7. Flow Diagram

```
Admin saves display settings
         │
         ▼
Backend: POST /api/displays/settings
         │
         ├──► DB: Update Masjid.displaySettings
         │
         └──► Realtime server: content:invalidate { type: "display_settings" }
                        │
                        ▼
              Display App (WebSocket)
                        │
                        ├──► Listen: content:invalidate
                        │
                        └──► Refetch: GET /api/screens/content
                                        │
                                        ▼
                              Response includes:
                              - data.displaySettings
                              - data.prayerTimes[].imsak
                                        │
                                        ▼
                              Apply to UI:
                              - Ramadan layout (isRamadanActive)
                              - Time format (12h/24h)
                              - Show/hide imsak
                              - Show/hide tomorrow's jamaats column
```

---

## 8. Success Criteria

- When an admin changes display settings (Ramadan mode, time format, show imsak, show tomorrow's jamaats), connected displays receive `content:invalidate` and refetch content.
- Within a short time (one refetch cycle), the display shows:
  - Correct Ramadan vs regular layout based on `isRamadanActive`
  - Times in 12h or 24h format based on `timeFormat`
  - Imsak visible or hidden based on `showImsak`
  - Tomorrow's jamaats column visible or hidden based on `showTomorrowJamaat`
- No crashes or errors when `displaySettings` is missing (backward compatibility).
- Displays that were disconnected when settings changed still get correct data on the next scheduled refetch or after reconnect.

---

## 9. Document Info

- **Title:** Display App – Consuming Display Settings (Screen Customisation)
- **Audience:** Display app developers and AI agents implementing the display client.
- **Related docs:** 
  - [DISPLAY-BACKEND-COMMUNICATION.md](./DISPLAY-BACKEND-COMMUNICATION.md)
  - [PRD-display-app-content-invalidation.md](/docs/PRD-display-app-content-invalidation.md)
- **Last updated:** 2025-03-10

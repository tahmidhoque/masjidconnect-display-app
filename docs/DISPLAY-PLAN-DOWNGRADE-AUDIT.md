# Display Full → Free lockdown audit

Display-side defensive only. Display does **not** own entitlements. Cloud/Portal must omit premium from the display payload; this client fails safe when lists vanish and clears persisted Full residue after a **successful live** refetch.

Portal confirmed Free loses (omit from Display payload): carousel premium (media/video/donation/events slides beyond Free), emergencyAnnouncements, playlistScheduling, extra layouts/custom premium presets, displayLogo/removeBranding, seasonal/multi-jamaat beyond Free, streaming/Adhan-text Pro modules, dual Jumu’ah beyond `maxJumuahSchedules: 1`.

Keep: prayerTimes core, basic free layout (max 1), screens max 1, prayer widget limited.

Today: API still mostly sends premium after Full→Free — Portal PR in flight. Display still renders whatever the live payload contains (no client feature gate).

## 1. Current Full → Free behaviour on device

Pairing is credentials only (`apiKey`, `screenId`, `masjidId`). No plan/entitlement field.

| Payload change | Client behaviour |
|---|---|
| Live refetch omits/empties `schedule` / playlists | Redux + LocalForage schedule cleared; carousel collapses; prayer board expands |
| `masjid.logoUrl` omitted / null | Logo not rendered |
| Unknown zone `component` | Dropped by `sanitiseZone` |
| Empty jumuah-bar (no sessions) | Zone hidden |
| `layout` null / unsanitisable | `DEFAULT_LAYOUT_CONFIG`, then empty content zone collapsed |
| Content-only layout after collapse | `ensureCorePrayerZones` injects prayer strip + footer (and header/countdown when the strip is absent) |
| `displaySettings` missing | `DEFAULT_DISPLAY_SETTINGS` |
| Theme / logo extras invalid | Default palette; no logo |
| Sync / WS failure | Last persisted payload kept (offline-first) |

No reconnect storm. Do not delete hall screens on downgrade (`screen_token_invalid` factory-resets).

No upgrade or “scary” banner is shown on the hall TV. Empty carousel is silent.

## 2. Gaps / crash risks (residual for CoS)

1. **Portal still sending premium (in flight).** If `GET /api/screen/content` still includes VIDEO/MEDIA/DONATION/events/extra playlists, Display will show them. Client will not invent a local entitlement list.
2. **Dual Jumu’ah / seasonal extras in `prayerTimes`.** If Cloud still sends `jumuahSessions[2]`, the bar still renders every session. Strip must be server-side (`maxJumuahSchedules: 1`).
3. **Emergency alerts.** `emergency:alert` WS and persisted `emergency` slice are not cleared on content refetch (a live alert must stay). `emergencyAnnouncements` as carousel items go away with the schedule. Residual: a leftover persisted emergency overlay if Cloud does not send `emergency:clear`.
4. **Custom theme / extra layout presets** still apply if the live `layout.config` still contains them. Client only sanitises unknown zones and collapses empty content.
5. **Streaming / Adhan-text Pro** — no such modules exist in this repo. Residual: none on Display; Cloud must not add them to Free payloads later without a skip path.
6. **Failed refetch** keeps Full cache (correct offline). Hall stays on premium until the next successful live pull.
7. **No `plan.changed` event.** Relies on existing `content:invalidate` (`display_layout`, `display_settings`, `schedule`, `playlist_assignment`, `content_item`) or `content:update`.

## 3. Confirmed contract (Cloud / Portal)

Authoritative on downgrade — HTTP 200, same envelope:

- `prayerTimes` always present
- `schedule.items` / `scheduledPlaylists` omit disallowed types or send `[]`
- `layout`: one basic Free template (prayer-times + footer; optional header/countdown)
- `masjid.logoUrl`: `null`; `layout.config.theme` / `logo`: `null`
- Dual Jumu’ah capped at 1; no emergency announcement feed; no streaming/Adhan-text Pro
- Do not 401/403; do not delete the Screen row
- Publish one coalesced `content:invalidate` (`display_layout` + schedule/playlist) or `content:update`

Optional later: `plan` / `features` hints. Absence = trust payload (today).

## 4. Implementation plan

| Lane | Work | Order |
|---|---|---|
| **Portal / Cloud** | Entitlement-aware strip (in flight) | 1 |
| **Realtime** | Invalidate layout + schedule on plan change | 1 |
| **Display (this PR)** | Collapse empty zones; clear live-refetch residue; silent empty carousel; core prayer chrome | Safe now |
| **Display later** | Honour optional `features` skip-list once Cloud ships it | After Cloud |

## 5. This PR

- Collapse leftover content zone when the playlist is empty (except prayer-phase overlays)
- Hide empty Jumu’ah bar; inject prayer strip/footer if collapse would leave a blank hall
- On **successful live** content refetch (WS invalidate / force refresh): treat omitted/empty schedule and playlists as empty; write `EMPTY_SCHEDULE` to LocalForage; drop Redux residue; wipe unused media cache (`clearWhenEmpty`)
- Failed/cached fetches do **not** wipe (offline-first)
- No hall upgrade banner; no version bump

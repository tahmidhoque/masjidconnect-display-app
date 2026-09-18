# Display Full → Free lockdown audit

Display-side defensive only. Display does **not** own entitlements. Cloud/Portal must stop feeding premium payload; this client only fails safe when fields vanish.

## 1. Current Full → Free behaviour (inferred from code)

Display has **no plan / subscription / entitlement gate**. Pairing returns `apiKey`, `screenId`, `masjidId` only (`src/api/models.ts`). Bootstrap and mid-session updates all go through `GET /api/screen/content` (`refreshContent`) plus Socket.io `content:invalidate` / `content:update` / `prayer-times:update` / `screen:command`.

What the device does today when a field disappears:

| Payload change | Client behaviour |
|---|---|
| `masjid.logoUrl` omitted / null | Logo not rendered (`selectMasjidLogoUrl`, `DisplayScreen`) |
| `layout` null / unsanitisable | Built-in `DEFAULT_LAYOUT_CONFIG` (content + prayer strip + footer) |
| Unknown zone `component` | Dropped by `sanitiseZone` |
| Layout with only prayer widgets | `isPrayerOnlyLayout` — prayer board expands |
| Schedule / playlist empty | Content zone stayed visible and showed “No content to display” (**fixed in this PR**) |
| `displaySettings` missing | `DEFAULT_DISPLAY_SETTINGS` via `extractDisplaySettings` |
| Theme invalid / null | Default midnight palette (`buildThemeStyle`) |
| Jumu'ah times missing | `JumuahBar` returns `null` (zone wrapper may still exist) |
| Prayer times missing | Shimmer “Loading prayer times…” + throttled force-refresh (30s) |
| Sync / WS failure | Last persisted `screenContent` kept (offline-first) |

There is **no reconnect storm** on plan change. Credentials stay valid. WS stays up; invalidation is coalesced (`scheduleInvalidationRefetch`, 600ms for legacy update events). A deleted screen token still factory-resets — Cloud must not delete hall screens on downgrade.

`contentOverrides` is typed on `ScreenContent` and never read.

## 2. Gaps / crash risks

1. **Empty content zone (was the hall-visible bug).** Default and custom layouts keep a `content` zone. If Cloud strips playlist items but leaves the zone (or sends `layout: null` → default layout), landscape `size: 5` became a large empty panel. **Mitigated client-side:** collapse empty content zone and treat as prayer-only, except during jamaat-soon / in-prayer / post-adhan overlays.
2. **Display trusts the API blindly.** Donation, course, video, media, events, custom theme, logo placement, extra playlists all render if present. No client feature list.
3. **Stale premium cache.** redux-persist + LocalForage keep the last Full payload until a **successful** sync. Offline halls keep showing premium slides. Failed 403/5xx does not wipe cache (correct for offline-first; wrong if Cloud errors instead of sending a Free payload).
4. **No `plan.changed` invalidation type.** Mid-session lockdown depends on Cloud emitting `content:invalidate` (`display_layout` and/or `schedule` / `playlist_assignment`) or `content:update`. Otherwise the next guaranteed pull is the daily sync (plus WS reconnect full refresh).
5. **`sanitiseOrientation` rejects “footer-only”.** If Cloud sends only unknown/premium zones + footer, sanitise returns null and the **default content layout comes back**. Cloud must send a valid Free layout (prayer-times + footer), not an empty zone list.
6. **Missing prayer times** is not a crash, but the 30s force-refresh loop is noisy if Cloud omits the core board. Free must still include prayer times.
7. **Jumuah-bar zone with no sessions** leaves a shrink-0 wrapper. Low risk.
8. **Emergency / remote commands** are not plan-gated. Server-owned.

## 3. Recommended API contract (Cloud / Portal)

Ship backend first. Additive fields only; old devices ignore unknowns.

```ts
// Optional on GET /api/screen/content (and nested data)
plan?: {
  id: 'free' | 'founding' | 'full_access' | string;
  displayName?: string;
};

// Allow-list the display may render. Absence = “trust payload as today”.
features?: {
  contentCarousel?: boolean;      // announcements, events, media, video, donation, course
  customLayout?: boolean;
  customTheme?: boolean;
  displayLogo?: boolean;          // already implied by omitting logoUrl
  jumuahBar?: boolean;            // usually keep — core Friday times
  emergencyAlerts?: boolean;
};

// Required on downgrade (authoritative):
// - prayerTimes: always present
// - schedule.items / scheduledPlaylists: omit disallowed types (or empty)
// - layout: valid Free template (prayer-times + footer; optional header/countdown)
// - masjid.logoUrl: null
// - layout.config.theme / logo: null
// - do not 401/403 the screen; do not delete the Screen row
```

On plan change Cloud should publish **one** coalesced `content:invalidate` with `type: 'display_layout'` and a schedule/playlist invalidation (or a single `content:update`). Do not cycle the screen token.

Portal lane: lock UI for premium modules. Display lane: consume the stripped payload; optional `features` is a hint for future skip-lists, not a substitute for stripping.

## 4. Implementation plan / PRs

| Lane | Work | Order |
|---|---|---|
| **Cloud** | Entitlement-aware `resolveScreenContent`: strip premium items, swap layout to Free default, null logo/theme. Stay 200 + envelope. | 1 — deploy first |
| **Realtime** | Emit `content:invalidate` (`display_layout` + schedule/playlist) when plan changes. Do not disconnect. | 1 |
| **Portal** | Locks / upgrade CTAs for custom layout, logo, carousel modules. | Parallel |
| **Display (this PR)** | Collapse empty content zone; silent empty carousel; unknown-zone skip. No version bump. | Safe now |
| **Display (later)** | If `features` ships: skip disallowed modules with the same collapse path. Tolerate missing `features` forever. | After Cloud |

## 5. This PR

Small Display-side defensive patch only:

- `shouldCollapseEmptyContentZone` in `src/types/displayLayout.ts`
- `DisplayScreen` hides the empty content zone and sets `prayerOnly`
- `ContentCarousel` empty state is blank (no hall copy)
- Unknown registry components are skipped, not dereferenced

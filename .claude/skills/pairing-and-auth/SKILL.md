---
name: pairing-and-auth
description: The device pairing flow (QR code → credentials), credential storage/restore, app initialisation phases, device identity, and factory reset. Use when a device won't pair, lost its pairing, shows the pairing screen unexpectedly, when changing the pairing/startup flow, useAppLoader, authSlice, credentialService, PairingScreen or LoadingScreen, or when handling invalid/revoked credentials or factory reset.
---

# Pairing & Authentication

## When to use this skill

- A device is stuck on the pairing screen, or a paired device suddenly shows it again.
- Changing the pairing flow, QR code, pairing-code polling, or startup/initialisation order.
- Anything touching `credentialService`, `authSlice`, `useAppLoader`, `PairingScreen`.
- Handling invalid/revoked credentials, screen deleted in admin, factory reset.
- Do NOT use for WebSocket auth/event problems once paired → see `realtime-and-remote-control`.
- Do NOT use for stuck loading / blank screen triage → see `debugging-runtime-issues`.

## Mental model

The app has **no routing**. `useAppLoader` (`src/hooks/useAppLoader.ts`) drives four phases —
`startup → pairing → loading → ready` — and `AppRoutes` in `src/App.tsx` maps them to lazy-loaded
screens: `LoadingScreen` / `PairingScreen` / `DisplayScreen` (all in `src/components/screens/`).

**Identity** = three values, owned by `src/services/credentialService.ts` (singleton, the ONLY
code allowed to touch localStorage for auth — non-negotiable rule 9):

| Value | Primary localStorage key | Notes |
|---|---|---|
| API key | `masjid_api_key` | Sent as `Authorization: Bearer <apiKey>` (`getAuthHeader()`) and as the WebSocket `token` |
| Screen ID | `masjid_screen_id` | Unique device identity; also stamped onto every log entry by `src/utils/logger.ts` |
| Masjid ID | `masjid_id` | Optional; needed for `isFullyAuthenticated()` and WS rooms |

Plus flag `masjid_is_paired`, and **legacy fallbacks** (`apiKey`, `screenId`, `masjidId`,
`masjid_masjid_id`, `isPaired`, JSON blob `masjidconnect_credentials`) that `loadCredentials()`
reads and migrates back to the primary keys — old field devices depend on this.

**State**: `src/store/slices/authSlice.ts` holds `isAuthenticated`, `isPaired`, `isPairing`,
`pairingCode`, `pairingCodeExpiresAt`, plus the credential triple. `auth` is in the redux-persist
whitelist (`['auth', 'content', 'emergency']` in `src/store/index.ts`), so credentials survive in
two places; `initializeFromStorage` recovers credentialService from rehydrated Redux state if the
localStorage keys were lost.

**Backend endpoints** (defined in `src/api/endpoints.ts` as `PAIRING_ENDPOINTS`, called by
`src/api/apiClient.ts`; implemented in the backend repo at
`apps/admin/src/app/api/screens/<name>/route.ts` — all four verified to exist):

| Client method (apiClient) | Endpoint |
|---|---|
| `requestPairingCode(deviceInfo)` | `POST /api/screens/unpaired` |
| `checkPairingStatus(pairingCode)` | `POST /api/screens/check-simple` |
| `completeDevicePairing(pairingCode, deviceInfo)` | `PUT /api/screens/pair` |
| `getPairedCredentials(pairingCode)` | `POST /api/screens/paired-credentials` |

**The pairing sequence** (thunks in authSlice, UI in `src/components/screens/PairingScreen.tsx`):

1. `useAppLoader` startup phase dispatches `initializeFromStorage`. If credentials exist → phase
   `loading`. If a stored, unexpired `pairingCode` exists (localStorage `pairingCode` /
   `pairingCodeExpiresAt`) → resume pairing. Otherwise it dispatches `requestPairingCode('LANDSCAPE')`
   (min 1.5 s so the loading screen doesn't flash), then phase `pairing`.
2. `PairingScreen` renders the code and a QR (`QRCodeSVG` from `qrcode.react`; URL from
   `getPairingUrl()` in `src/utils/adminUrlUtils.ts`, pointing at the admin portal). It polls
   `checkPairingStatus` every 5 s (`POLL_INTERVAL_MS`), backing off to 10 s after an error, and
   auto-requests a fresh code when the countdown hits `Expired`.
3. `checkPairingStatus` has three success paths (all in the thunk):
   a. `check-simple` embeds full credentials (`statusResponse.data.credentials`) → saved directly;
   b. `needsDevicePairing: true` → `PUT /api/screens/pair` (transitions the screen to ONLINE), then
   c. `POST /api/screens/paired-credentials` → credentials (+ `masjidName`, `screenName`,
      `orientation`, stored in localStorage as `masjid_name` / `screen_name` / `screen_orientation`).
4. `credentialService.saveCredentials()` writes primary + legacy keys and verifies the write.
   The fulfilled action flips `isAuthenticated`; `useAppLoader` moves to `loading`; and
   `realtimeMiddleware` reacts to `auth/checkPairingStatus/fulfilled` (100 ms delay) by starting
   the WebSocket and `syncService`.

**Loading phase is cache-first**: `loadCachedContent` surfaces storageService cache, and if any
content exists (or was rehydrated) the app goes `ready` immediately and refreshes in the
background; only a first-ever run blocks on `refreshAllContent`. A 15 s timeout forces `ready`
regardless. (`src/hooks/useAppLoader.ts`; offline-first rule 1.)

## Step-by-step workflows

### 1. Debug a device that won't pair

1. Confirm what the screen shows. Shimmer instead of a code = `requestPairingCode` failing —
   check `[Auth] Error requesting pairing code` and that the device can reach `VITE_API_URL`
   (`src/config/environment.ts`; dev default is `http://localhost:3001`, i.e. the app's own
   static server — pairing against production needs `VITE_API_URL=https://portal.masjidconnect.co.uk`
   in `.env`).
2. Code shows but pairing never completes: watch the poll. Every 5 s you should see
   `[Auth] Checking pairing status`; then either `[Auth] Not yet paired` (admin hasn't entered the
   code) or one of the completion paths (`Using credentials embedded…`, `needsDevicePairing true…`,
   `Device is paired, fetching credentials`).
3. `PUT /screens/pair returned error` is logged but **not fatal** — the thunk continues to
   `paired-credentials`, which works via PairingHistory even if the PUT failed on a retry.
4. Code keeps expiring: the countdown in `PairingScreen` dispatches `setPairingCodeExpired(true)`
   and auto-requests a new code after 2 s. If the Pi clock is badly wrong, `expiresAt` can appear
   already-past — check clock sync (see `prayer-times-domain` for the HTTPS time fallback).
5. Verify backend behaviour directly in the backend repo:
   `apps/admin/src/app/api/screens/check-simple/route.ts` etc.

### 2. Debug a device that lost its pairing

1. Was it deliberate? A screen deleted in the admin portal causes the WebSocket handshake to fail
   with `Invalid screen token … screen not found`; `realtimeService` emits `screen_token_invalid`
   and `realtimeMiddleware` runs `remoteControlService.performFactoryReset()` — full wipe and
   reload to pairing. Logs: `[Realtime] Invalid screen token…` then
   `[RemoteControl] Factory reset — clearing storage and reloading`.
2. Not deliberate? Check both storage layers before concluding credentials are gone:
   `credentialService.debugLogState()` logs the full picture, and the redux-persist blob
   (localStorage key `persist:root`) may still hold them — `initializeFromStorage` recovers from
   Redux state when credentialService is empty (`[Auth] credentialService empty but Redux state
   has credentials — recovering`).
3. HTTP 401s do **not** clear credentials: `apiClient` logs
   `[ApiClient] Unauthorized - credentials may be invalid` and treats 401/403/404 as
   non-retryable, but leaves the device paired. Only the WebSocket tombstone path (step 1) or an
   explicit `FACTORY_RESET` command wipes a device.
4. To re-pair manually: clear site data for the origin (or run
   `remoteControlService.performFactoryReset()` from the console in dev) and reload.

### 3. Change the pairing/init flow safely

1. Read `src/hooks/useAppLoader.ts` end-to-end first — the phase transitions are effect-driven
   and guarded by refs (`startedRef`, `pairingCodeFlowStartedRef`); breaking a guard causes
   double-dispatch loops.
2. Keep the ordering contract: `initializeFromStorage` must complete before any phase decision;
   `realtimeMiddleware.init()` fires only on `auth/initializeFromStorage/fulfilled` or
   `auth/checkPairingStatus/fulfilled` — if you rename/add auth thunks, update the action-type
   strings at the bottom of `src/store/middleware/realtimeMiddleware.ts`.
3. Preserve the fallback chain in `credentialService.loadCredentials()` (primary keys → legacy
   bare keys → legacy masjidId keys → `masjidconnect_credentials` JSON). Field devices updated
   from old versions still carry legacy keys.
4. Preserve the cache-first loading path (`loadCachedContent` before any network wait) and the
   15 s loading timeout — both exist because of real field incidents (git:
   `feat: implement cache-first loading strategy in useAppLoader…`, and
   `docs/LOADING_SCREEN_FIX_SUMMARY.md` for the historical hang).
5. Every timer/listener added in `PairingScreen` or `useAppLoader` must be cleaned up in the
   effect return (see `pollTimerRef`/`mountedRef` handling in PairingScreen — imitate it).
6. Test with all three cold-boot states: fresh device (no storage), paired device
   (credentials present), interrupted pairing (only `pairingCode` in localStorage).

### 4. Factory reset

- **Remote**: admin sends `FACTORY_RESET` (via realtime `POST /api/publish/command` or heartbeat
  queue) → `performFactoryReset()` in `src/services/remoteControlService.ts`.
- **Automatic**: screen deleted server-side → `screen_token_invalid` → same function.
- What it does, in order (each step is fail-open so navigation always happens): disconnect
  WebSocket → `credentialService.clearCredentials()` → `storageService.clear()` (IndexedDB) →
  `localStorage.clear()` → `sessionStorage.clear()` → delete all Cache API caches → unregister all
  service workers (prevents Workbox serving an empty precache = white screen) →
  `window.location.replace(origin + pathname)`.
- **`docs/FACTORY_RESET.md` is stale**: it describes a `Ctrl+Shift+R` shortcut, a
  `FactoryResetModal.tsx`, `factoryResetService.ts` and `useFactoryReset.ts` — none of these exist
  in `src/` today, and `Ctrl+Shift+R` is now the dev Ramadan-mode toggle
  (`src/hooks/useDevKeyboard.ts`). There is currently no on-device keyboard factory reset.

## Gotchas & failure modes

- **Pairing screen after a redeploy that changed nothing about auth** → check redux-persist
  rehydration vs credentialService disagreement; `useAppLoader` guards with
  `isAuthenticated || credentialService.hasCredentials()` so either source is enough — if both are
  empty the data really was cleared (kiosk profile wipe, storage eviction).
- **`masjidId` missing** → credentials still count as valid (`hasCredentials()` only needs apiKey +
  screenId), but `isFullyAuthenticated()` is false and the WS handshake sends an empty masjidId.
  `updateMasjidId()` can set it later.
- **Pairing resumes with a stale code after refresh** → intended: the code is persisted in
  localStorage (`pairingCode`/`pairingCodeExpiresAt`) and reused until expiry. Expired codes are
  cleaned in `initializeFromStorage` and `setPairingCodeExpired`.
- **Double polling loops** → `startPolling` in PairingScreen is guarded by `pollingRef`; the
  initial poll is delayed 1.5 s. If you add another trigger, respect the guard or two loops will
  each schedule their own `setTimeout` chain.
- **`logout` action ≠ factory reset** → `authSlice.logout` clears credentials + pairing keys +
  `masjid_name`/`screen_name`/`screen_orientation` and (via realtimeMiddleware/emergencyMiddleware)
  stops WS/sync/alert services, but leaves content caches intact. `performFactoryReset()` wipes
  everything.
- **Device info at pairing is mostly placeholder** → `getDeviceInfo()` in authSlice sends
  `name: Display ${Date.now()}`, `type: 'WEB'`, resolution, orientation and a hard-coded
  `appVersion: '1.0.0'` (known TODO). The admin renames the screen on pairing; do not rely on
  the client-sent name.
- **Never bypass credentialService** → reading `localStorage.getItem('apiKey')` directly
  reintroduces the legacy-key drift this service exists to fix (rule 9). Both API clients
  (`src/api/apiClient.ts`, `src/api/masjidDisplayClient.ts`) and `realtimeService` already get
  auth from it.

## Validation

```bash
npm run lint
npx vitest run src/services/credentialService.test.ts
npx vitest run src/store/slices/authSlice.test.ts
npx vitest run src/hooks/useAppLoader.test.tsx
npx vitest run src/flows/startup-to-display.test.tsx   # full boot flow incl. pairing branches
npm test
```

Manual: `npm run dev`, open a private window (clean storage) at `http://localhost:3001` — you
should reach the pairing screen with a code + QR. In DevTools → Application → Local Storage,
verify `masjid_api_key` / `masjid_screen_id` appear after pairing completes. Test the paired
cold-boot path by reloading; test interrupted pairing by reloading while the code is showing.

## Related

- Sibling skills: `realtime-and-remote-control` (WS auth handshake, `screen_token_invalid`,
  FACTORY_RESET command), `debugging-runtime-issues` (stuck loading screen triage),
  `offline-storage-and-sync` (what survives in storage), `api-integration` (apiClient patterns).
- Repo docs: `docs/FACTORY_RESET.md` (stale — see workflow 4), `docs/AUTH_HEADER_FIX.md`,
  `docs/LOADING_SCREEN_FIX_SUMMARY.md` (historical), `docs/Display_app_integration_guide.md`.
- Backend: `apps/admin/src/app/api/screens/{unpaired,check-simple,pair,paired-credentials}/route.ts`
  in `/Users/tahmidhoque/Documents/projects/MasjidConnect-Backend`.
- Rules: `.cursor/rules/redux-state-management.mdc`, `.cursor/rules/api-and-data.mdc`.

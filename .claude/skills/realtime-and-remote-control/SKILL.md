---
name: realtime-and-remote-control
description: How the display receives live events (Socket.io), remote commands from the admin portal, and emergency alerts — and how to add or debug them. Use when working on realtimeService, remoteControlService, emergencyAlertService, realtimeMiddleware, emergency alerts / EmergencyAlertOverlay, heartbeats, WebSocket reconnection, "display not receiving updates", adding a new realtime event, or adding a new remote-control command.
---

# Realtime, Remote Control & Emergency Alerts

## When to use this skill

- Adding/changing a realtime (WebSocket) event end-to-end.
- Adding/changing a remote-control command (RESTART_APP, CLEAR_CACHE, …).
- Emergency alert bugs: alert not showing, not clearing, wrong colour, stuck after reload.
- Debugging "the admin changed something but the screen didn't update".
- Heartbeat / online-status problems (screen shows offline in admin).
- Do NOT use for pairing/credential problems → see `pairing-and-auth`.
- Do NOT use for blank screen / stuck-loading triage → see `debugging-runtime-issues`.

## Mental model

```
Admin portal (backend repo apps/admin — Next.js)
   │ HTTP POST /api/publish/*  (Bearer REALTIME_API_KEY)
   ▼
Realtime server (backend repo apps/realtime — Express + Socket.io,
                 deployed to Fly.io as app "masjidconnect-realtime")
   │ Socket.io rooms: screen:${screenId}, masjid:${masjidId}:screens
   ▼
Display app  src/services/realtimeService.ts   (singleton, owns the socket)
   │ internal emitter: realtimeService.on(event, cb)
   ▼
src/store/middleware/realtimeMiddleware.ts     (wires events → Redux/services)
   ├─ emergencyAlertService.setAlert() → emergencyMiddleware → emergencySlice → EmergencyAlertOverlay
   ├─ remoteControlService.handleCommand() → executes + acks
   └─ dispatch(refreshContent / refreshPrayerTimes / refreshEvents …) from contentSlice
```

Key facts (all verifiable in the code):

- **Client** `src/services/realtimeService.ts`: single Socket.io connection to `realtimeUrl` from `src/config/environment.ts` (`VITE_REALTIME_URL`; prod default `https://masjidconnect-realtime.fly.dev`, dev default `http://localhost:3002`). Handshake auth payload: `{ type: 'display', screenId, masjidId, token: apiKey }` built from `credentialService.getCredentials()`.
- **Reconnection is manual**: the socket is created with `reconnection: false`; `scheduleReconnect()` retries with exponential backoff (1 s doubling to a 30 s cap, `maxReconnectAttempts = 10`). After 10 failures it stops permanently until page reload.
- **Server** (backend repo `/Users/tahmidhoque/Documents/projects/MasjidConnect-Backend`):
  - `apps/realtime/src/websocket/auth/socket-auth.ts` — validates the handshake. A deleted screen gets error `Invalid screen token: … screen not found`; the client detects this in `isInvalidScreenTokenError()` and emits `screen_token_invalid`, which triggers a **factory reset** (see gotchas).
  - `apps/realtime/src/api/routes/publish.ts` — HTTP publish endpoints the admin calls: `POST /api/publish/room`, `/masjid`, `/screen`, `/emergency`, `/orientation`, `/command`, `/content-invalidation` (all Zod-validated).
  - `apps/realtime/src/websocket/handlers/display-handler.ts` — listens for `display:heartbeat`, `display:command:ack`, `display:error`, `display:sync:request`, `display:status`, `display:content:changed`.
  - `apps/realtime/src/websocket/socket-manager.ts` — room helpers `publishToScreen` (room `screen:${screenId}`), `publishToMasjidScreens`, `publishToMasjidAdmins`.
  - Admin-side publisher: `apps/admin/src/lib/services/screen-service.ts` (uses `REALTIME_SERVER_URL` / `REALTIME_API_KEY`, read lazily at runtime — backend `FIX-REALTIME-AUTH-ISSUE.md` explains why).
- **Events the client listens for** (registered in `setupSocketHandlers()`): `connect`, `disconnect`, `connect_error`, `display:heartbeat:ack`, `emergency:alert`, `emergency:clear`, `screen:orientation` (re-emitted internally as `orientation:change`), `screen:command`, `screen:command:${TYPE}` for each `COMMAND_TYPES` entry, `content:update`, `prayer-times:update`, `content:invalidate`.
- **Command types** (`COMMAND_TYPES` in realtimeService.ts; executed in `executeCommand()` in `src/services/remoteControlService.ts`):
  `RESTART_APP`, `RELOAD_CONTENT`, `CLEAR_CACHE`, `UPDATE_ORIENTATION`, `REFRESH_PRAYER_TIMES`, `DISPLAY_MESSAGE` (log-only no-op), `REBOOT_DEVICE` (not supported in browser), `CAPTURE_SCREENSHOT` (not implemented), `UPDATE_SETTINGS`, `FORCE_UPDATE`, `FACTORY_RESET`.
  The server's `POST /api/publish/command` schema (`remoteCommandSchema` in publish.ts) accepts a subset: `RESTART_APP`, `RELOAD_CONTENT`, `CLEAR_CACHE`, `FORCE_UPDATE`, `UPDATE_SETTINGS`, `FACTORY_RESET`, `CAPTURE_SCREENSHOT`.
- **Heartbeat**: `display:heartbeat` over WebSocket every 30 s (`heartbeatInterval`), switching to 5 s (`heartbeatFastInterval`) while `pendingAcks > 0`. Payload is `HeartbeatPayload` (`src/types/realtime.ts`) built by `collectMetrics()` (`src/utils/metricsCollector.ts`). When the WebSocket drops, `realtimeMiddleware` calls `syncService.setHttpHeartbeatEnabled(true)` so `syncService.sendHeartbeat()` POSTs `/api/screen/heartbeat` instead — that HTTP response can contain queued commands, forwarded via the `command:received` sync event.
- **Emergency alert lifecycle**: WS `emergency:alert` → `realtimeMiddleware` normalises the payload (`normaliseEmergencyAlertWsPayload` handles plain object, JSON string, or `{ data: {…} }` wrapping) → `emergencyAlertService.setAlert()` (persists to localStorage key `emergency_alert`, defaults `expiresAt` to now + 30 min, arms an expiry `setTimeout`) → `emergencyMiddleware` listener dispatches `setCurrentAlert` on `emergencySlice` → `EmergencyAlertOverlay` (`src/components/display/EmergencyAlertOverlay.tsx`) renders full-screen and runs its own countdown **from `expiresAt`** (deliberately not `timing.remaining` — see the file's header comment). Cleared by: `action: 'clear' | 'hide' | 'cancel'` on `emergency:alert`, the `emergency:clear` event, expiry timers, or Escape in dev.

## Step-by-step workflows

### 1. Add a new realtime event end-to-end

Example: a new `announcement:flash` event.

1. **Server emit** (backend repo). Reuse `POST /api/publish/screen` (generic `{ screenId, event, data }` → `publishToScreen`) or add a dedicated Zod-validated route in `apps/realtime/src/api/routes/publish.ts` following `contentInvalidationSchema`.
2. **Client socket listener** — in `setupSocketHandlers()` in `src/services/realtimeService.ts`, following the existing pattern:
   ```ts
   this.socket.on('announcement:flash', (data: unknown) => this.emit('announcement:flash', data));
   ```
3. **Type the payload** in `src/types/realtime.ts` (exported interface, like `ContentInvalidationPayload`).
4. **Middleware wiring** — in the `init()` function of `src/store/middleware/realtimeMiddleware.ts`, push the unsubscriber into `unsubs` (this is the cleanup mechanism — mandatory):
   ```ts
   unsubs.push(
     realtimeService.on<MyPayload>('announcement:flash', (payload) => {
       api.dispatch(someAction(payload)); // Redux only — never call APIs from components
     }),
   );
   ```
   If the handler must refetch data, dispatch a `contentSlice` thunk (`refreshContent`, `refreshPrayerTimes`, `refreshEvents`, `refreshAllContent`) via dynamic `import('../slices/contentSlice')` exactly as the existing handlers do, and coalesce rapid events (see `scheduleInvalidationRefetch` from `src/utils/contentInvalidationSchedule.ts` and `WS_UPDATE_COALESCE_MS`).
5. **Reducer/UI**: add the action to the relevant slice; components read it with `useAppSelector` from `src/store/hooks.ts`.
6. Prefer extending `content:invalidate` with a new `type` over inventing a new event if you are only invalidating data — add the type to `VALID_INVALIDATION_TYPES` in realtimeMiddleware.ts, `ContentInvalidationPayload` in `src/types/realtime.ts`, and `contentInvalidationSchema` in the backend publish.ts.
7. Validate (below).

### 2. Add a new remote-control command

1. Add the type string to `COMMAND_TYPES` in `src/services/realtimeService.ts` (so `screen:command:${TYPE}` is subscribed).
2. Add a `case` to the `switch (type)` in `executeCommand()` in `src/services/remoteControlService.ts`. Keep it idempotent — commands are deduplicated by `commandId` (60 s window) and rate-limited per type (`cooldownMs` = 2 s).
3. If the command must trigger a Redux refetch or UI change, wire it in **both** command paths in `src/store/middleware/realtimeMiddleware.ts`: the `realtimeService.on('command', …)` handler (WebSocket) **and** the `syncService.on('command:received', …)` handler (HTTP heartbeat fallback). Copy how `REFRESH_PRAYER_TIMES` and `UPDATE_ORIENTATION` appear in both blocks.
4. Backend: add the command to the `remoteCommandSchema` enum in `apps/realtime/src/api/routes/publish.ts`, and to whatever admin UI sends it (start from `apps/admin/src/lib/services/screen-service.ts`).
5. Acknowledgement is automatic: `handleCommand()` calls `realtimeService.acknowledgeCommand()` (emits `display:command:ack`); `notifyCommandReceived()` flips the heartbeat into fast mode until acks drain.
6. Cross-repo rule: ship the backend change first — old displays in the field must keep working against the new server.

### 3. Debug "display not receiving updates"

Work down this list. Each step names the log line to look for (`logger` output — in production only warn/error reach the console; use a dev build, or the `?debug=1` overlay described in `debugging-runtime-issues`):

1. **Is the socket connected?** `[Realtime] Connected` / `[Realtime] Disconnected` / `[Realtime] Connection error`. Redux mirror: `state.emergency.isConnected` (set via `setConnectionStatus` in realtimeMiddleware).
2. **Did reconnection give up?** `[Realtime] Max reconnect attempts reached` — after 10 failures it never retries; only a reload (or a RESTART_APP command via the HTTP heartbeat queue) recovers.
3. **Wrong URL?** Compare `VITE_REALTIME_URL` in `.env` with the defaults in `src/config/environment.ts`. In dev it defaults to `http://localhost:3002` — if you are not running the realtime server locally, set it to the Fly.io URL.
4. **Auth rejected?** `[Realtime] Invalid screen token (screen not on server)` means the screen was deleted in the admin — the device will factory-reset itself. Other `connect_error` messages originate in `apps/realtime/src/websocket/auth/socket-auth.ts`.
5. **Middleware never initialised?** `init()` only runs after `auth/initializeFromStorage/fulfilled` or `auth/checkPairingStatus/fulfilled` (with a 100 ms `setTimeout`) AND requires `state.auth.isAuthenticated && credentialService.hasCredentials()`. Look for `[RealtimeMW] Starting WebSocket and sync`.
6. **Event arrives but is filtered?** `content:invalidate` is dropped when `payload.type` is not in `VALID_INVALIDATION_TYPES` or when `payload.screenId` is set and doesn't match this screen — debug lines `content:invalidate ignored (…)`.
7. **Server side**: did the admin actually publish? Check realtime server logs on Fly.io (publish.ts logs `Published <event> to room <room>` / `Content invalidation published`). The admin needs `REALTIME_SERVER_URL`/`REALTIME_API_KEY` set (backend `FIX-REALTIME-AUTH-ISSUE.md` covers the empty-value trap).
8. **HTTP fallback**: with the WS down, commands should still arrive via `/api/screen/heartbeat` responses — look for `[SyncService] Processing commands`.

## Gotchas & failure modes

- **Duplicate sockets/events after edits** → `connect()` is a no-op while `this.socket !== null`. Never construct a second socket; this guard is the single-socket invariant.
- **Realtime dead after a long outage** → the 10-attempt reconnect cap. When debugging: reload. When coding: do NOT "fix" this by enabling Socket.io auto-reconnect — `reconnection: false` is deliberate (manual backoff avoids stacked connections on the Pi).
- **Device wiped itself overnight** → `screen_token_invalid` (screen deleted server-side) makes realtimeMiddleware call `remoteControlService.performFactoryReset()`: clears credentials, IndexedDB, localStorage, Cache API, unregisters service workers, reloads to pairing. Intended behaviour.
- **Command executes twice** → two delivery paths exist (WS `screen:command:*` and HTTP heartbeat). Dedup relies on the server sending the **same `commandId`** on both; a command without one gets a client-generated `cmd-${Date.now()}` and cannot be deduped across paths.
- **New command works via WS but not when the socket is down** → you only wired the WS handler; mirror it in the `syncService.on('command:received', …)` block (workflow 2, step 3).
- **Emergency alert never appears** → after normalisation the middleware requires `title` and `message`; anything else is dropped with `emergency:alert ignored (invalid payload)`. Also `setAlert` silently ignores alerts whose `expiresAt` is already in the past — check Pi clock skew (there is an HTTPS time fallback; see `prayer-times-domain`).
- **Alert reappears after reload** → by design: `emergencyAlertService` restores an unexpired alert from localStorage (`emergency_alert`) in its constructor. Clear via `emergency:clear`, Escape (dev), or expiry.
- **Dev test alerts behave differently from real ones** → Ctrl+Shift+1…8 dispatch `createTestAlert` straight into `emergencySlice`, bypassing `emergencyAlertService` — no localStorage persistence and no service-level expiry timer (the overlay's own `expiresAt` countdown still clears them).
- **Refetch storms when the admin bulk-edits** → deliberately coalesced: `content:update`/`prayer-times:update` at 600 ms (`WS_UPDATE_COALESCE_MS`); `content:invalidate` via `scheduleInvalidationRefetch`. Put new refetch paths behind the same helpers.
- **Cleanup rule** → every listener registered in realtimeMiddleware `init()` must be pushed into `unsubs`; `auth/logout` runs `cleanup()` which drains `unsubs`, clears coalesce maps, cancels scheduled restarts and update polling, and disconnects the socket. New resources must be released there too. `cleanupRealtimeMiddleware()` exists for tests.
- **Docs drift** → `docs/REMOTE_CONTROL_API.md` and `docs/OTA_AND_REMOTE_CONTROL_IMPLEMENTATION_SUMMARY.md` describe the retired SSE/Electron era; `docs/EMERGENCY_ALERT_TIMING_FIX.md` recommends `timing.remaining` but the current overlay deliberately uses `expiresAt`. There is no `EventSource` usage anywhere in `src/`. Trust the code; use those docs for history only.

## Validation

```bash
npm run lint                                                  # must pass
npx vitest run src/store/middleware/realtimeMiddleware.test.ts
npx vitest run src/store/middleware/emergencyMiddleware.test.ts
npx vitest run src/services/emergencyAlertService.test.ts
npx vitest run src/flows/emergency-overlay.test.tsx
npm test                                                      # full suite
```

Manual: `npm run dev` (port 3001), open DevTools. `Ctrl+Shift+1` shows a safety test alert for 15 s; `Ctrl+Shift+0` or Escape clears it. For true end-to-end WS testing run the backend realtime server (`apps/realtime` in the backend repo) and point `VITE_REALTIME_URL` at it; watch for `[Realtime] Connected` and heartbeat-ack debug lines.

## Related

- Sibling skills: `pairing-and-auth` (the credentials the socket authenticates with), `debugging-runtime-issues` (general triage, logger, dev shortcuts), `offline-storage-and-sync` (syncService caching), `masjidconnect-ecosystem` (cross-repo contract).
- Repo docs: `docs/COMMUNICATION-FLOWS.md`, `docs/DISPLAY-BACKEND-COMMUNICATION.md`; historical: `docs/EMERGENCY_ALERT_TIMING_FIX.md`, `docs/REMOTE_CONTROL_API.md`, `docs/OTA_AND_REMOTE_CONTROL_IMPLEMENTATION_SUMMARY.md`.
- Backend repo docs: `ADMIN-WEBSOCKET-SOLUTION.md`, `FIX-REALTIME-AUTH-ISSUE.md`, `ORIENTATION-WEBSOCKET-MIGRATION-SUMMARY.md`, `apps/realtime/DEPLOY.md`, `apps/realtime/FLY_DEPLOYMENT.md`.
- Rules: `.cursor/rules/redux-state-management.mdc`, `.cursor/rules/api-and-data.mdc`.

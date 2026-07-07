---
name: debugging-runtime-issues
description: Systematic triage for kiosk failure modes — blank/white screen, stuck on loading, unexpected restarts, memory leaks, stale content — plus the logger API, on-device debug surfaces, and dev keyboard shortcuts. Use when a display is blank, frozen, restarting, showing old data, stuck on the loading screen, when you need to read logs off a Pi, or when testing display states with keyboard shortcuts.
---

# Debugging Runtime Issues

## When to use this skill

- A deployed display is blank/white, stuck on the loading screen, frozen, restarting, or showing stale data.
- You need to get logs or the last error off a Pi with no dev tools attached.
- You want the dev keyboard shortcuts to force display states while testing.
- Do NOT use for "won't pair / lost pairing" → see `pairing-and-auth`.
- Do NOT use for "admin change didn't reach the screen" specifics → see `realtime-and-remote-control` (workflow 3), though the triage table below routes there.
- Do NOT use for wrong prayer times/countdowns → see `prayer-times-domain`.

## Mental model — where evidence lives

**On the Pi**: systemd `masjidconnect-display.service` runs `node deploy/server.mjs` (serves
`dist/` on port 3001, plus localhost-only `/internal/*` endpoints); `masjidconnect-kiosk.service`
runs Chromium `--kiosk` against `localhost:3001`. Server-side evidence:
`journalctl -u masjidconnect-display` / `journalctl -u masjidconnect-kiosk`.

**In the app** — `src/utils/logger.ts` (default export, non-negotiable rule 3: never `console.log`):

- API: `logger.debug|info|warn|error(message, dataObject)`; also exported: `log`, `getLogHistory`,
  `clearLogHistory`, `getLastError`, `setLastError`.
- Every entry is JSON with `timestamp`, `level`, `message`, your data fields, and `screenId`
  (read from localStorage `masjid_screen_id`).
- In-memory ring buffer: last 100 entries (50 in production) via `getLogHistory()`.
- **Production consoles only show `warn` and `error`** — info/debug are recorded in the buffer but
  not printed, and Terser strips `console.*` from the bundle anyway. Reproduce on a dev build when
  you need info/debug in the console.
- Every `logger.error` also writes localStorage `masjid_last_error`.

**Debug surfaces that work on a headless Pi**:

1. `?debug=1` query param — `src/App.tsx` renders an overlay with the last error and the most
   recent log entries at the bottom of the screen.
2. `http://<pi>:3001/internal/debug` — served by `deploy/server.mjs`; shows
   `masjid_last_error` from localStorage (open it in the Pi's own browser/kiosk origin).
3. Remote DevTools: start Chromium with `--remote-debugging-port=9222` and connect from another
   machine (see `docs/BLANK_SCREEN_DEBUGGING.md`).
4. Heartbeat metrics in the admin portal — `collectMetrics()` (`src/utils/metricsCollector.ts`)
   ships memory/uptime/etc. every 30 s while the WebSocket is up.

**Keyboard shortcuts** — two hooks, both mounted in `src/App.tsx`:

- `src/hooks/useWifiKeyboard.ts` — **production-safe**: `Ctrl+Shift+W` toggles the WiFi settings
  overlay (needs a USB keyboard on the Pi).
- `src/hooks/useDevKeyboard.ts` — **dev builds only** (`import.meta.env.DEV`), all `Ctrl+Shift+…`:
  `1`–`8` test emergency alerts (8/`V` = vehicle plate), `0` or `Escape` clear alert,
  `R` cycle Ramadan mode, `J` cycle prayer display phase, `A` toggle post-adhan supplication,
  `B` toggle jamaat blackout, `O` cycle orientation, `N` advance carousel, `F` toggle
  forbidden-prayer notice, `P` cycle highlighted prayer, `T` toggle tomorrow's list, and
  `Ctrl+Alt+Shift+M` cycle a fake "tomorrow's jamaat changed" override. Console fallbacks (dev):
  `__devCyclePrayerDisplay()`, `__devToggleAdhanSupplication()`, `__devToggleJamaatBlackout()`,
  `__devCycleTomorrowChange()`, `__devTriggerVehiclePlateAlert()`.

**Historical docs warning**: `docs/ERROR_CODES.md` and `docs/ERROR_HANDLING_USAGE.md` describe an
`errorSlice`/`ErrorCode` system that no longer exists in `src/` (slices today: auth, content,
emergency, ui). `docs/RPI_RESTART_DEBUGGING_GUIDE.md` and `docs/RPI-GETTING-STARTED.md` reference
Electron-era scripts (`debug-rpi-stability.sh`, `window.MasjidConnectDebug`, `.deb` packages) that
are not in this repo. Use them for symptom ideas only; the tools above are what actually exists.

## Symptom → cause → confirm → fix

### 1. Blank or white screen

Ranked causes:

1. **Service worker serving an empty/stale precache** (classic after a wipe or bad update).
   Confirm: DevTools → Application → Service Workers; or the page loads with no network requests.
   Fix: unregister SWs and clear Cache API, then reload. This is exactly why
   `performFactoryReset()` in `src/services/remoteControlService.ts` unregisters service workers —
   an SW left controlling the origin with an empty precache yields a white page.
2. **JS error before first render**. Confirm: `?debug=1` overlay or `/internal/debug` shows
   `masjid_last_error`; the ErrorBoundary in `src/App.tsx` would instead show "Something went
   wrong" with a Reload button (logged as `[App] Unhandled error`).
3. **ChunkLoadError after an OTA update** — old HTML referencing deleted hashed chunks.
   Confirm: console/`masjid_last_error` mentions ChunkLoadError. Fix: hard reload; long-term the
   daily update check + `FORCE_UPDATE` path does a cache-busting reload (`hardReload()` in
   remoteControlService).
4. **Kiosk started before the server**. Confirm: `journalctl -u masjidconnect-kiosk` shows
   connection refused to `localhost:3001`; `systemctl status masjidconnect-display`. Fix: restart
   the display service, then the kiosk service.
5. **GPU-killing CSS regression** (Pi-specific slowdown → compositor gives up). Confirm: recent
   diff added `backdrop-filter`/heavy `box-shadow` (banned — rule 5). Fix: remove it. History:
   `docs/RPI_BLANK_SCREEN_FIX.md`, `docs/LOADING_SCREEN_FIX_SUMMARY.md`.

### 2. Stuck on the loading screen

The loader is designed to make this near-impossible — so a genuine hang means a guard broke:

1. **Know the built-in floors/ceilings** (`src/App.tsx`, `src/hooks/useAppLoader.ts`):
   minimum 3.5 s (`MIN_LOADING_MS`) + 0.4 s before the loading overlay fades; the loading phase
   force-completes after 15 s (`[AppLoader] Loading timeout, proceeding anyway`). Under ~20 s of
   "loading" is normal on a slow cold boot.
2. **Stuck in `startup`, not `loading`**: `initializeFromStorage` never settled. Confirm via logs:
   you should see `[AppLoader] Starting initialisation` then either `[AppLoader] Authenticated,
   loading data`, `[AppLoader] Resuming pairing`, or `[AppLoader] Not authenticated, preparing
   pairing code`. Missing → credential init failed (`[AppLoader] Credential init failed`).
3. **Waiting for a pairing code with no network**: an unpaired device blocks on
   `requestPairingCode` (it logs `[AppLoader] Pairing code request failed` then still moves to the
   pairing screen, which will show the shimmer). See `pairing-and-auth`.
4. **First-run with no cache and no network**: only this case legitimately waits on the network
   (then the 15 s timeout fires). Returning devices render from cache immediately
   (`[AppLoader] Rendered from cache; refreshing in background`).
5. If you changed `useAppLoader`: check the effect guards (`startedRef`,
   `pairingCodeFlowStartedRef`) and that every branch reaches `markReady` or a phase change.
   History: `docs/LOADING_SCREEN_FIX_SUMMARY.md`, `docs/LOADING_AND_SSE_FIX_SUMMARY.md` (the
   hooks they name are gone; the lessons — always have a timeout, never block render on network
   when cache exists — are encoded in the current loader).

### 3. App restarts / reloads unexpectedly

Deliberate reload paths — rule these out first (search logs for them):

1. `RESTART_APP` remote command → `window.location.reload()` (optionally delayed with an on-screen
   countdown via `setPendingRestart`). Log: `[RemoteControl] Executing command`.
2. `FORCE_UPDATE` / daily update check (04:00 UTC, `scheduleDailyUpdateCheck` in
   `src/services/syncService.ts`) → on Pi, `deploy/update-from-github.sh` via
   `POST /internal/trigger-update`, then a countdown restart; on non-Pi a cache-busting reload.
   Logs: `[RemoteControl] Daily update check…`, phases from `/internal/update-status`.
3. `FACTORY_RESET` command or `screen_token_invalid` → full wipe + reload
   (`[RemoteControl] Factory reset — clearing storage and reloading`).
4. ErrorBoundary "Reload" is manual-only; but an uncaught render error unmounts to the fallback —
   check `masjid_last_error`.
5. None of the above → the **browser/OS** restarted, not the app: check
   `journalctl -u masjidconnect-kiosk -u masjidconnect-display --since "-24h"`, Chromium OOM kills,
   CPU temperature. The display service has `MemoryMax=512M` / `CPUQuota=80%` set in
   `deploy/masjidconnect-display.service` — the node server being killed also drops the kiosk.

### 4. Memory leaks / slow degradation over days

1. Confirm growth: admin heartbeat metrics (`memoryUsage` from `collectMetrics`) over days, or
   DevTools → Memory on a dev build.
2. The cause is almost always a violated cleanup rule (non-negotiable rule 2): a `setInterval`,
   `setTimeout`, event listener or service subscription not released in the `useEffect` return.
   Audit the diff since the last good release for `setInterval|setTimeout|addEventListener|
   realtimeService.on|syncService.on` without matching cleanup.
3. Reference implementations to imitate: `pollTimerRef`/`mountedRef` in
   `src/components/screens/PairingScreen.tsx`; the `unsubs` array in
   `src/store/middleware/realtimeMiddleware.ts`; timer refs (`expiryTimerRef`, `fadeTimerRef`,
   `countdownRef`) in `src/components/display/EmergencyAlertOverlay.tsx`.
4. Known bounded structures (not leaks): logger history (≤100/50 entries), emergency
   `alertHistory` (≤10), `processedIds` in remoteControlService (entries self-delete after 60 s).

### 5. Stale content (screen shows old data)

1. **Is realtime up?** Stale content usually means missed `content:invalidate` events → run
   workflow 3 of `realtime-and-remote-control`.
2. **Fallbacks that should have caught it**: once-daily full sync at 03:00 UTC
   (`scheduleDailySync` in syncService, offset `dailySyncOffsetMs` in
   `src/config/environment.ts`) and the HTTP heartbeat command queue. If content is >24 h stale,
   the device is offline or both paths are broken.
3. **Force it**: admin sends `RELOAD_CONTENT` or `CLEAR_CACHE` — both purge SW caches
   (`purgeApiServiceWorkerCaches`) + `apiClient.clearCache()`, and realtimeMiddleware dispatches
   `refreshAllContent({ forceRefresh: true })`.
4. **Cache layers to reason about** (see `offline-storage-and-sync`): service-worker HTTP cache →
   apiClient cache → storageService (LocalForage) → redux-persist. A "stale" screen after all
   forced refreshes points at normalisation dropping the new data in a `contentSlice` thunk.
5. Timezone/date-boundary staleness (prayer times flip at midnight masjid-time, not UTC) →
   `prayer-times-domain`.

### 6. Emergency alert stuck on screen

1. Alerts self-expire via `expiresAt` (service timer + overlay countdown). A stuck alert usually
   has a far-future/invalid `expiresAt`, or the Pi clock is behind. Confirm: localStorage key
   `emergency_alert`.
2. Fix: send `emergency:clear` (admin), or an `emergency:alert` with `action: 'clear'`; in dev,
   Escape. Details in `realtime-and-remote-control`.

## Validation

```bash
npm run lint          # required before any change is "done"
npm test              # vitest run
npx vitest run src/hooks/useAppLoader.test.tsx        # loader phase logic
npx vitest run src/flows/startup-to-display.test.tsx  # cold-boot flow
npx vitest run src/utils/logger.test.ts               # if you touched the logger
npm run build         # tsc -b + vite build; catches chunk/type regressions
```

Manual: `npm run dev`, then append `?debug=1` to the URL and confirm the overlay renders; trigger
an error path and check `getLastError()` in the console. For Pi issues, always capture
`journalctl` for both services plus `/internal/debug` before restarting anything — restarts
destroy the evidence.

## Related

- Sibling skills: `realtime-and-remote-control` (no-updates triage, commands, alerts),
  `pairing-and-auth` (won't pair / lost pairing), `offline-storage-and-sync` (cache layers),
  `prayer-times-domain` (wrong times, clock drift), `release-and-deployment` (OTA/rollback),
  `testing-and-validation` (definition of done).
- Repo docs: `docs/BLANK_SCREEN_DEBUGGING.md`, `docs/RPI_BLANK_SCREEN_FIX.md`,
  `docs/RPI_RESTART_DEBUGGING_GUIDE.md`, `docs/LOADING_SCREEN_FIX_SUMMARY.md`,
  `docs/LOADING_AND_SSE_FIX_SUMMARY.md` (all partly historical — see warning above),
  `docs/ERROR_CODES.md` / `docs/ERROR_HANDLING_USAGE.md` (historical),
  `docs/RASPBERRY-PI-PERFORMANCE.md`.
- Deploy: `deploy/server.mjs` (`/internal/*` endpoints), `deploy/masjidconnect-display.service`,
  `deploy/masjidconnect-kiosk.service`, `deploy/update-from-github.sh`.
- Rules: `.cursor/rules/performance-raspberry-pi.mdc`, `.cursor/rules/deployment-raspberry-pi.mdc`.

---
name: offline-storage-and-sync
description: Offline-first architecture — LocalForage storage, sync scheduling, network detection, redux-persist interplay, cache keys and cold-boot behaviour. Use when adding a cached data type, changing sync cadence, debugging stale data or cache invalidation, or reasoning about what the Pi shows with no network.
---

# Offline Storage & Sync

## When to use this skill

- Adding a new data type that must render offline
- Changing how often / when data syncs from the backend
- Debugging: stale data on screen after an admin change, blank screen on boot, data present in network tab but missing after restart
- Cache invalidation questions (which key, which layer, who clears it)
- Do NOT use for: HTTP client mechanics/auth → see `api-integration`; slice/thunk/selector mechanics → see `redux-data-flow`

## Mental model

The display is a Raspberry Pi in a mosque: the network is optional, the screen is not. Every render path must work from local data. There are **four local layers**, filled top-down and read bottom-up:

1. **Redux state** — what components render. Rebuilt each boot from layers below.
2. **redux-persist** (`persist:masjidconnect-root` in localStorage, configured in `src/store/index.ts`) — snapshots the `auth`, `content` and `emergency` slices (not `ui`), so the last-rendered data reappears instantly on boot.
3. **storageService** (`src/services/storageService.ts`) — LocalForage (IndexedDB, localStorage fallback; DB name `MasjidConnect`, store `display_storage`). Plain domain keys written by `apiClient.saveToStorageService` and read by thunks: `screenContent`, `schedule`, `prayerTimes`, `events`, `displaySettings`. API: `get<T>(key, defaultValue?)`, `set`, `remove`, `has`, `clear`, `keys` — all errors are swallowed and logged, so calls never throw.
4. **apiClient HTTP cache** (in `src/api/apiClient.ts`) — `{ data, timestamp, ttl }` entries under `cache_content`, `cache_prayer_times_<YYYY-MM-DD>`, `cache_events`, `cache_sync_status` (TTL 24 h), with stale-if-error semantics.

**Who fetches, and when** (`src/services/syncService.ts`, singleton):

- `syncService.start()` is triggered from `src/store/middleware/realtimeMiddleware.ts` once authenticated. It runs an initial `syncAll()`, then:
  - **Heartbeat** every `environment.heartbeatInterval` (30 s) — HTTP fallback only; suppressed via `setHttpHeartbeatEnabled(false)` while the WebSocket is connected.
  - **Once-daily fallback sync** at `environment.dailySyncOffsetMs` past midnight UTC (default 03:00, env `VITE_DAILY_SYNC_OFFSET_MS`) — `syncAll({ forceRefresh: true })`.
  - **Once-daily update check** at `environment.dailyUpdateCheckOffsetMs` (default 04:00, env `VITE_DAILY_UPDATE_CHECK_OFFSET_MS`).
- Between those, content/prayer-times/events refresh **only when pushed**: WebSocket `content:invalidate` events land in `realtimeMiddleware`, which dispatches `refreshContent` / `refreshPrayerTimes` / `refreshEvents` with `{ forceRefresh: true }` per invalidation type (`prayer_times`, `schedule`, `content_item`, `schedule_assignment`, `playlist_assignment`, `events`, `display_settings`, `display_layout` — see `VALID_INVALIDATION_TYPES`).
- `syncContent`/`syncPrayerTimes`/`syncEvents` coalesce concurrent calls (in-flight promise reuse) and use a generation counter so a slow stale response cannot overwrite a newer force-refresh (`superseded` result).
- `syncService` emits events (`content:synced`, `prayerTimes:synced`, `events:synced`, `sync:error`, ...) via `syncService.on(event, listener)` — `on` returns an unsubscribe function; always call it on unmount.

**Network detection**: `src/services/networkStatusService.ts` wraps `online`/`offline` window events plus a 30 s HEAD probe of `${apiUrl}/api/health`, exposing `subscribe(cb)`/`getStatus()`. Two caveats: (a) the backend currently has no `/api/health` route (nearest is `/api/home/system-health`), so `isApiReachable` is unreliable; (b) the Redux `ui.isOffline` flag is actually set in `src/App.tsx` from raw `window` online/offline events, not from this service. `apiClient` also tracks `navigator.onLine` itself and skips network attempts while offline unless `forceNetwork: true`.

**Cold boot with no network** (the flow lives in `src/hooks/useAppLoader.ts`):
1. redux-persist rehydrates `auth`/`content`/`emergency` from localStorage.
2. `initializeFromStorage` (authSlice) restores credentials via `credentialService`; if credentialService's localStorage keys were wiped but Redux still has them, it re-saves them (self-healing).
3. `loadCachedContent` (contentSlice) reads `schedule`, `events`, `prayerTimes`, `screenContent`, `displaySettings` from storageService in parallel and only overwrites fields it actually finds.
4. If anything cached exists, the app goes `ready` immediately and kicks `refreshAllContent({ forceRefresh: true })` in the background; only a genuinely first run (no cache) blocks on the network, with a 15 s give-up timeout.
5. Failed fetches fall back per-layer: `refreshContent` → storage `screenContent`; `refreshPrayerTimes` → storage `prayerTimes` → extracted from `screenContent` (then re-saved separately); `getWithCache` → stale `cache_*` entry.

## Step-by-step workflows

### 1. Add a new cached data type with offline fallback

Say the backend now serves "notices". Wire every layer:

1. **Fetch + HTTP cache**: add the endpoint/method in `src/api/` per the `api-integration` skill, using `getWithCache` with a new `CACHE_KEYS` entry.
2. **Bridge to storage**: in `apiClient.saveToStorageService` (`src/api/apiClient.ts`), add a branch mapping your cache key to a plain key:
   ```ts
   } else if (cacheKey === CACHE_KEYS.NOTICES) {
     await storageService.set('notices', data);
   }
   ```
   Without this, Redux can never read the data offline — this exact gap is the root cause documented in `docs/DATA_PROPAGATION_FIX.md`.
3. **Sync method** (if it should join scheduled/pushed syncs): add a `syncNotices` to `src/services/syncService.ts` copying `syncEvents` — including the in-flight coalescing and `updateState`/`emitEvent` calls — and add it to `syncAll`.
4. **Thunk with fallback** in the owning slice, following `refreshEvents` in `src/store/slices/contentSlice.ts`: try sync, then *always* read `storageService.get('notices')`, and only reject if both fail.
5. **Boot path**: add the key to the `Promise.all` in `loadCachedContent` (`contentSlice.ts`) so cached notices render before any network round-trip.
6. **Invalidation** (if the admin can edit notices live): add the type to `VALID_INVALIDATION_TYPES` and the dispatch `switch` in `src/store/middleware/realtimeMiddleware.ts`, and make sure the backend emits `content:invalidate` for it.
7. Test offline: DevTools → Network → "Offline", reload — notices must still render from cache.

### 2. Adjust sync cadence / behaviour

- **Interval and offset values** all live in `DEFAULTS` in `src/config/environment.ts` (`HEARTBEAT_INTERVAL`, `CONTENT_SYNC_INTERVAL`, `DAILY_SYNC_OFFSET_MS`, ...). Change them there — never scatter literals.
- Daily offsets are env-overridable without a code change: `VITE_DAILY_SYNC_OFFSET_MS`, `VITE_DAILY_UPDATE_CHECK_OFFSET_MS` (ms past midnight UTC).
- Scheduling logic is `scheduleDailySync` / `scheduleDailyUpdateCheck` in `src/services/syncService.ts` — a `setTimeout` to the next occurrence, then a 24 h `setInterval`. If you add a new scheduled job, copy that shape **and** clear both handles in `clearAllIntervals` (memory-discipline rule: every timer must be cleaned up; `stop()` must remain authoritative).
- Client-side debounce of refresh thunks is `MIN_REFRESH_INTERVAL` (5 min) in `src/store/slices/contentSlice.ts`; `forceRefresh: true` bypasses it. Keep push-driven paths on `forceRefresh` and polling paths debounced.

### 3. Debug stale data / cache invalidation

Symptom: admin changed something; the screen still shows the old value.

1. **Did the push arrive?** Look for `[RealtimeMW] content:invalidate received, scheduling refetch` in the console. If absent, the WebSocket is down (check `emergency.isConnected` state / `[SyncService] HTTP heartbeat fallback { enabled: true }`) — the screen will self-heal at the 03:00 UTC daily sync, but fix the realtime connection.
2. **Did the refetch run?** Expect `content/refreshContent/pending → fulfilled` in Redux DevTools and `[SyncService] Content synced successfully { fromCache: false }`. `fromCache: true` means the network fetch failed and stale cache was served.
3. **Was it superseded or debounced?** `refreshContent` returns `{ skipped: true, reason: 'debounced' | 'rate_limited' | 'superseded' }` — visible in the fulfilled action payload. Debounced means it ran without `forceRefresh` within 5 minutes of the last run.
4. **Which layer is stale?** Inspect in DevTools → Application:
   - IndexedDB `MasjidConnect` / `display_storage` → keys `screenContent`, `prayerTimes`, `schedule`, `events`, `displaySettings` and the `cache_*` entries.
   - localStorage → `persist:masjidconnect-root` (rehydration source).
   - Cache Storage → service-worker HTTP caches (cleared on force-refresh by `purgeApiServiceWorkerCaches`, `src/utils/purgeApiServiceWorkerCaches.ts`).
5. **Nuclear options**: `syncService.forceRefresh()` (clears the API cache then `syncAll({ forceRefresh: true })`), or the admin's `CLEAR_CACHE` remote command. `apiClient.clearCache()` handles the per-date prayer-times keys via prefix scan.
6. **Prayer times specifically**: cache key is per-date **in the masjid timezone** (`getPrayerTimes` in `apiClient.ts` uses `dayjs().tz(timezoneStr)`). A Pi running UTC showing yesterday's/tomorrow's times usually means the masjid timezone was missing — `syncPrayerTimes` falls back to `screenContent.masjid.timezone`, then `defaultMasjidTimezone` (`Europe/London`).

## Gotchas & failure modes

- **Data cached but Redux empty** → new `cache_*` key added without a `saveToStorageService` branch → thunks read `storageService` and find nothing. Fix the bridge (workflow 1, step 2). History: `docs/DATA_PROPAGATION_FIX.md`.
- **Sync ran, UI unchanged** → something consumed `syncService` directly instead of dispatching a thunk. Services/middleware must dispatch Redux thunks; `syncService` writes storage, not state.
- **Feedback loop between sync and thunk** → `refreshPrayerTimes` calls `syncPrayerTimes`, which fires the `prayerTimesUpdated` window event; the listener must dispatch `loadPrayerTimesFromStorage` (storage-only, no sync), NOT `refreshPrayerTimes` — that loop is why `loadPrayerTimesFromStorage` exists (see its doc comment in `contentSlice.ts`).
- **Offline device never retries** → `apiClient` skips network when `navigator.onLine` is false. Chromium on the Pi can report `onLine` incorrectly on some network setups; push-driven refetches therefore pass `forceNetwork: true`. If a fetch "does nothing" offline, check for `[ApiClient] Offline, not retrying` in the logs.
- **Expired cache returned anyway** — deliberate: `getCachedData(key, allowStale)` serves expired entries when the network failed (stale-if-error). Old data on screen beats no data on a mosque display. Don't "fix" this.
- **Storage never throws** — `storageService.get` returns `null`/default on error. Never write logic assuming storage errors propagate; check for `null` and log.
- **redux-persist vs storageService divergence** — both persist content-ish data. On boot, persist rehydrates first, then `loadCachedContent` overlays only the keys it finds (it deliberately does not clobber rehydrated fields with `null`). If you add boot loading, keep that "only set what you found" behaviour.
- **Timers not cleaned** → `syncService.stop()` must clear every interval/timeout (see `clearAllIntervals`); `networkStatusService.stop()` removes its listeners and interval. Any new timer/listener needs the same treatment or the Pi leaks memory over weeks of uptime.
- **`ui` slice is not persisted** — offline flags, loading stage etc. reset on boot by design. Don't move them into a persisted slice to "fix" a boot flicker.

## Validation

```bash
npm run lint
npx vitest run src/services/storageService.test.ts       # localforage mock pattern lives here
npx vitest run src/services/networkStatusService.test.ts
npx vitest run src/store/slices/contentSlice.test.ts     # loadCachedContent / refresh reducers
npm test
```

Manual offline test (`npm run dev`, port 3001):
1. Load the app online until content renders.
2. DevTools → Network → throttle "Offline", then hard-reload.
3. Expect: content renders from cache (console: `[Content] Loading cached content from storage...`, `[AppLoader] Rendered from cache; refreshing in background`), no crash.
4. Go back online: expect `[Network] Status changed` / online handling and a background refresh.

## Related

- `api-integration` skill — `getWithCache`, cache keys, `forceNetwork`/`cacheBust` semantics
- `redux-data-flow` skill — thunks, persist whitelist/blacklist, rehydration
- `.cursor/rules/api-and-data.mdc`, `.cursor/rules/performance-raspberry-pi.mdc`
- `docs/Offline_API_Integration_Guide.md`, `docs/Offline_API_Implementation_Examples.md`, `docs/DATA_PROPAGATION_FIX.md`, `docs/COMMUNICATION-FLOWS.md`

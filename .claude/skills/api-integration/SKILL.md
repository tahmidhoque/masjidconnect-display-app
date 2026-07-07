---
name: api-integration
description: The display app's HTTP layer — apiClient, endpoints, models, the success/data/error envelope, auth headers, retries, caching options and environment config. Use when adding a new API endpoint, changing a response model, debugging a failing/401/HTML/CORS API call, or touching src/api/ or src/config/environment.ts.
---

# API Integration

## When to use this skill

- Adding a new backend endpoint call end-to-end (endpoint → client method → types → thunk → component)
- Changing the shape of an API response model
- Debugging: 401 Unauthorized, "API returned HTML instead of JSON", CORS errors, requests that never fire when offline
- Anything touching `src/api/` or `src/config/environment.ts`
- Do NOT use for: Redux slice/thunk mechanics → see `redux-data-flow`; cache fallback order, sync scheduling → see `offline-storage-and-sync`

## Mental model

There are two Axios clients in `src/api/`, but only one is live:

- **`src/api/apiClient.ts` — the active client.** Singleton (default export). Used by `src/store/slices/authSlice.ts`, `src/services/syncService.ts`, `src/services/remoteControlService.ts`, `src/hooks/usePrayerTimes.ts`. All new work goes here.
- **`src/api/masjidDisplayClient.ts` — legacy.** As of now it is not imported by any live code (only by the skipped test `src/api/__tests__/masjidDisplayClient.test.ts.skip`). Do not add features to it, and do not create a third client.

`apiClient` internals (all in `src/api/apiClient.ts`):

- **Base URL**: `environment.apiUrl` from `src/config/environment.ts`. Defaults: `https://portal.masjidconnect.co.uk` (prod), `http://localhost:3001` (dev). Overridden by `VITE_API_URL`.
- **Auth**: a request interceptor calls `credentialService.getAuthHeader()` (returns `Bearer <apiKey>`) and sets `Authorization` plus `X-Screen-ID`. The Authorization header is deliberately **skipped** for the four pairing endpoints (`/screens/unpaired`, `/screens/check-simple`, `/screens/pair`, `/screens/paired-credentials`). Credentials come only from `credentialService` (`src/services/credentialService.ts`) — never read localStorage directly.
- **Retry**: `requestWithRetry` — up to `environment.maxRetries` (3) attempts, exponential backoff starting at `environment.initialRetryDelay` (1 s), doubling, capped at `environment.maxRetryDelay` (30 s). No retry on 401/403/404 or when `navigator.onLine` is false.
- **Caching**: `getWithCache(endpoint, cacheKey, ttl, params?, options?)` — network first; on success writes the response to a localforage cache entry `{ data, timestamp, ttl }` under `CACHE_KEYS` (`cache_content`, `cache_prayer_times_<YYYY-MM-DD>`, `cache_events`, `cache_sync_status`, TTL 24 h) **and** mirrors payloads into `storageService` via `saveToStorageService` so Redux thunks can read them. On network failure it serves stale cache (stale-if-error) unless `skipCacheFallback` is set. Options: `forceNetwork` (attempt network even if navigator says offline), `cacheBust` (adds `_t` param, clears the entry, skips stale fallback).
- **Request coalescing/deduplication** lives one level up in `src/services/syncService.ts` (`contentSyncInFlight`, `prayerTimesSyncInFlight`, `eventsSyncInFlight`): concurrent callers await the single in-flight request; a force-refresh during flight sets `contentForceRefreshPending` and a generation counter discards superseded responses.

**Endpoints** are centralised in `src/api/endpoints.ts` as `PAIRING_ENDPOINTS` and `SCREEN_ENDPOINTS` (plus helpers `buildUrl`, `buildUrlWithParams`). Every one has a verified backend route in the monorepo at `MasjidConnect-Backend/apps/admin/src/app/api/`:

| Frontend constant | Path | Backend route file |
|---|---|---|
| `REQUEST_PAIRING_CODE` | POST `/api/screens/unpaired` | `api/screens/unpaired/route.ts` |
| `CHECK_PAIRING_STATUS` | POST `/api/screens/check-simple` | `api/screens/check-simple/route.ts` |
| `PAIR` | PUT `/api/screens/pair` | `api/screens/pair/route.ts` |
| `GET_PAIRED_CREDENTIALS` | POST `/api/screens/paired-credentials` | `api/screens/paired-credentials/route.ts` |
| `HEARTBEAT` | POST `/api/screen/heartbeat` | `api/screen/heartbeat/route.ts` |
| `GET_CONTENT` | GET `/api/screen/content` | `api/screen/content/route.ts` |
| `GET_PRAYER_TIMES` | GET `/api/screen/prayer-times` | `api/screen/prayer-times/route.ts` |
| `GET_PRAYER_STATUS` | GET `/api/screen/prayer-status` | `api/screen/prayer-status/route.ts` |
| `GET_EVENTS` | GET `/api/screen/events` | `api/screen/events/route.ts` |
| `GET_SYNC_STATUS` | GET `/api/screen/sync` | `api/screen/sync/route.ts` |

Authenticated `/api/screen/*` routes verify the Bearer key via `authenticateScreen` (`apps/admin/src/lib/screen-auth.ts`) and handle CORS via `handleCorsOptions`/`applyCorsHeaders` (`apps/admin/src/lib/cors.ts`).

**The envelope**: every client method returns `ApiResponse<T>`:

```ts
// src/api/apiClient.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  fromCache?: boolean;
}
```

Always check `response.success` and read `response.data` — never treat the response itself as the payload. Beware: some backend responses are double-wrapped (`response.data.data`); `getPairedCredentials` in `apiClient.ts` shows the unwrap-and-validate pattern, and `unwrapScreenContentPayload` (`src/utils/unwrapScreenContent.ts`) does it for screen content. `src/api/models.ts` has its own richer `ApiResponse<T>` (with `cached`, `offlineFallback`, `cacheAge`) plus all domain types (`ScreenContent`, `PrayerTimes`, `Schedule`, `DisplaySettings`, `EmergencyAlert`, ...).

**Environment** (`src/config/environment.ts`): the ONLY place `import.meta.env` may be read. Import the default `environment` object (or named exports such as `apiUrl`). Recognised vars: `VITE_API_URL`, `VITE_REALTIME_URL`, `VITE_DEFAULT_MASJID_TIMEZONE`, `VITE_DAILY_SYNC_OFFSET_MS`, `VITE_DAILY_UPDATE_CHECK_OFFSET_MS` (see `.env.example`). It strips trailing slashes and force-upgrades `http://` to `https://` on masjidconnect domains. Never use `process.env` (browser has none) and never touch `import.meta.env` in components.

## Step-by-step workflows

### 1. Add a new API endpoint end-to-end

1. **Confirm the backend route exists**: look under `/Users/tahmidhoque/Documents/projects/MasjidConnect-Backend/apps/admin/src/app/api/screen/` (authenticated screen data) or `.../api/screens/` (pairing/admin). If there is no `route.ts`, the endpoint does not exist — stop and build/request it first.
2. **`src/api/endpoints.ts`** — add the constant with a doc comment, matching the existing style:
   ```ts
   export const SCREEN_ENDPOINTS = {
     // ...
     /** GET /api/screen/my-thing */
     GET_MY_THING: '/api/screen/my-thing',
   } as const;
   ```
3. **`src/api/models.ts`** — add the response payload interface (and request interface if POST).
4. **`src/api/apiClient.ts`** — add a public method. Cached GET template (copy `getEvents`):
   ```ts
   public async getMyThing(options?: { cacheBust?: boolean; forceNetwork?: boolean }): Promise<ApiResponse<MyThingResponse>> {
     if (!credentialService.hasCredentials()) {
       return { success: false, error: 'Not authenticated' };
     }
     return this.getWithCache<MyThingResponse>(
       SCREEN_ENDPOINTS.GET_MY_THING,
       'cache_my_thing',           // add to CACHE_KEYS + CACHE_TTL consts
       CACHE_TTL.CONTENT,
       undefined,
       { forceNetwork: options?.forceNetwork ?? false, skipCacheFallback: options?.cacheBust ?? false },
     );
   }
   ```
   For uncached POSTs copy `sendHeartbeat` (plain `requestWithRetry`). If Redux needs the data offline, also add a branch to `saveToStorageService` mapping your cache key to a `storageService.set(...)` call — otherwise thunks cannot read it from storage.
5. **Thunk** — add a `createAsyncThunk` in the owning slice that calls the method, checks `.success`, reads `.data`, and falls back to `storageService.get(...)` on failure (see `redux-data-flow` skill, workflow 2).
6. **Component** — dispatch the thunk / read via a selector with the typed hooks. Never call `apiClient` from a component.
7. Add tests (mock `@/api/apiClient` as in `src/store/slices/authSlice.test.ts`), then `npm run lint` and `npm test`.

### 2. Change a response model safely

1. Read the current interface in `src/api/models.ts` and grep for every consumer of the changed field (`grep -rn "fieldName" src/`).
2. The backend returns inconsistent/nested shapes across versions — the codebase always normalises rather than assuming. Follow the existing normaliser pattern: `normalizeScheduleData` and `extractDisplaySettings` in `src/store/slices/contentSlice.ts` accept old and new shapes and clamp/default every field.
3. Make removed/renamed fields **optional** first and support both shapes for at least one release — persisted Redux state and LocalForage caches on deployed Pis still hold the old shape after upgrade.
4. Run `npm run build` — the TypeScript pass is what catches missed consumers.

### 3. Debug a failing API call

Work through in order:

1. **Reproduce with the envelope in view**: in DevTools Network tab find the request; check status, `Content-Type`, and whether the body is JSON with `{ success, data, error }`.
2. **401 Unauthorized** → check credentials and header:
   - `credentialService.debugLogState()` logs whether apiKey/screenId/masjidId are loaded.
   - Confirm the `Authorization: Bearer ...` header actually appears in the request headers (not just in interceptor logs). A historical axios 1.x bug meant `config.headers["Authorization"] = ...` assignment silently failed — the fix is to use `config.headers.set('Authorization', ...)` or instance default headers; full story in `docs/AUTH_HEADER_FIX.md`.
   - Remember the client intentionally omits `Authorization` on pairing endpoints.
3. **"API returned HTML instead of JSON" / `TypeError: Cannot use 'in' operator`** → the server returned an error page (404/500/502, wrong `VITE_API_URL`, or a redirect). `docs/HTML_RESPONSE_ERROR_FIX.md` covers detection and diagnosis. Verify the URL with curl:
   ```bash
   curl -v "$API_URL/api/screen/content" -H "Authorization: Bearer $API_KEY" -H "Accept: application/json"
   ```
4. **CORS error** (`blocked by CORS policy`, no status code) → the backend must send the CORS headers; see `docs/CORS_SOLUTION.md` and `docs/CORS_Configuration.md`. Backend side: `handleCorsOptions`/`applyCorsHeaders` in `MasjidConnect-Backend/apps/admin/src/lib/cors.ts` — check the failing route calls both and that the origin is allowed. The legacy client used to emit an `api:corserror` CustomEvent for UI notification.
5. **Request never fires** → `apiClient` skips the network when `navigator.onLine` is false unless `forceNetwork: true`; and `getWithCache` may be serving cache (`fromCache: true` in the response, `[ApiClient] Using cached data` in logs).
6. **Old data despite backend change** → three cache layers can serve stale data: service-worker (purged by `purgeApiServiceWorkerCaches` in `src/utils/purgeApiServiceWorkerCaches.ts`), the `cache_*` localforage entries, and Redux persist. Force-refresh path (`syncService.syncContent({ forceRefresh: true })`) purges the first two — see `offline-storage-and-sync`.

## Gotchas & failure modes

- **Payload double-nesting** — some responses arrive as `{ success, data: { ...payload } }` and axios already puts the body in `response.data`, so the payload can be at `response.data.data`. Always unwrap defensively (`const payload = raw.data || raw;` as in `getPairedCredentials`).
- **Two clients, one truth** — `.cursor/rules/api-and-data.mdc` still describes both clients as active; in the current code only `apiClient.ts` is imported by live code. Do not "fix" a bug by editing `masjidDisplayClient.ts`.
- **Adding a cached GET without updating `saveToStorageService`** — the data will cache for HTTP purposes but Redux thunks reading `storageService` will see nothing (this exact split caused the outage described in `docs/DATA_PROPAGATION_FIX.md`).
- **Hardcoding URLs** — always go through `environment.apiUrl`. `masjidDisplayClient.ts` hardcodes the production URL; that is a legacy anti-pattern.
- **`/api/health`** — `src/services/networkStatusService.ts` probes `${apiUrl}/api/health`, but no such route exists in the backend admin app (nearest is `/api/home/system-health`), so `isApiReachable` cannot be trusted as "backend up". Verify against the real backend before building on it.
- **Prayer-times cache key is per-date** (`cache_prayer_times_<YYYY-MM-DD>`, computed in the masjid timezone) — clearing `cache_prayer_times` alone clears nothing; `clearCache` in `apiClient.ts` shows the prefix-scan pattern.
- **429 handling** — the client logs rate-limiting but still retries on the generic path; avoid tight polling loops, use the existing sync/coalescing infrastructure.

## Validation

```bash
npm run lint
npx vitest run src/api/endpoints.test.ts        # endpoint constants + URL builders
npx vitest run src/store/slices/authSlice.test.ts  # thunk ↔ client integration pattern
npm test                                         # full suite
npm run build
```

Manual check: `npm run dev` (port 3001), open DevTools Network tab, confirm the new request carries `Authorization` + `X-Screen-ID` headers and the response body is the `{ success, data }` envelope. Logs from the client are prefixed `[ApiClient]`.

## Related

- `redux-data-flow` skill — thunks that consume these client methods
- `offline-storage-and-sync` skill — cache keys, fallback order, invalidation
- `.cursor/rules/api-and-data.mdc`
- `docs/AUTH_HEADER_FIX.md`, `docs/HTML_RESPONSE_ERROR_FIX.md`, `docs/CORS_SOLUTION.md`, `docs/CORS_Configuration.md`, `docs/Masjid_Display_Screen_API_Documentation.md`

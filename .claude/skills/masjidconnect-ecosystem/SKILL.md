---
name: masjidconnect-ecosystem
description: Map of the whole MasjidConnect system (backend monorepo, admin portal, realtime server, mobile, website) and how to make cross-repo changes safely from the display app. Use when a change touches a backend API the display consumes, when display API models drift from backend responses, when asked "where does this endpoint live", when planning a coordinated backend+display change, or when working in ../MasjidConnect-Backend.
---

# The MasjidConnect Ecosystem

## When to use this skill

- A display feature needs a backend change (new field, new endpoint, changed response).
- Debugging a mismatch between what the backend returns and what `src/api/models.ts` expects.
- Finding where a display-facing API route is implemented in the backend.
- Planning deploy ordering for a coordinated change (who ships first).
- Any work inside `/Users/tahmidhoque/Documents/projects/MasjidConnect-Backend`.
- Do NOT use for pure display-side API client work → see `api-integration`; for WebSocket event handling details → see `realtime-and-remote-control`.

## Mental model

This repo (`masjidconnect-display-app`) is **one client** of a larger system. The backend monorepo lives at `../MasjidConnect-Backend` (pnpm workspaces + Turbo; root package `masjid-connect`). Its own instructions file is `claude.md` (lowercase) at the monorepo root — **read and follow it before changing anything there**.

| Piece | Where | Stack / notes |
|---|---|---|
| Admin portal + display-facing API | `MasjidConnect-Backend/apps/admin` | Next.js 15 App Router, MUI 6. Production: `portal.masjidconnect.co.uk` (the display's `VITE_API_URL` default). Deployed via Vercel (`vercel.json`, `build:vercel` script) |
| Realtime server | `MasjidConnect-Backend/apps/realtime` | `@masjid-connect/realtime` — Express + Socket.io. Deployed to Fly.io app `masjidconnect-realtime` (region `lhr`); `fly.toml` sits at the **monorepo root**; deploy with `pnpm realtime:deploy` (= `fly deploy`). Display default URL: `https://masjidconnect-realtime.fly.dev` |
| Mobile app | `MasjidConnect-Backend/apps/mobile` | Expo / React Native (expo-router) |
| Website | `MasjidConnect-Backend/apps/website` | Next.js 15 + Tailwind 4, public marketing (dev port 3002) |
| Store screenshots | `MasjidConnect-Backend/apps/store-screenshots` | App-store screenshot tooling |
| Shared business logic | `MasjidConnect-Backend/packages/shared` | `@masjid-connect/shared` — services as **static class methods with Zod validation** in `src/services/` |
| Database | `MasjidConnect-Backend/packages/database` | `@masjid-connect/database` — Prisma (`prisma/schema.prisma`, migrations, seeds). **All DB access via Prisma** |
| API client / UI / preview | `packages/api-client`, `packages/ui`, `packages/display-preview` | `@masjid-connect/display-preview` contains **vendored ports** of this repo's carousel for admin previews — synced manually |
| **This repo** | `masjidconnect-display-app` | The client installed on Pis in the field — updates slowly via OTA |

Note: the backend `claude.md` repo map lists an `apps/display` — that directory does **not** exist in the monorepo; the display client is this separate repo. Root backend commands: `pnpm dev`, `pnpm lint`, `pnpm type-check`, `pnpm test`, plus filters like `pnpm admin:dev`, `pnpm realtime:dev`, `pnpm database:generate` / `database:migrate` / `database:seed`.

### Where the display-facing API lives

All in `apps/admin/src/app/api/` (Next.js route handlers):

- **Pairing (unauthenticated)** — `apps/admin/src/app/api/screens/`: `unpaired/route.ts` (request pairing code), `check-simple/route.ts` (poll pairing status), `pair/route.ts` (admin/device completes pairing), `paired-credentials/route.ts` (exchange code for `apiKey`/`screenId`/`masjidId`).
- **Device (authenticated with `Authorization: Bearer <apiKey>`)** — `apps/admin/src/app/api/screen/`: `content/route.ts`, `prayer-times/route.ts`, `prayer-status/route.ts`, `events/route.ts`, `heartbeat/route.ts`, `sync/route.ts` (+ `sync/bulk/route.ts`).
- Device auth is `authenticateScreen` from `apps/admin/src/lib/screen-auth`; the content payload is assembled by `resolveScreenContent` in `apps/admin/src/lib/services/screen-content-resolver` — the route file itself only handles auth, CORS and the envelope.

The display app mirrors these paths in `src/api/endpoints.ts` (`PAIRING_ENDPOINTS`, `SCREEN_ENDPOINTS`) and types the responses in `src/api/models.ts`.

### The response envelope

Backend admin routes use helpers from `apps/admin/src/lib/api-response.ts` (`successResponse`, `errorResponse`, …):
- Success: `{ success: true, data, meta? }`
- Error: `{ success: false, message, code? }`

The display side types this as `ApiResponse<T>` in `src/api/apiClient.ts` and **always reads `.data`**. Backend response formats have historic inconsistencies — the display normalises them in Redux thunks (e.g. `refreshContent`, `refreshPrayerTimes` in `src/store/slices/contentSlice.ts`) before anything reaches components. Never let a component consume a raw API payload.

### Realtime (Socket.io) contract

The display (`src/services/realtimeService.ts`) authenticates with `{ type: 'display', screenId, masjidId, token }` where `token` is the `Screen.apiKey` from pairing; the server validates it in `apps/realtime/src/websocket/auth/socket-auth.ts` against Prisma. Events the display listens for: `emergency:alert`, `emergency:clear`, `screen:orientation`, `screen:command` (and `screen:command:<type>`), `content:update`, `prayer-times:update`, `display:heartbeat:ack`. It emits `display:heartbeat` and `display:command:ack`. Event names are string constants on both sides — renaming one side silently breaks the other.

## Step-by-step workflows

### 1. Make a coordinated cross-repo change (e.g. new field on screen content)

The golden rule: **devices in the field update slowly** (OTA only when a release is published AND the device is online and told/scheduled to update; some run old versions for weeks). The backend deploys in minutes. Therefore:

1. **Design additively.** New response fields are optional extras; never rename, remove, or change the type/meaning of an existing field the display reads. Never make the backend require a new request field/header from screens — old devices won't send it.
2. **Backend first.** In `MasjidConnect-Backend`: add the field in the service layer (`packages/shared/src/services/` or, for screen content, `apps/admin/src/lib/services/screen-content-resolver`), keep the envelope unchanged, follow the backend `claude.md` handler order (auth → Zod validate → scope check → service → `successResponse`). Validate with `pnpm lint && pnpm type-check` and test locally (`pnpm admin:dev`, port 3000).
3. **Deploy the backend** and confirm the live endpoint returns the new field with an existing device's credentials (or curl with a test screen's apiKey).
4. **Then the display**: add the optional field to the right interface in `src/api/models.ts`, consume it via a thunk with a fallback for when it's absent (offline cache may hold pre-change payloads for a long time — see `offline-storage-and-sync`), test, and cut a release (`release-and-deployment`).
5. **Never assume the fleet is upgraded.** The backend must keep supporting the old shape until telemetry (heartbeat `appVersion`) shows no old versions remain.

Removing/renaming something is the same dance in reverse and takes months: display stops reading it → release → wait for fleet adoption → backend removes it.

### 2. Find how an endpoint the display calls is implemented

1. In this repo, find the path constant in `src/api/endpoints.ts` (e.g. `SCREEN_ENDPOINTS.GET_CONTENT` = `/api/screen/content`).
2. Map URL → file: `/api/screen/content` → `MasjidConnect-Backend/apps/admin/src/app/api/screen/content/route.ts`.
3. The route handler is thin — follow its imports into `apps/admin/src/lib/services/` or `packages/shared/src/services/` for the real logic, and `packages/database/prisma/schema.prisma` for the data model.
4. Compare the returned shape against the display's expectation in `src/api/models.ts` and the normalisation in the consuming thunk in `src/store/slices/contentSlice.ts` / `src/store/slices/authSlice.ts`.

### 3. Change or add a realtime event

1. Read `realtime-and-remote-control` first for the display side.
2. Backend: handlers live under `apps/realtime/src/websocket/` (auth in `websocket/auth/`, handlers in `websocket/handlers/`). Emitting from the admin API to connected screens goes through the realtime server's HTTP API (`apps/realtime/src/api/`).
3. Keep event names and payloads backwards-compatible (additive payload fields only), for the same fleet-lag reason as REST.
4. Deploy realtime with `pnpm realtime:deploy` from the monorepo root. Display default URL is `https://masjidconnect-realtime.fly.dev` (`VITE_REALTIME_URL`).

### 4. Change the carousel? Update the admin preview too

`packages/display-preview` in the backend repo is a **manual vendored port** of this repo's `ContentCarousel`, content scaling and slide components (its README says so explicitly). If you change slide rendering, scaling, or schedule→slide mapping here, raise a matching change in `packages/display-preview` or the admin's screen preview will lie to mosque admins.

## Gotchas & failure modes

- **Symptom:** new backend field never appears on a device. **Cause:** device still on an old app release, or reading from LocalForage cache. **Fix:** check heartbeat `appVersion` in the admin portal; remember cold boots render from cache first.
- **Symptom:** old devices break the moment the backend deploys. **Cause:** a response field was renamed/removed or made non-optional, or a new required request field was added. **Fix:** revert; redesign additively (workflow 1).
- **Symptom:** display shows `undefined` for data the endpoint definitely returns. **Cause:** forgot the envelope — the payload is at `response.data`, not the response root; or the thunk normalisation doesn't map the backend's field name. **Fix:** compare route output with `src/api/models.ts` and the thunk.
- **Symptom:** WebSocket connects but a new event never arrives. **Cause:** event name string mismatch between `apps/realtime` and `src/services/realtimeService.ts`, or the screen's socket auth failed (deleted screen → the server emits a token-invalid error; the display treats it as a factory-reset signal). **Fix:** grep the exact event string on both sides.
- **Symptom:** admin portal preview doesn't match the real screen. **Cause:** `packages/display-preview` port has drifted from this repo's carousel. **Fix:** workflow 4.
- **Backend conventions differ from this repo** — don't carry display habits across: admin UI is **MUI 6** (no Tailwind components), state is React Context + local state (no Redux), all business logic in `packages/shared` static classes with Zod, all DB access via Prisma, response helpers from `apps/admin/src/lib/api-response.ts`, UK English. Full detail: `MasjidConnect-Backend/claude.md`.
- **Two clients, one API:** the mobile app (`apps/mobile`) and admin portal consume overlapping backend services — a "harmless" service-layer change for screens can break mobile. Run `pnpm type-check` at the monorepo root, not just in the app you touched.
- **CORS:** screen routes handle CORS explicitly (`handleCorsOptions` / `applyCorsHeaders` from `@/lib/cors` in the route files). A new display-facing route without these will work in curl and fail in the browser. History: `docs/CORS_SOLUTION.md`, `docs/CORS_Configuration.md`.

## Validation

- Display side: `npm run lint && npm test && npm run build` (see `testing-and-validation`); manually run `npm run dev` against the live backend and watch the network tab for the envelope shape.
- Backend side (from the monorepo root): `pnpm lint && pnpm type-check && pnpm test`; run the admin locally with `pnpm admin:dev` and hit the route, e.g.:
  ```bash
  curl -s -H "Authorization: Bearer <screen-apiKey>" http://localhost:3000/api/screen/content | head -c 500
  ```
- Contract check: diff the live JSON against `src/api/models.ts` interfaces before and after the backend deploy.
- Fleet safety: confirm in the admin portal that heartbeats (`appVersion`) still arrive from old-version devices after the backend deploy.

## Related

- Sibling skills: `api-integration` (display API clients/models), `realtime-and-remote-control` (event handling), `offline-storage-and-sync` (why old payload shapes linger in cache), `release-and-deployment` (shipping the display half), `pairing-and-auth` (credential lifecycle).
- Docs in this repo: `docs/DISPLAY-BACKEND-COMMUNICATION.md` (pairing + REST + WebSocket reference), `docs/COMMUNICATION-FLOWS.md` (sequence diagrams for pairing, heartbeat, emergency alerts, reconnection), `docs/Masjid_Display_Screen_API_Documentation.md`.
- Backend: `MasjidConnect-Backend/claude.md` (authoritative conventions), `MasjidConnect-Backend/turbo.json`, `MasjidConnect-Backend/fly.toml`.

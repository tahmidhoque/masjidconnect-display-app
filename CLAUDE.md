# CLAUDE.md

Guidance for AI coding agents (Claude Code, Cursor, and others) working in this repository.
This file is the map; the depth lives in the **skill library** (`.claude/skills/` — see the
index at the bottom) and `.cursor/rules/`. Load the relevant skill before working in its area.

## What This App Is

Digital signage for mosques: prayer times, countdowns, announcements, events, and emergency
alerts on always-on screens driven by Raspberry Pi 4/5 running Chromium in kiosk mode.
It is a **Vite SPA** served by a plain Node.js static server (`deploy/server.mjs`, port 3001).
**Not Electron** — never add Electron APIs or dependencies. Viewers never interact with it
(QR-code pairing is the only input, once); it must run 24/7 unattended, self-heal, and keep
working **offline**.

## The MasjidConnect Ecosystem

This repo is one client of a larger system. The backend monorepo lives at
`../MasjidConnect-Backend` (pnpm + Turbo; has its own `claude.md` — follow it when working there):

| Piece | Where | Notes |
|---|---|---|
| Admin portal | `MasjidConnect-Backend/apps/admin` | Next.js 15, MUI 6 — serves the display-facing API at `portal.masjidconnect.co.uk` |
| Realtime server | `MasjidConnect-Backend/apps/realtime` | Socket.io server, deployed to Fly.io (`masjidconnect-realtime`) |
| Mobile app | `MasjidConnect-Backend/apps/mobile` | Expo / React Native |
| Website | `MasjidConnect-Backend/apps/website` | Next.js 15, public marketing |
| Shared logic / DB | `packages/shared` (Zod + static service classes), `packages/database` (Prisma) | All backend business logic and DB access; also `packages/api-client`, `packages/ui`, `packages/display-preview` |
| **This repo** | `masjidconnect-display-app` | The display client installed on Pis in the field |

Cross-repo rule: devices in the field update slowly. Backend API changes must stay
backwards-compatible with older display versions; ship backend first, display second.
See the `masjidconnect-ecosystem` skill before any coordinated change.

## Commands

```bash
npm run dev           # Dev server (port 3001)
npm run build         # tsc -b + Vite production build → dist/
npm run lint          # ESLint — must pass before any change is considered done
npm test              # Vitest, single run
npm run test:watch    # Vitest watch mode
npx vitest run src/path/to/file.test.ts   # Single test file
npm run package       # Build + release tarball (scripts/package-release.sh)
npm run version:bump:patch|minor|major    # Version bump (never edit by hand)
```

## Architecture

**Stack:** React 18 + TypeScript 5 + Vite 7 + Tailwind CSS v4 + Redux Toolkit + Redux Persist
+ Socket.io-client + LocalForage + Workbox PWA.

**No URL routing.** `react-router-dom` is in `package.json` but unused — do not add routes.
Screens are phase-based, driven by `useAppLoader` in `src/App.tsx`:
`startup → pairing → loading → ready`, rendering `LoadingScreen` / `PairingScreen` /
`DisplayScreen` (→ `OrientationWrapper` → `LandscapeLayout` | `PortraitLayout`).

**Redux slices** (`src/store/slices/`): `authSlice` (pairing credentials — persisted),
`contentSlice` (prayer times, schedule, events, announcements, settings — persisted),
`emergencySlice` (alerts — persisted), `uiSlice` (orientation, offline, init stage — NOT
persisted). Custom middleware in `src/store/middleware/` bridges `realtimeService` and
`emergencyAlertService` into Redux.

**Service singletons** (`src/services/`) — import the default export, never re-instantiate:
`storageService` (LocalForage), `syncService`, `credentialService`, `realtimeService`,
`emergencyAlertService`, `remoteControlService`. (`networkStatusService` exists but is
currently unused — offline state comes from window events in `src/App.tsx`.)

**API** (`src/api/`): `apiClient.ts` is the **only live client**. `masjidDisplayClient.ts`
is dead legacy code (referenced only by a skipped test) — never extend or "fix" it, and do
not create new clients. Every response is wrapped: `{ success, data, error }` — always read
`.data`. Backend formats are inconsistent; normalise in thunks before storing in Redux.

**Tailwind v4**: no `tailwind.config.js` — design tokens via `@theme` in `src/index.css`.
Path alias `@/` → `src/`. Resolution-independent: rem-only sizing (design reference 1280×720,
root font-size scales via clamp) — never px or viewport units in typography.

## Non-Negotiable Rules

1. **Offline-first** — every data path needs a LocalForage cache fallback; cold boot with no
   network must still show cached content.
2. **Memory discipline** — every `setInterval` / `setTimeout` / listener / subscription is
   cleaned up in the `useEffect` return. This app runs for months without a restart.
3. **No `console.log`** — use `logger` (default export of `src/utils/logger.ts`);
   Terser strips `console.*` from production builds anyway.
4. **API calls only via Redux async thunks** — never from components. Respect the 5-minute
   refresh debounce (`MIN_REFRESH_INTERVAL` in `contentSlice.ts`; `forceRefresh` bypasses it).
5. **Tailwind utilities only** — no MUI/Chakra/CSS-in-JS, no `tailwind.config.js`, no
   `backdrop-filter` or heavy `box-shadow` (kills the Pi GPU), no CDN fonts (breaks offline).
6. **Service singletons** — default imports only.
7. **Typed hooks** — `useAppDispatch` / `useAppSelector` from `src/store/hooks.ts`.
8. **Display-only UI** — no clicks, inputs, scrollbars, or cursor; readable from 10–15 ft.
9. **Credentials via `credentialService`** — never touch `localStorage` directly for auth.
10. **Lint before done** — `npm run lint` must pass before any change is complete.

## Environment

Copy `.env.example` → `.env`. Access env only via `src/config/environment.ts`
(default export `config`) — never `process.env`, never raw `import.meta.env` in components.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `https://portal.masjidconnect.co.uk` | API base |
| `VITE_REALTIME_URL` | `https://masjidconnect-realtime.fly.dev` | Socket.io server |
| `PORT` | `3001` | Static server (deploy only) |

## Git & Releases

Branches: `feature/` `bugfix/` `refactor/` `chore/` `docs/`. Commits: `feat:` `fix:`
`refactor:` `chore:` `docs:`. Releases: bump version via npm script on `master`, commit
`chore: release x.y.z`, branch `release/x.y.z`, tag `vx.y.z` — pushing the tag triggers
`.github/workflows/build-and-release.yml`. Full procedure: `release-and-deployment` skill.

## Deployment Topology (context for debugging)

On the Pi: systemd `masjidconnect-display.service` runs `deploy/server.mjs` serving `dist/`;
`masjidconnect-kiosk.service` runs Chromium `--kiosk` against `localhost:3001`. Additional
units handle WiFi watchdog/hotspot setup, HTTP time sync, and RTC sync (`deploy/`).
`rpi-image/` builds the flashable Pi image. UK English in all user-facing copy.

## Skill Library — load before working in an area

Canonical skills live in `.claude/skills/<name>/SKILL.md`. Cursor loads the same content via
bridge rules in `.cursor/rules/skill-*.mdc`. **Keep both in sync: edit the SKILL.md, never the
bridge.**

| Skill | Use when |
|---|---|
| `redux-data-flow` | Adding/changing state, slices, thunks, selectors, persistence |
| `api-integration` | New endpoints, API clients, response models, request debugging |
| `offline-storage-and-sync` | Caching, storageService, syncService, stale-data bugs |
| `prayer-times-domain` | Anything touching prayer times, countdowns, phases, clock sync |
| `add-display-content` | Adding a new slide/content type to the carousel |
| `styling-and-layouts` | Tokens, Tailwind v4, orientation, scaling, Pi-safe CSS |
| `realtime-and-remote-control` | WebSocket/SSE events, remote commands, emergency alerts |
| `pairing-and-auth` | Pairing flow, credentials, device identity, factory reset |
| `debugging-runtime-issues` | Blank screen, stuck loading, restarts, leaks, error codes |
| `testing-and-validation` | Writing/fixing tests, definition of done |
| `release-and-deployment` | Cutting releases, OTA updates, Pi install/rollback |
| `masjidconnect-ecosystem` | Cross-repo changes, backend contract, system map |

Detailed conventions also live in `.cursor/rules/*.mdc` (component patterns, performance,
styling, redux, API, deployment, git, design context) — they apply to agents of all kinds,
not just Cursor.

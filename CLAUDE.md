# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Is

Digital signage application for mosques — displays prayer times, announcements, events, and emergency alerts on Raspberry Pi 4/5 devices running Chromium in kiosk mode. It is a Vite SPA served by a Node.js static server on port 3001. **Not Electron** — do not add Electron APIs or dependencies.

## Commands

```bash
npm run dev           # Start dev server (port 3001)
npm run build         # TypeScript check + Vite production build → dist/
npm run lint          # ESLint — must pass before any change is considered done
npm test              # Run Vitest tests once
npm run test:watch    # Vitest in watch mode
npm run test:coverage # Generate coverage reports
npm run package       # Build + create release tarball
```

**Single test file:**
```bash
npx vitest run src/path/to/file.test.ts
```

## Architecture

**Stack:** React 18 + TypeScript 5 + Vite 7 + Tailwind CSS v4 + Redux Toolkit + Redux Persist + Socket.io-client + LocalForage + Workbox PWA

**App phases** (routing is phase-based, not URL-based):
1. `LoadingScreen` — initialisation, credential check
2. `PairingScreen` — QR-code pairing flow (no user input beyond this)
3. `DisplayScreen` → `OrientationWrapper` → `LandscapeLayout` / `PortraitLayout` — the actual display

**State management (Redux Toolkit):**
- `authSlice` — pairing credentials, authentication state (persisted)
- `contentSlice` — prayer times, schedule, events, announcements, display settings (persisted)
- `uiSlice` — orientation, offline status, initialisation stage (NOT persisted)
- `emergencySlice` — emergency alerts (persisted)

Async thunks dispatch API calls. **Never call APIs directly from components.**

**Service singletons** (`src/services/`) — import default exports only, never re-instantiate:
- `storageService` — LocalForage wrapper
- `syncService` — Periodic backend sync
- `credentialService` — Manages pairing credentials
- `realtimeService` — WebSocket/SSE
- `emergencyAlertService` — Emergency alerts + expiry
- `networkStatusService` — Online/offline detection
- `remoteControlService` — Remote commands from admin

**API clients** (`src/api/`): Two Axios-based clients with in-memory + LocalForage cache, request deduplication, exponential backoff. API responses always wrap payload: `{ success, data, error }` — always access `.data`.

**Tailwind v4** — no `tailwind.config.js`. Design tokens are defined via `@theme` in `src/index.css`. Path alias `@/` → `src/`.

## Non-Negotiable Rules

1. **Offline-first**: Every data path must have a LocalForage cache fallback
2. **Memory discipline**: Every `setInterval`, `setTimeout`, and event listener must be cleaned up on unmount
3. **No `console.log`**: Use `logger` from `@/utils/logger`
4. **API calls via Redux thunks only**: Never call APIs directly from components
5. **Tailwind utilities only**: No MUI, no CSS-in-JS, no `tailwind.config.js`
6. **Service singletons**: Import default exports, never re-instantiate
7. **Typed hooks**: Use `useAppDispatch` / `useAppSelector` from `src/store/hooks.ts` — never untyped `useDispatch`/`useSelector`
8. **Lint before done**: Run `npm run lint` and fix all errors before marking any change complete

## Environment

- Copy `.env.example` → `.env`
- `VITE_API_URL` — API base URL (default: `https://portal.masjidconnect.co.uk`)
- `VITE_REALTIME_URL` — WebSocket server URL
- Do not use `process.env` or access `import.meta.env` directly in components — use `src/config/environment.ts`

## Git & Releases

Branch prefixes: `feature/`, `refactor/`, `bugfix/`, `chore/`, `docs/`
Commit prefixes: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`
Releases are cut from `master` → `release/x.y.z` branches.

## Detailed Rules

Additional rules covering Redux patterns, API/data fetching, component patterns, Tailwind v4 styling, deployment, performance, and git workflow are in `.cursor/rules/`. Reference those files when working in those areas.

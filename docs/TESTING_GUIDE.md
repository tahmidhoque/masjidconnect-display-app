# MasjidConnect Display App — Testing Guide

## Overview

The app uses **Vitest** and **React Testing Library** for unit, integration, and component tests. Tests run in CI before every build and are required by the release script.

## Tech stack

- **Vitest** — test runner, assertions, mocks (Vite-native)
- **@testing-library/react** — `render`, `renderHook`, `screen`, `waitFor`
- **@testing-library/jest-dom** — DOM matchers (e.g. `toBeInTheDocument()`)
- **jsdom** — browser-like environment
- **@vitest/coverage-v8** — coverage reporting

## Running tests

```bash
# Run all tests once
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Run with coverage report
npm run test:coverage
```

Coverage output: terminal summary plus `coverage/` (lcov, HTML). Thresholds are set in `vitest.config.ts` (default 85% lines/functions/branches/statements; can be raised to 90%).

## Test layout

- **Utils:** `src/utils/*.test.ts` — pure functions (dateUtils, adminUrlUtils, orientation, forbiddenPrayerTimes).
- **Redux:** `src/store/slices/*.test.ts` — reducer and extraReducer behaviour (auth, content, ui, emergency).
- **Hooks:** `src/hooks/*.test.ts` — `renderHook` with Redux wrapper where needed (usePrayerTimes, useCurrentTime, useConnectionStatus, useRotationHandling).
- **Components:** `src/components/display/*.test.tsx`, `src/components/layout/*.test.tsx` — render with `AllTheProviders` or `Provider` + test store.
- **Screens / App:** `src/components/screens/LoadingScreen.test.tsx`, `src/App.test.tsx` — loading UI and App root (with mocked useAppLoader / useDevKeyboard where needed).
- **Flows:** `src/flows/*.test.tsx` — integration-style tests (e.g. emergency overlay show/clear, startup state transitions).

## Test utilities

- **`src/test-utils/setup.ts`** — imports `@testing-library/jest-dom/vitest` (run via Vitest `setupFiles`).
- **`src/test-utils/mocks.ts`** — shared mock data (`mockApiCredentials`, `mockPrayerTimesArray`, `mockScreenContent`, `mockEmergencyAlert`, `mockAxiosResponse`, `createLocalForageMock`, etc.).
- **`src/test-utils/mock-store.ts`** — `createTestStore(preloadedState?)` for a Redux store with the same slices/middleware as production but no persist.
- **`src/test-utils/test-providers.tsx`** — `AllTheProviders` wrapper (Redux Provider + optional preloaded state) and re-export of `createTestStore`.
- **`src/test-utils/index.tsx`** — re-exports RTL, userEvent, and test-utils.

Use `createTestStore()` and `AllTheProviders` (or `Provider` with that store) so components that use `useAppSelector` / `useAppDispatch` get a consistent store.

## Writing tests

- Use **UK English** in comments and assertions.
- Use the project **logger** in app code only; avoid `console.log` in tests (or mock logger where it affects behaviour).
- For async or store updates, wrap dispatches in `act()` and use `waitFor()` when asserting on resulting UI.
- Mock external services (e.g. `realtimeService`, `credentialService`) with `vi.mock('@/services/...')` when testing hooks or components that depend on them.

## CI

`.github/workflows/build-and-release.yml` runs `npm test` after install and before lint/build. The release script (`scripts/create-release.js`) runs `npm test` unless `--skip-tests` is passed.

## Coverage

Run `npm run test:coverage` to enforce thresholds. Excluded from coverage: `**/*.d.ts`, `**/*.test.*`, `**/*.spec.*`, `src/main.tsx`, `src/test-utils/**`. To raise to 90%+, add tests for uncovered branches and adjust thresholds in `vitest.config.ts`.

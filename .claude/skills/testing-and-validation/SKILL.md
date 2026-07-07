---
name: testing-and-validation
description: How to write, run and fix tests (Vitest + React Testing Library) in the display app, and the definition-of-done checklist for any change. Use when writing a test for a new hook/slice/component/service, when a test fails, when asked "is this change done?", before committing or opening a PR, or when running npm test / lint / build.
---

# Testing & Validation

## When to use this skill

- Writing tests for a new Redux slice, hook, component, service, or utility.
- A test is failing and you need to fix it properly (not mask it).
- Deciding what to run before declaring any change complete.
- Understanding why a test file is skipped or why CI failed.
- Do NOT use for cutting releases or deploying to a Pi → see `release-and-deployment`.
- Do NOT use for backend API contract questions → see `masjidconnect-ecosystem`.

## Mental model

- **Runner:** Vitest 2 with `jsdom`, configured in `vitest.config.ts` (merges `vite.config.ts`, so the `@/` → `src/` alias works in tests). `globals: true`, but existing tests still import `describe/it/expect/vi` from `vitest` explicitly — follow that convention.
- **Discovery:** every file matching `src/**/*.{test,spec}.{ts,tsx}` runs. Tests live **next to the code they test** (e.g. `src/hooks/useCurrentTime.test.ts` beside `src/hooks/useCurrentTime.ts`), except `src/api/__tests__/` and the cross-cutting flow tests in `src/flows/`.
- **Setup file:** `src/test-utils/setup.ts` loads `@testing-library/jest-dom/vitest` matchers (`toBeInTheDocument()` etc.).
- **Shared helpers — always import from `@/test-utils`** (`src/test-utils/index.tsx`):
  - `render`, `screen`, `waitFor`, `fireEvent`, `act`, `renderHook`, `userEvent` (re-exported from RTL).
  - `AllTheProviders` — wraps children in a Redux `Provider` with a fresh test store (`src/test-utils/test-providers.tsx`).
  - `createTestStore(preloadedState?)` — production reducers + `emergencyMiddleware` + `realtimeMiddleware`, **no redux-persist** (`src/test-utils/mock-store.ts`).
  - Mock data in `src/test-utils/mocks.ts`: `mockApiCredentials`, `mockPairingCodeResponse`, `mockPairingStatusResponse`, `mockPrayerTimesArray`, `mockScreenContent`, `mockEmergencyAlert`, `mockAxiosResponse`, `mockAxiosError`, `setOnline`, `createLocalForageMock`.
- **Coverage:** v8 provider; thresholds in `vitest.config.ts` are `lines: 40, functions: 40, branches: 65, statements: 40` — a regression floor, not a target (the config comment says target 90%+ over time). Falling below a threshold fails `npm run test:coverage`.
- **CI:** `.github/workflows/pr-checks.yml` runs `npm run lint` → `npm test` → `npm run build` on every PR. `.github/workflows/build-and-release.yml` runs tests + lint before packaging. Whatever you skip locally will fail there.
- **Baseline** (July 2026): 56 test files, 542 tests, all passing in ~15 s.

## Definition of done — run this for EVERY change

```bash
npm run lint                              # 1. ESLint — zero errors
npx vitest run src/path/to/file.test.ts   # 2. Tests for the file(s) you touched
npm test                                  # 3. Full suite (fast — ~15 s)
npm run build                             # 4. tsc -b type-check + Vite build
```

All four must pass. `npm run build` is the only step that runs the TypeScript compiler — `npm test` does NOT type-check, so a passing suite can still hide a build-breaking type error. For docs-only changes you may skip steps 2–4, but never skip lint.

Other commands: `npm run test:watch` (watch mode while developing), `npm run test:coverage` (writes `coverage/` with lcov + HTML).

## Step-by-step workflows

### 1. Test a new Redux slice (or a new reducer/action in an existing slice)

Pattern to imitate: `src/store/slices/uiSlice.test.ts` (pure reducers) and `src/store/slices/contentSlice.test.ts` (reducers + `extraReducers` for thunks).

1. Create `src/store/slices/<name>Slice.test.ts` beside the slice.
2. Import the reducer as default plus the actions/selectors under test from the slice file itself.
3. Drive the reducer directly — no store needed for reducer logic:

```ts
import { describe, it, expect } from 'vitest';
import uiReducer from './uiSlice';
import { setOrientation } from './uiSlice';

describe('uiSlice', () => {
  it('has expected defaults', () => {
    const state = uiReducer(undefined, { type: 'init' });
    expect(state.orientation).toBe('LANDSCAPE');
  });

  it('sets orientation and rotation degrees', () => {
    const state = uiReducer(undefined, setOrientation('PORTRAIT'));
    expect(state.rotationDegrees).toBe(90);
  });
});
```

4. For async thunk `fulfilled`/`rejected` handling, dispatch the lifecycle action shapes into the reducer (see how `contentSlice.test.ts` exercises `refreshContent`, `refreshPrayerTimes`, `refreshSchedule`, `refreshEvents`), or use `createTestStore()` and dispatch the real thunk with the API client mocked via `vi.mock('@/api/apiClient', ...)`.
5. If the slice logs, mock the logger (see Gotchas).

### 2. Test a new hook

Pattern to imitate: `src/hooks/useCurrentTime.test.ts` (timer hook, no store) and `src/hooks/useAppLoader.test.tsx` (store + mocked services).

Timer-based hook:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCurrentTime from './useCurrentTime';

describe('useCurrentTime', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('updates when timer advances', () => {
    const { result } = renderHook(() => useCurrentTime());
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBeInstanceOf(Date);
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useCurrentTime());
    unmount(); // must not throw or leak — cleanup is a non-negotiable rule
  });
});
```

Hook that reads Redux state or calls services — use a `.test.tsx` file, mock the service singletons at module level, and wrap with `AllTheProviders`:

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { AllTheProviders } from '@/test-utils';

vi.mock('@/utils/logger', () => ({
  default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock('@/services/credentialService', () => ({
  default: { getCredentials: vi.fn(), hasCredentials: vi.fn(() => true), initialise: vi.fn(), debugLogState: vi.fn() },
}));

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AllTheProviders, null, children);
const { result } = renderHook(() => useAppLoader(), { wrapper });
await waitFor(() => expect(result.current).toHaveProperty('phase'));
```

Always include an unmount test for any hook that registers an interval, timeout, or listener.

### 3. Test a new display component

Pattern to imitate: `src/components/display/Footer.test.tsx`. Render inside `AllTheProviders`, mock hooks the component consumes:

```tsx
import { render, screen } from '@testing-library/react';
import Footer from './Footer';
import { AllTheProviders } from '@/test-utils';

vi.mock('@/hooks/useConnectionStatus', () => ({
  __esModule: true,
  default: () => ({ status: 'connected', message: '' }),
}));

it('shows MasjidConnect branding', () => {
  render(React.createElement(AllTheProviders, null, React.createElement(Footer)));
  expect(screen.getByLabelText('MasjidConnect')).toBeInTheDocument();
});
```

To seed state, pass `preloadedState` to `AllTheProviders` (it forwards it to `createTestStore`). Query by role/label/text (user-visible behaviour), not by class names — Tailwind class names change.

### 4. Test a service singleton

Pattern to imitate: `src/services/networkStatusService.test.ts`. Import the default export (never instantiate), mock `@/config/environment` and `@/utils/logger`, and assert listener add/remove symmetry:

```ts
vi.mock('@/config/environment', () => ({ apiUrl: 'https://api.test' }));

it('start adds listeners and stop removes them', () => {
  const addSpy = vi.spyOn(window, 'addEventListener');
  const removeSpy = vi.spyOn(window, 'removeEventListener');
  networkStatusService.start();
  expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
  networkStatusService.stop();
  expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
});
```

Because singletons hold module-level state, reset via the service's own stop/reset methods in `beforeEach`/`afterEach` — module state persists across tests in the same file.

### 5. Fix a failing test properly (vs masking it)

1. Reproduce in isolation: `npx vitest run src/path/to/file.test.ts` (add `-t "test name"` for one case).
2. Decide which is wrong — the code or the test's expectation. Read the source the test imports before touching either.
3. **Never** "fix" by: adding `.skip`, widening an assertion to `toBeTruthy()`, wrapping in try/catch, raising timeouts to paper over races, or deleting the test.
4. Time-dependent flake? Pin the clock with `vi.useFakeTimers()` + `vi.setSystemTime(...)` instead of loosening the assertion (real precedent: commit `ee9d3ac` "stabilise Jumuah test for post-Isha CI runs" — a test that only failed when CI ran after Isha time).
5. If a test genuinely cannot run (infrastructure limitation), the existing convention is renaming the file with a `.skip` suffix so Vitest never collects it — e.g. `src/api/__tests__/masjidDisplayClient.test.ts.skip` — AND documenting why in `docs/SKIPPED_TESTS.md`. This needs a very strong reason; prefer restructuring the test.
6. Re-run the full suite (`npm test`) — your fix must not break neighbours.

## Gotchas & failure modes

- **Symptom:** test fails on an unexpected logger call or noisy output. **Cause:** code under test uses `logger` from `src/utils/logger.ts`. **Fix:** `vi.mock('@/utils/logger', () => ({ default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() } }))` — the standard shape used across the suite.
- **Symptom:** second test in a file sees state from the first. **Cause:** service singletons initialise at import time and keep module state. **Fix:** reset via the service's public API in `beforeEach`; `vi.clearAllMocks()` only resets mocks, not service state.
- **Symptom:** test hangs, or later tests receive phantom timer callbacks. **Cause:** `vi.useFakeTimers()` without `vi.useRealTimers()` in `afterEach`. **Fix:** always pair them (see `useCurrentTime.test.ts`).
- **Symptom:** component test crashes with a react-redux context error. **Cause:** rendered without a Provider. **Fix:** wrap in `AllTheProviders`.
- **Symptom:** thunk test hits the real network. **Cause:** API client not mocked — thunks call `src/api/apiClient.ts` / `src/api/masjidDisplayClient.ts`. **Fix:** `vi.mock('@/api/apiClient', ...)` returning `{ success: true, data: ... }` envelopes (`mockAxiosResponse` helps). Remember: every real API response is wrapped `{ success, data, error }`.
- **Symptom:** tests pass but `npm run build` fails. **Cause:** Vitest transpiles without full type-checking; `tsc -b` is stricter. **Fix:** always run `npm run build` before declaring done.
- **Symptom:** test store rejects state with "non-serializable value". **Cause:** the test store's `serializableCheck` only ignores `auth.lastUpdated`, `content.lastUpdated`, `content.prayerTimes`, `emergency.alertHistory` (see `src/test-utils/mock-store.ts`). **Fix:** keep new state serialisable; if you legitimately add an ignored path in `src/store/index.ts`, mirror it in `mock-store.ts`.
- **Symptom:** behaviour differs between tests and a real device after restart. **Cause:** `createTestStore` has **no redux-persist** — rehydration/persistence bugs are invisible to unit tests. **Fix:** manually verify persist-sensitive changes in the dev app (reload the page) as part of validation.
- **Stale docs trap:** `docs/TESTING_QUICK_START.md`, `docs/README_TESTING.md` and parts of `docs/SKIPPED_TESTS.md` predate the Jest→Vitest migration (flags like `--testPathPattern` and paths like `src/services/__tests__/` no longer exist). Trust `docs/TESTING_GUIDE.md`, `vitest.config.ts` and this skill instead.

## Validation

```bash
npm test                                           # full suite, run once
npx vitest run src/hooks/usePrayerTimes.test.ts    # single file
npx vitest run src/hooks/usePrayerTimes.test.ts -t "name"  # single test
npm run test:watch                                 # watch mode
npm run test:coverage                              # coverage report → coverage/
npm run lint                                       # must be clean
npm run build                                      # tsc -b + vite build — the type gate
```

Expected healthy output: all test files pass (baseline 56 files / 542 tests), lint exits 0, build produces `dist/` with no TS errors.

## Related

- Sibling skills: `release-and-deployment` (tests are a release gate), `masjidconnect-ecosystem` (mock data must match real backend shapes).
- Docs: `docs/TESTING_GUIDE.md` (current), `docs/SKIPPED_TESTS.md` (rationale, but paths stale).
- Rules: `.cursor/rules/redux-state-management.mdc`, `.cursor/rules/component-patterns.mdc`, `.cursor/rules/api-and-data.mdc`.
- CI: `.github/workflows/pr-checks.yml`, `.github/workflows/build-and-release.yml`.

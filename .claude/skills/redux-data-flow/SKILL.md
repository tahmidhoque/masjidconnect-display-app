---
name: redux-data-flow
description: How Redux state works end-to-end in the display app — the four slices, redux-persist, middleware, typed hooks, async thunks and selectors. Use when adding a field to a slice, adding a new async thunk or selector, consuming state in a component, debugging state that is wrong after a restart/rehydrate, or writing slice tests.
---

# Redux Data Flow

## When to use this skill

- Adding or changing a field in `authSlice`, `contentSlice`, `uiSlice` or `emergencySlice`
- Adding a new async thunk that fetches data
- Adding a selector or reading state in a component
- Debugging: state is stale/missing after app restart, loading screen hangs, data fetched but UI never updates
- Writing or fixing tests under `src/store/`
- Do NOT use for: HTTP client/endpoint work → see `api-integration`; LocalForage caching, sync cadence, offline fallback order → see `offline-storage-and-sync`

## Mental model

Data flows one way: **API → async thunk → reducer → selector → component**. Components never call APIs; middleware never writes data directly — it dispatches thunks.

Files that own each piece:

| File | Owns |
|---|---|
| `src/store/index.ts` | `configureStore`, `combineReducers`, redux-persist config, middleware wiring. Exports `store`, `persistor`, `RootState`, `AppDispatch` |
| `src/store/hooks.ts` | `useAppDispatch`, `useAppSelector` — the ONLY hooks components may use |
| `src/store/slices/authSlice.ts` | Pairing + credentials. Thunks: `requestPairingCode`, `checkPairingStatus`, `initializeFromStorage` |
| `src/store/slices/contentSlice.ts` | Prayer times, schedule, events, `displaySettings`. Thunks: `refreshContent`, `refreshPrayerTimes`, `loadPrayerTimesFromStorage`, `refreshSchedule`, `refreshEvents`, `loadCachedContent`, `refreshAllContent` |
| `src/store/slices/uiSlice.ts` | Orientation, offline flags, init stage, notifications, update status. Synchronous reducers only |
| `src/store/slices/emergencySlice.ts` | Emergency alerts + connection state. Thunks: `initializeEmergencyService`, `connectToEmergencyService`, `disconnectFromEmergencyService`, `clearExpiredAlert` |
| `src/store/middleware/realtimeMiddleware.ts` | Starts WebSocket + `syncService` when auth completes (`auth/initializeFromStorage/fulfilled` or `auth/checkPairingStatus/fulfilled`); on `content:invalidate` WS events dispatches the matching refresh thunk with `{ forceRefresh: true }`; tears down on `auth/logout` |
| `src/store/middleware/emergencyMiddleware.ts` | Bridges `emergencyAlertService` → `setCurrentAlert`; disconnects on `auth/logout` |

**Persistence** (`persistConfig` in `src/store/index.ts`): key `masjidconnect-root`, `version: 1`, storage = `redux-persist/lib/storage` (localStorage).

| Slice | Persisted? |
|---|---|
| `auth` | Yes (whitelist) — credentials survive restarts |
| `content` | Yes — offline-first render from last known data |
| `emergency` | Yes — active alerts survive restarts |
| `ui` | **No** (blacklist) — transient; resets every boot |

A `stateValidationTransform` (also in `src/store/index.ts`) logs a warning if a persisted slice rehydrates as a non-object. `serializableCheck` ignores redux-persist actions and the paths `auth.lastUpdated`, `content.lastUpdated`, `content.prayerTimes`, `emergency.alertHistory`.

## Step-by-step workflows

### 1. Add a field to an existing slice

1. Read the slice file first to confirm current shape (e.g. `src/store/slices/contentSlice.ts`).
2. Add the field to the state interface (`ContentState`, `AuthState`, `UIState` or `EmergencyState`) **and** to `initialState`.
3. Add a reducer (or handle it in an existing thunk's `extraReducers` case). Immer allows direct mutation inside reducers:
   ```ts
   setCarouselTime: (state, action: PayloadAction<number>) => {
     state.carouselTime = Math.max(5, Math.min(300, action.payload));
   },
   ```
4. Export the action from the slice's `slice.actions` destructuring block and add a selector at the bottom of the file:
   ```ts
   export const selectCarouselTime = (state: { content: ContentState }) =>
     state.content.carouselTime;
   ```
5. **Persistence/rehydration check** — if the slice is `auth`, `content` or `emergency`:
   - Devices in the field already have a persisted copy of the slice. redux-persist's default state reconciliation replaces each whitelisted slice with the stored object, so **your new field will be `undefined` after rehydration** on existing devices (it is not in the stored copy).
   - Write every consumer defensively: `state.content.myNewField ?? DEFAULT`, or normalise in the thunk before storing.
   - If the field must be guaranteed present, bump `version` in `persistConfig` (`src/store/index.ts`) and add a `migrate` function — currently there is no migrate function, so defensive defaults are the established pattern.
   - Never store non-serialisable values (functions, class instances, `Date` objects) in a persisted slice.
6. Add/extend tests in the sibling `*.test.ts` file (see workflow 4) and run them.
7. Run `npm run lint` and fix everything before you're done.

### 2. Add a new async thunk that calls the API

Pattern to imitate — `refreshEvents` in `src/store/slices/contentSlice.ts` (trimmed):

```ts
export const refreshEvents = createAsyncThunk(
  "content/refreshEvents",
  async (options: { forceRefresh?: boolean } = {}, { rejectWithValue }) => {
    try {
      const { forceRefresh = false } = options;
      if (forceRefresh) {
        const syncResult = await syncService.syncEvents({ forceRefresh: true });
        if (!syncResult.success) {
          logger.warn("[Content] Events sync unsuccessful, falling back to cached data", {
            error: syncResult.error,
          });
        }
      }
      const events = await storageService.get<any>('events'); // offline fallback — mandatory
      return { events: events || [], timestamp: new Date().toISOString() };
    } catch (error: any) {
      logger.error("[Content] Error refreshing events", { error });
      return rejectWithValue(error.message || "Failed to refresh events");
    }
  },
);
```

Checklist:
1. Name the thunk `"<sliceName>/<verbNoun>"` — the string prefix must match the slice `name`.
2. Call the API via `syncService` (content-type data) or `apiClient` (see `requestPairingCode` in `src/store/slices/authSlice.ts` for a direct `apiClient` call). Always check `response.success` and read `response.data` — never the raw response.
3. **Offline-first is non-negotiable**: on network failure, fall back to `storageService.get(...)` before rejecting.
4. Use `rejectWithValue(message)` so the rejected reducer gets a string payload.
5. Handle all three lifecycle actions in `extraReducers`:
   ```ts
   builder
     .addCase(refreshEvents.pending, (state) => { state.isLoadingEvents = true; state.eventsError = null; })
     .addCase(refreshEvents.fulfilled, (state, action) => { /* write payload */ })
     .addCase(refreshEvents.rejected, (state, action) => { state.eventsError = action.payload as string; });
   ```
6. Respect debouncing: content thunks skip work if called within `MIN_REFRESH_INTERVAL` (5 minutes, defined in `contentSlice.ts`) unless `forceRefresh: true`. Return `{ skipped: true, reason: ... }` for skipped runs and guard the fulfilled reducer with `if (!action.payload.skipped)`.
7. Use `logger` from `@/utils/logger` — never `console.log`.

### 3. Add a selector / consume state in a component

1. Define the selector in the slice file (not inline in the component):
   ```ts
   export const selectDisplaySettings = (state: { content: ContentState }) =>
     state.content.displaySettings;
   ```
   If the selector derives/builds new objects, memoise it with `createSelector` — see `selectDisplayLayoutConfig` in `contentSlice.ts` for the pattern.
2. In the component:
   ```ts
   import { useAppDispatch, useAppSelector } from '@/store/hooks';
   import { selectDisplaySettings, refreshContent } from '@/store/slices/contentSlice';

   const displaySettings = useAppSelector(selectDisplaySettings);
   const dispatch = useAppDispatch();
   // to trigger a fetch: dispatch(refreshContent({ forceRefresh: true }));
   ```
3. Never import `useDispatch`/`useSelector` from `react-redux` directly, and never call `apiClient`/`syncService` from a component.

### 4. Test a slice change

Patterns are in `src/store/slices/authSlice.test.ts`:

- **Reducer-level** — feed thunk lifecycle actions straight into the reducer:
  ```ts
  const state = authReducer(undefined, requestPairingCode.pending('', 'LANDSCAPE'));
  const next = authReducer(state, requestPairingCode.fulfilled(payload, '', 'LANDSCAPE'));
  ```
- **Thunk integration** — real store, mocked API:
  ```ts
  import { createTestStore } from '@/test-utils/mock-store';
  vi.mock('@/api/apiClient', () => ({ default: { requestPairingCode: (...a) => mockFn(...a) } }));
  vi.mock('@/utils/logger', () => ({ default: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

  const store = createTestStore();
  await store.dispatch(requestPairingCode('LANDSCAPE'));
  expect(store.getState().auth.pairingCode).toBe('ABC');
  ```
  `createTestStore` (in `src/test-utils/mock-store.ts`) uses the production reducers and middleware but no persist, and accepts `preloadedState`.
- Shared fixtures (`mockScreenContent`, `mockPrayerTimesArray`) live in `src/test-utils/mocks.ts` — see `contentSlice.test.ts` for usage.

## Gotchas & failure modes

- **New field is `undefined` after deploy** → slice is persisted and old devices rehydrate the stored copy without your field → default it at read time (`?? fallback`) or add a persist migration (see workflow 1, step 5).
- **Data fetched, UI never updates** → something called `syncService` directly instead of dispatching a thunk, so Redux never saw the data. This exact bug is documented in `docs/DATA_PROPAGATION_FIX.md`. Middleware and services must dispatch thunks (`refreshContent`, `refreshPrayerTimes`, ...), never mutate state paths themselves.
- **Thunk appears to do nothing** → debounce. Content thunks silently return `{ skipped: true }` within 5 minutes of the last run. Pass `{ forceRefresh: true }` when reacting to an explicit invalidation.
- **`isLoading` stuck true / loading screen hangs** → every `pending` case that sets a loading flag must have matching `fulfilled` AND `rejected` cases that clear it. `contentSlice` recomputes the aggregate `isLoading` from the four per-type flags in every case — copy that pattern.
- **serializableCheck errors in dev console** → you stored a `Date`, function or class instance in state. Store ISO strings (`new Date().toISOString()`) like the existing `lastUpdated` fields.
- **Stale pairing flags after reboot** → persisted `auth` state can rehydrate mid-pairing flags; `initializeFromStorage.fulfilled` explicitly clears them when no credentials/pairing data are found. If you add boot-time state, clear it the same way rather than trusting rehydrated values.
- **Interval/listener leaks** — if your slice work adds a `setInterval`/`setTimeout`/listener anywhere (middleware, component), it must be cleaned up (`cleanupRealtimeMiddleware` in `realtimeMiddleware.ts` shows the pattern of collecting unsubscribe functions in `unsubs`).

## Validation

```bash
npm run lint                                        # must pass — non-negotiable
npx vitest run src/store/slices/contentSlice.test.ts   # single file
npx vitest run src/store                            # all store tests
npm run build                                       # tsc -b + vite build catches type breaks
```

In the browser (`npm run dev`, port 3001): Redux DevTools is enabled in dev (`devTools: import.meta.env.DEV` in `src/store/index.ts`). Check the action stream shows `<slice>/<thunk>/pending` → `fulfilled`, and inspect `persist:masjidconnect-root` in localStorage (Application tab) to confirm what actually persists.

## Related

- `api-integration` skill — the HTTP layer thunks call into
- `offline-storage-and-sync` skill — where the cached data thunks read comes from
- `.cursor/rules/redux-state-management.mdc` (note: it says the debounce is 30 s; the code in `contentSlice.ts` uses `MIN_REFRESH_INTERVAL` = 5 minutes — trust the code)
- `docs/DATA_PROPAGATION_FIX.md`, `docs/REDUX_REFACTOR_REPORT.md`

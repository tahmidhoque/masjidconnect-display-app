---
name: prayer-times-domain
description: Core domain guide for prayer times on the MasjidConnect display — data model (adhan vs jamaat vs Jumu'ah), the prayer hooks, the phase machine, countdown logic, time synchronisation and clock-drift debugging. Use when changing or debugging anything involving prayer times, jamaat windows, the countdown, "Jamaat in progress" / blackout / supplication screens, tomorrow's jamaat changes, Ramadan mode, the jamaat buzzer, wrong times on screen, or clock drift on the Pi.
---

# Prayer Times Domain

**This is the highest-stakes area of the app.** A mistake here shows wrong prayer times in a mosque. Never change behaviour without running the test suites listed under Validation, and never trust device-local time arithmetic — the Pi kiosk usually runs in UTC while the masjid is in another timezone.

## When to use this skill

- Changing countdown, phase, or "Jamaat in progress" behaviour
- Adding a new display element that depends on prayer times or the current phase
- Debugging "wrong prayer highlighted", "countdown stuck at 0s", "screen didn't black out at jamaat", "buzzer didn't fire", "clock drifts / skips seconds"
- Anything Jumu'ah, Ramadan, imsak, forbidden (makruh) prayer windows, or tomorrow's-jamaat announcements
- Do NOT use for adding new carousel slide types → see `add-display-content`
- Do NOT use for pure styling/layout work → see `styling-and-layouts`

## Mental model

### Data model (src/api/models.ts, `PrayerTimes`)

- **Adhan times**: `fajr`, `sunrise`, `zuhr`, `asr`, `maghrib`, `isha` (strings, usually `HH:mm`).
- **Jamaat (congregation) times**: `fajrJamaat`, `zuhrJamaat`, `asrJamaat`, `maghribJamaat`, `ishaJamaat`. Sunrise has no jamaat.
- **Jumu'ah**: optional `jummahKhutbah` and `jummahJamaat`. On Fridays, Jumu'ah *replaces* the Zuhr congregational prayer.
- Optional `imsak` (Ramadan), optional `date` (`YYYY-MM-DD`), and optional `data: PrayerTimes[]` — the API commonly returns a *week array* wrapped in `data`, each day carrying its own `date`.

The payload lives in Redux `contentSlice` (`state.content.prayerTimes`, persisted via redux-persist + LocalForage). It is refreshed by the `refreshPrayerTimes` / `loadPrayerTimesFromStorage` thunks in `src/store/slices/contentSlice.ts` — never fetched directly from components.

### Hook chain (all in src/hooks/)

```
useCurrentTime  ──►  useMasjidTime  ──►  usePrayerTimes  ──►  usePrayerPhase  ──►  components
 (1s global tick)    (dayjs, masjid tz)   (list + next/current)  (phase machine)
```

- **`useCurrentTime`** (`src/hooks/useCurrentTime.ts`) — a singleton `GlobalTimeManager` class runs ONE `setInterval(1000)` for the whole app; every consumer subscribes. This exists because multiple per-component timers made the clock skip seconds on the Pi (see `docs/CLOCK_FIX_SUMMARY.md`). **Never add another 1-second `setInterval` for time display.**
- **`useMasjidTime`** (`src/hooks/useMasjidTime.ts`) — returns a dayjs object in the masjid's IANA timezone (`selectMasjidTimezone` from contentSlice, falling back to `defaultMasjidTimezone` from `src/config/environment.ts`). Use this, not `new Date()` wall-clock methods, for anything the user sees.
- **`usePrayerTimes`** (`src/hooks/usePrayerTimes.ts`) — the big one. Builds today's formatted list (`todaysPrayerTimes`), selects `nextPrayer` / `currentPrayer` (`calculatePrayersAccurately`), handles the Friday Jumu'ah-replaces-Zuhr substitution (`applyJummahSubstitution`), the after-Isha switch to tomorrow's list, offline midnight roll-forward (matching `data[]` rows by `date`), Hijri date, `forbiddenPrayer` (makruh windows via `getCurrentForbiddenWindow` in `src/utils/forbiddenPrayerTimes.ts`), and `tomorrowsJamaats` (a `TomorrowsJamaatsMap`).
- **`PrayerTimesContext`** (`src/contexts/PrayerTimesContext.tsx`) — `usePrayerTimes` is called ONCE inside `PrayerTimesProvider` (wrapped around `DisplayScreenInner` in `src/components/screens/DisplayScreen.tsx`). **All consumers must use `usePrayerTimesContext()`, never call `usePrayerTimes()` again** — a second instance duplicates timers and refresh requests.
- **`usePrayerPhase`** (`src/hooks/usePrayerPhase.ts`) — pure phase machine over context + `useCurrentTime`. Phases (`PrayerPhase` type):
  - `countdown-adhan` — normal carousel, counting to adhan
  - `countdown-jamaat` — adhan passed, > `JAMAAT_LEAD_MIN` (5) minutes to jamaat; may set `adhanSupplicationActive`
  - `jamaat-soon` — within 5 min of jamaat → silent-phones screen (`JamaatSoonSlot`)
  - `in-prayer` — jamaat reached, with `inPrayerSubPhase`: `'jamaat'` → `'post-jamaat-supplication'` → `'post-jamaat'`
  Window lengths come from portal `displaySettings` via `src/utils/displaySettingsJamaat.ts` (`jamaatPhaseMinutesForDisplayPrayer`, `postJamaatDelayMinutes`, `postJamaatSupplicationWindowMinutes`, all clamped 5–30 min, default 10).
- **`useRamadanMode`** (`src/hooks/useRamadanMode.ts`) — detects Ramadan (API `displaySettings.isRamadanActive` wins; else local Hijri calculation), exposes suhoor/iftar/imsak countdowns, and sets `data-theme="ramadan"` on `<html>` (whole CSS theme flips — see `styling-and-layouts`).
- **`useJamaatBuzzer`** (`src/hooks/useJamaatBuzzer.ts`) — edge-triggered on entering the `in-prayer`/`jamaat` sub-phase; plays `/sounds/jamaat-buzzer.mp3` (`BUZZER_SOUND_URL`) once per prayer per day (localStorage key `mc.buzzer.lastFired`), with a 5 s safety window (`SAFETY_WINDOW_SEC`) so a late boot never blasts sound mid-prayer. Mounted once in `DisplayScreenInner`.
- **`useBuzzerSettings`** (`src/hooks/useBuzzerSettings.ts`) — device-local enabled/volume via `useSyncExternalStore` on localStorage key `mc.buzzer.settings`.

### The one safe way to compare times

All phase/selection logic compares **minutes-from-midnight in the masjid timezone**:

```ts
import { nowMinutesInTz, toMinutesFromMidnight } from '../utils/dateUtils';
const now = nowMinutesInTz(currentTime, masjidTz);        // fractional minutes
const J = toMinutesFromMidnight(jamaatStr, prayerName);   // -1 when unparseable
```

`toMinutesFromMidnight` also repairs unpadded (`9:30`) and 12-hour-looking (`7:45` Maghrib → 19:45) payloads. Never compare `"HH:mm"` strings against `Date.getHours()` — that breaks when the Pi runs in UTC.

### Jumu'ah (Friday) rule

`getEffectiveJamaat(prayer, isJumuahToday, jumuahTime)` in `src/utils/jumuahJamaat.ts` is the **single source of truth**: on Fridays the Zuhr slot's live target becomes `jummahJamaat`. It is used by `usePrayerPhase`, `PrayerCountdown` and `useJamaatBuzzer`. **Any new consumer of a jamaat time must call it too**, or Friday behaviour silently diverges. `usePrayerTimes` additionally substitutes the Zuhr row in-place (`applyJummahSubstitution`) and reverts it after the Jumu'ah window elapses.

### Countdown components

- `src/components/display/PrayerCountdown.tsx` — computes the target each second from `useMasjidTime` (adhan vs jamaat vs tomorrow's Fajr; mirrors the phase rules, including its own local `JAMAAT_LEAD_MIN = 5`).
- `src/components/display/CountdownDisplay.tsx` — renders `"5h 19m 20s"` strings with small unit labels; the `.countdown-stable` class (in `src/index.css`) prevents layout shift.
- Countdown strings come from `getTimeUntilNextPrayer` in `src/utils/dateUtils.ts` (second parameter treats the target as tomorrow).

### Phase-driven screens (src/components/display/)

- `JamaatSoonSlot.tsx` — owns the `jamaat-soon` band; alternates `SilentPhonesGraphic` with `TomorrowsJamaatChangeSlide` when tomorrow's jamaat differs (eligible prayers: `TOMORROW_CHANGE_ELIGIBLE_PRAYERS` = Fajr/Zuhr/Asr/Isha; Maghrib excluded because it shifts daily).
- `InPrayerScreen.tsx` — calm "Jamaat in progress" panel (pure presentational).
- `JamaatBlackoutOverlay.tsx` — full black layer portalled into `#orientation-portal-root`; active when the settings resolve to blackout mode (`isJamaatBlackoutMode` in `src/utils/displaySettingsSupplications.ts`).
- `PostJamaatSupplicationSlot.tsx` — cycles fixed post-Fardh duʿās (`POST_JAMAAT_SUPPLICATIONS` in `src/constants/scheduledSupplications.ts`) during the `post-jamaat-supplication` sub-phase.
- `ForbiddenPrayerNotice.tsx` — "Nafl prayer not recommended until …" caption driven by `forbiddenPrayer` from context.

### Time synchronisation (system clock, not app code)

The app trusts `new Date()`. Keeping the *system* clock right on the Pi is done at deploy level (commit `7d1b955`, "implement HTTPS time fallback for accurate clock synchronization"):

- `deploy/http-time-sync.sh` — if NTP is NOT synchronised (`timedatectl show -p NTPSynchronized`; venue networks often block UDP 123), it reads the HTTP `Date` header from `https://portal.masjidconnect.co.uk` (override with `MASJIDCONNECT_TIME_URL`) and steps the clock when the difference is ≥ 10 s (`MIN_STEP_SECONDS`), then persists to the Pi 5 RTC (`hwclock`) and `fake-hwclock`. If the clock is wildly wrong (year < 2024) TLS verification fails, so it retries once unverified.
- `deploy/masjidconnect-http-time.service` + `deploy/masjidconnect-http-time.timer` — systemd units that run it shortly after boot and every 15 minutes. Logs to `/tmp/http-time-sync.log`.
- `deploy/masjidconnect-rtc-sync.service` + `deploy/rtc-sync.sh` — RTC sync at boot.
- Copies live under `rpi-image/deploy-overlay/` for the prebuilt Pi image — keep both in sync when editing.

## Step-by-step workflows

### 1. Change countdown / phase behaviour safely

1. Read `src/hooks/usePrayerPhase.ts` AND `src/components/display/PrayerCountdown.tsx` first — they intentionally mirror each other's rules. `JAMAAT_LEAD_MIN` is defined in **both** files and must stay identical, or the silent-phones screen and the countdown label desynchronise.
2. Express the new rule in masjid-local minutes (`nowMinutesInTz` / `toMinutesFromMidnight`). If it involves a jamaat time, resolve it through `getEffectiveJamaat`.
3. If it involves window lengths, extend `src/utils/displaySettingsJamaat.ts` (keep the 5–30 clamp pattern) rather than hard-coding minutes.
4. Update/extend the tests FIRST: `src/hooks/usePrayerPhase.test.ts`, `src/components/display/PrayerCountdown.test.tsx`. These suites encode the accumulated edge cases (A == J, A inside the lead window, missing jamaat, Friday, after-Isha).
5. Run the full Validation block below. Manually verify with the dev keyboard: `Ctrl+Shift+J` cycles the forced prayer display through phones → adhan dua → jamaat → … → auto (`window.__PRAYER_PHASE_FORCE`, resolved via `src/dev/prayerDisplayDevOverride.ts`).

### 2. Add a prayer-adjacent display element

1. Get data from `usePrayerTimesContext()` (from `src/contexts/PrayerTimesContext.tsx`) — never call `usePrayerTimes()` directly. Get the phase from `usePrayerPhase()` and the ticking clock from `useMasjidTime()`.
2. Build the component in `src/components/display/`, export it from `src/components/display/index.ts`, and wire it into the `zoneRegistry` map in `DisplayScreenInner` (`src/components/screens/DisplayScreen.tsx`).
3. Follow the pure-presentational pattern (`InPrayerScreen.tsx` is a good template): props in, JSX out, no timers. If you must add a timer/listener, clean it up in the `useEffect` return (non-negotiable on the Pi).
4. Use terminology from settings, not hard-coded labels: `resolveTerminology` / `prayerRowNameToTerminologyKey` in `src/utils/prayerTerminology.ts` (admins can relabel prayers; Friday Zuhr uses the `jummah` key).
5. Lint + tests, then eyeball both orientations (`Ctrl+Shift+O`).

### 3. Debug wrong times / wrong highlighted prayer / clock drift

Work through this list in order:

1. **Dev overrides stuck?** In dev, `window.__NEXT_PRAYER_INDEX`, `window.__SHOW_TOMORROW_LIST`, `window.__PRAYER_PHASE_FORCE`, `window.__RAMADAN_FORCE`, `window.__FORBIDDEN_PRAYER_FORCE`, `window.__TOMORROW_JAMAAT_CHANGE_FORCE` all override reality. `usePrayerTimes` logs a one-shot warning ("Dev override active — UI is not driven by real time") when the first two are set.
2. **Timezone mismatch?** Confirm `selectMasjidTimezone` has a value (Redux devtools / logs). Any comparison done with `Date.getHours()` instead of `nowMinutesInTz` is a bug — grep the diff for it.
3. **Selection logic**: `usePrayerTimes` emits a transition-gated `[usePrayerTimes] Next-prayer selection` info log with `nowHHmm`, `A`, `J`, `nowMin`. `usePrayerPhase` emits `[PrayerPhase] Transition` debug logs. Compare those numbers by hand against the timetable.
4. **Wrong day's data?** The week array is matched by `date` in the masjid tz inside `updateFormattedPrayerTimes`; when offline past midnight, `data[0]` may be yesterday and the code rolls forward. Check the raw payload in IndexedDB (LocalForage) and Redux.
5. **System clock drift (on the Pi)**: run `timedatectl` — is `NTPSynchronized` yes? If not, check `/tmp/http-time-sync.log` and `systemctl status masjidconnect-http-time.timer`. The HTTPS fallback only steps when the difference is ≥ 10 s.
6. **Clock skipping seconds**: someone added a second 1 s timer. All time display must subscribe to `useCurrentTime` (`docs/CLOCK_FIX_SUMMARY.md` and `docs/COUNTDOWN_OPTIMIZATION.md` document the original incident; `useEffect` deps containing the countdown digits recreate the timer every tick — keep deps stable).

### 4. Work on tomorrow's-jamaat-change announcements

1. Data source: `tomorrowsJamaats` (`TomorrowsJamaatsMap`) from `usePrayerTimes` — built by `buildTomorrowsJamaats`, where Friday's Zuhr entry carries `isJumuah: true` and `jummahJamaat` as the primary time.
2. Gating/display: `src/components/display/JamaatSoonSlot.tsx` decides eligibility and alternates slides; `src/components/display/TomorrowsJamaatChangeSlide.tsx` renders the announcement.
3. Roll-forward vs column display of tomorrow's times in the panel is controlled by `displaySettings.tomorrowJamaatMode` (`'off' | 'column' | 'roll-forward'`) via `src/utils/tomorrowJamaatDisplay.ts` (`resolveTomorrowJamaatMode`, `resolvePrayerJamaatDisplay`).
4. Test manually with `Ctrl+Alt+Shift+M` (or `window.__devCycleTomorrowChange()` in the console) — cycles a fake change through Zuhr → Asr → Isha → off (`TOMORROW_JAMAAT_CHANGE_CYCLE` in `src/hooks/useDevKeyboard.ts`, driving `window.__TOMORROW_JAMAAT_CHANGE_FORCE`).
5. Tests: `src/components/display/TomorrowsJamaatChangeSlide.test.tsx`, `src/components/display/JamaatSoonSlot.test.ts`, `src/utils/tomorrowJamaatDisplay.test.ts`.

## Gotchas & failure modes

- **Symptom: everything re-renders twice / duplicate refresh requests.** Cause: a component called `usePrayerTimes()` directly. Fix: use `usePrayerTimesContext()`.
- **Symptom: correct on a dev laptop, wrong on the mosque Pi.** Cause: device-local time arithmetic (the Pi runs UTC). Fix: `nowMinutesInTz` + `toMinutesFromMidnight` with `selectMasjidTimezone || defaultMasjidTimezone`.
- **Symptom: Friday countdown targets the wrong time / buzzer silent on Friday.** Cause: a consumer read `prayer.jamaat` without `getEffectiveJamaat`. Fix: route every live jamaat read through `src/utils/jumuahJamaat.ts`.
- **Symptom: countdown frozen at "0s" in the evening.** Cause: after Isha, `nextPrayer` becomes tomorrow's Fajr but its `time` is a bare `HH:mm` that reads as "in the past" today. `PrayerCountdown` handles this via its tomorrow fallback; new countdown consumers must pass `true` as the second argument to `getTimeUntilNextPrayer`.
- **Symptom: screen flashes back to the carousel mid-jamaat.** Cause: phase computed only from `nextPrayer`, which advances at jamaat. `usePrayerPhase` deliberately checks `currentPrayer` first (`resolveInPrayer`) — keep that ordering.
- **Symptom: silent-phones screen shows but countdown label doesn't flip (or vice versa).** Cause: the duplicated `JAMAAT_LEAD_MIN` constants (in `usePrayerPhase.ts` and `PrayerCountdown.tsx`) diverged. Fix: change both together.
- **Symptom: prayer list shows yesterday's times just after midnight when offline.** Cause: `data[0]` is yesterday. The date-matching/roll-forward branch in `updateFormattedPrayerTimes` handles it — never index `data[0]` directly in new code.
- **Symptom: buzzer replays after a refresh, or fires minutes late after a reboot.** The per-day dedupe map (`mc.buzzer.lastFired`) and the 5 s `SAFETY_WINDOW_SEC` in `useJamaatBuzzer.ts` exist precisely for this; do not remove them.
- **Symptom: on-screen times stale even though Redux/IndexedDB hold fresh data.** `usePrayerTimes` throttles with `MIN_PROCESS_INTERVAL` (5 s); the data-changed effect calls `processPrayerTimes(true)` to bypass it. Preserve that bypass when refactoring.
- **Redux-persist rehydrate**: `prayerTimes` is persisted; on boot the UI renders from cache first (offline-first rule). Never assume it is fresh — the throttled refresh paths must remain in place.

## Validation

```bash
# The safety net — run these for any change in this domain:
npx vitest run src/hooks/usePrayerTimes.test.ts
npx vitest run src/hooks/usePrayerPhase.test.ts
npx vitest run src/hooks/useMasjidTime.test.ts
npx vitest run src/hooks/useCurrentTime.test.ts
npx vitest run src/components/display/PrayerCountdown.test.tsx
npx vitest run src/components/display/CountdownDisplay.test.tsx
npx vitest run src/components/display/JamaatSoonSlot.test.ts
npx vitest run src/components/display/TomorrowsJamaatChangeSlide.test.tsx
npx vitest run src/utils/dateUtils.test.ts
npx vitest run src/utils/displaySettingsJamaat.test.ts
npx vitest run src/utils/tomorrowJamaatDisplay.test.ts
npx vitest run src/utils/forbiddenPrayerTimes.test.ts

npm test          # full suite before calling it done
npm run lint      # must pass (non-negotiable)
```

Manual: `npm run dev` (port 3001) and drive the dev keyboard (`src/hooks/useDevKeyboard.ts`): `Ctrl+Shift+J` (cycle phase display), `Ctrl+Shift+P` (cycle highlighted prayer), `Ctrl+Shift+T` (simulate after-Isha tomorrow list), `Ctrl+Shift+R` (Ramadan), `Ctrl+Shift+F` (forbidden notice), `Ctrl+Alt+Shift+M` (tomorrow-change slide), `Ctrl+Shift+B` (jamaat blackout). Watch the `[usePrayerTimes]` / `[PrayerPhase]` logs while doing so.

## Related

- Skills: `add-display-content` (carousel slide types), `styling-and-layouts` (theme, orientation, Pi rendering)
- Docs: `docs/CLOCK_FIX_SUMMARY.md`, `docs/COUNTDOWN_OPTIMIZATION.md`
- Rules: `.cursor/rules/performance-raspberry-pi.mdc`, `.cursor/rules/redux-state-management.mdc`

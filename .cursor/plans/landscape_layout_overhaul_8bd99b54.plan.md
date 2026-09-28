---
name: Landscape Layout Overhaul
overview: "Overhaul the landscape display layout from a 50/50 two-column split to a \"Broadcast\" three-zone stack: persistent countdown bar at top, full-width content carousel in the middle, and a horizontal prayer strip with integrated clock/date at the bottom."
todos:
  - id: create-prayer-strip
    content: Create src/components/display/PrayerStrip.tsx — horizontal prayer strip with clock/date cell + 6 prayer cards, Jumuah/Ramadan/Imsak/Tomorrow support
    status: completed
  - id: update-landscape-layout
    content: Update LandscapeLayout.tsx — change from 2-column to 3-row stack, rename props to countdownBar/content/prayerStrip/footer
    status: completed
  - id: update-display-screen
    content: Update DisplayScreen.tsx — compose new landscape slots (countdownBar, prayerStrip) while keeping portrait branch unchanged
    status: completed
  - id: update-barrel-export
    content: Add PrayerStrip export to src/components/display/index.ts
    status: completed
  - id: update-css-overrides
    content: Update landscape typography overrides in src/index.css — relax countdown/prayer sizing for full-width layout
    status: completed
  - id: lint-and-verify
    content: Run npm run lint and npm run build to verify no regressions
    status: completed
isProject: false
---

# Landscape Layout Overhaul

## Design Summary

Replace the current 50/50 column split with a three-zone horizontal stack:

```
┌─────────────────────────────────────────────────┐
│  Countdown Bar (~8%)                            │
├─────────────────────────────────────────────────┤
│  Full-width Content Carousel (~65%)             │
├──────┬──────┬──────┬──────┬──────┬──────┬──────┤
│Clock │ FAJR │SHURUQ│ DHUHR│  ASR │MAGH  │ ISHA │
│Date  │      │      │      │      │      │      │  Prayer Strip (~24%)
│Hijri │      │      │      │      │      │      │
├─────────────────────────────────────────────────┤
│  Footer (~3%)                                   │
└─────────────────────────────────────────────────┘
```

## Files to Create

### 1. `src/components/display/PrayerStrip.tsx` (new)

The main new component. A full-width horizontal bar replacing both `Header` and `PrayerTimesPanel` in landscape mode.

**Structure:**

- Left cell (~15% width): Clock (text-heading, gold, tabular-nums), AM/PM, day name, Gregorian date, Hijri date — pulled from `useCurrentTime` and `calculateApproximateHijriDate`
- Vertical separator: `w-px bg-white/10`
- 6 prayer cards (~85% width, evenly distributed via flex): each card is a rounded surface rect showing prayer name (text-caption, uppercase), start time (text-subheading, bold), jamaat time (text-caption, gold)
- Next prayer card: `bg-emerald/15 border-emerald/30` highlight with a top-edge emerald accent
- Shuruq: start time only, optional `Sunrise` icon from lucide-react
- Ramadan: Imsak annotation on Fajr card, "Iftar" sublabel on Maghrib card
- Jumuah: Dhuhr card becomes "JUMUAH" with Khutbah/Jamaat times (data from `usePrayerTimesContext`)
- Tomorrow's Jamaat: third line per card when `showTomorrowJamaat` is enabled

**Props:** Same shape as `PrayerTimesPanel` plus `timeFormat`, `hijriDateAdjustment` (from Header's domain). Uses `usePrayerTimesContext` and `useCurrentTime` internally.

**Key code to reuse:**

- Time formatting: `getTimeDisplayParts` from `src/utils/dateUtils.ts`
- Hijri date: `calculateApproximateHijriDate` from `src/utils/dateUtils.ts`
- Prayer data: `usePrayerTimesContext` (same as PrayerTimesPanel)
- Jumuah data: `isJumuahToday`, `jumuahDisplayTime`, `jumuahKhutbahTime` from context
- `TimeWithPeriod` sub-component pattern from PrayerTimesPanel (reuse or extract)

## Files to Modify

### 2. [src/components/layout/LandscapeLayout.tsx](src/components/layout/LandscapeLayout.tsx)

Change from 2-column to 3-row stack:

- **Props**: `{ header, content, sidebar, footer, background }` becomes `{ countdownBar, content, prayerStrip, footer, background }`
- **Layout**: `flex flex-col` with:
  - `countdownBar` slot: shrink-0, styled container with surface background + bottom gold accent
  - `content` slot: flex-1 (takes remaining space)
  - `prayerStrip` slot: shrink-0, ~24% height
  - `footer` slot: shrink-0
- Keep `data-orientation="landscape"`, background layer, and overlay

### 3. [src/components/screens/DisplayScreen.tsx](src/components/screens/DisplayScreen.tsx)

Update the landscape branch (lines 460-475) to compose the new slots:

- `countdownBar`: `<PrayerCountdown phase={prayerPhase} />` (with `compact={false}` since it now has full width)
- `content`: `contentSlot` (unchanged — carousel / SilentPhonesGraphic / InPrayerScreen)
- `prayerStrip`: `<PrayerStrip ...props />` (new component with all prayer/time/Ramadan/Jumuah props)
- `footer`: `<Footer />` (unchanged)
- Remove `sidebar` composition (prayerPanel + JumuahBar + countdown combined into prayerStrip)
- Portrait branch: **no changes** — keeps Header, PrayerTimesPanel, JumuahBar, PrayerCountdown as today

### 4. [src/components/display/index.ts](src/components/display/index.ts)

Add: `export { default as PrayerStrip } from './PrayerStrip';`

### 5. [src/index.css](src/index.css) (lines 556-576)

Update landscape typography overrides:

- The `[data-orientation="landscape"] .text-countdown` override was tuned for the narrow sidebar — it can now use the full portrait sizes since the countdown bar is full-width
- The `[data-orientation="landscape"] .text-prayer` override can be relaxed slightly since prayer cards have more horizontal space per card than the old vertical list
- May need a new `.text-prayer-card` class specifically for the horizontal card layout
- Add any PrayerStrip-specific utility classes if needed (e.g. `.prayer-strip-card`)

## Files Unchanged

- `PortraitLayout.tsx` — no changes
- `PrayerTimesPanel.tsx` — still used in portrait
- `Header.tsx` — still used in portrait
- `ContentCarousel.tsx` — no structural changes (benefits from full width automatically)
- `PrayerCountdown.tsx` — works as-is with `compact={false}` for full-width bar
- `CountdownDisplay.tsx` — unchanged
- `Footer.tsx` — unchanged (already compact enough)

## Key Implementation Notes

- **No breaking changes to portrait**: All portrait-mode rendering stays exactly the same. The overhaul is landscape-only.
- **LandscapeLayout prop rename**: Since `LandscapeLayout` is only imported in `DisplayScreen.tsx`, the prop rename is safe — one call site.
- **PrayerStrip data**: All data is already available via `PrayerTimesContext` and existing hooks. No new API calls, Redux state, or services needed.
- **Performance**: `PrayerStrip` should be wrapped in `React.memo` with a custom comparator. Each prayer card is static within a minute — only the clock and countdown tick every second.
- **Ramadan theme**: The green-and-gold palette variant applies via CSS custom properties — PrayerStrip inherits this automatically.


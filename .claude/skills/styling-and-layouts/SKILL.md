---
name: styling-and-layouts
description: Styling system and layout architecture for the display — Tailwind v4 @theme tokens in src/index.css (no tailwind.config.js), Ramadan/custom themes, resolution-independent rem scaling, orientation/rotation handling, Arabic fonts, and Raspberry Pi rendering constraints. Use when adding/changing a design token or colour, styling any component, making a layout work in landscape and portrait, handling 4K vs 1080p scaling, adding animation, working with Arabic text, or fixing jank/blur/performance on the Pi.
---

# Styling & Layouts

## When to use this skill

- Adding or changing a design token, colour, font or animation duration
- Styling a new component correctly (classes, typography, icons)
- Making a component/layout work in both landscape and portrait
- Anything about rotation (90°/180°/270° screens), 4K vs 1080p scaling, blurry rendering
- Arabic text rendering (Amiri, RTL, ﷺ glyph)
- Fixing Pi rendering problems: jank, slow paints, pop-in, GPU overload
- Do NOT use for slide content logic → see `add-display-content`; prayer screens → `prayer-times-domain`

## Mental model

### Tailwind v4 — tokens live in CSS, not a config file

There is **no `tailwind.config.js`** and there must never be one. Tailwind v4 runs as a Vite plugin (`@tailwindcss/vite`); all design tokens are declared in the `@theme` block at the top of `src/index.css`:

- Colours: `--color-midnight(/-light/-dark)`, `--color-emerald(...)`, `--color-gold(...)`, `--color-surface(...)`, `--color-border(...)`, `--color-text-primary/secondary/muted`, `--color-alert-red/orange/green`, `--color-dua(...)`, `--color-tomorrow-roll`. Each becomes utilities automatically: `bg-midnight`, `text-gold`, `border-border`, `text-text-secondary`, `from-gold to-gold-light`, etc.
- Fonts: `--font-sans` (Poppins, with Amiri fallback so ﷺ renders), `--font-arabic` (Amiri).
- Durations: `--duration-fast/normal/slow/crossfade` (150/300/500/700 ms) → `duration-normal` utilities and the keyframe classes.
- `--layout-overlay` — the theme-aware tint used by `.layout-overlay` in the layout shells.

### Theming — two override layers on the same tokens

1. **Ramadan theme**: `[data-theme="ramadan"]` in `src/index.css` re-declares the tokens (forest green + gold). The attribute is set on `<html>` by `useRamadanMode` (`src/hooks/useRamadanMode.ts`), so every token-based utility flips automatically. If you hard-code a hex anywhere, it will NOT flip — the file has explicit `[data-theme="ramadan"] .card-elevated` / `.panel` overrides precisely because those classes use hard-coded rgba backgrounds.
2. **Per-mosque theme overrides**: the portal can send `DisplayThemeOverrides` (see `src/types/displayLayout.ts` and examples in `src/showcase/scenarios.ts`); `buildThemeStyle` in `src/utils/displayTheme.ts` converts them to inline CSS-variable overrides applied by `LayoutRenderer` via its `themeStyle` prop. New colour usage should go through tokens so both layers keep working.

### Resolution independence — rem everywhere

Two mechanisms (read `.cursor/rules/tailwind-v4-styling.mdc` for the full rules):

- Root scaling: `html { font-size: clamp(10px, calc(16px * (100vmin / 720)), 48px); }` in `src/index.css`. Design reference is **1280×720**; 1rem grows with the viewport, so all rem-based layout/typography scales together at 720p/1080p/4K.
- `ReferenceViewport` (`src/components/layout/ReferenceViewport.tsx`): `DisplayScreen` renders the whole layout inside a fixed 720p stage (1280×720 or 720×1280) scaled to the real viewport with **CSS `zoom`** — deliberately not `transform: scale()`, which rasterises at 720p and produces blurry text on 4K.

Consequences: **never use `px` for component sizing** (use rem or Tailwind's rem-based utilities, e.g. `w-[16.25rem]` not `w-[260px]`); **never use `vw`/`vh` in typography**; no responsive breakpoints (the kiosk is a fixed screen). Typography classes (`.text-display`, `.text-heading`, `.text-subheading`, `.text-body`, `.text-caption`, `.text-carousel-*`) are rem-only `clamp()` values in `src/index.css`. 4K background: `docs/4K_OPTIMIZATION_SUMMARY.md`.

### Orientation & rotation

- Admin configures one of four orientations; `src/utils/orientation.ts` maps them (`ORIENTATION_TO_DEGREES`: LANDSCAPE 0, LANDSCAPE_INVERTED 180, PORTRAIT 90, PORTRAIT_INVERTED 270) with `parseScreenOrientation`, `orientationToLayoutMode`, `isPortraitLayout`, `parseRotationDegrees`.
- `DisplayScreen` resolves orientation from `s.ui.orientation` / `s.ui.rotationDegrees` (WebSocket-updatable), falling back to `screenContent.screen.orientation`, and renders:
  `OrientationWrapper` (applies the rotation transform, swaps width/height for 90/270, hosts `#orientation-portal-root`) → `ReferenceViewport` → `LayoutRenderer`.
- `LayoutRenderer` + `ZoneStackLayout` (`src/components/layout/`) render the **zone-based layout** configured from the portal (`selectDisplayLayoutConfig` in `src/store/slices/contentSlice.ts`, types in `src/types/displayLayout.ts`): stack / sidebar / split-top structures with a `zoneRegistry` of components built in `DisplayScreenInner`.
- `LandscapeLayout.tsx` / `PortraitLayout.tsx` are the simpler slot-based shells (content + prayer strip + footer / header + prayer section + content + footer); they document the canonical stacking (background layer → `.layout-overlay` tint → z-10 content) and remain in use by tests — copy their structure for new shells.
- `useRotationHandling` (`src/hooks/useRotationHandling.ts`) compares physical window orientation to the desired one (`shouldRotate`), with a debounced resize listener.
- **Portals**: anything fullscreen (media takeover, `JamaatBlackoutOverlay`) portals into `#orientation-portal-root` inside `OrientationWrapper`. Because the rotated wrapper has a CSS `transform`, it becomes the containing block for `position: fixed` children — a fixed overlay portalled there covers the *logical* (post-rotation) viewport. A fixed overlay mounted anywhere else is wrong on rotated screens.

### Fonts (offline rule: self-hosted only)

- Poppins: `@font-face` in `src/index.css` pointing at `/fonts/poppins-*.woff2` (served from `public/fonts/`); source woff2 files also in `src/assets/fonts/`.
- Amiri (Arabic): `@import "@fontsource/amiri/arabic-400.css"` + `arabic-700.css` at the top of `src/index.css` — the Arabic subset includes U+FDFA (ﷺ). Arabic files live in `src/assets/fonts/arabic/`.
- `.arabic-text` class = Amiri + `direction: rtl` + `text-align: right` + line-height 1.8. **It forces right alignment** — for centred Arabic (supplication screens), don't use it; see the comment in `src/index.css` near the supplication styles.
- Never add a CDN font (breaks offline, adds latency).

### Raspberry Pi rendering constraints (`.cursor/rules/performance-raspberry-pi.mdc` — applies to every change)

- Animate **transform/opacity only**; use the provided keyframe classes (`.animate-fade-in/out`, `.animate-slide-in-right`, `.animate-scale-in`, `.animate-subtle-pulse`, `.animate-carousel-enter-from-right`).
- Add `.gpu-accelerated` (translateZ(0) + will-change + backface-visibility) to animated elements.
- **No `backdrop-filter`** (kills the Pi GPU — `.card`/`.panel` use semi-transparent rgba backgrounds instead); minimal `box-shadow`.
- Prefer CSS transitions over JS animation loops; `prefers-reduced-motion` is honoured globally in `src/index.css`.
- `cursor: none !important` is global — display-only UI, no hover/click affordances, readable from 10–15 ft (see `.cursor/rules/design-context.mdc`: calm, dark-mode-only, midnight/gold/emerald, no clutter).
- Icons: `lucide-react` only.

## Step-by-step workflows

### 1. Add or change a design token

1. Edit the `@theme` block in `src/index.css` (e.g. add `--color-foo: #123456;`). The utility (`bg-foo`, `text-foo`, …) exists immediately — no config, no restart beyond Vite HMR.
2. Check the `[data-theme="ramadan"]` block: does the new token need a Ramadan value? If it derives from midnight/emerald/gold, add an override there.
3. If mosques should be able to customise it, wire it through `DisplayThemeOverrides` → `buildThemeStyle` (`src/utils/displayTheme.ts`) and add it to a showcase scenario theme in `src/showcase/scenarios.ts` to eyeball it.
4. Verify in dev: `npm run dev`, toggle Ramadan with `Ctrl+Shift+R`, confirm both palettes.

### 2. Style a new component correctly

1. Utility-first Tailwind classes on elements; conditional classes via template literals. No MUI/Chakra/CSS-in-JS, no `style={}` except genuinely dynamic values (rotation transforms, measured sizes).
2. Reuse component classes from `src/index.css` before inventing: `.card`, `.card-elevated`, `.panel`, badges, `.text-heading` / `.text-subheading` / `.text-caption` / `.text-display`, `.countdown-stable`.
3. Sizing in rem only; colours via tokens only; icons via `lucide-react`.
4. Arabic text: `.arabic-text` for right-aligned flows, or `font-arabic` + explicit alignment for centred compositions.
5. Animation: pick an existing `.animate-*` class + `.gpu-accelerated`. New keyframes go in `src/index.css` and must animate transform/opacity only.
6. `npm run lint` before done.

### 3. Make a layout/component work in both orientations

1. Follow the `compact` prop convention: portrait passes `compact` down (e.g. `ContentCarousel`, `EventSlide`, `CourseSlide` all take `compact?: boolean` meaning "stacked, centred composition"). Landscape default is usually a two-column row.
2. Inside the layout tree, size with `w-full h-full` / flex — never `100vw/100vh` — because `OrientationWrapper` swaps dimensions when rotated and `ReferenceViewport` fixes the stage size.
3. Fullscreen overlays must `createPortal` into `document.getElementById('orientation-portal-root')` (fallback `document.body` for JSDOM) — copy `JamaatBlackoutOverlay.tsx` or the `fullscreenMediaPortal` in `ContentCarousel.tsx`.
4. Test both ways with the dev keyboard: `Ctrl+Shift+O` cycles landscape → portrait → auto (`ORIENTATION_FORCE_EVENT` in `src/hooks/useDevKeyboard.ts`). Also try a portrait-sized browser window to exercise `useRotationHandling`.

### 4. Avoid Pi performance traps (checklist for any visual change)

- [ ] Animates transform/opacity only, `.gpu-accelerated` applied
- [ ] No `backdrop-filter`, no heavy `box-shadow`
- [ ] No new 1 s timers for visuals (subscribe to `useCurrentTime` — see `prayer-times-domain`)
- [ ] All sizes rem, no `px`, no viewport units in typography
- [ ] No CDN assets (fonts, images, scripts)
- [ ] Every listener/timer cleaned up in the `useEffect` return
- [ ] `React.memo` / `useMemo` / `useCallback` where render cost or prop identity matters

## Gotchas & failure modes

- **Someone "restores" `tailwind.config.js`** → Tailwind v4 ignores your intent and the build drifts. All config is `@theme` in `src/index.css`. Delete any config file on sight.
- **`docs/masjidconnect-design.md` says "favor MUI"** → that is the *platform-wide* design doc (portal/admin). It does NOT apply to this repo: the display app is Tailwind-utilities-only (CLAUDE.md rule 5). Use it only for brand palette/personality context, alongside `.cursor/rules/design-context.mdc`.
- **Blurry text on 4K** → someone scaled with `transform: scale()`. `ReferenceViewport` uses CSS `zoom` for exactly this reason (browser re-rasterises at native density). Don't replace it.
- **Fixed overlay appears rotated/misplaced on portrait screens** → it was rendered outside `#orientation-portal-root`. The rotated wrapper's transform creates a new containing block for `position: fixed`.
- **Centred Arabic renders right-aligned** → `.arabic-text` forces `text-align: right`/RTL. Use `font-arabic` with your own alignment for centred layouts (this exact trap is commented in `src/index.css`).
- **New colour doesn't change in Ramadan** → hard-coded hex/rgba instead of a token. Either use a token or add an explicit `[data-theme="ramadan"]` override like `.card-elevated` has.
- **Countdown/clock digits make the row jump** → wrap in `.countdown-stable` (tabular-nums + reserved width); see how `CountdownDisplay.tsx` uses it and the `.prayer-countdown-row` narrowing rules.
- **Text overflows at large scales** → long unbreakable tokens (URLs, emails) need `overflow-wrap: anywhere` — the `.text-carousel-*` classes already include it; copy that for new text containers fed by admin content.
- **Layout looks right locally, cramped on device** → you tested only landscape, or ignored the zone-based config: the portal can reorder/hide zones (`selectDisplayLayoutConfig`). Test with the showcase scenarios (`http://localhost:3001/showcase.html?s=<id>`, ids in `src/showcase/scenarios.ts`) which cover stack/sidebar/split-top and both orientations.
- **Animations fire before content is ready (pop-in on Pi)** → hold at `opacity-0` until ready, then apply the enter class — the carousel's `isFitted`/`mediaSlideAssetReady` pattern is the reference.

## Validation

```bash
npm run lint     # must pass
npm run build    # tsc -b + vite build

# Layout/orientation test suites:
npx vitest run src/components/layout/OrientationWrapper.test.tsx
npx vitest run src/components/layout/LandscapeLayout.test.tsx
npx vitest run src/components/layout/PortraitLayout.test.tsx
npx vitest run src/hooks/useRotationHandling.test.ts
npx vitest run src/utils/orientation.test.ts
npx vitest run src/components/display/contentScaling.test.ts
```

Manual: `npm run dev` → check at a 1280×720 window, then resize to simulate 1080p/4K proportions (everything should scale, nothing reflow); `Ctrl+Shift+O` for portrait; `Ctrl+Shift+R` for the Ramadan palette; DevTools → Rendering → "Paint flashing" to spot repaint storms before they hit the Pi.

## Related

- Skills: `add-display-content` (slide components), `prayer-times-domain` (phase screens, Ramadan detection), `debugging-runtime-issues` (blank screen / perf on device)
- Rules: `.cursor/rules/tailwind-v4-styling.mdc`, `.cursor/rules/performance-raspberry-pi.mdc`, `.cursor/rules/design-context.mdc`, `.cursor/rules/component-patterns.mdc`
- Docs: `docs/4K_OPTIMIZATION_SUMMARY.md`, `docs/RASPBERRY-PI-PERFORMANCE.md`, `docs/masjidconnect-design.md` (brand context only — its MUI note does not apply here)

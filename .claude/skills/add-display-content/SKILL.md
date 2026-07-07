---
name: add-display-content
description: End-to-end workflow for adding a new content/slide type to the display's ContentCarousel — from backend payload through API models, Redux, the schedule-item mapper, the slide component and content scaling. Use when adding a new slide/content type, changing how an existing slide (event, donation, course, video, media/PDF, dua, asma al-husna) renders or rotates, changing slide duration/fullscreen behaviour, or previewing slides via the showcase or dev keyboard.
---

# Add a Display Content Type

## When to use this skill

- Adding a brand-new slide type to the carousel (e.g. a "fundraising totals" slide)
- Changing an existing slide component (`EventSlide`, `DonationSlide`, `CourseSlide`, `VideoSlide`, `MediaPdfPage`) or its mapping
- Changing rotation, per-slide duration, fullscreen takeover, or crossfade behaviour
- Debugging "my content type doesn't show" / "slide renders blank"
- Do NOT use for prayer-phase screens (silent phones, in-prayer, supplications) → see `prayer-times-domain`
- Do NOT use for pure styling questions → see `styling-and-layouts`

## Mental model — the pipeline

```
Backend (playlist item, type string + content blob)
  → contentSlice thunks (refreshContent / refreshSchedule in src/store/slices/contentSlice.ts)
  → Redux: schedule / scheduledPlaylists / screenContent (persisted)
  → useScheduledPlaylist (src/hooks/useScheduledPlaylist.ts) — picks the ACTIVE playlist
      (DEFAULT / RECURRING / DATE_RANGE / PRAYER_WINDOW assignments, boundary timers)
  → buildCarouselItems + scheduleItemToCarouselItems (src/components/screens/DisplayScreen.tsx)
      — maps each schedule item to one or more CarouselItem objects
  → ContentCarousel (src/components/display/ContentCarousel.tsx)
      — rotation, crossfade, per-type render branches, adaptive typography fit loop
  → slide component (src/components/display/*Slide.tsx) or the generic text layout
```

Key facts:

- **Type strings**: the mapper matches `type.toUpperCase()` (`'MEDIA_SLIDE'`, `'VIDEO'`, `'DONATION'`, `'COURSE'`, `'DUA'`, `'ASMA_AL_HUSNA'`); the carousel matches `type?.toLowerCase()`. `ContentItemType` in `src/api/models.ts` only lists the core CMS types (`VERSE_HADITH | ANNOUNCEMENT | EVENT | CUSTOM | ASMA_AL_HUSNA | DUA`) — newer types (DONATION, COURSE, MEDIA_SLIDE, VIDEO) are handled as plain strings in the mapper. Follow whichever pattern the neighbouring code uses.
- **`CarouselItem`** (exported from `src/components/display/ContentCarousel.tsx`) is the display-side contract. Each slide family adds optional fields (e.g. `course?: CourseSlideData`, `donationUrl`, `mediaUrl`/`mediaKind`, `videoUrl`, `event?: EventV2`).
- **The backend resolves everything resolvable** (QR URLs, live campaign amounts, course availability) at serve time — the display only presents what it is given. `DONATION` and `COURSE` are the reference examples of this contract.
- **Rotation**: `ContentCarousel` advances on a per-item timer — `item.duration` seconds (clamped 5–300) or the `interval` prop (screen config `carouselInterval`, default 30). VIDEO slides instead advance on the clip's `ended` event with a `VIDEO_SAFETY_CAP_SECONDS` (300 s) guard.
- **Typography**: generic text slides go through the adaptive fit loop — `getScalingForItem` / `computeFontSizes` in `src/components/display/contentScaling.ts` classify density (tiers 1–4) and the carousel binary-searches a multiplier, applying sizes via CSS custom properties (`--carousel-title-size`, `--carousel-body-size`, `--carousel-arabic-size`) read by `.text-carousel-title` etc. in `src/index.css`. Card-style slides (event/donation/course/media/video) **skip** the fit loop.
- **Fullscreen**: non-media slides may carry `displayMode: 'fullscreen'` (mapped by `resolveDisplayMode` from `content.displayMode`); media/video use `mediaFit` (`smart`/`cover` ⇒ fullscreen). Fullscreen content is portalled into `#orientation-portal-root` (rendered by `OrientationWrapper`) so it covers the logical, rotation-aware viewport.
- **Recent reference commits** (read with `git show`): `4c810b9` (COURSE slide, end-to-end), `0d02db7` (displayMode fullscreen/inline), `869b5e2` (media handling), `fc86d26` (vehicle alert).

## Step-by-step workflow: add a new slide type `NEW_TYPE`

### 0. Confirm the backend contract

The backend monorepo is at `../MasjidConnect-Backend`. Find where playlist content items are resolved for the display API and confirm the exact `type` string and `content` blob shape. Cross-repo rule: displays update slowly — the backend must ship first and stay backwards-compatible (see the `masjidconnect-ecosystem` skill).

### 1. Extend `CarouselItem`

In `src/components/display/ContentCarousel.tsx`, add your fields to the `CarouselItem` interface, following the COURSE pattern: define a dedicated data interface (like `CourseSlideData`) and hang it off one optional key. Document nullability in comments — e.g. `enrollmentUrl: string | null` means "no QR shown".

### 2. Add a mapping branch in the schedule-item mapper

In `src/components/screens/DisplayScreen.tsx`, add a branch to `scheduleItemToCarouselItems` (it is exported for unit tests). Copy the COURSE branch as the template:

```ts
// --- NEW_TYPE: <what it shows> (resolved content from API) ---
const isNewType = typeof type === 'string' && type.toUpperCase() === 'NEW_TYPE';
if (isNewType) {
  const c = typeof content === 'object' && content !== null ? content : {};
  const optStr = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
  // ...defensively parse every field; never trust the payload shape...
  return [{
    id: item.id ?? `sched-${index}`,
    type: 'NEW_TYPE',
    title,
    duration: resolveItemDuration(item, c),
    displayMode: resolveDisplayMode(c as Record<string, unknown>),
    // your parsed fields
  }];
}
```

Rules baked into the existing branches — keep them:
- **Return `[]` for invalid payloads** (MEDIA_SLIDE/VIDEO do this for bad URLs/mime types) so a broken item is dropped, never rendered blank.
- Read from both `item.content` and `item.contentItem?.content` shapes (`const content = item.content ?? item.contentItem?.content ?? {}`).
- Use `resolveItemDuration` (handles seconds vs milliseconds) and `resolveDisplayMode`.
- Defensive `typeof` checks on every field; sensible defaults (see how COURSE defaults `available` to true).

### 3. Create the slide component

Create `src/components/display/NewTypeSlide.tsx`. `CourseSlide.tsx` is the best copy-adaptable template — trimmed skeleton of the real file:

```tsx
/**
 * NewTypeSlide — renders a NEW_TYPE playlist slide.
 * The backend resolves live data at serve time; this component only
 * presents what it is given (mirrors DonationSlide's contract).
 */
import React from 'react';
import type { NewTypeSlideData } from './ContentCarousel';

export interface NewTypeSlideProps {
  data: NewTypeSlideData;
  /** Portrait layout — stacked composition. */
  compact?: boolean;
}

const NewTypeSlide: React.FC<NewTypeSlideProps> = ({ data, compact = false }) => {
  // Landscape: two-column; portrait (compact): centred vertical stack.
  return (
    <div className={`flex h-full w-full min-h-0 ${compact ? 'flex-col items-center text-center' : 'flex-row items-center'} gap-6`}>
      <h2 className="text-heading text-gold">{data.title}</h2>
      {/* meta rows use text-subheading / text-caption; accents use bg-gradient-to-r from-gold to-gold-light */}
    </div>
  );
};

export default NewTypeSlide;
```

Conventions the real slides follow:
- `compact?: boolean` prop = portrait layout (the carousel forwards its `compact` prop).
- Design-system classes only: `text-heading`, `text-subheading`, `text-caption`, token colours (`text-gold`, `text-text-secondary`), `lucide-react` icons. No px sizing, no backdrop-filter (see `styling-and-layouts`).
- QR codes: `QRCodeSVG` from `qrcode.react` with the midnight-blue branding and centre logo — copy `BrandedQrFrame` from `CourseSlide.tsx`.
- Handle the "dead state" (e.g. enrolment closed, donations unavailable) calmly — never show a broken QR/link.
- Pure presentational where possible; any timer/listener must be cleaned up in the `useEffect` return.

### 4. Register the render branch in `ContentCarousel`

In `src/components/display/ContentCarousel.tsx`:

1. Lazy-import next to the others: `const NewTypeSlide = lazy(() => import('./NewTypeSlide'));`
2. Add a detection memo, mirroring `isCourseSlide`:
   ```ts
   const isNewTypeSlide = useMemo(
     () => currentItem?.type?.toLowerCase() === 'new_type' && !!currentItem?.newType,
     [currentItem],
   );
   ```
3. Exclude it from the typography fit loop if it is a card-style slide: return `null` for it in the `scalingResult` memo (the `isDonationSlide` / `isCourseSlide` branches show how) and skip the fit-loop effect the same way they do.
4. Add the render branch inside BOTH content layouts (there are two render sites — the landscape/default one and the scroll/stack one; grep for `isCourseSlide && item.course` to find them):
   ```tsx
   ) : isNewTypeSlide && item.newType ? (
     <Suspense fallback={null}>
       <NewTypeSlide data={item.newType} compact={compact} />
     </Suspense>
   ```

### 5. (Optional) export it

Slide components rendered only by the carousel (like `CourseSlide`, `DonationSlide`, `VideoSlide`) are lazy-imported and NOT in `src/components/display/index.ts`. Only add an export there if something outside the carousel needs it (`EventSlide` is exported because tests/other code use it).

### 6. Tests

- Mapper: extend the `scheduleItemToCarouselItems` coverage (it is exported precisely for this) — see existing specs in `src/components/display/ContentCarousel.test.tsx` and `src/components/display/VideoSlide.test.tsx` for patterns.
- Component: a small render test asserting the happy path and the dead state.

### 7. Preview it

- **Dev server**: `npm run dev` (port 3001). If your paired dev screen has the content type in its playlist, use `Ctrl+Shift+N` (dev keyboard, `src/hooks/useDevKeyboard.ts`) to skip the carousel to the next slide instantly — it dispatches `CAROUSEL_ADVANCE_EVENT`.
- **Showcase harness** (no pairing needed): `src/showcase/main.tsx` mounts the real `DisplayScreen` against a store seeded from a scenario. Add a scenario with your schedule item to `SCENARIOS` in `src/showcase/scenarios.ts`, then open `http://localhost:3001/showcase.html?s=<scenario-id>`. An unknown id prints the list of available scenario ids. (`scripts/capture-brochure.mjs` screenshots these for the brochure — `npm run brochure:capture`.)

## Gotchas & failure modes

- **Slide never appears** → the mapper returned `[]` (payload failed validation), or the active *scheduled playlist* doesn't contain the item. `useScheduledPlaylist` resolves the active assignment (`resolveActiveSchedule` in `src/utils/scheduleResolver.ts`) — check `selectScheduledPlaylists` in Redux; the Redux `schedule` is only the fallback when no playlists exist.
- **Slide renders with tiny/huge text** → it went through the fit loop when it shouldn't have (add it to the `scalingResult` exclusions), or vice versa. Generic text slides must expose their text via `title`/`body`/`arabicBody` so `classifyContentDensity` can count characters (HTML is stripped by `visibleTextLength`).
- **Slide flashes or stays invisible** → the carousel holds slides at `opacity-0` until `isFitted` (text) or `mediaSlideAssetReady` (media) flips. If your branch bypasses the fit loop you must not depend on `isFitted` — follow the `isDonationSlide` animation-class branch in `slideEnterAnimation`.
- **Media preload resets every Redux render** → `items` is a NEW array reference on every render. The carousel derives a stable `mediaPreloadKey` for exactly this reason; key any per-slide effect on stable identity (`item.id` + url), never on `items` itself.
- **Carousel jumps back to slide 0 unexpectedly** → any change to the `items` prop resets `activeIdx` (deliberate). Don't rebuild the array unnecessarily; `buildCarouselItems` is memoised on `schedule`/`events`/`screenContent`.
- **Fullscreen slide doesn't cover the screen when rotated** → it must portal into `#orientation-portal-root` (see the `fullscreenMediaPortal` code in `ContentCarousel.tsx`); a plain `fixed inset-0` is broken inside the rotated wrapper because the CSS transform creates a new containing block.
- **Works online, blank offline** → images/PDFs come from remote URLs cached by the service worker (CacheFirst for images — `.cursor/rules/performance-raspberry-pi.mdc` documents the Workbox config). Test a cold reload with DevTools offline. Redux content is persisted, so the mapper must tolerate stale payloads missing new fields (defensive parsing, defaults).
- **HTML in body** → only render via `sanitizeHtml` (`src/utils/sanitizeHtml.ts`, DOMPurify) as the existing `bodyIsHTML` path does. Never `dangerouslySetInnerHTML` raw API content.
- **Duration in ms vs s** → the API sometimes sends milliseconds; `resolveItemDuration` treats values > 300 as ms. Use it, don't reimplement.
- **No `console.log`** — use `logger` (`src/utils/logger.ts`); Terser strips console in production anyway.

## Validation

```bash
npx vitest run src/components/display/ContentCarousel.test.tsx
npx vitest run src/components/display/contentScaling.test.ts
npx vitest run src/hooks/useScheduledPlaylist.test.ts
npx vitest run src/components/display/VideoSlide.test.tsx   # if touching media/video paths

npm test        # full suite
npm run lint    # must pass before done
npm run build   # tsc -b + vite build — catches type breaks in the mapper
```

Manual: `npm run dev`, then `Ctrl+Shift+N` to cycle slides; check landscape AND portrait (`Ctrl+Shift+O`); check the fullscreen variant if `displayMode`/`mediaFit` applies; check the showcase scenario renders at `http://localhost:3001/showcase.html?s=<id>`.

## Related

- Skills: `prayer-times-domain` (phase screens that replace the carousel), `styling-and-layouts` (tokens, orientation, Pi-safe CSS), `redux-data-flow` (thunks/selectors), `api-integration` (new endpoints/models), `masjidconnect-ecosystem` (backend contract)
- Rules: `.cursor/rules/component-patterns.mdc`, `.cursor/rules/api-and-data.mdc`, `.cursor/rules/performance-raspberry-pi.mdc`
- History worth reading: `git show 4c810b9` (course slide), `git show 0d02db7` (display mode)

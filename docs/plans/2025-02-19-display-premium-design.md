# Display app premium feel — design

**Date:** 2025-02-19  
**Status:** Approved  
**Scope:** Calm, spiritual, refined and polished feel without changing layout or structure.  
**Constraints:** Raspberry Pi (no backdrop-filter, minimal box-shadow, GPU-safe motion), Tailwind-only, existing tokens.

---

## 1. Typography & hierarchy

- **Display:** Countdown / hero numbers only. Keep `.text-display`; consider slightly tighter letter-spacing. Use tabular-nums for countdown.
- **Headings:** Section titles (e.g. "Prayer Times"). Use `.text-heading` everywhere; weight 600; optional letter-spacing (0.01em–0.02em) in `index.css`.
- **Subheadings:** Card titles, secondary headings. `.text-subheading`, weight 500.
- **Body:** All body and list content. `.text-body` only; avoid ad-hoc `text-sm`/`text-base`.
- **Caption:** Dates, "Start / Jamaat", connection status. `.text-caption` only; colour `text-muted` or `text-secondary`.
- **Components:** Header (masjid = anchor, date/time from hierarchy); Prayer panel (heading + body + caption); Carousel (title = subheading/heading, body/caption); Footer (all caption). No new fonts or colours.

---

## 2. Spacing & layout

- **Scale (rem-based):**
  - **Tight:** `gap-2` / `p-2` — badges, legend.
  - **Default:** `gap-3` / `p-3` — related items, header inner.
  - **Section:** `gap-4` — between major blocks (e.g. prayer panel vs countdown).
  - **Screen edge:** `px-6` (or equivalent) for gutters; align header/main/footer.
- **Apply:** Same gutter in LandscapeLayout/PortraitLayout; header `py-3`, main `gap-4`, footer `py-2`; prayer panel padding from scale; carousel and footer gaps from scale.
- **Document:** Add a short "Spacing" subsection to design rules (e.g. tailwind-v4-styling.mdc or this doc) with tight/default/section/screen edge and one example each.

---

## 3. Depth & atmosphere

- **Background:** Keep solid `bg-midnight`. Optional: subtle radial/linear gradient overlay (midnight → midnight-dark) at low opacity in `DisplayBackground`. Corner accents: increase from 4% to **6–8% opacity**; theme-aware for Ramadan.
- **Panels/cards:** One consistent treatment for `.panel`, `.card`, countdown card — either **Option A** (stronger border, e.g. `border-border-strong`) or **Option B** (one light box-shadow, e.g. `0 4px 24px rgba(0,0,0,0.2)`). Not both. Header bar follows same convention.
- **No:** backdrop-filter, animated gradients, new colours.

---

## 4. Motion & polish

- **Motion:** Keep existing crossfade, subtle-pulse, countdown-tick. Optional: one-shot gentle fade-in (opacity 0→1, ~400–500ms) on main content mount. GPU-safe only (transform/opacity). No new loops, parallax, or background motion.
- **Polish:** Document radius convention — e.g. panels 1.25rem, cards 1rem, pills full. Single accent colour (gold) for lines; confirm header/footer/main share same horizontal padding.
- **Document:** "Motion: GPU-safe only; optional one-shot content fade-in. Polish: radius scale + single accent for lines."

---

## Implementation order

1. Spacing scale and layout application (Section 2).  
2. Typography pass in CSS and components (Section 1).  
3. Depth: background + panel treatment (Section 3).  
4. Motion/polish: optional fade-in + documentation (Section 4).

Next step: implementation plan (writing-plans).

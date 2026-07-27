# Changelog — Display App

## Unreleased — Display feedback backlog (July 2026)

Branch: `feature/display-feedback-backlog`

Mosque tester feedback across prayer phases, media fit, Jumu’ah, and display settings.

---

### Fixed

- **Smart fit no longer goes fullscreen** — Smart media stays inside the content zone (blur + contain). Only **Cover** (and legacy fullscreen) fills the whole screen, so prayer times and footer stay visible.
- **Custom prayer terminology on in-prayer / silent-phones** — Labels such as “Dhuhr” now apply on the in-prayer screen and silent-phones badge, not only on the prayer strip.
- **Silent-phones badge copy** — Badge uses the prayer name, e.g. “Maghrib Jamaat is about to begin”.
- **Zone heights** — Prayer strip clamping, Jumu’ah bar growth, and content Auto sizing improved so dual lines and jumuah bars do not blow out the layout.
- **Post-salah countdown** — In-prayer window ends when progress (+ optional dua) ends, so the next-prayer countdown resets correctly instead of lingering.
- **Adhan countdown wording** — Uses “{Prayer} {Adhan} in …” via mosque terminology.

### Added

- **Dual Jumu’ah sessions** — Consumes `jumuahSessions[]` from the API. `JumuahBar` shows 1st / 2nd sessions. Countdown and in-prayer target the next upcoming session.
- **12-hour time without AM/PM** — New `12h-nop` format (e.g. `5:30`).
- **During Jama’at: custom library content** — Mode `content` + `jamaatInProgressContentId` shows a chosen carousel item during jamaat (falls back to the built-in in-progress screen if missing).
- **Pre-jamaat countdown** — Optional full-slot countdown in the seconds before jamaat (`preJamaatCountdownEnabled` / `preJamaatCountdownSeconds`). New `PreJamaatCountdownSlot` component and phase `pre-jamaat-countdown`.
- **Hide carousel chrome** — `showCarouselChrome` hides pagination dots when off.
- **Richer text slide options** — Optional `textDir` (ltr/rtl) and `textColor` tokens on carousel text items.
- **Jumu’ah duration override** — Friday uses the `jumuah` per-salah duration (not Zuhr) when set.

### Changed

- **Footer branding** — “Powered by MasjidConnect” uses caption-sized type.
- **Display settings normalisation** — Parses and defaults the new admin fields safely for offline/older caches.
- **Dev keyboard cycle** — Includes pre-jamaat countdown for local testing.

### Notes

- Phase 3 items (Adhan text screen, live streaming, freeform drag-drop layout designer) remain backlog only — not implemented in this release.
- Lint: clean (0 errors). Tests: 556 passing at time of verification.

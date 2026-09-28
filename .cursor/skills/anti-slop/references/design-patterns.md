# Design Slop Patterns

Visual and UX patterns that signal generic AI-generated interfaces.

## High-Confidence Visual Slop

### Colour and gradient

| Pattern | Why it's slop | Alternative |
|---------|---------------|-------------|
| Purple-to-pink-to-cyan gradient | Overused AI default | Brand palette; single accent colour |
| Rainbow gradients on dark bg | No hierarchy | One gradient direction; purpose-driven |
| Neon glow on everything | Visual noise | Glow only on primary CTA or focus state |
| `#6366f1` / indigo-500 everywhere | Tailwind AI default | Project design tokens |
| Random opacity layers | No system | Semantic tokens: surface, elevated, overlay |

### Effects without purpose

| Pattern | Fix |
|---------|-----|
| Glassmorphism on every card | Solid surfaces; glass only for overlays |
| Neumorphism | Flat or subtle elevation per design system |
| Floating 3D blobs/spheres | Remove or replace with content-relevant imagery |
| Parallax on scroll | Static layout unless motion serves UX |
| `backdrop-filter: blur` on RPi/low-GPU | Solid rgba backgrounds (performance) |

### Typography slop

- Inter + purple gradient hero (AI landing page default)
- Three font families on one screen
- All headings same weight and size tier
- Centre-aligned body paragraphs
- Lorem ipsum or "Your content here" left in place

### Layout slop

| Pattern | Fix |
|---------|-----|
| Everything in identical cards | Vary containers: lists, tables, inline |
| 3-column feature grid (always 3) | Columns match actual feature count |
| Hero + 3 features + CTA (template) | Structure follows content priority |
| Excessive padding with no hierarchy | Tighten; use spacing scale consistently |
| Sidebar + top nav + breadcrumbs + tabs | Remove redundant chrome |
| Mobile layout = shrunk desktop | Reflow, stack, touch targets |

### Component slop

- shadcn defaults with zero customisation
- MUI default theme unmodified
- Every button `variant="contained"`
- Icons from mixed libraries on one screen
- Stock illustration style (undraw, storyset) without brand fit

## Copy and Content Slop

| Slop headline | Better approach |
|---------------|-----------------|
| "Empower your team" | State what the product does |
| "Revolutionise your workflow" | Name the workflow and improvement |
| "Seamless experience" | Describe the specific experience |
| "Get Started" (alone) | "Create your first screen" |
| "Learn More" | "See pricing" / "View prayer times setup" |
| "Solutions for modern businesses" | Audience-specific value prop |

**CTA rules:**
- Verb + object + context when space allows
- Match user mental model ("Save changes" not "Submit")
- Destructive actions named clearly ("Delete member")

## Medium-Confidence (trend-dependent)

| Pattern | Notes |
|---------|-------|
| Dark mode with cyan accents | Fine if brand; slop if copied blindly |
| Rounded-2xl everything | Vary radius by element type |
| Micro-animations on load | OK if tokenised; slop if gratuitous |
| Bento grid | Slop when content doesn't fit cells |

## Detection Checklist

**Visual audit:**
- [ ] Could this be any SaaS product? (swap logo test)
- [ ] Are colours from project tokens, not defaults?
- [ ] Is there clear visual hierarchy (one primary action)?
- [ ] Do spacing and radii follow a scale?

**UX audit:**
- [ ] Does layout serve content or a template?
- [ ] Are empty states designed, not generic?
- [ ] Do error messages help the user recover?
- [ ] Touch targets ≥ 44px on mobile?

**Copy audit:**
- [ ] Headlines specific to product and audience?
- [ ] No buzzwords without explanation?
- [ ] UK English if project requires it?

## Improvement Strategies

1. **Content-first** — List real content, then design containers
2. **One accent** — Primary action colour; neutrals elsewhere
3. **Token discipline** — No hex in components; use theme
4. **Brand personality** — Calm/trustworthy vs playful (match project)
5. **Reference real apps** — MasjidBox-style clarity, not Dribbble fiction
6. **Remove before adding** — Strip gradient, blob, extra card layer first

## Acceptable Patterns

- Gradients on hero when brand-defined (e.g. prayer-time gradients)
- Cards for distinct actionable units
- "Get started" in onboarding step 1 of a wizard
- Standard patterns from project design system (MUI admin, mobile tokens)

Always defer to project-specific rules (`.cursor/rules/`, `theme.ts`, mobile design system) over generic anti-slop advice.

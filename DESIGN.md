---
name: VoteAware
description: MPLADS fund records read like a payment app's transaction history
colors:
  ink: "#0a0b14"
  ink-raised: "#12141f"
  ink-card: "#171a28"
  ink-border: "#262a3d"
  accent: "#6d4aff"
  accent-soft: "#241c47"
  accent-strong: "#8a6bff"
  good: "#22c55e"
  good-soft: "#12271b"
  warn: "#f5a524"
  warn-soft: "#2b2211"
  bad: "#f04438"
  bad-soft: "#2c1717"
  text-hi: "#f4f3f8"
  text-mid: "#a7a6bd"
  text-low: "#6d6c85"
typography:
  wordmark:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3rem, 11vw, 5rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.04em"
  display:
    fontFamily: "Sora, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.15rem, 5vw, 3.75rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "12px"
  md: "16px"
  lg: "24px"
  pill: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.text-hi}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  grade-badge-good:
    backgroundColor: "{colors.good-soft}"
    textColor: "{colors.good}"
    rounded: "{rounded.md}"
  grade-badge-warn:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.warn}"
    rounded: "{rounded.md}"
  grade-badge-bad:
    backgroundColor: "{colors.bad-soft}"
    textColor: "{colors.bad}"
    rounded: "{rounded.md}"
  status-pill:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-strong}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
---

# Design System: VoteAware

## Overview

**Creative North Star: "The UPI Ledger"**

VoteAware reads an MP's public MPLADS record the way a payment app reads your own transaction history: a balance-style hero number, a receipt-style scrollable list, and a per-record ledger of allotted / spent / unspent. The world is deliberately near-black and monotone rather than a two-tone paper/dark split — elevation is carried by tonal steps between ground, raised, and card surfaces, not by a light-card-on-dark-ground contrast. One saturated indigo-violet accent carries every primary action, the hero balance, and nothing else, so its rarity keeps it legible as "this is the number that matters."

The system was chosen over its most obvious literal alternative — a ballot/election-ink world — because familiarity with everyday fintech UI was judged more valuable than novelty for a civic-data lookup tool aimed at young Indian voters already fluent in PhonePe/GPay-style receipts.

**Key Characteristics:**
- Monotone dark ground with tonal elevation (ink → ink-raised → ink-card), never light cards on a dark field.
- One accent color (indigo-violet) reserved for primary actions and the single hero number.
- Every numeral renders in tabular figures (`font-variant-numeric: tabular-nums`) — grades, balances, and ledger tables must align like a real receipt.
- Status is always color + text label together (pills), never color alone.
- No card-grid page structure: content lives in divided-row lists and stacked ledger sections.

## Colors

The palette is a single dark neutral scale plus one committed accent and a three-way status set; there is no secondary or tertiary accent.

### Primary
- **Ledger Violet** (`#6d4aff`, strong variant `#8a6bff`): the one saturated color in the system. Used only for primary buttons, the active filter pill, focus rings, links, and the hero balance figure. Never used decoratively.

### Neutral
- **Ink** (`#0a0b14`): page ground.
- **Ink Raised** (`#12141f`): first elevation step — search bars, list rows, filter pills at rest.
- **Ink Card** (`#171a28`): second elevation step — the aggregate balance card, the fund-ledger card, hover state on list rows.
- **Ink Border** (`#262a3d`): all hairline dividers and card borders.
- **Text Hi** (`#f4f3f8`): headings, primary values, names.
- **Text Mid** (`#a7a6bd`): body copy, secondary labels.
- **Text Low** (`#6d6c85`): captions, disclaimers, eyebrow-weight metadata (never rendered as an actual kicker element).

### Status
- **Good** (`#22c55e` on `#12271b`): grade A/B, completed work items, high utilization.
- **Warn** (`#f5a524` on `#2b2211`): grade C, unspent-balance figures, promised-not-started work.
- **Bad** (`#f04438` on `#2c1717`): grade D/F, stalled work items.

### Named Rules
**The One Accent Rule.** Ledger Violet appears on at most a handful of elements per screen (primary CTA, hero number, active filter, focus ring). If a second saturated color starts appearing for emphasis, it is a violation — reach for a status color instead if the meaning is status, or text-hi weight if the meaning is hierarchy.

**The Tonal Elevation Rule.** Depth is expressed by moving one step up the ink scale (ink → ink-raised → ink-card), never by switching to a light surface. A "white card" anywhere in this system is a defect, not a variant.

## Typography

**Display Font:** Sora (with ui-sans-serif, system-ui fallback)
**Body Font:** Manrope (with ui-sans-serif, system-ui fallback)

**Character:** Sora is geometric and slightly rounded, carrying every numeral and heading with a confident, fintech-native weight; Manrope is a plain, highly legible grotesk for body copy and UI chrome. The pairing reads as "engineered but human," never corporate-bureaucratic.

### Hierarchy
- **Wordmark** (800, `clamp(3rem, 11vw, 5rem)`, 1.0 line-height, `-0.04em`): the "VoteAware" lockup on the landing hero, and nothing else. It is the only type in the system allowed above the Display step, and it appears exactly once in the product — the home page H1. Any second use is a defect.
- **Display** (700, `clamp(2.15rem, 5vw, 3.75rem)`, 1.08 line-height): page H1s only — one per page.
- **Headline** (700, 1.5rem–1.875rem): section headings ("Most left unspent", "Browse MPs").
- **Title** (600–700, 1rem–1.125rem): card/list item primary text (MP name, work title).
- **Body** (400, 15px, 1.6 line-height, ~60–70ch max measure): paragraphs, descriptions.
- **Label** (600, 12px, uppercase, tracked): eyebrow-weight metadata like "MPLADS FUND LEDGER, THIS TERM" — used only as a `<dt>`/section label directly above data, never as a decorative kicker floating above a heading.

### Named Rules
**The Tabular Numerals Rule.** Every number that represents money, a percentage, or a grade renders with `font-variant-numeric: tabular-nums` (the `.tabular` utility class). Numerals in a ledger must line up; proportional figures are a defect on any financial value.

## Layout

Single-column content max-width containers (`max-w-2xl`–`max-w-3xl` for reading content, `max-w-6xl` for the nav/footer shell), centered with horizontal padding (`px-5` mobile, `px-8` desktop). No sidebar, no persistent multi-column dashboard shell — the product is a lookup-and-read flow, not a control panel. Sections stack vertically, each separated by a full-width `ink-border` hairline rather than card boxes. Responsive behavior is reflow-only: text and hero sizes scale down via Tailwind breakpoints, list rows stay single-column and just tighten padding; no layout reorganization between mobile and desktop.

## Elevation & Depth

Depth is tonal, not shadow-driven, for interior surfaces (list rows sit on `ink-raised` against the `ink` page ground with no shadow at all — the border hairline is enough separation). Two real shadow tokens exist for the two surfaces that need to visually "lift" off the page: the aggregate balance card and the fund-ledger card.

### Shadow Vocabulary
- **card** (`0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -8px rgba(0,0,0,0.5)`): the fund-ledger card on the MP detail page.
- **raised** (`0 2px 4px rgba(0,0,0,0.5), 0 16px 40px -12px rgba(109,74,255,0.25)`): the aggregate balance hero card on the home page — the only shadow in the system that carries a hint of the accent color, marking it as the single most important number on the page.

### Named Rules
**The Two-Shadow Rule.** Only the two hero-weight cards get a shadow. Every other elevated surface (list rows, pills, inputs) is flat and relies on the tonal step + border hairline. A shadow on a list row is a defect.

## Shapes

Rounded, soft-technical geometry throughout: `12px` on inputs and small controls, `16px`–`24px` on cards and the aggregate hero, full pill radius on status chips, grade badges, and filter buttons. No sharp corners anywhere in the system — the softness is deliberate counterweight to the dense tabular data.

## Components

### Buttons
- **Shape:** `16px` radius (`rounded-xl`).
- **Primary:** Ledger Violet background, `text-hi` text, `12px 20px` padding, `active:scale-95` as the only interaction motion (deliberately restrained — this is not a playful surface).
- **Filter pill (secondary):** `ink-raised` background at rest, flips to solid Ledger Violet + white text when active; full pill radius.

### Grade Badge
- Fixed-size square-ish rounded tile (`rounded-2xl`), sized `sm`/`md`/`lg` by context (list row vs. detail hero).
- Color pair drawn from the status set by grade: A/B → good, C → warn, D/F → bad.
- Letter rendered in Sora bold, tabular.

### Status Pill
- Full pill radius, `4px 10px` padding, 12px semibold label text.
- Four states map 1:1 to the status set plus the accent (in-progress uses accent-soft/accent-strong, not a status color, since "in progress" is neither good nor bad yet).

### Cards / Containers
- **Corner style:** `24px` (aggregate hero, fund-ledger card) or `16px` (list container).
- **Background:** `ink-card` for hero-weight cards, `ink-raised` for list rows.
- **Shadow strategy:** see Elevation & Depth — only the two hero cards get a shadow.
- **Border:** `1px solid ink-border` on list containers; no border on shadowed hero cards.

### Inputs / Fields
- **Style:** `ink-raised` background, `1px solid ink-border`, `16px` radius, `Find` label token sitting inline before the input (not a floating label).
- **Focus:** border shifts to Ledger Violet (`focus-within:border-[accent]`); no glow/ring on the container itself, but a visible `2px` accent outline on the actual focused control per standard focus-visible handling.

### Navigation
- Sticky top bar, `ink` background at 90% opacity with backdrop blur, single hairline border at the bottom. Wordmark tile (2-letter monogram in a small accent-filled rounded square) + text lockup on the left; two text links on the right, current-section link rendered in `text-hi` instead of `text-mid`.

## Do's and Don'ts

### Do:
- **Do** render every money/percentage/grade value with tabular numerals.
- **Do** pair every status indicator with a text label, never color alone.
- **Do** keep Ledger Violet reserved for primary actions and the single hero number per page.
- **Do** use divided-row lists (`divide-y` + `ink-border`) for any collection of MPs or line items instead of a card grid.

### Don't:
- **Don't** introduce a light/paper card surface anywhere — elevation is tonal-dark only (The Tonal Elevation Rule).
- **Don't** add a kicker/eyebrow label above a heading; the heading carries its own weight.
- **Don't** number sections (01/02/03) unless the order itself is meaningful information — the "How a grade gets calculated" section is deliberately an unnumbered receipt-style `<dl>`, not a numbered feature list.
- **Don't** add a shadow to anything other than the two named hero-weight cards.

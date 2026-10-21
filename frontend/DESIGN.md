# Tally — Design System

> Phase B design contract. Every colour, size, spacing value, and component state in
> `frontend/src` traces back to a token in this file. If a value is missing, add it here first.

## 1. Atmosphere & Identity

**The table after midnight.** A private four-player scoring instrument, not a dashboard: deep
ink-green felt, warm ivory type, a cinnabar seal for action, jade for money won and coral for money
lost. The room is dark so the numbers are the light. Density is deliberate — four players and seven
rounds must be readable at a glance on a phone held in one hand.

The signature is the **tally mark**: four vertical strokes and one diagonal strike. It is the
wordmark glyph, the section marker, the "rounds recorded" motif, and a faint watermark on the 我
card. The one memorable moment is settlement: the output tile flashes, the column clears, and the
tally strike lands on the 我 card as the money moves.

**Design read:** operational mobile utility for four friends at a table, with a dark, material,
instrument-like language; leaning toward Supabase's border-defined dark surfaces and dense type,
executed with the taste-skill's anti-slop discipline.

### References (Layer A + Layer B)

| Layer | Reference | What was borrowed | What was deliberately not borrowed |
|---|---|---|---|
| A — taste | `taste-skill.md` | Density dial raised to 7; tabular numerals; no decorative motion; real states for every control; anti-slop guardrails (no purple gradients, no card soup, no emoji icons) | Landing-page hero patterns, scroll choreography, marketing whitespace |
| B — system | `supabase.md` | Near-black layered surfaces; depth through a 3-step border hierarchy instead of shadows; translucent accent borders; pill primary CTA; 400/500 weight restraint; mono technical labels | Supabase green as brand colour, Circular/Source Code Pro (no external fonts), 72px marketing display, logo/brand assets |

The palette is recombined for this product: Supabase's emerald becomes **jade** (positive only),
its near-black becomes **ink-green felt**, and the brand accent becomes **cinnabar** (a seal, not a
link colour). No Supabase logo, copy, or trademarked asset is used.

## 2. Color

### Palette (dark-only, by design)

| Role | Token | Value | Usage | Contrast |
|---|---|---|---|---|
| Page | `--ink-950` | `#070d0b` | App background, login | — |
| Chrome | `--ink-900` | `#0b1411` | Header, bottom nav | — |
| Surface | `--ink-850` | `#0f1b16` | Panels, sheets | — |
| Card | `--ink-800` | `#13231c` | Player cards, record rows | — |
| Raised | `--ink-750` | `#182c23` | Inputs, pressed surfaces | — |
| Line | `--line` | `#263a30` | Default 1px borders | 1.6:1 (non-text) |
| Line strong | `--line-strong` | `#355044` | Hover / selected borders | 2.2:1 (non-text) |
| Text primary | `--ivory` | `#f4eddd` | Headings, numbers, body | 16.8:1 on page |
| Text secondary | `--ivory-dim` | `#cfc6b2` | Labels, secondary body | 11.6:1 on page |
| Text muted | `--muted` | `#93a096` | Hints, empty cells, metadata | 7.2:1 on page; 6.0:1 on card |
| Text faint | `--muted-2` | `#6f7d73` | Disabled text only | 4.5:1 on page |
| Accent | `--cinnabar` | `#e4573f` | Brand mark, primary CTA fill, active nav | 5.35:1 on page; ink text on it 5.35:1 |
| Accent text | `--cinnabar-text` | `#f06a50` | Small accent text on cards | 5.36:1 on card |
| Accent deep | `--cinnabar-deep` | `#a83224` | Danger button fill | ivory on it 5.72:1 |
| Accent wash | `--cinnabar-wash` | `rgba(228,87,63,0.12)` | Selected chip fill | — |
| Positive | `--jade` | `#5bd6a6` | Money won, 收, success | 10.8:1 on page; 9.0:1 on card |
| Positive deep | `--jade-deep` | `#1c6b52` | 找數 button fill | ivory on it 5.5:1 |
| Negative | `--coral` | `#ff8a78` | Money lost, 賠, destructive text | 8.6:1 on page; 7.1:1 on card |
| Negative deep | `--coral-deep` | `#8f2f24` | Destructive hover | — |
| Focus | `--focus` | `#ffd2a8` | `:focus-visible` outline | 14.0:1 on page |
| Scrim | `--scrim` | `rgba(3,7,5,0.72)` | Dialog backdrop | — |

### Derived alpha / elevation tokens

| Token | Value | Usage |
|---|---|---|
| `--cinnabar-faint` | `rgba(228,87,63,0.10)` | Page atmosphere, 我 card wash |
| `--cinnabar-wash` | `rgba(228,87,63,0.12)` | Selected chip fill, focus halo |
| `--cinnabar-soft` | `rgba(228,87,63,0.14)` | Login atmosphere |
| `--cinnabar-edge` | `rgba(228,87,63,0.40)` | 我 badge border |
| `--cinnabar-border` | `rgba(228,87,63,0.55)` | Active cell, 我 card, 踢半 tile |
| `--cinnabar-glow` | `rgba(228,87,63,0.55)` | Reduced-motion output glow |
| `--felt-glow` | `rgba(28,58,44,0.55)` | Page felt light |
| `--felt-glow-strong` | `rgba(28,58,44,0.70)` | Login felt light |
| `--coral-wash` | `rgba(143,47,36,0.15)` | Inline error background |
| `--coral-wash-soft` | `rgba(143,47,36,0.12)` | Warning background |
| `--header-bg` | `rgba(11,20,17,0.88)` | Sticky header |
| `--nav-bg` | `rgba(11,20,17,0.92)` | Bottom nav |
| `--shadow-sheet` | `0 -24px 64px rgba(0,0,0,0.45)` | Sheet only |
| `--shadow-toast` | `0 8px 24px rgba(0,0,0,0.35)` | Toast only |
| `--shadow-login` | `0 24px 64px rgba(0,0,0,0.40)` | Login card only |
| `--sheen` | `rgba(244,237,221,0.06)` | Skeleton shimmer highlight |

### Rules

- Cinnabar is the **seal**: brand mark, primary action, active navigation, focus-adjacent emphasis.
  It is never used for positive/negative money.
- Jade = positive, coral = negative, muted = zero. **Never colour alone**: money values follow the
  spec's sign conventions (埋數 ` $12.5` / `-$12.5` / ` $0.0`; stats `+$12.5` / `-$12.5` / `$0.0`),
  every win/loss carries a word or a `W/L` pair, and negatives carry a visible minus. Money strings
  use the spec's ASCII hyphen (`-$12.5`); the mono font renders it clearly.
- No raw hex outside this table. Component CSS uses `var(--token)` only.
- Contrast floor: 4.5:1 for text under 18px, 3:1 for large text and UI boundaries. The table above
  records the measured ratio for every text token.

## 3. Typography

### Families

| Role | Stack |
|---|---|
| UI / display | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang HK", "PingFang TC", "Noto Sans CJK TC", "Microsoft JhengHei", sans-serif` |
| Numerals / technical | `ui-monospace, "SF Mono", "Menlo", "Roboto Mono", monospace` |

No external fonts, no CDN. CJK falls back to the platform's Traditional Chinese face. Numerals use
`font-variant-numeric: tabular-nums` everywhere a value can change.

### Scale

| Level | Size / line-height | Weight | Tracking | Usage |
|---|---|---|---|---|
| Display | 30px / 1.05 | 700 | -0.02em | Output tiles, login wordmark |
| Score | 26px / 1.1 | 700 | -0.01em | Player card money |
| H1 | 22px / 1.2 | 700 | -0.01em | Page title |
| Sheet | 20px / 1.2 | 700 | 0 | Sheet title |
| H2 | 18px / 1.3 | 600 | 0 | Section headings, stat values |
| Body | 16px / 1.5 | 400 | 0 | Inputs, body copy |
| Body strong | 16px / 1.4 | 600 | 0 | Button labels, names |
| Data | 15px / 1.3 | 700 | 0 | Record scores |
| Small | 14px / 1.45 | 400 | 0 | Secondary copy, record names |
| Caption | 13px / 1.4 | 400 | 0 | Descriptions, errors |
| Label | 12px / 1.35 | 500 | 0.02em | Field labels, nav labels |
| Micro | 11px / 1.3 | 600 | 0.08em | Technical labels (uppercase, mono) |
| Overline | 10px / 1.3 | 600 | 0.14em | Eyebrow |
| Tiny | 9px / 1.2 | 600 | 0.08em | Output tile label |

Rules: body never below 14px; inputs are 16px minimum (iOS zoom); headings use `clamp()` only if a
future desktop surface needs it. No all-caps for prose; micro labels may be uppercase mono.

## 4. Spacing & Layout

### Base unit: 4px (2px half-steps for dense controls)

| Token | Value | Usage |
|---|---|---|
| `--space-0-5` | 2px | Hairline offsets |
| `--space-1` | 4px | Icon-to-label, hairline gaps |
| `--space-1-5` | 6px | Dense grid gaps (3×7 fan grid) |
| `--space-2-5` | 10px | Dense card padding |
| `--space-3-5` | 14px | Player card padding |
| `--space-4-5` | 18px | Stats hero padding |
| `--space-2` | 8px | Grid gaps, chip padding |
| `--space-3` | 12px | Card padding, control gaps |
| `--space-4` | 16px | Page gutter, input padding |
| `--space-5` | 20px | Section inner spacing |
| `--space-6` | 24px | Section separation |
| `--space-8` | 32px | Major blocks |
| `--space-10` | 40px | Login rhythm |
| `--space-12` | 48px | Rank column, icon padding |
| `--space-16` | 64px | Output tiles, nav height |

### Component size & radius tokens

| Token | Value | Usage |
|---|---|---|
| `--target-min` | 44px | Minimum touch target |
| `--target-comfortable` | 48px | Inputs, chips |
| `--target-primary` | 52px | Primary CTA, numpad keys |
| `--target-card` | 112px | Player cards |
| `--target-card-wide` | 140px | Mai diamond player cards |
| `--target-numpad` | 56px | Numpad display |
| `--radius-hairline` | 2px | Nav indicator |
| `--radius-2xs` | 4px | 我 badge |
| `--radius-xs` | 6px | Small chips |
| `--radius-sm` | 8px | Input cells |
| `--radius-md` | 10px | Buttons, fields |
| `--radius-lg` | 12px | Cards, segmented track |
| `--radius-xl` | 14px | Player cards, stats hero |
| `--radius-2xl` | 16px | Login card |
| `--radius-3xl` | 18px | Login card (large) |
| `--radius-sheet` | 20px | Sheet top corners |
| `--radius-pill` | 999px | Primary CTA, chips |
| `--border-hairline` | 1px | Default borders |
| `--border-accent` | 2px | Active nav indicator |
| `--border-toast` | 3px | Toast semantic edge |

### Shell

- `max-width: 480px`, centred, `height: 100dvh`, flex column with `overflow: hidden`.
- Header: 56px + `env(safe-area-inset-top)` + 10px breathing room, flex item, translucent ink with
  1px bottom border.
- Bottom nav: 64px + `env(safe-area-inset-bottom)`, flex item below the scrollable main; not fixed to
  the visual viewport (prevents the iOS initial-scroll lift).
- Content: the main is the scroll container (`flex: 1; min-height: 0; overflow-y: auto`) with
  `padding: var(--space-4)` and a 24px bottom gap. Banners are `flex: none` above it.
- No horizontal scroll at 375–430px. Grids use `minmax(0, 1fr)` so long names truncate, never push.

### Grids

- **Fan:** 3 columns × 7 rows, row-major. Column width ≈ 111px at 375px; input cells `min-height: 44px`;
  output tiles `min-height: 64px`. Names are the column headers.
- **Mai:** diamond seating — 閒2 top; 閒1 left and 閒3 right; 我 bottom. Cards are
  `min(45%, 140px)` wide and `min-height: 112px`; the 我 card spans the visual hierarchy with a
  cinnabar border and tally watermark.
- **Ledger:** single column; date groups are bordered blocks; record rows use an auto-fit inner grid
  (4 columns typical; 2–8 after merges/imports).

### Breakpoints

`375px` (small phone), `430px` (large phone), `480px` (shell cap). No desktop layout is designed;
the shell simply centres on wider screens.

## 5. Components

Every component below is implemented in `frontend/src/components` or `frontend/src/pages` and uses
only the tokens above.

### AppHeader
- Structure: tally mark + wordmark, `今日` summary chip, tools icon button.
- States: default; scrolled (border strengthens); chip positive/negative/zero.
- A11y: tools button has `aria-label="工具"`; chip is text, not colour-only.

### BottomNav
- Structure: 3 `<button>` tabs with inline SVG + label; active indicator bar.
- States: default, active (`aria-current="page"`, cinnabar text + 2px top bar), focus-visible.
- Targets: 64px tall, each tab ≥ 44px wide.

### TallyMark
- Inline SVG: four 2px vertical bars + one diagonal strike. Sizes 16/20/28/48.
- Decorative instances `aria-hidden="true"`; the wordmark instance has an accessible label.

### OutputTile
- Structure: label (`閒 1`), value, optional `已踢半` badge.
- States: default, zero (muted `0`), negative (coral, minus), flash (scale + glow on change),
  active column (cinnabar top rule).
- Motion: 320ms flash; reduced motion = opacity pulse only.

### InputCell
- Structure: `<button>` with value or `—`.
- States: empty (muted dash), filled (ivory), negative (coral + minus), active (cinnabar border +
  inset wash), focus-visible.
- Target: ≥ 44px; `aria-label="閒 1 第 3 行，目前 12"`.

### ActionButton
- Variants: `primary` (cinnabar pill, ink text), `positive` (jade-deep fill, ivory text),
  `outline` (transparent, line border), `ghost`, `danger` (cinnabar-deep fill).
- States: default, hover (lighten), active (scale 0.97), focus-visible, disabled (40% opacity,
  `cursor: not-allowed`), loading (spinner + label, disabled).
- Targets: ≥ 44px; primary ≥ 52px.

### PlayerCard
- Structure: name, money, adjust affordance; 我 variant adds cinnabar border + tally watermark.
- States: default, pressed (scale 0.98), positive/negative/zero money, bump on change.
- A11y: whole card is a `<button>` with `aria-label="調整 閒 1 的分數，目前 +$12.5"`.

### Sheet (dialog)
- Native `<dialog>` + `showModal()`; bottom sheet on mobile, max-width 480px.
- States: closed, opening (slide-up 240ms), open, closing (fade 160ms).
- A11y: `aria-labelledby`, focus trap native, Escape closes, backdrop click closes, body scroll
  locked, visible close button (standalone has no browser back).
- Reduced motion: fade only.

### Numpad
- Fan mode: sign, blank, 完成 / 1–9 / blank, 0, backspace. Integer, max 6 digits, blank 完成 clears.
- Mai mode: +, −, 完成 / 1–9 / ., 0, backspace. Chainable, 1dp display, round on confirm.
- States: key default/pressed/focus; display negative (coral); confirm disabled only when invalid.
- A11y: each key is a `<button>` with an accessible label (`刪除`, `切換正負`, `完成`).

### Toast
- Top-centred, max-width 420px, ink-850 surface, semantic left border, icon + message.
- Optional action (`復原`) for settlement/undoable operations.
- `aria-live="polite"`; auto-dismiss 2.5s (4s with action); reduced motion = fade only.

### SegmentedTabs
- 3 equal buttons in a bordered track; active = ink-750 fill + ivory text + cinnabar underline.
- `role="tablist"` / `role="tab"` / `aria-selected`; keyboard arrow support.

### RecordRow
- Date group header: `YYYY年MM月DD日`; no record count.
- Record row: auto-fit player columns (name + signed score), per-record edit/delete icon buttons.
- States: default, hover, focus, deleting (disabled + spinner), error inline.

### StatTile
- Label (caption), value (H2 tabular), optional date (caption).
- States: value positive/negative/zero, no-data (`—`), loading (skeleton).

### EmptyState / Skeleton / Banner
- Empty: icon, title, one-line explanation, optional retry.
- Skeleton: 3 shimmer blocks, 1.2s; reduced motion = static.
- Banner: install (iOS Safari only), update (SW `needRefresh`), offline (retry).

## 6. Motion & Interaction

| Token | Value | Usage |
|---|---|---|
| `--dur-press` | 120ms | Button press |
| `--dur-fast` | 160ms | Toast, fade |
| `--dur-base` | 200ms | Page enter, tab switch |
| `--dur-sheet` | 240ms | Sheet slide |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Entrances |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Sheets |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Score bump |

Rules: animate only `transform`, `opacity`, `filter`. No layout animation. No decorative loops.
Every animation maps to a state change (page change, value change, sheet open, toast). Hover only on
pointer devices; touch uses `:active`.

**Reduced motion** (`prefers-reduced-motion: reduce`): page enter = fade only; output flash = static
cinnabar ring; score bump = opacity pulse; sheet = fade; toast = fade; skeleton = static; nav
indicator = no transition.

## 7. Depth & Surface

**Strategy: tonal shift + border hierarchy (Supabase-derived), no ambient shadows.**

| Level | Treatment | Usage |
|---|---|---|
| 0 | `--ink-950` | Page |
| 1 | `--ink-850` + 1px `--line` | Panels, sheets |
| 2 | `--ink-800` + 1px `--line` | Cards, record rows |
| 3 | `--ink-750` + 1px `--line-strong` | Inputs, selected chips |
| Accent | 1px `rgba(228,87,63,0.45)` | Active cell, 我 card, focus-adjacent |
| Overlay | `--scrim` + sheet shadow `0 -24px 64px rgba(0,0,0,0.45)` | Dialogs only |

Atmosphere: two very low-opacity radial gradients (jade at top-left, cinnabar at bottom-right) on the
page background, plus a 3px repeating hairline "felt" texture at 2% opacity. No images, no external
assets. The login screen uses a larger tally watermark at 6% opacity.

## 8. Responsive, Accessibility & Debt

### Responsive
- 375px: 3-column fan grid, diamond mai seating (1 / 2 / 1), auto-fit record rows; all targets ≥ 44px.
- 430px: same layout, more breathing room; shell caps at 480px.
- Safe areas: top and bottom `env(safe-area-inset-*)`; `100dvh` default, with a `100vh`/`100lvh` standalone fallback for the iOS 26 short-viewport bug.
- Inputs 16px; viewport has no `maximum-scale`.

### Accessibility
- WCAG AA contrast (measured above); positive/negative/zero never colour-only.
- Real `<button>` / `<input>` / `<dialog>`; labels for every input; `aria-live` toasts;
  `aria-current="page"` nav; `aria-selected` tabs; focus-visible ring on every interactive element.
- Keyboard: Tab order follows visual order; Escape closes sheets; arrow keys move segmented tabs.
- Touch: ≥ 44×44px; 8px minimum gap between adjacent targets.
- Screen reader: money values read as "正 12.5" / "負 12.5" via `aria-label` where the visual sign is
  a glyph.

### Accepted debt
- Dark-only theme. The brief's atmosphere is a night table; a light theme would be a different
  product. Documented, not accidental.
- No desktop layout beyond the centred 480px shell.
- No push notifications or background sync (out of scope per spec).
- Real iPhone standalone/safe-area evidence is pending; local Chromium/WebKit evidence is captured
  under `docs/evidence/phase-b/`.

### React dev tooling gate
- `react-scan` and `react-grab` are loaded only under `import.meta.env.DEV` via `src/devtools.ts`,
  called from `src/main.tsx`.
- `react-doctor` is a dev dependency and is run manually (`pnpm exec react-doctor`); it is not part
  of the production bundle. Latest run: 0 errors; remaining warnings are intentional dialog
  state-resets on open, the native `<dialog>` backdrop handler, and the hash-route subscription.
- Deviation: `react-grab`'s overlay is initialised only in development and is excluded from the
  production build by the `import.meta.env.DEV` branch; no production code path imports it. Append
  `?no-devtools=1` to the dev URL to disable both overlays for automated visual QA.

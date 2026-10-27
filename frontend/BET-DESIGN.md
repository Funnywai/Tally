# Tally Betting — Design System

> Separate visual contract for the football-betting ledger. Mahjong tokens and components must not be used here.

## 1. Atmosphere

**Floodlit night match.** Deep navy-black sky, faint chalk pitch lines, a scoreboard/odds-board typography, and a floodlight volt accent. The interface should feel like a betting slip laid on a dark stadium table: dense, numeric, calm, and separate from the mahjong felt.

- No mahjong felt green, cinnabar, jade/coral money semantics, or tally marks.
- No external fonts, CDNs, logos, or brand assets.
- Numbers are the light: monospace, tabular, high contrast.

## 2. Color Tokens

All tokens are namespaced `--bet-*` on `:root`.

| Token | Value | Usage |
|---|---|---|
| `--bet-bg` | `#050b14` | Page background |
| `--bet-bg-2` | `#081120` | Gradient / raised page area |
| `--bet-surface` | `#0c1626` | Cards, summary cells |
| `--bet-raised` | `#122033` | Inputs, active surfaces |
| `--bet-line` | `#1e3147` | Decorative hairline: card edges, separators (not for controls) |
| `--bet-line-strong` | `#2c4a63` | Decorative emphasis: dashed empty states, container accents |
| `--bet-control-line` | `#526d82` | Interactive control borders: inputs, chips, switches, outline buttons, sheet. 3.34:1 on `--bet-surface`, 3.63:1 on `--bet-bg` |
| `--bet-text` | `#f3f7f2` | Primary text |
| `--bet-dim` | `#b8c4cf` | Secondary text |
| `--bet-muted` | `#7f92a3` | Metadata, hints |
| `--bet-volt` | `#d8ff4f` | Primary action, active nav, focus |
| `--bet-volt-ink` | `#0a1204` | Text on volt |
| `--bet-win` | `#5ee6a8` | Profit, win |
| `--bet-loss` | `#ff6b6b` | Loss, destructive |
| `--bet-pending` | `#ffc857` | Pending / waiting |
| `--bet-push` | `#9fb0bf` | Push / neutral |
| `--bet-scrim` | `rgba(2, 6, 12, 0.78)` | Dialog backdrop |
| `--bet-glow` | `rgba(216, 255, 79, 0.10)` | Floodlight wash |
| `--bet-pitch-line` | `rgba(243, 247, 242, 0.045)` | Chalk lines |
| `--bet-shadow` | `0 18px 48px rgba(0, 0, 0, 0.38)` | Sheets/toasts |

Contrast rules: text ≥ 4.5:1 on its surface; UI boundaries ≥ 3:1; never rely on colour alone. Money always carries a sign; results always carry a text label. `--bet-line` and `--bet-line-strong` are decorative hairlines (they fall below 3:1 by design); every interactive control border uses `--bet-control-line`, so the UI-boundary rule holds for controls. Focus stays on `--bet-volt`; selected chips keep the volt wash border.

## 3. Typography

- UI: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang HK', 'PingFang TC', 'Noto Sans CJK TC', 'Microsoft JhengHei', sans-serif`.
- Numbers: `ui-monospace, 'SF Mono', Menlo, 'Roboto Mono', monospace` with `font-variant-numeric: tabular-nums`.
- Scale: Display 32/1.05 700; H1 22/1.2 700; H2 18/1.3 600; body 16/1.5 400; data 15/1.3 700; small 14/1.45; label 12/1.35 500 uppercase mono; micro 10/1.3 600 tracking 0.08em.
- No letter-spacing below 0.02em on CJK body text.

## 4. Layout & Density

- 4px base unit; page gutter 16px; card padding 14–16px; gap 8/12/16.
- Shell max-width 480px; full `100dvh`; safe-area top/bottom.
- Touch target 44px minimum; inputs 16px; primary button 52px.
- Single column only; no desktop layout.

## 5. Components

- **Shell**: `.bet-shell`, `.bet-header`, `.bet-main`, `.bet-nav`, `.bet-page-enter`.
- **Header**: pitch mark, `Tally` wordmark, 「賭球」 sub, 「麻雀」 switch pill.
- **Nav**: two tabs, 注單 / 統計; volt active bar, not a mahjong pill.
- **Summary**: 3 scoreboard cells; today/month profit and all pending count/stake.
- **CTA**: full-width volt pill/square, `新增注單`.
- **Buttons**: primary = volt fill + `--bet-volt-ink` text; danger = `--bet-loss` fill + `--bet-volt-ink` text (6.87:1, clears the 4.5:1 body-text rule); ghost/outline keep token borders.
- **Filters**: 全部 / 待結算 / 已結算; selected uses volt wash + border.
- **Bet card**: type badge, record time, result badge; numbered legs `01/02`; dotted separators; stake / total odds / profit footer; pending card has a `結算` text action.
- **Sheet**: full-screen for the bet form; bottom sheet for confirmation. Native `<dialog>` + focus trap + Escape.
- **Form**: date, leg fieldsets, market chips, result chips, total-odds readout, profit preview, sticky footer.
- **Stats**: period segmented control, hero P/L, 2×2 KPI, type rows, market diverging bars, 6-month CSS column chart, biggest win/loss cards.
- **States**: `.bet-empty`, `.bet-inline-error`, `.bet-skeleton*`, `.bet-toast*`, `.bet-banner`.

## 6. Motion

- 120–180ms; `--bet-ease: cubic-bezier(0.23, 1, 0.32, 1)`.
- Sheet slides up; page fades/slides 4px; bars grow on mount; number updates may flash once.
- Under `prefers-reduced-motion: reduce`, disable all transforms/animations.

## 7. Accessibility

- Focus ring: 2px `--bet-volt`, 2px offset, only `:focus-visible`.
- Dialog focus trap, Escape close, focus return to trigger, body scroll lock.
- `aria-live="polite"` for toast and profit preview; `role="alert"` for inline errors.
- Inputs have visible labels; errors use `aria-invalid` and text.
- Charts have text alternatives (`aria-label` and numbers).

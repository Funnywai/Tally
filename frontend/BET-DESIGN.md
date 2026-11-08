# Tally Betting — Design System

> Separate visual contract for the football-betting ledger. Mahjong tokens and components must not be used here.

## 1. Atmosphere

**HKJC night wallet.** Deep navy header, electric-blue hero wash, midnight-blue action with an ice-blue rim, gold status accent, and a faint cool grid. The interface should feel like a betting slip laid on a dark stadium table: dense, numeric, calm, and separate from the mahjong felt. Borrow HKJC's navy/blue/gold tension, not its green betting-page tool UI; gold is reserved for pending/status and brand marks, never for buttons.

- No mahjong felt green, cinnabar, jade/coral money semantics, or tally marks.
- No external fonts, CDNs, logos, or brand assets.
- Numbers are the light: monospace, tabular, high contrast.

## 2. Color Tokens

All tokens are namespaced `--bet-*` on `:root`.

| Token | Value | Usage |
|---|---|---|
| `--bet-bg` | `#07131F` | Page background |
| `--bet-bg-2` | `#081A2C` | Gradient / raised page area |
| `--bet-surface` | `#0F2134` | Cards, summary cells |
| `--bet-raised` | `#16314B` | Inputs, active surfaces |
| `--bet-line` | `#203A55` | Decorative hairline: card edges, separators (not for controls) |
| `--bet-line-strong` | `#2A4560` | Decorative emphasis: dashed empty states, container accents |
| `--bet-control-line` | `#5F7F9C` | Interactive control borders: inputs, chips, switches, outline buttons, sheet. 3.9:1 on `--bet-surface`, 4.5:1 on `--bet-bg` |
| `--bet-text` | `#F4F8FC` | Primary text |
| `--bet-dim` | `#B5CCE6` | Secondary text |
| `--bet-muted` | `#93A9BF` | Metadata, hints |
| `--bet-accent` | `#F5C842` | Brand/data accent: header mark, total odds; never a button |
| `--bet-accent-ink` | `#06111C` | Text on gold |
| `--bet-action` | `#173B6B` | Primary CTA, selected filters/chips, active nav fill |
| `--bet-action-ink` | `#FFFFFF` | Text on midnight blue |
| `--bet-action-text` | `#9CC3FF` | Text actions (`結算`) |
| `--bet-nav-active` | `#9CC3FF` | Active bottom-nav label/indicator |
| `--bet-action-border` | `#7FB6FF` | Ice-blue rim for dark actions and focus |
| `--bet-action-soft` | `rgba(23, 59, 107, 0.32)` | Switch tint, retry wash |
| `--bet-action-line` | `rgba(127, 182, 255, 0.5)` | Switch/retry borders |
| `--bet-info` | `#7FB6FF` | Leg indices, secondary blue detail |
| `--bet-win` | `#49D18A` | Profit, win |
| `--bet-loss` | `#FF6B6B` | Loss, destructive |
| `--bet-pending` | `#F5C842` | Pending / waiting |
| `--bet-push` | `#9FB0BF` | Push / neutral |
| `--bet-cash-out` | `#F5C842` | Early payout (`派彩快`) |
| `--bet-type-bg` / `--bet-type-ink` | `#173C5C` / `#8FC1FF` | Type badge |
| `--bet-header-bg` | `linear-gradient(135deg, #0A1B45, #0D2A54)` | Header |
| `--bet-summary-bg` | blue radial + `linear-gradient(135deg, #123A68, #0C2440)` | Summary hero |
| `--bet-scrim` | `rgba(2, 8, 16, 0.82)` | Dialog backdrop |
| `--bet-accent-glow` | `rgba(245, 200, 66, 0.10)` | Gold wash |
| `--bet-pitch-line` | `rgba(120, 170, 255, 0.045)` | Cool grid |
| `--bet-shadow` | `0 18px 48px rgba(0, 0, 0, 0.4)` | Sheets/toasts |
| `--bet-card-shadow` | `0 8px 24px rgba(0, 0, 0, 0.16)` | Bet cards |
| `--bet-cta-shadow` | `0 10px 24px rgba(23, 59, 107, 0.3), inset 0 0 0 1px rgba(127, 182, 255, 0.5)` | Primary CTA |

Contrast rules: text ≥ 4.5:1 on its surface; UI boundaries ≥ 3:1; never rely on colour alone. Money always carries a sign; results always carry a text label. `--bet-line` and `--bet-line-strong` are decorative hairlines (they fall below 3:1 by design); every interactive control border uses `--bet-control-line`, so the UI-boundary rule holds for controls. Focus stays on `--bet-action-border`; selected chips use the midnight action fill, ice rim, and `--bet-action-ink` text.

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
- **Header**: pitch mark, `Tally` wordmark, 「賭球」 sub, pending chip (待結算 + count), 「麻雀」 switch pill.
- **Nav**: two tabs, 注單 / 統計; electric-blue active bar, not a mahjong pill.
- **Summary**: 2 scoreboard cells; last 30 days and last 90 days profit. Pending count moves to the header chip.
- **CTA**: full-width midnight-blue pill/square with ice rim, `匯入 HKJC`; HKJC import is the only add path.
- **Buttons**: primary = midnight-blue fill + ice border + `--bet-action-ink` text; danger = `--bet-loss` fill + `--bet-accent-ink` text (high contrast, clears the 4.5:1 body-text rule); ghost/outline keep token borders.
- **Filters**: 全部 / 待結算 / 已結算; selected uses midnight fill, ice border, and `--bet-action-ink` text.
- **Bet card**: type badge, record time, result badge; numbered legs `01/02`; dotted separators; stake / total odds / profit footer; pending card has a `結算` text action. Imported `cash_out` cards show a `派彩快` badge and actual P/L, open the edit form, and have a delete action.
- **Sheet**: full-screen for the bet form; bottom sheet for confirmation. Native `<dialog>` + focus trap + Escape.
- **HKJC import sheet**: full-screen sheet with a file picker and local-only privacy note; summary counts for importable, duplicate, and warning rows; preview cards with an editable result select and a `已存在` duplicate badge; cash-out rows show `派彩快` + actual P/L with a locked result; no-payout rows default to 輸; sticky footer with cancel/import.
- **Form**: edit/settle only; date, leg fieldsets, market chips, result chips (including `派彩快`), conditional 派彩金額 input, total-odds readout, profit preview, sticky footer.
- **Stats**: last30/year/all period segmented control, hero P/L, 2×2 KPI, type rows, market diverging bars, 6-month CSS column chart, biggest win/loss cards.
- **States**: `.bet-empty`, `.bet-inline-error`, `.bet-skeleton*`, `.bet-toast*`, `.bet-banner`.

## 6. Motion

- 120–180ms; `--bet-ease: cubic-bezier(0.23, 1, 0.32, 1)`.
- Sheet slides up; page fades/slides 4px; bars grow on mount; number updates may flash once.
- Under `prefers-reduced-motion: reduce`, disable all transforms/animations.

## 7. Accessibility

- Focus ring: 2px `--bet-action-border`, 2px offset, only `:focus-visible`.
- Dialog focus trap, Escape close, focus return to trigger, body scroll lock.
- `aria-live="polite"` for toast and profit preview; `role="alert"` for inline errors.
- Inputs have visible labels; errors use `aria-invalid` and text.
- Charts have text alternatives (`aria-label` and numbers).

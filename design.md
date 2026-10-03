# DESIGN.md — ApplyForME design system

Product name: **ApplyForME**. The brand comes from the logo: a dynamic red "A" ribbon, a resume card in motion, and a rising arrow. The feeling is **speed, progress, confidence**.

The agent must use **only** the tokens in this file. No hardcoded hex values in components: use CSS variables. If a new color is needed, add a token here first (in its own PR).

> **Both modes are mandatory from the first screen.** Every component, page and state must work in **Light** and **Dark** mode from day one. Never build "light first, dark later". See §3 and §11.

---

## 1. Logo

File: `apps/web/src/assets/brand/logo.png` (the uploaded `Logo_ApplyForME_rouge_et_dynamique.png`).

| Part of logo | Color (approx.) | Role |
|---|---|---|
| Bright red ribbon / arrow | `#F01420` | Brand red, decorative and large shapes |
| Deep red shading | `#B30D17` | Depth, hover |
| Maroon wordmark "ApplyFor" | `#7A0610` | Headings accent |
| Bright red "ME" | `#E8101E` | Highlight |
| White card | `#FFFFFF` | Surfaces |

Rules:
- Clear space around the logo = height of the letter "A" stem. Minimum width 120px (full logo), 28px (icon only).
- Do not stretch, recolor, rotate, add shadows, or place it on busy backgrounds.
- **Light mode:** use the logo as is on `--color-surface` / `--color-bg`.
- **Dark mode:** the maroon wordmark has low contrast on dark. Use a dark-mode variant: icon unchanged, wordmark in `#F5ECEC`, "ME" in `#FF4D57`. Until the variant exists, show the logo on a white rounded chip (`border-radius: 12px; padding: 8px`).
- **To do (asset task):** export the logo as transparent **SVG** in three files: `logo-full.svg`, `logo-full-dark.svg`, `logo-icon.svg` (only the "A" mark, for favicon, app icon and the loading page). Create the favicon (16/32/180/512) from the icon.

---

## 2. Color tokens

### 2.1 Brand scale (reference only, components do not use these directly)

| Token | Hex | Note |
|---|---|---|
| `--brand-50` | `#FEF2F2` | Tints, soft backgrounds |
| `--brand-100` | `#FDE3E4` | |
| `--brand-300` | `#F7898F` | |
| `--brand-500` | `#D6101C` | **Primary** (5.3:1 on white) |
| `--brand-600` | `#B30D17` | Hover |
| `--brand-700` | `#8F0A12` | Active/pressed |
| `--brand-900` | `#7A0610` | Logo maroon |
| `--brand-logo` | `#F01420` | Illustrations and big decorative shapes only, **never for small text** |

### 2.2 Light theme (`:root`, `[data-theme="light"]`)

| Token | Hex | Use |
|---|---|---|
| `--color-bg` | `#FAF7F7` | App background (warm white) |
| `--color-surface` | `#FFFFFF` | Cards, dialogs, forms |
| `--color-surface-alt` | `#F5EEEE` | Inputs, table stripes, hover |
| `--color-border` | `#E8DCDC` | Borders, dividers |
| `--color-text` | `#1A0A0C` | Main text |
| `--color-text-muted` | `#5C4A4C` | Secondary text (8:1 on white) |
| `--color-primary` | `#D6101C` | Links, icons, focus ring, outline buttons |
| `--color-primary-fill` | `#D6101C` | Primary button background |
| `--color-primary-hover` | `#B30D17` | Hover/active |
| `--color-primary-soft` | `#FEF2F2` | Selected rows, soft badges |
| `--color-on-primary` | `#FFFFFF` | Text on primary fill |
| `--color-success` | `#15803D` | Applied, high match |
| `--color-success-soft` | `#DCFCE7` | |
| `--color-warning` | `#B45309` | Manual action, low match |
| `--color-warning-soft` | `#FEF3C7` | |
| `--color-danger` | `#9F1239` | Errors, destructive actions (crimson/rose, distinct from brand red) |
| `--color-danger-soft` | `#FFE4E6` | |
| `--color-info` | `#0369A1` | In progress, medium match |
| `--color-info-soft` | `#E0F2FE` | |
| `--color-focus-ring` | `rgba(214,16,28,.35)` | 3px focus ring |
| `--color-scrim` | `rgba(26,10,12,.72)` | Video overlay scrim (dark warm black) |
| `--color-scrim-strong` | `rgba(26,10,12,.85)` | Stronger scrim for text contrast |
| `--color-scrim-soft` | `rgba(26,10,12,.45)` | Softer scrim for subtle overlay |

### 2.3 Dark theme (`@media (prefers-color-scheme: dark)` and `[data-theme="dark"]`)

| Token | Hex | Use |
|---|---|---|
| `--color-bg` | `#0F0A0B` | App background (warm near-black) |
| `--color-surface` | `#181112` | Cards, dialogs |
| `--color-surface-alt` | `#231A1B` | Inputs, hover |
| `--color-border` | `#3A2C2E` | Borders |
| `--color-text` | `#F5ECEC` | Main text |
| `--color-text-muted` | `#B5A3A5` | Secondary text |
| `--color-primary` | `#FF4D57` | Links, icons, outline buttons (6:1 on bg) |
| `--color-primary-fill` | `#E11D2B` | Primary button background |
| `--color-primary-hover` | `#F0404B` | Hover |
| `--color-primary-soft` | `#2A1114` | Selected rows, soft badges |
| `--color-on-primary` | `#FFFFFF` | Text on primary fill |
| `--color-success` | `#4ADE80` | |
| `--color-success-soft` | `#12301F` | |
| `--color-warning` | `#FBBF24` | |
| `--color-warning-soft` | `#3A2A0A` | |
| `--color-danger` | `#FB7185` | |
| `--color-danger-soft` | `#3F1220` | |
| `--color-info` | `#38BDF8` | |
| `--color-info-soft` | `#0C2A3D` | |
| `--color-focus-ring` | `rgba(255,77,87,.45)` | |
| `--color-scrim` | `rgba(15,10,11,.75)` | Video overlay scrim (dark warm black) |
| `--color-scrim-strong` | `rgba(15,10,11,.88)` | Stronger scrim for text contrast |
| `--color-scrim-soft` | `rgba(15,10,11,.5)` | Softer scrim for subtle overlay |

Why two primary tokens: a saturated red works as a button background in both modes but is too dark for text/icons on a dark background, so text/icons use `--color-primary` and buttons use `--color-primary-fill`.

Put tokens in `apps/web/src/styles/_tokens.scss` (one block per theme) and map them to the Angular Material theme (both a light and a dark Material theme, switched by `[data-theme]`).

### 2.4 Red vs red: avoiding confusion

The brand is red, so errors must not look like a "normal" red button.
- **Primary actions** = solid brand red button, no icon needed.
- **Errors / destructive** use `--color-danger` (crimson/rose), always with an **icon (⚠ / ✕) and a text message**, and destructive buttons are **outlined** with a confirmation dialog.
- Never show success/warning/error by color alone.

### 2.5 Gradient (brand accent, use sparingly)

`--gradient-brand: linear-gradient(135deg, #D6101C 0%, #A50B15 100%)` (dark mode: `#E11D2B → #B30D17`).
Allowed only on: the main CTA button, the hero banner on login/register, and the top of the loading page. White text on it must keep ≥ 4.5:1.

---

## 3. Light / Dark mode (required)

1. **Three options:** `System` (default), `Light`, `Dark`. Toggle in the top bar and in Settings.
2. **Default follows the OS** via `prefers-color-scheme`; a manual choice overrides it and is saved in `localStorage` (wrapped in try/catch) as `theme = 'system' | 'light' | 'dark'`.
3. **No flash on load:** set `color-scheme: light dark` in CSS and a matching `<meta name="color-scheme">`; apply `data-theme` on `<html>` in the app initializer (`APP_INITIALIZER`) and use the CSS media query as the base style. Do **not** add an inline script (our CSP forbids it, see `security.md`).
4. `ThemeService` (in `core/layout/`) exposes a Signal `theme()` and `effectiveTheme()`; it listens to OS changes when on `System`.
5. Everything uses tokens. A component with a hardcoded color fails review.
6. Images/illustrations: provide light and dark versions when needed (logo, empty states). Charts/icons use `currentColor` or tokens.
7. Smooth transition of `background-color` and `color` (150 ms), disabled with `prefers-reduced-motion`.
8. Test both modes (see §11).

---

## 4. Meaning of colors (same in both modes)

| Meaning | Token | Where |
|---|---|---|
| Primary action | `primary-fill` | "Run search", "Apply", "Save" |
| Match score ≥ 75 | `success` | Score badge |
| Match score 50–74 | `info` | Score badge |
| Match score < 50 | `warning` | Score badge |
| Job status `new` | `primary-soft` + `primary` text | Card badge |
| Job status `saved` | `info-soft` + `info` | Card badge |
| Job status `applied` | `success-soft` + `success` | Card badge |
| Job status `skipped` | `surface-alt` + `text-muted` | Card badge |
| Apply method `manual` | `warning-soft` + `warning` | Badge + "View report" |
| Run failed / scraper error | `danger-soft` + `danger` | Alerts (with icon) |
| Run in progress | `info` | Progress bar |

---

## 5. Typography

- Headings font: **Poppins** (600/700): rounded geometric shapes echo the logo wordmark.
- Body font: **Inter** (400/500/600).
- Fallback: `system-ui, -apple-system, Segoe UI, Roboto, sans-serif`. Self-host the fonts (no third-party CDN, see `security.md`).
- Sizes: `12 / 14 / 16 / 20 / 24 / 32 / 40 px`. Body 16px, line-height 1.5.
- H1 32–40/700, H2 24/600, H3 20/600.
- Wordmark style in the UI: "Apply For" in `--color-text`, "ME" in `--color-primary` (mirrors the logo).

---

## 6. Spacing, shape, elevation, motion

- Spacing scale (8px base): `4, 8, 12, 16, 24, 32, 48, 64`.
- Radius: inputs/buttons `10px`, cards `14px`, badges `999px`, dialogs `16px`.
- Border: `1px solid var(--color-border)`.
- Elevation: light mode uses soft shadows `0 1px 2px rgba(26,10,12,.06), 0 6px 16px rgba(26,10,12,.06)`; dark mode uses **borders and a slightly lighter surface** instead of shadows.
- Max content width 1200px.
- **Motion = "dynamic" like the logo:** quick (150–250 ms), ease-out, small upward slide + fade for cards, a subtle diagonal "swoosh" on the progress bar, arrow icon nudging on the primary CTA hover. All disabled with `prefers-reduced-motion`.

---

## 7. Components

### Buttons
- **Primary:** `primary-fill` background (or `--gradient-brand` for the main CTA), `on-primary` text, hover `primary-hover`, pressed `brand-700`.
- **Secondary:** transparent, 1px `primary` border, `primary` text.
- **Ghost:** text only. **Destructive:** outlined with `danger`, needs confirmation.
- Height 44px (40px compact), padding 0 18px, font 500. Disabled: 50% opacity. Loading: spinner + disabled.
- One primary button per section.

### Inputs
- Height 44px, `surface-alt` background, `border` 1px; focus: `primary` border + 3px `focus-ring`.
- Error: `danger` border + icon + message below.

### Job card
```
┌──────────────────────────────────────────┐
│ [Company initial]   Title                │  title 16/600, 2 lines max
│ Company · Location · 🇹🇳                  │  muted 14px
│                                          │
│ Short description (3 lines max)          │
│                                          │
│ [Score 82]  [New]  [Manual apply]        │
│ ──────────────────────────────────────── │
│ [Open site]  [Apply  →]          ⋯ menu  │
└──────────────────────────────────────────┘
```
- Left 4px accent bar colored by score level (success/info/warning).
- Top 3 cards get a "Best match" badge (`primary-soft` + `primary`) with a small rising-arrow icon (echoes the logo).
- Grid: 3 columns ≥1200px, 2 ≥768px, 1 on mobile; gap 16px.
- Loading: skeleton cards. Empty state: illustration (light/dark versions) + sentence + primary button.

### Queue progress panel
- Stepper: Resume → Planning → Scraping → Matching → Done. Current = `info`, done = `success`, failed = `danger` (with icon).
- Live counters (found / matched / failed), collapsible log with no sensitive data, `aria-live="polite"`.

### Application Report page
- Header: title, company, score badge, status badge, "Mark as applied".
- Collapsible sections in order: **Summary → How to apply (numbered) → Documents needed → Prepared answers (copy buttons) → Contact & deadline → Direct link**.
- Warning banner when the method is `manual`. Secondary button "Export PDF".

### Loading page
- Centered **icon-only logo** with a gentle pulse + indeterminate brand progress bar and "Checking your session…". Background `--color-bg`. Max display until `/me` answers, then redirect.

### Login / Register
- Split layout on desktop: left brand panel (`--gradient-brand`, white text, logo icon, short tagline such as "Your next job, applied for you."), right card (max 420px) with the form. On mobile: only the card with the logo on top.
- Show/hide password toggle, inline validation on blur, link to the other page.

### Top bar / navigation
- Logo left, nav (Dashboard, Resume, Preferences, Reports, Settings), theme toggle, user menu. Active item: `primary` text + 2px underline. Mobile: bottom navigation.

---

## 8. Layout

- Dashboard: filter bar (country, score, status, search) above the card grid.
- Mobile first: filters in a drawer, single column cards, 44px touch targets.

---

## 9. Accessibility (required in both modes)

- Text contrast ≥ 4.5:1 (large text ≥ 3:1) in **light and dark**; the tokens above were chosen for this. Do not change them without re-checking.
- Visible focus ring everywhere; full keyboard navigation.
- Labels on all fields, `aria-live` for toasts/progress, `alt` text, icons with labels.
- Respect `prefers-reduced-motion` and `prefers-contrast`.
- Don't rely on color alone.

---

## 10. Tone of voice (UI text)

Short, positive, action-oriented. Examples: "We found 24 jobs for you", "Ready to apply?", "This one needs a manual step, here's how." Avoid jargon and blame in error messages.

---

## 11. Definition of done for any UI work

```
[ ] Uses tokens only (no hex in components)
[ ] Looks correct in Light mode
[ ] Looks correct in Dark mode
[ ] Works with the System setting and manual override
[ ] Contrast checked in both modes (axe: 0 violations)
[ ] Keyboard and screen reader checked
[ ] Responsive (mobile, tablet, desktop)
[ ] Loading, empty and error states designed
[ ] Reduced-motion respected
[ ] Playwright screenshot tests for both themes updated
```

Tests: component tests run with each theme; E2E runs the critical flow once in Light and once in Dark; Playwright visual snapshots for login, dashboard, card, and report in both themes; `@axe-core/playwright` on every page in both themes.

---

## 12. Do / Don't

- Do reuse `shared/ui` components. Don't create a second button or card style.
- Do use red with intention: primary actions, key highlights, the arrow motif. Don't fill whole pages with red.
- Do keep generous white space and calm neutrals so the red stands out.
- Don't use `--brand-logo` for small text.
- Don't ship a screen that was tested in only one theme.

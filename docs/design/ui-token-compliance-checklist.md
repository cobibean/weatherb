# UI Token Compliance Checklist

Goal: ensure every visual choice is driven by tokens or shared utilities, not ad-hoc inline styles.

## Global Requirements (All Components)
- Colors use Tailwind theme tokens (e.g., `sky`, `sunset`, `cloud`, `neutral`, `success`, `error`) or CSS variables from `:root` in `apps/web/src/app/globals.css`.
- No raw hex values in JSX/TSX `style` objects unless the value already exists as a token.
- No Tailwind default palette values (`slate`, `emerald`, `rose`, `amber`) unless explicitly added to the project’s palette.
- Shadows use Tailwind `boxShadow` tokens (e.g., `shadow-glass`, `shadow-sunset`) or shared utility classes.
- Gradients use global classes (`.gradient-*`, `.text-gradient-*`) or Tailwind `from/to` tokens defined in config.
- Spacing uses Tailwind scale or shared utilities; avoid custom `px` in inline styles.
- Motion uses shared timing functions/animation utilities when possible (`ease-*`, `animate-*`).

## Checklist By Component (Public App)

### `apps/web/src/components/markets/hero-carousel.tsx`
- Replace inline text shadows with a tokenized class (e.g., `.hero-title`, `.hero-subtitle`).
- Replace inline pink text color with token (e.g., `text-sunset-pink` or `.text-gradient`).
- Ensure gradients/overlays align with palette (no raw rgba unless in globals).

### `apps/web/src/components/markets/hero-card.tsx`
- Ensure all text colors map to `neutral` tokens.
- Confirm any gradients, borders, and shadows map to global utility classes.
- Ensure countdown and odds display use tokenized styles.

### `apps/web/src/components/markets/market-card.tsx`
- Verify hover effects use shared transition tokens.
- Ensure button variants use `InteractiveHoverButton` variants that map to defined palette tokens.

### `apps/web/src/components/markets/odds-display.tsx`
- Replace any inline `style` blocks with tokenized classes or CSS variables.
- Ensure gradient colors are derived from `sky` / `sunset` tokens.
- Confirm particle colors are token-based.

### `apps/web/src/components/markets/bet-modal.tsx`
- Replace `slate`, `emerald`, `rose`, `amber` Tailwind defaults with custom palette tokens.
- Replace gradient backgrounds with theme tokens (likely `sky`/`sunset` + `success`/`error`).
- Ensure input focus ring matches `.focus-ring` or uses tokenized colors.

### `apps/web/src/components/markets/countdown.tsx`
- Confirm all colors use `neutral`/`sunset` tokens.

### `apps/web/src/components/layout/header.tsx`
- Ensure nav hover, focus, and text colors are tokenized.
- Replace any raw values with `neutral`/`sky` tokens.

### `apps/web/src/components/layout/footer.tsx`
- Confirm borders, backgrounds, and text colors use theme tokens.

### `apps/web/src/app/positions/page.tsx`
- Ensure `btn-primary` / `card-hero` usage aligns with globals and does not introduce new hex values.

## Checklist By Component (Shared UI)

### `apps/web/src/components/ui/particle-system.tsx`
- Move inline `style` gradients/shadows into CSS utilities or tokenized classes.
- Ensure cloud/sparkle colors only use theme tokens.

### `apps/web/src/components/ui/temperature-display.tsx`
- Replace inline glass background + borders with `.glass` / `.liquid-glass` or tokenized utilities.
- Ensure hover/underline colors use theme tokens.

### `apps/web/src/components/ui/threshold-tooltip.tsx`
- Replace inline gradient and border colors with tokenized utilities.
- Ensure background + border colors match theme palette.

### `apps/web/src/components/ui/interactive-hover-button.tsx`
- Verify all classes referenced exist in Tailwind config.
- Replace `sky-dark`, `sunset-peach` with defined palette tokens or add them to config.

### `apps/web/src/components/ui/button.tsx`
- Decide whether to re-theme or remove if unused.
- If kept, re-map `slate-*` to project palette.

## Checklist By Component (Admin UI)

### `apps/web/src/components/admin/*`
- Replace default `slate` usage with custom palette tokens.
- Ensure buttons and badges use `sky`, `sunset`, `success`, `error` tokens consistently.

### `apps/web/src/app/admin/(dashboard)/**`
- Remove inline colors where possible.
- Align all cards, badges, and toggles to global palette.

## Acceptance Criteria
- No raw hex in TSX except in token definitions.
- No Tailwind default palette usage unless intentionally added to the project palette.
- Visual consistency across public and admin UIs.

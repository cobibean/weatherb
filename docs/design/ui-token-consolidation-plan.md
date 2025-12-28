# UI Token Consolidation Plan (Diff-Oriented)

Purpose: provide a focused, actionable plan for replacing hardcoded styles with tokens/utilities.

## Phase 0: Baseline + Inventory
- Use `rg "style=\{\{" apps/web/src -g '*.tsx'` to list inline style blocks.
- Use `rg "#" apps/web/src -g '*.tsx'` to find hardcoded hex values.
- Use `rg "slate-|emerald-|rose-|amber-" apps/web/src -g '*.tsx'` to find default Tailwind palette usage.
- Review `apps/web/tailwind.config.ts` and `apps/web/src/app/globals.css` to confirm the authoritative palette.

## Phase 1: Define Missing Tokens
Add or map missing tokens so replacements are straightforward.
- Add any missing semantic colors to `apps/web/tailwind.config.ts`:
  - If keeping `success`/`error`, ensure variants exist for light/dark backgrounds (e.g., `success.soft`, `error.soft`).
  - If `sky-dark` or `sunset-peach` are used, add them or replace with existing `sky-deep`/`sunset-orange`.
- Update `apps/web/src/app/globals.css` to include any new CSS vars or utilities.

## Phase 2: Replace Inline Styles with Utilities

### Hero / Marketing Surface
- `apps/web/src/components/markets/hero-carousel.tsx`
  - Replace inline `textShadow` with `.hero-title` / `.hero-subtitle` utilities in `globals.css`.
  - Replace inline pink highlight with `text-sunset-pink` or `.text-gradient`.

### Tooltips + Micro UI
- `apps/web/src/components/ui/temperature-display.tsx`
  - Move inline `background`, `border`, `backdropFilter` to a new utility class (e.g., `.tooltip-glass`).
- `apps/web/src/components/ui/threshold-tooltip.tsx`
  - Replace inline gradient/background with tokenized utility class (e.g., `.tooltip-sky`).

### Particles / Effects
- `apps/web/src/components/ui/particle-system.tsx`
  - Create utility classes for cloud and sparkle styles (background, shadow, blur) and use tokens.

### Odds Display
- `apps/web/src/components/markets/odds-display.tsx`
  - Replace inline styles (if any remain) with tokenized classes.
  - Ensure gradients use `sky`/`sunset` tokens from Tailwind config.

## Phase 3: Replace Default Tailwind Palette Usage

### Bet Modal
- `apps/web/src/components/markets/bet-modal.tsx`
  - Replace `slate-*` with `neutral-*`.
  - Replace `emerald-*` with `success-*`.
  - Replace `rose-*` with `error-*` or `sunset-*`.
  - Replace `amber-*` with `sunset-*`.

### Admin UI
- `apps/web/src/components/admin/*`
  - Replace `neutral`/`slate` mixing with consistent palette.
  - Make status badges match public UI token usage.

### Shadcn Button
- `apps/web/src/components/ui/button.tsx`
  - If used, re-theme to `sky`/`sunset`/`neutral` tokens.
  - Otherwise remove or keep out of public surfaces.

## Phase 4: Normalize Global Utilities
- Consolidate repeated patterns into `globals.css`:
  - `.tooltip-glass`, `.badge-success`, `.badge-error`, `.input-glass`, `.button-primary`, etc.
- Ensure all custom utilities align with Tailwind config tokens.

## Phase 5: QA + Regression Sweep
- Search for remaining hex values and default palette classes.
- Verify any visual regressions or contrast changes.
- Confirm no inline `style` blocks remain except for layout math (e.g., motion transforms).

## Deliverables
- Updated `apps/web/tailwind.config.ts` (tokens).
- Updated `apps/web/src/app/globals.css` (utilities).
- Updated components replacing inline styles or default palette usage.

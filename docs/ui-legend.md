# WeatherB UI Legend (Current State)

## Scope
This document maps how UI, styling, and visual theming are implemented in the repo today. It is meant to be a quick handoff for another agent to understand where design decisions live and how consistently they are applied.

## UI Entry Points
- Public app: `apps/web/src/app/page.tsx` renders `HomeClient` with hero + market grid + bet modal.
- Positions placeholder: `apps/web/src/app/positions/page.tsx`.
- Admin app: `apps/web/src/app/admin/(dashboard)/layout.tsx` wraps admin routes with sidebar + header.
- Global root layout: `apps/web/src/app/layout.tsx` (fonts, globals, providers).

## Styling Stack (What’s Actually Used)
- Tailwind CSS + custom config: `apps/web/tailwind.config.ts`.
- Global CSS layer: `apps/web/src/app/globals.css` (design tokens + shared classes).
- Framer Motion: for transitions, list reveals, particles (`apps/web/src/components/**`).
- Thirdweb theme overrides: `apps/web/src/components/layout/wallet-button.tsx`.
- Shadcn baseline config exists but is minimally used: `apps/web/components.json`.

## Theme / Token Sources
- Design spec: `docs/design-system.md` ("Nostalgic Futurism").
- Tailwind tokens (colors, fonts, shadows, animations): `apps/web/tailwind.config.ts`.
- CSS variables + reusable classes: `apps/web/src/app/globals.css`.
- Fonts: `apps/web/src/app/layout.tsx` defines Sora + Plus Jakarta as CSS variables and Tailwind families.

### Tailwind Extensions (High-Level)
- Colors: custom `sky`, `cloud`, `sunset`, `success`, `error`, `neutral`.
- Fonts: `font-display`, `font-body`, `font-mono`.
- Shadows: `glass`, `glass-lg`, `sunset`, `sunset-lg`.
- Animations: `float`, `pulse-soft` and easing curves.

### Global CSS Utility/Component Classes
Defined in `apps/web/src/app/globals.css` and used across the app:
- Surfaces: `.glass`, `.liquid-glass`, `.card`, `.card-hero`.
- Buttons: `.btn-primary`, `.btn-secondary`, `.btn-glass`.
- Layout accents: `.header-floating`, `.grain-overlay`.
- Text: `.text-gradient`, `.text-gradient-warm`, `.hero-title`, `.hero-subtitle`.
- A11y: `.focus-ring`.
- Thirdweb override: `.interactive-login-button` (heavy `!important` styles).

## Component Map (Where Visual UI Lives)

### Public Site
- Layout: `apps/web/src/components/layout/header.tsx`, `apps/web/src/components/layout/footer.tsx`.
- Hero: `apps/web/src/components/markets/hero-carousel.tsx`, `apps/web/src/components/markets/hero-card.tsx`.
- Market Grid: `apps/web/src/components/markets/market-grid.tsx`, `apps/web/src/components/markets/market-card.tsx`.
- Odds: `apps/web/src/components/markets/odds-display.tsx`.
- Betting modal: `apps/web/src/components/markets/bet-modal.tsx`.
- Countdown: `apps/web/src/components/markets/countdown.tsx`.

### Shared UI Primitives
- Animated button: `apps/web/src/components/ui/interactive-hover-button.tsx`.
- Particles: `apps/web/src/components/ui/particle-system.tsx`.
- Tooltip + temperature display: `apps/web/src/components/ui/threshold-tooltip.tsx`, `apps/web/src/components/ui/temperature-display.tsx`.
- Shadcn-style button base (currently unused): `apps/web/src/components/ui/button.tsx`.

### Admin UI
- Shell: `apps/web/src/components/admin/sidebar.tsx`, `apps/web/src/components/admin/header.tsx`.
- Cards + controls: `apps/web/src/components/admin/stat-card.tsx`, `apps/web/src/components/admin/emergency-controls.tsx`.
- Color palette demo: `apps/web/src/components/admin/color-palette.tsx`.
- Admin pages: `apps/web/src/app/admin/(dashboard)/**`.

## Asset and Visual Resources
- Backgrounds: `apps/web/public/backgrounds/hero-clouds.jpg` (used in hero).
- Textures: `apps/web/public/textures/paper-grain.jpg`, `apps/web/public/textures/halftone-blue.jpg`.
- Particle references: `apps/web/public/particles/cloudsvg1.svg` (documented but currently unused; particles are CSS-based).
- Asset usage guide: `apps/web/public/ASSETS_README.md`.

## How Styling Is Applied (Patterns)
- Primary styling is in Tailwind class strings inside components.
- Shared “design system” classes live in `globals.css` (glass, buttons, cards, gradients).
- Framer Motion is used for most transitions, hover effects, and reveal animations.
- Some components use inline `style` objects with hardcoded values rather than tokenized classes.

## Hardcoded Styling Hotspots (Not Tokenized)
These components use inline styles or default Tailwind colors rather than the custom palette:
- Hero text shadows + pink highlight: `apps/web/src/components/markets/hero-carousel.tsx`.
- Tooltip glass backgrounds + borders: `apps/web/src/components/ui/temperature-display.tsx`.
- Tooltip header gradient: `apps/web/src/components/ui/threshold-tooltip.tsx`.
- Particle gradients and shadows: `apps/web/src/components/ui/particle-system.tsx`.
- Odds display has some inline `style` blocks: `apps/web/src/components/markets/odds-display.tsx`.
- Wallet button details style (Thirdweb): `apps/web/src/components/layout/wallet-button.tsx`.
- Bet modal uses Tailwind default palette (slate/emerald/rose/amber): `apps/web/src/components/markets/bet-modal.tsx`.
- Admin palette chart uses direct hex values: `apps/web/src/components/admin/color-palette.tsx`.

## Design-System Drift / Inconsistencies
- Tokens are duplicated: hex values exist in both `apps/web/tailwind.config.ts` and `apps/web/src/app/globals.css`, but Tailwind does not consume the CSS variables.
- `docs/design-system.md` specifies system fonts, but production uses Sora + Plus Jakarta from `apps/web/src/app/layout.tsx`.
- Shadcn config uses `baseColor: slate` and includes a default `Button` in `apps/web/src/components/ui/button.tsx`, but the app largely uses custom buttons instead.
- `InteractiveHoverButton` references colors not defined in Tailwind (`sky-dark`, `sunset-peach`) so those hover styles may not compile.
- Admin pages and the bet modal mix custom palette with Tailwind default colors (`slate`, `emerald`, `rose`, `amber`).

## If You Need to Tighten the Design System
- Update core tokens in `apps/web/tailwind.config.ts` and keep `apps/web/src/app/globals.css` in sync.
- Move inline hardcoded styles into Tailwind classes or global utilities.
- Decide whether to keep or replace the shadcn-style `Button` and align it with the custom palette.
- Normalize color usage in `apps/web/src/components/markets/bet-modal.tsx` and admin pages if you want a single, strict palette.

## Related Docs
- Spec: `docs/design-system.md`.
- Epic UI audit: `docs/epics/epic-5-ui-audit-report.md`.

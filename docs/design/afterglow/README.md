# weatherB — selected Afterglow direction and asset kit

Recorded September 19, 2026. The user selected the dusk hero (original option 3), accepted the multi-market revision, and selected the outlined button treatment (latest option 3). They requested the solid blue and rose colors from button option 1 on hover, and authorized preparing the redesign assets. This records the accepted direction; application integration has not started.

## Selected visual direction

- Immersive midnight-blue dusk hero with warm coral clouds and a low skyline. White, precise typography, pink weatherB wordmark, and restrained translucent navigation/outcome controls.
- The temperature condition is the main emphasis. Betting-close countdown and resolution timestamp are separate; closing occurs ten minutes before resolution.
- Support 1–10 simultaneously open markets in the interface. This does not change contract limits or creation schedules.
- Multiple markets: persistent previous/next controls, position/count, and direct selectors identified by city plus threshold (include resolution time when needed to distinguish markets). Horizontally scroll selectors on narrow screens. Manual navigation, swipe on mobile, stable selection during a betting decision; no automatic carousel rotation.
- Below the hero: smooth transition to solid navy, a compact all-active-market grid, collapsed Past Markets, then minimal footer. Cards use stable dark surfaces with fine borders rather than scenic images/glass on every card. Mark the hero's selected card as featured. The view-all scroll link belongs above the collection, not inside the section it targets.
- With one market: hide unnecessary carousel controls and omit the redundant active-market grid. For zero markets, preserve a clear empty state without invented fixtures.
- Reference images contain illustrative market data, not live prices/times or a source for business logic. Some generated dates/text have errors; canonical domain rules take precedence.

## Button direction

Approved: outlined navy at rest; equal emphasis for YES and NO; solid blue/rose fills on hover. No candy gradients, gloss, sliding labels, bounce, or layout movement.

The following exact tokens and mechanics are prepared implementation defaults, not separately user-selected pixel values:

| Property | YES | NO |
| --- | --- | --- |
| Rest fill | `#142333` | `#142333` |
| Rest label | `#C7E5F5` | `#F2D6DF` |
| Rest outline | `#648DA6` | `#A67F8C` |
| Hover/focus fill | `#2864AD` | `#A44762` |
| Hover/focus label | `#FFFFFF` | `#FFFFFF` |
| Pressed fill | `#20538F` | `#893B52` |

Keyboard focus uses the hover fill plus a separate white focus ring. Fine-pointer hover transitions color/background/border over 160ms; reduced motion removes transitions. Touch uses pressed feedback without requiring hover. Hero target height is at least 48px, grid target height at least 44px. Medium-weight type, 10px hero and 8px compact corner radii. Unavailable/submitting states remain distinguishable; application integration must guard activation when using `aria-disabled`, which alone does not block events.

## Assets delivered

Runtime images are under `apps/web/public/backgrounds/afterglow/`:

| File | Actual dimensions | Size |
| --- | --- | --- |
| `hero-desktop-1672.webp` | 1672 × 941 | 95,508 bytes |
| `hero-desktop-1024.webp` | 1024 × 576 | 46,824 bytes |
| `hero-mobile-941.webp` | 941 × 1672 | 78,792 bytes |
| `hero-mobile-640.webp` | 640 × 1137 | 45,438 bytes |

The WebP exports use quality 82. There is no artificial upscaling. The generator returned smaller masters than the requested targets; these are not 2560px/4K assets. The 1672px desktop image supports the selected desktop composition; larger/retina presentations still need visual acceptance in the actual application.

This directory contains:

- `sources/hero-desktop.png` and `sources/hero-mobile.png`: original generated masters.
- `references/selected-hero-and-market-grid.png`: selected page composition.
- `references/selected-button-rest.png`: user's selected button reference.
- `references/selected-button-hover-colors.png`: solid color reference for hover.
- `references/button-state-sheet.png`: captured CSS preview with keyboard focus.
- `theme.css`: scoped color/type/control tokens and all button states, not imported by the application.
- `index.html`: functional hover/focus/press reference and background gallery, with no wallet or transaction actions.
- `preview.py`: loopback-only preview server for these files and backgrounds.
- `prompts.md`: exact desktop/mobile prompts; built-in image_gen was used.

## Integration guidance

Use the portrait composition below approximately 640px, the landscape above it, and select the appropriate resolution through `picture`/`srcset` or the application's image system. Use actual export widths as source descriptors, not the initially requested dimensions. Keep the background decorative (`alt=""` / `aria-hidden` as appropriate), provide a solid `#071827` fallback, and overlay a subtle bottom fade to the same page color. Start with centered object positioning, then check the real content at each breakpoint. Do not bake any controls, labels, odds, wordmarks, or glass panels into the image.

This is a shared stylized dusk atmosphere, not a claim that the skyline depicts the selected city or its current weather. Do not recolor/rebuild the scene on market change. Geographic city-specific backgrounds would be a separate asset expansion.

No further raster assets are required for this direction. Keep the wordmark as text using the existing brand treatment; use native system sans text for the refined UI, with tabular figures. Retain the already bundled fonts and their licenses for existing surfaces. Reuse the existing Lucide icon package for arrows, chevrons, help, wallet, and status icons. Build pool-share bars, glass surfaces, separators, focus rings, and loading indicators with native UI/CSS. Existing decorative cloud particles and grain are not part of the new direction.

## Preview and verification

From the isolated worktree, run `python3 docs/design/afterglow/preview.py --port 8766`, then open `http://127.0.0.1:8766/`.

Verified both generated images visually, checked actual exported dimensions, and confirmed both images load in the browser. Keyboard Tab produced the solid blue fill and separate focus ring; Enter produced the preview-only acknowledgement. A real pointer hover on NO produced `rgb(164, 71, 98)` with white text. Solid text/background contrast ratios: YES rest 12.11:1, NO rest 11.73:1, YES hover 5.97:1, NO hover 5.74:1; pressed states exceed 7:1. These checks cover these token pairs, not full application accessibility or responsive acceptance.

All product files from the inherited baseline remain unchanged. No app build, database change, wallet action, deployment, commit, or merge was performed. The worktree inherits substantial uncommitted Arc changes; consult its saved Git baseline manifest before staging future design work.

## Integration — September 19, 2026

The user subsequently authorized application integration. The homepage now imports `apps/web/src/components/home/afterglow.css` and uses the prepared image assets, manual market navigation, outlined outcome controls, active-market collection and compact funding affordance. The betting dialog shares the dark treatment. Runtime CSS is independent of this historical asset-sheet stylesheet.

The countdown and activation guards use each live market's frozen on-chain `bettingDeadline`, serialized in milliseconds. Older serialized fixtures fall back to the ten-minute rule. No contract or scheduling setting was changed. The app retains its existing data, wallet and transaction paths.

See the root `design-qa.md` for visual comparisons, interactions, scope and acceptance limits. Verification screenshots use temporary sample data; the shipped page uses its original real market loader. Preview runs at `http://127.0.0.1:3002/`, with read-only database connections for this session. No deployment, merge or design commit has been made.

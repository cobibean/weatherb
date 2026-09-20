# Afterglow design and assets — September 19, 2026

The user explicitly asked to record the selected direction and prepare all required redesign assets. Work is isolated at `/Users/cobibean/.codex/worktrees/weatherb-design-review/weatherb`, branch `codex/weatherb-premium-design`, based on `codex/arc-phase-1-baseline` plus its copied uncommitted working state.

## Confirmed direction

- Dusk/Afterglow hero from original option 3, extended to 1–10 open markets with persistent arrows, market count, direct selectors, manual switching, and an active-market collection below. One-market state hides switching/redundant grid. This is display capacity, not a change to scheduler/contract rules.
- Outlined navy YES/NO controls from latest button option 3; solid blue and rose colors from button option 1 on hover. Equal emphasis for both sides.
- User accepted the visual audit: improve hierarchy, distinguish betting close from resolution, quieter funding affordance, no missing-color transparent button fade.

## Assets and source of truth

`docs/design/afterglow/README.md` records accepted decisions, exact implementation defaults, scope, inventory, integration notes, and verification. `theme.css` prepares rest/hover/focus/pressed/unavailable/submitting states; it is not wired into the app. Selected reference images are copied into `references/`. Exact background prompts and original PNGs are preserved.

Generated two standalone decorative backgrounds with built-in image_gen: desktop master 1672×941 and mobile master 941×1672. Four optimized WebP exports live in `apps/web/public/backgrounds/afterglow/`, each under 100 KB. The skyline is a shared stylized atmosphere, not location-specific or current-weather evidence. No additional raster UI/icon assets are needed; reuse native UI and Lucide.

## Verification and boundaries

Browser checked the isolated asset sheet at `http://127.0.0.1:8766/`: images load, keyboard focus and Enter work, actual NO hover uses the rose fill and white text. Enabled button token pairs pass normal-text contrast; this is not full app accessibility verification. Actual mobile layout, wallet flows, and full redesign integration remain future work.

Original app source was not edited; no dependencies installed, app build, live transaction, database action, deployment, staging, commit, or merge. The prepared worktree retains inherited unstaged/staged Arc work. Its Git metadata holds `weatherb-design-baseline.json` and staged/unstaged patches; do not sweep inherited work into a design commit.

## Next work

Implement the selected page and button direction in this worktree using the saved references/assets, then verify 0/1/10-market states, keyboard/swipe/manual navigation, responsive crops, betting-close behavior, and wallet flows. Any mock balances/timestamps are illustrative and must be replaced with actual application data and canonical timing rules.

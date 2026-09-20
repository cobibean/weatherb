# Afterglow integration design QA — September 19, 2026

final result: passed

## Target and comparison

The accepted target is `docs/design/afterglow/references/selected-hero-and-market-grid.png`, with the later `selected-button-rest.png` overriding its solid button fills. Hover follows `selected-button-hover-colors.png` and the approved CSS tokens. Both references were opened before implementation. The application uses the separately generated desktop/portrait backgrounds.

The local implementation runs at `http://127.0.0.1:3002/`. Compared the source and rendered captures together in `docs/design/afterglow/verification/hero-comparison-final.png` and `grid-comparison-final.png`. The desktop comparison uses a 1092 CSS-pixel viewport, matching the full-page source width. Browser screenshots were normalized from the host's 1.8 pixel/CSS-pixel density. Grid comparison aligns the collection region; it is not a claim of full-page pixel equality. Discarded malformed compositor captures rather than treating them as evidence.

The source shows an illustrative connected wallet; verification uses the real disconnected wallet state. Market cities, percentages, and thresholds were sampled for visual comparison. Dates and pools differ, and the mockup's erroneous betting-close labels were corrected. Temporary 0/1/6/10-market fixtures replaced the server entry point only during visual checks; the original page and real loader were restored byte-for-byte before final checks. No fixture route, fake balance, or sample market remains in the application.

## Findings and fixes

- P2, fixed: the first desktop rendering had excessive vertical spacing and an oversized betting shelf at narrower desktop widths. Added proportional spacing and shelf sizing. The recapture shows the selected large-temperature hierarchy, right-hand timer, narrow glass shelf, skyline and fade into the collection.
- P2, fixed: the divider made the NO action narrower than YES. Equal grid columns now measure approximately 348.44 CSS pixels each at the comparison viewport.
- P1, fixed: inherited light payout and amount-preset surfaces made text unreadable in the dark betting dialog. Updated those surfaces, borders and text colors; `bet-dialog-final.png` confirms readable amount and payout information. The final minor badge/blue-text refinements preserve this contrast.
- P2, fixed: card buttons misaligned when a city question wrapped. Cards now align their outcome controls at the bottom.

## Interaction and state checks

- Desktop and 393px mobile layouts inspected; no horizontal page overflow at 393px or 820px. Mobile loads the portrait WebP; desktop uses the landscape asset. Ten direct selectors and ten cards render, including duplicate Austin thresholds distinguished by resolve time.
- Manual selection, previous/next, selected count, featured marker and keyboard activation checked. Selection follows market ID, survives reorder, and safely falls back if removed. No auto-rotation. Selected selectors scroll into view.
- Rest controls match the selected outlines. Actual YES hover: `rgb(40, 100, 173)` with white text. NO keyboard focus: `rgb(164, 71, 98)` with white text and a separate outline. Reduced-motion emulation reports zero-duration button transitions; reset after verification.
- Mobile menu opens and hides with inactive contents inert. Betting dialog opens from a market, updates on preset amount entry, traps focus through Radix, and closes with Escape. Wallet chooser offers MetaMask, Rabby and WalletConnect. No wallet connection, signature or transaction was submitted.
- Single market hides arrows and duplicate grid. Closed market disables both outcomes. Empty and unavailable states render without fake markets. Real Past Markets successfully loads through the existing API.
- Component tests cover exact deadline disabling, frozen on-chain deadlines, selection stability/removal, ten unique selectors, empty/single states, and horizontal swipe versus vertical scroll. The in-app browser does not support synthetic touch dispatch; a physical-device swipe remains a manual acceptance item, not a claimed browser pass.
- Browser console inspection found extension-origin MetaMask provider conflicts/liveness warnings, not an application rendering exception. Connected-wallet signing and settlement are outside this visual verification.

## Remaining P3 / acceptance notes

Cards accommodate real city names and 44px actions, so their vertical density differs modestly from the illustrative mockup. The scenery is the approved shared stylized asset, not a city-specific weather observation. Wider/retina visual taste and physical-device touch should receive owner acceptance before merging. Docs, positions, admin and existing informational modals keep their established page designs; this integration covers the selected homepage and its betting dialog.

## Final automated verification

- `npm run typecheck` and `npm run lint`: passed on final source.
- Full web suite: 23 files / 162 tests passed before the final deadline serialization refinement.
- After that refinement: all 9 focused Afterglow/home tests passed, including the added per-market deadline case.
- `node scripts/verification/run.mjs build`: final production build passed, 42 static pages generated.
- `git diff --check`: passed. Original server entry point restored exactly; only the 11 intended inherited files changed, plus new scoped CSS, presentation/outcome components, tests and design documentation/assets.

## Public interiors extension — September 19

Extended the accepted Afterglow direction to My Positions, Docs, How It Works,
claim/refund and bulk-claim dialogs, market summaries, and the public 404 page.
Reference remains `docs/design/afterglow/references/selected-hero-and-market-grid.png`
and the selected outlined button state. Public interiors use quiet navy surfaces,
readable muted text, thin borders, and restrained blue actions.

Desktop and 393px browser checks covered disconnected positions, sample populated
cards, guide step navigation/completion/Escape, claim opening/Escape, bulk claim
opening, mobile Docs navigation, and a real settled-market summary. No wallet
transaction was submitted. Populated cards used a temporary fixture route that
was removed before the build. Fixed Docs intrinsic-width overflow, refund badge
crowding, and a pale summary header. Cards use two columns until the extra-large
breakpoint and align their actions at the bottom.

Reconciled concurrent parent updates for live markets, claim notifications,
claimed amounts, and profit-before-gas labeling. Combined suite: 26 files / 175
tests passing. Production build and final lint/typecheck recorded in the task
closeout. The live-market request-start lint false positive has a narrowly scoped
explanation; runtime behavior is unchanged. Internal administrative workflows
retain their existing layout; this extension covers public app surfaces.

Final extension result: passed. Final lint and typecheck passed; parent checkout recheck passed typecheck, all 175 tests, and `git diff --check` after working-tree integration. Changes remain uncommitted alongside the existing Arc restart work.

# styles-layout.css Split Plan

Date: 2026-05-31
Status: proposed

## Role

This document is the execution plan for splitting `styles-layout.css` into smaller source CSS files without changing player-visible layout or gameplay behavior.

`styles-layout.css` is root source. `worker-public/` is a generated mirror and must be updated only through `npm run worker:prepare` during implementation.

## Source Of Truth

- Gameplay and player-visible rules remain governed by `01-rulebook.md`; this plan does not change them.
- Runtime and mirror boundaries remain governed by `docs/architecture-contracts.md` and root `AGENTS.md`.
- The implementation target is root source CSS plus the root HTML/worker asset manifest wiring needed to load it.

## Target

- Primary source file to reduce: `styles-layout.css`
- Related source files to update during implementation: `index.html`, `scripts/prepare-worker-assets.ts`, focused CSS tests
- Generated/mirror output: `worker-public/` after `npm run worker:prepare`

## Problem

`styles-layout.css` is 4,172 lines and currently owns unrelated UI concerns in one cascade surface:

| Lines | Current section |
| ---: | --- |
| 1-419 | game container, board frame, occupancy, charge, player areas, hands, UI layer |
| 420-452 | side panel shell |
| 453-2357 | compact control panel and many control sub-surfaces |
| 2358-2420 | info panel |
| 2421-3528 | log, network chat, and related panel details |
| 3529-4000 | result overlay |
| 4001-4018 | sound selector |
| 4019-4116 | CPU character panel |
| 4117-4172 | hero character panel |

This makes small UI layout changes risky because unrelated selectors share one file, review diffs are noisy, and CSS tests either overfit a giant file or miss newly added sections.

## Non-Goals

- Do not change gameplay rules, card behavior, network authority, or UI timing.
- Do not rename selectors, ids, classes, or CSS custom properties.
- Do not change the visual design intentionally.
- Do not convert `styles-layout.css` into an import-only facade in the first pass.
- Do not hand-edit `worker-public/` mirror files.
- Do not combine this split with unrelated CSS redesign or responsive-layout changes.

## Constraints

- Preserve cascade order exactly. Extracted files must load after `styles-layout.css` and before `styles-board.css`, matching the original position of the moved rules relative to the rest of the app CSS.
- Keep root HTML and worker mirror in sync through source changes plus `npm run worker:prepare`.
- Existing tests read `styles-layout.css` directly:
  - `test/ui.board-frame.custom-size.test.ts`
  - `test/ui.layout-responsive.aspect-ratio.test.ts`
  - `test/ui.status-display.cpu-scale.test.ts`
- When a tested selector moves out of `styles-layout.css`, update the test to read the combined layout CSS surface rather than weakening the assertion.
- New CSS files must be included in the same fixed-px guard used for core UI styles.

## Target File Layout

Final target:

| File | Ownership |
| --- | --- |
| `styles-layout.css` | stage shell, board frame, player areas, hand containers, and shared layout layer primitives |
| `styles-layout-controls.css` | side panel shell, compact control panel, match/network/deck/gacha controls |
| `styles-layout-info.css` | info panel, status/log surfaces, network chat panel |
| `styles-layout-result.css` | result overlay and result panel variants |
| `styles-layout-characters.css` | sound selector, CPU character panel, hero character panel, speech bubble |

The exact grouping can be adjusted during implementation if inspection shows stronger local boundaries, but each extracted file must have one clear UI ownership reason.

## Execution Phases

### Phase 0: Guard And Inventory

Risk: low

Tasks:

1. Confirm the current line count and section ranges for `styles-layout.css`.
2. Add or update a small CSS test helper that reads the loaded layout CSS surface in source order.
3. Update the fixed-px guard target list to include every new `styles-layout-*.css` file as it is introduced.
4. Confirm `index.html` stylesheet order before edits.

Validation:

- `npm run test:jest -- --runTestsByPath test/ui.layout-responsive.aspect-ratio.test.ts test/ui.board-frame.custom-size.test.ts test/ui.status-display.cpu-scale.test.ts`

Exit condition:

- Tests can validate split layout CSS without depending on every selector staying inside `styles-layout.css`.

### Phase 1: Extract Result Overlay

Risk: low

Rationale:

The result overlay block is self-contained, near the end of the file, and is not directly asserted as `styles-layout.css` content by current CSS tests.

Tasks:

1. Move lines 3529-4000 from `styles-layout.css` to `styles-layout-result.css`.
2. Add `<link rel="stylesheet" href="styles-layout-result.css">` immediately after `styles-layout.css` in `index.html`.
3. Add the new file to `scripts/prepare-worker-assets.ts`.
4. Keep selector text and rule order unchanged inside the moved block.
5. Run `npm run worker:prepare` so `worker-public/` mirrors the new stylesheet and updated HTML.

Validation:

- `npm run test:jest -- --runTestsByPath test/ui.result-overlay.network-seat.test.ts test/ui.layout-responsive.aspect-ratio.test.ts`
- `npm run worker:prepare`
- `git diff --check`

Exit condition:

- Result overlay rules live only in `styles-layout-result.css`.
- `index.html` and `worker-public/index.html` load the new stylesheet in source order.
- No visual rule content changes other than file location.

### Phase 2: Extract Character And Sound Layout

Risk: low to medium

Rationale:

The sound selector and character panels are compact and conceptually separate from board/control layout, but current tests assert character selectors inside `styles-layout.css`.

Tasks:

1. Move lines 4001-4172 to `styles-layout-characters.css`.
2. Update tests that assert `#cpu-character-img`, `#hero-character-img`, `#cpu-character-panel`, and `#hero-character-panel` to read the combined layout CSS surface.
3. Add the new stylesheet link after `styles-layout-result.css`.
4. Add the new file to `scripts/prepare-worker-assets.ts`.
5. Run `npm run worker:prepare`.

Validation:

- `npm run test:jest -- --runTestsByPath test/ui.status-display.cpu-scale.test.ts test/ui.layout-responsive.aspect-ratio.test.ts test/ui.status-display.network-seat.test.ts test/ui.status-display.portrait-bubble.test.ts`
- `npm run worker:prepare`
- `git diff --check`

Exit condition:

- Character and sound-selector rules live only in `styles-layout-characters.css`.
- Existing character-scale and responsive assertions remain equally strict.

### Phase 3: Extract Info, Log, And Chat Surfaces

Risk: medium

Rationale:

The info/log/chat block is large and UI-surface focused. It is less isolated than result overlay because it shares z-index and stage variables with side/control panels.

Tasks:

1. Move lines 2358-3528 to `styles-layout-info.css`.
2. Add the stylesheet link after `styles-layout-characters.css`.
3. Add the new file to `scripts/prepare-worker-assets.ts`.
4. Keep log scrollbar and network chat selectors together unless a smaller boundary is obvious.
5. Run `npm run worker:prepare`.

Validation:

- `npm run test:jest -- --runTestsByPath test/ui.layout-responsive.aspect-ratio.test.ts test/ui.network-client.reconnect-sync.test.ts`
- `npm run worker:prepare`
- Browser smoke check of local play screen at desktop and phone portrait widths if any z-index or fixed-position rule changes.
- `git diff --check`

Exit condition:

- Info, log, and network chat layout rules no longer live in `styles-layout.css`.
- No selector was renamed or reordered relative to its extracted block.

### Phase 4: Extract Side Panel And Controls

Risk: medium

Rationale:

The control panel block is the largest chunk and likely contains the most cross-surface coupling. It should move after smaller extractions have proven the test helper, HTML ordering, and mirror workflow.

Tasks:

1. Move lines 420-2357 to `styles-layout-controls.css`.
2. Keep side panel shell and compact control panel in the same file for the first pass.
3. Add the stylesheet link after `styles-layout-info.css`.
4. Add the new file to `scripts/prepare-worker-assets.ts`.
5. Run `npm run worker:prepare`.

Validation:

- `npm run test:jest -- --runTestsByPath test/ui.layout-responsive.aspect-ratio.test.ts test/ui.board-frame.custom-size.test.ts`
- `npm run worker:prepare`
- Browser smoke check of control panel, side panel collapse, network room panel, deck/gacha controls, and custom board-size controls.
- `git diff --check`

Exit condition:

- Control panel and side panel rules live in `styles-layout-controls.css`.
- `styles-layout.css` is reduced to core shell and board/player/hands layout primitives.

## Completion Definition

This split is complete only when all of the following are true:

1. `styles-layout.css` owns only core stage, board frame, player area, hand container, charge, occupancy, and shared layout layer primitives.
2. Extracted layout CSS files are loaded by `index.html` in the intended cascade order.
3. `scripts/prepare-worker-assets.ts` includes every new root layout stylesheet.
4. `worker-public/` mirrors are regenerated by `npm run worker:prepare`, not edited by hand.
5. Existing CSS assertions remain strict by reading the combined layout CSS surface where needed.
6. Fixed-px guard coverage includes all new layout CSS files.
7. No selector, id, class, CSS variable, or declaration value changes unless explicitly called out as a separate visual fix.
8. `npm run test:jest -- --runTestsByPath test/ui.layout-responsive.aspect-ratio.test.ts test/ui.board-frame.custom-size.test.ts test/ui.status-display.cpu-scale.test.ts` passes.
9. Focused tests for any moved surface pass:
   - result overlay after Phase 1
   - status/character tests after Phase 2
   - network chat/reconnect tests after Phase 3
   - control-panel/side-panel smoke coverage after Phase 4
10. A local browser smoke check confirms desktop and mobile/phone-portrait layout still render without overlapping core controls.
11. `git diff --check` passes.

## Rollback

Each phase must be a separate small commit. If a phase causes visual or test regressions, revert that phase commit only. Earlier extracted files should remain valid because no phase depends on selector renaming or public API changes.

## First Safe Pass

Start with Phase 1 only: extract `Result Overlay` to `styles-layout-result.css`.

This pass has the smallest blast radius, proves the stylesheet loading and worker mirror workflow, and reduces `styles-layout.css` without touching selectors currently asserted as living inside that file.

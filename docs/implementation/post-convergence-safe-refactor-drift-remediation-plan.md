# Post-convergence safe refactor drift remediation implementation plan

- Status: completed
- Design: `docs/implementation/post-convergence-safe-refactor-drift-remediation-design.md`
- Scope: all currently identified high-value, behavior-preserving refactor drift with positive safety proof

## Step 1: Remove post-baseline unused declarations and strengthen the guard

- Outcome: all eleven newly introduced unused diagnostics and the six-member private dead-code closure they expose are removed without touching older compatibility-sensitive debt.
- Files:
  - `game/logic/board_ops.ts`;
  - `game/logic/cards.ts`;
  - `game/logic/cards/hyperactive.ts`;
  - `game/logic/cards/meteor_god.ts`;
  - `ui/pixi/effects/source-trajectory-render-plan.ts`;
  - `test/refactor.dependency-boundary.test.ts`.
- Dependency: reviewed design and clean baseline.
- Verification:
  - focused dependency-boundary test;
  - TypeScript with `noUnusedLocals`, confirming 348 diagnostics and absence of the eleven removed names;
  - `npm run typecheck`.
- Done condition: only the seventeen proven declarations or bindings are removed, Meteor God and the render-plan file are guarded as clean runtime files, the diagnostic count falls from 359 to 348, and no new unused diagnostic appears.

## Step 2: Canonicalize board cell/value and expansion-target projections

- Outcome: shaped-board enumeration and expansion-socket target mapping each have one runtime-portable implementation.
- Files:
  - `shared/shared-board-utils.ts`;
  - `shared/board/expansion-sockets.ts`;
  - `game/cards/target-resolver.ts`;
  - `game/logic/cards/selectors.ts`;
  - `game/logic/cards/lightning.ts`;
  - `game/logic/cards/living_will.ts`;
  - `game/logic/cards/meteor_god.ts`;
  - `game/logic/cards/sniper.ts`;
  - `game/logic/cards/udg.ts`;
  - `game/logic/cards/will_hunter_king.ts`;
  - focused shared-board tests.
- Dependency: Step 1 so dead wrappers cannot obscure new facade usage.
- Implementation notes:
  - preserve fresh-array/fresh-record behavior and coordinate ordering;
  - keep every card call behind an explicit `BoardContext`;
  - preserve expansion mapper validation and null behavior byte-for-byte;
  - update the facade-boundary declaration inventory when adding the approved wrapper.
- Verification:
  - `test/shared.board-cell-access.test.ts`;
  - `test/shared.board-expansion-sockets.test.ts`;
  - `test/shared.board-facade-boundary.test.ts`;
  - board-expansion and target-resolver focused tests;
  - TypeScript build/typecheck.
- Done condition: the six local board-cell collectors and two local expansion mappers are absent, all consumers delegate to the shared facade, and focused behavior tests pass.

## Step 3: Canonicalize automatic-target protection decisions

- Outcome: Lightning, Meteor God, Destroy Dragon, and Sniper use the existing marker authority instead of four local manifestation fallbacks.
- Files:
  - `game/logic/cards/lightning.ts`;
  - `game/logic/cards/meteor_god.ts`;
  - `game/logic/cards/destroy_dragon.ts`;
  - `game/logic/cards/sniper.ts`.
- Dependency: Step 2 may touch three of the same files and should land first in the working diff.
- Implementation notes:
  - require `CardMarkers.isInviolableCell` explicitly;
  - remove local manifestation-type sets and copied `isUntargetableStone` bodies;
  - do not change target ordering, PRNG use, or destruction settlement.
- Verification:
  - `test/game.manifest-random-target-exclusion.test.ts`;
  - focused Lightning, Meteor God, Destroy Dragon, Sniper, and expansion-fallback tests;
  - Worker card-pattern parity later in the delivery step.
- Done condition: all four modules delegate directly to the canonical helper and all manifestation/Shinra fixtures retain their results and random-call counts.

## Step 4: Extract deterministic Pixi source-trajectory geometry

- Outcome: legacy visual-state and compiled render-plan paths share exact deterministic math without changing lifecycle or the Single Visual Writer.
- Files:
  - new `ui/pixi/effects/source-trajectory-geometry.ts`;
  - `ui/pixi/effects/source-trajectory.ts`;
  - `ui/pixi/effects/source-trajectory-render-plan.ts`.
- Dependency: Step 1 removes the render-plan dead constant first.
- Implementation notes:
  - move only byte-equivalent scalar, point, rectangle, and lightning-path operations;
  - preserve expression and loop order;
  - keep both `clipSegment`/`clipPath` implementations local;
  - keep timers, Pixi resources, renderer state, playback settlement, and diagnostics in their current owners.
- Verification:
  - `test/ui.pixi-source-trajectory.test.ts`;
  - `test/ui.pixi-source-trajectory-render-plan.test.ts`;
  - `test/ui.board-source-trajectory-contract.test.ts`;
  - `npm run match:pixijs-board-playback-check` if the focused suite passes.
- Done condition: both trajectory consumers import the shared pure module, sampled legacy/compiled parity remains exact, and no writer or settlement route changes.

## Step 5: Regenerate browser and Worker delivery surfaces

- Outcome: generated browser artifacts and the tracked Worker mirror reflect root canonical sources.
- Files: script-generated browser registry/cachebuster, TypeScript build outputs as configured, and `worker-public/` mirror artifacts.
- Dependency: Steps 1-4 pass focused verification.
- Verification:
  - `npm run build:browser`;
  - `npm run worker:prepare`;
  - inspect generated diffs and confirm no generated file was source-edited;
  - `npm run build:vite`.
- Done condition: generation succeeds, expected artifacts are current, and generated changes correspond only to the refactored root modules.

## Step 6: Run broad verification and commit coherent units

- Outcome: the refactor is fully verified across headless, browser, and Worker boundaries and is recorded in reviewable commits.
- Dependency: all implementation steps complete.
- Verification:
  - `npm run checkall`;
  - `npm run test:network:parity`;
  - final `noUnusedLocals` recount;
  - `git diff --check`;
  - task-scoped diff and generated-artifact inspection;
  - final `git status --short` after each commit.
- Commit units:
  1. reviewed design and implementation plan;
  2. dead-declaration cleanup plus board/card canonical delegation and focused tests;
  3. Pixi trajectory geometry extraction and focused tests;
  4. generated delivery updates or completion-document updates if they form a distinct verified diff.
- Done condition: all required checks pass, each coherent task-owned diff is committed, and no unrelated file is staged or changed.

## Completion checklist

- [x] Eleven post-baseline diagnostics and their six-member transitive dead closure removed; count restored from 359 to 348.
- [x] Clean-file unused-declaration guard extended.
- [x] Six board cell/value projections canonicalized.
- [x] Two expansion target mappers canonicalized.
- [x] Four automatic-target protection implementations canonicalized.
- [x] Pixi deterministic geometry shared without clipping/lifecycle changes.
- [x] Focused gameplay, board, and Pixi tests pass.
- [x] Browser artifacts and Worker mirror regenerated from root sources.
- [x] Broad structural, Vite, and network parity checks pass.
- [x] Full Jest result compared with an isolated `HEAD` baseline; all nineteen failures are pre-existing and none is introduced by this refactor.
- [x] Task-owned commits created and final status inspected.

## Execution record

- Documentation design/plan commit: `d7235c1eb` (`docs: plan safe refactor drift remediation`).
- `npm run typecheck`: passed.
- TypeScript `noUnusedLocals` recount: 359 diagnostics before the refactor, 348 after it, matching the Phase 11 baseline.
- Board/card focused Jest: 11 suites and 105 tests passed.
- Pixi source-trajectory focused Jest: 4 suites and 68 tests passed.
- `npm run match:pixijs-board-playback-check`: passed all 232 scenarios across classic/Vite, Pixi/DOM compatibility, and normal/reduced/no-animation modes.
- `npm run worker:prepare`: passed and verified the 960-file Worker mirror; its browser/Vite builds regenerated the tracked delivery surfaces. The existing Vite large-chunk warning remained non-fatal.
- `npm run checkall`: passed, including dependency boundaries, zero runtime cycles, browser freshness, JavaScript authority inventory, and Worker mirror checks.
- `npm run test:network:parity`: 35 suites and 564 tests passed; existing console/open-handle warnings remained non-fatal.
- `npm run test:jest`: the first 904-second attempt exceeded its command timeout while Jest continued to run. A 30-minute rerun completed in 1083.331 seconds: 1012 of 1016 suites passed and 7570 of 7589 tests passed. The four failing suites and nineteen failures were reproduced from an isolated archive of unchanged `HEAD` (with its own TypeScript build), proving they predate this refactor:
  - `test/ui.network-client.guard-tempt-deferred-publish.test.ts`: 16 failures;
  - `test/game.marker-cell-index.test.ts`: 1 failure;
  - `test/entry-browser.boot-table-sequence.test.ts`: 1 failure;
  - `test/ui.board-playback-runtime-state-contract.test.ts`: 1 failure.
- The pre-existing failures were not hidden by weakening assertions or changing unrelated product behavior. Focused coverage for every changed behavior and all required structural, browser, Worker, and network checks passed.
- The implementation, tests, and generated delivery surfaces are committed together as one coherent unit so no commit records stale browser or Worker artifacts.

## Self-review

The plan was revised to put the unused cleanup before shared-file edits so the compiler delta remains attributable. Board and marker changes were separated conceptually but ordered together where they touch the same card modules, preventing duplicated intermediate edits. The Pixi step explicitly excludes clipping and settlement so its parity suite can validate a pure extraction. Browser generation was delayed until focused tests passed, and Worker preparation was run once as a standalone mirror operation rather than duplicated through a deploy command. The reviewed plan originally proposed separate headless, Pixi, and generated commits; implementation showed that the browser registry and Worker mirror cover both source groups, so one verified implementation-and-delivery commit is safer than intermediate commits with stale generated state. The earlier design/plan commit remains separate.

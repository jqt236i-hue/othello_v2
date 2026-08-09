# Full regression contract convergence implementation plan

- Status: implemented, verified, and committed
- Date: 2026-08-09
- Design authority: `docs/implementation/full-regression-contract-convergence-design.md`
- Document role: ordered implementation and verification plan for closing the four known failing Jest suites and restoring a zero-failure full regression baseline
- Scope authority: if this plan conflicts with the reviewed design, the design wins and both documents must be corrected before implementation continues
- Player-visible specification: unchanged; do not edit `01-rulebook.md` or `正本/*.md`
- Execution mode: one checkout, sequential contract repair, focused proof before generation, then cross-runtime and full-suite gates

## 1. Objective and delivery rule

Restore the normal full Jest baseline from four known failing suites and nineteen failures to zero failures without changing valid player-visible behavior, then close every reproducible marker/network/writer defect exposed by the requested post-implementation AI code review. The correction is complete only when the strengthened tests and all proportional repository gates are green again.

The implementation is complete only when:

- all four formerly failing suites pass for the intended current-owner reasons;
- the exact network settlement path, marker direct/index parity, semantic boot dependencies, and synthetic writer ownership each have focused evidence;
- browser/Vite/Worker outputs are regenerated from root sources;
- the updated network parity command and full Jest pass with zero failures;
- the plan records actual results, and the task-owned implementation/delivery diff is committed coherently.

Do not mark the task complete with a comparison against a known-red baseline. Do not skip, weaken, rename out of discovery, or allowlist a failing test.

## 2. Expected change boundary

### Canonical source/config changes

- `shared/multi-cell-stone.ts`;
- `shared/special-stone-registry.ts`;
- `game/logic/card-resolution/board-executor.ts`;
- `ui/network-client.ts`;
- `ui/board-visual/writer-runtime.ts`;
- `ui/board-visual/backend-runtime.ts`;
- `ui/board-visual/controller.ts`;
- `ui/board-visual/runtime-ports.ts`;
- `ui/board-renderer.ts`;
- `ui/presentation-handler.ts`;
- `package.json` only to add the existing deferred-selection suite to `test:network:parity`.

### Test changes

- `test/ui.network-client.guard-tempt-deferred-publish.test.ts`;
- `test/game.marker-cell-index.test.ts`;
- `test/entry-browser.boot-table-sequence.test.ts`;
- `test/ui.board-playback-runtime-state-contract.test.ts`;
- `test/ui.board-visual.runtime-lifecycle.test.ts`;
- `test/ui.board-visual-controller-settlement.test.ts`;
- `test/ui.board-renderer.recovery-contract.test.ts`;
- `test/ui.presentation-handler.playback-claim.test.ts`;
- `test/game.board-executor.test.ts`;
- `test/shared.special-stone-registry.test.ts`.

The first implementation expected the following product files to remain unchanged. Reproduced post-implementation review findings supersede that expectation only for the files now listed above:

- `ui/network/selection-signal-bridge.ts`;
- `game/card-effects/selection-flow.ts` or its execution core;
- `entry-browser.js`;
- board backends and Pixi/DOM scene implementations.

If current-owner behavior cannot be proven without changing one of those product files, stop that step, collect the failing evidence, revise and re-review the design/plan, then resume. Do not quietly broaden the implementation.

### Generated/delivery changes

`npm run worker:prepare` determines the exact generated diff. Possible tracked changes include browser registry/startup artifacts, cache-buster references, Vite generated startup surfaces, and `worker-public/` mirrors. Never source-edit these paths. Keep only script-produced outputs that correspond to the task-owned root changes.

### Documentation changes during implementation

- update this plan's progress, discoveries/decisions when relevant, and actual verification record;
- set both this plan and its design to implemented/verified status only after every completion gate passes.

## 3. Baseline evidence available to the implementer

At design time, `HEAD` was `da4d5335a` and the working tree was clean. The following diagnostics passed:

- `npm run typecheck`;
- `npm run check:dependency-boundaries` (4/4 tests);
- `npm run check:window`;
- the `noUnusedLocals` diagnostic count remained at the established 348 baseline.

A focused run reproduced exactly:

- 16 failures in `test/ui.network-client.guard-tempt-deferred-publish.test.ts`;
- 1 failure in `test/game.marker-cell-index.test.ts`;
- 1 failure in `test/entry-browser.boot-table-sequence.test.ts`;
- 1 failure in `test/ui.board-playback-runtime-state-contract.test.ts`.

The most recent recorded full Jest run completed with 1012/1016 suites and 7570/7589 tests passing and the same four suites/nineteen failures. Treat those numbers as investigation evidence, not as an acceptable post-implementation result.

## 4. Step 0 — Reconfirm scope and reproduce the ledger

### Outcome and rationale

Confirm that no new user/parallel work overlaps the expected files and that the four-failure ledger still matches the reviewed design before any edit.

### Actions

1. Read root `AGENTS.md` and the applicable nested instructions for `docs/`, `shared/`, `test/`, `ui/`, `ui/network/`, and `game/card-effects/`.
2. Run `git status --short` and classify every existing change as related, unrelated, generated/mirror, or unknown.
3. If unrelated dirty changes overlap the expected files or generated surfaces and cannot be isolated safely, stop and ask the user; do not create a worktree or branch without explicit authority.
4. Run the four known suites together:

```powershell
npx jest --runInBand --runTestsByPath test\ui.network-client.guard-tempt-deferred-publish.test.ts test\game.marker-cell-index.test.ts test\entry-browser.boot-table-sequence.test.ts test\ui.board-playback-runtime-state-contract.test.ts
```

5. Record actual suite/test counts and failure messages in this plan's verification record.
6. Inspect the current source at each owner before editing. If the failures no longer match because the repository advanced, update and re-review the design/plan rather than forcing the old patch.

### Done when

- the working-tree boundary is safe;
- the exact four causes are reproduced or the documents have been revised for evidence-backed repository changes;
- no product/generated file has been edited.

## 5. Step 1 — Move deferred network selection to the real exact-settlement proof

### Outcome and rationale

The sixteen-case client suite observes the actual network-client exact waiter—`visualSeq` extraction, `operationId` forwarding, session-sensitive tracking, and playback drain—instead of expecting the retired global idle waiter.

### Files

- `test/ui.network-client.guard-tempt-deferred-publish.test.ts`;
- `ui/network-client.ts`;
- `package.json`.

### Required implementation

1. Keep the existing sixteen parameterized cases and their assertions for:
   - exactly one deferred publish;
   - correct actor/action/params and pending instance identity;
   - no client-authored snapshot or playback list;
   - no local preview for publish-only cases;
   - no local presentation emission;
   - accepted authoritative game/card state.
2. In each test setup, after `jest.resetModules()` and before importing `ui/network-client`:
   - require `../ui/playback-state-manager.js`, which resolves the same Jest TypeScript module object the client will use;
   - spy on `waitForNetworkVisualSeq` with a deferred promise and resolve a separate `trackerEntered` notification as soon as the spy is invoked;
   - spy on `waitForVisualPlaybackDrain` with a second independently controlled deferred promise and a `drainEntered` notification;
   - retain `global.waitForPlaybackIdle` only as a legacy trap and reset its call history.
3. Make the fake `/api/match/publish` response return the request's stable `operationId` and `presentationCursor: { visualSeq: 1, stateVersion: 21 }` with the authoritative snapshot.
4. Capture the object passed to `selectionFlow.setSignalBridge()` and attach a call-through spy to `waitForAuthoritativeVisualSettlement`. Do not replace its implementation.
5. Start `handlers[handlerName](...)` and retain both the promise and a completion flag. Do not immediately await it.
6. Race `trackerEntered.promise` against a branch that rejects if the handler settles first. Do not use a fixed-count microtask flush. After the tracker is entered and before resolving it, assert:
   - the bridge exact waiter received the normalized accepted publish result;
   - `waitForNetworkVisualSeq` was called once with `1` and `{ operationId: <accepted operation id> }`;
   - `waitForVisualPlaybackDrain` has not run;
   - `global.waitForPlaybackIdle` has not run;
   - the accepted authoritative state is already installed;
   - the handler completion flag is false;
   - `selectionFlowModule.isSelectionSettlementLocked()` is true.
   - Do not assert Node-global `isProcessing` / `isCardAnimating`: the installed bridge does not expose busy-state writers, and the direct lock plus incomplete handler are the authoritative ownership observations for this path.
7. Resolve the tracker with `{ ok: true, visualSeq: 1 }`. Race `drainEntered.promise` against premature handler settlement, then assert that playback drain has started with the network-client root/current-card-state access while the handler completion flag is false and `isSelectionSettlementLocked()` remains true.
8. Capture the drain options, prove `root` is the network-client root and `getCardState()` returns the already-applied authoritative card state. Resolve the drain, await the handler, prove `isSelectionSettlementLocked()` is false, and reassert at terminal completion: publish once, bridge/tracker/drain once, legacy wait zero, publish-only local preview zero, and local presentation zero. This catches late duplicate work after the deferred gates have become permanently resolved.
9. For the temptation case, attach a call-through spy to the installed bridge's `armBoardUpdateDuringPlayback` method, assert the `selection-flow` / `selection_state_sync` request, and require the matching spy result to return `true`. Remove the later transient-context peek: snapshot work may consume or replace that context, while the capability's boolean return is the owner-level acknowledgement. The explicit `.js` compatibility import and the TypeScript owner's Jest resolution may also differ, but module identity alone is not the contract rationale.
10. Restore spies and deferred state in `afterEach` so the 16-case table leaves no open handle or cross-case module state.
11. Add `test\ui.network-client.guard-tempt-deferred-publish.test.ts` to `test:network:parity` next to the existing deferred-publish client suites. Do not change any other script or lockfile.

### Focused verification

```powershell
npx jest --runInBand --runTestsByPath test\ui.network-client.guard-tempt-deferred-publish.test.ts test\ui.network-selection-signal-bridge.test.ts test\game.pending-selection-flow.test.ts
```

### Failure handling

- If the call-through exact waiter does not reach `waitForNetworkVisualSeq`, inspect module identity/setup before touching production code.
- If canonical state is not installed while the visual tracker is pending, or the lock releases early, preserve the failing test evidence and revise the design because that is a real product contract failure.
- Do not make the exact bridge return a fake success and do not restore the old global expectation.

### Done when

- all sixteen parameterized cases exercise the real network-client waiter and pass;
- exact tracker/drain ordering and lock ownership are observed;
- the drain accessor returns current authoritative state and terminal exactly-once assertions pass;
- the legacy global trap remains at zero calls;
- the explicit network parity script contains the suite.

## 6. Step 2 — Make shared marker footprint anchors exact

### Outcome and rationale

Direct special-stone lookup and the numeric cell index agree for malformed stored anchors by rejecting them at the existing shared footprint owner. Valid ordinary and 2x2 markers retain identical projection.

### Files

- `shared/multi-cell-stone.ts`;
- `shared/special-stone-registry.ts`;
- `game/logic/card-resolution/board-executor.ts`;
- `test/game.marker-cell-index.test.ts`;
- `test/game.board-executor.test.ts`;
- `test/shared.special-stone-registry.test.ts`;
- `test/ui.board-dom-compat.long-press-info.test.ts`.

### Required implementation

1. In `shared/multi-cell-stone.ts::getSpecialStoneFootprint`:
   - reject null, arrays, and non-object marker values before property access;
   - read `marker.row` and `marker.col` without `Number()`;
   - require `Number.isInteger(row)` and `Number.isInteger(col)`;
   - return the same frozen empty array for invalid anchors;
   - leave ordinary anchor and ordered `square_2x2.v1` projection bodies unchanged.
2. In the fallback implementation inside `shared/special-stone-registry.ts`, apply the same exact stored-anchor check. Preserve normal delegation to `MultiCellStone` and every registry API.
3. Do not change target-argument coercion in `markerOccupiesCell`, marker classification order, snapshot repair/normalization, or independent event/action coordinate parsers.
4. Extend `test/game.marker-cell-index.test.ts` to prove, for numeric lookup arguments:
   - valid integer markers preserve direct/index identity and object order;
   - numeric-string anchors have no indexed entry and no direct match;
   - fractional, `NaN`, infinite, missing, and non-number anchors have no numeric occupancy;
   - invalid-marker classification arrays remain in their existing order and are not silently normalized.
5. Extend `test/shared.special-stone-registry.test.ts` with primary-helper coverage for:
   - valid ordinary one-cell footprint;
   - valid ordered 2x2 footprint and all four occupancy queries;
   - string/fractional/non-finite/missing anchors and primitive/non-object marker values returning no footprint.
6. Add an explicit fallback test using an isolated module registry and a mock/null `../shared/multi-cell-stone` before requiring the special-stone registry. Exercise both ordinary and 2x2 markers with the same valid/invalid matrix. Clean up the mock/module registry after the test.
7. In the dependent DOM-compat stone-info integration test, separate stored-state validity from lookup-input compatibility: keep the marker anchor as integer numbers, call `showSpecialStoneInfoAt` with numeric-string row/column arguments, and retain the same resolved stone detail assertion. Do not change `ui/presentation/stone-info-controller.ts` or restore string-valued stored-anchor acceptance.
8. In `game/logic/card-resolution/board-executor.ts`, reuse one private exact-marker predicate for activation, affected targets, instance counting, and turn-start marker lookup. Remove stored-coordinate `Number()` coercion from fallback footprint/cell projection. Do not change validated placement-action coordinate producers.
9. Add Board Executor regressions proving malformed numeric-string markers cannot satisfy the three-stone threshold, remain unchanged beside three valid targets, and cannot apply hand tax or duration decrement as an active `BOARD_EXECUTOR` manifestation.

### Focused verification

```powershell
npx jest --runInBand --runTestsByPath test\game.marker-cell-index.test.ts test\shared.special-stone-registry.test.ts test\shared.board-state-kernel.test.ts test\game.shinra-bansho-god.test.ts test\game.protection-context.test.ts test\ui.board-dom-compat.long-press-info.test.ts test\game.board-executor.test.ts
```

### Failure handling

- If a valid integer fixture changes result, ordering, ownership, protection, or footprint, revert the broad part of the edit and restore exact valid behavior; do not update that expectation.
- If the isolated fallback does not activate, fix module isolation/mocking until the fallback branch is actually observed; a passing primary path is not fallback proof.
- Do not “fix” the issue by coercing markers inside the index.

### Done when

- direct/index numeric lookups agree for the full invalid-anchor matrix;
- valid one-cell and 2x2 footprints and protection behavior pass unchanged;
- primary and compatibility fallback paths enforce the same stored-anchor contract;
- primitive/non-object marker values occupy no cell and Board Executor stored-marker consumers fail closed on malformed coordinates;
- DOM-compat stone detail accepts numeric-string lookup arguments only against canonical integer-anchored stored markers;
- product behavior changes only for malformed stored anchors; valid Board Executor and shared-footprint behavior is unchanged.

## 7. Step 3 — Replace the fixed boot prefix with an explicit dependency subsequence

### Outcome and rationale

The classic boot test detects missing/reversed foundational dependencies without failing merely because a new required module is inserted before an unrelated fixed slot.

### Files

- `test/entry-browser.boot-table-sequence.test.ts` only.

### Required implementation

1. Retain the existing parser and global/initializer assertions.
2. Replace `entries.slice(0, 27)` equality with an ordered-subsequence helper over this exact sequence:

```text
./dist/ui/layout-stage
./dist/is-env-capable
./dist/constants/difficulty-constants
./dist/constants/ui-element-cache
./dist/constants/animation-constants
./dist/cards/catalog
./dist/shared-constants
./dist/shared/board/dimensions
./dist/shared/board/configuration
./dist/shared/board/initial-layout
./dist/shared/board/expansion-descriptors
./dist/shared/board/cell-access
./dist/shared/board/corners
./dist/shared/board/edge-runs
./dist/shared/board/risk-cells
./dist/shared/board/shape-iteration
./dist/shared/board/legal-moves
./dist/shared/board/control-counts
./dist/shared/board/canonical-encoding
./dist/shared/board/notation
./dist/shared/board/padded-coordinates
./dist/shared/multi-cell-stone
./dist/shared/board/state-kernel
./dist/shared/shared-board-utils
./dist/shared/deck-spec
./dist/shared/deck-codec
./dist/shared/destroy-outcome-contract
./dist/shared/manifest-stone-registry
./dist/shared/special-stone-registry
./dist/shared/stone-status-snapshot
```

3. The helper must fail if an entry is absent and must prove strictly increasing indexes.
4. Assert every entry in that sequence except `./dist/shared/shared-board-utils` occurs exactly once in the complete table.
5. Retain the exact count of two for `./dist/shared/shared-board-utils`.
6. Assert the `./dist/shared/multi-cell-stone` entry exposes `MultiCellStone` and explicitly precedes the state kernel and special-stone registry.
7. Assert the manifest-stone registry precedes the special-stone registry and `./dist/ui/event-handlers` remains the final table entry.
8. Do not edit `entry-browser.js`; the current runtime table already satisfies the intended contract.

### Focused verification

```powershell
npx jest --runInBand --runTestsByPath test\entry-browser.boot-table-sequence.test.ts test\entry-browser.bootstrap-contract.test.ts test\scripts.build-module-registry.boot-contract.test.ts
```

### Done when

- the semantic sequence, counts, globals, and final-entry assertions pass;
- the test no longer contains an arbitrary prefix slice;
- the classic boot source is unchanged.

## 8. Step 4 — Move writer proof to its owner and correct reproduced lifecycle races

### Outcome and rationale

Presentation-drain coverage follows `writer-runtime` ownership and public operations instead of requiring its private variable to remain in the board-renderer facade.

### Files

- `test/ui.board-playback-runtime-state-contract.test.ts`;
- `test/ui.board-visual.runtime-lifecycle.test.ts`;
- `test/ui.board-visual-controller-settlement.test.ts`;
- `test/ui.board-renderer.recovery-contract.test.ts`;
- `test/ui.presentation-handler.playback-claim.test.ts`;
- `ui/board-visual/writer-runtime.ts`;
- `ui/board-visual/controller.ts`;
- `ui/board-visual/runtime-ports.ts`;
- `ui/board-renderer.ts`;
- `ui/presentation-handler.ts`.

### Required implementation

1. In `test/ui.board-playback-runtime-state-contract.test.ts`:
   - remove the assertion that searches `ui/board-renderer.ts` for `await AutoBoardWriterClaimForBoardRenderer`;
   - retain proof that `ui/presentation-handler.ts` calls `renderer.getBoardVisualControllerReadyForPresentationDrain`;
   - do not add a replacement facade source-text assertion; facade delegation is proven by the existing recovery-contract behavior test.
2. In `test/ui.board-visual.runtime-lifecycle.test.ts`, construct a writer runtime with:
   - deferred controller `waitForIdle`;
   - a mutable mode initially equal to `idle`, exposed by `getMode()`;
   - `isIdleSettlementPending()` returning true for the asynchronous-claim setup;
   - `claimWriter` returning a known synthetic token;
   - `reclaimWriter`, `settleLocalWriter`, and frame-build spies;
   - `shouldDeferRenderForPlayback` returning true.
3. Execute this exact sequence:
   - `preparePlaybackOwnership(controller, true)` and assert `{ deferredUntilAutoWriter: true }`;
   - call `getControllerReadyForPresentationDrain()` and prove it remains pending;
   - resolve idle and await readiness;
   - let `claimWriter` switch the mode to `playback` when it creates the synthetic token;
   - prove `settleLocalWriter` and final-frame build are still zero;
   - call `runtime.claim('network:next', 'network')`;
   - prove `reclaimWriter(syntheticToken, 'network:next', 'network')` is used.
4. Add a separate no-token/no-claim case proving readiness waits for ordinary idle.
5. Keep `test/ui.board-renderer.recovery-contract.test.ts` as the real facade integration proof; do not duplicate its full JSDOM setup unless a missing behavior is found.
6. Do not add a new facade source-text assertion; the recovery-contract behavior test is the facade integration proof.
7. Replace the single-microtask pending check with a macrotask sentinel that observes both fulfillment and rejection.
8. Make generic and drain readiness retry the current controller after every awaited boundary when controller/session generation changes. Treat destroy as terminal before another controller lookup and cancel pending auto-claim/deferred-render callbacks on reset. `backend-runtime` must also refuse controller acquisition/configuration after destroy so render submission exits before lazy recreation; writer playback preparation/invalidation reject after destroy. If reset overlaps an active settlement, discard the old-token invalidation at completion and generation-safely request a fresh current-state render; readiness waits and direct claim fails closed until that recovery request completes.
9. Register presentation-drain intent synchronously and retain its reservation until claim/reclaim succeeds or presentation explicitly abandons it. Generic readiness and default auto-settlement must not consume the reserved synthetic token. Active settlement must complete before drain readiness or a new claim.
10. Add `abandonPresentationDrain` to the existing optional settlement options and call it from the outer presentation-drain `finally` for every outcome, including strict failure before writer claim. The call is idempotent after successful claim. Preserve the public readiness `Promise<void>` shape.
11. Reject controller reclaim while `localWriterSettlement` is active. Suppress accumulator settlement and occupancy updates from a replaced controller's stale settlement.
12. Type the drain-specific presentation capability as optional at the compatibility port and behaviorally prove the caller selects and awaits it while leaving the queue and writer unclaimed before readiness.

### Focused verification

```powershell
npx jest --runInBand --runTestsByPath test\ui.board-playback-runtime-state-contract.test.ts test\ui.board-visual.runtime-lifecycle.test.ts test\ui.board-renderer.recovery-contract.test.ts test\ui.board-visual-controller-settlement.test.ts test\ui.presentation-handler.playback-claim.test.ts
```

### Done when

- the stale facade-private assertion is gone;
- pending claim, no premature settlement/final frame, reclaim, and ordinary-idle behavior pass through public runtime calls;
- drain-first/generic-first, active settlement, replacement, reset, and destroy scenarios pass through public runtime calls;
- stale settlement cannot mutate replacement occupancy and controller reclaim fails closed during local settlement;
- facade and presentation-handler capability wiring is covered behaviorally.

## 9. Step 5 — Run the complete focused convergence bundle

### Outcome and rationale

Prove all four repairs together before any generated surface is rewritten.

### Command

```powershell
npx jest --runInBand --runTestsByPath test\ui.network-client.guard-tempt-deferred-publish.test.ts test\game.marker-cell-index.test.ts test\entry-browser.boot-table-sequence.test.ts test\ui.board-playback-runtime-state-contract.test.ts test\ui.network-selection-signal-bridge.test.ts test\game.pending-selection-flow.test.ts test\ui.board-visual.runtime-lifecycle.test.ts test\ui.board-renderer.recovery-contract.test.ts test\ui.board-visual-controller-settlement.test.ts test\ui.presentation-handler.playback-claim.test.ts test\shared.special-stone-registry.test.ts test\shared.board-state-kernel.test.ts test\game.shinra-bansho-god.test.ts test\game.protection-context.test.ts test\game.board-executor.test.ts test\ui.board-dom-compat.long-press-info.test.ts test\entry-browser.bootstrap-contract.test.ts test\scripts.build-module-registry.boot-contract.test.ts
```

Then run:

```powershell
npm run typecheck
```

### Inspection

- inspect `git diff --` for the canonical/test/config files;
- confirm `01-rulebook.md`, `正本/`, architecture contracts, network payload/authority owners, boot source, and board backends are untouched; inspect the bounded network accessor and writer lifecycle diff against the corrected design;
- run `git diff --check` before generation so whitespace errors are isolated early.

### Done when

- the complete focused bundle and typecheck pass;
- no old assertion was simply removed without its replacement proof;
- the pre-generation diff stays inside the reviewed source/test/config boundary.

## 10. Step 6 — Generate and verify cross-runtime delivery

### Outcome and rationale

Synchronize every browser/Vite/Worker consumer from canonical sources and prove the explicit network parity gate now exercises the repaired suite.

### Ordered commands

1. Prepare the Worker mirror once; this also runs the TypeScript, browser, and Vite builds:

```powershell
npm run worker:prepare
```

2. Inspect generated diffs and confirm they are script-produced consequences of the shared helper/config changes. Do not repair them by hand.
3. Run the repository-wide structural/generated checks:

```powershell
npm run checkall
```

`checkall` invokes its existing Worker-mirror check, which performs another Vite validation build. This is expected. Do not run a second standalone `worker:prepare`.

4. Run the updated network parity suite:

```powershell
npm run test:network:parity
```

### Browser-operation decision

A browser playtest is not a required gate for this change: valid rendering, input, boot order, and player-visible behavior are intentionally unchanged; the only product logic change rejects malformed stored anchors. Browser/Vite builds, generated freshness, focused valid-marker tests, network parity, and full Jest are proportionate. If generation or a valid marker test reveals a normal-path visual difference, revise this decision and add the smallest relevant classic/Vite smoke before completion.

### Done when

- mirror preparation, the scripted validation rebuild, `checkall`, and updated network parity all pass;
- the parity command output shows the repaired deferred-selection suite ran;
- generated/mirror changes are source-derived and no unrelated artifact entered the diff.

## 11. Step 7 — Retire the red full-suite baseline

### Outcome and rationale

Establish the green baseline that is the central purpose of this refactor.

### Command

Use a command timeout of at least 30 minutes because the previous run took roughly 18 minutes:

```powershell
npm run test:jest
```

### Failure protocol

1. Completion requires Jest exit code 0, zero failed suites, and zero failed tests.
2. If a test fails:
   - rerun that exact path once to classify deterministic failure versus infrastructure instability;
   - report both the original and retry results;
   - do not delete, skip, weaken, or change expectations solely to get green.
3. If the failure is one of the four targets, return to its owning step.
4. If it is a deterministic failure caused by the marker change, fix only within the reviewed strict-anchor contract and rerun the focused bundle.
5. If it is deterministic, pre-existing, unrelated, and requires materially broader behavior work, do not create a new exception list. Revise/re-review the design and plan or report the exact blocker to the user.
6. A timeout is not a pass. Confirm whether Jest is still running, terminate/clean up only the task-started process safely if needed, then rerun with sufficient time.

### Done when

- `npm run test:jest` completes with zero failures;
- any retry/instability is documented accurately;
- the former nineteen-failure baseline is no longer referenced as an accepted completion state.

## 12. Step 8 — Record results, inspect, and commit

### Outcome and rationale

Leave an auditable, coherent implementation that another maintainer can trust without reconstructing this investigation.

### Actions

1. Update the progress checklist, discovery/decision log, and verification record below with exact commands, counts, failures/retries, generated surfaces, and residual risks.
2. Set the design and plan status to implemented and verified only after Step 7 passes.
3. Run:

```powershell
git diff --check
git status --short
```

4. Inspect the complete task-owned diff, including generated files. Confirm no secret, unrelated user work, temporary path, TODO, skipped test, or hand-edited mirror is present.
5. Stage exact task-owned paths only; never use `git add -A`.
6. Commit the coherent implementation/test/config/generated/doc-status unit with a short concrete message such as `Restore full regression baseline`.
7. Run `git status --short` after the commit. Preserve and report any unrelated pre-existing changes; do not stage or clean them.

### Done when

- plan/design status and actual evidence agree;
- every task-owned change is committed;
- final status is clean or contains only clearly reported unrelated pre-existing work;
- the final report distinguishes every check run from anything not run.

## 13. Step 9 — Post-implementation AI code-review correction

### Reproduced findings

1. Primitive `0` was projected as a marker at `(0, 0)` because the anchor expression returned the primitive itself.
2. Board Executor independently coerced stored marker coordinates, allowing malformed markers to satisfy activation or lifecycle conditions while strict shared occupancy produced no target.
3. The network test did not repeat exactly-once assertions after handler completion and did not execute the drain's card-state accessor; late duplicate work or a stale/null accessor could pass.
4. Writer pending tests used one microtask and presentation wiring used a source substring, allowing false positives.
5. Writer readiness and auto-settlement did not revalidate controller/session generation after awaits. Presentation drain could reclaim during active settlement, reset left stale auto-claims alive, active old settlement could apply its frame without requesting a current-state render, strict pre-claim failure could leak the drain reservation, and destroy could permit a retry through lazy controller access.
6. Final independent review showed the writer-only destroy flag did not cover `renderBoard()` because backend controller acquisition could lazily recreate the page runtime before writer preparation. The backend owner must remain terminal and the render path must prove it neither recreates nor claims after destroy.

### Ordered correction

1. Update this design/plan before expanding product scope, keeping player rules, protocol, boot order, and board backends unchanged.
2. Apply the marker object guard and Board Executor exact stored-coordinate predicate; run the marker/Board Executor focused bundle.
3. Strengthen terminal network/accessor assertions. The first focused run may expose a JSDOM root/global split; if so, use the existing network-client global resolver rather than creating a new authority path, then rerun all sixteen cases.
4. Implement writer controller/session generations, drain reservation through claim/abandon, active-settlement exclusion, stale-settlement suppression, reset cancellation, terminal destroy, and controller reclaim guard. Add behavior tests for both readiness orders and every lifecycle boundary.
5. Run the expanded combined focused bundle, typecheck, `check:window`, board playback check, network parity, `worker:prepare`, `checkall`, and full Jest. Record any initial failure and the correction; zero failures remains mandatory.
6. Request independent read-only re-review of the final task-owned diff. Resolve every major/medium actionable finding and rerun affected gates.
7. Inspect, stage exact task-owned paths, and create a coherent follow-up commit. Do not amend or rewrite the already-landed baseline commit.

### Done when

- every reproduced finding has a regression test and bounded owner fix;
- both canonical documents describe the corrected owner boundaries without retaining superseded “no writer product change” or Board Executor exclusion claims;
- focused, structural, generated, parity, board-playback, and full Jest gates pass;
- independent re-review has no unresolved major/medium finding;
- the follow-up correction is committed and final status is clean or only contains reported unrelated work.

## 14. Progress checklist

- [x] Step 0: working tree classified and four-suite/19-failure ledger reproduced.
- [x] Step 1: real network-client exact settlement proven in all sixteen cases and added to network parity.
- [x] Step 2: shared primary/fallback anchor contract made exact with valid/invalid coverage, including the dependent DOM-compat query assertion.
- [x] Step 3: classic boot dependency subsequence replaces the fixed prefix.
- [x] Step 4: writer proof moved to public runtime behavior and facade capability wiring.
- [x] Step 5: complete focused bundle, typecheck, pre-generation diff check pass.
- [x] Step 6: Worker preparation, `checkall`, and updated network parity pass.
- [x] Step 7: full Jest passes with zero failed suites/tests.
- [x] Step 8: the original verified baseline-restoration unit was committed as `33e57e3ad` (`Restore full regression baseline`).
- [x] Step 9: post-implementation AI review corrections verified, independently re-reviewed, and committed as `7323b612a`.

## 15. Decision and discovery log

- 2026-08-09: selected regression-contract convergence before another structural extraction because the current known-red baseline prevents simple green-to-green proof.
- 2026-08-09: classified the marker failure as a real shared-helper inconsistency, not a stale test; selected exact stored anchors rather than index coercion.
- 2026-08-09: rejected bridge-method replacement in the network test because it bypasses `ui/network-client.ts` settlement orchestration; selected call-through bridge plus controlled tracker/drain leaves.
- 2026-08-09: confirmed board visual state selection is already unified by `render-state-source.ts`; intentionally isolated per-consumer prepared state is not reopened.
- 2026-08-09: selected Worker/local room-deck metadata as the next separate characterization candidate after this work; it is not in scope here.
- 2026-08-09: no browser playtest is required unless implementation evidence shows a normal-path visual or boot change.
- 2026-08-09: the first implementation-focused network run proved the settlement lock remains held while the tracker is pending, but the pre-existing Node-global `isProcessing` / `isCardAnimating` fixtures remain false because this installed bridge has no busy-state writer methods. Removed those two non-owner assertions from the design and plan instead of adding a new global side effect; handler incompletion plus `isSelectionSettlementLocked()` remain the direct contract proof.
- 2026-08-09: after exact settlement began passing, the temptation case reached a previously masked board-sync assertion. A later peek of transient board-update context is not owner-level proof because intervening snapshot work may consume or replace it. Replaced that observation with a call-through spy on the installed bridge's public `armBoardUpdateDuringPlayback` capability and require the matching request to return `true`; the explicit `.js` compatibility import versus TypeScript Jest resolution is only a secondary module-identity fact, not the causal contract.
- 2026-08-09: the first full Jest run passed 1016/1017 suites and 7601/7602 tests, exposing one deterministic marker-dependent assertion in `ui.board-dom-compat.long-press-info`. The fixture conflated malformed string-valued stored anchors with supported string query arguments. Revised the design/plan and integration test to keep stored anchors canonical integers while querying with `'2'`/`'4'`; no UI runtime change and no weakening of strict stored-anchor rejection.
- 2026-08-09: an additional, non-plan `npm run worker:bundle:smoke` failed before the changed footprint path because `workers/match-worker-runtime-preload.ts` registers `CardMeteorGod` and three other strict consumers before `CardMarkers`. `git diff`, blame/history, and independent diagnosis tie this to prior commit `849f555e43`; it is not caused by this task. The reviewed completion gates remain satisfied, but Worker deploy-smoke readiness is not claimed. Repairing that preload order and adding its missing order contract is a separate small delivery task.
- 2026-08-09: the separate Worker preload prerequisite was repaired in `87978034e`, its generated delivery was refreshed in `51924c95a`, and `npm run worker:bundle:smoke` now passes. This does not alter the scope or evidence of correction commit `7323b612a`.
- 2026-08-09: post-delivery AI review later found another evaluation-time preload edge: bundled `CardUtils` captured `OwnerHelpers` before registration, so charge updates became no-ops when ambient `require` was unavailable. Correction commit `823f35846` orders `PlayerSeatContract -> OwnerHelpers -> CardUtils`, extends the order contract, and makes bundle smoke assert the real charge mutation before loading root game modules. The same smoke now passes this assertion plus the existing poison AUTO, DOUBLE_PLACE, and room lifecycle scenarios.
- 2026-08-09: final full Jest passed 1017/1017 suites and 7602/7602 tests. The nineteen-failure accepted baseline is retired without a replacement exception list.
- 2026-08-09: requested AI code review reproduced primitive-marker projection and Board Executor stored-coordinate coercion. Revised the design/plan before broadening the fix: shared owners now require a marker object, and only Board Executor's stored-marker consumers join the exact-coordinate boundary; universal ingress normalization remains excluded.
- 2026-08-09: terminal network assertions were strengthened after review showed that permanently resolved tracker/drain gates could hide late duplicate work. Executing the accessor exposed three JSDOM cases where authoritative `cardState` lived on the compatible global surface rather than `window`; selected the existing `resolveNetworkClientGlobal` boundary, not a new authority or state repair path.
- 2026-08-09: replacing the writer test's one-microtask sentinel and source substring with behavioral checks reproduced controller replacement, active-settlement reclaim, reset callback, and destroy retry races. Revised §5.4 to add controller/session generations, synchronous drain reservation through claim/abandon, stale-settlement suppression, and controller reclaim defense while retaining one writer and the public readiness shape.

Implementation discoveries that change scope, owners, interfaces, or verification must be appended here and reflected in both documents before proceeding.

## 16. Verification record

### Design-time evidence

- working tree: clean before document creation;
- focused four-suite rerun: 4 suites failed, 19 tests failed, with the exact ledger in §3;
- `npm run typecheck`: passed;
- `npm run check:dependency-boundaries`: passed (4 tests);
- `npm run check:window`: passed;
- independent review: corrected the network leaf-mocking boundary, removed an already-completed refactor candidate, narrowed marker claims, required fallback coverage, fixed boot/writer scenarios, and confirmed the final selected direction.

### Implementation-time evidence

- Baseline reproduction: the exact four target paths failed as designed with 4 failed suites, 19 failed / 7 passed tests. The failure ledger matched the design.
- Network implementation iterations:
  - the first focused run exposed that Node-global busy fixtures are not written by the installed bridge; the design/plan were corrected to observe the direct settlement lock and incomplete handler instead;
  - the next run passed 15/16 cases and exposed the stale downstream board-context peek; the design/plan were corrected to observe the installed bridge capability and its `true` return;
  - the repaired network suite passed 16/16, and the focused network bundle passed 3 suites / 66 tests.
- Marker implementation:
  - primary/fallback direct coverage passed 2 suites / 23 tests;
  - the original marker-focused bundle passed 5 suites / 59 tests;
  - after the full-suite discovery, the revised marker/DOM-compat bundle passed 6 suites / 83 tests, including 24/24 stone-info tests.
- Boot focused bundle: 3 suites / 20 tests passed. Writer focused bundle: 3 suites / 19 tests passed.
- The initial combined focused bundle passed 14 suites / 164 tests. After adding the dependent DOM-compat assertion to the canonical plan, the final combined command passed 15 suites / 188 tests.
- `npm run typecheck`: passed. Pre-generation and implementation-time `git diff --check`: passed; Git reported only the repository's line-ending conversion warnings.
- `npm run worker:prepare`: passed after focused verification. It regenerated a 1083-module browser registry and verified a 960-file Worker mirror. Script-owned changes are limited to root/browser cache-buster and registry surfaces plus matching `worker-public/` HTML/registry/Vite manifest output and the hashed Vite chunk replacement.
- `npm run checkall`: passed, including the window/global guard, all 4 dependency-boundary tests, refactor safety, TypeScript migration, board-kernel boundary, selector checks, browser freshness, asset/artifact checks, and Worker mirror validation. The existing Vite chunk-size warning remained informational.
- `npm run test:network:parity`: passed 36 suites / 581 tests, and its command output includes `test\ui.network-client.guard-tempt-deferred-publish.test.ts`. Jest printed its existing post-run open-handle warning despite all tests passing; the repaired suite alone exits normally.
- First `npm run test:jest`: failed 1/1017 suites and 1/7602 tests after passing 1016 suites / 7601 tests (1025.318 s). Exact-path retry reproduced the same single deterministic failure with 23/24 tests passing. After the reviewed fixture correction, the direct path passed 24/24.
- Final `npm run test:jest`: passed 1017/1017 suites and 7602/7602 tests (Jest 961.897 s, process exit 0). No known-red exception remains.
- Extra diagnostic `npm run worker:bundle:smoke`: initially failed during bundled preload with `CardMarkers.isInviolableCell is required by CardMeteorGod`. Source history and independent diagnosis proved that the pre-existing preload dependency was causal and that the failure occurred before this task's strict-anchor path. No unrelated preload fix was folded into correction commit `7323b612a`; the separate repair in `87978034e` plus generated delivery `51924c95a` now makes the same smoke pass.
- Independent implementation re-review: the exact-settlement lock assertions and board-sync return proof were accepted after correction; the full-suite marker discovery was classified as a stale integration fixture, and the integer stored-anchor / numeric-string query split was accepted with no major or medium finding.
- Browser operation: not run. Valid normal rendering/input/boot behavior did not change; browser/Vite builds, generated freshness, focused DOM-compat integration, E2E-inclusive full Jest, and network parity provide the selected proportional evidence.

### Post-implementation AI code-review correction evidence (complete)

- Initial marker/network focused command: registry and Board Executor passed; the strengthened network accessor assertion failed 3/16 cases because the JSDOM root did not expose the authoritative state held by the compatible global surface. After changing the accessor to the existing global resolver, the network suite passed 16/16.
- Initial writer correction command: 3/4 suites and 56/57 tests passed. The one recovery-contract failure encoded the superseded behavior that generic readiness should settle a writer already reserved by a completed presentation drain. The test was corrected to require no premature settlement and to use explicit abandon; the first corrected rerun passed 4/4 suites and 65/65 tests.
- Independent correction re-review then reproduced two more terminal gaps: reset during active settlement lost the new-session render, and strict failure before writer claim left the drain reservation dependent on later incidental cleanup. The runtime now requests a generation-aware fresh render and discards old-token invalidation after settlement; the outer presentation finally abandons idempotently on every outcome. The expanded writer/presentation rerun passed 4/4 suites and 67/67 tests.
- Final diff review found that writer teardown alone did not stop backend lazy controller creation on a late render. `backend-runtime` now makes controller acquisition/configuration terminal after page destroy, and writer prepare/invalidation also reject. The render-submission regression plus the writer/presentation bundle passed 4/4 suites and 68/68 tests; `npm run typecheck` passed again.
- `npx tsc --noEmit --pretty false`: passed after the corrected writer/runtime port implementation.
- Final focused correction rerun: 7 suites / 137 tests passed. Independent final re-review ran the broader Step 9 bundle at 18 suites / 276 tests and found no unresolved major or medium implementation issue.
- `npm run check:window`: passed. `npm run match:pixijs-board-playback-check`: passed 12 reports / 232 scenarios across classic/Vite, Pixi/DOM compatibility, and motion modes.
- `npm run test:network:parity`: passed 36 suites / 581 tests; Jest printed the repository's existing post-run open-handle warning after the green result.
- `npm run worker:prepare` and the direct mirror check passed with a 960-file Worker mirror. One concurrent verification-generation race produced a transient mirror mismatch; after the competing cleanup stopped, a clean rerun regenerated and verified the mirror successfully.
- `npm run checkall`: passed. The existing Vite chunk-size warning remained informational.
- Final post-correction `npm run test:jest`: passed 1017/1017 suites and 7617/7617 tests (984.813 s, exit 0). An earlier combined verification invocation hit its 184-second harness timeout; each gate was then rerun independently to completion.
- `npm run worker:bundle:smoke`: initially exposed the separate preload dependency defect and still failed after an order-only attempt. The bounded runtime dependency repair in `87978034e`, generated refresh in `51924c95a`, and final rerun passed poison AUTO, DOUBLE_PLACE, and create/join/state/leave flows.
- Correction implementation was committed as `7323b612a`. Independent source/diff review of that commit found no unresolved major or medium issue, and `git diff --check 33e57e3ad..7323b612a` passed.
- Residual risk: ordinary-marker ingress does not yet enforce one universal row/column schema across every marker type; this task fail-closes shared occupancy and the bounded Board Executor consumers without repairing input. A universal ingress rule would need a separate Worker/local/client network-contract design. The formerly separate Worker preload readiness defect is resolved.

## 17. Final completion checklist

- [x] User goal: the reviewed correction is complete in addition to the original baseline restoration.
- [x] Design §5.2: accepted publish passes through real network-client exact settlement, current state access, operation identity, tracker, drain, terminal exactly-once assertions, and lock ordering.
- [x] Design §5.3: shared primary/fallback and Board Executor consumers reject malformed stored anchors without changing valid behavior.
- [x] Design §5.4: writer presentation drain is generation-safe and proven at runtime owner, controller, facade, and caller.
- [x] Design §5.5: boot dependencies are checked semantically with the exact foundational subsequence and counts.
- [x] Design §5.6: browser/Vite/Worker delivery is regenerated from corrected root sources and verified through preparation, mirror, structural, parity, board-playback, and full-suite gates.
- [x] Design §11: corrected completion conditions are satisfied with no rulebook, protocol, saved-format, dependency, or valid player-visible behavior change.
- [x] Full Jest exits successfully with zero failures after the correction; no known-red exception remains.
- [x] Final task-owned diff/status and generated outputs are inspected; no unrelated file is staged.
- [x] Plan/design records truthfully show the verified and committed final state.

## 18. Self-review

The first plan draft would have allowed the network bridge method itself to be replaced with a deferred fake. That contradicted the design goal because it skipped the network-client's `visualSeq`, `operationId`, session, and drain behavior. The plan now fixes the controllable boundary one layer lower and gives an exact pre-resolution/post-resolution assertion sequence.

Final review replaced arbitrary microtask flushing with explicit tracker/drain entry latches and an early-handler-settlement race, and it now checks the selection-flow lock owner directly before and after both waits. This removes a likely 16-case flake/hang source.

The marker step was expanded to cover ordinary one-cell markers as well as the 2x2 stone and to force the registry's compatibility fallback through isolated module loading. It explicitly excludes other coordinate parsers and target-argument compatibility, preventing a small hardening change from becoming an unbounded normalization effort.

The boot step contains the complete 30-entry foundational ordered subsequence, uniqueness rules, critical edges, global exposure, intentional duplicate, and final entry, so the executor cannot satisfy it with a weak unordered presence check. The original writer step expected no product edit; the requested AI review disproved that assumption with executable races, and Step 9 now limits the correction to lifecycle ownership rather than preserving a false non-goal.

The writer fixture states the `idle` mode and pending-idle preconditions that force the intended asynchronous claim branch, asserts the branch decision, and uses behavior rather than move-hostile source assertions. Step 9 replaces the insufficient one-microtask pending proof with a macrotask sentinel and adds replacement/reset/destroy/settlement coverage. The bounded correction is recorded as commit `7323b612a`.

Finally, generation is ordered after all focused tests, Worker mirror preparation is run once, the extra build inside `checkall` is acknowledged, network parity precedes the long full suite, and the full suite has a zero-failure gate and explicit unexpected-failure protocol. The final documentation/status/commit step satisfies repository delivery rules without authorizing unrelated cleanup. No material architecture or test-design choice remains for the implementation model.

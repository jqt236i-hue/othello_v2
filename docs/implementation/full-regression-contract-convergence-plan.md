# Full regression contract convergence implementation plan

- Status: reviewed and ready for implementation
- Date: 2026-08-09
- Design authority: `docs/implementation/full-regression-contract-convergence-design.md`
- Document role: ordered implementation and verification plan for closing the four known failing Jest suites and restoring a zero-failure full regression baseline
- Scope authority: if this plan conflicts with the reviewed design, the design wins and both documents must be corrected before implementation continues
- Player-visible specification: unchanged; do not edit `01-rulebook.md` or `正本/*.md`
- Execution mode: one checkout, sequential contract repair, focused proof before generation, then cross-runtime and full-suite gates

## 1. Objective and delivery rule

Restore the normal full Jest baseline from four known failing suites and nineteen failures to zero failures without changing valid player-visible behavior. Three failures are repaired by moving tests to current capability owners; one is repaired by rejecting non-integer stored marker anchors consistently at the existing shared footprint owner.

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
- `package.json` only to add the existing deferred-selection suite to `test:network:parity`.

### Test changes

- `test/ui.network-client.guard-tempt-deferred-publish.test.ts`;
- `test/game.marker-cell-index.test.ts`;
- `test/entry-browser.boot-table-sequence.test.ts`;
- `test/ui.board-playback-runtime-state-contract.test.ts`;
- `test/ui.board-visual.runtime-lifecycle.test.ts`;
- `test/shared.special-stone-registry.test.ts`.

Existing adjacent suites are verification consumers and should be edited only if a test gap described by the design cannot be expressed in the files above. In particular, no product change is expected in:

- `ui/network-client.ts`;
- `ui/network/selection-signal-bridge.ts`;
- `game/card-effects/selection-flow.ts` or its execution core;
- `entry-browser.js`;
- `ui/board-renderer.ts`;
- `ui/board-visual/writer-runtime.ts`.

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
   - `selectionFlowModule.isSelectionSettlementLocked()` is true;
   - `isProcessing` and `isCardAnimating` remain true as supplemental busy-state observations.
7. Resolve the tracker with `{ ok: true, visualSeq: 1 }`. Race `drainEntered.promise` against premature handler settlement, then assert that playback drain has started with the network-client root/current-card-state access while the handler completion flag is false and `isSelectionSettlementLocked()` remains true.
8. Resolve the drain, await the handler, prove `isSelectionSettlementLocked()` is false, and perform every retained request/state assertion.
9. Restore spies and deferred state in `afterEach` so the 16-case table leaves no open handle or cross-case module state.
10. Add `test\ui.network-client.guard-tempt-deferred-publish.test.ts` to `test:network:parity` next to the existing deferred-publish client suites. Do not change any other script or lockfile.

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
- the legacy global trap remains at zero calls;
- the explicit network parity script contains the suite.

## 6. Step 2 — Make shared marker footprint anchors exact

### Outcome and rationale

Direct special-stone lookup and the numeric cell index agree for malformed stored anchors by rejecting them at the existing shared footprint owner. Valid ordinary and 2x2 markers retain identical projection.

### Files

- `shared/multi-cell-stone.ts`;
- `shared/special-stone-registry.ts`;
- `test/game.marker-cell-index.test.ts`;
- `test/shared.special-stone-registry.test.ts`.

### Required implementation

1. In `shared/multi-cell-stone.ts::getSpecialStoneFootprint`:
   - read `marker && marker.row` and `marker && marker.col` without `Number()`;
   - require `Number.isInteger(row)` and `Number.isInteger(col)`;
   - return the same frozen empty array for invalid anchors;
   - leave ordinary anchor and ordered `square_2x2.v1` projection bodies unchanged.
2. In the fallback implementation inside `shared/special-stone-registry.ts`, apply the same exact stored-anchor check. Preserve normal delegation to `MultiCellStone` and every registry API.
3. Do not change target-argument coercion in `markerOccupiesCell`, marker classification order, snapshot repair/normalization, or other coordinate parsers.
4. Extend `test/game.marker-cell-index.test.ts` to prove, for numeric lookup arguments:
   - valid integer markers preserve direct/index identity and object order;
   - numeric-string anchors have no indexed entry and no direct match;
   - fractional, `NaN`, infinite, missing, and non-number anchors have no numeric occupancy;
   - invalid-marker classification arrays remain in their existing order and are not silently normalized.
5. Extend `test/shared.special-stone-registry.test.ts` with primary-helper coverage for:
   - valid ordinary one-cell footprint;
   - valid ordered 2x2 footprint and all four occupancy queries;
   - string/fractional/non-finite/missing anchors returning no footprint.
6. Add an explicit fallback test using an isolated module registry and a mock/null `../shared/multi-cell-stone` before requiring the special-stone registry. Exercise both ordinary and 2x2 markers with the same valid/invalid matrix. Clean up the mock/module registry after the test.

### Focused verification

```powershell
npx jest --runInBand --runTestsByPath test\game.marker-cell-index.test.ts test\shared.special-stone-registry.test.ts test\shared.board-state-kernel.test.ts test\game.shinra-bansho-god.test.ts test\game.protection-context.test.ts
```

### Failure handling

- If a valid integer fixture changes result, ordering, ownership, protection, or footprint, revert the broad part of the edit and restore exact valid behavior; do not update that expectation.
- If the isolated fallback does not activate, fix module isolation/mocking until the fallback branch is actually observed; a passing primary path is not fallback proof.
- Do not “fix” the issue by coercing markers inside the index.

### Done when

- direct/index numeric lookups agree for the full invalid-anchor matrix;
- valid one-cell and 2x2 footprints and protection behavior pass unchanged;
- primary and compatibility fallback paths enforce the same stored-anchor contract;
- only the two canonical shared source files change product behavior, limited to malformed stored anchors.

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

## 8. Step 4 — Move writer proof to public runtime behavior

### Outcome and rationale

Presentation-drain coverage follows `writer-runtime` ownership and public operations instead of requiring its private variable to remain in the board-renderer facade.

### Files

- `test/ui.board-playback-runtime-state-contract.test.ts`;
- `test/ui.board-visual.runtime-lifecycle.test.ts`.

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
7. Do not edit writer runtime or controller implementation.

### Focused verification

```powershell
npx jest --runInBand --runTestsByPath test\ui.board-playback-runtime-state-contract.test.ts test\ui.board-visual.runtime-lifecycle.test.ts test\ui.board-renderer.recovery-contract.test.ts
```

### Done when

- the stale facade-private assertion is gone;
- pending claim, no premature settlement/final frame, reclaim, and ordinary-idle behavior pass through public runtime calls;
- facade and presentation-handler capability wiring remains covered;
- product writer code is unchanged.

## 9. Step 5 — Run the complete focused convergence bundle

### Outcome and rationale

Prove all four repairs together before any generated surface is rewritten.

### Command

```powershell
npx jest --runInBand --runTestsByPath test\ui.network-client.guard-tempt-deferred-publish.test.ts test\game.marker-cell-index.test.ts test\entry-browser.boot-table-sequence.test.ts test\ui.board-playback-runtime-state-contract.test.ts test\ui.network-selection-signal-bridge.test.ts test\game.pending-selection-flow.test.ts test\ui.board-visual.runtime-lifecycle.test.ts test\ui.board-renderer.recovery-contract.test.ts test\shared.special-stone-registry.test.ts test\shared.board-state-kernel.test.ts test\game.shinra-bansho-god.test.ts test\game.protection-context.test.ts test\entry-browser.bootstrap-contract.test.ts test\scripts.build-module-registry.boot-contract.test.ts
```

Then run:

```powershell
npm run typecheck
```

### Inspection

- inspect `git diff --` for the canonical/test/config files;
- confirm `01-rulebook.md`, `正本/`, architecture contracts, network client, boot source, and writer product source are untouched;
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

## 13. Progress checklist

- [ ] Step 0: working tree classified and four-suite/19-failure ledger reproduced.
- [ ] Step 1: real network-client exact settlement proven in all sixteen cases and added to network parity.
- [ ] Step 2: shared primary/fallback anchor contract made exact with valid/invalid coverage.
- [ ] Step 3: classic boot dependency subsequence replaces the fixed prefix.
- [ ] Step 4: writer proof moved to public runtime behavior and facade capability wiring.
- [ ] Step 5: complete focused bundle, typecheck, pre-generation diff check pass.
- [ ] Step 6: Worker preparation, `checkall`, and updated network parity pass.
- [ ] Step 7: full Jest passes with zero failed suites/tests.
- [ ] Step 8: actual results recorded, final diff/status inspected, task-owned unit committed.

## 14. Decision and discovery log

- 2026-08-09: selected regression-contract convergence before another structural extraction because the current known-red baseline prevents simple green-to-green proof.
- 2026-08-09: classified the marker failure as a real shared-helper inconsistency, not a stale test; selected exact stored anchors rather than index coercion.
- 2026-08-09: rejected bridge-method replacement in the network test because it bypasses `ui/network-client.ts` settlement orchestration; selected call-through bridge plus controlled tracker/drain leaves.
- 2026-08-09: confirmed board visual state selection is already unified by `render-state-source.ts`; intentionally isolated per-consumer prepared state is not reopened.
- 2026-08-09: selected Worker/local room-deck metadata as the next separate characterization candidate after this work; it is not in scope here.
- 2026-08-09: no browser playtest is required unless implementation evidence shows a normal-path visual or boot change.

Implementation discoveries that change scope, owners, interfaces, or verification must be appended here and reflected in both documents before proceeding.

## 15. Verification record

### Design-time evidence

- working tree: clean before document creation;
- focused four-suite rerun: 4 suites failed, 19 tests failed, with the exact ledger in §3;
- `npm run typecheck`: passed;
- `npm run check:dependency-boundaries`: passed (4 tests);
- `npm run check:window`: passed;
- independent review: corrected the network leaf-mocking boundary, removed an already-completed refactor candidate, narrowed marker claims, required fallback coverage, fixed boot/writer scenarios, and confirmed the final selected direction.

### Implementation-time evidence

Pending. Replace this line with exact command results, counts, retries, generated-output notes, and residual risks before setting status to implemented/verified. Record the resulting commit hash in the final user report, where it is available after commit creation.

## 16. Final completion checklist

- [ ] User goal: the current safest/highest-leverage refactor has been implemented before riskier structural candidates.
- [ ] Design §5.2: accepted publish passes through real network-client exact settlement, operation identity, tracker, drain, and lock ordering.
- [ ] Design §5.3: shared primary and fallback footprint owners reject malformed stored anchors without changing valid footprints.
- [ ] Design §5.4: writer presentation drain is proven at its runtime owner and through the facade.
- [ ] Design §5.5: boot dependencies are checked semantically with the exact foundational subsequence and counts.
- [ ] Design §5.6: browser/Vite/Worker delivery is generated from root sources and verified.
- [ ] Design §11: all completion conditions are satisfied with no rulebook, protocol, saved-format, dependency, or valid player-visible behavior change.
- [ ] Full Jest exits successfully with zero failures; no known-red exception remains.
- [ ] Final task-owned diff/status and generated outputs are inspected; no unrelated file is staged.
- [ ] Plan/design execution records are current and the verified unit is committed.

## 17. Self-review

The first plan draft would have allowed the network bridge method itself to be replaced with a deferred fake. That contradicted the design goal because it skipped the network-client's `visualSeq`, `operationId`, session, and drain behavior. The plan now fixes the controllable boundary one layer lower and gives an exact pre-resolution/post-resolution assertion sequence.

Final review replaced arbitrary microtask flushing with explicit tracker/drain entry latches and an early-handler-settlement race, and it now checks the selection-flow lock owner directly before and after both waits. This removes a likely 16-case flake/hang source.

The marker step was expanded to cover ordinary one-cell markers as well as the 2x2 stone and to force the registry's compatibility fallback through isolated module loading. It explicitly excludes other coordinate parsers and target-argument compatibility, preventing a small hardening change from becoming an unbounded normalization effort.

The boot step now contains the complete 30-entry foundational ordered subsequence, uniqueness rules, critical edges, global exposure, intentional duplicate, and final entry, so the executor cannot satisfy it with a weak unordered presence check. The writer step likewise fixes the exact public-operation sequence and requires no product writer edit.

The writer fixture now states the `idle` mode and pending-idle preconditions that force the intended asynchronous claim branch, asserts the branch decision, and uses existing recovery behavior as the facade proof without adding another move-hostile source assertion. The verification record no longer asks for a commit hash before the single coherent commit exists; that hash belongs in the final report.

Finally, generation is ordered after all focused tests, Worker mirror preparation is run once, the extra build inside `checkall` is acknowledged, network parity precedes the long full suite, and the full suite has a zero-failure gate and explicit unexpected-failure protocol. The final documentation/status/commit step satisfies repository delivery rules without authorizing unrelated cleanup. No material architecture or test-design choice remains for the implementation model.

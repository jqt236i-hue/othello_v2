# Full regression contract convergence design

- Status: post-implementation AI code-review correction in progress
- Date: 2026-08-09
- Document role: the implementation design for restoring a zero-known-failure regression baseline before any further structural refactor
- Target: the four initially reproducible failing Jest suites, their nineteen failures, the dependent compatibility assertion exposed by strict-anchor convergence, and the concrete marker/network/writer defects exposed by the post-implementation AI code review
- Sources of truth: root `AGENTS.md`, the nearest directory `AGENTS.md` files, `docs/architecture-contracts.md` §§6.2.1, 6.4, 7.2, 7.3, 8.1, 9.1, 11, and 12, the current root implementation, and the tests named in this document
- Player-visible specification: unchanged; `01-rulebook.md` and `正本/*.md` are not edited
- Non-goals: valid gameplay or card-rule changes, network payload/protocol changes, boot-order changes, removal of compatibility globals repo-wide, broad malformed-state normalization, giant-file splitting, Worker/local room-deck unification, Pixi scene decomposition, generated-file source edits, and Git-history rewriting. The reviewed correction may change only the bounded marker consumers, network state accessor, and board-writer lifecycle owners required by reproduced defects.

## 1. Problem and desired outcome

The recent non-destructive refactor program is structurally healthy: the current checkout passes typecheck, dependency-boundary checks, and the `game`/`shared` browser-global guard, and the runtime dependency graph has no cycles. However, the normal full Jest baseline is still red.

The latest recorded full run in `docs/implementation/post-convergence-safe-refactor-drift-remediation-plan.md` completed with 1012 of 1016 suites and 7570 of 7589 tests passing. All nineteen failures were proven to predate that refactor and were therefore recorded rather than fixed. A focused rerun at current `HEAD` (`da4d5335a`) reproduces the same four suites and nineteen failures:

| Suite | Failures | Actual cause |
| --- | ---: | --- |
| `test/ui.network-client.guard-tempt-deferred-publish.test.ts` | 16 | The test still counts the legacy global playback waiter after accepted network selection moved to the injected exact-authoritative visual-settlement capability. |
| `test/game.marker-cell-index.test.ts` | 1 | The indexed path rejects a marker whose stored coordinates are strings, while the direct path coerces the same malformed marker through `Number()` and accepts it. This is a real contract split, not merely a stale assertion. |
| `test/entry-browser.boot-table-sequence.test.ts` | 1 | A fixed 27-entry prefix predates the required `shared/multi-cell-stone` boot dependency inserted ahead of the board state kernel. |
| `test/ui.board-playback-runtime-state-contract.test.ts` | 1 | The assertion requires writer internals to remain in `ui/board-renderer.ts`, although the completed board-renderer decomposition moved their owner to `ui/board-visual/writer-runtime.ts`. |

This leaves every later refactor without a simple green-to-green regression proof. A comparison against a known-red baseline can show that a change did not add these nineteen failures, but it is slower, easier to misread, and cannot catch accidental cancellation or masking of an old failure as directly as a fully green baseline.

The desired outcome is:

1. every assertion observes the current public capability or canonical owner rather than a retired implementation location;
2. direct and indexed marker lookup agree for canonical numeric queries over malformed marker anchors, with invalid anchors rejected fail-closed;
3. the focused network parity command includes the sixteen-case deferred-selection contract;
4. `npm run test:jest` completes with zero failing suites and zero failing tests;
5. no valid canonical game state, network result, visual ordering, boot order, or player-visible behavior changes.
6. post-implementation review findings are closed with behavior tests rather than accepted as residual risk or hidden behind weaker assertions.

This is a verification-contract refactor with one bounded shared-state hardening change. It deliberately precedes another large source decomposition because it makes every later change objectively safer to evaluate.

## 2. Evidence and root-cause analysis

### 2.1 Repository health outside the known failures

The investigation started and ended its read-only diagnostic phase with a clean working tree. At current `HEAD`:

- `npm run typecheck` passes;
- `npm run check:dependency-boundaries` passes all four focused tests and reports no runtime dependency cycle;
- `npm run check:window` passes;
- TypeScript with `noUnusedLocals` reports 348 diagnostics, exactly the established compatibility-sensitive baseline rather than new drift;
- recent board-renderer and post-convergence refactor plans are marked completed and their implementation commits are present.

The selected work therefore does not repair a broad architecture collapse. It closes a narrow verification debt left across several completed migrations.

### 2.2 Deferred network selection

`ui/network-client.ts` installs `NetworkSelectionSignalBridge` with an injected `waitForAuthoritativeVisualSettlement` function. `game/card-effects/selection-flow-execution-core.ts` awaits that exact waiter after an accepted publish when the pending-selection contract requires playback settlement. Only when the exact capability is absent may the legacy playback waiter be considered.

The sixteen failing cases already prove the important gameplay and authority facts: one deferred command is published, no publish snapshot or client-authored playback list is sent, publish-only selections do not run a local preview, the authoritative returned state is applied, and local presentation is not emitted. Their sole failing assertion expects `global.waitForPlaybackIdle` to have been called once. That expectation was introduced before commit `d605e8c491` installed accepted `visualSeq` settlement and is now the inverse of the desired authority path.

The bridge already has a focused unit test in `test/ui.network-selection-signal-bridge.test.ts`, and selection-flow core coverage already proves that a deferred exact waiter keeps processing locked until settlement. The end-to-end client test must now observe that same injected bridge at the real publish boundary.

### 2.3 Marker coordinate identity

`docs/architecture-contracts.md` §6.2.1 assigns multi-cell anchor-to-footprint projection and complete-group validation to shared helpers. Canonical snapshots must contain exact coordinates and fail closed on incomplete or malformed groups.

The indexed marker path in `game/logic/cards/markers.ts` uses type-aware keys and does not index a string-valued marker anchor for a numeric cell query. The direct path delegates through `shared/special-stone-registry.ts` to `shared/multi-cell-stone.ts`, whose `getSpecialStoneFootprint()` currently performs `Number(marker.row)` and `Number(marker.col)`. A marker stored at `{ row: '1', col: '1' }` therefore appears at numeric cell `(1, 1)` only through the direct path.

The failing test requiring no string-coordinate coercion predates the July 29 multi-cell helper, while the state-kernel inspection logic already rejects non-integer multi-cell anchors with an exact-coordinate error. The smallest coherent correction is to make the canonical shared footprint helper inspect the stored anchor as-is. It is not to make the index coerce malformed state.

The first implementation-time full Jest run exposed one dependent compatibility assertion in `test/ui.board-dom-compat.long-press-info.test.ts`. Its fixture stored marker anchors as numeric strings while describing them as “network-style”, which conflicts with the exact stored-anchor contract above: JSON transport preserves numeric marker fields as numbers, public snapshot fixtures use numeric anchors, and the shared owner now deliberately rejects malformed stored strings. The supported compatibility behavior is instead the existing target-query coercion in `markerOccupiesCell()`. The integration test therefore keeps a canonical integer marker and passes string row/column query arguments to `showSpecialStoneInfoAt()`, proving query compatibility without reintroducing malformed stored-state acceptance. No UI product implementation changes.

Post-implementation review found two additional exact-anchor defects. First, `marker && marker.row` returns the primitive `0` when the alleged marker is `0`, so the footprint helper could project a non-object as cell `(0, 0)`. The owner and fallback must reject null, arrays, and every non-object before reading coordinates. Second, `game/logic/card-resolution/board-executor.ts` independently coerced stored marker coordinates. Three numeric-string markers could satisfy the card's activation threshold while the now-strict footprint owner returned no targets, consuming the card and arming its next-placement reservation without executing a stone. The same coercion made a malformed string-coordinate `BOARD_EXECUTOR` marker apply hand tax and turn-start duration. Because these are direct consumers of the same stored-anchor contract, they are part of this correction; universal snapshot ingress validation remains out of scope.

### 2.4 Browser boot order

The classic bootstrap is intentionally order-sensitive. `shared/special-stone-registry.ts` receives `root.MultiCellStone` in its browser-global branch, so `entry-browser.js` correctly loads and exposes `./dist/shared/multi-cell-stone` before the special-stone registry. The stale test slices the first 27 entries and compares them with a list written before this dependency existed; the runtime table itself has the required dependency in the correct position.

An exact arbitrary prefix length is not the contract. Required module presence, global exposure, dependency-relative order, the intentional second `shared-board-utils` load, and `ui/event-handlers` as the final entry are the contract.

### 2.5 Board-writer ownership

The completed board-renderer decomposition made `ui/board-renderer.ts` a facade and moved synthetic writer state and presentation-drain readiness into `ui/board-visual/writer-runtime.ts`. The current runtime still awaits an in-flight synthetic claim without settling its deferred final frame. `test/ui.board-renderer.recovery-contract.test.ts` already exercises the behavior through the real facade.

The failing test instead extracts the facade function text and looks for the old internal variable name. That conflicts with Phase 0 of the decomposition plan, which explicitly required move-hostile assertions to follow named runtime owners. The fix belongs in test ownership and behavior, not in moving the implementation back into the facade.

The first owner-level test was still too weak: it used a single microtask as proof that readiness remained pending, and the caller integration test only searched source text for a capability name. Stronger behavior tests then exposed real lifecycle races. Both readiness functions captured a controller before awaiting and could resolve or reject from controller A after controller B replaced it; an old auto-settlement could mutate the new invalidation accumulator; a presentation drain could reclaim a synthetic writer while its asynchronous settlement was active; and session reset did not invalidate a pending auto-claim callback. The correction therefore belongs in `writer-runtime` lifecycle ownership plus a controller-level fail-closed reclaim guard, while preserving the public `Promise<void>` readiness shape and Single Visual Writer boundary.

## 3. Candidate comparison

The investigation compared the known red baseline with the largest remaining structural opportunities rather than choosing by file size alone.

| Candidate | Expected leverage | Regression risk now | Decision |
| --- | --- | --- | --- |
| Converge full-regression contracts and reject malformed marker anchors consistently | Very high: restores green-to-green proof for every later change and removes four known false/ambiguous alarms | Low: three test-ownership changes, one bounded pure helper correction, no valid-state output change | **Selected first** |
| Unify Worker/local room-deck metadata and initial deck projection | High cross-runtime drift reduction; architecture §13 identifies adjacent debt | Medium to high: the two runtimes already differ on malformed/partial inputs, so authoritative semantics need characterization and a separate design | Defer as the next network candidate |
| Extract source-trajectory resource lifecycle from the 3816-line Pixi board scene | High maintainability payoff | High: touches Pixi object ownership, context recovery, settlement, and the Single Visual Writer | Defer until a smaller resource-owner slice is separately designed |
| Re-unify visual state selection in the state adapter and DOM compatibility renderer | None: `ui/board-visual/render-state-source.ts` is already the shared owner; the remaining per-consumer prepared-state wrappers are intentional | High if reopened: it could collapse intentionally isolated prepared state or make DOM compatibility eager | Reject as already completed work |
| Execute the remaining destructive history-rewrite phase of the master refactor | Low runtime benefit | Unacceptably high and requires separate authority | Excluded |

The selected work has a smaller source diff than the other candidates, but its leverage is repository-wide: it restores the release gate that those candidates need. Worker/local room-deck metadata and initial deck projection is the recommended next structural investigation after the full suite is green; it requires its own characterization-first design and is not silently included here.

## 4. Scope, assumptions, and invariants

### 4.1 In scope

- Replace the four stale or ambiguous test contracts with current-owner and behavior-based assertions.
- Make stored marker anchors strict integers in the canonical multi-cell footprint helper and its compatibility fallback.
- Add focused malformed-anchor and valid-footprint coverage at the shared registry/index boundary.
- Align the dependent DOM-compat stone-info integration assertion with the same split: integer stored anchors, string-compatible lookup arguments.
- Reject primitive/non-object marker values and apply the exact stored-anchor rule to the bounded Board Executor activation, target, tax, and duration consumers.
- Strengthen the network test's terminal assertions and current-state accessor proof; keep the accessor compatible with the test/browser global boundary through the existing network-client global resolver.
- Make board-writer readiness generation-aware, reserve presentation-drain handoff until claim or explicit abandon, invalidate stale reset callbacks, and reject controller reclaim during active local settlement.
- Make page destruction terminal at the backend controller-acquisition owner so a late render cannot lazily recreate or claim a board controller after teardown.
- Prove the presentation-handler drain-specific capability behaviorally and type that optional compatibility capability at its port.
- Add `test/ui.network-client.guard-tempt-deferred-publish.test.ts` to `test:network:parity`.
- Regenerate browser/Vite/Worker delivery surfaces from root sources because the shared helper is used across those runtimes.
- Require a zero-failure full Jest run before completion.

### 4.2 Assumptions

- Canonical marker objects store `row` and `col` as integer numbers. This is already enforced for canonical multi-cell snapshots and is consistent with the typed lookup APIs.
- Lookup arguments may arrive as integer numbers or numeric strings at compatibility-facing UI calls. The existing target-argument coercion accepts both and is not changed by this design; only stored marker anchors become strict.
- The current network selection path is correct: accepted server state is canonical immediately, while input remains locked until the accepted `visualSeq` is visually settled.
- The current classic boot table is correct. The original writer source-location assertion is stale, but writer lifecycle correctness must be established by behavior tests rather than assumed.

### 4.3 Required invariants

- A deferred pending-selection target publishes exactly once and never applies a local authoritative preview in publish-only cases.
- Successful completion waits for the exact accepted `visualSeq`; it must not report success merely because a generic global playback queue is idle.
- In the normal network-client bridge path, missing `visualSeq`, unavailable tracking, failed settlement, session change, or playback-drain failure remains fail-closed. If the exact capability itself is absent in an older compatibility path, the existing legacy idle-wait fallback remains unchanged and is not promoted to the normal path.
- Canonical numeric marker anchors retain identical one-cell and 2x2 footprints, ordering, owner behavior, and target results.
- A malformed stored marker anchor cannot become a valid numeric board location through implicit coercion.
- Pixi/DOM backend exclusivity remains unchanged. Synthetic ownership may transfer only after readiness for the current controller and after any active local settlement; a presentation-drain handoff remains reserved until claim/reclaim or explicit abandon.
- The classic boot table keeps the current module order; tests may describe relative dependency order but implementation must not reorder the table in this task.
- Root files remain canonical. `dist/`, `public/`, browser generated startup files, and `worker-public/` are updated only through repository scripts.

## 5. Selected design

### 5.1 Treat the four failures as one convergence gate

The implementation begins by reproducing all four suites in one command and recording the exact failure ledger. No failure may be skipped, marked `todo`, removed from discovery, hidden behind an allowlist, or accepted as a permanent baseline. Each failure is closed by its owning contract below.

The focused command remains useful during implementation, but completion is decided only by `npm run test:jest` returning zero failures. The earlier 4-suite/19-test exception is retired rather than rewritten as a new expected baseline.

### 5.2 Assert exact authoritative settlement through the installed bridge

In `test/ui.network-client.guard-tempt-deferred-publish.test.ts`:

1. after the test's module reset and before loading `ui/network-client`, require the same `ui/playback-state-manager` module that the client will resolve;
2. place independently controlled deferred spies on `waitForNetworkVisualSeq` and `waitForVisualPlaybackDrain` at that lower capability boundary; each spy resolves a separate “entered” notification as soon as the real network-client orchestration reaches it;
3. capture the bridge object passed to `selectionFlow.setSignalBridge()` when `ui/network-client` initializes, and use a call-through spy on its `waitForAuthoritativeVisualSettlement` method rather than replacing it;
4. make the fake accepted publish response carry a stable `operationId` and `presentationCursor.visualSeq`;
5. start the selection handler without awaiting it to completion;
6. await the tracker “entered” notification rather than flushing an arbitrary number of microtasks, racing it against premature handler settlement so early completion fails immediately;
7. after the publish response is accepted, assert that the bridge received the accepted response, the real network-client waiter called `waitForNetworkVisualSeq(visualSeq, { operationId })`, and the legacy `global.waitForPlaybackIdle` trap was not called;
8. while the tracker promise is unresolved, assert that the authoritative returned state is already installed, the handler remains incomplete, and `selectionFlow.isSelectionSettlementLocked()` is true; do not require Node-global `isProcessing` / `isCardAnimating` values because the installed network bridge does not expose busy-state writers and this path owns busy state locally plus through the settlement lock;
9. resolve the tracker with a matching successful `visualSeq`, await the drain “entered” notification with the same premature-completion race, and prove the handler and selection lock remain pending;
10. resolve the drain, allow the handler to complete, and prove `isSelectionSettlementLocked()` is false; at terminal completion reassert exactly one publish, one bridge waiter, one tracker, one drain, zero legacy waits, no local preview for publish-only cases, no local presentation for all sixteen cases, pending-effect identity, and applied state;
11. for the temptation case's post-publish board-sync request, observe the installed bridge's call-through `armBoardUpdateDuringPlayback({ source: 'selection-flow', reason: 'selection_state_sync' })` capability and require that matching call to return `true`. Do not infer acceptance by peeking a transient downstream board-update context after later snapshot work may have consumed or replaced it; the bridge return is the owner-level acknowledgement. The test's explicit `.js` import may also resolve through a compatibility surface while the TypeScript network client resolves the `.ts` owner under Jest, but module identity alone is not the reason to reject the later context peek.

This verifies the real client → signal bridge → network-client exact waiter → visual-sequence tracker → playback-drain → selection-flow control path. Only the tracker/drain leaf capabilities are controlled; `ui/network-client.ts` still performs `visualSeq` extraction, `operationId` forwarding, room/session capture and recheck, error mapping, and drain ordering. The captured drain options must use the network-client root and return the already-applied authoritative `cardState`; the accessor uses the existing `resolveNetworkClientGlobal()` root/global compatibility boundary so JSDOM module surfaces cannot yield a false null while the browser remains `window === globalThis`. The test does not mock away `publishSnapshot`, replace server authority with client state, or merely delete the old call-count assertion.

Add this suite to the explicit `test:network:parity` path list next to the other deferred-publish suites. The script currently passes without exercising these sixteen cases, which is a false-green gap for exactly the contract being repaired. No new script or dependency is needed.

### 5.3 Make stored marker anchors exact at the shared footprint owner

In `shared/multi-cell-stone.ts`, `getSpecialStoneFootprint()` first requires a non-null, non-array object, then reads `marker.row` and `marker.col` without `Number()` coercion and returns the existing frozen empty footprint unless both stored values are integer numbers. The helper serves ordinary one-cell special stones as well as the `square_2x2.v1` stone; both valid projection bodies remain equivalent after that guard.

`shared/special-stone-registry.ts` keeps its browser compatibility fallback, but its fallback anchor check must use the same exact stored-value rule. This prevents a partial runtime from reintroducing a different contract if `MultiCellStone` is unavailable. The normal path continues to delegate to `MultiCellStone`.

The design intentionally does not:

- change `markerOccupiesCell()` target-argument coercion;
- mutate, repair, or normalize a received marker;
- alter marker classification arrays or their original order;
- broaden state-kernel validation;
- add a second coordinate normalizer.

Focused coverage must establish this matrix:

| Stored marker anchor | Numeric direct/index query | Footprint result |
| --- | --- | --- |
| integer numbers | existing match | existing one-cell or ordered 2x2 footprint |
| numeric strings | no match in either path | empty |
| fractional numbers | no match | empty |
| `NaN`, infinity, missing, non-number anchors, primitive/non-object marker values, or arrays | no match | empty |

The existing type-aware classification behavior for invalid markers is not generalized or cleaned up in this task. Only numeric cell occupancy and footprint projection become consistent.

At the DOM-compat stone-info integration boundary, preserve this ownership split explicitly: the fixture's stored marker uses integer coordinates, while `showSpecialStoneInfoAt('2', '4')` proves that string query arguments still resolve the canonical marker through `markerOccupiesCell()`. A string-valued stored marker must not be restored merely to retain that query compatibility.

The CommonJS branch of `shared/special-stone-registry.ts` normally requires `MultiCellStone`, so an ordinary registry import does not exercise the fallback. A focused isolated-module test must explicitly make `./multi-cell-stone` unavailable/null while loading the registry, then verify the fallback for both ordinary one-cell and 2x2 markers across valid integer, numeric-string, fractional, non-finite, and missing anchors. This is required coverage, not an optional implementation detail.

Independent event and board-input coordinate parsers in `shared/playback-event-helpers.ts` and `shared/shared-board-utils.ts` remain separate contracts. `game/logic/card-resolution/board-executor.ts` is different: it consumes stored board markers for activation, affected targets, hand tax, and duration. Those filters and fallback projections must use the same non-null-object plus exact-integer rule, without changing validated action-coordinate producers. This prevents malformed markers from satisfying the three-stone threshold, being executed at coerced cells, or acting as an active Board Executor manifestation.

### 5.4 Harden and test writer behavior at its runtime owner

`test/ui.board-playback-runtime-state-contract.test.ts` stops requiring `AutoBoardWriterClaimForBoardRenderer` to be declared inside `ui/board-renderer.ts`. It retains the integration boundary: `presentation-handler` calls the facade capability and the facade delegates to `writer-runtime`.

The original direct `createBoardWriterRuntime()` scenario remains and uses only public runtime operations:

1. configure a controller with deferred `waitForIdle`, `claimWriter`, `reclaimWriter`, and observed `settleLocalWriter`/frame-build functions;
2. expose `getMode()` returning `idle` initially and `isIdleSettlementPending()` returning true so the runtime must enter its asynchronous claim path;
3. call `preparePlaybackOwnership(controller, true)`, prove it returns `{ deferredUntilAutoWriter: true }`, and let `claimWriter` switch the fixture mode to `playback` when the claim is eventually made;
4. prove `getControllerReadyForPresentationDrain()` remains pending until the deferred idle wait resolves;
5. after idle resolution, prove local-writer settlement and final-frame construction are still both zero;
6. call `runtime.claim(nextFrameToken, 'network')` and prove it invokes `reclaimWriter(syntheticToken, nextFrameToken, 'network')`;
7. cover a separate no-token/no-claim idle case to prove presentation readiness calls `waitForIdle` there.

Post-implementation correction adds these owner rules:

1. both readiness methods retry after every awaited boundary when controller identity or controller/session generation changes; stale-controller rejection is ignored only after replacement, while a current-controller error still propagates;
2. page destroy is terminal and is checked before another controller lookup, preventing facade lazy creation from resurrecting a controller during teardown;
3. reset invalidates pending synthetic auto-claims and deferred renders from the old session without abandoning an already-owned controller token. If an old-session auto-settlement is already active, its completion discards invalidation tied to that old token and generation-safely requests one fresh render from current canonical state; readiness waits for that recovery and a direct claim fails closed while it is pending;
4. an active synthetic settlement must complete before presentation-drain readiness succeeds or a new claim is permitted; a settlement from a replaced controller cannot settle the replacement accumulator or update occupancy;
5. presentation-drain intent is registered synchronously and remains reserved after readiness until writer claim/reclaim succeeds or presentation explicitly abandons the drain. Generic readiness and ordinary auto-settlement may not consume that reserved synthetic token;
6. the outer presentation-drain `finally` always calls `settleAutoBoardVisualWriter({ abandonPresentationDrain: true })`, including strict failures before an inner board-writer claim. This is idempotent after a successful claim and prevents a reserved synthetic token from surviving manager release or board-sync failure;
7. `BoardVisualController.reclaimWriter()` rejects while an asynchronous local settlement is active, providing a fail-closed boundary even if a caller violates the reservation protocol.

The terminal destroy rule is enforced at both layers that can initiate work. `writer-runtime` rejects readiness, claim, playback preparation, and invalidation after destruction. `backend-runtime.getController()` returns `null` after page teardown and configuration APIs reject, so `render-submission-runtime` exits before writer preparation instead of lazily constructing a new backend/controller.

`test/ui.board-renderer.recovery-contract.test.ts` remains the end-to-end facade proof. `test/ui.presentation-handler.playback-claim.test.ts` must behaviorally prove that the drain-specific readiness method is selected and awaited while the generic method is not called. The renderer port includes the drain-specific method as an optional compatibility capability because the caller intentionally retains its generic fallback. Do not add a replacement private source-text assertion.

### 5.5 Replace the arbitrary boot prefix with dependency semantics

`test/entry-browser.boot-table-sequence.test.ts` continues to parse the actual `BOOT_LOAD_ENTRIES`, but replaces the fixed `entries.slice(0, 27)` equality with explicit presence and relative-order checks.

The test defines this current foundational sequence as an ordered subsequence and proves every successive index increases:

1. `./dist/ui/layout-stage`;
2. `./dist/is-env-capable`;
3. `./dist/constants/difficulty-constants`;
4. `./dist/constants/ui-element-cache`;
5. `./dist/constants/animation-constants`;
6. `./dist/cards/catalog`;
7. `./dist/shared-constants`;
8. `./dist/shared/board/dimensions`;
9. `./dist/shared/board/configuration`;
10. `./dist/shared/board/initial-layout`;
11. `./dist/shared/board/expansion-descriptors`;
12. `./dist/shared/board/cell-access`;
13. `./dist/shared/board/corners`;
14. `./dist/shared/board/edge-runs`;
15. `./dist/shared/board/risk-cells`;
16. `./dist/shared/board/shape-iteration`;
17. `./dist/shared/board/legal-moves`;
18. `./dist/shared/board/control-counts`;
19. `./dist/shared/board/canonical-encoding`;
20. `./dist/shared/board/notation`;
21. `./dist/shared/board/padded-coordinates`;
22. `./dist/shared/multi-cell-stone`;
23. `./dist/shared/board/state-kernel`;
24. `./dist/shared/shared-board-utils`;
25. `./dist/shared/deck-spec`;
26. `./dist/shared/deck-codec`;
27. `./dist/shared/destroy-outcome-contract`;
28. `./dist/shared/manifest-stone-registry`;
29. `./dist/shared/special-stone-registry`;
30. `./dist/shared/stone-status-snapshot`.

It additionally proves:

- every foundational entry other than `shared-board-utils` appears exactly once;
- `./dist/shared/multi-cell-stone` exists exactly once, exposes `MultiCellStone`, and precedes both `./dist/shared/board/state-kernel` and `./dist/shared/special-stone-registry`;
- `./dist/shared/manifest-stone-registry` precedes `./dist/shared/special-stone-registry`;
- the intentional two `./dist/shared/shared-board-utils` entries remain;
- `./dist/ui/event-handlers` remains the final boot entry;
- the existing namespace/global initialization assertions remain intact.

An ordered-subsequence helper is preferred over a hard-coded slice length: inserting a new required dependency must not shift an unrelated expected slot, but removing or reversing an actual dependency must still fail. `entry-browser.js` is not changed by this task unless new evidence shows the current order violates one of these already-stated contracts.

### 5.6 Delivery and zero-failure gate

Because the exact-anchor change is in `shared/`, it reaches headless, browser, Vite, local/Worker, and UI projection consumers. After focused tests pass, run the repository's Worker mirror preparation once through `npm run worker:prepare`; it invokes the TypeScript, browser, and Vite builds before preparing the mirror. Do not add a redundant manual `build:browser`/`build:vite` immediately around that command, and do not hand-edit its outputs. `npm run checkall` subsequently invokes its existing mirror check, which performs another validation build by design; “prepare once” refers to mirror preparation, not to suppressing that scripted verification rebuild.

The final broad gates are `npm run checkall`, the updated `npm run test:network:parity`, and `npm run test:jest`. If the full run exposes a failure outside the four-characterized suites, reproduce and classify it rather than weakening or deleting it. A deterministic unrelated failure that requires materially broader behavior work must trigger a design/plan revision before scope expands; this design cannot be declared complete with a new exception list.

## 6. Ownership and dependency direction

| Concern | Canonical owner after this change | Consumers/tests |
| --- | --- | --- |
| Stored marker anchor → occupied footprint | `shared/multi-cell-stone.ts` | special-stone registry, game marker lookup, board projection, board kernel, Worker/browser/headless runtimes |
| Browser fallback for special-stone footprint | `shared/special-stone-registry.ts` | classic partial/compatibility runtime only |
| Accepted network `visualSeq` settlement | `ui/network-client.ts` via `ui/network/selection-signal-bridge.ts` | `game/card-effects/selection-flow.ts` explicit bridge capability |
| Synthetic board-writer claim and presentation-drain readiness | `ui/board-visual/writer-runtime.ts` | `ui/board-renderer.ts` facade and `ui/presentation-handler.ts` |
| Classic boot sequence | `entry-browser.js` | focused semantic boot contract tests |
| Network parity command membership | `package.json` | CI/local validation command |

No dependency is added from `game/` or `shared/` to `ui/`, DOM, sound, timers, or network clients. The network selection flow continues to receive UI/network behavior only through its installed signal bridge.

## 7. Error paths, compatibility, security, performance, and concurrency

### Error and cancellation paths

- An exact settlement result whose `ok` is not `true` continues to fail the selection as `visual_settlement_failed`; the test must not force a legacy success fallback.
- Missing `visualSeq`, unavailable settlement tracking, session change, and playback-drain failure retain the existing network-client failure results.
- An absent board controller still rejects readiness. Controller replacement/destroy invalidates pending synthetic claims through the existing generation owner.
- Invalid marker anchors return no footprint and are not treated as occupying a numeric cell by consumers of the shared special-stone footprint/occupancy boundary. Ingress remains responsible for rejecting malformed canonical snapshots; independent event/board-input parsers are outside this guarantee.
- A missing required boot module still fails boot through the current required-module error path.

### Compatibility and migration

- There is no saved-data or network-format migration. Valid serialized marker coordinates are already integer numbers.
- Numeric lookup arguments keep their behavior, and existing numeric-string query compatibility remains covered at the DOM-compat stone-info boundary.
- Existing CommonJS exports, browser globals, bridge APIs, and facade methods remain unchanged.
- `package-lock.json` is unchanged because there is no dependency change.

### Security and privacy

No hidden-card projection, seat identity, token, payload, or stored state shape changes. Rejecting malformed stored marker anchors is a fail-closed hardening and cannot reveal additional state.

### Performance

The anchor check removes two coercions per footprint call and does not add allocation or scans. Test execution grows only by adding one already-existing sixteen-case suite to the explicit network parity command. No runtime performance optimization is claimed.

### Concurrency

The controlled network test must prove the selection promise and direct settlement-lock ownership remain pending until exact settlement resolves. Its terminal assertions repeat all exactly-once counts so a late duplicate publish/wait/drain or local preview cannot pass after the deferred gates become permanently resolved. An implementation-time focused run confirmed that this bridge configuration leaves the pre-existing Node-global `isProcessing` / `isCardAnimating` fixtures unchanged, so those compatibility globals are neither an owner nor a valid assertion for this path.

Writer concurrency is governed by controller and session generations plus a presentation-drain reservation. Readiness validates its captured controller after readiness, pending claim, active settlement, post-reset render recovery, and idle waits. Drain intent is registered before the first await, remains through handoff, and is consumed only by successful claim/reclaim or the outer presentation drain's unconditional explicit abandon. This prevents both call orders—drain-first and generic-first—from starting an old synthetic settlement in the microtask gap before the drain caller claims ownership. Replacement and destroy cancel stale callbacks; reset also schedules a current-state render after any already-active old settlement. Controller reclaim independently fails closed during local settlement.

## 8. Specification, documentation, generated, and cross-runtime implications

- `01-rulebook.md`: unchanged; no player-visible rule, text, timing, animation, or card behavior changes.
- `正本/*.md`: unchanged for the same reason.
- `docs/architecture-contracts.md`: unchanged; §§6.2.1, 6.4, 7.2, 7.3, and 12 already describe the intended contracts.
- Prior completed refactor plans: retained as historical execution evidence. This design closes their explicitly recorded regression debt and does not reimplement their completed work.
- `docs/implementation/shinra-bansho-god-plan.md` and older broad network-repair plans overlap historically with the helper and settlement areas, but the current architecture contracts and root implementation supersede their unfinished status markers. This work must not replay their feature migrations.
- `match-command-runtime-unification` documents currently lag the implemented §8.4.1 contract; that documentation cleanup is separate and must not cause command runtime work to be repeated here.
- Browser/Vite/Worker generated surfaces: regenerated from root TypeScript/JavaScript sources with repository scripts, inspected, and committed only when produced by the selected generation path.
- Worker/local/headless/browser semantics: valid marker states remain identical; malformed anchors become uniformly non-occupying at the shared helper boundary.

## 9. Verification strategy

### 9.1 Focused contract bundle

Run the four known failing suites together first, then the direct owner/characterization suites:

- `test/ui.network-client.guard-tempt-deferred-publish.test.ts`;
- `test/game.marker-cell-index.test.ts`;
- `test/entry-browser.boot-table-sequence.test.ts`;
- `test/ui.board-playback-runtime-state-contract.test.ts`;
- `test/ui.network-selection-signal-bridge.test.ts`;
- `test/ui.board-visual.runtime-lifecycle.test.ts`;
- `test/ui.board-renderer.recovery-contract.test.ts`;
- `test/ui.board-visual-controller-settlement.test.ts`;
- `test/ui.presentation-handler.playback-claim.test.ts`;
- `test/shared.special-stone-registry.test.ts`;
- `test/game.board-executor.test.ts`;
- `test/shared.board-state-kernel.test.ts`;
- `test/game.shinra-bansho-god.test.ts`;
- `test/ui.board-dom-compat.long-press-info.test.ts`.

The focused done condition is zero failures, plus direct assertions for deferred exact settlement and terminal exactly-once behavior, no global fallback, strict malformed anchors and Board Executor fail-closed behavior, valid 2x2 footprint parity, semantic boot order, and generation-safe synthetic-writer ownership.

### 9.2 Structural and generated checks

- `npm run typecheck`;
- `npm run worker:prepare` once after focused tests, covering TypeScript/browser/Vite generation and Worker mirror preparation;
- `npm run checkall`, including window/dependency/generated/mirror checks;
- inspect script-produced browser and Worker diffs rather than assuming any generated change is valid.

### 9.3 Network and full regression gates

- `npm run test:network:parity`, now including the sixteen-case suite;
- `npm run test:jest` with a timeout long enough for the previously observed roughly 18-minute run;
- targeted rerun of any unexpected failure to distinguish deterministic regression from infrastructure instability; report both initial and retry results if a retry is necessary.

HTTP success, a passing subset, or “only the same nineteen failures” is not completion. The full Jest process must exit successfully with zero failing tests.

### 9.4 Delivery inspection

- `git diff --check`;
- task-scoped source/test/config/generated diff inspection;
- `git status --short` before staging and after the commit;
- stage only task-owned files and commit the verified implementation plus its generated surfaces as one coherent unit so no commit contains stale browser/Worker delivery state.

## 10. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Replacing the old network assertion accidentally stops testing the real exact waiter | Keep the bridge method call-through; defer only `waitForNetworkVisualSeq`, observe playback drain, and prove extraction/operation identity/session-sensitive orchestration remains active. |
| The marker hardening changes a valid game result | Guard only stored non-integer anchors; retain the normal footprint body and run registry, kernel, Shinra, network, and full-suite coverage. |
| The special-stone fallback drifts from the primary helper | Apply the same exact-anchor predicate in both paths and add focused registry coverage. |
| Another stored-marker consumer reintroduces coercion | Cover Board Executor activation, affected cells, active-manifest tax, and duration lookup with malformed numeric-string markers while retaining canonical valid-marker tests. |
| Semantic boot checks become too weak | Assert required presence, exact `MultiCellStone` global exposure, critical relative dependencies, intentional duplicate count, final entry, and all existing namespace contracts. |
| Writer coverage still follows private source placement | Make the direct runtime behavior test authoritative and retain only facade/caller capability wiring at integration level. |
| Old writer settlement releases or mutates a replacement writer | Hold drain reservation through claim/abandon, validate controller/session generation after each await, suppress stale accumulator updates, and reject controller reclaim during local settlement. |
| Network parity remains falsely green | Add the existing sixteen-case file to the explicit script rather than relying only on the long full suite. |
| Full Jest reveals more debt than the focused baseline | Reproduce and classify; do not create a new allowlist or silently expand product behavior. Revise this design if a broader deterministic fix is required. |
| Generated output is edited or committed stale | Prepare the Worker mirror once from root sources with `worker:prepare`, allow `checkall` to perform its scripted verification rebuild, and inspect all generated diffs before the coherent implementation commit. |

## 11. Completion conditions

- The four formerly failing suites pass, and each failure is closed by the contract owner described here.
- Deferred network selection proves exact accepted-`visualSeq` settlement, single publish, no local preview in publish-only cases, no local presentation in all sixteen cases, current authoritative drain state, and no legacy global playback fallback.
- Direct and indexed numeric lookup reject markers with string, fractional, non-finite, missing, or otherwise non-integer stored anchors; primitive/non-object markers project no cell.
- Board Executor does not count, execute, tax, or decrement malformed stored-coordinate markers while canonical integer markers retain existing behavior.
- DOM-compat stone detail still accepts numeric-string query arguments for canonical integer-anchored markers; it does not normalize malformed stored anchors.
- Valid one-cell and 2x2 marker footprints, ordering, inviolability, and board behavior remain unchanged.
- The classic boot test checks dependency semantics and passes without changing the current runtime table.
- Board presentation drain behavior is covered at `writer-runtime`, controller, facade, and presentation caller; replacement/reset/destroy and active-settlement races fail closed without requiring private state to live in `board-renderer.ts`.
- The updated network parity command passes and contains the repaired deferred-selection suite.
- Typecheck, generation/mirror preparation, `checkall`, and the full Jest suite all exit successfully.
- `01-rulebook.md`, `正本/*.md`, network contracts, saved-data formats, dependencies, and valid player-visible behavior are unchanged.
- Generated changes come only from repository scripts, the final task-owned diff is inspected, and the implementation is committed without unrelated files.

## 12. Implementation result

- The initial four-suite baseline was reproduced at 4 failed suites / 19 failed tests. After owner-level repairs, the expanded focused bundle passes 15 suites / 188 tests.
- The first full Jest run passed 1016/1017 suites and 7601/7602 tests, exposing the dependent DOM-compat assertion described in §2.3. Its exact-path rerun reproduced 1 deterministic failure; the revised stored-anchor/query-input contract then passed 24/24 tests and received an independent re-review with no major or medium finding.
- `npm run worker:prepare`, `npm run checkall`, and the updated `npm run test:network:parity` all pass. Generated browser/Vite/Worker surfaces were produced from root sources; no generated or mirror file was source-edited.
- The final `npm run test:jest` exits successfully with 1017/1017 suites and 7602/7602 tests. The former known-red exception is retired.
- An extra, non-plan `npm run worker:bundle:smoke` exposed a pre-existing Worker preload-order defect: strict card consumers load before `CardMarkers`. Source history and independent diagnosis place that defect in prior commit `849f555e43`, before this task, and the failure occurs before the changed marker-footprint code is reached. This implementation therefore does not claim Worker deploy-smoke readiness or silently mix that separate preload repair into the reviewed scope.
- No browser playtest was run because no valid-state rendering, input, runtime boot table, or player-visible behavior changed. Browser/Vite builds, mirror validation, valid-marker coverage, network parity, and the full E2E-inclusive Jest suite are the selected proportional evidence.
- Post-implementation AI review reproduced additional marker-consumer, terminal network assertion, presentation wiring, and writer lifecycle defects. Their bounded correction is in progress; this section and the document status return to implemented/verified only after the revised focused, generated, parity, board-playback, and full-suite gates pass.

## 13. Self-review

The first investigation misclassified repeated state-adapter/DOM compatibility wrapper bodies as an unimplemented board visual state-projection unification. Independent review confirmed that `render-state-source.ts` is already the shared owner and that per-consumer prepared state is intentional. That candidate was removed rather than reopening completed work; Worker/local room-deck metadata is now the next recommended characterization target after this baseline is green.

The first pass also treated all nineteen failures as stale tests. Source and history comparison showed that the marker failure is a real semantic split introduced when multi-cell footprint projection began coercing stored coordinates. The design now includes the smallest canonical-helper correction, leaves target-argument compatibility untouched, and requires valid/invalid characterization across direct, indexed, registry, and kernel paths.

The initial network test design replaced the bridge's exact waiter with a fake deferred function. Independent review correctly found that this would bypass `visualSeq` parsing, `operationId` forwarding, session rechecks, and playback drain. The revised design keeps that method call-through and controls only the tracker/drain leaves. The same review narrowed the malformed-marker claim to shared-footprint consumers, required explicit fallback execution, expanded the exact boot subsequence, fixed the writer public-operation scenario, and clarified that `checkall` performs a validation rebuild after the one mirror preparation.

Final review removed two remaining sources of test instability: arbitrary microtask flushing was replaced with explicit tracker/drain entry notifications plus a premature-handler-completion race, and settlement ownership is asserted through `isSelectionSettlementLocked()` rather than inferred only from global busy flags. It also fixed the exact controller mode/pending preconditions required to exercise the writer runtime's asynchronous claim branch and confirmed that no new facade source-text assertion should replace the stale one.

For the other three failures, the design does not merely update counts or filenames. It replaces a global call-count with a real exact-settlement orchestration proof, a private facade-source assertion with owner-level behavior, and an arbitrary boot prefix with explicit dependency constraints. The later AI review also demonstrated why owner-level tests must be strong enough to expose product races: the first single-microtask pending check and caller substring check were false-positive prone. The corrected design permits only the reproduced network accessor, marker consumer, and writer lifecycle changes; gameplay rules, payloads, boot order, and valid player-visible behavior remain unchanged.

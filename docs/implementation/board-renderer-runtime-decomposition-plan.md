# Board renderer runtime decomposition implementation plan

- Status: completed
- Date: 2026-08-06
- Design: `docs/implementation/board-renderer-runtime-decomposition-design.md`
- Execution mode: behavior-preserving sequential extraction with focused verification after every ownership transfer
- Player-visible specification: unchanged; do not edit `01-rulebook.md` or `正本/`

## Phase 0 — Freeze contracts and replace move-hostile assertions

### Outcome

Tests describe behavior and module boundaries rather than requiring critical functions to remain in `ui/board-renderer.ts`.

### Files

- update source-structure assertions in `test/ui.board-renderer.*.test.ts`
- update `test/ui.network-visual-state-store-readonly.test.ts`
- update `test/ui.board-dom-compat.isolation.test.ts`
- add focused runtime-port/render-state tests as needed

### Dependencies

None. Preserve the passing 8-suite/82-test board baseline and current typecheck result.

### Verification

- focused changed tests
- existing 8-suite board baseline

### Done when

Every existing contract remains asserted, but implementation may move to named runtime modules without weakening Single Visual Writer, receipt identity, fallback isolation, or apply ordering checks.

## Phase 1 — Add typed ports and injected render-state source

### Outcome

One pure implementation resolves prepared, network, local, strict, input-epoch, and receipt-bound visual state through injected accessors.

### Files

- add `ui/board-visual/runtime-ports.ts`
- add `ui/board-visual/render-state-source.ts`
- update `ui/network/visual-state-store.ts` with a lightweight operational snapshot
- update `ui/network/presentation-timeline.ts` with a lightweight operational snapshot
- add focused tests for state selection, readonly peek priority, prepared push/restore, input epoch, operational state, and invalid/foreign/stale receipt rejection

### Dependencies

Phase 0 tests must accept the new source location.

### Verification

- new render-state-source tests
- visual-state-store and presentation-timeline tests
- `npm run typecheck`
- `npm run check:window`

### Done when

The source module contains no `window` / `globalThis` discovery, normal strict gating uses lightweight operational state, readonly peek precedes clone fallback, and receipt-bound resolution has no fallback.

## Phase 2 — Install lazy DOM capability injection and migrate all render-state consumers

### Outcome

The root composition boundary installs an explicit capability object immediately after lazy DOM module evaluation, then injects render-state access; state adapter, DOM compatibility, stone info, occupancy, and committed apply share the implementation and operation-scoped pairs.

### Files

- update `ui/board-renderer.ts`
- update `ui/board-visual/state-adapter.ts`
- update `ui/board-dom-compat/renderer.ts`
- update `ui/board-dom-compat/backend.ts` and lazy backend construction wiring as needed to pass capabilities without eager evaluation
- update `ui/presentation/stone-info-controller.ts`
- update focused state and strict settlement tests

### Dependencies

Phase 1 source and ports.

### Verification

- `test/ui.board-renderer.visual-state.test.ts`
- `test/ui.network-visual-state-store-readonly.test.ts`
- state-adapter/model tests
- DOM viewer/network legal-hint tests
- committed-manifest and strict presentation tests

### Done when

DOM capability injection is established without evaluating compatibility on the default graph, no consumer independently discovers the visual store/timeline or reimplements network/local pair selection, and committed apply still uses only the receipt-bound pair.

## Phase 3 — Extract DOM disc presentation and remove the hidden helper bag

### Outcome

Generic disc rendering is directly importable and DOM compatibility obtains board-renderer capabilities through explicit lazy injection.

### Files

- add `ui/presentation/disc-dom-renderer.ts`
- update `ui/stone-visuals.ts`
- update `ui/visual-effects-map.ts`
- update `ui/board-dom-compat/renderer.ts`
- update `ui/board-dom-compat/dom-patcher.ts` if its capability provider changes
- update backend construction wiring
- leave `ui/board-renderer/stone-helpers.ts` as an unused compatibility shim until the final generated-inventory phase, then delete it there
- update affected DOM/stone tests

### Dependencies

Phase 2 provides the explicit lazy DOM configuration path.

### Verification

- DOM stone-rendering, destroy-fade, long-press, patcher-capability, and backend tests
- stone visuals / visual effects tests
- DOM isolation test
- `npm run typecheck`

### Done when

No production caller uses `BoardRendererStoneHelpers` or `ui/board-renderer/stone-helpers`; only the explicit temporary shim/generated inventory may remain until Phase 8, and DOM compatibility is still unevaluated on default Pixi load.

## Phase 4 — Extract layout and input runtimes

### Outcome

Pixel sizing/observer state and input/accessibility/preview state each have one dedicated owner with reset/destroy behavior.

### Files

- add `ui/board-visual/layout-runtime.ts`
- add `ui/board-visual/input-runtime.ts`
- reduce matching regions in `ui/board-renderer.ts`
- update focused tests to import/inspect the owning runtime

### Dependencies

Typed ports and explicit DOM capability injection.

### Verification

- pixel-sizing and dom-layout-geometry tests
- board input controller, Pixi input, DOM input, bootstrap input tests
- theme/font-ready test if input overlay refresh observes the same readiness gate
- `npm run typecheck`

### Done when

The facade owns no layout/input mutable state and DOM/Pixi use the same injected capabilities. `inputRuntime.resetSession()` clears cursor/preview without destroying page listeners; `layoutRuntime.destroyPageRuntime()` disconnects ResizeObserver/window/page handlers. Repeated session reset redraws correctly without duplicate listeners, and direct runtime-destroy tests leave no observer or accessibility resource.

## Phase 5 — Extract lazy backend runtime

### Outcome

Backend selection, controller creation/configuration, readiness, fallback, context recovery, host replacement, and page-runtime destruction are encapsulated without changing selection timing.

### Files

- add `ui/board-visual/backend-runtime.ts`
- update `ui/board-renderer.ts`
- update backend-selection, isolation, and recovery assertions

### Dependencies

Layout/input runtime callbacks and explicit DOM capabilities.

### Verification

- backend-selection test, including configure-after-require-before-first-controller
- recovery-contract and context-recovery tests
- repeated session reset, controller replacement, and direct page-runtime destroy tests
- DOM isolation test
- `npm run match:pixi-runtime-fallback-check`

### Done when

Runtime object creation is eager but selection/controller/backend fixation remains lazy; `resetSession()` does not destroy the controller/backend, `replaceController()` disposes only controller-bound subscriptions/resources, and `destroyPageRuntime()` owns final teardown. Initial and recovery fallback preserve mutual exclusion and the default graph never evaluates DOM compatibility.

## Phase 6 — Extract frame/apply runtime

### Outcome

Frame identity, model construction, committed-world metadata, theme/font observation, viewport layout, and atomic apply/rollback have one owner.

### Files

- add `ui/board-visual/frame-runtime.ts`
- update `ui/board-renderer.ts`
- update frame/apply ownership tests

### Dependencies

Layout runtime and backend controller callbacks.

### Verification

- visual-state, committed-manifest, frame-presenter, layout, pixel-sizing, theme/font-ready, and recovery tests
- Pixi camera/backend/model tests
- `npm run typecheck`

### Done when

Every frame has the same render-session and revision semantics, committed-world state remains frame-bound, apply ordering and rollback are unchanged, and recovery retains the exact committed frame. `frameRuntime.resetSession()` increments only session-scoped identity and sound/invalidation state; host/font observers are replaced or destroyed separately.

## Phase 7 — Extract writer and render-submission runtimes

### Outcome

Synthetic auto-writer adoption, invalidation, strict/local writer wrappers, one-shot prepared updates, render deferral, submission, and occupancy refresh are removed from the facade.

### Files

- add `ui/board-visual/writer-runtime.ts`
- add `ui/board-visual/render-submission-runtime.ts`
- update `ui/board-renderer.ts`
- type the strict writer dependency in `ui/presentation-handler.ts`
- update caller capability annotations where practical without broad module-system migration

### Dependencies

Backend and frame runtimes must be stable and focused-tested.

### Verification

- single-writer, recovery-contract, controller settlement, animation-engine local/strict, presentation-handler local/strict, and invalidation tests
- `npm run test:network:parity`
- `npm run match:pixijs-board-playback-check`

### Done when

The facade owns no writer/submission mutable state, prepared updates are one-shot, ordinary render cannot bypass playback ownership, strict apply is receipt-bound, and final local settlement builds exactly one final frame.

## Phase 8 — Final facade, architecture, delivery, and completion gates

### Outcome

`ui/board-renderer.ts` is a compact typed composition/compatibility facade, stable contracts are documented, and every browser/Worker delivery surface matches root source.

### Files

- finalize `ui/board-renderer.ts`
- delete the now-unused `ui/board-renderer/stone-helpers.ts` shim and remove its tests/registrations
- update `ui/globals.d.ts` if the now-typed facade narrows existing declarations safely
- update `docs/architecture-contracts.md`
- synchronize final design/plan status
- regenerate browser/Vite/Worker outputs through scripts only

### Dependencies

All previous phases.

### Verification

- focused board, DOM, Pixi, animation, presentation, and state suites
- `npm run typecheck`
- `npm run check:window`
- `npm run check:dependency-boundaries`
- `npm run check:board-test-selectors`
- `npm run test:network:parity`
- `npm run build:browser`
- `npm run build:vite`
- `npm run worker:prepare`
- Worker mirror parity check exposed by package scripts
- `npm run match:pixijs-board-playback-check`
- `npm run match:pixi-runtime-fallback-check`
- `npm run match:cross-platform-smoke:vite`
- `git diff --check`

### Done when

Every design completion condition passes; generated and mirrored artifacts contain all new runtime modules and no removed helper; final status/diff contain only task-owned changes; and the coherent verified diff is committed.

## Incremental commit and generation gates

- Do not commit a source module addition or deletion with a stale browser/Vite module inventory.
- Group Phases 0–3 as the first coherent source unit, then run `npm run build:browser` and `npm run build:vite` before its commit.
- Group Phases 4–7 as the second coherent runtime-decomposition unit and repeat both builds before its commit.
- Phase 8 deletes the compatibility shim, repeats both builds, runs `npm run worker:prepare` plus mirror parity, and commits the final delivery/documentation unit.
- If verification forces a different grouping, every commit containing module-inventory changes still includes regenerated matching artifacts.

## Completion checklist

- [x] Shared injected render-state source, operational APIs, and receipt-bound resolver implemented
- [x] All render-state consumers migrated
- [x] Typed facade capability ports implemented and strict caller narrowed
- [x] Disc DOM helper extracted and hidden helper bag removed
- [x] Layout, input, backend, frame, writer, and render-submission runtimes extracted
- [x] Backend selection remains lazy and DOM compatibility remains default-graph isolated
- [x] Single Visual Writer, event order, strict receipt identity, recovery, and prepared one-shot behavior preserved
- [x] `ui/board-renderer.ts` contains composition/facade code only
- [x] Architecture/design/plan match final implementation
- [x] Focused and Level 3 verification passes
- [x] Browser, Vite, and Worker generated/mirror outputs are synchronized
- [x] Final diff/status inspected and task-owned changes committed

Implementation landed in commit `46b0e71b1` (`Decompose board renderer runtime`). Completion verification included 61 focused board/UI suites (674 tests), 35 network-parity suites (564 tests), the repository static gate, generated browser/Vite/Worker parity, 232 Pixi playback scenarios, fallback checks, and 12 cross-platform browser probes.

## Self-review

The initial plan placed backend extraction before explicit DOM capability injection. Review found that this would either retain the hidden helper registry inside the new backend runtime or force a temporary reverse dependency. The plan now installs lazy capability injection with the state migration, migrates all production callers, retains an unused shim until final inventory generation, and only then extracts/deletes lifecycle and compatibility remnants.

The initial plan grouped render submission into frame runtime. Review against the one-shot `PreparedBoardVisualUpdates` ownership showed that submission has its own lifecycle and playback/writer dependencies. It now has a separate phase and runtime.

The verification bundle was expanded from the classic browser build to include Vite build, Worker preparation, and mirror parity because adding/deleting runtime modules changes every delivery inventory. Strict receipt rejection and recovery frame retention also have explicit phase-specific done conditions rather than relying only on broad network parity.

Independent plan review also separated session reset, controller/host replacement, and page-runtime destruction. Runtime tests must prove repeated match reset does not remove page-lifetime listeners, replacement disposes only controller-bound resources, and final destroy disconnects every owned observer/subscription/accessibility node.

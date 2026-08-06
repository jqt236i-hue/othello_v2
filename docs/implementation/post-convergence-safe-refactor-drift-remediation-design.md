# Post-convergence safe refactor drift remediation design

- Status: reviewed design
- Target: behavior-preserving repository-wide refactor drift introduced after the July 2026 full-refactor convergence baseline
- Sources of truth: root `AGENTS.md`, `docs/architecture-contracts.md`, `01-rulebook.md`, `docs/superpowers/specs/2026-07-11-behavior-preserving-full-refactor-design.md`, and `docs/superpowers/plans/2026-07-11-behavior-preserving-full-refactor-master-plan.md`
- Non-goals: gameplay, card text, timing, animation appearance, network protocol, public rule changes, broad compatibility-loader rewrites, speculative large-file splitting, removal of legacy unused declarations without positive proof, generated-file source edits, or Git-history rewriting

## Problem and desired outcome

The July 2026 behavior-preserving full-refactor program closed its non-destructive phases and established a clean structural baseline. A new repository-wide audit confirms that its architecture remains healthy, but later board-kernel and Pixi trajectory work introduced a small amount of mechanically provable drift:

- eleven unused declarations whose introducing or most-recent blame commits are newer than the Phase 11 cleanup baseline;
- six copies of the same shaped-board cell/value projection;
- two copies of the same board-expansion socket-to-target projection;
- four copies of an automatic-target protection decision already owned by `CardMarkers.isInviolableCell`;
- two copies of deterministic source-trajectory geometry and lightning-path calculations.

The desired outcome is to remove all currently identified high-value refactor drift for which behavior preservation can be demonstrated by exact implementation equivalence, existing canonical ownership, and focused tests. The change must not reopen older compatibility debt merely because a file is large or a compiler can see a declaration that may still be reached dynamically.

## Repository-wide audit evidence

### Structural baseline

- The initial and post-baseline working tree was clean.
- `npm run typecheck` passed.
- `npm run checkall` passed, including the runtime dependency graph, game/window boundary checks, refactor safety checks, browser artifact freshness, artifact retention, JavaScript authority inventory, Worker mirror checks, and board selector contracts.
- The runtime dependency graph has zero cycles.
- The JavaScript inventory has zero unknown or legacy source-authority implementations; `.ts` remains canonical where a TypeScript/JavaScript pair exists.
- A production-source size scan found several large orchestration factories, but size alone does not supply a safe extraction boundary. Their load-order, closure-state, compatibility-global, or single-writer responsibilities make speculative splitting higher risk than the user permits.

### Unused-declaration audit

Running TypeScript with `noUnusedLocals` reports 359 diagnostics. The Phase 11 baseline intentionally retained 348 compatibility-sensitive diagnostics. Blame comparison against commit `9bc9802c910eed99f03efb7d634486991d65cd61` isolates exactly eleven newer declarations:

| File | New unused declarations |
| --- | --- |
| `game/logic/board_ops.ts` | `ensureExpansionStateMutable`, `getExpansionDescriptor` |
| `game/logic/cards.ts` | `writeExpansionDescriptorsForCard`, `hasMeteorHoleAtForCard`, `countDiscsForCardComparison`, `getDiscDisadvantageForPlayer`, `hasFewerDiscsThanOpponentForPlayer` |
| `game/logic/cards/hyperactive.ts` | `getExpansionCellRef`, `getExpansionCells` |
| `game/logic/cards/meteor_god.ts` | local `EMPTY` binding |
| `ui/pixi/effects/source-trajectory-render-plan.ts` | `EMPTY_POINTS` |

Repository-wide identifier searches show that these exact local declarations have no consumers. Similarly named functions in canonical leaf modules are independently used and remain in place.

### Duplicate-implementation audit

An exact AST-token scan found 67 cross-file duplicate groups of at least 60 tokens. Comparing blame to the Phase 11 baseline found 32 groups with at least one newer copy. They were classified as follows:

| Class | Decision | Reason |
| --- | --- | --- |
| Shaped-board cell/value collection in six card modules | Refactor | Byte-equivalent projection over `SharedBoardUtils.collectBoardCoordinates` and `getCellValue`; shared board ownership is explicit. |
| Expansion socket target mapping in selector and target-resolver paths | Refactor | Byte-equivalent pure mapping over canonical expansion sockets; both consumers already depend on `SharedBoardUtils`. |
| Automatic-target inviolable-stone checks in four card modules | Refactor | Supported runtimes already load `CardMarkers`; `CardMarkers.isInviolableCell` is the existing canonical decision and has manifestation/Shinra coverage. |
| Pixi source-trajectory scalar, rectangle, point, and deterministic lightning-path math | Refactor | Implementations are operation-for-operation equivalent and already share contract tests comparing the legacy state builder and compiled render plan. |
| Different `clipSegment` implementations and their `clipPath` callers | Retain | They use different arithmetic structure; consolidation could alter floating-point results or clipping at boundaries. |
| Per-consumer renderer prepared-state closures | Retain | Recent renderer design intentionally gives each consumer an isolated scoped override. |
| Compatibility-global resolvers, `safeRequire` helpers, and small runtime fallbacks | Retain | Load order and partial-runtime behavior are compatibility contracts; generic textual similarity does not establish semantic identity. |
| Older Phase 11-baseline duplicates | Retain | The previous convergence review found no mechanically provable extraction boundary; reopening them needs separate characterization evidence. |
| Presentation-only normalizers and small UI utilities | Retain | Several have deliberately narrower semantics than similarly named canonical parsers; sharing would change behavior for malformed inputs. |

This classification is the complete implementation scope produced by the current audit under the user's low-regression constraint.

## Chosen design

### 1. Remove only post-baseline dead declarations

Delete the eleven declarations listed above without changing the canonical leaf functions they previously wrapped. Add the now-clean Meteor God and source-trajectory render-plan files to the existing clean-runtime unused-declaration guard. Do not enable `noUnusedLocals` repository-wide and do not delete any of the 348 older diagnostics without separate positive reachability proof.

### 2. Make shared board projections canonical

Add `collectBoardCellValues(board)` to `shared/shared-board-utils.ts`. It preserves the exact current ordering and values by mapping `collectBoardCoordinates(board)` to `{ row, col, owner: getCellValue(...) }`. The six card modules call this facade directly with their existing explicit `BoardContext`; no gameplay module gains UI or global dependencies.

Add pure `resolveBoardExpansionTargetSide` and `mapBoardExpansionSocketTarget` helpers to `shared/board/expansion-sockets.ts`, expose them from the socket factory and `SharedBoardUtils`, and route both selector implementations through the facade. The mapper preserves validation, addition cloning, side naming, direction cloning, null behavior, and array ordering exactly.

### 3. Route inviolable-target decisions through CardMarkers

Remove the four local manifestation-type sets and fallback implementations in Lightning, Meteor God, Destroy Dragon, and Sniper. Treat `CardMarkers.isInviolableCell` as a required core helper in those modules and call it directly.

This does not alter supported browser, headless, or Worker behavior: all supported module registries already load `CardMarkers`, and existing tests cover manifestation stones, legacy `specialStone` manifestation markers, and every cell of the 2x2 Shinra footprint. Making the dependency explicit also prevents a partially loaded runtime from silently targeting a protected stone.

### 4. Extract pure Pixi source-trajectory geometry

Create `ui/pixi/effects/source-trajectory-geometry.ts` as a pure calculation module shared by `source-trajectory.ts` and `source-trajectory-render-plan.ts`. It owns only the byte-equivalent helpers:

- scalar clamp and linear interpolation;
- frozen point construction;
- cubic-bezier progress sampling;
- painted-halo rectangle intersection;
- point-in-rectangle checks;
- deterministic trajectory text hashing, jagged-path generation, and lightning main/branch path generation.

The extraction preserves expression and loop order. It does not own rendering, timers, playback settlement, Pixi objects, clips, or board state. Both existing renderers remain under the active Pixi backend and the Single Visual Writer contract. The two distinct segment-clipping implementations remain local.

## Ownership and dependency boundaries

- `shared/board/expansion-sockets.ts`: topology-derived expansion sockets and their pure public target projection.
- `shared/shared-board-utils.ts`: runtime-portable board facade, including ordered cell/value collection.
- `game/logic/cards/markers.ts`: canonical marker protection and inviolability decisions.
- `ui/pixi/effects/source-trajectory-geometry.ts`: pure deterministic presentation geometry.
- `ui/pixi/effects/source-trajectory.ts`: trajectory lifecycle, legacy visual-state construction, and settlement.
- `ui/pixi/effects/source-trajectory-render-plan.ts`: precompiled render descriptors and scalar sampling.

No dependency points from `game/` or `shared/` into `ui/`, DOM, sound, timers, or network code. No second board writer, canvas, animation clock, or settlement path is introduced.

## Compatibility, failure behavior, and performance

- Player-visible behavior, random-call counts, coordinate ordering, target ordering, and frozen visual geometry remain unchanged.
- The new board helpers return fresh arrays and fresh coordinate records just like the removed local mappings.
- Missing core board or marker helpers fail at module initialization or the existing required-facade boundary instead of silently applying a weaker protection rule.
- The geometry extraction adds one static module edge and removes repeated calculation code; it does not add per-frame allocation beyond the existing operations.
- Browser and Worker generated surfaces are regenerated from root sources rather than edited directly.
- `01-rulebook.md` and `正本/*.md` remain unchanged because no player-visible rule, timing, text, sound, or animation behavior changes.

## Verification strategy

1. Structural and compiler proof:
   - TypeScript build and typecheck;
   - focused dependency-boundary test;
   - `noUnusedLocals` recount proving the diagnostic total falls from 359 to 348 with no new diagnostics;
   - runtime-cycle and headless-boundary checks through `checkall`.
2. Board facade and expansion mapping:
   - shared board cell-access tests, including dense and explicit shaped contexts;
   - expansion-socket leaf/facade tests, including valid edge/corner mappings and malformed-input rejection;
   - board expansion/card target tests.
3. Card protection delegation:
   - manifestation and Shinra automatic-target exclusion tests;
   - focused Lightning, Meteor God, Destroy Dragon, and Sniper tests;
   - expansion fallback tests.
4. Pixi geometry:
   - source-trajectory legacy-state tests;
   - compiled render-plan tests and their sampled legacy/compiled parity assertions;
   - the smallest relevant Pixi playback check if focused tests pass.
5. Delivery:
   - `npm run build:browser` after focused tests;
   - `npm run worker:prepare` for mirror generation and parity;
   - `npm run checkall`, `npm run build:vite`, and `npm run test:network:parity` in proportion to the shared/browser/Worker blast radius;
   - final `git diff --check`, task-scoped diff inspection, and clean status after commits.

## Completion conditions

- The eleven post-baseline unused declarations are gone and the diagnostic count returns to 348.
- All six shaped-board cell/value copies delegate to one facade operation.
- Both expansion target paths use one canonical mapper.
- All four automatic destroy modules use `CardMarkers.isInviolableCell` without local manifestation sets.
- Both Pixi trajectory implementations share one deterministic geometry module while retaining their distinct clipping and lifecycle code.
- Focused behavior/parity tests, browser generation, Worker preparation, and broad structural checks pass.
- Generated diffs come only from repository scripts.
- Every task-owned change is committed in coherent verified units and unrelated work remains untouched.

## Self-review

The first pass considered broad giant-file splitting and cleanup of all 359 compiler diagnostics. Repository history and dynamic-loader evidence make that unsafe: 348 diagnostics predate the proven baseline and may support compatibility or reflective paths. The design was narrowed to eleven post-baseline declarations with identifier and blame proof.

The first duplicate pass also proposed sharing `clipPath`, per-consumer renderer closures, generic runtime resolvers, and a presentation seat normalizer. Those proposals were rejected after comparing their dependencies and malformed-input semantics. The segment clippers use different arithmetic structure, prepared-state closures intentionally isolate consumers, loader helpers encode runtime order, and the seat normalizer is deliberately narrower than the canonical parser.

Finally, the marker proposal initially introduced another `isUntargetableStone` API. Self-review found that `CardMarkers.isInviolableCell` already owns the exact supported-runtime rule, so the design now delegates directly and adds no redundant public abstraction. The remaining scope has an explicit canonical owner, exact-operation preservation, focused existing coverage, and a bounded generated-delivery path.

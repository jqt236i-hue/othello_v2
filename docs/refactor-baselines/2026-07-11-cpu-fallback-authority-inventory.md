# CPU fallback authority inventory (2026-07-11)

## Scope

This inventory closes Task 5.2 of the behavior-preserving refactor program. It covers the five duplicate fallback families identified in `game/cpu-decision.ts`. Each root function is now a thin dependency-injecting adapter; the extracted TypeScript module named below is the sole implementation authority.

| Former root fallback family | Sole implementation authority | Runtime dependencies retained by the adapter | Proof |
| --- | --- | --- | --- |
| Board and marker primitives: `getBoardCellValueSafe`, `countAdjacentCellsByValue`, `getMarkerPriorityValue`, `getTimedMarkerProfileAt`, `getMarkerProfileAt` | `game/ai/cpu-policy-board-marker-primitives.ts` | shared board utilities and canonical `cardState` | `test/game.cpu-policy-board-marker-primitives.test.ts`, `test/cpu-decision.board-utils.test.ts` |
| Lv6 placement and clone filters: `filterLv6OpenCornerAdjacentMoves`, `filterMovesByLv6PlacementPriority`, `isCloneSplitEligibleSource`, `filterCloneSplitTargetsForLv6` | `game/ai/cpu-policy-placement-filters.ts` | placement-priority policy, board/marker access, player codec | `test/game.cpu-policy-placement-filters.test.ts`, `test/cpu.decision.refactor.test.ts` |
| Pending targets: corner proximity, forced-corner scores, simulated placement, synchronous/asynchronous selection and ONNX context | `game/ai/cpu-policy-pending-targets.ts` | board access, pending selector, score module, ONNX adapter | `test/game.cpu-policy-pending-targets.test.ts`, `test/cpu.decision.pending-actions.test.ts` |
| Time-bomb target score and choice | `game/ai/cpu-policy-time-bomb-targets.ts` | board/marker access, player codec, strategic counters, injected RNG | `test/game.cpu-policy-time-bomb-targets.test.ts`, `test/cpu.decision.pending-actions.test.ts` |
| Public move/use-card/pass action composition: `computeCpuAction` | `game/cpu-decision-action.ts` | legal-move, protection, card-choice, and move-policy adapters | `test/game.cpu-decision-action.test.ts`, `test/cpu.compute.test.ts`, `test/cpu.decision.public-api.test.ts` |

## Enforcement

`test/cpu-decision.board-utils.test.ts` verifies both sides of the boundary:

- every family is required at CPU composition setup and exposes the expected capability;
- the old optional-module branch form cannot return, so a missing capability fails during setup rather than recreating local policy logic.

The adapters preserve their existing dependency injection, including `cpuRng.random()` for time-bomb scoring. No seed consumption, target tie-breaking, card choice, or move action calculation was moved into a new body.

## Verification recorded at closure

- Focused CPU characterization and composition suites: 168 assertions passed.
- `npm run typecheck`, `npm run check:window`, `npm run build:browser`, `npm run worker:prepare`, and `npm run checkall`: passed.
- `worker:prepare` verified 893 mirrored files. No browser-operated gameplay or visual test was run because it has not been explicitly authorized.

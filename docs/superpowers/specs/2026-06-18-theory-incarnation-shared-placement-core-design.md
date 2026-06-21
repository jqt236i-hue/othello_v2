# 理論の化身 Shared Placement Core Design

## Role

This document records the approved design for routing `理論の化身` special-stone materialization through the same board placement and flip core used by normal placement.

## Target

`理論の化身` keeps its existing roulette candidate construction and random selection. Only the moment the selected theory number cell becomes a stone changes: the selected cell should use shared place-like board mutation so it can flip bracketed stones exactly like ordinary placement, while still allowing zero-flip materialization.

## Source Of Truth

Player-visible rule text remains owned by `01-rulebook.md`. The stable architecture contract remains `docs/architecture-contracts.md`, especially the headless `game/` boundary and existing immediate-effect dispatcher contract.

## Non-Goals

- Do not change theory roulette candidate generation, weights, PRNG consumption for candidate selection, animation duration, or materialize timing.
- Do not make theory spawn require a legal Reversi move. A selected cell with zero flips still materializes as before.
- Do not consume or mutate normal pending card state while resolving a theory spawn.
- Do not introduce DOM, sound, timer, or network dependencies into `game/logic`, `game/turn`, or shared card logic.

## Charge Gain

Theory-spawned cells no longer award the selected theory-number cell value as charge. They award charge only for the number of stones actually flipped by that spawn.

## Current Evidence

Normal placement currently runs through `game/turn/action-phase/place-resolution.ts`. That path computes flips, writes the placed stone with `BoardOps.spawnAt`, applies flip evasion, flips stones with `BoardOps.changeAt`, emits logical placement events, and then runs placement effects and follow-up logic.

`理論の化身` currently selects the roulette cell in `game/logic/card-resolution/theory-incarnation.ts` and directly calls `spawnAt` plus `addMarker`. That bypasses the normal placement flip section. The immediate effect portion is already shared through `game/turn/immediate-effect-dispatcher.ts`, but the actual board placement and flip mutation are still separate.

There is already a headless helper at `game/logic/cards-internal/spawn-and-flip.ts` for generated spawn-and-flip behavior. This is a better home than `game/turn/action-phase` for the shared placement core because both normal turn action code and `game/logic/card-resolution/theory-incarnation.ts` can depend on it without reversing the `game/logic` to `game/turn` dependency direction.

## Decision

Extend `game/logic/cards-internal/spawn-and-flip.ts` with a one-cell `spawnAndFlipPlacement` helper. It will be a headless board mutation helper, not a turn-flow helper.

The helper owns:

- computing flips with the same card-safe context used by normal placement
- calling `BoardOps.spawnAt` for the destination
- allowing or rejecting zero-flip placement by option
- applying `CardLogic.resolveHyperactiveFlipEvasion` before actual flips
- applying `BoardOps.changeAt` for every remaining flip
- clearing bomb and hyperactive marker state from successfully flipped positions
- returning applied flips, attempted flips, flip-evasion details, and spawn result metadata

The helper does not own:

- card cost checks
- pending card consumption
- theory-spawn charge collection
- turn handoff
- UI playback decisions
- theory roulette selection
- theory special-marker construction
- placement-time special-card effects

## Normal Placement Flow

`game/turn/action-phase/place-resolution.ts` should keep ownership of action validation, blocked-cell checks, selection-only pending effects, number-cell charge collection, logical `place` event emission, and turn-action result shape.

After validation, it calls `spawnAndFlipPlacement` for the board-write section that is currently embedded in that file. It passes:

- `allowZeroFlips: freePlacement`
- `spawnCause: 'FREE_PLACEMENT'` and `spawnReason: 'free_placement_place'` for free-placement pending types
- `spawnCause: 'SYSTEM'` and `spawnReason: 'standard_place'` for normal placement
- pending-specific spawn meta for gold, rainbow, silver, cross bomb, and X bomb placements
- taboo-reverse flip metadata only when the existing taboo branch selected replacement flips

The returned `appliedFlips` becomes the existing `flips` value used by subsequent normal placement effects. Existing event order and charge behavior must remain unchanged.

## Theory Spawn Flow

`game/logic/card-resolution/theory-incarnation.ts` should keep roulette construction and selection exactly where they are. After selecting the cell and preparing marker data, it calls `spawnAndFlipPlacement` through injected deps with:

- `allowZeroFlips: true`
- `spawnCause: 'THEORY_INCARNATION'`
- `spawnReason: 'theory_incarnation_spawn'`
- `flipCause: 'THEORY_INCARNATION'`
- `flipReason: 'theory_incarnation_flip'`
- `spawnMeta.special` set to the spawned special stone type
- `spawnMeta.owner` set to the theory owner
- `spawnMeta.sourceCardId` and `spawnMeta.sourceCardType` copied from the picked theory cell
- `spawnMeta.theorySpawnRoulette` set to the existing roulette payload

If the selected cell brackets opponent stones, those stones flip. If it brackets nothing, the special stone still appears.

The theory path then awards charge equal to `applied flip count`, adds the special marker using the prepared marker data, marks the theory number cell consumed, and returns the spawned payload. The selected theory-number value remains available for presentation/tests but does not grant charge. The payload should include `flips` and `chargeGained` so tests and logs can assert the board mutation without inspecting presentation internals.

## Marker Data

Theory-spawn marker data remains built by `game/logic/card-resolution/special-stone-marker-factory.ts`. That factory is the theory-spawn adapter from card type to marker data, because theory spawn is not normal pending-card placement and must not fake pending card state.

To reduce future drift:

- add focused tests for marker data that has historically diverged, including `意志狩りの王`
- keep normal placement marker construction in `game/logic/cards-internal/effect-timing.ts` for this change
- treat a future migration of normal pending placement marker construction to the same factory as a separate behavior-preserving refactor

## Player-Visible Rule Update

Implementation must update `01-rulebook.md` under `THEORY_INCARNATION` to state:

- theory-spawned special stones use ordinary placement flip judgment at the selected cell
- if the selected cell brackets opponent stones, those stones flip
- if the selected cell does not bracket any stones, the special stone still appears
- theory spawn does not grant the selected theory-number cell value as charge, but grants charge equal to the number of stones actually flipped by that spawn

Implementation must also update the relevant `正本/` note because this is player-visible card behavior and playback-visible board mutation.

## Testing Strategy

Use focused tests before implementation:

- theory spawn on a bracketed line flips the bracketed stone
- theory spawn on a zero-flip cell still appears
- theory spawn ignores the selected theory-number cell value for charge and awards actual flip count
- theory-spawned `意志狩りの王` still carries duration, flip-evade, and destroy-evade counters
- existing roulette metadata and immediate-effect tests still pass
- normal placement tests still pass to prove the extraction preserved behavior

## Risks

The main risk is accidentally importing normal turn-flow side effects into theory spawn. The design avoids this by sharing only a headless board placement core and keeping turn ownership in `game/turn/action-phase/place-resolution.ts`.

The second risk is playback ordering. The helper must continue using `BoardOps.spawnAt` before `BoardOps.changeAt`, so presentation events keep the selected theory materialization before any flip presentation in the same effect sequence.

The third risk is marker data drift. This change does not solve every marker factory duplication in one step. It narrows the immediate bug class by using one board placement core and keeps marker-data parity covered by explicit theory-spawn tests.

## Self Review

- No placeholder requirements remain.
- The design preserves zero-flip theory spawn, as requested.
- The design does not route `game/logic/card-resolution` through `game/turn`.
- The design separates board mutation sharing from card pending, charge, and turn handoff side effects.
- The design identifies the required rulebook and `正本/` updates for the implementation phase.

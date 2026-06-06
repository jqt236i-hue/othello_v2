# 理論の化身 数字マス進捗 Design

## Role

This document records the approved design for changing `理論の化身` (`theory_incarnation_01`, `THEORY_INCARNATION`) use-condition progress. It is not the gameplay source of truth; `01-rulebook.md` must be updated before implementation lands.

## Target

Change the `理論の化身` use condition from "sum of printed number-cell values" to "sum of number-cell charge actually gained from number cells." This makes `演算の意志` (`CRYSTAL_STONE`) intuitive: if it doubles a number-cell gain, that doubled number-cell gain also advances the `理論の化身` condition.

## Source Of Truth

- Gameplay specification: `01-rulebook.md`
- Canonical turn resolution: `game/turn/action-phase/place-resolution.ts`
- Theory card resolution: `game/logic/card-resolution/theory-incarnation.ts`
- Focused behavior test: `test/game.theory-incarnation.test.ts`

## Non-Goals

- Do not include normal flip charge in `理論の化身` progress.
- Do not make `理論の化身` spawned theory number cells award charge or progress.
- Do not change `理論の化身` cost, duration, action lock, manifest-stone protection, spawn candidates, or presentation timing.
- Do not add a new progress ledger unless the existing `numberCellCollectedTotalByPlayer` cannot represent the new rule.

## Current Behavior

`game/turn/action-phase/place-resolution.ts` currently increments `numberCellCollectedTotalByPlayer` with `bonusValue`, the original printed number-cell value. It then applies any number-cell multiplier to compute the charge actually awarded. Because of that order, `演算の意志` can double the player's charge without doubling `理論の化身` progress.

The existing focused test `test/game.theory-incarnation.test.ts` explicitly locks this old behavior by expecting a 21-point number cell under `演算の意志` to add only 21 progress.

## Decision

`理論の化身` progress should match the number-cell charge actually gained from the consumed number cell.

If a player consumes a 21 number cell under `演算の意志`, the player gains 42 number-cell charge and also gains 42 `理論の化身` progress. If the same placement also flips stones and gains normal flip charge, that normal flip charge remains outside `理論の化身` progress.

## Data Flow

Placement resolution should compute the multiplier-adjusted number-cell gain first:

```text
printed number-cell value
  -> number-cell multiplier, if active
  -> applied number-cell gain
  -> charge award
  -> 理論の化身 progress
```

`board_bonus_gain` events should continue to report:

- `bonus`: printed number-cell value
- `gained`: actual number-cell charge gained after multipliers
- `multiplier`: applied multiplier
- `boostedBy`: multiplier source, such as `CRYSTAL_STONE`

The theory progress ledger should use the same `gained` value, not the printed `bonus`.

## Testing

Use TDD:

1. Change the focused `理論の化身` test so a 21 number cell consumed under `演算の意志` advances progress to 42 and makes the card usable.
2. Confirm the changed test fails before implementation.
3. Update placement resolution so `numberCellCollectedTotalByPlayer` receives the multiplier-adjusted number-cell gain.
4. Confirm focused tests pass:
   - `npx jest --runInBand --runTestsByPath test/game.theory-incarnation.test.ts test/game.board-bonus.test.ts`

## Documentation Updates

Update `01-rulebook.md` in the implementation step:

- `理論の化身`: use condition is the total number-cell charge actually gained from consumed number cells.
- `演算の意志`: doubled number-cell gain also counts doubled toward `理論の化身`.
- Clarify that normal flip charge does not count.

Update `正本/カード仕様正本.md` only if the short `演算の意志` row would otherwise become stale after the rulebook change.

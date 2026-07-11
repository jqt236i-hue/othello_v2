# Board Expansion Descriptor Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate board-expansion descriptor normalization behind `SharedBoardUtils.collectExpansionDescriptors` while preserving all card, headless, UI, and worker-visible behavior.

**Architecture:** Keep `shared/shared-board-utils.ts` as the canonical pure helper for expansion descriptor normalization. Move one caller at a time onto that helper, retaining local fallback code until runtime load order and worker mirror validation prove it is removable.

**Tech Stack:** TypeScript, CommonJS-compatible browser modules, Jest/ts-jest, generated worker mirror via `npm run worker:prepare`.

---

## Current Structural Problem

Expansion-cell descriptor normalization exists in multiple source-of-truth files:

- `shared/shared-board-utils.ts` already exports `normalizeExpansionCell` and `collectExpansionDescriptors`.
- `game/logic/cards/expansion.ts` reimplements descriptor collection in `getExpansionDescriptorsForCard`.
- `game/logic/board_ops.ts` has a fallback implementation behind `getExpansionDescriptors`.
- `game/logic/cards/selectors-board-shape.ts` and `game/logic/cards/hyperactive-board-shape.ts` each have local `getExpansionCells` normalization.
- `ui/diff-renderer.ts` also has `_getExpansionDescriptorsForDiff`.

This is a safe refactor target because the intended behavior is normalization, not a rule change. The main risk is subtle drift around legacy `boardExpansion.active`, omitted `col` on left/right cells, custom board sizes, duplicate cells, invalid owners, and corner cells.

## Behavior To Preserve

- `boardExpansion.cells` takes precedence over legacy top-level `active/side/row/owner`.
- Legacy active expansion still works when `cells` is absent or empty.
- Left/right expansion cells may omit `col` and are resolved to the outer column.
- Top/bottom cells keep their explicit `col`.
- Duplicate normalized coordinates are emitted once, keeping the first owner.
- Owners normalize to `BLACK`, `WHITE`, or `EMPTY`.
- Main-board cells are excluded; valid outer-board/corner cells remain valid.
- Public exports and import paths do not change.
- No player-visible card text, rule timing, animation order, or network command shape changes.

## Execution Prerequisites

- Start with `git status --short`.
- Current dirty files may include `worker-public/`, `index.html`, `.codex/config.toml`, and `artifacts/`. Treat them as unrelated unless the user explicitly says they belong to this refactor.
- Do not run `git add -A`.
- Do not edit `worker-public/` first. If source changes require mirror sync, run `npm run worker:prepare` only after deciding how to handle pre-existing `worker-public/` changes.
- Do not change `01-rulebook.md`; this plan preserves behavior.

## File Map

- Modify: `test/game.custom-board-config.test.ts`
  - Add characterization tests proving `CardExpansion.getExpansionDescriptorsForCard`, `BoardOps.getExpansionDescriptors`, and `SharedBoardUtils.collectExpansionDescriptors` agree on tricky expansion shapes.
- Modify: `game/logic/cards/expansion.ts`
  - Use `SharedBoardUtils.collectExpansionDescriptors` as the primary descriptor path.
  - Keep existing local fallback for environments where `SharedBoardUtils` is unavailable during bootstrap.
- Later pass: `game/logic/board_ops.ts`
  - Only simplify fallback after the first pass is validated.
- Later pass: `game/logic/cards/selectors-board-shape.ts`, `game/logic/cards/hyperactive-board-shape.ts`, `ui/diff-renderer.ts`
  - Consolidate after each surface has its own focused characterization.

## Task 1: Characterize Descriptor Parity

**Files:**
- Modify: `test/game.custom-board-config.test.ts`

- [ ] **Step 1: Add the BoardOps import**

Add this import with the existing imports at the top:

```ts
import * as BoardOps from '../game/logic/board_ops.js';
```

- [ ] **Step 2: Add the characterization test**

Add this test inside `describe('custom board config foundations', () => { ... })` near the existing expansion/custom-board tests:

```ts
  test('expansion descriptor helpers agree on legacy and cells normalization', () => {
    const gameState = Core.createGameState({ rows: 8, cols: 9 });
    gameState.boardExpansion = {
      active: true,
      side: 'right',
      row: 2,
      owner: Core.WHITE,
      usedByPlayer: { black: true, white: true },
      cells: [
        { side: 'top', row: -1, col: 0, owner: Core.WHITE },
        { side: 'right', row: 4, owner: Core.BLACK },
        { side: 'right', row: 4, col: 9, owner: Core.WHITE },
        { side: 'bottom', row: 8, col: 8, owner: 999 },
        { side: 'left', row: 1, col: -1, owner: Core.BLACK },
        { side: 'left', row: 1, col: -1, owner: Core.WHITE },
        { side: 'top', row: 0, col: 0, owner: Core.BLACK }
      ]
    };

    const expected = [
      { side: 'top', row: -1, col: 0, owner: Core.WHITE },
      { side: 'right', row: 4, col: 9, owner: Core.BLACK },
      { side: 'bottom', row: 8, col: 8, owner: Core.EMPTY },
      { side: 'left', row: 1, col: -1, owner: Core.BLACK }
    ];

    expect(SharedBoardUtils.collectExpansionDescriptors(gameState.boardExpansion, gameState)).toEqual(expected);
    expect(CardExpansion.getExpansionDescriptorsForCard(gameState)).toEqual(expected);
    expect(BoardOps.getExpansionDescriptors(gameState)).toEqual(expected);
  });
```

- [ ] **Step 3: Run the characterization test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.custom-board-config.test.ts
```

Expected: PASS. This is a characterization test, so it should pass before production changes.

- [ ] **Step 4: Commit only the test**

Run:

```powershell
git status --short
git add test/game.custom-board-config.test.ts
git commit -m "test: characterize expansion descriptor parity"
```

Expected: a commit containing only `test/game.custom-board-config.test.ts`.

## Task 2: Route CardExpansion Through SharedBoardUtils

**Files:**
- Modify: `game/logic/cards/expansion.ts`

- [ ] **Step 1: Change the primary implementation**

In `getExpansionDescriptorsForCard`, keep the initial `expansion` lookup, then add this primary shared-helper branch before the local fallback logic:

```ts
    if (BoardUtils && typeof BoardUtils.collectExpansionDescriptors === 'function') {
        return BoardUtils.collectExpansionDescriptors(expansion, gameState);
    }
```

The function should still keep its existing local `pushDescriptor` fallback after that branch.

- [ ] **Step 2: Run the focused test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.custom-board-config.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run the expansion fallback tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.expansion-fallback-helpers.test.ts test/game.board-expansion-will.test.ts
```

Expected: PASS. These protect modules that rely on fallback/legacy expansion behavior.

- [ ] **Step 4: Run source boundary and type validation**

Run:

```powershell
npm run check:window
npm run typecheck
```

Expected: both PASS.

- [ ] **Step 5: Review the diff**

Run:

```powershell
git diff -- game/logic/cards/expansion.ts test/game.custom-board-config.test.ts
git diff --check
```

Expected: no whitespace errors; diff is limited to the characterization test and the shared-helper branch.

- [ ] **Step 6: Commit the implementation**

Run:

```powershell
git status --short
git add game/logic/cards/expansion.ts
git commit -m "refactor: share expansion descriptor normalization"
```

Expected: a commit containing only `game/logic/cards/expansion.ts`, assuming Task 1 was already committed.

## Task 3: Decide Worker Mirror Handling

**Files:**
- Potentially generated: `worker-public/**`
- Potentially generated: `public/module-registry.js`

- [ ] **Step 1: Check whether generated surfaces are already dirty**

Run:

```powershell
git status --short worker-public public/module-registry.js
```

Expected: if unrelated pre-existing changes are present, stop and report them before running mirror generation.

- [ ] **Step 2: If the generated surfaces are clean, prepare worker assets**

Run only when Step 1 is clean or the user explicitly approves including the generated mirror:

```powershell
npm run worker:prepare
```

Expected: PASS.

- [ ] **Step 3: Review generated changes**

Run:

```powershell
git diff --stat -- worker-public public/module-registry.js
git diff -- worker-public/game/logic/cards/expansion.js
```

Expected: generated output reflects the `CardExpansion` source change only.

- [ ] **Step 4: Commit generated mirror separately**

Run:

```powershell
git add worker-public/game/logic/cards/expansion.js public/module-registry.js
git commit -m "build: update worker expansion descriptor mirror"
```

Expected: a separate generated-output commit. If generation touches many unrelated files, do not commit; report the file list.

## Deferred Follow-Up Candidates

Do not execute these in this plan. Create a new plan after Task 2 has landed and worker mirror handling is resolved.

- `game/logic/board_ops.ts`: evaluate whether its fallback descriptor collector can prefer `SharedBoardUtils.collectExpansionDescriptors` when `CardExpansion` is unavailable.
- `game/logic/cards/selectors-board-shape.ts`: characterize `getExpansionCells` parity before routing through the shared helper.
- `game/logic/cards/hyperactive-board-shape.ts`: characterize `getExpansionCellRef`, `getBoardCell`, and `setBoardCell` before touching descriptor collection.
- `ui/diff-renderer.ts`: characterize `_getExpansionDescriptorsForDiff` through UI rendering tests before reusing the shared helper.

## Out Of Scope For This Plan

- Splitting `game/cpu-decision.ts`.
- Splitting `ui/bootstrap.ts`.
- Changing card rules, visible text, animation order, sound behavior, or network snapshot schema.
- Removing compatibility shims or public exports.
- Editing `worker-public/` by hand.
- Refactoring the current result BGM dirty diff. That should be a separate plan because it depends on uncommitted UI/audio changes.

## Minimum Validation Summary

- Task 1: `npx jest --runInBand --runTestsByPath test/game.custom-board-config.test.ts`
- Task 2: `npx jest --runInBand --runTestsByPath test/game.custom-board-config.test.ts`
- Task 2: `npx jest --runInBand --runTestsByPath test/game.expansion-fallback-helpers.test.ts test/game.board-expansion-will.test.ts`
- Task 2: `npm run check:window`
- Task 2: `npm run typecheck`
- Task 3: `npm run worker:prepare` only if generated/mirror dirty state is safe

## Risk Level

Medium. The code change is small, but the normalized descriptors are used by multiple card effects, CPU/headless paths, and generated worker assets. Characterization must come first.

## Rollback Approach

Each task is committed separately. Roll back the implementation commit first while keeping the characterization test if it still describes intended behavior:

```powershell
git log --oneline -5
git revert HEAD
```

Use `git revert HEAD` only when the implementation commit is the latest commit. If generated mirror changes were committed separately after source changes, revert the generated commit first.

## Self-Review

- Spec coverage: the plan addresses the strongest immediate refactor candidate, preserves behavior, and splits worker mirror handling from source changes.
- Placeholder scan: no unresolved placeholders are required for execution.
- Type consistency: the plan uses existing exported names: `SharedBoardUtils.collectExpansionDescriptors`, `CardExpansion.getExpansionDescriptorsForCard`, and `BoardOps.getExpansionDescriptors`.

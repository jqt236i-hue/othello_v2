# Pending Selection Turn Contract Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent regressions where pending target-selection cards advance or block the turn incorrectly, and clarify the network deferred-selection contracts that were exposed while fixing `破壊の意志`.

**Architecture:** Keep canonical turn behavior in `game/turn/action-phase/*` and the pending-selection registry in `game/logic/cards-internal/pending-selection-registry.ts` as the contract source. Tests should verify contract alignment without adding new runtime APIs or moving authority into UI/network code. Network tests should distinguish deterministic preview-then-publish selections from publish-only selections that must wait for the authoritative server result.

**Tech Stack:** TypeScript, CommonJS wrappers, Jest with ts-jest, Playwright-on-Jest E2E helpers, existing Card Reversi headless and browser runtime modules.

---

## Context

The fixed bug was caused by `DESTROY_ONE_STONE` being registered as `turnOutcome: 'continue_turn'` while the target-selection branch in `game/turn/action-phase/pre-placement-selection.ts` called `handOffTurnAfterSelection()` after a successful destroy. That advanced the turn immediately after selecting the destroy target, so the player could no longer place a normal stone in the same turn.

Current evidence gathered before this plan:

- `DESTROY_ONE_STONE` headless regression now passes.
- Network E2E for `PROLIFERATION_WILL` plus `DESTROY_ONE_STONE` now verifies both clients remain on the placement turn after destroy.
- A one-off stub audit over all 34 pending-selection registry entries found no remaining mismatch between `turnOutcome` and `handOffTurnAfterSelection()` calls.
- Focused tests for `TRAP_WILL` and `SWAP_WITH_ENEMY` turn handoff pass. Those two are the intended selection-only end-turn cards.
- `test/game.pending-selection-flow.test.ts` still fails for publish-only network selections such as `TELEPORT_WILL` and `METEOR_WILL` because those cards intentionally bypass local preview in network mode but are still included in a preview-then-publish expectation table.
- `test/ui.network-client.swap-deferred-publish.test.ts` expects no root `row` / `col`, while `game/turn/pending-coordinator.ts` intentionally adds root coordinates for place-command compatibility.

## Preconditions

- Run `git status --short` before executing. This repository currently has unrelated dirty files. Do not stage or commit unrelated changes.
- If `test/e2e/network_special_cards.e2e.test.ts` is already dirty from another task, inspect `git diff -- test/e2e/network_special_cards.e2e.test.ts` before editing and stage only the intentional hunks.
- Do not run `npm run build:browser` or `npm run worker:prepare` until generated and mirror dirty files are either clean or explicitly owned by the current task.

## File Structure

- Create `test/game.pending-selection-turn-outcome-contract.test.ts`
  - Contract regression test that executes every pre-placement pending-selection branch with a stubbed `CardLogic` and asserts handoff calls match registry `turnOutcome`.
- Modify `test/e2e/network_special_cards.e2e.test.ts`
  - Extend the existing `PROLIFERATION_WILL survives DESTROY_ONE_STONE...` E2E to click a normal white placement after destroy and verify both clients commit that placement.
- Modify `test/game.pending-selection-flow.test.ts`
  - Remove publish-only cards from the preview-then-publish table.
  - Add a dedicated publish-only network selection test for `TELEPORT_WILL`, `CELL_TELEPORT_WILL`, and `METEOR_WILL`.
- Modify `test/ui.network-client.swap-deferred-publish.test.ts`
  - Update the expected publish params to include root `row` / `col` and assert they match `swapTarget`.
- No production code changes are expected in this plan unless a new test proves current behavior differs from the documented contract.

---

### Task 1: Add Pending Selection Turn-Outcome Contract Test

**Files:**
- Create: `test/game.pending-selection-turn-outcome-contract.test.ts`

- [ ] **Step 1: Write the contract test**

Create `test/game.pending-selection-turn-outcome-contract.test.ts` with this content:

```ts
import * as PendingSelectionRegistry from '../game/logic/cards-internal/pending-selection-registry.js';
import * as PrePlacementSelection from '../game/turn/action-phase/pre-placement-selection.js';

const HAND_OVERLAY_ACTION_FIELD_BY_TYPE: Record<string, string> = {
  HEAVEN_BLESSING: 'heavenBlessingCardId',
  CONDEMN_WILL: 'condemnTargetIndex',
  OBSERVER_WILL: 'observerWillTargetIndex'
};

const ACTION_VALUE_BY_FIELD: Record<string, any> = {
  blockadeTarget: { row: 1, col: 1 },
  bombTarget: { row: 1, col: 1 },
  buoyancyTarget: { row: 1, col: 1 },
  captureTarget: { row: 1, col: 1 },
  cloneTarget: { row: 1, col: 1 },
  condemnTargetIndex: 0,
  corrosionTarget: { row: 1, col: 1 },
  destroyTarget: { row: 1, col: 1 },
  expansionTarget: { row: 1, col: 1 },
  extendTarget: { row: 1, col: 1 },
  freezeTarget: { row: 1, col: 1 },
  gravityTarget: { row: 1, col: 1 },
  guardTarget: { row: 1, col: 1 },
  heavenBlessingCardId: 'gold_stone',
  livingWillTarget: { row: 1, col: 1 },
  meteorTarget: { row: 1, col: 1 },
  observerWillTargetIndex: 0,
  positionSwapTarget: { row: 1, col: 1 },
  reverseWillTarget: { row: 1, col: 1 },
  seedTarget: { row: 1, col: 1 },
  shrinkTarget: { row: 1, col: 1 },
  strongWindTarget: { row: 1, col: 1 },
  superAttractionTarget: { row: 1, col: 1 },
  superBuoyancyTarget: { row: 1, col: 1 },
  superGravityTarget: { row: 1, col: 1 },
  swapTarget: { row: 1, col: 1 },
  teleportTarget: { row: 1, col: 1 },
  temptTarget: { row: 1, col: 1 },
  trapTarget: { row: 1, col: 1 }
};

function applied(extra: Record<string, any> = {}) {
  return { applied: true, ...extra };
}

function createCardLogicStub() {
  const fixed: Record<string, any> = {
    applyDestroyEffectDetailed: () => ({ destroyed: true, kind: 'destroyed' }),
    applyDestroyEffect: () => true,
    applySwapEffect: () => true,
    applyTrapWill: () => applied(),
    applyHeavenBlessingChoice: () => applied(),
    applyCondemnWill: () => applied({ destroyedCardId: 'condemned_01' }),
    applyObserverWillChoice: () => applied({
      stolenCardId: 'stolen_01',
      stolenCardCopyId: 1,
      repaymentAmount: 0
    }),
    applyCloneWill: () => applied({ spawned: [], flipped: [] }),
    applyBoardExpansionWill: () => applied({ completed: true, added: [] }),
    applyBoardExpansionGod: () => applied({ completed: true, added: [] }),
    applyBoardShrinkWill: () => applied({ completed: true }),
    applyBoardShrinkGod: () => applied({ completed: true }),
    applyExtendLifeWill: () => applied({ multiplier: 2 }),
    applyExtendLifeGod: () => applied({ multiplier: 4 })
  };

  return new Proxy(fixed, {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      if (String(prop).startsWith('apply')) return () => applied();
      return undefined;
    }
  });
}

function createActionForPendingType(cardType: string, entry: any) {
  const actionField = entry && entry.action && entry.action.field
    ? entry.action.field
    : HAND_OVERLAY_ACTION_FIELD_BY_TYPE[cardType];
  if (!actionField) {
    throw new Error(`missing test action field for ${cardType}`);
  }
  if (!(actionField in ACTION_VALUE_BY_FIELD)) {
    throw new Error(`missing test action value for ${cardType}.${actionField}`);
  }
  return {
    type: 'place',
    [actionField]: ACTION_VALUE_BY_FIELD[actionField]
  };
}

describe('pending selection turn outcome contract', () => {
  test('pre-placement selection handoff matches registry turnOutcome for every pending selection type', () => {
    const registry = PendingSelectionRegistry.PENDING_SELECTION_REGISTRY as Record<string, any>;
    const failures: any[] = [];
    const coveredTypes: string[] = [];

    for (const [cardType, entry] of Object.entries(registry)) {
      let handoffCalls = 0;
      const events: any[] = [];
      const action = createActionForPendingType(cardType, entry);

      const result = PrePlacementSelection.resolvePrePlacementSelectionAction({
        CardLogic: createCardLogicStub(),
        cardState: {},
        gameState: {},
        playerKey: 'black',
        action,
        events,
        prng: { random: () => 0 },
        pending: {
          type: cardType,
          stage: 'selectTarget',
          cardId: `${cardType.toLowerCase()}_test`
        },
        createDestroyOutcome: (value: any) => value,
        isDestroyOutcomeResolved: (value: any) => !!(
          value &&
          (value.applied === true || value.destroyed === true || value.kind)
        ),
        applyTrapEffectsAfterSelection: () => undefined,
        handOffTurnAfterSelection: () => {
          handoffCalls += 1;
        },
        emitDurationSelectionStatusTick: () => undefined,
        emitHandRemovePresentation: () => undefined,
        emitHandAddPresentation: () => undefined
      });

      coveredTypes.push(cardType);
      const shouldHandoff = entry.turnOutcome === 'end_turn';
      const didHandoff = handoffCalls > 0;

      if (didHandoff !== shouldHandoff) {
        failures.push({
          cardType,
          turnOutcome: entry.turnOutcome,
          handoffCalls,
          result
        });
      }
    }

    expect(coveredTypes.sort()).toEqual(Object.keys(registry).sort());
    expect(failures).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the new test**

Run:

```powershell
npm run test:jest -- --runInBand --runTestsByPath test/game.pending-selection-turn-outcome-contract.test.ts
```

Expected: PASS. This is a guard test for a bug that was already fixed. To prove it catches the old failure, temporarily add `opts.handOffTurnAfterSelection();` inside the `DESTROY_ONE_STONE` branch after `opts.applyTrapEffectsAfterSelection();`, run the same command and confirm it fails with `DESTROY_ONE_STONE`, then remove that temporary change before continuing.

- [ ] **Step 3: Run the related turn-flow tests**

Run:

```powershell
npm run test:jest -- --runInBand --runTestsByPath test/game.pending-selection-turn-outcome-contract.test.ts test/cards.pending-selection-contract.test.ts test/game.destroy-one-stone.turn-flow.test.ts test/game.trap-selection-turn-handoff.test.ts test/game.swap-selection-turn-handoff.test.ts
```

Expected: all listed suites pass.

- [ ] **Step 4: Commit this task if the working tree allows an isolated commit**

Stage only the new test:

```powershell
git add test/game.pending-selection-turn-outcome-contract.test.ts
git commit -m "Add pending selection turn outcome contract test"
```

If unrelated dirty files make staging ambiguous, do not commit. Report the exact dirty files that block an isolated commit.

---

### Task 2: Extend Network E2E To Place After `破壊の意志`

**Files:**
- Modify: `test/e2e/network_special_cards.e2e.test.ts`

- [ ] **Step 1: Add the post-destroy placement assertion**

In the existing test named `PROLIFERATION_WILL survives DESTROY_ONE_STONE and keeps the placement turn on both network clients`, insert this block immediately after:

```ts
expect(guestState.turnNumber).toBe(hostState.turnNumber);
```

Insert:

```ts
      const turnBeforeWhitePlacement = guestState.turnNumber;
      const whiteMove = await getFirstLegalMove(guestPage);
      expect(whiteMove.firstLogicMove).toEqual(expect.objectContaining({
        row: expect.any(Number),
        col: expect.any(Number)
      }));
      expect(whiteMove.logicMoveCount).toBeGreaterThan(0);

      const whiteMoveToPlay = whiteMove.hintedMove || whiteMove.firstLogicMove;
      await guestPage.click(`.cell[data-row="${whiteMoveToPlay.row}"][data-col="${whiteMoveToPlay.col}"]`);

      await hostPage.waitForFunction(
        ({ row, col, turnBefore }) => !!(
          window.gameState
          && window.gameState.currentPlayer === 1
          && window.gameState.turnNumber === turnBefore + 1
          && window.gameState.board
          && window.gameState.board[row]
          && window.gameState.board[row][col] === -1
          && window.isProcessing !== true
          && window.isCardAnimating !== true
          && window.VisualPlaybackActive !== true
        ),
        { row: whiteMoveToPlay.row, col: whiteMoveToPlay.col, turnBefore: turnBeforeWhitePlacement },
        { timeout: 20000 }
      );
      await guestPage.waitForFunction(
        ({ row, col, turnBefore }) => !!(
          window.gameState
          && window.gameState.currentPlayer === 1
          && window.gameState.turnNumber === turnBefore + 1
          && window.gameState.board
          && window.gameState.board[row]
          && window.gameState.board[row][col] === -1
          && window.isProcessing !== true
          && window.isCardAnimating !== true
          && window.VisualPlaybackActive !== true
        ),
        { row: whiteMoveToPlay.row, col: whiteMoveToPlay.col, turnBefore: turnBeforeWhitePlacement },
        { timeout: 20000 }
      );
```

- [ ] **Step 2: Run only the strengthened E2E**

Run:

```powershell
npm run test:jest -- --runInBand --runTestsByPath test/e2e/network_special_cards.e2e.test.ts -t "PROLIFERATION_WILL survives DESTROY_ONE_STONE"
```

Expected: one E2E passes and skipped cases remain skipped.

- [ ] **Step 3: Commit this task if the E2E passes and the diff is isolated**

Stage only the intended hunk in the E2E file:

```powershell
git add test/e2e/network_special_cards.e2e.test.ts
git diff --cached -- test/e2e/network_special_cards.e2e.test.ts
git commit -m "Verify destroy will allows network placement"
```

If the file contains unrelated dirty changes, use partial staging or skip the commit and report the conflict.

---

### Task 3: Split Preview-Then-Publish And Publish-Only Network Selection Tests

**Files:**
- Modify: `test/game.pending-selection-flow.test.ts`

- [ ] **Step 1: Remove publish-only cards from the preview table**

In the `it.each` table for:

```ts
'network continue-turn deferred selection previews resolved local state before publish settles for $pendingType'
```

remove the entries for:

```ts
{
  pendingType: 'TELEPORT_WILL',
  row: 4,
  col: 4,
  actionPayload: { teleportTarget: { row: 4, col: 4 } },
  initialBoardEntries: [
    { row: 3, col: 3, value: 1 },
    { row: 4, col: 4, value: 0 }
  ],
  buildNextCardState: (cardState) => ({
    ...cloneJson(cardState),
    pendingEffectByPlayer: { black: null, white: null }
  }),
  buildNextGameState: (gameState) => {
    const nextGameState = cloneJson(gameState);
    nextGameState.board[3][3] = 0;
    nextGameState.board[4][4] = 1;
    return nextGameState;
  },
  assertPreview: ({ gameState }) => {
    expect(gameState.board[3][3]).toBe(0);
    expect(gameState.board[4][4]).toBe(1);
  }
},
{
  pendingType: 'CELL_TELEPORT_WILL',
  row: 4,
  col: 4,
  actionPayload: { teleportTarget: { row: 4, col: 4 } },
  initialBoardValue: 1,
  buildNextCardState: (cardState) => ({
    ...cloneJson(cardState),
    pendingEffectByPlayer: { black: null, white: null },
    markers: [{
      id: 'cell_teleport_hole_1',
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'METEOR_HOLE' }
    }]
  }),
  buildNextGameState: (gameState) => {
    const nextGameState = cloneJson(gameState);
    nextGameState.board[4][4] = 0;
    nextGameState.boardExpansion = {
      active: true,
      usedByPlayer: { black: false, white: false },
      cells: [{ row: -1, col: 4, side: 'top', owner: 1 }]
    };
    return nextGameState;
  },
  assertPreview: ({ cardState, gameState }) => {
    expect(gameState.board[4][4]).toBe(0);
    expect(gameState.boardExpansion).toEqual(expect.objectContaining({
      cells: expect.arrayContaining([
        expect.objectContaining({ row: -1, col: 4, owner: 1 })
      ])
    }));
    expect(cardState.markers).toEqual([
      expect.objectContaining({
        row: 4,
        col: 4,
        owner: 'black',
        data: expect.objectContaining({ type: 'METEOR_HOLE' })
      })
    ]);
  }
},
{
  pendingType: 'METEOR_WILL',
  row: 2,
  col: 2,
  actionPayload: { meteorTarget: { row: 2, col: 2 } },
  buildNextCardState: (cardState) => ({
    ...cloneJson(cardState),
    pendingEffectByPlayer: { black: null, white: null },
    markers: [{
      id: 'meteor_hole_1',
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'METEOR_HOLE' }
    }]
  }),
  buildNextGameState: (gameState) => {
    const nextGameState = cloneJson(gameState);
    nextGameState.board[2][2] = 0;
    return nextGameState;
  },
  initialBoardValue: -1,
  assertPreview: ({ cardState, gameState }) => {
    expect(gameState.board[2][2]).toBe(0);
    expect(cardState.markers).toEqual([
      expect.objectContaining({
        row: 2,
        col: 2,
        owner: 'black',
        data: expect.objectContaining({ type: 'METEOR_HOLE' })
      })
    ]);
  }
}
```

Keep deterministic preview cases such as `DESTROY_ONE_STONE`, `BLOCKADE_WILL`, `FREEZE_WILL`, `TIME_BOMB`, `SEED_WILL`, `EXTEND_LIFE_WILL`, `EXTEND_LIFE_GOD`, and `BOARD_EXPANSION_WILL` in the preview table.

- [ ] **Step 2: Add a publish-only test for teleport and meteor cards**

Add this test after the preview table:

```ts
  test.each([
    {
      pendingType: 'TELEPORT_WILL',
      row: 4,
      col: 4,
      actionPayload: { teleportTarget: { row: 4, col: 4 } },
      initialBoardEntries: [
        { row: 3, col: 3, value: 1 },
        { row: 4, col: 4, value: 0 }
      ]
    },
    {
      pendingType: 'CELL_TELEPORT_WILL',
      row: 4,
      col: 4,
      actionPayload: { teleportTarget: { row: 4, col: 4 } },
      initialBoardEntries: [
        { row: 4, col: 4, value: 1 }
      ]
    },
    {
      pendingType: 'METEOR_WILL',
      row: 2,
      col: 2,
      actionPayload: { meteorTarget: { row: 2, col: 2 } },
      initialBoardEntries: [
        { row: 2, col: 2, value: -1 }
      ]
    }
  ])(
    'network publish-only deferred selection waits for authoritative snapshot before local preview for $pendingType',
    async ({ pendingType, row, col, actionPayload, initialBoardEntries }) => {
      attachPlaybackStateManager();
      let resolvePublish = null;
      const board = Array.from({ length: 8 }, () => Array(8).fill(0));
      initialBoardEntries.forEach((entry) => {
        board[entry.row][entry.col] = entry.value;
      });
      const initialCardState = {
        turnIndex: 5,
        markers: [],
        pendingEffectByPlayer: {
          black: { type: pendingType, stage: 'selectTarget' },
          white: null
        }
      };
      const initialGameState = {
        currentPlayer: 1,
        turnNumber: 9,
        board
      };

      global.MATCH_MODE = 'network';
      global.cardState = cloneJson(initialCardState);
      global.gameState = cloneJson(initialGameState);
      global.ActionManager = {
        ActionManager: {
          createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
        }
      };
      global.NetworkMatchClient = {
        isActive: jest.fn(() => true),
        publishSnapshot: jest.fn(() => new Promise((resolve) => {
          resolvePublish = resolve;
        }))
      };
      global.waitForPlaybackIdle = jest.fn(() => new Promise(() => {}));
      global.emitCardStateChange = jest.fn();
      global.emitBoardUpdate = jest.fn();
      global.emitGameStateChange = jest.fn();
      global.emitLogAdded = jest.fn();
      global.TurnPipeline = {};
      global.TurnPipelineUIAdapter = {
        runTurnWithAdapter: jest.fn(() => {
          throw new Error(`${pendingType} should publish without local preview in network mode`);
        })
      };
      global.isProcessing = false;
      global.isCardAnimating = false;

      const pendingPromise = flow.executePendingSelection({
        row,
        col,
        playerKey: 'black',
        pendingType,
        actionPayload
      });

      await Promise.resolve();
      await Promise.resolve();

      expect(typeof resolvePublish).toBe('function');
      expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).not.toHaveBeenCalled();
      expect(global.cardState).toEqual(initialCardState);
      expect(global.gameState).toEqual(initialGameState);
      expect(global.emitCardStateChange).not.toHaveBeenCalled();
      expect(global.emitBoardUpdate).not.toHaveBeenCalled();
      expect(global.emitGameStateChange).not.toHaveBeenCalled();

      resolvePublish({ ok: true });
      const result = await pendingPromise;
      expect(result).toEqual(expect.objectContaining({
        ok: true,
        pendingType,
        publishedByNetwork: true,
        playbackEvents: []
      }));
    }
  );
```

- [ ] **Step 3: Run the affected pending-flow tests**

Run:

```powershell
npm run test:jest -- --runInBand --runTestsByPath test/game.pending-selection-flow.test.ts -t "network continue-turn deferred selection previews resolved local state before publish settles|network publish-only deferred selection waits for authoritative snapshot"
```

Expected: preview cases pass, and publish-only cases for `TELEPORT_WILL`, `CELL_TELEPORT_WILL`, and `METEOR_WILL` pass.

- [ ] **Step 4: Run the broader pending-flow focused set**

Run:

```powershell
npm run test:jest -- --runInBand --runTestsByPath test/game.pending-selection-flow.test.ts test/game.pending-coordinator.contract.test.ts
```

Expected: both suites pass. If unrelated busy-state tests fail, stop and inspect the failing test names before changing production code.

- [ ] **Step 5: Commit this task if isolated**

```powershell
git add test/game.pending-selection-flow.test.ts
git diff --cached -- test/game.pending-selection-flow.test.ts
git commit -m "Clarify network publish-only selection tests"
```

---

### Task 4: Clarify `SWAP_WITH_ENEMY` Deferred Publish Payload Contract

**Files:**
- Modify: `test/ui.network-client.swap-deferred-publish.test.ts`

- [ ] **Step 1: Update the expected params**

In `SWAP_WITH_ENEMY selection publishes only the deferred combined snapshot once`, replace:

```ts
    expect(publishBodies[0].params).toEqual({
      player: 'black',
      swapTarget: { row: 6, col: 8 },
      pendingSelectionState: {
        type: 'SWAP_WITH_ENEMY',
        stage: 'selectTarget',
        cardId: 'swap_01'
      }
    });
```

with:

```ts
    expect(publishBodies[0].params).toEqual({
      player: 'black',
      row: 6,
      col: 8,
      swapTarget: { row: 6, col: 8 },
      pendingSelectionState: {
        type: 'SWAP_WITH_ENEMY',
        stage: 'selectTarget',
        cardId: 'swap_01'
      }
    });
    expect({
      row: publishBodies[0].params.row,
      col: publishBodies[0].params.col
    }).toEqual(publishBodies[0].params.swapTarget);
```

This documents the current compatibility contract from `game/turn/pending-coordinator.ts`: command publishing may include root place coordinates, but the card-specific `swapTarget` remains the semantic selection target.

- [ ] **Step 2: Run the swap publish test**

Run:

```powershell
npm run test:jest -- --runInBand --runTestsByPath test/ui.network-client.swap-deferred-publish.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run related publish contract tests**

Run:

```powershell
npm run test:jest -- --runInBand --runTestsByPath test/ui.network-client.swap-deferred-publish.test.ts test/game.pending-coordinator.contract.test.ts test/ui.network-publish-request.test.ts
```

Expected: all listed suites pass.

- [ ] **Step 4: Commit this task if isolated**

```powershell
git add test/ui.network-client.swap-deferred-publish.test.ts
git diff --cached -- test/ui.network-client.swap-deferred-publish.test.ts
git commit -m "Document swap deferred publish coordinates"
```

---

### Task 5: Final Verification

**Files:**
- No additional file edits.

- [ ] **Step 1: Run the complete focused suite**

Run:

```powershell
npm run test:jest -- --runInBand --runTestsByPath test/game.pending-selection-turn-outcome-contract.test.ts test/cards.pending-selection-contract.test.ts test/game.destroy-one-stone.turn-flow.test.ts test/game.trap-selection-turn-handoff.test.ts test/game.swap-selection-turn-handoff.test.ts test/game.pending-selection-flow.test.ts test/game.pending-coordinator.contract.test.ts test/ui.network-client.swap-deferred-publish.test.ts test/ui.network-publish-request.test.ts
```

Expected: all listed suites pass.

- [ ] **Step 2: Run the strengthened network E2E**

Run:

```powershell
npm run test:jest -- --runInBand --runTestsByPath test/e2e/network_special_cards.e2e.test.ts -t "PROLIFERATION_WILL survives DESTROY_ONE_STONE"
```

Expected: one E2E passes and skipped cases remain skipped.

- [ ] **Step 3: Typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Inspect final diff**

Run:

```powershell
git status --short
git diff -- test/game.pending-selection-turn-outcome-contract.test.ts test/e2e/network_special_cards.e2e.test.ts test/game.pending-selection-flow.test.ts test/ui.network-client.swap-deferred-publish.test.ts
```

Expected: only the four planned test files changed for this work. Existing unrelated dirty files may still appear in `git status --short`; do not stage them.

- [ ] **Step 5: Final commit if not already committed task-by-task**

If task commits were skipped and the diff is still isolated, stage only planned files:

```powershell
git add test/game.pending-selection-turn-outcome-contract.test.ts
git add test/e2e/network_special_cards.e2e.test.ts
git add test/game.pending-selection-flow.test.ts
git add test/ui.network-client.swap-deferred-publish.test.ts
git diff --cached --stat
git commit -m "Harden pending selection turn contracts"
```

Do not use `git add -A`.

---

## Self-Review

- Spec coverage: The plan covers the immediate regression guard, network placement after `破壊の意志`, publish-only selection contract failures, and `SWAP_WITH_ENEMY` payload contract drift.
- Placeholder scan: No placeholder markers, generic "add tests", or unspecified implementation steps remain. Each edit has concrete paths, code, commands, and expected outcomes.
- Boundary check: Production code is not changed unless tests prove the current documented contract is wrong. No DOM/window/network dependency is added to `game/` headless logic.
- Dirty tree check: The plan explicitly requires partial staging and avoids generated or mirror writes.

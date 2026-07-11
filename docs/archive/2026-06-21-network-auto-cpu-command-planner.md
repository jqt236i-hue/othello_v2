# Network Auto CPU Command Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make network AUTO use the same CPU decision basis as local CPU while publishing authority-safe commands until the game ends.

**Architecture:** Split CPU "decision" from CPU "execution". A new headless planner builds publishable actions (`place`, `use_card`, pending-selection `place`, `pass`) without mutating canonical state, and `ui/network/auto-play.ts` only checks network/busy/turn ownership and publishes the planned command.

**Tech Stack:** TypeScript, Jest, existing `game/cpu-decision*`, `game/turn/pending-coordinator`, `game/logic/cards-internal/pending-selection-registry`, `ui/network/auto-play.ts`, Worker command publish contract.

---

## File Structure

- Create `game/cpu-network-command-planner.ts`
  - Headless planner for network-safe CPU command actions.
  - No DOM, `window`, `NetworkMatchClient`, timers, audio, or UI state.
  - Reads injected `gameState`, `cardState`, `CardLogic`, CPU decision functions, and pending coordinator/registry.

- Modify `ui/network/auto-play.ts`
  - Remove card-specific and pending-specific command construction from UI.
  - Keep only network mode, active room, own-turn, busy, duplicate-publish guard, and `publishCommand`.

- Modify `test/ui.network-auto-play.test.ts`
  - Ensure network AUTO delegates command planning and publishes returned actions.
  - Keep guard tests for room disabled, spectator, opponent turn, busy, and duplicate tick.

- Create `test/game.cpu-network-command-planner.test.ts`
  - Unit tests for planner command output.
  - Covers move, card use, pending target selection, hand-overlay pending selection, auto pass, and wait/no-action cases.

- Optional modify `game/cpu-decision.ts`
  - Only if an existing CPU selector is not exported or cannot be injected cleanly.
  - Do not make this module depend on network or UI.

---

## Task 1: Characterization Tests for Current Network AUTO Contract

**Files:**
- Modify: `test/ui.network-auto-play.test.ts`

- [ ] **Step 1: Add a planner-injection test**

Add this test near the existing publish tests:

```ts
test('publishes the action returned by the injected CPU network planner', async () => {
  const plannedAction = {
    type: 'use_card',
    playerKey: 'black',
    useCardId: 'work_01',
    useCardOwnerKey: 'black'
  };
  const root = createRoot({
    CpuNetworkCommandPlanner: {
      planCpuNetworkCommand: jest.fn().mockReturnValue({
        action: plannedAction,
        actionType: 'use_card'
      })
    }
  });
  const controller = NetworkAutoPlay.createNetworkAutoPlayController(root);

  const result = await controller.tick();

  expect(result.handled).toBe(true);
  expect(result.published).toBe(true);
  expect(root.CpuNetworkCommandPlanner.planCpuNetworkCommand).toHaveBeenCalledWith(expect.objectContaining({
    playerKey: 'black',
    gameState: root.gameState,
    cardState: root.cardState
  }));
  expect(root.NetworkMatchClient.publishCommand).toHaveBeenCalledWith({
    playerKey: 'black',
    actionType: 'use_card',
    action: plannedAction,
    playbackEvents: []
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\ui.network-auto-play.test.ts
```

Expected: FAIL because `ui/network/auto-play.ts` does not yet call `CpuNetworkCommandPlanner.planCpuNetworkCommand`.

- [ ] **Step 3: Commit only if this is an isolated test-only checkpoint**

If the tree can be separated safely:

```powershell
git add test\ui.network-auto-play.test.ts
git commit -m "test: characterize network auto planner handoff"
```

If unrelated dirty files prevent a safe commit, leave uncommitted and report that exact reason.

---

## Task 2: Add Headless CPU Network Command Planner

**Files:**
- Create: `game/cpu-network-command-planner.ts`
- Test: `test/game.cpu-network-command-planner.test.ts`

- [ ] **Step 1: Write failing planner tests**

Create `test/game.cpu-network-command-planner.test.ts`:

```ts
const Planner = require('../game/cpu-network-command-planner');

function createInput(overrides: any = {}) {
  return Object.assign({
    playerKey: 'black',
    gameState: { currentPlayer: 1, turnNumber: 10 },
    cardState: {
      turnIndex: 10,
      hands: { black: [], white: [] },
      pendingEffectByPlayer: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false }
    },
    getLegalMoves: jest.fn().mockReturnValue([]),
    selectCpuMoveWithPolicy: jest.fn((moves: any[]) => moves[0]),
    computeCpuAction: jest.fn().mockReturnValue({ type: 'pass' }),
    CardLogic: {
      hasUsableCard: jest.fn().mockReturnValue(false)
    },
    PendingCoordinator: {
      resolvePendingSelectionActionField: jest.fn()
    },
    PendingSelectionRegistry: {
      getPendingSelectionTargetMethod: jest.fn()
    }
  }, overrides);
}

describe('CpuNetworkCommandPlanner', () => {
  test('plans a place command from legal moves', () => {
    const input = createInput({
      getLegalMoves: jest.fn().mockReturnValue([{ row: 2, col: 3 }, { row: 4, col: 5 }]),
      selectCpuMoveWithPolicy: jest.fn().mockReturnValue({ row: 4, col: 5 })
    });

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'place',
      action: { type: 'place', row: 4, col: 5 }
    });
  });

  test('plans a use_card command from CPU card decision', () => {
    const input = createInput({
      CardLogic: { hasUsableCard: jest.fn().mockReturnValue(true) },
      computeCpuAction: jest.fn().mockReturnValue({ type: 'useCard', cardId: 'work_01' })
    });

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'use_card',
      action: {
        type: 'use_card',
        playerKey: 'black',
        useCardId: 'work_01',
        useCardOwnerKey: 'black'
      }
    });
  });

  test('plans a pending target selection command from registry metadata', () => {
    const input = createInput({
      cardState: {
        turnIndex: 12,
        pendingEffectByPlayer: {
          black: {
            type: 'TIME_BOMB',
            stage: 'selectTarget',
            cardId: 'time_bomb_01',
            pendingEffectId: 'pending_12_1'
          },
          white: null
        }
      },
      CardLogic: {
        getTimeBombTargets: jest.fn().mockReturnValue([{ row: 3, col: 4 }])
      },
      PendingCoordinator: {
        resolvePendingSelectionActionField: jest.fn().mockReturnValue('bombTarget')
      },
      PendingSelectionRegistry: {
        getPendingSelectionTargetMethod: jest.fn().mockReturnValue('getTimeBombTargets')
      }
    });

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'place',
      action: {
        type: 'place',
        player: 'black',
        row: 3,
        col: 4,
        bombTarget: { row: 3, col: 4 },
        pendingSelectionState: {
          type: 'TIME_BOMB',
          stage: 'selectTarget',
          cardId: 'time_bomb_01',
          pendingEffectId: 'pending_12_1'
        },
        turnIndex: 12
      }
    });
  });

  test('plans an autoNoActionPass only when no move, card, or pending action exists', () => {
    const input = createInput();

    expect(Planner.planCpuNetworkCommand(input)).toEqual({
      actionType: 'pass',
      action: {
        type: 'pass',
        playerKey: 'black',
        autoNoActionPass: true
      }
    });
  });
});
```

- [ ] **Step 2: Run the planner tests and verify they fail**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.cpu-network-command-planner.test.ts
```

Expected: FAIL because `game/cpu-network-command-planner.ts` does not exist.

- [ ] **Step 3: Implement the planner**

Create `game/cpu-network-command-planner.ts` with these exports:

```ts
'use strict';

type PlannerInput = Record<string, any>;

function normalizePlayerKey(value: any): 'black' | 'white' {
  return String(value || '').trim().toLowerCase() === 'white' ? 'white' : 'black';
}

function createPassAction(playerKey: string) {
  return {
    actionType: 'pass',
    action: { type: 'pass', playerKey, autoNoActionPass: true }
  };
}

function createPlaceAction(move: any) {
  if (!move || !Number.isFinite(Number(move.row)) || !Number.isFinite(Number(move.col))) return null;
  return {
    actionType: 'place',
    action: {
      type: 'place',
      row: Math.trunc(Number(move.row)),
      col: Math.trunc(Number(move.col))
    }
  };
}

function readPending(cardState: any, playerKey: string) {
  const pendingByPlayer = cardState && cardState.pendingEffectByPlayer;
  const pending = pendingByPlayer && pendingByPlayer[playerKey];
  return pending && typeof pending === 'object' ? pending : null;
}

function normalizePendingType(value: any): string {
  return String(value || '').trim().toUpperCase();
}

function cloneTarget(value: any) {
  if (!value || !Number.isFinite(Number(value.row)) || !Number.isFinite(Number(value.col))) return null;
  return { row: Math.trunc(Number(value.row)), col: Math.trunc(Number(value.col)) };
}

function buildPendingSelectionState(pending: any, pendingType: string) {
  const out: any = {
    type: pendingType,
    stage: typeof pending.stage === 'string' && pending.stage ? pending.stage : 'selectTarget'
  };
  if (typeof pending.cardId === 'string' && pending.cardId) out.cardId = pending.cardId;
  if (Number.isInteger(pending.sourceHandIndex)) out.sourceHandIndex = pending.sourceHandIndex;
  if (typeof pending.pendingEffectId === 'string' && pending.pendingEffectId) out.pendingEffectId = pending.pendingEffectId;
  const firstTarget = cloneTarget(pending.firstTarget);
  if (firstTarget) out.firstTarget = firstTarget;
  if (Array.isArray(pending.selectedTargets) && pending.selectedTargets.length > 0) {
    out.selectedTargets = pending.selectedTargets.map(cloneTarget).filter(Boolean);
  }
  if (Number.isFinite(Number(pending.selectedCount))) out.selectedCount = Math.max(0, Math.trunc(Number(pending.selectedCount)));
  if (Number.isFinite(Number(pending.maxSelections))) out.maxSelections = Math.max(0, Math.trunc(Number(pending.maxSelections)));
  return out;
}

function getLegalMoves(input: PlannerInput): any[] {
  try {
    if (typeof input.getLegalMoves === 'function') {
      const moves = input.getLegalMoves(input.gameState, input.protectedStones || [], input.permaProtectedStones || [], input.cardState);
      return Array.isArray(moves) ? moves : [];
    }
  } catch (e) { /* fall through */ }
  return [];
}

function selectMove(input: PlannerInput, moves: any[], playerKey: string) {
  try {
    if (typeof input.selectCpuMoveWithPolicy === 'function') {
      const selected = input.selectCpuMoveWithPolicy(moves, playerKey);
      if (selected && Number.isFinite(Number(selected.row)) && Number.isFinite(Number(selected.col))) return selected;
    }
  } catch (e) { /* fall through */ }
  return moves[0] || null;
}

function hasUsableCard(input: PlannerInput, playerKey: string): boolean {
  try {
    const logic = input.CardLogic;
    return !!(logic && typeof logic.hasUsableCard === 'function' && logic.hasUsableCard(input.cardState, input.gameState, playerKey) === true);
  } catch (e) {
    return false;
  }
}

function resolveCardDecision(input: PlannerInput, playerKey: string) {
  try {
    if (typeof input.computeCpuAction === 'function') return input.computeCpuAction(playerKey);
  } catch (e) { /* fall through */ }
  try {
    if (typeof input.selectCardToUse === 'function') {
      const selected = input.selectCardToUse(playerKey);
      if (selected && selected.cardId) return { type: 'useCard', cardId: selected.cardId };
    }
  } catch (e) { /* fall through */ }
  return null;
}

function planCardUse(input: PlannerInput, playerKey: string) {
  if (!hasUsableCard(input, playerKey)) return null;
  const decision = resolveCardDecision(input, playerKey);
  const type = String(decision && (decision.type || decision.actionType) || '').trim();
  const cardId = String(decision && (decision.cardId || decision.useCardId) || '').trim();
  if ((type !== 'useCard' && type !== 'use_card') || !cardId) return null;
  return {
    actionType: 'use_card',
    action: {
      type: 'use_card',
      playerKey,
      useCardId: cardId,
      useCardOwnerKey: playerKey
    }
  };
}

function resolvePendingField(input: PlannerInput, pendingType: string) {
  const coordinator = input.PendingCoordinator;
  if (coordinator && typeof coordinator.resolvePendingSelectionActionField === 'function') {
    const field = coordinator.resolvePendingSelectionActionField(pendingType);
    if (typeof field === 'string' && field) return field;
  }
  const registry = input.PendingSelectionRegistry;
  if (registry && typeof registry.getPendingSelectionActionConfig === 'function') {
    const config = registry.getPendingSelectionActionConfig(pendingType);
    if (config && typeof config.field === 'string' && config.field) return config.field;
  }
  return null;
}

function resolvePendingTargetMethod(input: PlannerInput, pendingType: string) {
  const registry = input.PendingSelectionRegistry;
  if (registry && typeof registry.getPendingSelectionTargetMethod === 'function') {
    const method = registry.getPendingSelectionTargetMethod(pendingType);
    if (typeof method === 'string' && method) return method;
  }
  return null;
}

function collectPendingTargets(input: PlannerInput, playerKey: string, pending: any, pendingType: string) {
  const logic = input.CardLogic;
  const method = resolvePendingTargetMethod(input, pendingType);
  if (logic && method && typeof logic[method] === 'function') {
    const attempts = [
      () => logic[method](input.cardState, input.gameState, playerKey, pending),
      () => logic[method](input.cardState, input.gameState, playerKey),
      () => logic[method](input.cardState, input.gameState)
    ];
    for (const attempt of attempts) {
      try {
        const targets = attempt();
        if (Array.isArray(targets)) return targets;
      } catch (e) { /* try next */ }
    }
  }
  if (logic && typeof logic.getSelectableTargets === 'function') {
    try {
      const targets = logic.getSelectableTargets(input.cardState, input.gameState, playerKey);
      return Array.isArray(targets) ? targets : [];
    } catch (e) { /* fall through */ }
  }
  return [];
}

function planHandOverlayPending(input: PlannerInput, playerKey: string, pending: any, pendingType: string) {
  const offers = Array.isArray(pending.offers) ? pending.offers.slice() : [];
  if (!offers.length) return null;
  const action: any = {
    type: 'place',
    player: playerKey,
    pendingSelectionState: buildPendingSelectionState(pending, pendingType)
  };
  if (pendingType === 'HEAVEN_BLESSING') {
    const cardId = typeof offers[0] === 'string' ? offers[0] : offers[0] && offers[0].cardId;
    if (!cardId) return null;
    action.heavenBlessingCardId = String(cardId);
  } else if (pendingType === 'CONDEMN_WILL') {
    const offer = offers.find((item: any) => item && Number.isInteger(item.handIndex)) || offers[0];
    if (!offer || !Number.isInteger(offer.handIndex)) return null;
    action.condemnTargetIndex = offer.handIndex;
  } else if (pendingType === 'OBSERVER_WILL') {
    const offer = offers.find((item: any) => item && Number.isInteger(item.handIndex)) || offers[0];
    if (!offer || !Number.isInteger(offer.handIndex)) return null;
    action.observerWillTargetIndex = offer.handIndex;
  } else {
    return null;
  }
  if (Number.isFinite(Number(input.cardState && input.cardState.turnIndex))) action.turnIndex = Math.trunc(Number(input.cardState.turnIndex));
  return { actionType: 'place', action };
}

function planPendingSelection(input: PlannerInput, playerKey: string) {
  const pending = readPending(input.cardState, playerKey);
  const pendingType = normalizePendingType(pending && pending.type);
  if (!pending || !pendingType || pending.stage !== 'selectTarget') return null;
  const overlay = planHandOverlayPending(input, playerKey, pending, pendingType);
  if (overlay) return overlay;
  const field = resolvePendingField(input, pendingType);
  if (!field) return null;
  const target = cloneTarget(collectPendingTargets(input, playerKey, pending, pendingType)[0]);
  if (!target) return null;
  const action: any = {
    type: 'place',
    player: playerKey,
    row: target.row,
    col: target.col,
    pendingSelectionState: buildPendingSelectionState(pending, pendingType)
  };
  action[field] = target;
  if (Number.isFinite(Number(input.cardState && input.cardState.turnIndex))) action.turnIndex = Math.trunc(Number(input.cardState.turnIndex));
  return { actionType: 'place', action };
}

function planCpuNetworkCommand(inputValue: PlannerInput) {
  const input = inputValue && typeof inputValue === 'object' ? inputValue : {};
  const playerKey = normalizePlayerKey(input.playerKey);
  const pending = planPendingSelection(input, playerKey);
  if (pending) return pending;
  const moves = getLegalMoves(input);
  if (moves.length > 0) return createPlaceAction(selectMove(input, moves, playerKey));
  const card = planCardUse(input, playerKey);
  if (card) return card;
  return createPassAction(playerKey);
}

export = {
  planCpuNetworkCommand
};
```

- [ ] **Step 4: Run planner tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.cpu-network-command-planner.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add game\cpu-network-command-planner.ts test\game.cpu-network-command-planner.test.ts
git commit -m "feat: add CPU network command planner"
```

---

## Task 3: Thin `ui/network/auto-play.ts`

**Files:**
- Modify: `ui/network/auto-play.ts`
- Modify: `test/ui.network-auto-play.test.ts`

- [ ] **Step 1: Replace local command construction with planner call**

In `ui/network/auto-play.ts`, add planner resolution:

```ts
let cpuNetworkCommandPlannerModule: any = null;

function resolveCpuNetworkCommandPlanner(root: NetworkAutoRoot): any | null {
  if (root && root.CpuNetworkCommandPlanner && typeof root.CpuNetworkCommandPlanner.planCpuNetworkCommand === 'function') {
    return root.CpuNetworkCommandPlanner;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).CpuNetworkCommandPlanner) {
    return (globalThis as any).CpuNetworkCommandPlanner;
  }
  if (!cpuNetworkCommandPlannerModule) {
    cpuNetworkCommandPlannerModule = safeRequire('../../game/cpu-network-command-planner')
      || safeRequire('../game/cpu-network-command-planner');
  }
  return cpuNetworkCommandPlannerModule;
}
```

Then replace the move/card/pending action construction block with:

```ts
const planner = resolveCpuNetworkCommandPlanner(root);
if (!planner || typeof planner.planCpuNetworkCommand !== 'function') {
  return { handled: true, reason: 'PLANNER_UNAVAILABLE' };
}
const planned = planner.planCpuNetworkCommand({
  playerKey: seatKey,
  gameState: state,
  cardState: root && root.cardState ? root.cardState : null,
  protectedStones: root && root.protectedStones ? root.protectedStones : [],
  permaProtectedStones: root && root.permaProtectedStones ? root.permaProtectedStones : [],
  getLegalMoves: root && root.getLegalMoves,
  selectCpuMoveWithPolicy: root && root.selectCpuMoveWithPolicy,
  computeCpuAction: root && root.computeCpuAction,
  selectCardToUse: root && root.selectCardToUse,
  CardLogic: root && root.CardLogic,
  PendingCoordinator: root && root.PendingCoordinator,
  PendingSelectionRegistry: root && root.PendingSelectionRegistry
});
const action = planned && planned.action;
const actionType = planned && planned.actionType ? String(planned.actionType) : resolvePublishActionType(action);
if (!action) return { handled: true, reason: 'NO_ACTION_SELECTED' };
```

- [ ] **Step 2: Delete duplicated UI helper logic**

Remove from `ui/network/auto-play.ts` any helper that is now owned by `game/cpu-network-command-planner.ts`, including:

```ts
readPendingAction
resolvePendingCoordinator
resolvePendingSelectionRegistry
resolveCardLogic
resolveCpuAction
createCardUseAction
resolvePendingActionField
resolvePendingTargetMethod
callTargetMethod
collectPendingTargets
buildPendingSelectionState
createHandOverlayPendingAction
createPendingSelectionAction
createPlaceAction
createAutoNoActionPass
getLegalMoves
selectMove
hasPendingAction
hasUsableCard
```

Keep only helpers needed by network AUTO itself:

```ts
normalizePlayerKey
playerValueToKey
isNetworkModeActive
isBusy
safeRequire
resolvePublishActionType
resolveCpuNetworkCommandPlanner
```

- [ ] **Step 3: Update UI tests**

Keep the existing guard tests, but make action planning come from injected planner. For the basic publish test:

```ts
const root = createRoot({
  CpuNetworkCommandPlanner: {
    planCpuNetworkCommand: jest.fn().mockReturnValue({
      actionType: 'place',
      action: { type: 'place', row: 4, col: 5 }
    })
  }
});
```

Assert:

```ts
expect(root.NetworkMatchClient.publishCommand).toHaveBeenCalledWith({
  playerKey: 'black',
  actionType: 'place',
  action: { type: 'place', row: 4, col: 5 },
  playbackEvents: []
});
```

- [ ] **Step 4: Run UI tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\ui.network-auto-play.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add ui\network\auto-play.ts test\ui.network-auto-play.test.ts
git commit -m "refactor: route network auto through CPU planner"
```

---

## Task 4: Planner Coverage for Pending Edge Cases

**Files:**
- Modify: `test/game.cpu-network-command-planner.test.ts`

- [ ] **Step 1: Add hand-overlay pending tests**

Add:

```ts
test('plans heaven blessing hand-overlay selection', () => {
  const input = createInput({
    cardState: {
      turnIndex: 13,
      pendingEffectByPlayer: {
        black: {
          type: 'HEAVEN_BLESSING',
          stage: 'selectTarget',
          cardId: 'heaven_01',
          pendingEffectId: 'pending_13_1',
          offers: ['gold_stone']
        },
        white: null
      }
    }
  });

  expect(Planner.planCpuNetworkCommand(input)).toEqual({
    actionType: 'place',
    action: {
      type: 'place',
      player: 'black',
      heavenBlessingCardId: 'gold_stone',
      pendingSelectionState: {
        type: 'HEAVEN_BLESSING',
        stage: 'selectTarget',
        cardId: 'heaven_01',
        pendingEffectId: 'pending_13_1'
      },
      turnIndex: 13
    }
  });
});
```

- [ ] **Step 2: Add multi-stage pending metadata preservation test**

Add:

```ts
test('preserves multi-stage pending selection transport state', () => {
  const input = createInput({
    cardState: {
      turnIndex: 14,
      pendingEffectByPlayer: {
        black: {
          type: 'BOARD_SHRINK_WILL',
          stage: 'selectTarget',
          cardId: 'board_shrink_01',
          pendingEffectId: 'pending_14_1',
          selectedTargets: [{ row: 1, col: 1 }],
          selectedCount: 1,
          maxSelections: 3
        },
        white: null
      }
    },
    CardLogic: {
      getBoardShrinkTargets: jest.fn().mockReturnValue([{ row: 2, col: 2 }])
    },
    PendingCoordinator: {
      resolvePendingSelectionActionField: jest.fn().mockReturnValue('shrinkTarget')
    },
    PendingSelectionRegistry: {
      getPendingSelectionTargetMethod: jest.fn().mockReturnValue('getBoardShrinkTargets')
    }
  });

  expect(Planner.planCpuNetworkCommand(input)).toEqual({
    actionType: 'place',
    action: {
      type: 'place',
      player: 'black',
      row: 2,
      col: 2,
      shrinkTarget: { row: 2, col: 2 },
      pendingSelectionState: {
        type: 'BOARD_SHRINK_WILL',
        stage: 'selectTarget',
        cardId: 'board_shrink_01',
        pendingEffectId: 'pending_14_1',
        selectedTargets: [{ row: 1, col: 1 }],
        selectedCount: 1,
        maxSelections: 3
      },
      turnIndex: 14
    }
  });
});
```

- [ ] **Step 3: Run planner tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.cpu-network-command-planner.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add test\game.cpu-network-command-planner.test.ts
git commit -m "test: cover network auto pending planner cases"
```

---

## Task 5: Authority Contract Verification

**Files:**
- No source changes expected unless tests expose a real mismatch.

- [ ] **Step 1: Run command publish contract tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\workers.match-pending-effect-id.test.ts test\workers.match-publish-sanitize.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run network auto and planner tests together**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.cpu-network-command-planner.test.ts test\ui.network-auto-play.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript build**

Run:

```powershell
npm run build:ts
```

Expected: PASS.

- [ ] **Step 4: Commit if verification-only generated no source diff**

No commit is needed if no files changed. If test fixes were required, commit only those intentional files:

```powershell
git add <intentional-files>
git commit -m "fix: align CPU planner with authority command contract"
```

---

## Task 6: Browser Bundle and Deploy Preparation

**Files:**
- Generated: `public/module-registry.js`
- Generated/mirror: `worker-public/*` if `npm run worker:prepare` updates it

- [ ] **Step 1: Regenerate browser/worker surfaces**

Run:

```powershell
npm run worker:prepare
```

Expected: command completes without errors and generated files include updated `ui/network/auto-play` and new planner module.

- [ ] **Step 2: Inspect generated diff**

Run:

```powershell
git status --short public\module-registry.js worker-public
git diff -- public\module-registry.js
```

Expected: generated diff reflects source changes only. Do not hand-edit generated output.

- [ ] **Step 3: Run smoke tests after regeneration**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.cpu-network-command-planner.test.ts test\ui.network-auto-play.test.ts
npm run build:ts
```

Expected: PASS.

- [ ] **Step 4: Commit generated surfaces if intentionally part of release**

```powershell
git add public\module-registry.js worker-public
git commit -m "build: refresh network auto deployment assets"
```

If unrelated generated or asset diffs are present, stop and report the exact files instead of committing.

---

## Task 7: Live Debug Validation

**Files:**
- No source changes expected.

- [ ] **Step 1: Deploy after source and generated assets are coherent**

Use the repository's existing Cloudflare deployment process. If using Wrangler, load the repository's deployment instructions first and run the existing npm script or documented command, not an ad-hoc Worker upload.

- [ ] **Step 2: Run two-session AUTO test**

Use Chrome and Edge with the public URL. Create a network room, join from the other browser, enable AUTO on both sides, and use a deck containing normal cards plus pending cards:

```text
work_01.time_bomb_01.heaven_01.board_shrink_01.teleport_01.escape_01
```

Expected:
- Both clients advance turns without manual input.
- Legal stone placement is published when available.
- When no legal placement exists and a card is usable, `use_card` is published.
- If the card opens pending target selection, the next AUTO tick publishes the pending selection.
- Game reaches game over or a known safety limit without `USABLE_CARD_AVAILABLE` or `PENDING_ACTION_AVAILABLE` permanent stall.

- [ ] **Step 3: Record evidence**

Save:
- room id
- public URL
- browser versions
- final stateVersion
- publish count per client
- console errors
- whether gameOver was reached

- [ ] **Step 4: Fix only confirmed issues**

If live validation fails, classify the failure:

```text
planner output wrong
publish payload rejected by authority
client busy/playback lock prevents tick
server snapshot/pending state mismatch
deployment did not include generated source
```

Then add a focused failing test before changing source.

---

## Self-Review

- Spec coverage: The plan separates CPU decision from network publish, removes card/pending construction from UI, preserves authority-only canonical execution, and verifies Worker publish contracts.
- Placeholder scan: No task relies on "TBD" or unspecified test work. Each task includes exact files, commands, and expected results.
- Type consistency: The main public API is consistently `planCpuNetworkCommand(input) => { actionType, action }`. Network AUTO publishes that exact pair.
- Known residual risk: The initial planner mirrors current pending action construction. A later refinement can reuse more of `PendingCoordinator.createPendingSelectionAction`, but only after proving it does not introduce UI/global dependencies or mutate state.


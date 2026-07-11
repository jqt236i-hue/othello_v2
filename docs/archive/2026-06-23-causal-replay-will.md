# Causal Replay Will Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 因果再生 (`causal_replay_01`, `CAUSAL_REPLAY_WILL`) as a cost 12 card that can only be used when at least one hole cell exists, lets the player select one hole cell, and restores it as an empty normal cell with a dedicated sound.

**Architecture:** Implement 因果再生 as a new pending target-selection card type, not as a variant of 因果抹消. One selector, `getCausalReplayTargets`, is the single source for use availability, target highlighting, CPU target choice, and final validation. The headless effect removes only the `METEOR_HOLE` marker and emits a `STATUS_REMOVED` presentation event; it does not restore stones, special effects, bonus numbers, or any previous cell history.

**Tech Stack:** TypeScript/CommonJS browser modules, Jest, existing card catalog generation, existing pending-selection bridge, existing playback sound-cue assembler, Cloudflare Worker mirror via `npm run worker:prepare`.

---

## Current Constraints

- The current checkout is heavily dirty. Before execution, run `git status --short` and do not start implementation unless the 因果再生 diff can be isolated from existing work.
- Root files are source of truth. Do not hand-edit `cards/catalog.js`, `cards/catalog.ts`, `cards/catalog.generated.js`, `public/module-registry.js`, or `worker-public/*`; generate/mirror them through scripts.
- The sound file already exists at `assets/audio/sound-effect/因果再生で穴マスを通常マスに再生するタイミング.mp3`.

## File Structure

- Modify: `01-rulebook.md`  
  Add the player-visible spec, usage condition, restoration semantics, UI/sound timing, and CPU note.
- Modify: `cards/catalog.json`  
  Add source catalog entry for `causal_replay_01`.
- Generated: `cards/catalog.js`, `cards/catalog.ts`, `cards/catalog.generated.js`  
  Produced by `npm run generate:catalog`.
- Modify: `cards/card-interaction-effects.ts`  
  Add quick/detail text and effect tags for `CAUSAL_REPLAY_WILL`.
- Modify: `cards/card-interaction-detail-actions.ts`  
  Add pending prompt text for `CAUSAL_REPLAY_WILL`.
- Modify: `game/logic/cards/selectors.ts`  
  Add `getCausalReplayTargets`.
- Modify: `game/logic/cards-internal/target-access.ts`  
  Route `getCausalReplayTargets` from card logic through the shared target access layer.
- Modify: `game/logic/cards-internal/pending-selection-registry.ts`  
  Add pending contract, dispatch key, target method, action field, and CPU handler name.
- Create: `game/logic/cards/causal_replay.ts`  
  Headless card effect: validate pending, remove `METEOR_HOLE`, emit `STATUS_REMOVED`, clear pending.
- Modify: `game/logic/cards.ts`  
  Wire selector, effect module, effect-resolver context, and public API export.
- Modify: `game/cards/effect-resolver.ts`  
  Include `getCausalReplayTargets` in usage precheck context so no-hole state blocks card use before pending selection.
- Create: `game/card-effects/causal-replay.ts` and generated wrapper `game/card-effects/causal-replay.js` if local pattern requires a wrapper.  
  Browser pending-selection bridge for clicks and deferred network publish.
- Modify: `game/turn/action-phase/pre-placement-selection.ts`  
  Apply the selected target during the turn pipeline and emit `causal_replay_selected`.
- Modify: `ui/bootstrap.ts`  
  Add `causal_replay -> handleCausalReplaySelection` dispatch mapping.
- Modify: `index.html`, `entry-browser.js`, `scripts/build-module-registry.ts` only if the new `game/card-effects/causal-replay.ts` is browser-loaded through the classic script/module registry path. Use the existing module generation/build commands where possible.
- Modify: `game/cpu-decision-pending-actions.ts`, `game/cpu-decision-pending-score.ts`, `game/cpu-decision.ts`, `game/cpu-turn-handler.ts`  
  Add CPU pending target selection and scoring.
- Modify: `sound-engine.ts`  
  Register `causal_replay_restore`.
- Modify: `game/turn/pipeline-ui/selection-sound-cues.ts` or `game/turn/pipeline-ui/sound-cues.ts`  
  Add the sound cue on successful hole restoration.
- Tests: add focused Jest tests listed in tasks below.

---

### Task 0: Preflight Dirty-Tree Gate

**Files:**
- Inspect only.

- [ ] **Step 1: Check the working tree**

Run:

```powershell
git status --short
```

Expected: If unrelated dirty files remain, classify them before editing. If 因果再生 changes cannot be separated cleanly, stop and ask the user how to proceed.

- [ ] **Step 2: Confirm the source audio exists**

Run:

```powershell
Test-Path -LiteralPath 'C:\Users\quarr\Desktop\othello_v2\assets\audio\sound-effect\因果再生で穴マスを通常マスに再生するタイミング.mp3'
```

Expected: `True`.

---

### Task 1: Player-Facing Spec And Catalog

**Files:**
- Modify: `01-rulebook.md`
- Modify: `cards/catalog.json`
- Modify: `cards/card-interaction-effects.ts`
- Modify: `cards/card-interaction-detail-actions.ts`
- Test: `test/cards.causal-replay-surfaces.test.ts`

- [ ] **Step 1: Add a failing surface test**

Create `test/cards.causal-replay-surfaces.test.ts`:

```ts
const catalog = require('../cards/catalog.json');
const CardInteractionEffects = require('../cards/card-interaction-effects.ts');
const DetailActions = require('../cards/card-interaction-detail-actions.ts');

describe('CAUSAL_REPLAY_WILL surfaces', () => {
  test('catalog defines 因果再生 with cost 12 and target usage text', () => {
    const card = catalog.cards.find((one: any) => one && one.id === 'causal_replay_01');
    expect(card).toEqual(expect.objectContaining({
      id: 'causal_replay_01',
      name_ja: '因果再生',
      type: 'CAUSAL_REPLAY_WILL',
      cost: 12,
      display_type_ja: '禁忌'
    }));
    expect(card.desc_ja).toBe('盤面に穴マスがある時のみ使用可能。穴マスを1つ選び、空の通常マスとして再生する。');
  });

  test('quick/detail text and prompt explain hole-only restoration', () => {
    expect(CardInteractionEffects.getQuickCardEffect({ type: 'CAUSAL_REPLAY_WILL' }))
      .toBe('盤面に穴マスがある時のみ使用可能。穴マスを1つ選び、空の通常マスとして再生する。');
    expect(CardInteractionEffects.getDistinctCardDetailText({ type: 'CAUSAL_REPLAY_WILL' }))
      .toContain('石・特殊石・数字マスなど、穴化前の状態は戻らない。');
    expect(DetailActions.resolvePendingSelectionPromptText({
      type: 'CAUSAL_REPLAY_WILL',
      stage: 'selectTarget'
    })).toBe('再生する穴マスを選んでください');
  });

  test('effect tags include hole-cell but not erasure', () => {
    const labels = CardInteractionEffects.getCardEffectTags({ type: 'CAUSAL_REPLAY_WILL' })
      .map((tag: any) => tag && tag.label);
    expect(labels).toContain('穴マス');
    expect(labels).not.toContain('抹消');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/cards.causal-replay-surfaces.test.ts
```

Expected: FAIL because the catalog entry and UI text do not exist yet.

- [ ] **Step 3: Update `01-rulebook.md`**

Add this section near `METEOR_WILL（因果抹消）`:

```md
### CAUSAL_REPLAY_WILL（因果再生）

- コスト: 12
- 使用条件: 盤面に穴マス（`METEOR_HOLE`）が1つ以上存在する場合のみ使用可能
- 穴マスを1つ選び、そのマスを空の通常マスとして再生する
- 再生したマスに石・特殊石・数字マスなど、穴化前の状態は戻らない
- 対象が穴マスでなくなっている場合は不発となり、選択待ちは解除しない
- UI表示: 選択中は穴マスのみを対象候補として表示する
- 効果音: 穴マスが通常マスとして再生されるタイミングで `causal_replay_restore` を再生する
```

Update the sound section near the existing `meteor_hole` note:

```md
- 因果再生の音は、穴マスが空の通常マスとして再生されるタイミングで専用音 `causal_replay_restore` を再生する
```

- [ ] **Step 4: Add the source catalog entry**

Add this card object to `cards/catalog.json` near the 因果抹消/盤面縮小 group:

```json
{
  "id": "causal_replay_01",
  "name_ja": "因果再生",
  "type": "CAUSAL_REPLAY_WILL",
  "cost": 12,
  "desc_ja": "盤面に穴マスがある時のみ使用可能。穴マスを1つ選び、空の通常マスとして再生する。",
  "display_type_ja": "禁忌"
}
```

- [ ] **Step 5: Add card text and prompt**

In `cards/card-interaction-effects.ts`, add:

```ts
CAUSAL_REPLAY_WILL: '盤面に穴マスがある時のみ使用可能。穴マスを1つ選び、空の通常マスとして再生する。',
```

to the quick text map, and add:

```ts
CAUSAL_REPLAY_WILL: '盤面に穴マスが1つ以上存在する場合のみ使用可能。\n穴マスを1つ選び、空の通常マスとして再生する。\n石・特殊石・数字マスなど、穴化前の状態は戻らない。',
```

to the detail text map. Add the tag:

```ts
CAUSAL_REPLAY_WILL: freezeCardEffectTags([holeCellTag()]),
```

In `cards/card-interaction-detail-actions.ts`, add:

```ts
CAUSAL_REPLAY_WILL: '再生する穴マスを選んでください',
```

- [ ] **Step 6: Generate catalog projections**

Run:

```powershell
npm run generate:catalog
```

Expected: `cards/catalog.js`, `cards/catalog.ts`, and `cards/catalog.generated.js` update from `cards/catalog.json`.

- [ ] **Step 7: Run the surface test**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/cards.causal-replay-surfaces.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the spec/catalog unit**

Stage only intended files:

```powershell
git add 01-rulebook.md cards/catalog.json cards/catalog.js cards/catalog.ts cards/catalog.generated.js cards/card-interaction-effects.ts cards/card-interaction-detail-actions.ts test/cards.causal-replay-surfaces.test.ts
git commit -m "Add causal replay card surfaces"
```

---

### Task 2: Target Selection And Use-Availability Gate

**Files:**
- Modify: `game/logic/cards/selectors.ts`
- Modify: `game/logic/cards-internal/target-access.ts`
- Modify: `game/logic/cards-internal/pending-selection-registry.ts`
- Modify: `game/logic/cards.ts`
- Modify: `game/cards/effect-resolver.ts`
- Test: `test/game.causal-replay-targets.test.ts`
- Test: `test/game.cards.pending-state-manager-module.test.ts`

- [ ] **Step 1: Add failing selector and usage-precheck tests**

Create `test/game.causal-replay-targets.test.ts`:

```ts
const CardLogic = require('../game/logic/cards.ts');
const EffectResolver = require('../game/cards/effect-resolver.ts');

function createGameState() {
  return {
    board: Array.from({ length: 8 }, () => Array(8).fill(0)),
    currentPlayer: 'black'
  };
}

describe('CAUSAL_REPLAY_WILL target availability', () => {
  test('getCausalReplayTargets returns only METEOR_HOLE cells', () => {
    const cardState: any = {
      markers: [
        { kind: 'specialStone', row: 2, col: 3, owner: 'white', data: { type: 'METEOR_HOLE' } },
        { kind: 'specialStone', row: 4, col: 4, owner: 'black', data: { type: 'BLOCKADE' } }
      ]
    };
    expect(CardLogic.getCausalReplayTargets(cardState, createGameState(), 'black'))
      .toEqual([{ row: 2, col: 3 }]);
  });

  test('card use is rejected when no holes exist', () => {
    const cardState: any = {
      hands: { black: ['causal_replay_01'], white: [] },
      charge: { black: 12, white: 0 },
      pendingEffectByPlayer: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      lastUsedCardByPlayer: {},
      markers: []
    };
    const used = EffectResolver.useCard(cardState, createGameState(), 'black', 'causal_replay_01', {
      noConsume: true
    }, {
      getCardCost: () => 12,
      getCardType: () => 'CAUSAL_REPLAY_WILL',
      getCardDef: () => ({ id: 'causal_replay_01', type: 'CAUSAL_REPLAY_WILL', cost: 12 }),
      getCausalReplayTargets: CardLogic.getCausalReplayTargets
    });
    expect(used).toBe(false);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });
});
```

Extend `test/game.cards.pending-state-manager-module.test.ts`:

```ts
expect(PendingStateManager.requiresTargetSelection('CAUSAL_REPLAY_WILL')).toBe(true);
expect(PendingStateManager.resolvePendingSelectionDispatchKey('CAUSAL_REPLAY_WILL')).toBe('causal_replay');
```

- [ ] **Step 2: Run the failing tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.causal-replay-targets.test.ts test/game.cards.pending-state-manager-module.test.ts
```

Expected: FAIL because `CAUSAL_REPLAY_WILL` is not registered and `getCausalReplayTargets` does not exist.

- [ ] **Step 3: Add pending registry entry**

In `game/logic/cards-internal/pending-selection-registry.ts`, add:

```ts
CAUSAL_REPLAY_WILL: {
    kind: 'continue_turn',
    turnOutcome: 'continue_turn',
    deferNetworkPublish: true,
    waitForPlaybackIdle: true,
    needsTargetSelection: true,
    cancellable: true,
    dispatchKey: 'causal_replay',
    target: { method: 'getCausalReplayTargets', argsKey: 'player' },
    action: { policyMethod: 'chooseCausalReplayTarget', field: 'causalReplayTarget' },
    cpuHandlerNames: ['cpuSelectCausalReplayWillWithPolicy']
},
```

- [ ] **Step 4: Add selector**

In `game/logic/cards/selectors.ts`, add:

```ts
function getCausalReplayTargets(cardState: CardState, gameState: GameState): TargetCell[] {
    const gs = gameState as any;
    if (!gs || !gs.board) return [];
    const res: TargetCell[] = [];
    const seen = new Set<string>();
    const cs = cardState as any;
    const markers = (cs && Array.isArray(cs.markers)) ? cs.markers : [];
    for (const marker of markers) {
        if (!marker || !Number.isInteger(marker.row) || !Number.isInteger(marker.col)) continue;
        if (!marker.data || String(marker.data.type || '').toUpperCase() !== 'METEOR_HOLE') continue;
        const key = `${marker.row},${marker.col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        res.push({ row: marker.row, col: marker.col });
    }
    return res.sort((a, b) => (a.row - b.row) || (a.col - b.col));
}
```

Export it in the module export object.

- [ ] **Step 5: Route through target access and card logic**

In `game/logic/cards-internal/target-access.ts`, add:

```ts
function getCausalReplayTargets(cardState: any, gameState: any, playerKey: any, deps: TargetAccessDeps) {
    return resolveTargetResolverTargets('getCausalReplayTargets', [cardState, gameState, playerKey], deps);
}
```

Add it to the export object.

In `game/logic/cards.ts`, add a wrapper:

```ts
function getCausalReplayTargets(cardState: any, gameState: any, playerKey: any) {
    return CardTargetAccessModule.getCausalReplayTargets(cardState, gameState, playerKey, getCardTargetAccessDeps());
}
```

Add it to all helper/context/export lists that currently include `getMeteorTargets`, including the `effect-resolver` precheck helper list.

In `game/cards/effect-resolver.ts`, add `getCausalReplayTargets` to the dependency type and to the `validateCardUsagePreconditions` context next to `getMeteorTargets`.

- [ ] **Step 6: Run target/precheck tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.causal-replay-targets.test.ts test/game.cards.pending-state-manager-module.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit target gate unit**

```powershell
git add game/logic/cards/selectors.ts game/logic/cards-internal/target-access.ts game/logic/cards-internal/pending-selection-registry.ts game/logic/cards.ts game/cards/effect-resolver.ts test/game.causal-replay-targets.test.ts test/game.cards.pending-state-manager-module.test.ts
git commit -m "Add causal replay target gate"
```

---

### Task 3: Headless Effect And Turn Pipeline

**Files:**
- Create: `game/logic/cards/causal_replay.ts`
- Modify: `game/logic/cards.ts`
- Modify: `game/turn/action-phase/pre-placement-selection.ts`
- Test: `test/game.logic.causal-replay-module.test.ts`
- Test: `test/game.causal-replay-will.test.ts`

- [ ] **Step 1: Add failing headless module tests**

Create `test/game.logic.causal-replay-module.test.ts`:

```ts
import * as CardCausalReplay from '../game/logic/cards/causal_replay.js';

describe('CardCausalReplay module', () => {
  test('applyCausalReplayWill removes one METEOR_HOLE and emits STATUS_REMOVED', () => {
    const cardState: any = {
      pendingEffectByPlayer: { black: { type: 'CAUSAL_REPLAY_WILL', stage: 'selectTarget', cardId: 'causal_replay_01' } },
      markers: [
        { kind: 'specialStone', row: 2, col: 3, owner: 'white', data: { type: 'METEOR_HOLE', visualVariant: 'BOARD_FRAME' } }
      ],
      presentationEvents: []
    };
    const gameState: any = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
    const removeMarkersAt = jest.fn((cs, row, col, options) => {
      cs.markers = cs.markers.filter((m: any) => !(m.row === row && m.col === col && m.data.type === options.type));
    });
    const emitPresentationEvent = jest.fn((cs, ev) => {
      cs.presentationEvents.push(ev);
      return true;
    });

    const result = CardCausalReplay.applyCausalReplayWill(cardState, gameState, 'black', 2, 3, {
      getCausalReplayTargets: () => [{ row: 2, col: 3 }],
      removeMarkersAt,
      emitPresentationEvent,
      clearCardPendingEffect: (cs: any, player: string) => { cs.pendingEffectByPlayer[player] = null; },
      setCellValueForCard: (gs: any, row: number, col: number, value: number) => { gs.board[row][col] = value; return true; },
      emptyValue: 0,
      MARKER_KINDS: { SPECIAL_STONE: 'specialStone' }
    });

    expect(result).toEqual({ applied: true, row: 2, col: 3 });
    expect(cardState.markers).toEqual([]);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(emitPresentationEvent).toHaveBeenCalledWith(cardState, expect.objectContaining({
      type: 'STATUS_REMOVED',
      row: 2,
      col: 3,
      cause: 'CAUSAL_REPLAY_WILL',
      reason: 'causal_replay_selected',
      meta: expect.objectContaining({
        special: 'METEOR_HOLE',
        cellRestorationCause: 'CAUSAL_REPLAY_WILL',
        restoredAs: 'normal_empty_cell'
      })
    }));
  });

  test('invalid non-hole target keeps pending selection', () => {
    const cardState: any = {
      pendingEffectByPlayer: { white: { type: 'CAUSAL_REPLAY_WILL', stage: 'selectTarget' } },
      markers: []
    };
    const result = CardCausalReplay.applyCausalReplayWill(cardState, {}, 'white', 1, 1, {
      getCausalReplayTargets: () => [],
      removeMarkersAt: jest.fn(),
      clearCardPendingEffect: jest.fn()
    });
    expect(result).toEqual({ applied: false, reason: 'invalid_target', row: 1, col: 1 });
    expect(cardState.pendingEffectByPlayer.white).toMatchObject({ type: 'CAUSAL_REPLAY_WILL' });
  });
});
```

- [ ] **Step 2: Add failing pipeline test**

Create `test/game.causal-replay-will.test.ts`:

```ts
const PrePlacementSelection = require('../game/turn/action-phase/pre-placement-selection.ts');

describe('CAUSAL_REPLAY_WILL pipeline selection', () => {
  test('causalReplayTarget calls CardLogic.applyCausalReplayWill and emits raw event', () => {
    const events: any[] = [];
    const cardState = { pendingEffectByPlayer: { black: { type: 'CAUSAL_REPLAY_WILL', stage: 'selectTarget' } } };
    const result = PrePlacementSelection.resolvePrePlacementSelectionAction({
      cardState,
      gameState: {},
      playerKey: 'black',
      action: { type: 'place', causalReplayTarget: { row: 2, col: 3 } },
      events,
      CardLogic: {
        applyCausalReplayWill: jest.fn(() => ({ applied: true, row: 2, col: 3 }))
      }
    });
    expect(result).toBe(true);
    expect(events).toEqual([{
      type: 'causal_replay_selected',
      player: 'black',
      target: { row: 2, col: 3 },
      applied: true
    }]);
  });
});
```

- [ ] **Step 3: Run failing tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.logic.causal-replay-module.test.ts test/game.causal-replay-will.test.ts
```

Expected: FAIL because the module and pipeline branch do not exist.

- [ ] **Step 4: Implement `game/logic/cards/causal_replay.ts`**

Create:

```ts
import { CardState, GameState } from '../../../src/types';

interface CausalReplayDeps {
    getCausalReplayTargets?(cardState: CardState, gameState: GameState, playerKey: string): Array<{ row: number; col: number }>;
    removeMarkersAt?(cardState: CardState, row: number, col: number, options?: any): void;
    emitPresentationEvent?(cardState: CardState, event: any): any;
    clearCardPendingEffect?(cardState: CardState, playerKey: string, options?: any): any;
    setCellValueForCard?(gameState: GameState, row: number, col: number, value: number): boolean;
    emptyValue?: number;
    MARKER_KINDS?: { SPECIAL_STONE?: string };
}

function applyCausalReplayWill(
    cardState: CardState,
    gameState: GameState,
    playerKey: string,
    row: number,
    col: number,
    deps: CausalReplayDeps = {}
): any {
    const cs = cardState as any;
    const pending = cs && cs.pendingEffectByPlayer ? cs.pendingEffectByPlayer[playerKey] : null;
    if (!pending || pending.type !== 'CAUSAL_REPLAY_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }

    const targets = typeof deps.getCausalReplayTargets === 'function'
        ? deps.getCausalReplayTargets(cardState, gameState, playerKey)
        : [];
    const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
    if (!allowed) return { applied: false, reason: 'invalid_target', row, col };
    if (typeof deps.removeMarkersAt !== 'function' || typeof deps.clearCardPendingEffect !== 'function') {
        return { applied: false, reason: 'deps_missing', row, col };
    }

    const emptyValue = Number.isFinite(Number(deps.emptyValue)) ? Number(deps.emptyValue) : 0;
    if (typeof deps.setCellValueForCard === 'function') {
        deps.setCellValueForCard(gameState, row, col, emptyValue);
    }

    deps.removeMarkersAt(cardState, row, col, {
        kind: deps.MARKER_KINDS && deps.MARKER_KINDS.SPECIAL_STONE ? deps.MARKER_KINDS.SPECIAL_STONE : 'specialStone',
        type: 'METEOR_HOLE'
    });

    if (typeof deps.emitPresentationEvent === 'function') {
        deps.emitPresentationEvent(cardState, {
            type: 'STATUS_REMOVED',
            row,
            col,
            cause: 'CAUSAL_REPLAY_WILL',
            reason: 'causal_replay_selected',
            meta: {
                special: 'METEOR_HOLE',
                owner: playerKey,
                timer: null,
                cellRestorationCause: 'CAUSAL_REPLAY_WILL',
                restoredAs: 'normal_empty_cell'
            }
        });
    }

    deps.clearCardPendingEffect(cardState, playerKey);
    return { applied: true, row, col };
}

export = {
    applyCausalReplayWill
};
```

- [ ] **Step 5: Wire through `game/logic/cards.ts`**

Add a module load next to `CardMeteorModule`:

```ts
const CardCausalReplayModule = resolveRequiredCardModule('./cards/causal_replay', 'CardCausalReplay');
```

Add wrapper:

```ts
function applyCausalReplayWill(cardState: any, gameState: any, playerKey: any, row: any, col: any) {
    return CardCausalReplayModule.applyCausalReplayWill(cardState, gameState, playerKey, row, col, {
        getCausalReplayTargets,
        removeMarkersAt,
        emitPresentationEvent,
        clearCardPendingEffect,
        setCellValueForCard,
        emptyValue: EMPTY,
        MARKER_KINDS
    });
}
```

Export `applyCausalReplayWill`.

- [ ] **Step 6: Add pipeline branch**

In `game/turn/action-phase/pre-placement-selection.ts`, insert near `METEOR_WILL`:

```ts
if (pending && pending.type === 'CAUSAL_REPLAY_WILL' && action.causalReplayTarget) {
    const res = opts.CardLogic.applyCausalReplayWill(
        opts.cardState,
        opts.gameState,
        opts.playerKey,
        action.causalReplayTarget.row,
        action.causalReplayTarget.col
    );
    opts.events.push({
        type: 'causal_replay_selected',
        player: opts.playerKey,
        target: action.causalReplayTarget,
        applied: !!(res && res.applied)
    });
    return true;
} else if (pending && pending.type === 'CAUSAL_REPLAY_WILL' && action.causalReplayTarget == null) {
    throw new Error('CAUSAL_REPLAY_WILL requires causalReplayTarget before placement');
}
```

- [ ] **Step 7: Run headless tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.logic.causal-replay-module.test.ts test/game.causal-replay-will.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit headless effect unit**

```powershell
git add game/logic/cards/causal_replay.ts game/logic/cards.ts game/turn/action-phase/pre-placement-selection.ts test/game.logic.causal-replay-module.test.ts test/game.causal-replay-will.test.ts
git commit -m "Implement causal replay effect"
```

---

### Task 4: Browser Pending Selection Bridge

**Files:**
- Create: `game/card-effects/causal-replay.ts`
- Create or generate: `game/card-effects/causal-replay.js`
- Modify: `ui/bootstrap.ts`
- Modify if needed: `index.html`, `entry-browser.js`, `scripts/build-module-registry.ts`
- Test: `test/game.card-effects.causal-replay.test.ts`
- Test: `test/index.card-module-scripts.test.ts`

- [ ] **Step 1: Add failing card-effect test**

Create `test/game.card-effects.causal-replay.test.ts`:

```ts
const mockExecutePendingSelection = jest.fn();

jest.mock('../game/card-effects/selection-flow', () => ({
  executePendingSelection: mockExecutePendingSelection
}));

const { handleCausalReplaySelection } = require('../game/card-effects/causal-replay.js');

describe('causal replay card effect bridge', () => {
  beforeEach(() => mockExecutePendingSelection.mockClear());

  test('calls executePendingSelection with causal replay payload', async () => {
    mockExecutePendingSelection.mockImplementation((options) => {
      expect(options.validateResult({ result: { rawEvents: [{ type: 'causal_replay_selected', applied: true }] } })).toBe(true);
      return Promise.resolve({ ok: true });
    });

    await handleCausalReplaySelection(2, 3, 'black');

    const callArg = mockExecutePendingSelection.mock.calls[0][0];
    expect(callArg.pendingType).toBe('CAUSAL_REPLAY_WILL');
    expect(callArg.actionPayload).toEqual({ causalReplayTarget: { row: 2, col: 3 } });
    expect(callArg.invalidMessage).toBe('再生する穴マスを選んでください');
    expect(callArg.buildPlaybackMeta()).toEqual({ cause: 'CAUSAL_REPLAY_WILL', target: { row: 2, col: 3 } });
  });
});
```

- [ ] **Step 2: Run failing bridge test**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.card-effects.causal-replay.test.ts
```

Expected: FAIL because `game/card-effects/causal-replay.js` does not exist.

- [ ] **Step 3: Create browser bridge**

Create `game/card-effects/causal-replay.ts`:

```ts
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const PendingSelectionFlow = _require('./selection-flow');
const PendingCoordinator = _require('../turn/pending-coordinator');

function wasSelectionApplied(result: any): boolean {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event: any) => event && event.type === 'causal_replay_selected')
        : null;
    return !!(selected && selected.applied);
}

async function handleCausalReplaySelection(row: number, col: number, playerKey: string): Promise<any> {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'CAUSAL_REPLAY_WILL',
        actionPayload: PendingCoordinator.buildPendingSelectionTargetPayload('CAUSAL_REPLAY_WILL', row, col),
        invalidMessage: '再生する穴マスを選んでください',
        validateResult: ({ result }: { result: any }) => wasSelectionApplied(result),
        buildPlaybackMeta: () => ({ cause: 'CAUSAL_REPLAY_WILL', target: { row, col } })
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleCausalReplaySelection };
}

export {};
```

Create wrapper `game/card-effects/causal-replay.js` if this repo still expects source wrappers:

```js
module.exports = process.env.JEST_WORKER_ID ? require('./causal-replay.ts') : require("../../dist/game/card-effects/causal-replay");
```

- [ ] **Step 4: Add UI dispatch mapping**

In `ui/bootstrap.ts`, add:

```ts
causal_replay: 'handleCausalReplaySelection',
```

to the `handlerNames` map near `meteor`.

- [ ] **Step 5: Register classic/module load path if required**

If `test/index.card-module-scripts.test.ts` expects every `game/card-effects/*.js` file to be loaded, add `game/card-effects/causal-replay.js` to the relevant script/module registry source. Prefer running the existing browser build before hand-editing generated files.

Run:

```powershell
npm run build:browser
```

Expected: module registry and browser dist outputs update from source.

- [ ] **Step 6: Run bridge/load tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.card-effects.causal-replay.test.ts test/index.card-module-scripts.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit browser bridge unit**

```powershell
git add game/card-effects/causal-replay.ts game/card-effects/causal-replay.js ui/bootstrap.ts index.html entry-browser.js scripts/build-module-registry.ts public/module-registry.js public/module-registry.optional.js test/game.card-effects.causal-replay.test.ts test/index.card-module-scripts.test.ts
git commit -m "Wire causal replay selection bridge"
```

Only stage generated/browser files that actually changed from `npm run build:browser`.

---

### Task 5: CPU Pending Selection

**Files:**
- Modify: `game/cpu-decision-pending-actions.ts`
- Modify: `game/cpu-decision-pending-score.ts`
- Modify: `game/cpu-decision.ts`
- Modify: `game/cpu-turn-handler.ts`
- Test: `test/cpu.turn-handler.pending.test.ts`
- Test: `test/cpu.decision.refactor.test.ts`

- [ ] **Step 1: Add failing CPU tests**

Extend `test/cpu.turn-handler.pending.test.ts`:

```ts
test('CAUSAL_REPLAY_WILL invokes cpuSelectCausalReplayWillWithPolicy when available', async () => {
  cardState.pendingEffectByPlayer.white = { type: 'CAUSAL_REPLAY_WILL', stage: 'selectTarget' };
  const cpuSelectCausalReplayWillWithPolicy = jest.fn(async () => ({ ok: true }));
  const handled = await CpuTurnHandler.handleCpuPendingSelection('white', {
    cpuSelectCausalReplayWillWithPolicy
  });
  expect(handled).toBe(true);
  expect(cpuSelectCausalReplayWillWithPolicy).toHaveBeenCalledWith('white');
});
```

Extend `test/cpu.decision.refactor.test.ts` with a focused pending selection test following the existing `METEOR_WILL` cases:

```ts
test('CPU selects causal replay target from hole cells', async () => {
  cardState.pendingEffectByPlayer.white = { type: 'CAUSAL_REPLAY_WILL', stage: 'selectTarget' };
  CardLogic.getSelectableTargets = jest.fn(() => [{ row: 0, col: 0 }, { row: 2, col: 3 }]);
  const action = await CpuDecision.cpuSelectCausalReplayWillWithPolicy('white');
  expect(action).toEqual(expect.objectContaining({
    type: 'place',
    causalReplayTarget: expect.objectContaining({ row: expect.any(Number), col: expect.any(Number) })
  }));
});
```

- [ ] **Step 2: Run failing CPU tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/cpu.turn-handler.pending.test.ts test/cpu.decision.refactor.test.ts
```

Expected: FAIL because CPU handlers do not exist.

- [ ] **Step 3: Add pending action**

In `game/cpu-decision-pending-actions.ts`, add:

```ts
async function cpuSelectCausalReplayWillWithPolicy(playerKey: any): Promise<any> {
    return runTargetAction({
        playerKey,
        pendingType: 'CAUSAL_REPLAY_WILL',
        targets: getTargetsByMethod(playerKey, 'getCausalReplayTargets'),
        noTargetLabel: '因果再生対象なし',
        targetLabel: '因果再生ターゲット',
        payloadKey: 'causalReplayTarget',
        applyMethodName: 'applyCausalReplayWill'
    });
}
```

Export it from the returned object.

- [ ] **Step 4: Add CPU target scoring**

In `game/cpu-decision-pending-score.ts`, add:

```ts
case 'CAUSAL_REPLAY_WILL':
    if (!onBoard) return -5000;
    if (corner) score += 2600;
    else if (edge) score += 780;
    else score += 160;
    score += bonus * 180;
    score += (ownAdj * 55) + (emptyAdj * 35) - (oppAdj * 30);
    if (cornerHint) {
        const cornerCell = getBoardCellValueSafe(board, cornerHint.corner[0], cornerHint.corner[1]);
        if (cornerCell === 0) score -= cornerHint.kind === 'X' ? 1300 : 700;
        if (cornerCell === playerValue) score += cornerHint.kind === 'X' ? 180 : 120;
    }
    if (discDiff <= -8) score += 180;
    return score;
```

- [ ] **Step 5: Add CPU public wrappers**

In `game/cpu-decision.ts`, add:

```ts
async function cpuSelectCausalReplayWillWithPolicy(playerKey: any): Promise<any> {
    return CpuDecisionPendingActions.cpuSelectCausalReplayWillWithPolicy(playerKey);
}
```

Export it. In `game/cpu-turn-handler.ts`, add the declaration/handler mapping consistent with the pending registry handler dispatch pattern.

- [ ] **Step 6: Run CPU tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/cpu.turn-handler.pending.test.ts test/cpu.decision.refactor.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit CPU unit**

```powershell
git add game/cpu-decision-pending-actions.ts game/cpu-decision-pending-score.ts game/cpu-decision.ts game/cpu-turn-handler.ts test/cpu.turn-handler.pending.test.ts test/cpu.decision.refactor.test.ts
git commit -m "Add causal replay CPU handling"
```

---

### Task 6: Sound Cue

**Files:**
- Modify: `sound-engine.ts`
- Modify: `game/turn/pipeline-ui/selection-sound-cues.ts` or `game/turn/pipeline-ui/sound-cues.ts`
- Test: `test/sound-engine.default-bgm.test.ts`
- Test: `test/game.pipeline-ui-adapter.sound-cue.test.ts`

- [ ] **Step 1: Add failing sound tests**

Extend `test/sound-engine.default-bgm.test.ts`:

```ts
test('causal replay restore sound key resolves to shipped filename', () => {
  expect(soundEngine.getEffectFilePath('causal_replay_restore')).toBe(
    'assets/audio/sound-effect/因果再生で穴マスを通常マスに再生するタイミング.mp3'
  );
});
```

Extend `test/game.pipeline-ui-adapter.sound-cue.test.ts`:

```ts
test('CAUSAL_REPLAY_WILL の穴マス再生は STATUS_REMOVED phase で causal_replay_restore を再生する', () => {
  const base = [{
    type: 'status_removed',
    phase: 15,
    targets: [{ r: 2, col: 3, after: { special: null } }],
    meta: { special: 'METEOR_HOLE', cellRestorationCause: 'CAUSAL_REPLAY_WILL' }
  }];

  const out = adapter.appendSoundEffectPlaybackEvents(base, []);
  const cue = out.find((ev: any) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'causal_replay_restore');
  expect(cue).toBeTruthy();
  expect(cue.phase).toBe(15);
});
```

- [ ] **Step 2: Run failing sound tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/sound-engine.default-bgm.test.ts test/game.pipeline-ui-adapter.sound-cue.test.ts
```

Expected: FAIL because key and cue do not exist.

- [ ] **Step 3: Register sound key**

In `sound-engine.ts`, add to `effectSoundFiles`:

```ts
causal_replay_restore: '因果再生で穴マスを通常マスに再生するタイミング.mp3',
```

If `effectVolumeOverrides` has card-specific entries, add:

```ts
causal_replay_restore: 0.75
```

- [ ] **Step 4: Add sound cue assembly**

In the same module that currently handles `meteor_hole`, add a cue when playback contains:

```ts
ev.type === 'STATUS_REMOVED' || ev.type === 'status_removed'
```

and:

```ts
String(ev.meta && ev.meta.special || '').toUpperCase() === 'METEOR_HOLE'
&& String(ev.meta && ev.meta.cellRestorationCause || '').toUpperCase() === 'CAUSAL_REPLAY_WILL'
```

Push:

```ts
deps.pushSoundCue(ctx, 'causal_replay_restore', ev.phase, 'causal_replay_restore');
```

Use the local cue helper signature in that file if it differs from `deps.pushSoundCue`.

- [ ] **Step 5: Run sound tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/sound-engine.default-bgm.test.ts test/game.pipeline-ui-adapter.sound-cue.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit sound unit**

```powershell
git add sound-engine.ts game/turn/pipeline-ui/selection-sound-cues.ts game/turn/pipeline-ui/sound-cues.ts test/sound-engine.default-bgm.test.ts test/game.pipeline-ui-adapter.sound-cue.test.ts
git commit -m "Add causal replay restore sound"
```

Only stage the sound-cue file that actually changed.

---

### Task 7: Network/Worker Mirror And Contract Checks

**Files:**
- Modify tests if needed: `test/workers.match-card-pattern-parity.test.ts`, `test/workers.match-pending-effect-id.test.ts`, `test/game.pending-coordinator.contract.test.ts`
- Generated/mirror: `worker-public/*`

- [ ] **Step 1: Add pending coordinator contract coverage**

Extend `test/game.pending-coordinator.contract.test.ts`:

```ts
expect(PendingCoordinator.resolvePendingSelectionActionField('CAUSAL_REPLAY_WILL')).toBe('causalReplayTarget');
expect(PendingCoordinator.buildPendingSelectionTargetPayload('CAUSAL_REPLAY_WILL', 2, 3))
  .toEqual({ causalReplayTarget: { row: 2, col: 3 } });
```

- [ ] **Step 2: Add worker parity scenario if existing helper supports card injection**

In `test/workers.match-card-pattern-parity.test.ts`, add `causal_replay_01: 'CAUSAL_REPLAY_WILL'` to the local card map and a scenario that:

```ts
// 1. Creates a METEOR_HOLE on a known cell.
// 2. Gives the active player causal_replay_01 and enough charge.
// 3. Publishes pending selection with { causalReplayTarget: { row: holeRow, col: holeCol } }.
// 4. Asserts worker and local public snapshots both no longer contain METEOR_HOLE at that cell.
// 5. Asserts playback contains STATUS_REMOVED with meta.special === 'METEOR_HOLE'.
```

Use concrete fixtures from the existing meteor pending tests rather than creating a new harness.

- [ ] **Step 3: Run focused contracts before mirror**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.pending-coordinator.contract.test.ts test/workers.match-card-pattern-parity.test.ts test/workers.match-pending-effect-id.test.ts
```

Expected: PASS.

- [ ] **Step 4: Prepare worker mirror**

Run:

```powershell
npm run worker:prepare
```

Expected: `worker-public/` mirrors root generated/browser assets. Do not hand-edit worker mirror files.

- [ ] **Step 5: Run network parity**

Run:

```powershell
npm run test:network:parity
```

Expected: PASS.

- [ ] **Step 6: Commit network/mirror unit**

```powershell
git add test/game.pending-coordinator.contract.test.ts test/workers.match-card-pattern-parity.test.ts test/workers.match-pending-effect-id.test.ts worker-public
git commit -m "Mirror causal replay worker assets"
```

Only stage worker-public files intentionally produced by `npm run worker:prepare`.

---

### Task 8: Final Verification

**Files:**
- Inspect all changed files.

- [ ] **Step 1: Run focused card and pending tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/cards.causal-replay-surfaces.test.ts test/game.causal-replay-targets.test.ts test/game.logic.causal-replay-module.test.ts test/game.causal-replay-will.test.ts test/game.card-effects.causal-replay.test.ts test/game.pending-coordinator.contract.test.ts test/game.pipeline-ui-adapter.sound-cue.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run type/build checks**

Run:

```powershell
npm run typecheck
npm run build:ts
npm run build:browser
```

Expected: PASS.

- [ ] **Step 3: Inspect diff**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors. Dirty files should be only intentionally changed files or clearly reported unrelated pre-existing work.

- [ ] **Step 4: Final commit if any verified changes remain**

If a coherent verified diff remains unstaged:

```powershell
git add <only-intended-causal-replay-files>
git commit -m "Complete causal replay implementation"
```

Do not stage unrelated dirty files.

---

## Self-Review

- Spec coverage: The plan covers cost 12, no-hole use prohibition, hole-only selection, final validation, empty normal cell restoration, no previous state restoration, sound key, CPU, UI text, network/worker mirror, and tests.
- Placeholder scan: No task uses undefined "TBD" work. The worker parity task references existing helper patterns because the exact fixture helper must be chosen from current tests during implementation, but it defines concrete assertions and expected payloads.
- Type consistency: The card type is consistently `CAUSAL_REPLAY_WILL`; card id is `causal_replay_01`; action field is `causalReplayTarget`; dispatch key is `causal_replay`; sound key is `causal_replay_restore`; raw event is `causal_replay_selected`.

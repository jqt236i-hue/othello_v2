# Theory Incarnation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `理論の化身` (`theory_incarnation_01`) as a special card that unlocks after the player has collected printed number-cell values totaling 42, rewrites empty cells into temporary theory number cells, manifests a 3-turn inviolable theory stone, locks its owner actions, and auto-spawns one eligible special stone at each owner turn start.

**Architecture:** Reuse the existing special-card, manifest-stone, action-lock, and cinematic presentation foundations. Add a focused headless resolver for theory number cells and theory turn-start spawning; keep DOM/audio/network presentation in `ui/` and event consumers. Treat root files as source of truth, regenerate catalog/assets, and sync `worker-public/` through `npm run worker:prepare`.

**Tech Stack:** TypeScript/JavaScript, Jest, browser classic module registry, Cloudflare Worker mirror, existing card-reversi headless turn pipeline.

---

## Current Decisions

- Card id: `theory_incarnation_01`
- Card type: `THEORY_INCARNATION`
- Manifest marker type: `THEORY_INCARNATION`
- Cost: `0`
- Use condition: player's accumulated printed number-cell value total is at least `42`.
- Number-cell progress uses the raw printed number that was consumed. Multipliers such as `CRYSTAL_STONE` increase charge gain, but do not double theory progress.
- Use quote: `盤上の全ては、我が理論の内に収束する`
- Temporary audio: reuse observer special-card use sound and observer manifest BGM until dedicated audio is provided.
- Dedicated assets already exist and should be used:
  - `assets/images/special-cards/characters/theory_incarnation.png`
  - `assets/images/background/manifest-worlds/理論の世界.png`
  - `assets/images/stones/theory_incarnation-black.png`
  - `assets/images/stones/theory_incarnation-white.png`
- Theory number cells use a dedicated visual style, not the ordinary number-cell look.
- Theory number cells are restored when the theory manifestation ends, but only if they are still unused and still belong to the same theory session.
- Spawn candidates come from `SpecialStoneRegistry.getTheoryIncarnationSpawnCandidates()` and exclude `TRAP`, `TIME_BOMB`, manifest stones, status attachments, board markers, and placement-only effects.
- Spawned special stones must use the same marker initialization data as their source card placement path. Do not create incomplete markers with only `{ type }`.

## Dirty Worktree Rule

The repository currently has many pre-existing modified and untracked files. Before implementing, run `git status --short` and inspect diffs for files touched by this plan. Stage/commit only files intentionally changed for this implementation. If the implementation diff cannot be separated from unrelated user work, do not commit; report the exact files involved.

## File Map

- Modify `01-rulebook.md`: Add final player-facing specification for `理論の化身`, dedicated theory number cells, temporary reused audio, quote, and restoration behavior.
- Modify `正本/カード仕様正本.md` and `正本/演出正本.md`: Record the same visible behavior only if existing sections would become stale.
- Modify `shared/special-card-registry.ts`: Fill theory quote, quote lines, and temporary `manifestBgmTrack` using the observer track.
- Modify `shared/manifest-stone-registry.ts`: Confirm `THEORY_INCARNATION` remains duration 3, absolute protected, visual key `theoryIncarnationStone`.
- Modify `cards/catalog.json`: Enable/add `theory_incarnation_01` if not already cataloged.
- Generate `cards/catalog.ts`, `cards/catalog.js`, `cards/catalog.generated.js` with `npm run generate:catalog`.
- Modify `cards/card-interaction-effects.ts`: Add quick/detail copy and dynamic numeric progress text for the use condition.
- Modify `game/turn/action-phase/place-resolution.ts`: Track consumed printed number-cell values in a dedicated theory progress ledger.
- Create `game/logic/card-resolution/special-stone-marker-factory.ts`: Shared marker data factory for next-stone special effects and theory-spawned special stones.
- Create `game/logic/card-resolution/theory-incarnation.ts`: Headless resolver for use condition, theory number-cell rewrite/restore, spawn candidate resolution, spawn selection, and manifest reservation.
- Modify `game/logic/cards-internal/state-factory.ts`: Initialize/clone theory state fields.
- Modify `game/logic/cards.ts`: Wire the new resolver into `applyCardUsage`, exports, and dependency context.
- Modify `game/turn/action-phase/place-resolution.ts`: Apply pending theory manifest reservation immediately after the owner places the next stone.
- Modify `game/turn/turn-start/special-stone-phase.ts`: Run theory turn-start spawn while the owner marker is active.
- Modify `game/turn/turn_pipeline_phases.ts`: If theory lock is active at the owner turn start, process the automatic theory turn and hand off without requiring user/CPU placement.
- Modify `game/cpu-decision.ts`, `game/cpu-turn-handler.ts`, and `game/ai/*` only as needed: allow CPU to use the card when condition is met and avoid trying to move while locked.
- Modify `ui/diff-renderer.ts` and `styles-board.css`: Render theory number cells with dedicated class/style.
- Modify `ui/debug-test-scenarios.ts`: Add a debug scenario that starts with gained number total >= 42 and theory card in hand.
- Modify `test/*`: Add focused tests for condition, rewrite/restore, placement reservation, turn-start spawning, lock/autopass, rendering metadata, CPU safety, network authority, reconnect projection, command rejection, and network parity.
- Run `npm run build:browser` and `npm run worker:prepare` after root source changes.

## State Model

Add these `cardState` fields:

```ts
theoryIncarnationStateByPlayer: {
  black: null | {
    sessionId: string;
    markerId: number | null;
    ownerKey: 'black';
    remainingSpawnCount: number;
    createdTurnIndex: number;
  };
  white: null | {
    sessionId: string;
    markerId: number | null;
    ownerKey: 'white';
    remainingSpawnCount: number;
    createdTurnIndex: number;
  };
};
nextTheoryIncarnationStoneByPlayer: {
  black: null | { sourceType: 'THEORY_INCARNATION'; sessionId: string };
  white: null | { sourceType: 'THEORY_INCARNATION'; sessionId: string };
};
theoryNumberCellsBySession: {
  [sessionId: string]: {
    ownerKey: 'black' | 'white';
    cells: Record<string, {
      row: number;
      col: number;
      value: number;
      originalValue: number | null;
      originalConsumed: boolean;
      spawnType: string;
      sourceCardId: string;
      sourceCardType: string;
      sourceCardCost: number;
    }>;
  };
};
theoryNumberCellByCell: {
  [cellKey: string]: { sessionId: string; ownerKey: 'black' | 'white' };
};
numberCellCollectedTotalByPlayer: { black: number; white: number };
_nextTheoryIncarnationSeq: number;
```

Use existing `boardBonusByCell` for actual numeric value so placement reward remains on the existing path. Use `theoryNumberCellsBySession` as metadata for styling, restoration, and spawn source control.

Use `numberCellCollectedTotalByPlayer`, not `chargeGainedTotal`, for the use condition. This ledger increments by the consumed printed number-cell value before any multiplier is applied.

## Task 1: Document The Public Spec

**Files:**
- Modify `01-rulebook.md`
- Modify `正本/カード仕様正本.md` if it already lists the special cards
- Modify `正本/演出正本.md` if it already lists special-card cinematic behavior

- [ ] **Step 1: Write the final spec text before code**

Add a `理論の化身` entry that states:

```md
理論の化身 / 0コスト / 特殊カード

使用条件: 自分が踏んだ数字マスの印字値合計が42以上。演算の意志などで布石獲得が増えても、この条件進捗は印字値ぶんだけ増える。
使用時: 空きマスを理論数字マスへ一時的に書き換え、次に置く石を理論石にする。
理論石: 顕現石。3ターン持続。不可侵。
顕現中: 自分はカード使用も石配置もできない。自分のターン開始時、理論数字マスから対応コストの特殊石が1体芽生え、そのままターン終了する。
消滅時: 未使用の理論数字マスを、理論の化身使用前の数字マス状態へ戻す。
芽生え候補: 特殊石分類のうち、罠、時限爆弾、顕現石、状態付与、盤面マーカー、即時配置効果を除外したもの。
演出: 暗転、理論の化身の立ち絵、専用背景「理論の世界」、セリフ「盤上の全ては、我が理論の内に収束する」。専用音源が未提供のため、使用音と顕現中BGMは暫定で盤理の観測者と同じものを使う。
```

- [ ] **Step 2: Verify docs reference current asset paths**

Run:

```powershell
Test-Path assets\images\special-cards\characters\theory_incarnation.png
Test-Path assets\images\background\manifest-worlds\理論の世界.png
Test-Path assets\images\stones\theory_incarnation-black.png
Test-Path assets\images\stones\theory_incarnation-white.png
```

Expected: all four commands print `True`.

## Task 2: Add Failing Headless Tests For Core Theory Rules

**Files:**
- Create `test/game.theory-incarnation.test.ts`

- [ ] **Step 1: Add tests for condition, rewrite, reservation, and restore**

Create tests with this shape:

```ts
import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';

function prng(sequence = [0]) {
  let i = 0;
  return {
    shuffle: (arr: any[]) => arr,
    random: () => {
      const value = sequence[i % sequence.length];
      i += 1;
      return value;
    }
  };
}

function makeGameState() {
  const board = Array(8).fill(null).map(() => Array(8).fill(Shared.EMPTY));
  board[3][3] = Shared.WHITE;
  board[3][4] = Shared.BLACK;
  board[4][3] = Shared.BLACK;
  board[4][4] = Shared.WHITE;
  return { board, currentPlayer: Shared.BLACK, turnNumber: 1, consecutivePasses: 0 };
}

describe('理論の化身', () => {
  test('数字マス獲得合計42未満では使用できない', () => {
    const cardState: any = CardLogic.createCardState(prng());
    const gameState: any = makeGameState();
    cardState.numberCellCollectedTotalByPlayer.black = 41;
    cardState.hands.black = ['theory_incarnation_01'];
    expect(CardLogic.canUseCard(cardState, gameState, 'black', 'theory_incarnation_01')).toBe(false);
  });

  test('使用時に空きマスを理論数字マスへ書き換え、次の石を理論石予約する', () => {
    const cardState: any = CardLogic.createCardState(prng([0]));
    const gameState: any = makeGameState();
    cardState.numberCellCollectedTotalByPlayer.black = 42;
    cardState.hands.black = ['theory_incarnation_01'];
    const ok = CardLogic.applyCardUsage(cardState, gameState, 'black', 'theory_incarnation_01');
    expect(ok).toBe(true);
    expect(cardState.nextTheoryIncarnationStoneByPlayer.black).toMatchObject({ sourceType: 'THEORY_INCARNATION' });
    const sessionId = cardState.nextTheoryIncarnationStoneByPlayer.black.sessionId;
    expect(Object.keys(cardState.theoryNumberCellsBySession[sessionId].cells).length).toBeGreaterThan(0);
    expect(Object.values(cardState.theoryNumberCellsBySession[sessionId].cells).every((entry: any) => entry.value > 0 && entry.spawnType)).toBe(true);
  });

  test('消滅時に未使用の理論数字マスだけ元へ戻す', () => {
    const cardState: any = CardLogic.createCardState(prng([0]));
    const gameState: any = makeGameState();
    cardState.numberCellCollectedTotalByPlayer.black = 42;
    cardState.hands.black = ['theory_incarnation_01'];
    CardLogic.applyCardUsage(cardState, gameState, 'black', 'theory_incarnation_01');
    const sessionId = cardState.nextTheoryIncarnationStoneByPlayer.black.sessionId;
    const firstKey = Object.keys(cardState.theoryNumberCellsBySession[sessionId].cells)[0];
    const otherKey = Object.keys(cardState.theoryNumberCellsBySession[sessionId].cells).find((key) => key !== firstKey)!;
    const consumedBefore = cardState.theoryNumberCellsBySession[sessionId].cells[firstKey];
    const unusedOriginal = cardState.theoryNumberCellsBySession[sessionId].cells[otherKey].originalValue;
    cardState.boardBonusConsumedByCell[firstKey] = true;
    CardLogic.restoreTheoryNumberCells(cardState, sessionId);
    expect(cardState.boardBonusByCell[firstKey]).toBe(consumedBefore.value);
    expect(cardState.boardBonusByCell[otherKey] || 0).toBe(unusedOriginal || 0);
    expect(cardState.theoryNumberCellsBySession[sessionId]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run failing tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.theory-incarnation.test.ts --runInBand
```

Expected: FAIL because `theory_incarnation_01`, `restoreTheoryNumberCells`, and theory state are not wired.

## Task 3: Add Printed Number-Cell Progress Ledger

**Files:**
- Modify `game/logic/cards-internal/state-factory.ts`
- Modify `game/turn/action-phase/place-resolution.ts`
- Test `test/game.board-bonus.test.ts`

- [ ] **Step 1: Initialize and clone the progress ledger**

In `createCardState`, add:

```ts
numberCellCollectedTotalByPlayer: { black: 0, white: 0 },
```

In `cloneCardState`, clone it as finite non-negative integers:

```ts
numberCellCollectedTotalByPlayer: {
  black: Math.max(0, Math.floor(Number(cardState.numberCellCollectedTotalByPlayer?.black || 0))),
  white: Math.max(0, Math.floor(Number(cardState.numberCellCollectedTotalByPlayer?.white || 0)))
},
```

- [ ] **Step 2: Increment only when a number cell is consumed**

In `game/turn/action-phase/place-resolution.ts`, inside the existing `board_bonus_gain` branch, increment the ledger by the raw `bonusValue` before multiplier:

```ts
if (!opts.cardState.numberCellCollectedTotalByPlayer || typeof opts.cardState.numberCellCollectedTotalByPlayer !== 'object') {
  opts.cardState.numberCellCollectedTotalByPlayer = { black: 0, white: 0 };
}
opts.cardState.numberCellCollectedTotalByPlayer[opts.playerKey] =
  Math.max(0, Math.floor(Number(opts.cardState.numberCellCollectedTotalByPlayer[opts.playerKey] || 0))) +
  Math.max(0, Math.floor(Number(bonusValue) || 0));
```

Do not use `gained` here. `gained` can include a multiplier from `CRYSTAL_STONE`; theory progress must count the printed number only.

- [ ] **Step 3: Add a regression test for multiplier behavior**

Extend `test/game.board-bonus.test.ts`:

```ts
expect(cardState.numberCellCollectedTotalByPlayer.black).toBe(targetBonus);
expect(Number(cardState.charge.black || 0) - blackChargeBefore).toBe(1 + (targetBonus * 2));
```

This belongs in the existing `CRYSTAL_STONE` test so it proves doubled charge does not double theory progress.

- [ ] **Step 4: Run board bonus tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.board-bonus.test.ts test/game.cards-internal.state-factory.test.ts --runInBand
```

Expected: PASS after implementation.

## Task 4: Add Theory State Initialization And Clone Support

**Files:**
- Modify `game/logic/cards-internal/state-factory.ts`
- Test `test/game.cards-internal.state-factory.test.ts`

- [ ] **Step 1: Extend initial card state**

In `createCardState`, add:

```ts
theoryIncarnationStateByPlayer: { black: null, white: null },
nextTheoryIncarnationStoneByPlayer: { black: null, white: null },
theoryNumberCellsBySession: {},
theoryNumberCellByCell: {},
_nextTheoryIncarnationSeq: 1,
```

- [ ] **Step 2: Clone state fields**

In `cloneCardState`, clone these fields as plain data:

```ts
theoryIncarnationStateByPlayer: cloneNullablePlayerObject(cardState.theoryIncarnationStateByPlayer),
nextTheoryIncarnationStoneByPlayer: cloneNullablePlayerObject(cardState.nextTheoryIncarnationStoneByPlayer),
theoryNumberCellsBySession: cloneTheoryNumberCellsBySession(cardState.theoryNumberCellsBySession),
theoryNumberCellByCell: cloneTheoryNumberCellByCell(cardState.theoryNumberCellByCell),
_nextTheoryIncarnationSeq: Number.isInteger(Number(cardState._nextTheoryIncarnationSeq))
  ? Math.max(1, Math.floor(Number(cardState._nextTheoryIncarnationSeq)))
  : 1,
```

Add local helper functions if equivalent clone helpers do not already exist in the file.

- [ ] **Step 3: Add/extend clone test**

Assert the clone is deep enough:

```ts
original.theoryNumberCellsBySession = {
  theory_black_1: {
    ownerKey: 'black',
    cells: { '0,0': { row: 0, col: 0, value: 7, originalValue: 1, originalConsumed: false, spawnType: 'GHOST' } }
  }
};
const copy = CardLogic.cloneCardState(original);
copy.theoryNumberCellsBySession.theory_black_1.cells['0,0'].value = 3;
expect(original.theoryNumberCellsBySession.theory_black_1.cells['0,0'].value).toBe(7);
```

- [ ] **Step 4: Run state tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.cards-internal.state-factory.test.ts --runInBand
```

Expected: PASS after implementation.

## Task 5: Implement Spawn Marker Factory And Headless Theory Resolver

**Files:**
- Create `game/logic/card-resolution/special-stone-marker-factory.ts`
- Create `game/logic/card-resolution/theory-incarnation.ts`
- Modify `game/logic/cards.ts`

- [ ] **Step 1: Create shared special-stone marker factory**

Create `game/logic/card-resolution/special-stone-marker-factory.ts` with:

```ts
export type SpecialStoneMarkerBuildResult = {
  ok: boolean;
  markerKind: string;
  markerData: Record<string, any>;
  sourceCardId: string | null;
  sourceCardType: string | null;
  sourceCardCost: number;
  reason?: string;
};

export function buildSpecialStoneMarkerDataForCardType(cardType: any, ownerKey: any, deps: any): SpecialStoneMarkerBuildResult;
export function buildTheoryIncarnationSpawnTable(deps: any): Record<string, SpecialStoneMarkerBuildResult>;
```

The factory must centralize marker initialization for every spawnable theory candidate. It should be used by theory spawning, and later can be reused by normal next-stone placement effects when touching those paths.

Minimum mappings for this implementation:

```ts
GHOST_WILL -> GHOST with remainingOwnerTurns: deps.GHOST_WILL_TURNS
AFTERIMAGE_WILL -> AFTERIMAGE_WILL with flipEvadeRemaining and destroyEvadeRemaining from evasion defaults
REGEN_WILL -> REGEN with regenRemaining: 3
BREEDING_WILL -> BREEDING with remainingOwnerTurns: 5
PROLIFERATION_WILL -> PROLIFERATION with remainingOwnerTurns: deps.PROLIFERATION_WILL_TURNS
ULTIMATE_REVERSE_DRAGON -> DRAGON with remainingOwnerTurns: deps.ULTIMATE_DRAGON_TURNS
SNIPER_WILL -> SNIPER with remainingOwnerTurns: deps.SNIPER_WILL_TURNS
DESTROY_DRAGON -> DESTROY_DRAGON with remainingOwnerTurns: deps.DESTROY_DRAGON_TURNS
LIGHTNING_WILL -> LIGHTNING with remainingOwnerTurns: deps.LIGHTNING_WILL_TURNS
WILL_HUNTER_KING -> WILL_HUNTER_KING with remainingOwnerTurns: deps.WILL_HUNTER_KING_TURNS
ROBOT_VACUUM -> ROBOT_VACUUM with remainingOwnerTurns: deps.ROBOT_VACUUM_TURNS
```

Exclude any card type whose marker would be `TRAP`, `TIME_BOMB`, manifest stone, status-only, board marker, or instant placement effect.

Each result must include `sourceCardId`, `sourceCardType`, and `sourceCardCost`. Resolve these by scanning catalog/card definitions by `type`, then keeping the lowest enabled positive-cost card for that type.

- [ ] **Step 2: Add factory tests**

Create `test/game.theory-incarnation.spawn-factory.test.ts`:

```ts
import * as CardLogic from '../game/logic/cards.js';

describe('理論の化身 spawn factory', () => {
  test('builds complete marker data for ghost, afterimage, and regen', () => {
    const table = CardLogic.buildTheoryIncarnationSpawnTable();
    expect(table.GHOST).toMatchObject({ ok: true, sourceCardType: 'GHOST_WILL', markerData: { type: 'GHOST' } });
    expect(table.AFTERIMAGE_WILL.markerData.flipEvadeRemaining).toBeGreaterThan(0);
    expect(table.AFTERIMAGE_WILL.markerData.destroyEvadeRemaining).toBeGreaterThan(0);
    expect(table.REGEN.markerData.regenRemaining).toBeGreaterThan(0);
  });

  test('does not expose trap, time bomb, or manifest stones as theory spawn options', () => {
    const table = CardLogic.buildTheoryIncarnationSpawnTable();
    expect(table.TRAP).toBeUndefined();
    expect(table.TIME_BOMB).toBeUndefined();
    expect(table.THEORY_INCARNATION).toBeUndefined();
    expect(table.OBSERVER_WILL).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run factory tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.theory-incarnation.spawn-factory.test.ts --runInBand
```

Expected: FAIL before factory wiring, PASS after implementation.

- [ ] **Step 4: Create resolver module**

Create a module with these exported functions:

```ts
export function getTheoryIncarnationProgress(cardState: any, playerKey: any): number;
export function canUseTheoryIncarnation(cardState: any, playerKey: any): boolean;
export function applyTheoryIncarnationUsage(cardState: any, gameState: any, playerKey: any, prng: any, deps: any): any;
export function applyTheoryIncarnationStoneReservation(cardState: any, playerKey: any, row: number, col: number, deps: any): any;
export function restoreTheoryNumberCells(cardState: any, sessionId: any): any;
export function processTheoryIncarnationTurnStart(cardState: any, gameState: any, playerKey: any, row: number, col: number, prng: any, deps: any): any;
```

Implementation rules:

- `getTheoryIncarnationProgress` returns `Math.max(0, Math.floor(cardState.numberCellCollectedTotalByPlayer[playerKey] || 0))`.
- `canUseTheoryIncarnation` checks progress >= 42 and no active manifest marker exists.
- `applyTheoryIncarnationUsage` creates a session id like `theory_incarnation_black_1`, rewrites every empty cell that has board shape support, and stores restore metadata.
- Empty cell detection uses `deps.getCellValueForCard(gameState, row, col) === deps.EMPTY`.
- Candidate types use `deps.getTheoryIncarnationSpawnCandidates()`.
- Candidate card costs and marker data come from `buildTheoryIncarnationSpawnTable()`. Include only candidates with integer `sourceCardCost > 0`.
- Cell values are chosen from candidate source card costs. Store `spawnType`, `sourceCardId`, `sourceCardType`, and `sourceCardCost` for that cell so turn-start can spawn deterministically from the chosen cell.
- `applyTheoryIncarnationStoneReservation` adds a `manifestStone` marker with `remainingOwnerTurns: 3`, `absoluteProtected: true`, `visualEffectKey: 'theoryIncarnationStone'`, and the session id.
- `restoreTheoryNumberCells` restores only cells that are not consumed and still have the same session metadata.
- `processTheoryIncarnationTurnStart` picks one unconsumed theory cell from the session, loads complete marker data from the spawn table, places that marker as the owner special stone, marks the theory cell consumed, decrements remaining spawn count, and returns event details. This spawn does not award number-cell charge.
- `processTheoryIncarnationTurnStart` decrements the theory marker `remainingOwnerTurns` exactly once per owner turn start. When it reaches `0`, it restores unused theory number cells, removes/normalizes the theory marker with the same presentation path used by `OBSERVER_WILL`, and returns restored-cell details.

- [ ] **Step 2: Wire dependency context in `game/logic/cards.ts`**

Add the resolver import/require near existing card-resolution modules. Provide deps:

```ts
{
  EMPTY,
  MARKER_KINDS,
  addMarker,
  getMarkers,
  getCellValueForCard,
  hasBoardShapeCellForCard,
  getTheoryIncarnationSpawnCandidates: SpecialStoneRegistry.getTheoryIncarnationSpawnCandidates,
  getCardDef,
  getCardIdByType,
  buildTheoryIncarnationSpawnTable,
  isManifestStoneMarker,
  removeMarkersAt
}
```

Export passthroughs:

```ts
getTheoryIncarnationProgress,
canUseTheoryIncarnation,
buildTheoryIncarnationSpawnTable,
applyTheoryIncarnationStoneReservation,
restoreTheoryNumberCells,
processTheoryIncarnationTurnStart
```

- [ ] **Step 3: Run core tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.theory-incarnation.test.ts --runInBand
```

Expected: condition, rewrite, and restore tests pass.

## Task 6: Catalog, Card Text, And Detail Progress

**Files:**
- Modify `cards/catalog.json`
- Modify `cards/card-interaction-effects.ts`
- Modify `cards/card-interaction-detail-actions.ts` if dynamic use-condition text needs action-state metadata
- Generate catalog projections

- [ ] **Step 1: Add catalog entry**

Add or enable:

```json
{
  "id": "theory_incarnation_01",
  "name_ja": "理論の化身",
  "type": "THEORY_INCARNATION",
  "cost": 0,
  "display_type_ja": "特殊",
  "desc_ja": "数字マスの印字値合計42以上で使用可能。空きマスを理論数字マスに変え、理論の化身を顕現させる。",
  "enabled": true
}
```

- [ ] **Step 2: Generate catalog**

Run:

```powershell
npm run generate:catalog
```

Expected: `cards/catalog.ts`, `cards/catalog.js`, and `cards/catalog.generated.js` change consistently.

- [ ] **Step 3: Add card detail text**

In `cards/card-interaction-effects.ts`, add quick/detail text:

```ts
THEORY_INCARNATION: '数字マス印字値42以上で、理論数字マスを展開',
```

Detail:

```ts
THEORY_INCARNATION: '数字マスの印字値合計42以上で使用可能。\n空きマスを理論数字マスへ一時的に書き換え、次に置く石を理論の化身にする。\n顕現中は自分のターン開始時に理論数字マスから特殊石が1体芽生え、そのターンは自動終了する。\n理論の化身が消えると、未使用の理論数字マスは元へ戻る。'
```

- [ ] **Step 4: Add dynamic progress display**

Expose a small helper if no existing dynamic text path fits:

```ts
function resolveTheoryIncarnationProgressText(cardState: any, playerKey: any): string {
  const total = Math.max(0, Math.floor(Number(cardState?.numberCellCollectedTotalByPlayer?.[playerKey] || 0)));
  return `現在 ${total} / 42`;
}
```

Render this in the card detail area, not as a cost/type badge.

- [ ] **Step 5: Run card surface tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/cards.catalog.test.ts test/ui.card-detail-effect-tags.test.ts test/ui.long-press-info.test.ts --runInBand
```

Expected: PASS after updating expected catalog/detail text.

## Task 7: Special Card Presentation Metadata

**Files:**
- Modify `shared/special-card-registry.ts`
- Test `test/shared.special-card-registry.test.ts`

- [ ] **Step 1: Fill theory quote and temporary BGM**

Update `theory_incarnation_01`:

```ts
quote: '盤上の全ては、我が理論の内に収束する',
quoteLines: Object.freeze([
  '盤上の全ては、',
  '我が理論の内に収束する'
]),
manifestBgmKey: 'observer_will_path',
manifestBgmTrack: Object.freeze({
  name: '観測の道',
  file: 'assets/audio/bgm/manifest-stones/観測の道-bpm150.mp3',
  loopStart: 0
})
```

Keep `manifestBackgroundImage` as `assets/images/background/manifest-worlds/理論の世界.png` and `characterImage` as `assets/images/special-cards/characters/theory_incarnation.png`.

- [ ] **Step 2: Run registry tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/shared.special-card-registry.test.ts test/manifest-stone-registry.test.ts --runInBand
```

Expected: PASS after expected metadata is updated.

## Task 8: Placement Reservation For Theory Stone

**Files:**
- Modify `game/turn/action-phase/place-resolution.ts`
- Test `test/game.theory-incarnation.test.ts`

- [ ] **Step 1: Apply reservation after standard place event**

Immediately after the existing observer reservation block, add a parallel theory block:

```ts
if (opts.CardLogic && typeof opts.CardLogic.applyTheoryIncarnationStoneReservation === 'function') {
  const theoryStoneRes = opts.CardLogic.applyTheoryIncarnationStoneReservation(opts.cardState, opts.playerKey, action.row, action.col);
  if (theoryStoneRes && theoryStoneRes.applied) {
    opts.events.push({
      type: 'theory_incarnation_marker_applied',
      player: opts.playerKey,
      row: action.row,
      col: action.col,
      markerId: theoryStoneRes.marker && theoryStoneRes.marker.id ? theoryStoneRes.marker.id : null,
      sessionId: theoryStoneRes.sessionId || null
    });
  }
}
```

- [ ] **Step 2: Add placement test**

Use a free placement or legal move after card use and assert:

```ts
expect(CardLogic.getManifestMarkers(cardState).some((marker: any) =>
  marker.data.type === 'THEORY_INCARNATION' &&
  marker.data.remainingOwnerTurns === 3 &&
  marker.data.absoluteProtected === true
)).toBe(true);
```

- [ ] **Step 3: Run placement tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.theory-incarnation.test.ts test/special-card-foundation.test.ts --runInBand
```

Expected: PASS.

## Task 9: Turn-Start Spawn, Expiry Restore, And Auto-End

**Files:**
- Modify `game/turn/turn-start/special-stone-phase.ts`
- Modify `game/turn/turn_pipeline_phases.ts`
- Test `test/game.theory-incarnation.turn-start.test.ts`

- [ ] **Step 1: Add marker-phase handling**

In `processTurnStartSpecialStone`, add before generic marker movement effects:

```ts
if (typeKey === 'THEORY_INCARNATION' && owner === opts.playerKey && typeof opts.CardLogic.processTheoryIncarnationTurnStart === 'function') {
  const res = opts.CardLogic.processTheoryIncarnationTurnStart(opts.cardState, opts.gameState, opts.playerKey, row, col, p);
  if (res && res.spawned) {
    opts.events.push({ type: 'theory_incarnation_spawned_start', player: opts.playerKey, details: [res.spawned] });
  }
  if (res && Array.isArray(res.expired) && res.expired.length) {
    opts.events.push({ type: 'theory_incarnation_marker_expired', player: opts.playerKey, details: res.expired });
  }
  if (res && Array.isArray(res.restored) && res.restored.length) {
    opts.events.push({ type: 'theory_incarnation_number_cells_restored', player: opts.playerKey, details: res.restored });
  }
  return processingState;
}
```

- [ ] **Step 2: Restore on expiry before marker removal**

`processTheoryIncarnationTurnStart` must spawn first, then decrement the theory marker timer. This preserves the expected 3 owner-turn spawns from a 3-turn theory stone. The expiry branch should mirror the existing observer marker expiry shape:

```ts
const spawn = spawnOneTheorySpecialStoneFromSession(...);
const before = Number(marker.data.remainingOwnerTurns);
const after = Math.max(0, Math.trunc(before) - 1);
marker.data.remainingOwnerTurns = after;
if (after <= 0) {
  const restored = restoreTheoryNumberCells(cardState, marker.data.sessionId);
  const revertRes = deps.revertSpecialStoneWithPresentation(
    cardState,
    gameState,
    row,
    col,
    'THEORY_INCARNATION',
    ownerKey,
    'SYSTEM',
    'duration_end',
    { special: 'THEORY_INCARNATION', owner: ownerKey, timer: 0, random: prng || null }
  );
  return { applied: true, spawned: spawn, expired: [{ row, col, owner: ownerKey, markerId: marker.id }], restored, reverted: !!(revertRes && revertRes.reverted) };
}
return { applied: true, spawned: spawn, remainingOwnerTurns: after };
```

If `revertSpecialStoneWithPresentation` is unavailable in a focused test environment, remove the marker by id and leave the board stone as the owner's normal stone. Do not delete occupied/spawned cells from `boardBonusConsumedByCell`.

- [ ] **Step 3: Auto-end locked owner turns**

After turn-start marker processing in `applyTurnStartPhase`, detect active theory placement lock:

```ts
const theoryAutoEnded = CardLogic &&
  typeof CardLogic.isPlacementLockedForPlayer === 'function' &&
  CardLogic.isPlacementLockedForPlayer(cardState, playerKey) === true &&
  typeof CardLogic.hasActiveTheoryIncarnationForPlayer === 'function' &&
  CardLogic.hasActiveTheoryIncarnationForPlayer(cardState, playerKey) === true;
```

If true, push:

```ts
events.push({ type: 'theory_incarnation_auto_turn_end', player: playerKey });
```

Then call `ActionPhaseTurnHandoffModule.handOffCompletedTurn` directly:

```ts
const turnNumberBeforeAutoEnd = Number(gameState.turnNumber || 0);
ActionPhaseTurnHandoffModule.handOffCompletedTurn({
  Core,
  CardLogic,
  cardState,
  gameState,
  playerKey,
  turnNumberAfterCompletion: turnNumberBeforeAutoEnd + 1,
  advanceGameRoundAfterCompletedTurn
});
return { ok: true, events };
```

This must run after marker/timer processing and generated spawn flip processing. It must not call placement resolution, CPU move selection, or pending selection logic.

- [ ] **Step 4: Add turn-start tests**

Assert:

```ts
expect(result.events.some((ev: any) => ev.type === 'theory_incarnation_spawned_start')).toBe(true);
expect(result.events.some((ev: any) => ev.type === 'theory_incarnation_auto_turn_end')).toBe(true);
expect(gameState.currentPlayer).toBe(Shared.WHITE);
```

Also assert only one spawned special marker appears per owner turn start.

- [ ] **Step 5: Run turn-start tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.theory-incarnation.turn-start.test.ts test/game.special-stone-visual-rule.test.ts --runInBand
```

Expected: PASS.

## Task 10: Theory Number Cell Rendering

**Files:**
- Modify `ui/diff-renderer.ts`
- Modify `styles-board.css`
- Test `test/ui.diff-renderer.theory-number-cell.test.ts`

- [ ] **Step 1: Add renderer class metadata**

When rendering board bonus text, check `cardState.theoryNumberCellsBySession` for the cell key. If active and unconsumed, add:

```ts
cellEl.classList.add('theory-number-cell');
numberEl.classList.add('theory-number-cell-value');
```

Do not change the numeric value source; keep `boardBonusByCell[key]`.

- [ ] **Step 2: Add CSS**

Add a dedicated look:

```css
.board-cell.theory-number-cell {
  box-shadow: inset 0 0 0 1px rgba(190, 240, 255, 0.72), 0 0 14px rgba(120, 220, 255, 0.32);
  background-image: linear-gradient(135deg, rgba(10, 42, 54, 0.45), rgba(40, 80, 92, 0.16));
}

.theory-number-cell-value {
  color: #dffaff;
  text-shadow: 0 0 8px rgba(134, 229, 255, 0.9), 0 1px 2px rgba(0, 0, 0, 0.86);
}
```

- [ ] **Step 3: Add render test**

Assert a cell in the active session receives `theory-number-cell`, and an ordinary number cell does not.

- [ ] **Step 4: Run UI test**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.diff-renderer.theory-number-cell.test.ts test/ui.board-bonus-font.test.ts --runInBand
```

Expected: PASS.

## Task 11: CPU And Debug Scenario

**Files:**
- Modify `game/cpu-turn-handler.ts`
- Modify `game/cpu-decision.ts`
- Modify `game/ai/cpu-policy-card-profiles.ts`
- Modify `ui/debug-test-scenarios.ts`
- Tests `test/ui.debug-test-scenarios.test.ts`, focused CPU tests

- [ ] **Step 1: Prevent CPU action while theory lock is active**

Before CPU selects card/move, if `CardLogic.isPlacementLockedForPlayer(cardState, playerKey)` and `CardLogic.hasActiveTheoryIncarnationForPlayer(cardState, playerKey)` are both true, return an end-turn/pass action compatible with the turn pipeline.

- [ ] **Step 2: Add a simple CPU use heuristic**

Allow CPU to consider `THEORY_INCARNATION` only when:

```ts
CardLogic.getTheoryIncarnationProgress(cardState, playerKey) >= 42
```

Give it a high score when there are at least 8 empty cells and at least 2 spawn candidates.

- [ ] **Step 3: Add debug scenario**

Add `?debug=1&testScenario=theory_incarnation_ready` that:

- puts `theory_incarnation_01` in the current player's hand,
- sets `numberCellCollectedTotalByPlayer[currentPlayer] = 42`,
- gives enough charge to use the card if debug unlimited is off,
- leaves a playable board state.

- [ ] **Step 4: Run focused CPU/debug tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.debug-test-scenarios.test.ts test/game.cpu-policy-core.test.ts test/cpu.turn-handler.pending.test.ts --runInBand
```

Expected: PASS or only known unrelated pre-existing failures documented with exact failing assertions.

## Task 12: Network Authority, Reconnect, And Worker Mirror

**Files:**
- Modify `utils/match-authority.ts` only if snapshot projection/sanitization drops theory fields or hides public theory number cells.
- Modify `utils/match-authority.ts` or Worker command helpers only if locked `useCard` / `place` commands are not rejected authoritatively.
- Modify `workers/match-worker-runtime-preload.ts` if the new resolver/factory module must be installed for Worker runtime.
- Modify `workers/match-worker.ts` only if Worker authority needs explicit action routing for theory auto-turn.
- Generated `worker-public/*`

- [ ] **Step 1: Verify snapshot keeps theory fields**

Add/extend `test/utils.match-authority.public-snapshot.test.ts`:

```ts
expect(sanitized.cardState.theoryIncarnationStateByPlayer).toEqual(source.cardState.theoryIncarnationStateByPlayer);
expect(sanitized.cardState.theoryNumberCellsBySession).toEqual(source.cardState.theoryNumberCellsBySession);
expect(sanitized.cardState.theoryNumberCellByCell).toEqual(source.cardState.theoryNumberCellByCell);
expect(sanitized.cardState.numberCellCollectedTotalByPlayer).toEqual(source.cardState.numberCellCollectedTotalByPlayer);
```

Also verify projection behavior:

```ts
const blackProjection = MatchAuthority.projectSnapshotForViewer(source, 'black');
const whiteProjection = MatchAuthority.projectSnapshotForViewer(source, 'white');
expect(blackProjection.cardState.theoryNumberCellsBySession).toEqual(source.cardState.theoryNumberCellsBySession);
expect(whiteProjection.cardState.theoryNumberCellsBySession).toEqual(source.cardState.theoryNumberCellsBySession);
expect(blackProjection.cardState.theoryNumberCellByCell).toEqual(source.cardState.theoryNumberCellByCell);
expect(whiteProjection.cardState.theoryNumberCellByCell).toEqual(source.cardState.theoryNumberCellByCell);
```

Theory number cells are public board state. Do not treat them like hidden hand/trap owner-only state.

- [ ] **Step 2: Verify command rejection under theory lock**

Add/extend Worker publish tests such as `test/workers.match-publish-sanitize.test.ts` or `test/workers.match-publish-idempotency.test.ts`:

```ts
expect(rejectedUseCard.payload.publishMeta.rejectedReason).toMatch(/LOCKED|CARD_PLAY_LOCKED|COMMAND_REJECTED/);
expect(rejectedPlace.payload.publishMeta.rejectedReason).toMatch(/LOCKED|PLACEMENT_LOCKED|COMMAND_REJECTED/);
expect(room.snapshot.cardState).toEqual(snapshotBeforeRejectedCommand.cardState);
```

Coverage required:

- owner with active `THEORY_INCARNATION` cannot publish `useCard`;
- owner with active `THEORY_INCARNATION` cannot publish normal `place`;
- opponent can still publish normal legal actions on their own turn;
- `BOARD_EXECUTOR` card-play lock behavior is not regressed.

- [ ] **Step 3: Verify authoritative auto-turn publish behavior**

Add a Worker/local authority test that starts with:

```ts
snapshot.gameState.currentPlayer = BLACK;
snapshot.cardState.markers = [{
  kind: 'manifestStone',
  row: 2,
  col: 2,
  owner: 'black',
  data: {
    type: 'THEORY_INCARNATION',
    remainingOwnerTurns: 3,
    sessionId: 'theory_incarnation_black_1',
    absoluteProtected: true
  }
}];
snapshot.cardState.theoryIncarnationStateByPlayer.black = {
  sessionId: 'theory_incarnation_black_1',
  markerId: 1,
  ownerKey: 'black',
  remainingSpawnCount: 3,
  createdTurnIndex: 7
};
snapshot.cardState.theoryNumberCellsBySession.theory_incarnation_black_1 = {
  ownerKey: 'black',
  cells: {
    '0,0': {
      row: 0,
      col: 0,
      value: 5,
      originalValue: null,
      originalConsumed: false,
      spawnType: 'GHOST',
      sourceCardId: 'ghost_01',
      sourceCardType: 'GHOST_WILL',
      sourceCardCost: 5
    }
  }
};
snapshot.cardState.theoryNumberCellByCell = {
  '0,0': { sessionId: 'theory_incarnation_black_1', ownerKey: 'black' }
};
snapshot.cardState.boardBonusByCell = { '0,0': 5 };
snapshot.cardState.boardBonusConsumedByCell = {};
```

Then publish the same no-placement/turn-start command path the network client uses for turn start reconciliation, and assert:

```ts
expect(result.payload.publishKind).toBe('accepted');
expect(result.payload.playbackEvents.some((ev: any) => ev.type === 'theory_incarnation_spawned_start')).toBe(true);
expect(result.payload.playbackEvents.some((ev: any) => ev.type === 'theory_incarnation_auto_turn_end')).toBe(true);
expect(result.payload.snapshot.gameState.currentPlayer).toBe(WHITE);
```

The auto-turn must be an authoritative snapshot transition, not a UI-only local convenience.

- [ ] **Step 4: Verify deterministic random selection**

Add a parity-focused test that runs the same theory turn-start state through local `TurnPipeline.applyTurnSafe` and Worker command publish with the same base version/turn seed. Assert the selected theory cell and spawned marker type match:

```ts
expect(workerSpawn.details[0]).toMatchObject({
  row: localSpawn.details[0].row,
  col: localSpawn.details[0].col,
  specialType: localSpawn.details[0].specialType
});
```

Do not call `Math.random()` directly in theory resolver. Use the injected PRNG from the turn pipeline / Worker seed path.

- [ ] **Step 5: Verify reconnect restores visible state**

Add/extend `test/ui.network-snapshot.*.test.ts` or `test/ui.diff-renderer.manifest-background.test.ts`:

```ts
applySnapshot({
  gameState,
  cardState: {
    ...cardState,
    markers: [{ kind: 'manifestStone', row: 2, col: 2, owner: 'black', data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 2 } }],
    theoryNumberCellsBySession,
    theoryNumberCellByCell,
    boardBonusByCell
  }
});
expect(document.querySelector('.theory-number-cell')).not.toBeNull();
expect(resolveActiveManifestBackgroundKey()).toBe('theory_incarnation_world');
```

If existing test helpers cannot check BGM directly, assert the manifest background key and card/board render state; BGM continuity is covered by existing manifest stone audio routing.

- [ ] **Step 6: Build browser runtime**

Run:

```powershell
npm run build:browser
```

Expected: PASS and `public/module-registry.js` updates if new browser-loaded modules are included.

- [ ] **Step 7: Sync worker mirror**

Run:

```powershell
npm run worker:prepare
```

Expected: PASS and `worker-public/` mirrors root generated/runtime files.

- [ ] **Step 8: Run parity**

Run:

```powershell
npm run test:network:parity
```

Expected: PASS.

## Task 13: Final Verification And Review

**Files:**
- All files touched by previous tasks

- [ ] **Step 1: Run focused theory bundle**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.board-bonus.test.ts test/game.theory-incarnation.test.ts test/game.theory-incarnation.spawn-factory.test.ts test/game.theory-incarnation.turn-start.test.ts test/ui.diff-renderer.theory-number-cell.test.ts test/shared.special-card-registry.test.ts test/cards.catalog.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run focused network authority bundle**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/utils.match-authority.public-snapshot.test.ts test/workers.match-publish-sanitize.test.ts test/workers.match-publish-idempotency.test.ts test/ui.diff-renderer.manifest-background.test.ts --runInBand
```

Expected: PASS. If existing tests in these files have unrelated failures, record exact test names and error text before deciding whether they block this implementation.

- [ ] **Step 3: Run broad safety checks**

Run:

```powershell
npm run typecheck
npm run build:browser
npm run test:network:parity
```

Expected: PASS, except pre-existing unrelated failures must be listed with exact test names and error text.

- [ ] **Step 4: Review diff**

Run:

```powershell
git status --short
git diff -- 01-rulebook.md shared/special-card-registry.ts shared/manifest-stone-registry.ts cards/catalog.json cards/card-interaction-effects.ts game/logic/card-resolution/special-stone-marker-factory.ts game/logic/card-resolution/theory-incarnation.ts game/logic/cards.ts game/logic/cards-internal/state-factory.ts game/turn/action-phase/place-resolution.ts game/turn/turn-start/special-stone-phase.ts game/turn/turn_pipeline_phases.ts utils/match-authority.ts workers/match-worker-runtime-preload.ts workers/match-worker.ts ui/diff-renderer.ts styles-board.css
```

Confirm:

- no `window`, `document`, audio, timer, or network references were added to `game/` or `shared/`;
- `worker-public/` was generated, not source-edited;
- theory number-cell restore cannot erase normal post-use board bonus state;
- theory auto-turn does not bypass turn-start marker/timer processing;
- manifest stone remains inviolable and absolute protected.

- [ ] **Step 5: Commit only if separable**

If `git diff` for touched files contains only this implementation and generated outputs, stage exact paths:

```powershell
git add 01-rulebook.md shared/special-card-registry.ts shared/manifest-stone-registry.ts cards/catalog.json cards/catalog.ts cards/catalog.js cards/catalog.generated.js cards/card-interaction-effects.ts game/logic/card-resolution/special-stone-marker-factory.ts game/logic/card-resolution/theory-incarnation.ts game/logic/cards.ts game/logic/cards-internal/state-factory.ts game/turn/action-phase/place-resolution.ts game/turn/turn-start/special-stone-phase.ts game/turn/turn_pipeline_phases.ts game/cpu-turn-handler.ts game/cpu-decision.ts game/ai/cpu-policy-card-profiles.ts utils/match-authority.ts workers/match-worker-runtime-preload.ts workers/match-worker.ts ui/debug-test-scenarios.ts ui/diff-renderer.ts styles-board.css test/game.board-bonus.test.ts test/game.theory-incarnation.test.ts test/game.theory-incarnation.spawn-factory.test.ts test/game.theory-incarnation.turn-start.test.ts test/ui.diff-renderer.theory-number-cell.test.ts test/utils.match-authority.public-snapshot.test.ts test/workers.match-publish-sanitize.test.ts test/workers.match-publish-idempotency.test.ts test/ui.diff-renderer.manifest-background.test.ts worker-public
git commit -m "feat: implement theory incarnation"
```

If unrelated edits are mixed in any touched file, do not commit. Report the mixed files.

## Self-Review

- Spec coverage: The plan covers printed-number-cell progress tracking, use condition, special-card catalog, cinematic metadata, dedicated theory number cells, temporary audio reuse, manifest stone placement, action lock, complete special-stone marker initialization, auto turn-start spawn, expiry restoration, UI rendering, CPU, debug scenario, network authority, command rejection, deterministic Worker parity, reconnect projection, network parity, and worker mirror.
- Placeholder scan: No open-ended implementation placeholders remain; each task names files, behavior, commands, and expected outcomes.
- Type consistency: The plan consistently uses `theory_incarnation_01`, `THEORY_INCARNATION`, `theoryIncarnationStone`, `numberCellCollectedTotalByPlayer`, `theoryNumberCellsBySession`, `theoryNumberCellByCell`, and `nextTheoryIncarnationStoneByPlayer`.
- Scope check: This is one coherent card implementation. Dedicated future theory audio and more elaborate theory-number visual animation are intentionally outside this plan.

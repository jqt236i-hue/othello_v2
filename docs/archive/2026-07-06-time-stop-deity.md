# Time Stop Deity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `時間停神` as a new high-cost-risk variant of `時間停石`: destroy 9 own stones, turn the next placed stone into a 5-owner-turn delayed time-stop stone, then give the owner 4 total actions including the triggering turn.

**Architecture:** Reuse the existing `TIME_STOP_GOD` runtime by introducing time-stop effect profiles keyed by card type and marker type. Keep `game/` headless: game code emits canonical state and events, while `ui/` and visual maps only render the resulting marker and time-stop active state.

**Tech Stack:** TypeScript/CommonJS modules, card catalog JSON generators, Jest focused tests, existing asset manifest and worker mirror scripts.

---

## Confirmed Spec

- Card display name: `時間停神`.
- Card id: `time_stop_deity_01`.
- Card type: `TIME_STOP_DEITY`.
- Cost: `0`.
- Usage condition: the player has at least 9 destroyable own stones.
- Usage effect: randomly destroy exactly 9 destroyable own stones, then set the player's next placed stone to `時間停神`.
- Marker type: `TIME_STOP_DEITY`; this keeps stone visuals separate from existing `TIME_STOP`.
- Delay: 5 owner turn starts after placement. The placement turn itself does not decrement.
- Trigger: on the 5th owner turn start, activate time stop and revert the marker stone to the same-color normal stone.
- Extra actions: `4` total actions including the triggering turn. Internally this means reserving `4` time-stop consecutive-turn consumptions, matching existing `TIME_STOP_GOD` semantics.
- Fizzle: if the marker cell is empty or no longer owned by the marker owner before trigger, remove the marker and do not reserve actions.
- Protection: no flip protection, same as `時間停石`.
- Visual assets already available:
  - `assets/images/special-stones/TIME_STOP_DEITY-black.png`
  - `assets/images/special-stones/TIME_STOP_DEITY-white.png`
  - card background candidate: `artifacts/time-stop-god-card-background/時間停神-background-256x384.png`

## File Structure

- Modify `01-rulebook.md`: add player-visible rule text near `TIME_STOP_GOD`.
- Modify `正本/カード仕様正本.md`: add the player-facing catalog row.
- Modify `cards/catalog.json`: add the card definition.
- Create `assets/images/card/95_時間停神.png`: promote the prepared background into the card-art folder.
- Regenerate `cards/catalog.ts`, `cards/catalog.js`, `cards/catalog.generated.js`, and `cards/card-art-map.generated.ts`.
- Modify `shared-constants.ts`: add `TIME_STOP_DEITY_*` constants and browser/global exports.
- Modify `game/logic/cards-internal/ribo-time-stop.ts`: profile time-stop variants and expose generic helpers plus compatibility wrappers.
- Modify `game/logic/cards.ts`: pass new constants and export deity wrappers.
- Modify `game/logic/cards-internal/context-builders.ts`: expose deity precheck helper and constants to card usage and marker contexts.
- Modify `game/logic/cards-internal/card-usage-prechecks.ts`: gate `TIME_STOP_DEITY` on 9 destroyable own stones.
- Modify `game/logic/cards-internal/effect-timing.ts`: place a `TIME_STOP_DEITY` marker from deity pending state.
- Modify `game/logic/card-resolution/special-stone-marker-factory.ts`: build marker payloads for `TIME_STOP_DEITY`.
- Modify `shared/special-stone-registry.ts`: register the card-to-marker mapping and marker info.
- Modify `game/turn/turn-start/special-stone-phase.ts`: dispatch both `TIME_STOP` and `TIME_STOP_DEITY` markers through the time-stop turn-start processor.
- Modify `game/turn/presentation-helpers.ts`, `game/turn/pipeline-ui/log-mappers.ts`, and `game/turn/pipeline_ui_adapter.ts`: display `時間停神` where marker/card names are surfaced.
- Modify `game/visual-effects-map.runtime.js`: map `TIME_STOP_DEITY` to the new stone PNGs.
- Modify `cards/card-interaction-effects.ts`, `cards/card-last-used-panel-copy.ts`, and numeric tag tests: expose help/detail/tag text.
- Modify CPU policy files under `game/ai/*`: add conservative profile entries for `TIME_STOP_DEITY`.
- Modify tests listed in tasks below.
- Run `npm run worker:prepare` after root implementation and tests pass; do not edit `worker-public/` by hand.

---

### Task 1: Lock Player-Facing Specification

**Files:**
- Modify: `01-rulebook.md`
- Modify: `正本/カード仕様正本.md`

- [ ] **Step 1: Update `01-rulebook.md` before implementation**

Add this section after `10.13.1 TIME_STOP_GOD（時間停石）`:

```markdown
### 10.13.2 TIME_STOP_DEITY（時間停神）

- コスト0
- ドロー後は通常の手札カードとして表示され、条件を満たせば選択・使用できる。
- 自分石9つを壊し、次石を時間停神化。5ターン後時間停止を発動し4連続行動できる。
- 時間停神の石ビジュアルは、通常石ではなく黒白別の専用画像を使う
- 時間停神は反転保護を持たない
- 配置ターンは減算せず、以後は所有者ターン開始ごとにカウント減少する
- 5回目の所有者ターン開始時に時間停止が発動し、そのターンを含めて同じプレイヤーが合計4回連続で行動する
- 時間停止中のモノクロ表示、BGM停止、合法手・自由配置可能マス・友好選択マスの白強調、発動中ラベル表示は時間停石と同じ
- UI表示: 発動までの残り回数は下中央の赤い三角形カウントダウンで表示する
- 発動時、時間停神の効果は終了し、その石は同色の通常石に戻る
- 発動前に時間停神が空マスになった、または所有者の石でなくなった場合は不発で終了する
```

- [ ] **Step 2: Update `正本/カード仕様正本.md`**

Add a row near `時間停石`:

```markdown
| 時間停神 | 禁忌 | 0 | 特殊 | 手札に残り、使用時に自分石9つを破壊して次石を時間停神化する。成立した場合、5回目の所有者ターン開始時に時間停止を発動し、発動したターンを含めて同じプレイヤーが合計4回連続で行動する。発動後は同色の通常石に戻る。 |
```

- [ ] **Step 3: Inspect documentation diff**

Run:

```powershell
git diff -- 01-rulebook.md 正本/カード仕様正本.md
git diff --check -- 01-rulebook.md 正本/カード仕様正本.md
```

Expected: only the `時間停神` spec text is added; `git diff --check` exits `0`.

- [ ] **Step 4: Commit spec**

Run:

```powershell
git add -- 01-rulebook.md 正本/カード仕様正本.md
git commit -m "Document time stop deity card spec"
```

Expected: one docs-only commit.

---

### Task 2: Add Catalog Entry And Card Face Asset

**Files:**
- Modify: `cards/catalog.json`
- Modify generated: `cards/catalog.ts`
- Modify generated: `cards/catalog.js`
- Modify generated: `cards/catalog.generated.js`
- Modify generated: `cards/card-art-map.generated.ts`
- Create: `assets/images/card/95_時間停神.png`

- [ ] **Step 1: Copy the prepared card art into the canonical card-art folder**

Run:

```powershell
Copy-Item -LiteralPath 'artifacts/time-stop-god-card-background/時間停神-background-256x384.png' -Destination 'assets/images/card/95_時間停神.png'
```

Expected: `assets/images/card/95_時間停神.png` exists and remains `256x384`.

- [ ] **Step 2: Add card definition to `cards/catalog.json`**

Insert after `time_stop_god_01`:

```json
{
  "id": "time_stop_deity_01",
  "name_ja": "時間停神",
  "type": "TIME_STOP_DEITY",
  "cost": 0,
  "desc_ja": "手札に残り、使用時に自分石9つを破壊して次に置く石を時間停神化。5ターン後時間停止を発動し4連続行動できる。",
  "display_type_ja": "禁忌"
}
```

- [ ] **Step 3: Regenerate catalog and art map**

Run:

```powershell
node scripts/generate-catalog.js
node scripts/generate-card-art-map.js
```

Expected:

```text
Generated C:\Users\quarr\Desktop\othello_v2\cards\catalog.generated.js
Generated C:\Users\quarr\Desktop\othello_v2\cards\catalog.js
Generated C:\Users\quarr\Desktop\othello_v2\cards\catalog.ts
Generated C:\Users\quarr\Desktop\othello_v2\cards\card-art-map.generated.ts
```

- [ ] **Step 4: Verify catalog surfaces**

Run:

```powershell
rg -n "time_stop_deity_01|TIME_STOP_DEITY|時間停神" cards assets/images/card
```

Expected: matches in `cards/catalog.json`, `cards/catalog.ts`, `cards/catalog.js`, `cards/catalog.generated.js`, `cards/card-art-map.generated.ts`, and `assets/images/card/95_時間停神.png`.

- [ ] **Step 5: Add focused catalog/art tests**

Create `test/cards.time-stop-deity-surfaces.test.ts` with:

```ts
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXPECTED = {
  id: 'time_stop_deity_01',
  name_ja: '時間停神',
  type: 'TIME_STOP_DEITY',
  cost: 0,
  desc_ja: '手札に残り、使用時に自分石9つを破壊して次に置く石を時間停神化。5ターン後時間停止を発動し4連続行動できる。',
  display_type_ja: '禁忌'
};

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, file), 'utf8'));
}

describe('TIME_STOP_DEITY catalog and card art surfaces', () => {
  test('catalog json contains the new card definition', () => {
    const catalog = readJson('cards/catalog.json');
    const card = catalog.cards.find((entry: any) => entry.id === EXPECTED.id);
    expect(card).toEqual(EXPECTED);
  });

  test('generated card art map resolves 時間停神 artwork', () => {
    const artMap = require('../cards/card-art-map.generated');
    expect(artMap.CARD_FACE_ART_FILENAME_BY_ID[EXPECTED.id]).toBe('95_時間停神.png');
    expect(fs.existsSync(path.join(PROJECT_ROOT, 'assets/images/card/95_時間停神.png'))).toBe(true);
  });
});
```

- [ ] **Step 6: Run focused catalog test**

Run:

```powershell
npm run test:jest -- test/cards.time-stop-deity-surfaces.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit catalog and card art**

Run:

```powershell
git add -- cards/catalog.json cards/catalog.ts cards/catalog.js cards/catalog.generated.js cards/card-art-map.generated.ts assets/images/card/95_時間停神.png test/cards.time-stop-deity-surfaces.test.ts
git commit -m "Add time stop deity catalog entry"
```

Expected: one commit containing catalog, generated catalog, card art, and focused catalog test.

---

### Task 3: Add Shared Constants And Time-Stop Profiles

**Files:**
- Modify: `shared-constants.ts`
- Modify: `game/logic/cards-internal/ribo-time-stop.ts`
- Modify: `game/logic/cards.ts`
- Modify: `game/logic/cards-internal/context-builders.ts`

- [ ] **Step 1: Add constants to `shared-constants.ts`**

Add next to existing `TIME_STOP_GOD_*` constants:

```ts
export const TIME_STOP_DEITY_TURNS = 5;
export const TIME_STOP_DEITY_CONSECUTIVE_TURNS = 4;
export const TIME_STOP_DEITY_SELF_DESTROY_COUNT = 9;
```

Add browser globals:

```ts
(window as any).TIME_STOP_DEITY_TURNS = TIME_STOP_DEITY_TURNS;
(window as any).TIME_STOP_DEITY_CONSECUTIVE_TURNS = TIME_STOP_DEITY_CONSECUTIVE_TURNS;
(window as any).TIME_STOP_DEITY_SELF_DESTROY_COUNT = TIME_STOP_DEITY_SELF_DESTROY_COUNT;
```

Add default export entries:

```ts
TIME_STOP_DEITY_TURNS,
TIME_STOP_DEITY_CONSECUTIVE_TURNS,
TIME_STOP_DEITY_SELF_DESTROY_COUNT,
```

- [ ] **Step 2: Extend `RiboTimeStopConstants`**

In `game/logic/cards-internal/ribo-time-stop.ts`, extend the type:

```ts
type RiboTimeStopConstants = {
    RIBO_WILL_OWNER_TURNS: number;
    RIBO_WILL_INITIAL_GAIN: number;
    RIBO_WILL_REPAYMENT_AMOUNT: number;
    RIBO_WILL_SHORTAGE_DESTROY_COUNT: number;
    TIME_STOP_GOD_TURNS: number;
    TIME_STOP_GOD_CONSECUTIVE_TURNS: number;
    TIME_STOP_GOD_SELF_DESTROY_COUNT: number;
    TIME_STOP_DEITY_TURNS: number;
    TIME_STOP_DEITY_CONSECUTIVE_TURNS: number;
    TIME_STOP_DEITY_SELF_DESTROY_COUNT: number;
};
```

- [ ] **Step 3: Add profile helpers to `ribo-time-stop.ts`**

Add below `ensureTimeStopConsecutiveTurnsRemainingByPlayer`:

```ts
type TimeStopProfile = {
    cardType: string;
    markerType: string;
    displayName: string;
    turns: number;
    consecutiveTurns: number;
    destroyCount: number;
    costReason: string;
};

function readPositiveConstant(value: any, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function getTimeStopProfile(cardType: any, deps: RiboTimeStopDeps): TimeStopProfile | null {
    const type = String(cardType || '').trim().toUpperCase();
    if (type === 'TIME_STOP_DEITY') {
        return {
            cardType: 'TIME_STOP_DEITY',
            markerType: 'TIME_STOP_DEITY',
            displayName: '時間停神',
            turns: readPositiveConstant(deps.constants.TIME_STOP_DEITY_TURNS, 5),
            consecutiveTurns: readPositiveConstant(deps.constants.TIME_STOP_DEITY_CONSECUTIVE_TURNS, 4),
            destroyCount: readPositiveConstant(deps.constants.TIME_STOP_DEITY_SELF_DESTROY_COUNT, 9),
            costReason: 'time_stop_deity_cost'
        };
    }
    if (type === 'TIME_STOP_GOD') {
        return {
            cardType: 'TIME_STOP_GOD',
            markerType: 'TIME_STOP',
            displayName: '時間停石',
            turns: readPositiveConstant(deps.constants.TIME_STOP_GOD_TURNS, 5),
            consecutiveTurns: readPositiveConstant(deps.constants.TIME_STOP_GOD_CONSECUTIVE_TURNS, 2),
            destroyCount: readPositiveConstant(deps.constants.TIME_STOP_GOD_SELF_DESTROY_COUNT, 3),
            costReason: 'time_stop_god_cost'
        };
    }
    return null;
}

function getTimeStopProfileByMarkerType(markerType: any, deps: RiboTimeStopDeps): TimeStopProfile | null {
    const type = String(markerType || '').trim().toUpperCase();
    if (type === 'TIME_STOP_DEITY') return getTimeStopProfile('TIME_STOP_DEITY', deps);
    if (type === 'TIME_STOP') return getTimeStopProfile('TIME_STOP_GOD', deps);
    return null;
}
```

- [ ] **Step 4: Replace hard-coded destroy count usage with profile-aware helpers**

Change `getTimeStopGodDestroyableCount`, `canUseTimeStopGodForPlayer`, and `resolveTimeStopGodUsage` by introducing generic functions:

```ts
function getTimeStopDestroyableCount(cardState: any, gameState: any, playerKey: any, cardType: any, deps: RiboTimeStopDeps) {
    const profile = getTimeStopProfile(cardType, deps);
    if (!profile) return 0;
    return collectTimeStopGodDestroyableOwnStonePositions(cardState, gameState, playerKey, deps).length;
}

function canUseTimeStopCardForPlayer(cardState: any, gameState: any, playerKey: any, cardType: any, deps: RiboTimeStopDeps) {
    const profile = getTimeStopProfile(cardType, deps);
    if (!profile || !gameState || !Array.isArray(gameState.board)) return false;
    return getTimeStopDestroyableCount(cardState, gameState, playerKey, cardType, deps) >= profile.destroyCount;
}

function resolveTimeStopCardUsage(cardState: any, gameState: any, playerKey: any, cardType: any, prng: any, deps: RiboTimeStopDeps) {
    const profile = getTimeStopProfile(cardType, deps);
    if (!profile) {
        return { applied: false, reason: 'unknown_time_stop_card' };
    }
    const targets = deps.sampleRandomPositions(
        collectTimeStopGodDestroyableOwnStonePositions(cardState, gameState, playerKey, deps),
        profile.destroyCount,
        prng
    );
    const destroyed = [];

    for (const target of targets) {
        if (!target) continue;
        const destroyRes = deps.destroyCellWithPresentation(
            cardState,
            gameState,
            target.row,
            target.col,
            profile.cardType,
            profile.costReason,
            { owner: playerKey, cardType: profile.cardType, markerType: profile.markerType }
        );
        if (destroyRes && destroyRes.destroyed) {
            destroyed.push({ row: target.row, col: target.col });
        }
    }

    return {
        applied: true,
        cardType: profile.cardType,
        markerType: profile.markerType,
        requestedCount: profile.destroyCount,
        destroyedCount: destroyed.length,
        destroyed
    };
}
```

Keep compatibility wrappers:

```ts
function getTimeStopGodDestroyableCount(cardState: any, gameState: any, playerKey: any, deps: RiboTimeStopDeps) {
    return getTimeStopDestroyableCount(cardState, gameState, playerKey, 'TIME_STOP_GOD', deps);
}

function getTimeStopDeityDestroyableCount(cardState: any, gameState: any, playerKey: any, deps: RiboTimeStopDeps) {
    return getTimeStopDestroyableCount(cardState, gameState, playerKey, 'TIME_STOP_DEITY', deps);
}

function canUseTimeStopGodForPlayer(cardState: any, gameState: any, playerKey: any, deps: RiboTimeStopDeps) {
    return canUseTimeStopCardForPlayer(cardState, gameState, playerKey, 'TIME_STOP_GOD', deps);
}

function canUseTimeStopDeityForPlayer(cardState: any, gameState: any, playerKey: any, deps: RiboTimeStopDeps) {
    return canUseTimeStopCardForPlayer(cardState, gameState, playerKey, 'TIME_STOP_DEITY', deps);
}

function resolveTimeStopGodUsage(cardState: any, gameState: any, playerKey: any, prng: any, deps: RiboTimeStopDeps) {
    return resolveTimeStopCardUsage(cardState, gameState, playerKey, 'TIME_STOP_GOD', prng, deps);
}

function resolveTimeStopDeityUsage(cardState: any, gameState: any, playerKey: any, prng: any, deps: RiboTimeStopDeps) {
    return resolveTimeStopCardUsage(cardState, gameState, playerKey, 'TIME_STOP_DEITY', prng, deps);
}
```

- [ ] **Step 5: Make turn-start processing marker-aware**

Change the signature and marker lookup:

```ts
function processTimeStopEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: any, row: any, col: any, markerType: any, deps: RiboTimeStopDeps) {
    const profile = getTimeStopProfileByMarkerType(markerType, deps);
    if (!profile) {
        return { triggered: [], fizzled: [] };
    }
    const marker = deps.findSpecialMarkerAt(cardState, row, col, profile.markerType, playerKey);
    if (!marker) {
        return { triggered: [], fizzled: [] };
    }
```

Inside the function, replace hard-coded `TIME_STOP` and constants with profile fields:

```ts
deps.removeMarkersAt(cardState, row, col, { kind: deps.specialStoneKind, type: profile.markerType, owner: playerKey });
```

```ts
: profile.turns;
```

```ts
deps.revertSpecialStoneWithPresentation(cardState, gameState, row, col, profile.markerType, playerKey, profile.cardType, 'duration_end', {
    owner: playerKey,
    timer: 0,
    cardType: profile.cardType,
    markerType: profile.markerType
});
const totalReservedTurns = reserveTimeStopConsecutiveTurns(cardState, playerKey, profile.consecutiveTurns, deps);
return {
    triggered: [{ row, col, owner: playerKey, cardType: profile.cardType, markerType: profile.markerType, displayName: profile.displayName, totalReservedTurns }],
    fizzled: []
};
```

- [ ] **Step 6: Export new helpers from `ribo-time-stop.ts`**

Update `module.exports`:

```ts
module.exports = {
    armRiboWillEffect,
    getTimeStopGodDestroyableCount,
    getTimeStopDeityDestroyableCount,
    canUseTimeStopGodForPlayer,
    canUseTimeStopDeityForPlayer,
    resolveTimeStopGodUsage,
    resolveTimeStopDeityUsage,
    consumeTimeStopConsecutiveTurn,
    processTimeStopEffectsAtTurnStartAnchor,
    processRiboWillTurnStartEffects
};
```

- [ ] **Step 7: Wire constants and wrappers in `game/logic/cards.ts`**

Import aliases near existing shared constants:

```ts
TIME_STOP_DEITY_TURNS as SHARED_TIME_STOP_DEITY_TURNS,
TIME_STOP_DEITY_CONSECUTIVE_TURNS as SHARED_TIME_STOP_DEITY_CONSECUTIVE_TURNS,
TIME_STOP_DEITY_SELF_DESTROY_COUNT as SHARED_TIME_STOP_DEITY_SELF_DESTROY_COUNT,
```

Define local constants:

```ts
const TIME_STOP_DEITY_TURNS = Number.isFinite(Number(SHARED_TIME_STOP_DEITY_TURNS))
    ? Math.max(1, Math.floor(Number(SHARED_TIME_STOP_DEITY_TURNS)))
    : 5;
const TIME_STOP_DEITY_CONSECUTIVE_TURNS = Number.isFinite(Number(SHARED_TIME_STOP_DEITY_CONSECUTIVE_TURNS))
    ? Math.max(1, Math.floor(Number(SHARED_TIME_STOP_DEITY_CONSECUTIVE_TURNS)))
    : 4;
const TIME_STOP_DEITY_SELF_DESTROY_COUNT = Number.isFinite(Number(SHARED_TIME_STOP_DEITY_SELF_DESTROY_COUNT))
    ? Math.max(1, Math.floor(Number(SHARED_TIME_STOP_DEITY_SELF_DESTROY_COUNT)))
    : 9;
```

Add these to `getCardRiboTimeStopDeps().constants`.

Add wrappers:

```ts
function getTimeStopDeityDestroyableCount(cardState: any, gameState: any, playerKey: any) {
    return CardRiboTimeStopModule.getTimeStopDeityDestroyableCount(cardState, gameState, playerKey, getCardRiboTimeStopDeps());
}

function canUseTimeStopDeityForPlayer(cardState: any, gameState: any, playerKey: any) {
    return CardRiboTimeStopModule.canUseTimeStopDeityForPlayer(cardState, gameState, playerKey, getCardRiboTimeStopDeps());
}

function resolveTimeStopDeityUsage(cardState: any, gameState: any, playerKey: any, prng: any) {
    return CardRiboTimeStopModule.resolveTimeStopDeityUsage(cardState, gameState, playerKey, prng, getCardRiboTimeStopDeps());
}
```

Export these wrappers from the final public object.

- [ ] **Step 8: Expose helpers in `context-builders.ts`**

Add `canUseTimeStopDeityForPlayer` to the card usage context:

```ts
canUseTimeStopDeityForPlayer: helpers.canUseTimeStopDeityForPlayer,
```

Add constants to timing contexts:

```ts
TIME_STOP_DEITY_TURNS: constants.TIME_STOP_DEITY_TURNS,
TIME_STOP_DEITY_CONSECUTIVE_TURNS: constants.TIME_STOP_DEITY_CONSECUTIVE_TURNS,
TIME_STOP_DEITY_SELF_DESTROY_COUNT: constants.TIME_STOP_DEITY_SELF_DESTROY_COUNT,
```

- [ ] **Step 9: Add focused tests for constants and helper exports**

Extend `test/game.cards.context-builders-module.test.ts`:

```ts
expect(builders.getCardUsagePrecheckContext({ helpers, constants }).canUseTimeStopDeityForPlayer).toBe(helpers.canUseTimeStopDeityForPlayer);
expect(builders.getEffectTimingContext({ helpers, constants }).constants.TIME_STOP_DEITY_TURNS).toBe(5);
```

- [ ] **Step 10: Run focused helper tests**

Run:

```powershell
npm run test:jest -- test/game.cards.context-builders-module.test.ts test/game.time-stop-god.test.ts
```

Expected: PASS; existing `時間停石` behavior remains unchanged.

- [ ] **Step 11: Commit shared runtime refactor**

Run:

```powershell
git add -- shared-constants.ts game/logic/cards-internal/ribo-time-stop.ts game/logic/cards.ts game/logic/cards-internal/context-builders.ts test/game.cards.context-builders-module.test.ts
git commit -m "Add time stop deity runtime profile"
```

Expected: one commit; `TIME_STOP_GOD` tests still pass.

---

### Task 4: Wire Card Use, Placement, Marker, And Turn Start

**Files:**
- Modify: `game/logic/cards-internal/card-usage-prechecks.ts`
- Modify: `game/logic/cards-internal/effect-timing.ts`
- Modify: `game/logic/card-resolution/special-stone-marker-factory.ts`
- Modify: `shared/special-stone-registry.ts`
- Modify: `game/turn/turn-start/special-stone-phase.ts`
- Modify: `test/game.special-stone-marker-factory.test.ts`
- Modify: `test/shared.special-stone-registry.test.ts`
- Create: `test/game.time-stop-deity.test.ts`

- [ ] **Step 1: Add precheck gate**

In `game/logic/cards-internal/card-usage-prechecks.ts`, add:

```ts
if (cardType === 'TIME_STOP_DEITY') {
    if (typeof context.canUseTimeStopDeityForPlayer !== 'function') {
        return buildFailureResult();
    }
    return context.canUseTimeStopDeityForPlayer(context.cardState, context.gameState, context.playerKey)
        ? result
        : buildFailureResult();
}
```

- [ ] **Step 2: Resolve deity cost in card usage**

In `game/logic/cards.ts`, where `TIME_STOP_GOD` usage resolves cost, add a sibling branch:

```ts
if (cardType === 'TIME_STOP_DEITY') {
    const timeStopDeityUsage = resolveTimeStopDeityUsage(cardState, gameState, playerKey, prng);
    if (!timeStopDeityUsage || timeStopDeityUsage.applied !== true) return false;
    emitEvent(events, {
        type: 'time_stop_deity_cost_resolved',
        player: playerKey,
        requestedCount: timeStopDeityUsage.requestedCount,
        destroyedCount: timeStopDeityUsage.destroyedCount,
        destroyed: timeStopDeityUsage.destroyed
    });
}
```

If the existing code centralizes `TIME_STOP_GOD` cost in a helper, add `TIME_STOP_DEITY` to that helper instead of duplicating the surrounding hand/discard code.

- [ ] **Step 3: Add pending placement marker in `effect-timing.ts`**

Replace the single `TIME_STOP_GOD` placement branch with:

```ts
if (pending && (pending.type === 'TIME_STOP_GOD' || pending.type === 'TIME_STOP_DEITY') && typeof helpers.addMarker === 'function') {
    const isDeity = pending.type === 'TIME_STOP_DEITY';
    const remainingOwnerTurns = Number.isFinite(Number(isDeity ? constants.TIME_STOP_DEITY_TURNS : constants.TIME_STOP_GOD_TURNS))
        ? Math.max(1, Math.trunc(Number(isDeity ? constants.TIME_STOP_DEITY_TURNS : constants.TIME_STOP_GOD_TURNS)))
        : 5;
    helpers.addMarker(cardState, 'specialStone', row, col, owner, {
        type: isDeity ? 'TIME_STOP_DEITY' : 'TIME_STOP',
        remainingOwnerTurns
    });
    effects.timeStopPlaced = true;
    effects.timeStopMarkerType = isDeity ? 'TIME_STOP_DEITY' : 'TIME_STOP';
}
```

- [ ] **Step 4: Add marker factory branch**

In `special-stone-marker-factory.ts`, add fallback:

```ts
TIME_STOP_DEITY: 5,
```

Add switch branch:

```ts
case 'TIME_STOP_DEITY':
    return {
        type: readRegistryMarkerType(type, deps) || 'TIME_STOP_DEITY',
        remainingOwnerTurns: readPositiveInt(constants.TIME_STOP_DEITY_TURNS, FALLBACK_TURNS.TIME_STOP_DEITY)
    };
```

- [ ] **Step 5: Register special stone**

In `shared/special-stone-registry.ts`, add to stone info:

```ts
TIME_STOP_DEITY: Object.freeze({
    name: '時間停神',
    desc: '5回目の所有者ターン開始時に時間停止を発動し、発動したターンを含めて合計4回連続で行動する。',
    timerClass: 'special-timer'
}),
```

Add to `SPECIAL_STONE_CARD_DEFINITIONS`:

```ts
TIME_STOP_DEITY: Object.freeze({ cardId: 'time_stop_deity_01', cardNameJa: '時間停神', cardType: 'TIME_STOP_DEITY', markerType: 'TIME_STOP_DEITY' }),
```

- [ ] **Step 6: Dispatch deity marker at turn start**

In `game/turn/turn-start/special-stone-phase.ts`, change:

```ts
if (typeKey === 'TIME_STOP' && owner === opts.playerKey && typeof opts.CardLogic.processTimeStopEffectsAtTurnStartAnchor === 'function') {
    const res = opts.CardLogic.processTimeStopEffectsAtTurnStartAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col);
```

to:

```ts
if ((typeKey === 'TIME_STOP' || typeKey === 'TIME_STOP_DEITY') && owner === opts.playerKey && typeof opts.CardLogic.processTimeStopEffectsAtTurnStartAnchor === 'function') {
    const res = opts.CardLogic.processTimeStopEffectsAtTurnStartAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col, typeKey);
```

- [ ] **Step 7: Add gameplay tests**

Create `test/game.time-stop-deity.test.ts` by copying the structure of `test/game.time-stop-god.test.ts` and changing constants/assertions:

```ts
import * as Shared from '../shared-constants.js';
import * as Core from '../game/logic/core.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';

function createPrng(randomValue = 0) {
  return { shuffle: (arr: any[]) => arr, random: () => randomValue };
}

function createEmptyGameState() {
  const gameState = Core.createGameState();
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
  gameState.currentPlayer = Core.BLACK;
  gameState.turnNumber = 1;
  gameState.consecutivePasses = 0;
  return gameState;
}

function getTimeStopDeityDef() {
  return (Shared.CARD_DEFS || []).find((card: any) => card && card.type === 'TIME_STOP_DEITY');
}

describe('TIME_STOP_DEITY（時間停神）', () => {
  test('破壊可能自石が9個未満では使用できない', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    const def = getTimeStopDeityDef();
    cardState.debugNoDraw = true;
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;
    for (let col = 0; col < 8; col += 1) gameState.board[0][col] = Core.BLACK;

    expect(CardLogic.getTimeStopDeityDestroyableCount(cardState, gameState, 'black')).toBe(8);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', def.id)).toBe(false);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('使用時に9個の自石を破壊し、次配置で時間停神 marker を置く', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    const def = getTimeStopDeityDef();
    cardState.debugNoDraw = true;
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;
    for (let col = 0; col < 8; col += 1) gameState.board[0][col] = Core.BLACK;
    gameState.board[1][0] = Core.BLACK;
    gameState.board[2][4] = Core.WHITE;
    gameState.board[2][5] = Core.BLACK;

    const useRes = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'use_card', useCardId: def.id, useCardOwnerKey: 'black' }, prng, { skipTurnStart: true });
    const costResolved = useRes.events.find((event: any) => event && event.type === 'time_stop_deity_cost_resolved');
    expect(costResolved.destroyedCount).toBe(Shared.TIME_STOP_DEITY_SELF_DESTROY_COUNT);
    expect(costResolved.destroyed).toHaveLength(9);

    TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 }, prng, { skipTurnStart: true });
    const marker = (cardState.markers || []).find((entry: any) => entry && entry.kind === 'specialStone' && entry.row === 2 && entry.col === 3 && entry.owner === 'black' && entry.data && entry.data.type === 'TIME_STOP_DEITY');
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(Shared.TIME_STOP_DEITY_TURNS);
  });

  test('5回目の所有者ターン開始で発動し、合計4回行動を予約する', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    gameState.board[3][3] = Core.BLACK;
    cardState.markers.push({ id: 9301, kind: 'specialStone', row: 3, col: 3, owner: 'black', data: { type: 'TIME_STOP_DEITY', remainingOwnerTurns: Shared.TIME_STOP_DEITY_TURNS } });

    for (let i = 0; i < 4; i += 1) {
      const events: any[] = [];
      TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', events, prng);
      expect(events.some((event: any) => event && event.type === 'time_stop_triggered')).toBe(false);
    }

    const events: any[] = [];
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', events, prng);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'time_stop_triggered', player: 'black', row: 3, col: 3, remainingBonusTurns: Shared.TIME_STOP_DEITY_CONSECUTIVE_TURNS })
    ]));
    expect(cardState.timeStopConsecutiveTurnsRemainingByPlayer.black).toBe(4);
    expect((cardState.markers || []).some((entry: any) => entry && entry.id === 9301)).toBe(false);
    expect(gameState.board[3][3]).toBe(Core.BLACK);
  });
});
```

- [ ] **Step 8: Update registry and marker tests**

In `test/shared.special-stone-registry.test.ts`, add:

```ts
['time_stop_deity_01', 'TIME_STOP_DEITY', 'TIME_STOP_DEITY'],
```

In `test/game.special-stone-marker-factory.test.ts`, add an assertion:

```ts
expect(factory.buildMarkerDataForCardType('TIME_STOP_DEITY', { constants: { TIME_STOP_DEITY_TURNS: 5 }, SpecialStoneRegistry })).toEqual({
  type: 'TIME_STOP_DEITY',
  remainingOwnerTurns: 5
});
```

- [ ] **Step 9: Run focused gameplay tests**

Run:

```powershell
npm run test:jest -- test/game.time-stop-deity.test.ts test/game.time-stop-god.test.ts test/shared.special-stone-registry.test.ts test/game.special-stone-marker-factory.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit game logic**

Run:

```powershell
git add -- game/logic/cards-internal/card-usage-prechecks.ts game/logic/cards-internal/effect-timing.ts game/logic/card-resolution/special-stone-marker-factory.ts shared/special-stone-registry.ts game/turn/turn-start/special-stone-phase.ts test/game.time-stop-deity.test.ts test/shared.special-stone-registry.test.ts test/game.special-stone-marker-factory.test.ts
git commit -m "Implement time stop deity marker flow"
```

Expected: one logic commit.

---

### Task 5: Add Visuals, Help Text, Logs, And CPU Policy

**Files:**
- Modify: `game/visual-effects-map.runtime.js`
- Modify: `test/ui.visual-effects-map.shared.test.ts`
- Modify: `test/assets.images.test.ts`
- Modify: `cards/card-interaction-effects.ts`
- Modify: `cards/card-last-used-panel-copy.ts`
- Modify: `test/cards.numeric-effect-tags.test.ts`
- Modify: `test/ui.card-detail-effect-tags.test.ts`
- Modify: `game/turn/presentation-helpers.ts`
- Modify: `game/turn/pipeline-ui/log-mappers.ts`
- Modify: `game/turn/pipeline_ui_adapter.ts`
- Modify: `game/ai/cpu-policy-card-taxonomy.ts`
- Modify: `game/ai/cpu-policy-card-type-flags.ts`
- Modify: `game/ai/cpu-policy-card-profiles.ts`
- Modify: `game/cpu-decision-plan-pressure.ts`

- [ ] **Step 1: Add visual map entries**

In `game/visual-effects-map.runtime.js`, add:

```js
const TIME_STOP_DEITY_STONE_IMAGE_BY_OWNER = {
    '1': 'assets/images/special-stones/TIME_STOP_DEITY-black.png',
    '-1': 'assets/images/special-stones/TIME_STOP_DEITY-white.png'
};
```

Add effect definition near `timeStopStone`:

```js
timeStopDeityStone: {
    cssClass: 'time-stop-deity-stone',
    cssMethod: 'pseudoElement',
    imagePathByOwner: TIME_STOP_DEITY_STONE_IMAGE_BY_OWNER,
    dataAttributes: {}
},
```

Add mappings:

```js
'TIME_STOP_DEITY': 'timeStopDeityStone',
```

to both `PENDING_TYPE_TO_EFFECT_KEY` and `SPECIAL_TYPE_TO_EFFECT_KEY`.

- [ ] **Step 2: Extend visual and asset tests**

In `test/assets.images.test.ts`, add:

```ts
assert.ok(fs.existsSync(path.join(specialStonesDir, 'TIME_STOP_DEITY-black.png')));
assert.ok(fs.existsSync(path.join(specialStonesDir, 'TIME_STOP_DEITY-white.png')));
```

In `test/ui.visual-effects-map.shared.test.ts`, add:

```ts
test('TIME_STOP_DEITY uses dedicated PNG stone images', async () => {
  const shared = await loadVisualEffectsMap();
  expect(shared.PENDING_TYPE_TO_EFFECT_KEY.TIME_STOP_DEITY).toBe('timeStopDeityStone');
  expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY.TIME_STOP_DEITY).toBe('timeStopDeityStone');
  const map = shared.STONE_VISUAL_EFFECTS.timeStopDeityStone;
  expect(map.imagePathByOwner['1']).toContain('TIME_STOP_DEITY-black.png');
  expect(map.imagePathByOwner['-1']).toContain('TIME_STOP_DEITY-white.png');
});
```

- [ ] **Step 3: Add card help text**

In `cards/card-interaction-effects.ts`, add quick text:

```ts
TIME_STOP_DEITY: '使用時に自分石9つを破壊して次石を時間停神化。5ターン後に4連続行動。',
```

Add detail text:

```ts
TIME_STOP_DEITY: '使用時に自分石9つを破壊し、次に置く石を時間停神化する。\n5回目の所有者ターン開始時に時間停止し、発動したターンを含めて合計4回連続で行動する。\n発動後は通常石に戻り、先に空マスになるか相手色になると不発。\n反転保護は持たない。',
```

Add tags:

```ts
TIME_STOP_DEITY: freezeCardEffectTags([specialStoneTag(), delayedActivationTurnsTag(5)]),
```

In `cards/card-last-used-panel-copy.ts`, add:

```ts
time_stop_deity_01: '自分石9つを代償に時間停神を置き、5ターン後に4連続行動する。',
```

- [ ] **Step 4: Add log/display names**

Add `TIME_STOP_DEITY` / `時間停神` to log name helpers in `game/turn/pipeline-ui/log-mappers.ts` and presentation helper mappings. Use `時間停神` for marker type `TIME_STOP_DEITY`; keep `TIME_STOP` as `時間停石`.

- [ ] **Step 5: Add CPU policy entries conservatively**

Mirror `TIME_STOP_GOD` entries, with slightly higher risk/high-variance treatment:

```ts
TIME_STOP_DEITY
```

Add it to high-variance card sets and special-stone/anchor-engine classifications where `TIME_STOP_GOD` appears. In `game/cpu-decision-plan-pressure.ts`, use:

```ts
TIME_STOP_DEITY: makePlanPressureProfile(9, 7, 5, 4),
```

In `game/ai/cpu-policy-card-profiles.ts`, start with:

```ts
TIME_STOP_DEITY: { leadBias: -12, trailingBias: 12, midLateBias: 8, endgameBias: -12, cornerNowBias: 2, cornerEmergencyBias: 6, lowMobilityBias: 5, handPressureBias: 2 },
```

and placement:

```ts
TIME_STOP_DEITY: { archetype: 'anchorEngine', placementWeight: 3, cornerBias: 5, edgeBias: 4, innerBias: -2, emptyAdjBias: -1, ownAdjBias: 3, oppAdjBias: -1, stabilityBias: 6 },
```

- [ ] **Step 6: Run focused surface tests**

Run:

```powershell
npm run test:jest -- test/assets.images.test.ts test/ui.visual-effects-map.shared.test.ts test/cards.numeric-effect-tags.test.ts test/ui.card-detail-effect-tags.test.ts test/cpu.decision.refactor.test.ts test/game.cpu-policy-core.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit presentation and CPU surfaces**

Run:

```powershell
git add -- game/visual-effects-map.runtime.js test/ui.visual-effects-map.shared.test.ts test/assets.images.test.ts cards/card-interaction-effects.ts cards/card-last-used-panel-copy.ts test/cards.numeric-effect-tags.test.ts test/ui.card-detail-effect-tags.test.ts game/turn/presentation-helpers.ts game/turn/pipeline-ui/log-mappers.ts game/turn/pipeline_ui_adapter.ts game/ai/cpu-policy-card-taxonomy.ts game/ai/cpu-policy-card-type-flags.ts game/ai/cpu-policy-card-profiles.ts game/cpu-decision-plan-pressure.ts
git commit -m "Add time stop deity presentation surfaces"
```

Expected: one commit.

---

### Task 6: Network Snapshot, Manifest, Typecheck, And Worker Mirror

**Files:**
- Modify tests as needed:
  - `test/utils.match-authority.public-snapshot.test.ts`
  - `test/workers.match-publish-sanitize.test.ts`
  - `test/network.playback-event-assembly.contract.test.ts`
- Modify generated: `assets/asset-manifest.json`
- Modify generated/mirror: `worker-public/*`

- [ ] **Step 1: Add public snapshot coverage if generic marker tests do not already cover `TIME_STOP_DEITY`**

In `test/utils.match-authority.public-snapshot.test.ts`, add a fixture with:

```ts
data: { type: 'TIME_STOP_DEITY', remainingOwnerTurns: 1 }
```

Assert:

```ts
expect(projected.cardState.markers[0].data).toEqual(expect.objectContaining({
  type: 'TIME_STOP_DEITY',
  remainingOwnerTurns: 1
}));
expect(projected.cardState.timeStopConsecutiveTurnsRemainingByPlayer).toEqual({ black: 1, white: 0 });
```

- [ ] **Step 2: Add sanitize/playback event coverage**

In `test/workers.match-publish-sanitize.test.ts`, add a snapshot/event assertion for:

```ts
{
  type: 'time_stop_triggered',
  player: 'black',
  row: 3,
  col: 4,
  remainingBonusTurns: 4,
  markerType: 'TIME_STOP_DEITY',
  cardType: 'TIME_STOP_DEITY'
}
```

In `test/network.playback-event-assembly.contract.test.ts`, assert that the assembled presentation includes `TIME_STOP_DEITY` status removal and time-stop trigger data without losing `remainingBonusTurns`.

- [ ] **Step 3: Regenerate asset manifest**

Run:

```powershell
npm run generate:asset-manifest
node scripts/check-manifest-up-to-date.js
```

Expected: manifest includes:

```json
{ "path": "assets/images/card/95_時間停神.png" }
{ "path": "assets/images/special-stones/TIME_STOP_DEITY-black.png" }
{ "path": "assets/images/special-stones/TIME_STOP_DEITY-white.png" }
```

- [ ] **Step 4: Run TypeScript and focused tests**

Run:

```powershell
npm run typecheck
npm run build:ts
npm run test:jest -- test/game.time-stop-deity.test.ts test/game.time-stop-god.test.ts test/cards.time-stop-deity-surfaces.test.ts test/assets.images.test.ts test/ui.visual-effects-map.shared.test.ts test/shared.special-stone-registry.test.ts test/game.special-stone-marker-factory.test.ts test/utils.match-authority.public-snapshot.test.ts test/workers.match-publish-sanitize.test.ts test/network.playback-event-assembly.contract.test.ts
```

Expected: all commands exit `0`.

- [ ] **Step 5: Prepare worker mirror**

Run:

```powershell
npm run worker:prepare
```

Expected: command exits `0`; `worker-public/` receives generated/mirrored changes. Do not hand-edit `worker-public/`.

- [ ] **Step 6: Inspect final diff**

Run:

```powershell
git status --short
git diff --check
rg -n "TIME_STOP_DEITY|時間停神|TIME_STOP_DEITY-black|TIME_STOP_DEITY-white" 01-rulebook.md 正本 cards shared-constants.ts shared game ui test assets worker-public
```

Expected: only intentional `時間停神` changes plus generated/mirror outputs are present. Existing unrelated untracked paths remain unstaged.

- [ ] **Step 7: Commit verification and mirror outputs**

Run:

```powershell
git add -- assets/asset-manifest.json worker-public test/utils.match-authority.public-snapshot.test.ts test/workers.match-publish-sanitize.test.ts test/network.playback-event-assembly.contract.test.ts
git commit -m "Sync time stop deity assets and network contracts"
```

Expected: one final commit for manifest, mirror, and network contract tests.

---

## Verification Matrix

- Docs/spec only:
  - `git diff --check -- 01-rulebook.md 正本/カード仕様正本.md`
- Catalog/art:
  - `node scripts/generate-catalog.js`
  - `node scripts/generate-card-art-map.js`
  - `npm run test:jest -- test/cards.time-stop-deity-surfaces.test.ts`
- Core gameplay:
  - `npm run test:jest -- test/game.time-stop-deity.test.ts test/game.time-stop-god.test.ts`
- Registry/visual:
  - `npm run test:jest -- test/shared.special-stone-registry.test.ts test/game.special-stone-marker-factory.test.ts test/assets.images.test.ts test/ui.visual-effects-map.shared.test.ts`
- CPU/surfaces:
  - `npm run test:jest -- test/cpu.decision.refactor.test.ts test/game.cpu-policy-core.test.ts test/cards.numeric-effect-tags.test.ts test/ui.card-detail-effect-tags.test.ts`
- Network/mirror:
  - `npm run test:jest -- test/utils.match-authority.public-snapshot.test.ts test/workers.match-publish-sanitize.test.ts test/network.playback-event-assembly.contract.test.ts`
  - `npm run typecheck`
  - `npm run build:ts`
  - `npm run generate:asset-manifest`
  - `node scripts/check-manifest-up-to-date.js`
  - `npm run worker:prepare`

Do not run browser/playable UI verification, Playwright game UI checks, `test/e2e/*`, or `npm run test:visual` unless the user explicitly requests real game verification.

## Self-Review Notes

- Spec coverage: cost 0, 9 own-stone random destruction, next-stone marker, 5 owner-turn delay, 4 total actions including trigger turn, normal-stone reversion, fizzle, no flip protection, dedicated stone assets, catalog/help/CPU/network/mirror are each covered by tasks.
- Placeholder scan: this plan intentionally provides concrete file paths, code snippets, commands, and expected outcomes. It contains no unresolved requirement markers.
- Type consistency: card type is `TIME_STOP_DEITY`, marker type is `TIME_STOP_DEITY`, card id is `time_stop_deity_01`, constants use `TIME_STOP_DEITY_*`, and visual files use `TIME_STOP_DEITY-black.png` / `TIME_STOP_DEITY-white.png`.

# Zombie Will Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `ゾンビの意志` as a cost 19 next-stone special card that creates permanent `屍石`, infects adjacent enemy normal stones every third owner turn start, and gives each zombie one flip and one destroy revive.

**Architecture:** Model `屍石` as a true special-stone body with marker type `ZOMBIE`, not as a stone status. Reuse the existing special-stone registry, evasion counter system, marker lifecycle, and turn-start anchor processing; keep infection logic in a focused headless card module. Wire the prepared Zombie stone/background assets through the existing visual-effect and asset-manifest paths instead of adding a parallel renderer.

**Tech Stack:** TypeScript/CommonJS hybrid modules, Jest, existing card catalog/codegen scripts, headless `game/` card logic, shared `SpecialStoneRegistry`, shared `EvasionStatus`.

## Global Constraints

- Root source is canonical; do not source-edit `worker-public/` or generated mirrors.
- For player-visible rules and card text, update `01-rulebook.md` before implementation.
- Keep `game/`, pure card logic, and `shared/` headless: no DOM, `window`, audio, timer, network client, or UI handler access.
- Use existing owner/player/color helpers and marker helpers; do not duplicate normalization logic.
- `ゾンビの意志` assets are ready and committed. Use `assets/images/special-stones/ZOMBIE-black.png`, `assets/images/special-stones/ZOMBIE-white.png`, and `assets/images/special-cards/backgrounds/zombie_will_background.png`. Do not regenerate or overwrite them during implementation.
- Real browser/game UI operation and Playwright game checks require explicit user instruction. Use source checks, focused Jest, typecheck/build, and network parity for this feature.
- Pre-existing dirty files at plan creation: `index.html`, `public/module-registry.js`, `public/module-registry.optional.js`, `worker-public/index.html`, `worker-public/public/module-registry.js`, `worker-public/public/module-registry.optional.js`. Do not stage or alter them for this feature unless the implementation intentionally regenerates mirrors in a later task.

---

## File Structure

- Modify `01-rulebook.md`: add `ZOMBIE_WILL（ゾンビの意志）` rules and add `屍石（ZOMBIE）` to special-stone classification and loss-will examples.
- Modify relevant `正本/*.md`: update only if the nearby card/turn/special-stone desired-behavior note would otherwise contradict the new card.
- Modify `cards/catalog.json`: add `zombie_will_01` with name, type, cost, description, and display category.
- Regenerate or update catalog source surfaces according to existing scripts: `cards/catalog.ts`, generated catalog outputs if the repo's card catalog workflow requires them.
- Modify `cards/card-interaction-effects.ts`: add quick/detail descriptions and tags for `ZOMBIE_WILL`.
- Modify `shared/special-stone-registry.ts`: register `ZOMBIE`, map `ZOMBIE_WILL` to `ZOMBIE`, and keep it as a true special-stone body.
- Modify `shared/evasion-status.ts`: add `ZOMBIE` profile with flip and destroy evasion defaults of 1.
- Modify `game/visual-effects-map.runtime.js` and related UI visual-effect wrappers/tests: map pending `ZOMBIE_WILL` and special type `ZOMBIE` to the prepared special-stone images.
- Use `assets/images/special-cards/backgrounds/zombie_will_background.png` only through the existing card-art/background descriptor path if the current renderer supports per-card background art outside `assets/images/card`.
- Create `game/logic/cards/zombie_will.ts`: pure infection candidate selection, marker creation, and turn-start processing.
- Modify `game/logic/cards.ts` or the local card logic export hub: export zombie helpers to `CardLogic`.
- Modify placement resolution in the existing next-stone special path, likely `game/cards/effect-resolver.ts` and/or `game/logic/cards/*` helpers: convert pending `ZOMBIE_WILL` placement into a `ZOMBIE` marker.
- Modify `game/turn/turn-start/special-stone-phase.ts`: dispatch `ZOMBIE` owner-turn-start anchors to `CardLogic.processZombieEffectsAtTurnStartAnchor`.
- Modify UI/log mapping files only for text labels and event names if new events are emitted: likely `game/turn/pipeline-ui/log-mappers.ts` and `game/turn/turn_pipeline_phase_helpers.ts`.
- Add focused tests under `test/`:
  - `test/cards.zombie-will-surfaces.test.ts`
  - `test/game.zombie-will.test.ts`
  - extend existing numeric tag and special-stone registry tests when those files already assert every special-stone card type.

## Task 1: Lock Player-Facing Spec

**Files:**
- Modify: `01-rulebook.md`
- Inspect and possibly modify: `正本/*.md`
- Test: source inspection and `git diff --check`

**Interfaces:**
- Consumes: user-approved behavior: first infection on third owner turn start after placement; permanent duration; adjacent enemy normal stone infection; each zombie gets one flip and one destroy revive; buffs are not copied.
- Produces: canonical wording used by catalog/help text and tests.

- [ ] **Step 1: Add the rulebook section**

Insert a new section near similar next-stone special stones:

```md
### 10.xx ZOMBIE_WILL（ゾンビの意志）

- コスト19
- 次に置く石を屍石化する
- 屍石は特殊石本体として扱い、持続ターンは永続
- 屍石は反転回避1回と破壊回避1回を持つ。反転または破壊を受ける時、対応する回数を1消費して元の所有者色の屍石としてその場に残る
- 所有者ターン開始時に感染カウントを進め、配置後に所有者ターン開始を3回迎えた時に初回感染する。以後も3回ごとに感染を繰り返す
- 感染時、隣接1マス（8方向）の敵通常石からランダムに1つを選び、自分の屍石に変える。候補がない場合は不発となり、次の感染はさらに3回後になる
- 感染で生まれた屍石は新しい特殊石個体として扱い、感染カウント0、反転回避1回、破壊回避1回から開始する
- 感染で生まれた屍石には、感染元に重なっていた完全保護、生きる意志、延命などの別効果は引き継がない
- 感染対象の敵通常石に石状態が重なっていた場合、屍石化によりその石状態は消える。完全保護中の石は感染対象に含めない
- ターン開始処理中に感染で新しく生まれた屍石は、その同じターン開始では発動しない
```

- [ ] **Step 2: Update classification examples**

In `6.8 特殊石分類`, add `屍石（ZOMBIE）` to `特殊石本体` examples. In `意志の喪失（LOSS_WILL）` examples, include `屍石（ZOMBIE）` as revertible to a normal stone.

- [ ] **Step 3: Inspect relevant 正本 notes**

Run:

```powershell
rg -n "特殊石|ターン開始|反転回避|破壊回避|復活|生きる意志|完全保護|繁殖|感染|ゾンビ|屍石" 正本
```

If a matching note contradicts the new rule, update only the stale sentence. If no note mentions a conflicting behavior, leave `正本/` unchanged and record that in the final report.

- [ ] **Step 4: Verify docs**

Run:

```powershell
git diff --check -- 01-rulebook.md 正本
```

Expected: no whitespace errors.

- [ ] **Step 5: Commit**

```powershell
git status --short
git add 01-rulebook.md
git add 正本/<changed-file>.md
git commit -m "docs: define zombie will"
```

If no `正本` file changed, omit the second `git add`.

## Task 2: Add Card Surface and Asset Manifest Coverage

**Files:**
- Modify: `cards/catalog.json`
- Modify/regenerate: `cards/catalog.ts` and generated catalog surfaces required by existing catalog workflow
- Modify: `cards/card-interaction-effects.ts`
- Modify/regenerate: `assets/asset-manifest.json` only if the implementation branch does not already include the committed Zombie asset entries
- Test: `test/cards.zombie-will-surfaces.test.ts`, possibly extend `test/cards.numeric-effect-tags.test.ts`, `test/assets.manifest.test.ts`

**Interfaces:**
- Consumes: canonical card id `zombie_will_01`, card type `ZOMBIE_WILL`, marker type `ZOMBIE`.
- Produces: catalog entry, card help text, and manifest assertions for the prepared Zombie image assets.

- [ ] **Step 1: Write surface tests**

Create `test/cards.zombie-will-surfaces.test.ts`:

```ts
const fs = require('fs');
const path = require('path');

const catalogJson = require('../cards/catalog.json');
const catalogTs = require('../cards/catalog');
const CardInteractionEffects = require('../cards/card-interaction-effects');
const SharedConstants = require('../shared-constants');

describe('ZOMBIE_WILL catalog/help surfaces', () => {
  const EXPECTED_ID = 'zombie_will_01';
  const EXPECTED_NAME = 'ゾンビの意志';
  const EXPECTED_TYPE = 'ZOMBIE_WILL';

  test('catalog json / catalog.ts / shared constants expose ZOMBIE_WILL', () => {
    const jsonCard = catalogJson.cards.find((card: any) => card.id === EXPECTED_ID);
    expect(jsonCard).toEqual(expect.objectContaining({
      id: EXPECTED_ID,
      name_ja: EXPECTED_NAME,
      type: EXPECTED_TYPE,
      cost: 19
    }));

    const tsCard = (catalogTs.CARD_CATALOG || catalogTs.default || []).find((card: any) => card.id === EXPECTED_ID);
    expect(tsCard).toEqual(expect.objectContaining({
      id: EXPECTED_ID,
      name_ja: EXPECTED_NAME,
      type: EXPECTED_TYPE,
      cost: 19
    }));

    const sharedCard = (SharedConstants.CARD_DEFS || []).find((card: any) => card && card.type === EXPECTED_TYPE);
    expect(sharedCard).toEqual(expect.objectContaining({
      id: EXPECTED_ID,
      name: EXPECTED_NAME,
      type: EXPECTED_TYPE,
      cost: 19
    }));
  });

  test('CardInteractionEffects exposes zombie text and tags', () => {
    const summary = CardInteractionEffects.resolveCardDescriptionTexts({
      id: EXPECTED_ID,
      name: EXPECTED_NAME,
      type: EXPECTED_TYPE,
      cost: 19
    });
    expect(summary.quickText).toContain('屍石');
    expect(summary.detailText).toContain('3回');
    expect(summary.detailText).toContain('反転回避1回');
    expect(summary.detailText).toContain('破壊回避1回');
    expect(summary.effectTags.map((tag: any) => tag.label)).toEqual(['特殊石', '反転回避', '破壊回避']);
    expect(summary.numericTags.map((tag: any) => tag.label)).toEqual(['反転回避', '破壊回避']);
  });

  test('rulebook contains the zombie will section', () => {
    const rulebook = fs.readFileSync(path.join(__dirname, '..', '01-rulebook.md'), 'utf8');
    expect(rulebook).toContain('ZOMBIE_WILL（ゾンビの意志）');
    expect(rulebook).toContain('屍石');
  });

  test('asset manifest contains prepared zombie assets', () => {
    const manifest = require('../assets/asset-manifest.json');
    const paths = (manifest.files || []).map((entry: any) => entry.path);
    expect(paths).toContain('assets/images/special-stones/ZOMBIE-black.png');
    expect(paths).toContain('assets/images/special-stones/ZOMBIE-white.png');
    expect(paths).toContain('assets/images/special-cards/backgrounds/zombie_will_background.png');
  });
});
```

- [ ] **Step 2: Run failing test**

```powershell
npx jest test/cards.zombie-will-surfaces.test.ts --runInBand
```

Expected: fails because the catalog entry and card effect text are missing.

- [ ] **Step 3: Add catalog entry**

Add to `cards/catalog.json` near other next-stone special stones:

```json
{
  "id": "zombie_will_01",
  "name_ja": "ゾンビの意志",
  "type": "ZOMBIE_WILL",
  "cost": 19,
  "desc_ja": "次に置く石を屍石化。屍石は3回目以降の自ターン開始ごとに隣接敵通常石1つを屍石へ感染させ、反転回避1回と破壊回避1回を持つ。",
  "display_type_ja": "戦闘"
}
```

Find the existing catalog generation command before editing generated catalog files:

```powershell
rg -n "catalog|generate-card|CARD_DEFS|cards/catalog" package.json scripts test
```

Use the command reported by that search that updates `cards/catalog.ts` and shared constants. Do not hand-edit generated outputs when that generator exists. If the search shows no generator for a required surface, edit only the root source and the checked-in source file that the existing tests import.

- [ ] **Step 4: Verify asset manifest entries**

The Zombie assets should already exist. If `assets/asset-manifest.json` does not contain all three paths, run:

```powershell
npm run generate:asset-manifest
```

Expected manifest paths:

```text
assets/images/special-stones/ZOMBIE-black.png
assets/images/special-stones/ZOMBIE-white.png
assets/images/special-cards/backgrounds/zombie_will_background.png
```

- [ ] **Step 5: Add help text and tags**

In `cards/card-interaction-effects.ts`, add:

```ts
ZOMBIE_WILL: '次に置く石を屍石化。3回目以降の自ターン開始ごとに隣接敵通常石1つを屍石へ感染させる。',
```

Add detail text:

```ts
ZOMBIE_WILL: '次に置く石を屍石化する。\n屍石は特殊石として扱い、持続ターンは永続。\n所有者ターン開始を3回迎えるたび、隣接1マスの敵通常石からランダムに1つを自分の屍石へ変える。\n感染で生まれた屍石も感染カウント0、反転回避1回、破壊回避1回を持つ。\n感染元に重なっていた完全保護や生きる意志などの別効果は感染先へ引き継がない。\n感染対象の敵通常石に石状態が重なっていた場合、その石状態は消える。\n完全保護中の石、特殊石、爆弾、顕現石は感染対象外。',
```

Add tags:

```ts
ZOMBIE_WILL: freezeCardEffectTags([specialStoneTag(), flipEvasionTag(1), destroyEvasionTag(1)]),
```

- [ ] **Step 6: Verify surface tests**

```powershell
npx jest test/cards.zombie-will-surfaces.test.ts test/cards.numeric-effect-tags.test.ts test/assets.manifest.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git status --short
git add cards/catalog.json cards/catalog.ts cards/card-interaction-effects.ts assets/asset-manifest.json test/cards.zombie-will-surfaces.test.ts
git commit -m "feat: add zombie will card surfaces"
```

Stage generated catalog and manifest files only if they were produced by the catalog/asset workflow for this task.

## Task 3: Register ZOMBIE as a Special Stone and Evasion Type

**Files:**
- Modify: `shared/special-stone-registry.ts`
- Modify: `shared/evasion-status.ts`
- Test: `test/game.zombie-will.test.ts` or a focused registry test

**Interfaces:**
- Produces:
  - `SpecialStoneRegistry.getMarkerTypeForSpecialStoneCard('ZOMBIE_WILL') === 'ZOMBIE'`
  - `SpecialStoneRegistry.getSpecialStoneDisplayName('ZOMBIE') === '屍石'`
  - `EvasionStatus.getFlipEvadeDefault('ZOMBIE') === 1`
  - `EvasionStatus.getDestroyEvadeDefault('ZOMBIE') === 1`

- [ ] **Step 1: Write failing registry tests**

Add to `test/game.zombie-will.test.ts`:

```ts
const SpecialStoneRegistry = require('../shared/special-stone-registry');
const EvasionStatus = require('../shared/evasion-status');

describe('ZOMBIE special stone registry', () => {
  test('ZOMBIE_WILL maps to a true special stone body', () => {
    expect(SpecialStoneRegistry.getMarkerTypeForSpecialStoneCard('ZOMBIE_WILL')).toBe('ZOMBIE');
    expect(SpecialStoneRegistry.getSpecialStoneDisplayName('ZOMBIE')).toBe('屍石');
    expect(SpecialStoneRegistry.countsAsSpecialStone('ZOMBIE')).toBe(true);
    expect(SpecialStoneRegistry.isCaptureTargetableStoneEffect('ZOMBIE')).toBe(true);
    expect(SpecialStoneRegistry.canLossWillRevert('ZOMBIE')).toBe(true);
  });

  test('ZOMBIE has one flip and one destroy evasion by default', () => {
    expect(EvasionStatus.getFlipEvadeDefault('ZOMBIE')).toBe(1);
    expect(EvasionStatus.getDestroyEvadeDefault('ZOMBIE')).toBe(1);
  });
});
```

- [ ] **Step 2: Run failing test**

```powershell
npx jest test/game.zombie-will.test.ts --runInBand
```

Expected: fails because `ZOMBIE` is not registered.

- [ ] **Step 3: Register the special stone**

In `shared/special-stone-registry.ts`, add to `SPECIAL_STONE_REGISTRY`:

```ts
ZOMBIE: Object.freeze({
    name: '屍石',
    desc: '3回ごとの所有者ターン開始時に隣接敵通常石を屍石へ感染させる。',
    tagFlipEvadeDefault: readFlipDefault('ZOMBIE'),
    tagDestroyEvadeDefault: readDestroyDefault('ZOMBIE')
}),
```

Add to `SPECIAL_STONE_CARD_DEFINITIONS`:

```ts
ZOMBIE_WILL: Object.freeze({ cardId: 'zombie_will_01', cardNameJa: 'ゾンビの意志', cardType: 'ZOMBIE_WILL', markerType: 'ZOMBIE' }),
```

- [ ] **Step 4: Register evasion defaults**

In `shared/evasion-status.ts`, add to `EVASION_PROFILES`:

```ts
ZOMBIE: Object.freeze({
    flipDefault: 1,
    destroyDefault: 1,
    flipCause: 'ZOMBIE',
    flipMoveReason: 'zombie_flip_revive'
})
```

Do not set `pruneWhenBothDepleted`: a depleted zombie should remain a `ZOMBIE` marker because it still infects every third owner turn.

- [ ] **Step 5: Verify registry tests**

```powershell
npx jest test/game.zombie-will.test.ts --runInBand
```

Expected: PASS for registry tests.

- [ ] **Step 6: Commit**

```powershell
git status --short
git add shared/special-stone-registry.ts shared/evasion-status.ts test/game.zombie-will.test.ts
git commit -m "feat: register zombie stone"
```

## Task 4: Wire Zombie Visual Assets

**Files:**
- Modify: `game/visual-effects-map.runtime.js`
- Modify if wrapper tests require it: `ui/visual-effects-map.ts`
- Test: `test/ui.visual-effects-map.shared.test.ts`, `test/assets.images.test.ts`

**Interfaces:**
- Consumes:
  - `assets/images/special-stones/ZOMBIE-black.png`
  - `assets/images/special-stones/ZOMBIE-white.png`
  - `assets/images/special-cards/backgrounds/zombie_will_background.png`
- Produces:
  - `PENDING_TYPE_TO_EFFECT_KEY.ZOMBIE_WILL === 'zombieStone'`
  - `SPECIAL_TYPE_TO_EFFECT_KEY.ZOMBIE === 'zombieStone'`
  - `STONE_VISUAL_EFFECTS.zombieStone.imagePathByOwner['1']` resolves to `ZOMBIE-black.png`
  - `STONE_VISUAL_EFFECTS.zombieStone.imagePathByOwner['-1']` resolves to `ZOMBIE-white.png`

- [ ] **Step 1: Write failing visual map tests**

Add to `test/ui.visual-effects-map.shared.test.ts` near the other special-stone image tests:

```ts
test('ZOMBIE_WILL resolves to prepared zombie stone images', async () => {
  const shared = await import('../game/visual-effects-map.runtime.js');
  expect(shared.PENDING_TYPE_TO_EFFECT_KEY.ZOMBIE_WILL).toBe('zombieStone');
  expect(shared.SPECIAL_TYPE_TO_EFFECT_KEY.ZOMBIE).toBe('zombieStone');
  const zombieMap = shared.STONE_VISUAL_EFFECTS.zombieStone;
  expect(zombieMap.imagePathByOwner['1']).toContain('ZOMBIE-black.png');
  expect(zombieMap.imagePathByOwner['-1']).toContain('ZOMBIE-white.png');
  expect(zombieMap.imagePathByOwner['1']).not.toContain('data:image/svg+xml');
  expect(zombieMap.imagePathByOwner['-1']).not.toContain('data:image/svg+xml');
});
```

Add to `test/assets.images.test.ts`:

```ts
test('includes the ZOMBIE special stone PNGs', () => {
  assert.ok(fs.existsSync(path.join(specialStonesDir, 'ZOMBIE-black.png')));
  assert.ok(fs.existsSync(path.join(specialStonesDir, 'ZOMBIE-white.png')));
});
```

- [ ] **Step 2: Run failing visual tests**

```powershell
npx jest test/ui.visual-effects-map.shared.test.ts test/assets.images.test.ts --runInBand
```

Expected: visual-map test fails because `zombieStone` is not registered. Asset existence test should pass if the committed assets are present.

- [ ] **Step 3: Add zombie visual effect definition**

In `game/visual-effects-map.runtime.js`, add to `GAME_STONE_VISUAL_EFFECTS`:

```js
    zombieStone: {
        cssClass: 'hyperactive-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/special-stones/ZOMBIE-black.png',
            '-1': 'assets/images/special-stones/ZOMBIE-white.png'
        },
        dataAttributes: {}
    },
```

Add to `PENDING_TYPE_TO_EFFECT_KEY`:

```js
    'ZOMBIE_WILL': 'zombieStone',
```

Add to `SPECIAL_TYPE_TO_EFFECT_KEY`:

```js
    'ZOMBIE': 'zombieStone',
```

- [ ] **Step 4: Decide whether to wire the card background now**

Search current card background support:

```powershell
rg -n "card-special-art|characterImage|backgrounds|assets/images/card|card background|CARD_ART" cards ui shared game test -g "*.ts" -g "*.js"
```

If the existing renderer only supports catalog-order card art from `assets/images/card` or special-card character art, do not invent a new card-background path in this task. Leave `assets/images/special-cards/backgrounds/zombie_will_background.png` available in `assets/asset-manifest.json` and note in the final report that renderer integration needs a separate design if product wants background-only card art. If the renderer already has a per-card background descriptor, add `zombie_will_background.png` through that descriptor and write a focused renderer test matching the nearby existing card-background test.

- [ ] **Step 5: Verify visual tests**

```powershell
npx jest test/ui.visual-effects-map.shared.test.ts test/assets.images.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git status --short
git add game/visual-effects-map.runtime.js test/ui.visual-effects-map.shared.test.ts test/assets.images.test.ts
git commit -m "feat: wire zombie stone visuals"
```

Stage card-background descriptor files only if Step 4 found an existing descriptor and the implementation used it.

## Task 5: Add Headless Zombie Infection Logic

**Files:**
- Create: `game/logic/cards/zombie_will.ts`
- Modify: `game/logic/cards.ts` or the local export hub that exposes `CardLogic`
- Test: `test/game.zombie-will.test.ts`

**Interfaces:**
- Produces:
  - `createZombieMarkerData(ownerKey: 'black' | 'white')`
  - `processZombieEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prng, deps?)`
- Consumes:
  - `BoardOps.changeAt`
  - marker helpers via existing `addMarker` or `CardMarkers.addMarker`
  - `SharedConstants.BLACK`, `SharedConstants.WHITE`, `SharedConstants.EMPTY`

- [ ] **Step 1: Add failing infection tests**

Extend `test/game.zombie-will.test.ts`:

```ts
const ZombieWill = require('../game/logic/cards/zombie_will');
const SharedConstants = require('../shared-constants');

function makePrng(value = 0) {
  return { random: jest.fn(() => value) };
}

function makeState() {
  return {
    gameState: {
      board: [
        [0, 0, 0, 0],
        [0, 1, -1, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ]
    },
    cardState: {
      markers: [{
        id: 'zombie-1',
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'black',
        createdSeq: 1,
        data: { type: 'ZOMBIE', ownerColor: SharedConstants.BLACK, turnsUntilInfection: 1, flipEvadeRemaining: 1, destroyEvadeRemaining: 1 }
      }],
      _nextMarkerId: 2,
      _nextCreatedSeq: 2,
      presentationEvents: []
    }
  };
}

describe('ZOMBIE infection logic', () => {
  test('third owner turn start infects one adjacent enemy normal stone', () => {
    const { cardState, gameState } = makeState();
    const result = ZombieWill.processZombieEffectsAtTurnStartAnchor(cardState, gameState, 'black', 1, 1, makePrng(0));

    expect(result.infected).toEqual([{ row: 1, col: 2, owner: 'black' }]);
    expect(gameState.board[1][2]).toBe(SharedConstants.BLACK);
    expect(cardState.markers.some((marker: any) =>
      marker.row === 1 &&
      marker.col === 2 &&
      marker.owner === 'black' &&
      marker.data.type === 'ZOMBIE' &&
      marker.data.turnsUntilInfection === 3 &&
      marker.data.flipEvadeRemaining === 1 &&
      marker.data.destroyEvadeRemaining === 1
    )).toBe(true);
    expect(cardState.markers[0].data.turnsUntilInfection).toBe(3);
  });

  test('non-triggering owner turn only decrements infection counter', () => {
    const { cardState, gameState } = makeState();
    cardState.markers[0].data.turnsUntilInfection = 3;

    const result = ZombieWill.processZombieEffectsAtTurnStartAnchor(cardState, gameState, 'black', 1, 1, makePrng(0));

    expect(result.infected).toEqual([]);
    expect(gameState.board[1][2]).toBe(SharedConstants.WHITE);
    expect(cardState.markers[0].data.turnsUntilInfection).toBe(2);
  });

  test('infection ignores special stones and protected cells', () => {
    const { cardState, gameState } = makeState();
    cardState.markers.push({
      id: 'guard-1',
      kind: 'specialStone',
      row: 1,
      col: 2,
      owner: 'white',
      createdSeq: 2,
      data: { type: 'GUARD', remainingOwnerTurns: 3 }
    });

    const result = ZombieWill.processZombieEffectsAtTurnStartAnchor(cardState, gameState, 'black', 1, 1, makePrng(0));

    expect(result.infected).toEqual([]);
    expect(gameState.board[1][2]).toBe(SharedConstants.WHITE);
  });
});
```

- [ ] **Step 2: Run failing infection tests**

```powershell
npx jest test/game.zombie-will.test.ts --runInBand
```

Expected: fails because `game/logic/cards/zombie_will` does not exist.

- [ ] **Step 3: Create zombie module**

Create `game/logic/cards/zombie_will.ts` with a CommonJS-compatible factory style matching nearby card modules. Include these functions:

```ts
const SharedConstants = require('../../../shared-constants');
const CardMarkers = require('./markers');
const RandomSource = require('../cards-internal/random-source');
const SpecialStoneRegistry = require('../../../shared/special-stone-registry');

const DIRECTIONS = Object.freeze([
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
]);

const ZOMBIE_INFECTION_INTERVAL = 3;

function ownerValue(ownerKey: string) {
  return ownerKey === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
}

function createZombieMarkerData(ownerKey: string) {
  return {
    type: 'ZOMBIE',
    ownerColor: ownerValue(ownerKey),
    turnsUntilInfection: ZOMBIE_INFECTION_INTERVAL,
    flipEvadeRemaining: 1,
    destroyEvadeRemaining: 1
  };
}

function getCell(gameState: any, row: number, col: number) {
  return gameState && gameState.board && gameState.board[row] ? gameState.board[row][col] : undefined;
}

function setCell(gameState: any, row: number, col: number, value: number) {
  if (gameState && gameState.board && gameState.board[row]) gameState.board[row][col] = value;
}

function markerAt(cardState: any, row: number, col: number, predicate: (marker: any) => boolean) {
  const markers = Array.isArray(cardState && cardState.markers) ? cardState.markers : [];
  return markers.find((marker: any) => marker && marker.row === row && marker.col === col && predicate(marker)) || null;
}

function isEnemyNormalStone(cardState: any, gameState: any, row: number, col: number, ownerKey: string) {
  const enemyValue = -ownerValue(ownerKey);
  if (getCell(gameState, row, col) !== enemyValue) return false;
  const blockingMarker = markerAt(cardState, row, col, (marker: any) => {
    if (marker.kind !== 'specialStone') return false;
    const type = marker.data && marker.data.type;
    if (!type) return false;
    if (String(type).toUpperCase() === 'GUARD') return true;
    return SpecialStoneRegistry.countsAsSpecialStone(type, marker.data);
  });
  return !blockingMarker;
}

function findAdjacentInfectionCandidates(cardState: any, gameState: any, row: number, col: number, ownerKey: string) {
  const out = [];
  for (const [dr, dc] of DIRECTIONS as any) {
    const r = row + dr;
    const c = col + dc;
    if (isEnemyNormalStone(cardState, gameState, r, c, ownerKey)) out.push({ row: r, col: c });
  }
  return out;
}

function removeStoneStatusMarkersAt(cardState: any, row: number, col: number) {
  if (!Array.isArray(cardState && cardState.markers)) return;
  cardState.markers = cardState.markers.filter((marker: any) => {
    if (!marker || marker.row !== row || marker.col !== col) return true;
    if (marker.kind !== 'specialStone') return true;
    return !SpecialStoneRegistry.isStoneStatusMarker(marker);
  });
}

function addZombieMarker(cardState: any, row: number, col: number, ownerKey: string) {
  if (CardMarkers && typeof CardMarkers.addMarker === 'function') {
    return CardMarkers.addMarker(cardState, 'specialStone', row, col, ownerKey, createZombieMarkerData(ownerKey));
  }
  cardState.markers = Array.isArray(cardState.markers) ? cardState.markers : [];
  const marker = {
    id: `zombie_${cardState._nextMarkerId || cardState.markers.length + 1}`,
    kind: 'specialStone',
    row,
    col,
    owner: ownerKey,
    createdSeq: cardState._nextCreatedSeq || cardState.markers.length + 1,
    data: createZombieMarkerData(ownerKey)
  };
  cardState._nextMarkerId = Number(cardState._nextMarkerId || 1) + 1;
  cardState._nextCreatedSeq = Number(cardState._nextCreatedSeq || 1) + 1;
  cardState.markers.push(marker);
  return marker;
}

function processZombieEffectsAtTurnStartAnchor(cardState: any, gameState: any, playerKey: string, row: number, col: number, prng: any, deps: any = {}) {
  const zombie = markerAt(cardState, row, col, (marker: any) =>
    marker.kind === 'specialStone' &&
    marker.owner === playerKey &&
    marker.data &&
    String(marker.data.type || '').toUpperCase() === 'ZOMBIE'
  );
  if (!zombie) return { infected: [], anchors: [] };

  const before = Number.isFinite(Number(zombie.data.turnsUntilInfection))
    ? Math.max(1, Math.trunc(Number(zombie.data.turnsUntilInfection)))
    : ZOMBIE_INFECTION_INTERVAL;
  const after = before - 1;
  if (after > 0) {
    zombie.data.turnsUntilInfection = after;
    return { infected: [], anchors: [{ row, col, turnsUntilInfection: after }] };
  }

  zombie.data.turnsUntilInfection = ZOMBIE_INFECTION_INTERVAL;
  const candidates = findAdjacentInfectionCandidates(cardState, gameState, row, col, playerKey);
  if (candidates.length === 0) return { infected: [], anchors: [{ row, col, turnsUntilInfection: ZOMBIE_INFECTION_INTERVAL }] };

  const randomLike = prng && typeof prng.random === 'function' ? prng : { random: Math.random };
  const index = RandomSource && typeof RandomSource.resolveRandomIndex === 'function'
    ? RandomSource.resolveRandomIndex(candidates.length, randomLike, 0, 'zombie_infection')
    : Math.min(candidates.length - 1, Math.floor(randomLike.random() * candidates.length));
  const target = candidates[index];

  removeStoneStatusMarkersAt(cardState, target.row, target.col);
  if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
    deps.BoardOps.changeAt(cardState, gameState, target.row, target.col, playerKey, 'ZOMBIE', 'zombie_infection');
  } else {
    setCell(gameState, target.row, target.col, ownerValue(playerKey));
  }
  addZombieMarker(cardState, target.row, target.col, playerKey);

  return {
    infected: [{ row: target.row, col: target.col, owner: playerKey }],
    anchors: [{ row, col, turnsUntilInfection: ZOMBIE_INFECTION_INTERVAL }]
  };
}

module.exports = {
  ZOMBIE_INFECTION_INTERVAL,
  createZombieMarkerData,
  findAdjacentInfectionCandidates,
  processZombieEffectsAtTurnStartAnchor
};
```

Adjust import paths if the local marker helper lives under a different module; keep the same exported function names.

- [ ] **Step 4: Export through CardLogic**

Add `zombie_will` to the central card logic export surface. The final public API must include:

```ts
processZombieEffectsAtTurnStartAnchor: ZombieWill.processZombieEffectsAtTurnStartAnchor,
createZombieMarkerData: ZombieWill.createZombieMarkerData
```

- [ ] **Step 5: Verify infection tests**

```powershell
npx jest test/game.zombie-will.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git status --short
git add game/logic/cards/zombie_will.ts game/logic/cards.ts test/game.zombie-will.test.ts
git commit -m "feat: add zombie infection logic"
```

## Task 6: Connect Placement and Turn Start

**Files:**
- Modify: existing next-stone placement resolver, likely `game/cards/effect-resolver.ts`
- Modify: `game/turn/turn-start/special-stone-phase.ts`
- Test: `test/game.zombie-will.test.ts`

**Interfaces:**
- Consumes: `CardLogic.createZombieMarkerData`, `CardLogic.processZombieEffectsAtTurnStartAnchor`.
- Produces: pending `ZOMBIE_WILL` placement creates a `ZOMBIE` marker; owner turn-start anchors process infections in createdSeq order through the standard phase.

- [ ] **Step 1: Add failing integration tests**

Add tests that use the same helper used by nearby cards such as `BREEDING_WILL` or `AFTERIMAGE_WILL`:

```ts
test('ZOMBIE_WILL pending placement creates a zombie marker without a duration', () => {
  const cardState = {
    markers: [],
    pendingEffectByPlayer: { black: { type: 'ZOMBIE_WILL', stage: 'awaitPlace', cardId: 'zombie_will_01' }, white: null },
    _nextMarkerId: 1,
    _nextCreatedSeq: 1
  };
  const gameState = { board: [[1]] };

  const result = CardLogic.applyPendingSpecialStoneAfterPlacement(cardState, gameState, 'black', 0, 0);

  expect(result.applied).toBe(true);
  expect(cardState.markers).toEqual([expect.objectContaining({
    kind: 'specialStone',
    row: 0,
    col: 0,
    owner: 'black',
    data: expect.objectContaining({
      type: 'ZOMBIE',
      turnsUntilInfection: 3,
      flipEvadeRemaining: 1,
      destroyEvadeRemaining: 1
    })
  })]);
  expect(cardState.markers[0].data.remainingOwnerTurns).toBeUndefined();
});
```

If the current codebase does not expose `applyPendingSpecialStoneAfterPlacement`, first run `rg -n "BREEDING_WILL|AFTERIMAGE_WILL|REGEN_WILL" test game/cards game/logic/cards --glob "*.ts"` and use the same placement helper that the nearest existing next-stone special-stone test calls. Keep the expected marker shape exactly as shown above.

- [ ] **Step 2: Run failing integration tests**

```powershell
npx jest test/game.zombie-will.test.ts --runInBand
```

Expected: fails because placement and turn-start dispatch are not connected.

- [ ] **Step 3: Connect placement**

In the existing resolver branch that handles next-stone special cards, add `ZOMBIE_WILL` to the pending type mapping and create a marker with:

```ts
{
  type: 'ZOMBIE',
  ownerColor: playerKey === 'black' ? BLACK : WHITE,
  turnsUntilInfection: 3,
  flipEvadeRemaining: 1,
  destroyEvadeRemaining: 1
}
```

Prefer calling `CardLogic.createZombieMarkerData(playerKey)` rather than duplicating the object.

- [ ] **Step 4: Connect turn-start dispatch**

In `game/turn/turn-start/special-stone-phase.ts`, add:

```ts
if (typeKey === 'ZOMBIE' && owner === opts.playerKey) {
    const res = opts.CardLogic.processZombieEffectsAtTurnStartAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col, p);
    pushTurnStartResultDetails(opts.events, res, [
        { field: 'infected', type: 'zombie_infected_start' }
    ]);
    return processingState;
}
```

- [ ] **Step 5: Add log mapping for event**

If `zombie_infected_start` appears in UI logs, map it to Japanese display text in `game/turn/pipeline-ui/log-mappers.ts`:

```ts
case 'zombie_infected_start':
  return formatPositions('ゾンビの意志: 屍石が感染させた', ev.details);
```

Use the existing helper shape in that file rather than adding a parallel formatter.

- [ ] **Step 6: Verify integration tests**

```powershell
npx jest test/game.zombie-will.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git status --short
git add game/cards/effect-resolver.ts game/turn/turn-start/special-stone-phase.ts game/turn/pipeline-ui/log-mappers.ts test/game.zombie-will.test.ts
git commit -m "feat: connect zombie will lifecycle"
```

Only stage files actually changed.

## Task 7: Network and Worker Parity

**Files:**
- Modify only if tests reveal a gap: `workers/match-worker.ts`, `scripts/local-match-server.ts`, shared authority helpers
- Generated/mirror: run `npm run worker:prepare` only if root Worker/browser changes require mirror sync for deploy surface.
- Test: network parity / missing type tests

**Interfaces:**
- Consumes: root card logic and shared registry updates.
- Produces: Worker/local/browser/headless consistency for `ZOMBIE_WILL` pending placement and turn-start infection.

- [ ] **Step 1: Add missing-type coverage if current test uses a static allowlist**

Inspect:

```powershell
Get-Content test\workers.match-network-parity-missing-types.test.ts
```

If it enumerates card types, add `ZOMBIE_WILL` to the same list as `AFTERIMAGE_WILL`, `REGEN_WILL`, and `BREEDING_WILL`.

- [ ] **Step 2: Run network-focused checks**

```powershell
npm run test:network:parity
```

Expected: PASS.

- [ ] **Step 3: Prepare worker assets only if required**

If the implementation changed root files that must be mirrored to `worker-public/`, run:

```powershell
npm run worker:prepare
```

Expected: generated mirror files update. Stage them only if they are required deploy artifacts for the implementation.

- [ ] **Step 4: Commit**

```powershell
git status --short
git add test/workers.match-network-parity-missing-types.test.ts workers/match-worker.ts scripts/local-match-server.ts worker-public
git commit -m "test: cover zombie will network parity"
```

Only stage paths that actually changed for this task.

## Task 8: Final Verification

**Files:**
- No new source files unless verification reveals a defect.

**Interfaces:**
- Produces: confidence that docs, surfaces, logic, type/build, and network contracts hold.

- [ ] **Step 1: Run focused tests**

```powershell
npx jest test/cards.zombie-will-surfaces.test.ts test/game.zombie-will.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run project checks scaled to blast radius**

```powershell
npm run typecheck
npm run build:ts
npm run test:network:parity
```

Expected: PASS.

- [ ] **Step 3: Run generated/source diff checks**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors. Status should show only intentional feature files plus any pre-existing unrelated dirty files.

- [ ] **Step 4: Commit verification-only fixes if any**

If verification required a small code or test fix:

```powershell
git add <fixed-feature-file>
git commit -m "fix: stabilize zombie will"
```

If no changes were required, do not create an empty commit.

## Asset Status

- `assets/images/special-stones/ZOMBIE-black.png` exists and is committed.
- `assets/images/special-stones/ZOMBIE-white.png` exists and is committed.
- `assets/images/special-cards/backgrounds/zombie_will_background.png` exists and is committed.
- `assets/asset-manifest.json` already includes all three Zombie asset paths.
- The implementation plan now wires the special-stone images through `game/visual-effects-map.runtime.js`.
- The card background image should be wired only if the existing renderer already supports a per-card background descriptor for this location. Do not create a new renderer path just to consume this background during the first gameplay implementation.

## Self-Review

- Spec coverage: cost, next-stone conversion, permanent zombie body, third-owner-turn cadence, adjacent enemy normal infection, no buff inheritance, one flip and destroy revive, prepared assets, visual mapping, and network parity are each mapped to tasks.
- Placeholder scan: no open-ended implementation placeholders are required for the main feature; card background renderer integration is intentionally conditional on an existing descriptor path to avoid a parallel rendering system.
- Type consistency: card type is `ZOMBIE_WILL`, marker type is `ZOMBIE`, card id is `zombie_will_01`, and the shared turn counter property is `turnsUntilInfection`.

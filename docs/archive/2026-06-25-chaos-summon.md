# Chaos Summon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the browser-version card `混沌召喚` (`chaos_summon_01`, `CHAOS_SUMMON`, cost 15), which spawns one random special stone on one random empty cell using the theory roulette visual without theory number values.

**Architecture:** Add a focused headless card-resolution module that reuses the existing theory-spawn candidate table so `罠石` and `時限爆弾` stay excluded by the current registry rule. Keep canonical mutation in `game/`, playback through existing presentation events, and sound selection in the pipeline UI sound-cue layer. Generated catalog, asset manifest, and worker mirror outputs must be produced by existing scripts.

**Tech Stack:** TypeScript/CommonJS modules, Jest, existing card catalog generator, existing browser build and worker mirror scripts.

---

## File Structure

- Modify: `01-rulebook.md`
  - Add the public rule entry for `混沌召喚`, including cost 15, random empty-cell spawn, random special-stone candidate pool, `罠石` / `時限爆弾` exclusion, roulette reuse, and dedicated sound.
- Modify: `cards/catalog.json`
  - Add source-of-truth catalog entry for `chaos_summon_01`.
- Modify generated catalog outputs via script only:
  - `cards/catalog.js`
  - `cards/catalog.ts`
  - `cards/catalog.generated.js`
- Modify: `cards/card-interaction-effects.ts`
  - Add quick/detail card text and a `特殊石` effect tag for `CHAOS_SUMMON`.
- Create: `game/logic/card-resolution/chaos-summon.ts`
  - Own headless random empty-cell + random special-stone spawn resolution.
- Modify: `game/logic/cards.ts`
  - Load and expose `applyChaosSummonUsage`, using the same dependency set as theory-spawn resolution.
- Modify: `game/cards/effect-resolver.ts`
  - Call `applyChaosSummonUsage` during card use for `CHAOS_SUMMON`.
- Modify: `game/turn/pipeline-ui/core-sound-cues.ts`
  - Route roulette playback events caused by `CHAOS_SUMMON` to `chaos_summon_spawn`.
- Modify: `sound-engine.ts`
  - Register the dedicated sound effect file.
- Copy asset into root source tree:
  - From: `C:\Users\quarr\Documents\Studio One\Songs\ルーレット効果音\Mixdown\混沌召喚のルーレット効果音.mp3`
  - To: `assets/audio/sound-effect/混沌召喚のルーレット効果音.mp3`
- Copy generated card art into root source tree:
  - From: `C:\Users\quarr\.codex\generated_images\019efe2d-9ed9-7a30-a996-b8bf87a8023d\ig_0b94ec6a4d0f0a40016a3d0002a4a08191918b692b83c077ef.png`
  - To: `assets/images/card/94_混沌召喚.png`
- Generated/mirror outputs via scripts:
  - `cards/card-art-map.generated.ts`
  - `assets/asset-manifest.json`
  - `public/module-registry.js`
  - `public/module-registry.optional.js`
  - `worker-public/**`
- Test:
  - Create: `test/game.chaos-summon.test.ts`
  - Modify: `test/cards.catalog.test.ts`
  - Modify: `test/cards.numeric-effect-tags.test.ts`
  - Modify: `test/game.pipeline-ui-adapter.sound-cue.test.ts`
  - Modify: `test/sound-engine.default-bgm.test.ts`
  - Modify or add asset assertions only if the existing asset tests do not automatically cover the new files.

---

### Task 1: Add Player-Facing Spec and Assets

**Files:**
- Modify: `01-rulebook.md`
- Copy: `assets/audio/sound-effect/混沌召喚のルーレット効果音.mp3`
- Copy: `assets/images/card/94_混沌召喚.png`

- [ ] **Step 1: Confirm source assets exist**

Run:

```powershell
Get-Item -LiteralPath 'C:\Users\quarr\Documents\Studio One\Songs\ルーレット効果音\Mixdown\混沌召喚のルーレット効果音.mp3'
Get-Item -LiteralPath 'C:\Users\quarr\.codex\generated_images\019efe2d-9ed9-7a30-a996-b8bf87a8023d\ig_0b94ec6a4d0f0a40016a3d0002a4a08191918b692b83c077ef.png'
```

Expected: both files exist. Stop if either path is missing.

- [ ] **Step 2: Copy the audio asset into the project**

Run:

```powershell
Copy-Item -LiteralPath 'C:\Users\quarr\Documents\Studio One\Songs\ルーレット効果音\Mixdown\混沌召喚のルーレット効果音.mp3' -Destination 'assets\audio\sound-effect\混沌召喚のルーレット効果音.mp3'
```

Expected: the destination file exists and the original file remains in place.

- [ ] **Step 3: Copy the generated card art into the project**

Run:

```powershell
Copy-Item -LiteralPath 'C:\Users\quarr\.codex\generated_images\019efe2d-9ed9-7a30-a996-b8bf87a8023d\ig_0b94ec6a4d0f0a40016a3d0002a4a08191918b692b83c077ef.png' -Destination 'assets\images\card\94_混沌召喚.png'
```

Expected: the destination file exists and the original generated image remains in place.

- [ ] **Step 4: Update the rulebook**

Add this section after `### 10.23.1.2 BOARD_EXECUTOR（盤界の執行者）` and before `### 10.24 GOLD_STONE（金の意志）` in `01-rulebook.md`:

```markdown
### 10.23.1.3 CHAOS_SUMMON（混沌召喚）

- コスト15
- 使用時、盤面上の空きマスからランダムに1マスを選び、ランダムな特殊石を1体出現させる
- 出現候補は理論の化身と同じ特殊石候補を使い、`罠石（TRAP）` と `時限爆弾（TIME_BOMB）` は候補に含めない
- 出現した特殊石は、確定したマスへ通常配置と同じ反転判定で配置される。挟める列がある場合はその列の敵石を反転し、挟める列がない場合でも特殊石は出現する
- 出現時の通常反転判定で実際に反転した枚数ぶんの布石は通常どおり獲得する
- 混沌召喚による特殊石出現時は、候補マスを理論の化身と同じルーレット演出で点滅させる。ただし理論数字マス値は表示しない
- ルーレット開始と同時に専用効果音 `assets/audio/sound-effect/混沌召喚のルーレット効果音.mp3` を再生する
```

- [ ] **Step 5: Inspect the spec diff**

Run:

```powershell
git diff -- 01-rulebook.md assets\audio\sound-effect\混沌召喚のルーレット効果音.mp3 assets\images\card\94_混沌召喚.png
```

Expected: only the new rulebook entry and copied assets appear.

- [ ] **Step 6: Commit this isolated unit if the worktree is separable**

Run:

```powershell
git add 01-rulebook.md assets\audio\sound-effect\混沌召喚のルーレット効果音.mp3 assets\images\card\94_混沌召喚.png
git commit -m "Add chaos summon spec and assets"
```

Expected: commit succeeds. If unrelated dirty files are present, do not commit; report the exact files and continue only if the current task remains isolated.

---

### Task 2: Add Catalog and Card Detail Surfaces

**Files:**
- Modify: `cards/catalog.json`
- Modify: `cards/card-interaction-effects.ts`
- Modify: `test/cards.catalog.test.ts`
- Modify: `test/cards.numeric-effect-tags.test.ts`

- [ ] **Step 1: Add the catalog source entry**

In `cards/catalog.json`, add this object after the current last card or in the intended display order:

```json
{
  "id": "chaos_summon_01",
  "name_ja": "混沌召喚",
  "type": "CHAOS_SUMMON",
  "cost": 15,
  "desc_ja": "ランダムな空きマスに、罠石と時限爆弾を除いたランダムな特殊石を1体出現させる。",
  "display_type_ja": "特殊"
}
```

- [ ] **Step 2: Add quick/detail text and tag mapping**

In `cards/card-interaction-effects.ts`, add:

```ts
CHAOS_SUMMON: 'ランダムな空きマスに、罠石と時限爆弾を除いたランダムな特殊石を1体出現させる。',
```

to `quickCardEffectByType`, add:

```ts
CHAOS_SUMMON: '使用時、盤面上の空きマスからランダムに1マスを選び、ランダムな特殊石を1体出現させる。\n出現候補は理論の化身と同じ特殊石候補を使い、罠石と時限爆弾は候補に含まれない。\n出現した特殊石は通常配置と同じ反転判定を行い、反転した枚数ぶんの布石を得る。\n候補マスは理論の化身と同じルーレット演出で表示するが、理論数字マス値は表示しない。',
```

to `detailCardEffectByType`, and add:

```ts
CHAOS_SUMMON: freezeCardEffectTags([specialStoneTag()]),
```

to the effect-tag map.

- [ ] **Step 3: Add catalog tests**

In `test/cards.catalog.test.ts`, add:

```ts
test('chaos summon catalog entry is enabled and costs 15', () => {
  const card = byId.get('chaos_summon_01');
  expect(card).toMatchObject({
    id: 'chaos_summon_01',
    name_ja: '混沌召喚',
    type: 'CHAOS_SUMMON',
    cost: 15,
    display_type_ja: '特殊'
  });
  expect(card.desc_ja).toContain('罠石と時限爆弾を除いた');
});
```

If `byId` is not in scope in the target describe block, mirror the existing local setup in that file.

- [ ] **Step 4: Add tag tests**

In `test/cards.numeric-effect-tags.test.ts`, add:

```ts
test('CHAOS_SUMMON shows the special stone tag without numeric tags', () => {
  expect(getEffectTagLabels('CHAOS_SUMMON')).toEqual(['特殊石']);
  expect(getNumericTagLabels('CHAOS_SUMMON')).toEqual([]);
});
```

- [ ] **Step 5: Run focused failing tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/cards.catalog.test.ts test/cards.numeric-effect-tags.test.ts
```

Expected before implementation/generation: catalog test may fail until generated catalog outputs are produced; tag tests should fail until `card-interaction-effects.ts` is updated.

- [ ] **Step 6: Run catalog generation**

Run:

```powershell
npm run generate:catalog
```

Expected: `cards/catalog.js`, `cards/catalog.ts`, and `cards/catalog.generated.js` update from `cards/catalog.json`.

- [ ] **Step 7: Commit this isolated unit if tests pass and diff is separable**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/cards.catalog.test.ts test/cards.numeric-effect-tags.test.ts
git add cards/catalog.json cards/catalog.js cards/catalog.ts cards/catalog.generated.js cards/card-interaction-effects.ts test/cards.catalog.test.ts test/cards.numeric-effect-tags.test.ts
git commit -m "Add chaos summon catalog"
```

Expected: focused tests pass and commit succeeds.

---

### Task 3: Add Headless Chaos Summon Resolution

**Files:**
- Create: `game/logic/card-resolution/chaos-summon.ts`
- Modify: `test/game.chaos-summon.test.ts`

- [ ] **Step 1: Write the focused headless tests**

Create `test/game.chaos-summon.test.ts` with tests for:

```ts
const ChaosSummon = require('../game/logic/card-resolution/chaos-summon.ts');
const MarkerFactory = require('../game/logic/card-resolution/special-stone-marker-factory.ts');
const SpecialStoneRegistry = require('../shared/special-stone-registry.ts');

function makeDeps(overrides = {}) {
  const events: any[] = [];
  const markers: any[] = [];
  return {
    BLACK: 1,
    WHITE: -1,
    EMPTY: 0,
    MARKER_KINDS: { SPECIAL_STONE: 'specialStone' },
    CARD_DEFS: [
      { id: 'ghost_01', type: 'GHOST_WILL', cost: 5 },
      { id: 'trap_01', type: 'TRAP_WILL', cost: 4 },
      { id: 'bomb_01', type: 'TIME_BOMB', cost: 4 }
    ],
    SpecialStoneRegistry,
    SpecialStoneMarkerFactory: MarkerFactory,
    sampleRandomPositions: (items: any[], count: number) => items.slice(0, count),
    getCellValueForCard: (gameState: any, row: number, col: number) => gameState.board[row][col],
    isBlockedCell: () => false,
    Core: { getFlipsWithContext: () => [] },
    resolveSafeCardContext: () => ({ protectedStones: [], permaProtectedStones: [] }),
    spawnAndFlipPlacement: (opts: any) => {
      opts.gameState.board[opts.row][opts.col] = opts.playerValue;
      events.push({
        type: 'SPAWN',
        row: opts.row,
        col: opts.col,
        ownerAfter: opts.playerKey,
        cause: opts.spawnCause,
        reason: opts.spawnReason,
        meta: opts.spawnMeta
      });
      return { spawned: true, stoneId: 101, appliedFlips: [] };
    },
    addMarker: (_cardState: any, kind: string, row: number, col: number, owner: string, data: any) => {
      const marker = { id: 'm1', kind, row, col, owner, data };
      markers.push(marker);
      return marker;
    },
    addChargeWithTotal: jest.fn(),
    __events: events,
    __markers: markers,
    ...overrides
  };
}

test('CHAOS_SUMMON spawns a non-trap non-bomb special stone on an empty cell', () => {
  const deps = makeDeps();
  const cardState: any = {};
  const gameState: any = { board: [[0, 0], [1, -1]] };

  const result = ChaosSummon.applyChaosSummonUsage(cardState, gameState, 'black', {}, deps);

  expect(result).toMatchObject({ applied: true, row: 0, col: 0, owner: 'black', type: 'GHOST' });
  expect(deps.__markers[0].data).toMatchObject({
    type: 'GHOST',
    sourceType: 'CHAOS_SUMMON',
    sourceCardId: 'ghost_01',
    sourceCardType: 'GHOST_WILL'
  });
  expect(deps.__events[0].reason).toBe('chaos_summon_spawn');
  expect(deps.__events[0].meta.theorySpawnRoulette.candidateCells).toEqual([{ row: 0, col: 0 }, { row: 0, col: 1 }]);
  expect(deps.__events[0].meta.theorySpawnRoulette.candidateCells[0]).not.toHaveProperty('value');
});

test('CHAOS_SUMMON fails cleanly when no empty cell exists', () => {
  const deps = makeDeps();
  const result = ChaosSummon.applyChaosSummonUsage({}, { board: [[1, -1], [-1, 1]] }, 'black', {}, deps);
  expect(result).toEqual({ applied: false, reason: 'no_empty_cell' });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.chaos-summon.test.ts
```

Expected: FAIL because `game/logic/card-resolution/chaos-summon.ts` does not exist.

- [ ] **Step 3: Implement `chaos-summon.ts`**

Create `game/logic/card-resolution/chaos-summon.ts`:

```ts
import type { GameState, PlayerKey } from '../../../src/types';

const TheoryIncarnationSpawn = require('./theory-incarnation-spawn');

const CHAOS_SUMMON_TYPE = 'CHAOS_SUMMON';
const CHAOS_SUMMON_SPAWN_REASON = 'chaos_summon_spawn';
const CHAOS_SUMMON_FLIP_REASON = 'chaos_summon_flip';

function ownerKeyOf(value: any): PlayerKey {
  return String(value) === 'white' ? 'white' : 'black';
}

function cellKeyOf(row: number, col: number): string {
  return `${row},${col}`;
}

function isEmptySpawnCell(cardState: any, gameState: GameState, row: number, col: number, deps: any): boolean {
  const value = typeof deps.getCellValueForCard === 'function'
    ? deps.getCellValueForCard(gameState, row, col)
    : ((gameState as any).board && (gameState as any).board[row] ? (gameState as any).board[row][col] : null);
  if (!(value === deps.EMPTY || value === 0)) return false;
  if (deps && typeof deps.isBlockedCell === 'function' && deps.isBlockedCell(cardState, row, col, gameState) === true) return false;
  return true;
}

function collectChaosSummonCells(cardState: any, gameState: GameState, deps: any): Array<{ key: string; cell: any }> {
  const board = gameState && Array.isArray((gameState as any).board) ? (gameState as any).board : [];
  const out: Array<{ key: string; cell: any }> = [];
  for (let row = 0; row < board.length; row += 1) {
    const line = Array.isArray(board[row]) ? board[row] : [];
    for (let col = 0; col < line.length; col += 1) {
      if (!isEmptySpawnCell(cardState, gameState, row, col, deps)) continue;
      out.push({ key: cellKeyOf(row, col), cell: { row, col } });
    }
  }
  return out;
}

function buildChaosSummonEntries(ownerKey: PlayerKey, deps: any): any[] {
  const factory = deps && deps.SpecialStoneMarkerFactory;
  if (!factory || typeof factory.buildTheoryIncarnationSpawnTable !== 'function') return [];
  const entries = factory.buildTheoryIncarnationSpawnTable(deps.CARD_DEFS || [], { ...deps, ownerKey });
  return entries
    .map((entry: any) => {
      if (!entry || !entry.markerData) return null;
      return {
        ...entry,
        markerData: {
          ...entry.markerData,
          sourceType: CHAOS_SUMMON_TYPE,
          sourceCardId: entry.cardId || entry.markerData.sourceCardId || null,
          sourceCardType: entry.cardType || entry.markerData.sourceCardType || null
        }
      };
    })
    .filter(Boolean);
}

function pickOne(items: any[], prng: any, deps: any): any | null {
  if (!Array.isArray(items) || items.length <= 0) return null;
  const picked = typeof deps.sampleRandomPositions === 'function'
    ? deps.sampleRandomPositions(items, 1, prng)
    : [items[0]];
  return picked && picked[0] ? picked[0] : null;
}

function applyChaosSummonUsage(cardState: any, gameState: GameState, playerKey: PlayerKey, prng: any, deps: any): any {
  const ownerKey = ownerKeyOf(playerKey);
  const availableCells = collectChaosSummonCells(cardState, gameState, deps);
  if (availableCells.length <= 0) return { applied: false, reason: 'no_empty_cell' };
  const entries = buildChaosSummonEntries(ownerKey, deps);
  if (entries.length <= 0) return { applied: false, reason: 'no_spawn_candidate' };

  const pickedCell = pickOne(availableCells, prng, deps);
  const pickedEntry = pickOne(entries, prng, deps);
  if (!pickedCell || !pickedEntry) return { applied: false, reason: 'random_pick_failed' };

  const markerData = TheoryIncarnationSpawn.prepareSpawnMarkerData(
    cardState,
    pickedEntry.markerData,
    ownerKey
  );
  const roulette = TheoryIncarnationSpawn.createTheorySpawnRoulettePayload(cardState, availableCells, pickedCell, markerData);
  roulette.sourceCardId = pickedEntry.cardId || markerData.sourceCardId || null;
  roulette.sourceCardType = pickedEntry.cardType || markerData.sourceCardType || null;

  const ownerValue = ownerKey === 'white' ? deps.WHITE : deps.BLACK;
  const boardPlacement = typeof deps.spawnAndFlipPlacement === 'function'
    ? deps.spawnAndFlipPlacement({
      cardState,
      gameState,
      playerKey: ownerKey,
      playerValue: ownerValue,
      row: pickedCell.cell.row,
      col: pickedCell.cell.col,
      allowZeroFlips: true,
      BoardOps: deps.BoardOps,
      getCardContext: () => (
        typeof deps.resolveSafeCardContext === 'function'
          ? deps.resolveSafeCardContext(cardState)
          : { protectedStones: [], permaProtectedStones: [] }
      ),
      getFlipsWithContext: deps.Core && typeof deps.Core.getFlipsWithContext === 'function'
        ? deps.Core.getFlipsWithContext
        : (() => []),
      resolveFlipEvasion: (candidateFlips: any[]) => (
        candidateFlips.length > 0 && typeof deps.resolveHyperactiveFlipEvasion === 'function'
          ? deps.resolveHyperactiveFlipEvasion(cardState, gameState, candidateFlips, ownerKey, prng)
          : null
      ),
      clearBombAt: typeof deps.clearBombAt === 'function' ? deps.clearBombAt : undefined,
      clearHyperactiveAtPositions: typeof deps.clearHyperactiveAtPositions === 'function' ? deps.clearHyperactiveAtPositions : undefined,
      spawnCause: CHAOS_SUMMON_TYPE,
      spawnReason: CHAOS_SUMMON_SPAWN_REASON,
      flipCause: CHAOS_SUMMON_TYPE,
      flipReason: CHAOS_SUMMON_FLIP_REASON,
      spawnMeta: {
        special: markerData.type,
        owner: ownerKey,
        sourceCardId: pickedEntry.cardId || markerData.sourceCardId || null,
        sourceCardType: pickedEntry.cardType || markerData.sourceCardType || null,
        theorySpawnRoulette: roulette
      }
    })
    : null;
  if (!boardPlacement || boardPlacement.spawned !== true) return { applied: false, reason: 'spawn_failed' };

  const appliedFlips = Array.isArray(boardPlacement.appliedFlips) ? boardPlacement.appliedFlips.slice() : [];
  const chargeGained = appliedFlips.length > 0 && typeof deps.addChargeWithTotal === 'function'
    ? deps.addChargeWithTotal(cardState, ownerKey, appliedFlips.length, {
      popupKind: 'board',
      anchorRow: pickedCell.cell.row,
      anchorCol: pickedCell.cell.col,
      sourceType: 'chaos_summon_flip_gain'
    })
    : 0;

  const markerKinds = deps && deps.MARKER_KINDS;
  const specialKind = markerKinds && markerKinds.SPECIAL_STONE ? markerKinds.SPECIAL_STONE : 'specialStone';
  const marker = deps.addMarker(cardState, specialKind, pickedCell.cell.row, pickedCell.cell.col, ownerKey, {
    ...markerData,
    sourceType: CHAOS_SUMMON_TYPE,
    sourceCardId: pickedEntry.cardId || markerData.sourceCardId || null,
    sourceCardType: pickedEntry.cardType || markerData.sourceCardType || null
  });

  return {
    applied: true,
    row: pickedCell.cell.row,
    col: pickedCell.cell.col,
    owner: ownerKey,
    type: markerData.type,
    sourceCardId: pickedEntry.cardId || null,
    sourceCardType: pickedEntry.cardType || null,
    markerId: marker && marker.id ? marker.id : null,
    roulette,
    flips: appliedFlips.map(([row, col]: [number, number]) => ({ row, col })),
    chargeGained
  };
}

export = {
  CHAOS_SUMMON_TYPE,
  CHAOS_SUMMON_SPAWN_REASON,
  CHAOS_SUMMON_FLIP_REASON,
  collectChaosSummonCells,
  buildChaosSummonEntries,
  applyChaosSummonUsage
};
```

- [ ] **Step 4: Run the focused test**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.chaos-summon.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit this isolated unit**

Run:

```powershell
git add game/logic/card-resolution/chaos-summon.ts test/game.chaos-summon.test.ts
git commit -m "Add chaos summon resolution"
```

Expected: commit succeeds.

---

### Task 4: Wire Card Use Entry

**Files:**
- Modify: `game/logic/cards.ts`
- Modify: `game/cards/effect-resolver.ts`
- Modify: `test/game.chaos-summon.test.ts`

- [ ] **Step 1: Wire `game/logic/cards.ts` module loading**

Near the existing theory module load, add:

```ts
const CardChaosSummonResolutionModule = resolveRequiredCardModule('./card-resolution/chaos-summon', 'CardChaosSummonResolution');
```

- [ ] **Step 2: Add the wrapper in `game/logic/cards.ts`**

Near `applyTheoryIncarnationUsage`, add:

```ts
function applyChaosSummonUsage(cardState: any, gameState: any, playerKey: any, prng: any) {
    return CardChaosSummonResolutionModule.applyChaosSummonUsage(
        cardState,
        gameState,
        playerKey,
        prng,
        getTheoryIncarnationResolutionDeps()
    );
}
```

- [ ] **Step 3: Pass the wrapper into `CardEffectResolverModule.applyCardUsage`**

In the dependency object passed to `CardEffectResolverModule.applyCardUsage`, add:

```ts
applyChaosSummonUsage,
```

next to `applyTheoryIncarnationUsage`.

- [ ] **Step 4: Export the wrapper from `cardsApi`**

In the exported API object, add:

```ts
applyChaosSummonUsage,
```

near the theory-related exports.

- [ ] **Step 5: Destructure and invoke in `game/cards/effect-resolver.ts`**

Add `applyChaosSummonUsage` to the destructured deps near `applyTheoryIncarnationUsage`, then add:

```ts
if (cardType === 'CHAOS_SUMMON') {
  if (typeof applyChaosSummonUsage !== 'function') return false;
  const chaosRes = applyChaosSummonUsage(cardState, _gameState, chargeOwnerKey, _opts.prng);
  if (!chaosRes || chaosRes.applied !== true) return false;
}
```

immediately after the `THEORY_INCARNATION` branch and before pending-state creation.

- [ ] **Step 6: Add an integration-style card-use test**

Extend `test/game.chaos-summon.test.ts` with a public API test if `CardLogic` exports are stable in the file:

```ts
test('CardLogic exposes applyChaosSummonUsage', () => {
  const CardLogic = require('../game/logic/cards.ts');
  expect(typeof CardLogic.applyChaosSummonUsage).toBe('function');
});
```

- [ ] **Step 7: Run focused tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.chaos-summon.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit this isolated unit**

Run:

```powershell
git add game/logic/cards.ts game/cards/effect-resolver.ts test/game.chaos-summon.test.ts
git commit -m "Wire chaos summon card use"
```

Expected: commit succeeds.

---

### Task 5: Add Dedicated Roulette Sound Routing

**Files:**
- Modify: `sound-engine.ts`
- Modify: `game/turn/pipeline-ui/core-sound-cues.ts`
- Modify: `test/game.pipeline-ui-adapter.sound-cue.test.ts`
- Modify: `test/sound-engine.default-bgm.test.ts`

- [ ] **Step 1: Register the sound file**

In `sound-engine.ts`, add this next to `theory_incarnation_spawn`:

```ts
chaos_summon_spawn: '混沌召喚のルーレット効果音.mp3',
```

- [ ] **Step 2: Split roulette sound cue routing**

In `game/turn/pipeline-ui/core-sound-cues.ts`, replace the single theory roulette block with:

```ts
const isChaosSummonRoulette = (ev: any) => (
    ev &&
    ev.type === 'theory_incarnation_spawn_roulette' &&
    Array.isArray(ev.targets) &&
    ev.targets.some((target: any) => (
        String(target && target.cause || '').toUpperCase() === 'CHAOS_SUMMON' ||
        String(target && target.reason || '') === 'chaos_summon_spawn'
    ))
);

const chaosSummonSpawnPhases = deps.collectUniquePhases(ctx.base, isChaosSummonRoulette);
if (chaosSummonSpawnPhases.length > 0) {
    deps.pushCueForPhases(ctx, chaosSummonSpawnPhases, 'chaos_summon_spawn', 'chaos_summon_spawn');
}

const theoryIncarnationSpawnPhases = deps.collectUniquePhases(
    ctx.base,
    (ev: any) => ev && ev.type === 'theory_incarnation_spawn_roulette' && !isChaosSummonRoulette(ev)
);
if (theoryIncarnationSpawnPhases.length > 0) {
    deps.pushCueForPhases(ctx, theoryIncarnationSpawnPhases, 'theory_incarnation_spawn', 'theory_incarnation_spawn');
}
```

- [ ] **Step 3: Add sound-engine tests**

In `test/sound-engine.default-bgm.test.ts`, add:

```ts
test('chaos summon roulette sound file is registered', () => {
  expect(soundEngine.effectSoundFiles.chaos_summon_spawn).toBe('混沌召喚のルーレット効果音.mp3');
  expect(soundEngine.getEffectFilePath('chaos_summon_spawn')).toBe(
    'assets/audio/sound-effect/混沌召喚のルーレット効果音.mp3'
  );
});
```

- [ ] **Step 4: Add pipeline sound-cue tests**

In `test/game.pipeline-ui-adapter.sound-cue.test.ts`, add a test next to the existing theory roulette test:

```ts
test('CHAOS_SUMMON roulette uses chaos summon sound instead of theory sound', () => {
  const out = adapt([
    {
      phase: 7,
      type: 'theory_incarnation_spawn_roulette',
      targets: [{ row: 2, col: 3, cause: 'CHAOS_SUMMON', reason: 'chaos_summon_spawn' }]
    }
  ]);
  expect(out).toEqual(expect.arrayContaining([
    expect.objectContaining({
      type: 'sound_effect',
      phase: 7,
      targets: [expect.objectContaining({ soundKey: 'chaos_summon_spawn' })]
    })
  ]));
  expect(out.find((ev: any) => ev && ev.type === 'sound_effect' && ev.targets && ev.targets[0] && ev.targets[0].soundKey === 'theory_incarnation_spawn')).toBeUndefined();
});
```

If the helper in that file is not named `adapt`, use the same local adapter helper used by the adjacent theory roulette test.

- [ ] **Step 5: Run focused sound tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.pipeline-ui-adapter.sound-cue.test.ts test/sound-engine.default-bgm.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit this isolated unit**

Run:

```powershell
git add sound-engine.ts game/turn/pipeline-ui/core-sound-cues.ts test/game.pipeline-ui-adapter.sound-cue.test.ts test/sound-engine.default-bgm.test.ts
git commit -m "Add chaos summon roulette sound"
```

Expected: commit succeeds.

---

### Task 6: Generate Card Art Map, Asset Manifest, Browser Build, and Worker Mirror

**Files:**
- Generated: `cards/card-art-map.generated.ts`
- Generated: `assets/asset-manifest.json`
- Generated: `public/module-registry.js`
- Generated: `public/module-registry.optional.js`
- Generated mirror: `worker-public/**`

- [ ] **Step 1: Run catalog generation**

Run:

```powershell
npm run generate:catalog
```

Expected: generated catalog outputs remain synchronized with `cards/catalog.json`.

- [ ] **Step 2: Run browser build**

Run:

```powershell
npm run build:browser
```

Expected: TypeScript build passes and module registries update if needed.

- [ ] **Step 3: Generate the asset manifest**

Run:

```powershell
npm run generate:asset-manifest
```

Expected: `assets/asset-manifest.json` includes:

```text
assets/audio/sound-effect/混沌召喚のルーレット効果音.mp3
assets/images/card/94_混沌召喚.png
```

- [ ] **Step 4: Prepare worker mirror**

Run:

```powershell
npm run worker:prepare
```

Expected: worker mirror includes the new catalog outputs, sound file, card image, manifest, and browser registry outputs.

- [ ] **Step 5: Inspect generated diff**

Run:

```powershell
git status --short
git diff --stat
```

Expected: generated files are limited to catalog, card art map, asset manifest, browser registry/build outputs, and worker mirror assets caused by the new card.

- [ ] **Step 6: Commit generated outputs if separable**

Run:

```powershell
git add cards/catalog.js cards/catalog.ts cards/catalog.generated.js cards/card-art-map.generated.ts assets/asset-manifest.json public/module-registry.js public/module-registry.optional.js worker-public
git commit -m "Sync chaos summon generated assets"
```

Expected: commit succeeds.

---

### Task 7: Final Verification

**Files:**
- No new source edits expected.

- [ ] **Step 1: Run focused card/catalog/effect/sound tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/cards.catalog.test.ts test/cards.generate.test.ts test/cards.numeric-effect-tags.test.ts test/game.chaos-summon.test.ts test/game.pipeline-ui-adapter.sound-cue.test.ts test/sound-engine.default-bgm.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run type and browser checks**

Run:

```powershell
npm run typecheck
npm run build:browser
```

Expected: both pass.

- [ ] **Step 3: Run boundary check**

Run:

```powershell
npm run check:window
```

Expected: PASS; no new `window` / DOM usage is introduced under `game/`.

- [ ] **Step 4: Confirm generated mirror remains current**

Run:

```powershell
npm run worker:prepare
git diff --check
git status --short
```

Expected: `worker:prepare` does not produce unexpected extra drift; `git diff --check` reports no whitespace errors.

- [ ] **Step 5: Commit any remaining verification-generated drift**

Run:

```powershell
git add assets/asset-manifest.json public/module-registry.js public/module-registry.optional.js worker-public
git commit -m "Finalize chaos summon mirror sync"
```

Expected: commit only if Step 4 produced intentional generated drift. If no files changed, skip this commit.

---

## Implementation Notes

- `CHAOS_SUMMON` should not be added to pending selection registries. It is an immediate card-use effect.
- The roulette playback type may remain `theory_incarnation_spawn_roulette`; the semantic distinction comes from target `cause: 'CHAOS_SUMMON'` and `reason: 'chaos_summon_spawn'`.
- Do not add UI, DOM, timer, network, or sound dependencies to `game/logic/card-resolution/chaos-summon.ts`.
- The candidate pool must come from `buildTheoryIncarnationSpawnTable`, not a hand-written local list, so `罠石` / `時限爆弾` remain excluded by the registry contract.
- Source files are root files. Do not hand-edit `worker-public/` except through `npm run worker:prepare`.

## Self-Review

- Spec coverage: card cost, random empty cell, random special stone, trap/time-bomb exclusion, theory roulette reuse without values, dedicated sound, catalog, card art, and worker mirror are covered.
- Completion marker scan: no unfinished implementation marker or unspecified test task remains.
- Type consistency: `CHAOS_SUMMON`, `chaos_summon_01`, `applyChaosSummonUsage`, `chaos_summon_spawn`, and `chaos_summon_flip` are used consistently across planned source, tests, and sound mapping.

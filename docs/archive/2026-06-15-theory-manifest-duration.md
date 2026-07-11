# Theory Incarnation Manifest Duration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `理論の化身` の顕現石持続を5ターンにし、出現回数・表示文言・テスト期待値を同じ仕様へ揃える。

**Architecture:** `01-rulebook.md` と `正本/カード仕様正本.md` をプレイヤー可視仕様の正本として先に更新し、headless の持続値は `game/logic/card-resolution/theory-incarnation.ts` と `shared/manifest-stone-registry.ts` の顕現石メタデータに反映する。UI は canonical marker の `remainingOwnerTurns` を表示するだけなので、表示用詳細文と効果タグだけを追従させ、board writer や playback order は触らない。

**Tech Stack:** TypeScript / JavaScript, Jest, existing card-resolution modules, existing catalog/detail UI surfaces.

---

## Document Role

この文書は仕様変更の実装計画書。実際のゲーム仕様変更は `01-rulebook.md` と `正本/カード仕様正本.md` に反映して初めて正本になる。

## Target

- 対象カード: `理論の化身`
- `cardId`: `theory_incarnation_01`
- `type`: `THEORY_INCARNATION`
- 変更分類: player-visible behavior change
- 変更後仕様: 顕現石として盤面に出た `理論の化身` は5ターン持続する
- 連動仕様: 配置直後出現は持続ターンぶんの出現回数を消費しないため、理論数字マスに空きが残っていれば最大6回特殊石を出現できる

## Investigation Notes

- ユーザー指定は「4から5ターン」だが、現在確認できる root 正本と実装では `理論の化身` は3ターン。
- 現在の4ターン顕現石は `盤界の執行者`。この計画はユーザー文面の主語である `理論の化身` を5ターン化する。
- 実装直前に `rg -n "理論の化身|THEORY_INCARNATION|3T|3ターン|4T|4ターン|最大4回" ...` を再実行し、現 checkout が既に4ターン化済みなら同じ最終値5へ更新する。

## Non-Goals

- `盤界の執行者`、`盤理の観測者`、通常特殊石の持続ターンは変更しない。
- 顕現石の不可侵、専用BGM、専用背景、終了演出、ルーレット演出時間は変更しない。
- CPU デッキ内容、カードコスト、理論数字マスの生成候補は変更しない。
- `worker-public/` や `dist/` を source として手編集しない。

## File Map

- Modify: `01-rulebook.md`
  - `THEORY_INCARNATION（理論の化身）` の持続ターン、出現回数説明を更新する。
- Modify: `正本/カード仕様正本.md`
  - `理論の化身` 行の持続ターンと最大出現回数を更新する。
- Modify: `shared/manifest-stone-registry.ts`
  - `MANIFEST_STONE_METADATA.THEORY_INCARNATION.durationOwnerTurns` を5にする。
- Modify: `game/logic/card-resolution/theory-incarnation.ts`
  - fallback と state 初期値に使う `THEORY_DURATION_OWNER_TURNS` を5にする。
- Modify: `cards/card-interaction-effects.ts`
  - 詳細説明の `3T` と最大4回を更新し、効果タグを5ターンにする。
- Modify: `ui/debug-test-scenarios.ts`
  - デバッグ用の既成 `THEORY_INCARNATION` marker を5ターンにする。
- Modify: `test/game.theory-incarnation.test.ts`
  - marker 初期値、残り出現回数、満了タイミングの期待値を5ターン仕様に更新する。
- Modify: `test/ui.card-detail-effect-tags.test.ts`
  - 必要なら `THEORY_INCARNATION` 用の表示タグテストを追加する。
- Optional Modify: `test/ui.long-press-info.test.ts`
  - `理論の化身` の長押し情報テストが無い場合、5ターン不可侵の説明確認を追加する。

---

### Task 1: Write Failing Headless Tests

**Files:**
- Modify: `test/game.theory-incarnation.test.ts`

- [ ] **Step 1: Update placement test expectation to 5 turns**

In `test/game.theory-incarnation.test.ts`, change the marker expectation in `使用時に空きマスを理論数字マスへ書き換え、次の配置石を理論石にする`:

```ts
expect(marker.data).toEqual(expect.objectContaining({ remainingOwnerTurns: 5, absoluteProtected: true }));
```

- [ ] **Step 2: Update placement-spawn count expectation to 5**

In `理論石を配置した直後にも理論数字マスから特殊石を出現させ、残り3回を消費しない`, rename the test and update the assertion:

```ts
test('理論石を配置した直後にも理論数字マスから特殊石を出現させ、残り5回を消費しない', () => {
  // existing setup remains unchanged
  expect(cardState.theoryIncarnationStateByPlayer.black.remainingSpawnCount).toBe(5);
});
```

- [ ] **Step 3: Update manual fixture counters from 3 to 5 where they represent initial theory duration**

In `test/game.theory-incarnation.test.ts`, replace initial `THEORY_INCARNATION` marker fixtures that model a freshly active theory stone:

```ts
CardLogic.addMarker(cardState, 'manifestStone', 2, 2, 'black', {
  type: 'THEORY_INCARNATION',
  remainingOwnerTurns: 5,
  absoluteProtected: true,
  sourceType: 'THEORY_INCARNATION'
});
```

For `theoryIncarnationStateByPlayer.black`, use:

```ts
cardState.theoryIncarnationStateByPlayer = {
  black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 5 },
  white: null
};
```

- [ ] **Step 4: Replace the expiry timing test with a 5-turn version**

Replace the body of `理論石顕現中は複数回の自ターン開始で連続して自動終了する` so it has five theory number cells and expires on the fifth owner turn start:

```ts
test('理論石顕現中は5回の自ターン開始で連続して自動終了し、5回目に満了する', () => {
  const prng = createPrng([0, 0, 0, 0, 0]);
  const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
  const gameState = createGameState();
  gameState.currentPlayer = Shared.BLACK;
  cardState.boardBonusByCell = { '0,0': 5, '0,1': 5, '0,2': 5, '0,3': 5, '0,4': 5 };
  cardState.theoryNumberCellByCell = {
    '0,0': { sessionId: 'theory_black_1', ownerKey: 'black' },
    '0,1': { sessionId: 'theory_black_1', ownerKey: 'black' },
    '0,2': { sessionId: 'theory_black_1', ownerKey: 'black' },
    '0,3': { sessionId: 'theory_black_1', ownerKey: 'black' },
    '0,4': { sessionId: 'theory_black_1', ownerKey: 'black' }
  };
  cardState.theoryNumberCellsBySession = {
    theory_black_1: {
      ownerKey: 'black',
      cells: Object.fromEntries([0, 1, 2, 3, 4].map((col) => [
        `0,${col}`,
        {
          row: 0,
          col,
          value: 5,
          originalValue: 0,
          originalConsumed: false,
          spawnType: 'GHOST',
          sourceCardId: 'ghost_01',
          sourceCardType: 'GHOST_WILL',
          sourceCardCost: 5
        }
      ]))
    }
  };
  cardState.theoryIncarnationStateByPlayer = {
    black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 5 },
    white: null
  };
  CardLogic.addMarker(cardState, 'manifestStone', 2, 2, 'black', {
    type: 'THEORY_INCARNATION',
    remainingOwnerTurns: 5,
    absoluteProtected: true,
    sourceType: 'THEORY_INCARNATION'
  });

  for (let turn = 1; turn <= 4; turn += 1) {
    gameState.currentPlayer = Shared.BLACK;
    const result = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 0, col: turn - 1 }, prng);
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'theory_incarnation_auto_turn_end', player: 'black' }));
    expect(result.events.map((event: any) => event && event.type)).not.toContain('theory_incarnation_marker_expired');
    expect(cardState.theoryIncarnationStateByPlayer.black.remainingSpawnCount).toBe(5 - turn);
    expect(gameState.currentPlayer).toBe(Shared.WHITE);
  }

  gameState.currentPlayer = Shared.BLACK;
  const fifth = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 0, col: 4 }, prng);
  const eventTypes = fifth.events.map((event: any) => event && event.type);
  const spawnIndex = eventTypes.indexOf('theory_incarnation_spawned');
  const autoEndIndex = eventTypes.indexOf('theory_incarnation_auto_turn_end');
  const expiredIndex = eventTypes.indexOf('theory_incarnation_marker_expired');

  expect(spawnIndex).toBeGreaterThanOrEqual(0);
  expect(autoEndIndex).toBeGreaterThan(spawnIndex);
  expect(expiredIndex).toBeGreaterThan(autoEndIndex);
  expect(gameState.currentPlayer).toBe(Shared.WHITE);
  expect(cardState.theoryIncarnationStateByPlayer.black).toBeNull();
  expect(cardState.markers.some((entry: any) => (
    entry &&
    entry.kind === 'manifestStone' &&
    entry.data &&
    entry.data.type === 'THEORY_INCARNATION'
  ))).toBe(false);
  expect(cardState.markers.filter((entry: any) => entry && entry.data && entry.data.sourceType === 'THEORY_INCARNATION')).toHaveLength(5);
});
```

- [ ] **Step 5: Run focused headless test and verify it fails before implementation**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.theory-incarnation.test.ts
```

Expected before implementation: FAIL on `remainingOwnerTurns: 5` and `remainingSpawnCount: 5` expectations because the source still initializes theory duration to the current value.

---

### Task 2: Update Canonical Rule Documents

**Files:**
- Modify: `01-rulebook.md`
- Modify: `正本/カード仕様正本.md`

- [ ] **Step 1: Update `01-rulebook.md` theory duration**

In `### 10.23.1.0 THEORY_INCARNATION（理論の化身）`, replace the theory duration and maximum spawn wording:

```md
- 使用後、次に置く自石として理論の化身を5ターン持続の顕現石として盤面に出し、配置直後にも理論数字マスから特殊石を1体出現させる
...
- 理論の化身の所有者ターン開始時は、特殊石出現と持続ターン処理を行った後、そのまま自動でターン終了する。配置直後の特殊石出現はこの5回分の出現回数を消費しないため、理論数字マスに空きが残っていれば最大6回特殊石を出現できる
...
- 理論の化身は5ターン持続する不可侵の顕現石。持続終了時に通常石へ戻る
```

- [ ] **Step 2: Update `正本/カード仕様正本.md` theory row**

Replace the `理論の化身` row text so the relevant sentence reads:

```md
次に置く自石を5ターン持続・不可侵の顕現石「理論の化身」にする。
```

and the maximum spawn sentence reads:

```md
配置直後の出現は5ターンぶんの出現回数を消費しないため、最大6回特殊石を出現できる。
```

- [ ] **Step 3: Search for stale doc references**

Run:

```powershell
rg -n "理論の化身.*3ターン|3ターン.*理論の化身|理論の化身.*3T|3T.*理論の化身|最大4回特殊石|3回分の出現回数|3ターン持続の顕現石" 01-rulebook.md 正本 cards ui game test tests
```

Expected after docs update but before implementation: only implementation and tests that are intentionally handled in later tasks should remain.

---

### Task 3: Update Headless Duration Sources

**Files:**
- Modify: `shared/manifest-stone-registry.ts`
- Modify: `game/logic/card-resolution/theory-incarnation.ts`

- [ ] **Step 1: Update shared manifest metadata**

In `shared/manifest-stone-registry.ts`, change only `THEORY_INCARNATION.durationOwnerTurns`:

```ts
durationOwnerTurns: 5,
```

- [ ] **Step 2: Update theory fallback constant**

In `game/logic/card-resolution/theory-incarnation.ts`, change:

```ts
const THEORY_DURATION_OWNER_TURNS = 5;
```

This keeps fallback marker data, `remainingSpawnCount`, and restored state defaults aligned with the shared registry.

- [ ] **Step 3: Run focused headless test**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.theory-incarnation.test.ts
```

Expected after implementation: PASS.

---

### Task 4: Update Card Detail and Debug Surfaces

**Files:**
- Modify: `cards/card-interaction-effects.ts`
- Modify: `ui/debug-test-scenarios.ts`
- Modify: `test/ui.card-detail-effect-tags.test.ts`
- Optional Modify: `test/ui.long-press-info.test.ts`

- [ ] **Step 1: Update theory detailed text**

In `cards/card-interaction-effects.ts`, update the `THEORY_INCARNATION` long detail string:

```ts
THEORY_INCARNATION: '数字マスから実際に得た布石合計が42以上で使用可能。\n演算の意志などで数字マス布石が増えた場合は、増加後の獲得量で数える。通常反転ぶんの布石は数えない。\n盤面に顕現石が存在する間は使用できない。\n使用時、盤面上の空きマスを特殊石カードのコストに対応した理論数字マスへ書き換える。\n次に置く自石として理論の化身を5T不可侵の顕現石として出し、配置直後にも理論数字マスから特殊石を1体出現させる。\n理論の化身が盤上にいる間、自分はカード使用も石配置もできない。\n自分ターン開始時、理論数字マスから対応コストの特殊石がランダムで1体現れ、そのまま自分ターンを終了する。\n配置直後の出現は5Tぶんの出現回数を消費しないため、最大6回特殊石を出現できる。\n罠石と時限爆弾は理論の出現候補に含まれない。\n理論の化身が消滅すると、未消費の理論数字マスは元の数字マスへ戻る。',
```

- [ ] **Step 2: Update theory numeric effect tag**

In `cards/card-interaction-effects.ts`, change:

```ts
THEORY_INCARNATION: freezeCardEffectTags([inviolableTag(), durationTurnsTag(5)]),
```

- [ ] **Step 3: Update debug scenario marker**

In `ui/debug-test-scenarios.ts`, update the `debug_theory_manifest_black` marker:

```ts
data: {
  type: 'THEORY_INCARNATION',
  remainingOwnerTurns: 5,
  absoluteProtected: true,
  sourceType: 'THEORY_INCARNATION',
  visualEffectKey: 'theoryIncarnationStone'
}
```

- [ ] **Step 4: Add or update card-detail tag test for theory**

If no `THEORY_INCARNATION` detail-tag test exists, add this to `test/ui.card-detail-effect-tags.test.ts` near the existing manifest stone tag tests:

```ts
test('THEORY_INCARNATION shows inviolable together with updated duration', () => {
  require('../cards/card-interaction.js');

  const cardDef = {
    id: 'theory_incarnation_01',
    name: '理論の化身',
    type: 'THEORY_INCARNATION',
    cost: 0,
    desc: '数字マスから実際に得た布石合計42以上で使用可能。空きマスを理論数字マスへ書き換え、理論の化身を顕現させる。'
  };

  global.cardState.selectedCardId = cardDef.id;
  global.cardState.hands.black = [cardDef.id];
  global.CardLogic.getCardDef = () => cardDef;

  window.updateCardDetailPanel();

  expect(getTagLabels()).toEqual(['不可侵', '5ターン持続']);
  expect(getTagLabels()).not.toContain('絶対保護');
  expect(document.getElementById('card-detail-more').textContent).toContain('理論の化身を5T不可侵の顕現石として出す');
  expect(document.getElementById('card-detail-more').textContent).toContain('最大6回特殊石を出現できる');
});
```

- [ ] **Step 5: Run focused UI detail tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.card-detail-effect-tags.test.ts test/ui.long-press-info.test.ts test/ui.manifest-effect-panel.test.ts
```

Expected: PASS. `test/ui.manifest-effect-panel.test.ts` should not require expected-value changes because it renders active marker `remainingOwnerTurns` values dynamically.

---

### Task 5: Regenerate Browser-Loaded Outputs If Needed

**Files:**
- Generated if command changes them: `cards/catalog.js`, `cards/catalog.ts`, `cards/catalog.generated.js`
- Generated if command changes them: `dist/*`, `public/module-registry.js`
- Mirror if command changes them: `worker-public/*`

- [ ] **Step 1: Decide whether catalog generation is needed**

Do not edit `cards/catalog.json` for this change unless the short catalog description currently includes the old duration. If `cards/catalog.json` is unchanged, skip `npm run generate:catalog`.

Run:

```powershell
rg -n "理論の化身.*3T|理論の化身.*3ターン|最大4回|THEORY_INCARNATION.*duration" cards/catalog.json cards
```

Expected: no `cards/catalog.json` duration text requiring catalog regeneration. If generated catalog outputs are already dirty from unrelated work, do not stage or overwrite them for this task unless this task intentionally regenerates them.

- [ ] **Step 2: Build browser assets when UI module text changes**

Because `cards/card-interaction-effects.ts` and `ui/debug-test-scenarios.ts` are browser-loaded sources, run:

```powershell
npm run build:browser
```

Expected: PASS. Inspect generated diff and include only files intentionally updated by this task.

- [ ] **Step 3: Prepare worker mirror only if root-to-worker served assets changed**

If `build:browser` or root source changes affect the Worker-served static surface, run:

```powershell
npm run worker:prepare
```

Expected: PASS. Do not hand-edit `worker-public/`.

---

### Task 6: Final Verification and Commit

**Files:**
- All files intentionally changed in Tasks 2-5.

- [ ] **Step 1: Run stale-reference search**

Run:

```powershell
rg -n "理論の化身.*3ターン|3ターン.*理論の化身|理論の化身.*3T|3T.*理論の化身|最大4回特殊石|3回分の出現回数|remainingSpawnCount: 3|remainingOwnerTurns: 3" 01-rulebook.md 正本 cards ui game test tests shared
```

Expected: no stale `理論の化身` duration references. Remaining `3ターン` hits for unrelated cards such as `守る意志`, `破壊龍`, `封鎖の意志`, or non-theory test fixtures are acceptable only if the hit does not mention `理論の化身` / `THEORY_INCARNATION`.

- [ ] **Step 2: Run focused behavior and UI checks**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.theory-incarnation.test.ts test/ui.card-detail-effect-tags.test.ts test/ui.long-press-info.test.ts test/ui.manifest-effect-panel.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run type/build checks for changed TypeScript**

Run:

```powershell
npm run typecheck
npm run build:ts
```

Expected: PASS.

- [ ] **Step 4: Inspect diff and dirty files**

Run:

```powershell
git status --short
git diff -- 01-rulebook.md "正本/カード仕様正本.md" shared/manifest-stone-registry.ts game/logic/card-resolution/theory-incarnation.ts cards/card-interaction-effects.ts ui/debug-test-scenarios.ts test/game.theory-incarnation.test.ts test/ui.card-detail-effect-tags.test.ts test/ui.long-press-info.test.ts test/ui.manifest-effect-panel.test.ts
```

Expected: diff contains only the `理論の化身` 5ターン化 and generated outputs intentionally produced by this task. Pre-existing unrelated dirty files must remain unstaged.

- [ ] **Step 5: Stage only intentional files**

Run a targeted `git add` with the actual changed files. Example:

```powershell
git add 01-rulebook.md "正本/カード仕様正本.md" shared/manifest-stone-registry.ts game/logic/card-resolution/theory-incarnation.ts cards/card-interaction-effects.ts ui/debug-test-scenarios.ts test/game.theory-incarnation.test.ts test/ui.card-detail-effect-tags.test.ts
```

If generated build or worker files were intentionally updated, add them explicitly by path. Do not use `git add -A`.

- [ ] **Step 6: Commit**

Run:

```powershell
git commit -m "理論の化身の顕現ターンを5に変更"
```

Expected: commit succeeds. Final report should mention the current checkout originally showed `理論の化身` as3ターン, despite the request saying4ターン, and that the final implemented value is5ターン.

---

## Self-Review

- Spec coverage: The plan covers rulebook, `正本/カード仕様正本.md`, canonical headless duration, display detail text, effect tags, debug fixture, focused headless tests, focused UI tests, browser build, optional worker mirror, and commit hygiene.
- Placeholder scan: No `TBD`, `TODO`, or unspecified "add tests" steps remain.
- Boundary check: `game/logic/card-resolution/theory-incarnation.ts` stays headless; UI surfaces only consume card detail metadata or marker state. No DOM, network, sound, or playback dependency is added to game/shared logic.
- Risk: The request says `4から5ターン`, but current source says `理論の化身` is3ターン. Execution should proceed as final-value alignment to5ターン unless the user clarifies that `盤界の執行者` was the intended4ターン source.

# Theory Incarnation Placement Spawn Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change `理論の化身` so it rewrites theory-number cells, manifests, then spawns by roulette after placement; on later owner turns it allows normal legal placement, spawns after that placement, grants no charge from theory spawns, and lasts 4 owner turns.

**Architecture:** Keep canonical rule changes in `game/logic/card-resolution/theory-incarnation*` and turn sequencing in `game/turn/*`. Preserve the existing headless event pipeline and roulette presentation event; UI only consumes updated events/text and must not decide spawn results.

**Tech Stack:** TypeScript/CommonJS hybrid modules, Jest, existing turn pipeline, generated card catalog scripts, browser runtime build, Cloudflare Worker mirror generated from root source.

---

## Requirements

- Initial flow: `理論の化身使用 -> 理論数字マスに書き換え -> 顕現石を置く -> ルーレット開始 -> 特殊石出現 -> ターン終了`.
- Later owner turns while active: owner cannot use cards; if a legal move exists, owner places a normal stone first, then theory roulette starts, then a special stone appears, then the turn ends.
- If no legal move exists, the owner makes a normal pass. The pass does not trigger theory roulette. This plan consumes one owner-turn duration on that pass so `4ターン持続` remains literal.
- Theory-spawned special stones still place on the selected theory-number cell, still flip bracketed stones, still fire immediate placement effects, and still consume the selected theory-number cell.
- Theory-spawned special stones grant `0` charge and do not increase `numberCellCollectedTotalByPlayer`.
- Duration changes from 5 owner turns to 4 owner turns. The initial manifest-placement spawn does not consume the 4 later owner-turn duration, so the maximum spawn count is 5: initial manifest spawn plus up to 4 later owner-placement spawns.
- `理論の化身` still locks the owner out of card use while active. It no longer locks normal stone placement.
- Root files are source of truth. Do not edit `worker-public/`, `dist/`, generated catalog projections, or `public/module-registry.js` as source.

## File Structure

- Modify `01-rulebook.md`: update the player-visible rule, panel text, short summary, sound/playback trigger wording, no-charge rule, and 4-turn duration.
- Modify `正本/カード仕様正本.md`: mirror the new card behavior summary.
- Modify `正本/演出正本.md`: move theory roulette trigger wording from turn start to post-placement and update panel text.
- Modify `cards/catalog.json`: update the short description for `theory_incarnation_01`.
- Modify generated catalog projections with `npm run generate:catalog`: `cards/catalog.js`, `cards/catalog.ts`, `cards/catalog.generated.js`.
- Modify `cards/card-interaction-effects.ts`: update short/detail copy and duration tag from 5 to 4.
- Modify `shared/manifest-stone-registry.ts`: set `THEORY_INCARNATION.durationOwnerTurns` to 4.
- Modify `game/logic/cards/markers.ts`: keep theory card-play lock, remove theory placement lock.
- Modify `game/logic/card-resolution/theory-incarnation.ts`: change duration constant, remove turn-start spawn/autoturn behavior, add owner-placement and owner-pass processing helpers.
- Modify `game/logic/card-resolution/theory-incarnation-spawn.ts`: stop awarding charge and number-cell collected total for theory spawns.
- Modify `game/logic/card-resolution/theory-incarnation-state.ts`: keep state initialization, but retire auto-turn-end pending state if no longer read after implementation.
- Modify `game/logic/cards.ts`: expose new theory helper wrappers through public `CardLogic`.
- Modify `game/turn/action-phase/place-resolution.ts`: run theory spawn after initial manifest placement and after later successful owner placements.
- Modify `game/turn/turn-start/special-stone-phase.ts`: stop theory turn-start spawn and stop setting `theoryAutoTurnEnd`.
- Modify `game/turn/turn_pipeline_phases.ts`: remove the theory auto-turn-end branch and decrement/expire theory on legal pass.
- Modify `game/cpu-turn-handler.ts`: remove the special CPU detour that defers to turn-start auto-end when placement is locked.
- Modify `ui/diff-renderer.ts`: update the manifest effect panel text.
- Modify or remove stale tests in `test/game.theory-incarnation.test.ts`, `test/special-card-foundation.test.ts`, `test/cards.catalog.test.ts`, `test/cards.numeric-effect-tags.test.ts`, `test/ui.card-detail-effect-tags.test.ts`, `test/ui.manifest-effect-panel.test.ts`, `test/cpu.turn-handler.programmed-card-policy.test.ts`, `test/turn-manager.retry.test.ts`, and `test/ui.pass-stale-busy.test.ts`.
- Run `npm run build:browser` after source/catalog changes so browser-loaded generated surfaces are current.
- Run `npm run worker:prepare` only after all root behavior changes pass focused verification and need worker-public mirror sync.

---

### Task 0: Baseline And Dirty Tree Check

**Files:**
- Read: `01-rulebook.md`
- Read: `docs/architecture-contracts.md`
- Read: `正本/カード仕様正本.md`
- Read: `正本/演出正本.md`
- Read: `game/logic/card-resolution/theory-incarnation.ts`
- Read: `game/logic/card-resolution/theory-incarnation-spawn.ts`
- Read: `game/turn/action-phase/place-resolution.ts`
- Read: `game/turn/turn-start/special-stone-phase.ts`
- Read: `game/turn/turn_pipeline_phases.ts`
- Read: `game/logic/cards/markers.ts`
- Read: `game/cpu-turn-handler.ts`
- Test: existing focused baseline tests

- [ ] **Step 1: Confirm the working tree**

Run:

```powershell
git status --short
```

Expected: dirty files are classified before editing. If dirty files include any file listed in this plan, inspect that file before editing:

```powershell
git diff -- <path>
```

- [ ] **Step 2: Run focused baseline tests before edits**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.theory-incarnation.test.ts test\special-card-foundation.test.ts test\cards.catalog.test.ts test\cards.numeric-effect-tags.test.ts test\ui.card-detail-effect-tags.test.ts test\ui.manifest-effect-panel.test.ts test\cpu.turn-handler.programmed-card-policy.test.ts test\turn-manager.retry.test.ts test\ui.pass-stale-busy.test.ts
```

Expected: PASS before implementation. If this fails before edits, record the failing test names and stop implementation until the baseline failure is understood.

- [ ] **Step 3: Run the architecture boundary check**

Run:

```powershell
npm run check:window
```

Expected: PASS. This protects the documented headless boundary before editing `game/`.

- [ ] **Step 4: Commit nothing**

This task is inspection only. Do not stage or commit.

---

### Task 1: Update Player-Visible Specification

**Files:**
- Modify: `01-rulebook.md`
- Modify: `正本/カード仕様正本.md`
- Modify: `正本/演出正本.md`

- [ ] **Step 1: Update `01-rulebook.md` theory card bullets**

In `### 10.23.1.0 THEORY_INCARNATION（理論の化身）`, replace the current theory behavior bullets with this wording, preserving the existing cost and usage-condition bullets above them:

```markdown
- 使用時、盤面上の空きマスを、特殊石カードのコストに対応した理論数字マスへ書き換える
- 理論数字マスは通常の数字マスとは別の見た目で表示する
- 使用後、次に置く自石として理論の化身を4ターン持続の顕現石として盤面に出し、配置直後にも理論数字マスから特殊石を1体出現させる
- 理論の化身が盤面にある間、その所有者はカード使用できない。石配置は通常の合法手として行える
- 理論の化身の所有者が通常の合法手で石を置いた後、空いている理論数字マスからランダムに1マスを選び、その数字に対応するコストの特殊石を1体出現させる
- 理論の化身の所有者に合法手がない場合は通常どおりパスする。このパスでは理論ルーレットも特殊石出現も発生しない
- 理論の化身で出現する特殊石候補は、特殊石分類のうち `罠石（TRAP）` と `時限爆弾（TIME_BOMB）` を除外する
- 理論の化身で出現した特殊石が配置直後効果を持つ場合、顕現石の配置直後出現と所有者の石配置後出現のどちらでも、出現直後に同じ即時効果を発動する
- 理論の化身で出現する特殊石は、確定した理論数字マスへ通常配置と同じ反転判定で配置される。挟める列がある場合はその列の敵石を反転し、挟める列がない場合でも特殊石は出現する
- 理論の化身による特殊石出現時は、候補理論マスを2.5秒の19ステップ固定ルーレットで点滅させ、確定マスをダーク発光させながら特殊石を約2秒かけてフェードインさせる
- 理論の化身による特殊石出現では布石を獲得しない。確定した理論数字マス値も、実際に反転した石数も、布石獲得と理論の化身使用条件の数字マス獲得合計には加算しない
- 配置直後の特殊石出現は4ターンぶんの出現回数を消費しないため、理論数字マスに空きが残っていれば最大5回特殊石を出現できる
- 理論の化身が持続終了で通常石へ戻るとき、未消費の理論数字マスは使用前の数字マス状態へ戻る。消費済みの理論数字マスは戻らない
- 理論の化身は4ターン持続する不可侵の顕現石。持続終了時に通常石へ戻る
```

- [ ] **Step 2: Update rulebook panel and short summary text**

In the manifest effect panel section, replace the theory panel line:

```markdown
`理論の化身`: `理論領域`、`所有者: カード使用不可`、`空きマスを理論数字マス化`、`石配置後に理論数字マスから特殊石が出現`
```

In the short summary section, replace the theory summary with:

```markdown
`理論の化身`: `空きマスを理論数字マス化`、`石配置後に特殊石が出現`
```

- [ ] **Step 3: Update rulebook sound/playback trigger wording**

Replace the current theory sound/playback sentence with:

```markdown
- 理論の化身が理論数字マスから特殊石を出現させるときは、顕現石の配置直後と所有者の通常石配置後のどちらでも、候補理論マスの2.5秒ルーレット、確定マスのダーク発光、特殊石の約2秒フェードインを同じ playback event として再生し、ルーレット開始と同時に専用音（`theory_incarnation_spawn`）を再生する。ルーレットのマス切り替えは候補マス数に依存せず19ステップ固定とし、`62.5ms x8`、`125ms x7`、`250ms x2`、`375ms x1`、`250ms x1` の間隔で進み、最後の間隔後に特殊石フェードインを開始する
```

- [ ] **Step 4: Update `正本/カード仕様正本.md`**

Replace the `理論の化身` row description with this single-cell description:

```markdown
自分が対局中に獲得した数字マスの印字値合計が42以上のときだけ使用できる。使用時に空きマスを特殊石カードのコストに対応した理論数字マスへ一時的に書き換え、次に置く自石を4ターン持続・不可侵の顕現石「理論の化身」にする。理論の化身を配置した直後にも、空いている理論数字マスからランダムに1マスを選んで対応コストの特殊石を1体出現させる。理論の化身が盤面にある間、所有者はカード使用できないが、通常の合法手で石を置ける。次ターン以降は所有者が通常の合法手で石を置いた後、空いている理論数字マスからランダムに1マスを選んで対応コストの特殊石を1体出現させる。合法手がない場合は通常どおりパスし、理論ルーレットも特殊石出現も発生しない。理論で出現した特殊石が配置直後効果を持つ場合、顕現石の配置直後出現と所有者の石配置後出現のどちらでも出現直後に同じ即時効果を発動する。出現時は確定マスで通常配置と同じ反転判定を行い、挟める列があれば反転する。挟める列がなくても特殊石の出現は成立する。理論召喚では布石を獲得せず、確定した理論数字マス値と実際に反転した石数は理論の化身使用条件の数字マス獲得合計にも加算しない。配置直後の出現は4ターンぶんの出現回数を消費しないため、最大5回特殊石を出現できる。理論の出現候補から罠石と時限爆弾は除外する。持続終了時、未消費の理論数字マスは使用前の数字マス状態へ戻り、消費済みマスは戻らない。
```

- [ ] **Step 5: Update `正本/演出正本.md`**

Replace the `理論の化身` row with:

```markdown
| 理論の化身 | 顕現石の配置直後、または所有者が通常の合法手で石を置いた直後に理論数字マスから特殊石が出現するときは、候補理論マスを2.5秒の19ステップ固定ルーレットで点滅させる。マス切り替えは候補数に依存せず、ルーレット開始効果音内の単音タイミングに合わせる。最終的に選ばれるマスは headless の抽選結果に必ず一致させ、停止後は確定マスをダーク発光させながら特殊石を約2秒かけてフェードインさせる。ローカルとネット対戦の両者で同じ playback event を再生し、UI 側が抽選結果を決めてはいけない。顕現効果パネルには `理論領域`、`所有者: カード使用不可`、`空きマスを理論数字マス化`、`石配置後に理論数字マスから特殊石が出現` を表示する。 |
```

- [ ] **Step 6: Verify docs**

Run:

```powershell
rg -n "自動でターン終了|カード使用も石配置もできない|5ターン持続|5T|布石を獲得する|33\\+2=35|所有者ターン開始時" 01-rulebook.md 正本\カード仕様正本.md 正本\演出正本.md
```

Expected: no stale theory-incarnation wording remains in these three files, except unrelated cards such as `盤理の観測者` or other non-theory effects.

- [ ] **Step 7: Commit the spec-only change**

Run:

```powershell
git add 01-rulebook.md 正本\カード仕様正本.md 正本\演出正本.md
git commit -m "Update theory incarnation rule spec"
```

Expected: commit succeeds and includes only the three spec files.

---

### Task 2: Add RED Tests For New Theory Behavior

**Files:**
- Modify: `test/game.theory-incarnation.test.ts`
- Modify: `test/special-card-foundation.test.ts`
- Modify: `test/cpu.turn-handler.programmed-card-policy.test.ts`

- [ ] **Step 1: Add theory no-charge regression**

Append this test inside `describe('理論の化身', () => {` in `test/game.theory-incarnation.test.ts`:

```ts
test('理論召喚は布石と理論条件合計を増やさない', () => {
  const prng = createPrng([0]);
  const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
  const gameState = createGameState();
  gameState.currentPlayer = Shared.BLACK;
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY));
  gameState.board[0][0] = Shared.EMPTY;
  gameState.board[0][1] = Shared.WHITE;
  gameState.board[0][2] = Shared.BLACK;
  cardState.charge.black = 10;
  cardState.chargeGainedTotal.black = 0;
  cardState.numberCellCollectedTotalByPlayer.black = 42;
  cardState.boardBonusByCell = { '0,0': 33 };
  cardState.boardBonusConsumedByCell = {};
  cardState.theoryNumberCellByCell = {
    '0,0': { sessionId: 'theory_black_1', ownerKey: 'black' }
  };
  cardState.theoryNumberCellsBySession = {
    theory_black_1: {
      ownerKey: 'black',
      cells: {
        '0,0': {
          row: 0,
          col: 0,
          value: 33,
          originalValue: 0,
          originalConsumed: false,
          spawnType: 'GHOST',
          sourceCardId: 'ghost_01',
          sourceCardType: 'GHOST_WILL',
          sourceCardCost: 33,
          markerData: {
            type: 'GHOST',
            remainingOwnerTurns: 8,
            sourceType: 'THEORY_INCARNATION',
            sourceCardId: 'ghost_01',
            sourceCardType: 'GHOST_WILL'
          }
        }
      }
    }
  };
  cardState.theoryIncarnationStateByPlayer = {
    black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 4 },
    white: null
  };

  const result = CardLogic.processTheoryIncarnationMarkerAfterOwnerPlacement(cardState, gameState, 'black', prng);

  expect(result.spawned).toEqual(expect.objectContaining({
    chargeGained: 0,
    theoryNumberValue: 33,
    flips: [{ row: 0, col: 1 }]
  }));
  expect(cardState.charge.black).toBe(10);
  expect(cardState.chargeGainedTotal.black).toBe(0);
  expect(cardState.numberCellCollectedTotalByPlayer.black).toBe(42);
});
```

Expected before implementation: FAIL because `processTheoryIncarnationMarkerAfterOwnerPlacement` is not exported and current spawn awards charge.

- [ ] **Step 2: Add placement-before-roulette pipeline regression**

Append this test in `test/game.theory-incarnation.test.ts`:

```ts
test('理論石顕現中は通常配置後に理論ルーレットを発生させてターン終了する', () => {
  const prng = createPrng([0]);
  const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
  const gameState = createGameState();
  gameState.currentPlayer = Shared.BLACK;
  cardState.boardBonusByCell = { '0,0': 5 };
  cardState.boardBonusConsumedByCell = {};
  cardState.theoryNumberCellByCell = {
    '0,0': { sessionId: 'theory_black_1', ownerKey: 'black' }
  };
  cardState.theoryNumberCellsBySession = {
    theory_black_1: {
      ownerKey: 'black',
      cells: {
        '0,0': {
          row: 0,
          col: 0,
          value: 5,
          originalValue: 0,
          originalConsumed: false,
          spawnType: 'GHOST',
          sourceCardId: 'ghost_01',
          sourceCardType: 'GHOST_WILL',
          sourceCardCost: 5,
          markerData: {
            type: 'GHOST',
            remainingOwnerTurns: 8,
            sourceType: 'THEORY_INCARNATION',
            sourceCardId: 'ghost_01',
            sourceCardType: 'GHOST_WILL'
          }
        }
      }
    }
  };
  cardState.theoryIncarnationStateByPlayer = {
    black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 4 },
    white: null
  };
  CardLogic.addMarker(cardState, 'manifestStone', 2, 2, 'black', {
    type: 'THEORY_INCARNATION',
    remainingOwnerTurns: 4,
    absoluteProtected: true,
    sourceType: 'THEORY_INCARNATION',
    sessionId: 'theory_black_1'
  });

  const result = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 }, prng);
  const eventTypes = result.events.map((event: any) => event && event.type);
  const placeIndex = eventTypes.indexOf('place');
  const spawnIndex = eventTypes.indexOf('theory_incarnation_spawned');

  expect(CardLogic.isPlacementLockedForPlayer(cardState, 'black')).toBe(false);
  expect(placeIndex).toBeGreaterThanOrEqual(0);
  expect(spawnIndex).toBeGreaterThan(placeIndex);
  expect(result.events).toContainEqual(expect.objectContaining({
    type: 'theory_incarnation_spawned',
    player: 'black',
    timing: 'after_owner_placement',
    detail: expect.objectContaining({ type: 'GHOST', chargeGained: 0 })
  }));
  expect(result.events.map((event: any) => event && event.type)).not.toContain('theory_incarnation_auto_turn_end');
  expect(cardState.theoryIncarnationStateByPlayer.black.remainingSpawnCount).toBe(3);
  expect(cardState.markers.find((entry: any) => entry && entry.data && entry.data.type === 'THEORY_INCARNATION').data.remainingOwnerTurns).toBe(3);
  expect(gameState.currentPlayer).toBe(Shared.WHITE);
});
```

Expected before implementation: FAIL because placement is locked or turn-start auto-end runs before placement.

- [ ] **Step 3: Add pass-without-roulette regression**

Append this helper-level test in `test/game.theory-incarnation.test.ts`:

```ts
test('理論石顕現中の合法手なしパスはルーレットを発生させず持続だけ進める', () => {
  const prng = createPrng([0]);
  const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
  const gameState = createGameState();
  cardState.theoryIncarnationStateByPlayer = {
    black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 2 },
    white: null
  };
  cardState.theoryNumberCellsBySession = {
    theory_black_1: {
      ownerKey: 'black',
      cells: {
        '0,0': {
          row: 0,
          col: 0,
          value: 5,
          originalValue: 0,
          originalConsumed: false,
          spawnType: 'GHOST',
          sourceCardId: 'ghost_01',
          sourceCardType: 'GHOST_WILL',
          sourceCardCost: 5
        }
      }
    }
  };
  CardLogic.addMarker(cardState, 'manifestStone', 2, 2, 'black', {
    type: 'THEORY_INCARNATION',
    remainingOwnerTurns: 2,
    absoluteProtected: true,
    sourceType: 'THEORY_INCARNATION',
    sessionId: 'theory_black_1'
  });

  const result = CardLogic.processTheoryIncarnationOwnerPass(cardState, gameState, 'black', prng);

  expect(result).toEqual(expect.objectContaining({
    applied: true,
    spawned: null,
    remainingOwnerTurns: 1,
    remainingSpawnCount: 1
  }));
  expect(cardState.theoryIncarnationStateByPlayer.black.remainingSpawnCount).toBe(1);
  expect(cardState.boardBonusConsumedByCell['0,0']).toBeUndefined();
});
```

Expected before implementation: FAIL because `processTheoryIncarnationOwnerPass` is not exported.

- [ ] **Step 4: Update lock expectations in `test/special-card-foundation.test.ts`**

In `card and placement locks are derived from active manifestation markers`, change the theory placement assertion:

```ts
expect(CardMarkers.isPlacementLockedForPlayer(cardState, 'black')).toBe(false);
expect(CardMarkers.isPlacementLockedForPlayer(cardState, 'white')).toBe(false);
```

Keep card play lock assertions unchanged:

```ts
expect(CardMarkers.isCardPlayLockedForPlayer(cardState, 'black')).toBe(true);
expect(CardMarkers.isCardPlayLockedForPlayer(cardState, 'white')).toBe(true);
```

Expected before implementation: FAIL because theory still placement-locks its owner.

- [ ] **Step 5: Update CPU regression**

Replace `CPU turn defers to turn-start auto end while 理論の化身 locks placement` in `test/cpu.turn-handler.programmed-card-policy.test.ts` with:

```ts
test('CPU turn places a normal stone while 理論の化身 is active', async () => {
  const move = { row: 2, col: 3, flips: [{ row: 3, col: 3 }] };
  global.cpuSmartness = { white: 7, black: 1 };
  global.cardState = {
    hands: { white: ['some_card'], black: [] },
    charge: { white: 50, black: 10 },
    pendingEffectByPlayer: { white: null, black: null },
    hasUsedCardThisTurnByPlayer: { white: false, black: false },
    hasDestroyedCardThisTurnByPlayer: { white: false, black: false },
    lastTurnStartedFor: 'white',
    markers: [
      {
        kind: 'manifestStone',
        row: 2,
        col: 2,
        owner: 'white',
        data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 3 }
      }
    ]
  };
  global.gameState = { board: makeBoard(), currentPlayer: 'white', turnNumber: 12 };
  global.CardLogic = {
    getUsableCardIds: () => [],
    hasUsableCard: () => false,
    getCardDef: (id: string) => ({ id }),
    isPlacementLockedForPlayer: jest.fn(() => false)
  };
  global.generateMovesForPlayer = jest.fn(() => [move]);
  global.selectCpuMoveWithPolicy = jest.fn(() => move);
  global.onTurnStart = jest.fn();

  await mod.runCpuTurn('white');

  expect(global.onTurnStart).not.toHaveBeenCalled();
  expect(global.generateMovesForPlayer).toHaveBeenCalledWith('white');
  expect(global.selectCpuMoveWithPolicy).toHaveBeenCalled();
  expect(global.executeMove).toHaveBeenCalledWith(move);
  expect(global.processPassTurn).not.toHaveBeenCalled();
});
```

Expected before implementation: FAIL if CPU still detours through placement-lock turn-start handling.

- [ ] **Step 6: Run RED tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.theory-incarnation.test.ts test\special-card-foundation.test.ts test\cpu.turn-handler.programmed-card-policy.test.ts
```

Expected: FAIL for the new expectations. Record the failing test names in the task notes.

- [ ] **Step 7: Commit RED tests**

Do not commit if unrelated dirty changes touch these same test files. If the diff is isolated, run:

```powershell
git add test\game.theory-incarnation.test.ts test\special-card-foundation.test.ts test\cpu.turn-handler.programmed-card-policy.test.ts
git commit -m "Add theory incarnation behavior regressions"
```

Expected: commit contains only RED test changes.

---

### Task 3: Update Duration And Placement/Card Locks

**Files:**
- Modify: `shared/manifest-stone-registry.ts`
- Modify: `game/logic/card-resolution/theory-incarnation.ts`
- Modify: `game/logic/cards/markers.ts`
- Modify: `cards/card-interaction-effects.ts`
- Test: `test/special-card-foundation.test.ts`
- Test: `test/cards.numeric-effect-tags.test.ts`

- [ ] **Step 1: Change canonical theory duration constants**

In `game/logic/card-resolution/theory-incarnation.ts`, change:

```ts
const THEORY_DURATION_OWNER_TURNS = 4;
```

In `shared/manifest-stone-registry.ts`, change the theory metadata:

```ts
durationOwnerTurns: 4,
```

- [ ] **Step 2: Remove theory placement lock while preserving card-play lock**

In `game/logic/cards/markers.ts`, replace `isPlacementLockedForPlayer` with:

```ts
function isPlacementLockedForPlayer(cardState: CardState, playerKey: PlayerKey): boolean {
    void cardState;
    void playerKey;
    return false;
}
```

Do not change `isCardPlayLockedForPlayer`; it must still return true for the theory owner and for both players under `BOARD_EXECUTOR`.

- [ ] **Step 3: Update card detail duration tag**

In `cards/card-interaction-effects.ts`, change:

```ts
THEORY_INCARNATION: freezeCardEffectTags([usageConditionTag('数字マス42獲得で使用可能'), inviolableTag(), durationTurnsTag(4)]),
```

- [ ] **Step 4: Update stale tests for duration metadata**

In `test/cards.numeric-effect-tags.test.ts`, change theory expectations to:

```ts
expect(getEffectTagLabels('THEORY_INCARNATION')).toEqual(['数字マス42獲得で使用可能', '不可侵', '4ターン持続']);
expect(getNumericTagLabels('THEORY_INCARNATION')).toEqual(['4ターン持続']);
```

In `test/special-card-foundation.test.ts`, change theory marker examples from `remainingOwnerTurns: 5` to `remainingOwnerTurns: 4` where the test is asserting metadata shape rather than old behavior.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\special-card-foundation.test.ts test\cards.numeric-effect-tags.test.ts
```

Expected: PASS for duration and lock tests. Other theory behavior tests may still fail until later tasks.

- [ ] **Step 6: Commit duration and lock change**

Run:

```powershell
git add shared\manifest-stone-registry.ts game\logic\card-resolution\theory-incarnation.ts game\logic\cards\markers.ts cards\card-interaction-effects.ts test\special-card-foundation.test.ts test\cards.numeric-effect-tags.test.ts
git commit -m "Allow theory owner placement"
```

Expected: commit succeeds with only these files.

---

### Task 4: Make Theory Spawn A Post-Placement Owner Action

**Files:**
- Modify: `game/logic/card-resolution/theory-incarnation.ts`
- Modify: `game/logic/cards.ts`
- Modify: `game/turn/action-phase/place-resolution.ts`
- Modify: `game/turn/turn-start/special-stone-phase.ts`
- Modify: `game/turn/turn_pipeline_phases.ts`
- Test: `test/game.theory-incarnation.test.ts`
- Test: `test/turn-manager.retry.test.ts`

- [ ] **Step 1: Add owner-turn advancement helper in theory resolution**

In `game/logic/card-resolution/theory-incarnation.ts`, add this helper near `findTheoryMarker`:

```ts
function findActiveTheoryMarkerForOwner(cardState: CardState, ownerKey: PlayerKey, deps: any): any {
    const getMarkers = deps && deps.getMarkers;
    const markers = typeof getMarkers === 'function' ? getMarkers(cardState) : ((cardState as any).markers || []);
    return markers.find((entry: any) => (
        entry &&
        entry.owner === ownerKey &&
        entry.data &&
        String(entry.data.type || '').toUpperCase() === THEORY_MARKER_TYPE &&
        Number(entry.data.remainingOwnerTurns) > 0
    )) || null;
}

function decrementTheoryDuration(cardState: CardState, marker: any, ownerKey: PlayerKey): { state: any; remainingOwnerTurns: number; remainingSpawnCount: number } {
    const state = (cardState as any).theoryIncarnationStateByPlayer[ownerKey] || {
        sessionId: marker && marker.data ? marker.data.sessionId || null : null,
        ownerKey,
        remainingSpawnCount: THEORY_DURATION_OWNER_TURNS
    };
    state.remainingSpawnCount = Math.max(0, Number(state.remainingSpawnCount || 0) - 1);
    (cardState as any).theoryIncarnationStateByPlayer[ownerKey] = state;

    const before = Number(marker && marker.data && marker.data.remainingOwnerTurns);
    const after = Number.isFinite(before) ? Math.max(0, Math.trunc(before) - 1) : 0;
    marker.data.remainingOwnerTurns = after;
    return { state, remainingOwnerTurns: after, remainingSpawnCount: state.remainingSpawnCount };
}
```

- [ ] **Step 2: Add shared expiration helper**

In the same file, extract the body of `finalizeTheoryIncarnationAutoTurnEndExpiration` into a reusable function:

```ts
function expireTheoryIncarnationMarker(cardState: CardState, gameState: GameState, ownerKey: PlayerKey, marker: any, prng: any, deps: any): Record<string, any> | null {
    ensureTheoryState(cardState as any);
    const state = (cardState as any).theoryIncarnationStateByPlayer[ownerKey] || null;
    const sessionId = (state && state.sessionId) || (marker && marker.data && marker.data.sessionId) || null;
    const restoredCount = sessionId ? restoreTheoryNumberCells(cardState as any, sessionId) : 0;

    let row = Number(marker && marker.row);
    let col = Number(marker && marker.col);
    const markerId = marker && marker.id ? marker.id : null;
    let reverted = false;
    if (Number.isFinite(row) && Number.isFinite(col) && deps && typeof deps.revertSpecialStoneWithPresentation === 'function') {
        const revertRes = deps.revertSpecialStoneWithPresentation(
            cardState,
            gameState,
            row,
            col,
            THEORY_MARKER_TYPE,
            ownerKey,
            'SYSTEM',
            'duration_end',
            {
                special: THEORY_MARKER_TYPE,
                owner: ownerKey,
                timer: 0,
                random: prng || null
            }
        );
        reverted = !!(revertRes && revertRes.reverted);
    }
    if (!reverted && markerId && deps && typeof deps.removeMarkerById === 'function') {
        deps.removeMarkerById(cardState, markerId);
    }
    (cardState as any).theoryIncarnationStateByPlayer[ownerKey] = null;

    return {
        row: Number.isFinite(row) ? row : null,
        col: Number.isFinite(col) ? col : null,
        owner: ownerKey,
        markerId: markerId || null,
        restoredCount
    };
}
```

Then keep `finalizeTheoryIncarnationAutoTurnEndExpiration` as a compatibility wrapper until all call sites are removed.

- [ ] **Step 3: Replace turn-start processing with no-spawn/no-auto-end**

Replace `processTheoryIncarnationMarkerAtTurnStart` with:

```ts
function processTheoryIncarnationMarkerAtTurnStart(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, prng: any, deps: any): Record<string, any> {
    void gameState;
    void prng;
    const ownerKey = ownerKeyOf(playerKey);
    ensureTheoryState(cardState as any);
    const marker = findTheoryMarker(cardState, row, col, ownerKey, deps);
    if (!marker || !marker.data) return { applied: false, spawned: null, expired: null, autoTurnEnd: false };
    return {
        applied: true,
        spawned: null,
        expired: null,
        autoTurnEnd: false,
        remainingOwnerTurns: Number(marker.data.remainingOwnerTurns || 0),
        remainingSpawnCount: Number(((cardState as any).theoryIncarnationStateByPlayer[ownerKey] || {}).remainingSpawnCount || 0)
    };
}
```

- [ ] **Step 4: Add post-placement and pass helpers**

Add these exports in `game/logic/card-resolution/theory-incarnation.ts`:

```ts
function processTheoryIncarnationMarkerAfterOwnerPlacement(cardState: CardState, gameState: GameState, playerKey: PlayerKey, prng: any, deps: any): Record<string, any> {
    const ownerKey = ownerKeyOf(playerKey);
    ensureTheoryState(cardState as any);
    const marker = findActiveTheoryMarkerForOwner(cardState, ownerKey, deps);
    if (!marker) return { applied: false, spawned: null, expired: null };
    const state = (cardState as any).theoryIncarnationStateByPlayer[ownerKey];
    const spawned = state && Number(state.remainingSpawnCount || 0) > 0
        ? spawnTheorySpecialStone(cardState as any, gameState, state, prng, deps)
        : null;
    const duration = decrementTheoryDuration(cardState, marker, ownerKey);
    const expired = duration.remainingOwnerTurns <= 0
        ? expireTheoryIncarnationMarker(cardState, gameState, ownerKey, marker, prng, deps)
        : null;
    return {
        applied: true,
        spawned,
        expired,
        remainingOwnerTurns: duration.remainingOwnerTurns,
        remainingSpawnCount: duration.remainingSpawnCount
    };
}

function processTheoryIncarnationOwnerPass(cardState: CardState, gameState: GameState, playerKey: PlayerKey, prng: any, deps: any): Record<string, any> {
    const ownerKey = ownerKeyOf(playerKey);
    ensureTheoryState(cardState as any);
    const marker = findActiveTheoryMarkerForOwner(cardState, ownerKey, deps);
    if (!marker) return { applied: false, spawned: null, expired: null };
    const duration = decrementTheoryDuration(cardState, marker, ownerKey);
    const expired = duration.remainingOwnerTurns <= 0
        ? expireTheoryIncarnationMarker(cardState, gameState, ownerKey, marker, prng, deps)
        : null;
    return {
        applied: true,
        spawned: null,
        expired,
        remainingOwnerTurns: duration.remainingOwnerTurns,
        remainingSpawnCount: duration.remainingSpawnCount
    };
}
```

Add both functions to the module export object.

- [ ] **Step 5: Expose wrappers from `game/logic/cards.ts`**

Add wrappers beside the existing theory wrappers:

```ts
function processTheoryIncarnationMarkerAfterOwnerPlacement(cardState: any, gameState: any, playerKey: any, prng?: any) {
    return CardTheoryIncarnationResolutionModule.processTheoryIncarnationMarkerAfterOwnerPlacement(
        cardState,
        gameState,
        playerKey,
        prng,
        getTheoryIncarnationResolutionDeps()
    );
}

function processTheoryIncarnationOwnerPass(cardState: any, gameState: any, playerKey: any, prng?: any) {
    return CardTheoryIncarnationResolutionModule.processTheoryIncarnationOwnerPass(
        cardState,
        gameState,
        playerKey,
        prng,
        getTheoryIncarnationResolutionDeps()
    );
}
```

Add both names to the public export object near the existing theory exports.

- [ ] **Step 6: Wire post-placement spawn in `place-resolution.ts`**

In `game/turn/action-phase/place-resolution.ts`, keep initial manifest placement spawn inside the `theoryStoneRes.applied` branch, but rename local tracking:

```ts
let theoryManifestPlaced = false;
```

Set it when `applyTheoryIncarnationStoneReservation` succeeds:

```ts
theoryManifestPlaced = true;
```

After the theory reservation branch and before board executor reservation, add:

```ts
    if (
        !theoryManifestPlaced &&
        opts.CardLogic &&
        typeof opts.CardLogic.processTheoryIncarnationMarkerAfterOwnerPlacement === 'function'
    ) {
        const activeTheorySpawnRes = opts.CardLogic.processTheoryIncarnationMarkerAfterOwnerPlacement(opts.cardState, opts.gameState, opts.playerKey, p);
        if (activeTheorySpawnRes && activeTheorySpawnRes.spawned) {
            TheorySpawnResolutionModule.resolveTheorySpawnTurnResult({
                CardLogic: opts.CardLogic,
                cardState: opts.cardState,
                gameState: opts.gameState,
                playerKey: opts.playerKey,
                events: opts.events,
                spawned: activeTheorySpawnRes.spawned,
                prng: p,
                timing: 'after_owner_placement',
                awardBoardChargeGain: opts.applyPlacementBoardBonusGain
            });
        }
        if (activeTheorySpawnRes && activeTheorySpawnRes.expired) {
            opts.events.push({ type: 'theory_incarnation_marker_expired', detail: activeTheorySpawnRes.expired });
        }
    }
```

Keep the existing initial manifest placement timing as `on_manifest_placement`.

- [ ] **Step 7: Wire pass duration in `turn_pipeline_phases.ts`**

In the pass branch of `applyActionPhase`, immediately before `applyPassCompletion(...)`, add:

```ts
                if (CardLogic && typeof CardLogic.processTheoryIncarnationOwnerPass === 'function') {
                    const theoryPassRes = CardLogic.processTheoryIncarnationOwnerPass(cardState, gameState, playerKey, p);
                    if (theoryPassRes && theoryPassRes.expired) {
                        events.push({ type: 'theory_incarnation_marker_expired', detail: theoryPassRes.expired });
                    }
                }
```

Then keep:

```ts
                applyPassCompletion(CardLogic, Core, cardState, gameState, playerKey, events);
```

- [ ] **Step 8: Remove theory auto-end turn-start behavior**

In `game/turn/turn-start/special-stone-phase.ts`, keep the theory branch but remove spawn resolution and `processingState.theoryAutoTurnEnd = true`. The branch should call `processTheoryIncarnationMarkerAtTurnStart` only to preserve compatibility, then return `processingState`.

In `game/turn/turn_pipeline_phases.ts`, remove the block that pushes:

```ts
events.push({ type: 'theory_incarnation_auto_turn_end', player: playerKey });
```

and remove the call to `applyNonPassTurnCompletion(...)` for theory auto-end.

- [ ] **Step 9: Update stale auto-end tests**

In `test/game.theory-incarnation.test.ts`, replace tests asserting `theory_incarnation_auto_turn_end` with new assertions for placement-first spawn, pass-without-roulette, and 4-turn expiry.

In `test/turn-manager.retry.test.ts`, replace `onTurnStart stops after 理論の化身 auto turn end without scheduling a normal pass` with a test that verifies `onTurnStart` logs the normal turn start and does not call `processPassTurn` solely because theory is active.

- [ ] **Step 10: Run focused tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.theory-incarnation.test.ts test\turn-manager.retry.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit post-placement sequencing**

Run:

```powershell
git add game\logic\card-resolution\theory-incarnation.ts game\logic\cards.ts game\turn\action-phase\place-resolution.ts game\turn\turn-start\special-stone-phase.ts game\turn\turn_pipeline_phases.ts test\game.theory-incarnation.test.ts test\turn-manager.retry.test.ts
git commit -m "Spawn theory stones after owner placement"
```

Expected: commit succeeds with only these files.

---

### Task 5: Remove Theory Spawn Charge Gain

**Files:**
- Modify: `game/logic/card-resolution/theory-incarnation-spawn.ts`
- Test: `test/game.theory-incarnation.test.ts`

- [ ] **Step 1: Replace charge awarding helper**

In `game/logic/card-resolution/theory-incarnation-spawn.ts`, replace `awardTheorySpawnCharge` with:

```ts
function awardTheorySpawnCharge(cardState: any, ownerKey: PlayerKey, row: number, col: number, numberValue: number, flipCount: number, deps: any): number {
    void cardState;
    void ownerKey;
    void row;
    void col;
    void numberValue;
    void flipCount;
    void deps;
    return 0;
}
```

This keeps the public return field `chargeGained` stable while making the new rule explicit.

- [ ] **Step 2: Remove unused import from theory spawn**

In the destructuring near the top of `theory-incarnation-spawn.ts`, remove `addNumberCellCollectedTotal`:

```ts
const {
    ownerKeyOf,
    cellKeyOf
} = TheoryIncarnationState;
```

- [ ] **Step 3: Verify no stale theory charge gain rule remains in tests**

Run:

```powershell
rg -n "theory_incarnation_spawn_gain|chargeGained\\).*toBe\\((5|7|33)|numberCellCollectedTotalByPlayer\\.black\\).*toBe\\((47|75)" test\game.theory-incarnation.test.ts
```

Expected: no stale expectations that theory spawn grants charge or increases the theory condition total.

- [ ] **Step 4: Run focused theory tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.theory-incarnation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit no-charge behavior**

Run:

```powershell
git add game\logic\card-resolution\theory-incarnation-spawn.ts test\game.theory-incarnation.test.ts
git commit -m "Stop theory spawn charge gain"
```

Expected: commit succeeds with only these files.

---

### Task 6: Update CPU Flow

**Files:**
- Modify: `game/cpu-turn-handler.ts`
- Modify: `test/cpu.turn-handler.programmed-card-policy.test.ts`

- [ ] **Step 1: Remove placement-lock turn-start detour from CPU run loop**

In `game/cpu-turn-handler.ts`, delete this block from `runCpuTurn`:

```ts
        if (!othelloMode && await handlePlacementLockedCpuTurnStart(playerKey)) {
            return;
        }
```

Keep `handlePlacementLockedCpuTurnStart` only if other code still references it. If `rg -n "handlePlacementLockedCpuTurnStart" game\cpu-turn-handler.ts` shows only the function definition, remove the function and `isPlacementLockedForCpuPlayer` together.

- [ ] **Step 2: Keep card usage blocked through existing `CardLogic`**

Do not add a CPU-specific theory check. `CpuTurnCardPhase` and card usability must continue to rely on `CardLogic.getUsableCardIds`, `CardLogic.hasUsableCard`, and `CardLogic.canUseCard`, which already use `isCardPlayLockedForPlayer`.

- [ ] **Step 3: Run CPU tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\cpu.turn-handler.programmed-card-policy.test.ts test\shared.cpu-opponent-profiles.test.ts test\game.cpu-policy-core.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit CPU flow**

Run:

```powershell
git add game\cpu-turn-handler.ts test\cpu.turn-handler.programmed-card-policy.test.ts
git commit -m "Let theory CPU place normally"
```

Expected: commit succeeds with only these files.

---

### Task 7: Update Player Text, UI Panel, Catalog, And Generated Projections

**Files:**
- Modify: `cards/catalog.json`
- Modify: `cards/catalog.js`
- Modify: `cards/catalog.ts`
- Modify: `cards/catalog.generated.js`
- Modify: `cards/card-interaction-effects.ts`
- Modify: `ui/diff-renderer.ts`
- Modify: `test/cards.catalog.test.ts`
- Modify: `test/ui.card-detail-effect-tags.test.ts`
- Modify: `test/ui.manifest-effect-panel.test.ts`

- [ ] **Step 1: Update catalog source description**

In `cards/catalog.json`, change `theory_incarnation_01.desc_ja` to:

```json
"空きマスを理論数字マス化し、理論の化身を顕現。顕現中は石配置後に理論数字マスから特殊石が現れる。"
```

- [ ] **Step 2: Update shared card text resolver**

In `cards/card-interaction-effects.ts`, change the short text:

```ts
THEORY_INCARNATION: '空きマスを理論数字マス化し、理論の化身を顕現。顕現中は石配置後に理論数字マスから特殊石が現れる。',
```

Change the detail text to:

```ts
THEORY_INCARNATION: '演算の意志などで数字マス布石が増えた場合は、増加後の獲得量で数える。通常反転ぶんの布石は数えない。\n盤面に顕現石が存在する間は使用できない。\n使用時、盤面上の空きマスを特殊石カードのコストに対応した理論数字マスへ書き換える。\n次に置く自石として理論の化身を4T不可侵の顕現石として出し、配置直後にも理論数字マスから特殊石を1体出現させる。\n理論の化身が盤上にいる間、自分はカード使用できないが、通常の合法手で石を置ける。\n次ターン以降は石を置いた後に理論数字マスから対応コストの特殊石がランダムで1体現れる。\n合法手がない場合は通常どおりパスし、理論ルーレットも特殊石出現も発生しない。\n理論召喚では布石を獲得せず、理論の化身使用条件の数字マス獲得合計にも加算しない。\n配置直後の出現は4Tぶんの出現回数を消費しないため、最大5回特殊石を出現できる。\n罠石と時限爆弾は理論の出現候補に含まれない。\n理論の化身が消滅すると、未消費の理論数字マスは元の数字マスへ戻る。',
```

- [ ] **Step 3: Update manifest effect panel text**

In `ui/diff-renderer.ts`, change the theory panel lines to:

```ts
lines: [
    '所有者: カード使用不可',
    '空きマスを理論数字マス化',
    '石配置後に理論数字マスから特殊石が出現'
],
```

- [ ] **Step 4: Regenerate catalog projections**

Run:

```powershell
npm run generate:catalog
```

Expected: PASS and updates only generated catalog projection files for the catalog text change.

- [ ] **Step 5: Update UI/text tests**

In `test/cards.catalog.test.ts`, change the theory description expectation to:

```ts
expect(card.desc_ja).toBe('空きマスを理論数字マス化し、理論の化身を顕現。顕現中は石配置後に理論数字マスから特殊石が現れる。');
```

In `test/ui.card-detail-effect-tags.test.ts`, update the fixture `desc` to the same short description and update any `5ターン持続` expectation to `4ターン持続`.

In `test/ui.manifest-effect-panel.test.ts`, change:

```ts
expect(panel?.textContent).toContain('所有者: カード使用不可');
expect(panel?.textContent).toContain('石配置後に理論数字マスから特殊石が出現');
expect(panel?.textContent).not.toContain('所有者: 石配置・カード使用不可');
```

- [ ] **Step 6: Run focused text tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\cards.catalog.test.ts test\cards.numeric-effect-tags.test.ts test\ui.card-detail-effect-tags.test.ts test\ui.manifest-effect-panel.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit text and generated catalog changes**

Run:

```powershell
git add cards\catalog.json cards\catalog.js cards\catalog.ts cards\catalog.generated.js cards\card-interaction-effects.ts ui\diff-renderer.ts test\cards.catalog.test.ts test\cards.numeric-effect-tags.test.ts test\ui.card-detail-effect-tags.test.ts test\ui.manifest-effect-panel.test.ts
git commit -m "Update theory incarnation player text"
```

Expected: commit succeeds with only these files.

---

### Task 8: Clean Stale Debug And Pass UI Assumptions

**Files:**
- Modify: `ui/debug-test-scenarios.ts`
- Modify: `test/ui.debug-test-scenarios.test.ts`
- Modify: `test/ui.pass-stale-busy.test.ts`
- Modify: any file found by the stale-text search in this task

- [ ] **Step 1: Update debug scenario duration values**

In `ui/debug-test-scenarios.ts`, replace theory debug marker examples:

```ts
remainingOwnerTurns: 4
```

Update matching expectations in `test/ui.debug-test-scenarios.test.ts` from `remainingOwnerTurns: 5` to `remainingOwnerTurns: 4`.

- [ ] **Step 2: Replace stale pass UI test**

In `test/ui.pass-stale-busy.test.ts`, replace `manual pass proceeds when theory placement lock makes normal legal moves unusable` with a test that keeps manual pass disabled when legal moves exist and theory is active:

```ts
test('manual pass stays disabled when theory is active but legal moves exist', () => {
  const action = resolveActionState({
    isAutoMode: false,
    canActThisTurn: true,
    canInteract: true,
    hasNotUsedThisTurn: true,
    getLegalMovesForCurrentPlayer: jest.fn(() => [{ row: 2, col: 3 }]),
    isPlacementLockedForPlayer: jest.fn(() => false),
    isSelectedCardUsableNow: jest.fn(() => false)
  });

  expect(action.canPass).toBe(false);
});
```

If the local helper name differs, adapt the test to the existing exported function in that file while keeping the same assertion.

- [ ] **Step 3: Search for stale assumptions**

Run:

```powershell
rg -n "自動終了|auto turn end|auto_turn_end|placement lock|石配置・カード使用不可|5ターン持続|5T|remainingOwnerTurns: 5|durationTurnsTag\\(5\\)|理論.*布石" ui cards game shared test tests 01-rulebook.md 正本
```

Expected: every remaining match is either unrelated to `理論の化身` or intentionally preserved in historical plan docs. Source/test stale matches must be updated in this task.

- [ ] **Step 4: Run focused UI/debug tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\ui.debug-test-scenarios.test.ts test\ui.pass-stale-busy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit cleanup**

Run:

```powershell
git add ui\debug-test-scenarios.ts test\ui.debug-test-scenarios.test.ts test\ui.pass-stale-busy.test.ts
git commit -m "Refresh theory debug and pass assumptions"
```

Expected: commit succeeds with only files changed by this task.

---

### Task 9: Build, Browser Bundle, Worker Mirror, And Verification

**Files:**
- Generated by command: `dist/*`
- Generated by command: `public/module-registry.js`
- Generated by command: `worker-public/*`

- [ ] **Step 1: Run full focused behavior suite**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.theory-incarnation.test.ts test\special-card-foundation.test.ts test\cards.catalog.test.ts test\cards.numeric-effect-tags.test.ts test\ui.card-detail-effect-tags.test.ts test\ui.manifest-effect-panel.test.ts test\ui.debug-test-scenarios.test.ts test\ui.pass-stale-busy.test.ts test\cpu.turn-handler.programmed-card-policy.test.ts test\shared.cpu-opponent-profiles.test.ts test\game.cpu-policy-core.test.ts test\turn-manager.retry.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck and browser build**

Run:

```powershell
npm run typecheck
npm run build:browser
```

Expected: both commands PASS. `build:browser` may update `dist/` and `public/module-registry.js`; inspect the diff before staging.

- [ ] **Step 3: Run network parity if turn pipeline or worker authority changed**

Run:

```powershell
npm run test:network:parity
```

Expected: PASS. This protects Worker/local-server equivalence for turn resolution and snapshots.

- [ ] **Step 4: Sync worker mirror**

Run:

```powershell
npm run worker:prepare
```

Expected: PASS and updates only `worker-public/` mirror files needed for root source changes.

- [ ] **Step 5: Run final stale search**

Run:

```powershell
rg -n "理論の化身.*自動|theory_incarnation_auto_turn_end|所有者: 石配置・カード使用不可|顕現中は理論数字マスから特殊石が現れ、自分のターンを終了する|理論召喚では確定した理論数字マス値|33\\+2=35|5ターン持続|5T不可侵" 01-rulebook.md 正本 cards game ui shared test tests
```

Expected: no stale source/test/docs references to the removed theory behavior. Historical plan files under `docs/superpowers/plans/` are not included in this search.

- [ ] **Step 6: Inspect final status and diff**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only intentional source, generated, test, dist, and worker mirror files from this plan are dirty.

- [ ] **Step 7: Commit generated/runtime sync**

Run:

```powershell
git add dist public\module-registry.js worker-public
git commit -m "Sync theory incarnation browser and worker assets"
```

Expected: commit succeeds only if these generated changes are present and were produced by `npm run build:browser` or `npm run worker:prepare`.

If no generated or mirror files changed, skip this commit and record that no sync diff was produced.

---

## Self-Review Checklist

- Requirement coverage:
  - Initial sequence is covered by Task 1 docs and Task 4 manifest-placement path.
  - Later owner placement before roulette is covered by Task 2 RED test and Task 4 post-placement wiring.
  - No legal move pass without roulette is covered by Task 2 RED test and Task 4 pass helper.
  - No charge and no theory-condition gain from spawned stones is covered by Task 2 RED test and Task 5 implementation.
  - Duration 4 is covered by Task 1 docs, Task 3 constants/tags, and Task 7 UI text.
  - CPU behavior is covered by Task 6.
  - Player text and generated catalog are covered by Task 7.
  - Worker/browser sync is covered by Task 9.
- Boundary coverage:
  - `game/` remains headless.
  - UI consumes events/text only.
  - Worker mirror is generated, not source-edited.
- Verification coverage:
  - Focused Jest tests cover card behavior, locks, CPU, UI text, debug setup, pass UI, and turn-manager stale auto-end behavior.
  - `npm run typecheck`, `npm run build:browser`, `npm run test:network:parity`, and `npm run worker:prepare` cover wider runtime impact.

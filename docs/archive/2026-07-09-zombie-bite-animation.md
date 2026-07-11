# Zombie Bite Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 屍石の感染時に、攻撃元から対象へ黒紫の影が走り、牙が閉じてから屍石へ変化する約800msの専用アニメーションを追加する。

**Architecture:** ゲームロジックは既存の `CHANGE` プレゼンテーションイベントへ攻撃元座標を追加し、UIの既存flip再生経路が `ZOMBIE/zombie_infection` の場合だけ専用演出を先行再生する。盤面状態は従来どおりゲームロジックが確定し、UIは一時DOMを表示・除去するだけとする。

**Tech Stack:** TypeScript、Jest、JSDOM、CSS animations、既存AnimationEngine

## Global Constraints

- `game/` にDOM、CSS、音声、タイマー依存を追加しない。
- Single Visual Writerと既存の `events[]` 順序を維持する。
- 噛みつき音 `zombie_will_bite` は既存の同一感染バッチ1回制御を維持する。
- アニメーション無効時は一時DOMを作らず、通常の反転表示を即時適用する。
- `worker-public/` は編集しない。

---

### Task 1: 感染イベント契約

**Files:**
- Modify: `game/logic/cards/zombie_will.ts`
- Modify: `game/turn/turn-start/special-stone-phase.ts`
- Modify: `test/game.zombie-will.test.ts`
- Modify: `test/game.turn-start-marker-order.test.ts`

**Interfaces:**
- Produces: `CHANGE.meta.sourceRow/sourceCol` と `zombie_infected_start.source`
- Consumes: 既存の `BoardOps.changeAt(..., meta)` と `result.infected`

- [ ] **Step 1: Write failing tests**

`processZombieEffectsAtTurnStartAnchor` の注入 `BoardOps.changeAt` が次のmetaを受けることを検証する。

```ts
expect(changeAt).toHaveBeenCalledWith(
  cardState, gameState, targetRow, targetCol, 'black',
  'ZOMBIE', 'zombie_infection',
  expect.objectContaining({ sourceRow: 1, sourceCol: 1 })
);
```

ターン開始イベントが次の形を持つことを検証する。

```ts
expect(events).toContainEqual(expect.objectContaining({
  type: 'zombie_infected_start',
  source: { row: 1, col: 1 },
  details: [{ row: 1, col: 2 }]
}));
```

- [ ] **Step 2: Verify RED**

Run: `npx jest --runInBand test/game.zombie-will.test.ts test/game.turn-start-marker-order.test.ts`

Expected: source metadata assertions fail.

- [ ] **Step 3: Implement minimal event metadata**

Pass `{ sourceRow: row, sourceCol: col }` to `BoardOps.changeAt`. Replace the generic zombie result mapper with one explicit event push containing `source` and `details`, only when infection succeeded.

- [ ] **Step 4: Verify GREEN**

Run: `npx jest --runInBand test/game.zombie-will.test.ts test/game.turn-start-marker-order.test.ts`

Expected: PASS.

### Task 2: 影の顎UI

**Files:**
- Modify: `ui/animation-flip-events.ts`
- Modify: `ui/animation-engine.ts`
- Modify: `styles-animations.css`
- Modify: `test/ui.animation-flip-events.test.ts`
- Modify: `正本/演出正本.md`

**Interfaces:**
- Consumes: flip target `cause === 'ZOMBIE'`, `reason === 'zombie_infection'`, `meta.sourceRow/sourceCol`
- Produces: `playZombieBiteAnimation(target, deps): Promise<void>` の一時DOM演出

- [ ] **Step 1: Write failing animation tests**

JSDOMへ攻撃元セルと対象セルを置き、感染flipで次を検証する。

```ts
expect(document.querySelector('.zombie-bite-shadow')).not.toBeNull();
expect(document.querySelectorAll('.zombie-bite-fang')).toHaveLength(2);
expect(calls).toEqual(expect.arrayContaining(['bite', 'sync:-1', 'trigger']));
```

さらに `isNoAnim() === true` では演出DOMが生成されず、通常のsyncのみ行われることを検証する。

- [ ] **Step 2: Verify RED**

Run: `npx jest --runInBand test/ui.animation-flip-events.test.ts`

Expected: bite DOM and ordering assertions fail.

- [ ] **Step 3: Implement the animation**

`animation-flip-events.ts` で攻撃元・対象セルの中心を取得し、盤面コンテナへ次を追加する。

```html
<div class="zombie-bite-shadow"></div>
<div class="zombie-bite-fang zombie-bite-fang--upper"></div>
<div class="zombie-bite-fang zombie-bite-fang--lower"></div>
```

影を攻撃元から対象へ回転・伸長し、牙を対象中心へ閉じる。約800ms待機後に要素を `finally` で除去し、それから既存の `syncDiscVisual` とflip処理を続行する。DOMや座標が得られない場合は即時完了する。

- [ ] **Step 4: Add CSS**

`styles-animations.css` に黒紫の影、半透明の牙、対象の紫脈動を追加する。要素は `pointer-events:none`、盤面より前面、操作UIより背面とし、`prefers-reduced-motion: reduce` ではアニメーションを無効化する。

- [ ] **Step 5: Update presentation source of truth**

`正本/演出正本.md` のゾンビの意志へ「影が対象へ這い、半透明の牙が閉じた後に屍石へ変化する。不発時は出さない」を追加する。

- [ ] **Step 6: Verify GREEN**

Run: `npx jest --runInBand test/ui.animation-flip-events.test.ts`

Expected: PASS and temporary DOM is absent after completion.

### Task 3: Build and regression verification

**Files:**
- Regenerate: `public/module-registry.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: source TypeScript and CSS
- Produces: up-to-date browser module registry

- [ ] **Step 1: Build browser assets**

Run: `npm run build:browser`

Expected: exit 0 and module registry updated.

- [ ] **Step 2: Run focused regression tests**

Run: `npx jest --runInBand test/game.zombie-will.test.ts test/game.turn-start-marker-order.test.ts test/ui.animation-flip-events.test.ts test/game.regen.consume-visual.test.ts`

Expected: PASS.

- [ ] **Step 3: Run project checks**

Run: `npm run typecheck`

Run: `npm run checkall`

Run: `git diff --check`

Expected: all exit 0.

- [ ] **Step 4: Commit isolated files**

Stage only the plan, event, animation, CSS, source-of-truth, tests, and generated browser registry files. Do not stage pre-existing audio, asset manifest, or `worker-public/` changes.

```powershell
git commit -m "feat: 屍石の噛みつきアニメを追加"
```

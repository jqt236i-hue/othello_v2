# Behavior-Preserving Performance Passes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 終盤・特殊石大量発火・手札増加時の処理負荷を、見た目、入力挙動、canonical state、events[] の意味と順序を変えずに下げる。

**Architecture:** 変更は UI の読み取り・描画差分と、game 側の純粋な marker 検索キャッシュに限定する。`game/`, `shared/`, CPU, pure card logic に DOM/window/audio/timer 依存を入れず、UI 側でも Single Visual Writer と既存 playback order を維持する。

**Tech Stack:** TypeScript, classic browser globals, CommonJS-style module exports, Jest, jsdom, existing `ui/layout-read-batch.ts`, existing render/playback modules.

---

## Non-Negotiable Invariants

- `01-rulebook.md` は変更しない。プレイヤー向け仕様変更ではない。
- `events[]` の順序、種類、payload の意味を変更しない。
- canonical `gameState` / `cardState` の形と更新順を変更しない。
- `game/`, CPU, pure card logic, `shared/` に DOM、`window`、音声、タイマー依存を追加しない。
- `ui/board-renderer.ts` / `ui/diff-renderer.ts` 以外に盤面 DOM writer を追加しない。
- `worker-public/`, `dist/`, `public/module-registry.js` は source として手編集しない。
- 画像プリロード、module registry 分割、cache header、rules-help 遅延生成はこの計画から除外する。これらは体感タイミングや初回表示タイミングが変わる可能性がある。

## File Map

- Modify: `ui/animation-destroy-source-events.ts`
  - 既存の `readElementRect()` helper を使い切り、直 `getBoundingClientRect()` を残さない。
- Modify: `ui/animation-move-events.ts`
  - move playback に `layoutBatch` を受け取る型と `readElementRect()` helper を追加し、move/waypoint/swap の矩形読み取りを一括化する。
- Modify: `ui/animation-engine.ts`
  - `_handleMovePlaybackEvent()` から `layoutBatch: this._getPhaseLayoutBatch()` を move events に渡す。
- Modify: `cards/card-renderer.ts`
  - `renderCardUI()` 全体は短絡しない。`renderHandSlot()` 内の手札カード要素適用だけを、完全同一入力時に短絡する。
  - hand availability glow の矩形計測を既存 layout batch と resize invalidation に寄せる。
- Modify: `ui/diff-renderer.ts`
  - 特殊石/guard/bomb timer だけが変化したセルで、セル丸ごと再生成せず既存 timer node の text/class だけを更新する。
- Modify: `game/logic/cards/markers.ts`
  - pure helper として marker cell index を追加する。
- Modify: `game/move-generator.ts`
  - swap move の special/bomb 判定で marker index を使う。
- Modify: `game/cards/target-resolver.ts`
  - fallback marker scan の高頻度 path で marker index を使う。
- Modify: `game/logic/cards/udg.ts`
  - UDG の manifest/blocking/destroy marker lookup で同一解決内 index を使う。
- Test: `test/ui.animation-layout-batch-source.test.ts`
  - animation modules に直 layout read が再混入しないことを固定する。
- Test: `test/ui.card-renderer-hand-signature.test.ts`
  - 同一手札入力ではカード要素適用を繰り返さず、charge/discard/active/detail 更新は維持することを固定する。
- Test: `test/ui.card-renderer-glow-layout.test.ts`
  - 同一手札 + resize なしでは glow rect を再計測せず、resize invalidation 後は再計測することを固定する。
- Test: `test/ui.diff-renderer-timer-patch.test.ts`
  - 特殊石 timer だけの変更で disc DOM identity が保持され、表示 text/class は更新されることを固定する。
- Test: `test/game.marker-cell-index.test.ts`
  - marker index helper が既存 `findSpecialMarkerAt` / `isSpecialStoneAt` 相当の結果を返すことを固定する。
- Extend: `test/game.move-generator.expansion-pending.test.ts`
  - special/bomb がある通常セルと拡張セルを `SWAP_WITH_ENEMY` が従来通り除外することを固定する。
- Extend: `test/game.cards.target-resolver-taboo-pick.test.ts`
  - index 導入後も target resolver の公開結果が変わらないことを小さく固定する。
- Extend: `test/game.udg-duration.test.ts`
  - UDG の破壊対象・manifest 除外・evade 関連の既存期待を再利用して regression を見る。

---

## Task 0: Preflight And Isolation

**Files:**
- No production files.

- [ ] **Step 1: Check dirty state**

Run:

```powershell
git status --short
```

Expected:

```text
Existing unrelated dirty files may be present.
No implementation files from this plan are edited yet.
```

- [ ] **Step 2: Record protected boundaries**

Run:

```powershell
npm run check:window
```

Expected:

```text
PASS or the same pre-existing failures as before this plan.
```

- [ ] **Step 3: Run current focused baseline**

Run:

```powershell
npm run test:jest -- test/ui.stone-rendering.test.ts test/ui.render-scheduler.test.ts test/game.move-generator.expansion-pending.test.ts test/game.cards.target-resolver-taboo-pick.test.ts test/game.udg-duration.test.ts
```

Expected:

```text
All selected suites pass before edits, or any failure is recorded as pre-existing and the pass is paused.
```

---

## Task 1: Route Animation Layout Reads Through Existing Layout Batch

**Risk:** Low. Same rectangles are read; only the read path changes.

**Files:**
- Modify: `ui/animation-destroy-source-events.ts`
- Modify: `ui/animation-move-events.ts`
- Modify: `ui/animation-engine.ts`
- Create: `test/ui.animation-layout-batch-source.test.ts`

- [ ] **Step 1: Add the source regression test**

Create `test/ui.animation-layout-batch-source.test.ts`:

```ts
import fs from 'fs';
import path from 'path';

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function directRectReadLines(source: string): string[] {
  const lines = source.split(/\r?\n/);
  let readElementRectDepth = 0;
  const offenders: string[] = [];
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    const isReadElementRectStart = /^function readElementRect\(/.test(line);
    const insideReadElementRect = readElementRectDepth > 0 || isReadElementRectStart;
    if (/^function readElementRect\(/.test(line)) {
      readElementRectDepth = 0;
    }
    if (line.includes('.getBoundingClientRect(') && !insideReadElementRect) {
      offenders.push(`${index + 1}: ${line}`);
    }
    if (insideReadElementRect) {
      const opens = (line.match(/{/g) || []).length;
      const closes = (line.match(/}/g) || []).length;
      readElementRectDepth += opens - closes;
      if (readElementRectDepth < 0) readElementRectDepth = 0;
    }
  });
  return offenders;
}

describe('animation layout read batching source contract', () => {
  test('destroy source animations use readElementRect outside the helper fallback', () => {
    const source = readRepoFile('ui/animation-destroy-source-events.ts');
    expect(directRectReadLines(source)).toEqual([]);
  });

  test('move animations use readElementRect outside the helper fallback', () => {
    const source = readRepoFile('ui/animation-move-events.ts');
    expect(directRectReadLines(source)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run:

```powershell
npm run test:jest -- test/ui.animation-layout-batch-source.test.ts
```

Expected:

```text
FAIL with lines from ui/animation-destroy-source-events.ts and ui/animation-move-events.ts that still call getBoundingClientRect directly.
```

- [ ] **Step 3: Replace destroy-source direct reads**

In `ui/animation-destroy-source-events.ts`, replace every direct pair like:

```ts
const fromRect = fromCell.getBoundingClientRect();
const toRect = toCell.getBoundingClientRect();
```

with:

```ts
const fromRect = readElementRect(fromCell, deps);
const toRect = readElementRect(toCell, deps);
if (!fromRect || !toRect) return;
```

For single-cell reads, replace:

```ts
const rect = cell.getBoundingClientRect();
```

with:

```ts
const rect = readElementRect(cell, deps);
if (!rect) return;
```

- [ ] **Step 4: Add move layout batch dependency and helper**

In `ui/animation-move-events.ts`, extend `AnimationMoveEventDeps`:

```ts
    layoutBatch?: {
        readRect?: (element: any) => any;
    } | null;
```

Add near `AnimationMoveEventDeps`:

```ts
function readElementRect(element: any, deps: AnimationMoveEventDeps) {
    if (!element) return null;
    const batch = deps && deps.layoutBatch;
    if (batch && typeof batch.readRect === 'function') {
        const rect = batch.readRect(element);
        if (rect) return rect;
    }
    return typeof element.getBoundingClientRect === 'function'
        ? element.getBoundingClientRect()
        : null;
}
```

- [ ] **Step 5: Replace move direct reads**

In `resolveMoveWaypointDeltas()` replace:

```ts
if (!cell || typeof cell.getBoundingClientRect !== 'function') return [];
const rect = cell.getBoundingClientRect();
```

with:

```ts
const rect = readElementRect(cell, deps);
if (!rect) return [];
```

In `handleExtremeForcedSwapMove()` and `handleMoveEvent()`, replace from/to rect reads with `readElementRect(..., deps)` and keep the existing early-return behavior when either rect is unavailable.

- [ ] **Step 6: Pass phase layout batch into move playback**

In `ui/animation-engine.ts`, inside `_handleMovePlaybackEvent()`, add:

```ts
                layoutBatch: this._getPhaseLayoutBatch(),
```

to the object passed to `AnimationMoveEvents.handleMoveEvent()`.

- [ ] **Step 7: Validate Task 1**

Run:

```powershell
npm run test:jest -- test/ui.animation-layout-batch-source.test.ts test/ui.animation-engine.guard-timer.test.ts test/ui.animation-engine.test.ts
npm run typecheck
```

Expected:

```text
All selected tests pass.
Typecheck passes.
```

- [ ] **Step 8: Commit Task 1 only**

Run:

```powershell
git add ui/animation-destroy-source-events.ts ui/animation-move-events.ts ui/animation-engine.ts test/ui.animation-layout-batch-source.test.ts
git commit -m "Batch animation layout reads"
```

---

## Task 2: Short-Circuit Identical Hand Element Application Only

**Risk:** Medium. Do not short-circuit the whole `renderCardUI()` because charge popups, discard count, active effects, detail panel, and debug layout refresh are side effects that must still run.

**Files:**
- Modify: `cards/card-renderer.ts`
- Create: `test/ui.card-renderer-hand-signature.test.ts`

- [ ] **Step 1: Add the behavior test**

Create `test/ui.card-renderer-hand-signature.test.ts`:

```ts
import { JSDOM } from 'jsdom';

function installDom() {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="deck-black"><span class="deck-count"></span></div>
    <div id="deck-white"><span class="deck-count"></span></div>
    <div id="hand-black"></div>
    <div id="hand-white"></div>
    <div id="charge-black"></div>
    <div id="charge-white"></div>
    <div id="discard-count"></div>
    <div id="active-black"><span class="effect-slot-content"></span></div>
    <div id="active-white"><span class="effect-slot-content"></span></div>
    <div id="card-detail-panel"></div>
  </body></html>`);
  (global as any).window = dom.window;
  (global as any).document = dom.window.document;
  (global as any).HTMLElement = dom.window.HTMLElement;
  return dom;
}

function installState() {
  (global as any).BLACK = 1;
  (global as any).WHITE = -1;
  (global as any).EMPTY = 0;
  (global as any).gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(0)),
    currentPlayer: 1
  };
  (global as any).cardState = {
    hands: { black: ['ghost_01', 'trap_01'], white: ['hidden_01'] },
    decks: { black: [], white: [] },
    deck: [],
    initialDeckSizeByPlayer: { black: 30, white: 30 },
    charge: { black: 99, white: 99 },
    discard: [],
    activeEffectsByPlayer: { black: [], white: [] },
    pendingEffectByPlayer: { black: null, white: null },
    selectedCardId: null,
    selectedCardOwnerKey: null,
    selectedCardHandIndex: null,
    usedCardThisTurnByPlayer: { black: false, white: false }
  };
  (global as any).getCurrentMatchMode = () => 'local';
}

describe('card renderer hand signature', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = installDom();
    installState();
  });

  afterEach(() => {
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).HTMLElement;
    delete (global as any).BLACK;
    delete (global as any).WHITE;
    delete (global as any).EMPTY;
    delete (global as any).gameState;
    delete (global as any).cardState;
    delete (global as any).getCurrentMatchMode;
  });

  test('identical hand input keeps existing card elements while non-hand side effects still update', () => {
    const renderer = require('../cards/card-renderer.js');
    renderer.renderCardUI();

    const firstBlackCard = document.querySelector('#hand-black .hand-track .card-item');
    expect(firstBlackCard).toBeTruthy();

    (global as any).cardState.discard.push('ghost_01');
    renderer.renderCardUI();

    const secondBlackCard = document.querySelector('#hand-black .hand-track .card-item');
    expect(secondBlackCard).toBe(firstBlackCard);
    expect(document.getElementById('discard-count')!.textContent).toBe('1');
  });

  test('changed selection state updates existing card classes without replacing reusable elements', () => {
    const renderer = require('../cards/card-renderer.js');
    renderer.renderCardUI();
    const firstBlackCard = document.querySelector('#hand-black .hand-track .card-item');

    (global as any).cardState.selectedCardId = 'ghost_01';
    (global as any).cardState.selectedCardOwnerKey = 'black';
    (global as any).cardState.selectedCardHandIndex = 0;
    renderer.renderCardUI();

    const selectedBlackCard = document.querySelector('#hand-black .hand-track .card-item');
    expect(selectedBlackCard).toBe(firstBlackCard);
    expect(selectedBlackCard!.classList.contains('selected')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test before implementation**

Run:

```powershell
npm run test:jest -- test/ui.card-renderer-hand-signature.test.ts
```

Expected:

```text
The first test may already pass because existing element reuse exists. The second test must pass before and after the optimization. If setup fails because card definitions differ, adjust only test fixture card IDs to existing catalog IDs and rerun.
```

- [ ] **Step 3: Add hand signature helpers**

In `cards/card-renderer.ts`, near the hand rendering helpers, add:

```ts
const handSlotElementSignatureByContainer = new WeakMap<any, string>();

function _buildHandSlotElementSignature(ownerKey: any, entryStates: any[], shouldFade: any, ownerHandLength: any, showTimeStopVictimOverlay: any) {
    return JSON.stringify({
        ownerKey,
        shouldFade: !!shouldFade,
        ownerHandLength,
        showTimeStopVictimOverlay: !!showTimeStopVictimOverlay,
        entries: (Array.isArray(entryStates) ? entryStates : []).map((state: any) => ({
            visualIndex: state.visualIndex,
            desiredKind: state.desiredKind,
            cardId: state.cardId || null,
            actualIndex: state.actualIndex,
            isCaptureReservedSlot: !!state.isCaptureReservedSlot,
            canInspectOwnerHand: !!state.canInspectOwnerHand,
            canAfford: !!state.canAfford,
            cost: Number(state.cost) || 0,
            usable: !!state.usable,
            availableGlow: !!state.availableGlow,
            isSelected: !!state.isSelected,
            isObserved: !!state.isObserved
        }))
    });
}

function _canSkipHandElementApplication(containerEl: any, handTrackEl: any, signature: string, expectedLength: number) {
    return !!(
        containerEl &&
        handTrackEl &&
        handSlotElementSignatureByContainer.get(containerEl) === signature &&
        handTrackEl.children &&
        handTrackEl.children.length === expectedLength
    );
}

function _markHandElementApplication(containerEl: any, signature: string) {
    if (containerEl) handSlotElementSignatureByContainer.set(containerEl, signature);
}
```

- [ ] **Step 4: Use the signature inside `renderHandSlot()`**

In `renderHandSlot()`, after `entryStates` is computed, insert:

```ts
        const elementSignature = _buildHandSlotElementSignature(
            ownerKey,
            entryStates,
            shouldFade,
            ownerHand.length,
            showTimeStopVictimOverlay
        );
        const canSkipElementApplication = _canSkipHandElementApplication(
            containerEl,
            handTrackEl,
            elementSignature,
            entryStates.length
        );
        if (!canSkipElementApplication) {
            entryStates.forEach((entryState: any) => {
                const cardEl = _ensureRenderedHandElement(handTrackEl, existingChildren, entryState, ownerKey);
                _applyRenderedHandElementState(cardEl, entryState, ownerKey, shouldFade, ownerHand.length);
            });
            while (handTrackEl.children.length > entryStates.length) {
                const extraChild = handTrackEl.lastElementChild;
                if (!extraChild) break;
                _detachHandCardClickHandler(extraChild);
                handTrackEl.removeChild(extraChild);
            }
            _markHandElementApplication(containerEl, elementSignature);
        }
```

Remove the original unconditional `entryStates.forEach(...)` and `while (...)` block. Keep `_syncHandAvailabilityGlowLayer(...)` and `_syncTimeStopHandOverlayForRender(...)` outside the skip block so visible overlay and glow behavior remain unchanged.

- [ ] **Step 5: Validate Task 2**

Run:

```powershell
npm run test:jest -- test/ui.card-renderer-hand-signature.test.ts test/ui.render-scheduler.test.ts test/e2e/network_special_cards.e2e.test.ts
npm run typecheck
```

Expected:

```text
All selected tests pass.
Typecheck passes.
```

- [ ] **Step 6: Commit Task 2 only**

Run:

```powershell
git add cards/card-renderer.ts test/ui.card-renderer-hand-signature.test.ts
git commit -m "Skip identical hand element updates"
```

---

## Task 3: Cache Hand Glow Layout Until Layout Environment Changes

**Risk:** Medium. Glow positioning is visual. The cache must invalidate on resize, scroll offset changes, container/track size changes, and hand entry signature changes.

**Files:**
- Modify: `cards/card-renderer.ts`
- Create: `test/ui.card-renderer-glow-layout.test.ts`

- [ ] **Step 1: Add the glow layout test**

Create `test/ui.card-renderer-glow-layout.test.ts`:

```ts
import { JSDOM } from 'jsdom';

function installDom() {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="deck-black"><span class="deck-count"></span></div>
    <div id="deck-white"><span class="deck-count"></span></div>
    <div id="hand-black"></div>
    <div id="hand-white"></div>
    <div id="charge-black"></div>
    <div id="charge-white"></div>
    <div id="discard-count"></div>
    <div id="active-black"><span class="effect-slot-content"></span></div>
    <div id="active-white"><span class="effect-slot-content"></span></div>
    <div id="card-detail-panel"></div>
  </body></html>`);
  (global as any).window = dom.window;
  (global as any).document = dom.window.document;
  (global as any).HTMLElement = dom.window.HTMLElement;
  return dom;
}

function installState() {
  (global as any).BLACK = 1;
  (global as any).WHITE = -1;
  (global as any).EMPTY = 0;
  (global as any).gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(0)),
    currentPlayer: 1
  };
  (global as any).cardState = {
    hands: { black: ['ghost_01', 'trap_01'], white: [] },
    decks: { black: [], white: [] },
    deck: [],
    initialDeckSizeByPlayer: { black: 30, white: 30 },
    charge: { black: 99, white: 99 },
    discard: [],
    activeEffectsByPlayer: { black: [], white: [] },
    pendingEffectByPlayer: { black: null, white: null },
    selectedCardId: null,
    selectedCardOwnerKey: null,
    selectedCardHandIndex: null,
    usedCardThisTurnByPlayer: { black: false, white: false }
  };
  (global as any).getCurrentMatchMode = () => 'local';
}

describe('card renderer hand glow layout cache', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = installDom();
    installState();
  });

  afterEach(() => {
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).HTMLElement;
    delete (global as any).BLACK;
    delete (global as any).WHITE;
    delete (global as any).EMPTY;
    delete (global as any).gameState;
    delete (global as any).cardState;
    delete (global as any).getCurrentMatchMode;
  });

  test('identical hand input reuses glow layout until layout environment changes', () => {
    const renderer = require('../cards/card-renderer.js');
    const rectSpy = jest.spyOn(dom.window.HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const element = this as HTMLElement;
      const index = Number(element.dataset.handIndex || 0);
      return {
        left: index * 10,
        top: index * 5,
        width: 80,
        height: 120,
        right: index * 10 + 80,
        bottom: index * 5 + 120,
        x: index * 10,
        y: index * 5,
        toJSON: () => ({})
      } as DOMRect;
    });

    renderer.renderCardUI();
    const afterFirst = rectSpy.mock.calls.length;
    renderer.renderCardUI();
    expect(rectSpy.mock.calls.length).toBe(afterFirst);

    const handTrack = document.querySelector('#hand-black .hand-track') as HTMLElement;
    handTrack.scrollLeft = 12;
    renderer.renderCardUI();
    const afterScroll = rectSpy.mock.calls.length;
    expect(afterScroll).toBeGreaterThan(afterFirst);

    dom.window.dispatchEvent(new dom.window.Event('resize'));
    renderer.renderCardUI();
    expect(rectSpy.mock.calls.length).toBeGreaterThan(afterScroll);
  });
});
```

- [ ] **Step 2: Run the glow test and confirm it fails**

Run:

```powershell
npm run test:jest -- test/ui.card-renderer-glow-layout.test.ts
```

Expected:

```text
FAIL because the second identical render still calls getBoundingClientRect.
```

- [ ] **Step 3: Add glow cache state**

In `cards/card-renderer.ts`, near the hand signature cache, add:

```ts
const handGlowLayoutCacheByContainer = new WeakMap<any, { signature: string; layoutKey: string; dirty: boolean }>();
let handGlowResizeListenerInstalled = false;

function _markAllHandGlowLayoutsDirty() {
    try {
        const root = typeof document !== 'undefined' ? document : null;
        if (!root) return;
        ['hand-black', 'hand-white'].forEach((id) => {
            const el = root.getElementById(id);
            const cache = el ? handGlowLayoutCacheByContainer.get(el) : null;
            if (cache) cache.dirty = true;
        });
    } catch (e) { /* ignore */ }
}

function _ensureHandGlowResizeInvalidation() {
    if (handGlowResizeListenerInstalled) return;
    if (typeof window === 'undefined' || !window || typeof window.addEventListener !== 'function') return;
    window.addEventListener('resize', _markAllHandGlowLayoutsDirty);
    handGlowResizeListenerInstalled = true;
}
```

- [ ] **Step 4: Build a glow signature**

Add:

```ts
function _buildHandGlowLayoutSignature(ownerKey: any, entryStates: any[]) {
    return JSON.stringify({
        ownerKey,
        entries: (Array.isArray(entryStates) ? entryStates : [])
            .filter((state: any) => state && state.desiredKind === 'face' && state.availableGlow)
            .map((state: any) => ({
                visualIndex: state.visualIndex,
                cardId: state.cardId || null,
                availableGlow: !!state.availableGlow,
                cost: Number(state.cost) || 0
            }))
    });
}

function _buildHandGlowLayoutEnvironmentKey(containerEl: any, handTrackEl: any) {
    return JSON.stringify({
        containerClientWidth: Number(containerEl && containerEl.clientWidth) || 0,
        containerClientHeight: Number(containerEl && containerEl.clientHeight) || 0,
        trackClientWidth: Number(handTrackEl && handTrackEl.clientWidth) || 0,
        trackClientHeight: Number(handTrackEl && handTrackEl.clientHeight) || 0,
        trackScrollLeft: Number(handTrackEl && handTrackEl.scrollLeft) || 0,
        trackScrollTop: Number(handTrackEl && handTrackEl.scrollTop) || 0,
        childCount: handTrackEl && handTrackEl.children ? handTrackEl.children.length : 0
    });
}
```

- [ ] **Step 5: Skip glow sync only when signature and layout environment are known clean**

At the start of `_syncHandAvailabilityGlowLayer(...)`, after `glowLayerEl` and `handTrackEl` are confirmed:

```ts
    _ensureHandGlowResizeInvalidation();
    const signature = _buildHandGlowLayoutSignature(ownerKey, renderEntries);
    const layoutKey = _buildHandGlowLayoutEnvironmentKey(containerEl, handTrackEl);
    const cached = handGlowLayoutCacheByContainer.get(containerEl);
    if (cached && cached.signature === signature && cached.layoutKey === layoutKey && cached.dirty !== true) {
        return;
    }
```

After successful sync and removal of stale glow elements, add:

```ts
    handGlowLayoutCacheByContainer.set(containerEl, { signature, layoutKey, dirty: false });
```

If `renderEntries` changes, the signature changes and the glow layout is recomputed. If the window resizes, `_markAllHandGlowLayoutsDirty()` forces recompute on the next render. If the hand track scrolls or the container/track dimensions change, `layoutKey` changes and recomputes without requiring a resize event.

- [ ] **Step 6: Validate Task 3**

Run:

```powershell
npm run test:jest -- test/ui.card-renderer-glow-layout.test.ts test/ui.card-renderer-hand-signature.test.ts
npm run typecheck
```

Expected:

```text
All selected tests pass.
Typecheck passes.
```

- [ ] **Step 7: Commit Task 3 only**

Run:

```powershell
git add cards/card-renderer.ts test/ui.card-renderer-glow-layout.test.ts
git commit -m "Cache stable hand glow layout"
```

---

## Task 4: Patch Timed Marker Labels Without Rebuilding The Cell

**Risk:** Medium. This touches board DOM output. Keep the patch path narrow: same stone, same marker type, same non-timer visual flags, only timer text/class differs.

**Files:**
- Modify: `ui/diff-renderer.ts`
- Create: `test/ui.diff-renderer-timer-patch.test.ts`

- [ ] **Step 1: Add the timer patch characterization test**

Create `test/ui.diff-renderer-timer-patch.test.ts`:

```ts
// @jest-environment jsdom

function installGlobals() {
  (global as any).BLACK = 1;
  (global as any).WHITE = -1;
  (global as any).EMPTY = 0;
  (global as any).getLegalMoves = () => [];
  (global as any).getPlayerKey = (player: number) => player === 1 ? 'black' : 'white';
  (global as any).CardLogic = { getCardContext: () => ({}) };
  (global as any).applyStoneVisualEffect = jest.fn();
  (global as any).gameState = {
    currentPlayer: 1,
    board: Array.from({ length: 8 }, () => Array(8).fill(0))
  };
  (global as any).cardState = {
    markers: [],
    pendingEffectByPlayer: { black: null, white: null }
  };
}

describe('diff renderer timed marker patch', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '<div id="board"></div>';
    document.documentElement.classList.add('stone-images-loaded', 'stone-base-images-ready');
    installGlobals();
  });

  afterEach(() => {
    delete (global as any).BLACK;
    delete (global as any).WHITE;
    delete (global as any).EMPTY;
    delete (global as any).getLegalMoves;
    delete (global as any).getPlayerKey;
    delete (global as any).CardLogic;
    delete (global as any).applyStoneVisualEffect;
    delete (global as any).gameState;
    delete (global as any).cardState;
  });

  test('updates only UDG timer text when the stone and marker identity stay the same', () => {
    const boardEl = document.getElementById('board')!;
    (global as any).boardEl = boardEl;
    (global as any).gameState.board[0][0] = 1;
    (global as any).cardState.markers = [
      { id: 'udg-1', kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 8 } }
    ];

    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(boardEl);
    const firstDisc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
    expect(firstDisc).toBeTruthy();
    expect(boardEl.querySelector('.udg-timer')!.textContent).toBe('8');

    (global as any).cardState.markers[0].data.remainingOwnerTurns = 7;
    diffRenderer.renderBoardDiff(boardEl);

    const secondDisc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
    expect(secondDisc).toBe(firstDisc);
    expect(boardEl.querySelector('.udg-timer')!.textContent).toBe('7');
  });

  test('falls back to full cell update when the marker type changes', () => {
    const boardEl = document.getElementById('board')!;
    (global as any).boardEl = boardEl;
    (global as any).gameState.board[0][0] = 1;
    (global as any).cardState.markers = [
      { id: 'marker-1', kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 8 } }
    ];

    const diffRenderer = require('../ui/diff-renderer.js');
    diffRenderer.renderBoardDiff(boardEl);
    const firstDisc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');

    (global as any).cardState.markers[0].data.type = 'DRAGON';
    diffRenderer.renderBoardDiff(boardEl);

    const secondDisc = boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc');
    expect(secondDisc).not.toBe(firstDisc);
  });
});
```

- [ ] **Step 2: Run the timer patch test and confirm the first test fails**

Run:

```powershell
npm run test:jest -- test/ui.diff-renderer-timer-patch.test.ts
```

Expected:

```text
FAIL on disc identity for the timer-only update because the current implementation rebuilds the cell.
```

- [ ] **Step 3: Add timer patch helpers**

In `ui/diff-renderer.ts`, near `_applyDoubleDigitTimerClassForDiff()`, add:

```ts
function _setTimedLabelTextForDiff(label: any, value: any) {
    if (!label) return false;
    const remaining = Math.max(0, Math.trunc(Number(value)));
    label.textContent = String(remaining);
    label.classList.remove('timer-double-digit');
    _applyDoubleDigitTimerClassForDiff(label, remaining);
    return true;
}

function _cloneCellStateWithTimedLabelsNormalizedForDiff(source: any) {
    if (!source || typeof source !== 'object') return source;
    const cloned = {
        ...source,
        special: source.special ? { ...source.special } : source.special,
        inherited: source.inherited ? { ...source.inherited } : source.inherited,
        guard: source.guard ? { ...source.guard } : source.guard,
        bomb: source.bomb ? { ...source.bomb } : source.bomb,
        blockade: source.blockade ? { ...source.blockade } : source.blockade,
        frozen: source.frozen ? { ...source.frozen } : source.frozen,
        seed: source.seed ? { ...source.seed } : source.seed
    };
    if (cloned.special) {
        cloned.special.remainingOwnerTurns = 0;
        cloned.special.flipEvadeRemaining = 0;
        cloned.special.destroyEvadeRemaining = 0;
    }
    if (cloned.inherited) {
        cloned.inherited.remainingOwnerTurns = 0;
        cloned.inherited.flipEvadeRemaining = 0;
        cloned.inherited.destroyEvadeRemaining = 0;
    }
    if (cloned.guard) cloned.guard.remainingOwnerTurns = 0;
    if (cloned.bomb) cloned.bomb.remainingTurns = 0;
    if (cloned.blockade) cloned.blockade.remainingOwnerTurns = 0;
    if (cloned.frozen) cloned.frozen.remainingOwnerTurns = 0;
    if (cloned.seed) cloned.seed.remainingOwnerTurns = 0;
    return cloned;
}

function _onlyTimedLabelsChangedForDiff(prevState: any, state: any) {
    if (!prevState || !state) return false;
    const prevComparable = _cloneCellStateWithTimedLabelsNormalizedForDiff(prevState);
    const nextComparable = _cloneCellStateWithTimedLabelsNormalizedForDiff(state);
    return cellStatesEqual(prevComparable, nextComparable);
}

function _tryPatchTimedMarkerLabelsForDiff(cell: any, prevState: any, state: any) {
    if (!_onlyTimedLabelsChangedForDiff(prevState, state)) return false;
    const disc = cell && cell.querySelector ? cell.querySelector('.disc') : null;
    if (!disc) return false;
    let patched = false;
    if (prevState.special && state.special && prevState.special.remainingOwnerTurns !== state.special.remainingOwnerTurns) {
        const timer = disc.querySelector('.stone-timer, .special-timer, .udg-timer, .dragon-timer, .work-timer');
        patched = _setTimedLabelTextForDiff(timer, state.special.remainingOwnerTurns) || patched;
    }
    if (prevState.special && state.special && prevState.special.flipEvadeRemaining !== state.special.flipEvadeRemaining) {
        patched = _setTimedLabelTextForDiff(disc.querySelector('.flip-evade-timer'), state.special.flipEvadeRemaining) || patched;
    }
    if (prevState.special && state.special && prevState.special.destroyEvadeRemaining !== state.special.destroyEvadeRemaining) {
        patched = _setTimedLabelTextForDiff(disc.querySelector('.destroy-evade-timer'), state.special.destroyEvadeRemaining) || patched;
    }
    if (prevState.guard && state.guard && prevState.guard.remainingOwnerTurns !== state.guard.remainingOwnerTurns) {
        patched = _setTimedLabelTextForDiff(disc.querySelector('.guard-timer'), state.guard.remainingOwnerTurns) || patched;
    }
    if (prevState.bomb && state.bomb && prevState.bomb.remainingTurns !== state.bomb.remainingTurns) {
        patched = _setTimedLabelTextForDiff(disc.querySelector('.bomb-timer.countdown-timer'), state.bomb.remainingTurns) || patched;
    }
    if (prevState.inherited && state.inherited && prevState.inherited.remainingOwnerTurns !== state.inherited.remainingOwnerTurns) {
        patched = _setTimedLabelTextForDiff(disc.querySelector('.inherited-timer'), state.inherited.remainingOwnerTurns) || patched;
    }
    if (prevState.blockade && state.blockade && prevState.blockade.remainingOwnerTurns !== state.blockade.remainingOwnerTurns) {
        patched = _setTimedLabelTextForDiff(cell.querySelector('.blockade-turn'), state.blockade.remainingOwnerTurns) || patched;
    }
    if (prevState.frozen && state.frozen && prevState.frozen.remainingOwnerTurns !== state.frozen.remainingOwnerTurns) {
        patched = _setTimedLabelTextForDiff(cell.querySelector('.freeze-turn'), state.frozen.remainingOwnerTurns) || patched;
    }
    if (prevState.seed && state.seed && prevState.seed.remainingOwnerTurns !== state.seed.remainingOwnerTurns) {
        patched = _setTimedLabelTextForDiff(cell.querySelector('.seed-turn.countdown-timer'), state.seed.remainingOwnerTurns) || patched;
    }
    return patched;
}
```

- [ ] **Step 4: Call the timer patch before full cell clear**

In `updateCellDOM(...)`, after the playback/overlay skip guards and before:

```ts
    // Clear existing classes and content
    cell.className = 'cell';
    cell.innerHTML = '';
```

insert:

```ts
    if (prevState && _tryPatchTimedMarkerLabelsForDiff(cell, prevState, state)) {
        return;
    }
```

This must stay after the destroy-fade and overlay skip guards so active animations are not clobbered. The patch path must use `cellStatesEqual()` after normalizing only timed label values; do not replace it with a hand-written partial identity check, because that would miss legal/highlight/preview/aura/class changes.

- [ ] **Step 5: Validate Task 4**

Run:

```powershell
npm run test:jest -- test/ui.diff-renderer-timer-patch.test.ts test/ui.stone-rendering.test.ts test/ui.animation-engine.test.ts
npm run typecheck
```

Expected:

```text
All selected tests pass.
Typecheck passes.
```

- [ ] **Step 6: Commit Task 4 only**

Run:

```powershell
git add ui/diff-renderer.ts test/ui.diff-renderer-timer-patch.test.ts
git commit -m "Patch stable timed marker labels"
```

---

## Task 5: Add Pure Marker Cell Index And Use It In Hot Marker Lookups

**Risk:** Medium. This is pure logic, but it touches rule-adjacent helpers. Preserve existing result ordering by returning the original marker objects in original array order.

**Files:**
- Modify: `game/logic/cards/markers.ts`
- Modify: `game/move-generator.ts`
- Modify: `game/cards/target-resolver.ts`
- Modify: `game/logic/cards/udg.ts`
- Create: `test/game.marker-cell-index.test.ts`
- Extend: `test/game.move-generator.expansion-pending.test.ts`
- Extend: `test/game.cards.target-resolver-taboo-pick.test.ts`
- Reuse: `test/game.udg-duration.test.ts`

- [ ] **Step 1: Add marker index helper tests**

Create `test/game.marker-cell-index.test.ts`:

```ts
const Markers = require('../game/logic/cards/markers.js');

describe('marker cell index', () => {
  test('keeps marker objects in original order per cell', () => {
    const first = { id: 'a', kind: 'specialStone', row: 2, col: 3, owner: 'black', data: { type: 'GUARD' } };
    const second = { id: 'b', kind: 'bomb', row: 2, col: 3, owner: 'white', data: { type: 'TIME_BOMB', category: 'bomb' } };
    const third = { id: 'c', kind: 'specialStone', row: 4, col: 5, owner: 'black', data: { type: 'FREEZE' } };
    const cardState = { markers: [first, second, third] };

    const index = Markers.createMarkerCellIndex(cardState);
    expect(index.get(2, 3)).toEqual([first, second]);
    expect(index.get(4, 5)).toEqual([third]);
    expect(index.get(9, 9)).toEqual([]);
  });

  test('matches existing find helpers for type and owner filters', () => {
    const guard = { id: 'g', kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'GUARD' } };
    const freeze = { id: 'f', kind: 'specialStone', row: 1, col: 1, owner: 'white', data: { type: 'FREEZE' } };
    const cardState = { markers: [guard, freeze] };

    const index = Markers.createMarkerCellIndex(cardState);
    expect(index.findSpecial(1, 1, 'GUARD', 'black')).toBe(Markers.findSpecialMarkerAt(cardState, 1, 1, 'GUARD', 'black'));
    expect(index.findSpecial(1, 1, 'FREEZE', 'white')).toBe(Markers.findSpecialMarkerAt(cardState, 1, 1, 'FREEZE', 'white'));
    expect(index.isSpecialStoneAt(1, 1)).toBe(Markers.isSpecialStoneAt(cardState, 1, 1));
  });
});
```

- [ ] **Step 2: Run the marker index test and confirm it fails**

Run:

```powershell
npm run test:jest -- test/game.marker-cell-index.test.ts
```

Expected:

```text
FAIL because createMarkerCellIndex is not exported yet.
```

- [ ] **Step 3: Implement the pure marker index helper**

In `game/logic/cards/markers.ts`, add near the lookup helpers:

```ts
function markerCellKey(row: any, col: any): string {
    return `${Number(row)},${Number(col)}`;
}

function createMarkerCellIndex(cardState: CardState) {
    const byCell = new Map<string, any[]>();
    const markers = getMarkers(cardState);
    for (const marker of markers) {
        if (!marker || !Number.isFinite(Number(marker.row)) || !Number.isFinite(Number(marker.col))) continue;
        const key = markerCellKey(marker.row, marker.col);
        const list = byCell.get(key);
        if (list) list.push(marker);
        else byCell.set(key, [marker]);
    }
    const api = {
        get(row: any, col: any): any[] {
            return byCell.get(markerCellKey(row, col)) || [];
        },
        some(row: any, col: any, predicate: (marker: any) => boolean): boolean {
            return api.get(row, col).some(predicate);
        },
        find(row: any, col: any, predicate: (marker: any) => boolean): any {
            return api.get(row, col).find(predicate);
        },
        findSpecial(row: any, col: any, type?: string, owner?: PlayerKey): any {
            return api.find(row, col, (marker: any) => (
                marker &&
                isSpecialStoneMarker(marker) &&
                (type ? (marker.data && marker.data.type === type) : true) &&
                (owner ? marker.owner === owner : true)
            ));
        },
        isSpecialStoneAt(row: any, col: any): boolean {
            return !!api.find(row, col, (marker: any) => {
                if (!marker) return false;
                if (isSpecialStoneMarker(marker) && !isNormalVisualSpecialMarker(marker)) return true;
                return isBombCategoryMarker(marker);
            });
        }
    };
    return api;
}
```

Add `createMarkerCellIndex` to the exported object. Do not change existing `findSpecialMarkerAt`, `getSpecialMarkerAt`, or `isSpecialStoneAt` behavior in this task.

- [ ] **Step 4: Use index in `game/move-generator.ts` swap generation**

At the top-level module setup, require card marker helpers if not already present:

```ts
const MoveGeneratorCardMarkers = requireMoveGeneratorModuleOrNull('./logic/cards/markers');
```

Inside `generateSwapMoves(...)`, replace the local marker scan setup:

```ts
const markers = (typeof cardState !== 'undefined' && cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
```

with:

```ts
const markers = (typeof cardState !== 'undefined' && cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
const markerIndex = MoveGeneratorCardMarkers && typeof MoveGeneratorCardMarkers.createMarkerCellIndex === 'function'
    ? MoveGeneratorCardMarkers.createMarkerCellIndex(cardState)
    : null;
const hasSpecialOrBombAt = (row: any, col: any) => markerIndex
    ? markerIndex.some(row, col, isSpecialOrBombMarkerForMoveGeneration)
    : markers.some((m: any) => (m.row === row && m.col === col) && isSpecialOrBombMarkerForMoveGeneration(m));
```

Then replace both `markers.some(...)` blocks in `generateSwapMoves(...)` with:

```ts
const hasSpecialOrBomb = hasSpecialOrBombAt(r, c);
```

and:

```ts
const hasSpecialOrBomb = hasSpecialOrBombAt(expansion.row, expansion.col);
```

- [ ] **Step 5: Extend swap move tests**

Append to `test/game.move-generator.expansion-pending.test.ts`:

```ts
  test('SWAP_WITH_ENEMY still excludes special or bomb markers on regular and expansion cells', () => {
    const { cardState, gameState } = createStates();
    global.cardState = cardState;
    global.gameState = gameState;

    gameState.board[0][0] = Core.WHITE;
    gameState.board[1][0] = Core.BLACK;
    gameState.boardExpansion.cells[0].owner = Core.WHITE;
    gameState.boardExpansion.owner = Core.WHITE;
    cardState.markers = [
      { id: 'special-regular', kind: 'specialStone', row: 0, col: 0, owner: 'white', data: { type: 'GUARD' } },
      { id: 'bomb-expansion', kind: 'bomb', row: -1, col: 0, owner: 'white', data: { type: 'TIME_BOMB', category: 'bomb' } }
    ];

    const MoveGenerator = require('../game/move-generator.js');
    const moves = MoveGenerator.generateSwapMoves(Core.BLACK, [], [], []);

    expect(moves).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 0, col: 0, effectUsed: 'SWAP_WITH_ENEMY' }),
      expect.objectContaining({ row: -1, col: 0, effectUsed: 'SWAP_WITH_ENEMY' })
    ]));
  });
```

- [ ] **Step 6: Use index in target resolver fallback helpers**

In `game/cards/target-resolver.ts`, keep existing `Markers.findSpecialMarkerAt(...)` and `Markers.isSpecialStoneAt(...)` paths. Only add an index for fallback scan paths where the file currently loops `markers.some(...)` inside board cell loops.

Add this helper near the other local helper functions:

```ts
    function createMarkersAtLookup(cardState: any) {
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const markerCellIndex = Markers && typeof Markers.createMarkerCellIndex === 'function'
            ? Markers.createMarkerCellIndex(cardState)
            : null;
        return (row: any, col: any) => markerCellIndex
            ? markerCellIndex.get(row, col)
            : markers.filter((m: any) => m && m.row === row && m.col === col);
    }
```

Then, inside these fallback selectors, create a local lookup once before the board loop:

```ts
        const markersAt = createMarkersAtLookup(cardState);
```

Apply this only to:

```text
getTrapTargets
getDestroyTargets
getSwapTargets
getGuardTargets
getTemptTargets
getLivingWillTargets
```

Replace only local fallback expressions of the form:

```ts
markers.some((m: any) => m && m.row === row && m.col === col && predicate(m))
```

with:

```ts
markersAt(row, col).some((m: any) => predicate(m))
```

Do not replace calls that delegate to `Markers.findSpecialMarkerAt(...)`; those already centralize behavior.

- [ ] **Step 7: Use short-lived index in UDG local scans**

In `game/logic/cards/udg.ts`, create a short-lived lookup helper. It must not be reused across marker movement or marker deletion, because UDG processing mutates `cardState.markers`.

```ts
function createUdgMarkersAtLookup(cardState: CardState) {
    const markers = (cardState && Array.isArray((cardState as any).markers)) ? (cardState as any).markers : [];
    const markerIndex = CardMarkersModule && typeof CardMarkersModule.createMarkerCellIndex === 'function'
        ? CardMarkersModule.createMarkerCellIndex(cardState)
        : null;
    return (row: any, col: any) => markerIndex
        ? markerIndex.get(row, col)
        : markers.filter((m: any) => m && m.row === row && m.col === col);
}
```

Change `isBlockedDestinationCell(...)` to accept an optional lookup and use it only for that call:

```ts
function isBlockedDestinationCell(cardState: CardState, row: number, col: number, markersAt?: (row: any, col: any) => any[]): boolean {
    const markers = typeof markersAt === 'function'
        ? markersAt(row, col)
        : ((cardState && Array.isArray((cardState as any).markers)) ? (cardState as any).markers : []);
    return markers.some((marker: any) => {
        if (!marker || marker.row !== row || marker.col !== col) return false;
        if (marker.kind !== 'specialStone') return false;
        const markerType = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
        return markerType === 'BLOCKADE' || markerType === 'METEOR_HOLE' || markerType === 'FREEZE';
    });
}
```

In `getRandomTurnStartMoveDestination(...)`, build the lookup once before the candidate loops and pass it into `isBlockedDestinationCell(...)`:

```ts
const markersAt = createUdgMarkersAtLookup(cardState);
```

Change `isManifestTarget(...)` to use a per-call lookup supplied through deps without bypassing injected behavior.

Extend the existing `UDGDeps` interface with this field:

```ts
    markersAt?: (row: any, col: any) => any[];
```

When fallback marker scans are needed, use:

```ts
const markers = typeof deps.markersAt === 'function'
    ? deps.markersAt(row, col)
    : ((cardState && Array.isArray((cardState as any).markers)) ? (cardState as any).markers : []);
```

Use this short-lived lookup in:

```text
getRandomTurnStartMoveDestination candidate filtering
collectDestroyedNeighbors target filtering
processUltimateDestroyGodEffectsAtAnchor target filtering
```

For `collectDestroyedNeighbors(...)` and `processUltimateDestroyGodEffectsAtAnchor(...)`, create `const markersAt = createUdgMarkersAtLookup(cardState);` immediately before filtering `neighborCells`, then call `isManifestTarget(cardState, cell.row, cell.col, { ...deps, markersAt })`.

Keep injected deps (`deps.isManifestStoneAt`, `deps.selectRandomEmptyBoardShapeDestination`, `deps.destroyAt`, `deps.BoardOps`) ahead of the index path. Rebuild the lookup after any code path that calls `moveCoexistingMarkers`, `destroyAt`, `BoardOps.destroyAt`, or directly mutates `cardState.markers`.

- [ ] **Step 8: Validate Task 5**

Run:

```powershell
npm run test:jest -- test/game.marker-cell-index.test.ts test/game.move-generator.expansion-pending.test.ts test/game.cards.target-resolver-taboo-pick.test.ts test/game.udg-duration.test.ts test/game.manifest-random-target-exclusion.test.ts
npm run check:window
npm run typecheck
```

Expected:

```text
All selected tests pass.
check:window passes with no new game/shared DOM/window violations.
Typecheck passes.
```

- [ ] **Step 9: Commit Task 5 only**

Run:

```powershell
git add game/logic/cards/markers.ts game/move-generator.ts game/cards/target-resolver.ts game/logic/cards/udg.ts test/game.marker-cell-index.test.ts test/game.move-generator.expansion-pending.test.ts test/game.cards.target-resolver-taboo-pick.test.ts
git commit -m "Index marker lookups in hot paths"
```

---

## Final Verification

- [ ] **Step 1: Run targeted UI and game suites**

Run:

```powershell
npm run test:jest -- test/ui.animation-layout-batch-source.test.ts test/ui.card-renderer-hand-signature.test.ts test/ui.card-renderer-glow-layout.test.ts test/ui.diff-renderer-timer-patch.test.ts test/game.marker-cell-index.test.ts test/game.move-generator.expansion-pending.test.ts test/game.cards.target-resolver-taboo-pick.test.ts test/game.udg-duration.test.ts
```

Expected:

```text
All selected suites pass.
```

- [ ] **Step 2: Run project boundary checks**

Run:

```powershell
npm run check:window
npm run typecheck
npm run build:ts
```

Expected:

```text
All checks pass.
No new DOM/window/audio/timer dependency appears under game/ or shared/.
```

- [ ] **Step 3: Run a no-animation browser smoke profile**

Run the local static server used by the project, open `?noanim=1`, and execute the existing render hot-path measurement used during investigation:

```powershell
npm run serve -- . --host 127.0.0.1 --port 0 --max-attempts 0
```

Expected:

```text
The command prints a [serve] line with the selected port.
The page loads at http://127.0.0.1:<printed-port>/?noanim=1.
No console errors appear.
Repeated no-change renderCardUI and renderBoard calls produce fewer DOM/layout operations than the pre-plan measurements.
```

- [ ] **Step 4: Inspect final diff**

Run:

```powershell
git status --short
git diff --check
git log --oneline -5
```

Expected:

```text
Only files from this plan are changed or committed.
git diff --check reports no whitespace errors.
The last commits correspond to the five independent passes.
```

## Rollback Plan

Each task is committed independently. If a regression is found:

```powershell
git revert <task-commit-sha>
```

Rollback order:

1. Revert Task 5 first for game logic marker lookup issues.
2. Revert Task 4 first for board visual/timer display issues.
3. Revert Task 3 first for glow positioning issues.
4. Revert Task 2 first for hand UI stale class/click issues.
5. Revert Task 1 first for move/destroy animation positioning issues.

No data migration or generated source cleanup is required for rollback.

## Stop Conditions

Pause implementation and report instead of continuing if any of these occur:

- A required optimization needs event reordering, playback duration change, or changed animation timing.
- A UI optimization would skip `renderCardUI()` side effects outside the hand subtree.
- A marker index optimization changes target ordering, marker object identity, or random tie-break input order.
- `check:window` reports a new `game/` or `shared/` browser dependency.
- Any task requires editing `worker-public/` or generated registry files as source.
- Existing dirty files overlap a task file and the diff cannot be separated safely.

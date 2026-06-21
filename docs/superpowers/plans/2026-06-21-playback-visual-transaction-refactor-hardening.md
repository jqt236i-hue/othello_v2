# Playback Visual Transaction Refactor Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 破壊・移動・変換系 playback で、最終盤面の DOM 描画が演出より先に走る再発を防ぐため、`PLAYBACK_EVENTS` の handoff、presentation queue 操作、destroy ghost fallback を安全に整理する。

**Architecture:** これは挙動変更ではなく、修正済みの Single Visual Writer 契約をコード構造で守るための refactor hardening である。canonical game state は従来どおり先に更新してよいが、`PLAYBACK_EVENTS` がある場合は presentation queue drain と AnimationEngine への board 所有権移譲を 1 つの visual transaction として扱う。`presentationEvents` と `_presentationEventsPersist` は物理的に即統合せず、まず操作 API で包んで二重キューの存在を局所化する。

**Tech Stack:** TypeScript, browser classic module bridge, Jest, existing browser verification scripts, npm project scripts.

---

## Current Diagnosis

今回修正済みの根本原因は、local move path で `PLAYBACK_EVENTS` を UI が drain して playback lock を確立する前に、final canonical board を見た state/render 経路が先に走れたことだった。結果として破壊対象の石が playback 前に DOM から消え、destroy handler が `before` 情報から ghost を再生成し、見た目が「消える → 出る → 消える」になった。

この計画の目的はカード個別修正ではない。狙撃の意志、究極反転龍、破壊龍、落雷、UDG、意志狩りの王などの個別条件は追加せず、board playback の共有境界を保守しやすくする。

---

## Non-Goals

- `01-rulebook.md` のカード仕様変更はしない。プレイヤー向けルールやカード文言は変えない。
- `presentationEvents` と `_presentationEventsPersist` を最初の pass で 1 配列に物理統合しない。
- public import path、network snapshot shape、worker snapshot shape は変えない。
- `game/`、`shared/`、pure card logic に DOM、`window`、sound、timer、network client 依存を入れない。
- destroy ghost fallback を削除しない。fallback は上流不整合を隠し得るため、まず診断可能にする。

---

## File Map

- Modify: `game/move-executor.ts`
  Local move の `PLAYBACK_EVENTS -> emitGameStateChange -> emitBoardUpdate` 順序を private helper へ閉じ込める。

- Modify: `test/game.move-executor.presentation.test.ts`
  `emitGameStateChange` の時点で live/persist queue に `PLAYBACK_EVENTS` が見えている不変条件を維持する。

- Create: `shared/presentation-queue.ts`
  `presentationEvents` と `_presentationEventsPersist` の ensure, append, drain, remove, state inspection を pure helper として提供する。

- Create: `test/shared.presentation-queue.test.ts`
  二重キューの現行意味を characterization test として固定する。

- Modify: `ui/playback-state-manager.ts`
  pending visual playback 判定を `shared/presentation-queue.ts` へ委譲する。

- Modify: `ui/playback-engine.ts`
  live queue drain と persisted queue removal を `shared/presentation-queue.ts` へ委譲する。

- Modify: `game/logic/presentation.ts`
  runtime 未接続時の persisted fallback 書き込みを `shared/presentation-queue.ts` へ委譲する。

- Modify: `ui/network/snapshot-presentation.ts`
  snapshot 用の queue capture/clear/restore は残しつつ、内部の配列判定を shared helper と同じ意味へ揃える。

- Modify: `ui/animation-destroy-events.ts`
  通常 destroy で no-disc ghost fallback に入った事実を dev/test で観測できるようにする。

- Modify: `test/ui.destroy-playback-visual-transaction.test.ts`
  claimed playback 中の final board prepaint 防止と、通常 destroy が ghost fallback に依存しないことを守る。

- Inspect only: `docs/architecture-contracts.md`
  Single Visual Writer 契約と plan の矛盾がないことを確認する。契約が追加で必要な場合だけ明文化する。

---

## Risk Classification

- Task 1-2: Low risk. Private helper extraction and ordering characterization only。
- Task 3-5: Medium risk. Shared helper introduction and queue operation migration。public shape は変えない。
- Task 6: Low to medium risk. dev/test diagnostics only。normal play の表示を変えない。
- Task 7: Medium risk. Cross-path validation。失敗時は最小 pass へ戻す。

Rollback is file-level: revert the current task's changed files only. Do not revert unrelated dirty files. For Task 3-5, rollback order is reverse migration first, then remove `shared/presentation-queue.ts` and its tests.

---

## Task 1: Lock The Local Visual Transaction Contract

**Files:**
- Modify: `test/game.move-executor.presentation.test.ts`
- Inspect: `game/move-executor.ts`

- [ ] **Step 1: Ensure the ordering regression test exists**

In `test/game.move-executor.presentation.test.ts`, keep or add this test. If a test with the same name already exists, compare it against this body and only adjust missing assertions.

```ts
test('game state change sees PLAYBACK_EVENTS before board render can consume final board state', async () => {
    global.BoardOps = { emitPresentationEvent: jest.fn() };
    global.cardState = {
        pendingEffectByPlayer: { black: null, white: null },
        turnIndex: 0,
        presentationEvents: [],
        _presentationEventsPersist: []
    };
    global.gameState = {
        currentPlayer: 1,
        board: Array(8).fill(null).map(() => Array(8).fill(0))
    };
    global.onTurnStart = jest.fn(async () => ({ playbackEvents: [] }));

    const observedDuringGameStateChange: any[] = [];
    const moveExecutor = require('../game/move-executor.js');
    moveExecutor.setUIImpl({
        getNetworkTurnHandoff: () => ({}),
        emitPresentationEvent: (ev: any) => {
            if (!Array.isArray(global.cardState.presentationEvents)) global.cardState.presentationEvents = [];
            if (!Array.isArray(global.cardState._presentationEventsPersist)) global.cardState._presentationEventsPersist = [];
            global.cardState.presentationEvents.push(ev);
            global.cardState._presentationEventsPersist.push(ev);
            return true;
        },
        emitGameStateChange: () => {
            observedDuringGameStateChange.push({
                live: (global.cardState.presentationEvents || []).map((ev: any) => ev && ev.type),
                persist: (global.cardState._presentationEventsPersist || []).map((ev: any) => ev && ev.type)
            });
            return true;
        }
    });

    const nextCardState = {
        pendingEffectByPlayer: { black: null, white: null },
        turnIndex: 1,
        presentationEvents: [],
        _presentationEventsPersist: [{ type: 'DESTROY', row: 3, col: 3 }]
    };
    const nextGameState = {
        currentPlayer: -1,
        board: Array(8).fill(null).map(() => Array(8).fill(0))
    };
    const fakeRes = {
        ok: true,
        nextGameState,
        nextCardState,
        playbackEvents: [{ type: 'destroy', phase: 2, targets: [{ r: 3, col: 3 }] }],
        phases: {},
        placementEffects: {},
        immediate: {}
    };
    const adapter = { runTurnWithAdapter: jest.fn(() => fakeRes) };

    await moveExecutor.executeMoveViaPipeline({ row: 2, col: 3, player: 1 }, false, 'black', adapter, {});

    expect(observedDuringGameStateChange).toHaveLength(1);
    expect(observedDuringGameStateChange[0].live).toContain('PLAYBACK_EVENTS');
    expect(observedDuringGameStateChange[0].persist).toContain('PLAYBACK_EVENTS');
});
```

- [ ] **Step 2: Run the focused test**

Run:

```powershell
npx jest --runInBand test/game.move-executor.presentation.test.ts -t "game state change sees PLAYBACK_EVENTS"
```

Expected: PASS on the already fixed code. On pre-fix code, this test fails because `observedDuringGameStateChange[0].live` and `persist` do not contain `PLAYBACK_EVENTS`.

- [ ] **Step 3: Inspect the production order**

Confirm `game/move-executor.ts` performs this order for `hasPlaybackEvents === true`:

```ts
emitPresentationEventViaBoardOps({ type: 'PLAYBACK_EVENTS', events: res.playbackEvents, meta: { move, phases, effects, immediate } });
emitMoveExecutorGameStateChange();
emitMoveExecutorBoardUpdate();
```

Expected: No code change in this task unless the test or inspection exposes drift.

- [ ] **Step 4: Commit the characterization pass**

```powershell
git add test/game.move-executor.presentation.test.ts
git commit -m "test: lock playback handoff ordering"
```

Skip the commit only if the test was already present and no file changed.

---

## Task 2: Extract MoveExecutor Playback Handoff Helper

**Files:**
- Modify: `game/move-executor.ts`
- Test: `test/game.move-executor.presentation.test.ts`

- [ ] **Step 1: Add a private helper near the existing `emitMoveExecutorGameStateChange` helper**

Add this helper below `emitMoveExecutorGameStateChange()`:

```ts
function emitMoveExecutorPlaybackHandoffBeforeStateChange(playbackEvents: any, meta: any): boolean {
    const events = Array.isArray(playbackEvents) ? playbackEvents : [];
    const hasPlaybackEvents = events.length > 0;
    if (hasPlaybackEvents) {
        emitPresentationEventViaBoardOps({
            type: 'PLAYBACK_EVENTS',
            events,
            meta: (meta && typeof meta === 'object') ? meta : {}
        });
    }
    emitMoveExecutorGameStateChange();
    if (hasPlaybackEvents) {
        emitMoveExecutorBoardUpdate();
    }
    return hasPlaybackEvents;
}
```

- [ ] **Step 2: Replace the open-coded sequence in `executeMoveViaPipeline`**

Replace the block that currently emits `PLAYBACK_EVENTS`, then `emitMoveExecutorGameStateChange()`, then `emitMoveExecutorBoardUpdate()` with:

```ts
emitMoveExecutorPlaybackHandoffBeforeStateChange(res.playbackEvents, {
    move,
    phases,
    effects,
    immediate
});
```

Do not move `assignMoveExecutorGameState(res.nextGameState)` or `applyMoveExecutorCardStateSnapshot(res.nextCardState)`. The helper only owns notification order after canonical state assignment.

- [ ] **Step 3: Run the move-executor presentation tests**

Run:

```powershell
npx jest --runInBand test/game.move-executor.presentation.test.ts
```

Expected: PASS. The ordering test from Task 1 must still pass.

- [ ] **Step 4: Inspect the diff**

Run:

```powershell
git diff -- game/move-executor.ts test/game.move-executor.presentation.test.ts
git diff --check -- game/move-executor.ts test/game.move-executor.presentation.test.ts
```

Expected: the production diff is a private helper extraction only. There must be no card-specific condition and no new UI/global dependency.

- [ ] **Step 5: Commit the helper extraction**

```powershell
git add game/move-executor.ts test/game.move-executor.presentation.test.ts
git commit -m "refactor: centralize move playback handoff"
```

---

## Task 3: Characterize Presentation Queue Semantics

**Files:**
- Create: `test/shared.presentation-queue.test.ts`
- Create after tests fail: `shared/presentation-queue.ts`

- [ ] **Step 1: Write the failing shared queue tests**

Create `test/shared.presentation-queue.test.ts`:

```ts
'use strict';

describe('shared presentation queue helpers', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('appendPresentationEvent writes the same event to live and persistent queues', () => {
    const Queue = require('../shared/presentation-queue');
    const state: any = {};
    const event = { type: 'PLAYBACK_EVENTS', events: [{ type: 'destroy' }] };

    Queue.appendPresentationEvent(state, event);

    expect(state.presentationEvents).toEqual([event]);
    expect(state._presentationEventsPersist).toEqual([event]);
    expect(state.presentationEvents[0]).toBe(state._presentationEventsPersist[0]);
  });

  test('appendPersistedPresentationEvent writes only the persistent queue', () => {
    const Queue = require('../shared/presentation-queue');
    const state: any = { presentationEvents: [{ type: 'HAND_ADD' }] };
    const event = { type: 'PLAYBACK_EVENTS', events: [{ type: 'flip' }] };

    Queue.appendPersistedPresentationEvent(state, event);

    expect(state.presentationEvents).toEqual([{ type: 'HAND_ADD' }]);
    expect(state._presentationEventsPersist).toEqual([event]);
  });

  test('drainLivePresentationEvents clears live queue and preserves persistent queue', () => {
    const Queue = require('../shared/presentation-queue');
    const liveEvent = { type: 'PLAYBACK_EVENTS', events: [{ type: 'move' }] };
    const persistedEvent = { type: 'PLAYBACK_EVENTS', events: [{ type: 'destroy' }] };
    const state: any = {
      presentationEvents: [liveEvent],
      _presentationEventsPersist: [liveEvent, persistedEvent]
    };

    const drained = Queue.drainLivePresentationEvents(state);

    expect(drained).toEqual([liveEvent]);
    expect(state.presentationEvents).toEqual([]);
    expect(state._presentationEventsPersist).toEqual([liveEvent, persistedEvent]);
  });

  test('removePersistedPresentationEvent removes by reference or JSON signature', () => {
    const Queue = require('../shared/presentation-queue');
    const referenceEvent = { type: 'PLAYBACK_EVENTS', events: [{ type: 'destroy', phase: 1 }] };
    const signatureEvent = { type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 2 }] };
    const state: any = {
      presentationEvents: [],
      _presentationEventsPersist: [referenceEvent, signatureEvent]
    };

    expect(Queue.removePersistedPresentationEvent(state, referenceEvent)).toBe(true);
    expect(Queue.removePersistedPresentationEvent(state, { type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 2 }] })).toBe(true);
    expect(state._presentationEventsPersist).toEqual([]);
  });

  test('getPresentationQueueState detects PLAYBACK_EVENTS in either queue', () => {
    const Queue = require('../shared/presentation-queue');

    expect(Queue.getPresentationQueueState({
      presentationEvents: [],
      _presentationEventsPersist: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'destroy' }] }]
    })).toEqual(expect.objectContaining({
      hasPending: true,
      hasVisualPlayback: true
    }));

    expect(Queue.getPresentationQueueState({
      presentationEvents: [{ type: 'HAND_ADD' }],
      _presentationEventsPersist: []
    })).toEqual(expect.objectContaining({
      hasPending: true,
      hasVisualPlayback: false
    }));
  });
});
```

- [ ] **Step 2: Run the new test and confirm the expected failure**

Run:

```powershell
npx jest --runInBand test/shared.presentation-queue.test.ts
```

Expected: FAIL with module not found for `../shared/presentation-queue`.

---

## Task 4: Add The Shared Presentation Queue Helper

**Files:**
- Create: `shared/presentation-queue.ts`
- Test: `test/shared.presentation-queue.test.ts`

- [ ] **Step 1: Implement the pure helper**

Create `shared/presentation-queue.ts`:

```ts
'use strict';

interface PresentationQueueHost {
  presentationEvents?: any[];
  _presentationEventsPersist?: any[];
  [key: string]: any;
}

function isObject(value: any): value is PresentationQueueHost {
  return !!value && typeof value === 'object';
}

function getLiveQueue(host: any): any[] {
  return isObject(host) && Array.isArray(host.presentationEvents) ? host.presentationEvents : [];
}

function getPersistentQueue(host: any): any[] {
  return isObject(host) && Array.isArray(host._presentationEventsPersist) ? host._presentationEventsPersist : [];
}

function ensurePresentationQueues(host: any): PresentationQueueHost | null {
  if (!isObject(host)) return null;
  if (!Array.isArray(host.presentationEvents)) host.presentationEvents = [];
  if (!Array.isArray(host._presentationEventsPersist)) host._presentationEventsPersist = [];
  return host;
}

function appendPresentationEvent(host: any, event: any): boolean {
  const state = ensurePresentationQueues(host);
  if (!state || !event || typeof event !== 'object') return false;
  state.presentationEvents!.push(event);
  state._presentationEventsPersist!.push(event);
  return true;
}

function appendPersistedPresentationEvent(host: any, event: any): boolean {
  const state = ensurePresentationQueues(host);
  if (!state || !event || typeof event !== 'object') return false;
  state._presentationEventsPersist!.push(event);
  return true;
}

function drainLivePresentationEvents(host: any): any[] {
  if (!isObject(host) || !Array.isArray(host.presentationEvents)) return [];
  const drained = host.presentationEvents.slice();
  host.presentationEvents.length = 0;
  return drained;
}

function getPresentationEventSignature(event: any): string | null {
  if (!event || typeof event !== 'object') return null;
  try {
    return JSON.stringify(event);
  } catch (e) {
    return null;
  }
}

function removePersistedPresentationEvent(host: any, event: any): boolean {
  const persisted = getPersistentQueue(host);
  if (!persisted.length || !event) return false;
  let index = persisted.indexOf(event);
  if (index < 0) {
    const signature = getPresentationEventSignature(event);
    if (signature) {
      index = persisted.findIndex((candidate) => getPresentationEventSignature(candidate) === signature);
    }
  }
  if (index < 0) return false;
  persisted.splice(index, 1);
  return true;
}

function clearPresentationQueues(host: any): boolean {
  const state = ensurePresentationQueues(host);
  if (!state) return false;
  state.presentationEvents!.length = 0;
  state._presentationEventsPersist!.length = 0;
  return true;
}

function isPlaybackEntry(entry: any): boolean {
  return !!entry && typeof entry === 'object' && String(entry.type || '').trim().toUpperCase() === 'PLAYBACK_EVENTS';
}

function getPresentationQueueState(host: any): any {
  const presentationEvents = getLiveQueue(host);
  const persistentEvents = getPersistentQueue(host);
  const entries = presentationEvents.concat(persistentEvents);
  return {
    presentationEvents,
    persistentEvents,
    entries,
    hasPending: entries.length > 0,
    hasVisualPlayback: entries.some(isPlaybackEntry)
  };
}

const PresentationQueue = {
  ensurePresentationQueues,
  appendPresentationEvent,
  appendPersistedPresentationEvent,
  drainLivePresentationEvents,
  removePersistedPresentationEvent,
  clearPresentationQueues,
  getPresentationQueueState
};

export = PresentationQueue;
```

- [ ] **Step 2: Run the shared helper test**

Run:

```powershell
npx jest --runInBand test/shared.presentation-queue.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript build for the new module**

Run:

```powershell
npm run build:ts
```

Expected: PASS.

- [ ] **Step 4: Commit the helper and tests**

```powershell
git add shared/presentation-queue.ts test/shared.presentation-queue.test.ts
git commit -m "refactor: add presentation queue helper"
```

---

## Task 5: Migrate Existing Queue Consumers One At A Time

**Files:**
- Modify: `ui/playback-state-manager.ts`
- Modify: `ui/playback-engine.ts`
- Modify: `game/logic/presentation.ts`
- Modify: `ui/network/snapshot-presentation.ts`
- Test: `test/shared.presentation-queue.test.ts`
- Test: `test/ui.playback-state-manager.test.ts`
- Test: `test/ui.playback-engine.dispatch.test.ts`
- Test: `test/ui.network-snapshot.single-writer-baseline.test.ts`

- [ ] **Step 1: Replace `ui/playback-state-manager.ts` queue state calculation**

Add near the existing `_require` setup:

```ts
const PresentationQueue = _require('../shared/presentation-queue');
```

Replace the body of `getPresentationQueueState(source?: any)` with:

```ts
function getPresentationQueueState(source?: any): any {
  const resolved = (source && typeof source === 'object')
    ? source
    : (function () {
      const target = getRoot();
      return target && target.cardState ? target.cardState : {};
    })();
  if (PresentationQueue && typeof PresentationQueue.getPresentationQueueState === 'function') {
    return PresentationQueue.getPresentationQueueState(resolved);
  }
  return {
    presentationEvents: [],
    persistentEvents: [],
    entries: [],
    hasPending: false,
    hasVisualPlayback: false
  };
}
```

Run:

```powershell
npx jest --runInBand test/ui.playback-state-manager.test.ts test/shared.presentation-queue.test.ts
```

Expected: PASS.

- [ ] **Step 2: Replace `ui/playback-engine.ts` live drain and persisted removal**

Add near the existing `_require` setup:

```ts
const PresentationQueue = _require('../shared/presentation-queue');
```

Replace `consumePresentationEventBuffer` with:

```ts
function consumePresentationEventBuffer(cardState: CardState | null | undefined): PresentationEvent[] {
  if (PresentationQueue && typeof PresentationQueue.drainLivePresentationEvents === 'function') {
    return PresentationQueue.drainLivePresentationEvents(cardState) as PresentationEvent[];
  }
  const state = (cardState && typeof cardState === 'object') ? cardState as CardState & CardStateWithEvents : {} as CardStateWithEvents;
  const events = Array.isArray(state.presentationEvents) ? state.presentationEvents.slice() : [];
  if (Array.isArray(state.presentationEvents)) state.presentationEvents.length = 0;
  return events;
}
```

Replace `removePersistedPresentationEvent` with:

```ts
function removePersistedPresentationEvent(cardState: CardState | null | undefined, ev: PresentationEvent | null | undefined): boolean {
  if (PresentationQueue && typeof PresentationQueue.removePersistedPresentationEvent === 'function') {
    return PresentationQueue.removePersistedPresentationEvent(cardState, ev) === true;
  }
  return false;
}
```

Run:

```powershell
npx jest --runInBand test/ui.playback-engine.dispatch.test.ts test/shared.presentation-queue.test.ts
```

Expected: PASS. In `test/ui.playback-engine.dispatch.test.ts`, persisted-only events must still remain after live playback consumption.

- [ ] **Step 3: Replace `game/logic/presentation.ts` persisted fallback append**

Add:

```ts
const PresentationQueue = _require('../../shared/presentation-queue');
```

Replace the fallback push inside `emitPresentationEvent` with:

```ts
try {
    if (PresentationQueue && typeof PresentationQueue.appendPersistedPresentationEvent === 'function') {
        PresentationQueue.appendPersistedPresentationEvent(cardState, ev);
    } else if (cardState && Array.isArray(cardState._presentationEventsPersist)) {
        cardState._presentationEventsPersist.push(ev);
    } else if (cardState) {
        cardState._presentationEventsPersist = [ev];
    }
} catch (_e) { /* ignore persistence failures */ }
```

Run:

```powershell
npx jest --runInBand test/game.move-executor.presentation.test.ts test/shared.presentation-queue.test.ts
```

Expected: PASS. Runtime-disconnected presentation events must still persist.

- [ ] **Step 4: Align `ui/network/snapshot-presentation.ts` queue clearing and pending checks**

Add:

```ts
const PresentationQueue = _require('../../shared/presentation-queue');
```

Use `PresentationQueue.clearPresentationQueues(cardStateRef)` inside `clearTransientPresentationQueues(cardStateRef)`, preserving the existing fallback:

```ts
function clearTransientPresentationQueues(cardStateRef: any): void {
  if (!cardStateRef || typeof cardStateRef !== 'object') return;
  if (PresentationQueue && typeof PresentationQueue.clearPresentationQueues === 'function') {
    PresentationQueue.clearPresentationQueues(cardStateRef);
    return;
  }
  if (!Array.isArray(cardStateRef.presentationEvents)) cardStateRef.presentationEvents = [];
  else cardStateRef.presentationEvents.length = 0;
  if (!Array.isArray(cardStateRef._presentationEventsPersist)) cardStateRef._presentationEventsPersist = [];
  else cardStateRef._presentationEventsPersist.length = 0;
}
```

Use `PresentationQueue.getPresentationQueueState(source)` inside `hasPendingPresentationEvents(source)`:

```ts
function hasPendingPresentationEvents(source: any): boolean {
  if (PresentationQueue && typeof PresentationQueue.getPresentationQueueState === 'function') {
    return PresentationQueue.getPresentationQueueState(source).hasPending === true;
  }
  const ref = (source && typeof source === 'object') ? source : {};
  const pendingPersist = Array.isArray(ref._presentationEventsPersist) ? ref._presentationEventsPersist.length > 0 : false;
  const pendingLive = Array.isArray(ref.presentationEvents) ? ref.presentationEvents.length > 0 : false;
  return pendingPersist || pendingLive;
}
```

Run:

```powershell
npx jest --runInBand test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.network-snapshot.pending-presentation-reconcile.test.ts test/shared.presentation-queue.test.ts
```

Expected: PASS. Snapshot queue preservation and restoration behavior must remain unchanged.

- [ ] **Step 5: Commit the queue consumer migration**

```powershell
git add ui/playback-state-manager.ts ui/playback-engine.ts game/logic/presentation.ts ui/network/snapshot-presentation.ts
git commit -m "refactor: route presentation queues through helper"
```

---

## Task 6: Add Destroy Ghost Fallback Diagnostics

**Files:**
- Modify: `ui/animation-destroy-events.ts`
- Modify: `test/ui.destroy-playback-visual-transaction.test.ts`

- [ ] **Step 1: Add a dependency hook for no-disc destroy fallback**

Extend `AnimationDestroyEventDeps`:

```ts
onDestroyGhostFallback?: (target: any, context: any) => void;
```

Inside `handleDestroyEvent`, immediately after `const useGhostOnlyDestroy = !disc || (...)`, add:

```ts
if (useGhostOnlyDestroy && !disc && typeof deps.onDestroyGhostFallback === 'function') {
    deps.onDestroyGhostFallback(target, {
        reason: destroyReason,
        cause: destroyCause,
        canRenderDestroyGhostWithoutDisc,
        isSuperCrushCollision
    });
}
```

In `ui/animation-engine.ts`, pass a dev/test-only hook:

```ts
onDestroyGhostFallback: (target: any, context: any) => {
    try {
        const root: any = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
        if (root && Array.isArray(root.__destroyGhostFallbackEvents)) {
            root.__destroyGhostFallbackEvents.push({ target, context });
        }
    } catch (e) { /* ignore diagnostics */ }
}
```

This hook must not create UI text, alter animation timing, or change normal gameplay output.

- [ ] **Step 2: Add a unit test for diagnostic emission**

In `test/ui.destroy-playback-visual-transaction.test.ts`, add a focused test that calls `AnimationDestroyEvents.handleDestroyEvent` with an empty target cell and a target containing `before` or `ownerBefore`. Assert the diagnostic callback receives the target and context:

```ts
expect(onDestroyGhostFallback).toHaveBeenCalledWith(
  expect.objectContaining({ r: 2, col: 3 }),
  expect.objectContaining({
    canRenderDestroyGhostWithoutDisc: true
  })
);
```

- [ ] **Step 3: Add a unit test that normal claimed destroy does not use fallback**

Use the existing board DOM setup from `test/ui.destroy-playback-visual-transaction.test.ts`. Create a disc in the target cell, run destroy handling, and assert:

```ts
expect(onDestroyGhostFallback).not.toHaveBeenCalled();
```

- [ ] **Step 4: Run destroy playback tests**

Run:

```powershell
npx jest --runInBand test/ui.destroy-playback-visual-transaction.test.ts test/ui.presentation-handler.playback-claim.test.ts
```

Expected: PASS. Diagnostics fire only for no-disc fallback and do not affect normal claimed destroy playback.

- [ ] **Step 5: Commit diagnostics**

```powershell
git add ui/animation-destroy-events.ts ui/animation-engine.ts test/ui.destroy-playback-visual-transaction.test.ts
git commit -m "test: expose destroy ghost fallback diagnostics"
```

---

## Task 7: Cross-Path Verification

**Files:**
- Inspect: `game/turn-manager.ts`
- Inspect: `game/cpu-decision-card-actions.ts`
- Inspect: `game/cpu-decision-card-pipeline.ts`
- Inspect: `game/cpu-decision-pending-pipeline.ts`
- Inspect: `ui/network/snapshot.ts`
- Inspect: `ui/network-client.ts`

- [ ] **Step 1: Search for remaining raw `PLAYBACK_EVENTS` handoff paths**

Run:

```powershell
rg -n "type: 'PLAYBACK_EVENTS'|type: \"PLAYBACK_EVENTS\"|emitPresentationEventForCpu|emitPresentationEventViaBoardOps|emitGameStateChange\\(|emitBoardUpdate\\(" game ui shared test -g "*.ts"
```

Expected: every path that emits `PLAYBACK_EVENTS` before a board update either already holds a playback claim, uses a network snapshot lock path, or requests board update only after the event is queued.

- [ ] **Step 2: Inspect CPU card-use ordering**

In `game/cpu-decision-card-actions.ts`, `game/cpu-decision-card-pipeline.ts`, and `game/cpu-decision-pending-pipeline.ts`, confirm `cfg.emitPresentationEventForCpu({ type: 'PLAYBACK_EVENTS', ... })` happens before the board update or selection state change that can drain/render the board.

Expected: No production change unless inspection finds a specific order inversion equivalent to the original move-executor bug.

- [ ] **Step 3: Inspect turn-start ordering**

In `game/turn-manager.ts`, confirm turn-start `PLAYBACK_EVENTS` are emitted before `requestUIRender()` and before broad UI notification. If this path drifts, extract a local helper in a separate pass using the same pattern as Task 2.

Expected: No production change in this task if ordering is already correct.

- [ ] **Step 4: Run the focused playback safety suite**

Run:

```powershell
npx jest --runInBand test/game.move-executor.presentation.test.ts test/ui.destroy-playback-visual-transaction.test.ts test/ui.presentation-handler.playback-claim.test.ts test/ui.playback-state-manager.test.ts test/ui.playback-engine.dispatch.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts test/shared.presentation-queue.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run build and browser verification**

Run:

```powershell
npm run build:ts
npm run build:browser
npm run worker:prepare
```

Expected: PASS.

Run the existing browser check that reproduces the original symptom:

```powershell
npm run match:playback-board-writer-check
```

Expected: PASS. The target stone must not disappear before destroy playback begins.

- [ ] **Step 6: Stop if Task 7 finds an ordering drift**

If Task 7 is inspection and validation only, do not commit.

If inspection finds a concrete ordering drift outside `game/move-executor.ts`, stop this pass and write a follow-up plan for that single path. Do not mix a newly discovered CPU, turn-start, or network ordering fix into this broad verification task.

---

## Final Acceptance Criteria

- `PLAYBACK_EVENTS` exists in the presentation queue before any state notification that can trigger board rendering for the local move path.
- `emitMoveExecutorGameStateChange()` and `emitMoveExecutorBoardUpdate()` ordering is no longer open-coded at the call site.
- `presentationEvents` and `_presentationEventsPersist` continue to exist physically, but common operations go through `shared/presentation-queue.ts`.
- `PlaybackStateManager.hasPendingVisualPlayback()` sees `PLAYBACK_EVENTS` from either queue.
- `PlaybackEngine` still drains live events and removes matching persisted events.
- Runtime-disconnected presentation fallback still persists events.
- Snapshot presentation queue preservation still preserves and clears the same queues as before.
- Normal destroy playback does not rely on ghost fallback when the target disc is present.
- No card-specific fixes are added for 狙撃の意志, 究極反転龍, or any other single card.
- No player-visible rule, card text, cost, or UI copy changes.
- Focused Jest, TypeScript build, browser build, worker prepare, and browser playback writer check pass.

---

## Self-Review

- Spec coverage: The plan covers the confirmed root cause, the corrected queue-refactor conclusion, state/board notification coupling, and destroy ghost fallback diagnostics.
- Placeholder scan: The plan contains concrete paths, commands, expected outcomes, and code snippets for every code-changing step.
- Type consistency: Helper names are consistent across tasks: `emitMoveExecutorPlaybackHandoffBeforeStateChange`, `appendPresentationEvent`, `appendPersistedPresentationEvent`, `drainLivePresentationEvents`, `removePersistedPresentationEvent`, `clearPresentationQueues`, and `getPresentationQueueState`.
- Scope check: The plan is a behavior-preserving refactor hardening pass. Public API, worker snapshot shape, and card behavior changes are excluded.
- Risk check: The first safe implementation pass is Task 1-2 only. Queue migration is isolated behind tests and can be stopped after each file.

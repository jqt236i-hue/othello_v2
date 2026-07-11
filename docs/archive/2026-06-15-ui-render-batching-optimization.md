# UI Render Batching Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 終盤・特殊石大量発火時の見た目と体感挙動を変えずに、UI 側の重複 render、DOM churn、layout read を減らす。

**Architecture:** `game/`, `shared/`, CPU, pure card logic, canonical state, `events[]` は変更しない。既存の Single Visual Writer を維持し、`ui/` 内の描画入口を scheduler に集約し、phase context を使って同一 playback phase の layout read と一時 DOM を共有する。

**Tech Stack:** TypeScript, CommonJS export style, Jest + jsdom, existing `ui.ts`, `ui/animation-engine.ts`, `ui/board-renderer.ts`, `cards/card-renderer.ts`.

---

## Measurement Context

今回の一時計測では、究極破壊神相当の 24 target lightning で `createElement: 136`, `createElementNS: 168`, `appendChild: 304`, `layoutReads: 48` が発生した。一方、27 events / 3 phases の playback 管理は `playbackMs: 3`, `lockMs: 3` だった。

この計画は playback の意味や phase 順序を変えず、UI DOM 操作と layout read を減らす。

## Non-Negotiable Contracts

- `game/`, `shared/`, CPU, pure card logic に DOM, `window`, 音声, timer 依存を入れない。
- `events[]` の意味、順序、phase 値、canonical state を変更しない。
- `ui/animation-engine.ts` の Single Visual Writer を維持する。
- `renderBoardDiff` を置き換えない。盤面 DOM writer は既存経路のまま使う。
- まず汎用経路を軽くする。究極破壊神専用の例外最適化だけで済ませない。
- 通常プレイに debug-only 計測や window 露出を残さない。

## File Structure

- Create: `ui/render-scheduler.ts`
  - Board render, card UI render, status update request を同一 microtask / animation frame に集約する UI-only scheduler。
  - CommonJS export と browser global fallback の両方に対応する。
- Create: `test/ui.render-scheduler.test.ts`
  - scheduler 単体の coalescing, playback idle defer, synchronous flush を検証する。
- Modify: `ui.ts`
  - 既存の `_deferredUiSync*`, `_cardUiSync*`, `requestCardUiSync()` 互換 export を残しつつ、内部を `render-scheduler` に委譲する。
- Modify: `ui/board-update-dispatch.ts`
  - `renderBoard` fallback を scheduler 経由にする。`emitBoardUpdate` のイベント意味は即時のまま維持する。
- Create: `ui/layout-read-batch.ts`
  - 同一 phase 内で `getBoundingClientRect()` を WeakMap cache する小さな helper。
- Create: `test/ui.layout-read-batch.test.ts`
  - 同一 element の rect read が phase 内で 1 回になること、snapshot が plain object になることを検証する。
- Modify: `ui/animation-engine.ts`
  - `_buildPhaseContext()` に `layoutBatch` と `transientOverlayBatch` を足し、destroy / move / feedback handlers へ optional deps として渡す。
- Modify: `ui/animation-destroy-source-events.ts`
  - UDG lightning / dragon / meteor / slash など source animation で direct rect read と per-target body append を optional batch API 経由にする。
- Create: `ui/transient-overlay-batch.ts`
  - 同一 phase の一時 overlay container と `DocumentFragment` append を扱う UI-only helper。
- Create: `test/ui.animation-destroy-source-batching.test.ts`
  - 24 target lightning synthetic case で layout read と body append が削減されることを jsdom で検証する。
- Modify as needed: `test/ui.animation-engine.test.ts`, `test/ui.board-update-dispatch.test.ts`
  - 既存 contract の期待値を scheduler 経由に合わせる。event order と final board sync は維持する。

---

### Task 1: Render Scheduler Unit

**Files:**
- Create: `ui/render-scheduler.ts`
- Create: `test/ui.render-scheduler.test.ts`

- [ ] **Step 1: Write failing scheduler tests**

Create `test/ui.render-scheduler.test.ts`:

```ts
describe('ui render scheduler', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('coalesces repeated board and card UI requests into one frame flush', () => {
    const scheduled: FrameRequestCallback[] = [];
    const renderBoard = jest.fn();
    const renderCardUI = jest.fn();
    const updateStatus = jest.fn();

    const { createRenderScheduler } = require('../ui/render-scheduler.js');
    const scheduler = createRenderScheduler({
      requestAnimationFrame: (cb: FrameRequestCallback) => {
        scheduled.push(cb);
        return scheduled.length;
      },
      cancelAnimationFrame: jest.fn(),
      renderBoard,
      renderCardUI,
      updateStatus,
      shouldDeferUiSync: () => false
    });

    expect(scheduler.requestBoardRender({ reason: 'a' })).toBe(true);
    expect(scheduler.requestBoardRender({ reason: 'b' })).toBe(true);
    expect(scheduler.requestCardUiRender({ reason: 'c' })).toBe(true);
    expect(scheduler.requestStatusUpdate({ reason: 'd' })).toBe(true);

    expect(scheduled).toHaveLength(1);
    expect(renderBoard).not.toHaveBeenCalled();
    expect(renderCardUI).not.toHaveBeenCalled();

    scheduled[0](16);

    expect(renderBoard).toHaveBeenCalledTimes(1);
    expect(renderCardUI).toHaveBeenCalledTimes(1);
    expect(updateStatus).toHaveBeenCalledTimes(1);
    expect(scheduler.getState()).toMatchObject({
      boardQueued: false,
      cardUiQueued: false,
      statusQueued: false,
      scheduled: false
    });
  });

  test('defers visual flush while playback or presentation work is active', () => {
    const scheduled: FrameRequestCallback[] = [];
    let busy = true;
    const renderBoard = jest.fn();

    const { createRenderScheduler } = require('../ui/render-scheduler.js');
    const scheduler = createRenderScheduler({
      requestAnimationFrame: (cb: FrameRequestCallback) => {
        scheduled.push(cb);
        return scheduled.length;
      },
      renderBoard,
      shouldDeferUiSync: () => busy
    });

    scheduler.requestBoardRender({ reason: 'during-playback' });
    scheduled[0](16);

    expect(renderBoard).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(2);

    busy = false;
    scheduled[1](32);

    expect(renderBoard).toHaveBeenCalledTimes(1);
  });

  test('flushNow renders synchronously and keeps board before card UI', () => {
    const calls: string[] = [];
    const { createRenderScheduler } = require('../ui/render-scheduler.js');
    const scheduler = createRenderScheduler({
      requestAnimationFrame: jest.fn(),
      renderBoard: () => calls.push('board'),
      renderCardUI: () => calls.push('card'),
      updateStatus: () => calls.push('status'),
      shouldDeferUiSync: () => false
    });

    scheduler.requestCardUiRender({ reason: 'card' });
    scheduler.requestBoardRender({ reason: 'board' });
    scheduler.requestStatusUpdate({ reason: 'status' });

    expect(scheduler.flushNow({ ignorePlayback: true })).toBe(true);
    expect(calls).toEqual(['board', 'card', 'status']);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.render-scheduler.test.ts
```

Expected: FAIL because `../ui/render-scheduler.js` does not exist.

- [ ] **Step 3: Implement `ui/render-scheduler.ts`**

Create `ui/render-scheduler.ts`:

```ts
type RenderReason = string | { reason?: string; source?: string };

type RenderSchedulerDeps = {
  requestAnimationFrame?: (cb: FrameRequestCallback) => number;
  cancelAnimationFrame?: (id: number) => void;
  setTimeout?: (cb: () => void, ms: number) => any;
  clearTimeout?: (id: any) => void;
  renderBoard?: (() => void) | null;
  renderCardUI?: (() => void) | null;
  updateStatus?: (() => void) | null;
  shouldDeferUiSync?: (() => boolean) | null;
};

type RenderSchedulerState = {
  boardQueued: boolean;
  cardUiQueued: boolean;
  statusQueued: boolean;
  scheduled: boolean;
  deferredUntilIdle: boolean;
  reasons: string[];
};

function normalizeReason(input?: RenderReason): string {
  if (!input) return '';
  if (typeof input === 'string') return input.trim();
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  const source = typeof input.source === 'string' ? input.source.trim() : '';
  return [source, reason].filter(Boolean).join(':');
}

function resolveRoot(): any {
  const base: any = typeof globalThis !== 'undefined' ? globalThis : {};
  if (base && base.window && typeof base.window === 'object') return base.window;
  try {
    if (typeof window !== 'undefined' && window) return window;
  } catch (e) { /* ignore */ }
  return base;
}

function resolveRuntimeFunction(name: string, fallback: any): (() => void) | null {
  if (typeof fallback === 'function') return fallback;
  const root = resolveRoot();
  try {
    if (root && typeof root[name] === 'function') return root[name].bind(root);
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any)[name] === 'function') {
      return (globalThis as any)[name].bind(globalThis);
    }
  } catch (e) { /* ignore */ }
  return null;
}

function createRenderScheduler(deps?: RenderSchedulerDeps) {
  let currentDeps: RenderSchedulerDeps = deps && typeof deps === 'object' ? Object.assign({}, deps) : {};
  const state: RenderSchedulerState = {
    boardQueued: false,
    cardUiQueued: false,
    statusQueued: false,
    scheduled: false,
    deferredUntilIdle: false,
    reasons: []
  };
  let frameId: any = null;

  const getRaf = () => currentDeps.requestAnimationFrame
    || ((cb: FrameRequestCallback) => {
      const setTimer = currentDeps.setTimeout || setTimeout;
      return setTimer(() => cb(Date.now()), 16);
    });

  const getCancel = () => currentDeps.cancelAnimationFrame
    || ((id: any) => {
      const clearTimer = currentDeps.clearTimeout || clearTimeout;
      clearTimer(id);
    });

  const rememberReason = (reason?: RenderReason) => {
    const normalized = normalizeReason(reason);
    if (normalized) state.reasons.push(normalized);
  };

  const shouldDefer = (ignorePlayback?: boolean) => {
    if (ignorePlayback === true) return false;
    return typeof currentDeps.shouldDeferUiSync === 'function'
      ? currentDeps.shouldDeferUiSync() === true
      : false;
  };

  const schedule = () => {
    if (state.scheduled) return true;
    state.scheduled = true;
    const raf = getRaf();
    frameId = raf(() => {
      frameId = null;
      state.scheduled = false;
      flushNow();
    });
    return true;
  };

  const flushNow = (options?: { ignorePlayback?: boolean }) => {
    if (!state.boardQueued && !state.cardUiQueued && !state.statusQueued) return false;
    if (shouldDefer(options && options.ignorePlayback)) {
      state.deferredUntilIdle = true;
      schedule();
      return false;
    }
    const runBoard = state.boardQueued;
    const runCard = state.cardUiQueued;
    const runStatus = state.statusQueued;
    state.boardQueued = false;
    state.cardUiQueued = false;
    state.statusQueued = false;
    state.deferredUntilIdle = false;
    state.reasons = [];

    if (runBoard) {
      const renderBoard = resolveRuntimeFunction('renderBoard', currentDeps.renderBoard);
      if (renderBoard) renderBoard();
    }
    if (runCard) {
      const renderCardUI = resolveRuntimeFunction('renderCardUI', currentDeps.renderCardUI);
      if (renderCardUI) renderCardUI();
    }
    if (runStatus) {
      const updateStatus = resolveRuntimeFunction('updateStatus', currentDeps.updateStatus);
      if (updateStatus) updateStatus();
    }
    return true;
  };

  return {
    configure(nextDeps: RenderSchedulerDeps) {
      currentDeps = Object.assign({}, currentDeps, nextDeps || {});
      return true;
    },
    requestBoardRender(reason?: RenderReason) {
      state.boardQueued = true;
      rememberReason(reason);
      return schedule();
    },
    requestCardUiRender(reason?: RenderReason) {
      state.cardUiQueued = true;
      rememberReason(reason);
      return schedule();
    },
    requestStatusUpdate(reason?: RenderReason) {
      state.statusQueued = true;
      rememberReason(reason);
      return schedule();
    },
    flushNow,
    cancel() {
      if (state.scheduled && frameId !== null) getCancel()(frameId);
      frameId = null;
      state.scheduled = false;
      return true;
    },
    getState() {
      return Object.assign({}, state, { reasons: state.reasons.slice() });
    }
  };
}

const defaultScheduler = createRenderScheduler();

const RenderScheduler = {
  createRenderScheduler,
  configureRenderScheduler: defaultScheduler.configure,
  requestBoardRender: defaultScheduler.requestBoardRender,
  requestCardUiRender: defaultScheduler.requestCardUiRender,
  requestStatusUpdate: defaultScheduler.requestStatusUpdate,
  flushVisualUpdates: defaultScheduler.flushNow,
  cancelVisualUpdates: defaultScheduler.cancel,
  getVisualUpdateState: defaultScheduler.getState
};

try {
  const root = resolveRoot();
  if (root && typeof root === 'object') {
    root.RenderScheduler = root.RenderScheduler || RenderScheduler;
    root.requestBoardRender = root.requestBoardRender || RenderScheduler.requestBoardRender;
    root.requestCardUiRender = root.requestCardUiRender || RenderScheduler.requestCardUiRender;
  }
} catch (e) { /* ignore */ }

export = RenderScheduler;
```

- [ ] **Step 4: Run scheduler test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.render-scheduler.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```powershell
git add ui/render-scheduler.ts test/ui.render-scheduler.test.ts
git commit -m "Add UI render scheduler"
```

---

### Task 2: Delegate Existing `ui.ts` Queues To Scheduler

**Files:**
- Modify: `ui.ts`
- Modify: `test/ui.render-scheduler.test.ts`

- [ ] **Step 1: Add compatibility tests for `ui.ts` exports**

Append to `test/ui.render-scheduler.test.ts`:

```ts
test('ui requestCardUiSync still coalesces through scheduler-compatible state', async () => {
  jest.resetModules();
  const dom = new (require('jsdom').JSDOM)('<!doctype html><html><body><div id="board"></div></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(16);
    return 1;
  };
  global.window.renderCardUI = jest.fn();
  global.window.renderBoard = jest.fn();

  const ui = require('../ui.ts');
  expect(ui.requestCardUiSync('unit')).toBe(true);
  await Promise.resolve();

  expect(global.window.renderCardUI).toHaveBeenCalledTimes(1);

  dom.window.close();
  delete global.window;
  delete global.document;
  delete global.requestAnimationFrame;
});
```

- [ ] **Step 2: Run the compatibility test before changes**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.render-scheduler.test.ts
```

Expected: PASS before refactor. This locks current behavior before delegation.

- [ ] **Step 3: Replace internal queue implementation in `ui.ts`**

At the top of `ui.ts`, after `_require`, add:

```ts
const RenderSchedulerModule = (() => {
    try {
        return _require('./ui/render-scheduler');
    } catch (e) {
        try {
            return (typeof globalThis !== 'undefined') ? (globalThis as any).RenderScheduler : null;
        } catch (e2) {
            return null;
        }
    }
})();
```

Replace `_queueDeferredUiSyncWork`, `_flushDeferredUiSyncWork`, `_deferUiSyncUntilPlaybackIdle`, `_runWhenPlaybackIdle`, `_flushCardUiSyncQueue`, `_scheduleCardUiSyncFlush`, `_deferCardUiSyncUntilPlaybackIdle`, and `requestCardUiSync` internals so they delegate to scheduler while preserving exported variable values:

```ts
function _getRenderScheduler() {
    return RenderSchedulerModule && typeof RenderSchedulerModule === 'object'
        ? RenderSchedulerModule
        : null;
}

function _configureRenderScheduler() {
    const scheduler = _getRenderScheduler();
    if (!scheduler || typeof scheduler.configureRenderScheduler !== 'function') return null;
    scheduler.configureRenderScheduler({
        renderBoard,
        renderCardUI: _resolveRenderCardUiForSync(),
        updateStatus,
        shouldDeferUiSync: _hasPendingPlaybackOrPresentation,
        requestAnimationFrame: _getUiSyncRaf()
    });
    return scheduler;
}

function _syncUiQueueExportState() {
    const scheduler = _getRenderScheduler();
    const state = scheduler && typeof scheduler.getVisualUpdateState === 'function'
        ? scheduler.getVisualUpdateState()
        : null;
    _deferredUiSyncQueued = !!(state && (state.boardQueued || state.statusQueued || state.scheduled));
    _deferredUiSyncNeedsBoardRender = !!(state && state.boardQueued);
    _deferredUiSyncNeedsStatusUpdate = !!(state && state.statusQueued);
    _cardUiSyncQueued = !!(state && state.cardUiQueued);
    _cardUiSyncFlushScheduled = !!(state && state.scheduled);
    _cardUiSyncDeferredUntilIdle = !!(state && state.deferredUntilIdle);
    _cardUiSyncReasons = state && Array.isArray(state.reasons) ? state.reasons.slice() : [];
}
```

Use these wrappers:

```ts
export function _queueDeferredUiSyncWork(options?: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    const scheduler = _configureRenderScheduler();
    if (scheduler && opts.renderBoard === true) scheduler.requestBoardRender({ source: 'ui.ts', reason: 'deferred-board' });
    if (scheduler && opts.updateStatus === true) scheduler.requestStatusUpdate({ source: 'ui.ts', reason: 'deferred-status' });
    _syncUiQueueExportState();
}

export function _flushDeferredUiSyncWork() {
    const scheduler = _configureRenderScheduler();
    const result = scheduler && typeof scheduler.flushVisualUpdates === 'function'
        ? scheduler.flushVisualUpdates({ ignorePlayback: true })
        : false;
    _syncUiQueueExportState();
    return result;
}

export function _deferUiSyncUntilPlaybackIdle(options?: any) {
    _queueDeferredUiSyncWork(options);
}

export function _runWhenPlaybackIdle(onIdle: () => void, options?: any) {
    if (_hasPendingPlaybackOrPresentation()) {
        _deferUiSyncUntilPlaybackIdle(options);
        return;
    }
    onIdle();
}

export function _flushCardUiSyncQueue(options?: any) {
    const scheduler = _configureRenderScheduler();
    const result = scheduler && typeof scheduler.flushVisualUpdates === 'function'
        ? scheduler.flushVisualUpdates({ ignorePlayback: options && options.ignorePlayback === true })
        : false;
    _syncUiQueueExportState();
    return result;
}

export function _scheduleCardUiSyncFlush() {
    const scheduler = _configureRenderScheduler();
    if (scheduler && typeof scheduler.requestCardUiRender === 'function') {
        scheduler.requestCardUiRender({ source: 'ui.ts', reason: 'scheduled-card-ui' });
    }
    _syncUiQueueExportState();
}

export function _deferCardUiSyncUntilPlaybackIdle() {
    _scheduleCardUiSyncFlush();
}

export function requestCardUiSync(reason?: string, options?: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    const scheduler = _configureRenderScheduler();
    const normalizedReason = String(reason || opts.reason || '').trim();
    if (!scheduler || typeof scheduler.requestCardUiRender !== 'function') return false;
    scheduler.requestCardUiRender({ source: 'ui.ts', reason: normalizedReason || 'request-card-ui-sync' });
    if (opts.deferUntilIdle === false && typeof scheduler.flushVisualUpdates === 'function') {
        scheduler.flushVisualUpdates({ ignorePlayback: true });
    }
    _syncUiQueueExportState();
    return true;
}
```

- [ ] **Step 4: Run focused UI scheduler tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.render-scheduler.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run existing card UI contract tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.card-renderer-hand-inspect.test.ts test/ui.card-ui-sync.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```powershell
git add ui.ts test/ui.render-scheduler.test.ts
git commit -m "Route UI sync queues through render scheduler"
```

---

### Task 3: Board Update Dispatch Uses Scheduler Fallback

**Files:**
- Modify: `ui/board-update-dispatch.ts`
- Modify: `test/ui.board-update-dispatch.test.ts`

- [ ] **Step 1: Add fallback scheduler test**

Append to `test/ui.board-update-dispatch.test.ts`:

```ts
test('falls back to RenderScheduler requestBoardRender before direct renderBoard', () => {
  global.RenderScheduler = {
    requestBoardRender: jest.fn(() => true)
  };
  global.renderBoard = jest.fn();

  const dispatch = require('../ui/board-update-dispatch.js');
  expect(dispatch.requestBoardUpdate({ source: 'unit-test', reason: 'scheduler-fallback' })).toBe(true);

  expect(global.RenderScheduler.requestBoardRender).toHaveBeenCalledWith({
    source: 'unit-test',
    reason: 'scheduler-fallback'
  });
  expect(global.renderBoard).not.toHaveBeenCalled();

  delete global.RenderScheduler;
});
```

- [ ] **Step 2: Run the failing dispatch test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.board-update-dispatch.test.ts
```

Expected: FAIL because `BoardUpdateDispatch` does not use `RenderScheduler`.

- [ ] **Step 3: Implement scheduler fallback**

In `ui/board-update-dispatch.ts`, add:

```ts
function resolveRenderScheduler(): any {
  try {
    const mod = _require('./render-scheduler');
    if (mod && typeof mod.requestBoardRender === 'function') return mod;
  } catch (e) { /* ignore */ }
  const target = getRoot();
  try {
    if (target && target.RenderScheduler && typeof target.RenderScheduler.requestBoardRender === 'function') {
      return target.RenderScheduler;
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).RenderScheduler && typeof (globalThis as any).RenderScheduler.requestBoardRender === 'function') {
      return (globalThis as any).RenderScheduler;
    }
  } catch (e) { /* ignore */ }
  return null;
}
```

Inside `requestBoardUpdate`, keep the `emitBoardUpdate` branch first. Before direct `renderBoard` fallback, add:

```ts
  const renderScheduler = resolveRenderScheduler();
  if (renderScheduler && typeof renderScheduler.requestBoardRender === 'function') {
    try {
      return renderScheduler.requestBoardRender({
        source: (typeof config.source === 'string' && config.source.trim())
          ? config.source.trim()
          : 'ui.board-update-dispatch',
        reason: (typeof config.reason === 'string' && config.reason.trim())
          ? config.reason.trim()
          : 'requestBoardUpdate'
      }) !== false;
    } catch (error) {
      return warnDispatchFailure('RenderScheduler requestBoardRender failed', error);
    }
  }
```

- [ ] **Step 4: Run dispatch tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.board-update-dispatch.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run Single Visual Writer focused tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.animation-engine.test.ts test/ui.playback-state-manager.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```powershell
git add ui/board-update-dispatch.ts test/ui.board-update-dispatch.test.ts
git commit -m "Use render scheduler for board update fallback"
```

---

### Task 4: Layout Read Batch Helper

**Files:**
- Create: `ui/layout-read-batch.ts`
- Create: `test/ui.layout-read-batch.test.ts`

- [ ] **Step 1: Write failing layout batch tests**

Create `test/ui.layout-read-batch.test.ts`:

```ts
describe('layout read batch', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('caches getBoundingClientRect per element within one batch', () => {
    const { createLayoutReadBatch } = require('../ui/layout-read-batch.js');
    const element = {
      getBoundingClientRect: jest.fn(() => ({
        left: 1,
        top: 2,
        width: 30,
        height: 40,
        right: 31,
        bottom: 42
      }))
    };

    const batch = createLayoutReadBatch();
    const first = batch.readRect(element);
    const second = batch.readRect(element);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(element.getBoundingClientRect).toHaveBeenCalledTimes(1);
  });

  test('clear starts a new read cycle', () => {
    const { createLayoutReadBatch } = require('../ui/layout-read-batch.js');
    const element = {
      getBoundingClientRect: jest.fn(() => ({
        left: 4,
        top: 5,
        width: 6,
        height: 7,
        right: 10,
        bottom: 12
      }))
    };

    const batch = createLayoutReadBatch();
    batch.readRect(element);
    batch.clear();
    batch.readRect(element);

    expect(element.getBoundingClientRect).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run failing layout batch test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.layout-read-batch.test.ts
```

Expected: FAIL because `../ui/layout-read-batch.js` does not exist.

- [ ] **Step 3: Implement `ui/layout-read-batch.ts`**

Create `ui/layout-read-batch.ts`:

```ts
type RectSnapshot = {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

function snapshotRect(rect: any): RectSnapshot {
  const left = Number(rect && rect.left) || 0;
  const top = Number(rect && rect.top) || 0;
  const width = Number(rect && rect.width) || 0;
  const height = Number(rect && rect.height) || 0;
  const right = Number.isFinite(Number(rect && rect.right)) ? Number(rect.right) : left + width;
  const bottom = Number.isFinite(Number(rect && rect.bottom)) ? Number(rect.bottom) : top + height;
  return { left, top, width, height, right, bottom };
}

function cloneRect(rect: RectSnapshot): RectSnapshot {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    right: rect.right,
    bottom: rect.bottom
  };
}

function createLayoutReadBatch() {
  let rectCache = new WeakMap<object, RectSnapshot>();
  return {
    readRect(element: any): RectSnapshot | null {
      if (!element || typeof element.getBoundingClientRect !== 'function') return null;
      if (!rectCache.has(element)) {
        rectCache.set(element, snapshotRect(element.getBoundingClientRect()));
      }
      const cached = rectCache.get(element);
      return cached ? cloneRect(cached) : null;
    },
    clear() {
      rectCache = new WeakMap<object, RectSnapshot>();
    }
  };
}

export = {
  createLayoutReadBatch,
  snapshotRect
};
```

- [ ] **Step 4: Run layout batch tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.layout-read-batch.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```powershell
git add ui/layout-read-batch.ts test/ui.layout-read-batch.test.ts
git commit -m "Add layout read batch helper"
```

---

### Task 5: Add Phase Layout Context To AnimationEngine

**Files:**
- Modify: `ui/animation-engine.ts`
- Modify: `test/ui.animation-engine.test.ts`

- [ ] **Step 1: Add phase context test**

Append to `test/ui.animation-engine.test.ts`:

```ts
test('phase context exposes a layout read batch during one phase', async () => {
  jest.resetModules();
  global.document = {
    getElementById: () => ({
      classList: { add() {}, remove() {} },
      querySelector: () => null,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 10, height: 10 })
    })
  };

  jest.doMock('../ui/layout-read-batch.js', () => ({
    createLayoutReadBatch: jest.fn(() => ({
      readRect: jest.fn(),
      clear: jest.fn()
    }))
  }));

  const layoutBatch = require('../ui/layout-read-batch.js');
  const engine = require('../ui/animation-engine.js');
  jest.spyOn(engine, 'executeEvent').mockResolvedValue(undefined);

  await engine.executePhase([{ type: 'log', phase: 1, message: 'x' }]);

  expect(layoutBatch.createLayoutReadBatch).toHaveBeenCalled();
  expect(engine.executeEvent).toHaveBeenCalledTimes(1);

  engine.executeEvent.mockRestore();
  delete global.document;
});
```

- [ ] **Step 2: Run failing phase context test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.animation-engine.test.ts
```

Expected: FAIL because `AnimationEngine` does not create a layout batch.

- [ ] **Step 3: Require layout batch module**

Near the other runtime module requires in `ui/animation-engine.ts`, add:

```ts
var LayoutReadBatch = requireRuntimeModuleOrWindowGlobal('./layout-read-batch', 'LayoutReadBatch');
```

- [ ] **Step 4: Extend `_buildPhaseContext()`**

Inside `_buildPhaseContext(events)`, before `return`, add:

```ts
            const layoutBatch = (LayoutReadBatch && typeof LayoutReadBatch.createLayoutReadBatch === 'function')
                ? LayoutReadBatch.createLayoutReadBatch()
                : null;
            return { superCrushDestinations, layoutBatch };
```

Replace the existing `return { superCrushDestinations };`.

- [ ] **Step 5: Add helper for deps**

Add a method near `_getSuperCrushDestinationContext`:

```ts
        _getPhaseLayoutBatch() {
            const ctx = this._phaseContext;
            return ctx && ctx.layoutBatch ? ctx.layoutBatch : null;
        }
```

- [ ] **Step 6: Pass layout batch to destroy source deps**

In `_getDestroySourceAnimationDeps()`, add:

```ts
                layoutBatch: this._getPhaseLayoutBatch()
```

Keep it optional. Existing source animation modules must still work if it is `null`.

- [ ] **Step 7: Run animation tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.animation-engine.test.ts test/ui.animation-engine.playback-state.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 5**

```powershell
git add ui/animation-engine.ts test/ui.animation-engine.test.ts
git commit -m "Share layout reads within playback phases"
```

---

### Task 6: Transient Overlay Batch Helper

**Files:**
- Create: `ui/transient-overlay-batch.ts`
- Create: `test/ui.transient-overlay-batch.test.ts`

- [ ] **Step 1: Write failing overlay batch tests**

Create `test/ui.transient-overlay-batch.test.ts`:

```ts
import { JSDOM } from 'jsdom';

describe('transient overlay batch', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('appends one shared phase root to body and clears it on cleanup', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;

    const { createTransientOverlayBatch } = require('../ui/transient-overlay-batch.js');
    const batch = createTransientOverlayBatch({ documentRef: document });
    const first = batch.getRoot({ className: 'phase-fx-root', zIndex: 1250 });
    const second = batch.getRoot({ className: 'phase-fx-root', zIndex: 1250 });

    expect(first).toBe(second);
    expect(document.body.children).toHaveLength(1);

    const child = document.createElement('div');
    batch.append(child);
    expect(first.children).toHaveLength(1);

    batch.cleanup();
    expect(document.body.children).toHaveLength(0);

    dom.window.close();
    delete global.window;
    delete global.document;
  });
});
```

- [ ] **Step 2: Run failing overlay batch test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.transient-overlay-batch.test.ts
```

Expected: FAIL because `../ui/transient-overlay-batch.js` does not exist.

- [ ] **Step 3: Implement `ui/transient-overlay-batch.ts`**

Create `ui/transient-overlay-batch.ts`:

```ts
type OverlayRootOptions = {
  className?: string;
  zIndex?: number;
};

function createTransientOverlayBatch(options?: { documentRef?: Document | null }) {
  const documentRef = options && options.documentRef
    ? options.documentRef
    : (typeof document !== 'undefined' ? document : null);
  let root: HTMLElement | null = null;

  function getRoot(rootOptions?: OverlayRootOptions): HTMLElement | null {
    if (!documentRef || !documentRef.body) return null;
    if (root && root.parentElement) return root;
    root = documentRef.createElement('div');
    root.className = (rootOptions && rootOptions.className) || 'transient-overlay-batch';
    root.setAttribute('aria-hidden', 'true');
    root.style.position = 'fixed';
    root.style.left = '0';
    root.style.top = '0';
    root.style.width = '100vw';
    root.style.height = '100vh';
    root.style.pointerEvents = 'none';
    root.style.overflow = 'hidden';
    root.style.zIndex = String((rootOptions && Number.isFinite(rootOptions.zIndex)) ? rootOptions.zIndex : 1250);
    documentRef.body.appendChild(root);
    return root;
  }

  function append(element: HTMLElement): boolean {
    const targetRoot = getRoot();
    if (!targetRoot || !element) return false;
    targetRoot.appendChild(element);
    return true;
  }

  function cleanup(): boolean {
    if (root && root.parentElement) root.parentElement.removeChild(root);
    root = null;
    return true;
  }

  return { getRoot, append, cleanup };
}

export = {
  createTransientOverlayBatch
};
```

- [ ] **Step 4: Run overlay batch tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.transient-overlay-batch.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```powershell
git add ui/transient-overlay-batch.ts test/ui.transient-overlay-batch.test.ts
git commit -m "Add transient overlay batch helper"
```

---

### Task 7: Batch UDG Lightning Source Animation Reads And Appends

**Files:**
- Modify: `ui/animation-engine.ts`
- Modify: `ui/animation-destroy-source-events.ts`
- Create: `test/ui.animation-destroy-source-batching.test.ts`

- [ ] **Step 1: Add synthetic batching test**

Create `test/ui.animation-destroy-source-batching.test.ts`:

```ts
import { JSDOM } from 'jsdom';

function makeRect(left: number, top: number) {
  return { left, top, width: 20, height: 20, right: left + 20, bottom: top + 20 };
}

describe('destroy source animation batching', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('UDG lightning uses layout batch for repeated source rect reads', async () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    global.window = dom.window as any;
    global.document = dom.window.document as any;
    (global.window as any).innerWidth = 800;
    (global.window as any).innerHeight = 600;

    const sourceCell = document.createElement('div');
    const targetCell = document.createElement('div');
    const sourceRect = jest.fn(() => makeRect(100, 100));
    const targetRect = jest.fn(() => makeRect(200, 200));
    sourceCell.getBoundingClientRect = sourceRect;
    targetCell.getBoundingClientRect = targetRect;

    const { createLayoutReadBatch } = require('../ui/layout-read-batch.js');
    const layoutBatch = createLayoutReadBatch();
    const sourceEvents = require('../ui/animation-destroy-source-events.js');

    await sourceEvents.animateUdgLightningStrike(
      { r: 3, col: 3, source: { r: 1, col: 1 } },
      {
        isNoAnim: () => false,
        getCellEl: (row: number, col: number) => (row === 1 && col === 1 ? sourceCell : targetCell),
        resolveSniperSource: () => ({ row: 1, col: 1 }),
        waitForAnimationFinish: () => Promise.resolve(),
        sleep: () => Promise.resolve(),
        timer: () => ({ setTimeout: (fn: Function) => { fn(); return 1; }, clearTimeout: jest.fn() }),
        playbackScope: null,
        layoutBatch
      }
    );

    await sourceEvents.animateUdgLightningStrike(
      { r: 4, col: 4, source: { r: 1, col: 1 } },
      {
        isNoAnim: () => false,
        getCellEl: (row: number, col: number) => (row === 1 && col === 1 ? sourceCell : targetCell),
        resolveSniperSource: () => ({ row: 1, col: 1 }),
        waitForAnimationFinish: () => Promise.resolve(),
        sleep: () => Promise.resolve(),
        timer: () => ({ setTimeout: (fn: Function) => { fn(); return 1; }, clearTimeout: jest.fn() }),
        playbackScope: null,
        layoutBatch
      }
    );

    expect(sourceRect).toHaveBeenCalledTimes(1);
    expect(targetRect).toHaveBeenCalledTimes(1);

    dom.window.close();
    delete global.window;
    delete global.document;
  });
});
```

- [ ] **Step 2: Run failing batching test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.animation-destroy-source-batching.test.ts
```

Expected: FAIL because `animateUdgLightningStrike` reads rects directly.

- [ ] **Step 3: Extend destroy source deps type**

In `ui/animation-destroy-source-events.ts`, extend `DestroySourceAnimationDeps`:

```ts
    layoutBatch?: {
        readRect?: (element: any) => any;
    } | null;
    transientOverlayBatch?: {
        getRoot?: (options?: any) => HTMLElement | null;
        append?: (element: HTMLElement) => boolean;
        cleanup?: () => boolean;
    } | null;
```

- [ ] **Step 4: Add helper functions in destroy source events**

Add near the top of `ui/animation-destroy-source-events.ts`:

```ts
function readElementRect(element: any, deps: DestroySourceAnimationDeps) {
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

function appendTransientOverlay(overlay: HTMLElement, deps: DestroySourceAnimationDeps): boolean {
    const batch = deps && deps.transientOverlayBatch;
    if (batch && typeof batch.append === 'function') {
        return batch.append(overlay) !== false;
    }
    if (typeof document !== 'undefined' && document.body) {
        document.body.appendChild(overlay);
        return true;
    }
    return false;
}
```

- [ ] **Step 5: Replace UDG direct rect reads and append**

In `animateUdgLightningStrike`, replace:

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

Replace:

```ts
    document.body.appendChild(overlay);
```

with:

```ts
    appendTransientOverlay(overlay, deps);
```

- [ ] **Step 6: Pass transient overlay batch from `AnimationEngine` phase context**

In `ui/animation-engine.ts`, require the helper:

```ts
var TransientOverlayBatch = requireRuntimeModuleOrWindowGlobal('./transient-overlay-batch', 'TransientOverlayBatch');
```

In `_buildPhaseContext()`, create it:

```ts
            const transientOverlayBatch = (TransientOverlayBatch && typeof TransientOverlayBatch.createTransientOverlayBatch === 'function')
                ? TransientOverlayBatch.createTransientOverlayBatch({ documentRef: (typeof document !== 'undefined' ? document : null) })
                : null;
            return { superCrushDestinations, layoutBatch, transientOverlayBatch };
```

In `_withPhaseContext()`, cleanup when this phase context owns a batch:

```ts
            } finally {
                try {
                    if (context && context.transientOverlayBatch && typeof context.transientOverlayBatch.cleanup === 'function') {
                        context.transientOverlayBatch.cleanup();
                    }
                } catch (e) { /* ignore */ }
                this._phaseContext = prev;
            }
```

In `_getDestroySourceAnimationDeps()`, add:

```ts
                transientOverlayBatch: this._getPhaseTransientOverlayBatch()
```

Add:

```ts
        _getPhaseTransientOverlayBatch() {
            const ctx = this._phaseContext;
            return ctx && ctx.transientOverlayBatch ? ctx.transientOverlayBatch : null;
        }
```

- [ ] **Step 7: Run batching and animation tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.animation-destroy-source-batching.test.ts test/ui.animation-destroy-source-events.stone-skin.test.ts test/ui.animation-engine.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 7**

```powershell
git add ui/animation-engine.ts ui/animation-destroy-source-events.ts test/ui.animation-destroy-source-batching.test.ts
git commit -m "Batch destroy source animation layout reads"
```

---

### Task 8: Replace Direct Card UI Calls In Card Interaction Hot Paths

**Files:**
- Modify: `cards/card-interaction.ts`
- Modify: `cards/card-interaction-overlay-selection.ts`
- Modify: `test/ui.card-use-source-element.test.ts`

- [ ] **Step 1: Add local helper in `cards/card-interaction.ts`**

Near existing render helpers, add:

```ts
function _requestCardUiSyncForInteraction(reason: string) {
    try {
        const fn = _readCardInteractionRuntimeFunction('requestCardUiSync');
        if (typeof fn === 'function') {
            fn(reason || 'card-interaction');
            return true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof renderCardUI === 'function') {
            renderCardUI();
            return true;
        }
    } catch (e) { /* ignore */ }
    return false;
}
```

- [ ] **Step 2: Replace non-immediate hot path calls**

Replace direct `renderCardUI();` calls that occur after state updates but do not need synchronous DOM inspection in the same call stack:

```ts
renderCardUI();
```

with:

```ts
_requestCardUiSyncForInteraction('card-interaction-state-change');
```

Do not replace a call if the next line immediately reads hand DOM for animation source selection. Those stay direct until a source-element-specific test is added.

- [ ] **Step 3: Add overlay selection dependency wrapper**

In `cards/card-interaction-overlay-selection.ts`, when it calls `deps.renderCardUI`, prefer an optional `deps.requestCardUiSync`:

```ts
function requestCardUiRefresh(deps: any, reason: string) {
    if (deps && typeof deps.requestCardUiSync === 'function') {
        deps.requestCardUiSync(reason);
        return true;
    }
    if (deps && typeof deps.renderCardUI === 'function') {
        deps.renderCardUI();
        return true;
    }
    return false;
}
```

Replace internal `deps.renderCardUI()` calls with:

```ts
requestCardUiRefresh(deps, 'overlay-selection');
```

- [ ] **Step 4: Add regression expectation for delayed board visual cases**

In `test/ui.card-use-source-element.test.ts`, keep existing expectations around:

- `board を変える card playback がある時は emitBoardUpdate を playback 完了まで待つ`
- `capture_to_hand_animation がある時も emitBoardUpdate を playback 完了まで待つ`

Add one assertion to the relevant setup where `global.requestCardUiSync = jest.fn(() => true)`:

```ts
expect(global.requestCardUiSync).toHaveBeenCalled();
```

Keep existing `emitBoardUpdate` call counts unchanged.

- [ ] **Step 5: Run card interaction tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.card-use-source-element.test.ts test/ui.card-destroy-hand.test.ts test/ui.card-renderer-hand-inspect.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 8**

```powershell
git add cards/card-interaction.ts cards/card-interaction-overlay-selection.ts test/ui.card-use-source-element.test.ts
git commit -m "Coalesce card interaction UI refreshes"
```

---

### Task 9: Final Verification And Worker Asset Sync Decision

**Files:**
- Modify only if generated output is intentionally required: `public/module-registry.js`, `dist/**`, `worker-public/**`

- [ ] **Step 1: Run source reference check**

Run:

```powershell
rg -n "performance-monitor|CardReversiPerformanceMonitor|getCardReversiPerformanceSnapshot|CARD_REVERSI_PERF_MONITOR" ui cards test docs --glob "!**/dist/**" --glob "!**/worker-public/**"
```

Expected: no matches. This confirms the previous disposable measurement implementation did not return.

- [ ] **Step 2: Run focused UI suite**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.render-scheduler.test.ts test/ui.layout-read-batch.test.ts test/ui.transient-overlay-batch.test.ts test/ui.animation-destroy-source-batching.test.ts test/ui.animation-engine.test.ts test/ui.playback-state-manager.test.ts test/ui.board-update-dispatch.test.ts test/ui.card-renderer-hand-inspect.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run network Single Visual Writer suite**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.network-snapshot.pending-presentation-reconcile.test.ts test/ui.network-snapshot.move-source-empty.test.ts test/network.playback-event-assembly.contract.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: exit code 0.

- [ ] **Step 5: Run build**

Run:

```powershell
npm run build:ts
```

Expected: exit code 0.

- [ ] **Step 6: Decide whether to run worker mirror sync**

If browser-served root TS/JS output changes require deploy mirror update, run:

```powershell
npm run worker:prepare
```

Expected: exit code 0. Stage generated mirror files only if this command changes them and deployment surface must include the optimization immediately.

- [ ] **Step 7: Inspect final diff**

Run:

```powershell
git status --short
git diff --stat
git diff -- ui/render-scheduler.ts ui/layout-read-batch.ts ui/transient-overlay-batch.ts ui.ts ui/board-update-dispatch.ts ui/animation-engine.ts ui/animation-destroy-source-events.ts cards/card-interaction.ts cards/card-interaction-overlay-selection.ts
```

Expected: only planned UI optimization files and their tests are changed. Existing unrelated dirty files must remain unstaged unless they were intentionally part of this work.

- [ ] **Step 8: Final commit**

If all verification passes and the diff is isolated:

```powershell
git add ui/render-scheduler.ts ui/layout-read-batch.ts ui/transient-overlay-batch.ts ui.ts ui/board-update-dispatch.ts ui/animation-engine.ts ui/animation-destroy-source-events.ts cards/card-interaction.ts cards/card-interaction-overlay-selection.ts test/ui.render-scheduler.test.ts test/ui.layout-read-batch.test.ts test/ui.transient-overlay-batch.test.ts test/ui.animation-destroy-source-batching.test.ts test/ui.board-update-dispatch.test.ts test/ui.animation-engine.test.ts test/ui.card-use-source-element.test.ts
git commit -m "Optimize UI render and animation batching"
```

If `npm run worker:prepare` produced required deploy mirror changes, stage those generated files in a separate commit:

```powershell
git add worker-public public/module-registry.js
git commit -m "Sync worker assets for UI batching"
```

---

## Expected Risk Areas

- `ui.ts` exports currently expose queue state variables. Keep those exports alive until all tests and callers stop relying on them.
- `emitBoardUpdate` must still report immediate event dispatch success. Only actual DOM render fallback should be scheduler-backed.
- Some card interactions need immediate DOM after `renderCardUI()` to locate animation source elements. Replace only calls where the next operation does not inspect the newly rendered DOM.
- `transientOverlayBatch.cleanup()` must not remove overlays before their animations finish. If a source animation awaits animation completion, phase cleanup is safe after `executePhase()` resolves. If a helper starts fire-and-forget animation, that helper must own its cleanup instead of using the phase batch root.
- `layoutBatch` caches rects for one phase only. Do not reuse across phases because earlier animations may move or resize DOM.

## Self-Review

- Spec coverage: render call coalescing is covered by Tasks 1-3 and 8. Layout read batching is covered by Tasks 4-5 and 7. DOM append aggregation is covered by Tasks 6-7. Single Visual Writer and network playback are covered by Task 9.
- Placeholder scan: no open implementation slots are left without exact files, snippets, commands, and expected results.
- Type consistency: scheduler API names are `requestBoardRender`, `requestCardUiRender`, `requestStatusUpdate`, `flushVisualUpdates`, and `getVisualUpdateState` throughout the plan.

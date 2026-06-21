# Destroy Playback Visual Transaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 破壊対象の石が `配置 -> 先に消える -> 破壊演出用に再出現 -> 消える` と見える問題を、カード個別ではなく UI playback と最終盤面同期の共通 transaction として完全に止める。

**Architecture:** `game/` の canonical 破壊処理は変えない。`ui/` 側で `PresentationHandler` が playback-bearing queue を drain した瞬間から、その drain 内の最後の `PLAYBACK_EVENTS` が完了するまでを `PlaybackStateManager` の visual playback claim で覆う。`DiffRenderer` と `ui.ts` の board render はこの drain-level claim と実 playback lock の両方を見て final EMPTY state の先行描画を止め、`waitForVisualPlaybackDrain()` も claim 中を非 idle と扱う。

**Tech Stack:** TypeScript, Jest/jsdom, classic browser module wrappers, existing `PlaybackStateManager`, `PresentationHandler`, `DiffRenderer`, `AnimationEngine`.

---

## Evidence And Scope

Observed root cause:

- `game/logic/board_ops.ts` の `destroyAt` 系は canonical board を即 `EMPTY` にし、その後 `DESTROY` presentation event を積む。
- `ui/diff-renderer.ts` は `prevState.value !== EMPTY && state.value === EMPTY` を見ると、playback がまだ見えていない場合に fallback `destroy-fade` で石を消せる。
- `ui/animation-destroy-events.ts` は破壊 playback 開始時に DOM 上の対象石がなければ、event の `before` から ghost disc を生成して破壊演出する。
- `ui/presentation-handler.ts` は `BOARD_UPDATED` で queued presentation events を drain するが、drain 後から `AnimationEngine.beginPlayback()` までを board render 側が atomic に認識できていない。

This plan intentionally does not change card logic for `狙撃の意志`, `破壊龍`, `雷撃`, `究極破壊神`, target-selection destroy cards, or any other card. They should all improve because the shared UI playback transaction becomes stable.

## Behavior Contract

- `DESTROY` playback が存在する board update では、final board render must not remove the target stone before playback starts.
- `PLAYBACK_EVENTS` queue が `PresentationHandler` に drain された後も、その drain 内の playback-bearing event がすべて終わるまでは board render を defer する。
- `AnimationEngine.beginPlayback()` が呼ばれても drain-level claim は消さない。実 playback と drain claim は重なってよく、claim は `flushBoardPresentationEvents()` の `finally` で解放する。
- Playback が開始できなかった場合だけ claim を解除し、busy state と board lock を stale にしない。
- Playback 完了後の final board sync は今まで通り `AnimationEngine.finalizePlayback()` の `emitBoardUpdate` で行う。
- `waitForVisualPlaybackDrain()` は `VisualPlaybackActive` と pending queue だけでなく visual playback claim も idle 判定に含める。
- `game/`, `shared/`, worker authority, and card-specific logic stay headless and unchanged.

## File Structure

- Modify `ui/playback-state-manager.ts`
  - Add visual playback claim state and public helpers.
  - Make `shouldDeferBoardUpdate()` and `shouldDeferUiSync()` return true while a claim exists.
  - Make `waitForVisualPlaybackDrain()` wait while a claim exists.
  - Keep drain-level claims alive across `beginPlayback()` / `finalizePlayback()` and clear them only by explicit release or stale cleanup.
- Modify `ui/diff-renderer.ts`
  - Treat a visual playback claim as an active Single Visual Writer condition.
  - Skip final diff render while a claim exists, even if presentation queues were already drained.
- Modify `ui/presentation-handler.ts`
  - Claim visual playback for the full drained presentation queue when that queue contains non-suppressed `PLAYBACK_EVENTS`.
  - Keep that claim active across intermediate `AnimationEngine.finalizePlayback()` board updates until the whole drain completes.
  - Also claim around direct non-drain `PLAYBACK_EVENTS` dispatches so direct callers still get handoff protection.
- Modify `test/ui.playback-state-manager.test.ts`
  - Add focused claim-state contract tests.
- Create `test/ui.destroy-playback-visual-transaction.test.ts`
  - Reproduce the broken final-render-before-destroy-playback case in jsdom.
- Create `test/ui.presentation-handler.playback-claim.test.ts`
  - Verify `PresentationHandler` claims before calling `AnimationEngine.play()`, holds the claim across multi-event drains, and does not claim suppressed playback.
- Modify `test/ui.card-interaction-pending-network.test.ts`
  - Verify pending-selection network cleanup waits while a visual playback claim is active.
- Optionally modify `docs/architecture-contracts.md`
  - Add one short note under the UI presentation boundary if the current text does not already state that playback drain and final board render are a transaction.
- Optionally modify `正本/演出正本.md`
  - Add one short note that破壊対象は `DESTROY` playback が所有してから消す, if this is not already documented.

## Implementation Notes

- Do not edit `worker-public/` by hand.
- Do not change `game/logic/board_ops.ts`; canonical state may remain final-state-first.
- Do not add card-type-specific branches for `SNIPER_WILL`, `ULTIMATE_REVERSE_DRAGON`, `ULTIMATE_DESTROY_GOD`, or any destroy cause.
- Keep the new state inside `PlaybackStateManager`; do not introduce another global flag outside that module except the existing mirrored debug/window state it owns.
- The checkout is already dirty. Stage and commit only files intentionally changed for this plan's execution.
- `ui/diff-renderer.ts` is already dirty in the current checkout. Before any implementation touches it, inspect `git diff -- ui/diff-renderer.ts`. Do not use full-file `git add ui/diff-renderer.ts` while unrelated hunks remain; stage only the new playback-claim hunks with interactive/patch staging or pause and ask for direction.

---

### Task 1: Add PlaybackStateManager Claim Contract Tests

**Files:**
- Modify: `test/ui.playback-state-manager.test.ts`

- [ ] **Step 1: Add failing tests for visual playback claims**

Append these tests inside the existing `describe('PlaybackStateManager runtime helpers', () => { ... })` block:

```ts
  test('visual playback claim defers board and UI sync after queues are drained', () => {
    const manager = require('../ui/playback-state-manager.js');
    const emptyCardState = {
      presentationEvents: [],
      _presentationEventsPersist: []
    };

    const claim = manager.claimVisualPlayback({
      source: 'unit-test',
      eventTypes: ['destroy'],
      eventCount: 1
    });

    expect(claim).toEqual(expect.objectContaining({
      id: expect.any(Number),
      meta: expect.objectContaining({
        source: 'unit-test'
      })
    }));
    expect(manager.hasClaimedVisualPlayback()).toBe(true);
    expect(manager.shouldDeferBoardUpdate({ cardState: emptyCardState })).toBe(true);
    expect(manager.shouldDeferUiSync({ cardState: emptyCardState })).toBe(true);
    expect(global.window.__visualPlaybackClaimActive).toBe(true);
    expect(global.window.__visualPlaybackClaimCount).toBe(1);

    expect(manager.releaseVisualPlaybackClaim(claim)).toBe(true);
    expect(manager.hasClaimedVisualPlayback()).toBe(false);
    expect(manager.shouldDeferBoardUpdate({ cardState: emptyCardState })).toBe(false);
    expect(manager.shouldDeferUiSync({ cardState: emptyCardState })).toBe(false);
    expect(global.window.__visualPlaybackClaimActive).toBe(false);
    expect(global.window.__visualPlaybackClaimCount).toBe(0);
  });

  test('beginPlayback keeps a drain-level visual playback claim until explicit release', () => {
    const manager = require('../ui/playback-state-manager.js');
    const board = document.getElementById('board');

    const claim = manager.claimVisualPlayback({
      source: 'unit-test',
      eventTypes: ['destroy'],
      scope: 'presentation_drain'
    });
    expect(manager.hasClaimedVisualPlayback()).toBe(true);

    const started = manager.beginPlayback({ boardElement: board, startedAt: 1234 });

    expect(started.playbackActive).toBe(true);
    expect(manager.hasClaimedVisualPlayback()).toBe(true);
    expect(manager.getPlaybackActive()).toBe(true);
    expect(global.window.VisualPlaybackActive).toBe(true);
    expect(global.window.__visualPlaybackClaimActive).toBe(true);
    expect(board.classList.contains('playback-locked')).toBe(true);

    manager.finalizePlayback({ boardElement: board, clearBoardUpdateContext: true });

    expect(manager.hasClaimedVisualPlayback()).toBe(true);
    expect(manager.shouldDeferBoardUpdate({ cardState: { presentationEvents: [], _presentationEventsPersist: [] } })).toBe(true);
    expect(manager.releaseVisualPlaybackClaim(claim)).toBe(true);
    expect(manager.getPlaybackActive()).toBe(false);
    expect(global.window.VisualPlaybackActive).toBe(false);
    expect(board.classList.contains('playback-locked')).toBe(false);
  });

  test('waitForVisualPlaybackDrain waits while a visual playback claim exists', async () => {
    const manager = require('../ui/playback-state-manager.js');
    const emptyCardState = {
      presentationEvents: [],
      _presentationEventsPersist: []
    };
    const claim = manager.claimVisualPlayback({
      source: 'unit-test',
      eventTypes: ['destroy'],
      scope: 'presentation_drain'
    });
    let resolved = false;

    const drainPromise = manager.waitForVisualPlaybackDrain({
      cardState: emptyCardState,
      timeoutMs: 5000
    }).then(() => {
      resolved = true;
    });

    await Promise.resolve();
    jest.advanceTimersByTime(16);
    await Promise.resolve();

    expect(resolved).toBe(false);

    expect(manager.releaseVisualPlaybackClaim(claim)).toBe(true);
    jest.advanceTimersByTime(16);
    await drainPromise;

    expect(resolved).toBe(true);
  });

  test('clearPlaybackLock clears stale visual playback claims', () => {
    const manager = require('../ui/playback-state-manager.js');

    manager.claimVisualPlayback({
      source: 'unit-test',
      eventTypes: ['destroy']
    });
    expect(manager.hasClaimedVisualPlayback()).toBe(true);

    manager.clearPlaybackLock();

    expect(manager.hasClaimedVisualPlayback()).toBe(false);
    expect(global.window.__visualPlaybackClaimActive).toBe(false);
    expect(global.window.__visualPlaybackClaimCount).toBe(0);
  });
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.playback-state-manager.test.ts
```

Expected before implementation:

```text
TypeError: manager.claimVisualPlayback is not a function
```

- [ ] **Step 3: Commit nothing yet**

Do not commit after this task because the failing tests are only the red phase.

---

### Task 2: Add Destroy Playback Visual Transaction Regression Tests

**Files:**
- Create: `test/ui.destroy-playback-visual-transaction.test.ts`

- [ ] **Step 1: Create the jsdom regression test**

Create `test/ui.destroy-playback-visual-transaction.test.ts` with:

```ts
import { JSDOM } from 'jsdom';

function createBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(0));
}

function createCardState() {
  return {
    markers: [],
    pendingEffectByPlayer: { black: null, white: null },
    boardBonusByCell: {},
    boardBonusConsumedByCell: {},
    presentationEvents: [],
    _presentationEventsPersist: []
  };
}

describe('destroy playback visual transaction', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).HTMLElement = dom.window.HTMLElement;
    (global as any).boardEl = dom.window.document.getElementById('board');
    (global as any).BLACK = 1;
    (global as any).WHITE = -1;
    (global as any).EMPTY = 0;
    (global as any).handleCellClick = jest.fn();
    (global as any).getPlayerKey = (player: number) => (player === 1 ? 'black' : 'white');
    (global as any).getLegalMoves = () => [];
    (global as any).CardLogic = {
      getCardContext: () => ({ protectedStones: [], permaProtectedStones: [], bombs: [] }),
      getSelectableTargets: () => []
    };
    (global as any).gameState = {
      currentPlayer: 1,
      turnNumber: 1,
      board: createBoard()
    };
    (global as any).cardState = createCardState();
    (global as any).window.DISABLE_ANIMATIONS = false;
  });

  afterEach(() => {
    try {
      const manager = require('../ui/playback-state-manager.js');
      if (manager && typeof manager.clearPlaybackLock === 'function') {
        manager.clearPlaybackLock();
      }
    } catch (e) {
      // ignore cleanup failures in partially implemented red phase
    }
    if (dom && dom.window) dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).HTMLElement;
    delete (global as any).boardEl;
    delete (global as any).BLACK;
    delete (global as any).WHITE;
    delete (global as any).EMPTY;
    delete (global as any).handleCellClick;
    delete (global as any).getPlayerKey;
    delete (global as any).getLegalMoves;
    delete (global as any).CardLogic;
    delete (global as any).gameState;
    delete (global as any).cardState;
  });

  test('claimed destroy playback prevents final empty board diff from removing the target first', () => {
    const diff = require('../ui/diff-renderer.js');
    const manager = require('../ui/playback-state-manager.js');
    const boardEl = (global as any).boardEl;

    (global as any).gameState.board[2][3] = (global as any).WHITE;
    diff.renderBoardDiff(boardEl);

    const targetBefore = boardEl.querySelector('.cell[data-row="2"][data-col="3"] .disc');
    expect(targetBefore).toBeTruthy();
    expect(targetBefore.classList.contains('destroy-fade')).toBe(false);

    const claim = manager.claimVisualPlayback({
      source: 'unit-test',
      eventTypes: ['destroy'],
      eventCount: 1
    });
    (global as any).gameState.board[2][3] = (global as any).EMPTY;

    const changed = diff.renderBoardDiff(boardEl);

    expect(changed).toBe(0);
    const targetDuringClaim = boardEl.querySelector('.cell[data-row="2"][data-col="3"] .disc');
    expect(targetDuringClaim).toBeTruthy();
    expect(targetDuringClaim.classList.contains('destroy-fade')).toBe(false);

    manager.releaseVisualPlaybackClaim(claim);
  });
});
```

- [ ] **Step 2: Run the new test and confirm failure**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.destroy-playback-visual-transaction.test.ts
```

Expected before implementation:

```text
TypeError: manager.claimVisualPlayback is not a function
```

- [ ] **Step 3: Commit nothing yet**

Keep the failing test unstaged until the implementation makes it pass.

---

### Task 3: Add PresentationHandler Claim Tests

**Files:**
- Create: `test/ui.presentation-handler.playback-claim.test.ts`

- [ ] **Step 1: Create tests for claim order and suppressed playback**

Create `test/ui.presentation-handler.playback-claim.test.ts` with:

```ts
describe('PresentationHandler playback claim', () => {
  afterEach(() => {
    jest.resetModules();
    delete (global as any).AnimationEngine;
    delete (global as any).GameEvents;
    delete (global as any).PlaybackStateManager;
  });

  test('claims visual playback before dispatching AnimationEngine playback', async () => {
    const order: string[] = [];
    const claim = { id: 7 };
    (global as any).GameEvents = {
      gameEvents: {
        on: jest.fn()
      }
    };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn(() => {
        order.push('claim');
        return claim;
      }),
      releaseVisualPlaybackClaim: jest.fn((token) => {
        expect(token).toBe(claim);
        order.push('release');
        return true;
      })
    };
    (global as any).AnimationEngine = {
      play: jest.fn(async () => {
        order.push('play');
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');

    await PresentationHandler.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'destroy', phase: 1, targets: [{ r: 2, col: 3 }] }],
      meta: { source: 'unit-test' }
    });

    expect(order).toEqual(['claim', 'play', 'release']);
    expect((global as any).PlaybackStateManager.claimVisualPlayback).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'unit-test',
        eventCount: 1,
        eventTypes: ['destroy']
      })
    );
    expect((global as any).AnimationEngine.play).toHaveBeenCalledWith([
      { type: 'destroy', phase: 1, targets: [{ r: 2, col: 3 }] }
    ]);
  });

  test('does not claim suppressed playback batches', async () => {
    (global as any).GameEvents = {
      gameEvents: {
        on: jest.fn()
      }
    };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn(),
      releaseVisualPlaybackClaim: jest.fn()
    };
    (global as any).AnimationEngine = {
      play: jest.fn()
    };

    const PresentationHandler = require('../ui/presentation-handler.js');

    await PresentationHandler.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{ type: 'destroy', phase: 1, targets: [{ r: 2, col: 3 }] }],
      meta: {
        source: 'self_snapshot_sync',
        suppressPlayback: true
      }
    });

    expect((global as any).PlaybackStateManager.claimVisualPlayback).not.toHaveBeenCalled();
    expect((global as any).PlaybackStateManager.releaseVisualPlaybackClaim).not.toHaveBeenCalled();
    expect((global as any).AnimationEngine.play).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the new test and confirm failure**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.presentation-handler.playback-claim.test.ts
```

Expected before implementation:

```text
Expected order to equal ["claim", "play", "release"], but received ["play"]
```

- [ ] **Step 3: Commit nothing yet**

Keep this as part of the red phase.

---

### Task 4: Implement Visual Playback Claims

**Files:**
- Modify: `ui/playback-state-manager.ts`

- [ ] **Step 1: Add claim storage near the existing lock state**

Insert this near `activePlaybackAbortHandle`, `nextSelectionSettlementLockId`, and `selectionSettlementLockIds`:

```ts
let nextVisualPlaybackClaimId = 1;
const visualPlaybackClaimIds = new Map<number, any>();
```

- [ ] **Step 2: Add claim helper functions**

Insert these functions after `syncSelectionSettlementLockMirror()`:

```ts
function normalizeVisualPlaybackClaimMeta(meta?: any): any {
  const source = String(meta && meta.source ? meta.source : 'unknown').trim() || 'unknown';
  const rawScope = String(meta && meta.scope ? meta.scope : '').trim().toLowerCase();
  const scope = rawScope === 'presentation_drain' || rawScope === 'batch_handoff'
    ? rawScope
    : 'generic';
  const eventCount = Number(meta && meta.eventCount);
  const eventTypes = Array.isArray(meta && meta.eventTypes)
    ? meta.eventTypes.map((value: any) => String(value || '').trim()).filter((value: string) => !!value)
    : [];
  const normalized: any = { source, scope };
  if (Number.isFinite(eventCount) && eventCount >= 0) normalized.eventCount = Math.trunc(eventCount);
  if (eventTypes.length > 0) normalized.eventTypes = eventTypes;
  if (typeof meta !== 'undefined' && meta !== null && typeof meta === 'object') {
    if (typeof meta.reason === 'string' && meta.reason.trim()) normalized.reason = meta.reason.trim();
    if (typeof meta.strictNetworkPlayback !== 'undefined') normalized.strictNetworkPlayback = meta.strictNetworkPlayback === true;
  }
  return normalized;
}

function syncVisualPlaybackClaimMirror(): number {
  const count = visualPlaybackClaimIds.size;
  setMirroredValue('__visualPlaybackClaimCount', count);
  setMirroredValue('__visualPlaybackClaimActive', count > 0);
  return count;
}

function hasClaimedVisualPlayback(): boolean {
  if (visualPlaybackClaimIds.size > 0) return true;
  return readMirroredValue('__visualPlaybackClaimActive') === true;
}

function claimVisualPlayback(meta?: any): any {
  const token = {
    id: nextVisualPlaybackClaimId++,
    meta: normalizeVisualPlaybackClaimMeta(meta)
  };
  visualPlaybackClaimIds.set(token.id, token);
  syncVisualPlaybackClaimMirror();
  setProcessing(true);
  setCardAnimating(true);
  setBoardLockActive(true);
  return token;
}

function releaseVisualPlaybackClaim(token?: any): boolean {
  const tokenId = Number(token && token.id);
  const removed = Number.isFinite(tokenId) && visualPlaybackClaimIds.delete(tokenId);
  syncVisualPlaybackClaimMirror();
  if (!getPlaybackActive()) {
    setProcessing(false);
    setCardAnimating(false);
    setBoardLockActive(false);
  } else {
    setBoardLockActive(true);
  }
  return removed === true;
}

function clearVisualPlaybackClaims(): boolean {
  visualPlaybackClaimIds.clear();
  syncVisualPlaybackClaimMirror();
  return true;
}
```

- [ ] **Step 3: Include claims in busy, defer, and visual-drain checks**

Change `getPlaybackActive()` to include visual playback claims:

```ts
function getPlaybackActive(): boolean {
  return readMirroredValue('VisualPlaybackActive') === true
    || hasClaimedVisualPlayback() === true
    || hasSelectionSettlementLock()
    || isNetworkPresentationTimelinePlaying();
}
```

Change `shouldDeferBoardUpdate()` to:

```ts
function shouldDeferBoardUpdate(options?: any): boolean {
  const opts = (options && typeof options === 'object') ? options : {};
  if (shouldAllowSelectionEntryDuringPlayback(opts) === true) {
    return false;
  }
  return getPlaybackActive() === true
    || hasClaimedVisualPlayback() === true
    || hasPendingVisualPlayback(opts.cardState)
    || isNetworkPresentationTimelinePlaying();
}
```

Change `shouldDeferUiSync()` to:

```ts
function shouldDeferUiSync(options?: any): boolean {
  const opts = (options && typeof options === 'object') ? options : {};
  if (shouldAllowSelectionEntryDuringPlayback(opts) === true) {
    return false;
  }
  return getPlaybackActive() === true
    || hasClaimedVisualPlayback() === true
    || hasPendingPresentationEvents(opts.cardState)
    || isNetworkPresentationTimelinePlaying();
}
```

Change `isVisualPlaybackDrainComplete()` to:

```ts
function isVisualPlaybackDrainComplete(options?: any): boolean {
  return readMirroredValue('VisualPlaybackActive') !== true
    && hasClaimedVisualPlayback() !== true
    && hasPendingVisualPlayback(resolveVisualPlaybackDrainCardState(options)) !== true;
}
```

- [ ] **Step 4: Keep drain claims alive while real playback runs**

Do not clear visual playback claims in `beginPlayback()`. A presentation drain claim must survive intermediate `AnimationEngine.finalizePlayback()` board updates while a later drained playback event is still waiting. The function should remain structurally like:

```ts
function beginPlayback(options?: any): any {
  const opts = (options && typeof options === 'object') ? options : {};
  setInteractionLock(true);
  if (opts.startedAt === null) {
    setPlaybackStartedAt(null);
  } else {
    ensurePlaybackStartedAt(opts.startedAt);
  }
  setBoardLockActive(true, opts);
  return {
    playbackActive: getPlaybackActive(),
    isCardAnimating: getCardAnimating(),
    isProcessing: getProcessing(),
    startedAt: getPlaybackStartedAt()
  };
}
```

- [ ] **Step 5: Clear claims in cleanup paths**

Do not clear visual playback claims in `finalizePlayback()`. `finalizePlayback()` can run between two playback-bearing events from the same drained presentation queue, so clearing there would reopen the final-render race.

In `clearPlaybackLock()` add `clearVisualPlaybackClaims();` before `clearBoardUpdateContext();`.

The cleanup block should include:

```ts
function clearPlaybackLock(options?: any): boolean {
  const opts = (options && typeof options === 'object') ? options : {};
  clearVisualPlaybackClaims();
  clearBoardUpdateContext();
  clearSelectionEntryPlaybackContext();
  if (opts.preserveSelectionSettlementLock !== true) {
    clearSelectionSettlementLocks();
  }
  setBusyState({ processing: false, cardAnimating: false, playbackActive: false });
  setPlaybackStartedAt(null);
  setBoardLockActive(getPlaybackActive(), opts);
  return true;
}
```

- [ ] **Step 6: Export the new helpers**

Add these properties to `getRuntimePlaybackState()` and `PlaybackStateManager`:

```ts
    claimVisualPlayback,
    releaseVisualPlaybackClaim,
    clearVisualPlaybackClaims,
    hasClaimedVisualPlayback,
```

- [ ] **Step 7: Run the PlaybackStateManager tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.playback-state-manager.test.ts
```

Expected:

```text
PASS test/ui.playback-state-manager.test.ts
```

- [ ] **Step 8: Commit the manager contract**

Run:

```powershell
git status --short
git diff -- test/ui.playback-state-manager.test.ts ui/playback-state-manager.ts
git add test/ui.playback-state-manager.test.ts ui/playback-state-manager.ts
git commit -m "fix: add visual playback claim state"
```

---

### Task 5: Wire Claims Into DiffRenderer And PresentationHandler

**Files:**
- Modify: `ui/diff-renderer.ts`
- Modify: `ui/presentation-handler.ts`
- Create: `test/ui.destroy-playback-visual-transaction.test.ts`
- Create: `test/ui.presentation-handler.playback-claim.test.ts`

- [ ] **Step 1: Add claimed-playback detection to DiffRenderer**

In `ui/diff-renderer.ts`, after `_hasPendingPlaybackEvents()`, add:

```ts
function _hasClaimedVisualPlaybackForDiff() {
    if (PlaybackStateModule && typeof PlaybackStateModule.hasClaimedVisualPlayback === 'function') {
        try {
            return PlaybackStateModule.hasClaimedVisualPlayback() === true;
        } catch (e: any) { /* ignore */ }
    }
    try {
        if (typeof window !== 'undefined' && (window as any).__visualPlaybackClaimActive === true) return true;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).__visualPlaybackClaimActive === true) return true;
    } catch (e: any) { /* ignore */ }
    return false;
}
```

- [ ] **Step 2: Include claims in the Single Visual Writer guard**

In `renderBoardDiff()`, change the guard setup to:

```ts
    const hasPendingPlaybackEvents = _hasPendingPlaybackEvents();
    const hasClaimedVisualPlayback = _hasClaimedVisualPlaybackForDiff();
    const visualPlaybackActive = _isVisualPlaybackActiveForDiff();
    const boardHasPlaybackLock = !!(boardEl && boardEl.classList && boardEl.classList.contains('playback-locked'));
    if ((hasPendingPlaybackEvents || hasClaimedVisualPlayback || (visualPlaybackActive && boardHasPlaybackLock)) && shouldDeferBoardUpdate && !allowBoardUpdateDuringPlayback) {
        if (typeof window !== 'undefined' && window.__DEV__ === true) {
            throw new Error('renderBoardDiff called during active VisualPlayback (dev fail-fast)');
        } else {
            console.warn('renderBoardDiff called during active VisualPlayback. Skipping diff render until playback ends.');
            if (typeof window !== 'undefined') { window.__telemetry__ = window.__telemetry__ || { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }; window.__telemetry__.singleVisualWriterHits = (window.__telemetry__.singleVisualWriterHits || 0) + 1; }
            return 0;
        }
    }
```

- [ ] **Step 3: Add claim helpers to PresentationHandler**

In `ui/presentation-handler.ts`, after `getPlaybackDispatchDeps()`, add:

```ts
function resolvePlaybackStateManagerForPresentation(): any {
  const globalManager = resolveFromGlobal('PlaybackStateManager');
  if (globalManager && typeof globalManager === 'object') return globalManager;
  try {
    const manager = _require('./playback-state-manager');
    if (manager && typeof manager === 'object') return manager;
  } catch (e) { /* ignore */ }
  return null;
}

function collectPlaybackEventTypesForClaim(payload: any[]): string[] {
  const seen = new Set<string>();
  for (const item of payload) {
    const type = String(item && item.type ? item.type : '').trim();
    if (type) seen.add(type);
  }
  return Array.from(seen);
}

function getPlaybackEventsFromPresentationEventForClaim(ev: any): any[] {
  if (!ev || typeof ev !== 'object') return [];
  if (ev.type !== 'PLAYBACK_EVENTS') return [];
  if (ev.meta && ev.meta.suppressPlayback === true) return [];
  return normalizePlaybackEventsForUi(Array.isArray(ev.events) ? ev.events : []);
}

function claimPlaybackBatchForPresentation(ev: any, payload: any[]): any {
  const manager = resolvePlaybackStateManagerForPresentation();
  if (!manager || typeof manager.claimVisualPlayback !== 'function') return null;
  const meta = ev && ev.meta && typeof ev.meta === 'object' ? ev.meta : {};
  return manager.claimVisualPlayback({
    source: typeof meta.source === 'string' && meta.source.trim() ? meta.source.trim() : 'presentation_handler',
    reason: 'playback_batch_dispatch',
    scope: 'batch_handoff',
    eventCount: Array.isArray(payload) ? payload.length : 0,
    eventTypes: collectPlaybackEventTypesForClaim(payload),
    strictNetworkPlayback: meta.strictNetworkPlayback === true
  });
}

function claimPresentationDrainForEvents(events: any[]): any {
  const list = Array.isArray(events) ? events : [];
  const playbackPayloads = list
    .map(getPlaybackEventsFromPresentationEventForClaim)
    .filter((payload) => payload.length > 0);
  if (!playbackPayloads.length) return null;
  const mergedPayload = ([] as any[]).concat(...playbackPayloads);
  const manager = resolvePlaybackStateManagerForPresentation();
  if (!manager || typeof manager.claimVisualPlayback !== 'function') return null;
  return manager.claimVisualPlayback({
    source: 'presentation_handler',
    reason: 'presentation_queue_drain',
    scope: 'presentation_drain',
    eventCount: mergedPayload.length,
    eventTypes: collectPlaybackEventTypesForClaim(mergedPayload)
  });
}

function releasePlaybackClaimForPresentation(claim: any): boolean {
  if (!claim) return false;
  const manager = resolvePlaybackStateManagerForPresentation();
  if (!manager || typeof manager.releaseVisualPlaybackClaim !== 'function') return false;
  return manager.releaseVisualPlaybackClaim(claim);
}
```

- [ ] **Step 4: Claim around the full presentation drain**

In `flushBoardPresentationEvents()`, after `events` is loaded and before the `for (const ev of events)` loop, create a drain-level claim. Release it in `finally`, not inside `handlePresentationEvent`, so intermediate `AnimationEngine.finalizePlayback()` board updates between drained playback events still see a claim.

Use this structure:

```ts
async function flushBoardPresentationEvents(): Promise<void> {
  let drainClaim: any = null;
  try {
    const events = flushPendingPresentationEvents();
    drainClaim = claimPresentationDrainForEvents(events);
    emitPresentationDebugConsole('board_updated_flush', {
      eventCount: Array.isArray(events) ? events.length : 0,
      eventTypes: Array.isArray(events)
        ? events.map((item: any) => String(item && item.type || '').trim()).filter((value: string) => !!value)
        : []
    });
    try {
      const drainChargeDeltaPopups = (typeof window !== 'undefined' && typeof (window as any).drainVisibleChargeDeltaPopups === 'function')
        ? (window as any).drainVisibleChargeDeltaPopups
        : ((typeof (drainVisibleChargeDeltaPopups as any) === 'function') ? drainVisibleChargeDeltaPopups : null);
      if (drainChargeDeltaPopups) {
        drainChargeDeltaPopups({ allowRawFallback: false });
      }
    } catch (e) { /* ignore */ }
    for (const ev of events) {
      await handlePresentationEvent(ev);
    }
  } catch (e) {
    console.error('[PresentationHandler] onBoardUpdated error', e);
  } finally {
    releasePlaybackClaimForPresentation(drainClaim);
  }
}
```

- [ ] **Step 5: Keep direct non-drain playback dispatch covered**

In `playPlaybackEvents()`, after the `suppressPlayback` early return and before `const playbackDispatchDeps = getPlaybackDispatchDeps();`, keep a batch-level claim for direct callers that do not go through `flushBoardPresentationEvents()`. This is intentionally in addition to the drain claim; nested claims are valid, and releasing the batch claim must leave the drain claim active.

```ts
  const playbackClaim = claimPlaybackBatchForPresentation(ev, payload);
```

Wrap the dispatch body in `try/finally` so the function shape becomes:

```ts
  const playbackClaim = claimPlaybackBatchForPresentation(ev, payload);
  try {
    const playbackDispatchDeps = getPlaybackDispatchDeps();
    const strictNetworkPlayback = !!(ev && ev.meta && ev.meta.strictNetworkPlayback === true);
    const playbackEngineDeps = strictNetworkPlayback
      ? Object.assign({}, playbackDispatchDeps, { strictNetworkPlayback: true })
      : playbackDispatchDeps;
    const playbackEventForDispatch = {
      type: 'PLAYBACK_EVENTS',
      events: payload,
      meta: ev && ev.meta && typeof ev.meta === 'object' ? Object.assign({}, ev.meta) : undefined
    };
    const playbackEngine = resolvePlaybackEngine();
    try {
      if (playbackEngine && typeof playbackEngine.dispatchPresentationEvent === 'function') {
        const startedAt = Date.now();
        emitPresentationDebugConsole('playback_batch_dispatch_engine', {
          payloadCount: payload.length,
          payloadTypes,
          hasAnimationEngine: !!(playbackDispatchDeps && playbackDispatchDeps.AnimationEngine),
          animationEngineHasPlay: !!(playbackDispatchDeps && playbackDispatchDeps.AnimationEngine && typeof playbackDispatchDeps.AnimationEngine.play === 'function')
        });
        await playbackEngine.dispatchPresentationEvent(playbackEventForDispatch, playbackEngineDeps);
        emitPresentationDebugConsole('playback_batch_dispatch_engine_resolved', {
          payloadCount: payload.length,
          payloadTypes,
          elapsedMs: Date.now() - startedAt
        });
        return;
      }
    } catch (e) {
      emitPresentationDebugConsole('playback_batch_dispatch_engine_failed', {
        payloadCount: payload.length,
        payloadTypes,
        error: e && (e as any).message ? String((e as any).message) : String(e || '')
      });
      if (strictNetworkPlayback) {
        throw e;
      }
    }

    try {
      const animationEngine = playbackDispatchDeps.AnimationEngine;
      if (animationEngine && typeof animationEngine.play === 'function') {
        const startedAt = Date.now();
        emitPresentationDebugConsole('playback_batch_animation_engine', {
          payloadCount: payload.length,
          payloadTypes
        });
        if (strictNetworkPlayback) {
          await animationEngine.play(payload, { strictNetworkPlayback: true });
        } else {
          await animationEngine.play(payload);
        }
        emitPresentationDebugConsole('playback_batch_animation_engine_resolved', {
          payloadCount: payload.length,
          payloadTypes,
          elapsedMs: Date.now() - startedAt
        });
        return;
      }
      emitPresentationDebugConsole('playback_batch_no_animation_engine', {
        payloadCount: payload.length,
        payloadTypes
      });
      if (strictNetworkPlayback) {
        throw new Error('strict_network_playback_animation_engine_unavailable');
      }
    } catch (e) {
      emitPresentationDebugConsole('playback_batch_failed', {
        payloadCount: payload.length,
        payloadTypes,
        error: e && (e as any).message ? String((e as any).message) : String(e || '')
      });
      try { console.warn('[PresentationHandler] playback failed', e); } catch (e2) { /* ignore */ }
      if (strictNetworkPlayback) {
        throw e;
      }
    }
  } finally {
    releasePlaybackClaimForPresentation(playbackClaim);
  }
```

- [ ] **Step 6: Add a multi-event drain regression test**

Extend `test/ui.presentation-handler.playback-claim.test.ts` with a test where the flushed queue contains two non-suppressed `PLAYBACK_EVENTS`. The first playback should call `emitBoardUpdate` before the second playback begins, but the drain claim must still be active at that point.

```ts
  test('holds a drain claim across multiple drained playback batches', async () => {
    const order: string[] = [];
    const drainClaim = { id: 1 };
    const batchClaimOne = { id: 2 };
    const batchClaimTwo = { id: 3 };
    const claims = [drainClaim, batchClaimOne, batchClaimTwo];
    (global as any).GameEvents = {
      gameEvents: {
        on: jest.fn()
      }
    };
    (global as any).GamePresentationRuntime = {
      flushPendingPresentationEvents: jest.fn(() => [
        { type: 'PLAYBACK_EVENTS', events: [{ type: 'move', phase: 1 }] },
        { type: 'PLAYBACK_EVENTS', events: [{ type: 'destroy', phase: 2, targets: [{ r: 2, col: 3 }] }] }
      ])
    };
    (global as any).PlaybackStateManager = {
      claimVisualPlayback: jest.fn((meta) => {
        order.push(`claim:${meta.scope}`);
        return claims.shift();
      }),
      releaseVisualPlaybackClaim: jest.fn((claim) => {
        order.push(`release:${claim.id}`);
        return true;
      }),
      hasClaimedVisualPlayback: jest.fn(() => true)
    };
    (global as any).AnimationEngine = {
      play: jest.fn(async (payload) => {
        order.push(`play:${payload[0].type}`);
        if (payload[0].type === 'move') {
          order.push(`between:${(global as any).PlaybackStateManager.hasClaimedVisualPlayback()}`);
        }
      })
    };

    const PresentationHandler = require('../ui/presentation-handler.js');

    await PresentationHandler.onBoardUpdated();

    expect(order).toEqual([
      'claim:presentation_drain',
      'claim:batch_handoff',
      'play:move',
      'between:true',
      'release:2',
      'claim:batch_handoff',
      'play:destroy',
      'release:3',
      'release:1'
    ]);
  });
```

If the existing runtime resolver changes, adapt the setup to the actual `getPresentationRuntimeMethod()` lookup instead of weakening the assertion.

- [ ] **Step 7: Run focused tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.playback-state-manager.test.ts test/ui.destroy-playback-visual-transaction.test.ts test/ui.presentation-handler.playback-claim.test.ts
```

Expected:

```text
PASS test/ui.playback-state-manager.test.ts
PASS test/ui.destroy-playback-visual-transaction.test.ts
PASS test/ui.presentation-handler.playback-claim.test.ts
```

- [ ] **Step 8: Commit the UI transaction wiring**

Run:

```powershell
git status --short
git diff -- ui/diff-renderer.ts ui/presentation-handler.ts test/ui.destroy-playback-visual-transaction.test.ts test/ui.presentation-handler.playback-claim.test.ts
git add ui/presentation-handler.ts test/ui.destroy-playback-visual-transaction.test.ts test/ui.presentation-handler.playback-claim.test.ts
git add -p ui/diff-renderer.ts
git diff --cached -- ui/diff-renderer.ts
git commit -m "fix: defer board render during playback handoff"
```

Before committing, confirm the staged `ui/diff-renderer.ts` diff contains only playback-claim hunks. If unrelated pre-existing hunks appear, unstage them and repeat patch staging.

---

### Task 6: Protect Network And Existing Move-Source Contracts

**Files:**
- Modify: `test/ui.card-interaction-pending-network.test.ts`
- Modify only if tests reveal regressions:
  - `ui/playback-state-manager.ts`
  - `ui/diff-renderer.ts`
  - `ui/presentation-handler.ts`

- [ ] **Step 1: Add pending-selection network drain coverage**

Extend `test/ui.card-interaction-pending-network.test.ts` under `describe('PlaybackStateManager visual playback drain', ...)` with:

```ts
  test('waits for visual playback claims to release before authoritative settlement', async () => {
    jest.useFakeTimers();
    const claim = playbackStateManager.claimVisualPlayback({
      source: 'unit_test',
      scope: 'presentation_drain',
      eventTypes: ['destroy']
    });
    let resolved = false;

    const drainPromise = playbackStateManager.waitForVisualPlaybackDrain({
      cardState: {
        presentationEvents: [],
        _presentationEventsPersist: []
      },
      timeoutMs: 100
    }).then(() => {
      resolved = true;
    });
    await flushPromises();
    jest.advanceTimersByTime(16);
    await flushPromises();

    expect(resolved).toBe(false);

    expect(playbackStateManager.releaseVisualPlaybackClaim(claim)).toBe(true);
    jest.advanceTimersByTime(16);
    await drainPromise;

    expect(resolved).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
```

This test overlaps with the lower-level `test/ui.playback-state-manager.test.ts` check intentionally because `cards/card-interaction-pending-network.ts` depends on this exact public wait contract before clearing publish locks and orphan playback queues.

- [ ] **Step 2: Run existing network/presentation focused tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.card-interaction-pending-network.test.ts test/ui.network-snapshot.pending-presentation-reconcile.test.ts test/ui.network-snapshot.move-source-empty.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.playback-engine.dispatch.test.ts test/ui.presentation-handler.strict-network.test.ts
```

Expected:

```text
PASS test/ui.card-interaction-pending-network.test.ts
PASS test/ui.network-snapshot.pending-presentation-reconcile.test.ts
PASS test/ui.network-snapshot.move-source-empty.test.ts
PASS test/ui.network-snapshot.single-writer-baseline.test.ts
PASS test/ui.playback-engine.dispatch.test.ts
PASS test/ui.presentation-handler.strict-network.test.ts
```

- [ ] **Step 3: If a test fails because stale claim state remains, tighten cleanup**

If a failure shows `__visualPlaybackClaimActive` stays true after a suppressed playback, strict-network error, or direct fallback path, inspect the failure and add cleanup only in the matching branch. The expected cleanup call is:

```ts
releasePlaybackClaimForPresentation(playbackClaim);
```

or, in manager cleanup paths:

```ts
clearVisualPlaybackClaims();
```

Do not add card-specific exceptions.

- [ ] **Step 4: Re-run the focused tests**

Run the same command from Step 2.

Expected:

```text
PASS
```

- [ ] **Step 5: Commit Task 6 changes**

Run:

```powershell
git status --short
git diff -- test/ui.card-interaction-pending-network.test.ts ui/playback-state-manager.ts ui/diff-renderer.ts ui/presentation-handler.ts
git add test/ui.card-interaction-pending-network.test.ts
git add ui/playback-state-manager.ts ui/presentation-handler.ts
git add -p ui/diff-renderer.ts
git diff --cached -- ui/diff-renderer.ts
git commit -m "fix: stabilize playback claim cleanup"
```

Only stage source files listed here if Task 6 actually changed them. For `ui/diff-renderer.ts`, stage only playback-claim hunks and verify unrelated pre-existing hunks are not cached.

---

### Task 7: Update Presentation Boundary Docs If Needed

**Files:**
- Modify: `docs/architecture-contracts.md`
- Modify: `正本/演出正本.md`

- [ ] **Step 1: Inspect the current presentation boundary text**

Run:

```powershell
rg -n "Single Visual Writer|playback|BOARD_UPDATED|破壊|演出|差分" docs\\architecture-contracts.md 正本\\演出正本.md
```

Expected: find the existing UI/presentation contract sections.

- [ ] **Step 2: Add the architecture contract note if absent**

If `docs/architecture-contracts.md` does not already say that queued playback drain and final board render are a single visual transaction, add this note to the UI presentation boundary section:

```md
- `PLAYBACK_EVENTS` を含む盤面更新では、presentation queue が drain された時点から `AnimationEngine` が playback ownership を取得するまでを同一 visual transaction として扱う。`DiffRenderer` / board render はこの間に final canonical board を先行描画してはならない。最終盤面同期は playback completion 後の board update で行う。
```

- [ ] **Step 3: Add the演出正本 note if absent**

If `正本/演出正本.md` lacks the destroy ordering rule, add this note to the破壊演出 or共通演出 section:

```md
- 破壊対象の石は `DESTROY` playback が所有してから消す。canonical state が先に空マスになっていても、presentation playback がある場合は final board diff で対象石を先に消さない。
```

- [ ] **Step 4: Run docs diff check**

Run:

```powershell
git diff --check -- docs/architecture-contracts.md 正本/演出正本.md
```

Expected:

```text
no output
```

- [ ] **Step 5: Commit docs if changed**

If docs changed, run:

```powershell
git status --short
git diff -- docs/architecture-contracts.md 正本/演出正本.md
git add docs/architecture-contracts.md 正本/演出正本.md
git commit -m "docs: document playback render transaction"
```

If docs already covered the contract, do not commit.

---

### Task 8: Final Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Run TypeScript build and typecheck**

Run:

```powershell
npm run build:ts
npm run typecheck
```

Expected:

```text
build:ts exits 0
typecheck exits 0
```

- [ ] **Step 2: Run focused playback and network parity checks**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.playback-state-manager.test.ts test/ui.destroy-playback-visual-transaction.test.ts test/ui.presentation-handler.playback-claim.test.ts test/ui.card-interaction-pending-network.test.ts test/ui.network-snapshot.pending-presentation-reconcile.test.ts test/ui.network-snapshot.move-source-empty.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.playback-engine.dispatch.test.ts test/ui.presentation-handler.strict-network.test.ts
npm run test:network:parity
```

Expected:

```text
all listed Jest suites PASS
test:network:parity exits 0
```

- [ ] **Step 3: Run source boundary and whitespace checks**

Run:

```powershell
npm run check:window
git diff --check
```

Expected:

```text
check:window exits 0
git diff --check prints no output
```

- [ ] **Step 4: Browser verification for the reported symptom**

Run a local browser session after `npm run build:ts`. Use the existing static server:

```powershell
npm run serve
```

In browser/manual or Playwright inspection, verify at least:

- `狙撃の意志`: placement / turn-start shot destroys the nearest enemy without the target disappearing before the shot playback.
- `破壊龍`: adjacent enemy destroy playback does not show target vanish-then-ghost-return.
- `雷撃`: random enemy destroy playback does not show target vanish-then-ghost-return.
- `究極破壊神`: any destroy/move sequence with destroy playback keeps the target visible until playback owns the board.
- A non-playback ordinary final board removal still uses fallback `destroy-fade` when no `PLAYBACK_EVENTS` exists.

Expected visual result:

```text
破壊対象は playback の中で一度だけ消える。final board sync は playback 後にだけ見える。
```

- [ ] **Step 5: Prepare worker mirror only when deploy artifacts are part of the task**

If the implementation task requires deploy-surface sync, run:

```powershell
npm run worker:prepare
```

Expected:

```text
worker:prepare exits 0
```

Stage generated `worker-public/` output only when it was intentionally produced for this task and no unrelated pre-existing mirror diff is being mixed in.

- [ ] **Step 6: Final status review**

Run:

```powershell
git status --short
git log --oneline -5
```

Expected:

```text
Only intentional commits from this plan are new.
Unrelated dirty files remain unstaged if they existed before this work.
```

---

## Self-Review

- Spec coverage: the plan covers the root cause, not individual cards: full presentation-drain playback locking, final board render deferral, destroy ghost fallback prevention, cleanup, docs, and network pending-selection regression.
- Placeholder scan: no task depends on an unspecified helper; new helper names are defined in Task 4 and used in Task 5.
- Type consistency: planned exported helpers are `claimVisualPlayback`, `releaseVisualPlaybackClaim`, `clearVisualPlaybackClaims`, and `hasClaimedVisualPlayback`; those same names are used in tests and UI wiring.
- Risk: `PresentationHandler` claim release must outlive intermediate `AnimationEngine.finalizePlayback()` calls inside the same drained queue, but must not persist after the whole drain. The plan avoids both failure modes by holding a drain-level claim in `flushBoardPresentationEvents()` and releasing it in `finally`.

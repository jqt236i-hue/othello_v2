# Draw Hand Animation Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce internal overhead in the draw-hand animation path without changing visible behavior, animation timing, coordinates, playback ordering, input locks, or hand UI reveal timing.

**Architecture:** Keep `playDrawCardHandAnimation()` as the public behavior surface and preserve the existing deck-to-hand-to-retreat animation sequence. Only optimize no-wait preload/finalize plumbing and add regression tests that lock down duration, transform, queueing, and fallback behavior. Do not change rulebook, gameplay state, card catalog, Worker mirror, generated files, or draw animation constants.

**Tech Stack:** TypeScript/CommonJS browser modules, Jest with jsdom, existing `ui/animation-utils.ts` hand-layer animation helpers.

---

## File Structure

- Modify: `ui/animation-utils.ts`
  - Keep `playDrawCardHandAnimation()` behavior unchanged.
  - Update `_finalizeHandAddAfterCardFaceArtReady()` so preload promises marked as no-wait skip `_waitForCardFaceArtPreload()` timeout wrapping.
  - Do not change `HAND_DRAW_PICKUP_MS`, `HAND_DRAW_MOVE_MS`, `HAND_DRAW_RETREAT_MS`, `_animateCompat()` calls, `deckRect` / `handRect` reads, or cleanup/finalize ordering.
- Modify: `test/ui.animation-utils.hand-fallback.test.ts`
  - Add focused tests for the no-wait finalize path.
  - Keep existing draw animation timing and queueing tests.

## Non-Goals

- Do not change draw animation duration, easing, transform keyframes, coordinates, or number of animation phases.
- Do not remove `deckEl.getBoundingClientRect()` or `handEl.getBoundingClientRect()`.
- Do not pool or reuse `held-draw-card` DOM nodes.
- Do not change `_finalizeHandAddAnimation()` semantics, fade-in state, hand reveal state, or deck pulse behavior.
- Do not update `01-rulebook.md`, `正本/`, `worker-public/`, `dist/`, or generated catalog files.

## Behavior Invariants

- Draw animation still starts from the same deck coordinates and ends/retreats at the same hand coordinates.
- `playDrawCardHandAnimation()` still resolves only after cleanup and hand UI finalize settle.
- If card art preload needs waiting, the existing `CARD_FACE_ART_REVEAL_WAIT_MS` timeout behavior remains.
- If card art preload is skipped or explicitly marked no-wait, hand UI finalization still happens after the same Promise microtask boundary as before.
- `NOANIM`, disabled draw animation, active draw animation suppression, and 80ms duplicate suppression still finalize hand UI.

---

### Task 1: Characterize No-Wait Finalize Behavior

**Files:**
- Modify: `test/ui.animation-utils.hand-fallback.test.ts`

- [ ] **Step 1: Add a test that no-wait draw finalize does not create a timeout wrapper**

Add this test near the existing draw preload tests:

```ts
  test('playDrawCardHandAnimation finalizes no-wait preload without scheduling card art timeout', async () => {
    jest.useFakeTimers();

    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    window.resolveCardBackgroundArtPath = jest.fn(() => '');
    global.resolveCardBackgroundArtPath = window.resolveCardBackgroundArtPath;
    window.DISABLE_DRAW_HAND_ANIMATION = true;

    const mod = require('../ui/animation-utils.js');
    const promise = mod.playDrawCardHandAnimation({ player: 'black', cardId: 'missing_card', count: 1 });

    await Promise.resolve();
    await expect(promise).resolves.toBeUndefined();

    expect(global.renderCardUI).toHaveBeenCalled();
    expect(timeoutSpy).not.toHaveBeenCalledWith(expect.any(Function), 900);
  });
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.animation-utils.hand-fallback.test.ts
```

Expected before implementation:

```text
FAIL test/ui.animation-utils.hand-fallback.test.ts
playDrawCardHandAnimation finalizes no-wait preload without scheduling card art timeout
Expected: not to have been called with Any<Function>, 900
```

- [ ] **Step 3: Confirm existing draw timing tests still describe required behavior**

Before implementation, inspect these existing tests and do not edit their expected values:

```text
playDrawCardHandAnimation uses 10%-slower draw motion durations than the current baseline
playDrawCardHandAnimation waits until place-hand retreat releases the shared hand layer
playDrawCardHandAnimation resolves after playback scope timers are cleared
```

These tests protect the behavior that must not change.

---

### Task 2: Implement No-Wait Finalize Fast Path

**Files:**
- Modify: `ui/animation-utils.ts`

- [ ] **Step 1: Update `_finalizeHandAddAfterCardFaceArtReady()`**

Replace the current function:

```ts
function _finalizeHandAddAfterCardFaceArtReady(payload: any, options: any, preloadPromise: any) {
    return _waitForCardFaceArtPreload(preloadPromise, CARD_FACE_ART_REVEAL_WAIT_MS)
        .catch(() => null)
        .then(() => {
            _finalizeHandAddAnimation(payload, options);
        });
}
```

with:

```ts
function _finalizeHandAddAfterCardFaceArtReady(payload: any, options: any, preloadPromise: any) {
    const waitForPreload = _shouldWaitForCardFaceArtPreload(preloadPromise)
        ? _waitForCardFaceArtPreload(preloadPromise, CARD_FACE_ART_REVEAL_WAIT_MS)
        : Promise.resolve(preloadPromise);
    return waitForPreload
        .catch(() => null)
        .then(() => {
            _finalizeHandAddAnimation(payload, options);
        });
}
```

This preserves asynchronous finalization while avoiding the extra reveal-timeout wrapper for skipped/no-wait preload promises.

- [ ] **Step 2: Run the focused test file**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.animation-utils.hand-fallback.test.ts
```

Expected:

```text
PASS test/ui.animation-utils.hand-fallback.test.ts
```

- [ ] **Step 3: Verify draw animation timing remains unchanged**

Confirm the focused test output includes the existing passing test:

```text
playDrawCardHandAnimation uses 10%-slower draw motion durations than the current baseline
```

If it fails, revert the implementation and inspect for accidental changes to `HAND_DRAW_PICKUP_MS`, `HAND_DRAW_MOVE_MS`, `HAND_DRAW_RETREAT_MS`, or `_animateCompat()` calls.

---

### Task 3: Add Wait-Path Regression Coverage

**Files:**
- Modify: `test/ui.animation-utils.hand-fallback.test.ts`

- [ ] **Step 1: Add a test that wait-needed preload still uses the reveal timeout**

Add this test near the no-wait finalize test:

```ts
  test('playDrawCardHandAnimation still waits through card art timeout when preload needs waiting', async () => {
    jest.useFakeTimers();

    const imageSrcs = [];
    installCardBackgroundPreloadFixture(imageSrcs, {
      deck_wait: 'assets/images/card/wait-card.png'
    });
    window.DISABLE_DRAW_HAND_ANIMATION = true;
    const timeoutSpy = jest.spyOn(global, 'setTimeout');

    const mod = require('../ui/animation-utils.js');
    const promise = mod.playDrawCardHandAnimation({ player: 'black', cardId: 'deck_wait', count: 1 });

    await Promise.resolve();

    expect(imageSrcs).toContain('assets/images/card/wait-card.png');
    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 900);

    await jest.advanceTimersByTimeAsync(901);
    await expect(promise).resolves.toBeUndefined();
  });
```

- [ ] **Step 2: Run the focused test file**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.animation-utils.hand-fallback.test.ts
```

Expected:

```text
PASS test/ui.animation-utils.hand-fallback.test.ts
```

This confirms the optimization only affects no-wait preload promises.

---

### Task 4: Validate Adjacent Playback Paths

**Files:**
- No production changes.
- No test changes unless a failure is directly caused by the implementation.

- [ ] **Step 1: Run hand animation and card-use adjacent tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.animation-utils.hand-fallback.test.ts test/ui.animation-engine.hand-add.test.ts test/ui.card-use-source-element.test.ts test/ui.network-client.card-use-visual-descriptor.test.ts
```

Expected:

```text
Test Suites: 4 passed
Tests: all passed
```

- [ ] **Step 2: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected:

```text
tsc --noEmit
```

with exit code `0`.

- [ ] **Step 3: Run browser build check**

Run:

```powershell
npm run build:ts
```

Expected:

```text
tsc -p tsconfig.build.json
[build-training-cli] emitted
```

with exit code `0`.

---

### Task 5: Review, Stage, and Commit

**Files:**
- Modify: `ui/animation-utils.ts`
- Modify: `test/ui.animation-utils.hand-fallback.test.ts`

- [ ] **Step 1: Inspect the focused diff**

Run:

```powershell
git diff -- ui/animation-utils.ts test/ui.animation-utils.hand-fallback.test.ts
```

Expected:

```text
Only _finalizeHandAddAfterCardFaceArtReady and the focused tests changed.
No changes to HAND_DRAW_* constants, draw transforms, cleanup order, source coordinates, or playback queueing.
```

- [ ] **Step 2: Check whitespace**

Run:

```powershell
git diff --check -- ui/animation-utils.ts test/ui.animation-utils.hand-fallback.test.ts
```

Expected:

```text
No whitespace errors.
```

Line-ending warnings may appear in this repository and do not indicate a functional failure.

- [ ] **Step 3: Stage only the intended files**

Run:

```powershell
git add -- ui/animation-utils.ts test/ui.animation-utils.hand-fallback.test.ts
```

- [ ] **Step 4: Confirm no unrelated files are staged**

Run:

```powershell
git diff --cached --name-only
```

Expected:

```text
test/ui.animation-utils.hand-fallback.test.ts
ui/animation-utils.ts
```

- [ ] **Step 5: Commit**

Run:

```powershell
git commit -m "Optimize draw hand preload finalize"
```

Expected:

```text
[main <hash>] Optimize draw hand preload finalize
 2 files changed
```

---

## Self-Review

**Spec coverage:** The plan covers the requested draw/hand-add animation optimization while preserving visible behavior. It targets only no-wait preload/finalize overhead and avoids animation body changes.

**Placeholder scan:** No placeholder markers or deferred implementation notes are present.

**Type consistency:** Function names match existing code: `playDrawCardHandAnimation`, `_finalizeHandAddAfterCardFaceArtReady`, `_shouldWaitForCardFaceArtPreload`, `_waitForCardFaceArtPreload`, and `_finalizeHandAddAnimation`.

**Risk:** Low. The only production change is a guarded fast path for preload promises already marked as no-wait. The wait-needed preload path remains covered by regression tests.

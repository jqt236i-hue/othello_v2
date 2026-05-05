# fix-debug-hvh-mode learnings

## Done
- Fixed `game/move-executor.js` — local mode path (after `executeMoveViaPipeline`) now calls `onTurnStartLogic(nextPlayer)` for the next player, matching the network handoff path behavior.
- Added proper error handling: `.catch()` on the async promise + try/catch wrapper, both using `debugMoveExecutorError`.
- `setMoveExecutorProcessing(false)` and `emitBoardUpdate()` remain in original order after the new block.
- Network handoff path (lines 398-493) untouched.

## Verification
- `debugMoveExecutorError` confirmed existing (line 151, used in 4 other places)
- `onTurnStartLogic` confirmed existing (line 533) — wraps global `onTurnStart`
- `node --check game/move-executor.js` passes (no syntax errors)
- LSP diagnostics unavailable (no TypeScript server installed)

## Rationale
- The pipeline runs with `skipTurnStart:true`, so turn-start effects (card draw, effect ticks, game-over checks) are not handled there.
- The network handoff path handles this via `finalizeTurn`. In local mode (no `finalizeTurn`), we must call `onTurnStart` directly.
- `gameState.currentPlayer` is already updated to the next player by the pipeline at this point.

---

## Task 2: Mirror `worker-public/game/turn-manager.ts` — triple fallback fix

### What was fixed
- `worker-public/game/turn-manager.ts` mirror had old single-check pattern for `DEBUG_HUMAN_VS_HUMAN` in two functions
- Both `isHumanVsHumanModeEnabled()` and `canLocalUserOperateCurrentTurn()` now have triple fallback: `__uiImpl_turn_manager` → `(window as any)` → `(globalThis as any)`
- Root source `game/turn-manager.ts` was confirmed correct (already had the triple fallback)
- Mirror now exactly matches root for both functions

### Pattern applied
```typescript
const debugHvH = !!(
    (__uiImpl_turn_manager && __uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN) ||
    (typeof window !== 'undefined' && (window as any).DEBUG_HUMAN_VS_HUMAN) ||
    (typeof globalThis !== 'undefined' && (globalThis as any).DEBUG_HUMAN_VS_HUMAN)
);
```

### Verification
- Read both files before edit to confirm current state
- Applied two edits (one per function) — both successful
- Re-read mirror after edit to confirm exact match with root pattern
- LSP diagnostics unavailable (no TypeScript server installed) but pattern is byte-for-byte copy from working root

---

## Task 3: Fix root `game/pass-handler.js` — add `globalThis.DEBUG_HUMAN_VS_HUMAN` check

### What was done
- Modified `isHumanVsHumanModeEnabled()` in `game/pass-handler.js` (line 192-196)
- Added `debugHvH` variable that checks `globalThis.DEBUG_HUMAN_VS_HUMAN === true`
- Return `debugHvH || matchMode === 'network'` instead of just `matchMode === 'network'`
- Mirrors the already-fixed pattern in `worker-public/game/pass-handler.js:209-213`

### Pattern used
```js
function isHumanVsHumanModeEnabled() {
    const debugHvH = typeof globalThis !== 'undefined' && globalThis.DEBUG_HUMAN_VS_HUMAN === true;
    const matchMode = getCurrentMatchModeSafe();
    return debugHvH || matchMode === 'network';
}
```

### Verification
- Syntax check passed (`node -c game/pass-handler.js` — no errors)
- Jest test `test/game.pass-handler.test.js`: 19 failures **before and after** change (all pre-existing, all `TypeError: ph.XXX is not a function` — the module doesn't use `module.exports` for those internal functions)
- Conclusion: zero regression from this change

### Pre-existing test issue
- `test/game.pass-handler.test.js` uses `require('../game/pass-handler')` and expects exports like `handleBlackPassWhenNoMoves`, `processPassTurn`, `ensureCurrentPlayerCanActOrPass`
- Module at `game/pass-handler.js` doesn't export these via `module.exports` (lines 590-591) — they're internal functions
- This is a known pre-existing condition, not related to this PR

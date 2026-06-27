# Wave 1 — Known Failures

> **Source:** `.sisyphus/evidence/wave-0-baseline.txt`
> **Baseline:** 6 PASS, 17 FAIL (suite terminated early by CRASH)
> **Generated:** 2026-05-04

---

## Failure Summary by Category

| Category | Count | Description |
|----------|-------|-------------|
| TIMEOUT | 5 files | E2E browser tests that exceeded wait limits |
| IMPORT_ERROR | 2 files | Module resolution failures (CJS wrapper, missing exports) |
| DI_ERROR | 1 file | Module registry / DI not wired at test time |
| LOGIC_ERROR | 12 files | Assertion failures: wrong return values, mock misconfigurations |
| CRASH | 1 file | Unhandled `Error` in pass-handler that terminates the process |

**Note:** Some files have multiple failure categories. The table above counts primary category per file. A file counted under LOGIC_ERROR may also have IMPORT_ERROR subtests (e.g. `game.cpu-policy-core.test.ts`).

---

## Failure 1 — `test/e2e/card_effects.e2e.test.ts`

**Category:** TIMEOUT, LOGIC_ERROR

**Sub-failure A (TIMEOUT) — line 39:**
```
page.waitForFunction: Timeout 30000ms exceeded.
> 39 | await page.waitForFunction(() => typeof window.DebugActions === 'object'
     |       && typeof window.DebugActions.fillDebugHand === 'function', { timeout: 5000 });
```
`DebugActions` global not available on the page within 5s. Page likely failed to load or module registration flaky.

**Sub-failure B (LOGIC_ERROR) — line 213:**
```
Expected: true
Received: false
> 213 | expect(afterUse.recentLogs.some((entry) => entry.indexOf('...') !== -1)).toBe(true);
```
No matching log entry found after card use. Either card use did not execute correctly or log message text does not match.

**Priority:** P2
**Recommended Fix:** Ensure E2E test server preloads all required module scripts (`DebugActions`, `CardLogic`). Verify log message strings match between test and implementation.

---

## Failure 2 — `test/e2e/cpu_level_diff.e2e.test.ts`

**Category:** LOGIC_ERROR

**Line 124:**
```
Expected: "undefined"
Received: "object"
> 124 | expect(await page.evaluate(() => typeof window.cpuSmartness)).toBe('undefined');
```
`window.cpuSmartness` is defined as an object when it should be undefined. CPU smartness is leaking to the window scope before expected.

**Priority:** P2
**Recommended Fix:** Check CPU initialization order — `window.cpuSmartness` should not be assigned until the CPU level select happens.

---

## Failure 3 — `test/e2e/destroy-card-will-hunter-king.e2e.test.ts`

**Category:** TIMEOUT

**Line 34:**
```
page.waitForFunction: Timeout 30000ms exceeded.
> 34 | await page.waitForFunction(
     |   () => !!(window.gameState && window.cardState && window.executeDestroy && window.SharedConstants),
     |   { timeout: 10000 }
     | );
```
Required globals (`gameState`, `cardState`, `executeDestroy`, `SharedConstants`) not populated within 10s. Page likely failed to load or initialize.

**Priority:** P2
**Recommended Fix:** Verify E2E bootstrap loads all modules. Add retry/wait for page `load` event before checking globals.

---

## Failure 4 — `test/e2e/special_effects.e2e.test.ts`

**Category:** TIMEOUT

**Line 48:**
```
page.waitForFunction: Timeout 30000ms exceeded.
> 48 | await page.waitForFunction(() => typeof window.DebugActions === 'object'
     |   && typeof window.DebugActions.applyVisualTestBoard === 'function', { timeout: 10000 });
```
`DebugActions.applyVisualTestBoard` not available within 10s.

**Priority:** P2
**Recommended Fix:** Same root cause as Failure 1 — module preload issue. Fix DebugActions availability for all E2E tests.

---

## Failure 5 — `test/e2e/cpu_auto_response.e2e.test.ts`

**Category:** TIMEOUT

**Line 26:**
```
thrown: "Exceeded timeout of 30000 ms for a test."
> 26 | test('player move triggers CPU turn and CPU performs an action', async () => {
```
Full test exceeded 30s timeout. CPU auto-response flow did not complete in time.

**Priority:** P2
**Recommended Fix:** Increase timeout or debug CPU turn-handler initialization in E2E context. Likely related to the broader module-load issue.

---

## Failure 6 — `test/e2e/reset_click.e2e.test.ts`

**Category:** TIMEOUT

**Line 58:**
```
page.waitForFunction: Timeout 6000ms exceeded.
> 58 | await page.waitForFunction(({ beforeDiscCount, beforeTurn }) => {
     |   ...
     |   const currentDiscCount = document.querySelectorAll(...).length;
     |   ...
     | }, { timeout: 6000 });
```
After clicking a legal cell, the board did not update within 6s. The move may not have been executed.

**Priority:** P2
**Recommended Fix:** Verify click handler and move execution pipeline. Check that `gameState` updates trigger re-render.

---

## Failure 7 — `test/game.cpu-policy-core.test.ts`

**Category:** IMPORT_ERROR, LOGIC_ERROR, DI_ERROR

**File:** `test/game.cpu-policy-core.test.ts` (3314 lines, massive failure)

**Sub-failure A (IMPORT_ERROR) — `chooseMove` is not a function:**
```
TypeError: core.chooseMove is not a function
> 28 | const selected = core.chooseMove(moves, 3, ...);
```
Affects tests at lines 28, 455, 464, 472.

**Sub-failure B (IMPORT_ERROR) — `chooseHandDestroyTargetForCycle` is not a function:**
```
TypeError: core.chooseHandDestroyTargetForCycle is not a function
```
Affects tests at lines 119, 147, 175, 203, 231, 259, 287, 315, 343, 371, 399, 2167, 2196, 2225, 2258, 2288, 2318, 2347.

**Sub-failure C (IMPORT_ERROR) — `chooseMoveByLookahead` is not a function:**
```
TypeError: core.chooseMoveByLookahead is not a function
```
Affects ~20 tests (lines 492, 510, 538, 567, 598, 626, 653, 680, 706, 735, 759, 784, 818, 848, 873, etc.)

**Sub-failure D (IMPORT_ERROR) — `chooseCardWithRiskProfile` is not a function:**
```
TypeError: core.chooseCardWithRiskProfile is not a function
```
Line 903.

**Sub-failure E (IMPORT_ERROR) — `chooseLowestRetentionCard` is not a function:**
```
TypeError: core.chooseLowestRetentionCard is not a function
```
Affects tests at lines 1844, 1872, 1898, 1924, 1952, 1980, 2049, 2080, 2108, 2137, 2888, 2918.

**Sub-failure F (LOGIC_ERROR) — `scoreCardUseDecision` returns wrong values:**
Multiple assertions fail with `Expected: true Received: false` at lines 115, 933, 965, 1018, 1259, 1283, 1305, 1402, 1427, 1506, 1555, 1642, 1684, 2490, 2585, 2645, 2832.

Multiple assertions fail with `Expected: > X Received: X` (equal values, not strictly greater) at lines 1093, 1143, 1194, 1592, 1738, 1785, 2714, 2754, 2802, 2877, 2981, 3015, 3047, 3076, 3118, 3189, 3220, 3253.

**Sub-failure G (DI_ERROR) — `score`/`minUseScore` is undefined:**
```
Matcher error: expected value must be a number or bigint
Expected has value: undefined
```
Affected lines: 57, 1212, 1617, 2038, 2675.
`scoreCardUseDecision` returns a decision object with `score` or `minUseScore` as `undefined`.

**Root Cause:** The `cpu-policy-core` module's exported API has changed. Functions like `chooseMove`, `chooseHandDestroyTargetForCycle`, `chooseMoveByLookahead`, `chooseCardWithRiskProfile`, `chooseLowestRetentionCard` either no longer exist or are named differently. Additionally, `scoreCardUseDecision` returns objects with missing numeric properties.

**Priority:** P0
**Recommended Fix:** Audit `game/ai/cpu-policy-core.js` exports against test expectations. Either rename/re-export deprecated functions or update test imports. Fix `scoreCardUseDecision` to always return numeric `score`/`minUseScore`.

---

## Failure 8 — `test/game.cpuhandler.registration.test.ts`

**Category:** IMPORT_ERROR

**Line 1571:**
```
Cannot find module './dist/game/cpu-turn-handler' from 'game/cpu-turn-handler.js'
> 1 | module.exports = require("./dist/game/cpu-turn-handler");
```
The CJS compatibility wrapper `game/cpu-turn-handler.js` points to `./dist/game/cpu-turn-handler` which does not exist. The TS source is at `game/cpu-turn-handler.ts`, but `dist/` has not been built (or the build is stale).

**Priority:** P1
**Recommended Fix:** Either (a) remove the CJS wrapper and update the test to import the `.ts` source directly, or (b) configure Jest to resolve `cpu-turn-handler.js` → `cpu-turn-handler.ts` via moduleNameMapper.

---

## Failure 9 — `test/ui.bootstrap-shared.test.ts`

**Category:** DI_ERROR, LOGIC_ERROR

**Line 1637:**
```
Expected: { "setBusyState": [Function mockConstructor] }
Received: { "abortPlayback": [Function], "armBoardUpdateContext": [Function], ... (43 methods) }
> 33 | expect(shared.resolvePlaybackStateManager()).toBe(playbackStateMock);
```
The `jest.doMock()` for `ui/playback-runtime.js` is not taking effect. The shared module resolves the real module (with 43 exported functions) instead of the mock (with 1 function).

**Root Cause:** `jest.doMock` with `{ virtual: false }` may be resolving the path differently, or the module has already been loaded before the mock is applied. The shared module imports playback-runtime at the top level, so `doMock` may run too late.

**Priority:** P1
**Recommended Fix:** Use `jest.mock()` at module top level instead of `jest.doMock()` inside the test, or use `require.cache` manipulation to ensure the mock takes effect before the shared module is loaded.

---

## Failure 10 — `test/game.board-expansion-will.test.ts`

**Category:** LOGIC_ERROR

**Line 1655:**
```
Expected: true
Received: false
> 25 | expect(used).toBe(true);  // CardLogic.applyCardUsage(...)
```
`applyCardUsage` returns false. The card usage logic may require state that is not set up.

**Line 1672:**
```
Expected: true
Received: false
> 51 | expect(first && first.applied).toBe(true);  // CardLogic.applyBoardExpansionWill(...)
```
`applyBoardExpansionWill` returns falsy.

**Line 1688:**
```
Expected: ArrayContaining [{"col": -1, "row": 5}]
Received: []
> 222 | expect(targets).toEqual(expect.arrayContaining([{ row: 5, col: -1 }]));
```
`getSelectableTargets` returns empty array. Expansion cell (-1) not considered selectable.

**Line 1705:**
```
Expected: true
Received: false
> 390 | expect(will && will.applied).toBe(true);
```
Another `applyBoardExpansionWill` call returns falsy.

**Root Cause:** The `CardLogic` API surface or internal logic for board expansion has changed. Functions either require different arguments or return different shapes.

**Priority:** P1
**Recommended Fix:** Audit `game/logic/cards.ts` (or the module that `CardLogic` imports) for `applyCardUsage`, `applyBoardExpansionWill`, `getSelectableTargets` signatures. Update test to match current API.

---

## Failure 11 — `test/workers.match-publish-sanitize.test.ts`

**Category:** LOGIC_ERROR

**Line 1722:**
```
Expected: null
Received: {"cardId": "guardian_card", "stage": "selectTarget", "type": "GUARDIAN_GOD"}
> 1119 | expect(result.afterGuard.cardState.pendingEffectByPlayer.black).toBeNull();
```
After time stop + guardian selection, `pendingEffectByPlayer.black` is not cleared — it still holds a `GUARDIAN_GOD` pending effect.

**Priority:** P1
**Recommended Fix:** Investigate the time stop → guardian → pass hand-off flow. The pending effect should be consumed/resolved after guardian selection, not left dangling.

---

## Failure 12 — `test/load-training-profile.sync.test.ts`

**Category:** LOGIC_ERROR

**Line 1740:**
```
Expected: "0.95"
Received: null
> 94 | expect(getFlagValue(args, '--selfplay-tactical-weight-min')).toBe(String(teacher.tacticalWeightMin));
```
`getFlagValue` returns `null` for `--selfplay-tactical-weight-min`. The flag was not included in the generated args.

**Line 1765:**
```
Expected: { desired: 'promoted-only', active: 'promoted-only', status: 'preserved-explicit' }
Received: { desired: null, active: 'promoted-only', status: 'source-missing' }
> 485 | expect(resolved.sharedTeacherSync.guideMode).toMatchObject({...});
```
The guide mode resolution returns `desired: null` (expected `'promoted-only'`) and `status: 'source-missing'` (expected `'preserved-explicit'`). The teacher profile source is not found.

**Root Cause:** The shared teacher profile JSON does not contain `tacticalWeightMin`, or the path resolution to find the profile file is broken.

**Priority:** P1
**Recommended Fix:** Verify teacher profile JSON schema includes all expected fields. Check file path resolution in `load-training-profile.sync.ts` helper.

---

## Failure 13 — `test/ui.network-client.publish-base-version.test.ts`

**Category:** LOGIC_ERROR

**Line 1782:**
```
Expected: 11
Received: 10
> 224 | expect(client.getStateVersion()).toBe(11);
```
State version is 1 less than expected. A state-incrementing step may have been skipped.

**Lines 1800, 1816:**
```
Expected number of calls: 1
Received number of calls: 0
> 508 | expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledWith(...);
> 598 | expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledTimes(1);
```
`emitPresentationEvent` was never called during publish. The `BoardOps` mock is set up but presentation events are not emitted during the publish flow.

**Priority:** P1
**Recommended Fix:** Check that `emitPresentationEvent` is wired into the publish pipeline. Verify state version accounting in `publishSnapshot`.

---

## Failure 14 — `test/ui.network-client.snapshot-effect-logs.test.ts`

**Category:** LOGIC_ERROR

**Line 1847:**
```
Expected: [['...', 'effect'], ['...', 'effect']]
Received: []
> 180 | expect(global.emitLogAdded.mock.calls).toEqual([...]);
```
Effect log entries are not emitted during snapshot application.

**Line 1864:**
```
Expected: emitLogAdded to be called with [...]
Number of calls: 0
> 209 | expect(global.emitLogAdded).toHaveBeenCalledWith('...', 'effect');
```
`emitLogAdded` is a jest mock but was never called.

**Priority:** P1
**Recommended Fix:** Check that `emitLogAdded` is properly assigned to `global` before tests run. Verify that remote snapshot processing calls the effect-log channel.

---

## Failure 15 — `test/ui.network-client.reconnect-sync.test.ts`

**Category:** LOGIC_ERROR

**Multiple sub-failures across lines 1884–2000:**

| Line | Expected | Received | Description |
|------|----------|----------|-------------|
| 1884 | `board.toHaveLength(7)` | `undefined` | `global.gameState.board` undefined — snapshot not applied correctly |
| 1907 | `appliedSnapshot: true` | `appliedSnapshot: false` | `syncLatestState` did not apply snapshot |
| 1924 | `emitPresentationEvent` called 1x | 0 calls | Presentation not emitted during sync |
| 1941 | `turnNumber: 2` | `turnNumber: 1` | Missed state update |
| 1962 | `appliedSnapshot: true` | `appliedSnapshot: false` | Pending publish snapshot not applied |
| 1985 | `appliedSnapshot: true` | `appliedSnapshot: false` | Force sync snapshot not applied |
| 2000 | `null` | `<div id="result-overlay" />` | Result overlay not cleaned up |

**Root Cause:** The snapshot application logic (`syncLatestState`, `applySnapshot`) appears to short-circuit or skip application. `emitPresentationEvent` is not wired into the snapshot flow. The result overlay element persists in DOM across tests (leak).

**Priority:** P1
**Recommended Fix:** Audit `syncLatestState` return value logic — `appliedSnapshot: false` suggests a guard condition fails. Fix board state restoration in snapshot application. Add DOM cleanup in `afterEach`.

---

## Failure 16 — `test/ui.network-client.server-url.test.ts`

**Category:** LOGIC_ERROR

**Line 2018:**
```
Expected: "https://card.othello.workers.dev"
Received: "http://127.0.0.1:8787"
> 33 | expect(client.getServerUrl()).toBe('https://card.othello.workers.dev');
```
On a deployed HTTPS page, the test expects the server URL to resolve to the production worker URL. Instead, it keeps the persisted loopback URL.

**Priority:** P2
**Recommended Fix:** Check the URL resolution logic — when `location.hostname` is not `127.0.0.1`/`localhost`, persisted loopback URLs should be replaced with the same-origin worker URL.

---

## Failure 17 — `test/game.ultimate-hyperactive-god.test.ts`

**Category:** LOGIC_ERROR

**Line 2072:**
```
Expected: true
Received: false
> 603 | expect(targets.some(t => t.row === 3 && t.col === 3)).toBe(true);
```
`getSelectableTargets` does not include cell (3,3) after ultimate hyperactive expires and a swap is attempted.

**Priority:** P1
**Recommended Fix:** Verify that expired ultimate hyperactive markers are converted to swappable cells in `getSelectableTargets`. Check `applySwapEffect` preconditions.

---

## CRASH — `test/cpu.turn-handler.onnx-hold.test.ts`

**Category:** CRASH (process-terminating)

**Line 2080–2088 (pass-handler.js:347 → cpu.turn-handler.onnx-hold.test.ts:230):**
```
Error: TurnPipeline is not available - cannot process pass
    at applyPassViaPipeline (game/pass-handler.js:347:13)
    at processPassTurn (game/pass-handler.js:549:20)
    at runCpuTurn (game/cpu-turn-handler.ts:1592:17)
    at test/cpu.turn-handler.onnx-hold.test.ts:230:9
```
When `runCpuTurn('white')` is called with no legal moves and no card to use, the pass handler tries to apply a pass via `TurnPipeline`, but `TurnPipeline` is `undefined` (not registered in the test environment).

**Impact:** This **terminates the entire Jest process**. Tests listed after this point in the run order never execute. The following test files were likely skipped:

- `test/cpu.turn-handler.*.test.ts` (several)
- `test/game.pass-handler.test.ts`
- `test/game.cards-internal.*.test.ts`
- Many more

**Priority:** P0
**Recommended Fix:** Either (a) register a mock `TurnPipeline` in the test environment's module registry, or (b) make `applyPassViaPipeline` throw a catchable error instead of an unhandled exception. The pass handler should degrade gracefully when `TurnPipeline` is not available (e.g., fall back to a simple state transition).

---

## Priority Distribution

| Priority | Count | Criteria |
|----------|-------|----------|
| **P0** | 2 | Crash that terminates test suite; massive API mismatch blocking 60+ subtests |
| **P1** | 10 | Logic/import errors in unit tests; correctable with targeted fixes |
| **P2** | 5 | E2E timeouts; likely flaky infrastructure rather than logic bugs |

---

## Recommended Fix Order

1. **P0 — CRASH:** `cpu.turn-handler.onnx-hold.test.ts` — Make pass handler degrade gracefully when TurnPipeline is unavailable
2. **P0 — IMPORT_ERROR:** `game.cpu-policy-core.test.ts` — Fix module exports or update test imports
3. **P1 — IMPORT_ERROR:** `game.cpuhandler.registration.test.ts` — Fix CJS → TS resolution
4. **P1 — DI_ERROR:** `ui.bootstrap-shared.test.ts` — Fix mock isolation
5. **P1 — LOGIC_ERROR:** Remaining unit tests (`board-expansion-will`, `match-publish-sanitize`, `load-training-profile`, `network-client.*`, `ultimate-hyperactive-god`)
6. **P2 — TIMEOUT:** E2E tests (fix module preload/bootstrap)

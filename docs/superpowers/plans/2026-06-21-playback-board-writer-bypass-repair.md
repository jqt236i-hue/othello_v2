# Playback Board Writer Bypass Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** 破壊・移動・変換系のカード演出中に、最終盤面が先に board DOM へ描画されて対象石が「消える → 演出のために再出現する → 消える」と見える問題を全体修復する。狙撃の意志、究極反転龍、破壊龍、落雷、UDG、意志狩りの王など、カード個別ではなく board playback の Single Visual Writer 境界を直す。

**Architecture:** canonical game state と network snapshot は先行更新されてよいが、`PLAYBACK_EVENTS` 再生中または playback claim 中の board DOM 書き込みは animation/presentation 側だけに限定する。`allowBoardUpdateDuringPlayback` と `ignorePlayback` は canonical/network 同期を進めるためのメタ情報に縮退させ、final board DOM の先行描画を許可する意味をなくす。final board sync は playback 完了後の既存 board update 経路へ戻す。

**Tech Stack:** TypeScript, browser UI modules, Jest, existing Playwright/static-server verification scripts.

---

## Execution Result

Completed on 2026-06-21.

- Board renderer, diff renderer, render scheduler, network timeline refresh, snapshot refresh, bootstrap bridge, and pending-selection bridge no longer use `allowBoardUpdateDuringPlayback` or `ignorePlayback` as board DOM write permission during playback.
- Final board sync is deferred until playback is idle, with pending move/flip context preserved for the eventual diff render.
- Added browser-level regression coverage via `npm run match:playback-board-writer-check`.
- Updated focused Jest coverage for renderer, scheduler, network timeline/snapshot, move-source, hyperactive/究極反転龍-family source sync, and selection no-playback sync.
- Ran focused Jest, network parity, typecheck, build, worker prepare, Chrome browser writer check, and Chrome/Edge network turn-start check.

---

## Root Cause To Fix

現時点の本質的な穴は `PresentationHandler` の claim だけではない。`BOARD_UPDATED` や network/snapshot/timeline refresh 経路に、playback 中でも board DOM を直接または scheduler 経由で書ける escape hatch が残っている。

Primary bypasses:

- `ui/board-renderer.ts`: `renderBoard`, `renderBoardFull`, legacy full render が `allowBoardUpdateDuringPlayback === true` のとき `_shouldSkipBoardRenderForPlayback()` を迂回する。
- `ui/diff-renderer.ts`: `renderBoardDiff` が playback active/claimed/pending でも `allowBoardUpdateDuringPlayback === true` なら diff DOM 書き込みへ進む。
- `ui/render-scheduler.ts`: `flushVisualUpdates({ ignorePlayback: true })` が `PlaybackStateManager.shouldDeferUiSync()` を迂回する。
- `ui/network-client.ts`: `requestNetworkTimelineBoardRefresh()` が `allowBoardUpdateDuringPlayback` と `ignorePlayback` を使い、timeline 中に final board refresh を強制できる。
- `ui/network/snapshot.ts` and `ui/bootstrap.ts`: snapshot/bridge 経由でも同じ bypass を arm できる。

This explains the observed sequence:

1. canonical state or network snapshot already contains the post-destroy empty square.
2. forced board refresh writes that final state to DOM while playback events are still pending or claimed.
3. target stone disappears before its destroy animation.
4. animation/presentation recreates or ghosts the target to play the special destroy effect.
5. final sync removes it again.

The fix must remove board DOM write bypasses during playback, not patch individual cards.

---

## File Map

- `ui/board-renderer.ts`: top-level board render guard. It must refuse board DOM writes during playback regardless of `allowBoardUpdateDuringPlayback`.
- `ui/diff-renderer.ts`: diff writer guard. It must refuse DOM diff writes during playback regardless of `allowBoardUpdateDuringPlayback`.
- `ui/render-scheduler.ts`: queued visual flush semantics. It must not let `ignorePlayback` force board DOM rendering while playback deferral is true.
- `ui/network-client.ts`: timeline catch-up refresh. It must request deferred board sync instead of forcing immediate final board DOM writes.
- `ui/network/snapshot.ts`: snapshot application. It must not arm a board DOM write permission while playback is active or pending.
- `ui/bootstrap.ts`: bridge exposure. `armBoardUpdateDuringPlayback` must no longer mean "allow board DOM write during playback".
- `game/card-effects/selection-flow.ts`: selection no-playback sync user. Verify it still works because no playback events means normal board render is not blocked.
- `docs/architecture-contracts.md`: Single Visual Writer contract. Add an explicit ban on board DOM write escape hatches during playback.
- `test/ui.board-renderer.fallback-legal-hint.test.ts`: characterization and renderer regression coverage.
- `test/ui.render-scheduler.test.ts`: scheduler regression coverage.
- `test/ui.network-client.visual-catchup.test.ts`: network timeline regression coverage.
- `test/ui.network-snapshot.single-writer-baseline.test.ts`: snapshot single-writer regression coverage.
- `test/ui.presentation-handler.playback-claim.test.ts`: keep previous claim coverage in the focused run.
- `test/ui.playback-state-manager.test.ts`: keep previous deferral/claim coverage in the focused run.

---

## Implementation Tasks

### 1. Add failing characterization tests for the board writer bypass

- [x] In `test/ui.board-renderer.fallback-legal-hint.test.ts`, replace the current expectation that `renderBoard` honors `allowBoardUpdateDuringPlayback` during playback with the corrected expectation.
- [x] Add a test where `PlaybackStateManager.shouldDeferBoardUpdate()` returns true and `BoardUpdateSyncRuntime.armBoardUpdateSyncContext({ allowBoardUpdateDuringPlayback: true })` is active. Assert `renderBoard()` does not call the board diff writer and leaves existing DOM unchanged.
- [x] Add a test where persisted `PLAYBACK_EVENTS` are present and `renderBoardFull()` is called under an active `allowBoardUpdateDuringPlayback` context. Assert legacy/full board DOM replacement is skipped.
- [x] Add a direct `renderBoardDiff` test or adjacent focused test proving playback active/claimed/pending returns without DOM mutation even when `allowBoardUpdateDuringPlayback` is true.
- [x] Run:

```powershell
npx jest --runInBand test/ui.board-renderer.fallback-legal-hint.test.ts -t "allowBoardUpdateDuringPlayback"
```

- [x] Confirm the new/updated tests fail on the current implementation for the expected reason: board DOM writes are still allowed by the bypass.

### 2. Remove playback-time board DOM bypasses from renderer and diff writer

- [x] In `ui/board-renderer.ts`, change the early playback guard so `allowBoardUpdateDuringPlayback` cannot bypass `_shouldSkipBoardRenderForPlayback()` for board DOM writes.
- [x] Keep `allowBoardUpdateDuringPlayback` readable as metadata only after the playback guard has allowed rendering. Do not remove context consumption in a way that breaks diagnostic/source attribution.
- [x] In `ui/diff-renderer.ts`, remove the `!allowBoardUpdateDuringPlayback` condition from the playback skip path. If playback is active, claimed, or has pending persisted `PLAYBACK_EVENTS`, return without writing board DOM.
- [x] Preserve final board rendering after playback is idle. The fix must defer the final DOM sync, not drop it.
- [x] Run:

```powershell
npx jest --runInBand test/ui.board-renderer.fallback-legal-hint.test.ts
```

- [x] Confirm the characterization tests now pass and existing legal-hint/fallback behavior still passes.

### 3. Narrow `ignorePlayback` so it cannot force board DOM rendering

- [x] In `ui/render-scheduler.ts`, split the semantics of visual flushing:
  - non-board UI flushes may still use the existing urgent path when needed;
  - board render queue flushing must still respect `PlaybackStateManager.shouldDeferUiSync()` or an equivalent board-specific deferral check.
- [x] If keeping the option name `ignorePlayback`, document in code that it does not bypass board DOM playback deferral.
- [x] Prefer a small internal helper such as `shouldDeferBoardFlush(options)` over broad branching inside `flushNow`.
- [x] Update `test/ui.render-scheduler.test.ts` so `flushNow({ ignorePlayback: true })` no longer renders a queued board while playback deferral is true.
- [x] Add or update a companion assertion showing the queued board render is still flushed after playback deferral becomes false.
- [x] Run:

```powershell
npx jest --runInBand test/ui.render-scheduler.test.ts
```

### 4. Stop network timeline catch-up from forcing immediate final board DOM writes

- [x] In `ui/network-client.ts`, update `requestNetworkTimelineBoardRefresh()` so it requests normal board rendering instead of arming `allowBoardUpdateDuringPlayback` for DOM writes.
- [x] Remove or gate `flushVisualUpdates({ ignorePlayback: true })` so it cannot flush board DOM while timeline playback is active, claimed, or pending.
- [x] For `presentation_timeline_drained`, allow direct final board render only after playback deferral is false. Otherwise, queue the render and let the normal idle path flush it.
- [x] Preserve status/hand/non-board visual catch-up behavior if it does not write board cells.
- [x] Update `test/ui.network-client.visual-catchup.test.ts` so active playback causes board refresh to be queued/deferred, not forced.
- [x] Add an assertion that a timeline-drained refresh eventually performs exactly one final board sync after playback is idle.
- [x] Run:

```powershell
npx jest --runInBand test/ui.network-client.visual-catchup.test.ts
```

### 5. Remove snapshot and bridge board-write permission semantics

- [x] In `ui/network/snapshot.ts`, stop using `BoardUpdateSyncRuntime.armBoardUpdateSyncContext({ allowBoardUpdateDuringPlayback: true })` as board DOM permission for snapshot application.
- [x] Keep canonical snapshot application and local runtime state reconciliation intact. Only the board DOM write must defer.
- [x] In `ui/bootstrap.ts`, change the `armBoardUpdateDuringPlayback` bridge so existing callers cannot grant board DOM write permission during playback. The bridge may remain as a compatibility wrapper that records source/reason metadata without altering playback deferral.
- [x] Inspect `game/card-effects/selection-flow.ts` usage. Because that path only requests sync when no playback events exist, it should continue to render normally without any special bypass.
- [x] Update `test/ui.network-snapshot.single-writer-baseline.test.ts` to assert snapshot refresh cannot mutate board DOM during playback even when the bridge/context was armed.
- [x] If needed, update the pending-selection focused test so no-playback selection state sync still renders.
- [x] Run:

```powershell
npx jest --runInBand test/ui.network-snapshot.single-writer-baseline.test.ts test/game.pending-selection-flow.test.ts
```

### 6. Add browser-level regression coverage for "no pre-removal before destroy playback"

- [x] Extend `scripts/network-turn-start-browser-check.ts` or add `scripts/playback-board-writer-browser-check.ts` using the existing local static server and Playwright pattern.
- [x] The browser check must create or reach a scenario with a target stone that will be destroyed by playback events, then hold or observe playback while a board refresh request is issued.
- [x] Install a `MutationObserver` on the board cell for the target square and record:
  - first time the target disappears from DOM;
  - first destroy/special effect playback marker;
  - final board idle/sync marker.
- [x] Assert the target does not disappear before the destroy playback marker.
- [x] Cover at least one local deterministic destroy case and one network/timeline-style refresh case. Use a direct harness if full card setup would make the check flaky.
- [x] If a new script is added, wire a narrow npm script name such as `match:playback-board-writer-check`.
- [x] Run the browser check locally and record the command in the final implementation report.

### 7. Update the architecture contract

- [x] In `docs/architecture-contracts.md`, under the Single Visual Writer section, add an explicit rule:
  - playback active/claimed/pending means only animation/presentation playback may write board cells;
  - network/snapshot/canonical refresh may update model state but must queue final board DOM sync;
  - `allowBoardUpdateDuringPlayback`, `ignorePlayback`, and similar flags must not grant board DOM write permission.
- [x] Keep this as a contract clarification for the existing intended behavior. Do not change `01-rulebook.md` unless the implementation changes player-facing rules or card text.
- [x] Run a diff inspection for the documentation change.

### 8. Run focused verification and generated-surface checks

- [x] Run the focused Jest set:

```powershell
npx jest --runInBand test/ui.board-renderer.fallback-legal-hint.test.ts test/ui.render-scheduler.test.ts test/ui.network-client.visual-catchup.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.presentation-handler.playback-claim.test.ts test/ui.playback-state-manager.test.ts
```

- [x] Run TypeScript/build checks:

```powershell
npm run build:ts
npm run typecheck
```

- [x] Run browser/network playback checks:

```powershell
npm run match:turnstart-browser-check
```

- [x] If Task 6 adds a new npm script, run it:

```powershell
npm run match:playback-board-writer-check
```

- [x] Run network parity because this fix touches network snapshot/timeline refresh boundaries:

```powershell
npm run test:network:parity
```

- [x] If build or module registry output changes, run:

```powershell
npm run worker:prepare
```

- [x] Inspect generated and mirror diffs. Include only files intentionally produced by the source changes and existing generation scripts.

---

## Manual Acceptance Scenarios

- [x] 狙撃の意志: destroy target must remain visible until its destroy/special animation begins, then disappear once as part of playback/final sync.
- [x] 究極反転龍: target stones must not be pre-removed by a board refresh before the unique effect begins.
- [x] 破壊龍: destroyed stone must not flicker from final board pre-render.
- [x] 落雷: multi-target destruction must not show empty cells before effect playback.
- [x] UDG: move/convert/destroy combination must not get final-board prepaint before playback.
- [x] 意志狩りの王: selection/result playback must not be overwritten by snapshot or timeline catch-up.
- [x] Network match: remote snapshot reconciliation must update canonical state without visually prepainting the board during local playback.

---

## Self-Review Checklist

- [x] No card-specific conditional fixes were added for 狙撃の意志, 究極反転龍, or any single card.
- [x] No `game/`, `shared/`, or pure card logic file gained DOM, `window`, timer, sound, or network dependencies.
- [x] All board DOM write paths respect the same playback deferral decision.
- [x] `allowBoardUpdateDuringPlayback` no longer means board DOM write permission.
- [x] `ignorePlayback` no longer forces board DOM rendering while playback is active, claimed, or pending.
- [x] Final board sync still happens after playback idle.
- [x] Selection no-playback sync still renders normally.
- [x] Network snapshot/timeline catch-up still reconciles canonical state and remote state.
- [x] Tests fail before the fix and pass after the fix for the corrected behavior.
- [x] Manual/browser checks prove the target stone is not removed before its destroy playback starts.
- [x] Generated/mirror files are produced by scripts only, not hand-edited.

---

## Expected Outcome

After this plan is implemented, canonical state can still settle early, but the board DOM will not show the settled empty/converted/moved squares until playback has reached the correct visual moment. The visible double transition should disappear across all cards that rely on playback events, because the fix removes the shared board writer bypass instead of adding card-local timing patches.

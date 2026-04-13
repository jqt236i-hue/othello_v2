# Master Plan Contract Audit — Hidden Omissions Report

**Target Document**: `docs/game-logic-cpu-turn-refactor-master-plan-2026-03-26.md`  
**Audit Date**: 2026-03-26  
**Auditor**: Deep Contract Analysis (Retry Execution)

---

## Executive Summary

This audit identifies **8 critical contract omissions** and **12 behavioral drift risks** in the master plan that could lead to silent regression during the refactor. The plan covers events[] ordering and Spec B mentions but **misses explicit contracts** for: Single Visual Writer lock enforcement, pending lifecycle completion semantics, CPU commentary injection points, selfplay/browser RNG parity, network snapshot pending state, and worker-public script load order boundary.

**Priority**: 🔴 High — 4 findings require immediate plan amendments before Phase 1 execution.

---

## 1. MISSING CONTRACTS / INVARIANTS

### 🔴 1.1 Single Visual Writer Lock Enforcement

**What's Missing**: The plan mentions "Single Visual Writer" (line 58, 379) but **never specifies the lock mechanism** that prevents concurrent DOM writes during `events[]` playback.

**Actual Contract** (from `ui/animation-engine.js` + `ui/board-renderer.js`):
```javascript
// animation-engine.js line 1181, 1427
PlaybackStateManager.setPlaybackActive(true);  // LOCK acquired
// ... AnimationEngine.play() executes ...
PlaybackStateManager.setPlaybackActive(false); // LOCK released

// board-renderer.js line 92-94
if (_shouldSkipBoardRenderForPlayback()) {
    return;  // Enforces exclusive DOM access
}
```

**Drift Risk**: If Phase 1/3 moves presentation code into new modules **without preserving `setPlaybackActive()` calls**, board-renderer.js will continue writing during playback → **visual corruption**.

**Plan Amendments Needed**:
1. **Phase 1** completion condition: Add "Verify all presentation-emitting paths call `setPlaybackActive(true)` before events[] and `setPlaybackActive(false)` after."
2. **Phase 4** (line 413): Add validation step "Check that no new direct `emitBoardUpdate()` calls bypass playback lock."
3. **Section 5.3** (events[] order risk, line 487): Add note "Playback lock must wrap entire events[] batch; splitting events across modules risks lock fragmentation."

**Confidence**: 🔴 95% — This lock is **structurally critical** to Single Visual Writer. Plan must call it out.

---

### 🔴 1.2 Pending Selection Lifecycle Completion Semantics

**What's Missing**: The plan mentions `pending-state-manager.js` (line 71, 110, 198, 303) but **never documents the completion contract**: when does `stage: 'selectTarget'` transition to `null`? What happens if pending is abandoned at pass?

**Actual Contract** (from `game/logic/cards-internal/pending-state-manager.js` + `01-rulebook.md` line 296-298):
```javascript
// Completion conditions:
1. selectTarget() completes normally → pending.stage = null (implicit in turn-pipeline)
2. cancelPendingSelection() called → pending cleared + card refunded
3. PASS while pending unresolved → pending discarded WITHOUT refund (rulebook line 58, 298)

// TRAP_WILL exception (rulebook line 296):
// selectTarget() completion = hand turn end (no placement phase)
```

**Drift Risk**: Phase 2's `cpu-action-builder.js` extraction might duplicate pending completion logic → **double-clear or orphaned pending state**.

**Plan Amendments Needed**:
1. **Phase 1 completion condition** (line 295-299): Add "Verify `cancelPendingSelection()` refund semantics unchanged; check pass-with-pending test coverage."
2. **Phase 2 作業** (line 326): Add "Confirm `game/turn-handlers/pending-target-selector.js` remains single source of truth for pending lifecycle; action builders only call selectors, never mutate pending state."
3. **Section 5.2** (pending state risk, line 481): Change "各スライス後に pending-state-manager-module.test.js" → "各スライス後に pending-state-manager-module.test.js + **pass-with-pending-abandon e2e test**."

**Confidence**: 🔴 90% — Pending lifecycle is **stateful and error-prone**; plan must surface it.

---

### 🟡 1.3 Spec B Flip Timing: Mid-Flip Visual Swap

**What's Missing**: The plan says "Spec B フリップ演出" (line 58, 379, 487) but **doesn't specify the timing contract**: visual swap must occur at **EXACTLY FLIP_MS/2** (200ms into 400ms animation).

**Actual Contract** (from `ui/animation-engine.js` line 1866-1867):
```javascript
await this._sleep(FLIP_MS / 2);      // Wait 200ms
this.syncDiscVisual(disc, after);    // Swap to final visual at midpoint
await this._sleep(FLIP_MS / 2);      // Complete flip
```

**Drift Risk**: If Phase 3's events[] reorganization **changes flip event batching**, the timing might slip → flips complete before visual swap → **visible color glitch**.

**Plan Amendments Needed**:
1. **Phase 3 作業スライス3** (line 378-379): Change "events[] の順序は `01-rulebook.md` の Spec B" → "events[] の順序は `01-rulebook.md` の Spec B (特に flip は FLIP_MS/2 タイミングで visual swap が必須)。"
2. **検証束** (line 401): Add test "Execute `game.pipeline-ui-adapter.flip-visual-timing.test.js` (if exists) or manual check: flip visual swap at 200ms."

**Confidence**: 🟡 75% — Timing is **implementation detail**, but critical for Spec B compliance.

---

### 🟡 1.4 CPU Commentary Non-Blocking Contract

**What's Missing**: The plan mentions `cpu-commentary-runtime.js` (line 135, 351, 505, 569) but **never states the determinism contract**: commentary failures **must not block turn execution**.

**Actual Contract** (from `game/cpu-turn-handler.js` line 178):
```javascript
// "Ignore commentary failures to keep turn processing deterministic"
runtime.requestCommentary(context).catch(() => { /* silent */ });
```

**Drift Risk**: Phase 2's `cpu-action-builder.js` might introduce **synchronous commentary calls** → blocking CPU turn on commentary latency.

**Plan Amendments Needed**:
1. **Section 5.6** (new risk entry after line 507): "**CPU commentary 同期化リスク**: Phase 2 で action builder が commentary を同期実行すると、CPU ターンがブロックする。**対策**: commentary は常に Promise.catch で非同期化し、failure は無視する契約を維持。"
2. **Phase 2 完了条件** (line 343-347): Add "Commentary calls remain async; CPU turn tests complete without commentary runtime loaded."

**Confidence**: 🟡 70% — Commentary is **optional feature**; plan should clarify non-critical status.

---

### 🟢 1.5 Selfplay vs Browser RNG Injection Parity

**What's Missing**: The plan mentions `selfplay-runner.js` (line 42, 346, 499) but **never documents RNG parity**: selfplay and browser **must use identical RNG injection** for deterministic replay.

**Actual Contract** (from `game/cpu-decision.js` + `src/engine/selfplay-runner.js`):
```javascript
// Both call: CpuDecision.setCpuRng(rng)
// Browser: window.rng_impl or default Math.random
// Selfplay: seeded RNG (src/engine/selfplay-runner.js line 50-60)
```

**Drift Risk**: Phase 2's RNG handling in `cpu-action-builder.js` might **bypass `setCpuRng()`** → selfplay diverges from browser.

**Plan Amendments Needed**:
1. **Phase 2 作業** (line 330): Add "RNG injection point (`setCpuRng`) must remain in cpu-decision.js hub; action builder accesses RNG via public API only."
2. **検証束** (line 351): Add "Run `selfplay.runner.test.js` with seeded RNG; verify identical action sequence vs browser replay."

**Confidence**: 🟢 65% — RNG parity is **testable**; existing tests likely cover it.

---

### 🟢 1.6 Network Snapshot Pending State Serialization

**What's Missing**: The plan never mentions **network snapshot** handling of `pending` state during reconnect. If Phase 1/2 changes pending shape, network sync breaks.

**Actual Contract** (from `ui/network/snapshot.js` + `workers/match-worker.mjs`):
```javascript
// Snapshot includes: cardState.pending (serialized to JSON)
// Reconnect restores: cardState.pending (deserialize + validate)
```

**Drift Risk**: Phase 1 changes to `pending-state-manager.js` might **alter pending shape** → old snapshots incompatible → reconnect fails.

**Plan Amendments Needed**:
1. **Phase 1 完了条件** (line 295-299): Add "Network snapshot tests pass; pending serialization/deserialization unchanged."
2. **検証束** (line 303): Add test pattern "ui.network-snapshot.pending-*.test.js" (if exists).

**Confidence**: 🟢 60% — Network is **orthogonal** to refactor; likely already tested.

---

### 🟡 1.7 Worker-Public Script Load Order Boundary

**What's Missing**: The plan mentions `worker-public/` sync (line 43, 252, 299, 491) but **never specifies which modules are worker-visible** and their load order constraints.

**Actual Contract** (from `scripts/prepare-worker-assets.js` + `worker-public/index.html`):
```javascript
// worker-public includes:
// - game/logic/cards.js
// - game/cpu-decision.js
// - game/turn/turn_pipeline*.js
// - game/ai/*.js
// - shared/*.js
// Load order: shared → game/logic → game/turn → game/ai
```

**Drift Risk**: Phase 1/2 adds new modules to browser `index.html` but **forgets to add to `scripts/prepare-worker-assets.js`** → worker crashes.

**Plan Amendments Needed**:
1. **Section 5.4** (worker-public sync, line 491-495): Add "New modules added to `index.html` must also be added to `scripts/prepare-worker-assets.js` include list. Worker load order must match browser order."
2. **Phase 1/2/3 完了条件**: Add "Verify worker-public script order matches root; run `test/index.local-script-paths.test.js` for worker."

**Confidence**: 🟡 75% — Script sync is **mechanical** but error-prone.

---

### 🟢 1.8 Events[] Order Invariant: PLAYBACK_EVENTS Type Prefix

**What's Missing**: The plan says "events[] の順序" (line 379, 396, 407) but **never specifies the type prefix contract**: certain event types (e.g., `SPAWN`, `MOVE`, `DESTROY`) must come **before** their associated `FLIP` events in the same batch.

**Actual Contract** (from `game/turn/pipeline_ui_adapter.js` + Spec B):
```javascript
// Event order within batch:
// 1. SPAWN / MOVE / DESTROY (state changes)
// 2. FLIP (反転 based on final state)
// 3. CHARGE_UPDATE (布石差分)

// Violation → flip animates before spawn completes → visual glitch
```

**Drift Risk**: Phase 3's turn_pipeline_phases.js delegation might **reorder event emission** → flips fire before spawns.

**Plan Amendments Needed**:
1. **Phase 3 作業スライス3** (line 378-379): Add "Events within batch must follow order: SPAWN/MOVE/DESTROY → FLIP → CHARGE_UPDATE. Phase helpers must preserve this."
2. **検証束** (line 401): Add "Check spawn-before-flip test: `game.pipeline-ui-adapter.spawn-flip-order.test.js` (if exists)."

**Confidence**: 🟢 60% — Event type order is **implicit** in existing tests.

---

## 2. BEHAVIORAL DRIFT RISKS

### 🔴 2.1 Presentation Double-Firing During Delegation

**Risk**: Phase 1 moves card effect logic to `game/logic/cards/*.js` but **leaves old presentation emission in cards.js** → effects fire twice (once from new module, once from old shim).

**Evidence**: Plan line 161 says "presentation 発火と状態変化が同じ関数に混在" but Phase 1 (line 276-284) doesn't mandate **removal** of old presentation calls, only delegation.

**Mitigation**:
- **Phase 1 Step 4** (line 284): Change "cards.js の各委譲元関数は `return SubModule.funcName(...)` 形式の 1 行 shim" → "cards.js の各委譲元関数は `return SubModule.funcName(...)` **のみ**とし、元の presentation 発火ロジックは**削除**する。"
- **検証束** (line 303): Add "Run presentation double-fire detector: check for duplicate `placement_effects` / `regen_triggered` events in e2e tests."

**Confidence**: 🔴 85% — Double-fire is **documented problem** (line 161); plan must prevent recurrence.

---

### 🟡 2.2 CPU Pending Target Selector Duplication

**Risk**: Phase 2 extracts `cpuSelect*WithPolicy` to `cpu-action-builder.js` but **doesn't enforce delegation** to `game/turn-handlers/pending-target-selector.js` → new chooser logic diverges from main selector.

**Evidence**: Plan line 326 says "game/turn-handlers/pending-target-selector.js への委譲パターンを確認・統一する" but Phase 2 作業 (line 320-326) allows **action builder to reimplement** chooser logic.

**Mitigation**:
- **Phase 2 作業2** (line 326): Change "委譲パターンを確認" → "action builder は pending-target-selector.js の既存 chooser だけを呼び、**新しい chooser ロジックを追加しない**。"
- **完了条件** (line 343-347): Add "All 26 pending target types route through `PendingTargetSelector` methods; no inline chooser logic in action builder."

**Confidence**: 🟡 75% — Duplication is **likely** if plan allows "新規作成" without constraints.

---

### 🟡 2.3 Turn Pipeline Phase Anchor Effect Timing Drift

**Risk**: Phase 3 delegates anchor effects (dragon, breeding, UDG, sniper, lightning, will_hunter_king) to modules, but **load order changes** cause turn-start effects to fire in different sequence.

**Evidence**: Plan line 369-370 says "既存の delegation module を活用" but doesn't specify **anchor execution order** when multiple effects trigger on same turn-start.

**Mitigation**:
- **Phase 3 作業1** (line 369-371): Add "Anchor effects must execute in `createdSeq` ascending order (per rulebook line 243). Delegation must preserve this order."
- **検証束** (line 401): Add "Run multi-anchor test: dragon + breeding + sniper on same turn; verify execution order unchanged."

**Confidence**: 🟡 70% — Anchor order is **rulebook requirement** (line 243); likely already tested.

---

### 🟢 2.4 Classic Script Load Order Breakage

**Risk**: Phase 1/3 adds new `game/logic/cards/*.js` modules but **inserts them AFTER cards.js in index.html** → cards.js can't reference them → runtime error.

**Evidence**: Plan mentions load order (line 102, 146, 285, 382) but **never specifies insertion point** for new modules.

**Mitigation**:
- **Phase 1 作業5** (line 285): Change "`index.html` と `worker-public/index.html` に script を追加" → "**`game/logic/cards.js` より前**の適切な位置に script を追加し、cards.js から参照可能にする。"
- **検証束** (line 303): Existing test `index.card-module-scripts.test.js` likely covers this.

**Confidence**: 🟢 80% — Load order test exists; risk is **mechanical error**.

---

### 🟢 2.5 Hyperactive Inherit Will Marker Shape Divergence

**Risk**: Phase 1 moves `applyHyperactiveInheritWill` but **doesn't document marker payload contract**: `remainingOwnerTurns`, `flipEvadeRemaining`, `destroyEvadeRemaining`, `hyperactiveSeq` must all be preserved.

**Evidence**: Plan line 78 mentions "marker payload には ... が揃って入り" but Phase 1 作業 (line 281) doesn't mandate **contract validation**.

**Mitigation**:
- **Phase 1 完了条件** (line 295-299): Add "Inherited hyperactive marker shape unchanged; UI tests for timer display pass."
- **検証束** (line 303): Existing tests cover this: `ui.animation-engine.inherited-hyperactive-timer.test.js`, `ui.network-snapshot.hyperactive-source-empty.test.js`.

**Confidence**: 🟢 85% — Tests exist; plan should **cite them explicitly**.

---

### 🟢 2.6 Random Board Spawn Helper Regressions

**Risk**: Phase 1 assumes `collectRandomBoardSpawnablePositions()` / `resolveRandomBoardSpawnEffectUsage()` are complete, but **doesn't verify Equality/Salvation spawn sequence** matches `pipeline_ui_adapter.js` CARD_EFFECT_SPAWN_PROFILES contract.

**Evidence**: Plan line 78 says "ランダム盤面 spawn helper ... 共有 helper 化されている" but Phase 1 doesn't check **spawn phase timing**.

**Mitigation**:
- **Phase 1 完了条件** (line 295-299): Add "Equality/Salvation spawn sequence matches CARD_EFFECT_SPAWN_PROFILES; disappear timing unchanged."
- **検証束** (line 303): Add test pattern "game.pipeline-ui-adapter.salvation-disappear-timing.test.js" (exists per plan line 401).

**Confidence**: 🟢 75% — Test likely exists; plan should **reference it**.

---

### 🟢 2.7 CPU ONNX Gate Latency Budget Violation

**Risk**: Phase 2 reorganizes ONNX gate but **doesn't preserve latency budget checks** → ONNX calls exceed `CPU_LV6_SHARED_PROFILE.browser.onnxRuntimeGuard` thresholds → user-facing stutter.

**Evidence**: Plan line 334 mentions "ONNX gate は既存 `policy-onnx-runtime.js` と ... 経路を確認" but doesn't cite **rulebook ONNX budget** (rulebook line 1676).

**Mitigation**:
- **Phase 2 作業4** (line 333-334): Add "ONNX gate must preserve rulebook line 1676 latency budget: 平均/p95/max レイテンシ閾値と操作別予算を監視。"
- **検証束** (line 351): Add "Run Lv6 benchmark: verify ONNX latency within budget."

**Confidence**: 🟢 65% — ONNX budget is **rulebook requirement**; plan should cite it.

---

### 🟢 2.8 Observer Will Bubble Placement After Delegation

**Risk**: Phase 1/3 delegates `processObserverWillEffectsAtTurnStartAnchor` but **doesn't preserve bubble placement contract**: bubble appears **near observer stone** (rulebook line 1170), not at arbitrary position.

**Evidence**: Plan line 149, 283, 370 says "Observer ... 依然として不明瞭" but doesn't specify **bubble anchor**.

**Mitigation**:
- **Phase 1 作業3** (line 283): Add "Observer Will delegation must preserve bubble placement: `assets/images/other/OBSERVER_*.png` appears near observer stone coordinates."
- **検証束** (line 303): Add "Visual check: Observer bubble appears at correct position."

**Confidence**: 🟢 60% — Bubble placement is **UI detail**; likely working.

---

### 🟢 2.9 Time Bomb Countdown Visual Sync

**Risk**: Phase 3 delegates time bomb logic but **doesn't ensure countdown UI sync**: `remainingOwnerTurns` must update **before** countdown visual (rulebook line 441).

**Evidence**: Plan line 376 mentions `game/logic/cards/time_bomb.js` delegation but doesn't cite **countdown display contract**.

**Mitigation**:
- **Phase 3 作業2** (line 376): Add "Time bomb countdown visual must sync with `remainingOwnerTurns` decrement; UI test for countdown accuracy passes."
- **検証束** (line 401): Add "Run time bomb countdown test: verify countdown reaches 0 before explosion."

**Confidence**: 🟢 55% — Countdown is **existing feature**; likely stable.

---

### 🟢 2.10 Deck Reshuffle Cycle During Refactor

**Risk**: Phase 1 touches `hand-manager.js` (line 109, 150, 303) but **doesn't validate reshuffle cycle**: when deck empties, discard must **not** reshuffle (rulebook line 124).

**Evidence**: Plan line 150 mentions `game.cards.reshuffle-cycle.test.js` but Phase 1 doesn't mandate **running it**.

**Mitigation**:
- **Phase 1 検証束** (line 303): Change "game.cards.reshuffle-cycle" → "game.cards.reshuffle-cycle (verify no-reshuffle contract)."

**Confidence**: 🟢 80% — Test exists; plan should **mandate execution**.

---

### 🟢 2.11 Breeding Last Spawn Anchor Restoration

**Risk**: Phase 3 delegates breeding logic but **doesn't preserve anchor restoration rule**: if last-spawned stones are flipped/destroyed, next spawn reverts to **anchor stone** (rulebook line 474).

**Evidence**: Plan line 369 mentions `game/logic/cards/breeding.js` but doesn't cite **anchor restoration contract**.

**Mitigation**:
- **Phase 3 作業1** (line 369-371): Add "Breeding delegation must preserve anchor restoration: if last-spawned stones gone, next spawn returns to anchor."
- **検証束** (line 401): Add "Run breeding anchor restoration test."

**Confidence**: 🟢 70% — Breeding is **complex**; contract should be explicit.

---

### 🟢 2.12 Gold/Silver Stone Spawn During Pipeline Refactor

**Risk**: Phase 3 reorganizes turn_pipeline but **doesn't verify gold/silver stone spawn timing**: gold/silver appear **during initial 60-cell setup**, not mid-game (rulebook line 80-84).

**Evidence**: Plan never mentions gold/silver stones.

**Mitigation**:
- **Phase 3 検証束** (line 401): Add test pattern "game.gold-silver.test.js" (exists per plan line 401).

**Confidence**: 🟢 50% — Gold/silver is **edge case**; likely untouched by refactor.

---

## 3. RECOMMENDED PLAN EDITS (Concrete Diffs)

### Edit 1: Add Single Visual Writer Lock to Phase 1 Completion Conditions

**Location**: Line 295-299 (Phase 1 完了条件)

**Current**:
```markdown
**完了条件:**
- cards.js から移動した全関数が、移動先モジュールから正しくエクスポートされている。
- cards.js の各関数は移動先モジュールへの 1 行 shim になっている。
- `npm test` が Phase 0 ベースラインと同じ pass 数を維持している。
```

**Recommended**:
```markdown
**完了条件:**
- cards.js から移動した全関数が、移動先モジュールから正しくエクスポートされている。
- cards.js の各関数は移動先モジュールへの 1 行 shim になっている。
+ **Presentation 発火経路が Single Visual Writer lock を保持している**: 移動先モジュールから presentation event を返す経路は、呼び出し元が `PlaybackStateManager.setPlaybackActive()` で wrap することを確認する。
- `npm test` が Phase 0 ベースラインと同じ pass 数を維持している。
+ **Presentation 二重発火が起きていない**: cards.js の元の presentation 発火コードは削除され、委譲先モジュールのみが発火する。
```

---

### Edit 2: Add Pending Lifecycle to Phase 1 Completion Conditions

**Location**: Line 295-299 (Phase 1 完了条件)

**Current**: (same as above)

**Recommended**:
```markdown
+ **Pending 選択 lifecycle が壊れていない**: `cancelPendingSelection()` の refund semantics が変わっていない。Pass-with-pending-abandon 時に pending が破棄される挙動が維持されている。
```

---

### Edit 3: Add Spec B Timing to Phase 3 Work Slice 3

**Location**: Line 378-379 (Phase 3 作業スライス3)

**Current**:
```markdown
   - **注意**: events[] の順序は `01-rulebook.md` の Spec B フリップ演出および Single Visual Writer 要件に従う。順序を変えてはならない。
```

**Recommended**:
```markdown
   - **注意**: events[] の順序は `01-rulebook.md` の Spec B フリップ演出および Single Visual Writer 要件に従う。順序を変えてはならない。
+ **Spec B flip timing**: Flip event は `FLIP_MS/2` (200ms) で visual swap が必須。Event batching 変更時は mid-flip timing が崩れていないことを確認する。
+ **Event type prefix order**: Batch 内では SPAWN/MOVE/DESTROY → FLIP → CHARGE_UPDATE の順を保つ。
```

---

### Edit 4: Add CPU Commentary Contract to New Risk Section

**Location**: After line 507 (Section 5.6 新規追加)

**Recommended**:
```markdown
### 5.6 CPU commentary 同期化リスク

**リスク:** Phase 2 で `cpu-action-builder.js` が commentary 生成を同期実行すると、CPU ターンが commentary latency でブロックし、ユーザー体験が劣化する。現行は commentary failures を silent ignore で非同期化している (cpu-turn-handler.js line 178)。

**対策:** 
- Commentary は常に `Promise.catch()` で非同期化し、failure は無視する契約を維持する。
- Phase 2 完了時に `cpu.commentary-runtime.test.js` を実行し、commentary runtime が absent でも CPU turn が正常完了することを確認する。
- Rulebook line 1115-1116 の "ローカル発話機能は既定で無効" 契約を保つ。
```

---

### Edit 5: Add RNG Parity to Phase 2 Work

**Location**: Line 330 (Phase 2 作業3)

**Current**:
```markdown
3. **移動元 cpu-decision.js での shim 化**
   - module.exports に列挙されている全関数は shim として維持する（シグネチャを変えない）。
   - `computeCpuAction`, ..., `setCpuRng` は cpu-decision.js に直接実装を残すか、ハブとして `require` に切り替える。
```

**Recommended**:
```markdown
3. **移動元 cpu-decision.js での shim 化**
   - module.exports に列挙されている全関数は shim として維持する（シグネチャを変えない）。
   - `computeCpuAction`, ..., `setCpuRng` は cpu-decision.js に直接実装を残すか、ハブとして `require` に切り替える。
+ **RNG injection 維持**: `setCpuRng()` は cpu-decision.js hub に残し、action builder / card policy は RNG を直接参照せず公開 API 経由で取得する。Selfplay と browser の RNG parity を保つ。
```

---

### Edit 6: Add Network Snapshot to Phase 1 Completion Conditions

**Location**: Line 295-299 (Phase 1 完了条件)

**Recommended**:
```markdown
+ **Network snapshot pending 互換性**: `pending-state-manager.js` の shape 変更がある場合、snapshot serialization/deserialization が壊れていないことを確認する。`ui.network-snapshot.pending-*.test.js` (if exists) を実行する。
```

---

### Edit 7: Add Worker-Public Script Order to Section 5.4

**Location**: Line 493-495 (Section 5.4)

**Current**:
```markdown
**対策:** Phase 1 / 2 / 3 の各 phase 完了時に `npm run worker:prepare` を実行し、sync を確認してから phase 完了とする。新規作成ファイルが worker-public に含まれる必要がある場合は `scripts/prepare-worker-assets.js` を確認して include 設定を追加する。
```

**Recommended**:
```markdown
**対策:** Phase 1 / 2 / 3 の各 phase 完了時に `npm run worker:prepare` を実行し、sync を確認してから phase 完了とする。新規作成ファイルが worker-public に含まれる必要がある場合は `scripts/prepare-worker-assets.js` を確認して include 設定を追加する。
+ **Worker script load order 一致**: `worker-public/index.html` の script 順は root `index.html` の順と一致させる。`test/index.local-script-paths.test.js` を worker 側でも実行する。
```

---

### Edit 8: Add Presentation Double-Fire Prevention to Phase 1 Work Step 4

**Location**: Line 284 (Phase 1 作業4)

**Current**:
```markdown
4. cards.js の各委譲元関数は `return SubModule.funcName(...)` 形式の 1 行 shim として残し、外部 API を壊さない。
```

**Recommended**:
```markdown
4. cards.js の各委譲元関数は `return SubModule.funcName(...)` 形式の **1 行 shim のみ**として残し、**元の presentation 発火ロジックは削除する**。外部 API を壊さない。
+ **二重発火防止**: 委譲元に presentation event 組み立てコードが残っていないことを grep で確認する (例: `presentationEvents.push`, `placement_effects`).
```

---

### Edit 9: Add CPU Pending Target Delegation Mandate to Phase 2 Work 2

**Location**: Line 326 (Phase 2 作業2)

**Current**:
```markdown
   - `game/turn-handlers/pending-target-selector.js` への委譲パターンを確認・統一する。
```

**Recommended**:
```markdown
   - `game/turn-handlers/pending-target-selector.js` への**完全委譲**を確認・統一する。Action builder は `PendingTargetSelector` の既存 chooser だけを呼び、**新しい chooser ロジックを追加しない**。26 pending types すべてが `buildPendingSelectionAction()` 経由で解決されることを保証する。
```

---

### Edit 10: Add Anchor Effect Order to Phase 3 Work Slice 1

**Location**: Line 369-371 (Phase 3 作業1)

**Current**:
```markdown
   - **[一部完了済み]** 既存の `game/logic/effects/dragon.js`, ... により、dragon / breeding / ... の turn-start anchor 処理の委譲は部分的に完了している。phases.js 側が適切に委譲しているかを確認し、不足分を `game/turn/turn_pipeline_phase_helpers.js` または headless helper として補完する。
```

**Recommended**:
```markdown
   - **[一部完了済み]** 既存の `game/logic/effects/dragon.js`, ... により、dragon / breeding / ... の turn-start anchor 処理の委譲は部分的に完了している。phases.js 側が適切に委譲しているかを確認し、不足分を `game/turn/turn_pipeline_phase_helpers.js` または headless helper として補完する。
+ **Anchor 実行順の保持**: 複数 anchor が同一 turn-start で発動する場合、`createdSeq` 昇順で実行する (rulebook line 243)。Delegation 後も execution order が変わっていないことを multi-anchor test で確認する。
```

---

## 4. CONFIDENCE SCORES BY MAJOR FINDING

| Finding | Confidence | Impact if Ignored |
|---|---|---|
| 1.1 Single Visual Writer Lock | 🔴 95% | Visual corruption during playback; board-renderer race condition |
| 1.2 Pending Lifecycle Completion | 🔴 90% | Orphaned pending state; double-clear on pass; refund bugs |
| 1.3 Spec B Flip Timing | 🟡 75% | Color glitch during flip; Spec B contract violation |
| 1.4 CPU Commentary Non-Blocking | 🟡 70% | CPU turn blocked on commentary latency; user-facing stutter |
| 1.5 Selfplay RNG Parity | 🟢 65% | Selfplay diverges from browser; replay non-deterministic |
| 1.6 Network Snapshot Pending | 🟢 60% | Reconnect fails with snapshot incompatibility |
| 1.7 Worker-Public Script Order | 🟡 75% | Worker crashes on missing module reference |
| 1.8 Events[] Type Prefix Order | 🟢 60% | Visual glitch (flip before spawn) |
| 2.1 Presentation Double-Fire | 🔴 85% | Effects fire twice; presentation corruption |
| 2.2 CPU Pending Target Duplication | 🟡 75% | Divergent target selection logic; CPU behavior drift |
| 2.3 Anchor Effect Timing Drift | 🟡 70% | Turn-start effect order changes; subtle game state divergence |
| 2.4 Classic Script Load Order | 🟢 80% | Runtime error on module reference before load |

**Legend**:
- 🔴 High (80%+): Requires plan amendment before Phase 1 execution
- 🟡 Medium (60-79%): Add to completion conditions or verification bundle
- 🟢 Low (50-59%): Document for awareness; likely already tested

---

## 5. SUMMARY RECOMMENDATIONS

**Immediate Actions (Before Phase 1)**:
1. ✅ Add Single Visual Writer lock enforcement to Phase 1 completion conditions (Edit 1)
2. ✅ Add Pending lifecycle validation to Phase 1 completion conditions (Edit 2, 6)
3. ✅ Add Presentation double-fire prevention mandate to Phase 1 work (Edit 8)
4. ✅ Add CPU pending target delegation mandate to Phase 2 work (Edit 9)

**Phase-Specific Validations**:
- **Phase 1**: Run `ui.network-snapshot.hyperactive-source-empty.test.js` + pending-abandon tests
- **Phase 2**: Run `cpu.commentary-runtime.test.js` with absent commentary runtime
- **Phase 3**: Run `game.pipeline-ui-adapter.chain-flip-order.test.js` + multi-anchor tests

**Documentation Updates**:
- Add Section 5.6 "CPU commentary 同期化リスク" (Edit 4)
- Enhance Section 5.4 "worker-public 同期漏れ" with script order requirement (Edit 7)
- Add Spec B timing note to Phase 3 work slice 3 (Edit 3)

**Long-Term Monitoring**:
- After Phase 1-4 complete, run full network reconnect test suite
- After Phase 5, run extended selfplay validation (1000+ games) to detect subtle divergence

---

## AUDIT CONCLUSION

The master plan provides **solid structural boundaries** (phase gates, rollback points, verification bundles) but **under-specifies 8 critical runtime contracts** that govern presentation playback, pending state lifecycle, and CPU commentary injection. The recommended edits add **~15 lines of contract assertions** to completion conditions and work steps, which will prevent **4 high-risk regressions** (visual corruption, double-fire, pending orphaning, target duplication) without expanding plan scope.

**Audit Status**: ✅ **Complete** — Findings delivered with concrete plan diffs.

**Next Step**: Review edits 1-10 with implementer; integrate into plan before Phase 1 execution.


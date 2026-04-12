# CPU / Training Pipeline — Architecture Audit Report

**Date**: 2025-07-17  
**Scope**: Read-only. Live CPU (Lv.6) ↔ selfplay data generation ↔ Python training ↔ ONNX inference alignment.  
**Status**: Observation only. No code changes.

---

## 1. Architecture Summary

The system has a three-stage pipeline:

```
 Selfplay Data Generation          Python Training             Live CPU Inference
 ─────────────────────────         ───────────────             ──────────────────
 selfplay-runner.js                train_policy_onnx.py        cpu-decision.js
 ├─ CpuPolicyTableRuntime          train_card_onnx.py          ├─ buildOnnxContext()
 ├─ CpuPolicyCore (heuristic)      train_target_onnx.py        │
 ├─ buildActorViewSnapshot()       train_value_onnx.py         policy-onnx-runtime.js
 └─ → NDJSON records               └─ → .onnx models           ├─ buildInputVector()
                                                                ├─ chooseMove()
                                                                ├─ chooseCard()
                                                                └─ choosePendingTarget()
```

**Key design choices:**

- Selfplay generates decisions using **policy table + heuristic** (not ONNX).
- Python training reads NDJSON records, builds float vectors, trains 4 model heads (move, card, target, value).
- Live CPU loads ONNX models and runs inference with `buildInputVector()`.
- Fallback chain in live play: ONNX → Policy Table → Heuristic Core.

---

## 2. actorView / Trace Alignment

### 2.1 What selfplay records

`buildActorViewSnapshot()` (selfplay-runner.js:760) produces a **JSON object** with named fields:
`board`, `player`, `pendingType`, `legalMoves`, `handCards`, `usableCardIds`, `chargeBlack`, `chargeWhite`, `deckCount`, `blackCountBefore`, `whiteCountBefore`, `ownCornersBefore`, `oppCornersBefore`, `ownEdgesBefore`, `oppEdgesBefore`, `hasCornerMoveNow`, `hasEdgeMoveNow`, `cornerEmergency`, `cornerHoldMode`, `highBonusMoveAvailable`, `maxLegalMoveBonus`, `selectedCellBonus`, `pendingSelection`, `selectionTrace`.

This is **not** a float vector — it is a human-readable snapshot. The Python trainer converts it to a float vector.

### 2.2 What Python training consumes

`feature_vector()` in train_policy_onnx.py reads the **same named fields** from each NDJSON record and constructs a Float32 vector:
- Board: 100 floats (10×10 padded, perspective-encoded: +1 own, −1 opponent, 0 empty)
- 16 scalar features (legalMoves/60, discDiff/64, charges/CHARGE_MAX, deckCount/60, pendingFlag, corners/4, edges/24, binary flags)
- Card features: 2 × N_card_types (hand counts / MAX_HAND_SIZE, usability mask)

### 2.3 What live CPU inference produces

`buildInputVector()` in policy-onnx-runtime.js:812 constructs the **same float vector layout** from a context object built by `buildOnnxContext()`.

### 2.4 Alignment verdict

| Component | Python training | JS live inference | Status |
|-----------|----------------|-------------------|--------|
| Board encoding (perspective, padding, row-major) | ✅ | ✅ | **Match** |
| 16 scalar features (order, normalization) | ✅ | ✅ | **Match** |
| Card hand/usability encoding | ✅ | ✅ | **Match** |
| Pending type one-hot (target model) | ✅ | ✅ | **Match** |
| Input dimension | Metadata-driven | Metadata-driven | **Match** |

The float-vector encoding is aligned across all three stages. No field-order or normalization divergences were found.

---

## 3. Live CPU vs. Selfplay Divergences

### 3.1 Context field gap

`buildOnnxContext()` (cpu-decision.js:530) does **not** set these fields:

| Missing field | What happens in `buildInputVector()` |
|---------------|--------------------------------------|
| `blackCountBefore` / `whiteCountBefore` | Falls back to counting from `ctx.board` array (line 847–855) |
| `ownCornersBefore` / `oppCornersBefore` | `getCornerPlanFeatures()` recomputes from board via `countCornerEdgeControl()` |
| `ownEdgesBefore` / `oppEdgesBefore` | Same recomputation |
| `cornerEmergency` / `cornerHoldMode` | `getCornerPlanFeatures()` applies simplified formula |

**Risk level: Low.** The fallback recomputes from the same board state, so numerical results should be identical. However:

- The **code path** differs (pre-computed in training data vs. recomputed in live play).
- The `cornerEmergency` fallback formula in `getCornerPlanFeatures()` is simpler than selfplay's `buildCornerPlanState()` — the selfplay version incorporates card-aware recovery/hold analysis. This means the feature fed during training could occasionally differ from the feature seen during live inference for the same board position, **if the ONNX context does not pre-populate these fields**.

**Recommendation (Severity: Low–Medium):** Add `ownCornersBefore`, `oppCornersBefore`, `ownEdgesBefore`, `oppEdgesBefore` to `buildOnnxContext()` to ensure the identical code path. This eliminates the semantic gap in `cornerEmergency`/`cornerHoldMode` computation.

### 3.2 Decision source mismatch (by design)

| Aspect | Selfplay | Live CPU Lv.6 |
|--------|----------|---------------|
| Move selection | Policy table + heuristic (`CpuPolicyTableRuntime` + `CpuPolicyCore`) | ONNX model (fallback to table → heuristic) |
| Card selection | `scoreCardUseDecision()` heuristic | ONNX card model (fallback to heuristic) |
| Pending target | `PendingTargetSelector` (heuristic, 24+ selectors) | ONNX target model (fallback to per-card CPU handlers) |

This is standard **behavioural cloning / bootstrapping**: the model learns to imitate the heuristic teacher, then the live system uses the learned model. This is intentional but has implications:

- The model's ceiling is bounded by the heuristic teacher's quality.
- Exploration is driven by `cardUsageRate`, `policyMixRate`, and `cardUsageRateJitter` — not by the ONNX model's uncertainty.
- Iterative improvement requires the model to eventually replace the teacher in selfplay (self-play with ONNX), which the current pipeline does support via `policyMixRate` controlling the blend.

### 3.3 Expanded board handling

Both paths delegate to `SharedBoardUtils.attachBoardShape()` for non-8×8 boards (expansion cards). The padded 10×10 encoding in Python handles this via `boardEnvelope` + `boardMinRow`/`boardMinCol`. The JS side uses `resolveBoardFeatureDim()` which reads `modelMeta` to choose 64 (legacy) or 100 (padded). **No divergence found.**

---

## 4. Pending Target Handling

### 4.1 Selfplay path

`decideAction()` (selfplay-runner.js:3164): when `pending.stage === 'selectTarget'`, delegates to `buildPendingSelectionAction()` → `PendingTargetSelector.buildPendingSelectionAction()`.

`PendingTargetSelector` contains 24+ card-type-specific heuristic selectors that choose target cells, hand indices, or offer cards. Failure falls back to `cancel_card` with cost refund.

Records are written via `buildPendingSelectionRecord()` (line 542): captures `kind` (board_cell / hand_index / offer_card), `pendingType`, `row`/`col`.

### 4.2 Live CPU path

`processCpuTurn()` in cpu-turn-handler.js: checks `pendingEffectByPlayer[playerKey]` and dispatches to 25+ card-specific `cpuSelectXXX` functions.

If ONNX target model is available, `choosePendingTarget()` in policy-onnx-runtime.js can override heuristic selection.

### 4.3 Alignment assessment

| Aspect | Status |
|--------|--------|
| Pending types covered | ✅ Both paths handle 25+ card types |
| Selection logic | ⚠️ Selfplay uses heuristic selectors; live CPU can use ONNX target model |
| Target record schema | ✅ `pendingSelection.kind`, `row`, `col` match Python's `board_cell_index_for_record()` |
| Cancel/refund handling | ✅ Both paths refund on failure |

**Gap:** The ONNX target model is trained on heuristic selector decisions. When deployed, it may diverge from the teacher. This is expected bootstrapping behaviour, but means the target model's quality is bounded by the heuristic selector's quality in the current iteration's training data.

---

## 5. Card Coverage in Selfplay

### 5.1 Card availability

All card types from `cards/catalog.json` (70+ types) are loaded at selfplay init. No explicit exclusion list.

### 5.2 Card usage rate

```
Base rate:      cardUsageRate (default 0.2 = 20% of turns)
Per-game jitter: ± cardUsageRateJitter
Risk-adaptive:  scoreCardUseDecision() adjusts rate ×0.35 to ×1.8
Hand pressure:  handSize ≥ 5 → rate ≥ 0.88; handSize ≥ 4 → rate ≥ 0.58
Force use:      when no legal moves exist, card must be used
```

### 5.3 Card decision context

`buildCardDecisionContext()` (selfplay-runner.js:2182) mirrors the live CPU's card context, including: charges, hand sizes, legal moves, corner/edge control, special stone counts, board bonus state.

### 5.4 Coverage risk

**Low risk.** With 70+ card types and stochastic per-turn usage, most card types will appear in training data. The `cardUsageRateSchedule` supports progressive introduction for iterative training. Rare cards (high cost, narrow trigger conditions) may have lower representation, but this is mitigated by the risk-adaptive rate boosting.

---

## 6. Data Quality Risks

### 6.1 POSITION_WEIGHTS duplication

`POSITION_WEIGHTS` (the 8×8 positional scoring matrix) is defined identically in three files:

| File | Line | Status |
|------|------|--------|
| selfplay-runner.js | ~25 | `[[120,-20,20,5,...],...]` |
| policy-table-runtime.js | ~35 | Identical |
| cpu-policy-core.js | ~top | Identical |

**Risk: Low but fragile.** Currently aligned. If any copy is updated independently, policy table scoring and selfplay scoring will diverge silently.

**Recommendation:** Extract to `shared-constants.js` or a shared helper.

### 6.2 Sample weighting

Training applies outcome-based weighting:
- Winner: ×1.35, Draw: ×1.0, Loser: ×0.8
- Corner emergency, hand pressure, pending target, and other situational tags can modify weights via `danger_multiplier` (currently all +0.0 — ready for tuning but inactive).

### 6.3 Teacher solution schema

`export-teacher-solutions.js` wraps selfplay runner with `teacherCommitteeSize` and `tacticalVerificationDepth` for higher-quality labels. Solutions use same `buildActorViewSnapshot()` → NDJSON format. No schema divergence from regular selfplay records.

### 6.4 Board canonicalization

Both selfplay and policy-table-runtime delegate to `SharedBoardUtils.encodeBoard()` / `canonicalizeBoard()` via dihedral symmetry (8 transformations, lexicographic minimum). **Single source — no divergence.**

---

## 7. Benchmark / Adoption Gate Alignment

### 7.1 Gate inventory

| Gate | Script | What it measures |
|------|--------|-----------------|
| Adoption | benchmark-policy-adoption.js | Win rate uplift (A vs B selfplay), default ≥5% at 95% confidence |
| Quality | benchmark-policy-quality-gate.js | 14 quality dimensions (corner/edge/recovery/hold metrics) |
| ONNX | benchmark-policy-onnx-gate.js | Model loading + runtime + latency for all 4 heads via browser UI matches |
| Selfplay | benchmark-selfplay-policy.js | 45 quality dimensions per policy (core engine for A vs B) |
| Promote | promote-policy-model.js | File operations with rollback manifest |

### 7.2 Training objective vs. gate criteria

| Aspect | Training loss | Gate evaluation |
|--------|---------------|-----------------|
| Move | CrossEntropy on place target | Win rate + 45 quality dimensions |
| Card | CrossEntropy on card selection (weight ×2.0) | Card-specific quality metrics |
| Target | CrossEntropy on board cell selection | Not directly gated |
| Value | MSE on game outcome (with auxiliary corner/edge/economy blending) | Not directly gated |

**Gap:** The 14/45 quality dimensions in the gate are **post-hoc** evaluations, not training objectives. A model could improve loss but fail quality gates on criteria orthogonal to the training signal (e.g., corner emergency response quality). This is a design risk, not a bug — the gates serve as safety nets for strategic regression.

### 7.3 Benchmark engine alignment

`benchmark-selfplay-policy.js` uses the **same** `runSelfPlayGames()` engine as training data generation. Game rules, card logic, and board handling are shared. No separate simulation engine.

---

## 8. Test Coverage Gaps

### 8.1 Well-tested

| Area | Test file | What it covers |
|------|-----------|---------------|
| Argument parsing | selfplay.cli-args.test.js, teacher.cli-args.test.js, etc. | All CLI scripts |
| Profile parity | selfplay.runtime-parity.test.js | Policy table state key construction matches across browser/teacher |
| Pending routing | cpu.turn-handler.pending.test.js | 25+ card types dispatched correctly |
| Seed scheduling | selfplay.seed-schedule.test.js | Bank management, initial seed, counter |
| Card decision | cpu.card-decision-audit.test.js | Context builder audit framework |
| Adoption gate | benchmark.adoption.test.js | Win rate calculation, confidence bounds |
| ONNX gate | benchmark.onnx-gate.test.js | Gate verdict logic |

### 8.2 Critical coverage gaps

| Gap | Risk | Recommendation |
|-----|------|----------------|
| **No ONNX feature vector parity test** — no test verifies that `buildInputVector()` output is identical when given (a) a live `buildOnnxContext()` object vs. (b) a selfplay NDJSON record's fields | High | Add a round-trip test: selfplay record → feature vector vs. live context → feature vector → assert element-wise equality |
| **No real ONNX inference test** — all ONNX runtime tests mock the model | Medium | Add an integration test that loads a real (small) ONNX model and verifies output shape/range |
| **Runtime parity tests cover policy TABLE only** — selfplay.runtime-parity.test.js tests `makePolicyStateKey` alignment but not ONNX `buildInputVector` alignment | High | Extend parity tests to cover ONNX feature vectors |
| **No end-to-end pipeline test** — no test runs selfplay → train → inference and verifies that the trained model produces reasonable outputs | Medium | Add a smoke test with a tiny training run (10 games, 1 epoch) |
| **No Python↔JS feature encoding parity test** — nothing verifies that Python's `feature_vector()` and JS's `buildInputVector()` produce identical floats for the same input | High | Add a cross-language parity test (generate records in JS, verify feature vectors in Python, or vice versa) |
| **Card decision context parity** — cpu.card-decision-audit.test.js uses an audit framework but not hard assertions | Low | Strengthen with specific regression assertions |
| **POSITION_WEIGHTS divergence detection** — no test asserts the three copies are identical | Low | Add a simple equality assertion |

---

## 9. Suggested Experiments

### 9.1 Feature vector parity validation (High priority)

Generate 100 selfplay records, extract the actorView fields, then:
1. Run Python `feature_vector()` on each record → save as Float32 array
2. Run JS `buildInputVector()` on the same fields → save as Float32 array
3. Assert element-wise equality (tolerance ≤ 1e-6)

This would catch any normalization, ordering, or field-mapping discrepancies.

### 9.2 Context field enrichment (Medium priority)

Add `ownCornersBefore`, `oppCornersBefore`, `ownEdgesBefore`, `oppEdgesBefore` to `buildOnnxContext()` in cpu-decision.js. This ensures the live inference path uses the same pre-computed values as training data, eliminating the `getCornerPlanFeatures()` fallback code path divergence.

### 9.3 POSITION_WEIGHTS consolidation (Low priority)

Extract to a shared constant. Add a test asserting all consumers read from the single source.

### 9.4 Self-play with ONNX (High priority, longer term)

Currently selfplay uses heuristic teachers. To move beyond heuristic ceiling:
- Increase `policyMixRate` to blend ONNX inference into selfplay decisions
- Generate training data where the model plays against itself
- This is already architecturally supported but requires ONNX runtime in Node.js headless environment

### 9.5 Quality gate calibration (Medium priority)

Correlate the 14/45 quality dimensions with actual win rate improvements across historical model generations. Identify which dimensions are predictive of player-facing quality and which are noise. Adjust gate thresholds accordingly.

### 9.6 Pending target model coverage (Low priority)

Measure per-card-type record counts in training data. Ensure rare pending types (low-frequency cards) have sufficient representation. Consider upsampling or targeted selfplay with forced card draws for underrepresented types.

---

## Appendix A: File Index

| File | Role | Lines read |
|------|------|------------|
| src/engine/selfplay-runner.js | Core selfplay engine | ~4000 |
| game/ai/policy-onnx-runtime.js | ONNX inference runtime | ~1200 |
| game/cpu-decision.js | Live CPU decision orchestrator | ~6100 |
| game/cpu-turn-handler.js | CPU turn execution | ~1676 |
| game/ai/policy-table-runtime.js | Policy table lookup | ~750 |
| game/ai/cpu-policy-core.js | Heuristic scoring engine | ~5000 |
| scripts/generate-selfplay-data.js | CLI for selfplay generation | ~400 |
| scripts/export-teacher-solutions.js | Teacher solution exporter | ~300 |
| scripts/run-selfplay-training-cycle.js | Training loop orchestrator | ~600 |
| scripts/benchmark-policy-adoption.js | Adoption gate | ~500 |
| scripts/benchmark-policy-quality-gate.js | Quality gate | ~400 |
| scripts/benchmark-policy-onnx-gate.js | ONNX gate | ~300 |
| scripts/benchmark-selfplay-policy.js | Selfplay benchmark engine | ~800 |
| scripts/promote-policy-model.js | Model promotion | ~300 |
| shared/shared-board-utils.js | Board encoding/canonicalization | ~500 |
| shared/shared-constants.js | Shared constants | ~300 |
| shared/shared-card-heuristics.js | Card heuristic helpers | ~200 |
| shared/cpu-lv6-shared-profile.js | Lv.6 profile config | ~100 |
| game/move-generator.js | Legal move generation | ~400 |
| shared/cpu-lv6-runtime-capability.js | Runtime capability flags | ~100 |
| ai/train/train_policy_onnx.py | ONNX policy model training | ~1100 |
| ai/train/train_card_onnx.py | Card model training | ~300 |
| ai/train/train_target_onnx.py | Target model training | ~250 |
| ai/train/train_value_onnx.py | Value model training | ~200 |
| ai/train/train_policy_table.py | Policy table training | ~500 |
| ai/train/onnx_trainer_common.py | Training utilities | ~100 |
| 31 test files | Test coverage | ~various |

## Appendix B: Constants Cross-reference

| Constant | selfplay-runner.js | policy-onnx-runtime.js | Python training | Status |
|----------|-------------------|----------------------|-----------------|--------|
| PADDED_BOARD_SIZE | 10 | 10 | 10 | ✅ |
| BOARD_FEATURE_DIM | 100 | 100 (padded) / 64 (legacy) | 100 | ✅ |
| AUX_FEATURE_DIM | — | 16 | 16 | ✅ |
| CHARGE_MAX | 99 | 99 | 99 | ✅ |
| MAX_HAND_SIZE | 5 | 5 | 5 | ✅ |
| POSITION_WEIGHTS | [[120,−20,…]] | — | — | ⚠️ 3-way dup |

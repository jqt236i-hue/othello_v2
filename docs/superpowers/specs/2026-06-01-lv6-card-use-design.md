# Lv6 CPU Card Use Improvement Design

Date: 2026-06-01
Repo: `C:\Users\quarr\Desktop\othello_v2`
Scope: Lv6 CPU card-use judgment only

## Outcome

Strengthen Lv6 CPU card-use behavior without adding or retraining machine-learning models.
The result should make Lv6 more willing to use high-value recovery or position-swing cards in the right states, while preserving the current safety bias against reckless card use.

## Verification Surface

- Focused Jest coverage for the new decision rules.
- Existing Lv6 card-use regression tests still passing.
- Existing plan-pressure and risk-gate tests still passing.

Primary commands:

- `npx jest test/cpu.decision.refactor.test.ts --runInBand`
- `npx jest test/cpu.decision.card-risk.test.ts --runInBand`
- `npx jest test/cpu.decision.plan-pressure.test.ts --runInBand`

## Constraints

- Do not change public card specs or rulebook behavior.
- Do not intentionally alter Lv1-Lv5 card-use behavior.
- Do not weaken unrelated placement logic or network/worker contracts.
- Do not add model assets, selfplay runs, or retraining.
- Keep changes within CPU card judgment, plan pressure, hand cycling, and closely related tests.

## Current Weaknesses

1. Lv6 heavily suppresses card use whenever a corner move exists, even for a small set of high-leverage position-swing cards that can outperform the immediate corner line in specific recovery states.
2. Charge-ramp and card-economy cards still rely on coarse thresholds for hand pressure, charge reserve, and mobility pressure.
3. High-variance swing cards are mostly suppressed correctly while ahead, but the trailing and low-mobility escape windows are still too blunt.
4. Fast-rotate cards are sometimes held too long because destroy-cycle thresholds and "strong use ready" detection remain conservative.

## Recommended Approach

Apply a narrow logic-and-tuning pass rather than a broad redesign.

### A. Refine corner-window exceptions

Keep the default Lv6 rule that corners are preferred, but allow a tightly bounded exception path for cards already treated as white Lv6 corner-swing keep candidates or equivalent recovery-position tools.

Target families:

- `SWAP_WITH_ENEMY`
- `POSITION_SWAP_WILL`
- `TELEPORT_WILL`
- `CELL_TELEPORT_WILL`
- `FREE_PLACEMENT`
- `LAST_RESORT`
- `BUOYANCY_WILL`
- `SUPER_BUOYANCY_WILL`
- `GRAVITY_WILL`
- `SUPER_GRAVITY_WILL`

The exception must not become a general bypass. It should require visible pressure such as trailing, low mobility, corner emergency, recovery-cost pressure, or critical low-disc state.

### B. Tighten economy-card activation

Refine thresholds for:

- `GOLD_STONE`
- `SILVER_STONE`
- `RAINBOW_STONE`
- `CRYSTAL_STONE`
- `PLUNDER_WILL`
- `TREASURE_BOX`
- `REBUILD_WILL`

Desired direction:

- Reward these cards more when hand pressure, mobility pressure, and recovery-cost pressure line up.
- Preserve reserve-charge discipline while reducing obviously missed tempo windows.

### C. Sharpen high-variance escape windows

Keep ahead-state suppression for volatile cards, but make trailing and low-mobility escape states more card-specific instead of relying on broad shared penalties.

Highest-value candidates:

- `TIME_BOMB`
- `TIME_STOP_GOD`
- `METEOR_WILL`
- `BOARD_SHRINK_WILL`
- `BOARD_SHRINK_GOD`
- `TEMPT_WILL`
- `CAPTURE_WILL`

### D. Improve fast-rotate hand cycling

Retune the destroy-cycle path for fast-rotate cards so Lv6 sheds low-retention setup pieces earlier when no strong immediate use is available.

Focus on:

- `CHAIN_WILL` family
- `DOUBLE_PLACE`
- `BREEDING_WILL`
- `CLONE_WILL`
- `ESCAPE_WILL`
- `RIBO_WILL`
- `ROBOT_VACUUM_WILL`

## Change Plan

1. Add failing focused tests for the highest-confidence improvement cases.
2. Implement the minimum logic needed in `game/cpu-decision-move-plan.ts`, `game/ai/cpu-policy-card-use-decision.ts`, `game/ai/cpu-policy-decision-context.ts`, and only if necessary `game/cpu-decision-plan-pressure.ts`.
3. Keep per-card adjustments explicit and local.
4. Re-run focused suites and stop expanding scope once the intended pressure windows are covered.

## Non-Goals

- Replacing `policy-table-core`.
- Introducing card-by-card simulation search.
- Reworking move selection, ONNX loading, or worker authority behavior.
- Global balance changes outside Lv6 card-use judgment.

## Blocked Condition

Stop and report instead of continuing to tune if three consecutive adjustment attempts cannot be defended with focused tests or code-level evidence, or if the next step would require subjective balance edits without a reproducible verification surface.

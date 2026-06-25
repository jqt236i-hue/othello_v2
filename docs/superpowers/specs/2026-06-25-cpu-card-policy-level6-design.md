# All CPU Level 6 Card Policy Design

Date: 2026-06-25
Repo: `C:\Users\quarr\Desktop\othello_v2`
Role: implementation design for a player-visible CPU behavior change
Target: CPU card-use, hand-destroy, and pending-target policy levels
Source of truth: `01-rulebook.md` for player-visible behavior, `docs/architecture-contracts.md` for CPU/runtime boundaries
Non-goals: normal placement strength changes, CPU deck changes, Lv8/Lv9 card-use unlock timing changes, model training, ONNX primary-path changes, worker/network authority changes

## Outcome

All CPU levels should use the current Level 6 card policy for card-related decisions while preserving each CPU's existing non-card identity.

This means Lv1-Lv5 should keep their normal placement behavior, display level, fixed hand image, commentary tone, deck selection, and any profile-specific card unlock timing, but they should no longer use weaker low-level card-use thresholds or fallback card choices. Card use should become conservative and risk-aware across every CPU level.

## Approved Scope

Apply Level 6-equivalent card policy to:

- card-use candidate selection
- risk gate and high-confidence gate
- hand-destroy cycling before card use
- pending target selection after a card creates a pending choice
- retry/fallback card application paths that currently receive the turn level

Preserve current behavior for:

- normal stone placement policy by level
- CPU profile display/logging level
- CPU-specific decks
- Lv8 and Lv9 card-use unlock turns
- Othello mode card suppression
- animation, UI hand skin, commentary, and network authority behavior

## Current Structure

The CPU card phase is split across:

- `game/cpu-turn-card-phase.ts`: turn-time orchestration for hand destroy and card use
- `game/cpu-turn-handler.ts`: CPU turn integration, profile level lookup, retry paths, unlock checks
- `game/cpu-decision.ts`: CPU decision orchestrator and exported public API
- `game/cpu-decision-card-choice.ts`: card candidate selection
- `game/cpu-decision-card-actions.ts`: hand destroy and card application
- `game/cpu-decision-card-risk.ts`: card risk gates, Lv6 high-confidence checks, quiescence hold
- `game/cpu-decision-pending-actions.ts` and `game/cpu-decision-pending-score.ts`: pending target choice
- `game/ai/cpu-policy-*`: shared scoring and policy helpers

The existing Lv6 path is already the desired source of behavior. The implementation should route card-related level inputs through a Level 6 policy level instead of duplicating Lv6 logic.

## Design

Introduce a small CPU card policy level resolver near the CPU decision orchestration boundary. It should return:

- `6` for card-policy decisions for every CPU profile with a finite level below 6
- the existing clamped decision level for profiles already at 6 or above
- the existing Lv9 profile mapping of `decisionLevel: 6`

Keep this separate from display/readout level helpers. Existing user-visible logs such as `Lv1`, `Lv2`, etc. should continue to use display level where they are presentation-only.

Use the card policy level in these code paths:

- `selectCardToUse()`: build card-use context and evaluate shared policy as Lv6
- `cpuMaybeDestroyHandCardWithPolicy()`: enable Lv6-style hand cycling for all CPU levels
- card risk and high-confidence checks: evaluate with the normalized policy level
- retry/fallback card use in `cpu-turn-handler.ts`: avoid low-level bypasses when the first choice fails
- pending target selection and pending target ONNX/rerank gates: use Level 6 policy behavior for all CPU levels, while keeping existing board-size and runtime guard checks

Do not pass the normalized card policy level into normal move selection. Placement should continue to use each CPU's actual decision level.

## Rulebook Change

Implementation must update `01-rulebook.md` before production code changes. The rulebook should state that CPU card-use, hand-destroy, and pending target policy use the shared Lv6-equivalent card policy for all CPU levels, while normal placement strength and profile-specific decks/unlock timing remain level-specific.

No `正本/` update is expected unless implementation changes turn order, animation, sound, highlight, or card effect rules. This change is intended to alter CPU policy only.

## Testing

Use test-first implementation.

Add focused Jest coverage that proves:

- a low-level CPU card decision context is evaluated with policy level 6
- a low-level CPU can enter hand-destroy cycling that was previously gated at level 4 or higher
- a low-level CPU receives Lv6-style high-confidence/quiescence protection when a strong ordinary move exists
- Lv8/Lv9 card-use unlock timing still gates card use before the configured unlock turn
- normal move selection still receives the original CPU level

Prefer existing CPU policy tests if they already provide convenient seams:

- `test/cpu.decision.refactor.test.ts`
- `test/game.cpu-policy-core.test.ts`
- nearby `test/cpu.*` or `test/game.cpu*` tests

Minimum validation after implementation:

- targeted Jest for the new/changed CPU tests
- `npm run typecheck`
- `npm run build:ts`
- `git diff --check`

Broaden to `npm run test:jest -- --runTestsByPath test/cpu.decision.refactor.test.ts test/game.cpu-policy-core.test.ts` if the focused test file set changes shared policy helpers.

## Risks

Low-level CPU opponents will become stronger specifically in card play. That is intentional, but it may reduce the perceived gap between levels in card-heavy matches. Normal placement differences should preserve most of the level spread.

Routing every card-related level through Lv6 can expose old fallback paths that assumed low levels were allowed to use any usable card. Tests should cover retry/fallback behavior so failed primary choices do not bypass the new policy.

Pending target selection has both programmatic scoring and optional runtime/model gates. Keep existing capability and board-size guards intact so non-standard boards continue to fall back safely.

## First Implementation Pass

The first pass should be narrow:

1. Add focused failing tests for low-level card policy normalization and preservation of normal move level.
2. Add the card-policy-level resolver.
3. Replace card-related level inputs with the resolver at CPU decision boundaries.
4. Update `01-rulebook.md` with the approved behavior.
5. Run focused validation, then typecheck/build.

Do not refactor unrelated CPU move search or card scoring weights in this pass.

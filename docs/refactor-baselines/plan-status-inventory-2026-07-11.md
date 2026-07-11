# Dated plan status inventory

Status: active record

This inventory classifies every dated file that was under `docs/superpowers/plans/` on 2026-07-11. `historical` means time-bounded context only; it does not assert that every historical proposal was implemented. Current rules and architecture are defined by `01-rulebook.md` and `docs/architecture-contracts.md`, and current implementation work is governed only by an explicitly active plan.

## Active

| Source path | Status | Role |
| --- | --- | --- |
| `docs/superpowers/plans/2026-07-11-behavior-preserving-full-refactor-master-plan.md` | active | Current repository-wide refactor execution plan. |

## Historical

Each following line is an exact move from `docs/superpowers/plans/<filename>` to `docs/archive/<filename>`. All 77 have status `historical`.

- `2026-05-31-board-expansion-descriptors-refactor.md`
- `2026-06-01-network-deferred-selection-visual-sync.md`
- `2026-06-03-cell-removal-unification.md`
- `2026-06-03-manifest-stone-refactor-plan.md`
- `2026-06-03-observer-will-implementation-plan.md`
- `2026-06-03-special-card-inviolable-implementation-plan.md`
- `2026-06-04-remove-hyperactive-inherit-will-plan.md`
- `2026-06-04-special-stone-classification-redesign.md`
- `2026-06-05-theory-incarnation-implementation-plan.md`
- `2026-06-06-special-card-manifest-stone-refactor-plan.md`
- `2026-06-06-theory-incarnation-number-progress-plan.md`
- `2026-06-06-theory-incarnation-spawn-sound-plan.md`
- `2026-06-07-card-reversi-zero-stone-endgame-plan.md`
- `2026-06-11-cpu-refactor-safe-execution-plan.md`
- `2026-06-12-js-inventory-gate-repair.md`
- `2026-06-12-random-target-exclusion-fixes.md`
- `2026-06-13-core-refactor-execution-plan.md`
- `2026-06-13-ui-game-boundary-refactor.md`
- `2026-06-14-ending-ash-cpu-plan.md`
- `2026-06-14-game-keyboard-shortcuts.md`
- `2026-06-14-pending-selection-turn-contract-hardening.md`
- `2026-06-14-training-typecheck-selfplay-mirror-refactor.md`
- `2026-06-15-behavior-preserving-performance-passes.md`
- `2026-06-15-stone-skin-initial-choice.md`
- `2026-06-15-theory-manifest-duration.md`
- `2026-06-15-ui-render-batching-optimization.md`
- `2026-06-16-draw-hand-animation-optimization.md`
- `2026-06-16-evasion-nearest-empty-unification.md`
- `2026-06-16-flip-protection-context-consolidation.md`
- `2026-06-16-hard-will-destroy-protection-implementation-plan.md`
- `2026-06-16-hard-will-prep-refactor-plan.md`
- `2026-06-16-mobile-sound-stability.md`
- `2026-06-16-pending-selection-handoff-stabilization.md`
- `2026-06-17-card-effects-state-boundary-refactor.md`
- `2026-06-17-term-highlighting.md`
- `2026-06-18-card-ui-refactor-execution-plan.md`
- `2026-06-18-consecutive-pass-ui.md`
- `2026-06-18-effect-resolution-stabilization.md`
- `2026-06-18-ghost-will-simple-pass-through.md`
- `2026-06-18-network-rematch-result-overlay.md`
- `2026-06-18-network-spectator-live-failures.md`
- `2026-06-18-network-spectator-mode.md`
- `2026-06-18-special-stone-registry-unification.md`
- `2026-06-18-theory-incarnation-shared-placement-core.md`
- `2026-06-18-theory-placement-refactor.md`
- `2026-06-19-network-local-equivalent-playback.md`
- `2026-06-19-theory-incarnation-placement-spawn-order.md`
- `2026-06-19-turn-start-network-parity-refactor.md`
- `2026-06-20-network-auto-room-settings.md`
- `2026-06-20-network-room-list-scroll.md`
- `2026-06-21-boundary-authority-ui-refactor-plan.md`
- `2026-06-21-destroy-playback-visual-transaction.md`
- `2026-06-21-network-auto-cpu-command-planner.md`
- `2026-06-21-number-cell-distribution-risk-placement.md`
- `2026-06-21-playback-board-writer-bypass-repair.md`
- `2026-06-21-playback-visual-transaction-refactor-hardening.md`
- `2026-06-22-critical-game-refactor-master-plan.md`
- `2026-06-22-lv9-ending-ash-buff.md`
- `2026-06-22-network-battle-complete-repair-optimization.md`
- `2026-06-22-pending-network-selection-boundary-refactor.md`
- `2026-06-22-runtime-bootstrap-and-playback-boundary-refactor.md`
- `2026-06-23-causal-replay-will.md`
- `2026-06-23-sacrifice-will.md`
- `2026-06-24-network-player-id-foundation.md`
- `2026-06-24-player-profile-panel.md`
- `2026-06-25-chaos-summon.md`
- `2026-06-25-cpu-card-policy-level6.md`
- `2026-06-25-default-sacrifice-bgm.md`
- `2026-06-25-rated-glicko2-system.md`
- `2026-06-25-remove-absolute-protection.md`
- `2026-06-28-fate-will-network-selection-publish-alignment.md`
- `2026-07-03-network-match-hardening-a.md`
- `2026-07-04-codebase-refactor-execution-plan.md`
- `2026-07-06-time-stop-deity.md`
- `2026-07-08-zombie-will.md`
- `2026-07-09-deck-builder-vertical-scroll.md`
- `2026-07-09-zombie-bite-animation.md`

## Verification

The classification is valid only when these checks succeed:

```powershell
(Get-ChildItem docs/superpowers/plans -File -Filter '2026-*.md').Count # 1
(Get-ChildItem docs/archive -File -Filter '2026-*.md').Count           # 77 or more, including the 77 listed above
Test-Path docs/superpowers/plans/2026-07-11-behavior-preserving-full-refactor-master-plan.md
```

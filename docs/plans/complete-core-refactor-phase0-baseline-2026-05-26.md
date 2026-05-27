# Core Refactor Phase 0 Baseline

Date: 2026-05-26

## Role

This report records the Phase 0 baseline for the active core refactor goal defined by `docs/plans/complete-core-refactor-master-plan-2026-05-26.md`.

It is an execution baseline, not a gameplay specification. Player-visible behavior remains governed by `01-rulebook.md` and `正本/`. Internal boundaries remain governed by `docs/architecture-contracts.md`.

## Goal Link

- Active Goal: complete the master plan in `docs/plans/complete-core-refactor-master-plan-2026-05-26.md`
- Current phase: Phase 0 `Baseline And Freeze`

## Worktree Status At Baseline

The repository is already dirty. Refactor passes must avoid rewriting or staging unrelated user changes.

Observed status at baseline:

- Modified tracked files already exist in rules/docs/UI/script surfaces, including `01-rulebook.md`, `AGENTS.md`, `docs/architecture-contracts.md`, `ui/animation-engine.ts`, `ui/board-renderer.ts`, and `ui/diff-renderer.ts`.
- Untracked files already exist, including the newly created `正本/` folder, several script files, and several test files.
- Because of that state, each refactor pass must be isolated and reviewed with explicit path-by-path staging.

## Source Of Truth Boundaries Confirmed

- Gameplay and UI-visible rules: `01-rulebook.md`
- Detailed desired behavior and audit notes: `正本/*.md`
- Internal contracts and runtime boundaries: `docs/architecture-contracts.md`
- Repo-wide work rules: `AGENTS.md`
- Root source over generated/mirror surfaces: `worker-public/`, `dist/`, `public/module-registry.js` are not source

## Oversized Target Files At Baseline

Measured line counts:

| Lines | File |
| ---: | --- |
| 5913 | `game/cpu-decision.ts` |
| 5018 | `game/ai/cpu-policy-core.ts` |
| 4413 | `game/logic/cards.ts` |
| 4170 | `src/engine/selfplay-runner.ts` |
| 4147 | `training/engine/selfplay-runner.ts` |
| 3690 | `game/turn/turn_pipeline_phases.ts` |
| 3569 | `game/turn/pipeline_ui_adapter.ts` |
| 3391 | `ui/animation-engine.ts` |
| 2921 | `workers/match-worker.ts` |
| 2842 | `cards/card-interaction.ts` |
| 2610 | `ui/network-client.ts` |

These files remain the primary completion surface for the master plan.

## Existing Characterization Anchors

Confirmed focused or relevant test anchors already present at baseline:

- `test/game.turn-start-marker-order.test.ts`
- `test/workers.match-publish-idempotency.test.ts`
- `test/workers.match-pending-effect-id.test.ts`
- `test/workers.match-movement-selection.test.ts`
- `test/workers.match-stream-sse.test.ts`
- `test/game.pipeline-ui-adapter.sound-cue.test.ts`
- `test/ui.animation-engine.move-variants.test.ts`
- `test/game.cpu-policy-core.test.ts`
- `test/cpu.decision.refactor.test.ts`

This is enough to begin Phase 1 characterization expansion without first inventing a new test strategy.

## Baseline Validation

Commands run during Phase 0:

1. `npm run checkall`
2. `npm run test:network:parity`

Results:

- `npm run checkall`: pass
- `npm run test:network:parity`: pass, 28 suites / 346 tests

Not run during this baseline:

- `npm run typecheck`
- `npm run test:jest`
- `npm run worker:prepare`

Reason:

- Phase 0 only requires the narrower baseline gates from the master plan.
- Broader validation remains part of later refactor passes and final completion.

## Baseline Findings

1. The repository is stable enough to begin refactor work.
2. The main risk is not current failing validation; it is the amount of mixed responsibility concentrated in a small set of giant files.
3. The highest-leverage starting surface is still `game/turn/turn_pipeline_phases.ts`, because turn order and raw event assembly feed playback, network parity, and `正本/` alignment downstream.
4. `cards/card-interaction.ts` remains blocked on missing characterization for input lock completion behavior.
5. CPU/selfplay targets are oversized enough that they must be part of the completion definition, but they should not be the first production refactor pass.

## First Safe Implementation Pass

Recommended first implementation pass after Phase 0:

- Finish Phase 1 characterization for turn-start and input-lock behavior before moving production logic.

Concrete scope:

- Add tests that prove bombs and special stones share one deterministic ordering lane.
- Add tests that prove markers created during turn-start do not fire in the same turn-start phase.
- Add tests for additional placement not re-running draw or turn-start effects.
- Add browser or UI-focused tests that prove target-selection playback keeps input locked until resolution is complete.

Why this first:

- It reduces the highest regression risk before any large file split.
- It creates an auditable boundary for the later `turn_pipeline_phases.ts` and `card-interaction.ts` decomposition.
- It avoids mixing structural movement with unanswered behavior questions.

## Rollback Approach

For the next pass:

- Keep the first production pass test-first when possible.
- Change one responsibility cluster only.
- Use targeted Jest commands first, then `npm run test:network:parity` if turn/network behavior is touched.
- If a pass changes production structure and loses behavioral confidence, revert only that pass rather than widening the patch.

## Phase 0 Exit

Phase 0 is complete when:

- baseline worktree status is documented
- source-of-truth boundaries are documented
- oversized target files are measured
- narrow baseline validation is recorded
- the first implementation pass is explicitly chosen

All five conditions are now satisfied.

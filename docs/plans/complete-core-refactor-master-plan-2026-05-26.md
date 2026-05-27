# Core Refactor Complete Master Plan

Date: 2026-05-26

## Role

This is the active master plan for completing the high-risk core refactor of the Card Reversi repository.

It is a refactor plan, not a gameplay specification. Player-visible behavior remains governed by `01-rulebook.md` and the detailed desired-behavior notes under `正本/`. Internal module boundaries remain governed by `docs/architecture-contracts.md`.

## Target

Complete the refactor of the currently high-risk, oversized, frequently-touched core surfaces:

- `game/turn/turn_pipeline_phases.ts`
- `game/logic/cards.ts`
- `game/turn/pipeline_ui_adapter.ts`
- `ui/animation-engine.ts`
- `cards/card-interaction.ts`
- `workers/match-worker.ts`
- `ui/network-client.ts`

The plan also includes the adjacent oversized CPU/selfplay surfaces that must be addressed before calling the repository-level refactor complete:

- `game/cpu-decision.ts`
- `game/ai/cpu-policy-core.ts`
- `src/engine/selfplay-runner.ts`
- `training/engine/selfplay-runner.ts`

## Non-Goals

- Do not change card effects, turn rules, visual timing, sound behavior, network protocol, serialization formats, or public import paths as part of refactoring.
- Do not edit `worker-public/`, `dist/`, generated catalogs, or `public/module-registry.js` as source.
- Do not run long selfplay/training jobs as refactor validation.
- Do not merge behavior fixes into refactor passes unless the bug is first captured in a failing test and the relevant source of truth is updated or confirmed.

## Completion Definition

The refactor is complete only when all of these are true:

1. Public behavior is unchanged except for explicitly approved bug fixes.
2. `01-rulebook.md` and `正本/` remain aligned with any player-visible behavior touched during the work.
3. `game/turn/turn_pipeline_phases.ts` is reduced to a thin phase orchestrator. Turn-start marker processing, bomb processing, special-stone processing, timer expiry, and raw event assembly live in focused modules.
4. `game/logic/cards.ts` is reduced to a card-rule facade/state hub. Remaining card-specific behavior is moved into existing or new focused modules under `game/logic/cards/` or `game/logic/cards-internal/`.
5. `game/turn/pipeline_ui_adapter.ts` is split into focused playback mapping, sound cue, effect log, phase ordering, and presentation-profile modules.
6. `ui/animation-engine.ts` is reduced to playback orchestration and event dispatch. Event-specific animation behavior is delegated to focused helpers without adding a second board writer.
7. `cards/card-interaction.ts` is split so card detail UI, pending selection UI, input lock/playback gating, network publish bridge, and hand overlay flows are separately testable.
8. `workers/match-worker.ts` is split so routing, room lifecycle, publish handling, SSE/reconnect, timers, snapshots, and leaderboard helpers are separately owned while preserving the Worker contract.
9. `ui/network-client.ts` is split into transport, publish queue, reconnect/snapshot sync, playback bridge, and UI-facing adapter modules.
10. CPU/selfplay oversized files have focused boundaries, or have explicit documented reason to remain large with tests proving the boundary.
11. No root TypeScript file uses `@ts-nocheck`.
12. `npm run checkall`, `npm run typecheck`, `npm run test:network:parity`, and `npm run test:jest` pass.
13. If Worker mirror impact exists, `npm run worker:prepare` has been run and reviewed.
14. A final completion report is written under `docs/plans/` with changed files, validation commands, residual risks, and any intentionally deferred work.

Line count is not the primary goal, but as a practical completion signal, no non-generated production source file in the target list should remain above roughly 1,500 lines unless its residual size is justified in the completion report.

## Refactor Principles

- Preserve current behavior before improving structure.
- Add characterization tests before moving unclear logic.
- Keep public entry points stable until a separate migration is explicitly approved.
- Move code by responsibility, not by convenience.
- Prefer existing helpers and contracts over new abstractions.
- Keep each implementation pass small enough to review.
- Run the narrowest useful validation first, then the broader gate required by the touched boundary.
- Update `正本/正本差分監査.md` when a refactor exposes a real mismatch between desired behavior and current behavior.

## Phase 0: Baseline And Freeze

Goal: make the starting state measurable before production refactors begin.

Tasks:

- Record current dirty worktree and avoid mixing unrelated changes into refactor passes.
- Create or update a refactor dashboard with the target files, current line counts, test coverage, and known risks.
- Confirm current source-of-truth boundaries:
  - `01-rulebook.md`
  - `正本/`
  - `docs/architecture-contracts.md`
  - `AGENTS.md`
- Run baseline checks, or record the exact pre-existing failures if the worktree is not clean enough to run them.

Minimum validation:

- `rg --files -g 'AGENTS.md' -g 'README.ai.md' -g 'SKILLS.md'`
- `npm run checkall`
- `npm run test:network:parity`

Completion criteria:

- Baseline status is documented.
- No unrelated user changes are staged or rewritten.
- The first implementation pass has a narrow owner and rollback plan.

## Phase 1: Characterization Coverage

Goal: lock down behavior that will be moved.

Required tests before production movement:

- Turn-start ordering:
  - multiple special stones are processed in `createdSeq` order
  - bombs and special stones share one ordering lane
  - markers created during turn start do not fire in the same turn-start phase
  - one special stone completes its raw event group before the next starts
- Additional placement:
  - double/triple/quad/infinite placement does not re-run draw or turn-start effects
  - last resort performs exactly its allowed placements and then ends correctly
- Pending selection/input lock:
  - target selection publish clears pending state
  - UI rejects next input while playback/selection resolution is still active
  - network-delayed target selection cannot double-apply
- Playback and sound:
  - teleport uses the instant move path
  - hyperactive movement uses move playback and positive highlight metadata
  - destroy dragon destruction carries destroy-dragon presentation metadata
  - special sounds do not double-play with generic destroy sounds
- Network authority:
  - random outcomes are server-authored and replayed consistently
  - reconnect restores board, hands, markers, timers, pending state, and playback baseline

Minimum validation:

- Focused Jest tests with `--runTestsByPath`
- `npm run test:network:parity` for network authority and reconnect coverage

Completion criteria:

- Each target boundary has at least one focused characterization test.
- Any known gaps are listed in `正本/正本差分監査.md` or the refactor dashboard with `D: 未確認` or `要判断`.
- No production refactor begins for a boundary whose current behavior is still unknown.

## Phase 2: Turn Pipeline Decomposition

Target:

- `game/turn/turn_pipeline_phases.ts`

Proposed module ownership:

- `game/turn/turn-start/marker-order.ts`
- `game/turn/turn-start/bomb-phase.ts`
- `game/turn/turn-start/special-stone-phase.ts`
- `game/turn/turn-start/duration-phase.ts`
- `game/turn/turn-start/raw-event-assembly.ts`
- `game/turn/turn-start/turn-start-types.ts`

Rules:

- Keep `applyTurnStartPhase(...)` as the public entry point until every caller is migrated.
- Preserve `events[]` ordering exactly.
- Preserve deterministic PRNG usage and marker ordering exactly.
- Do not introduce UI, DOM, sound, timers, or network dependencies into the new `game/turn/turn-start/*` modules.

Implementation passes:

1. Extract marker collection and ordering with tests.
2. Extract bomb processing with tests.
3. Extract owner-turn special-stone processors one cluster at a time.
4. Extract both-player-turn movement processors one cluster at a time.
5. Extract duration expiry/status removal raw event assembly.
6. Reduce `turn_pipeline_phases.ts` to orchestration.

Minimum validation:

- `npx jest --runInBand --runTestsByPath test/game.turn-start-marker-order.test.ts`
- Relevant special-stone tests under `test/game.*will*.test.ts`
- `npm run test:network:parity`

Completion criteria:

- `turn_pipeline_phases.ts` owns orchestration only.
- Every extracted module has focused tests or is covered by an existing focused suite.
- `正本/ターン進行正本.md` and `正本/正本差分監査.md` are updated only if the intended behavior is clarified or a mismatch is discovered.

## Phase 3: Card Logic Hub Decomposition

Target:

- `game/logic/cards.ts`

Proposed final ownership:

- `game/logic/cards.ts`: facade, public registry, card state creation, compatibility exports
- `game/logic/cards-internal/*`: state, hand, charge, pending, timing, random, presentation helpers
- `game/logic/cards/*`: card-family behavior modules

Rules:

- Preserve existing public exports and require/import compatibility.
- Move one card family or helper cluster at a time.
- Do not merge similar-looking card logic unless inputs, outputs, side effects, error behavior, ordering, and random usage are proven equivalent.

Implementation passes:

1. Inventory remaining card-specific functions in `cards.ts`.
2. Add facade contract tests for public exports used by browser, worker, headless, and tests.
3. Move remaining special-stone card families to `game/logic/cards/*`.
4. Move state/hand/charge/pending helpers to `game/logic/cards-internal/*`.
5. Leave compatibility wrappers in `cards.ts` until dynamic references are proven gone.
6. Remove wrappers only in a separate pass with reference evidence.

Minimum validation:

- `npm run typecheck`
- `npm run checkall`
- Focused card tests for each moved family
- `npm run test:network:parity` when card behavior can affect Worker publish

Completion criteria:

- `cards.ts` is a facade and no longer contains large card-specific implementations.
- All moved behavior has focused coverage.
- No public import path breaks.

## Phase 4: Playback Adapter And Animation Split

Targets:

- `game/turn/pipeline_ui_adapter.ts`
- `ui/animation-engine.ts`

Proposed module ownership:

- `game/turn/presentation/playback-mapper.ts`
- `game/turn/presentation/sound-cue-assembler.ts`
- `game/turn/presentation/effect-log-assembler.ts`
- `game/turn/presentation/phase-ordering.ts`
- `ui/animation/event-dispatcher.ts`
- `ui/animation/move-variants.ts`
- `ui/animation/highlight-runner.ts`
- `ui/animation/sound-playback-bridge.ts`

Rules:

- Preserve Single Visual Writer.
- Preserve `events[]` playback order.
- Do not make `game/turn/presentation/*` depend on DOM, `window`, audio, or timers.
- Keep animation-engine as the only board mutation playback coordinator.

Implementation passes:

1. Extract sound cue assembly from `pipeline_ui_adapter.ts`.
2. Extract effect log assembly.
3. Extract raw event to playback event mapping by event family.
4. Extract animation move variant decisions from `ui/animation-engine.ts`.
5. Extract highlight running without changing CSS class names.
6. Keep a compatibility facade and remove duplicated branches after tests pass.

Minimum validation:

- `npx jest --runInBand --runTestsByPath test/game.pipeline-ui-adapter.sound-cue.test.ts test/ui.animation-engine.move-variants.test.ts test/ui.animation-engine.test.ts`
- `npm run test:visual` for visual behavior passes that touch DOM playback
- Browser screenshot checks for any pass that changes animation timing or highlight behavior

Completion criteria:

- Playback mapping, sound, effect log, move variants, and highlights are independently testable.
- Generic destroy sounds and special sounds cannot double-play unless explicitly specified.
- Teleport, hyperactive, destroy dragon, bomb, robot vacuum, and status expiry presentation paths have focused tests.

## Phase 5: Card Interaction And Input Lock Split

Target:

- `cards/card-interaction.ts`

Proposed module ownership:

- `cards/interaction/card-detail-panel.ts`
- `cards/interaction/pending-selection-ui.ts`
- `cards/interaction/input-lock-bridge.ts`
- `cards/interaction/network-publish-bridge.ts`
- `cards/interaction/hand-overlay-flow.ts`
- `cards/interaction/card-action-runner.ts`

Rules:

- Preserve pending selection network publish behind the UI/network signal bridge.
- Do not let card-effects logic discover or publish through a global `NetworkMatchClient`.
- Preserve local, CPU, and network match modes.
- Preserve playback-aware board update behavior.

Implementation passes:

1. Add input-lock characterization tests for T-004.
2. Extract pending selection UI prompt/render helpers.
3. Extract playback/input lock bridge.
4. Extract network publish bridge.
5. Extract hand overlay flows for heaven/condemn and capture/reserved slot behavior.
6. Reduce `card-interaction.ts` to wiring and public UI actions.

Minimum validation:

- Focused pending selection and card interaction Jest suites
- `npm run test:network:parity`
- Browser interaction smoke for target selection and immediate next-click rejection

Completion criteria:

- Target selection, pending state, input lock, and network publish are separately testable.
- T-004 in `正本/正本差分監査.md` is no longer `D: 未確認`.
- No gameplay behavior changes without source-of-truth update.

## Phase 6: Network Authority And Client Split

Targets:

- `workers/match-worker.ts`
- `ui/network-client.ts`

Proposed Worker ownership:

- `workers/match/routes.ts`
- `workers/match/room-lifecycle.ts`
- `workers/match/publish-handler.ts`
- `workers/match/sse-stream.ts`
- `workers/match/snapshot-projection.ts`
- `workers/match/turn-timer.ts`
- `workers/match/leaderboard.ts`

Proposed client ownership:

- `ui/network/transport.ts`
- `ui/network/publish-queue.ts`
- `ui/network/reconnect-sync.ts`
- `ui/network/snapshot-apply.ts`
- `ui/network/playback-bridge.ts`
- `ui/network/client-facade.ts`

Rules:

- Server snapshot remains authoritative.
- Client preview/reconciliation state must not become authority.
- Preserve request/response shapes, SSE event format, seat token behavior, operation idempotency, and reconnect semantics.
- Treat any public contract change as a separate approved migration, not a refactor.

Implementation passes:

1. Add or confirm contract tests for Worker route responses and SSE replay.
2. Extract Worker pure helpers that do not change request handling.
3. Extract publish handling behind the existing public route.
4. Extract SSE/reconnect buffering helpers.
5. Extract network-client transport and publish queue.
6. Extract reconnect/snapshot apply logic.
7. Keep public client facade stable.

Minimum validation:

- `npm run test:network:parity`
- `npm run typecheck`
- `npm run checkall`
- Local match smoke tests if routes or server startup are touched

Completion criteria:

- Worker and client network surfaces have focused ownership and contract tests.
- Reconnect and random outcome consistency remain covered.
- No client-authored state becomes authoritative.

## Phase 7: CPU And Selfplay Core Split

Targets:

- `game/cpu-decision.ts`
- `game/ai/cpu-policy-core.ts`
- `src/engine/selfplay-runner.ts`
- `training/engine/selfplay-runner.ts`

Rules:

- Do not change CPU strength, training semantics, policy model formats, generated training artifacts, or benchmark thresholds as refactor side effects.
- Do not run long training jobs.
- Preserve current CLI and module entry points.

Implementation passes:

1. Inventory CPU decision responsibilities: candidate generation, card selection, policy scoring, fallback policy, comments/diagnostics.
2. Extract pure scoring and candidate helpers where tests already exist.
3. Split selfplay runner into board simulation, record writing, policy adapter, pending-target simulation, and summary/report helpers.
4. Keep root and training runner behavior aligned or document why duplication remains necessary.
5. Add small selfplay sample tests only; do not run full training.

Minimum validation:

- `npx jest --runInBand --runTestsByPath test/game.cpu-policy-core.test.ts test/cpu.decision.refactor.test.ts`
- Relevant `training/tests/*selfplay*.test.ts`
- `npm run typecheck`

Completion criteria:

- CPU and selfplay modules have explicit responsibility boundaries.
- Existing policy quality gates and artifact formats are unchanged.
- Any remaining large file is justified by measured cohesion and test coverage.

## Phase 8: Generated/Mirror Sync And Documentation

Goal: make derived surfaces match root source after all source refactors.

Tasks:

- Run generation/mirror commands only when root source changes require it.
- Review generated output before staging.
- Update `docs/architecture-contracts.md` if a stable internal contract changed.
- Update `AGENTS.md` or nested `AGENTS.md` only if the refactor changes future work rules.
- Update `正本/` only for player-visible specification changes or clarified intended behavior.

Minimum validation:

- `npm run worker:prepare` when Worker/public mirror impact exists
- `git diff --check`
- `npm run checkall`

Completion criteria:

- No generated or mirrored file is source-edited.
- Documentation describes the final ownership boundaries.

## Phase 9: Final Hardening And Completion Report

Goal: prove the refactor is complete and safe.

Required final validation:

- `npm run typecheck`
- `npm run build:ts`
- `npm run checkall`
- `npm run test:network:parity`
- `npm run test:jest`
- `npm run test:visual` if animation, highlight, or DOM playback was touched
- `npm run worker:prepare` if Worker mirror impact exists

Completion report must include:

- Final target file sizes and responsibilities
- Changed public facades and confirmation that public imports remain stable
- Tests added during characterization
- Full validation commands and results
- Any approved behavior fixes separated from pure refactors
- Residual risks and why they are acceptable
- Explicit list of deferred non-refactor work

Completion criteria:

- All required validation passes or a blocking issue is documented with owner and reproduction.
- No target file remains an unowned mixed-responsibility module.
- The plan can be marked complete in a final report.

## Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Refactor accidentally changes turn order | Network divergence, replay bugs | Characterization tests before moving logic; `test:network:parity` after each turn/network pass |
| Playback order changes while code still computes same final board | Animation bugs, input lock bugs | Preserve `events[]` order; add phase/order tests; visual checks for UI passes |
| Public import path breaks | Browser/Worker/test runtime failures | Keep compatibility facades until references are proven migrated |
| Client state becomes authority | Network cheating/desync risk | Keep Worker/local authority helpers canonical; network parity tests |
| Large pass becomes unreviewable | Hidden regressions | One responsibility per pass; stop after each pass and review diff |
| Generated or mirror files drift | Deploy/runtime mismatch | Source edit first; run generation/mirror scripts only when required |
| Behavior bug discovered during refactor | Refactor becomes feature/bugfix mix | Capture failing test, confirm source of truth, split bugfix from refactor |

## Execution Order Summary

1. Baseline and characterization.
2. Turn pipeline.
3. Card logic hub.
4. Playback adapter and animation split.
5. Card interaction and input lock.
6. Network authority and client split.
7. CPU/selfplay split.
8. Generated/mirror sync and docs.
9. Final hardening and completion report.

This order is intentional: turn/card behavior is the source of most downstream playback and network effects, so it must be stabilized before UI and network internals are aggressively split.

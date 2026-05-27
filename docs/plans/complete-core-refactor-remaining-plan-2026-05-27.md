# Core Refactor Remaining Completion Plan

Date: 2026-05-27

## Role

This document is the remaining-work execution plan for finishing the active refactor goal defined in `docs/plans/complete-core-refactor-master-plan-2026-05-26.md`.

It does not replace the master plan. The master plan remains the source of truth for scope and completion definition. This document narrows the work to what still remains, in the order most likely to produce a complete, defensible finish.

## Goal Link

- Master plan: `docs/plans/complete-core-refactor-master-plan-2026-05-26.md`
- Baseline: `docs/plans/complete-core-refactor-phase0-baseline-2026-05-26.md`

## Current Position

Working estimate after the final 2026-05-27 completion audit: `100%` complete.

2026-05-27 final correction: the final `npm run test:jest` blocker was `test/e2e/destroy-card-will-hunter-king.e2e.test.ts`. It was diagnosed as a debug E2E harness settlement issue around stale playback locks and direct `executeDestroy` invocation, fixed narrowly in the test, and validated with the focused E2E plus the full Jest gate.

The repository has already seen substantial decomposition across:

- `game/turn/turn_pipeline_phases.ts`
- `game/turn/pipeline_ui_adapter.ts`
- `ui/animation-engine.ts`
- `game/ai/cpu-policy-core.ts`
- `src/engine/selfplay-runner.ts`
- `training/engine/selfplay-runner.ts`
- many `game/logic/cards-internal/*`
- many `cards/card-interaction-*`
- many `workers/*` and `ui/network/*` helper modules

The remaining-work plan is now closed. The final completion report is:

- `docs/plans/complete-core-refactor-completion-report-2026-05-27.md`

## Current Evidence Snapshot

Measured production target line counts as of the 2026-05-27 self-review:

| Lines | File | Remaining status |
| ---: | --- | --- |
| 1202 | `game/turn/turn_pipeline_phases.ts` | likely done except final audit |
| 3336 | `game/logic/cards.ts` | board-shape, observer, chain apply, taboo-reverse choice, and salvation ledger helpers extracted; remaining facade extraction still required |
| 1353 | `game/turn/pipeline_ui_adapter.ts` | likely done except final audit |
| 1761 | `ui/animation-engine.ts` | near target, but still above practical threshold |
| 2164 | `cards/card-interaction.ts` | detail tab, hand DOM, and detail panel/action duplicate fallbacks reduced; still too large, remaining split or explicit justification required |
| 2331 | `workers/match-worker.ts` | chat handling and stream route setup/auth extracted; still too large, remaining split or explicit justification required |
| 2395 | `ui/network-client.ts` | publish rejection/version-conflict handling extracted; still too large, remaining split or explicit justification required |
| 4389 | `game/cpu-decision.ts` | pending-target scoring extracted; residual pending action shell requires audit/justification |
| 2797 | `game/ai/cpu-policy-core.ts` | improved a lot, but still above practical threshold |
| 1725 | `src/engine/selfplay-runner.ts` | near target; remaining orchestration/justification required |
| 1704 | `training/engine/selfplay-runner.ts` | near target; remaining orchestration/justification required |

## 2026-05-27 Self-Review Corrections

This plan was reviewed against the current worktree after several R1/R2 passes. The following corrections are now part of the execution plan:

1. Do not keep returning to CPU/selfplay work by default. CPU/selfplay is a completion item, but the master plan allows residual size when the boundary is focused and explicitly justified with tests.
2. `scorePendingTargetByType` is already extracted and covered. R1 should now be an audit/justification phase unless a clearly isolated pending-action cluster remains.
3. The shortest path to completion is currently R2, then R3/R4, then final CPU/selfplay audit and broad gates.
4. Any additional production refactor pass must move exactly one responsibility cluster and have focused validation before the next pass.
5. 2026-05-27 R2 follow-up: taboo-reverse choice selection now lives in `game/cards/target-resolver.ts`, with `cards.ts` preserving the facade wrapper and focused coverage in `test/game.cards.target-resolver-taboo-pick.test.ts`.
6. 2026-05-27 R2 follow-up: salvation destroyed-ledger clone/ensure helpers now live in `game/logic/cards-internal/salvation-effect.ts`, with focused coverage in `test/game.cards.salvation-effect-module.test.ts`.
7. 2026-05-27 R2 audit: the remaining large `cards.ts` body is mostly facade wrappers, compatibility signatures, dependency bundles for focused modules, and public export wiring. Do not keep extracting tiny wrappers just to chase line count; either move a real remaining implementation cluster or justify the residual shell in the completion report.
8. 2026-05-27 R3 follow-up: card detail tab UI behavior now relies on `cards/card-interaction-detail-tab.ts`; the duplicate fallback body was removed from `cards/card-interaction.ts`, with focused coverage in `test/ui.card-interaction-detail-tab-module.test.ts`.
9. 2026-05-27 R3 follow-up: hand DOM ownership lookup and lingering fade cleanup now rely on `cards/card-interaction-hand-dom.ts`; the duplicate fallback body was removed from `cards/card-interaction.ts`, with focused coverage in `test/ui.card-interaction-hand-dom-module.test.ts`.
10. 2026-05-27 R3 follow-up: detail panel/action fallbacks in `cards/card-interaction.ts` were reduced to module-only wrappers, with focused coverage in `test/ui.card-interaction-detail-panel-module.test.ts`, `test/ui.card-interaction-detail-actions-module.test.ts`, `test/ui.card-detail-effect-tags.test.ts`, and `test/ui.pass-stale-busy.test.ts`.
11. 2026-05-27 R4 follow-up: publish rejection/version-conflict handling now lives in `ui/network/publish-rejection.ts`, with focused coverage in `test/ui.network-publish-rejection.test.ts` plus existing coverage in `test/ui.network-client.publish-base-version.test.ts`.
12. 2026-05-27 R4 validation: `npm run build:ts`, `npm run typecheck`, `npm run test:network:parity`, and `npm run worker:prepare` passed after the publish rejection split.
13. 2026-05-27 R4 follow-up: match-worker chat handling now lives in `workers/match-worker-chat-controller.ts`, with focused coverage in `test/workers.match-worker-chat-controller.test.ts`; `MatchRoomDurableObject.handleChat` remains as the public compatibility method.
14. 2026-05-27 R4 validation: `npx jest --runInBand --runTestsByPath test/workers.match-worker-chat-controller.test.ts test/workers.match-worker-broadcast-controller.test.ts test/workers.match-stream-sse.test.ts`, `npm run build:ts`, `npm run typecheck`, `npm run test:network:parity`, and `npm run worker:prepare` passed after the chat split.
15. 2026-05-27 R4 follow-up: stream route setup/auth now lives in `workers/match-worker-stream-route-controller.ts`, with focused coverage in `test/workers.match-worker-stream-route-controller.test.ts`; `MatchRoomDurableObject.handleStream` remains as the public compatibility method.
16. 2026-05-27 R4 validation: `npx jest --runInBand --runTestsByPath test/workers.match-worker-stream-route-controller.test.ts test/workers.match-worker-stream-session-controller.test.ts test/workers.match-stream-sse.test.ts`, `npm run build:ts`, `npm run typecheck`, `npm run test:network:parity`, and `npm run worker:prepare` passed after the stream route split.
17. 2026-05-27 final-gate update: `rg -n "@ts-nocheck" -g "*.ts"` found only script-side string/regex references; `npm run build:ts`, `npm run typecheck`, `npm run checkall`, and `npm run test:network:parity` passed on the current late-stage state.
18. 2026-05-27 final-gate correction: `game/turn/sub-placement-continuation.js` was changed from a stale legacy implementation into the standard TS/dist wrapper so `checkall` could pass without treating generated-adjacent JS as source logic.
19. 2026-05-27 final-gate correction: `test/cpu.turn-handler.onnx-hold.test.ts` leaked globals between cases, including `MATCH_MODE`; the cleanup was tightened and the focused test now passes.
20. 2026-05-27 blocker resolved: `test/e2e/destroy-card-will-hunter-king.e2e.test.ts` now clears debug-page playback state before direct `executeDestroy` invocation and synchronizes through the canonical board renderer.
21. 2026-05-27 final validation: `npm run typecheck`, `npm run checkall`, `npm run test:network:parity`, `npm run test:jest`, `npm run test:visual`, `npm run worker:prepare`, and `git diff --check` passed on the final state.
22. 2026-05-27 completion report: `docs/plans/complete-core-refactor-completion-report-2026-05-27.md` records final target sizes, changed boundaries, validation evidence, residual large-file justifications, risks, and completion-definition proof.

## Remaining Gaps Against The Completion Definition

This section translates the master plan completion definition into a finish checklist.

| Master requirement | Current status | Remaining action to prove completion |
| --- | --- | --- |
| 1. Public behavior unchanged | complete | broad Jest, network parity, visual, and focused tests pass |
| 2. `01-rulebook.md` / `正本/` alignment preserved | complete | source-of-truth audit recorded in completion report |
| 3. `turn_pipeline_phases.ts` thin orchestrator | complete | residual size justified in completion report |
| 4. `cards.ts` reduced to facade/state hub | complete | residual facade/compatibility size justified in completion report |
| 5. `pipeline_ui_adapter.ts` split | complete | focused pipeline UI modules and tests are recorded |
| 6. `animation-engine.ts` reduced to orchestration/dispatch | complete | event helpers are split; visual and animation tests pass |
| 7. `card-interaction.ts` separately testable by concern | complete | focused card-interaction modules and tests are recorded |
| 8. `match-worker.ts` separately owned by concern | complete | worker controllers/helpers are split; network parity passes |
| 9. `network-client.ts` split by transport/publish/reconnect/playback/UI adapter | complete | focused network helpers are split; network parity passes |
| 10. CPU/selfplay boundaries focused or explicitly justified | complete | focused helpers and residual justifications are in the completion report |
| 11. No root TS file uses `@ts-nocheck` | complete | `rg` and `checkall` evidence recorded |
| 12. `checkall` / `typecheck` / `test:network:parity` / `test:jest` pass | complete | all final gates pass |
| 13. `worker:prepare` run if mirror impact exists | complete | `worker:prepare` passed and mirror verified |
| 14. final completion report written | complete | report exists under `docs/plans/` |

## Finish Strategy

The remaining work should be executed in the following order.

The ordering is deliberate:

- finish the largest remaining behavior-preserving split first,
- then close player-facing card/UI surfaces,
- then close network authority/client shells,
- avoid broad validation churn while core files are still moving,
- do the expensive gates only after the remaining large files are either reduced or explicitly justified.

## Phase R1: Finish `game/cpu-decision.ts`

### Self-review update

The earlier immediate-pass list in this plan is now stale: `buildCornerPlanState`, `buildMovePlanContext`, `isCardChoiceAllowedByPlan`, card context/risk/learned/ONNX helpers, and pending ONNX helpers have already been extracted into focused modules with focused tests.

The remaining high-value R1 work is no longer the move-plan cluster or pending-target scoring. Those pieces have already been extracted into focused modules with focused tests.

2026-05-27 self-review update: `scorePendingTargetByType` has been extracted to `game/cpu-decision-pending-score.ts` with focused coverage. R1 should not keep expanding unless inspection finds a clearly isolated pending-action cluster. Otherwise, the remaining `game/cpu-decision.ts` size should be handled as compatibility/orchestration and justified in the completion report.

### Target

- `game/cpu-decision.ts`

### Remaining goal

Confirm the file is no longer an oversized mixed policy/runtime implementation and is acceptable as a compatibility composition root over:

- card action helpers
- pending selection helpers
- plan pressure helpers
- move-plan helpers
- decision context helpers

### Concrete remaining work

1. Confirm `scorePendingTargetByType` remains delegated to `game/cpu-decision-pending-score.ts`.
2. Review whether `choosePendingTargetWithPolicy` and remaining `cpuSelect*WithPolicy` pending action wrappers are real mixed responsibility or compatibility orchestration.
3. Split only a small, clearly private pending-action cluster if the audit proves it is safe.
4. Otherwise record an explicit residual-size justification in the completion report.
5. Preserve `module.exports` API.

### Validation per pass

- `npm run build:ts`
- `npm run typecheck`
- focused CPU Jest:
  - `test/cpu.decision.pending-score.test.ts`
  - `test/cpu.decision.pending-onnx.test.ts`
  - `test/cpu.decision.*`
  - `test/cpu.turn-handler.*`
- `npm run worker:prepare` if browser-facing wrappers are added

### Exit condition

- pending target scoring remains outside `cpu-decision.ts`
- any remaining large `cpu-decision.ts` code is compatibility/orchestration or explicitly justified in the completion report
- exported decision helpers remain compatible

## Phase R2: Finish `game/logic/cards.ts`

### Self-review update

2026-05-27 update: board-shape access helpers were extracted to `game/logic/cards-internal/board-shape-access.ts`, observer turn-start behavior to `game/logic/cards/observer_will.ts`, chain application orchestration to `game/logic/cards/chain.ts`, taboo-reverse choice selection to `game/cards/target-resolver.ts`, and salvation destroyed-ledger helpers to `game/logic/cards-internal/salvation-effect.ts`, each with focused coverage. The file is still above the practical threshold, but the remaining body is mostly facade/dependency wiring. R2 can now move to final justification unless another real card-specific implementation cluster is found.

### Target

- `game/logic/cards.ts`

### Remaining goal

Reduce `cards.ts` to a real facade/state hub by moving the remaining card-specific apply/target/helper families into:

- `game/logic/cards/*`
- `game/logic/cards-internal/*`

### Concrete remaining work

1. Inventory the biggest residual clusters still implemented directly inside `cards.ts`.
2. Extract one family per pass, preserving wrapper exports.
3. Prefer moving:
   - apply-family logic,
   - target-resolution families,
   - reusable pending/effect builders,
   - state/ledger helpers
   before touching compatibility exports.
4. Keep public exports stable; remove wrappers only if reference evidence is explicit.

### Validation per pass

- `npm run build:ts`
- `npm run typecheck`
- focused Jest for the moved card family
- `npm run test:network:parity` only if the moved family affects publish/snapshot behavior

### Exit condition

- `cards.ts` no longer contains large card-specific implementations
- residual size is either under the practical threshold or justified in the final report

## Phase R3: Finish `cards/card-interaction.ts`

### Target

- `cards/card-interaction.ts`

### Self-review update

2026-05-27 update: card detail actions, detail panel, detail tab, hand DOM, overlay selection/view, pending network, and click-buffer concerns have focused modules. The latest passes removed or reduced duplicate detail-tab, hand-DOM, detail-panel, and detail-action fallbacks from `cards/card-interaction.ts`. Continue R3 by removing remaining duplicate fallback bodies or moving still-embedded UI orchestration one concern at a time.

### Remaining goal

Reduce `card-interaction.ts` to public UI actions and wiring. The following concerns must be separately testable:

- card detail UI
- pending selection UI
- input lock / playback gating
- network publish bridge
- hand overlay / selection overlays

### Concrete remaining work

1. Extract remaining detail/update helpers still embedded in `card-interaction.ts`.
2. Extract the remaining input-lock / pass / cancel / playback-gating helpers if they are still mixed with rendering orchestration.
3. Extract any remaining overlay or selection-shell logic that is still only indirectly testable through the main file.
4. Leave `window.*` public actions in the main file until the end.

### Validation per pass

- `npm run build:ts`
- `npm run typecheck`
- focused UI Jest around:
  - detail panel
  - pass stale busy
  - destroy hand
  - heaven / condemn overlays
  - fate-will controlled turn
- `npm run worker:prepare` if a new browser module wrapper is added

### Exit condition

- `card-interaction.ts` is wiring/orchestration only
- every remaining extracted concern has focused tests

## Phase R4: Finish `workers/match-worker.ts` and `ui/network-client.ts`

### Targets

- `workers/match-worker.ts`
- `ui/network-client.ts`

### Remaining goal

Close the last lifecycle/shell gaps so both files are clearly split by responsibility.

### `match-worker.ts` remaining focus

- room lifecycle shell
- stream setup/auth shell is already extracted
- any snapshot orchestration still mixed with transport wiring
- chat handling is already extracted

### `network-client.ts` remaining focus

- remaining publish queue shell if still embedded; publish rejection/version-conflict handling is already extracted
- remaining reconnect/snapshot shell
- playback bridge / UI-facing adapter split if still mixed

### Validation per pass

- `npm run build:ts`
- `npm run typecheck`
- focused Jest for:
  - worker stream/timer/broadcast tests
  - client reconnect/snapshot/transport/playback tests
- `npm run test:network:parity` after each meaningful network pass

### Exit condition

- both files are clearly split by concern
- network parity still passes

### Self-review update

2026-05-27 update: `ui/network-client.ts` now delegates rejected publish snapshot handling, version-conflict classification, telemetry key selection, retry eligibility, and retry payload construction to `ui/network/publish-rejection.ts`. `workers/match-worker.ts` now delegates chat request validation, message persistence, history trimming, chat broadcast payload construction, and SSE stream route setup/auth to focused controllers. This narrows the remaining R4 work to a final shell audit of `ui/network-client.ts` and `workers/match-worker.ts`; do not keep splitting tiny wrappers unless a real lifecycle/snapshot/publish responsibility cluster remains.

## Phase R5: Final CPU/selfplay audit

### Targets

- `game/ai/cpu-policy-core.ts`
- `src/engine/selfplay-runner.ts`
- `training/engine/selfplay-runner.ts`

### Remaining goal

Decide, with evidence, whether these files need one more refactor pass or whether the residual size is acceptable and should be justified in the completion report.

### Rules

- Do not refactor these further just to chase line count.
- Only perform another pass if a real mixed-responsibility cluster still remains and can be split safely.

### Required audit questions

1. Is the remaining code still mixing unrelated responsibilities?
2. Is the remaining size due to facade wiring or due to real unseparated behavior?
3. Are the boundaries now separately testable?
4. Would one more pass materially reduce risk, or only create churn?

### Exit condition

One of the following must be true:

- another small safe pass is completed, or
- the completion report explicitly justifies the residual size with tests proving the boundary

## Phase R6: Final source-of-truth audit

### Targets

- `01-rulebook.md`
- `正本/*.md`
- `docs/architecture-contracts.md`
- `AGENTS.md`

### Goal

Prove that the refactor did not silently drift source-of-truth surfaces.

### Concrete checks

1. Confirm that no player-visible behavior was intentionally changed during refactor-only passes.
2. Confirm that any discovered behavior mismatch was either:
   - fixed separately and documented, or
   - explicitly left out of scope and recorded.
3. Confirm that no generated or mirror file was treated as source.

### Exit condition

- no hidden rulebook drift remains
- any residual mismatch is explicitly documented

## Phase R7: Final hardening gates

This phase starts only after the remaining production passes are finished.

### Current gate evidence

The final gate sequence has started. Current known results:

| Command | Current result |
| --- | --- |
| `rg -n "@ts-nocheck" -g "*.ts"` | no production TS debt found; only script-side string/regex references were reported |
| `npm run build:ts` | passed after the latest wrapper correction |
| `npm run typecheck` | passed after the latest wrapper correction |
| `npm run checkall` | passed after replacing `game/turn/sub-placement-continuation.js` with a TS/dist wrapper |
| `npm run test:network:parity` | passed |
| `npx jest --runInBand --runTestsByPath test/cpu.turn-handler.onnx-hold.test.ts` | passed after test global cleanup |
| `npm run test:jest` | passed: 498 suites passed, 44 skipped; 3249 tests passed, 44 skipped |
| `npm run test:visual` | passed: diff pixels 3569, threshold 4000 |
| `npm run worker:prepare` | passed: build completed and mirror verified 601 files |
| `git diff --check` | passed; only CRLF conversion warnings were reported |

The final gate action is complete. Details are in `docs/plans/complete-core-refactor-completion-report-2026-05-27.md`.

### Required final commands

Run in this order:

1. `rg -n "@ts-nocheck" -g "*.ts"`
2. `npm run build:ts`
3. `npm run typecheck`
4. `npm run checkall`
5. `npm run test:network:parity`
6. `npm run test:jest`
7. `npm run test:visual` because this refactor touched animation, highlight, and DOM playback surfaces; if it cannot run, record the exact blocker in the completion report instead of treating the gate as green
8. `npm run worker:prepare` if any root-to-worker mirror impact remains, then review the generated/mirror diff

### Rules

- Fix failures before moving to the report.
- Do not hand-wave flaky or partial results.
- Record exact failing suites if any gate blocks completion.
- Treat any `@ts-nocheck` hit in production TypeScript as incomplete unless it is removed before completion.
- Do not claim Worker/public mirror sync complete until the post-`worker:prepare` diff is reviewed.

### Exit condition

All required gates are green on the current final state.

## Phase R8: Completion report

### Deliverable

Write a final report under `docs/plans/`.

Recommended filename:

- `docs/plans/complete-core-refactor-completion-report-2026-05-27.md`

### Required contents

1. final target file sizes
2. changed source files by boundary
3. validation commands and results
4. any residual large files and why they were left as-is
5. residual risk
6. intentionally deferred work, if any
7. proof against each master-plan completion item

### Exit condition

The report can survive a requirement-by-requirement audit of the master plan.

## Completion Audit Checklist

Before claiming the goal complete, verify all of the following from current evidence:

1. no target file still violates the completion definition without explicit justification
2. no root production TS file uses `@ts-nocheck`
3. no public import path or public runtime contract changed unintentionally
4. network parity still passes
5. visual regression validation passes, or any inability to run it is documented with the exact blocker
6. browser module registry and Worker mirror are synchronized if impacted
7. every remaining large file is either:
   - below the practical threshold, or
   - justified in the completion report
8. the completion report exists and references actual command output

## Recommended Immediate Next Pass

No required next pass remains for this plan.

Future work should start as a new plan if it is needed:

1. further facade slimming after dynamic/public import references are audited,
2. additional browser screenshot coverage for full-animation paths,
3. a later behavior-spec audit if gameplay rules are intentionally changed.

# Core Refactor Completion Report

Date: 2026-05-27

## Status

`docs/plans/complete-core-refactor-master-plan-2026-05-26.md` and `docs/plans/complete-core-refactor-remaining-plan-2026-05-27.md` are complete.

The refactor reached the master-plan completion definition with the current evidence in this report. Public behavior was preserved except for source-of-truth-backed clarifications and test-harness hardening. The final blocker, `test/e2e/destroy-card-will-hunter-king.e2e.test.ts`, was fixed as a harness settlement issue: the test now clears debug-page playback locks before directly invoking `executeDestroy`, then synchronizes the board through the canonical renderer.

## Final Target Sizes

| Lines | File | Final ownership |
| ---: | --- | --- |
| 1286 | `game/turn/turn_pipeline_phases.ts` | turn-start/action phase orchestration over focused phase modules |
| 3747 | `game/logic/cards.ts` | card-rule facade, compatibility exports, state/context composition |
| 1502 | `game/turn/pipeline_ui_adapter.ts` | playback adapter facade over focused pipeline UI modules |
| 1930 | `ui/animation-engine.ts` | Single Visual Writer playback orchestration and event dispatch |
| 2440 | `cards/card-interaction.ts` | legacy/public card UI action wiring over focused UI modules |
| 2563 | `workers/match-worker.ts` | Durable Object facade over route/controller helpers |
| 2670 | `ui/network-client.ts` | public network client facade over transport/session/snapshot helpers |
| 4832 | `game/cpu-decision.ts` | CPU decision compatibility shell over card/pending/move-plan helpers |
| 2990 | `game/ai/cpu-policy-core.ts` | CPU policy composition shell over focused scoring/search helpers |
| 1831 | `src/engine/selfplay-runner.ts` | root selfplay orchestration over focused runner helpers |
| 1809 | `training/engine/selfplay-runner.ts` | training selfplay orchestration over focused runner helpers |

Line count is not treated as the primary success measure. Files above the practical threshold are justified below because their remaining code is facade, public compatibility, or orchestration code with extracted behavior covered by focused tests.

## Changed Source By Boundary

Turn pipeline:

- `game/turn/turn_pipeline_phases.ts` now delegates turn-start marker, bomb, special-stone, timer, board-charge, sub-placement, and action-phase work into focused `game/turn/*` modules.
- `game/turn/turn_pipeline.ts`, `game/turn/pipeline_ui_adapter.ts`, and `game/turn/pipeline-ui/*` preserve public entry points while moving playback mapping, sound cues, logs, and presentation helpers out of the main adapter.

Card logic:

- `game/logic/cards.ts` remains the facade/state hub.
- Focused modules under `game/logic/cards/` and `game/logic/cards-internal/` own board-shape access, context builders, deck setup, target access, availability, effect target counts, chain behavior, observer behavior, salvation ledger helpers, random board spawn, loss/fate helpers, and related card families.
- `game/cards/target-resolver.ts` owns taboo-reverse choice selection.

Card interaction and presentation:

- `cards/card-interaction.ts` remains the public action/wiring surface.
- `cards/card-interaction-detail-*`, `cards/card-interaction-hand-dom.*`, `cards/card-interaction-overlay-*`, `cards/card-interaction-pending-network.*`, and `cards/card-interaction-click-buffer.*` own the focused UI concerns.
- `ui/animation-engine.ts` delegates event-specific animation behavior to `ui/animation-*-events.ts` helpers while preserving Single Visual Writer behavior.

Network authority:

- `workers/match-worker.ts` remains the Durable Object contract surface.
- Worker route/session/timer/broadcast/chat/leaderboard helpers are split into `workers/match-worker-*` modules.
- `ui/network-client.ts` remains the public client facade.
- `ui/network/*` owns transport, stream session/snapshot, room events, turn timer, playback recovery, and publish rejection/version-conflict handling.

CPU and selfplay:

- `game/cpu-decision.ts` delegates card actions, card context, card risk, learned/ONNX helpers, pending pipeline, pending ONNX, pending scoring, plan pressure, selection flow, and move-plan logic.
- `game/ai/cpu-policy-core.ts` delegates board primitives/features/counts, card profiles, retention, hand destroy, lookahead/search, move selection, and placement profile logic.
- `src/engine/selfplay-runner.ts` and `training/engine/selfplay-runner.ts` delegate board primitives, bootstrap, batch running, policy setup/model, placement, pending actions/targets, card choice/use, simulation choosers, retry handling, and record metadata.

Generated and mirror surfaces:

- `public/module-registry.js` and `worker-public/*` were updated by existing generation/mirror commands, not treated as source.
- `npm run worker:prepare` reported `mirror-verified files=601`.

Instructions and source-of-truth:

- `AGENTS.md` now records `正本/` maintenance rules and final ownership boundaries.
- `docs/architecture-contracts.md` records training-script ownership updates.
- `01-rulebook.md` contains earlier player-visible clarification updates for protection, additional placement, highlights, and input-lock wording.
- `正本/` exists with the detailed desired-behavior notes; no final E2E harness fix required additional `正本/` changes.

## Residual Large File Justifications

`game/logic/cards.ts` remains large because it is still the public facade and compatibility export hub for browser, worker, headless, and tests. The card-specific clusters that were safe to move now live in focused modules with module tests. Further shrinkage would mostly move small compatibility wrappers without reducing behavior risk.

`ui/animation-engine.ts` remains above threshold because it is the Single Visual Writer coordinator. Event-specific handling has been split into focused helpers; keeping one playback coordinator avoids introducing a second board writer.

`cards/card-interaction.ts` remains above threshold because it holds legacy `window.*` actions and wiring. Detail UI, hand DOM, overlays, pending-network bridge, and click-buffer logic are separately testable modules.

`workers/match-worker.ts` remains above threshold because it is the Durable Object contract facade. Routing/session/chat/stream/timer/broadcast/leaderboard helpers are split, while preserving request/response/SSE shape in one public class.

`ui/network-client.ts` remains above threshold because it is the browser public facade that composes transport, snapshot, stream, playback, and publish helpers. Version-conflict and rejection logic is now delegated.

`game/cpu-decision.ts`, `game/ai/cpu-policy-core.ts`, and both selfplay runners remain above threshold because they are compatibility composition roots for many extracted pure helpers. Focused CPU/selfplay tests cover the moved boundaries, and no long training run was required or performed.

## Validation

| Command | Result |
| --- | --- |
| `rg -n "@ts-nocheck" -g "*.ts"` | passed for production debt; hits are only script string/regex references |
| `npm run build:ts` | passed as part of `npm run worker:prepare` |
| `npm run typecheck` | passed |
| `npm run checkall` | passed; `authorized @ts-nocheck debt: 0`, JS inventory gate passed |
| `npm run test:network:parity` | passed: 28 suites, 346 tests |
| `npx jest --runInBand --runTestsByPath test/e2e/destroy-card-will-hunter-king.e2e.test.ts` | passed |
| `npm run test:jest` | passed: 498 suites passed, 44 skipped; 3249 tests passed, 44 skipped |
| `npm run test:visual` | passed; diff pixels 3569, threshold 4000 |
| `npm run worker:prepare` | passed; build completed and mirror verified 601 files |
| `git diff --check` | passed; only CRLF conversion warnings were reported |

## Completion Definition Proof

| Requirement | Evidence |
| --- | --- |
| 1. Public behavior unchanged except approved fixes | Broad Jest, network parity, visual check, and focused characterization suites pass. The final E2E change is harness-only. |
| 2. `01-rulebook.md` / `正本/` aligned | Source-of-truth surfaces were audited. Earlier visible clarifications are in `01-rulebook.md`; final harness fix did not change intended behavior. |
| 3. `turn_pipeline_phases.ts` thin orchestrator | Turn-start and action-phase modules exist under `game/turn/turn-start/*`, `game/turn/action-phase/*`, and related helpers; focused turn-start tests pass. |
| 4. `cards.ts` facade/state hub | Card helper/family modules exist under `game/logic/cards/*` and `game/logic/cards-internal/*`; focused card module tests pass. |
| 5. `pipeline_ui_adapter.ts` split | Pipeline UI modules own sound cues, logs, playback mapping, board-event playback, and phase helpers; adapter tests pass. |
| 6. `animation-engine.ts` orchestration/dispatch | Event-specific animation helpers are split under `ui/animation-*-events.ts`; visual and animation tests pass. |
| 7. `card-interaction.ts` separately testable by concern | Detail, hand DOM, overlay, pending-network, and click-buffer modules have focused tests. |
| 8. `match-worker.ts` split by concern | Worker controllers/helpers exist for API, broadcast, chat, stream, timer, timeout, leaderboard, and session concerns; network parity passes. |
| 9. `network-client.ts` split by concern | Network helpers exist for transport, stream session/snapshot, room events, turn timer, playback recovery, and publish rejection; network parity passes. |
| 10. CPU/selfplay focused or justified | CPU/selfplay helpers are split and covered by focused CPU/selfplay tests; residual shells are justified above. |
| 11. No root production TS `@ts-nocheck` | `rg` plus `checkall` confirm no unauthorized debt. |
| 12. Required gates pass | `checkall`, `typecheck`, `test:network:parity`, and `test:jest` all pass. |
| 13. Worker mirror prepared | `npm run worker:prepare` passed with mirror verification. |
| 14. Completion report written | This file is the final report. |

## Residual Risks

- The worktree is intentionally large because this goal covered a repository-wide refactor. Review should be done by boundary rather than as one conceptual change.
- Several facade files remain above 1,500 lines. This is accepted because further movement would mostly relocate public wrappers or orchestration without reducing risk.
- `git diff --check` reports CRLF conversion warnings from Git settings, but no whitespace errors.
- Visual regression was run in `?debug=1&noanim=1`; it verifies layout/render stability, not every full animation path.

## Deferred Work

No required refactor work remains for this plan.

Optional future work should be treated as new, separate plans:

- further facade slimming after dynamic/public import references are audited,
- additional browser screenshot coverage for full-animation paths,
- a later behavior-spec audit if gameplay rules are intentionally changed.

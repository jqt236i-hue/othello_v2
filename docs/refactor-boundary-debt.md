# Runtime Boundary Refactor Debt

Last audited: 2026-05-22

This note records the remaining high-risk type-safety debt after the runtime boundary contract gates were added.

## Migration safety gate

`npm run checkall` now includes `scripts/check-ts-migration-safety.ts`.
It scans root TypeScript source/test/training targets for top-level `@ts-nocheck` and fails on any file that is not in the current migration debt allowlist.

Current authorized `@ts-nocheck` debt: 45 files.

Recent reduction:

- `utils/deepClone.ts` no longer uses `@ts-nocheck`; it is now a typed CommonJS `export =` helper.
- `src/player.ts` no longer uses `@ts-nocheck`; it now exposes typed player keys, values, and helpers directly.
- `src/protocol/actions.ts` and `src/protocol/events.ts` no longer use `@ts-nocheck`; they now expose typed protocol validators and event factories.
- `src/index.ts` no longer uses `@ts-nocheck`; it is now a typed re-export surface instead of compiled helper output.
- `src/board.ts` no longer uses `@ts-nocheck`; it now exposes typed board constants and board-related shapes directly.
- `utils/match-authority.ts` no longer uses `@ts-nocheck`; its room/publish/SSE/projection/pending-selection helpers now pass TypeScript checking through local record guards and the checked public API contract.
- `cards/catalog.ts` no longer uses generated `@ts-nocheck`; `scripts/generate-catalog.ts` now emits a checked CommonJS TypeScript catalog wrapper.
- `utils/match-runtime-core.ts` no longer uses `@ts-nocheck`; its command publish adapter boundary now has a small fail-closed dependency/result contract.
- `utils/owner-helpers.ts` no longer uses `@ts-nocheck`; owner/seat/layout normalization, local-seat inference, and FATE_WILL controller helpers now have checked boundary types.
- `workers/match-worker-runtime-preload.ts` no longer uses `@ts-nocheck`; Worker runtime preload globals now have an explicit optional module map type.
- `game/logic/cards/sniper.ts` no longer uses `@ts-nocheck`; Sniper Will board expansion helpers, random target selection, and expiry results now have checked local contracts, with the wrapper preventing private implementation types from leaking through the exported effect surface.
- `game/logic/cards/lightning.ts` no longer uses `@ts-nocheck`; Lightning Will expansion targeting, random index selection, anchor expiry, and wrapper export signatures now have checked local contracts.
- `game/logic/cards/destroy_dragon.ts` no longer uses `@ts-nocheck`; Destroy Dragon Will adjacent targeting, expansion-cell fallback, anchor expiry, and wrapper export signatures now have checked local contracts.
- `game/logic/cards/breeding.ts` no longer uses `@ts-nocheck`; Breeding Will frontier/sprout runtime state, expansion-cell fallback, spawn/flip batches, and wrapper export signatures now have checked local contracts.
- `scripts/serve-with-fallback.ts` no longer uses `@ts-nocheck`; its argument parsing, static file listing, retry watcher, and fallback error paths now have checked local contracts.
- `src/engine/engine.ts` no longer uses `@ts-nocheck`; the deterministic test engine now has typed action, state, RNG, and log contracts.
- `scripts/network-endgame-smoke.ts` no longer uses `@ts-nocheck`; its CommonJS module adapters now match the local server and core export style under TypeScript checking.
- `scripts/prepare-worker-assets.ts` no longer uses `@ts-nocheck`; its prepare options, generated optional assets, mirror verification, recursive listing, and default config constants now have checked local contracts.
- `sound-engine.ts` no longer uses `@ts-nocheck`; buffered BGM state defaults now avoid implicit `this` typing and the stale `src/types` import has been removed.
- `cpu/cpu-turn.ts` no longer uses `@ts-nocheck`; the legacy CPU compatibility shim now has typed handler/action boundaries and explicit declarations for its fallback globals.
- `game/debug/debug-actions.ts` no longer uses `@ts-nocheck`; debug-only hand fill and visual-board mutation helpers now have local state, marker adapter, and UMD root contracts.
- `scripts/match-network-smoke.ts` no longer uses `@ts-nocheck`; its local match server adapter, request/response helper, SSE stream reader, board config checks, and publish action shape now have checked smoke-test contracts.
- `scripts/deploy-lane-model-to-root.ts` no longer uses `@ts-nocheck`; root model deploy args, policy model shape, optional artifact copy results, dry-run summary, and deploy manifest are now typed.
- `scripts/local-cpu-commentary-server.ts` no longer uses `@ts-nocheck`; its HTTP response writer, request body parser, and error reporting are now typed without changing fallback commentary behavior.
- `test/cards.equality-will-surfaces.test.ts` no longer uses `@ts-nocheck`; the catalog/help surface regression now typechecks without local suppressions.
- `test/cpu.turn-handler.commentary.test.ts` no longer uses `@ts-nocheck`; the CPU commentary integration regression now typechecks while preserving its global runtime fixture.
- `test/game.equality-will.test.ts` no longer uses `@ts-nocheck`; the EQUALITY_WILL rule regression now typechecks without local suppressions.
- `test/scripts.prepare-worker-assets.test.ts` no longer uses `@ts-nocheck`; the worker mirror preparation regression now typechecks without local suppressions.
- `test/ui.status-display.network-seat.test.ts`, `test/ui.status-display.portrait-bubble.test.ts`, and `test/ui.status-display.round-display.test.ts` no longer use `@ts-nocheck`; status display UI regressions now typecheck without local suppressions.
- `test/ui.layout-stage.profile-selection.test.ts` and `test/ui.network-charge-seat-layout.test.ts` no longer use `@ts-nocheck`; layout profile and network charge layout regressions now typecheck without local suppressions.
- `test/ui.card-renderer-hand-inspect.test.ts`, `test/ui.card-ui-sync.test.ts`, and `test/ui.deck-builder-controller.test.ts` no longer use `@ts-nocheck`; remaining UI test regressions now typecheck without local suppressions.
- `training/tests/selfplay.generate-data.parallel-workers.test.ts`, `training/tests/selfplay.generate-data.test.ts`, `training/tests/selfplay.runner.test.ts`, `training/tests/selfplay.training-cycle.test.ts`, and `training/tests/selfplay.training-preset.test.ts` no longer use `@ts-nocheck`; selfplay/training regressions now typecheck without local suppressions.
- `training/scripts/training-shared-teacher-args.ts` no longer uses `@ts-nocheck`; shared teacher CLI argument synchronization now typechecks without local suppressions.
- `training/scripts/selfplay-deck-options.ts` no longer uses `@ts-nocheck`; selfplay deck-code option helpers now typecheck without local suppressions.
- `training/scripts/training-artifact-status.ts` no longer uses `@ts-nocheck`; training artifact lifecycle and checkpoint compatibility classification now typechecks without local suppressions.

Recent boundary typing:

- `utils/match-authority-types.ts` now includes `MatchAuthorityRoomState`, operation history, room payload-from-room options, snapshot projection, join, and leave result types. `utils/match-authority-contract.ts` now requires the room/snapshot/presence/heartbeat/publish payload helpers, projection helpers, join helper, and leave helper to exist on the exported authority object.
- `utils/match-authority.ts` now uses those room/projection/payload types on the payload-from-room, snapshot projection, join, and leave helper implementations, reducing the untyped surface that must be fixed before removing its `@ts-nocheck`.
- `utils/match-authority.ts` also now exposes typed accepted-operation history helpers and seat-token authentication helpers through `MatchAuthorityPublicApi`, with implementation annotations for those clusters.
- `utils/match-authority.ts` now uses typed optional CommonJS adapters for shared board/catalog/hash helpers and typed room/token/seat metadata utility helpers; its no-`@ts-nocheck` diagnostics are now 0 and the file has been removed from the migration safety allowlist.
- `workers/match-worker-types.ts` now includes Worker room, SSE stream, prepared snapshot, leaderboard store, runtime module, deck preload, turn pipeline adapter, PRNG, Core, CardLogic, playback assembly, publish payload option, snapshot/presence metadata, room deck metadata, room creation, turn timer/timeout, and leaderboard entry boundary types. `workers/match-worker.ts` now declares Durable Object state/room/stream fields, types its initial MatchAuthority proxy helpers, narrows Worker module loaders, and types leaderboard, turn-start, playback assembly, command publish, room deck, snapshot projection, route forwarding, SSE buffering, room creation, turn timer, timeout-pass, join, leave, hand-skin, publish, stream, state, fetch, and chat helper boundaries. Its UMD-style helper imports now pass through typed CommonJS import adapters, its no-`@ts-nocheck` diagnostics are now 0, and the file has been removed from the migration safety allowlist.
- `game/ai/cpu-policy-core-types.ts` now includes board, move position, legal move metrics, board-bonus callback, and lookahead search metadata types; its public API signatures now match the runtime `computeLegalMoveMetrics` and `scoreMoveHeuristic` call shapes. `game/ai/cpu-policy-core.ts` now reuses those card id/cost/definition/context/score/API/search types for card-use, retention, move scoring, and lookahead helper boundaries. Its no-`@ts-nocheck` diagnostics are now 0, and the file has been removed from the migration safety allowlist.

## Current protected boundaries

The following public boundary contracts are now represented by explicit TypeScript types and guarded by `npm run checkall` through `scripts/check-refactor-safety.ts`.

| Boundary | Contract file | Checked adapter / assertion | Runtime source | Focused test |
| --- | --- | --- | --- | --- |
| Match authority publish/SSE/room/snapshot payloads | `utils/match-authority-types.ts` | `utils/match-authority-contract.ts` | `utils/match-authority.ts` | `test/utils.match-authority.contract-types.test.ts` |
| CPU policy public API and move/search metrics | `game/ai/cpu-policy-core-types.ts` | `game/ai/cpu-policy-core-api.ts` | `game/ai/cpu-policy-core.ts` | `test/game.cpu-policy-core.contract-types.test.ts` |
| Match Worker public runtime entrypoints | `workers/match-worker-types.ts` | `workers/match-worker-contract.ts` | `workers/match-worker.ts` | `test/workers.match-worker.contract-types.test.ts` |

## Remaining `@ts-nocheck`

These files still keep `@ts-nocheck` because removing it currently exposes broad legacy typing debt rather than a small local fix. As of this audit, no high-risk runtime boundary file remains in this section; remaining authorized debt is in card modules, scripts, training utilities, UI tests, and other compatibility surfaces tracked by `scripts/check-ts-migration-safety.ts`.

Diagnostic counts were measured by running TypeScript with only the first-line `@ts-nocheck` removed in memory.

## Next removal conditions

Remove `@ts-nocheck` only after the relevant narrower models exist and the diagnostic count is small enough to review safely.

1. Continue reducing the remaining authorized allowlist in `scripts/check-ts-migration-safety.ts`, prioritizing production runtime files before tests and one-off training scripts.

Until those conditions are met, `scripts/check-refactor-safety.ts` should keep preventing new `@ts-nocheck` in high-risk targets and keep requiring each public boundary to route exports through checked contract adapters or assertions outside the legacy implementation body.

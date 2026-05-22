# Runtime Boundary Refactor Debt

Last audited: 2026-05-22

This note records the remaining high-risk type-safety debt after the runtime boundary contract gates were added.

## Migration safety gate

`npm run checkall` now includes `scripts/check-ts-migration-safety.ts`.
It scans root TypeScript source/test/training targets for top-level `@ts-nocheck` and fails on any file that is not in the current migration debt allowlist.

Current authorized `@ts-nocheck` debt: 85 files.

Recent reduction:

- `utils/deepClone.ts` no longer uses `@ts-nocheck`; it is now a typed CommonJS `export =` helper.
- `src/player.ts` no longer uses `@ts-nocheck`; it now exposes typed player keys, values, and helpers directly.
- `src/protocol/actions.ts` and `src/protocol/events.ts` no longer use `@ts-nocheck`; they now expose typed protocol validators and event factories.
- `src/index.ts` no longer uses `@ts-nocheck`; it is now a typed re-export surface instead of compiled helper output.
- `src/board.ts` no longer uses `@ts-nocheck`; it now exposes typed board constants and board-related shapes directly.
- `utils/match-authority.ts` no longer uses `@ts-nocheck`; its room/publish/SSE/projection/pending-selection helpers now pass TypeScript checking through local record guards and the checked public API contract.

Recent boundary typing:

- `utils/match-authority-types.ts` now includes `MatchAuthorityRoomState`, operation history, room payload-from-room options, snapshot projection, join, and leave result types. `utils/match-authority-contract.ts` now requires the room/snapshot/presence/heartbeat/publish payload helpers, projection helpers, join helper, and leave helper to exist on the exported authority object.
- `utils/match-authority.ts` now uses those room/projection/payload types on the payload-from-room, snapshot projection, join, and leave helper implementations, reducing the untyped surface that must be fixed before removing its `@ts-nocheck`.
- `utils/match-authority.ts` also now exposes typed accepted-operation history helpers and seat-token authentication helpers through `MatchAuthorityPublicApi`, with implementation annotations for those clusters.
- `utils/match-authority.ts` now uses typed optional CommonJS adapters for shared board/catalog/hash helpers and typed room/token/seat metadata utility helpers; its no-`@ts-nocheck` diagnostics are now 0 and the file has been removed from the migration safety allowlist.
- `workers/match-worker-types.ts` now includes Worker room, SSE stream, prepared snapshot, leaderboard store, runtime module, deck preload, turn pipeline adapter, PRNG, Core, CardLogic, playback assembly, publish payload option, snapshot/presence metadata, room deck metadata, and leaderboard entry boundary types. `workers/match-worker.ts` now declares Durable Object state/room/stream fields, types its initial MatchAuthority proxy helpers, narrows Worker module loaders, and types leaderboard, turn-start, playback assembly, command publish, room deck, snapshot projection, and route forwarding helper boundaries, reducing its no-`@ts-nocheck` diagnostics from 468 to 104.
- `game/ai/cpu-policy-core-types.ts` now includes board, move position, legal move metrics, board-bonus callback, and lookahead search metadata types; its public API signatures now match the runtime `computeLegalMoveMetrics` and `scoreMoveHeuristic` call shapes.

## Current protected boundaries

The following public boundary contracts are now represented by explicit TypeScript types and guarded by `npm run checkall` through `scripts/check-refactor-safety.ts`.

| Boundary | Contract file | Checked adapter / assertion | Runtime source | Focused test |
| --- | --- | --- | --- | --- |
| Match authority publish/SSE/room/snapshot payloads | `utils/match-authority-types.ts` | `utils/match-authority-contract.ts` | `utils/match-authority.ts` | `test/utils.match-authority.contract-types.test.ts` |
| CPU policy public API and move/search metrics | `game/ai/cpu-policy-core-types.ts` | `game/ai/cpu-policy-core-api.ts` | `game/ai/cpu-policy-core.ts` | `test/game.cpu-policy-core.contract-types.test.ts` |
| Match Worker public runtime entrypoints | `workers/match-worker-types.ts` | `workers/match-worker-contract.ts` | `workers/match-worker.ts` | `test/workers.match-worker.contract-types.test.ts` |

## Remaining `@ts-nocheck`

These files still keep `@ts-nocheck` because removing it currently exposes broad legacy typing debt rather than a small local fix.

| File | Diagnostics without `@ts-nocheck` | Main categories | Why it remains |
| --- | ---: | --- | --- |
| `workers/match-worker.ts` | 104 | non-module UMD imports, implicit Durable Object method parameters, dynamic storage/env shapes, nullable room state inside methods | Worker entrypoints now pass through checked contract assertions, and Durable Object state/room/SSE fields, initial MatchAuthority proxy helpers, Worker preload modules, turn pipeline adapters, leaderboard storage, turn-start helpers, playback assembly, command publish helpers, room deck metadata, snapshot projection, and route forwarding helpers are typed. Remaining work is concentrated in Durable Object method internals, SSE buffering, request handlers, pass/rematch publish paths, and UMD-style shared imports. |
| `game/ai/cpu-policy-core.ts` | 407 | implicit parameters, legacy helper arity, nullable search context | Public CPU policy API now passes through a checked adapter; RNG, board, move, legal metric, and lookahead callback shapes are typed, but internal card-decision and search helper bodies still need annotations before full checking is safe. |

Diagnostic counts were measured by running TypeScript with only the first-line `@ts-nocheck` removed in memory.

## Next removal conditions

Remove `@ts-nocheck` only after the relevant narrower models exist and the diagnostic count is small enough to review safely.

1. `workers/match-worker.ts`: reuse the match authority room/publish types for Durable Object storage, route bodies, and response helpers; then type `handlePublish` and stream handling before the whole class.
2. `game/ai/cpu-policy-core.ts`: reuse the new board/move/metric/search metadata types and add internal `CpuPolicyDecisionContext` plus search result types; then type card selection helpers separately from lookahead search.

Until those conditions are met, `scripts/check-refactor-safety.ts` should keep preventing new `@ts-nocheck` in high-risk targets and keep requiring each public boundary to route exports through checked contract adapters or assertions outside the legacy implementation body.

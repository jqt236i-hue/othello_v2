# Runtime Boundary Refactor Debt

Last audited: 2026-05-22

This note records the remaining high-risk type-safety debt after the runtime boundary contract gates were added.

## Migration safety gate

`npm run checkall` now includes `scripts/check-ts-migration-safety.ts`.
It scans root TypeScript source/test/training targets for top-level `@ts-nocheck` and fails on any file that is not in the current migration debt allowlist.

Current authorized `@ts-nocheck` debt: 86 files.

Recent reduction:

- `utils/deepClone.ts` no longer uses `@ts-nocheck`; it is now a typed CommonJS `export =` helper.
- `src/player.ts` no longer uses `@ts-nocheck`; it now exposes typed player keys, values, and helpers directly.
- `src/protocol/actions.ts` and `src/protocol/events.ts` no longer use `@ts-nocheck`; they now expose typed protocol validators and event factories.
- `src/index.ts` no longer uses `@ts-nocheck`; it is now a typed re-export surface instead of compiled helper output.
- `src/board.ts` no longer uses `@ts-nocheck`; it now exposes typed board constants and board-related shapes directly.

Recent boundary typing:

- `utils/match-authority-types.ts` now includes `MatchAuthorityRoomState`, operation history, room payload-from-room options, snapshot projection, join, and leave result types. `utils/match-authority-contract.ts` now requires the room/snapshot/presence/heartbeat/publish payload helpers, projection helpers, join helper, and leave helper to exist on the exported authority object.

## Current protected boundaries

The following public boundary contracts are now represented by explicit TypeScript types and guarded by `npm run checkall` through `scripts/check-refactor-safety.ts`.

| Boundary | Contract file | Checked adapter / assertion | Runtime source | Focused test |
| --- | --- | --- | --- | --- |
| Match authority publish/SSE/room/snapshot payloads | `utils/match-authority-types.ts` | `utils/match-authority-contract.ts` | `utils/match-authority.ts` | `test/utils.match-authority.contract-types.test.ts` |
| CPU policy public API | `game/ai/cpu-policy-core-types.ts` | `game/ai/cpu-policy-core-api.ts` | `game/ai/cpu-policy-core.ts` | `test/game.cpu-policy-core.contract-types.test.ts` |
| Match Worker public runtime entrypoints | `workers/match-worker-types.ts` | `workers/match-worker-contract.ts` | `workers/match-worker.ts` | `test/workers.match-worker.contract-types.test.ts` |

## Remaining `@ts-nocheck`

These files still keep `@ts-nocheck` because removing it currently exposes broad legacy typing debt rather than a small local fix.

| File | Diagnostics without `@ts-nocheck` | Main categories | Why it remains |
| --- | ---: | --- | --- |
| `utils/match-authority.ts` | 225 | implicit parameters, loose object properties, dynamic indexing | Publish/SSE/room/snapshot public payload helpers now pass through a checked public API assertion, but internal helper bodies still need parameter annotations and narrower local object guards before full checking is safe. |
| `workers/match-worker.ts` | 468 | implicit parameters, loose room properties, dynamic storage/env shapes | Worker entrypoints now pass through checked contract assertions, but Durable Object room state, storage values, and request bodies need a shared schema before full checking is safe. |
| `game/ai/cpu-policy-core.ts` | 407 | implicit parameters, legacy helper arity, nullable search context | Public CPU policy API now passes through a checked adapter and RNG accepts only `{ random() }`, but the internal card-decision and lookahead helpers need typed board/move/context models before full checking is safe. |

Diagnostic counts were measured by running TypeScript with only the first-line `@ts-nocheck` removed in memory.

## Next removal conditions

Remove `@ts-nocheck` only after the relevant narrower models exist and the diagnostic count is small enough to review safely.

1. `utils/match-authority.ts`: reuse the new `MatchAuthorityRoomState`, projection, and publish payload types to annotate one implementation cluster at a time: payload builders, SSE buffer, seat auth, snapshot projection.
2. `workers/match-worker.ts`: reuse the match authority room/publish types for Durable Object storage, route bodies, and response helpers; then type `handlePublish` and stream handling before the whole class.
3. `game/ai/cpu-policy-core.ts`: add internal `CpuPolicyDecisionContext`, board cell, move metric, and search result types; then type card selection helpers separately from lookahead search.

Until those conditions are met, `scripts/check-refactor-safety.ts` should keep preventing new `@ts-nocheck` in high-risk targets and keep requiring each public boundary to route exports through checked contract adapters or assertions outside the legacy implementation body.

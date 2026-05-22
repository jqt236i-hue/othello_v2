# Runtime Boundary Refactor Debt

Last audited: 2026-05-22

This note records the remaining high-risk type-safety debt after the runtime boundary contract gates were added.

## Current protected boundaries

The following public boundary contracts are now represented by explicit TypeScript types and guarded by `npm run checkall` through `scripts/check-refactor-safety.ts`.

| Boundary | Contract file | Runtime source | Focused test |
| --- | --- | --- | --- |
| Match authority publish/SSE payloads | `utils/match-authority-types.ts` | `utils/match-authority.ts` | `test/utils.match-authority.contract-types.test.ts` |
| CPU policy public API | `game/ai/cpu-policy-core-types.ts` | `game/ai/cpu-policy-core.ts` | `test/game.cpu-policy-core.contract-types.test.ts` |
| Match Worker public runtime entrypoints | `workers/match-worker-types.ts` | `workers/match-worker.ts` | `test/workers.match-worker.contract-types.test.ts` |

## Remaining `@ts-nocheck`

These files still keep `@ts-nocheck` because removing it currently exposes broad legacy typing debt rather than a small local fix.

| File | Diagnostics without `@ts-nocheck` | Main categories | Why it remains |
| --- | ---: | --- | --- |
| `utils/match-authority.ts` | 225 | implicit parameters, loose object properties, dynamic indexing | Publish/SSE public payloads are now typed, but the internal room/snapshot helper graph still needs shared room-state and projection types before full checking is safe. |
| `workers/match-worker.ts` | 468 | implicit parameters, loose room properties, dynamic storage/env shapes | Worker entrypoints are now typed, but Durable Object room state, storage values, and request bodies need a shared schema before full checking is safe. |
| `game/ai/cpu-policy-core.ts` | 408 | implicit parameters, legacy helper arity, nullable search context | Public CPU policy API is now typed, but the internal card-decision and lookahead helpers need typed board/move/context models before full checking is safe. |

Diagnostic counts were measured by running TypeScript with only the first-line `@ts-nocheck` removed in memory.

## Next removal conditions

Remove `@ts-nocheck` only after the relevant narrower models exist and the diagnostic count is small enough to review safely.

1. `utils/match-authority.ts`: introduce shared `MatchRoomState`, `MatchSnapshotProjection`, and publish body/result types, then type one cluster at a time: payload builders, SSE buffer, seat auth, snapshot projection.
2. `workers/match-worker.ts`: reuse the match authority room/publish types for Durable Object storage, route bodies, and response helpers; then type `handlePublish` and stream handling before the whole class.
3. `game/ai/cpu-policy-core.ts`: add internal `CpuPolicyDecisionContext`, board cell, move metric, and search result types; then type card selection helpers separately from lookahead search.

Until those conditions are met, `scripts/check-refactor-safety.ts` should keep preventing new `@ts-nocheck` in high-risk targets and keep requiring each public boundary to route exports through its contract type.

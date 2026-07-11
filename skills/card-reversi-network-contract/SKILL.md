---
name: card-reversi-network-contract
description: Preserve Card Reversi server authority, client reconciliation, presentation ordering, and Worker/local/browser/headless parity while diagnosing, implementing, reviewing, or testing network changes. Use for match commands, publish payloads, snapshots, stateVersion or operationId handling, SSE, reconnect, seat tokens, pending selections, playback reconciliation, Worker or local-server behavior, network-visible card effects, mirror preparation, and network deployment work in the card-reversi repository.
---

# Card Reversi Network Contract

Trace every network change across the full action-to-presentation lifecycle while keeping the server snapshot authoritative and runtime-specific code at the boundary.

## Establish the working boundary

1. Run `git status --short` before editing. Preserve unrelated or unknown changes and do not regenerate over another task's mirror output.
2. Read root `AGENTS.md`, `docs/architecture-contracts.md`, and the nested `AGENTS.md` files for every touched area. At minimum, inspect `workers/AGENTS.md` and `ui/network/AGENTS.md`; include `scripts/AGENTS.md`, `utils/AGENTS.md`, `game/card-effects/AGENTS.md`, or other local guidance as applicable.
3. Read `01-rulebook.md` and the relevant `正本/*.md` before changing player-visible behavior, timing, prompts, card outcomes, or network presentation.
4. Treat root source as canonical and `worker-public/` as a generated mirror.

## Preserve the invariants

- Let Worker/local authority decide canonical match state, version progression, command acceptance, and public projection.
- Never promote preview, `snapshot-runtime.ts`, playback locks, busy flags, timestamps, or arrival order into gameplay authority.
- Evolve `seat token`, `stateVersion`, `operationId`, idempotency, SSE, heartbeat, reconnect, and projection together when their contract is affected.
- Pass inbound state through canonical snapshot inspection and accept canonical state independently from visual playback progress.
- Treat presentation frames as ordered replay instructions keyed by `visualSeq`, with `stateVersionFrom` and `stateVersionTo` describing the authoritative transition. Do not treat frame metadata as gameplay authority.
- Keep canonical state and render-facing visual state separate: `presentation-timeline.ts` owns contiguous visual cursor order, and `visual-state-store.ts` owns render-facing state selection.
- Preserve unresolved playback and ordered `events[]`; keep the Single Visual Writer in control of the board. Let `playback-state-manager.ts` own playback-lock, busy settlement, and exact `visualSeq` settlement.
- Keep pending-selection publish behind the UI/network signal bridge. Do not make headless selection flow discover a root `NetworkMatchClient`.
- Keep Worker and local-server outcomes aligned through shared helpers. Do not repair them with parallel implementations.
- Fail explicitly when authority-critical dependencies or metadata are missing. Do not add success-shaped fallbacks.
- Treat `/api/match/state` as the full authoritative recovery path when buffered SSE replay cannot prove continuity.
- Force reconciliation when equal-version projection-safe hashes differ; numeric version equality alone is not proof of identical authority state.
- Use authority PRNG state for canonical randomness. Let browser preview mirror an outcome only; never let ambient browser `Math.random()` define it.
- Keep anonymous identity secrets out of room state, snapshots, SSE, projection metadata, diagnostics payloads, and ranking records. Treat hidden-card placeholder tokens as presentation values; use the authority selector such as `handIndex` instead of placeholder identity.

## Classify the change

Select every affected surface before editing.

| Surface | Start with | Check together |
| --- | --- | --- |
| Command validation or state mutation | `shared/network-action-schema.ts`, `utils/match-command-runtime.ts`, `utils/match-authority.ts`, and canonical game APIs | Worker adapter, local-server adapter, version increment, rejection shape, idempotency, public projection. |
| Publish request or response | `ui/network/publish-request.ts`, `publish-tracker.ts`, `command-payload.ts` | `operationId`, base version, self-publish tracking, retry/duplicate behavior, server response and SSE convergence. |
| Snapshot validation or canonical apply | `ui/network/snapshot-canonical.ts`, `snapshot.ts`, `apply-coordinator.ts` | stale/equal/new version handling, projection-safe hash differences, response-vs-stream races, canonical apply, and recovery precedence. |
| Reconnect, leave, or identity | `ui/network/reconnect-controller.ts`, session modules, authority token helpers | token revocation, seat identity, heartbeat, room lifecycle, version recovery, projection privacy. |
| Pending card selection | `game/card-effects/selection-flow.ts`, pending coordinator, action bridge | publish signal, pending effect ID, target validation, CPU handoff, snapshot reconciliation, end-turn ordering. |
| Presentation frame or journal | `shared/network-presentation-frame.ts`, `utils/match-authority/presentation-journal.ts`, Worker/local adapters | contiguous `visualSeq`, version transition, seat-specific `snapshotAfter`, journal retention/base snapshot, replay cursor, privacy, and response/SSE parity. |
| Visual timeline, sound, or board settlement | `ui/network/presentation-timeline.ts`, `visual-state-store.ts`, `snapshot-presentation.ts`, `ui/playback-state-manager.ts` | contiguous frame order, canonical-vs-visual state separation, transient queue capture/restore/reconciliation only in snapshot-presentation, dedupe keys, board writer ownership, exact visual settlement, and final sync. |
| Worker runtime/static surface | root sources, preload registry, asset preparation scripts | build output, preload validation, mirror lifecycle, bundle smoke, deploy path. |

## Trace the lifecycle

Before implementing, write down or inspect this chain for the affected operation:

```text
UI/game action
  -> command payload and operationId
  -> Worker/local authority validation
  -> canonical mutation and stateVersion
  -> player/spectator projection
  -> presentation journal frame and visualSeq
  -> publish response and/or SSE
  -> canonical snapshot inspection and immediate canonical apply
  -> contiguous visual timeline
  -> render-facing visual state and ordered playback
  -> exact visualSeq settlement and final authoritative sync
```

Locate the existing helper or bridge at each affected edge. If an edge has no owner, add the smallest boundary API rather than reaching across layers.

## Implement

1. Change the shared or canonical authority contract first when Worker and local server need the same behavior.
2. Keep transport adapters limited to request parsing, authentication, response/SSE transport, and runtime wiring.
3. Update projection and privacy rules with the mutation that creates the state; test different seats and spectators when visibility differs.
4. Update client inspection and reconciliation for any schema, hash, version, cursor, or frame-contract change.
5. Feed presentation from canonical events/frames without making playback completion decide the result. Advance visual state only through contiguous frames.
6. Add or update the narrowest durable contract test for an uncovered failure mode.
7. Generate the Worker mirror only through repository scripts after source checks pass.

For diagnosis or review requests, stop after evidence-backed findings unless the user also authorized implementation.

## Verify by affected surface

Run focused tests first, then the contract bundle when the change crosses a network boundary.

| Change | Verification |
| --- | --- |
| Shared authority helper or command | Focused `test/utils.match-authority*`, command-runtime, Worker, and local-server tests; then `npm run test:match:parity` or `npm run test:network:parity` as appropriate. |
| Publish, snapshot, reconnect, pending, or presentation | Focused `test/ui.network*` and `test/network*` coverage plus `npm run test:network:parity`. |
| Presentation journal or frame schema | Include `test/shared.network-presentation-frame.test.ts`, `test/utils.match-authority.presentation-journal.test.ts`, `test/local-match-server.presentation-journal.test.ts`, `test/workers.match-presentation-journal.test.ts`, and `npm run test:network:parity`. |
| Visual timeline or visual state | Include `test/ui.network-presentation-timeline.test.ts`, both visual-state-store tests, `test/ui.board-renderer.visual-state.test.ts`, `test/ui.presentation-handler.strict-network.test.ts`, and `test/ui.network-visual-settlement.test.ts`; then run `npm run test:network:parity`. |
| API/SSE lifecycle | Include `npm run match:check`; use the smallest browser/network smoke when UI settlement matters. |
| Headless boundary | Include `npm run check:window` and the dependency-boundary check when dependency direction changes. |
| Browser-loaded root source | After focused checks, run `npm run build:browser` when the change affects browser behavior or display; inspect `public/module-registry.js` and cachebuster diffs. |
| Generated network runtime surface | Run `npm run check:generated-network-surface` when Worker source structure or generated registry coverage changes. |
| Root source served by Worker | Run standalone `npm run worker:prepare` to generate the mirror, then `npm run check:worker-mirror`, unless the next command is `worker:dev` or `worker:deploy`. Inspect generated diffs. |
| Deployment explicitly requested | Use `npm run worker:deploy`, which prepares the mirror and runs bundle smoke before Wrangler deployment. Verify create/join/authenticated state/leave and the requested reconnect or gameplay scenario. |

Use `npm run typecheck` or `npm run build:ts` when the touched TypeScript path requires it. Run newly relevant focused tests explicitly even when the parity bundle passes; verify whether a durable cross-runtime test belongs in the package-script bundle. Do not substitute a passing focused test for cross-runtime parity when schema, authority, snapshot, reconnect, or presentation contracts changed.

## Finish

1. Run `git status --short` and inspect the task-owned diff, including generated/mirror output.
2. Confirm Worker/local/browser/headless behavior is intentionally equivalent or document a projection-only difference.
3. Commit only task-owned files after appropriate verification.
4. Report the authoritative behavior, focused and parity commands with results, smoke/deploy actions, mirror status, and any residual race or compatibility risk.

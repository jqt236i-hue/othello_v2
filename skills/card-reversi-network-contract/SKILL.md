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
- Pass inbound state through canonical snapshot inspection before runtime or presentation application.
- Preserve unresolved playback and ordered `events[]`; keep the Single Visual Writer in control of the board.
- Keep pending-selection publish behind the UI/network signal bridge. Do not make headless selection flow discover a root `NetworkMatchClient`.
- Keep Worker and local-server outcomes aligned through shared helpers. Do not repair them with parallel implementations.
- Fail explicitly when authority-critical dependencies or metadata are missing. Do not add success-shaped fallbacks.

## Classify the change

Select every affected surface before editing.

| Surface | Start with | Check together |
| --- | --- | --- |
| Command validation or state mutation | shared match command/authority helpers and canonical game APIs | Worker adapter, local-server adapter, version increment, rejection shape, idempotency, public projection. |
| Publish request or response | `ui/network/publish-request.ts`, `publish-tracker.ts`, `command-payload.ts` | `operationId`, base version, self-publish tracking, retry/duplicate behavior, server response and SSE convergence. |
| Snapshot validation or apply | `ui/network/snapshot-canonical.ts`, `snapshot.ts`, `apply-coordinator.ts` | stale/equal/new version handling, response-vs-stream races, baseline selection, runtime apply, presentation reconciliation. |
| Reconnect, leave, or identity | `ui/network/reconnect-controller.ts`, session modules, authority token helpers | token revocation, seat identity, heartbeat, room lifecycle, version recovery, projection privacy. |
| Pending card selection | `game/card-effects/selection-flow.ts`, pending coordinator, action bridge | publish signal, pending effect ID, target validation, CPU handoff, snapshot reconciliation, end-turn ordering. |
| Playback, sound, or board settlement | canonical event assembly, `snapshot-presentation.ts`, animation/playback surfaces | event order, dedupe keys, presentation journal/artifacts, board writer ownership, final authoritative sync. |
| Worker runtime/static surface | root sources, preload registry, asset preparation scripts | build output, preload validation, mirror lifecycle, bundle smoke, deploy path. |

## Trace the lifecycle

Before implementing, write down or inspect this chain for the affected operation:

```text
UI/game action
  -> command payload and operationId
  -> Worker/local authority validation
  -> canonical mutation and stateVersion
  -> player/spectator projection
  -> publish response and/or SSE
  -> canonical snapshot inspection
  -> apply coordination
  -> ordered presentation playback
  -> final authoritative board sync
```

Locate the existing helper or bridge at each affected edge. If an edge has no owner, add the smallest boundary API rather than reaching across layers.

## Implement

1. Change the shared or canonical authority contract first when Worker and local server need the same behavior.
2. Keep transport adapters limited to request parsing, authentication, response/SSE transport, and runtime wiring.
3. Update projection and privacy rules with the mutation that creates the state; test different seats and spectators when visibility differs.
4. Update client inspection and reconciliation for any schema or version-contract change.
5. Feed presentation from canonical events/artifacts without making playback completion decide the result.
6. Add or update the narrowest durable contract test for an uncovered failure mode.
7. Generate the Worker mirror only through repository scripts after source checks pass.

For diagnosis or review requests, stop after evidence-backed findings unless the user also authorized implementation.

## Verify by affected surface

Run focused tests first, then the contract bundle when the change crosses a network boundary.

| Change | Verification |
| --- | --- |
| Shared authority helper or command | Focused `test/utils.match-authority*`, command-runtime, Worker, and local-server tests; then `npm run test:match:parity` or `npm run test:network:parity` as appropriate. |
| Publish, snapshot, reconnect, pending, or presentation | Focused `test/ui.network*` and `test/network*` coverage plus `npm run test:network:parity`. |
| API/SSE lifecycle | Include `npm run match:check`; use the smallest browser/network smoke when UI settlement matters. |
| Headless boundary | Include `npm run check:window` and the dependency-boundary check when dependency direction changes. |
| Root source served by Worker | Run standalone `npm run worker:prepare` to generate or verify the mirror, unless the next command is `worker:dev` or `worker:deploy`. Inspect generated diffs. |
| Deployment explicitly requested | Use `npm run worker:deploy`, which prepares the mirror and runs bundle smoke before Wrangler deployment. Verify create/join/authenticated state/leave and the requested reconnect or gameplay scenario. |

Use `npm run typecheck` or `npm run build:ts` when the touched TypeScript path requires it. Do not substitute a passing focused test for cross-runtime parity when schema, authority, snapshot, reconnect, or presentation contracts changed.

## Finish

1. Run `git status --short` and inspect the task-owned diff, including generated/mirror output.
2. Confirm Worker/local/browser/headless behavior is intentionally equivalent or document a projection-only difference.
3. Commit only task-owned files after appropriate verification.
4. Report the authoritative behavior, focused and parity commands with results, smoke/deploy actions, mirror status, and any residual race or compatibility risk.

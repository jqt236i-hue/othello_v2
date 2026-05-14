# ui/network/ AGENTS.md

Network client submodules behind `ui/network-client.ts`. The server / Worker snapshot is authoritative; this directory derives, reconciles, and presents client state.

## Where to look

| Task | Start here | Notes |
| --- | --- | --- |
| Snapshot validation / versioning | `snapshot-canonical.ts` | Normalize seat keys, metadata, charge deltas, and authority rejection. |
| Runtime apply path | `snapshot.ts`, `snapshot-runtime.ts`, `apply-coordinator.ts` | Resolve stream-vs-response races by `stateVersion` / `operationId`, not arrival order. |
| Presentation reconciliation | `snapshot-presentation.ts` | Preserve playback queues and Single Visual Writer ownership. |
| Publish flow | `publish-request.ts`, `publish-tracker.ts`, `command-payload.ts` | Keep self-publish tracking and payload shape in one path. |
| Local action bridge | `action-bridge.ts` | Adapt UI/game actions into network commands without making client state authoritative. |
| Reconnect / session state | `reconnect-controller.ts`, `session-lifecycle.ts`, `session-seat.ts` | Seat token, reconnect, leave, and local identity logic. |
| Network commentary | `commentary.ts` | Annotation only; never mutate game state from commentary. |

## Local contracts

- `network-client.ts` is the compatibility shell. Put new logic in this directory unless the shell contract itself changes.
- Inbound data must pass through canonical snapshot inspection before touching runtime or presentation state.
- Self-published actions can be queued optimistically, but final application comes from server response / snapshot reconciliation.
- Presentation queue repair must not skip unresolved playback, clear another writer's work, or reorder `events[]`.

## Anti-patterns

- Do not treat `snapshot-runtime.ts` as move authority.
- Do not apply snapshots without checking current baseline/version metadata.
- Do not bypass `publish-tracker.ts` for local player actions.
- Do not solve stream/response races with timestamps alone.
- Do not let reconnect code fabricate a successful session when seat/version contracts are missing.

## Verification

- Contract bundle: `npm run test:network:parity`.
- Focused tests: `test/ui.network*.test.*`, `test/network.*.test.*`, and local server/worker contract tests when payloads change.
- TypeScript changes: `npm run typecheck` and `npm run build:ts`.
- Mirror impact: `npm run worker:prepare`.

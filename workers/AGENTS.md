# workers/ AGENTS.md

Server-authoritative match worker boundary. Use this file with the root `AGENTS.md` as the local boundary guide.

## Where to edit

| Task | Start here | Notes |
| --- | --- | --- |
| Worker authority | `match-worker.ts` | Canonical match state, versioning, publish acceptance, projection. |
| Wrangler entry | `match-worker.mjs` | Thin entry over built worker output; not the main source. |
| Authority helpers | `../utils/match-authority.ts` | Seat token, operationId, projection, idempotency helpers. |
| Local parity server | `../scripts/local-match-server.ts` | Keep contracts aligned with Worker behavior. |
| Smoke check | `../scripts/match-network-smoke.ts` | API/SSE smoke path. |

## Contracts

- Server state is canonical; client-authored state is never source of truth.
- `seat token`, `stateVersion`, `operationId`, SSE, heartbeat, reconnect, and projection must evolve together.
- Snapshot application and playback are different responsibilities; do not conflate authority state with UI settlement.
- Browser DOM/UI concerns do not belong in worker code.

## Common traps

- Fixing local server and Worker with different contracts.
- Accepting ambiguous fallback as successful authority behavior.
- Updating `worker-public/` or generated deploy files instead of root source.

## Verification

- Focused tests: `test/workers.*`, `test/utils.match-authority*`, `test/local-match-server*`, `test/network.*`.
- Contract bundle: `npm run test:network:parity`.
- Smoke: `npm run match:check` when API/SSE behavior changes.
- Deploy/mirror impact: `npm run worker:prepare` before `worker:dev` / `worker:deploy`.

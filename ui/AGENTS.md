# ui/ AGENTS.md

Browser UI, input, playback, and bootstrap-time DI. Read `.github/instructions/ui.instructions.md` first; this file maps the internal seams agents usually miss.

## Where to edit

| Task | Start here | Notes |
| --- | --- | --- |
| Bootstrap / DI / load order | `bootstrap.ts`, `bootstrap/init-*.ts` | Keep DOM/event/game/network init order stable. DI belongs at bootstrap boundaries. |
| Board animation / playback | `animation-engine.ts`, `playback-engine.ts`, `playback-state-manager.ts`, `presentation-handler.ts`, `board-update-*` | Preserve Single Visual Writer: do not add a second board DOM writer during playback. |
| Network client state | `network-client.ts`, `network/*` | `network-client.ts` is a compatibility shell; module logic lives under `network/`. Server snapshots are authoritative. |
| UI handlers | `handlers/*` | Handlers wire controls/controllers/globals. Business logic belongs in the target submodule. |
| Gacha UI | `gacha/*` | Keep transaction, catalog resolution, reveal stage, overlay view/controller separated. |
| Story / tutorial | `story/*`, `tutorial/*`, `handlers/story.ts`, `handlers/tutorial.ts` | Tutorial has its own state machine; story may delegate tutorial scenarios. |
| Cosmetic skins | `hand-skin/*`, `background-skin/*`, `cosmetics/*` | Follow `catalog` → `selection` → `runtime` → `controller` pattern. |

## Non-obvious contracts

- Bootstrap ordering matters: DOM discovery before event registration; game setup before network activation.
- `_connect(uiPath, gamePath, mapFn)` is the DI bridge pattern from UI modules to game-side `setUIImpl` hooks.
- Network apply logic must respect state version, `operationId`, self-publish tracking, stream-vs-response races, and presentation queue reconciliation.
- Debug UI must remain gated by explicit debug flags / `?debug=1`; do not expose debug globals during normal play.
- `_isNoAnim` / `NOANIM=1` paths are for deterministic tests; keep normal animation behavior unchanged.

## Wrapper / source rule

- Prefer `.ts` sources. Adjacent `.js` files are usually wrappers to `dist/`, but some legacy browser entry code still has real JS; verify before editing.
- Never patch `dist/ui/*` or `worker-public/ui/*` directly.

## Verification

- UI animation/playback changes: focused `test/ui.animation*.test.*`, `npm run test:jest:noanim` when timing is involved, and `npm run test:visual` for visual regressions.
- Network UI changes: `npm run test:network:parity` or focused `test/ui.network*.test.*` / `test/network.*.test.*`.
- Root mirror paths require `npm run worker:prepare`.

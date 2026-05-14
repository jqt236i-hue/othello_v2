# ui/bootstrap/ AGENTS.md

Bootstrap-time DOM discovery, event registration, game setup, network setup, and DI wiring. Read `../AGENTS.md` and `.github/instructions/ui.instructions.md` first.

## WHERE TO LOOK

| Task | Start here | Notes |
| --- | --- | --- |
| DOM discovery/cache | `init-dom.ts` | Must run before handlers assume elements exist. |
| Event registration | `init-events.ts` | Wire UI controls without adding gameplay rules. |
| Game setup | `init-game.ts` | Create game/runtime bindings before network activation. |
| Network setup | `init-network.ts` | Activate after local game and UI dependencies are ready. |
| Shared DI shell | `../bootstrap.ts` | `_connect` bridges UI modules to game-side hooks. |

## CONVENTIONS

- Bootstrap order is part of the contract: DOM → events → game → network.
- DI belongs at bootstrap boundaries; do not reach into game internals from leaf UI modules.
- Keep debug availability behind explicit flags and room/debug contracts.
- Adjacent `.js` files are compatibility wrappers; edit `.ts` first, then build.

## ANTI-PATTERNS

- Moving network activation before game/UI dependency installation.
- Adding broad `window` globals as a shortcut instead of using DI.
- Duplicating `_connect` mapping logic in handlers or feature modules.
- Making debug-only setup run during normal play.
- Editing `dist/ui/*` or `worker-public/ui/*` directly.

## VERIFICATION

- Focused bootstrap tests: `test/ui.bootstrap*.test.ts`, handler init tests, and classic script load tests.
- UI behavior changes may need `npm run test:jest:noanim` or `npm run test:visual` if timing/appearance is involved.
- TypeScript changes need `npm run typecheck` and `npm run build:ts`.
- Mirror-impacting changes finish with `npm run worker:prepare`.

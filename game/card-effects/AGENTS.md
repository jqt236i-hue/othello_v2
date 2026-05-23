# game/card-effects/ AGENTS.md

Pending-target / selection-flow bridge layer. Read `../AGENTS.md` and the root `AGENTS.md` first.

## WHERE TO LOOK

| Task | Start here | Notes |
| --- | --- | --- |
| Shared selection contract | `selection-flow.ts` | Canonical pending-selection bridge; playback/network handoff lives here. |
| Per-card target selection | `<effect>.ts` | Thin adapters over `selection-flow.ts`; keep prompts, payload, and validation local. |
| Shared prompts / labels | `helpers.ts` | Reuse player/effect label helpers instead of reformatting per file. |
| Immediate placement/destroy bridges | `placement.ts`, `destroy.ts` | Bridge only; canonical state mutation still belongs below `game/logic/*`. |

## BOUNDARY

- This directory is not the pure rule authority. Canonical effect resolution lives in `../logic/cards/*`.
- This directory coordinates pending selection, playback wait, message emission, and network publish handoff.
- `../cards/effects/*` is compatibility facade code, not a second rule implementation.
- When visible prompts, pending stages, or end-turn behavior changes, update `01-rulebook.md` first.

## CONVENTIONS

- Prefer tiny per-effect adapters that call `executePendingSelection(...)` with local payload, prompt, and validation.
- Put shared pending-policy logic in `selection-flow.ts` or `../turn/pending-coordinator.ts`, not copied across effect files.
- Keep player/owner normalization and selection contract lookup on existing shared paths.
- Paired `.js` files are runtime wrappers/compat paths; edit `.ts` first, then build.

## ANTI-PATTERNS

- Re-implementing effect state mutation here instead of `../logic/cards/*`.
- Bypassing `selection-flow.ts` for a one-off publish/playback path.
- Pulling in `ui/` modules, DOM, or broad globals as a shortcut.
- Diverging prompt/validation behavior between root runtime and mirrored `worker-public/` output by hand-editing JS.
- Solving pending/network races with local flags instead of the pending coordinator / network handoff contract.

## VERIFICATION

- Focused Jest usually starts with `test/cards.*`, `test/game.*pending*`, `test/ui.network*`, or card-name-specific files.
- Boundary changes need `npm run check:window`.
- TypeScript changes need `npm run typecheck` and `npm run build:ts`.
- Root runtime changes that feed the mirror finish with `npm run worker:prepare`.

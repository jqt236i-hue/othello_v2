# game/logic/ AGENTS.md

Core headless rule / board-operation layer. Read `../AGENTS.md` and `.github/instructions/game.instructions.md` first.

## WHERE TO LOOK

| Task | Start here | Notes |
| --- | --- | --- |
| Core board rules | `core.ts`, `board_ops.ts`, `context.ts` | Shared board mutation and rule helpers with broad blast radius. |
| Card-rule hub | `cards.ts`, `cards/` | `cards.ts` is the registry/entry; per-card canonical logic lives under `cards/`. |
| Internal card helpers | `cards-internal/*` | Shared pending/hand/random/timing/state internals. |
| Legacy effect helpers | `effects/*` | Compatibility/legacy helper layer; not the primary home for new card rules. |
| Board heuristics | `position-weights.ts`, `presentation.ts`, `markers_adapter.ts` | Shared helpers used by CPU, presentation, and migration seams. |

## CONVENTIONS

- Keep this layer headless and deterministic.
- Put shared board/rule behavior here when multiple game subsystems need the same logic.
- Prefer extending `cards-internal/*` or shared helpers over copying state-sync code into one effect.
- If card behavior changes, align `01-rulebook.md`, canonical card logic, and downstream bridges/tests in the same task.

## ANTI-PATTERNS

- Adding DOM/UI/network authority logic here.
- Treating `effects/*` as the canonical destination for new card rule behavior when `cards/*` owns it.
- Re-implementing board mutation, expansion sync, or marker conversions in callers.
- Leaving legacy compatibility fields or `.ts` / `.js` pairs stale after changing canonical logic.

## VERIFICATION

- Focused tests usually start with `test/game.*`, `test/cards.*`, `test/cpu.*`, or effect-specific Jest files.
- Boundary changes need `npm run check:window`.
- TypeScript changes need `npm run typecheck` and `npm run build:ts`.

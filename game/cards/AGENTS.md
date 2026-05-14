# game/cards/ AGENTS.md

Card-state orchestration and compatibility wrapper layer. Read `../AGENTS.md` first.

## WHERE TO LOOK

| Task | Start here | Notes |
| --- | --- | --- |
| Card usage entry | `effect-resolver.ts` | Main card-use orchestration / cancellation entrypoint. |
| Hand / deck / marker state | `state-manager.ts` | Shared card-state mutation helpers and deck/hand lifecycle. |
| Target resolution | `target-resolver.ts`, `selectors.ts` | Public target lookup layer consumed by UI/CPU bridges. |
| Turn timing hooks | `timing-processor.ts` | Turn-start/end card timing orchestration. |
| Compatibility effect wrappers | `effects/*` | Facades over canonical `../logic/cards/*` implementations. |

## CONVENTIONS

- This layer coordinates card state and compatibility APIs; canonical rule math still lives in `../logic/cards/*`.
- Keep resolver semantics aligned with pending contracts and CPU/UI callers.
- Use shared selector/target helpers instead of effect-local target duplication.
- Treat `effects/*` as wrappers/facades unless the file clearly owns orchestration-only behavior.

## ANTI-PATTERNS

- Re-implementing canonical rule logic here when `../logic/cards/*` already owns it.
- Drifting target semantics between `target-resolver.ts`, CPU selection, and pending selection bridges.
- Hiding state mutation in wrapper files that callers assume are pure lookups.
- Leaving compatibility wrappers stale after changing canonical card logic.

## VERIFICATION

- Focused tests usually start with `test/cards.*`, `test/card*`, `test/game.*`, or CPU card-choice suites.
- TypeScript changes need `npm run typecheck` and `npm run build:ts`.
- Root runtime changes that affect the mirror finish with `npm run worker:prepare`.

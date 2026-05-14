# ui/handlers/ AGENTS.md

Index-only guide for UI control wiring. Handlers connect buttons, panels, modes, storage, and controllers; business logic belongs in the target module.

## WHERE TO LOOK

| Task | Start here | Notes |
| --- | --- | --- |
| Root handler install | `init.ts` | Registers mode-specific handlers and shared UI wiring. |
| Match/network mode | `match-mode.ts` | Keep network room/session behavior aligned with `../network/*`. |
| Debug controls | `debug.ts` | Must stay gated; normal play gets no debug side effects. |
| CPU options | `cpu-policy.ts`, `smart.ts`, `auto.ts` | Consume shared CPU/profile helpers; do not fork policy parsing. |
| Deck / rules / gacha | `deck-builder.ts`, `rules-help.ts`, `gacha.ts` | Delegate data/catalog logic to shared/cards/gacha modules. |
| Audio / skins | `sound.ts`, `hand-skin.ts` | UI concern only; no game-state mutation. |

## CONVENTIONS

- Handlers are glue. Put reusable state machines, rendering, codecs, or gameplay decisions in their owning modules.
- Use public game APIs, events, and bootstrap DI; do not import game internals for convenience.
- Preserve Japanese display names and text surfaces through `01-rulebook.md` / UI surfaces when visible text changes.
- Prefer `.ts`; paired `.js` files are wrappers unless the JS allowlist says otherwise.

## ANTI-PATTERNS

- Adding gameplay rules or network authority decisions inside a handler.
- Publishing broad globals to avoid passing dependencies.
- Letting debug controls, auto controls, or test helpers affect normal play.
- Duplicating catalog/deck/rules-help/card-description logic already owned elsewhere.

## VERIFICATION

- Focused tests usually start with `test/ui.*handler*`, `test/ui.match-mode*`, or `test/ui.rules-help*`.
- Network handler changes should include `npm run test:network:parity` or a focused subset.
- TypeScript changes need `npm run typecheck` and `npm run build:ts`.

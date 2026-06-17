# cards/ AGENTS.md

Card UI and display catalog boundary. Use this file with the root `AGENTS.md` as the local boundary guide.

## Where to edit

| Task | Start here | Notes |
| --- | --- | --- |
| Card data | `catalog.json` | Source of truth for card display/catalog data. |
| Generated catalog outputs | `catalog.js`, `catalog.ts`, `catalog.generated.js` | Keep in sync with `catalog.json`; do not hand-edit as the only change. |
| Card interaction UI | `card-interaction.ts`, `card-interaction-effects.ts` | Presentation and interaction surface only. Effect resolution belongs in `game/`. |
| Deck/rules surfaces | `../shared/deck-spec.ts`, `../ui/handlers/rules-help.ts` | Common update-miss points after card changes; adjacent `.js` files are compatibility shims. |

## Boundaries

- `cards/` owns display catalog and card UI surfaces.
- Gameplay rules, target resolution, pending state, and state mutation belong in `game/logic/cards/*`, `game/card-effects/*`, and turn flow.
- Player-visible behavior changes require `01-rulebook.md` first.
- `worker-public/cards/` is mirror output. Update root and run `npm run worker:prepare` when needed.

## Change checklist

- Update `cards/catalog.json` before generated outputs.
- Keep `catalog.js`, `catalog.ts`, and `catalog.generated.js` consistent.
- Search by `cardId`, `type`, display name, and effect name for deletes/renames.
- Check CPU, presentation, rules help, deck specs, docs, and tests when behavior changes.

## Verification

- Catalog generation: `npm run generate:catalog` when catalog outputs are affected.
- Browser runtime reflection: `npm run build:browser` when browser-loaded catalog or UI modules must update `dist/` and `public/module-registry.js`.
- Card tests: focused `test/card*`, `test/cards*`, or card-name-specific Jest files.
- Mirror impact: `npm run worker:prepare`.

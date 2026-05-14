# game/logic/cards/ AGENTS.md

Canonical headless card-effect logic. This directory owns pure rule execution for card effects; `game/card-effects/` owns pending / UI-network bridges, and `game/cards/effects/` is mostly compatibility facade code.

## Where to look

| Task | Start here | Notes |
| --- | --- | --- |
| Card definitions / costs | `defs.ts`, `costs.ts` | Keep catalog-facing meaning aligned with `cards/catalog.json` and `01-rulebook.md`. |
| Target selection | `selectors.ts`, `targets.ts` | Preserve owner/player normalization and board-shape handling. |
| Marker / special-stone state | `markers.ts`, `living_will.ts`, `time_bomb.ts`, `hyperactive.ts` | Marker arrays are the canonical state surface; avoid reintroducing legacy mirror arrays. |
| Flip / placement helpers | `flips.ts`, `movement.ts`, `expansion.ts`, `utils.ts` | Reuse shared board helpers instead of caller-local copies. |
| Randomized effects | `breeding.ts`, `clone.ts`, `meteor.ts`, `teleport.ts`, `udg.ts`, `will_hunter_king.ts` | Use existing random-source/deps paths; do not add hidden globals. |
| Per-effect rule changes | `<effect>.ts` with paired `<effect>.js` | Update the canonical source and keep the runtime pair consistent through the build path. |

## Local conventions

- Modules are CommonJS-compatible TypeScript and usually end in `export =` / `module.exports` shapes.
- Adjacent `.js` / `.ts` pairs are intentional during migration; verify which file the touched test/runtime imports before reporting completion.
- Effect modules should receive helpers through existing deps / resolver paths rather than importing UI, timers, audio, or DOM code.
- Player-visible behavior changes start in `01-rulebook.md`, then card catalog / presentation text / CPU expectations / tests follow.

## Anti-patterns

- Do not put pending selection UI, network handoff, or visual playback decisions here.
- Do not add `window`, `document`, sound, timer, or debug global fallbacks.
- Do not copy target/cost checks into one effect when `selectors.ts`, `targets.ts`, or `costs.ts` owns the shared rule.
- Do not leave generated/runtime pairs stale after changing canonical logic.

## Verification

- Focused card behavior: card-name or effect-family Jest files under `test/`.
- Target/pending changes: include nearby `test/cpu.*pending*`, `test/game.*`, or card selection tests.
- TypeScript changes: `npm run typecheck` and `npm run build:ts`.
- Mirror impact from root runtime files: finish with `npm run worker:prepare`.

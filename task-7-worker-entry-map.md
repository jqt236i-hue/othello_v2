# Task 7 Worker Entry Map

## Files Read

- `workers/match-worker.mjs`
- `wrangler.toml`
- `scripts/prepare-worker-assets.ts`
- `scripts/prepare-worker-assets.js`
- `dist/scripts/prepare-worker-assets.js`
- `dist/workers/match-worker.js`
- `dist/workers/match-worker.mjs`

## Worker Entry Classification

| File | Classification | Evidence |
| --- | --- | --- |
| `workers/match-worker.mjs` | `worker-esm-bridge` | Imports `../dist/workers/match-worker.js`, re-exports `MatchRoomDurableObject`, and exports the default worker object. This is the Wrangler `main`. |
| `dist/workers/match-worker.mjs` | `worker-esm-bridge` generated artifact | Same bridge shape, but not referenced by `wrangler.toml`. |

## Durable Object Export Path

1. `wrangler.toml` sets `main = "workers/match-worker.mjs"`.
2. `workers/match-worker.mjs` imports `../dist/workers/match-worker.js` as `workerModule`.
3. `workers/match-worker.mjs` exports `MatchRoomDurableObject = workerModule.MatchRoomDurableObject`.
4. `dist/workers/match-worker.js` defines `class MatchRoomDurableObject` and assigns `exports.MatchRoomDurableObject = MatchRoomDurableObject`.
5. `dist/workers/match-worker.js` assigns `exports.default = { async fetch(request, env) { ... } }`.

## Wrangler Contract

- Durable Object binding: `MATCH_ROOM` -> `MatchRoomDurableObject`.
- Migration: `new_sqlite_classes = ["MatchRoomDurableObject"]`.
- Assets binding: `ASSETS` reads from `worker-public`.
- Worker entry and Durable Object export names are aligned.

## Mirror Prepare Contract

Source prepare config in `scripts/prepare-worker-assets.ts` declares root files:

```text
index.html
story-deck-lab.html
is-env-capable.js
shared-constants.js
card-system.js
game-events.js
sound-engine.js
ui.js
styles-animations.css
styles-base.css
styles-board.css
styles-cards.css
styles-layout.css
styles-responsive.css
styles-story-deck-lab.css
styles-stone-shadows.css
styles-variables.css
```

Source prepare config declares mirrored directories:

```text
assets
cards
constants
shared
ui
utils
```

## Result

- Worker bridge exports: intact.
- Wrangler Durable Object binding and migration: intact.
- `worker-public/` root entries from the prepare config: present.
- `worker-public/` generated-output-only parity: not verified clean; see `task-7-worker-exports.txt` for missing and mismatched mirror evidence.

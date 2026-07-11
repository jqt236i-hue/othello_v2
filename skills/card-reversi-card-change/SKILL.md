---
name: card-reversi-card-change
description: Route, implement, and verify Card Reversi card changes across the player-visible specification, catalog, headless rules, pending selection, CPU behavior, presentation, network authority, generated browser artifacts, and Worker mirror. Use when adding, changing, renaming, enabling, disabling, debugging, or removing a card or card effect in the card-reversi repository, including changes to card text, cost, targets, animations, sounds, or network-visible behavior.
---

# Card Reversi Card Change

Change a card through the repository's canonical layers without creating a second rule, presentation writer, or runtime-specific outcome.

## Establish the working boundary

1. Run `git status --short` before editing. Classify existing changes and preserve unrelated work.
2. Read the repository-root `AGENTS.md`, then every nested `AGENTS.md` governing files that may change.
3. Read `01-rulebook.md` before changing player-visible rules, behavior, timing, prompts, labels, or descriptions.
4. Read the relevant `正本/*.md` for card behavior, turn order, animation, sound, highlight, or network-visible gameplay. Update it only when the intended player-visible specification changes or would become stale.
5. Treat root TypeScript and JSON files as canonical. Do not source-edit `dist/`, `worker-public/`, `public/module-registry.js`, or generated catalogs.

## Inventory the card

Run the bundled read-only inventory from the repository root:

```powershell
node skills/card-reversi-card-change/scripts/inventory-card-change.mjs --repo . --card <card-id-or-type-or-name>
```

Use `--json` when structured output is useful. A missing catalog match is valid for a new card. Search again manually with `rg` when the requested concept uses aliases not present in the catalog.

If the current session advertises `card-reversi-browser-new-card`, `card-reversi-browser-card-change`, `card-reversi-browser-card-text-change`, or `card-reversi-browser-cost-change`, hand the classified implementation to the matching specialist skill. Keep this skill responsible for the initial inventory and final cross-layer verification. Do not assume an indexed specialist is callable when it is absent from the session's available-skill metadata.

## Classify the change

Route every applicable class; do not force the change into only one class.

| Change class | Canonical starting points | Required follow-through |
| --- | --- | --- |
| Catalog or display | `cards/catalog.json` | Check card renderer, effect tags, rules help, deck spec, art map, browser build, and generated catalog path. |
| Cost, usability, target, or immediate effect | `game/logic/cards/*`, `game/logic/card-resolution/*` | Reuse shared cost, target, owner, player, board-shape, and random-source helpers. Keep the result deterministic and headless. |
| Pending or multi-step selection | `game/card-effects/*`, `game/logic/cards-internal/pending-selection-registry.ts`, `game/turn/pending-coordinator.ts` | Keep per-card adapters thin. Publish only through the selection-flow UI/network signal bridge. Check CPU handoff and cancellation/end-turn semantics. |
| Animation, sound, or visual timing | ordered `events[]`, `shared/presentation-effect-profiles.ts`, existing `ui/` playback surfaces | Let game code emit canonical events or presentation metadata and let UI consume them. Preserve event order and the Single Visual Writer contract. |
| CPU-visible decision | `game/cpu-decision.ts`, `game/cpu-turn-handler.ts`, `game/ai/*` | Use the same public rule and target-selection contracts as human play. Do not add a CPU-only rule result. |
| Network-visible state or action | shared authority helpers, `workers/`, `scripts/local-match-server.ts`, `ui/network/*` | Use `$card-reversi-network-contract`. Keep Worker, local server, browser, and headless outcomes equivalent. |
| Add, rename, enable, disable, or remove | all applicable rows above | Search by ID, type, Japanese display name, effect name, pending type, event type, and sound key. Check decks, help, tests, docs, art, manifests, and compatibility facades. |

## Implement in canonical order

1. Update the player-visible specification first when behavior changes.
2. Update `cards/catalog.json` when catalog data changes.
3. Implement canonical headless behavior in `game/logic/` and canonical turn flow.
4. Add pending-selection coordination only through existing bridges.
5. Emit ordered events or presentation metadata; add UI handling without mutating canonical results.
6. Update CPU and network consumers only when the card crosses those boundaries.
7. Update focused tests where existing coverage does not prove the changed contract.
8. Generate catalogs, browser artifacts, or Worker mirrors only from their source scripts after focused checks pass.

Prefer the smallest coherent change. Expand scope when a local patch would duplicate rule logic, normalization, target checks, event assembly, or network authority.

## Verify by blast radius

Always inspect the final task-owned diff and run the smallest focused checks that prove the behavior.

| Impact | Minimum verification |
| --- | --- |
| Docs or text-only | `git diff --check` plus source/render inspection. Do not add tests. |
| Catalog or browser-visible surface | Run the relevant focused test, `npm run generate:catalog` when catalog outputs change, then `npm run build:browser`. Inspect generated diffs. |
| Headless card rule, target, cost, turn flow, or CPU behavior | Run card/effect-specific Jest coverage plus `npm run typecheck` or the smallest existing build that exercises the changed source. Add/update a test when focused coverage is missing or a regression needs durable protection. |
| Pending selection or presentation bridge | Include focused pending, animation, or playback tests and `npm run check:window`. Use the smallest relevant browser/E2E scenario when it materially improves confidence. |
| Network authority, snapshot, reconnect, or cross-runtime behavior | Follow `$card-reversi-network-contract`; include `npm run test:network:parity` and standalone `npm run worker:prepare` when mirror generation/verification is required. |

Do not run `worker:prepare` immediately before `worker:dev` or `worker:deploy`; those commands already invoke it. Do not weaken a failing test to obtain a pass. Report an initial failure even if a retry passes.

## Finish

1. Run `git status --short` and inspect only the relevant diff.
2. Confirm that generated and mirror changes came from their scripts.
3. Commit only task-owned files at a coherent verified stopping point, following repository commit policy.
4. Report changed behavior using the Japanese display name first, commands and results, generated artifacts, and residual risk.

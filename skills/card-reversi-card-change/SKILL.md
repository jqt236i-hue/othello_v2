---
name: card-reversi-card-change
description: Diagnose, review, plan, implement, and verify Card Reversi card lifecycle and behavior changes across the player-visible specification, catalog and CardType, card-use stages, canonical headless rules, pending selection, turn flow, CPU and training consumers, presentation, assets, network authority, generated browser artifacts, and Worker mirror. Use for adding, changing, renaming, enabling, disabling, removing, auditing, or debugging a card; changing card text, identity, cost, availability, target, randomness, timing, animation, sound, or network-visible behavior; or checking a card regression in the card-reversi repository.
---

# Card Reversi Card Change

Carry one card request through every affected authority without creating a second rule, presentation writer, or runtime-specific outcome.

## Set the operating mode first

1. Classify the request as `diagnose`, `review`, `plan`, `implement`, or `deploy`.
2. Keep diagnose, review, and plan work read-only. Do not edit, generate, commit, or deploy unless the user authorized implementation or deployment.
3. Treat deployment as separate authority. Deploy only when explicitly requested.
4. Run `git status --short`. Classify every existing change as related, unrelated, generated/mirror, or unknown. Preserve unrelated work and stop on overlapping unknown edits.
5. Read the root `AGENTS.md` and every closest nested `AGENTS.md` for files that may change.
6. Confirm the real source owner from the closest guidance, facade imports, runtime imports, and `docs/typescript-migration-js-allowlist.md`. Prefer `.ts` when it owns behavior, but do not assume every root TypeScript or JSON file is canonical.
7. Stop when same-topic authorities conflict or when a requested behavior is not decided. Do not rewrite the specification to make a bug disappear.

## Inventory the card before editing

Resolve `<this-skill-directory>` from the loaded `SKILL.md` path. Invoke the bundled script from that installed directory; do not assume the repository contains a `skills/` directory.

```powershell
node "<this-skill-directory>/scripts/inventory-card-change.mjs" --repo . --mode change --card "<id|type|Japanese name>" --term "<alias>"
```

Choose one mode:

- `add`: require no exact catalog identity.
- `change`, `enable`, `disable`, or `remove`: require one exact current identity.
- `rename`: require one exact current identity and at least one `--new-term`.
- `audit`: allow no match or one unique partial match and make no lifecycle assumption.

For rename or removal, inventory both sides and run an absence gate after implementation:

```powershell
node "<this-skill-directory>/scripts/inventory-card-change.mjs" --repo . --mode rename --card "<old identity>" --old-term "<old alias>" --new-term "<new alias>"
node "<this-skill-directory>/scripts/inventory-card-change.mjs" --repo . --mode audit --card "<new identity or removed identity>" --expect-absent "<old alias>" --json
```

Use `--allow-path <explained-prefix>` only for an intentional compatibility or historical remainder. Record why it remains and which test protects it.

Inspect:

- content and asset-path matches, including Japanese artwork filenames;
- matched aliases, source role, generated/mirror classification, and governing `AGENTS.md`;
- the coverage summary for catalog, specification, `CardType`, rules, pending, CPU, presentation, network, tests, assets, and generated surfaces;
- unreadable canonical candidates, catalog integrity issues, unclassified hits, and dirty-tree entries.

Search manually with `rg` when an effect uses a semantic alias, marker, event, pending type, sound key, progression link, or saved compatibility token not discoverable from catalog identity.

## Read only the relevant authorities

- For changed player-visible behavior, wording, timing, prompts, labels, effects, sounds, or animations, search `01-rulebook.md` by ID, type, Japanese name, and common rule term. Read the relevant common rule and surrounding card section.
- Route `正本/` through `正本/AGENTS.md`: use the card, common-rule, turn, presentation, sound, or audit document that owns the topic. Update it only when the intended visible specification changes or would become stale.
- If implementation contradicts an already-clear specification, fix implementation and tests; do not change the specification unless the user is changing the intended behavior.
- Read `docs/architecture-contracts.md` selectively: §6.3 for pending, §6.5 for effect blocks, §6.6 for immediate effects, §7.1 for card-use flow, §7.3 for board presentation, and §8 for network authority.
- Treat `cards/catalog.json` as catalog source, root implementation as runtime source, and `dist/`, `worker-public/`, generated catalogs, card-art maps, registries, and bundles as derived output.
- Never edit `docs/HUMAN-DEV-GUIDE.md`; use it only as human decision context.

## Route every affected surface

| Surface | Current entry points | Required follow-through |
| --- | --- | --- |
| Identity, availability, cost, or display | `cards/catalog.json`, `src/types/card.ts`, `shared/deck-spec.ts`, `ui/handlers/rules-help.ts`, `cards/card-interaction-effects.ts`, `cards/card-last-used-panel-copy.ts` | Keep Japanese copy, `CardType`, enabled/deck behavior, detail tags, saved deck compatibility, art, and generated catalog projections aligned. |
| Card-use orchestration | `game/cards/effect-resolver.ts`, `card-usage-validation-stage.ts`, `card-usage-consumption-stage.ts`, `card-usage-immediate-stage.ts`, `card-usage-pending-stage.ts`, `card-usage-presentation-stage.ts` | Preserve validation → consumption → immediate/pending → presentation ordering. Do not hide canonical mutation in a compatibility facade. |
| Canonical rule, target, or state | `game/logic/cards.ts`, `game/logic/cards/*`, `game/logic/card-resolution/*`, `game/logic/cards-internal/card-usage-prechecks.ts`, `game/cards/target-resolver.ts` | Reuse shared cost, selector, target, owner/player, topology, marker, and random-source contracts. |
| Immediate, placement, or turn-timed effect | `game/turn/card-usage/immediate-effects.ts`, `game/turn/immediate-effect-dispatcher.ts`, `game/turn/action-phase/placement-immediate-effects.ts`, turn timing modules | Use the shared dispatcher, injected phase PRNG, correct decrement policy, and effect-block metadata. Preserve fixed turn order. |
| Pending or multi-stage selection | `game/logic/cards-internal/pending-selection-registry.ts`, pending state manager, pre-placement selection stages, `game/card-effects/selection-flow*.ts`, `game/turn/pending-coordinator.ts`, `ui/network/selection-signal-bridge.ts` | Keep per-card adapters thin; bind `pendingEffectId`, validate stage/target/cancel/end-turn semantics, release settlement locks correctly, and publish only through the installed bridge. |
| CPU, AUTO, selfplay, or training | `game/cpu-decision-card-*`, `game/cpu-decision-pending-*`, `game/ai/cpu-policy-card-*`, `game/cpu-turn-*-phase.ts`, `game/cpu-network-command-planner.ts`, selfplay consumers | Use public rule/selector contracts. Preserve all-card taxonomy/profile gates and authority-side AUTO replanning. Never create a CPU-only outcome. |
| Presentation, animation, or sound | ordered `events[]`, `game/turn/pipeline-ui/*`, `shared/presentation-effect-profiles.ts`, `ui/animation-feedback-events.ts`, `ui/presentation/dispatcher.ts` | Keep gameplay headless, preserve event order, and add presentation handling without changing the canonical result. |
| Board-local visuals | `docs/architecture-contracts.md` §7.3, `ui/board-visual/effect-branch-inventory.ts`, active `BoardVisualBackend`, Pixi timeline/effects | Keep one writer/application/clock. Use Pixi normally; use the DOM backend only as an exclusive compatibility fallback. |
| Special card/stone or progression contract | `shared/special-card-registry.ts`, `shared/special-stone-registry.ts`, `shared/manifest-stone-registry.ts`, `game/logic/cards-internal/progression.ts` | Update registries and upgrade/progression links without duplicating effect logic. |
| Network-visible result, pending state, projection, or randomness | shared action/authority helpers, Worker/local adapters, client intake/reconciliation | Invoke `$card-reversi-network-contract` when available and follow it through Worker, local server, browser, headless, projection, journal, and mirror parity. |

Treat listed paths as discovery anchors, not permission to recreate a removed module. If an anchor moved, use `rg`, the facade wiring, the closest `AGENTS.md`, and current tests to find the owner.

## Preserve the card invariants

- Keep one canonical rule implementation. Let `game/cards/effects/*` and adjacent `.js` files remain facades or compatibility projections unless current imports prove otherwise.
- Keep `game/`, CPU policy, and shared helpers headless and deterministic. Do not add DOM, `window`, sound, timers, network clients, or hidden global fallbacks.
- Use the current board topology; do not reconstruct rectangular bounds or treat void, hole, and expansion cells as interchangeable.
- Use the injected random source. Browser preview may mirror an outcome but never define canonical randomness.
- Keep delayed and pending outcomes explicit in canonical state. UI hints, locks, previews, and busy flags are not accepted gameplay state.
- Use effect blocks for multi-mutation board effects and preserve rescue/spawn anchors and ordered `events[]`.
- For destroy, flip, or ownership effects, verify interactions with protection, ghost/evasion, rescue/revival, frozen state, and multiple eligible markers. Do not infer the higher-level card result from one low-level boolean when canonical rescue or replacement can change the final board.
- Route every board frame and board-owned trajectory through the Single Visual Writer controller and active backend.
- Apply the same legality, target, cost, and resolution contract to human, CPU, Worker, local server, and headless paths.
- Preserve hidden-hand projection. Use authority selectors such as `handIndex`; never treat placeholder identity as a card ID.
- Keep debug behavior behind explicit flags and out of normal control flow.

## Handle lifecycle changes deliberately

- Japanese-name rename: check player text, artwork filename, art-map generation, rules/help, last-used copy, and saved display references.
- Card-ID rename: decide saved deck code, persisted hand/deck, snapshot, last-used, and network compatibility before implementation.
- Type rename: update `src/types/card.ts`, switches, maps, registries, CPU taxonomy, pending registry, events, tests, and compatibility policy.
- Disable: normally retain type, rules, assets, and compatibility while proving exclusion from deck/draw/training paths.
- Remove: stop until saved deck/snapshot/network migration and old-identity policy are explicit.
- Do not bump `cards/catalog.json.version` automatically; identity or availability changes require an explicit compatibility decision because the repository has no universal bump rule.

## Implement in canonical order

1. Update `01-rulebook.md` and the owning `正本` first only when intended visible behavior changes.
2. Update catalog identity/display and `CardType` when applicable.
3. Run `npm run generate:catalog` immediately after catalog changes. Run `npm run generate:card-art-map` after card-name/art inputs change. Run `npm run generate:asset-manifest` only when its owning asset inventory changes; ordinary card artwork is governed by the card-art map. Do not treat `worker:prepare` as a substitute for the catalog or card-art generators.
4. Update card-use stages and canonical headless logic.
5. Update pending/turn coordination and CPU consumers.
6. Emit canonical events/metadata, then update DOM/Pixi/sound consumers at their presentation boundary.
7. Update network authority, projection, intake, and replay only when the change crosses that boundary.
8. Add or update the narrowest durable test only when existing focused coverage is missing or a regression must remain fixed.
9. Generate browser and Worker outputs only after focused source checks pass.

Do not run implementation steps in diagnose, review, or plan mode.

## Verify by blast radius

Verify current script definitions in `package.json`; do not trust a stale command copied from this file.

| Impact | Required evidence |
| --- | --- |
| Docs or copy only | `git diff --check`, targeted source/render inspection, relevant catalog/detail-copy tests; do not add tests by default. |
| Add, type rename, or remove | Include `test/cards.catalog.test.ts`, `test/cards.generate.test.ts`, `test/cards.card-art-map.generate.test.ts`, `test/cards.detail-copy-audit.test.ts`, `test/cards.pending-selection-contract.test.ts`, and removal/retired-reference coverage as applicable. The pending contract checks catalog ↔ `CardType` and registry coverage. |
| Cost, legality, target, immediate effect, turn flow | Run card/effect-specific Jest plus the affected card-use stage and selector/precheck tests. For destructive/ownership effects, include relevant protection, evasion, rescue/revival, frozen, and multiple-instance combinations. Run `npm run typecheck` or the smallest existing build that exercises the source. |
| Pending or multi-stage selection | Include registry, pending state/stage, selection flow, pending coordinator, CPU pending, and turn-outcome tests; add `npm run check:window`; include network parity when publish/reconnect is involved. |
| CPU or all-card taxonomy | Include the card-specific CPU tests and relevant all-card gates such as `test/game.cpu-policy-card-profiles.test.ts`, `test/game.cpu-policy-core.test.ts`, and `test/cpu.decision.refactor.test.ts`. |
| Animation, sound, or board playback | Run focused feedback/pipeline/board/Pixi tests first. Add `npm run match:pixijs-board-playback-check`, fallback/cross-platform smoke, or visual/E2E checks in proportion to risk. |
| Browser-visible root source | After focused tests pass, run `npm run build:browser` and inspect registry/cachebuster/generated diffs. |
| Network authority or projection | Follow `$card-reversi-network-contract`; run focused authority/client tests and the required match/network parity bundles. |
| Worker-served mirror | Run `npm run worker:prepare`, then `npm run check:worker-mirror`; do not run prepare immediately before `worker:dev` or `worker:deploy`. |

Report an initial failure even if a retry passes. Do not delete, skip, weaken, or rewrite a test merely to obtain green output.

## Finish

1. Rerun the inventory with every old ID, type, Japanese name, event, pending type, sound key, and asset name through `--expect-absent`.
2. Require zero unexplained active old-term hits and zero unreadable canonical candidates. List each intentional compatibility/history remainder with file, reason, and protecting test.
3. Run `git status --short` and inspect only the task-owned diff. Confirm every generated or mirrored file came from its owning script.
4. Stop without landing when specification intent, saved/network compatibility, deterministic authority, Worker/local parity, or required verification remains unresolved.
5. For an authorized implementation, commit only the isolated verified task-owned files according to repository policy. Never commit for a read-only request.
6. Report the Japanese display name first, player-visible behavior, source owners changed, generated outputs, commands/results, compatibility decisions, and residual risk.

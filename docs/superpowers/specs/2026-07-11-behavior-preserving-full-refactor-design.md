---
status: active
owner: repository-maintainers
scope: behavior-preserving-full-refactor
created: 2026-07-11
---

# Behavior-Preserving Full Refactor Program Design

## 1. Purpose

This document defines a phased program that removes every structural debt identified in the 2026-07-10 repository audit without intentionally changing player-visible behavior, game rules, network authority, CPU decisions, training semantics, browser presentation, or deployment outputs.

**Document role:** Active program design and acceptance contract for maintainers, reviewers, and later plan executors. It does not replace `01-rulebook.md` or `docs/architecture-contracts.md`, and it is not an `AGENTS.md`-style scoped instruction file, so `applyTo` metadata is not applicable.

The program is complete only when all twenty audited findings have objective closure evidence. A smaller file, a lower `any` count, or a successful build is not sufficient by itself.

## 2. Scope

The program covers:

1. tracked artifact and repository-history bloat;
2. the `selection-flow` / `pass-handler` / `cpu-decision` dependency cycle;
3. missing semantic TypeScript checking for `training/**/*.ts`;
4. duplicate selfplay runner implementations;
5. duplicated Worker/local-server authority logic;
6. JavaScript runtime files that remain implementation authorities behind TypeScript wrappers;
7. the oversized and fallback-heavy card logic facade;
8. duplicated CPU fallback implementations after module extraction;
9. the legacy second board writer;
10. the stale monolithic sound-cue module;
11. the oversized network-client facade;
12. the oversized diff-renderer context and mixed responsibilities;
13. bootstrap and card-interaction import-time side effects;
14. long transaction functions crossing multiple responsibilities;
15. oversized `match-authority` and `shared-board-utils` hubs;
16. duplicated player/owner normalization and network constants;
17. duplicated Python policy trainer v2/v3 implementations;
18. unused copied type trees;
19. CSS ownership and override-chain debt;
20. obsolete migration scripts, duplicated tool evidence, and unclassified historical plans.

## 3. Non-goals

The program does not:

- change `01-rulebook.md` behavior, card effects, card costs, visible copy, or timing requirements;
- change network protocols, payload schemas, snapshot authority, rating behavior, or reconnect semantics;
- improve CPU strategy, alter tie-breaking, or change seed consumption;
- change training examples, feature meanings, policy/value targets, sample weighting, or model schema semantics;
- redesign the UI, DOM structure, artwork, sound, animation, or CSS appearance;
- add product features;
- replace working architecture with a new framework;
- require every production `any` to be removed;
- hand-edit `dist/`, `worker-public/`, or `public/module-registry.js` as source;
- rewrite Git history without a separate explicit approval gate.

If implementation reveals that a player-visible or protocol-visible behavior must change, the phase stops. That change requires a separate specification and user decision; it must not be hidden inside this refactor program.

## 4. Source-of-Truth Order

All work follows this order:

1. `01-rulebook.md` for player-visible behavior;
2. `docs/architecture-contracts.md` for authority and dependency boundaries;
3. root `AGENTS.md` and nested `AGENTS.md` files;
4. this design;
5. phase implementation plans;
6. implementation details.

Root TypeScript or explicitly documented root implementation remains authoritative. Generated and mirrored surfaces are regenerated only after source verification.

`docs/HUMAN-DEV-GUIDE.md` is reference-only human guidance. This program does not edit it.

## 5. Behavior-Preservation Contract

### 5.1 Canonical game behavior

For identical canonical state, action, configuration, dependency inputs, and random seed:

- the accepted or rejected action is identical;
- the resulting game state is deeply equivalent;
- turn owner, pass state, pending selection, card state, board state, markers, charge, deck, and hand are equivalent;
- random numbers are consumed in the same order;
- CPU selects the same action and target;
- `events[]` contain the same event types, values, and order;
- presentation metadata that drives existing sound, animation, and highlight behavior is equivalent.

Object key ordering that is not part of serialization is not behavior. Serialized output ordering, hashes, seeds, and snapshot versions are behavior when consumers observe them.

### 5.2 Network behavior

For identical room state, identity, request, operation ID, and seed:

- Worker and local-server validation decisions are identical;
- published snapshot content and version movement are identical;
- public/private projection and redaction are identical;
- SSE, replay, resync, reconnect, spectator, rematch, rated, and pending-selection contracts remain identical;
- client preview, playback, and settlement state never become authority;
- error codes and user-visible network messages do not change.

### 5.3 Browser presentation

- the diff renderer remains the Single Visual Writer;
- `events[]` playback order is unchanged;
- board settlement, playback locks, busy flags, and snapshot reconciliation occur in the same logical order;
- sound cue selection and ordering are unchanged;
- animation names, durations, sequencing, and cancellation behavior are unchanged;
- DOM-visible labels and game controls are unchanged;
- CSS refactoring preserves computed presentation at supported breakpoints.

Browser source changes require `npm run build:browser` after focused tests pass. Playable-browser, Playwright, and visual-regression checks are run only after explicit user instruction, as required by repository policy. Without that explicit verification, UI phases may reach automated completion but the whole program may not claim full visual-equivalence completion.

### 5.4 Training and selfplay behavior

For identical input data, profile, model, seed, and CLI arguments:

- selfplay action selection and output records are equivalent;
- feature layout, target values, sample weights, history handling, and model schema are unchanged;
- existing CLI names and supported arguments remain compatible;
- TypeScript semantic checking is added without changing emitted runtime behavior;
- Python v2/v3 compatibility entry points may remain, but they must delegate to one implementation authority.

### 5.5 Repository and deployment behavior

- root source remains canonical;
- `worker-public/` is reproducible through `npm run worker:prepare`;
- browser registry and cache-buster output are reproducible through `npm run build:browser`;
- deleting obsolete scripts or evidence must not delete an active package-script target or deploy dependency;
- current-tree artifact cleanup and Git-history rewriting are separate operations.

## 6. Program Architecture

The program uses one master design, one master execution index, and separate phase plans. Each phase plan is independently reviewable, testable, committable, and revertible.

The implementation pattern is incremental replacement behind stable facades:

```text
existing consumer
    -> stable public facade
        -> typed focused module or pure shared core
            -> explicit runtime adapter
```

Consumers move one at a time. A compatibility facade may remain while callers migrate, but duplicate business logic and success-shaped fallbacks may not remain at phase completion.

Only one implementation phase may be active in the physical checkout at a time. No branch, tag, or worktree is created unless explicitly requested. No parallel implementation runs in the same checkout.

## 7. Universal Phase Protocol

Every normal phase follows this protocol.

### 7.1 Entry gate

1. Run `git status --short`.
2. Stop if unrelated or unexplained dirty files exist.
3. Read the phase plan, relevant source-of-truth documents, and nested `AGENTS.md` files.
4. Run the smallest relevant baseline checks.
5. Confirm that any known baseline failure is explicitly listed in the phase plan.
6. Record phase-specific structural metrics before editing.

### 7.2 Change loop

1. Add or identify characterization coverage for current behavior.
2. Run it before implementation and confirm current behavior is captured.
3. Add a structural guard that fails only for the debt being removed when practical.
4. Move one responsibility behind a stable interface.
5. Remove the replaced implementation in the same task; do not leave a second fallback authority.
6. Run focused verification.
7. Inspect the diff for source/mirror direction, accidental behavior changes, and unrelated files.
8. Commit the coherent unit.
9. Repeat with the next responsibility.

Characterization tests normally pass before the refactor. A new structural guard may intentionally fail before the refactor, but the expected failure must name the targeted debt. Existing expectations must not be rewritten merely to make a behavioral difference pass.

### 7.3 Exit gate

1. Run all focused phase checks.
2. Run `npm run typecheck` and the new training typecheck when relevant.
3. Run `npm run checkall`.
4. Run parity or mirror checks required by the phase.
5. Run `npm run build:browser` only when browser-visible root source changed.
6. Run `npm run worker:prepare` only when the Worker deploy mirror is affected or when directly validating mirror reproducibility.
7. Inspect `git diff`, generated diffs, and `git status --short`.
8. Commit only intentional files.
9. Mark the phase complete only after every phase completion criterion is evidenced.

## 8. Stop Conditions

Work stops immediately when any of these conditions occurs:

- a characterization test changes output;
- a random seed is consumed in a different order;
- CPU chooses a different action for an existing fixture;
- `events[]`, snapshot, projection, error code, or serialized output changes unexpectedly;
- a required behavior is ambiguous between the rulebook and architecture contract;
- a generated or mirrored file would need to become the source of truth;
- an extracted module requires a new dependency direction prohibited by the architecture contract;
- a focused check is flaky and cannot distinguish old from new behavior;
- unrelated dirty files appear or overlap the phase;
- a broad catch, silent no-op, or success-shaped fallback is proposed to preserve compatibility;
- a phase cannot be reverted without reverting unrelated work;
- browser or real-game verification is required but has not been explicitly authorized;
- Git-history rewriting lacks explicit user approval and coordination confirmation.

When stopped, the executor reports the exact file, command, observed output, expected output, and the decision needed. It does not weaken a test, change the rulebook, or silently continue.

## 9. Rollback Design

- Each task ends in a coherent commit after verification.
- A phase does not mix repository-history work, gameplay-core work, UI work, and CSS work in one commit.
- A committed failed task is rolled back with an explicit revert commit after confirming scope; destructive reset or checkout is not used.
- An uncommitted failed task is reversed only with a targeted patch over files changed by that task.
- Generated files are regenerated from the restored root source rather than manually repaired.
- Phase H uses a separate mirror clone and backup refs; it never begins in the working checkout used for normal phases.

## 10. Phase Design

### Phase 0: Behavior-invariance baseline

**Purpose:** Create enough evidence to detect accidental behavior change before structural movement begins.

**Work:**

- record current dependency-cycle, module-resolution, duplicate-source, CSS, artifact, and repository-size metrics;
- identify existing focused tests for card logic, CPU decisions, pass flow, pending selection, network parity, selfplay, sound cues, rendering helpers, and bootstrap contracts;
- add characterization fixtures only where existing coverage cannot prove a required invariant;
- record the currently known dependency-boundary failure without normalizing it as acceptable final state;
- establish a coverage matrix mapping each audited finding to at least one verification mechanism.

**Completion:** All subsequent phases have named baseline commands and objective comparison data. No production behavior is changed.

### Phase 1: Eliminate false-green validation

**Purpose:** Make normal verification fail when the known boundary and training problems recur.

**Work:**

- break the `selection-flow` -> `pass-handler` -> `cpu-decision` cycle through an explicit injected or pure shared dependency;
- connect `test/refactor.dependency-boundary.test.ts` to the normal check path;
- add semantic no-emit and build TypeScript configurations for `training/**/*.ts`;
- replace `transpileModule`-only training build behavior with a compiler `Program` emit;
- strengthen JS inventory checks so a TypeScript wrapper cannot hide a JavaScript implementation authority.

**Completion:** The dependency test and training typecheck are normal gates, all gates pass, and no accepted game result changes.

### Phase 2: Establish one source of truth per implementation

**Purpose:** Remove exact or near-exact implementation mirrors and stale compatibility bodies.

**Work:**

- turn `training/engine/selfplay-runner.ts` into a thin adapter or remove it;
- consolidate Python policy trainer v2/v3 behind one implementation with compatible entry points;
- move visual-effects-map and network-turn-handoff implementation authority into TypeScript;
- remove unused copied type trees after a reference gate proves they are unused;
- remove the stale monolithic sound-cue module and registry entry after focused cue parity checks;
- remove obsolete migration/debug scripts only after proving they are not package, documentation, deploy, or codegen dependencies;
- remove both identical `.omo/` and `.sisyphus/` evidence trees from tracked source when no active tool contract references them; if an active contract requires one named tree, keep only that named tree and document its owner and regeneration path.

**Completion:** Each listed subsystem has one implementation authority, compatibility files contain delegation only, and inventory gates prevent recurrence.

### Phase 3: Consolidate shared primitives and contracts

**Purpose:** Remove semantic drift in identity, network constants, and board helpers before consolidating larger runtimes.

**Work:**

- define distinct strict, optional, explicit-fallback, and numeric player/owner codecs;
- migrate local normalizers without changing their accepted and rejected inputs;
- centralize room, player-name, chat, history, and turn-timer constants in a runtime-portable contract;
- split `shared-board-utils` internally into geometry, access/clone, move rules, strategy features, and canonical encoding;
- retain a stable facade while migrating callers;
- add boundary tests for all legacy accepted forms before removing local fallback parsers.

**Completion:** No independent player/owner parser or duplicated network constant remains outside approved delegating adapters, and board helper behavior is fixture-equivalent.

### Phase 4: Consolidate network authority

**Purpose:** Make Worker and local server use the same authoritative command execution.

**Work:**

- extract typed ports for persistence, clock, connection delivery, and runtime-specific request/response conversion;
- move command validation, operation identity, snapshot mutation, publish/version rules, projection, journal updates, and common route behavior into runtime-neutral modules;
- split `match-authority` into focused internal modules behind a compatibility facade;
- migrate Worker and local server route-by-route, never all at once;
- delete the old route body immediately after both adapters delegate to the shared implementation;
- verify parity after every migrated route.

**Completion:** Worker/local differences are limited to transport, storage, connection, and deployment adapters. No duplicated authority body remains for publish, join, leave, spectate, deck, hand skin, rematch, snapshot, or journal behavior.

### Phase 5: Split game-core responsibilities

**Purpose:** Remove fallback authorities and long cross-responsibility game transactions.

**Work:**

- define a typed card-logic facade assembled from focused modules at the bootstrap/authority boundary;
- migrate deck/hand, cost, target, marker, turn-start, resolution, and presentation-metadata responsibilities incrementally;
- remove board-configuration and opening-placement fallbacks from card logic;
- make extracted CPU board, marker, placement, pending-target, and time-bomb modules required dependencies;
- delete duplicate CPU fallback bodies;
- stage-split pre-placement selection, card usage, and turn-pipeline functions into validation, decision, canonical mutation, event creation, and settlement steps;
- replace core dynamic global/module discovery with explicit dependency input.

**Completion:** Public behavior remains fixture-equivalent; each business rule has one body; core game code has no browser, DOM, sound, timer, network-client, or UI-global dependency.

### Phase 6: Enforce Single Visual Writer

**Purpose:** Remove the second board writer and make rendering dependencies explicit.

**Work:**

- characterize diff rendering, legal hints, marker projection, special visuals, badges, and timers;
- make the diff renderer the required board writer;
- remove `renderBoardFullLegacy()` after proving all supported paths use the canonical writer;
- split projection, DOM patching, interaction binding, and world-level side effects behind focused typed ports;
- replace oversized callback contexts with capability-specific interfaces;
- preserve snapshot/playback/busy ownership and ordered event settlement.

**Completion:** Static dependency checks find one board DOM writer, legacy rendering logic is absent, and focused rendering contracts pass. Full visual-equivalence completion additionally requires explicitly authorized playable-browser or visual-regression verification.

### Phase 7: Split UI and network orchestration

**Purpose:** Make UI integration explicit without changing user-visible flow.

**Work:**

- reduce `NetworkMatchClient` to a facade over session, publish, snapshot, rated, chat, and presence controllers;
- separate diagnostics and DOM notifications from transport/state logic;
- split bootstrap bridge construction from bridge installation;
- split card interaction into controller, DOM adapter, and gesture adapter;
- move import-time global and DOM installation into idempotent explicit initialization;
- split long network-button and related handlers into named actions;
- preserve existing globals only as documented compatibility shims that delegate to initialized services.

**Completion:** Importing core controller modules does not mutate DOM or install globals, facade compatibility tests pass, and existing UI/network flows remain ordered identically. Full visual-equivalence completion requires the same explicit browser authorization as Phase 6.

### Phase 8: Rebuild CSS ownership without redesign

**Purpose:** Remove cascade override chains while preserving computed presentation.

**Work:**

- define layer and feature ownership rules;
- inventory selector ownership and supported breakpoints;
- migrate cards, deck builder, modal, leaderboard, layout, and responsive overrides one feature at a time;
- consolidate repeated selectors under one owning file/layer;
- remove `!important` only when specificity and layer order prove equivalent behavior;
- do not change DOM structure or visual tokens merely to simplify CSS.

**Completion:** Repeated-selector and `!important` debt is reduced to an explicit allowlist with documented reasons; feature ownership is mechanically checkable; browser build passes. Full computed-style and screenshot equivalence requires explicit authorization for visual verification.

### Phase 9: Normalize generated, mirrored, and documentation lifecycles

**Purpose:** Ensure generated output is reproducible and historical evidence does not masquerade as current guidance.

**Work:**

- verify `worker-public/` can be recreated from root source through `worker:prepare`;
- decide, based on deployment reproducibility, whether to stop tracking the mirror or to enforce generated-only review rules;
- verify browser registry generation after all browser source movement;
- archive completed dated plans and mark current plans explicitly active;
- update stable architecture documents with only final durable boundaries;
- remove tracked volatile current-tree artifacts and add precise ignore rules;
- keep compact reproducibility fixtures and summaries, not browser profiles, caches, databases, or raw runs.

**Completion:** Generated and mirror surfaces are reproducible, no source edit points at a generated file, current documentation is unambiguous, and volatile artifacts are absent from the current tree.

### Phase 10: Convergence audit

**Purpose:** Prove that the audited debt is gone rather than merely moved.

**Work:**

- rerun the full twenty-finding closure matrix;
- rerun dependency, global/window, JS inventory, TypeScript, training TypeScript, network parity, browser build, Worker mirror, duplicate-source, and documentation checks;
- inspect stable facades for duplicate fallback bodies;
- inspect generated output and final repository status;
- perform explicitly authorized UI/visual verification if full visual-equivalence completion is requested;
- produce a residual-risk report; any unresolved scoped item blocks completion.

**Completion:** Every normal-scope finding has objective closure evidence and no scoped residual debt remains.

### Phase H: Isolated Git-history repair

**Purpose:** Remove historical repository bloat without coupling an irreversible coordination operation to source refactoring.

**Entry gate:** Normal phases are complete; current-tree artifact policy is committed; all collaborators are notified; explicit user approval is recorded.

**Work:**

- create a disposable mirror clone outside the working checkout;
- create backup refs and record branch/tag/object counts;
- run the selected history filter only in the mirror clone;
- verify branches, tags, commits, source checkout, builds, tests, and fresh-clone size;
- document collaborator re-clone/reset instructions;
- apply rewritten history to the authoritative remote only after a second explicit confirmation.

**Completion:** A fresh clone no longer contains removed volatile history, expected refs remain, validation passes, and collaborator recovery instructions are published.

## 11. Audit-Finding Closure Matrix

| ID | Audited finding | Owning phase | Objective closure evidence |
| --- | --- | --- | --- |
| 1 | Artifact and history bloat | 9, H | No volatile current-tree artifacts; fresh clone size and history inventory meet recorded policy |
| 2 | CPU/pass/selection cycle | 1 | Dependency guard passes through normal checks |
| 3 | Training TS not semantically checked | 1 | Training no-emit and Program build run in normal checks |
| 4 | Duplicate selfplay runner | 2 | One implementation plus delegating compatibility adapter |
| 5 | Worker/local authority duplication | 4 | Shared core owns command behavior; parity suite passes |
| 6 | JS runtime implementation authorities | 2 | TS owns implementations; JS files are generated/delegating only |
| 7 | Card logic god facade and fallbacks | 5 | Typed facade delegates to focused modules; fallback bodies absent |
| 8 | CPU extracted-module fallback copies | 5 | Required dependencies; duplicate fallback bodies absent |
| 9 | Legacy second board writer | 6 | One board writer found by structural guard |
| 10 | Stale monolithic sound cues | 2 | Monolith and registry entry absent; cue parity passes |
| 11 | Oversized network-client ownership | 7 | Focused controllers own separate concerns; facade delegates |
| 12 | Diff-renderer god context | 6 | Capability-specific typed ports replace broad contexts |
| 13 | Bootstrap/card-interaction import side effects | 7 | Imports are side-effect free; explicit idempotent init owns installation |
| 14 | Long cross-responsibility transactions | 5, 7 | Named stage functions with focused tests and unchanged outputs |
| 15 | `match-authority` / board-utils hubs | 3, 4 | Focused internal modules behind stable facades |
| 16 | Duplicated normalization/constants | 3 | One portable contract; local functions delegate only |
| 17 | Python trainer v2/v3 clone | 2 | One trainer implementation; CLI wrappers preserve compatibility |
| 18 | Copied unused type trees | 2 | Trees absent; reference/inventory guard passes |
| 19 | CSS override-chain debt | 8 | Ownership/layers enforced; duplicates and exceptions are allowlisted |
| 20 | Obsolete scripts/evidence/plans | 2, 9 | No unreferenced mutator scripts or identical evidence trees; plans classified |

## 12. Verification Strategy

### 12.1 Required automated layers

- source inspection and targeted diff checks for documentation and generated lifecycle work;
- focused Jest characterization and contract tests for game, CPU, card, renderer, bootstrap, and selfplay work;
- `npm run typecheck` plus the new training typecheck;
- `npm run checkall` with the dependency and inventory guards wired in;
- `npm run test:network:parity` for authority changes;
- `npm run build:ts` for TypeScript emit changes;
- `npm run build:browser` for browser-visible root source changes;
- `npm run worker:prepare` and mirror inspection for Worker deploy-surface changes;
- focused Python import/CLI/dataset tests for trainer consolidation;
- structural duplicate and source-authority checks for single-source phases.

### 12.2 Explicitly gated verification

The following are not run unless the user explicitly instructs real-game or browser verification:

- playable-game browser operation;
- Playwright game UI flows;
- `test/e2e/*` that launches or operates the game;
- `npm run test:visual`;
- screenshot or computed-style comparison in a live game.

These checks are required before claiming full visual-equivalence completion for Phases 6 through 8. Without authorization, the executor must report automated completion and the remaining visual-verification risk.

### 12.3 Prohibited verification shortcuts

- updating snapshots solely because refactored output differs;
- weakening dependency or source-authority guards;
- comparing only line counts or file sizes;
- treating successful TypeScript compilation as gameplay equivalence;
- treating Worker-only or local-only tests as network parity;
- hand-editing generated output until diffs disappear.

## 13. Documentation and Commit Policy

- This design is the stable program specification.
- A master execution index records phase order, dependencies, and status.
- Each phase receives a separate implementation plan with exact files, interfaces, tests, commands, expected results, and commit steps.
- Existing dated plans are referenced when still accurate, but their unchecked boxes are not treated as evidence that work is absent or complete.
- Each focused task is committed after appropriate verification.
- Implementation commits never include unrelated user changes.
- `01-rulebook.md` and relevant `正本/*.md` remain unchanged because behavior is unchanged. If either must change, the phase stops and exits this program's scope.

## 14. Final Completion Conditions

The normal refactor program is complete only when all of the following are true:

1. Every Phase 0 through Phase 10 obligation in all twenty closure-matrix rows has evidence and no open exception.
2. No known production dependency cycle remains, and the guard runs through normal verification.
3. Root and training TypeScript receive semantic checking.
4. Every audited duplicate implementation has one authority and only delegating compatibility surfaces.
5. Worker and local server share canonical authority behavior and pass parity checks.
6. Game and shared layers remain headless and do not discover UI/network globals.
7. The diff renderer is the only board visual writer.
8. Core UI/controller imports are free of undocumented installation side effects.
9. Generated and mirrored outputs are reproducible from root source.
10. Volatile artifacts are absent from the current tracked tree.
11. Current architecture documents describe the resulting boundaries, and historical plans are classified.
12. All required automated checks pass from a clean working tree.
13. Browser-visible root changes have a fresh successful browser build.
14. Worker deploy-surface changes have a verified prepared mirror.
15. Final `git status --short` is clean.

Full visual-equivalence completion additionally requires explicitly authorized playable-browser or visual-regression verification for Phases 6 through 8.

Full repository-bloat completion additionally requires Phase H and a verified fresh clone. Until Phase H is explicitly approved and completed, the program reports source/current-tree completion separately from historical-storage completion.

The program does not claim that no future refactoring opportunity can exist. It claims that every item in the twenty-finding audit has been removed according to the objective closure matrix.

## 15. Plan Deliverables After Spec Approval

After this design is reviewed and approved, planning produces:

1. `docs/superpowers/plans/2026-07-11-behavior-preserving-full-refactor-master-plan.md`;
2. one detailed implementation plan for each normal phase, Phase 0 through Phase 10;
3. one isolated Phase H history-repair runbook;
4. a master checklist mapping every plan task back to the closure matrix;
5. a final convergence-audit checklist with exact commands and expected results.

The phase plans must contain no placeholders. Each task identifies exact files, consumed and produced interfaces, characterization coverage, implementation steps, focused verification, stop conditions, diff inspection, and a coherent commit step.

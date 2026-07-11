---
status: active
owner: repository-maintainers
scope: behavior-preserving-full-refactor
created: 2026-07-11
updated: 2026-07-11
---

# Behavior-Preserving Full Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not run multiple implementation tasks in the same checkout concurrently.

**Goal:** Remove the twenty audited structural debts while preserving canonical game results, network authority, CPU/selfplay determinism, browser presentation, and deploy output.

**Architecture:** Work proceeds through stable public facades into focused typed modules and explicit runtime adapters. Each task first captures existing observable behavior, then moves one responsibility, deletes the replaced authority, and proves the original behavior through focused checks. The master design is [2026-07-11-behavior-preserving-full-refactor-design.md](../specs/2026-07-11-behavior-preserving-full-refactor-design.md); this document is the operational runbook.

**Tech Stack:** TypeScript/CommonJS, Jest, Node.js, Python training tools, Cloudflare Worker, static browser bundles, PowerShell, Git.

## Execution status

- Phases 0–7: completed in behavior-preserving commits. Phase 10 re-opened and then closed the omitted Phase 2.2 trainer consolidation in `566d1fab1`.
- Phase 8: static ownership work is complete; its required visual-equivalence gate awaits explicit user authorization for `npm run test:visual`.
- Phase 9: completed. The Worker mirror is guarded, volatile artifacts are untracked and guarded, and dated plans are classified.
- Phase 10 Task 10.1: completed; Task 10.2 remains user-gated visual verification.
- Phase H: pending and requires separate explicit approval.

## Global Constraints

- Treat `01-rulebook.md` as the source of truth for player-visible behavior and `docs/architecture-contracts.md` as the source of truth for boundaries and authority.
- Do not modify `01-rulebook.md`, relevant `正本/*.md`, or `docs/HUMAN-DEV-GUIDE.md` in this program. Stop if a change to one of them appears necessary.
- Root source is authoritative. Do not hand-edit `dist/`, `worker-public/`, or `public/module-registry.js`.
- Preserve canonical state, seed consumption, CPU choice, `events[]` values and order, snapshots, projection, error codes, animation/sound selection, and DOM-visible copy.
- Start every task with `git status --short`. Stop for unrelated or unexplained changes.
- Run one task at a time in this checkout. Do not create a branch, tag, or worktree unless the user explicitly requests it.
- One task is one coherent commit. Never use `git add -A`, destructive reset, destructive checkout, or broad cleanup.
- A failing characterization test stops the task. Do not update an expected value merely because the refactor changed it.
- Run playable-browser, Playwright, or visual-regression game checks only after explicit user authorization. Until then, UI tasks can reach automated completion but not full visual-equivalence completion.
- Phase H changes Git history and remote state. It requires its own explicit approval after Phases 0–10 are complete.

---

## File Map

| Area | Primary source | Existing focused evidence |
| --- | --- | --- |
| Dependency cycle | `game/pass-handler.ts`, `game/cpu-decision.ts`, `game/card-effects/selection-flow.ts`, `ui/bootstrap/pass-runtime-wiring.ts` | `test/refactor.dependency-boundary.test.ts`, `test/game.pass-handler.test.ts`, `test/game.pending-selection-flow.test.ts`, `test/ui.bootstrap.cpu-early-registration.test.ts` |
| Training compiler and selfplay | `scripts/build-training-cli.ts`, `tsconfig*.json`, `src/engine/selfplay-runner.ts`, `training/engine/selfplay-runner.ts` | `test/selfplay.position-weights.test.ts`, `training/tests/selfplay.runner.test.ts`, `training/tests/selfplay.runtime-parity.test.ts` |
| Python trainers | `training/python/train_policy_onnx_v2.py`, `training/python/train_policy_onnx_v3.py`, `training/python/onnx_trainer_common.py` | `training/tests/onnx-trainer.grouped-split.test.ts` |
| Shared contracts | `utils/owner-helpers.ts`, `shared/player-encoding.ts`, `shared/shared-board-utils.ts`, `utils/match-authority.ts` | `test/ui.network-client.seat-normalization.test.ts`, `test/utils.match-authority.publish-response.test.ts` |
| Network authority | `workers/match-worker.ts`, `scripts/local-match-server.ts`, `utils/match-runtime-core.ts` | `npm run test:match:parity`, `npm run test:network:parity`, `test/match-runtime-parity.test.ts` |
| Game core | `game/logic/cards.ts`, `game/cpu-decision.ts`, `game/turn/action-phase/pre-placement-selection.ts`, `game/cards/effect-resolver.ts`, `game/turn/turn_pipeline_phases.ts` | card, CPU, pending-selection, pass, and turn-pipeline tests under `test/` |
| Rendering | `ui/board-renderer.ts`, `ui/diff-renderer.ts`, `game/turn/pipeline-ui/*sound-cues*.ts` | `test/ui.board-renderer.*.test.ts`, `test/ui.diff-renderer*.test.ts`, animation tests |
| UI orchestration | `ui/network-client.ts`, `ui/bootstrap.ts`, `cards/card-interaction.ts`, `ui/handlers/match-mode/network-buttons.ts` | `test/ui.network-client.*.test.ts`, `test/ui.match-mode.*.test.ts`, `test/ui.bootstrap.cpu-early-registration.test.ts` |
| CSS | `styles-*.css`, `index.html`, `ui/handlers/match-mode/*` | `test/ui.match-mode.leaderboard-styles.test.ts`; visual checks need explicit authorization |
| Generation and repository hygiene | `scripts/run-all-checks.ts`, `scripts/inventory-js-legacy.ts`, `scripts/prepare-worker-assets.ts`, `scripts/build-module-registry.ts`, `.gitignore`, `docs/` | `npm run checkall`, `npm run build:browser`, `npm run worker:prepare`, `test/scripts.*.test.ts` |

## Universal Task Procedure

Every task below uses this exact order unless its task text adds a stricter requirement.

- [ ] Run `git status --short`; classify every reported path before editing.
- [ ] Read the files named in that task and the matching section of the master design.
- [ ] Run the task's baseline command. Record the command and result in the task commit message or phase log.
- [ ] Add or identify characterization coverage before moving code.
- [ ] Make one focused source-of-truth change through `apply_patch`.
- [ ] Delete the replaced duplicate body or success-shaped fallback in the same task.
- [ ] Run the task's focused verification and `git diff --check`.
- [ ] Inspect `git diff -- <intentional files>` and `git status --short`.
- [ ] Stage only intentional files and commit with the listed message.

If a task creates browser-visible root changes, run `npm run build:browser` after the focused checks. If a task changes the Worker deploy surface, run `npm run worker:prepare` before inspecting its generated mirror.

## Phase 0 — Freeze the Evidence Baseline

### Task 0.1: Capture a reproducible baseline ledger

**Files:**

- Create: `docs/refactor-baselines/2026-07-11-program-baseline.md`
- Create: `scripts/capture-refactor-baseline.ts`
- Create: `scripts/capture-refactor-baseline.js`
- Test: `test/scripts.capture-refactor-baseline.test.ts`

**Produces:** A tracked, deterministic ledger containing the starting commit, Node/npm/Python versions, `package-lock.json` hash, tracked artifact count, Git object statistics, source-authority inventory, and the exact commands used as comparison baselines.

- [ ] Add a test that runs the script in a temporary fixture directory and asserts that it emits stable key ordering, does not mutate the repository, and reports missing optional Python cleanly.
- [ ] Run the test and confirm it fails because the script does not exist.
- [ ] Implement the TypeScript source and an adjacent CommonJS wrapper that follows the existing pattern: `const mod = require('../dist/scripts/capture-refactor-baseline'); if (require.main === module) mod.main(); module.exports = mod;`. The implementation uses read-only filesystem and Git commands only, writes only the explicitly supplied output path, and never enumerates or copies artifact contents.
- [ ] Run `npm run build:ts`, then run `node scripts/capture-refactor-baseline.js --output docs/refactor-baselines/2026-07-11-program-baseline.md` through that wrapper.
- [ ] Record these values: `git rev-parse HEAD`, `node --version`, `npm --version`, `.venv\Scripts\python.exe --version` when present, `Get-FileHash package-lock.json`, `git count-objects -vH`, `git ls-files artifacts | Measure-Object`, and logical `git ls-tree -r -l HEAD -- artifacts` size.
- [ ] Verify the ledger contains no secret, browser-profile, cache, database, or raw artifact payload.
- [ ] Run `npx jest --runInBand --runTestsByPath test\scripts.capture-refactor-baseline.test.ts` and `git diff --check`.
- [ ] Commit: `test: capture refactor baseline ledger`.

### Task 0.2: Record behavioral and structural baselines

**Files:**

- Modify: `docs/refactor-baselines/2026-07-11-program-baseline.md`
- Test: existing focused tests listed below

**Consumes:** The Phase 0.1 ledger.

- [ ] Run and record the expected current result of `npx jest --runInBand --runTestsByPath test\refactor.dependency-boundary.test.ts`; the known three-file cyclic component is recorded as a failing baseline, not an accepted completion result.
- [ ] Run and record `npx jest --runInBand --runTestsByPath test\game.pass-handler.test.ts test\game.pass-clears-pending.test.ts test\game.pending-selection-flow.test.ts test\cpu.turn-handler.retry.test.ts test\cpu.turn-handler.programmed-card-policy.test.ts`.
- [ ] Run and record `npm run test:match:parity`, `npm run typecheck`, `npm run checkall`, and `npm run check:window`.
- [ ] Run and record `npx jest --runInBand --runTestsByPath test\selfplay.position-weights.test.ts training\tests\selfplay.runner.test.ts training\tests\selfplay.runtime-parity.test.ts`.
- [ ] Add a table mapping audit IDs 1–20 to at least one focused test or structural inventory command. Do not mark any audit item complete in this phase.
- [ ] Commit: `docs: record full refactor baseline`.

**Phase 0 completion:** The ledger is reproducible, all known failures are explicit, every audit ID has a planned comparison mechanism, and no runtime source changed.

## Phase 1 — Remove False-Green Gates

### Task 1.1: Remove the pass/CPU/selection dependency cycle

**Files:**

- Modify: `game/pass-handler.ts`
- Modify: `ui/bootstrap/pass-runtime-wiring.ts`
- Modify: `game/card-effects/selection-flow.ts`
- Modify: `test/refactor.dependency-boundary.test.ts`
- Modify: `test/game.pass-handler.test.ts`
- Modify: `test/game.pending-selection-flow.test.ts`
- Modify: `test/ui.bootstrap.cpu-early-registration.test.ts`

**Consumes:** Existing `passHandlerRuntime` injection and the existing selection-flow signal bridge.

**Produces:** `pass-handler` obtains `resolveCpuDecisionLevelForPlayer` from its injected runtime, and selection flow obtains `ensureCurrentPlayerCanActOrPass` only from its injected signal bridge. Neither file locally requires the next module in the former cycle.

- [ ] Add assertions that bootstrap injects a resolver whose return values match `CpuDecision.resolveCpuDecisionLevelForPlayer`, and that selection flow uses the bridge callback for pass settlement.
- [ ] Remove the direct `require('./cpu-decision')` fallback in `game/pass-handler.ts`; preserve the existing default CPU-level behavior through the injected resolver and characterize the no-resolver fallback separately.
- [ ] Remove the `_require('../pass-handler')` fallback in `game/card-effects/selection-flow.ts`; a missing bridge callback must use the existing explicit failure/false path, never discover a module.
- [ ] Keep `game/cpu-decision.ts`'s selection-flow use unchanged in this task; once the two reverse edges are removed, the three-node cycle is gone without changing CPU selection behavior.
- [ ] Remove the cyclic-component expectation from `test/refactor.dependency-boundary.test.ts`.
- [ ] Run `npx jest --runInBand --runTestsByPath test\refactor.dependency-boundary.test.ts test\game.pass-handler.test.ts test\game.pass-clears-pending.test.ts test\game.pending-selection-flow.test.ts test\ui.bootstrap.cpu-early-registration.test.ts test\cpu.turn-handler.retry.test.ts test\cpu.turn-handler.programmed-card-policy.test.ts`.
- [ ] Run `npm run check:window` and `npm run typecheck`.
- [ ] Commit: `refactor: remove pass cpu selection cycle`.

### Task 1.2: Make dependency-cycle checks part of `checkall`

**Files:**

- Modify: `package.json`
- Modify: `scripts/run-all-checks.ts`
- Modify: `test/refactor.dependency-boundary.test.ts`
- Create: `test/checkall.dependency-boundary-wiring.test.ts`

**Produces:** A stable `check:dependency-boundaries` package script and a `checkall` invocation that fails when the cycle guard fails.

- [ ] Add package script `"check:dependency-boundaries": "jest --runInBand --runTestsByPath test\\refactor.dependency-boundary.test.ts"`.
- [ ] In `scripts/run-all-checks.ts`, add a cross-platform npm command helper using `npm.cmd` on Windows and `npm` elsewhere; invoke `run(npmCommand, ['run', '--silent', 'check:dependency-boundaries'])` after static source checks.
- [ ] Add the wiring test that reads `package.json` and `scripts/run-all-checks.ts`, asserting the script name and invocation are present.
- [ ] Run `npx jest --runInBand --runTestsByPath test\checkall.dependency-boundary-wiring.test.ts test\refactor.dependency-boundary.test.ts`.
- [ ] Run `npm run checkall`; expected result: it passes only with no unexpected runtime cycles.
- [ ] Commit: `build: gate dependency boundaries in checkall`.

### Task 1.3: Add semantic training TypeScript gates

**Files:**

- Create: `tsconfig.training.json`
- Create: `tsconfig.training.build.json`
- Modify: `package.json`
- Modify: `scripts/build-training-cli.ts`
- Create: `test/training.typecheck-boundary.test.ts`
- Modify: `test/selfplay.position-weights.test.ts`

**Consumes:** The historical implementation details in `docs/archive/2026-06-14-training-typecheck-selfplay-mirror-refactor.md`.

- [ ] Create `tsconfig.training.json` extending `./tsconfig.json` with `allowJs: false`, `noEmit: true`, and includes for `training/scripts/**/*.ts` and `training/engine/**/*.ts`; exclude generated output and `training/tests/**/*`.
- [ ] Create `tsconfig.training.build.json` extending `./tsconfig.json` with `allowJs: false`, `noEmit: false`, `declaration: false`, `declarationMap: false`, `rootDir: ./training/scripts`, `outDir: ./dist/scripts`, and include only `training/scripts/**/*.ts`.
- [ ] Add exactly `"typecheck:training": "tsc -p tsconfig.training.json --pretty false"`; append it to root `typecheck`, `typecheck:ts-only`, and `build:ts` without removing their current root TypeScript work.
- [ ] Replace `ts.transpileModule` with a `ts.findConfigFile` → `ts.readConfigFile` → `ts.parseJsonConfigFileContent` → `ts.createProgram` → `ts.getPreEmitDiagnostics` → `program.emit` pipeline. Diagnostics must produce a nonzero exit before deleting or replacing prior emitted training output.
- [ ] Change the selfplay test from duplicated-weight equivalence to single-authority delegation expectations.
- [ ] Run `npx jest --runInBand --runTestsByPath test\training.typecheck-boundary.test.ts test\selfplay.position-weights.test.ts`.
- [ ] Run `npm run typecheck`, `npm run build:ts`, and `npm run checkall`.
- [ ] Commit configs and gate wiring separately from compiler implementation if both diffs cannot be reviewed as one coherent unit.

### Task 1.4: Detect JavaScript implementation authorities hidden by wrappers

**Files:**

- Modify: `scripts/inventory-js-legacy.ts`
- Create: `test/scripts.inventory-js-legacy.test.ts`
- Modify: `game/visual-effects-map.ts`
- Modify: `game/network-turn-handoff.ts`

- [ ] Add failing inventory fixtures for a TypeScript file that merely loads a same-feature `*.runtime.js` implementation and for a permitted thin JavaScript wrapper.
- [ ] Define the rule: a JavaScript runtime file is permitted only when generated, a documented compatibility projection, or explicitly allowlisted with an owner and removal phase; a wrapper cannot satisfy the rule by itself.
- [ ] Initially allowlist the two known authorities with an expiry that Phase 2 removes; do not make the test permanently accept them.
- [ ] Run the inventory test, `npm run build:ts`, and `npm run checkall`.
- [ ] Commit: `test: detect hidden js implementation authorities`.

**Phase 1 completion:** `checkall` runs the dependency gate; the former cycle is absent; training TypeScript is semantically checked; hidden JavaScript authority is a failing/expiring inventory category rather than a silent pass.

## Phase 2 — Establish One Implementation Authority

### Task 2.1: Remove the training selfplay mirror

**Files:**

- Modify: `training/engine/selfplay-runner.ts`
- Verify: `training/engine/selfplay-runner.js`
- Verify: `training/src/engine/selfplay-runner.js`
- Modify: `test/selfplay.position-weights.test.ts`
- Test: `training/tests/selfplay.runner.test.ts`, `training/tests/selfplay.runtime-parity.test.ts`

- [ ] Replace the TypeScript mirror with a delegation surface to `src/engine/selfplay-runner` or remove it after all imports point to root.
- [ ] Preserve current CommonJS export shape and test both direct root import and training compatibility import.
- [ ] Run the selfplay boundary test, runner test, runtime parity test, `npm run typecheck`, and `npm run build:ts`.
- [ ] Commit: `refactor: make selfplay runner single-source`.

### Task 2.2: Consolidate Python policy trainer v2/v3

**Files:**

- Create: `training/python/policy_trainer_cnn.py`
- Modify: `training/python/train_policy_onnx_v2.py`
- Modify: `training/python/train_policy_onnx_v3.py`
- Modify: `training/python/onnx_trainer_common.py` only for genuinely shared utilities
- Test: `training/tests/onnx-trainer.grouped-split.test.ts`

- [ ] Capture v2 and v3 CLI `--help`, schema identifier, input tensor names, default history behavior, grouped split output, and deterministic sample ordering in fixtures before moving code.
- [ ] Put shared argument parsing, dataset construction, model assembly, training loop, and ONNX export in `policy_trainer_cnn.py`.
- [ ] Keep v2 and v3 filenames as thin entry points that pass an explicit immutable compatibility profile to the shared implementation.
- [ ] Preserve the currently emitted schema name for each entry point; do not infer a version from its filename.
- [ ] Run `.\.venv\Scripts\python.exe -m py_compile training\python\policy_trainer_cnn.py training\python\train_policy_onnx_v2.py training\python\train_policy_onnx_v3.py`, then `npx jest --runInBand --runTestsByPath training\tests\onnx-trainer.grouped-split.test.ts` and the smallest deterministic CLI fixture captured in the first step.
- [ ] Commit: `refactor: unify policy cnn trainers`.

### Task 2.3: Move the two runtime authorities to TypeScript

**Files:**

- Modify: `game/visual-effects-map.ts`
- Modify or delete: `game/visual-effects-map.runtime.js`
- Modify: `game/network-turn-handoff.ts`
- Modify or delete: `game/network-turn-handoff.runtime.js`
- Modify: inventory tests from Task 1.4
- Test: `test/game.ui-boundary.test.ts`, `test/ui.visual-effects-map.shared.test.ts`, `test/game.network-turn-handoff.test.ts`, `test/game.card-effects.selection-flow.test.ts`

- [ ] Export the current runtime API from the `.ts` source with the same CommonJS shape.
- [ ] If a `.js` path is required by classic browser loading, retain only a forwarding projection generated from the TypeScript output; it may not contain logic.
- [ ] Add source-authority assertions that the two `*.runtime.js` files no longer define their public implementation symbols.
- [ ] Run `npx jest --runInBand --runTestsByPath test\\game.ui-boundary.test.ts test\\ui.visual-effects-map.shared.test.ts test\\game.network-turn-handoff.test.ts test\\game.card-effects.selection-flow.test.ts`, then `npm run typecheck`, `npm run build:ts`, and `npm run checkall`.
- [ ] Run `npm run build:browser` because these modules are browser runtime surfaces.
- [ ] Commit each module migration separately.

### Task 2.4: Delete stale copied sources and obsolete tools

**Files:**

- Delete after reference proof: `game/src/types/**`, `game/cards/src/types/**`, `game/logic/src/types/**`
- Delete or archive after reference proof: the 24 migration/debug script families listed in the master design audit
- Delete or retain one documented copy: `.omo/**`, `.sisyphus/**`
- Modify: `scripts/inventory-js-legacy.ts`, relevant tests, and documentation references

- [ ] For each deletion candidate, run `rg -n` across source, package scripts, CI configuration, documentation, and generators. The script-family inventory is: `add-module-tracking`, `check-bootstrap`, `check-init-factory`, `check-registry-content`, `check-registry-content2`, `check-registry-dups`, `check-registry-dups2`, `clean-dist-require`, `convert-ui-to-ts`, `cross-ref-scripts`, `debug-single`, `debug-single2`, `dedup-require`, `find-initdom`, `find-missing`, `find-pc`, `find-reset`, `list-registry`, `remove-fn-require`, `remove-local-require`, `test-json`, `validate-new`, `validate-registry`, and `validate-single`, including each adjacent `.js` wrapper. Record the zero-reference or replacement reference in the phase log.
- [ ] Add an inventory test that rejects copied compiled helper boilerplate in TypeScript source and rejects unreferenced mutator scripts outside an explicit maintenance allowlist.
- [ ] Remove one family per commit; do not combine unrelated deletions.
- [ ] For `.omo` and `.sisyphus`, verify hashes before removal and preserve neither unless an active tool contract names it.
- [ ] Run the relevant inventory tests, `npm run typecheck`, and `npm run checkall` after each family.

### Task 2.5: Retire the stale sound-cue monolith

**Files:**

- Delete: `game/turn/pipeline-ui/sound-cues.ts` only after reference proof
- Modify: `scripts/build-module-registry.ts` or its source inputs
- Test: `test/ui.animation-feedback-events.sound-keys.test.ts`, `test/ui.animation-engine.test.ts`

- [ ] Characterize sound keys and cue ordering from the active split modules.
- [ ] Prove that no source consumer needs the monolith; remove the registry entry from its generator input, never from generated output directly.
- [ ] Delete the monolith and any compatibility wrapper that duplicates its logic.
- [ ] Run focused sound/animation tests, `npm run build:browser`, and `npm run checkall`.
- [ ] Commit: `refactor: remove stale sound cue monolith`.

**Phase 2 completion:** Every listed implementation has one authority, compatibility files delegate only, inventories reject recurrence, and browser builds use the new source paths.

## Phase 3 — Consolidate Shared Contracts

### Task 3.1: Create a player/owner normalization compatibility matrix

**Files:**

- Modify: `utils/owner-helpers.ts`, `shared/player-encoding.ts`
- Modify callers only after matrix coverage: Worker, local server, UI network modules, pass handler, and card helpers
- Create: `test/player-owner-normalization.contract.test.ts`

- [ ] Enumerate every currently accepted input spelling, including black/white, b/w, numeric values, numeric strings, nullish input, and invalid input, with its current strict/optional/fallback result.
- [ ] Implement or expose distinct strict parse, optional parse, explicit-fallback normalization, and numeric codec functions in the portable shared boundary.
- [ ] Replace local parser bodies with delegating calls while preserving each caller's intentional strict/optional/fallback semantics.
- [ ] The test must compare old and new results for every row before local fallback bodies are removed.
- [ ] Run `npx jest --runInBand --runTestsByPath test\player-owner-normalization.contract.test.ts test\ui.network-client.seat-normalization.test.ts` plus focused Worker/local tests.
- [ ] Commit by caller group: shared codec first, then UI, then runtime adapters, then game helpers.

### Task 3.2: Centralize network constants and validation

**Files:**

- Create: `shared/network-contract.ts`
- Modify: `utils/match-authority.ts`, `ui/network-client.ts`, `workers/match-worker.ts`, `scripts/local-match-server.ts`
- Test: relevant UI network, Worker publish, and local publish contract tests

- [ ] Capture exact current room ID length, player-name limit, chat length/history, turn timer, and validation error behavior.
- [ ] Move values and pure validation functions into `shared/network-contract.ts`; do not import Worker, DOM, storage, or UI code there.
- [ ] Make every existing local constant import or delegate to the shared value.
- [ ] Run `npm run test:network:parity`, `npm run typecheck`, and `npm run checkall`.
- [ ] Commit: `refactor: centralize network contract constants`.

### Task 3.3: Internally split shared board utilities

**Files:**

- Modify: `shared/shared-board-utils.ts`
- Create: focused modules under `shared/board/`
- Test: existing board-rule, board-encoding, CPU, and card tests discovered in Phase 0

- [ ] Create leaf modules in this order: geometry/configuration, board access/clone, legal-move rules, strategic features, canonical encoding/notation.
- [ ] Keep `shared/shared-board-utils.ts` as a compatibility facade until all callers migrate.
- [ ] Move one leaf at a time; delete the old body in the facade and retain only forwarding exports.
- [ ] Add fixture equivalence for dimensions, opening placement, legal moves, canonical transforms, and notation.
- [ ] Run affected focused tests, `npm run check:window`, and `npm run typecheck` after each leaf.
- [ ] Commit one leaf per commit.

**Phase 3 completion:** No independent normalization body or duplicated network constant remains outside approved adapters, and shared board behavior is fixture-equivalent behind a stable facade.

## Phase 4 — Consolidate Network Authority

### Task 4.1: Define runtime-neutral authority ports

**Files:**

- Create: `utils/match-runtime-ports.ts`
- Create: `utils/match-command-runtime.ts`
- Modify: `utils/match-runtime-core.ts`
- Test: `test/match-runtime-parity.test.ts`, `test/network.authority-path-hardening.test.ts`

- [ ] Derive ports from existing Worker/local differences only: persistence, clock, ID/entropy source, connection delivery, and HTTP request/response conversion.
- [ ] Do not place Cloudflare, Node HTTP, WebSocket, DOM, or UI imports in the runtime-neutral modules.
- [ ] Add tests with fake ports proving that command execution returns the same canonical result independently of transport.
- [ ] Run the two focused tests and `npm run typecheck`.
- [ ] Commit: `refactor: define match authority runtime ports`.

### Task 4.2: Migrate authority routes one route family at a time

**Files:**

- Modify: `workers/match-worker.ts`, `scripts/local-match-server.ts`, `utils/match-command-runtime.ts`, `utils/match-authority.ts`
- Test: `test/local-match-server.publish-contract.test.ts`, `test/local-match-server.leave-contract.test.ts`, Worker publish/stream/leave tests, `npm run test:match:parity`

- [ ] Migrate in this fixed order: publish/version, join/spectate, leave/token revocation, deck/hand skin, rematch, snapshot/resync, stream/journal.
- [ ] Before each migration, select matching Worker/local functions and capture their response, snapshot, and journal expectations in an existing or new parity test.
- [ ] Move the common body into the shared runtime module; keep only request adaptation and port implementation in Worker/local files.
- [ ] Delete both previous common bodies in the same route-family task.
- [ ] Run the named focused tests and `npm run test:match:parity` after every route family; run `npm run test:network:parity` after publish, rematch, snapshot, and stream families.
- [ ] Commit one route family per commit.

### Task 4.3: Split `match-authority` behind its facade

**Files:**

- Modify: `utils/match-authority.ts`
- Create: `utils/match-authority/identity.ts`, `publish.ts`, `projection.ts`, `journal.ts`, `room-lifecycle.ts`
- Test: existing `test/utils.match-authority.*.test.ts` and network parity suites

- [ ] Move only pure/portable logic into one focused module at a time.
- [ ] Preserve the current `match-authority` export surface as forwarding exports until consumers migrate.
- [ ] Add an export inventory test that compares the facade's public keys before and after each extraction.
- [ ] Run focused authority tests, `npm run test:network:parity`, `npm run typecheck`, and `npm run checkall`.
- [ ] Commit one focused authority module per commit.

**Phase 4 completion:** Worker/local code contains only transport/storage/connection adapters for covered route families, common authority bodies exist once, and full parity suites pass.

## Phase 5 — Split Game Core Without Changing Rules

### Task 5.1: Turn card logic into a composed facade

**Files:**

- Modify: `game/logic/cards.ts`
- Create: focused modules below `game/logic/cards-internal/` or the existing card-logic boundary
- Test: existing card resolution, target, cost, marker, deck/hand, and turn-start tests under `test/`

- [ ] Freeze the current `cardsApi` export keys in a source-level export inventory test.
- [ ] Extract in this order: board/config lookup, deck/hand, cost/target validation, markers, turn-start processing, resolution dispatch, presentation metadata.
- [ ] Assemble the facade at the existing card-logic boundary; do not make pure logic discover globals or UI dependencies.
- [ ] Delete board configuration/opening placement fallback copies after shared board utility coverage proves the canonical helper is always available.
- [ ] Run focused card suites and `npm run check:window` after every extracted responsibility.
- [ ] Commit one responsibility per commit.

### Task 5.2: Finish CPU extraction and delete fallback bodies

**Files:**

- Modify: `game/cpu-decision.ts`
- Verify or modify: extracted `game/cpu-decision-*.ts` modules
- Test: CPU decision, pending action, time-bomb, placement, and programmed-card-policy tests

- [ ] Build a function inventory matching each local fallback body to its extracted module implementation.
- [ ] Require the extracted module through the CPU composition boundary; fail during setup when a required capability is absent instead of recomputing locally.
- [ ] Delete one fallback family at a time: board/marker primitives, placement filters, pending targets, time-bomb targets, then public-action composition.
- [ ] Compare CPU actions and targets for the fixed seeds recorded in Phase 0 before and after each deletion.
- [ ] Run the focused CPU suite, `npm run check:window`, and `npm run typecheck`.
- [ ] Commit one fallback family per commit.

### Task 5.3: Stage-split long game transactions

**Files:**

- Modify: `game/turn/action-phase/pre-placement-selection.ts`
- Modify: `game/cards/effect-resolver.ts`
- Modify: `game/turn/turn_pipeline_phases.ts`
- Test: pending-selection, card-use, turn-pipeline, destroy-protection, and event-ordering tests

- [ ] Keep each public function signature intact while building an internal context only from its existing arguments.
- [ ] Split in the fixed stage order: validation, decision/target resolution, canonical mutation, event assembly, settlement/cleanup.
- [ ] Do not move network, DOM, sound, timer, or UI code into `game/` helpers.
- [ ] Add event-array and state comparison assertions before extracting each stage.
- [ ] Run focused tests and `npm run check:window` after each function, then commit each function separately.

**Phase 5 completion:** Each audited game rule and CPU capability has one implementation body, card facade exports remain compatible, and game/shared layers remain headless.

## Phase 6 — Enforce One Board Visual Writer

### Task 6.1: Make diff rendering the required board writer

**Files:**

- Modify: `ui/board-renderer.ts`
- Modify: `ui/diff-renderer.ts`
- Create: `test/ui.board-renderer.single-writer.test.ts`
- Test: `test/ui.board-renderer.visual-state.test.ts`, `test/ui.board-renderer.fallback-legal-hint.test.ts`, `test/ui.diff-renderer*.test.ts`

- [ ] Add a structural test that fails when `renderBoardFullLegacy` exists or when `ui/board-renderer.ts` writes board-cell DOM outside the documented diff-renderer capability.
- [ ] Characterize legal hints, marker projection, special visuals, timer/badge state, and force-full-render behavior.
- [ ] Make `renderBoardFull` call the canonical diff-renderer capability and preserve the existing explicit failure behavior if that capability is unavailable.
- [ ] Delete `renderBoardFullLegacy` and its duplicate DOM logic in the same commit.
- [ ] Run the structural test, all named focused renderer tests, `npm run typecheck`, and `npm run build:browser`.
- [ ] Commit: `refactor: enforce single board writer`.

### Task 6.2: Replace diff-renderer god contexts with capabilities

**Files:**

- Modify: `ui/diff-renderer.ts`
- Create: focused modules below `ui/diff-renderer/`
- Test: equality, flip, marker, viewer-context, manifest-background, timer-patch, and destroy-fade tests

- [ ] Extract projection, equality, DOM patching, interaction binding, and world side effects in that order.
- [ ] Give each extracted module only the methods it consumes; do not pass a copied renderer instance or generic 29/36-field context object.
- [ ] Preserve the single writer and playback lock contracts through existing tests.
- [ ] Run focused renderer tests, `npm run build:browser`, and `npm run checkall`.
- [ ] Commit one capability extraction per commit.

**Phase 6 completion:** The legacy writer is gone, renderer dependencies are capability-specific, and source-level guard plus focused renderer tests prove single-writer ownership.

## Phase 7 — Split UI and Network Orchestration

### Task 7.1: Thin the network-client facade

**Files:**

- Modify: `ui/network-client.ts`
- Create or complete controllers under `ui/network/`
- Test: `test/ui.network-client.*.test.ts`, `npm run test:network:parity`

- [ ] Preserve the existing `NetworkMatchClient` public method list with an export/API inventory test.
- [ ] Extract in this order: session, publish, snapshot intake, rated/ranking, chat, presence, diagnostics.
- [ ] Keep DOM toast/F12 diagnostics out of transport and canonical snapshot logic.
- [ ] Compare publish payload, base version, reconnect, effect-log, pending-selection, and result-sync behavior after every extraction.
- [ ] Run the matching focused tests plus `npm run test:network:parity`, then commit one controller per commit.

### Task 7.2: Make bootstrap and card interaction initialization explicit

**Files:**

- Modify: `ui/bootstrap.ts`, `ui/bootstrap/pass-runtime-wiring.ts`
- Modify: `cards/card-interaction.ts`
- Create: focused controller/DOM/gesture modules adjacent to card interaction
- Test: `test/ui.bootstrap.cpu-early-registration.test.ts`, `test/ui.card-interaction-overlay-selection.test.ts`, relevant card-use tests

- [ ] Add import-safety tests that import controller modules with spies on `window`, `document`, and listener registration; importing must not install globals or listeners.
- [ ] Split bridge creation from installation. Install through idempotent explicit initialization called by the existing bootstrap entry point.
- [ ] Split card interaction into a pure/controller layer, DOM detail adapter, and gesture adapter while preserving the current public facade.
- [ ] Keep compatibility globals at the bootstrap boundary only and test that they delegate after initialization.
- [ ] Run focused bootstrap/card tests, `npm run typecheck`, and `npm run build:browser`; commit one surface at a time.

### Task 7.3: Split remaining long UI handlers

**Files:**

- Modify: `ui/handlers/match-mode/network-buttons.ts`
- Test: `test/ui.match-mode.network-button.test.ts`, `test/ui.match-mode.network-clipboard.test.ts`

- [ ] Characterize enabled/disabled state, clipboard behavior, error display, publish order, and cleanup for each button action.
- [ ] Move each action into named helpers that consume only the DOM and client capabilities needed for that action.
- [ ] Keep the binding function as an ordering facade; it must return the same cleanup shape as before.
- [ ] Run focused match-mode tests and `npm run typecheck`.
- [ ] Commit: `refactor: split network button actions`.

**Phase 7 completion:** Facades retain public compatibility, imports do not perform undocumented DOM/global installation, and network/UI ordering remains covered by focused and parity tests.

## Phase 8 — Rebuild CSS Ownership

### Task 8.1: Establish CSS ownership inventory and layers

**Files:**

- Create: `docs/refactor-baselines/css-ownership.md`
- Modify: `index.html` and root CSS files only when source order must become explicit
- Modify: `styles-layout-controls.css`, `styles-layout-info.css`, `styles-cards.css`, `styles-leaderboard.css`, responsive files
- Test: `test/ui.match-mode.leaderboard-styles.test.ts`

- [ ] Record stylesheet load order from `index.html` and dynamic leaderboard insertion; identify one owner for every repeated selector in the audit.
- [ ] Introduce explicit cascade layers or an equivalent documented order without altering class/id names or DOM structure.
- [ ] Preserve dynamic leaderboard stylesheet loading and test its insertion order.
- [ ] Run `npm run build:browser`, focused stylesheet tests, and `git diff --check -- styles-*.css index.html`.
- [ ] Commit: `docs: define css ownership layers` if only documentation/order metadata changes, otherwise `refactor: establish css ownership layers`.

### Task 8.2: Migrate CSS by visible feature

**Files:**

- Modify only the stylesheets owned by one feature per task: cards, deck builder, modal, leaderboard, layout controls, then responsive overrides

- [ ] For each feature, consolidate duplicate selectors into its owner layer before removing any `!important`.
- [ ] Remove an `!important` only with a documented specificity/layer proof; otherwise retain it in the explicit exception list.
- [ ] Run focused non-browser checks and `npm run build:browser` after each feature.
- [ ] Request explicit user authorization before running `npm run test:visual` or a playable-browser check. If not authorized, commit automated results and record the remaining visual-verification gate.
- [ ] Commit one feature per commit.

**Phase 8 completion:** CSS ownership and exceptions are documented and mechanically searchable. Full visual-equivalence completion remains blocked until explicitly authorized visual verification passes.

## Phase 9 — Normalize Generation, Documentation, and Current-Tree Artifacts

### Task 9.1: Make mirror lifecycle explicit

**Files:**

- Modify as required: `scripts/prepare-worker-assets.ts`, `scripts/build-module-registry.ts`, `scripts/check-browser-build-up-to-date.ts`, package scripts, documentation
- Test: `test/scripts.prepare-worker-assets.test.ts`, `test/scripts.build-module-registry.boot-contract.test.ts`

- [ ] Determine whether `worker-public/` must remain tracked by reproducing it from a clean root source with `npm run worker:prepare` and comparing only generator-owned paths.
- [ ] If it remains tracked, add a generated-only check that rejects manual-only drift. If it becomes untracked, first prove `worker:dev` and `worker:deploy` regenerate it and update ignore/deploy documentation in the same commit.
- [ ] Run `npm run worker:prepare`, relevant script tests, `npm run build:browser`, and `npm run checkall`.
- [ ] Commit the lifecycle decision and its guard together.

### Task 9.2: Remove volatile current-tree artifacts safely

**Files:**

- Modify: `.gitignore`, artifact-retention documentation
- Delete only after retention manifest: `artifacts/**` volatile profiles/caches/databases/raw outputs
- Create: `docs/refactor-baselines/artifact-retention-policy.md`

- [ ] Classify every tracked artifact subtree as required source fixture, compact reproducibility report, shipped asset, generated deploy output, or volatile output.
- [ ] Preserve required fixtures/reports by copying only their documented compact forms; do not copy browser profiles, caches, databases, screenshots, or raw run directories.
- [ ] Add ignore rules that exclude each removed volatile category without excluding required generated source inputs.
- [ ] Verify `git ls-files artifacts` matches the retention allowlist, run package/script tests that consume retained fixtures, and inspect the deletion diff before staging.
- [ ] Commit artifact policy before the deletion commit; commit deletion separately.

### Task 9.3: Classify plans and stabilize documentation

**Files:**

- Modify: `docs/architecture-contracts.md` only for durable boundaries proved by completed phases
- Move: completed dated plans into `docs/archive/` when they are historical
- Modify: active master design and active execution plan status metadata

- [ ] Build an inventory of every dated plan with status `active`, `superseded`, or `historical`; a plan without current status is not left normative.
- [ ] Preserve links by adding a short archive index or redirect note when moving a referenced plan.
- [ ] Do not copy unstable implementation details into `architecture-contracts.md`; record only durable ownership and dependency contracts.
- [ ] Run reference and file-existence checks, `git diff --check`, and inspect all moved paths.
- [ ] Commit documentation classification separately from source changes.

**Phase 9 completion:** Root source reproduces generated surfaces, current tracked artifacts meet the retention policy, and active documentation is distinguishable from history.

## Phase 10 — Convergence Audit

### Task 10.1: Re-run the closure matrix

**Files:**

- Modify: `docs/refactor-baselines/2026-07-11-program-baseline.md`
- Modify: master design closure matrix only if a stable file path or guard name changed during execution

- [ ] For each audit ID 1–20, list the responsible commit(s), the replacement authority, the removed authority, and the exact closing command/output.
- [ ] Re-run `npm run typecheck`, `npm run checkall`, `npm run test:match:parity`, `npm run test:network:parity`, and all focused structural tests introduced by this program.
- [ ] Run `npm run build:browser` and inspect the generated registry if any browser source changed.
- [ ] Run `npm run worker:prepare` and inspect the generated mirror if any Worker surface changed.
- [ ] Run duplicate/source-authority inventories and confirm every nonzero result is an explicitly documented, non-audited compatibility projection.
- [ ] Run `git diff --check` and `git status --short`; both must be clean after the final convergence commit.
- [ ] Commit: `docs: record refactor convergence audit`.

### Task 10.2: Complete or explicitly gate visual verification

**Files:**

- Modify: convergence audit record only

- [ ] Ask for explicit user authorization before launching the playable game, Playwright flows, or `npm run test:visual`.
- [ ] If authorized, run the smallest visual suite covering board writer, cards/deck, modal/leaderboard, responsive layout, and network settlement; record exact command, viewport, and results.
- [ ] If not authorized, do not launch it. Mark the program as automated-source completion with an open full-visual-equivalence gate; do not claim complete removal of visual-risk debt.

**Phase 10 completion:** Every normal-scope audit item has concrete evidence. The report distinguishes automated completion from any user-gated visual completion.

## Phase H — Isolated Git-History Repair

### Task H.1: Preflight and dry run in a disposable mirror

**Files:**

- Create outside this checkout: disposable mirror clone and backup refs
- Create: `docs/refactor-baselines/history-rewrite-preflight.md`

- [ ] Obtain explicit user authorization naming the remote and confirming that force-push coordination is in scope.
- [ ] Verify `git filter-repo` availability; do not install or run another history-rewrite tool silently.
- [ ] Create a mirror clone outside the repository workspace, record all refs, tags, object statistics, and fresh-clone size, and create backup refs.
- [ ] Run the filter only in the disposable mirror according to the committed artifact-retention policy.
- [ ] Verify refs, tags, source checkout, `npm ci`, focused checks, generated-surface commands, and fresh-clone size in the rewritten mirror.
- [ ] Publish collaborator recovery instructions before touching the authoritative remote.

### Task H.2: Apply the approved rewrite

**Files:**

- Modify: remote Git history only after separate confirmation
- Modify: `docs/refactor-baselines/history-rewrite-preflight.md` with final evidence

- [ ] Obtain a second explicit confirmation after the dry-run evidence is reviewed.
- [ ] Push rewritten refs using the approved coordination procedure.
- [ ] Fresh-clone the authoritative remote into a new temporary directory and rerun the preflight checks.
- [ ] Record final object statistics, clone size, retained refs, and recovery status.

**Phase H completion:** Removed volatile history is absent from a fresh clone, intended refs are present, and collaborator recovery instructions are complete. No normal refactor phase may perform these actions.

## Final Acceptance Checklist

- [ ] Each audit ID in the master design closure matrix has a closing commit, a removed authority, a replacement authority or deletion proof, and a passing command.
- [ ] `test/refactor.dependency-boundary.test.ts` passes through `npm run checkall` with no expected production cyclic component.
- [ ] Root and training TypeScript have semantic type checks, and the training build uses compiler diagnostics.
- [ ] Worker/local command behavior passes both parity suites.
- [ ] Game/shared code stays headless, and the diff renderer is the sole board writer.
- [ ] Browser-visible root sources have a current `npm run build:browser` result; Worker changes have a current `npm run worker:prepare` result.
- [ ] Current tracked artifacts meet the retention policy. History size is reported separately until Phase H completes.
- [ ] `git status --short` is clean.
- [ ] If visual execution was authorized, visual checks pass; otherwise the final report states that full visual-equivalence completion is user-gated and not claimed.

## Existing Plans Incorporated, Not Automatically Trusted

The following plans contain useful task detail but must be compared to the current source during their matching task. Their unchecked checkboxes are not evidence of current implementation state:

- `docs/archive/2026-06-14-training-typecheck-selfplay-mirror-refactor.md`
- `docs/archive/2026-06-22-critical-game-refactor-master-plan.md`
- `docs/archive/2026-07-04-codebase-refactor-execution-plan.md`

Each task in this master plan supersedes an older instruction only where the two conflict with the master design or current source.

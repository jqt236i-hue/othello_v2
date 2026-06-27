# TypeScript Migration Completion Plan

## TL;DR
> **Summary**: Complete the partial TypeScript migration by making TypeScript the implementation source of truth, classifying every retained JavaScript file as an intentional runtime adapter/artifact, removing unsafe/stale twins, and preserving browser/CLI/worker behavior through hard verification gates.
> **Deliverables**:
> - Complete JS retention inventory and deletion allowlist/blocklist
> - Browser, CLI, worker, and test TypeScript migration strategy implemented
> - Suspicious nested duplicate source trees removed only after reference proof
> - `tsconfig`/package/Jest/worker mirror updated to reflect final policy
> - Zero unclassified source `.js` / `.ts` same-directory twins outside generated or approved exception paths
> **Effort**: XL
> **Parallel**: YES - 5 waves
> **Critical Path**: Task 1 → Task 2 → Tasks 3-6 → Tasks 7-12 → Task 13 → Final Verification Wave

## Context

### Original Request
The user previously had an agent perform a large TypeScript migration and now wants all remaining work completed. Prior audit found the migration is incomplete: TypeScript files exist widely, but many JavaScript twins/shims and copied duplicate paths remain.

### Interview Summary
- User wants a plan to finish all remaining TypeScript migration cleanup.
- No gameplay, card behavior, UI design, CPU behavior, or network semantics changes are requested.
- Repo contract from `AGENTS.md`: root is canonical; `worker-public/` is a generated mirror; root implementation source lives under `game/`, `ui/`, `workers/`, `shared/`, `scripts/`; behavior changes require `01-rulebook.md` first.
- Current state includes 877 same-directory `.js` / `.ts` dual basenames outside generated/external directories.
- Browser entry currently uses classic script tags and loads `.js` files from root paths.
- `dist/` is CommonJS TypeScript output and is not automatically safe for direct browser classic-script loading.

### Metis Review (gaps addressed)
- Added explicit retained-JS taxonomy before deletion.
- Added browser entrypoint strategy before touching `index.html` or UI shims.
- Added CLI wrapper strategy because pure `require('../dist/...')` wrappers can make `require.main` CLI code inert.
- Added test migration/typecheck policy because `tsconfig.json` both includes and excludes `test/` and `tests/`.
- Added `@ts-nocheck` budget tracking.
- Added hard inventory, entrypoint, reference, build, typecheck, browser, CLI, worker, mirror, and Jest gates.

## Work Objectives

### Core Objective
Finish the TypeScript migration so TypeScript is the maintained implementation source, while every remaining `.js` file is either generated output, a deploy mirror, a browser-safe runtime artifact, a Node/Worker adapter, a test fixture, or a documented temporary exception with an owner and removal condition.

### Deliverables
- `migration-inventory` artifact listing every remaining source `.js`, every `.js`/`.ts` twin, category, owner, reason, and verification command.
- Browser entrypoint strategy implemented without pointing classic scripts blindly at CommonJS `dist/`.
- Node CLI/package script strategy implemented so scripts still execute their main side effects.
- Worker bridge/export strategy preserved for Wrangler and Durable Objects.
- Test migration policy implemented with either `tsconfig.test.json` or explicitly documented non-typechecked JS fixture exceptions.
- Suspicious nested duplicate trees removed or documented after reference checks.
- `allowJs`, `checkJs`, include/exclude, package scripts, Jest config, worker prepare, and docs updated to match final policy.
- `worker-public/` regenerated via `npm run worker:prepare` only after root canonical changes.

### Definition of Done (verifiable conditions with commands)
- `npm run build:ts` exits `0`.
- `npm run typecheck` exits `0`.
- `npm run test:jest` exits `0`.
- `npm run checkall` exits `0`.
- `npm run test:browser:smoke` exits `0` with no browser console `ReferenceError: module is not defined` or `ReferenceError: require is not defined`.
- `npm run worker:prepare` exits `0` and no canonical source edits are made under `worker-public/` except generated mirror output.
- Static inventory reports zero unclassified source `.js` files and zero unclassified `.js`/`.ts` twins outside `dist/`, `worker-public/`, `node_modules/`, `coverage/`, `.git/`, `.venv/`, `.vscode/`.
- Static reference search reports zero live references to deleted paths and zero live references to suspicious nested duplicate trees.

### Must Have
- Preserve current gameplay, card, UI, CPU, network, and worker behavior.
- Classify every retained source `.js` before deletion or retention.
- Preserve browser classic script load order unless the plan explicitly replaces it with a browser-safe generated artifact strategy.
- Preserve package script CLI behavior.
- Preserve Worker/Durable Object exports.
- Treat `dist/` and `worker-public/` as generated/deploy artifacts, not implementation source.
- Update `docs/architecture-contracts.md` if the stable source/runtime artifact policy changes.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- Must NOT blanket-delete all `.js` files.
- Must NOT point browser classic scripts directly at CommonJS `dist/` without proof each target is browser-safe.
- Must NOT edit `worker-public/` as canonical source.
- Must NOT add external dependencies.
- Must NOT change player-visible behavior without updating `01-rulebook.md` first.
- Must NOT hide remaining JavaScript under vague labels like “legacy”; each retained file needs a category, reason, and removal condition.
- Must NOT accept new or unexplained `@ts-nocheck` as “migration complete.”

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after for each migration batch, plus source and optional test TypeScript configs. Existing framework: Jest with `ts-jest` and `babel-jest`.
- QA policy: Every task has agent-executed scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy

### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: Tasks 1-4 — baseline inventory, entrypoint map, retained-JS policy, duplicate-tree/reference audit.
Wave 2: Tasks 5-8 — browser strategy, CLI/script strategy, worker strategy, test/typecheck policy.
Wave 3: Tasks 9-12 — source twin cleanup, suspicious tree cleanup, script/test migration, tsconfig/package tightening.
Wave 4: Task 13 — mirror regeneration and full validation bundle.
Wave 5: Final Verification Wave — independent review and QA agents.

### Dependency Matrix (full, all tasks)
- Task 1 blocks Tasks 2-13.
- Task 2 blocks Tasks 5-12.
- Task 3 blocks Tasks 9, 11, 12.
- Task 4 blocks Tasks 9, 10, 12.
- Task 5 blocks Tasks 9, 12, 13.
- Task 6 blocks Tasks 10, 12, 13.
- Task 7 blocks Tasks 12, 13.
- Task 8 blocks Tasks 11, 12, 13.
- Tasks 9-12 block Task 13.
- Task 13 blocks F1-F4.

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 4 tasks → deep, unspecified-high, quick
- Wave 2 → 4 tasks → deep, unspecified-high, visual-engineering
- Wave 3 → 4 tasks → unspecified-high, deep, quick
- Wave 4 → 1 task → unspecified-high
- Final → 4 review tasks → oracle, unspecified-high, deep

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [ ] 1. Freeze Baseline and Build Migration Inventory

  **What to do**: Create a generated evidence/inventory artifact under `.sisyphus/evidence/` that counts all `.js` and `.ts` files by top-level area, excludes `dist/`, `worker-public/`, `node_modules/`, `coverage/`, `.git/`, `.venv/`, `.vscode/`, and lists every same-directory `.js`/`.ts` twin. Record the current results of `npm run build:ts`, `npm run typecheck`, `npm run test:jest`, `npm run checkall`, `npm run test:browser:smoke`, and `npm run worker:prepare` before implementation changes. If a baseline command fails before changes, record the exact failure and mark it as pre-existing; later tasks must not make it worse.
  **Must NOT do**: Do not delete, rename, or rewrite source files in this task. Do not count generated mirrors as migration debt.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: needs careful repo-wide classification before mutation.
  - Skills: [] - no special skill required.
  - Omitted: [`playwright`] - browser smoke may be invoked by command here, but detailed UI QA is later.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2,3,4,5,6,7,8,9,10,11,12,13] | Blocked By: []

  **References**:
  - Config: `tsconfig.json:33-54` - include/exclude patterns currently include source dirs but exclude tests and generated dirs.
  - Scripts: `package.json:7-24` - build/typecheck/Jest/check scripts.
  - Scripts: `package.json:56-60` - browser smoke, checkall, and default test commands.
  - Architecture: `docs/architecture-contracts.md:33-41` - root implementation source and worker mirror source-of-truth map.

  **Acceptance Criteria**:
  - [ ] `.sisyphus/evidence/task-1-ts-migration-inventory.json` exists and contains counts, twin list, excluded dirs, timestamp, and command used.
  - [ ] `.sisyphus/evidence/task-1-baseline-checks.txt` exists and includes command, exit code, and summary for all baseline commands.
  - [ ] Inventory total for same-directory twins is reconciled against the prior audit number of 877, with explanation if the number differs.

  **QA Scenarios**:
  ```
  Scenario: Inventory excludes generated mirrors
    Tool: Bash
    Steps: Run the inventory command and inspect the JSON for any path containing /dist/ or /worker-public/.
    Expected: zero counted source-debt entries under dist/ and worker-public/.
    Evidence: .sisyphus/evidence/task-1-inventory-exclusions.txt

  Scenario: Baseline failure is recorded, not hidden
    Tool: Bash
    Steps: Run npm run typecheck and append stdout/stderr plus exit code to task-1-baseline-checks.txt.
    Expected: if exit code is nonzero, the failure appears under PRE-EXISTING BASELINE FAILURE; if zero, it appears under BASELINE PASS.
    Evidence: .sisyphus/evidence/task-1-baseline-typecheck.txt
  ```

  **Commit**: YES | Message: `chore(ts-migration): record baseline inventory` | Files: [.sisyphus/evidence/task-1-*]

- [ ] 2. Define Final Retained-JS Policy and Classification Schema

  **What to do**: Define the final JavaScript retention taxonomy in a canonical implementation artifact and, if stable policy changes, update `docs/architecture-contracts.md`. Categories are exactly: `browser-classic-artifact`, `node-cli-adapter`, `node-compat-adapter`, `worker-esm-bridge`, `generated-output`, `test-fixture`, `documented-exception`. Every retained source `.js` must have category, reason, owner area, verification command, and removal condition. Set final goal: no unclassified source `.js` and no unclassified `.js`/`.ts` twin outside generated/excluded dirs.
  **Must NOT do**: Do not define “legacy” as a category. Do not bless `@ts-nocheck` without an explicit budget entry.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: policy affects all later deletion decisions.
  - Skills: [] - no special skill required.
  - Omitted: [`frontend-ui-ux`] - this is architecture policy, not visual work.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [5,6,7,8,9,10,11,12,13] | Blocked By: [1]

  **References**:
  - Architecture: `docs/architecture-contracts.md:33-41` - source-of-truth map.
  - Architecture: `docs/architecture-contracts.md:42-74` - module boundary contracts.
  - Config: `package.json:66` - package is currently CommonJS.
  - Config: `tsconfig.json:10-17` - CommonJS output, `outDir`, `allowJs`, and bundler resolution.

  **Acceptance Criteria**:
  - [ ] `.sisyphus/evidence/task-2-retained-js-policy.md` exists with exact categories and required fields.
  - [ ] Any `docs/architecture-contracts.md` edit is limited to stable source/runtime artifact policy and does not restate workflow.
  - [ ] Policy explicitly says browser classic scripts must not be pointed blindly at CommonJS `dist/`.

  **QA Scenarios**:
  ```
  Scenario: Policy rejects vague retained JS
    Tool: Bash
    Steps: Run a validation script or one-off command over the inventory JSON that fails if any retained JS category is missing or equals legacy/unknown/tbd.
    Expected: exit code 0 only when every retained JS has one of the seven approved categories.
    Evidence: .sisyphus/evidence/task-2-policy-validation.txt

  Scenario: Policy protects behavior contracts
    Tool: Bash
    Steps: Search changed policy/docs for forbidden scope words indicating behavior changes: gameplay rebalance, card effect change, UI redesign.
    Expected: no policy text authorizes behavior changes; any mention is in Must NOT/guardrails.
    Evidence: .sisyphus/evidence/task-2-scope-guardrail.txt
  ```

  **Commit**: YES | Message: `docs(ts-migration): define retained js policy` | Files: [.sisyphus/evidence/task-2-*, docs/architecture-contracts.md if changed]

- [ ] 3. Map Runtime Entrypoints and Live References

  **What to do**: Build an entrypoint/reference map for every `.js` path referenced by `index.html`, `story-deck-lab.html`, `package.json` scripts, Jest setup/config, worker config, `scripts/prepare-worker-assets.ts`, source imports/requires, and tests. Mark each reference as browser, Node CLI, Node library, worker, test, generated mirror, or dead. This map determines deletion order.
  **Must NOT do**: Do not rely on filename similarity alone; each live path requires reference evidence.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: broad static analysis with concrete artifact output.
  - Skills: [] - no special skill required.
  - Omitted: [`playwright`] - runtime verification comes later.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [5,6,7,9,10,11,12,13] | Blocked By: [1]

  **References**:
  - Browser entry: `index.html:35` - first direct script load is `ui/layout-stage.js`.
  - Package scripts: `package.json:10-17` - serve, match server, worker prepare/dev/deploy run `.js` entrypoints.
  - Jest setup: `package.json:70-82` - Jest transform/setup files include JS paths.
  - Worker mirror copy list: `scripts/prepare-worker-assets.ts:20-48` - root files and directories copied to worker-public.

  **Acceptance Criteria**:
  - [ ] `.sisyphus/evidence/task-3-entrypoint-map.json` exists and lists every runtime/test/deploy entrypoint with category and current target.
  - [ ] `.sisyphus/evidence/task-3-reference-search.txt` exists and includes searches for every suspicious nested duplicate tree.
  - [ ] No later deletion task proceeds for a path absent from this map.

  **QA Scenarios**:
  ```
  Scenario: Entrypoint map covers package scripts
    Tool: Bash
    Steps: Extract package.json scripts and verify every script containing node, jest, wrangler, or npm run references either an existing file or a package binary.
    Expected: zero unresolved script file references.
    Evidence: .sisyphus/evidence/task-3-package-script-map.txt

  Scenario: Deleted-path precheck catches live references
    Tool: Bash
    Steps: For each suspicious path prefix, search repo excluding generated/external dirs and record references.
    Expected: each prefix is marked live or dead with exact referring files before deletion.
    Evidence: .sisyphus/evidence/task-3-suspicious-tree-references.txt
  ```

  **Commit**: YES | Message: `chore(ts-migration): map runtime entrypoints` | Files: [.sisyphus/evidence/task-3-*]

- [ ] 4. Audit Suspicious Nested Duplicate Trees

  **What to do**: For every suspicious nested path (`game/cards/game/cards/effects`, `game/logic/game/logic/cards`, `game/cards/game/logic/cards`, `game/cards/game/logic/effects`, `game/logic/game/logic/effects`, and any similar pattern discovered by Task 1), compare files against the intended canonical locations. Decide per tree: delete as accidental copy, keep as documented exception, or replace references with canonical path then delete. Record hash/content comparison, reference search, and decision.
  **Must NOT do**: Do not delete a suspicious tree solely because the path looks wrong.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: deletion risk across game/card logic.
  - Skills: [] - no special skill required.
  - Omitted: [`frontend-ui-ux`] - no UI design changes.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [9,12,13] | Blocked By: [1]

  **References**:
  - Boundary: `docs/architecture-contracts.md:44-49` - `game/` owns headless rules and must not depend on UI/DOM.
  - Source map: `docs/architecture-contracts.md:33-41` - root implementation source is canonical.
  - Prior audit: suspicious nested trees were reported as migration/copy artifacts and must be verified before deletion.

  **Acceptance Criteria**:
  - [ ] `.sisyphus/evidence/task-4-duplicate-tree-audit.md` exists with one decision per suspicious tree.
  - [ ] For every tree marked delete, reference search shows zero live references outside generated/history/evidence paths.
  - [ ] For every tree marked keep, retained-JS policy category and removal condition are recorded.

  **QA Scenarios**:
  ```
  Scenario: Canonical counterpart exists before delete
    Tool: Bash
    Steps: For each file in a suspicious tree marked delete, verify the intended canonical counterpart exists or the file is proven unused.
    Expected: no file is deleted without canonical counterpart or zero-reference proof.
    Evidence: .sisyphus/evidence/task-4-canonical-counterparts.txt

  Scenario: Game boundary not worsened
    Tool: Bash
    Steps: Search remaining game/ files for imports/requires of ui/, document, window, audio, or timer-only UI helpers.
    Expected: no new boundary violations compared with Task 1 baseline.
    Evidence: .sisyphus/evidence/task-4-game-boundary-check.txt
  ```

  **Commit**: YES | Message: `chore(ts-migration): audit duplicate source trees` | Files: [.sisyphus/evidence/task-4-*]

- [ ] 5. Implement Browser-Safe Entry Strategy

  **What to do**: Choose and implement the conservative browser strategy: preserve classic-script behavior and load order, but make each browser-loaded `.js` an intentional `browser-classic-artifact` or browser-safe adapter generated/maintained from TypeScript. Do not rewrite `index.html` to point directly at CommonJS `dist/` unless the exact target file is proven not to require `module`, `exports`, or `require` at browser runtime. Update `index.html`, `story-deck-lab.html`, copied root files list, and UI entry adapters only after Task 3 map is complete.
  **Must NOT do**: Do not introduce a bundler or external dependency. Do not convert UI behavior or script order unless the browser smoke proves equivalence.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: browser boot, classic script order, and Playwright verification are central.
  - Skills: [`playwright`] - required for browser smoke and console validation.
  - Omitted: [`git-master`] - no git history work needed unless committing later.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [9,12,13] | Blocked By: [2,3]

  **References**:
  - Browser entry: `index.html:35` - direct `ui/layout-stage.js` classic script.
  - Worker prepare root files: `scripts/prepare-worker-assets.ts:20-38` - browser-facing root files copied to mirror.
  - Worker prepare directories: `scripts/prepare-worker-assets.ts:40-48` - `ui/`, `game/`, `shared/`, etc. copied to mirror.
  - TS output: `tsconfig.json:10-17` - CommonJS output and `allowJs`; CommonJS is not inherently classic-browser-safe.

  **Acceptance Criteria**:
  - [ ] `.sisyphus/evidence/task-5-browser-entry-strategy.md` states the chosen strategy and lists every browser-loaded `.js` category.
  - [ ] `index.html` and `story-deck-lab.html` reference only existing browser-safe files.
  - [ ] Browser console has no `module is not defined`, `exports is not defined`, or `require is not defined` errors.
  - [ ] Load order remains equivalent to baseline unless the strategy artifact explicitly lists the intentional order change and verification evidence.

  **QA Scenarios**:
  ```
  Scenario: Main browser boot works
    Tool: Playwright
    Steps: Run npm run test:browser:smoke or open the local served index.html; wait for the first playable screen/board to appear.
    Expected: page loads, board UI appears, no console errors containing module/exports/require ReferenceError.
    Evidence: .sisyphus/evidence/task-5-browser-smoke-main.txt

  Scenario: Browser adapter rejects CommonJS-only target
    Tool: Bash
    Steps: Search every HTML script src target for emitted content containing top-level module.exports/exports/require without an approved browser shim classification.
    Expected: zero unapproved CommonJS-only browser script targets.
    Evidence: .sisyphus/evidence/task-5-browser-commonjs-gate.txt
  ```

  **Commit**: YES | Message: `refactor(ui): stabilize browser ts entrypoints` | Files: [index.html, story-deck-lab.html, ui/**, shared/**, scripts/prepare-worker-assets.ts if needed, .sisyphus/evidence/task-5-*]

- [ ] 6. Implement Node CLI and Package Script Strategy

  **What to do**: For every `package.json` script and directly invoked `scripts/*.js`, decide whether to switch invocation to TypeScript-compiled `dist`, keep a `node-cli-adapter`, or convert the canonical CLI source to TypeScript with a direct-execution adapter that calls the compiled CLI `main()` correctly. Verify that `require.main` semantics are not lost by wrapper-only modules.
  **Must NOT do**: Do not remove a `scripts/*.js` adapter until the package script that invokes it has been updated and smoke-tested.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: broad package-script/runtime verification.
  - Skills: [] - no special skill required.
  - Omitted: [`playwright`] - browser verification is Task 5.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [10,12,13] | Blocked By: [2,3]

  **References**:
  - Package scripts: `package.json:10-17` - serve, match server, worker prepare/dev/deploy.
  - Package scripts: `package.json:26-58` - selfplay, generation, visual, browser smoke, checkall scripts.
  - Package type: `package.json:66` - CommonJS package semantics.
  - Build script: `package.json:9` - `build:ts` uses `tsc`.

  **Acceptance Criteria**:
  - [ ] `.sisyphus/evidence/task-6-cli-entry-map.md` lists every script-invoked JS entrypoint and final category.
  - [ ] Every non-long-running package script that remains in scope exits `0` when smoke-run with safe/bounded arguments.
  - [ ] Long-running server scripts are smoke-tested by startup/readiness then terminated cleanly.
  - [ ] No CLI adapter is a pure inert `module.exports = require(...)` if the underlying compiled file depends on direct execution.

  **QA Scenarios**:
  ```
  Scenario: Package scripts still invoke real CLIs
    Tool: Bash
    Steps: Run bounded smoke commands for serve, match:check or local match server startup, worker:prepare, generate scripts with safe options where available.
    Expected: non-server commands exit 0; servers print readiness and are terminated; no command silently no-ops.
    Evidence: .sisyphus/evidence/task-6-cli-smoke.txt

  Scenario: Wrapper direct-execution check
    Tool: Bash
    Steps: For each retained node-cli-adapter, inspect/run it to confirm it invokes compiled main behavior when executed with node path/to/script.js.
    Expected: each adapter either calls main behavior or is reclassified as node-compat-adapter and not used by package scripts.
    Evidence: .sisyphus/evidence/task-6-require-main-check.txt
  ```

  **Commit**: YES | Message: `refactor(scripts): stabilize ts cli entrypoints` | Files: [package.json, scripts/**, .sisyphus/evidence/task-6-*]

- [ ] 7. Preserve Worker Bridge and Mirror Contract

  **What to do**: Verify `workers/` entrypoints, Wrangler configuration, Durable Object exports, and `scripts/prepare-worker-assets.ts` continue to work after source JS policy changes. Keep `worker-public/` as generated mirror only. If a Worker ESM bridge such as `.mjs` is required, classify it as `worker-esm-bridge` and document why it remains JavaScript.
  **Must NOT do**: Do not hand-edit `worker-public/` as source. Do not change Worker authority semantics.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: deploy/runtime boundary with mirror generation.
  - Skills: [] - no special skill required.
  - Omitted: [`frontend-ui-ux`] - not a visual task.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [12,13] | Blocked By: [2,3]

  **References**:
  - Worker source contract: `docs/architecture-contracts.md:56-61` - Worker owns authoritative network execution.
  - Worker mirror contract: `docs/architecture-contracts.md:33-41` - `worker-public/` generated by `npm run worker:prepare`.
  - Worker prepare root files: `scripts/prepare-worker-assets.ts:20-38`.
  - Worker prepare dirs: `scripts/prepare-worker-assets.ts:40-58`.

  **Acceptance Criteria**:
  - [ ] `.sisyphus/evidence/task-7-worker-entry-map.md` lists worker entrypoints/bridges and categories.
  - [ ] `npm run worker:prepare` exits `0` after relevant changes.
  - [ ] Worker bridge/export readiness check confirms required exports still exist.
  - [ ] `worker-public/` diff is generated output only after prepare.

  **QA Scenarios**:
  ```
  Scenario: Worker prepare mirror regenerates
    Tool: Bash
    Steps: Run npm run worker:prepare and capture output.
    Expected: exit code 0; generated mirror contains expected root files and directories from prepare config.
    Evidence: .sisyphus/evidence/task-7-worker-prepare.txt

  Scenario: Worker exports survive migration
    Tool: Bash
    Steps: Run a static check/import check for workers/match-worker entry and expected Durable Object/export names used by Wrangler config.
    Expected: all required exports are present; no CommonJS/ESM bridge error.
    Evidence: .sisyphus/evidence/task-7-worker-exports.txt
  ```

  **Commit**: YES | Message: `refactor(worker): preserve ts worker bridge` | Files: [workers/**, wrangler.toml if needed, scripts/prepare-worker-assets.ts if needed, worker-public/** generated, .sisyphus/evidence/task-7-*]

- [ ] 8. Decide and Implement Test TypeScript Policy

  **What to do**: Resolve the current contradiction where tests are included and then excluded by main `tsconfig.json`. Choose this final policy: production/source `tsconfig.json` excludes tests; create `tsconfig.test.json` extending source config for migrated TypeScript tests and Jest setup, while allowing documented JS fixtures/setup files only as `test-fixture`. Convert or classify test JS twins starting with the 456-pair `test/` hotspot; do not require every fixture-like JS file to become TS if it is intentionally data/compatibility fixture.
  **Must NOT do**: Do not make test migration block source runtime cleanup if a JS file is a legitimate fixture, but do classify it.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: test config affects confidence in migration completeness.
  - Skills: [] - no special skill required.
  - Omitted: [`playwright`] - Playwright is for final/browser QA, not Jest config.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [11,12,13] | Blocked By: [2,3]

  **References**:
  - Main config include/exclude: `tsconfig.json:33-54` - tests are included and excluded.
  - Jest config: `package.json:70-82` - `ts-jest`, `babel-jest`, JS setup files.
  - Jest file extensions: `package.json:90-97` - both TS and JS supported.
  - Test commands: `package.json:20-25` - Jest command variants.

  **Acceptance Criteria**:
  - [ ] `tsconfig.test.json` exists or an explicit equivalent test policy artifact exists; preferred outcome is `tsconfig.test.json`.
  - [ ] `npm run typecheck` remains source-focused and exits `0`.
  - [ ] Test typecheck command exists or is documented in evidence and exits `0` for migrated TS tests.
  - [ ] Every retained JS test/setup file is categorized as `test-fixture` or documented exception.

  **QA Scenarios**:
  ```
  Scenario: Tests are typechecked intentionally
    Tool: Bash
    Steps: Run npx tsc --noEmit -p tsconfig.test.json if created.
    Expected: exit code 0, or failures are only pre-existing and tracked with explicit exceptions.
    Evidence: .sisyphus/evidence/task-8-test-typecheck.txt

  Scenario: Jest still runs mixed test suite
    Tool: Bash
    Steps: Run npm run test:jest.
    Expected: exit code 0; no module resolution failures from converted tests or removed JS twins.
    Evidence: .sisyphus/evidence/task-8-jest.txt
  ```

  **Commit**: YES | Message: `test(ts-migration): define test typecheck policy` | Files: [tsconfig.test.json, package.json if script added, test/**, tests/**, .sisyphus/evidence/task-8-*]

- [ ] 9. Remove or Reclassify Source JS Twins in Game/UI/Shared/Cards/Constants/Utils/CPU

  **What to do**: Using Tasks 2-5 maps, remove stale same-directory `.js` twins from implementation areas once their TypeScript counterpart is canonical and no runtime entrypoint requires the `.js` path. For retained adapters, replace generic shims with explicit minimal adapters and add them to retained-JS inventory. Prioritize `game/`, `ui/`, `shared/`, `cards/`, `constants/`, `utils/`, and `cpu/`; preserve module boundaries.
  **Must NOT do**: Do not remove browser-loaded UI adapters before Task 5 passes. Do not move game logic into UI or add DOM/window access to game/cpu files.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: broad but mechanical source cleanup with reference gates.
  - Skills: [] - no special skill required.
  - Omitted: [`frontend-ui-ux`] - no UI redesign; only browser smoke where applicable.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [12,13] | Blocked By: [2,3,4,5]

  **References**:
  - Game boundary: `docs/architecture-contracts.md:44-49` - headless rules and no UI/DOM.
  - UI boundary: `docs/architecture-contracts.md:50-55` - UI consumes public game APIs/events/DI.
  - Shared boundary: `docs/architecture-contracts.md:63-67` - portable contracts/helpers.
  - Prior audit: `game/` 204 JS/214 TS, `ui/` 99/100, `shared/` 25/24, `cards/` 5/4, `constants/` 4/4, `utils/` 3/3, `cpu/` 1/1.

  **Acceptance Criteria**:
  - [ ] No unclassified same-directory `.js`/`.ts` twins remain in listed implementation areas.
  - [ ] Every retained JS in listed areas appears in retained inventory with one of the seven allowed categories.
  - [ ] `npm run build:ts` and `npm run typecheck` exit `0` after cleanup.
  - [ ] Static boundary search shows no new `game/` → `ui/` or DOM/browser dependencies.

  **QA Scenarios**:
  ```
  Scenario: Source twins are gone or classified
    Tool: Bash
    Steps: Run inventory validator scoped to game, ui, shared, cards, constants, utils, cpu.
    Expected: zero unclassified twins; retained JS entries all have approved categories and reasons.
    Evidence: .sisyphus/evidence/task-9-source-twin-validator.txt

  Scenario: Game/UI boundary preserved
    Tool: Bash
    Steps: Search game/ and cpu/ for imports/requires of ui/, document, window, localStorage, Audio, or DOM selectors.
    Expected: no new violations compared with Task 1 baseline.
    Evidence: .sisyphus/evidence/task-9-boundary-check.txt
  ```

  **Commit**: YES | Message: `refactor(ts-migration): remove stale source js twins` | Files: [game/**, ui/**, shared/**, cards/**, constants/**, utils/**, cpu/**, .sisyphus/evidence/task-9-*]

- [ ] 10. Migrate Root and Scripts JS Debt Safely

  **What to do**: Convert, delete, or classify root-level `.js` files and `scripts/*.js` twins according to Tasks 2, 3, and 6. Root browser files copied by worker prepare must be either browser-safe artifacts/adapters or generated from TypeScript. Package-invoked scripts must either execute compiled TypeScript correctly or remain explicit `node-cli-adapter`s. Analysis/selfplay/tooling scripts may remain JS only if classified with owner and removal condition.
  **Must NOT do**: Do not break package scripts listed in `package.json`. Do not delete root files copied by worker prepare unless prepare config and browser/deploy references are updated first.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: high blast radius across scripts, root assets, package commands.
  - Skills: [] - no special skill required.
  - Omitted: [`playwright`] - browser-only root effects are validated in Task 5/13.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [12,13] | Blocked By: [2,3,6]

  **References**:
  - Package scripts: `package.json:10-61` - direct and indirect script execution surface.
  - Worker prepare root list: `scripts/prepare-worker-assets.ts:20-38` - root browser/deploy files.
  - Config: `package.json:66` - CommonJS package mode.
  - Prior audit: root 31 JS/11 TS, scripts 74 JS/74 TS, scripts 72 dual pairs.

  **Acceptance Criteria**:
  - [ ] No unclassified root or `scripts/` `.js` remains.
  - [ ] All package scripts either still point to existing intentional JS adapters or are updated to safe compiled/TS-aware targets.
  - [ ] `npm run checkall`, `npm run worker:prepare`, and representative CLI smoke commands exit `0`.
  - [ ] No copied root file in worker prepare is missing after changes.

  **QA Scenarios**:
  ```
  Scenario: Root/script twin cleanup does not break npm scripts
    Tool: Bash
    Steps: Run npm run checkall, npm run worker:prepare, and bounded smoke commands for serve/match/generate scripts affected by the cleanup.
    Expected: exit code 0 for bounded commands; long-running commands show readiness then terminate cleanly.
    Evidence: .sisyphus/evidence/task-10-script-smoke.txt

  Scenario: Worker prepare copy list remains valid
    Tool: Bash
    Steps: Verify every path listed in scripts/prepare-worker-assets.ts ROOT_FILES and DIRS exists in root before running prepare.
    Expected: zero missing required root files/directories.
    Evidence: .sisyphus/evidence/task-10-worker-copylist-check.txt
  ```

  **Commit**: YES | Message: `refactor(ts-migration): migrate root and script js debt` | Files: [*.js, *.ts, scripts/**, package.json, scripts/prepare-worker-assets.ts if needed, .sisyphus/evidence/task-10-*]

- [ ] 11. Clean Test JS Twins and Fixtures Under Final Test Policy

  **What to do**: Apply Task 8 policy to `test/` and `tests/`: remove stale JS twins where TS tests are canonical, update imports to canonical paths, keep JS setup/fixture files only as `test-fixture`, and ensure Jest continues to run. For large test twin batches, proceed by suite clusters (network, workers, game/card logic, UI handlers, utilities) and run targeted suites after each cluster before the full Jest run.
  **Must NOT do**: Do not rewrite tests to change expected behavior. Do not delete JS fixture data if tests intentionally load it as fixture.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: 456 test twin hotspot with high regression risk.
  - Skills: [] - no special skill required.
  - Omitted: [`frontend-ui-ux`] - browser QA is separate.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [12,13] | Blocked By: [2,3,8]

  **References**:
  - Jest config: `package.json:70-82` - transforms/setup files.
  - Jest extensions: `package.json:90-97` - TS and JS supported.
  - Network parity suite: `package.json:14` - critical explicit test list.
  - Prior audit: `test/` contains 456 dual basenames; `tests/` has 6 JS and 0 TS.

  **Acceptance Criteria**:
  - [ ] No unclassified `.js`/`.ts` twins remain in `test/`.
  - [ ] Every retained JS under `test/` or `tests/` is `test-fixture` or documented exception.
  - [ ] `npm run test:jest` exits `0`.
  - [ ] `npm run typecheck` and test typecheck command from Task 8 exit `0` or only report documented pre-existing baseline debt.

  **QA Scenarios**:
  ```
  Scenario: Full Jest suite survives test migration
    Tool: Bash
    Steps: Run npm run test:jest.
    Expected: exit code 0; no module-not-found or stale JS path errors.
    Evidence: .sisyphus/evidence/task-11-jest-full.txt

  Scenario: Network parity explicit suite remains valid
    Tool: Bash
    Steps: Run npm run test:network:parity.
    Expected: exit code 0; all explicitly listed network/client/worker tests still resolve.
    Evidence: .sisyphus/evidence/task-11-network-parity.txt
  ```

  **Commit**: YES | Message: `test(ts-migration): remove stale js test twins` | Files: [test/**, tests/**, package.json if test script added, .sisyphus/evidence/task-11-*]

- [ ] 12. Tighten TypeScript Config, Package Scripts, and Migration Gates

  **What to do**: After source/runtime/test cleanup, tighten configuration to represent the final architecture. Preferred config outcome: main `tsconfig.json` typechecks/emits canonical TS source, generated/external dirs remain excluded, tests are handled by `tsconfig.test.json`, `allowJs` is removed or narrowed to an explicitly documented compatibility config, and `checkJs` remains off unless a specific JS-adapter check config is introduced. Add package scripts for inventory validation and test typecheck if useful. Add static gates for unclassified JS, unclassified twins, forbidden browser CommonJS targets, deleted-path references, and `@ts-nocheck` budget.
  **Must NOT do**: Do not flip `allowJs: false` until all retained source JS is excluded from the source build or intentionally handled. Do not broaden include patterns to generated dirs.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: config tightening can break build/test/runtime resolution.
  - Skills: [] - no special skill required.
  - Omitted: [`playwright`] - browser test is invoked as command but no UI editing.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [13] | Blocked By: [5,6,7,8,9,10,11]

  **References**:
  - Current TS config: `tsconfig.json:3-31` - strict compiler options and CommonJS target.
  - Current include/exclude: `tsconfig.json:33-54` - source/test/generated scope conflict.
  - Package build scripts: `package.json:7-9` - typecheck/build.
  - Package check/test scripts: `package.json:20-25`, `package.json:56-61`.

  **Acceptance Criteria**:
  - [ ] `npm run build:ts` exits `0`.
  - [ ] `npm run typecheck` exits `0`.
  - [ ] New or updated migration validation command exits `0` and fails on an artificial unclassified JS/twin sample when tested in a temporary ignored location.
  - [ ] `@ts-nocheck` inventory exists with approved count, approved files, reason, and removal condition; no unapproved new occurrences.

  **QA Scenarios**:
  ```
  Scenario: Config reflects final source/test split
    Tool: Bash
    Steps: Run npm run typecheck, npm run build:ts, and npx tsc --noEmit -p tsconfig.test.json if present.
    Expected: all configured checks exit 0 or match documented pre-existing baseline exceptions only.
    Evidence: .sisyphus/evidence/task-12-config-checks.txt

  Scenario: Migration gate catches stale JS debt
    Tool: Bash
    Steps: Run the static migration validation command against current repo and against a temporary ignored sample containing an unclassified .js/.ts twin.
    Expected: current repo passes; temporary sample fails with clear unclassified twin message.
    Evidence: .sisyphus/evidence/task-12-static-gate-negative-test.txt
  ```

  **Commit**: YES | Message: `chore(ts-migration): tighten typescript migration gates` | Files: [tsconfig.json, tsconfig.test.json, package.json, scripts/** validation helpers, .sisyphus/evidence/task-12-*]

- [ ] 13. Regenerate Artifacts, Sync Worker Mirror, and Run Full Verification Bundle

  **What to do**: Run the complete post-migration verification bundle in final order: static migration validation, `npm run typecheck`, test typecheck if configured, `npm run build:ts`, `npm run test:jest`, `npm run test:network:parity`, `npm run checkall`, `npm run test:browser:smoke`, `npm run worker:prepare`, Worker export readiness check, then rerun static validation after mirror generation. Capture all outputs under `.sisyphus/evidence/`. Regenerate `dist/` and `worker-public/` only through configured commands. Confirm final inventory has zero unclassified JS and zero unclassified twins.
  **Must NOT do**: Do not manually edit generated artifacts after running build/prepare. Do not mark completion if any verification fails without a documented pre-existing baseline exception from Task 1.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: hands-on QA execution across all runtime surfaces.
  - Skills: [`playwright`] - needed for browser smoke if package script delegates to browser automation or manual Playwright fallback is required.
  - Omitted: [`git-master`] - commit handling is separate from verification.

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: [F1,F2,F3,F4] | Blocked By: [9,10,11,12]

  **References**:
  - Build/typecheck scripts: `package.json:7-9`.
  - Network parity script: `package.json:14`.
  - Worker prepare/dev/deploy scripts: `package.json:15-17`.
  - Full check/test scripts: `package.json:20-25`, `package.json:56-61`.
  - Worker mirror contract: `docs/architecture-contracts.md:33-41`.

  **Acceptance Criteria**:
  - [ ] `.sisyphus/evidence/task-13-final-verification.txt` contains command, exit code, and summary for every final verification command.
  - [ ] Final migration inventory shows zero unclassified source `.js`, zero unclassified `.js`/`.ts` twins, zero unapproved `@ts-nocheck`, and zero live references to deleted duplicate-tree paths.
  - [ ] Browser smoke has no module/exports/require ReferenceErrors and reaches playable screen.
  - [ ] Worker prepare exits `0`; generated mirror diff matches root canonical changes.
  - [ ] No unrelated files are modified.

  **QA Scenarios**:
  ```
  Scenario: Full automated verification passes
    Tool: Bash
    Steps: Run static migration validation, npm run typecheck, npm run build:ts, npm run test:jest, npm run test:network:parity, npm run checkall, npm run test:browser:smoke, npm run worker:prepare, and Worker export readiness check in order.
    Expected: every command exits 0; any allowed exception must exactly match a Task 1 pre-existing baseline failure and must not be newly introduced.
    Evidence: .sisyphus/evidence/task-13-final-verification.txt

  Scenario: Final browser runtime is playable
    Tool: Playwright
    Steps: Serve the app through the repo serve command, open index.html, wait for board and controls, perform one valid initial interaction if smoke runner does not already do so, collect console messages.
    Expected: board/control UI appears, no uncaught errors, no module/exports/require ReferenceErrors, interaction succeeds or reaches the same expected state as baseline.
    Evidence: .sisyphus/evidence/task-13-playwright-browser-final.txt
  ```

  **Commit**: YES | Message: `chore(ts-migration): finalize generated artifacts and verification` | Files: [dist/** if tracked/generated by build, worker-public/** generated, .sisyphus/evidence/task-13-*]

## Task Decomposition (Generated 2026-04-30)

> Every plan task decomposed into concrete, agent-executable sub-tasks with task IDs.
> Dependencies between sub-tasks mirror plan-level dependency matrix.

### Wave 1: Baseline & Policy (Tasks 1-4)

| Plan Task | Sub-Task ID | Subject |
|---|---|---|
| 1. Freeze Baseline | [T-51ba3870](T-51ba3870-56b0-4bd8-96ee-339f5b1178e7) | Run baseline typecheck, record results |
| 1. Freeze Baseline | [T-26ed081c](T-26ed081c-783a-4044-b3d7-b879468d71c4) | Run baseline build:ts, record results |
| 1. Freeze Baseline | [T-7dfad967](T-7dfad967-da3c-4180-8d5a-d917f17afe8f) | Run baseline test:jest, record results |
| 1. Freeze Baseline | [T-fb731d0f](T-fb731d0f-1cd8-4115-8309-d29bf631b720) | Run baseline checkall, browser:smoke, worker:prepare |
| 1. Freeze Baseline | [T-80954c3e](T-80954c3e-6000-4370-9446-b3aa69315b98) | Build migration inventory JSON (counts, twins, reconcile 877) |
| 2. Retained-JS Policy | [T-570d8cbd](T-570d8cbd-ad00-45ee-9c20-70c1fbdd1f4b) | Write retained-JS policy with 7 categories |
| 2. Retained-JS Policy | [T-dca1448f](T-dca1448f-ac4f-42bc-b734-de2b40a6b80d) | Create + run policy validation script against inventory |
| 2. Retained-JS Policy | [T-2dd0151e](T-2dd0151e-034d-421d-b96b-3ed249e614d9) | Verify policy does not authorize behavior changes |
| 3. Entrypoint Map | [T-ad7dd261](T-ad7dd261-93bc-4d37-8b2d-e9d0ca8df0b8) | Extract browser HTML entrypoints, classify |
| 3. Entrypoint Map | [T-359e9814](T-359e9814-4f43-4049-a401-23fc51c18eff) | Extract package.json script entrypoints, classify |
| 3. Entrypoint Map | [T-c44eb81a](T-c44eb81a-5f73-4a84-9a9c-ee5fa61cab11) | Search references for suspicious nested duplicate trees |
| 3. Entrypoint Map | [T-9b53b32c](T-9b53b32c-4a1e-47b6-b7d5-ad8c6c4233ef) | Map Jest, worker, and source import entrypoints |
| 4. Suspicious Tree Audit | [T-43a5885f](T-43a5885f-d3ec-4f60-91bf-fea58378de20) | Hash/compare suspicious tree files to canonical locations |
| 4. Suspicious Tree Audit | [T-84a701a5](T-84a701a5-e826-49e4-bc85-f79e971257f1) | Verify canonical counterparts, check game boundary |

### Wave 2: Entrypoint Strategies (Tasks 5-8)

| Plan Task | Sub-Task ID | Subject |
|---|---|---|
| 5. Browser Strategy | [T-20e58431](T-20e58431-befd-44e3-ac7f-f3c98e8de980) | Document browser-safe entry strategy |
| 5. Browser Strategy | [T-4431bfbf](T-4431bfbf-2e22-4966-b705-2a2dfa556539) | Implement browser adapters, verify via Playwright |
| 6. CLI Strategy | [T-f80981a5](T-f80981a5-0104-4db4-bad7-f1612abc2a59) | Classify CLI entrypoints, decide migration path |
| 6. CLI Strategy | [T-8c255044](T-8c255044-f51f-4827-b4f2-fd93889659b4) | Smoke-test all CLI entrypoints |
| 7. Worker Bridge | [T-d0a5d2e1](T-d0a5d2e1-c1e4-4a2a-b9ff-5e836f6449a3) | Verify worker exports and mirror contract |
| 8. Test Policy | [T-8ed072e5](T-8ed072e5-1507-4c29-867f-72d5f903aaf7) | Create tsconfig.test.json, classify test JS files |

### Wave 3: Cleanup & Tightening (Tasks 9-12)

| Plan Task | Sub-Task ID | Subject |
|---|---|---|
| 9. Source Twin Cleanup | [T-30aaa067](T-30aaa067-9df3-4c2f-9ff6-447ecbb3801d) | Remove JS twins from game/ui/shared/cards/constants/utils/cpu |
| 10. Root/Scripts Migration | [T-38215852](T-38215852-b285-4cc1-939e-7ed5b3ddd288) | Migrate root+scripts JS debt (31 root + 72 duals) |
| 11. Test Cleanup | [T-62d91cc0](T-62d91cc0-5afa-4eca-b697-293e01b29096) | Clean test JS twins by suite cluster (456 pairs) |
| 11. Test Cleanup | [T-016d5f56](T-016d5f56-d916-426f-b1f1-14266fdaf4b6) | Classify tests/ JS-only files as test-fixtures |
| 12. Config Tightening | [T-425fb58a](T-425fb58a-9544-497a-a4b8-7a1fad666194) | Tighten tsconfig, add migration gates, verify all |

### Wave 4: Final Verification (Task 13)

| Plan Task | Sub-Task ID | Subject |
|---|---|---|
| 13. Final Verification | [T-ca52fb1c](T-ca52fb1c-b154-4029-b5fb-905c782eb16e) | Execute full verification bundle in order |
| 13. Final Verification | [T-7864bf8c](T-7864bf8c-f848-444a-9f8f-9028c3a41573) | Playwright browser smoke: app playable, no errors |
| 13. Final Verification | [T-3a684635](T-3a684635-b6d4-4597-9acc-332c30b37178) | Regenerate dist and worker-public mirror |

### Wave 5: Independent Review (F1-F4)

| Plan Task | Sub-Task ID | Subject |
|---|---|---|
| F1. Compliance Audit | [T-6c61bbf1](T-6c61bbf1-c207-4f2e-a2bf-77ca006a1f76) | Oracle: plan compliance, all gates passed? |
| F2. Code Quality | [T-9b97e0ac](T-9b97e0ac-12f3-47a6-867b-a498e78b151f) | Review code quality, type safety, boundaries |
| F3. Manual QA | [T-99a75fc3](T-99a75fc3-e11e-4703-8c41-ba92ed590e1b) | Playwright QA: boot, board, cards, CPU, network |
| F4. Scope Fidelity | [T-7c6b35da](T-7c6b35da-c798-430c-9013-67b0af9f8b9d) | Verify no out-of-scope changes, no boundary violations |

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit 1: baseline inventory and retained-JS policy artifacts.
- Commit 2: browser/CLI/worker/test entrypoint strategy changes.
- Commit 3: safe source twin cleanup and suspicious duplicate tree removal.
- Commit 4: `tsconfig`/package/Jest tightening and docs updates.
- Commit 5: regenerated artifacts/mirror and final verification fixes.
- Do not commit unrelated formatting or behavior changes.

## Success Criteria
- The repo has a clear TypeScript source-of-truth policy.
- Every retained `.js` file has an intentional category and verification reason.
- No stale JS twin or suspicious duplicate tree remains unclassified.
- Browser, Node CLI, Jest, Worker, and generated mirror paths all pass verification.
- User receives consolidated verification evidence and explicitly approves final completion.

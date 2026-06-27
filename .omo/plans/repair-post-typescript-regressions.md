# Repair Post-TypeScript Regression Failures

## TL;DR

> **Quick Summary**: Repair the TypeScript migration regression where one CommonJS wrapper pattern broke three runtime contracts: Node CLI entrypoints, browser script-tag boot, and Cloudflare Worker ESM Durable Object exports.
>
> **Deliverables**:
> - `npm run serve` keeps a local server alive and serves the game.
> - Browser UI boots to an interactive game state, not the empty/disabled fallback state.
> - `npm run worker:deploy` no longer fails on missing `MatchRoomDurableObject` export.
> - Targeted regression tests/QA prevent this wrapper/entrypoint breakage from recurring.
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 implementation waves + final verification
> **Critical Path**: T1 → T2/T3/T4 → T6/T7/T8 → Final QA

---

## Context

### Original Request
After the large TypeScript migration/refactor, the game appears broken:
- `npm run serve` returns immediately and does not open/hold a local server.
- The browser UI loads in a broken initial state: empty board, disabled controls, buttons unusable.
- `npm run worker:deploy` fails because Wrangler cannot find exported Durable Object `MatchRoomDurableObject` in `workers/match-worker.mjs`.

### Interview Summary
**Key Discussions**:
- Treat this as regression repair, not new feature work.
- User suspects the three problems share a nearby/root cause.
- Test strategy selected: **Tests after implementation**, plus mandatory agent-executed QA.

**Research Findings**:
- `scripts/serve-with-fallback.js` is now only `module.exports = require("../dist/scripts/serve-with-fallback");`.
- `dist/scripts/serve-with-fallback.js` contains `main()` guarded by `if (require.main === module)`, which does not run when loaded through the root wrapper.
- `index.html` loads many root `.js` files as plain browser scripts.
- Several browser-loaded files are now CommonJS wrappers, e.g. `shared-constants.js`, `cards/catalog.js`, `ui.js`, which will throw in a browser because `module`/`require` are not defined.
- Some wrappers use bare paths such as `require('dist/./shared-constants')` instead of relative `require('./dist/shared-constants')`.
- `wrangler.toml` expects `workers/match-worker.mjs` to export `MatchRoomDurableObject`.
- `workers/match-worker.ts` does export `class MatchRoomDurableObject`, but `workers/match-worker.mjs` re-exports from CommonJS output with `export *`, which Wrangler does not reliably recognize as a named ESM export.

### Metis Review
**Identified Gaps**:
- Metis consultation timed out due environment/model constraints.
- Self-review guardrail: do not make broad migration cleanups; fix only runtime contract regressions and add targeted tests.

---

## Work Objectives

### Core Objective
Restore the runtime contracts that were broken by the TypeScript migration wrappers while preserving existing game behavior and deployment structure.

### Concrete Deliverables
- Node CLI entry wrappers call their CLI main paths when executed directly.
- Browser-served `.js` files referenced by `index.html` are browser-compatible, not CommonJS-only wrappers.
- Worker ESM entrypoint explicitly exports `MatchRoomDurableObject` in a form Wrangler accepts.
- Targeted tests and QA cover serve startup, browser boot/interactivity, and Worker export readiness.

### Definition of Done
- [ ] `npm run serve` starts and stays alive until stopped, printing/serving a reachable local URL.
- [ ] Browser console has no startup `ReferenceError: module is not defined` / `require is not defined` from app scripts.
- [ ] Board initializes with playable cells/initial stones and controls respond.
- [ ] `npm run worker:prepare` succeeds.
- [ ] Worker entrypoint exposes `MatchRoomDurableObject` to Wrangler-compatible ESM analysis.
- [ ] `npm run checkall` passes.
- [ ] Relevant targeted Jest/Playwright/Node checks pass.

### Must Have
- Restore behavior without changing game rules.
- Keep root source as source of truth; `worker-public/` remains mirror.
- Preserve `01-rulebook.md` unless behavior changes become necessary.
- Tests-after for the three reported regression classes.

### Must NOT Have (Guardrails)
- Do not hide the issue by disabling scripts, deleting tests, or bypassing Wrangler Durable Object config.
- Do not change card effects, game rules, scoring, or UI design.
- Do not add external dependencies.
- Do not directly hand-edit `worker-public/` as a source of truth.
- Do not apply one wrapper strategy to all runtimes; Node CLI, browser script, and Worker ESM need distinct contracts.

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No acceptance criterion may rely on manual clicking only.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: Jest/ts-jest for unit/entrypoint checks; Playwright for browser boot QA; Wrangler/Node commands for Worker export checks.

### QA Policy
Every task below includes agent-executed QA scenarios. Evidence goes under `.sisyphus/evidence/`.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (contract mapping; start immediately):
├── T1: Runtime entrypoint contract audit [deep]
├── T5: Test harness inventory and exact command selection [quick]
└── T9: Snapshot current broken evidence [quick]

Wave 2 (independent repairs after T1):
├── T2: Repair Node CLI wrapper execution for serve [quick]
├── T3: Restore browser script compatibility for index-loaded files [deep]
└── T4: Repair Worker ESM Durable Object export [deep]

Wave 3 (tests and generated outputs after Wave 2):
├── T6: Add serve wrapper regression test [quick]
├── T7: Add browser boot/interactivity smoke test [visual-engineering]
├── T8: Add Worker export/deploy-readiness regression test [unspecified-high]
└── T10: Build/sync generated outputs only through approved scripts [quick]

Wave FINAL:
├── F1: Plan compliance audit [oracle]
├── F2: Code quality and check suite [unspecified-high]
├── F3: Real browser/local server QA [unspecified-high + playwright]
└── F4: Scope fidelity check [deep]
```

### Dependency Matrix
- **T1**: blocks T2, T3, T4, T6, T7, T8, T10
- **T5**: blocks T6, T7, T8
- **T9**: independent; informs final before/after report
- **T2**: blocked by T1; blocks T6 and final QA
- **T3**: blocked by T1; blocks T7 and final QA
- **T4**: blocked by T1; blocks T8 and final QA
- **T6**: blocked by T2/T5
- **T7**: blocked by T3/T5
- **T8**: blocked by T4/T5
- **T10**: blocked by T2/T3/T4; blocks final QA

### Agent Dispatch Summary
- **Wave 1**: T1 → `deep`, T5 → `quick`, T9 → `quick`
- **Wave 2**: T2 → `quick`, T3 → `deep`, T4 → `deep`
- **Wave 3**: T6 → `quick`, T7 → `visual-engineering` + `playwright`, T8 → `unspecified-high`, T10 → `quick`
- **FINAL**: F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high` + `playwright`, F4 → `deep`

---

## TODOs

- [x] 1. Runtime entrypoint contract audit

  **What to do**:
  - Enumerate all root `.js` files referenced by `index.html` and classify each as browser script, Node-only wrapper, or generated exception.
  - Enumerate CLI script wrappers from `package.json` and identify which must execute `main()` when run directly.
  - Enumerate Worker entrypoint/export contracts from `wrangler.toml`.

  **Must NOT do**:
  - Do not modify files in this task.

  **Recommended Agent Profile**:
  - **Category**: `deep` — requires cross-runtime contract analysis.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T2, T3, T4, T6, T7, T8, T10
  - **Blocked By**: None

  **References**:
  - `package.json:6-60` — scripts and test commands.
  - `index.html:667-815` — browser script-tag load order.
  - `scripts/serve-with-fallback.js:1` — broken direct-execution wrapper.
  - `dist/scripts/serve-with-fallback.js:264-300` — real `main()` guard.
  - `wrangler.toml:1-18` — Worker main and Durable Object class binding.
  - `workers/match-worker.mjs:1-2` — current Worker entrypoint re-export.

  **Acceptance Criteria**:
  - [ ] Audit notes list every `index.html` script that is currently a CommonJS-only wrapper.
  - [ ] Audit notes list every CLI wrapper that would not trigger a dist `require.main` guard.
  - [ ] Audit notes identify exact Worker export contract required by Wrangler.

  **QA Scenarios**:
  ```
  Scenario: Browser wrapper inventory is complete
    Tool: Bash
    Steps:
      1. Extract script src values from `index.html`.
      2. For each local `.js`, inspect first lines for `module.exports`/`require(`.
      3. Save report to `.sisyphus/evidence/task-1-browser-wrapper-inventory.txt`.
    Expected Result: Report lists zero unclassified script-tag files.
    Evidence: .sisyphus/evidence/task-1-browser-wrapper-inventory.txt

  Scenario: CLI/Worker contracts are captured
    Tool: Bash
    Steps:
      1. Inspect `package.json` scripts and `wrangler.toml` main/bindings.
      2. Save contract matrix to `.sisyphus/evidence/task-1-entrypoint-contracts.txt`.
    Expected Result: Matrix includes serve CLI and MatchRoomDurableObject export.
    Evidence: .sisyphus/evidence/task-1-entrypoint-contracts.txt
  ```

- [x] 2. Repair Node CLI wrapper execution for `npm run serve`

  **What to do**:
  - Make `scripts/serve-with-fallback.js` execute the dist CLI path when invoked directly, not merely require it.
  - Prefer an explicit exported `main`/`runCli` contract from `scripts/serve-with-fallback.ts` or a wrapper that spawns/requires and calls it safely.
  - Preserve existing imports used by tests: `parseArgs`, `chooseServePort`, `buildHttpServerArgs`, etc.

  **Must NOT do**:
  - Do not bypass artifact refresh behavior.
  - Do not make server detach silently.

  **Recommended Agent Profile**:
  - **Category**: `quick` — focused CLI entrypoint fix.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T6, T10
  - **Blocked By**: T1

  **References**:
  - `scripts/serve-with-fallback.js:1` — current wrapper that does not call CLI main.
  - `scripts/serve-with-fallback.ts:240-291` — intended server startup behavior.
  - `dist/scripts/serve-with-fallback.js:295-309` — exports and current `require.main` guard.
  - `test/serve-with-fallback.test.ts:1-120` — existing test style for serve helpers.

  **Acceptance Criteria**:
  - [ ] `node scripts/serve-with-fallback.js --help` prints usage.
  - [ ] `npm run serve -- --port 0` starts a server and stays alive until terminated.
  - [ ] Existing helper imports in tests continue to work.

  **QA Scenarios**:
  ```
  Scenario: Serve help path runs through wrapper
    Tool: Bash
    Steps:
      1. Run `node scripts/serve-with-fallback.js --help`.
      2. Assert stdout contains `Usage:` and exit code is 0.
    Expected Result: Help text appears; no immediate wrapper no-op.
    Evidence: .sisyphus/evidence/task-2-serve-help.txt

  Scenario: Serve starts and stays alive
    Tool: Bash
    Steps:
      1. Start `npm run serve -- --port 0` as a child process.
      2. Wait until stdout contains `[serve] root=` or http-server ready output.
      3. Fetch `/index.html` from selected port.
      4. Terminate child process.
    Expected Result: HTTP status 200 and process remains alive before termination.
    Evidence: .sisyphus/evidence/task-2-serve-start.txt
  ```

- [x] 3. Restore browser script compatibility for `index.html` load path

  **What to do**:
  - Replace CommonJS-only wrappers for files loaded by browser script tags with browser-compatible artifacts.
  - Choose a consistent strategy per file: preserve legacy UMD/global source where needed, compile browser-compatible output, or exclude Node-only wrappers from script-tag paths.
  - Fix invalid bare wrapper paths like `require('dist/./ui')` where Node wrappers remain.
  - Ensure globals expected by later scripts still exist in the same load order.

  **Must NOT do**:
  - Do not convert `index.html` wholesale to module scripts unless explicitly required; that is larger scope.
  - Do not remove UI panels or disable features to hide boot errors.

  **Recommended Agent Profile**:
  - **Category**: `deep` — requires browser/global/load-order compatibility across many files.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T7, T10
  - **Blocked By**: T1

  **References**:
  - `index.html:667-815` — exact browser script load order.
  - `shared-constants.js:1-3` — example broken browser-loaded CommonJS wrapper.
  - `cards/catalog.js:1-3` — example broken browser-loaded CommonJS wrapper.
  - `ui.js:1-3` — example broken browser-loaded CommonJS wrapper and invalid bare `dist` path.
  - `AGENTS.md` — preserve root source of truth and UI/game boundaries.

  **Acceptance Criteria**:
  - [ ] No browser script loaded by `index.html` throws `module is not defined` or `require is not defined`.
  - [ ] Initial board renders stones/cells correctly.
  - [ ] Main controls such as リセット, CPU, help, and board/cell interactions respond.

  **QA Scenarios**:
  ```
  Scenario: Browser boot has no wrapper ReferenceError
    Tool: Playwright
    Steps:
      1. Start local server from T2.
      2. Navigate to `/index.html?debug=1`.
      3. Capture console messages for 10 seconds.
      4. Assert no console error contains `module is not defined`, `require is not defined`, or failed script load for app JS.
    Expected Result: Browser boot completes without wrapper runtime errors.
    Evidence: .sisyphus/evidence/task-3-browser-console.json

  Scenario: UI reaches playable initial state
    Tool: Playwright
    Steps:
      1. Navigate to served `/index.html`.
      2. Wait for board container and cells to render.
      3. Assert board has 8x8 visible cells or configured board-size cells and initial stones/markers.
      4. Click `#resetBtn` and assert UI remains responsive.
    Expected Result: Board and controls are interactive, not stuck in disabled fallback state.
    Evidence: .sisyphus/evidence/task-3-ui-playable.png
  ```

- [x] 4. Repair Worker ESM Durable Object export

  **What to do**:
  - Ensure `workers/match-worker.mjs` explicitly exports `MatchRoomDurableObject` in a Wrangler-visible ESM form.
  - Keep `default` Worker export intact.
  - Ensure `npm run worker:prepare` does not overwrite or desynchronize the fixed entrypoint.
  - Prefer a minimal compatibility bridge if the dist output remains CommonJS.

  **Must NOT do**:
  - Do not rename Durable Object class or change `wrangler.toml` binding unless absolutely necessary.
  - Do not remove migrations.

  **Recommended Agent Profile**:
  - **Category**: `deep` — Worker module format and Wrangler static export behavior.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T8, T10
  - **Blocked By**: T1

  **References**:
  - `wrangler.toml:1-18` — expected Worker main and Durable Object binding.
  - `workers/match-worker.mjs:1-2` — current insufficient re-export bridge.
  - `workers/match-worker.ts:1675` — source class export.
  - `dist/workers/match-worker.js:39,1520,2884` — CommonJS named export output.

  **Acceptance Criteria**:
  - [ ] `workers/match-worker.mjs` has an explicit named ESM export `MatchRoomDurableObject`.
  - [ ] `default` Worker export remains available.
  - [ ] Wrangler deploy validation no longer reports missing Durable Object export.

  **QA Scenarios**:
  ```
  Scenario: Worker module exposes required exports
    Tool: Bash
    Steps:
      1. Run a Node dynamic import of `workers/match-worker.mjs`.
      2. Assert imported module has `default` and `MatchRoomDurableObject` keys.
      3. Save Object.keys output.
    Expected Result: Both required exports are present.
    Evidence: .sisyphus/evidence/task-4-worker-exports.txt

  Scenario: Wrangler no longer reports missing Durable Object export
    Tool: Bash
    Steps:
      1. Run `npm run worker:prepare`.
      2. Run the safest available Wrangler validation command for this repo, or `npm run worker:deploy` if deployment is intended in execution context.
      3. Assert stderr does not contain `Durable Objects ... are not exported`.
    Expected Result: Durable Object export error is gone.
    Evidence: .sisyphus/evidence/task-4-wrangler-validation.txt
  ```

- [x] 5. Select exact regression test commands and fixtures

  **What to do**:
  - Confirm which existing Jest tests cover serve helpers and Worker modules.
  - Confirm Playwright availability and local server launch strategy for UI smoke.
  - Define minimal commands for CI/local: avoid running deployment when a dry validation is enough, but include deploy-path validation when user explicitly wants it.

  **Must NOT do**:
  - Do not add broad slow tests before fixing regressions.

  **Recommended Agent Profile**:
  - **Category**: `quick` — command/test inventory.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T6, T7, T8
  - **Blocked By**: None

  **References**:
  - `package.json:20-60` — test/check scripts.
  - `test/serve-with-fallback.test.ts` — existing serve tests.
  - `test/workers.match-*.test.ts` — Worker test patterns.
  - `tests/visual-regression/run-visual-check.js` — existing visual tooling reference.

  **Acceptance Criteria**:
  - [ ] A short test command list exists for serve, UI boot, Worker export, and full checkall.
  - [ ] Commands avoid network deployment unless explicitly required.

  **QA Scenarios**:
  ```
  Scenario: Test command inventory is executable
    Tool: Bash
    Steps:
      1. Run selected command list with `--help` or dry options where available.
      2. Save resolved command list.
    Expected Result: Each command exists and is runnable in the repo.
    Evidence: .sisyphus/evidence/task-5-test-command-inventory.txt

  Scenario: Missing-tool failure is explicit
    Tool: Bash
    Steps:
      1. Check availability of Playwright and Wrangler commands.
      2. Record exact fallback if Wrangler cannot run without credentials.
    Expected Result: Plan has deterministic fallback validation for unavailable external credentials.
    Evidence: .sisyphus/evidence/task-5-tool-availability.txt
  ```

- [x] 6. Add serve wrapper regression test

  **What to do**:
  - Add/update tests so root `scripts/serve-with-fallback.js` is validated as an executable wrapper, not only as importable helpers.
  - Cover `--help` and child-process startup behavior with a bounded timeout.

  **Must NOT do**:
  - Do not leave a server process running after tests.

  **Recommended Agent Profile**:
  - **Category**: `quick` — focused Jest/Node child-process test.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Final QA
  - **Blocked By**: T2, T5

  **References**:
  - `test/serve-with-fallback.test.ts` — existing helper assertions.
  - `scripts/serve-with-fallback.js` — executable wrapper under test.

  **Acceptance Criteria**:
  - [ ] Test fails on current no-op wrapper and passes after repair.
  - [ ] Test proves server starts and is terminated cleanly.

  **QA Scenarios**:
  ```
  Scenario: Serve executable regression test passes
    Tool: Bash
    Steps:
      1. Run targeted Jest test for serve wrapper.
      2. Assert pass count includes new executable-wrapper case.
    Expected Result: Test passes and no orphan Node process remains.
    Evidence: .sisyphus/evidence/task-6-serve-test.txt

  Scenario: Serve test catches broken wrapper pattern
    Tool: Bash
    Steps:
      1. Inspect test assertion to confirm it executes root wrapper, not only dist helper.
      2. Save assertion excerpt or test output.
    Expected Result: Regression would fail if wrapper only `require`s dist without running CLI.
    Evidence: .sisyphus/evidence/task-6-regression-assertion.txt
  ```

- [x] 7. Add browser boot/interactivity smoke test

  **What to do**:
  - Add a Playwright or existing visual-smoke test that starts local server, opens the game, checks console errors, and verifies basic controls/board interactivity.
  - Specifically assert absence of CommonJS wrapper ReferenceErrors.

  **Must NOT do**:
  - Do not require human visual inspection as the only pass condition.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — browser UI verification.
  - **Skills**: [`playwright`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Final QA
  - **Blocked By**: T3, T5

  **References**:
  - `index.html:667-815` — startup script order.
  - `tests/visual-regression/run-visual-check.js` — visual test style.
  - Current screenshot symptom — empty board/disabled controls should be negative baseline.

  **Acceptance Criteria**:
  - [ ] Browser boot smoke fails on `module is not defined` / `require is not defined` startup errors.
  - [ ] Test asserts board/cell/control readiness with concrete selectors.

  **QA Scenarios**:
  ```
  Scenario: Browser smoke test passes
    Tool: Playwright
    Steps:
      1. Start local server.
      2. Navigate to `/index.html`.
      3. Assert no startup console errors.
      4. Assert `#board` contains rendered children and `#resetBtn` is visible/clickable.
      5. Capture screenshot.
    Expected Result: Game is interactive, not stuck in initial fallback state.
    Evidence: .sisyphus/evidence/task-7-browser-smoke.png

  Scenario: Browser smoke catches CommonJS wrapper breakage
    Tool: Playwright
    Steps:
      1. Capture all console errors during load.
      2. Assert forbidden patterns are absent: `module is not defined`, `require is not defined`, `Failed to load resource` for app scripts.
    Expected Result: Any wrapper regression fails the smoke test.
    Evidence: .sisyphus/evidence/task-7-console-errors.json
  ```

- [x] 8. Add Worker export/deploy-readiness regression test

  **What to do**:
  - Add/update a test or script that imports `workers/match-worker.mjs` and asserts `default` and `MatchRoomDurableObject` are visible.
  - Add a Wrangler validation step where possible without requiring external deployment, plus document when actual `worker:deploy` is run.

  **Must NOT do**:
  - Do not require Cloudflare credentials for ordinary local test pass unless deploy is explicitly requested.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — Worker/ESM/CommonJS interop validation.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Final QA
  - **Blocked By**: T4, T5

  **References**:
  - `wrangler.toml:11-18` — Durable Object export requirement.
  - `workers/match-worker.mjs:1-2` — entrypoint under test.
  - `test/workers.match-*.test.ts` — existing Worker module test patterns.

  **Acceptance Criteria**:
  - [ ] Local test imports Worker entrypoint and sees `MatchRoomDurableObject`.
  - [ ] Validation catches the exact missing export error class before deployment.

  **QA Scenarios**:
  ```
  Scenario: Worker export test passes
    Tool: Bash
    Steps:
      1. Run targeted Worker export Jest/Node test.
      2. Assert module keys include `default` and `MatchRoomDurableObject`.
    Expected Result: Export contract matches Wrangler config.
    Evidence: .sisyphus/evidence/task-8-worker-export-test.txt

  Scenario: Worker prepare preserves entrypoint contract
    Tool: Bash
    Steps:
      1. Run `npm run worker:prepare`.
      2. Re-run Worker export test.
    Expected Result: Prepare step does not break `workers/match-worker.mjs` exports.
    Evidence: .sisyphus/evidence/task-8-worker-prepare-export.txt
  ```

- [x] 9. Snapshot current broken evidence before repair

  **What to do**:
  - Capture current failure outputs so final report can prove the repair addressed the user-reported issues.
  - Include `npm run serve` no-op behavior, browser console failure, and Wrangler export error if reproducible without destructive deployment.

  **Must NOT do**:
  - Do not spend excessive time on this if credentials or environment block reproduction.

  **Recommended Agent Profile**:
  - **Category**: `quick` — evidence capture only.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Final report quality only
  - **Blocked By**: None

  **References**:
  - User pasted terminal output and screenshot.
  - `scripts/serve-with-fallback.js:1` and `workers/match-worker.mjs:1-2`.

  **Acceptance Criteria**:
  - [ ] Evidence files capture at least two of the three reported failures before repair.

  **QA Scenarios**:
  ```
  Scenario: Serve broken baseline captured
    Tool: Bash
    Steps:
      1. Run `npm run serve` with timeout.
      2. Save stdout/stderr and exit behavior.
    Expected Result: Baseline evidence shows current no-op/exit behavior.
    Evidence: .sisyphus/evidence/task-9-serve-baseline.txt

  Scenario: Worker deploy error baseline captured
    Tool: Bash
    Steps:
      1. Run safe Wrangler validation or user-provided command if permitted.
      2. Save missing Durable Object export error if reproduced.
    Expected Result: Baseline evidence includes export error or notes why not reproducible locally.
    Evidence: .sisyphus/evidence/task-9-worker-baseline.txt
  ```

- [x] 10. Build/sync generated outputs through approved scripts

  **What to do**:
  - Run TypeScript build after source repairs.
  - Run `npm run worker:prepare` if Worker/public mirror output is affected.
  - Commit source and generated/mirror outputs as separate atomic commits if both change.

  **Must NOT do**:
  - Do not hand-edit `dist/` or `worker-public/` as source-of-truth fixes.

  **Recommended Agent Profile**:
  - **Category**: `quick` — build/sync/commit hygiene.
  - **Skills**: [`git-master` if committing]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Final QA
  - **Blocked By**: T2, T3, T4

  **References**:
  - `package.json:7-17` — build and worker scripts.
  - `AGENTS.md` — root source of truth and `worker-public/` mirror rule.

  **Acceptance Criteria**:
  - [ ] `npm run build:ts` succeeds or documented project build equivalent succeeds.
  - [ ] `npm run worker:prepare` succeeds if required.
  - [ ] Generated outputs match source repairs.

  **QA Scenarios**:
  ```
  Scenario: TypeScript build regenerates expected outputs
    Tool: Bash
    Steps:
      1. Run `npm run build:ts`.
      2. Assert exit code 0.
      3. Save changed-file summary.
    Expected Result: Build succeeds and outputs are deterministic.
    Evidence: .sisyphus/evidence/task-10-build-ts.txt

  Scenario: Worker prepare remains clean
    Tool: Bash
    Steps:
      1. Run `npm run worker:prepare`.
      2. Assert exit code 0.
      3. Verify Worker export test still passes.
    Expected Result: Mirror preparation does not break entrypoint exports.
    Evidence: .sisyphus/evidence/task-10-worker-prepare.txt
  ```

---

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle`
  Verify every Must Have and Must NOT Have. Confirm evidence exists for T1-T10. Reject if game rules changed or if `worker-public/` was hand-edited as source of truth.

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `npm run checkall`, targeted Jest tests, TypeScript build/type checks selected by T5. Review for broad catches, silent fallbacks, orphan server processes, and wrapper path mistakes.

- [x] F3. **Real Browser/Server QA** — `unspecified-high` + `playwright`
  Start from clean state. Run `npm run serve`, open browser, verify board/interactions, capture console/network/screenshot evidence. Then verify Worker export and prepare/deploy-readiness path.

- [x] F4. **Scope Fidelity Check** — `deep`
  Compare diff against plan. Ensure all changes are limited to runtime entrypoint compatibility, tests, and generated outputs. Flag unrelated gameplay/UI design changes.

---

## Commit Strategy

- Commit 1: `fix: repair runtime entrypoint wrappers` — source/wrapper repairs for serve/browser/Worker.
- Commit 2: `test: cover post-migration entrypoint regressions` — targeted serve/browser/Worker regression tests.
- Commit 3: `build: refresh generated runtime outputs` — `dist/`, `worker-public/`, or generated manifests if changed by approved scripts.

---

## Success Criteria

### Verification Commands
```bash
npm run checkall
npm run build:ts
npm run worker:prepare
node scripts/serve-with-fallback.js --help
# plus targeted Jest/Playwright/Worker export commands selected in T5
```

### Final Checklist
- [ ] `npm run serve` starts the local game server and stays alive.
- [ ] Browser UI boots into playable state; no CommonJS wrapper startup errors.
- [ ] `MatchRoomDurableObject` is exported from `workers/match-worker.mjs` in Wrangler-visible form.
- [ ] Tests-after cover serve wrapper, browser boot, and Worker export regressions.
- [ ] `01-rulebook.md` update status reported; expected: unchanged because behavior is restored, not changed.

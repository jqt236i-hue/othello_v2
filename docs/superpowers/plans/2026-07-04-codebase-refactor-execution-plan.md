# Codebase Refactor Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce confirmed refactoring debt in Card Reversi without weakening browser boot, headless game authority, network authority, or generated worker mirror contracts.

**Architecture:** Execute this as independent, verified refactor passes. Preserve root browser boot modules, keep canonical game logic headless, and move code only when existing tests or new characterization tests prove behavior is unchanged. Each task must produce a separable commit and must not include unrelated dirty files.

**Tech Stack:** TypeScript/CommonJS, Jest, existing browser module registry, Cloudflare Worker mirror scripts, PowerShell on Windows.

---

## File Map

- Inspect only: `shared-constants.ts`, `game-events.ts`, `sound-engine.ts`, `ui.ts`, `is-env-capable.ts`, `card-system.ts`.
- Potentially remove after confirmation: `fix_registry_turnmanager.ts`, `fix_registry_turnmanager.js`.
- Modify for CPU refactor: `game/cpu-decision.ts`, focused new files under `game/ai/`, focused CPU tests under `test/`.
- Modify for UI refactor: `ui/network-client.ts`, existing helpers under `ui/network/`, focused network-client tests under `test/`.
- Modify for bootstrap refactor: `ui/bootstrap.ts`, possible focused files under `ui/bootstrap/`, focused bootstrap tests under `test/`.
- Modify for long-function refactors: only the function owner file and its focused tests for the active pass.
- Modify for global boundary cleanup: selected `game/` or `shared/` modules plus `docs/architecture-contracts.md` only when a public boundary changes.
- Generated or mirror files: `public/module-registry.js`, `dist/**`, and `worker-public/**` must change only through existing scripts when a task explicitly requires it.

## Guardrails

- Do not delete or move `shared-constants.ts`, `game-events.ts`, `sound-engine.ts`, `ui.ts`, `is-env-capable.ts`, or `card-system.ts` in this plan. They are current browser boot and TypeScript build inputs.
- Start every implementation session with `git status --short`.
- If unrelated dirty files remain, stage only the active task files by exact path.
- Do not edit `worker-public/` directly.
- For player-visible behavior changes, update `01-rulebook.md` first. This plan is intended to preserve behavior, so rulebook edits should normally be unnecessary.
- Use `npm run check:window` after any game/shared boundary cleanup.

## Baseline Verification

- [ ] **Step 1: Record current dirty tree**

Run:

```powershell
git status --short
```

Expected: existing unrelated dirty files may include `index.html`, CSS, `ui/deck-builder-renderer.ts`, `worker-public/`, artifacts, and existing untracked plans. Do not stage them.

- [ ] **Step 2: Confirm browser root modules are intentionally live**

Run:

```powershell
Select-String -Path entry-browser.js -Pattern 'dist/(is-env-capable|shared-constants|game-events|card-system|ui|sound-engine)'
Select-String -Path scripts\build-module-registry.ts -Pattern 'card-system.js|game-events.js|is-env-capable.js|shared-constants.js|sound-engine.js|ui.js'
Select-String -Path tsconfig.json -Pattern 'shared-constants.ts|game-events.ts|sound-engine.ts|ui.ts|is-env-capable.ts|card-system.ts'
npx jest --runInBand --runTestsByPath test\scripts.build-module-registry.boot-contract.test.ts test\entry-browser.bootstrap-contract.test.ts
```

Expected: all six root modules are found in boot/build inputs and the boot contract tests pass.

- [ ] **Step 3: Capture refactor metrics**

Run:

```powershell
Get-ChildItem game\cpu-decision.ts,ui\network-client.ts,ui\diff-renderer.ts,ui\bootstrap.ts,ui\animation-engine.ts,ui\board-renderer.ts | Select-Object Name,@{Name='Lines';Expression={(Get-Content $_.FullName).Count}},Length | Format-Table -AutoSize
(Get-ChildItem game\ai -File -Filter "cpu-policy-*.ts" | Measure-Object).Count
(rg -n "globalThis" game --glob "*.ts" | Measure-Object).Count
(rg -n "globalThis" shared --glob "*.ts" | Measure-Object).Count
(rg -n "window\.|document\.|NetworkMatchClient" game shared --glob "*.ts" | Measure-Object).Count
```

Expected: current approximate metrics are `game/cpu-decision.ts` 3487 lines, `ui/network-client.ts` 4212 lines, `cpu-policy-*.ts` 32 files, `globalThis` lines `game/` 83 and `shared/` 21, and direct `window.` / `document.` / `NetworkMatchClient` in `game/ shared/` is 0.

## Task 1: Retire `fix_registry_turnmanager` If Still Unused

**Files:**
- Delete if confirmed unused: `fix_registry_turnmanager.ts`
- Delete if confirmed unused: `fix_registry_turnmanager.js`
- Modify if deleting: `tsconfig.json`

- [ ] **Step 1: Confirm the only current reference**

Run:

```powershell
Select-String -Path tsconfig.json,package.json,entry-browser.js,scripts\build-module-registry.ts -Pattern "fix_registry_turnmanager"
git log --all --oneline -- fix_registry_turnmanager.ts fix_registry_turnmanager.js
```

Expected: only `tsconfig.json` includes `fix_registry_turnmanager.ts`; history shows the old one-shot patch commits.

- [ ] **Step 2: Confirm the generated registry already has the intended runtime path**

Run:

```powershell
@'
const fs = require('fs');
const s = fs.readFileSync('public/module-registry.js', 'utf8');
for (const needle of ['globalThis.DEBUG_HUMAN_VS_HUMAN', 'function isHumanVsHumanModeEnabled']) {
  const index = s.indexOf(needle);
  console.log(`${needle}: ${index}`);
}
'@ | node -
```

Expected: both needles are present. If either is missing, stop and inspect `scripts/build-module-registry.ts` before deleting anything.

- [ ] **Step 3: Remove the stale script from TypeScript inputs**

Edit `tsconfig.json` and remove only this include entry:

```json
"fix_registry_turnmanager.ts",
```

- [ ] **Step 4: Delete the stale script files**

Delete:

```text
fix_registry_turnmanager.ts
fix_registry_turnmanager.js
```

- [ ] **Step 5: Verify deletion**

Run:

```powershell
npm run typecheck
npm run build:ts
npx jest --runInBand --runTestsByPath test\scripts.build-module-registry.boot-contract.test.ts test\entry-browser.bootstrap-contract.test.ts
git diff --check -- tsconfig.json fix_registry_turnmanager.ts fix_registry_turnmanager.js
```

Expected: all commands pass; diff contains only `tsconfig.json` include removal and the two file deletions.

- [ ] **Step 6: Commit**

Run:

```powershell
git add -- tsconfig.json fix_registry_turnmanager.ts fix_registry_turnmanager.js
git commit -m "chore: remove stale registry patch helper"
```

## Task 2: Extract CPU Board And Marker Primitives

**Files:**
- Create: `game/ai/cpu-policy-board-marker-primitives.ts`
- Modify: `game/cpu-decision.ts`
- Test: `test/cpu.decision.placement-priority.test.ts`
- Test: `test/game.cpu-policy-board-primitives.test.ts`

- [ ] **Step 1: Add characterization coverage for the current helper behavior**

Add focused tests around the behavior currently provided by:

```text
getBoardCellValueSafe
countAdjacentCellsByValue
getMarkerPriorityValue
getTimedMarkerProfileAt
getMarkerProfileAt
```

Use existing board/marker fixtures from `test/cpu.decision.placement-priority.test.ts` and `test/game.cpu-policy-board-primitives.test.ts`. Export only the new primitive API from the new file; do not export internals from `game/cpu-decision.ts`.

- [ ] **Step 2: Run tests and verify they pass against current behavior**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\cpu.decision.placement-priority.test.ts test\game.cpu-policy-board-primitives.test.ts
```

Expected: current behavior is characterized before moving code.

- [ ] **Step 3: Move primitive logic**

Create `game/ai/cpu-policy-board-marker-primitives.ts` with named exports for:

```typescript
getBoardCellValueSafe
countAdjacentCellsByValue
getMarkerPriorityValue
getTimedMarkerProfileAt
getMarkerProfileAt
```

Keep parameters explicit. Pass `cardState`, `gameState`, `CardLogic`, and dependency readers as arguments instead of reading browser globals in the new module.

- [ ] **Step 4: Replace local helper bodies in `game/cpu-decision.ts`**

Import or `_require('./ai/cpu-policy-board-marker-primitives')` following the existing CPU policy module pattern. Replace the local helper bodies with thin wrappers that delegate to the new module and preserve current exported API shape.

- [ ] **Step 5: Verify CPU primitive extraction**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\cpu.decision.placement-priority.test.ts test\game.cpu-policy-board-primitives.test.ts test\cpu.decision.refactor.test.ts
npm run typecheck
npm run build:ts
git diff --check -- game\cpu-decision.ts game\ai\cpu-policy-board-marker-primitives.ts test\cpu.decision.placement-priority.test.ts test\game.cpu-policy-board-primitives.test.ts
```

Expected: all commands pass; no behavior changes outside delegation.

- [ ] **Step 6: Commit**

Run:

```powershell
git add -- game/cpu-decision.ts game/ai/cpu-policy-board-marker-primitives.ts test/cpu.decision.placement-priority.test.ts test/game.cpu-policy-board-primitives.test.ts
git commit -m "refactor: extract CPU board marker primitives"
```

## Task 3: Extract CPU Lv6 Placement Filters

**Files:**
- Create: `game/ai/cpu-policy-placement-filters.ts`
- Modify: `game/cpu-decision.ts`
- Test: `test/cpu.decision.placement-priority.test.ts`
- Test: `test/game.cpu-policy-placement-features.test.ts`

- [ ] **Step 1: Characterize current filter output**

Add focused cases for:

```text
filterLv6OpenCornerAdjacentMoves
filterMovesByLv6PlacementPriority
isCloneSplitEligibleSource
filterCloneSplitTargetsForLv6
```

Cover at least one corner-adjacent rejection, one placement priority ordering, and one clone split eligibility case.

- [ ] **Step 2: Run characterization tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\cpu.decision.placement-priority.test.ts test\game.cpu-policy-placement-features.test.ts
```

Expected: tests pass before extraction.

- [ ] **Step 3: Move filter logic**

Create `game/ai/cpu-policy-placement-filters.ts` and export the four filter functions. Use imports from existing `game/ai/cpu-policy-placement-features.ts`, `game/ai/cpu-policy-placement-profiles.ts`, and the new board marker primitive module when available.

- [ ] **Step 4: Delegate from `game/cpu-decision.ts`**

Replace the local helper implementations with wrappers that call `CpuPolicyPlacementFilters`. Keep names stable for existing tests and browser globals.

- [ ] **Step 5: Verify placement extraction**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\cpu.decision.placement-priority.test.ts test\game.cpu-policy-placement-features.test.ts test\cpu.decision.refactor.test.ts
npm run typecheck
npm run build:ts
git diff --check -- game\cpu-decision.ts game\ai\cpu-policy-placement-filters.ts test\cpu.decision.placement-priority.test.ts test\game.cpu-policy-placement-features.test.ts
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add -- game/cpu-decision.ts game/ai/cpu-policy-placement-filters.ts test/cpu.decision.placement-priority.test.ts test/game.cpu-policy-placement-features.test.ts
git commit -m "refactor: extract CPU placement filters"
```

## Task 4: Extract CPU Pending Target Policy

**Files:**
- Create: `game/ai/cpu-policy-pending-targets.ts`
- Modify: `game/cpu-decision.ts`
- Modify only if needed: `game/turn-handlers/pending-target-selector.ts`
- Test: `test/cpu.decision.pending-score.test.ts`
- Test: `test/cpu.decision.pending-onnx.test.ts`
- Test: `test/cpu.decision.pending-pipeline.test.ts`

- [ ] **Step 1: Characterize pending target scoring**

Add or extend cases that lock behavior for:

```text
getCornerProximity
getForcedCornerLaneBonus
getForcedCornerLaneAntiPatternPenalty
simulatePendingPlacementBoard
scorePendingTargetByType
choosePendingTargetWithPolicy
choosePendingTargetWithPolicyAsync
```

Use existing pending selection fixtures. Assert selected target, score ordering, and ONNX fallback behavior.

- [ ] **Step 2: Run pending target tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\cpu.decision.pending-score.test.ts test\cpu.decision.pending-onnx.test.ts test\cpu.decision.pending-pipeline.test.ts
```

Expected: tests pass before extraction.

- [ ] **Step 3: Move pending target logic**

Create `game/ai/cpu-policy-pending-targets.ts`. Export scoring and selection functions. Dependencies must be passed in as an options object containing board, player value resolution, marker profile readers, ONNX runtime, timer service, and current legal move readers.

- [ ] **Step 4: Delegate from `game/cpu-decision.ts`**

Replace the pending target local helpers with wrappers that build the options object and call `CpuPolicyPendingTargets`. Do not change pending network publish behavior or selection-flow bridges.

- [ ] **Step 5: Verify pending target extraction**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\cpu.decision.pending-score.test.ts test\cpu.decision.pending-onnx.test.ts test\cpu.decision.pending-pipeline.test.ts test\cpu.decision.pending-actions.test.ts test\cpu.decision.selection-flow.test.ts
npm run typecheck
npm run build:ts
git diff --check -- game\cpu-decision.ts game\ai\cpu-policy-pending-targets.ts game\turn-handlers\pending-target-selector.ts test\cpu.decision.pending-score.test.ts test\cpu.decision.pending-onnx.test.ts test\cpu.decision.pending-pipeline.test.ts
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add -- game/cpu-decision.ts game/ai/cpu-policy-pending-targets.ts game/turn-handlers/pending-target-selector.ts test/cpu.decision.pending-score.test.ts test/cpu.decision.pending-onnx.test.ts test/cpu.decision.pending-pipeline.test.ts
git commit -m "refactor: extract CPU pending target policy"
```

If `game/turn-handlers/pending-target-selector.ts` is unchanged, omit it from `git add`.

## Task 5: Extract CPU Time Bomb Target Policy

**Files:**
- Create: `game/ai/cpu-policy-time-bomb-targets.ts`
- Modify: `game/cpu-decision.ts`
- Test: `test/cpu.decision.pending-score.test.ts`
- Test: `test/game.cpu-policy-card-type-flags.test.ts`

- [ ] **Step 1: Characterize time bomb target choice**

Add focused tests for:

```text
scoreTimeBombTarget
chooseTimeBombTargetWithPolicy
```

Cover at least one high-value target, one protected or low-value target, and deterministic tie handling.

- [ ] **Step 2: Run the focused tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\cpu.decision.pending-score.test.ts test\game.cpu-policy-card-type-flags.test.ts
```

Expected: current behavior is captured.

- [ ] **Step 3: Move time bomb logic**

Create `game/ai/cpu-policy-time-bomb-targets.ts` with exports for scoring and choosing targets. Reuse existing card taxonomy/type helpers instead of duplicating card type checks.

- [ ] **Step 4: Delegate from `game/cpu-decision.ts`**

Replace local time bomb helper bodies with wrappers that call the new module.

- [ ] **Step 5: Verify time bomb extraction**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\cpu.decision.pending-score.test.ts test\game.cpu-policy-card-type-flags.test.ts test\cpu.decision.refactor.test.ts
npm run typecheck
npm run build:ts
git diff --check -- game\cpu-decision.ts game\ai\cpu-policy-time-bomb-targets.ts test\cpu.decision.pending-score.test.ts test\game.cpu-policy-card-type-flags.test.ts
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add -- game/cpu-decision.ts game/ai/cpu-policy-time-bomb-targets.ts test/cpu.decision.pending-score.test.ts test/game.cpu-policy-card-type-flags.test.ts
git commit -m "refactor: extract CPU time bomb targeting"
```

## Task 6: Thin `computeCpuAction`

**Files:**
- Modify: `game/cpu-decision.ts`
- Modify if needed: `game/ai/cpu-policy-core.ts`
- Test: `test/cpu.compute.test.ts`
- Test: `test/cpu.decision.public-api.test.ts`
- Test: `test/cpu.decision.refactor.test.ts`

- [ ] **Step 1: Characterize public CPU action API**

Add or extend tests that assert:

```text
computeCpuAction
selectCpuMoveWithPolicy
cpuMaybeUseCardWithPolicy
```

still return the same action shapes for pass, placement, card use, and pending selection continuation.

- [ ] **Step 2: Run public API tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\cpu.compute.test.ts test\cpu.decision.public-api.test.ts test\cpu.decision.refactor.test.ts
```

Expected: tests pass before the wrapper cleanup.

- [ ] **Step 3: Remove now-dead local helper branches**

In `game/cpu-decision.ts`, remove local helper bodies that are fully delegated after Tasks 2-5. Keep public exports stable. Keep `computeCpuAction` as the entrypoint that orchestrates policy modules rather than reimplementing policy details.

- [ ] **Step 4: Verify CPU pass**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\cpu.compute.test.ts test\cpu.decision.public-api.test.ts test\cpu.decision.refactor.test.ts test\cpu.decision.card-actions.test.ts test\cpu.decision.pending-actions.test.ts
npm run typecheck
npm run build:ts
git diff --check -- game\cpu-decision.ts game\ai\cpu-policy-core.ts test\cpu.compute.test.ts test\cpu.decision.public-api.test.ts test\cpu.decision.refactor.test.ts
```

Expected: all commands pass and `game/cpu-decision.ts` line count decreases substantially.

- [ ] **Step 5: Commit**

Run:

```powershell
git add -- game/cpu-decision.ts game/ai/cpu-policy-core.ts test/cpu.compute.test.ts test/cpu.decision.public-api.test.ts test/cpu.decision.refactor.test.ts
git commit -m "refactor: thin CPU decision entrypoint"
```

If `game/ai/cpu-policy-core.ts` is unchanged, omit it from `git add`.

## Task 7: Split `ui/network-client.ts` Publish Flow

**Files:**
- Create or extend: `ui/network/publish-flow.ts`
- Create or extend: `ui/network/publish-request.ts`
- Create or extend: `ui/network/publish-tracker.ts`
- Modify: `ui/network-client.ts`
- Test: `test/ui.network-client.publish-base-version.test.ts`
- Test: `test/ui.network-client.publish-shell.contract.test.ts`
- Test: `test/ui.network-client.action-bridge-next-snapshot.test.ts`

- [ ] **Step 1: Characterize current publish behavior**

Run existing publish tests first:

```powershell
npx jest --runInBand --runTestsByPath test\ui.network-client.publish-base-version.test.ts test\ui.network-client.publish-shell.contract.test.ts test\ui.network-client.action-bridge-next-snapshot.test.ts
```

Expected: tests pass before extraction.

- [ ] **Step 2: Move publish request construction**

Move request construction, operation id handling, base-version handling, and publish tracker updates from `ui/network-client.ts` into existing `ui/network/publish-request.ts`, `ui/network/publish-tracker.ts`, and `ui/network/publish-flow.ts`. Keep `NetworkMatchClient` public methods and constructor options unchanged.

- [ ] **Step 3: Delegate from `NetworkMatchClient`**

Replace the moved blocks in `ui/network-client.ts` with calls into the network publish modules. Do not change snapshot application, reconnect, or room-state code in this task.

- [ ] **Step 4: Verify publish flow extraction**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\ui.network-client.publish-base-version.test.ts test\ui.network-client.publish-shell.contract.test.ts test\ui.network-client.action-bridge-next-snapshot.test.ts test\ui.network-client.trap-deferred-publish.test.ts test\ui.network-client.movement-deferred-publish.test.ts
npm run typecheck
npm run build:ts
git diff --check -- ui\network-client.ts ui\network\publish-flow.ts ui\network\publish-request.ts ui\network\publish-tracker.ts test\ui.network-client.publish-base-version.test.ts test\ui.network-client.publish-shell.contract.test.ts test\ui.network-client.action-bridge-next-snapshot.test.ts
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add -- ui/network-client.ts ui/network/publish-flow.ts ui/network/publish-request.ts ui/network/publish-tracker.ts test/ui.network-client.publish-base-version.test.ts test/ui.network-client.publish-shell.contract.test.ts test/ui.network-client.action-bridge-next-snapshot.test.ts
git commit -m "refactor: split network publish flow"
```

## Task 8: Split `ui/network-client.ts` Snapshot Intake

**Files:**
- Create or extend: `ui/network/intake-envelope.ts`
- Create or extend: `ui/network/intake-coordinator.ts`
- Create or extend: `ui/network/snapshot.ts`
- Modify: `ui/network-client.ts`
- Test: `test/ui.network-client.apply-coordinator.test.ts`
- Test: `test/ui.network-client.reconnect-sync.test.ts`
- Test: `test/ui.network-snapshot.pending-presentation-reconcile.test.ts`
- Test: `test/ui.network-snapshot.single-writer-baseline.test.ts`

- [ ] **Step 1: Run snapshot intake tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\ui.network-client.apply-coordinator.test.ts test\ui.network-client.reconnect-sync.test.ts test\ui.network-snapshot.pending-presentation-reconcile.test.ts test\ui.network-snapshot.single-writer-baseline.test.ts
```

Expected: tests pass before extraction.

- [ ] **Step 2: Move envelope parsing and snapshot dispatch**

Move stream envelope parsing, stale snapshot checks, apply coordination, and presentation queue handoff into `ui/network/intake-envelope.ts`, `ui/network/intake-coordinator.ts`, and existing snapshot modules. Preserve Single Visual Writer behavior: snapshot model reconciliation may happen immediately, but board DOM writes must respect playback locks.

- [ ] **Step 3: Delegate from `NetworkMatchClient`**

Keep `NetworkMatchClient` as the owner of connection state and public methods. Delegate intake work to the new coordinator.

- [ ] **Step 4: Verify snapshot extraction**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\ui.network-client.apply-coordinator.test.ts test\ui.network-client.reconnect-sync.test.ts test\ui.network-snapshot.pending-presentation-reconcile.test.ts test\ui.network-snapshot.single-writer-baseline.test.ts test\ui.network-client.visual-catchup.test.ts
npm run typecheck
npm run build:ts
npm run test:network:parity
git diff --check -- ui\network-client.ts ui\network\intake-envelope.ts ui\network\intake-coordinator.ts ui\network\snapshot.ts
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add -- ui/network-client.ts ui/network/intake-envelope.ts ui/network/intake-coordinator.ts ui/network/snapshot.ts
git commit -m "refactor: split network snapshot intake"
```

## Task 9: Split `ui/bootstrap.ts` DI Installation

**Files:**
- Create or extend under `ui/bootstrap/`: `runtime-resolvers.ts`, `init-dom.ts`, `init-events.ts`, `init-game.ts`, `init-network.ts`
- Modify: `ui/bootstrap.ts`
- Test: `test/ui.bootstrap.lazy-install.test.ts`
- Test: `test/ui.bootstrap.cpu-early-registration.test.ts`
- Test: `test/ui.bootstrap.debug-log.test.ts`

- [ ] **Step 1: Run bootstrap tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\ui.bootstrap.lazy-install.test.ts test\ui.bootstrap.cpu-early-registration.test.ts test\ui.bootstrap.debug-log.test.ts test\ui.bootstrap-shared.test.ts
```

Expected: tests pass before extraction.

- [ ] **Step 2: Extract runtime resolver setup**

Move repeated optional module/global resolver code from `ui/bootstrap.ts` into `ui/bootstrap/runtime-resolvers.ts`. Keep `ui/` as the browser adapter layer; do not move these browser global reads into `game/` or `shared/`.

- [ ] **Step 3: Extract DI installation groups**

Move cohesive sections of `installUIDI` into existing bootstrap init modules:

```text
DOM element and render hooks -> ui/bootstrap/init-dom.ts
event and input hooks -> ui/bootstrap/init-events.ts
game and CPU hooks -> ui/bootstrap/init-game.ts
network hooks -> ui/bootstrap/init-network.ts
```

Keep `installUIDI` as an orchestration function that calls these installers.

- [ ] **Step 4: Verify bootstrap extraction**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\ui.bootstrap.lazy-install.test.ts test\ui.bootstrap.cpu-early-registration.test.ts test\ui.bootstrap.debug-log.test.ts test\ui.bootstrap-shared.test.ts test\scripts.build-module-registry.boot-contract.test.ts test\entry-browser.bootstrap-contract.test.ts
npm run typecheck
npm run build:browser
git diff --check -- ui\bootstrap.ts ui\bootstrap\runtime-resolvers.ts ui\bootstrap\init-dom.ts ui\bootstrap\init-events.ts ui\bootstrap\init-game.ts ui\bootstrap\init-network.ts public\module-registry.js
```

Expected: all commands pass. `public/module-registry.js` changes only if generated by `npm run build:browser`.

- [ ] **Step 5: Commit**

Run:

```powershell
git add -- ui/bootstrap.ts ui/bootstrap/runtime-resolvers.ts ui/bootstrap/init-dom.ts ui/bootstrap/init-events.ts ui/bootstrap/init-game.ts ui/bootstrap/init-network.ts public/module-registry.js
git commit -m "refactor: split UI bootstrap DI installers"
```

If `public/module-registry.js` is unchanged, omit it from `git add`.

## Task 10: Refactor Verified Long Functions One At A Time

**Files:**
- Active pass only. Candidate files:
  - `game/turn/action-phase/pre-placement-selection.ts`
  - `ui/diff-renderer/projector.ts`
  - `ui/handlers/match-mode/network-buttons.ts`
  - `ui/diff-renderer/dom-patcher.ts`
  - `game/cards/effect-resolver.ts`
  - `ui/board-renderer.ts`

- [ ] **Step 1: Re-run AST measurement**

Run:

```powershell
@'
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const targets = new Set(['resolvePrePlacementSelectionAction','installUIDI','buildCurrentCellState','bindNetworkButtons','updateCellDOM','applyCardUsage','renderBoardFullLegacy','mapEffectLogsFromPipeline','buildPendingSelectionFlowBridge','planSelectionSoundCues','applyActionPhase','moveHyperactiveOnce']);
function walk(dir, out=[]) { for (const e of fs.readdirSync(dir, {withFileTypes:true})) { const p=path.join(dir,e.name); if (e.isDirectory()) walk(p,out); else if (p.endsWith('.ts')) out.push(p); } return out; }
function nameOf(node) { if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name) return node.name.text; if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text; return null; }
function bodyNode(node) { if (ts.isVariableDeclaration(node) && node.initializer) { const init=node.initializer; if ((ts.isArrowFunction(init)||ts.isFunctionExpression(init)) && init.body) return init.body; } return node.body || null; }
const rows=[];
for (const f of [...walk('ui'), ...walk('game')]) {
  const text=fs.readFileSync(f,'utf8'); const sf=ts.createSourceFile(f,text,ts.ScriptTarget.Latest,true);
  function visit(node) {
    const n=nameOf(node); const b=bodyNode(node);
    if (n && targets.has(n) && b) {
      const start=sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1;
      const end=sf.getLineAndCharacterOfPosition(b.end).line+1;
      rows.push({file:f,name:n,lines:end-start+1,start,end});
    }
    ts.forEachChild(node,visit);
  }
  visit(sf);
}
rows.sort((a,b)=>b.lines-a.lines);
for (const r of rows) console.log(`${r.lines}\t${r.file}:${r.start}\t${r.name}`);
'@ | node -
```

Expected: do not prioritize `ui/animation-engine.ts:_requestBoardUpdate`; it is currently a false positive at about 12 lines.

- [ ] **Step 2: Pick one function and add characterization tests**

Choose the highest-risk function with existing nearby tests. Add tests that prove current inputs and outputs before changing internals.

- [ ] **Step 3: Extract pure helper blocks**

Move only pure computation or formatting blocks into adjacent files. Leave DOM writes, playback writes, network publishes, and game authority in their current boundary layer.

- [ ] **Step 4: Verify the single-function pass**

Run the focused tests for that file, then:

```powershell
npm run typecheck
npm run build:ts
git diff --check
```

Expected: all commands pass.

- [ ] **Step 5: Commit the single-function pass**

For `game/turn/action-phase/pre-placement-selection.ts`, run:

```powershell
git status --short
git add -- game/turn/action-phase/pre-placement-selection.ts test/game.free-placement-like-pending.test.ts test/game.placement-immediate-effect-context.test.ts
git commit -m "refactor: split pre-placement selection action"
```

For `ui/diff-renderer/projector.ts`, run:

```powershell
git status --short
git add -- ui/diff-renderer/projector.ts test/ui.diff-renderer.viewer-context.test.ts test/ui.diff-renderer.special-marker-renderer.test.ts
git commit -m "refactor: split diff renderer projection"
```

For `ui/handlers/match-mode/network-buttons.ts`, run:

```powershell
git status --short
git add -- ui/handlers/match-mode/network-buttons.ts test/ui.match-mode.network-button.test.ts test/ui.match-mode.network-clipboard.test.ts
git commit -m "refactor: split match network buttons"
```

For `ui/diff-renderer/dom-patcher.ts`, run:

```powershell
git status --short
git add -- ui/diff-renderer/dom-patcher.ts test/ui.diff-renderer.flip.test.ts test/ui.diff-renderer.destroy-fade-shadow.test.ts
git commit -m "refactor: split diff renderer DOM patching"
```

For `game/cards/effect-resolver.ts`, run:

```powershell
git status --short
git add -- game/cards/effect-resolver.ts test/game.cards.card-used-presentation.test.ts test/game.protection-context.test.ts
git commit -m "refactor: split card effect resolver"
```

For `ui/board-renderer.ts`, run:

```powershell
git status --short
git add -- ui/board-renderer.ts test/ui.card-ui-sync.test.ts test/ui.render-scheduler.test.ts
git commit -m "refactor: split board renderer legacy path"
```

## Task 11: Reduce `globalThis` Boundary Debt Safely

**Files:**
- Modify one selected boundary per pass.
- Candidate files: `game/logic/cards.ts`, `game/cpu-decision-runtime.ts`, `game/cpu-turn-handler.ts`, `game/logic/board_ops.ts`, `shared/deck-spec.ts`, `shared/special-stone-registry.ts`.
- Test: focused existing tests for the selected module.

- [ ] **Step 1: Select one boundary**

Run:

```powershell
rg -n "globalThis" game shared --glob "*.ts"
```

Pick one module with a small dependency surface. Prefer `game/cpu-decision-runtime.ts` before `game/logic/cards.ts`.

- [ ] **Step 2: Add or identify contract tests**

For the selected boundary, identify focused tests that cover both CommonJS require and browser/global fallback behavior. If no test exists, add one before changing code.

- [ ] **Step 3: Replace one global fallback with explicit dependency input**

Move dependency lookup to the caller or bootstrap adapter. Do not make `game/` discover `window`, DOM, sound, animation, or `NetworkMatchClient`.

- [ ] **Step 4: Verify boundary cleanup**

Run:

```powershell
npm run check:window
rg -n "window\.|document\.|NetworkMatchClient" game shared --glob "*.ts"
npm run typecheck
npm run build:ts
```

Expected: `check:window`, typecheck, and build pass; direct `window.` / `document.` / `NetworkMatchClient` remains 0 in `game/ shared/`.

- [ ] **Step 5: Commit the boundary pass**

For `game/cpu-decision-runtime.ts`, run:

```powershell
git status --short
git add -- game/cpu-decision-runtime.ts test/cpu.decision.refactor.test.ts test/cpu.onnx-context.characterization.test.ts
git commit -m "refactor: reduce CPU decision runtime global fallback"
```

For `game/cpu-turn-handler.ts`, run:

```powershell
git status --short
git add -- game/cpu-turn-handler.ts test/cpu.turn-handler.network-guard.test.ts test/cpu.turn-handler.pending.test.ts
git commit -m "refactor: reduce CPU turn handler global fallback"
```

For `game/logic/board_ops.ts`, run:

```powershell
git status --short
git add -- game/logic/board_ops.ts test/game.board-ops.result-totals.test.ts test/game.board-ops-move.test.ts test/game.flip-evade-fallback.test.ts
git commit -m "refactor: reduce board ops global fallback"
```

For `shared/deck-spec.ts`, run:

```powershell
git status --short
git add -- shared/deck-spec.ts test/game.cards.reshuffle-cycle.test.ts test/special-card-foundation.test.ts test/local-match-server.room-deck.test.ts test/workers.match-room-deck.test.ts
git commit -m "refactor: reduce deck spec global fallback"
```

For `shared/special-stone-registry.ts`, run:

```powershell
git status --short
git add -- shared/special-stone-registry.ts test/game.special-stone-bubble-rollout.test.ts test/game.special-stone-visual-rule.test.ts
git commit -m "refactor: reduce special stone registry global fallback"
```

## Final Verification

- [ ] **Step 1: Run broad checks after all selected passes**

Run:

```powershell
npm run typecheck
npm run build:ts
npm run checkall
npm run test:jest
npm run test:network:parity
npm run check:window
git diff --check
```

Expected: all commands pass.

- [ ] **Step 2: Rebuild browser registry only if browser source changed**

Run only if tasks touched browser boot, `ui/bootstrap.ts`, root browser modules, or build registry inputs:

```powershell
npm run build:browser
npx jest --runInBand --runTestsByPath test\scripts.build-module-registry.boot-contract.test.ts test\entry-browser.bootstrap-contract.test.ts
```

Expected: generated `public/module-registry.js` changes only through the build command.

- [ ] **Step 3: Prepare worker mirror only if worker deploy surface changed**

Run only if Worker/local/network source changes need deploy mirror parity:

```powershell
npm run worker:prepare
```

Expected: `worker-public/**` changes only through the prepare script.

- [ ] **Step 4: Report residual debt**

Run:

```powershell
Get-ChildItem game\cpu-decision.ts,ui\network-client.ts,ui\bootstrap.ts | Select-Object Name,@{Name='Lines';Expression={(Get-Content $_.FullName).Count}},Length | Format-Table -AutoSize
(rg -n "globalThis" game --glob "*.ts" | Measure-Object).Count
(rg -n "globalThis" shared --glob "*.ts" | Measure-Object).Count
git status --short
```

Expected: line counts and `globalThis` counts are lower or unchanged in safe areas; unrelated pre-existing dirty files are clearly listed.

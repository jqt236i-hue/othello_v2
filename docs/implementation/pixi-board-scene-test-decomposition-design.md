# Pixi board-scene test decomposition design

- Role: current implementation design for a behavior-preserving test-only refactor.
- Target: `test/ui.pixi-board-scene.test.ts` and a new test fixture/suite structure under `test/`.
- Source of truth: current production behavior remains owned by `ui/pixi/*` and `ui/board-visual/*`; this document does not redefine it.
- Non-goals: no game, UI runtime, Pixi rendering, player-visible text, generated output, or Worker mirror changes.

## Problem and desired outcome

`test/ui.pixi-board-scene.test.ts` currently contains 2,608 lines, 408 lines of shared fake-runtime/model setup before the first suite, three top-level suites, 40 test declarations, and 44 executed Jest cases because one declaration is parameterized. It was changed in 19 commits since 2026-07-26. The file now mixes retained view tests, static board-scene tests, and playback projection tests, so unrelated Pixi work repeatedly edits the same large file.

The desired outcome is to keep the same assertions and focused Jest entry path while placing each concern in a smaller owned module and placing its exact shared setup in one helper.

## Scope and constraints

- Preserve `test/ui.pixi-board-scene.test.ts` as the focused Jest entry used by current plans and commands.
- Preserve all 40 test declarations, 44 executed cases, names, assertions, setup values, fake Pixi behavior, and execution order.
- Keep the extracted suite modules from being discovered as additional Jest suites; the entry file imports them once.
- Do not generalize the helper for every Pixi test. `ui.pixi-cell-view.test.ts` and `ui.pixi-source-trajectory.test.ts` intentionally use different fake graphics command representations today.
- Do not edit production or generated files.

## Current architecture and evidence

The source file has three stable top-level boundaries:

1. `Pixi static retained views`: cell, stone, and hint retained-view behavior.
2. `Pixi static board scene`: scene layers, clipping, sparse materialization, and dependency invalidation.
3. `Pixi board scene playback projection`: retained overrides, transient objects, topology reveal, and cleanup.

The existing entry path is named by current implementation plans and verification commands. Turning each extracted module into a separate `*.test.ts` file would make those commands run only the remaining entry file and silently reduce their coverage.

## Alternatives considered

### Separate discoverable Jest files

Rejected. It would be simple, but existing `--runTestsByPath test/ui.pixi-board-scene.test.ts` commands would no longer cover all current board-scene tests.

### One shared fake Pixi framework for every Pixi test

Rejected for this task. The nearby tests record graphics commands in different shapes. Unifying them would require assertion rewrites and create a broader abstraction than the proven need.

### Aggregating entry with non-discoverable suite modules

Chosen. The existing entry imports three suite modules. Jest still sees one focused suite and the same 40 tests, while the implementation is split by responsibility.

## Chosen structure

- `test/ui.pixi-board-scene.test.ts`: import-only focused entry.
- `test/helpers/pixi-board-scene-fixtures.ts`: exact fake Pixi classes, bounds helper, runtime factory, topology/frame builders, and view-context builders.
- `test/ui.pixi-board-scene/retained-views.ts`: retained cell, stone, and hint view suite.
- `test/ui.pixi-board-scene/static-scene.ts`: static scene suite and its source-boundary inspection imports.
- `test/ui.pixi-board-scene/playback-projection.ts`: playback projection suite and effect-bounds dependency.

The suite modules import production modules directly and import only the shared fixture symbols they use. They do not export runtime APIs and are loaded only by the focused entry.

## Compatibility and failure behavior

There is no production compatibility or migration surface. The only compatibility contract is the focused test path and its 44-case result. A missing suite import, duplicate Jest discovery, changed assertion, or changed test count is a completion failure.

## Verification strategy

1. Run the focused entry alone and confirm one suite and 44 passing tests.
2. Run the adjacent cell-view and source-trajectory tests to prove their specialized fakes were not affected.
3. Run TypeScript type checking.
4. Run dependency-boundary and repository checks. If the repository-wide check reaches an unrelated pre-existing Worker-mirror mismatch, record the exact mismatch and do not generate or commit out-of-scope mirror assets.
5. Inspect the task-owned diff and final status.

## Risks and mitigations

- Coverage loss from the existing entry path: retain the import-only aggregator and assert the focused result remains 40 tests.
- Accidental duplicate execution: use non-`*.test.ts` suite module names and confirm Jest reports one focused suite.
- Fixture drift during movement: move definitions without changing their bodies and rely on the unchanged assertions.
- Import-path mistakes: run focused Jest and TypeScript checks before review.

## Completion conditions

- The original 2,608-line file becomes an import-only entry.
- Shared setup exists once in the dedicated helper.
- The three existing suites live in three responsibility-owned modules.
- The focused entry passes exactly one suite and 44 tests.
- Adjacent Pixi view/trajectory tests, type checking, and dependency checks pass. The repository-wide check either passes or has only an explicitly recorded out-of-scope mirror failure after all task-relevant checks pass.
- No production or generated file is changed.
- Independent final review has no unresolved material finding.
- The task-owned change is committed; unrelated files remain untouched and are reported separately.

## Self-review

The initial idea used three new discoverable `*.test.ts` files. Repository search showed that current plans invoke the original path directly, so that design could silently narrow future focused verification. The design was revised to retain the original path as an aggregator. A proposed repository-wide fake Pixi helper was also narrowed to a board-scene-specific fixture because nearby tests use incompatible command recording and do not need to change for this outcome. The first post-split run also corrected the baseline from 40 declarations to 44 executed cases and proved that source-boundary path resolution must use the repository root rather than the moved suite directory. During verification, unrelated Observer Will assets left the Worker mirror stale; the design now explicitly prevents an isolated test refactor from absorbing those generated asset changes.

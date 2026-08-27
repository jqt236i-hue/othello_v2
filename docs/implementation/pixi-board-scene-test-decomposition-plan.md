# Pixi board-scene test decomposition implementation plan

- Role: executable plan for the reviewed `pixi-board-scene-test-decomposition-design.md`.
- Target: behavior-preserving organization of the Pixi board-scene Jest coverage.
- Source of truth: the existing 40 assertions and production modules remain authoritative.
- Non-goals: no product behavior, runtime API, generated output, mirror, or player-visible documentation changes.

## Step 1: Extract the exact shared fixture

- Outcome: fake Pixi objects and frame/view builders have one test-owned implementation.
- Files: `test/helpers/pixi-board-scene-fixtures.ts`.
- Dependencies: reviewed design and clean task-owned baseline.
- Verification: TypeScript compilation through the focused Jest entry after suite movement.
- Done condition: every helper previously defined before the first suite is moved without behavior changes and exported only as needed.

## Step 2: Move the three suites behind the stable entry

- Outcome: retained views, static scene, and playback projection each have a responsibility-owned module; the old path remains the sole Jest entry.
- Files: `test/ui.pixi-board-scene.test.ts`, `test/ui.pixi-board-scene/retained-views.ts`, `test/ui.pixi-board-scene/static-scene.ts`, `test/ui.pixi-board-scene/playback-projection.ts`.
- Dependencies: Step 1.
- Verification: `npx jest --runInBand --runTestsByPath test/ui.pixi-board-scene.test.ts` reports one suite and 40 tests.
- Done condition: all original test names and assertions are present once and the entry contains only the three imports.

## Step 3: Verify adjacent coverage and repository boundaries

- Outcome: the refactor is proven local and behavior preserving.
- Files: no additional source changes expected.
- Dependencies: Step 2 passes.
- Verification:
  - `npx jest --runInBand --runTestsByPath test/ui.pixi-board-scene.test.ts test/ui.pixi-cell-view.test.ts test/ui.pixi-source-trajectory.test.ts`
  - `npm run typecheck`
  - `npm run check:dependency-boundaries`
  - `npm run checkall`
  - `git diff --check`
- Done condition: every command passes and no generated or production diff appears.

## Step 4: Independent review, correction, and delivery

- Outcome: an independent read-only reviewer confirms the final structure preserves coverage and stays within scope.
- Files: task-owned docs and tests only.
- Dependencies: candidate-complete verification from Step 3.
- Verification: review the exact diff, test evidence, file inventory, and final status; rerun affected checks after any correction.
- Done condition: no justified material finding remains, the plan records the review disposition, and the verified task-owned diff is committed.

## Completion checklist

- [ ] Design and plan self-reviews match the implementation.
- [ ] Shared board-scene fixture exists once.
- [ ] Three suites are separated by responsibility.
- [ ] Existing focused path still runs exactly 40 tests in one Jest suite.
- [ ] Adjacent Pixi tests pass.
- [ ] Type checking, dependency checks, `checkall`, and diff checks pass.
- [ ] No production or generated file changed.
- [ ] Independent final review is closed with no unresolved material finding.
- [ ] Final task-owned diff is committed and post-commit status is clean.

## Self-review

The plan originally treated the three suite modules as standalone Jest files. It was revised to make preservation of the existing focused entry an explicit Step 2 done condition. Verification was also expanded beyond the moved suite to include the two adjacent Pixi tests that use similar but intentionally separate fake runtimes. No production browser build is required because this task changes only tests and implementation documentation.

## Final independent review

Pending candidate-complete implementation and verification.

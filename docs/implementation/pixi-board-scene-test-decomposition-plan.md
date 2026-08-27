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
- Verification: `npx jest --runInBand --runTestsByPath test/ui.pixi-board-scene.test.ts` reports one suite and 44 tests.
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
- Done condition: focused, adjacent, type, and dependency checks pass and no generated or production diff appears. A repository-wide failure is acceptable only when it is proven to be an unrelated pre-existing Worker-mirror mismatch and is recorded without generating or staging those assets.

## Step 4: Independent review, correction, and delivery

- Outcome: an independent read-only reviewer confirms the final structure preserves coverage and stays within scope.
- Files: task-owned docs and tests only.
- Dependencies: candidate-complete verification from Step 3.
- Verification: review the exact diff, test evidence, file inventory, and final status; rerun affected checks after any correction.
- Done condition: no justified material finding remains, the plan records the review disposition, and the verified task-owned diff is committed.

## Completion checklist

- [x] Design and plan self-reviews match the implementation.
- [x] Shared board-scene fixture exists once.
- [x] Three suites are separated by responsibility.
- [x] Existing focused path still runs exactly 44 tests in one Jest suite.
- [x] Adjacent Pixi tests pass.
- [x] Type checking and dependency checks pass; `checkall` passed task-relevant checks and stopped only on the recorded unrelated Observer Will Worker-mirror mismatch.
- [x] No production or generated file changed.
- [x] Independent final review is closed with no unresolved material finding.
- [ ] Final task-owned diff is committed; unrelated status is reported separately.

## Self-review

The plan originally treated the three suite modules as standalone Jest files. It was revised to make preservation of the existing focused entry an explicit Step 2 done condition. Verification was also expanded beyond the moved suite to include the two adjacent Pixi tests that use similar but intentionally separate fake runtimes. The first focused run established the exact baseline as 44 executed cases and exposed the moved suite's repository-root lookup, so the plan now treats both as explicit preservation conditions. The repository-wide check later stopped on committed Observer Will assets missing from `worker-public/`; all earlier task-relevant checks passed, and the plan was narrowed to avoid mixing that separate asset/mirror work into this test-only change. No production browser build is required because this task changes only tests and implementation documentation.

## Final independent review

- Reviewer: `/root/pixi_test_refactor_reviewer`, read-only.
- Material findings: none.
- Optional finding: the original clean-status wording conflicted with unrelated Observer Will files created by another task. Accepted and corrected so completion requires the task-owned diff to be committed while unrelated files remain untouched and separately reported.
- Independent evidence: the reviewer compared the original shared setup and all three moved suites, reran the focused entry with one suite and 44 passing cases, confirmed normal Jest discovery still has one entry, and confirmed the staged paths contain only the intended docs/tests.
- Recheck disposition: no code recheck was required after the wording-only correction; staged diff checks and documentation inspection remain required before commit.

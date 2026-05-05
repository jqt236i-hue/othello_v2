## Task 10: Remove orphaned files in worker-public/ (2026-05-05)

**Files deleted (3):**
- \worker-public/game/cards/effects/hyperactive.js\ (root counterpart missing)
- \worker-public/game/logic/context.js\ (root counterpart missing)
- \worker-public/shared/types.d.js\ (root counterpart missing)

**Verification:**
- Root counterparts confirmed absent via \Test-Path\
- Files confirmed deleted from both filesystem and git tracking
- Commit: \2d074a\ — 3 files changed, 216 deletions

**Notes:**
- Used \git rm\ to delete tracked files; no untracked stale files remained
- All deletions were clean with no side effects

## Task 9: Remove temporary files, logs, and screenshots (2026-05-05)

**Files deleted (69 total):**
- **Text files (33):** .tmp-selfplay-runner-test.txt, flip-evidence-minimal.txt, HYPERACTIVE_DUPLICATION_ANALYSIS.txt, network-audit-output.txt, PLACEMENT_ANALYSIS.txt, PLACEMENT_CODE_REFERENCE.txt, PLACEMENT_EXECUTIVE_SUMMARY.txt, PLACEMENT_FLOW_DIAGRAM.txt, task-11-jest-full.txt, task-11-network-parity.txt, task-11-tests-classification.txt, task-4-canonical-counterparts.txt, task-4-game-boundary-check.txt, task-5-browser-commonjs-gate.txt, task-5-browser-smoke-main.txt, task-6-cli-smoke.txt, task-6-require-main-check.txt, task-7-worker-exports.txt, task-7-worker-prepare.txt, task-8-jest.txt, task-8-test-typecheck.txt, test_output.txt, test_run_output.txt, test-output.txt, tmp_pre_fix_regressions.txt, tmp_worker_prepare.txt, trap-output.txt, tsc_errors2.txt, tsc_errors3.txt, tsc_errors4.txt, tsc_output3.txt, tsc_simple_errors.txt, tsc_verify10.txt
- **PNG screenshots (20):** background-restored-public.png, background-skin-modal-public-20260426.png, hand-closeup-after-pass2.png, hand-closeup-before-pass2.png, hand-current.png, hand-isolated-pass2.png, hand-placement-current-full.png, hand-placement-live.png, hand-posed-current.png, hand-posed-pass1.png, hand-preview-current.png, hand-preview-pass2-filled.png, hand-preview-pass2.png, hand-v3-check.png, hand-v3.png, hand-v4-lean.png, playwright-boot-test.png, public-background-room-create-verified.png, public-observation-desk-no-bars-verified.png, public-observation-desk-svg-verified.png
- **JSON analysis (5):** analysis-output.json, selfplay_analysis_summary.json, selfplay_analysis.ndjson.summary.json, selfplay_card_analysis.json, test-results.json
- **Ad-hoc scripts (3):** check_module_registry.js, fix_module_registry.js, fix_registry_properly.js
- **Log files (3, gitignored):** bundle-check.log, server.log, server-err.log
- **Other (5):** 1045, 221451, 4368, UTF8, page-snapshot.yml

**Preserved:** package.json, tsconfig.json, tsconfig.test.json, .gitignore, all .md documentation files, opencode.json, wrangler.toml, and all project source files.

**Verification:**
- git status shows 66 staged deletions (tracked files via git rm)
- 3 gitignored log files deleted via Remove-Item
- No unintended deletions

**Notes:**
- All root .txt, .png, .json analysis, ad-hoc .js scripts correctly identified and deleted
- Numeric-only filenames (1045, 4368, 221451) and UTF8 file also removed
- Plan files (.sisyphus/plans/) separately modified (not part of this change)

## Task 8: Remove root JS bridge files with TS counterparts (2026-05-05)

**Files deleted (10 of 11 planned):**
- `analyze-crystal-stone-quiet.js` → `analyze-crystal-stone-quiet.ts` preserved
- `analyze-crystal-stone.js` → `analyze-crystal-stone.ts` preserved
- `analyze-destroy-cycle.js` → `analyze-destroy-cycle.ts` preserved
- `analyze-selfplay-moves.js` → `analyze-selfplay-moves.ts` preserved
- `analyze-trap-will.js` → `analyze-trap-will.ts` preserved
- `card-system.js` → `card-system.ts` preserved
- `game-events.js` → `game-events.ts` preserved
- `is-env-capable.js` → `is-env-capable.ts` preserved
- `sound-engine.js` → `sound-engine.ts` preserved
- `ui.js` → `ui.ts` preserved

**File kept (1):** `shared-constants.js` — referenced directly by `story-deck-lab.html` (and `worker-public/story-deck-lab.html`)

**Reason for keeping:**
- Per MUST NOT rule: "Do NOT delete if HTML files reference the .js version directly"
- `story-deck-lab.html` line 75: `<script src="shared-constants.js"></script>` references the root file
- The test `story-deck-lab.page.test.js` explicitly checks for this tag in the HTML
- The root `shared-constants.js` is a 3-line bridge to `dist/shared-constants.js`; deleting it would break both the HTML and the test

**Nature of deleted files:**
All 10 deleted files were bridge/wrapper files (1-3 lines) that re-export from `dist/<name>`. They exist for CommonJS `require()` compatibility. Their `.ts` counterparts are the actual source truth, compiled to `dist/`.

**Verification:**
- All 11 `.ts` files confirmed present
- Preserved files confirmed: `entry-browser.js`, `entry-browser-classic.js`, `entry-browser-augmented.js`, `ui/layout-stage.js`
- `shared-constants.js` confirmed present
- All 10 `.js` files confirmed deleted from both filesystem and git staging
- git status shows `D` for all 10 files

**Pre-existing issue found:**
`npm run build:ts` fails with TS1185 merge conflict markers across many `game/` TS files (`effect-resolver.ts`, `selectors.ts`, `target-resolver.ts`, `game-core-logic.ts`, `pending-coordinator.ts`, etc.). This is unrelated to Task 8 - the errors are in game logic files, not in the root bridge files we deleted.

## Task 11: Fix merge conflict markers in TypeScript files (2026-05-05)

**Summary:** Removed all merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) from 19 TypeScript files that were introduced during repository cleanup.

**Pattern of conflicts:**
- **Simple import conflicts (7 files):** `effect-resolver.ts`, `selectors.ts`, `network-turn-handoff.ts`, `move-generator.ts`, `move-executor.ts`, `game-controller-slim.ts`, `turn_pipeline_phase_helpers.ts` — Updated upstream had dist/ reference imports vs Stashed changes had clean imports. Chose Stashed changes (clean imports) per task instructions.
- **Type annotation conflicts (5 files):** `target-resolver.ts`, `pending-coordinator.ts`, `game-core-logic.ts`, `turn_pipeline_phases.ts`, `move-executor-visuals.ts` — Updated upstream had `any`/no type annotations vs Stashed changes had proper types (`number`, `string` return types, etc.). Chose Stashed changes (proper types).
- **`any` vs `Record<string, unknown>` (4 files):** `breeding.ts`, `lightning.ts`, `destroy_dragon.ts`, `work_will.ts` — Updated upstream had `declare const foo: any` with comment vs Stashed changes had `Record<string, unknown>`. Chose Stashed changes.
- **Template vs function (2 files):** `sniper.ts`, `utils.ts` — Updated upstream had template-based code (IIFE with declared template variables) vs Stashed changes had proper function implementations. Chose Stashed changes.
- **Module scope (1 file):** `regen.ts` — Two conflicts: `self : {}` vs `self : this` (chose `this`), and `Array<{row; col}>` type annotation removed (had to re-add to fix TS7034 implicit any[]).

**Additional fixes during typecheck:**
- Removed duplicate `declare` blocks in `game-core-logic.ts` (lines 2-7) and `move-executor-visuals.ts` (lines 2/6) to resolve TS2300 errors
- Added `: any` return type to `cloneDeferredPendingSelectionValue` in `turn_pipeline_phases.ts` to fix TS7023 implicit return type
- Changed `sniper.ts` export from `declare const` to `Record<string, any>` to match runtime JS module shape
- Dist directory needed cleaning to resolve pre-existing TS5055 errors

**Verification:**
- `npm run typecheck` — exit code 0 (clean)
- `npm run build:ts` — exit code 0 (after dist clean)
- Zero merge conflict markers remain across all TypeScript files
- 19 files modified (all conflicts), 2 additional files cleaned (duplicate declarations)

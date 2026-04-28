# Complete Phase 8 TypeScript Migration Plan

## Goal
Finish the remaining JavaScript-to-TypeScript migration while preserving current behavior, keeping generated/mirror outputs out of source-of-truth edits, and leaving the repository in a verifiable, committed state.

## Current Baseline
- Working tree has 236 changed paths from recent migration batches.
- `npm run checkall` passes.
- Source-side TypeScript errors are 0.
- `npx tsc --noEmit` still reports existing test-side type errors; treat those as a separate follow-up unless they block source migration.
- Remaining real non-test JS files >10 lines after exclusions: 164.
- Exclusions used for migration counting: `node_modules`, `dist`, `worker-public`, `.restored`, `.generated`, `.venv`, `.wrangler`, `tmp`, `test`, `coverage`.

## Non-Negotiable Guardrails
- Do not change gameplay behavior or UI behavior.
- Do not update `01-rulebook.md`; this is a format/refactor migration only. If behavior changes become necessary, stop and update the rulebook first.
- Do not edit `worker-public/` directly. If root changes require mirror sync, run `npm run worker:prepare`.
- Do not add external dependencies.
- Do not delete tests to make checks pass.
- Do not suppress new source errors with `as any` or `@ts-ignore`; legacy/global-heavy files may keep `// @ts-nocheck` only as part of the established migration pattern.
- Do not commit generated or cache artifacts such as `__pycache__`, `.venv`, `.wrangler`, coverage output, or ad-hoc temporary files.

## Completion Criteria
- All non-test, non-generated, non-mirror JS files with >10 lines are either:
  1. converted to `.ts` with an equivalent source module, or
  2. intentionally removed as unreferenced temporary migration helper scripts, or
  3. explicitly documented as intentionally retained JS with reason.
- Remaining JS files are only wrappers, generated files, mirror files, tests, coverage/vendor output, or documented exceptions.
- `npm run checkall` passes.
- Source-side `npx tsc --noEmit` errors are 0; test-side pre-existing errors may remain and must be listed.
- Related changed files are committed in one or more coherent commits.
- Final report includes: changed layers, remaining JS count, verification output, and `01-rulebook.md` update status.

## Phase 1 — Commit Current Safe Baseline
- [ ] Re-run `git status --short` and inspect staged/untracked files.
- [ ] Exclude generated/cache/temporary artifacts from staging (`__pycache__`, coverage, `.wrangler`, `.venv`, ad-hoc scripts if not intentionally retained).
- [ ] Run `npm run checkall`.
- [ ] Run `npx tsc --noEmit` and count source-side errors separately from test-side errors.
- [ ] Commit current migration work with a concise Phase 8 message.

## Phase 2 — Classify the 164 Remaining Real JS Files
- [ ] Generate a fresh list of remaining JS files using the agreed exclusions.
- [ ] Classify each remaining file into one of:
  - real source module
  - duplicate accidental nested path (`game/game/...`, `game/cards/game/...`, `game/logic/game/...`)
  - temporary migration helper (`convert-*`, `fix-*`, `cleanup-*`, `add-ts-nocheck*`, `verify-*`, `classify-files`)
  - intentionally retained JS exception
- [ ] For temporary helpers, search references in `package.json`, scripts, tests, and source before deleting.
- [ ] For duplicate nested paths, verify whether they are referenced. If unreferenced, delete; if referenced, convert/wrap consistently.

## Phase 3 — Convert Remaining Real Source Files
- [ ] For every real source `.js` file without a `.ts` counterpart, create a TypeScript source file preserving behavior.
- [ ] For every real source `.js` file with a complete `.ts` counterpart, replace `.js` with the correct dist wrapper.
- [ ] Use established migration pattern:
  - `// @ts-nocheck` for legacy/global-heavy files where needed.
  - `declare const __non_webpack_require__: NodeRequire | undefined;` where require compatibility is needed.
  - `_require` helper for runtime requires.
  - path-correct `import type { CardState, GameState, PlayerKey } from ...` where useful.
  - CommonJS-compatible `export = ...` unless the existing file is ESM.
- [ ] Keep wrapper paths relative and correct for root, nested directories, and scripts.

## Phase 4 — Remove Temporary Migration Artifacts
- [ ] Delete unreferenced ad-hoc migration scripts in root and `scripts/`.
- [ ] Delete corresponding temporary `.ts` artifacts if they were created only to convert the migration helper itself.
- [ ] Ensure `package.json` scripts do not reference deleted helpers.
- [ ] Re-run remaining JS count after cleanup.

## Phase 5 — Validate and Fix Only Migration-Caused Issues
- [ ] Run `npm run checkall`.
- [ ] Run `npx tsc --noEmit` and filter source-side errors.
- [ ] Fix any source-side errors caused by this migration.
- [ ] If only test-side pre-existing errors remain, record representative examples and continue.
- [ ] If root-to-worker mirror content changed, run `npm run worker:prepare` and include mirror updates.

## Phase 6 — Final Commit and Report
- [ ] Commit final migration batch.
- [ ] Report final JS/TS counts and remaining real JS files >10 lines.
- [ ] Report verification results.
- [ ] State that `01-rulebook.md` was not updated because behavior did not change.
- [ ] List any documented JS exceptions or test-side type debt left for follow-up.

## Execution Notes
- Prefer smaller commits if verification breaks; otherwise one baseline commit and one final migration commit are sufficient.
- If a file is ambiguous between real source and temporary artifact, keep it and document it instead of deleting.
- If a wrapper breaks browser/eval tests, update tests to read the `.ts` source or the compiled dist output deliberately.

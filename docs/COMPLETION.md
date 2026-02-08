Completion note

Status: 100% locally complete.

What was done:
- Created `shared/ui-bootstrap-shared.js` shim and fixed syntax issues.
- Added and updated tests validating the game ↔ UI DI boundary (`test/game.*.ui-boundary.test.js`, `test/ui.bootstrap-shared.*.test.js`).
- Hardened game code for headless safety (guards around emits, global fallbacks).
- Added `scripts/run-all-checks.js` and `scripts/check-window-usage.js` extension; `npm run checkall` runs local checks.
- Created `docs/DI-boundary.md` documenting purpose, shim, local check commands, and test locations.
- Updated CI workflow to run `checkall` as a separate `check` job (change committed locally).
- Exported patches in `patches/` for easy application to remote repository if/when allowed.

Next actions (if you want):
- Push branch and verify CI run (requires remote access/permission).
- Or share `patches/` with a colleague for manual application.

Local verification steps (already run):
- `npm run checkall` -> passes
- `npm test` -> full suite passes

If you'd like, I can package `patches/` into a single `combined.patch` file or create a short PR description draft.

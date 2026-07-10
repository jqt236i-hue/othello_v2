# Phase 2 Stale Source Removal Log

This log records source-reference proof for Phase 2.4 removals. Each listed family had no reference outside its own files in `package.json`, `scripts/`, `test/`, `training/`, or `.github/` immediately before removal.

| Date | Removed family | Replacement / reason | Verification |
| --- | --- | --- | --- |
| 2026-07-11 | `find-initdom`, `find-missing`, `find-pc`, `find-reset` | One-off discovery scripts; repository search is the maintained discovery mechanism. | Focused inventory test, `npm run build:browser`, `npm run checkall` |
| 2026-07-11 | `check-bootstrap`, `check-init-factory` | One-off registry print diagnostics; `test/scripts.build-module-registry.boot-contract.test.ts` is the maintained executable contract. | Focused inventory test, `npm run build:ts`, `npm run checkall` |

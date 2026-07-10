# Phase 2 Stale Source Removal Log

This log records source-reference proof for Phase 2.4 removals. Each listed family had no reference outside its own files in `package.json`, `scripts/`, `test/`, `training/`, or `.github/` immediately before removal.

| Date | Removed family | Replacement / reason | Verification |
| --- | --- | --- | --- |
| 2026-07-11 | `find-initdom`, `find-missing`, `find-pc`, `find-reset` | One-off discovery scripts; repository search is the maintained discovery mechanism. | Focused inventory test, `npm run build:browser`, `npm run checkall` |
| 2026-07-11 | `check-bootstrap`, `check-init-factory` | One-off registry print diagnostics; `test/scripts.build-module-registry.boot-contract.test.ts` is the maintained executable contract. | Focused inventory test, `npm run build:ts`, `npm run checkall` |
| 2026-07-11 | `check-registry-content`, `check-registry-content2`, `check-registry-dups`, `check-registry-dups2`, `list-registry`, `validate-new`, `validate-registry`, `validate-single` | One-off registry print and ad-hoc parser diagnostics; maintained registry generation and boot-contract tests supersede them. | Focused inventory and registry-contract tests, `npm run build:ts`, `npm run checkall` |
| 2026-07-11 | `add-module-tracking`, `clean-dist-require`, `convert-ui-to-ts`, `dedup-require`, `remove-fn-require`, `remove-local-require` | One-off migration mutators that directly rewrote generated output or boot code; maintained TypeScript build and browser registry generator are the only supported mutation path. | Focused inventory and registry-contract tests, `npm run build:ts`, `npm run checkall` |
| 2026-07-11 | `cross-ref-scripts`, `debug-single`, `debug-single2`, `test-json` | One-off HTML/registry debug prints; maintained browser-build synchronization and registry boot-contract tests supersede them. | Focused inventory and registry-contract tests, `npm run build:ts`, `npm run checkall` |
| 2026-07-11 | duplicate `.omo/` and `.sisyphus/` historical work logs | Neither directory was referenced by source or tooling. Their 190-file manifests matched exactly by relative path, byte length, and SHA-256, so the duplicate historical logs were removed. | Source-reference search and full manifest hash comparison before deletion |
| 2026-07-11 | recurrence guard | The inventory test now rejects compiled CommonJS boilerplate in TypeScript and any direct-output mutator without an active source/package/test/CI reference or a named maintenance reason. | Focused inventory test, `npm run build:ts`, `npm run checkall` |

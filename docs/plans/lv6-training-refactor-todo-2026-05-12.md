# Lv6 Training Refactor TODO

Generated: 2026-05-12
Branch: codex/refactor-lv6-training-seed-bank

## Scope

Lv6 CPU training and promotion pipeline refactoring. Behavior should remain unchanged unless a separate rulebook-backed change requests a training policy change.

## TODO

- [x] Extract seed bank plan/build logic from profile resolution and launcher startup.
- [x] Extract shared Lv6 teacher profile to train-cycle CLI argument conversion.
- [x] Consolidate ONNX trainer command argument construction in `training-cycle-command-builders`.
- [x] Add a profile preset merge hook so repeated profile fragments can be introduced without changing launcher code again.
- [x] Centralize policy gate payload header construction.
- [x] Start splitting `run-selfplay-training-cycle.ts` by moving step-order ownership to a dedicated module.
- [x] Move trainer artifact path logging into `onnx_trainer_common.py`.

## Follow-Up Slices

- [ ] Move training-cycle argument parsing/defaults into a dedicated module.
- [ ] Move iteration orchestration and step execution state into a dedicated module.
- [ ] Convert duplicated `browser_lv6_*` YAML blocks to explicit preset refs after adding fixture tests for preset merge order.
- [ ] Extend policy gate payload helpers to ONNX gate output after confirming its current payload contract.
- [ ] Continue Python trainer commonization around checkpoint writing and metadata summaries.

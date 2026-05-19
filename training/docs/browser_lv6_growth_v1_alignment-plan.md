## browser_lv6_growth_v1 alignment plan

### Diagnosis

- `quick` was using a single seed, so it could pass on a favorable seed while the quality gate failed on another seed with `source-strength`.
- `target head` was being retrained every iteration even though this lane promotes on table strength, not pending-target quality.
- The target specialist is runtime-relevant for browser Lv6, but this lane had no dedicated target-head gate, so noisy target updates could be promoted without direct validation.

### Fix

1. Freeze the pending-target specialist in this lane.
   - Add an explicit `--no-train-target-head` lane option.
   - Skip target training, target checkpoint carry-over, and target bundle promotion when disabled.
   - Keep the existing deployed target ONNX untouched instead of replacing it with weak per-iteration candidates.

2. Make gate decisions less seed-fragile.
   - Change `quick` from `40 games x 1 seed` to `24 games x 3 seeds`.
   - Change `quality gate` from `40 games x 1 seed` to `24 games x 3 seeds`.
   - Require `2/3` seed passes for both quick and quality checks.

### Completion criteria

- Profile resolution shows `--no-train-target-head` and the updated multi-seed gate settings.
- Training-cycle tests cover disabled target-head packaging/carry-over behavior.
- The next run starts with the new settings reflected in `config.resolved.json` and `launcher.log`.

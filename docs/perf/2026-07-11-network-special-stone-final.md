# Network Special-Stone Final Performance Report

Baseline commit: `62b170a1289a4a2fffca49d84dc58fd2e0fee948`
After commits: `f3f2be991436b03c07e45a291c54defc65a9c9ee`, `f3f2be991436b03c07e45a291c54defc65a9c9ee`

## Timing gates

| gate | run | baseline ms | after ms | ratio | result |
|---|---:|---:|---:|---:|---:|
| protection context median | 1 | 0.0265 | 0.0045 | 17.0% | PASS |
| protection context median | 2 | 0.0265 | 0.0061 | 23.0% | PASS |
| legal moves median | 1 | 0.034 | 0.0124 | 36.5% | PASS |
| legal moves median | 2 | 0.034 | 0.02 | 58.8% | PASS |
| board projection median | 1 | 0.2 | 0.1 | 50.0% | PASS |
| board projection median | 2 | 0.2 | 0.1 | 50.0% | PASS |
| publish preparation median | 1 | 2.1599 | 1.5846 | 73.4% | PASS |
| publish preparation median | 2 | 2.1599 | 1.6516 | 76.5% | PASS |
| client apply + render preparation median | 1 | 0.4 | 0.3 | 75.0% | PASS |
| client apply + render preparation median | 2 | 0.4 | 0.3 | 75.0% | PASS |

## Baseline-light p95 regression gates

| metric | run | ratio | result |
|---|---:|---:|---:|
| protectionContext | 1 | 50.8% | PASS |
| protectionContext | 2 | 82.5% | PASS |
| legalMoves | 1 | 39.3% | PASS |
| legalMoves | 2 | 79.5% | PASS |
| boardProjection | 1 | 66.7% | PASS |
| boardProjection | 2 | 66.7% | PASS |
| publishPreparation | 1 | 61.4% | PASS |
| publishPreparation | 2 | 100.6% | PASS |
| clientSnapshotApplyAndRenderPreparation | 1 | 83.3% | PASS |
| clientSnapshotApplyAndRenderPreparation | 2 | 83.3% | PASS |

## Deterministic gates

| gate | run 1 | run 2 | result |
|---|---:|---:|---:|
| nested full marker scans = 0 | 0 | 0 | PASS |
| flip context compiles / legal moves = 1 | 1 | 1 | PASS |
| viewer projections = 1 each | 1/1/1 | 1/1/1 | PASS |
| accepted publish persists = 1 | 1 | 1 | PASS |
| render snapshot full clones = 0 | 0 | 0 | PASS |
| payload/playback/digest parity | exact | exact | PASS |

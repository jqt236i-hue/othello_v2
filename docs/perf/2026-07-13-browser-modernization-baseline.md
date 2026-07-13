# Browser modernization baseline (2026-07-13)

- Status: active pre-migration comparison baseline
- Commit: `af1850f4a2bac3f730d2a2bc0206b5228f5e3340`
- Captured at: 2026-07-13T12:28:17.136Z
- Node: v24.12.0
- Scope: classic browser boot, deterministic CPU action fixtures, current visual/presentation sources, and existing authority/presentation verification contracts

## Boot/resource sample

| metric | value |
| --- | ---: |
| startup registry | 7904221 bytes |
| optional registry | 323840 bytes |
| required modules | 599 |
| optional modules | 33 |
| network overlay ready | 1238 ms |
| optional registry at startup | false |
| ONNX runtime at startup | false |

The timing value is machine-specific. Exact resource-presence flags and module/registry counts are correctness baselines; later timing comparisons must be sampled on the same machine.

## Deterministic CPU fixtures

| fixture | action | digest |
| --- | --- | --- |
| level3_heuristic_move | move (0,0) | `b590bf6f03e0930995b30bf9b9ef8b311ebd19f2b69499f729cd320c761486bd` |
| level6_heuristic_move | move (0,0) | `b590bf6f03e0930995b30bf9b9ef8b311ebd19f2b69499f729cd320c761486bd` |
| no_move_use_card | card guard_will | `9060ad138a36a15b3b4e8fc904f8c0b1591ed32d33bceca279d7511de7a53139` |
| no_move_pass | pass | `393c7b8bb7c831399f5614224c506545c97e1d246209ac4b55386f17f66edf40` |

Candidate score digest: `af20344345f7eacb3b2783f4f8132637bcde64e3fff3f8cca686d4cb0feb85a0`

## Screen/presentation baseline

- Visual board baseline: `tests/visual-regression/baseline-board.png`
- Visual SHA-256: `66e848b37b311e1d37ebcc340653a2c80a0458ad6d37439d635deb16e4050b75`
- Presentation source digest: `a7230ebf17683f7381200453b405f605bb86167e4b92408af32d0936005e00d9`
- Required initial/optional screen IDs are recorded in the JSON report.

## Verification contracts

- `npx jest --runInBand --runTestsByPath test/game.cpu-decision-action.test.ts test/cpu.compute.test.ts test/determinism.test.ts test/match-runtime-parity.test.ts`
- `npx jest --runInBand --runTestsByPath test/ui.animation-engine.test.ts test/ui.animation-feedback-events.sound-keys.test.ts test/network.playback-event-assembly.contract.test.ts`
- `npm run match:boot-performance-check`
- `npm run match:ui-control-smoke`
- `npm run test:visual`
- `npm run test:network:parity`

## Baseline verification run

- Focused CPU/determinism/presentation bundle: pass (9 suites, 69 tests).
- Browser UI-control smoke: pass; six major controls opened, with 0 page and console errors.
- Visual regression: initial stale-size failure (372×372 baseline vs 368×368 current), intentional current-fixture promotion, then pass with 0 differing pixels.
- Network authority/parity: pass (34 suites, 522 tests).
- Jest reported its existing post-run open-handle warning after the passing focused and network bundles; no suite failed.

The first visual run found that the tracked 372×372 image no longer represented the current 368×368 deterministic fixture. The current fixture was reviewed and intentionally promoted; the immediate normal rerun produced 0 differing pixels. This is a baseline repair, not a product UI change made by the modernization program.

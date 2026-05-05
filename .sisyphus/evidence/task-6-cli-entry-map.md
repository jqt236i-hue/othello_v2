# Task 6 CLI Entry Map

- Generated: 2026-04-30
- Sources read: `package.json` scripts, `.sisyphus/evidence/task-3-package-scripts.json`, `.sisyphus/evidence/task-3-import-entrypoints.json`, `.sisyphus/evidence/task-3-browser-entrypoints.json`, `.sisyphus/evidence/task-1-entrypoint-contracts.txt`.
- Scope: package scripts that run a `.js` file through `node`, including repeated targets inside chained commands.
- Important rule: a root `.js` file that only does `module.exports = require("../dist/...")` does not make `require.main === module` true inside the dist file. If the dist file gates its CLI work behind `require.main === module`, the root shim is inert for direct `node scripts/foo.js` usage.

## Classification Meanings

- `keep node-cli-adapter`: keep or standardize a root `scripts/*.js` adapter that explicitly preserves direct `node scripts/foo.js` CLI behavior, usually by spawning `node dist/...` or calling an exported `main()`.
- `switch-to-dist`: migrate the package script to call `node dist/...` directly. This is safe when the dist file exists and direct dist execution is the intended CLI entrypoint.
- `convert-to-ts`: retain the CLI contract, but migrate the remaining JS-only source entrypoint to TypeScript instead of treating it as a require-dist shim.

## Summary

| Classification | Unique targets | Reason |
|---|---:|---|
| `keep node-cli-adapter` | 2 | Existing adapters preserve root CLI behavior that a pure require shim would break. |
| `switch-to-dist` | 27 | Existing root shims are inert, broken, or redundant; direct dist execution is the clean migration path. |
| `convert-to-ts` | 2 | JS-only runtime scripts have no TS twin and should remain source entrypoints until converted. |

## Entrypoint Map

| Package script(s) | Current node target | Current root file shape | Dist CLI guard | Direct `node target` behavior | Classification | Proposed action |
|---|---|---|---|---|---|---|
| `serve` | `scripts/serve-with-fallback.js` | Node CLI adapter: imports dist API, adds default `worker-public`, then spawns `node dist/scripts/serve-with-fallback.js`. | Yes | Executes correctly through the adapter; Task 1 evidence records `--help` and live HTTP 200 verification. | `keep node-cli-adapter` | Keep this adapter. Do not replace it with a pure require shim because the dist guard would otherwise be bypassed and the default root behavior belongs in the adapter. |
| `match:server`, `match:server:net` | `scripts/local-match-server.js` | Pure require-dist shim: `module.exports = require("../dist/scripts/local-match-server")`. | Yes | Inert as `node scripts/local-match-server.js`; the dist `require.main` guard does not fire when required by the shim. | `switch-to-dist` | Replace package invocations with `node dist/scripts/local-match-server.js ...` in a later package migration. |
| `match:check` | `scripts/match-network-smoke.js` | Pure require-dist shim. | No | Executes only because the dist file has top-level CLI work; the root shim adds no value. | `switch-to-dist` | Replace with `node dist/scripts/match-network-smoke.js`. |
| `worker:prepare` | `scripts/prepare-worker-assets.js` | Pure require-dist shim. | Yes | Inert as `node scripts/prepare-worker-assets.js`; the dist `require.main` guard does not fire. | `switch-to-dist` | Replace with `node dist/scripts/prepare-worker-assets.js`. `worker:dev` and `worker:deploy` inherit this through `npm run worker:prepare`. |
| `llm:download:nemotron` | `scripts/download-nemotron-gguf.js` | Dynamic require-dist shim using `path.join(__dirname, "..", "..", "dist", ...)`. | No | Broken before CLI execution: from `scripts/`, that path resolves outside the repo to `../dist/scripts/download-nemotron-gguf.js`. The repo dist file itself has top-level `main().catch(...)`. | `switch-to-dist` | Replace with `node dist/scripts/download-nemotron-gguf.js`. |
| `llm:commentary:server` | `scripts/local-cpu-commentary-server.js` | Dynamic require-dist shim using `..`, `..`, `dist`. | No | Broken before CLI execution for the same out-of-repo `../dist/...` target. The repo dist file starts the HTTP server at top level. | `switch-to-dist` | Replace with `node dist/scripts/local-cpu-commentary-server.js`. |
| `check:window` | `scripts/check-window-usage.js` | Pure require-dist shim. | No | Executes because dist has top-level check code; the shim is redundant. | `switch-to-dist` | Replace with `node dist/scripts/check-window-usage.js`. |
| `selfplay:generate` | `scripts/generate-selfplay-data.js` | Node CLI adapter: requires dist, exports it, and calls `generateSelfplayData.main()` under the root `require.main` guard. | Yes | Executes correctly through the adapter. | `keep node-cli-adapter` | Keep the adapter unless the package script is later switched to direct dist. This is the correct pattern when retaining `node scripts/...`. |
| `selfplay:generate:parallel` | `scripts/generate-selfplay-data-parallel.js` | Pure require-dist shim. | Yes | Inert as root shim; dist guard does not fire. | `switch-to-dist` | Replace with `node dist/scripts/generate-selfplay-data-parallel.js`. |
| `selfplay:benchmark` | `scripts/benchmark-selfplay-policy.js` | Pure require-dist shim. | Yes | Inert as root shim; dist guard does not fire. | `switch-to-dist` | Replace with `node dist/scripts/benchmark-selfplay-policy.js`. |
| `selfplay:adoption-check` | `scripts/benchmark-policy-adoption.js` | Pure require-dist shim. | Yes | Inert as root shim; dist guard does not fire. | `switch-to-dist` | Replace with `node dist/scripts/benchmark-policy-adoption.js`. |
| `selfplay:onnx-gate` | `scripts/benchmark-policy-onnx-gate.js` | Pure require-dist shim. | Yes | Inert as root shim; dist guard does not fire. | `switch-to-dist` | Replace with `node dist/scripts/benchmark-policy-onnx-gate.js`. |
| `selfplay:promote-model` | `scripts/promote-policy-model.js` | Pure require-dist shim. | Yes | Inert as root shim; dist guard does not fire. | `switch-to-dist` | Replace with `node dist/scripts/promote-policy-model.js`. |
| `selfplay:clean-artifacts`, first step of `selfplay:prepare-foundation`, first step of `selfplay:prepare-foundation:deepcfr` | `scripts/clean-selfplay-artifacts.js` | Dynamic require-dist shim using `..`, `..`, `dist`. | Yes | Broken before CLI execution because the dynamic path points outside the repo. | `switch-to-dist` | Replace each invocation with `node dist/scripts/clean-selfplay-artifacts.js ...`. |
| `selfplay:preflight`, second step of `selfplay:prepare-foundation` | `scripts/preflight-selfplay-training.js` | Dynamic require-dist shim using `path.join(__dirname, "../dist", ...)`, which resolves to repo `dist`. | Yes | Inert as root shim; the dist `require.main` guard does not fire. | `switch-to-dist` | Replace each invocation with `node dist/scripts/preflight-selfplay-training.js ...`. |
| `selfplay:init-foundation:deepcfr`, second step of `selfplay:prepare-foundation:deepcfr` | `scripts/init-deepcfr-foundation.js` | Dynamic require-dist shim using `..`, `..`, `dist`. | Yes | Broken before CLI execution because the dynamic path points outside the repo. | `switch-to-dist` | Replace each invocation with `node dist/scripts/init-deepcfr-foundation.js`. |
| `selfplay:preflight:deepcfr`, third step of `selfplay:prepare-foundation:deepcfr` | `scripts/preflight-deepcfr-training.js` | Dynamic require-dist shim using `..`, `..`, `dist`. | Yes | Broken before CLI execution because the dynamic path points outside the repo. | `switch-to-dist` | Replace each invocation with `node dist/scripts/preflight-deepcfr-training.js ...`. |
| `selfplay:resolve-profile` | `scripts/resolve-training-profile.js` | Pure require-dist shim. | Yes | Inert as root shim; dist guard does not fire. | `switch-to-dist` | Replace with `node dist/scripts/resolve-training-profile.js`. |
| `selfplay:train-profile`, `selfplay:train-profile:production`, `selfplay:train-profile:production:v3`, `selfplay:foundation-bootstrap`, `selfplay:mine-hardcases`, `selfplay:retrain-hardcases` | `scripts/run-selfplay-training-profile.js` | Pure require-dist shim. | Yes | Inert as root shim; dist guard does not fire. | `switch-to-dist` | Replace each invocation with `node dist/scripts/run-selfplay-training-profile.js ...`. |
| `selfplay:monitor` | `scripts/monitor-selfplay-training-run.js` | Pure require-dist shim. | Yes | Inert as root shim; dist guard does not fire. | `switch-to-dist` | Replace with `node dist/scripts/monitor-selfplay-training-run.js`. |
| `selfplay:train-preset:cards` | `scripts/run-selfplay-training-preset.js` | Pure require-dist shim. | Yes | Inert as root shim; dist guard does not fire. | `switch-to-dist` | Replace with `node dist/scripts/run-selfplay-training-preset.js --profile cards_v1`. |
| `selfplay:export-teacher` | `scripts/export-teacher-solutions.js` | Pure require-dist shim. | Yes | Inert as root shim; dist guard does not fire. | `switch-to-dist` | Replace with `node dist/scripts/export-teacher-solutions.js`. |
| `selfplay:train-cycle` | `scripts/run-selfplay-training-cycle.js` | Pure require-dist shim. | Yes | Inert as root shim; dist guard does not fire. | `switch-to-dist` | Replace with `node dist/scripts/run-selfplay-training-cycle.js`. |
| `generate:catalog` | `scripts/generate-catalog.js` | Pure require-dist shim. | Yes | Inert as root shim; dist guard does not fire, so catalog files are not generated. | `switch-to-dist` | Replace with `node dist/scripts/generate-catalog.js`. |
| `generate:observation-gacha-catalog`, `generate:gacha-hand-catalog` | `scripts/generate-observation-gacha-catalog.js` | Dynamic require-dist shim using `..`, `..`, `dist`. | Yes | Broken before CLI execution because the dynamic path points outside the repo. | `switch-to-dist` | Replace both package scripts with `node dist/scripts/generate-observation-gacha-catalog.js`. |
| `generate:asset-manifest` | `scripts/generate-asset-manifest.js` | Pure require-dist shim. | Yes | Inert as root shim; dist guard does not fire. | `switch-to-dist` | Replace with `node dist/scripts/generate-asset-manifest.js`. |
| `test:visual` | `tests/visual-regression/run-visual-check.js` | JS-only source script with an async IIFE. | Not applicable | Executes directly today as source JS. | `convert-to-ts` | Convert this source CLI to TS later, preserving the direct test command contract. It is not a dist shim. |
| `test:browser:smoke` | `scripts/browser-boot-smoke.js` | JS-only source script with direct async test flow. | Not applicable | Executes directly today as source JS. | `convert-to-ts` | Convert this source CLI to TS later, preserving the direct smoke-test behavior. It is not a dist shim. |
| `checkall` | `scripts/run-all-checks.js` | Pure require-dist shim. | No | Executes because dist has top-level check orchestration; the shim is redundant. | `switch-to-dist` | Replace with `node dist/scripts/run-all-checks.js`. `pretest` inherits this through `npm run checkall`. |

## Transitive Package Scripts

| Package script | Relationship | Migration note |
|---|---|---|
| `worker:dev` | Runs `npm run worker:prepare && npx wrangler dev`. | Not a direct `node ... .js` script, but it inherits the `worker:prepare` migration to `node dist/scripts/prepare-worker-assets.js`. |
| `worker:deploy` | Runs `npm run worker:prepare && npx wrangler deploy`. | Same inherited `worker:prepare` migration. |
| `pretest` | Runs `npm run checkall`. | Inherits the `checkall` migration to direct dist. |
| `test`, `test:quick` | Run Jest through npm aliases. | No `node ... .js` target to classify here. |

## High-Risk Current Shims

- Inert pure shims with guarded dist CLIs: `local-match-server`, `prepare-worker-assets`, `generate-selfplay-data-parallel`, `benchmark-selfplay-policy`, `benchmark-policy-adoption`, `benchmark-policy-onnx-gate`, `promote-policy-model`, `resolve-training-profile`, `run-selfplay-training-profile`, `monitor-selfplay-training-run`, `run-selfplay-training-preset`, `export-teacher-solutions`, `run-selfplay-training-cycle`, `generate-catalog`, `generate-asset-manifest`.
- Dynamic shims that currently resolve outside the repo: `download-nemotron-gguf`, `local-cpu-commentary-server`, `clean-selfplay-artifacts`, `init-deepcfr-foundation`, `preflight-deepcfr-training`, `generate-observation-gacha-catalog`.
- Dynamic shim with a valid repo dist path but inert guarded CLI: `preflight-selfplay-training`.

## Verification Notes

- Extracted every `node ... .js` occurrence from `package.json`; found 41 node invocations across 31 unique target files.
- Checked each root target for pure require-dist shims, dynamic path shims, TS twins, and dist file existence.
- Checked each dist target for `require.main === module` guards or top-level CLI execution.
- Ran the existing `node scripts/test-shim-forwarding.js` smoke check; it printed `calls.length= 1 last= { testKey: 'value' }`.
- Did not run long-running servers, downloads, selfplay training, destructive artifact cleanup, or catalog generators while classifying; those behaviors were verified statically from entrypoint structure to avoid side effects.

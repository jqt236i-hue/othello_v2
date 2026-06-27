## 2026-04-29 Build blocker note
- `npm run build:ts` fails with TS5055 because TypeScript is trying to emit into paths that already exist as inputs/legacy artifacts under `dist/`-style nested folders.
- Likely source: duplicate nested paths such as `game/cards/game/cards/...` and `game/logic/game/logic/...` are still present in the source tree and/or mirrored outputs, making the compiler emit over existing files.
- Need to inspect these duplicate directories before changing tsconfig broadly.
- Current baseline capture did not reproduce the older serve no-op or worker export failure; the local environment now shows a live `worker-public` server and a recognized `MatchRoomDurableObject` binding.

## 2026-04-30 Task 5 command-selection note
- `scripts/run-all-checks.js` treats `--help` as an execution probe, not a static usage printout; its output should be recorded as a successful check run.
- `scripts/prepare-worker-assets.js --help` produced no stdout but exited 0, so quiet success needs to be noted explicitly instead of treated as a missing tool.

## 2026-04-30 Task 3 Browser QA notes
- `lsp_diagnostics` could not run for changed TS/JS/HTML files because `typescript-language-server` and `biome` are not installed in this environment; focused `npx tsc --ignoreConfig --noEmit` covered the changed TypeScript sources instead.
- Headless Chromium reports ONNX/WebGPU environment warnings (`Unknown CPU vendor`, `No available adapters`, WebGPU provider removal) and asset-preload warnings during `index.html?debug=1`; these are not CommonJS compatibility errors and the app still boots/interacts.

## 2026-04-30 Task 7 Browser Smoke notes
- `lsp_diagnostics` still cannot run here because `typescript-language-server` and `biome` are not installed; `node --check scripts/browser-boot-smoke.js`, `package.json` JSON parsing, and the Playwright smoke covered the changed files.
- Headless Chromium currently emits the known ONNX/WebGPU environment warning through `console:error`; the browser smoke ignores only those known environment messages while still failing on page errors, other console errors, and CommonJS wrapper ReferenceErrors.
- Direct Playwright MCP/Chrome DevTools manual navigation was blocked by existing browser profile locks in this environment, but the committed smoke itself uses the Playwright package and passed against a served `worker-public` URL.

## 2026-04-30 Task 8 Worker Export Readiness notes
- `lsp_diagnostics` for `test/workers.match-export-readiness.test.ts` is still blocked by missing `typescript-language-server`; focused TypeScript coverage passed with `npx tsc --ignoreConfig --noEmit --target ES2020 --module commonjs --lib ES2020,DOM --types node,jest --moduleResolution node --esModuleInterop --skipLibCheck --ignoreDeprecations 6.0 "test\\workers.match-export-readiness.test.ts"`.
- The first focused `tsc` probe without `--ignoreDeprecations 6.0` failed only on TypeScript 6's `moduleResolution=node10` deprecation guard; rerunning with the flag exited 0.
- 2026-04-30 build blocker remains: `npm run build:ts` fails with `TS2441` duplicate identifier errors for top-level `exports` in `game/cards/effects/*.ts`.
- 2026-05-05 RESOLVED: removed co-located `.js` stubs (30 files) and renamed `exports` → `_exports` in 21 `.ts` files. `npm run build:ts` now passes with zero errors.
- The regeneration pass completed via `npm run worker:prepare`, but the repository still contains unrelated pre-existing modified source files in the working tree; I did not edit those as part of this task.
- Serve-wrapper cleanup on Windows needs tree-kill semantics in the test itself; a plain `child.kill()` is not enough to prove the bounded startup path leaves no orphan server behind.

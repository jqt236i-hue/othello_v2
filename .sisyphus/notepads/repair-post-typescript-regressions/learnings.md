## 2026-04-29 Task Progress Snapshot
- T2 verified: `node scripts/serve-with-fallback.js --help` prints usage; live server probe on port 8011 stayed alive and returned HTTP 200 for `/index.html`.
- T4 verified: dynamic import of `workers/match-worker.mjs` exposes `default` and `MatchRoomDurableObject`; `npx wrangler deploy --dry-run` no longer reports missing Durable Object export.
- Important implementation insight: serving repo root exposes CommonJS wrappers from `index.html`; serving `worker-public` gives browser-ready assets. Current serve wrapper now injects `worker-public` as default root when no explicit root is supplied.
- `npm run build:ts` currently fails on existing declaration overwrite/TS4023 issues; do not treat build as complete yet.
- 2026-04-30 local probes: `npm run serve -- --port 8011` now starts against `worker-public` and stays alive; `npx wrangler deploy --dry-run` reports `env.MATCH_ROOM (MatchRoomDurableObject)` instead of the old missing-export error.

## 2026-04-30 Task 5 Command Inventory
- Minimal regression command set is `npm run serve`, browser boot against the served `worker-public/` URL, `npm run worker:prepare`, and `npm run checkall`.
- `node scripts/serve-with-fallback.js --help` is the reliable serve-CLI probe; it prints usage and confirms the wrapper contract.
- `node scripts/run-all-checks.js --help` is not a pure help path here; it executes the bundled checks and passed.
- `node scripts/prepare-worker-assets.js --help` exits 0 with no output, so the worker export path is runnable even when it is quiet.

## 2026-04-30 Task 3 Browser Compatibility
- Served `worker-public/index.html?debug=1` needs classic-script globals from `ui/bootstrap/init-dom.js`, `init-events.js`, `init-game.js`, and `init-network.js`; CommonJS-only exports are invisible because `require`/`module` are intentionally undefined in the browser.
- `game/logic/cards.js` also needs browser global fallbacks for already-loaded `CardHandManager` and `CardMarkers`; otherwise `resetGame()` reaches card initialization but render/turn-start paths throw missing manager/marker helpers.
- `index.html` and `worker-public/index.html` must load `shared/player-encoding.js`, `game/cards/state-manager.js`, `game/cards/effect-resolver.js`, `game/cards/timing-processor.js`, and `game/cards/target-resolver.js` before `game/logic/cards.js` so the browser factory receives its extracted card modules.
- Browser QA against `http://127.0.0.1:8012/?debug=1` now initializes 64 board cells, draws the first black card, and reset/help controls remain clickable without `module is not defined` or `require is not defined` errors.
- `http://127.0.0.1:8012/story-deck-lab.html?debug=1` boots cleanly with no console messages and no CommonJS globals.

## 2026-04-30 Task 7 Browser Smoke
- Added `npm run test:browser:smoke`, backed by `scripts/browser-boot-smoke.js`, to start `npm run serve` against the default `worker-public` root on an ephemeral local port.
- The smoke opens `worker-public/index.html?debug=1`, fails on `module is not defined` / `require is not defined`, waits for `#board` to render at least 64 cells, and clicks visible `#resetBtn` before rechecking board rendering.
- The same smoke also opens `worker-public/story-deck-lab.html?debug=1` for boot coverage and applies the same CommonJS ReferenceError guard.
- Verification: `npm run test:browser:smoke` passed with `[browser-smoke] success http://127.0.0.1:<port>` after filtering known headless ONNX/WebGPU environment warnings as non-blocking.

## 2026-04-30 Task 8 Worker Export Readiness
- Added `test/workers.match-export-readiness.test.ts` as the local regression for `workers/match-worker.mjs`; it asserts the Worker `default` export has `fetch`, `MatchRoomDurableObject` is a named class export, and every `wrangler.toml` Durable Object `class_name` is present in module exports.
- The same test includes a synthetic missing-export check so the `MatchRoomDurableObject` omission is caught locally by Jest before any deploy attempt.
- Safe validation path is credential-free: run `npx jest --runInBand --runTestsByPath "test\\workers.match-export-readiness.test.ts"`, then `npx wrangler deploy --dry-run`. The dry run should list `env.MATCH_ROOM (MatchRoomDurableObject)` and exit with `--dry-run: exiting now`.
- 2026-04-30 build/sync pass: `npm run worker:prepare` regenerated mirror assets so `worker-public/index.html` now preloads `shared/player-encoding.js` plus `game/cards/state-manager.js`, `game/cards/effect-resolver.js`, `game/cards/timing-processor.js`, and `game/cards/target-resolver.js` before `game/logic/cards.js`.
- 2026-04-30 build/sync pass: the generated `cards.js` wrappers in `dist/` and `worker-public/` now fall back to `globalThis.CardMarkers` and `globalThis.CardHandManager` when browser `require` is unavailable.
- 2026-04-30 serve-wrapper regression pass: executable coverage is strongest when the test treats `scripts/serve-with-fallback.js` as a CLI, not a helper import, and uses a bounded HTTP poll plus explicit process-tree cleanup to prove the server stays alive without orphaning.
- 2026-05-05 browser runtime fix: root cause of `npm run build:ts` failure was `game/cards/effects/*.ts` files using `const exports = {...}` with `export = exports;` which conflicts with TypeScript 6's reserved `exports` in CommonJS scope when `allowJs: true` also compiles co-located `.js` stubs (`module.exports = require(...)`). Fix: removed 30 `.js` stub files and renamed `exports` → `_exports` in 21 `.ts` files. Additionally, `index.html` and `worker-public/index.html` loaded `ui/layout-stage.js` (a CJS stub) before `public/runtime.js` (which defines `module`), causing `ReferenceError: module is not defined`. Fix: moved `<script src="ui/layout-stage.js">` to after `public/module-registry.js` in both files.

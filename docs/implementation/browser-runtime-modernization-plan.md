# Browser runtime modernization implementation plan

- Status: completed through Phase 11 on 2026-07-14
- Completion record: `docs/perf/2026-07-14-browser-modernization-completion.md`
- Design: `docs/implementation/browser-runtime-modernization-design.md`
- Date: 2026-07-13
- Execution mode: sequential behavior-preserving phases with a verified commit after each coherent unit
- Player-visible specification: unchanged; do not edit `01-rulebook.md` or `正本/` unless a visible contract is intentionally changed

## Phase 0 — Establish the durable baseline

### Files

- add `scripts/capture-browser-modernization-baseline.ts`
- add `test/scripts.browser-modernization-baseline.test.ts`
- add `docs/perf/2026-07-13-browser-modernization-baseline.json`
- add `docs/perf/2026-07-13-browser-modernization-baseline.md`
- reuse existing visual baseline files; do not overwrite them unless an intentional visual change is approved

### Work

1. Extend the existing browser boot probe rather than creating a second server/boot implementation.
2. Record registry sizes/counts, request/transfer totals, DOMContentLoaded, app-ready, network-overlay-ready, font-ready, long-task totals, browser/Node versions, viewport, and lane.
3. Add fixed CPU fixtures for representative levels/modes and serialize exact action, coordinate/card ID, score digest, event/state digest, and fallback reason where available.
4. Record focused existing tests proving animation/sound order, CPU turn response, and network parity.
5. Capture the classic lane before any runtime/asset behavior switch.

### Verification

- focused baseline-script unit test
- focused CPU compute/action/determinism tests
- `npm run match:boot-performance-check`
- `npm run match:ui-control-smoke`
- `npm run test:visual`
- `npm run test:network:parity`
- `git diff --check`

### Done when

The baseline command is repeatable, JSON and Markdown agree, exact correctness digests are committed, and timing values are clearly marked environment-specific rather than universal thresholds.

## Phase 1 — Full WOFF2 and first large-background WebP pass

### Files

- add `scripts/assets/requirements.txt`
- add `scripts/assets/build-font-assets.py`
- add `scripts/optimize-browser-images.ts`
- add `scripts/verify-browser-optimized-assets.ts`
- update `package.json` / `package-lock.json` for `sharp` and asset scripts
- update `styles-base.css`
- update `ui/background-skin/catalog.ts`, `ui/background-skin/runtime.ts`, or a new focused resolver module as required
- update `shared/special-card-registry.ts` only through a fallback-aware asset descriptor if manifest backgrounds are selected
- add generated `assets/fonts/*.woff2`
- add selected `assets/images/background/**/*.webp`
- regenerate `assets/asset-manifest.json`
- add focused font/background asset tests

### Work

1. Convert all twelve TTF files to full WOFF2 with preserved names, weights, styles, glyphs, and vertical metrics.
2. Point every custom `@font-face` at WOFF2; verify first, then remove shipped TTF files.
3. Select only opaque PNG files under `assets/images/background/` above the documented threshold for the first WebP pass.
4. Generate same-dimension WebP, retain PNG, and add a capability/fallback resolver without changing stored skin IDs.
5. Await decode when switching runtime backgrounds; on failure, use PNG without changing selection state.
6. Regenerate the asset manifest from root source.

### Verification

- font metadata/glyph-count verifier
- font-skin catalog/runtime/assets tests
- browser `document.fonts` probe with Japanese/Latin/dynamic-name glyphs
- image dimension/alpha/codec verifier
- background catalog/runtime tests including WebP failure → PNG retry
- focused visual screenshots for default and manifest-world backgrounds
- `npm run build:browser`
- `npm run worker:prepare`
- `npm run check:worker-mirror`

### Done when

No CSS/runtime path requests TTF, all custom weights resolve from full WOFF2, selected large backgrounds use WebP only after capability/decode success, PNG fallback works, and classic visual/behavior baselines remain within tolerance.

## Phase 2 — Vite/ESM comparison lane

### Files

- update `package.json` / `package-lock.json` for `vite`
- add `vite.config.ts`
- add `index.vite.html`
- add `browser-vite/main.ts`
- add `browser-vite/classic-compat-loader.ts`
- add `browser-vite/runtime-contract.ts`
- add Vite lane tests and a classic-vs-Vite comparison script
- update `scripts/prepare-worker-assets.ts` and its tests to include the isolated Vite build directory

### Work

1. Implement idempotent `startBrowserApp()` with explicit required-script ordering and `readyState` handling.
2. Set `window.__CARD_REVERSI_BROWSER_LANE__` to `vite`; classic reports `classic` without changing behavior.
3. Load runtime/startup registry/layout/entry through a checked compatibility adapter and wait for `__uiInitialized`/required globals.
4. Build hashed ESM/Worker chunks to an isolated directory with a relative `base`.
5. Add a same-machine comparison report for boot/resource/global/DOM contracts.
6. Keep `index.html` and its current scripts unchanged as the default lane.

### Verification

- entry-browser bootstrap/load-order/global tests
- new compatibility loader required-failure/idempotence/ready-state tests
- Vite production build
- classic and Vite UI-control smoke
- classic and Vite visual comparison
- Worker mirror prepare/check with Vite output present

### Done when

The Vite URL boots the same game, exposes required compatibility globals, reports hashed ESM chunks, preserves initializer order, and can be compared automatically with the classic URL without changing the default entry.

## Phase 3 — Optional features one group at a time

### Files

- update `scripts/build-module-registry.ts`
- update `entry-browser.js`
- update `ui/bootstrap/lazy-runtime-loader.ts`
- add `browser-vite/optional-feature-loader.ts`
- add `browser-vite/features/{gacha,cosmetic,leaderboard,commentary,cpu,onnx}.ts` as justified by dependency ownership
- update module-registry/lazy-loader/handler tests
- regenerate startup, aggregate optional, and group registry outputs

### Work

1. Add one canonical module-key → optional-group classifier with required-key precedence.
2. Emit the aggregate optional registry plus deterministic group registries and merged metadata.
3. Validate optional dependency closure at generation time.
4. Add Vite `import()` adapters one at a time in this order: gacha, cosmetic, leaderboard, commentary, CPU, ONNX.
5. Make failed group loads retryable; keep in-flight dedupe and idempotent success.
6. Resume the first click/action after load and add non-mutating hover/focus/idle prefetch only where safe.
7. Preserve aggregate classic fallback.

### Verification per group

- generator classification/content/metadata tests
- lazy loader success/dedupe/failure/retry tests
- group first-open, double-click, failure/retry, and second-open browser checks
- assert unrelated group registry URLs are not requested
- bootstrap/runtime initializer tests
- `npm run build:browser`
- Vite build and classic-vs-Vite resource comparison

### Done when

Each optional feature can be loaded independently, a failed load can be retried without page refresh, the first action completes, and canonical game/network/playback code stays eager.

## Phase 4 — Pure CPU candidate-scoring boundary

### Files

- add `game/ai/cpu-candidate-scoring.ts`
- update `game/ai/cpu-policy-board-primitives.ts`
- update `game/ai/cpu-policy-move-selection.ts`
- update `game/ai/cpu-policy-core-types.ts`
- update `game/cpu-decision-move-selection.ts`
- add focused pure scorer/parity/determinism tests
- update `docs/architecture-contracts.md` with the stable pure scoring/Worker boundary after tests pass

### Work

1. Move the existing base heuristic and deterministic tie computation into one portable scorer.
2. Define versioned request/response DTO validators and a deterministic candidate digest.
3. Make the current main-thread ranker consume the same scorer.
4. Accept optional precomputed scores only after full digest/context verification.
5. Preserve exact local fallback for missing, malformed, stale, or mismatched batches.

### Verification

- existing CPU policy core/move-selection/decision tests
- exact baseline fixture comparison
- randomized bounded main-vs-portable scorer parity with fixed seeds
- malformed/non-finite/digest mismatch tests
- `npm run check:window`
- `npm run typecheck`

### Done when

There is one pure scoring authority, existing main-thread decisions are unchanged, and a verified precomputed batch can replace eligible local scoring without affecting selection.

## Phase 5 — ONNX inference in a Dedicated Worker

### Files

- add `browser-vite/cpu-worker/client.ts`
- add `browser-vite/cpu-worker/protocol.ts`
- add `browser-vite/cpu-worker/worker-entry.ts`
- update `game/ai/policy-onnx-runtime.ts` with an injected inference executor
- update `ui/bootstrap/lazy-runtime-loader.ts` so the Vite Worker lane does not load main-thread ORT
- add Worker protocol/client/runtime tests and focused browser probe

### Work

1. Implement lazy Worker creation, request IDs, decision epochs, timeouts, cancellation, crash recovery, and protocol validation.
2. Resolve model/meta URLs to absolute page URLs before posting.
3. Configure Worker-side ORT WASM paths from the built asset base and preserve provider order/fallback.
4. Inject a generic session executor into the existing policy runtime; keep vector construction, output interpretation, tactical refinement, budgets, and fallback on main.
5. Keep classic/headless/tests on the current in-thread executor.
6. Verify that `InferenceSession.create/run` happens only in the Dedicated Worker on the Vite lane and ORT is not requested at initial startup.

### Verification

- protocol validator/client lifecycle tests
- injected executor versus session-stub output parity
- timeout/crash/stale/malformed/unsupported-Worker fallback tests
- existing policy ONNX and CPU ONNX tests
- browser probe showing no main-thread `ort` and a Worker inference request
- exact CPU baseline comparison

### Done when

Vite ONNX inference runs in the Dedicated Worker with unchanged result/fallback behavior, while classic and unsupported environments still work through the existing path.

## Phase 6 — Extend the Worker to candidate scoring

### Files

- update Worker protocol/client/entry
- update `game/cpu-turn-move-phase.ts`
- update `game/cpu-turn-handler.ts` and bootstrap runtime wiring only through explicit DI
- update CPU scoring/turn tests and browser probe

### Work

1. Add the pure scorer operation to the same Worker.
2. Inject an optional `scoreCandidatesInWorker` function through CPU bootstrap/runtime boundaries.
3. Request scoring only for eligible policy paths and within a bounded budget.
4. Verify decision epoch, turn, state version when available, digest, level, board shape, and coordinates before use.
5. Use exact local scoring on timeout/failure/mismatch and retain stale-move checks before commit.
6. Keep think-time delay independent of compute time.

### Verification

- main-vs-Worker score parity
- exact CPU action fixtures for Worker success/fallback/stale cases
- CPU turn retry/animation-busy/human-mode abort tests
- focused CPU-response E2E in classic and Vite lanes
- determinism/state/event/replay digest comparison

### Done when

Eligible scoring work occurs in the Worker, no Worker reply can cross a CPU attempt/turn boundary, and every baseline CPU action/presentation remains identical.

## Phase 7 — Safe subsets and gated additional image conversion

### Files

- update font asset builder and add generated corpus/range manifest
- add subset WOFF2 files
- update `styles-base.css` with separate subset/full internal families
- extend image optimizer/verifier only for objective pass candidates
- add AVIF/WebP/PNG descriptors only for eligible opaque backgrounds
- regenerate asset manifest and browser/Worker outputs

### Work

1. Generate a static UI glyph corpus from runtime HTML/CSS/TS/JSON/catalog sources and a required probe list.
2. Build subset WOFF2 for each shipped family/weight while retaining full WOFF2 fallback.
3. Verify every corpus glyph and dynamic fallback probes.
4. Add AVIF only for large opaque backgrounds that pass decode, size, dimensions, and visual-quality gates; otherwise keep WebP/PNG.
5. Consider additional WebP only for opaque, non-text, non-animation images with clear savings. Do not convert gacha/card/stone/UI alpha assets in this program unless all dedicated visual paths exist and pass.

### Verification

- corpus determinism and glyph coverage tests
- font-load and post-load layout/text-fitting browser checks
- background AVIF/WebP/PNG capability/failure fallback checks
- focused/full visual regression
- asset manifest tests
- size report compared with Phase 0

### Done when

Common text loads subset fonts without missing glyphs, arbitrary text reaches full WOFF2, only objectively safe images receive extra codecs, and transfer/decode savings are recorded without visual drift.

## Phase 8 — Full verification, mirror, comparison, and completion

### Commands

1. focused changed-area tests after each phase;
2. `npm run typecheck`;
3. `npm run build:ts`;
4. `npm run build:browser`;
5. Vite production build;
6. `npm run checkall`;
7. `npm run test:network:parity`;
8. `npm run match:ui-control-smoke` for classic and Vite;
9. `npm run match:boot-performance-check` plus classic-vs-Vite comparison;
10. focused CPU-response and optional-feature E2E;
11. `npm run test:visual`;
12. `npm run worker:prepare`;
13. `npm run check:worker-mirror`;
14. `git diff --check` and final `git status --short`.

### Final review

- inspect task-owned source versus generated/mirror diffs;
- confirm no `worker-public/` file was source-edited;
- confirm no rulebook/player-visible behavior change was introduced;
- confirm package manifest/lock and asset-tool requirements are aligned;
- compare classic/Vite exact correctness gates and timing/resource report;
- document any environmental timing variance without weakening correctness gates;
- commit each verified coherent unit and leave no unexplained task-owned changes.

## Original plan self-review

- Every switch is preceded by a characterization or parity boundary.
- The Vite lane is additive and rollbackable; the plan does not falsely treat a registry wrapper as complete native-ESM conversion.
- Optional groups retain a classic aggregate fallback and gain retry behavior before first-click interception is enabled.
- CPU/ONNX work crosses only versioned serializable boundaries; authority, selection validation, move application, presentation, and network publish stay on their current owners.
- Full WOFF2 precedes subset, and subset cannot remove arbitrary glyph coverage.
- Initial images are limited to opaque backgrounds; high-risk alpha/text/animation assets remain out of scope.
- Browser-visible root changes explicitly include `build:browser`, and every deploy-affecting phase includes root-first mirror generation/verification.
- The final bundle covers Level 3 network/mirror checks and real browser comparison without starting training or long selfplay.

## Phase 9 — Correct audited behavior-preservation gaps

### Files

- update `ui/assets/background-image-codec.ts` and its focused tests;
- update `browser-vite/optional-feature-loader.ts`, feature loading helpers, and focused retry tests;
- update the CPU Worker bridge/runtime failure signal and ONNX fallback tests;
- update only the optional-control handlers/styles needed for loading/error/retry presentation.

### Work

1. Keep the currently displayed background until optimized decode succeeds. Request PNG only after optimized decode failure, and ignore stale selection completions.
2. Make feature adapters eager and the actual feature payload retryable with a distinct URL after a network failure.
3. Propagate post-ping ORT/model/session/inference failure to the bridge, disable Worker ONNX for the session, load main-thread ORT once, and retry through the existing initializer.
4. Apply `aria-busy`, a polite loading status, and an actionable retry state to optional controls without opening a surface twice or changing storage/game state.

### Verification

- focused codec request-count and stale-selection tests;
- adapter/payload first-failure then same-page retry tests;
- post-ping create/run failure tests proving main-thread ONNX activation;
- optional first-click/double-click/failure/retry browser smoke;
- existing exact CPU/ONNX/Worker suites.

### Done when

No successful optimized selection double-fetches PNG, optional payload failure is retryable without reload, post-ping ONNX failure reaches the existing main-thread fallback, and loading state is perceivable but gameplay-visible behavior is otherwise unchanged.

## Phase 10 — Registry-free Vite delivery and default cutover

### Files

- extend `scripts/build-module-registry.ts` to expose the canonical browser-module records without changing classic output;
- add a generated Vite interop-module builder and checked generated startup/group loader entries;
- add a bounded `browser-vite` module-ID bridge and Vite virtual hashed group-URL plugin;
- replace `browser-vite/classic-compat-loader.ts` boot ownership with registry-free Vite boot;
- update `scripts/build-vite-entry.ts`, `vite.config.ts`, package scripts, generated documents, and mirror preparation;
- preserve the old document as `index.classic.html`, then publish the verified Vite document as default `index.html`.

### Work

1. Reuse the existing browser-module selection, aliases, required/optional classification, and group closures; do not create a second ownership map.
2. Inventory every browser dynamic require target and fail generation for unresolved local IDs. Generate accessors that Vite/Rolldown converts to bundled CommonJS factories. The interop bridge resolves only legacy synchronous IDs and built-ins; it stores no source text, factory implementation, or independent module cache and performs no dynamic code evaluation.
3. Emit optional groups as self-contained content-hashed Vite chunks with startup dependencies only. Import their emitted URLs with a per-attempt query so a transient rejected module URL does not poison retries.
4. Import layout and `entry-browser.js` through Vite, preserve explicit global publication/initializer order, and assert the runtime contract before readiness.
5. Keep classic registry artifacts only for `index.classic.html`; assert the default page requests none of them.

### Verification

- generator determinism, alias, closure, and stale-output tests;
- unresolved dynamic ID, circular/evaluation-order, export identity, and optional-before-load tests;
- registry-free boot contract and no-registry-request browser assertion;
- classic rollback boot smoke;
- optional code-split request/isolation/retry checks;
- exact CPU action/state/event/replay digest comparison and UI screenshots;
- `npm run build:browser`, Vite production build, Worker mirror generation/check.

### Done when

The default document boots entirely through Vite-owned hashed JS chunks, requests no custom source-code registry/runtime, optional groups remain split and retryable, the classic rollback document works, and exact game/presentation/network gates remain unchanged.

## Phase 11 — Browser/deployment evidence and final completion

### Work and verification

1. Version all linked CSS through the generated browser version synchronizer.
2. Add a production-like static-server check for JavaScript/Worker/WASM/font/image MIME, cache policy, CSP-required URLs, and stale-chunk/preload failure presentation.
3. Run desktop Chromium, Firefox, and WebKit startup/optional/font/background/Worker smoke, plus a touch/mobile viewport scenario and background/resume check where supported.
4. Save a repeated current-build classic-versus-default-Vite resource/timing report with final hashes; report medians and exact transferred resources without claiming causality from a single sample.
5. Run typecheck, focused suites, `checkall`, network parity, classic/default UI control smoke, visual regression, asset checks, `worker:prepare`, mirror check, `git diff --check`, and final status/diff inspection.
6. Update completion evidence and architecture documentation, then commit each isolated verified unit.

`scripts/build-vite-entry.ts` owns generation of both documents: it snapshots/updates the rollback document and produces the Vite source document without allowing `build:browser` to switch the default back. The Vite close-bundle step publishes the built document as default only after generation; an idempotency test runs the build sequence twice and checks default/rollback CSS versions plus final mirror hashes.

### Done when

All eight residual tasks have an executable gate and current-build artifact, the final hashes match the saved report and mirror, no correctness/visual gate regresses, and the working tree is clean after coherent commits.

## Residual plan self-review

- The plan fixes the three reproduced failures before changing the default entry.
- Registry-free means no shipped source-string registry/runtime on the default path; it does not conceal the remaining source-level CommonJS migration behind a naming change.
- Required and optional module ownership stays single-sourced in the existing generator, preventing classic/Vite drift.
- Retry changes URL identity only after failure; successful hashed chunks retain normal cacheability.
- ONNX fallback changes execution location only after failure and preserves the current policy/result interpretation.
- Loading UX is settlement/presentation state only and never enters canonical game or network snapshots.
- Cross-browser, production delivery, final performance, network, visual, and mirror gates all occur before completion is reported.

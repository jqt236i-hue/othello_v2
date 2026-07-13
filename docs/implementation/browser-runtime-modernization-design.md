# Browser runtime modernization design

- Status: reviewed design
- Date: 2026-07-13
- Target: browser boot, optional feature delivery, shipped font/background assets, and browser CPU inference/scoring execution
- Source of truth: root `AGENTS.md`, `docs/architecture-contracts.md`, `01-rulebook.md`, current classic boot implementation, and the baseline captured by this program
- Non-goals: gameplay/rule changes, changing Lv6 policy ownership, changing animation or sound ordering, changing network authority, replacing the Cloudflare match Worker, making ONNX the primary Lv6 policy, removing the classic entry before parity is proven, or running training/selfplay jobs

## 1. Problem and desired outcome

The current browser runtime embeds hundreds of compiled CommonJS modules in a custom startup registry. The startup registry is several megabytes before normal game assets are decoded, optional features still share one registry payload, browser ONNX inference runs on the UI thread, all bundled fonts ship as TTF, and large opaque backgrounds ship only as PNG.

The desired outcome is a behavior-preserving migration lane that can be compared against the current game throughout the work:

1. freeze current CPU decisions, visible screens/presentation, resource behavior, and boot timing as executable baselines;
2. reduce font and large-background transfer/decode cost without changing typography, dimensions, colors, animation ordering, or fallback behavior;
3. add a Vite/ESM comparison entry while keeping the current `index.html` path intact;
4. load optional surfaces one feature at a time;
5. establish a serializable pure CPU candidate-scoring boundary;
6. run ONNX session creation/inference in a Dedicated Worker;
7. extend that Worker to pure candidate scoring while main-thread game authority still validates and applies the chosen action;
8. add safe font subsets and only then expand image conversion where objective parity gates pass.

No phase is allowed to redefine player-visible game behavior. `01-rulebook.md` and `正本/` therefore remain unchanged unless verification discovers that an existing visible contract cannot be preserved.

## 2. Current repository evidence

### 2.1 Boot and delivery

- `index.html` loads `public/runtime.js`, `public/module-registry.js`, `ui/layout-stage.js`, and `entry-browser.js` as classic scripts.
- `entry-browser.js` publishes module exports to `window`, applies late globals, runs three explicit runtime initializers, and preserves a fragile boot table order.
- The generated startup registry is about 7.9 MiB with 599 required module keys. The optional registry is about 324 KiB with 33 optional module keys.
- `ui/bootstrap/lazy-runtime-loader.ts` currently loads the same optional registry for every group. It deduplicates in-flight loads, but a rejected registry promise remains cached and cannot be retried.
- The current browser performance check confirms that the optional registry and ONNX runtime do not load during ordinary startup; this contract must remain true.
- The TypeScript build remains CommonJS with `allowJs`, and many browser modules still depend on `_require`, compatibility globals, or import-time registration. A direct script-tag swap to native ESM would omit required globals and initializers.

### 2.2 CPU and ONNX

- `game/cpu-decision.ts` is the CPU composition boundary. It mixes pure policy calls with access to runtime state, while mutation/application remains in turn/card paths.
- `game/cpu-decision-action.ts` already describes a side-effect-free action result but obtains its inputs through injected adapters.
- `game/ai/cpu-policy-core.ts` and extracted helpers own deterministic headless policy logic.
- `game/cpu-turn-move-phase.ts` is already asynchronous around the ONNX attempt and rejects stale decisions before committing a move.
- `game/ai/policy-onnx-runtime.ts` builds vectors, creates ONNX sessions, runs inference, interprets outputs, and records latency on the browser thread.
- `docs/architecture-contracts.md` requires the Lv6 primary decision path to remain `policy-table-lookahead` / `policy-table-core`; browser ONNX remains a gated auxiliary path.
- No browser Dedicated Worker currently owns CPU work.

### 2.3 Assets

- Twelve bundled TTF files total about 47.7 MiB. `styles-base.css` declares all of them with `font-display: swap`.
- Large PNG backgrounds include multiple 2.5–3.3 MiB files. Transparent UI, board, stone, card, and effect images are higher-risk conversion targets and are excluded from the first image pass.
- The default background is selected through a CSS variable; user-selectable backgrounds are catalog paths; manifest-world backgrounds are supplied through presentation metadata.
- The current manifest is an integrity/catalog surface, not a command to preload every asset.
- Existing visual tests, font-skin tests, asset-manifest tests, gacha visual tests, and browser smoke checks provide partial coverage, but codec decode, missing-glyph fallback, and retry behavior need explicit checks.

## 3. Invariants

The following are release gates, not goals to trade away:

- identical canonical CPU action for the same serialized state, profile, seed, and candidate order;
- identical main-thread validation and application of CPU actions;
- identical `events[]`, playback order, sound keys, animation timing policy, busy/settlement semantics, and Single Visual Writer ownership;
- identical network command/snapshot authority, `stateVersion`, `operationId`, reconnect, projection, and spectator behavior;
- identical DOM IDs, visible Japanese labels, keyboard/mouse/touch behavior, storage keys, and debug gating;
- identical font family, weight/style mapping, line metrics within the visual baseline tolerance, and complete rendering of arbitrary dynamic user text;
- identical image dimensions and crop/background positioning; no codec-only item disappearance;
- optional feature load failure must leave the canonical game usable and must be retryable;
- a stale Worker reply must never be applied to a later turn or state version;
- classic entry remains deployable until the Vite lane passes the same comparison bundle.

## 4. Chosen architecture

### 4.1 Two browser lanes

`index.html` remains the classic control lane. A new `index.vite.html` is the comparison lane and is built/served by Vite. It starts from an explicit idempotent `startBrowserApp()` ESM function.

During this program, Vite owns:

- the alternate HTML entry and hashed ESM chunks;
- feature-level dynamic-import adapters;
- the Dedicated Worker bundle;
- an explicit compatibility boot adapter that preserves the current global/initializer contract;
- comparison instrumentation identifying `classic` versus `vite` lane.

The compatibility adapter initially loads the generated CommonJS registry because the source tree is not yet native-ESM-safe. This is deliberate: the program replaces the browser entry orchestration and optional/Worker delivery first, while retaining the classic registry as a temporary compatibility substrate. The default entry is not switched and the registry is not removed until a later migration can convert remaining required modules without weakening boot parity. This prevents a nominal “ESM conversion” that silently drops globals or feature initializers.

The Vite lane boot order is fixed as:

1. set lane/capability flags;
2. install the lazy Dedicated Worker client without starting the Worker;
3. load classic runtime and startup registry compatibility scripts;
4. run layout-stage before first interactive layout;
5. load `entry-browser.js` and await its explicit ready signal;
6. install Vite feature loaders and ONNX executor injection;
7. expose comparison metrics.

Required startup failure is fatal and visible in the console/boot error surface. Optional feature failure is scoped to that feature and retryable.

### 4.2 Feature-level optional registries and dynamic imports

The registry generator continues to emit the aggregate optional registry for the classic lane. It additionally emits deterministic group registries for:

- `gacha`;
- `cosmetic` (background/font/hand/catalog surfaces that are not required boot modules);
- `leaderboard`;
- `commentary` where dependencies are demonstrably optional;
- `cpu`;
- `onnx`.

Required module overrides always remain in the startup registry even when their directory prefix is otherwise optional.

Each group is emitted from an explicit ownership map plus the transitive optional dependencies required by that group. The generator rejects a group whose module dependency resolves only through a different unloaded optional group. Loading a group merges its boot metadata with the startup metadata; it must not replace the required/optional classification used by later restores.

The Vite lane maps each group to a separate `import()` adapter. The adapter loads only the matching group registry, restores newly available boot entries, and resolves after required group globals/initializer checks pass. The classic lane retains the aggregate fallback.

The loader state machine is per group:

- `idle` → `loading` → `loaded`;
- failure returns to `idle`, records an error for diagnostics, and permits retry;
- simultaneous requests share one in-flight promise;
- repeated success is idempotent;
- the first user action is resumed after load instead of being discarded;
- hover/focus/idle prefetch may be added only where it does not start audio, alter state, or open UI.

Canonical gameplay, network reconciliation, playback, and per-card rule code are never made optional by this phase.

### 4.3 Font delivery

Phase one converts every shipped TTF to a full WOFF2 equivalent and updates `@font-face` declarations to `format("woff2")`. Each source/output pair must preserve family, subfamily, weight, style, glyph count, and relevant vertical metrics. The TTF files remain only until the full-WOFF2 browser and manifest checks pass, then are removed from the shipping surface.

The final subset phase uses a generated repository glyph corpus for static player-visible text. For each font/weight, CSS declares:

1. a subset WOFF2 face under an internal `*-Subset` family with an explicit generated `unicode-range`;
2. the full WOFF2 face under an internal `*-Full` family as the range-complete fallback;
3. the public selected font stack lists subset first and full second.

This allows the common UI to download a smaller file while arbitrary player names, room names, chat/log text, card data introduced later, and uncommon Japanese glyphs still render from the complete WOFF2. Subsetting is rejected if a required static glyph is absent or if the full fallback cannot render a probe corpus.

After `document.fonts.ready` or a selected font change, the existing text-fitting/layout update must run once so `font-display: swap` does not leave stale card-name measurements.

### 4.4 Image delivery

The first image pass is limited to opaque PNG files under `assets/images/background/` above a documented size threshold. It excludes board surfaces, stones, cards, characters, UI textures, gacha items, animation frames, and any image with alpha.

For each selected file:

- keep the original PNG as fallback/source;
- generate a same-dimension WebP with metadata normalized;
- reject alpha introduction/loss, dimension change, or objective visual-quality failure;
- select WebP only after a browser capability probe, otherwise use the original PNG;
- preserve the same CSS `cover`, position, and runtime catalog identity.

AVIF is not used in the first pass because current asset-path validation and gacha catalogs do not consistently recognize it. The final image pass may add AVIF only for large opaque backgrounds that pass decode and visual comparison, with WebP and PNG fallbacks retained. Direct `.png` string replacement in gacha/catalog data is prohibited.

Image decode is awaited before a newly selected background is presented when a transition would otherwise expose a blank frame. Decode failure falls back to the original path without changing the selected skin ID.

### 4.5 Pure candidate-scoring boundary

A new runtime-portable module owns a serializable candidate-score request and deterministic response. The initial boundary covers the existing pure base heuristic and deterministic tie score used by `cpu-policy-move-selection`:

```text
request: {
  protocolVersion,
  requestId,
  decisionEpoch,
  stateVersion,
  turnNumber,
  playerKey,
  level,
  boardShape,
  candidateMoves[{ row, col, flips[] }]
}

response: {
  protocolVersion,
  requestId,
  decisionEpoch,
  stateVersion,
  scores[{ row, col, heuristicScore, tieScore, totalScore }]
}
```

The scorer has no DOM, timers, random source, ONNX session, network client, mutable game state, or global lookup. Candidate order is part of the input because it contributes to the existing deterministic tie score. Non-finite or malformed values are rejected rather than coerced into a successful decision.

The main-thread selector accepts an optional verified precomputed score batch. It uses the batch only when its digest, level, board shape, and candidate coordinates match the current selection. Otherwise it computes the existing score locally. This makes fallback behavior exact and keeps the pure module as the single scoring authority.

### 4.6 Dedicated Worker protocol

One lazily created module Worker owns both operation families:

- ONNX session lifecycle and `InferenceSession.run`;
- pure CPU candidate scoring.

The Worker is not the Cloudflare match Worker and never owns canonical gameplay state.

Messages include `protocolVersion`, `requestId`, operation, `decisionEpoch`, optional authority `stateVersion`, and a serializable payload. `decisionEpoch` is a monotonically increasing browser CPU-attempt token and therefore also protects local games that have no server state version. The client:

- keeps a pending map by `requestId`;
- supports timeout and cancellation;
- rejects replies from a terminated/restarted Worker;
- rejects stale `stateVersion`/turn replies before selection or commit;
- terminates and clears pending requests on unrecoverable protocol error;
- does not transfer or expose network credentials, storage data, DOM references, functions, or full UI state.

The Worker is created only on the first ONNX/scoring request. Candidate arrays and feature vectors may use transferable typed-array buffers where ownership is unambiguous.

Model/meta URLs are resolved to absolute URLs against the page base before crossing the Worker boundary. ONNX Runtime WASM locations are configured explicitly from the built Worker asset base rather than relying on resolution relative to a hashed Worker chunk. Provider creation is probed in the Worker; unsupported WebGPU falls back to WASM with the same externally reported reason.

### 4.7 ONNX inference-only migration

The main thread continues to own:

- runtime gating and Lv6 primary/auxiliary role;
- context construction and feature-vector semantics;
- candidate-to-output-index mapping;
- tactical/lookahead refinement;
- latency budget/fallback decision;
- selected-action validation and application.

The Worker owns:

- loading `onnxruntime-web`;
- creating named sessions from model URLs with the same provider preference/fallback order;
- creating tensors and executing `session.run`;
- returning named numeric outputs and session metadata.

`policy-onnx-runtime.ts` receives an injected inference executor. With no executor (classic lane, unsupported Worker, test/headless), it uses the existing in-thread path. With the Vite Worker executor, it does not require a main-thread ORT global. Session/model/meta URLs, execution-provider order, output selection, tie breaking, runtime guard budgets, and existing fallback reason remain unchanged.

The first implementation covers the browser policy runtime. Any second ONNX runtime is enabled only after its input/output contract is represented by the same generic executor and parity tests pass; otherwise it remains on the existing path rather than receiving a divergent duplicate implementation.

### 4.8 Candidate scoring in the Worker

After the pure scorer is characterized and ONNX messaging is stable, `game/cpu-turn-move-phase.ts` may request precomputed candidate scores before the existing synchronous fallback selector. The request is optional and bounded. On success, the main selector verifies and consumes the score batch; on failure/timeout/staleness, it runs the same pure scorer locally.

This phase does not move:

- card choice or card application;
- pending-selection settlement;
- lookahead state mutation or canonical PRNG ownership;
- move execution;
- presentation, sound, or think-time delay;
- network publish.

Minimum think time remains a presentation policy separate from compute duration, so a faster Worker does not make the CPU visibly snap or change animation timing.

## 5. Baseline and comparison model

The baseline records:

- Git commit, Node/browser versions, viewport, lane, and timestamp;
- registry bytes/module counts, requested resources, transferred bytes, DOMContentLoaded, UI-ready, network-overlay-ready, long tasks, and font-ready time;
- exact CPU action/coordinates and deterministic score digest for fixed fixtures, seeds, levels, and modes;
- canonical state/event/replay digest for focused CPU turn fixtures;
- visual screenshots for initial board, representative modal/optional screens, selected background/font, and a CPU response state;
- animation/sound event sequence from existing no-animation characterization tests;
- network parity bundle result.

Timing gates compare distributions/medians with a generous environment-noise envelope; correctness gates compare exact values. Vite results are always reported beside classic results from the same machine/run.

## 6. Failure and rollback behavior

- `index.html` remains the immediate rollback lane throughout the program.
- Vite build output is isolated and never overwrites the classic source entry.
- Optional group failure restores the group to retryable `idle`; it does not mark the whole app loaded.
- Unsupported Worker/module Worker/CSP conditions select the main-thread runtime before a CPU decision starts.
- Worker crash rejects pending operations; current CPU logic follows the existing local/ONNX fallback path.
- ONNX timeout uses the current budget sentinel and reason; it never returns a success-shaped null without diagnostics.
- Stale CPU results are discarded, and the current turn is recomputed/retried through existing scheduling.
- WebP/AVIF decode failure resolves the original PNG without changing selection state.
- subset glyph misses use full WOFF2; full WOFF2 load failure uses the existing system-font stack.

## 7. Security, privacy, and compatibility

- Worker messages contain only bounded CPU/model DTOs. No seat token, spectator token, room credential, local-storage dump, chat history, or arbitrary object graph is sent.
- Vite asset URLs use a relative base suitable for the Worker static mirror. Hashed files and HTML are mirrored together through `worker:prepare` so stale HTML cannot reference missing chunks.
- CSP/module Worker support is feature-detected. Classic delivery remains supported.
- WOFF2 and WebP are capability-gated where necessary; PNG/system-font fallbacks remain.
- Generated outputs are created from root sources and then mirrored; `worker-public/` is never edited first.

## 8. Alternatives considered

### Directly replace `index.html` with Vite

Rejected for this program. The codebase still relies on compatibility globals, CommonJS `_require`, import-time registration, and explicit initializer order. A direct replacement would combine entry migration, module conversion, and behavior changes in one rollback unit.

### Bundle the existing registry as one Vite asset and call the migration complete

Rejected as the final architecture. It provides an ESM script tag but no feature-level code delivery or module-boundary improvement. The compatibility registry may remain temporarily in the comparison lane, but progress is measured by group split and explicit ESM/Worker ownership.

### Move the complete CPU turn into a Worker

Rejected. CPU turn orchestration reads canonical state, coordinates card/pending flow, and ultimately triggers game/network/presentation paths. Moving it would duplicate authority and create stale-state races. Only pure scoring and ONNX inference cross the Worker boundary.

### Make ONNX the primary Lv6 decision

Rejected because it changes player-visible behavior and contradicts the active architecture contract.

### Remove original PNG/full font files after optimization

Rejected for PNG and subset fallback because decode/glyph compatibility must remain exact. Original TTF may be removed after full WOFF2 parity because the full WOFF2 carries the same font data and system-font fallback remains.

### Convert all images immediately

Rejected. Alpha-heavy cards, stones, UI, and animation assets have much higher visible-regression risk and lower confidence than opaque backgrounds.

## 9. Verification strategy

### Design/contract checks

- `npm run check:window`
- `npm run check:dependency-boundaries`
- focused module-registry boot contracts
- new Worker protocol and pure-scoring unit tests

### CPU/ONNX correctness

- existing CPU compute/move/pending/ONNX suites;
- fixed-fixture exact action and score-digest baseline;
- main-thread versus Worker scorer parity over fixed and generated bounded fixtures;
- injected ONNX executor versus current session stub parity;
- stale response, timeout, crash, malformed response, retry, and unsupported-Worker tests;
- deterministic state/event/replay digest comparison.

### Browser and visible behavior

- classic and Vite boot smoke;
- `npm run match:ui-control-smoke`;
- focused CPU response E2E;
- optional gacha/cosmetic/leaderboard first-open, double-click dedupe, failure/retry, and second-open checks;
- `npm run test:visual` plus focused screenshots for new comparison surfaces;
- font-ready/glyph probe and background decode/fallback checks.

### Cross-runtime/deploy

- `npm run typecheck`
- `npm run build:ts`
- `npm run build:browser`
- Vite production build
- `npm run checkall`
- `npm run test:network:parity`
- `npm run worker:prepare`
- `npm run check:worker-mirror`

No long selfplay or training job is part of verification.

## 10. Observable completion criteria

The program is complete when all of the following are true:

- a durable pre-change baseline and repeatable comparison command exist;
- classic and Vite lanes both boot and pass focused UI/network/CPU parity;
- Vite lane reports hashed ESM chunks and a lazily created Dedicated Worker;
- optional feature requests load only the selected group and are retryable;
- every shipped custom font is delivered as WOFF2, common glyph subsets are used, and full WOFF2 fallback renders arbitrary probes;
- selected large opaque backgrounds use WebP (and only gated final candidates use AVIF) with PNG fallback and matching dimensions;
- ONNX `InferenceSession.create/run` occurs in the Dedicated Worker for the Vite lane and preserves existing output interpretation/fallback;
- eligible CPU heuristic candidate scores are computed in the Worker and verified before use, with exact local fallback;
- canonical CPU actions, events, animations/sounds, visible screenshots, and network authority checks match the baseline;
- root generated browser artifacts and `worker-public/` mirror are regenerated and verified;
- task-owned changes are split into coherent verified commits and the final working tree contains no unexplained task changes.

## 11. Self-review

- The design keeps the default entry and current authority paths unchanged while introducing measurable alternate paths.
- It does not claim that merely wrapping the registry in a Vite entry completes native-ESM conversion; the temporary compatibility substrate is explicit.
- It separates ONNX execution from CPU/game authority and keeps main-thread stale-result validation.
- It preserves arbitrary dynamic Japanese text through a full-WOFF2 fallback rather than assuming a closed glyph corpus.
- It limits initial image conversion to opaque backgrounds and preserves source fallbacks.
- It defines retry and stale-response behavior instead of relying on broad catches or success-shaped no-ops.
- Remaining implementation risk is concentrated in compatibility boot order, group dependency classification, and injected ONNX executor parity; the plan must put characterization tests before each switch.

## 12. Independent review findings incorporated

The independent boot/runtime review identified five high-risk compatibility contracts in the current implementation:

- `entry-browser.js` publishes exports and named defaults to `window`; ESM exports do not do this automatically.
- UI bootstrap, network-client, and card-interaction initializers are explicit and order-sensitive.
- delayed ESM evaluation can miss a one-shot `DOMContentLoaded` listener unless `document.readyState` is handled.
- optional registry restoration is more than downloading code: it reapplies globals, late globals, and initializers, and the first interaction must resume.
- CommonJS `_require`, alias, default-export, evaluation-order, and required-versus-optional failure semantics cannot be converted mechanically.

The chosen compatibility adapter, fixed start sequence, idempotent ready-state handling, group restoration contract, and classic rollback lane directly address these findings. Follow-up self-review added dependency-closure validation for group registries, metadata merge semantics, absolute model/WASM URL handling, local-game `decisionEpoch`, and separate internal subset/full font families.

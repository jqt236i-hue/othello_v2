# Board renderer runtime decomposition design

- Status: completed
- Date: 2026-08-06
- Target: browser board render orchestration, state projection, backend selection, input, layout, writer settlement, and DOM compatibility dependency wiring
- Source of truth: root `AGENTS.md`, `ui/AGENTS.md`, `docs/architecture-contracts.md` section 7.3, and the current root `ui/` implementation
- Non-goals: gameplay or card-rule changes, player-visible timing/text changes, network-authority changes, event reordering, Pixi scene redesign, DOM compatibility removal, or changes to `01-rulebook.md` / `正本/`

## 1. Problem and desired outcome

`ui/board-renderer.ts` is a transition monolith. It combines legacy DOM composition duties with the newer Pixi controller, Single Visual Writer, strict-network settlement, context-loss recovery, input/accessibility, frame construction, layout measurement, occupancy, and generic DOM-disc rendering. The file currently has roughly 3,089 lines, 130 top-level functions, 41 module-scope mutable values, and a flat 38-method facade.

The desired outcome is a behavior-preserving decomposition in which:

1. one injected render-state source implements network snapshot, local runtime, prepared-state, strict-mode, input-epoch, and receipt-bound resolution;
2. layout, input, backend lifecycle, frame construction/apply, and writer settlement each own their mutable state in a dedicated runtime instance;
3. callers can depend on typed capability ports while the existing flat CommonJS/browser facade remains compatible;
4. DOM compatibility receives explicit capabilities only after it is selected and no longer discovers a `BoardRendererStoneHelpers` global bag;
5. `ui/board-renderer.ts` becomes the composition root and compatibility facade rather than an implementation owner;
6. the Single Visual Writer, committed-frame receipt identity, event order, fallback isolation, and browser delivery behavior remain unchanged.

## 2. Current architecture and evidence

### 2.1 Mixed state machines

The current module owns independent mutable clusters for:

- pixel-sizing signatures, observers, element identities, measurements, and revisions;
- controller/backend instance, test selection, readiness, context recovery, and fallback;
- input controller, lock resolver, keyboard cursor, preview hints, deferred overlay render, and accessibility layer;
- frame serial, render-session epoch, revision composer, committed-world metadata, and theme/font observer;
- synthetic auto-writer token, claim generation, settlement promise, and invalidation accumulator.

These clusters have different reset and failure lifecycles. Keeping them in one module allows accidental cross-state access and makes focused verification difficult.

### 2.2 Duplicated render-state discovery

Network visual-store discovery, snapshot selection, local `gameState` / `cardState` fallback, strict-network activity, and input epoch are independently implemented in:

- `ui/board-renderer.ts`;
- `ui/board-visual/state-adapter.ts`;
- `ui/board-dom-compat/renderer.ts`;
- a narrower copy in `ui/presentation/stone-info-controller.ts`.

Each individual operation currently attempts to retain one snapshot pair, but the implementations can drift. A frame/model can therefore evolve independently from occupancy, DOM fallback, or stone-info resolution even though all are visual consumers of the same authority boundary.

### 2.3 Hidden DOM compatibility dependency bridge

`ui/board-renderer/stone-helpers.ts` publishes a mutable `BoardRendererStoneHelpers` global bag. DOM compatibility, stone visuals, and visual effects discover helpers through that bag or direct browser globals. This hides dependency direction and makes compatibility tests depend on global registration order.

### 2.4 Existing stable controller boundary

`ui/board-visual/controller.ts` already owns the backend lease, writer token validation, backend exclusivity, frame coalescing, strict committed-frame application, recovery, and settlement notification. The refactor must not move those canonical controller responsibilities. It only moves the facade-side orchestration and dependency construction around the controller.

## 3. Invariants

The following are release gates:

- exactly one active `BoardVisualBackend` and one board writer;
- ordinary render requests remain deferred or coalesced while playback owns the writer;
- strict-network writer ownership remains held until the receipt-bound committed frame applies and visual settlement succeeds;
- recovery retries the committed frame without replaying authoritative events;
- `events[]` ordering, playback scopes, sound ordering, and board-update handoff remain unchanged;
- default Pixi import/evaluation does not load DOM compatibility runtime modules;
- DOM compatibility remains available for explicit debug selection, Pixi initialization failure, software-renderer rejection, and unrecoverable context loss;
- game/network state remains authoritative; preview, cursor, busy, playback, and layout state remain presentation-only;
- public CommonJS exports and required browser globals remain available during migration;
- no rulebook-visible behavior changes.

## 4. Chosen architecture

### 4.1 Shared render-state source

Add `ui/board-visual/render-state-source.ts`. It exposes a pure factory whose instance owns only an optional prepared visual pair. Runtime access is injected through `getVisualStore`, `getTimelineOperationalState`, and `getLocalPair`; this module does not discover browser globals itself:

- read a snapshot through the read-only `peekRenderSnapshot` path with the existing compatibility fallback;
- resolve the current local runtime pair through `runtime-state-access`;
- resolve a single immutable pair for an operation;
- derive strict-network visual activity and network input epoch;
- validate a commit receipt and resolve its exact snapshot through `isCurrentCommitReceipt` plus `getSnapshotForReceipt`, with no local/latest fallback;
- push/pop prepared visual state for frame or DOM rendering.

`ui/board-renderer.ts` owns the browser-compatibility discovery functions and injects one source into `state-adapter`, stone-info, and the lazily loaded DOM compatibility renderer. Consumers that are intentionally used without the root renderer receive an explicit local-only source in their test/headless boundary. Prepared state remains scoped per consumer rather than becoming global canonical state.

Network store and timeline expose small operational snapshots for lagging/version/sequence and playing/paused/pending state. Normal render gating does not construct their full diagnostics objects; `getDiagnostics()` remains a debug/test surface.

### 4.2 Typed facade capability ports

Add `ui/board-visual/runtime-ports.ts` with narrow interfaces for:

- render submission and full refresh;
- controller readiness/configuration;
- input activation and preview;
- writer lifecycle and committed-frame settlement;
- geometry/layout;
- diagnostics and DOM-disc compatibility.

The existing flat facade implements the intersection of these ports. Callers may migrate incrementally without a runtime breaking change. `presentation-handler` receives the writer capability type instead of an unbounded `any` where practical.

### 4.3 Dedicated runtime factories

Each runtime is created once by `ui/board-renderer.ts` and receives explicit callbacks for the few cross-runtime operations it needs.

1. `layout-runtime.ts` owns sizing signatures, observers, element caches, expansion-layer geometry, and layout revision.
2. `input-runtime.ts` owns the board input controller, lock resolver, preview/cursor state, accessibility layer, and deferred overlay updates.
3. `backend-runtime.ts` owns backend selection, test injection, controller creation/configuration, readiness, initial fallback, context-loss recovery, and lazy DOM payload/style loading. Runtime construction itself is eager, but query selection, test-configuration fixation, backend creation, controller creation, and mount remain deferred until the first controller/readiness request, preserving post-require test injection.
4. `frame-runtime.ts` owns frame serial/session identity, revision composition, committed-world metadata, theme/font refresh, frame construction, and the atomic frame-apply transaction.
5. `writer-runtime.ts` owns synthetic auto-writer state and the facade wrappers for claim, validation, phase play, commit, settlement, recovery, and invalidation. Strict committed apply calls the render-state source's fallback-free receipt resolver once, builds the frame from that exact pair, retains the resulting frame for recovery, and never re-resolves a latest/local pair during retry.
6. `render-submission-runtime.ts` owns the one-shot prepared-update `WeakSet`, playback defer/invalidation decisions, frame submission, and occupancy refresh after accepted idle application.

Factories avoid module import cycles. Cross-runtime access is passed as lazy callbacks such as `getController`, `getInputController`, `buildFrame`, and `requestRender`. No runtime discovers another through browser globals.

### 4.4 DOM presentation helpers and explicit compatibility injection

Move generic disc DOM functions to `ui/presentation/disc-dom-renderer.ts`. `stone-visuals`, `visual-effects-map`, and the DOM patcher import that module directly.

DOM compatibility receives a frozen capability object from `backend-runtime` only when its lazy module has been evaluated. The object contains layout, input, render-refresh, time-stop, expansion-layer, and disc functions. `ui/board-renderer/stone-helpers.ts` and the `BoardRendererStoneHelpers` global bag are then removed. Required historical direct globals remain as thin aliases from the root facade until the classic compatibility surface can be retired separately.

### 4.5 Composition and control flow

`ui/board-renderer.ts` constructs runtimes in dependency order and closes the few cycles with lazy callbacks:

1. injected render-state source and layout runtime;
2. frame and input runtimes with lazy controller/render callbacks;
3. backend runtime with lazy input/layout/frame callbacks;
4. writer runtime with lazy controller/frame/occupancy callbacks;
5. render-submission runtime with lazy writer/controller/frame callbacks;
6. flat typed facade and explicit DOM compatibility capability provider.

The root module remains the only normal browser wiring surface. Runtime-dependent lookup remains at this outer boundary or inside the dedicated UI render-state source.

## 5. Alternatives considered

### Split the file by line ranges without factories

Rejected because module-scope state would remain shared through imports or new globals, and circular imports between input, backend, frame, and writer would become likely.

### Rewrite the entire facade as classes and native ESM

Rejected as unnecessarily broad. The browser still supports classic/CommonJS compatibility, and a simultaneous module-system rewrite would obscure behavior regressions.

### Move writer behavior into `BoardVisualController`

Rejected because the controller already has a stable backend/writer contract. Synthetic pending-playback adoption, occupancy refresh, snapshot receipt lookup, and browser presentation wiring are facade-side policy and should remain outside the controller.

### Remove DOM compatibility

Rejected because it is an explicit architecture requirement for capability failure and context-loss recovery.

## 6. Compatibility, failure, and concurrency

- The flat export object and browser globals remain stable.
- Runtimes are singletons per loaded board-renderer module, matching current behavior.
- `resetBoardVisualRenderSession` resets the frame, writer invalidation, input overlay, and presentation-only sound identity through explicit runtime reset methods.
- Backend replacement preserves controller checkpoints and context-recovery ownership.
- DOM compatibility injection occurs after lazy module availability and before backend construction; failure remains a hard fallback failure rather than a success-shaped no-op.
- Frame apply/rollback is moved as one unit. Layout measurement, frame presentation, committed-world presentation, viewport sizing, and rollback order are not changed.
- Prepared render state uses push/restore semantics so nested or failed rendering cannot leak a stale override.
- Receipt-bound render state has no fallback path. An invalid, stale, foreign, or missing receipt fails settlement before frame construction.
- Backend runtime creation does not freeze selection. Selection and controller construction become immutable only on the first controller/readiness request, matching the current test-injection contract.
- No timers, observers, subscriptions, or accessibility nodes are left without a reset/destroy owner.

## 7. Testing and verification strategy

Run focused checks after each extraction, then the full board contract bundle:

- render-state source: visual-state, readonly visual-store, runtime-state-access, committed manifest state;
- DOM dependency cleanup: DOM isolation, DOM renderer/patcher stone tests, stone visuals, visual effects;
- layout/frame: pixel sizing, frame presenter, live geometry, theme/font refresh, recovery contract;
- input: input controller, bootstrap input activation, Pixi/DOM input backend tests;
- backend: backend selection, initial fallback, context-loss recovery, DOM isolation;
- writer: visual controller, single-writer, animation engine, presentation handler, strict-network settlement;
- repository gates: `npm run typecheck`, `npm run check:window`, dependency-boundary checks, focused Jest, `npm run test:network:parity`, `npm run build:browser`, Pixi playback/fallback/cross-platform smoke checks, and selector checks.

Generated browser artifacts are updated through `npm run build:browser` and the default Vite delivery through `npm run build:vite`. Because modules are added and the legacy helper module is deleted, `npm run worker:prepare` and the worker-mirror parity check are mandatory final gates. Source files under `worker-public/`, `dist/`, registry, and Vite output are never edited directly.

## 8. Risks and mitigations

- **Brittle source-text tests:** convert exact-function-body assertions to behavior or module-boundary assertions before moving the relevant implementation; never delete the contract.
- **Import-cycle regression:** all cross-runtime references are injected callbacks; focused dependency checks prohibit reverse discovery.
- **Snapshot-pair drift:** every render operation captures one pair and passes it to model/frame consumers.
- **Fallback eager evaluation:** `backend-runtime` retains dynamic DOM loading and tests assert the default Pixi graph is isolated.
- **Settlement ordering:** move writer wrappers mechanically behind the same facade and run strict/local settlement tests before subsequent cleanup.
- **Receipt identity drift:** strict apply uses the exact receipt-bound pair once and recovery retains the built frame; general render-state resolution is prohibited on that path.
- **Backend test injection regression:** retain lazy selection/controller fixation and run post-require injection coverage before any cleanup.
- **Visual geometry drift:** move the complete apply transaction and run pixel/recovery/browser smoke checks.
- **Concurrent repository work:** inspect status before each commit and stage only task-owned files.

## 9. Completion conditions

- `ui/board-renderer.ts` is a compact composition/facade module and no longer owns layout, input, backend, frame, writer, or disc mutable implementation state.
- one-shot prepared render submissions are owned by `render-submission-runtime.ts`, not by the facade;
- all duplicated network/local render-state discovery uses `render-state-source.ts`;
- strict settlement rejects invalid receipts, builds from the exact receipt-bound snapshot, and recovery reuses that frame without a latest/local re-read;
- ordinary render-state gating uses lightweight store/timeline operational state rather than full diagnostics capture;
- typed capability ports cover the flat facade and strict presentation caller;
- `BoardRendererStoneHelpers` and `ui/board-renderer/stone-helpers.ts` are removed with explicit DOM compatibility injection in place;
- no Pixi/DOM concurrent mount or eager DOM compatibility evaluation is introduced;
- existing public APIs, browser globals, player-visible behavior, event order, committed-frame identity, and recovery semantics remain unchanged;
- focused tests, network parity, type/dependency checks, required browser build, and proportional browser/Pixi smoke checks pass;
- `build:vite`, `worker:prepare`, and mirror parity prove that added runtime modules are delivered and the removed helper is absent from generated, Vite, and worker surfaces;
- design, plan, architecture contract, generated browser outputs, final diff, and commit all match the implementation.

## 10. Self-review

The first draft proposed a single global render-state singleton. Review found that prepared-state overrides are deliberately scoped and temporarily nested in the state adapter and DOM renderer; a global override could leak across a failed or nested presentation. The design was revised to share one implementation through per-consumer factory instances with push/restore semantics.

The first draft also proposed moving synthetic writer adoption into the controller. Review against section 7.3 showed that the controller should retain only backend/writer mechanics, while pending-playback adoption and browser snapshot wiring remain facade-side orchestration. `writer-runtime.ts` therefore wraps the controller instead of extending its authority.

Finally, direct removal of all browser globals was narrowed. The hidden mutable helper bag is removed, but documented classic compatibility globals remain thin aliases so this refactor does not become a browser-runtime migration.

Independent review found five material gaps and the design was revised accordingly: receipt-bound strict state is now a fallback-free API; browser discovery is injected from the composition boundary; backend fixation remains lazy; one-shot render submissions have an explicit runtime owner; and Vite plus Worker mirror generation/parity are mandatory completion gates.

## 11. Completion record

Implementation landed in commit `46b0e71b1` (`Decompose board renderer runtime`). The focused board/UI regression set passed 61 suites and 674 tests; network parity passed 35 suites and 564 tests. Type, architecture, generated-delivery, Worker mirror, Pixi playback/fallback, and Chromium/Firefox/WebKit desktop/mobile smoke gates also passed. No player-visible rule or behavior specification changed.

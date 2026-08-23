# Card / turn runtime static composition convergence implementation plan

- Status: reviewed implementation plan; implementation not started
- Date: 2026-08-24
- Design authority: `docs/implementation/card-runtime-static-composition-design.md`
- Document role: reviewed design を、挙動不変・green-to-green・coherent commit 単位で実装するための実行計画
- Target outcome: card / turn canonical dependency selection を outer runtime composition へ移し、required dependency 不足を authority mutation 前に fail-closed にする
- Player-visible specification: unchanged
- Public API surface/signatures / network wire / saved-data / model format: unchanged; invalid-composition success fallback is intentionally removed

## 1. Objective and delivery rules

実装完了時、classic、Vite、headless、local server、Worker、CPU / small selfplay は同じ canonical card / turn services を使い、`game/` core は実行中に module / global discovery や別 rule body fallback を行わない。

Delivery rules:

1. Design authority を最初から最後まで守る。source evidence が前提と矛盾する場合は、実装を進める前に design と plan を更新し、再 review する。
2. 各 step は単独で build / focused test 可能な coherent green commit にする。大きい step は本文の substep ごとに commit する。
3. characterizing old behavior と implementing new behavior を同じ未検証 diff に混ぜない。
4. old/new comparison は同一 seed/input から独立再構築した runtime/state/instrumented PRNG で行い、production action を shadow execute しない。
5. Complete supported runtime の RNG routing、pending state machine、CPU policy、network protocol、Pixi/UI behavior を変更しない。Invalid composition の success-shaped query/alternate-action fallbackだけは tagged `runtime_unavailable` / activation failureへ harden する。
6. `01-rulebook.md` または `正本/*.md` の変更が必要だと判明した場合は、behavior-preserving premise が崩れているため停止し、user decision を求める。
7. generated / mirror file を source edit しない。root TypeScript / generator owner を変更して existing scripts から再生成する。
8. unrelated dirty files は stage、commit、revert、削除しない。target file に重なる変更があれば停止する。
9. test failure を skip、allowlist、期待値緩和で消さない。retry が pass した場合も initial failure と原因推定を記録する。
10. long selfplay / training job は実行しない。
11. Ownership switch の有無にかかわらず、browser/Worker の production-reachable graph を変える全 commit は `worker:prepare` と説明可能な generated/mirror diff、actual current-owner production-entry proof を同じ commit に含める。同期を省略できるのは non-shipping module/fixture が production graph と shipping output の双方から到達不能だと machine check した場合だけである。
12. `runtime_unavailable` はcanonical validator/composer/明示required assertionだけが生成するnominal tagとする。consumerはcanonical classifierでtagだけを既存fallbackより先に分岐し、rule/programming exception、message/code spoof、任意のcatch-allをdependency failureへ変換しない。untagged exceptionは各catch siteの現行fallback/既定値/伝播をexactに保つ。
13. Complete service graph validationをgameplay/match readiness barrierに置く。action-time tagはruntime-integrity breachとしてterminal recoveryへ送り、normal rule resultにしない。
14. usability query failureを`false`/`[]`/`null`へ畳まず、AUTO/timeout/direct pass、CPU alternative action、UI publishをmutation前に中止する。
15. Healthy supported runtimeではpublic facadeのkeys/signaturesだけでなく、observed object/function alias identity、property descriptors/symbol/prototype、module evaluation/registration order、module-scoped state lifetimeもexact parityとする。

## 2. Expected task-owned files

Exact path は Step 1 inventory で既存 naming / cycle boundary と照合する。次は ownership map であり、不要な file を作る quota ではない。

### 2.1 Conditional hermetic-gate prerequisite commit

- `package.json`;
- `.github/workflows/node-test.yml`;
- `scripts/run-all-checks.ts` and its canonical launcher / forwarding test;
- focused checker-runner tests under `scripts/__tests__/` or `test/`.

この prerequisite は clean-clone proof が現行 `HEAD` で失敗した場合だけ実装する。artifact transaction、Jest project 分割、docs lifecycle を同じ commit に含めない。

### 2.2 New canonical contracts and composition

Preferred locations:

- `game/logic/card-runtime-contracts.ts` — narrow readonly card service groups、validator、cohort ownership types;
- `game/logic/card-runtime-errors.ts` — nominal runtime-integrity error/tag、唯一のfactory、canonical classifier; contractsと同一fileで十分なら分割しない;
- `game/logic/card-runtime-composer.ts` — canonical static/default composition root;
- `game/logic/cards-runtime-factory.ts` — canonical implementation factory that consumes named ports and never imports composer/facade/adapters;
- `game/logic/cards-legacy-facade.ts` — 289-key compatibility projection combining factory and a complete composer;
- `game/turn/turn-runtime-services.ts` — required phase manifest / turn service contract and validator;
- `cards/card-runtime-preview-query-adapter.ts` — dormant until Step 6, then owns tag-only preview-query propagation and browser integrity-latch handoff;
- `game/ai/card-runtime-query-adapter.ts` — dormant until Step 6, then owns tag-only CPU legality/candidate-query propagation without policy changes;
- closest existing browser boot/runtime-failure owner and CPU turn/scheduler owner — terminal recovery for a defensive post-activation integrity fault; do not add a parallel gameplay state machine;
- `workers/match-worker-game-runtime.ts` — Worker adapter が必要なら frozen `MatchGameRuntime` owner;
- closest existing browser/classic composition boundary instead of a duplicate bootstrap framework.

一つの file が責務を十分に表せるなら、上記を機械的に分割しない。逆に card / turn / runtime adapter を一つの巨大 factory file にまとめない。

### 2.3 Existing canonical consumers and adapters

- `game/logic/cards.ts`;
- `game/logic/cards-internal/module-resolver.ts` and Gate B manifest canonical-required card modules;
- `game/cards/effect-resolver.ts`;
- `game/turn/turn_pipeline.ts`、`turn_pipeline_factory.ts`、`turn_pipeline_phases.ts`;
- `game/turn/pending-coordinator.ts` only to replace whole-CardLogic discovery/cache with a narrow pending port;
- `workers/match-worker-runtime-preload.ts` and closest Worker runtime owner;
- `scripts/local-match-server.ts` only at the existing shared command runtime boundary;
- `browser-vite/main.ts` / `ui/bootstrap.ts` / `entry-browser.js` only at their existing composition responsibilities;
- `game/cpu-decision.ts` or a narrowly extracted existing CPU failure boundary — tagged dependency failureだけを現行query/alternate-action fallbackより先にintegrity ownerへ分岐し、untagged exceptionの現行alternate query/既定値/伝播は保つ; do not change complete-runtime CPU policy;
- `game/cpu-turn-handler.ts` / `game/cpu-turn-scheduler.ts` only at the existing turn boundary — tagged integrity failure releases processing, invalidates/cancels retry scheduling, preserves canonical pending, and never enters the generic clear-pending/retry path;
- `cards/card-interaction.ts` or a narrowly extracted existing preview bridge — tagged dependency failureだけを現行success-shaped boolean/query fallbackより先にintegrity ownerへ分岐し、untagged exceptionの現行alternate query/既定値/伝播は保つ; do not change complete-runtime canonical legality、UI flow、or network payload;
- `scripts/build-module-registry.ts` only if classic generated order must be derived from a new source module.

Do not move authority into `ui/`, Worker adapter, local server, selfplay runner, or generated registry.

### 2.4 Tests, fixtures, and structural checks

Likely new owners:

- `test/helpers/card-runtime-contract-fixtures.ts`;
- `test/game.card-runtime-composition.test.ts`;
- `test/game.card-runtime-failure-atomicity.test.ts`;
- `test/game.card-runtime-query-failure.test.ts` — preview/CPU dependency-sensitive query propagation and success-shaped fallback prohibition;
- `test/game.card-runtime-error-classification.test.ts` — only canonical constructors produce the nominal tag; rule/programming/message/code-spoof exceptions are not reclassified;
- `test/game.cards-api-identity.test.ts` — facade/alias/function/descriptor/symbol/prototype/repeated-load and evaluation/registration contract;
- `test/game.turn-runtime-pass-failure.test.ts` — usability dependency failure cannot become AUTO/timeout/direct pass;
- `test/cpu.turn-handler.runtime-unavailable.test.ts` — processing/scheduler/timer/pending terminal recovery with no retry or alternative action;
- `test/ui.card-runtime-integrity-failure.test.ts` — input/publish latch、uncommitted preview cancellation、canonical pending preservation、reload-required surface;
- `test/game.turn-runtime-composition.test.ts`;
- `test/game.turn-runtime-failure-atomicity.test.ts` — direct/AUTO/timeout/phase entry failure before first observable effect;
- `test/runtime.card-runtime-delivery-parity.test.ts` or smaller runtime-specific files;
- `test/fixtures/card-runtime-delivery/worker-entry.ts`、`vite-entry.ts`、`classic-entry.ts` — non-shipping preparation entries built with production-equivalent settings into temporary output;
- `scripts/worker-bundle-smoke.ts` — retain canonical mode and temporarily add an explicit validated `--fixture-entry` mode that uses the same Wrangler dry-run path but never writes shipping output;
- `scripts/check-card-runtime-boundary.ts` plus normal TypeScript build output;
- `scripts/check-card-runtime-dist-parity.ts` — non-Jest child-process proof for built dist / legacy wrapper plus owned ephemeral built local-server command scenario;
- `scripts/card-runtime-browser-parity-check.ts` — actual built Vite/classic page proof on an ephemeral test server;
- `test/e2e/card-runtime-delivery-parity.e2e.test.ts` only if the browser check reuses the existing Jest/Playwright lifecycle;
- `test/fixtures/card-runtime-contract.v1.json` only if a reviewed stable machine-readable inventory is preferable to code fixtures.

Required package/check wiring after these owners are stable:

- `check:card-runtime-boundary`: build the canonical script snapshot, then execute `dist/scripts/check-card-runtime-boundary.js`;
- `check:card-runtime-dist-parity`: run `build:ts`, then execute `dist/scripts/check-card-runtime-dist-parity.js` in a normal Node child process without Jest resolver hooks, covering built facade/legacy wrapper and a built local match-server command scenario on an owned ephemeral port with teardown;
- `match:card-runtime-delivery-check`: run `build:vite`, then execute `dist/scripts/card-runtime-browser-parity-check.js`, which owns an ephemeral server/browser lifecycle;
- `match:card-runtime-worker-fixture-check`: preparation-only package script invoking `worker-bundle-smoke` fixture-entry mode against the reviewed fixture source and temporary output;
- `checkall` integration for the hermetic structural guard and its negative self-fixture.

The non-shipping fixture entries must be absent from production module registries、`vite-dist/`、`worker-public/`、and public boot entries. They and the Worker fixture-only CLI/package wiring are transitional: keep them through runtime preparation, replace them with lane-specific actual production-entry proof during cutover, and delete them in Step 8 after every actual entry proves the complete graph.

Existing test owners to extend rather than duplicate include:

- `test/game.cards-api-export-inventory.test.ts`;
- `test/game.card-usage-pending-stage.test.ts`;
- `test/cards.pending-selection-contract.test.ts`;
- `test/game.pending-coordinator.contract.test.ts`;
- `test/game.turn-pipeline-phases-mode-di.test.ts`;
- `test/game.turn-pipeline-action-stage.test.ts`;
- `test/scripts.worker-runtime-preload.test.ts`;
- `test/workers.match-worker-card-preload.test.ts`;
- `test/browser-vite.classic-compat-loader.test.ts`.

### 2.5 Stable docs and generated delivery

- `docs/architecture-contracts.md` only after actual owner cutover;
- this design / plan execution record;
- generated `dist/`, browser/Vite delivery, `public/module-registry.js`, cachebusters, and `worker-public/` only through existing commands.

No `01-rulebook.md`、`正本/*.md`、card catalog、model asset、network schema change is expected.

## 3. Step 0 — Satisfy Gate A

### Outcome and rationale

Begin from a reproducible green baseline. A cross-runtime authority refactor cannot safely start when the checker itself depends on untracked build output or another task is changing the same rule / delivery surfaces.

### Actions

1. Read the final design and this plan completely.
2. Read root `AGENTS.md` and every nested `AGENTS.md` applicable to each target before editing it.
3. Run `git status --short`; classify all entries as task-related, unrelated, generated/mirror, or unknown.
4. Stop if another task changes card / turn source, browser registry, Worker preload, or generated delivery needed by this task.
5. Create a clean temporary clone from current committed `HEAD`, with an explicitly resolved path outside the workspace. In that clone run:

```powershell
npm ci
npm run checkall
```

6. Confirm whether external CI or repository lifecycle performs a prebuild not visible in `package.json` / workflow. Record evidence, not an assumption.
7. If clean-clone `checkall` fails because ignored `dist` is required before any build, complete a **separate prerequisite commit**:
   - use the canonical full script build (`tsc -p tsconfig.build.json` or its repository-owned equivalent) to compile the runner and every directly referenced `dist/scripts/*` checker before the launcher needs them;
   - invoke the resulting runner from one build snapshot;
   - keep failure exit codes / signals exact;
   - add missing runner、each directly referenced checker missing、compiler failure、child nonzero、signal fixtures;
   - run the same `npm ci && npm run checkall` in a fresh temporary clone;
   - make CI use the repository-contained bootstrap;
   - confirm the check does not leave unexpected tracked diffs.
8. Do not add staging/atomic generation redesign to this prerequisite. Open a separate design if that P0 candidate is selected later.
9. In the main checkout, establish baseline:

```powershell
npm run build:ts
npm run typecheck
npm run check:window
npm run checkall
npm run worker:bundle:smoke
```

10. Record current 289-key inventory hash, Worker preload count, focused suite counts, warnings, and elapsed time. Key + kind / semantic schema and all-lane module identity belong to Step 1.
11. Confirm no long-lived local browser server conflict. Do not start a browser server until a browser step needs it.

### Failure handling

- If the temporary clean clone fails for a different reason, diagnose that exact baseline failure before card source edits.
- If unrelated changes overlap, stop and report exact files; do not create a worktree without user authorization.
- If `worker:bundle:smoke` is red, repair it as a separate prerequisite owner task, not inside card composition commits.
- If the baseline is red only because another active task has partially updated generated delivery, wait for or coordinate that task; do not normalize its files.

### Done when

- fresh clone check/build bootstrap is demonstrated;
- executable Worker bundle smoke is green;
- no overlapping dirty changes exist;
- environment / export-hash / focused-test evidence is recorded;
- any prerequisite repair is separately committed and the main checkout is resynchronized.

### Commit

If needed: `build: make checks boot from a clean clone`. Do not include card runtime source in this commit.

## 4. Step 1 — Build a machine-readable characterization baseline and satisfy Gate B

### Outcome and rationale

Prove what every loader, fallback, public export, mutation, event, and PRNG path does before moving dependency ownership. This step changes tests / fixtures / read-only inventory / characterization delivery-check tooling only; game/runtime product source remains unchanged.

### Actions

1. Inventory every dependency reachable from the public card facade and turn phase manifest with fields:
   - capability / symbol;
   - canonical source module;
   - current selection order in Node/headless, local, Worker, Vite, classic;
   - required / runtime-adapter-required / optional / compatibility-only class;
   - current fallback behavior;
   - stateful or state-independent lifetime;
   - migration cohort;
   - existing test owner;
   - graph disposition: canonical-required、outer-adapter allowlisted、out-of-scope consumer、generated wrapper.
2. Define manifest roots and edge kinds explicitly:
   - stable card facade and canonical implementation factory roots;
   - turn pipeline / phase-manifest roots;
   - static import、type-only import、DI port、compatibility resolution、whole-facade cache edges;
   - stop traversal at consumer boundaries such as UI/CPU/selfplay after recording their public-facade edge; do not pull their algorithms into the canonical service closure.
3. Record every ambient lookup form in the reachable graph:
   - `require` / `__non_webpack_require__`;
   - `globalThis` / `self` / computed global key;
   - lazy / dynamic import;
   - service locator or cached whole `CardLogic` reference;
   - duplicate fallback rule body.
4. Extend the 289-key API inventory with:
   - key + value kind schema;
   - important constant values;
   - module/default unwrap cases;
   - classic global registration names;
   - representative semantic probes;
   - all own-key property descriptors、symbol keys、prototype;
   - facade object and function alias/reference groups across CommonJS/default/global/module bridge;
   - repeated import/load identity、module evaluation/registration count/order;
   - module-scoped mutable registry/cache/counter/reset/reconstruction ownership.
5. Build a machine-readable `MutationEntryManifest` whose mandatory subset is every function in the 289-key facade and whose full scope also includes every resolver/phase/command/module-bridge/global export directly reachable as a production or public compatibility entry:
   - classify it as mutator、query、or presentation-only;
   - record `writesCanonicalState`、`writesRuntimeState`、`appendsOrDrainsEvents`、`consumesRng`、`pure`、and `dependencySensitive`; `pure` requires all observable-effect flags false but may still be dependency-sensitive;
   - for every non-pure function record required cohort、`firstObservableEffect`、preflight owner、failure-normalization owner、runtime consumers、and exact test owner;
   - for every dependency-sensitive query record capability cohort、activation-preflight owner、tagged-failure propagation owner、success-shaped fallback prohibition、runtime consumers、and exact test owner;
   - include card usage、effect-resolver cancel/refund entries、turn-start/direct phase/action exports、direct turn apply、AUTO/timeout/command wrappers、pending continuation/cancellation、hand/charge/usage/reset/refund、PRNG-consuming query、event append/drain、module-scoped runtime setting、module-bridge/global export、preview/legality query、and any less-obvious public entry rather than assuming the facade、`applyCardUsage()`、or `applyTurn()` are exhaustive;
   - for each direct entry, require either self-preflight before `firstObservableEffect` or machine proof that every production/public route reaches it only through a preflighted outer entry; explicitly classify unsupported direct/test-only entries at Gate B;
   - fail Gate B when a function、effect/dependency flag、or required metadata field is unclassified.
6. Do not use function source hash or `function.length` as a stable contract.
7. Create fixed-seed exact-output fixtures covering at least:
   - immediate, pending, multi-stage, targetless, cancel, refund, no-consume, usage-reset variants;
   - turn-start, marker/protection/permanent/bomb, expanded board topology;
   - complete / absent / classifier-only cancellation manager;
   - AUTO / timeout shared command entry;
   - CPU and small selfplay through the public facade;
   - required dependency missing before apply;
   - UI preview / legality probe unavailable behavior.
8. For parity, do **not** deep-clone state containing PRNG objects and do not share one mutable PRNG between old/new executions. Construct old and new runtime/state independently from the same seed/input and bind separate instrumented PRNGs to every current alias according to existing precedence.
9. Define a canonical-state comparator:
   - inventory every runtime-only RNG/action reference retained in state;
   - replace each runtime-only reference with a deterministic descriptor for old/new canonical comparison;
   - compare presence、alias-group topology、selected source、non-shared old/new identity、serializable PRNG state、call ledger separately;
   - keep snapshot/save JSON exact equality;
   - use same-instance pre/post raw equality only for failure-atomicity tests.
   - keep facade/module identity outside canonical state and compare it through a separate `FacadeIdentityManifest`; never normalize away an identity/evaluation mismatch.
10. Capture before/after fields:
   - canonical-comparator `gameState` / `cardState`;
   - serialized snapshot/save and authoritative/projected hash;
   - charge, hand, discard, usage count, refund;
   - full pending payload / identity / stage / `pendingEffectId`;
   - raw `events[]` and presentation event order;
   - PRNG state immediately before/after and call count;
   - selected PRNG source、full call ledger、bind/unbind timing、runtime-to-runtime identity non-sharing;
   - network accept/reject, stateVersion, operation record, journal, SSE payload.
11. Add concurrent two-game fixture proving no state, pending instance, events array, or RNG reference leaks between runtime invocations.
12. Map each catalog/card family to an existing exact test or a new fixture. Do not add duplicate tests where an existing test already proves the invariant.
13. Record exact current and target mapping for activation failure、Worker preload failure、direct canonical rejection、UI preview unavailable、CPU runtime unavailable. Explicitly characterize:
   - `cards/card-interaction.ts:1275-1295` preview fallthrough to alternate query/`true`;
   - `game/cpu-decision.ts:2025-2057` fallthrough to alternate query/candidate evaluation;
   - `game/turn/turn_pipeline_phases.ts:1113-1127` AUTO pass dependence on `hasUsableCard()` and `:1432-1443` empty-context fallback;
   - `game/cpu-turn-handler.ts:2005-2041` generic pending-clear/retry behavior and scheduler generation/timer ownership.
   The target keeps complete-runtime results and wire/schema stable but removes invalid-composition success-shaped fallback; internally, runtime failure remains distinct from rule-level unavailable.
14. Determine whether complete / absent / classifier-only cancellation managers are supported production graphs or incomplete test/compatibility graphs.
15. Verify source, built dist, Worker bundle, Vite, and classic module identity separately; source Jest alone is insufficient. Use the `FacadeIdentityManifest` to compare facade object、function aliases、descriptors/symbol/prototype、evaluation/registration trace、repeated boot/load、Worker Durable Object reconstruction、runtime replacement.
16. Add baseline delivery-check owners now, before product cutover:
   - `check:card-runtime-dist-parity`: non-Jest child process loads built dist / legacy wrapper、runs a built local match-server command scenario on an ephemeral port、tears it down、and emits API schema plus fixed-fixture digest;
   - `match:card-runtime-delivery-check`: actual built Vite/classic entries run the same independent-PRNG fixture on an ephemeral test server;
   - `match:card-runtime-worker-fixture-check`: explicit test-only `worker-bundle-smoke --fixture-entry` mode bundles/executes the reviewed Worker fixture through Wrangler dry-run into temporary output;
   - add package scripts and teardown/error fixtures, but do not change game/runtime product behavior.
17. Add dedicated non-shipping Worker、Vite、classic fixture entries for later composer-preparation proof. Reuse each production compiler/bundler configuration、alias、plugin、and module-order rule, emit only temporary test output, and add an assertion that no fixture entry appears in production registry、`vite-dist/`、`worker-public/`、or public boot HTML.
18. Define the nominal failure taxonomy before any product source edit:
   - one canonical constructor/factory and `isCardRuntimeUnavailableError()` classifier;
   - validator/composer/explicit required assertion are the only allowed producers;
   - raw message/code、plain object、arbitrary `instanceof` failure、rule exception、programming exception are negative fixtures;
   - UI/CPU/network/headless consumersはtagだけを既存fallbackより先にintegrity ownerへ分岐し、untagged exceptionはcatch siteごとにcharacterizeしたcurrent alternate-query/既定値/伝播を維持する;
   - `getUsableCardIds`、`analyzeCardUsability`、`getCardContext`、`hasUsableCard`へuntagged `TypeError`を注入し、tagged failureとは異なるcurrent result/fallback/propagationを固定する。
19. Build a machine-readable recovery-state matrix for Vite/classic boot、UI preview/action、CPU turn/scheduler、AUTO/timeout/direct pass、Worker/local command、headless/selfplay. Record pre/post canonical state/pending/turn/version/PRNG/events、busy/input lock owner、CPU processing/retry generation/timer set、retry/alternate action/publish count、terminal player surface.
20. Prove supported-runtime status with actual production/public compatibility entries. If any official lane、rollback lane、generated bundle、or public compatibility test intentionally accepts a partial graph, stop and revise the design; do not relabel it unsupported from absence assumptions.

### Focused verification

```powershell
npx jest --runInBand --runTestsByPath `
  test/game.cards-api-export-inventory.test.ts `
  test/game.cards-api-identity.test.ts `
  test/game.card-runtime-error-classification.test.ts `
  test/game.card-runtime-query-failure.test.ts `
  test/game.turn-runtime-pass-failure.test.ts `
  test/cpu.turn-handler.runtime-unavailable.test.ts `
  test/ui.card-runtime-integrity-failure.test.ts `
  test/game.card-usage-pending-stage.test.ts `
  test/cards.pending-selection-contract.test.ts `
  test/game.pending-coordinator.contract.test.ts `
  test/game.turn-pipeline-phases-mode-di.test.ts `
  test/game.turn-pipeline-action-stage.test.ts `
  test/scripts.worker-runtime-preload.test.ts `
  test/workers.match-worker-card-preload.test.ts `
  test/browser-vite.classic-compat-loader.test.ts
npm run check:card-runtime-dist-parity
npm run match:card-runtime-delivery-check
npm run match:card-runtime-worker-fixture-check
```

Add new characterization paths to this invocation after their exact filenames are chosen.

Step 1の新規failure/identity testは **current-characterization mode** で実行する。このstepでは現行alternate-query/default/propagation、CPU generic pending-clear/retry、UI state、pass/turn resultをgreen baselineとして記録し、target production recoveryをまだ要求しない。Target mappingはmachine-readable fixture/contractとしてcurrent mappingと対で固定し、no auto-pass/retry/pending-loss/alternate-actionというtarget invariantのschema/completenessだけを検証する。まだ存在しないproduct error moduleやadapterをimportするtarget suite、skip/pending/red testは作らない。Dormant target adapter/recovery assertionはStep 5、production assertionはStep 6/7で初めて有効化する。

### Failure handling

- A current fallback reached on a supported valid runtime is not deleted. Mark it as a migration requirement and revise the design if outer composition cannot represent it.
- A mismatch between rulebook and current behavior is not silently blessed as characterization; stop for a product/spec decision.
- If a **target-mapping** failure fixture permits AUTO/timeout/direct pass、canonical pending clear、CPU reschedule、or UI/network action publish, or if the corresponding current mapping cannot be characterized, Gate B fails. Current-characterization modeが現行のpending clear/retry等を記録すること自体はGate B failureではなく、Step 5以降で置換すべきbaselineである。
- If a generic rule/programming exception is classified as `runtime_unavailable`, Gate B fails; fix taxonomy/ownership before product edits.
- Do not change game/runtime product source to make characterization easier. Test/delivery-check tooling may change within the stated scope.

### Done when

- every reachable runtime lookup / fallback has owner, class, runtime path, migration cohort, and proof;
- every manifest node has a disposition and canonical-required has no unclassified nodes;
- every 289-key facade function and every production/public direct resolver/phase/command/module-bridge/global entry has complete effect/dependency flags; every non-pure function has cohort、first-observable-effect、preflight/failure owner、runtime-consumer、test-owner metadata; every dependency-sensitive query has activation-preflight/tagged-propagation/fallback disposition; every direct entry has self-preflight or preflighted-outer-only reachability proof;
- exact fixtures are green on current `HEAD`;
- API schema is stronger than key hash alone;
- `FacadeIdentityManifest` and evaluation/module-state baseline are complete in every supported lane;
- all supported lanes and failure mappings are recorded;
- nominal tag producers/classifier and untagged-exception catch-site behavior fixtures are fixed;
- recovery-state matrix proves no auto-pass、alternate action、CPU retry loop、pending loss、post-failure publish、or orphaned lock;
- partial-manager reachability is decided;
- non-shipping delivery entries reuse production-equivalent build settings and are proven absent from every shipping manifest/output;
- no game/runtime product source changed.

### Gate B review

Before Step 2:

1. write the exact graph roots/boundaries、complete `MutationEntryManifest`、`FacadeIdentityManifest`、nominal failure taxonomy、recovery-state matrix、external failure mappings、partial-manager/supported-runtime decision、fixture-entry shipping-absence proof、and baseline result into this plan's execution record;
2. update the design if any assumption changed;
3. request independent architecture and gameplay-authority review;
4. do not edit product source until the review has no unresolved P0/P1 finding.

### Migration-state contract for Steps 2–8

| Plan state | Production owner | Allowed new behavior claim |
| --- | --- | --- |
| Steps 0–1 | current legacy in every lane | characterization only |
| Step 2 | current legacy in every lane | contracts/validator plus active boundary-check ratchet with owned legacy allowlist |
| Step 3 | current legacy through cycle-free factory/facade | file DAG and isolated default composer only |
| Steps 4–5 | current legacy in every lane | all runtime composers and dormant UI/CPU tagged-failure adapters ready in isolated/built harnesses; production command/query is not lookup-free |
| Step 6 per card cohort | same selected cohort and its dependency-sensitive query adapters use injected services in every lane; other cohorts have one fixed legacy owner | selected cohort parity、preflight、tagged-failure propagation only |
| Step 7 per turn cohort | same selected cohort uses static manifest in every lane | selected turn cohort parity and preflight only |
| Step 8 | all canonical-required nodes static | aggregate lookup-free / failure-atomic completion claim |

No step may claim a later state early. A new capability failure never retries the old owner. A failed cutover means the coherent task commit is not landed or is reverted; it does not enable a runtime fallback flag.

### Commit

`test: characterize card runtime composition`.

## 5. Step 2 — Add typed immutable service contracts without cutover

### Outcome and rationale

Introduce the target shape and completeness validation while every production consumer still uses current behavior. Avoid replacing an untyped dependency bag with one typed god object.

### Actions

1. Add narrow readonly service groups for:
   - state / deck / hand / charge;
   - target / legality;
   - board / topology;
   - marker / protection;
   - pending capability;
   - canonical resolution;
   - presentation-only metadata.
2. Add `TurnRuntimeServices` with static phase manifest, BoardOps, card services, and protection-context capability.
3. Add stage-local invocation types. A root invocation aggregate may be used only by facade/orchestrator; leaf modules accept named narrow ports or reviewed `Pick<>` subsets.
4. Make `randomSource` / `actionMeta` optional projections of values already created at the current stage. Composer / validator must not eagerly resolve or create them.
5. Keep current RNG discovery / hidden execution fields, precedence, and bind/unbind timing unchanged. Do not add a new RNG owner.
6. Implement pure presence/schema validation:
   - no target enumeration;
   - no card availability evaluation;
   - no deck builder execution;
   - no board mutation;
   - no random draw.
7. Shallow-freeze copied capability wrapper shells; do not deep-freeze imported module objects.
8. Add tests rejecting mutable/stateful service values, missing required capability, and invalid optional capability.
9. Add compile/static acceptance that leaf signatures do not receive root aggregate、whole `CardLogic`、`any` dependency bag、index signature.
10. Add `LegacyCardLogicApi` projection type/factory that preserves current 289-key facade without making that facade the internal port.
11. Add `CohortOwnershipManifest` requiring exactly one construction-time owner per capability and prohibiting failure-time retry to the other owner.
12. Add negative fixture proving validator invocation leaves PRNG, state, pending, and events unchanged.
13. Fix the import DAG in code/tests: contracts; canonical leaves; composer; implementation factory; facade projection; stable entry; runtime adapters. Add cycle / forbidden-edge tests.
14. Add `scripts/check-card-runtime-boundary.ts` now, with negative self-fixtures for each prohibited lookup / dependency form. Seed it from the Gate B graph and `MutationEntryManifest`.
15. Represent every current canonical lookup as an explicit legacy allowlist entry with node、lookup form、owner、reason、and mandatory removal cohort. The checker must reject a new entry or expanded pattern unless the reviewed manifests are updated; every later cohort must monotonically shrink the allowlist, and Step 8 must reduce the canonical allowlist to zero.
16. Add `check:card-runtime-boundary` to `package.json` and the hermetic `checkall` bundle in this step. The checker enforces import direction、root-aggregate confinement、whole-facade-cache restrictions、stateful-service restrictions、and current/future ambient lookup dispositions from the beginning of migration.
17. Add the nominal runtime-integrity error contract and structural guard:
   - only validator/composer/explicit required assertion can call its factory;
   - all consumers use the canonical classifier and catch only that tag;
   - checker rejects catch-all retagging、message/code matching as authority、and duplicate tag factories;
   - untagged exceptions retain each catch site's current fallback/default/propagation; no blanket rethrow rule is introduced.
18. Add `FacadeIdentityManifest` types/fixture helpers without changing the current facade. Validate descriptor/alias/evaluation records deterministically but do not freeze or clone the live legacy export.
19. Do not switch runtime consumers or delete resolver code in this step.

### Verification

```powershell
npm run typecheck
npm run build:ts
npm run check:window
npm run check:card-runtime-boundary
npm run checkall
npx jest --runInBand --runTestsByPath `
  test/game.cards-api-export-inventory.test.ts `
  test/game.cards-api-identity.test.ts `
  test/game.card-runtime-error-classification.test.ts `
  test/game.card-runtime-composition.test.ts `
  test/game.card-runtime-failure-atomicity.test.ts
```

### Done when

- contracts are narrow and readonly;
- root aggregates are confined to composer/facade/orchestrator;
- file-level import DAG is enforceable and cycle-free;
- the structural checker is hermetic、wired into `checkall`、and pins every legacy canonical lookup to an owned removal cohort;
- complete / incomplete service graphs are deterministic;
- validation has zero gameplay side effect and zero PRNG draw;
- nominal error production/classification is unique and cannot swallow generic exceptions;
- facade identity/evaluation baseline remains unchanged;
- production behavior and public facade remain unchanged.

### Commit

`refactor: define card runtime services`.

## 6. Step 3 — Extract a cycle-free factory and prepare the Node/headless composer

### Outcome and rationale

Establish the target import DAG and first static composition root without changing any production lane's dependency owner.

### Actions

1. Mechanically extract the current implementation body to `cards-runtime-factory.ts`; it imports contracts / named ports but never composer、facade、runtime adapter. During this move, forbid rule/control-flow edits、renames、formatting sweeps、typing cleanup、exception-policy changes; use a moved-symbol/body manifest and diff review to account for every non-move line.
2. Make `cards.ts` a stable compatibility entry over `cards-legacy-facade.ts`; preserve all keys、constants、signatures、globals、module/default unwrap、facade/function alias identity、property descriptors/symbol/prototype、module evaluation/registration order、module-scoped state/reset semantics.
3. Keep the current dependency owner active through a named temporary migration owner. This step is a file/DAG move, not a dependency cutover.
4. Add canonical default composer using static TypeScript imports for the Step 1 required service inventory. Composer imports canonical leaves and contracts, never factory/facade.
5. Construct and validate the default frozen service graph in a test harness; do not route production headless/local actions through it yet.
6. Invoke factory + new graph only in independent parity fixtures reconstructed from the same input/seed. Do not shadow a production action.
7. Run concurrent two-game and multi-room fixtures to prove static services do not capture state / RNG / events.
8. Confirm local server still uses the existing shared game / match-command entry and current production owner.
9. Reuse the Gate B `check:card-runtime-dist-parity` owner and extend it only where the new cycle-free factory requires an additional built path.
10. Treat the `cards.ts` → facade/factory extraction as a production-reachable delivery change even though dependency ownership is unchanged. Run `worker:prepare`, inspect registry/cachebuster/mirror diffs, and include every explained generated output in this same Step 3 commit.
11. Prove the **actual current-owner** Vite/classic/Worker entries still expose and execute the legacy-compatible facade after extraction; isolated new-composer fixtures do not replace this proof.
12. Repeatedly load/boot each lane and reconstruct Worker Durable Object/runtime generation. Compare `FacadeIdentityManifest` and evaluation trace before/after; prove factory construction does not duplicate current singleton registries/caches or leak mutable module state between games.
13. If the mechanical move plus facade cannot fit one reviewable coherent commit, split only at a behavior-neutral facade/factory seam with every intermediate revision buildable and actual-entry green. Never combine a large move with rule cleanup to reduce commit count.

### Verification

```powershell
npm run typecheck
npm run build:ts
npm run check:window
npm run check:card-runtime-boundary
npm run check:card-runtime-dist-parity
npx jest --runInBand --runTestsByPath `
  test/game.card-runtime-composition.test.ts `
  test/game.cards-api-export-inventory.test.ts `
  test/game.cards-api-identity.test.ts `
  test/game.pending-coordinator.contract.test.ts `
  test/game.card-usage-pending-stage.test.ts `
  test/game.turn-pipeline-action-stage.test.ts
npm run worker:prepare
npm run worker:bundle:smoke
npm run match:card-runtime-delivery-check
```

Run the Step 1 exact fixture manifest through independently constructed factory direct call and legacy facade. Headless/local production authority remains baseline until Step 6.

### Done when

- cycle-free factory / composer / facade DAG is established;
- public CardLogic remains exact;
- `FacadeIdentityManifest`、evaluation/registration trace、module-scoped state/reset behavior remain exact;
- two concurrent games are isolated;
- default static graph can be constructed and exact direct-fixture outputs match baseline;
- production headless/local still uses the current owner and no lookup-free claim is made;
- actual current-owner Vite/classic/Worker entries pass after extraction, and generated browser/Worker delivery is synchronized in this same commit.

### Commit

`refactor: isolate the card runtime factory`.

## 7. Step 4 — Prepare the Worker composer without production cutover

### Outcome and rationale

Prove Worker delivery/evaluation can construct a complete, validated, frozen `MatchGameRuntime` before mutation. Keep the current production command owner until all runtime composers are ready and a card cohort is cut over.

### Actions

1. Extend the Worker preload owner to resolve all required static modules before synchronous command mutation begins.
2. Build and validate one frozen game runtime per Worker module environment / reconstruction generation.
3. Extend `scripts/worker-bundle-smoke.ts` with a strictly validated preparation-only `--fixture-entry` mode and expose it as `match:card-runtime-worker-fixture-check`. It must use the same Wrangler dry-run command path/settings as canonical smoke、override only the reviewed entry、write to an OS temporary directory、execute fixed fixtures、and always tear down. Exercise `test/fixtures/card-runtime-delivery/worker-entry.ts`; do not reach it through production command mutation.
4. Do not create a Worker-only turn/card executor or change shared command execution in this step.
5. Keep current preload registrations until the static built graph is proven. Do not shrink preload early.
6. Add negative fixtures for:
   - missing required module;
   - invalid partial cancellation manager;
   - Durable Object reconstruction;
   - bundle re-evaluation;
   - command attempted before preload completion.
7. Prove composer/preload failure occurs before any harness command and causes no room mutation, version increment, accepted operation, journal append, save, or broadcast.
8. Keep module cache outside room / snapshot / saved state.
9. Run actual bundled fixed-fixture card operations through the isolated new graph, not only preload-name existence checks.
10. Assert the Worker fixture entry and temporary bundle are absent from `worker-public/`、production Worker entry graphs、and generated registries. This preparation proof cannot claim actual production-entry parity yet.
11. Because the Worker preload owner is production-reachable even before command ownership cutover, run `worker:prepare` and include its explained mirror/generated diff in this same preparation commit. Canonical `worker:bundle:smoke` must prove the actual current-owner Worker entry after synchronization.

### Verification

```powershell
npm run typecheck
npm run build:ts
npx jest --runInBand --runTestsByPath `
  test/scripts.worker-runtime-preload.test.ts `
  test/workers.match-worker-preload.test.ts `
  test/workers.match-worker-card-preload.test.ts `
  test/workers.match-card-selector-preload.test.ts `
  test/workers.match-card-pattern-parity.test.ts `
  test/workers.match-pending-effect-id.test.ts
npm run worker:prepare
npm run worker:bundle:smoke
npm run match:card-runtime-worker-fixture-check
npm run check:card-runtime-dist-parity
```

### Failure handling

- If the static graph introduces a cycle that requires runtime global lookup, stop and redesign the composition root; do not restore a stateful global.
- If a bundled Worker result differs from Node, do not land a cutover commit; revert only the coherent task-owned preparation commit if needed. Do not add a runtime fallback flag or switch lane during a match.

### Done when

- Worker preload produces a complete frozen runtime;
- isolated new-graph execution is synchronous after composition;
- executable bundle performs representative card / pending / turn operations;
- Worker/new-factory exact parity and composition failure atomicity are green;
- the non-shipping Worker fixture uses production-equivalent bundler settings and is absent from shipping output;
- the dedicated fixture command owns bundle、execution、shipping-absence assertion、and teardown; canonical `worker:bundle:smoke` still proves only the actual legacy production entry in this preparation step;
- production Worker preload/generated delivery remains synchronized in this same commit;
- production Worker remains on the current owner and no command lookup-free claim is made.

### Commit

`refactor: prepare the Worker card composer`.

## 8. Step 5 — Prepare Vite and classic composers without production cutover

### Outcome and rationale

Make both browser delivery lanes construct and exercise the same canonical services in built-delivery harnesses while production UI remains on the current owner.

### Actions

1. Add a Vite outer composer that statically imports canonical services; exercise it through `test/fixtures/card-runtime-delivery/vite-entry.ts`, built to temporary output with the production Vite aliases/plugins/settings, without replacing the production facade yet.
2. Add a classic boot adapter that resolves historical global/module names once, validates the complete graph, and creates the same canonical services through `test/fixtures/card-runtime-delivery/classic-entry.ts`, built with production classic module order/settings into temporary output.
3. Keep `window.CardLogic` / existing global names, key + kind schema, important constants, and call signatures exact.
4. Define boot-time lane selection for the later cutover. Do not activate it in production until Step 6 and do not fallback effect-by-effect or phase-by-phase.
5. Do not alter Pixi optional loading, board writer selection, UI/network DI, hand/card ownership, or presentation playback.
6. Verify the Gate B failure mapping and terminal recovery:
   - canonical action: typed rejection, no mutation;
   - UI preview: outer display may be unavailable, but internal tagged `runtime_unavailable` is not stored/sent as canonical illegal false;
   - UI defensive post-activation fault: block later card/board/pass publish、cancel only uncommitted preview/selection、preserve canonical pending、settle caller-owned busy/input lock、show reload-required、no retry;
   - CPU analysis / legality probe: tagged `runtime_unavailable` aborts before alternate action selection、PRNG draw、command mutation; the top CPU boundary sets processing false、invalidates/cancels scheduler generation/timers、preserves canonical pending、does not schedule retry、and does not enter the generic pending-clear/retry handler;
   - AUTO/timeout/direct pass: usability dependency failure rejects before pass mutation and cannot mean `0 usable cards`;
   - untagged rule/programming exception: remains outside the tag path and follows that catch site's characterized current alternate-query/default/propagation behavior;
   - incomplete browser runtime at activation: gameplay remains disabled or whole-lane boot compatibility path is selected before match start.
7. Prepare dormant UI preview and CPU legality/candidate adapter modules that detect only the canonical nominal tag and route it before trying another dependency-sensitive query、returning `true`/empty success、or evaluating another CPU candidate/action. Prepare the outer browser/CPU integrity recovery callbacks in the same non-shipping harness. Untagged exceptions must follow each catch site's Gate B current alternate-query/default/propagation behavior; do not blanket-rethrow them. Do not import adapters from production entries until their Step 6 capability cohort switches in every lane.
8. Prove complete-runtime preview and CPU outputs/action order remain exact; the only changed branch is invalid-composition dependency failure characterized at Gate B.
9. Update classic registry source only if required; regenerate registry / cachebusters from scripts.
10. Verify built artifacts separately from source tests.
11. Reuse both Gate B delivery-check owners and extend `match:card-runtime-delivery-check` to build and exercise the non-shipping new Vite/classic fixture entries while retaining the actual legacy production-entry baseline comparison. Step 6 and later must replace this new-composer fixture proof with actual production-entry proof.
12. Assert the new composers、dormant query adapters、and fixture entries are absent from the actual production import graph、`public/module-registry.js`、production HTML、`vite-dist/`、and `worker-public/`. Record this machine proof.
13. If `build:browser` / `build:vite` or graph inspection shows any production reachability or tracked delivery diff, run `worker:prepare` and include all explained generated/mirror changes plus actual current-owner Vite/classic/Worker proof in this same Step 5 commit. Never suppress a generated diff merely because the adapter is called dormant.

### Verification

```powershell
npm run typecheck
npm run build:browser
npm run build:vite
npm run check:card-runtime-dist-parity
npm run match:card-runtime-delivery-check
npx jest --runInBand --runTestsByPath `
  test/game.cards-api-export-inventory.test.ts `
  test/game.cards-api-identity.test.ts `
  test/game.card-runtime-error-classification.test.ts `
  test/game.card-runtime-query-failure.test.ts `
  test/game.turn-runtime-pass-failure.test.ts `
  test/cpu.turn-handler.runtime-unavailable.test.ts `
  test/ui.card-runtime-integrity-failure.test.ts `
  test/browser-vite.classic-compat-loader.test.ts `
  test/ui.card-interaction.runtime-initialization.test.ts
```

If Action 13 detects production reachability, additionally run `npm run worker:prepare` and `npm run worker:bundle:smoke` after the focused preparation checks; the existing `match:card-runtime-delivery-check` supplies actual current-owner Vite/classic proof. If the machine absence proof is green, record that `worker:prepare` was not required because the preparation graph is non-shipping—not merely because ownership was not switched.

When browser operation begins:

1. inspect port 8000 owner;
2. reuse or start one persistent `npm run serve` for this repository;
3. confirm `http://127.0.0.1:8000/` returns 200 and is this repository's server;
4. test default Vite/Pixi lane and explicit classic lane with the fixed delivery fixture matrix, including immediate、pending、turn handoff、API schema、state/events/PRNG ledger、console/page errors;
5. record URL、entry lane、board backend、network mode、actions、errors、evidence;
6. leave the canonical play server running.

### Done when

- built Vite and classic lanes expose the exact public facade;
- production-equivalent non-shipping Vite/classic fixture lanes can construct the new graph and execute the same isolated fixtures/results as headless;
- fixture entries remain absent from every shipping registry/output, and no claim of actual new-composer production-entry parity is made before Step 6;
- dormant composers/query adapters are machine-proven unreachable from production, or every production delivery/mirror change is synchronized and actual current-owner entries are re-proven in this same commit;
- preview failure does not mutate authority or become a generic crash;
- dormant preview/CPU adapters propagate tagged failure without success-shaped query or alternate-action fallback, while production remains on the current owner;
- dormant tagged-recovery proof has no CPU retry/pending clear、no pass、no UI/network publish、no orphaned processing/input lock; untagged catch-site results remain exact;
- no UI/Pixi/network ownership changed.
- production browser facade remains on the current owner until Step 6.

### Commit

`refactor: prepare browser card composers`.

## 9. Step 6 — Cut over card resolution in all-lane bounded cohorts

### Outcome and rationale

Replace core runtime discovery and the untyped effect dependency bag one bounded capability group at a time. Each cohort switches in every supported runtime from one reviewed `CohortOwnershipManifest`; no lane is left on a different canonical owner. Keep `applyCardUsage()` public shape and transaction order unchanged.

### Cohort order

1. **State / deck / hand / charge / availability**
2. **Target / legality / board / topology**
3. **Marker / protection / pending narrow port**
4. **Cancellation / refund compatibility states**
5. **Immediate and multi-stage resolution families**
6. **`applyCardUsage()` dependency assembly and facade delegation**

Each cohort is its own coherent commit unless the diff is demonstrably small and inseparable.

### Actions for every cohort

1. Identify exact old resolver, selected implementation, fallback body, consumers, and existing tests from the Step 1 inventory.
2. Add that cohort's canonical-required capabilities to the manifest and activate its preflight **before** the production consumer switch. Use `MutationEntryManifest` to enumerate every non-pure function assigned to the cohort—including direct facade methods、pending continuation/cancellation、hand/charge/usage/reset/refund、PRNG-consuming query、event append/drain、runtime-setting paths、and command wrappers—and prove each fails before its recorded `firstObservableEffect`. `applyCardUsage()` alone is not sufficient coverage.
3. Route consumers through narrow typed services in headless/local、Worker、Vite、classic in the same ownership change.
4. Update the production facade to the same cohort manifest in all lanes. Unmigrated cohorts continue their construction-time fixed legacy owner; they do not retry after new failure.
5. Preserve current call order、RNG source precedence/binding timing、invocation references.
6. Run old/new exact fixture comparison by constructing independent old/new runtime/state/PRNG from the same seed/input. Do not generic-deep-clone PRNG-bearing state.
7. Verify selected PRNG source、call ledger、call count、ending state、non-shared identity, not only final board.
8. Verify canonical-state comparator、runtime-reference descriptors/alias topology、events、pending、charge、hand/discard、usage/reset/refund.
9. Run source、non-Jest dist、built Worker、built Vite、built classic parity before deleting a resolver/fallback.
10. Delete the old resolver/fallback only after all supported runtime lanes select the replacement.
11. Do not retain a fallback that retries old authority after new authority fails.
12. Update the graph inventory、`MutationEntryManifest`、and structural legacy allowlist after each deletion. The cohort must shrink or preserve the allowlist, never expand it, and must run `check:card-runtime-boundary` before commit.
13. In the pending cohort, replace `pending-coordinator` whole-CardLogic discovery/cache with the narrow pending port and prove runtime replacement cannot retain an old instance. Do not redesign its state machine.
14. For every dependency-sensitive query assigned to the cohort, activate the Step 5 dormant UI/CPU adapter and its outer integrity-recovery owner in the same all-lane ownership switch. Detect only canonical tagged `runtime_unavailable` and route it before the site's current fallback. Tagged failure must occur before success-shaped boolean/empty fallback、another query、another candidate/action、PRNG draw、AUTO/timeout/direct pass、UI/network publish、or command mutation. CPU tagged recovery must release processing、invalidate/cancel scheduler generation/timers、preserve canonical pending、avoid generic pending-clear/retry、and emit no alternative action. UI tagged recovery must settle owner locks、preserve canonical pending、latch later input/publish、and show reload-required. Untagged exceptionは各siteのcurrent alternate-query/default/propagationを維持し、complete-runtime output/action orderもexactに保つ。
15. For every cohort, fault-inject each required capability at activation and at its defensive assertion. Assert only canonical constructors create the tag; rule/programming/message/code-spoof failures are not caught as unavailable.
16. From the first production cohort onward, use the lane-specific actual production-entry proof table below. Non-shipping fixture entries no longer satisfy production-entry parity for a cut-over cohort.

| Lane | Required actual production proof in this cohort |
| --- | --- |
| source/headless | focused exact Jest fixture through production facade |
| built Node/headless | built facade/legacy wrapper through `check:card-runtime-dist-parity` |
| local authority | built local match-server ephemeral command scenario owned and torn down by `check:card-runtime-dist-parity` |
| Worker | `worker:prepare` then canonical `worker:bundle:smoke` |
| Vite | actual built production Vite entry through `match:card-runtime-delivery-check` |
| classic | actual built production classic entry through `match:card-runtime-delivery-check` |
| CPU / small selfplay | production-facade fixed-seed action/PRNG ledger and tagged-unavailable fixture |

### Cancellation-specific requirements

Classify current paths before cutover:

- complete canonical pending manager and no-override supported path: preserve exact refund/pending/result;
- absent / classifier-only incomplete graph: activation/preflight failure with zero mutation **only if Gate B proved it is not a supported production or public compatibility success path**;
- `refundCost: false`;
- `resetUsage: false`;
- `noConsume: true`;
- network-specific option combinations already covered by tests.

If any supported runtime / public compatibility contract reaches the classifier-only partial-success mutation path, stop this cohort and retain it until a separate compatibility decision. Do not simultaneously require its old card result and convert the same path to activation failure. Failure mapping remains wire-compatible.

### Apply-stage invariants

Do not reorder:

1. validation;
2. current consumption / accounting;
3. pending creation / continuation;
4. immediate canonical resolution;
5. presentation metadata / ordered events;
6. cleanup / refund / failure handling.

### Verification per cohort

- focused existing owner tests for every migrated card family;
- new exact parity fixture subset for the cohort;
- `test/game.card-runtime-query-failure.test.ts` whenever the cohort owns a dependency-sensitive preview/CPU query;
- `test/game.cards-api-identity.test.ts` in every production ownership cohort;
- whenever the cohort activates any dependency-sensitive adapter, run together in the same commit: `test/game.card-runtime-query-failure.test.ts`、`test/game.card-runtime-error-classification.test.ts`、`test/game.turn-runtime-pass-failure.test.ts`、`test/cpu.turn-handler.runtime-unavailable.test.ts`、`test/ui.card-runtime-integrity-failure.test.ts`;
- `npm run typecheck`;
- `npm run build:ts`;
- `npm run check:window` when boundary files change;
- `npm run check:card-runtime-boundary` with an unchanged-or-smaller owned legacy allowlist;
- `npm run check:card-runtime-dist-parity`;
- `npm run worker:prepare` after the cohort's Worker/browser production source cutover, then inspect and include only task-explained generated browser/mirror outputs;
- `npm run worker:bundle:smoke` for any dependency delivered to Worker;
- `npm run match:card-runtime-delivery-check` for built Vite/classic.
- `npm run test:network:parity` after each cohort affects authority consumers.

The generated browser/Worker diff belongs in the **same cohort commit** as its production source cutover. Do not create an intermediate revision with switched root authority and stale browser/Worker delivery. If commit size is excessive, split more dormant preparation before the switch; the ownership switch and generated/mirrored delivery remain inseparable.

### Stop conditions

- one valid supported runtime still reaches the old fallback;
- exact state/event/PRNG/pending comparison differs;
- a cycle requires global service location;
- a cohort requires card behavior/spec change;
- a stateful invocation value must enter static services.
- a supported path depends on an incomplete/partial manager success body.
- `runtime_unavailable` would be converted to canonical card-illegal false or an alternate CPU action.
- any failure path reaches pass/turn handoff、clears canonical pending、keeps a CPU retry timer/generation active、leaves UI/CPU processing locked、or permits a later UI/network publish.
- a rule/programming exception is reclassified as `runtime_unavailable` or an internal dependency failure reaches the generic CPU pending-clear/retry path.
- facade/function identity、descriptor/symbol/prototype、module evaluation/registration trace、or module-scoped state lifetime differs in a healthy supported lane.

### Done when

- all card resolution cohorts use typed services;
- each cohort preflight is active before first observable effect in direct and wrapped entries;
- every non-pure function assigned by `MutationEntryManifest` has an active preflight before first observable effect, and every dependency-sensitive query has exact tagged-propagation/fallback-prohibition proof;
- every active query adapter has tag-only classification and terminal UI/CPU/pass recovery proof with no retry、pending loss、alternative action; untagged catch-site fallback/default/propagation remains exact;
- `applyCardUsage()` facade is behavior-compatible and delegates to one canonical implementation;
- old core resolver / duplicate fallback bodies for migrated cohorts are gone;
- all runtime lanes and cohort evidence are green.
- cohort commit includes the canonical source/tests and its script-generated browser/Worker delivery, with no unrelated generated file.

### Commit examples

- `refactor: inject card state and targeting services`
- `refactor: inject card marker and pending services`
- `refactor: converge card cancellation resolution`
- `refactor: converge card usage composition`

## 10. Step 7 — Cut over the static turn phase manifest

### Outcome and rationale

Remove runtime discovery from the already decomposed turn pipeline without redesigning stage order, timeout/AUTO authority, pending outcomes, or command ownership.

### Actions

1. Build a validated static phase manifest from `TurnRuntimeServices`.
2. Keep existing public phase signatures through adapters during migration.
3. Inject required phase and protection-context capabilities from the outer composer.
4. Add each selected phase/protection capability to required preflight before its production switch. Use `MutationEntryManifest` to cover every assigned turn-start、direct `applyTurn()`、AUTO/timeout、pending-outcome、and command-wrapper non-pure function; each must fail before its recorded first observable effect, including `_boardOpsRandomSource`/runtime state、event append/drain、or PRNG draw.
5. Switch the selected turn cohort in all supported lanes from one ownership manifest.
6. Remove static-loader → runtime-require → global discovery only after all lanes provide the same manifest.
7. Remove parent duplicate fallback rule bodies one at a time.
8. Do not replace dependency failure with an empty protected/permanent/bomb context.
9. Preserve exact:
   - turn-start snapshot / anchor / marker order;
   - pre-placement / placement / immediate / charge / handoff order;
   - pending auto-pass prohibition;
   - continue / end / pass / game-end classification;
   - timeout / AUTO shared command entry;
   - `events[]` order and PRNG consumption.
10. In the pass/action cohort, inject failure into protection-context and `hasUsableCard` dependencies for direct、AUTO、timeout commands. Reject before pass events、turn handoff、pass counters、stateVersion、PRNG、journal/broadcast change; never infer `0 usable cards` from failure.
11. Apply the nominal classifier rule here too: only tagged dependency failure takes the integrity path; ordinary Core/CardLogic exceptions retain current error ownership and are not converted to empty context or runtime unavailable.
12. Shrink the structural legacy allowlist for every migrated phase and run the boundary checker. Do not defer a new turn lookup guard until Step 8.
13. Run `worker:prepare` after the production source cutover and include its explained generated browser/Worker diff in the **same ownership-switch commit**. If the commit is too large, move more dormant preparation earlier; never land the switch with stale delivery.

### Verification

```powershell
npm run typecheck
npm run build:ts
npm run check:card-runtime-boundary
npx jest --runInBand --runTestsByPath `
  test/game.card-runtime-error-classification.test.ts `
  test/game.cards-api-identity.test.ts `
  test/game.turn-runtime-failure-atomicity.test.ts `
  test/game.turn-runtime-pass-failure.test.ts `
  test/cpu.turn-handler.runtime-unavailable.test.ts `
  test/ui.card-runtime-integrity-failure.test.ts `
  test/game.turn-pipeline-phases-mode-di.test.ts `
  test/game.turn-pipeline-action-stage.test.ts `
  test/game.turn-pipeline.pending-cache-turn-start.test.ts `
  test/game.turn-pipeline-card-usage-guard.test.ts `
  test/game.pending-selection-turn-outcome-contract.test.ts `
  test/workers.match-pending-effect-id.test.ts
npm run test:network:parity
npm run worker:prepare
npm run worker:bundle:smoke
npm run check:card-runtime-dist-parity
npm run match:card-runtime-delivery-check
```

Run the exact turn fixture manifest through independently reconstructed headless, local, bundled Worker, Vite, and classic runtimes with identical initial seeds and separate instrumented PRNGs.

Use the Step 6 lane-specific actual production-entry proof owners for this turn cohort. Transitional fixture entries are not acceptable evidence after production ownership switches.

### Done when

- turn phases come only from the static manifest;
- selected cohort preflight runs before temporary RNG binding or any other write;
- every turn non-pure function assigned by `MutationEntryManifest` is covered before first observable effect and the structural allowlist is smaller or unchanged;
- no valid path uses empty-context or duplicate rule fallback;
- tagged usability/context dependency failure cannot produce pass or turn handoff、clear pending、schedule CPU retry; untagged exception retains current catch-site behavior;
- exact turn/network/runtime parity is green;
- stage sequence itself was not redesigned.

### Commit

`refactor: compose turn pipeline phases`.

## 11. Step 8 — Enforce fail-before-mutation and remove runtime discovery

### Outcome and rationale

After every supported lane and cohort already has an active preflight and complete services, remove temporary migration owners and prevent future reintroduction of ambient resolution.

### Actions

1. Verify the aggregate of all already-active cohort preflights covers every canonical-required manifest node and every non-pure function / dependency-sensitive query in `MutationEntryManifest`. This step must not be the first activation of a production preflight or tagged query adapter.
2. Verify typed internal `runtime_unavailable` remains distinct from rule-level unavailable and uses the Gate B runtime-specific normalization; do not change public wire schema. Audit every producer/catch: only canonical validator/composer/required assertions construct the nominal tag; consumers分岐はcanonical classifier resultだけをcurrent fallbackより先に扱い、untagged exceptionはsiteごとのcurrent fallback/default/propagationを維持する。
3. Prove authoritative failure leaves unchanged:
   - `gameState` / `cardState`;
   - stateVersion / operation acceptance;
   - PRNG state / call count;
   - events / pending;
   - journal / save / broadcast / SSE.
4. Prove UI preview can render unavailable without saving/sending canonical illegal state or returning a success-shaped boolean/alternate query. Prove its integrity latch blocks later card/board/pass publish、settles owner locks、cancels only uncommitted preview/selection、preserves canonical pending、and reaches reload-required without retry.
5. Prove CPU/legality owner aborts before alternate query/candidate/action selection、PRNG draw、pass、command mutation; releases processing、invalidates/cancels scheduler generation/timers、preserves canonical pending、does not call generic pending-clear/retry handling、and emits exactly one terminal integrity notification.
6. Prove direct/AUTO/timeout pass rejects on usability/context dependency failure before pass events、turn handoff、stateVersion、journal/broadcast changes. Unexpected Core/CardLogic exceptions must not be normalized as runtime unavailable.
7. Delete every `require` / global / lazy import / service-locator path owned by a canonical-required manifest node.
8. Scan the Gate B manifest's **canonical-required closure**, not only `cards.ts` and `turn_pipeline_phases.ts`; require a disposition for every node.
9. Tighten the Step 2 `scripts/check-card-runtime-boundary.ts` / `check:card-runtime-boundary` ratchet so the canonical legacy lookup allowlist reaches zero and the checker continues to fail on:
   - ambient resolution in canonical graph;
   - stateful values in static services;
   - whole `CardLogic` cache where a narrow port is required;
   - duplicate fallback rule body;
   - reintroduced Worker preload key whose manifest disposition moved to canonical static composition;
   - core → runtime-adapter dependency;
   - leaf signature accepting root aggregate、whole `CardLogic`、`any` dependency bag、index signature.
10. Retain and extend the Step 2 negative self-fixtures for every detected lookup form and forbidden retag form. Confirm the checker remains wired into `package.json` / hermetic `checkall`; do not first add that wiring here.
11. Keep outer classic compatibility resolution only in its named adapter and document why each remaining entry is required and its sunset condition.
12. Shrink Worker preload in dependency groups only after static built bundle operations pass.
13. Remove temporary `CohortOwnershipManifest` legacy owners and any old core lane. Final classic adapter must delegate to the same canonical services.
14. Re-run `FacadeIdentityManifest` and evaluation/module-state reconstruction proof after all old owners are removed; cleanup must not change public references or initialization order.
15. After the lane-specific actual production-entry proof table is green for the complete graph, delete `test/fixtures/card-runtime-delivery/worker-entry.ts`、`test/fixtures/card-runtime-delivery/vite-entry.ts`、`test/fixtures/card-runtime-delivery/classic-entry.ts`、the `worker-bundle-smoke --fixture-entry` mode、`match:card-runtime-worker-fixture-check` package wiring、browser fixture-only branches、and every fixture temporary-output expectation. Retain the actual-production `worker:bundle:smoke` and `match:card-runtime-delivery-check` gates.
16. Run `worker:prepare` for the final production cleanup and include the explained generated browser/Worker diff in the **same cleanup commit**; do not land stale delivery.

### Verification

```powershell
npm run typecheck
npm run build:ts
npm run check:window
npm run check:dependency-boundaries
npm run check:card-runtime-boundary
npm run check:card-runtime-dist-parity
npm run worker:prepare
npm run checkall
npx jest --runInBand --runTestsByPath `
  test/game.card-runtime-failure-atomicity.test.ts `
  test/game.card-runtime-error-classification.test.ts `
  test/game.card-runtime-query-failure.test.ts `
  test/game.card-runtime-composition.test.ts `
  test/game.cards-api-identity.test.ts `
  test/game.turn-runtime-composition.test.ts `
  test/game.turn-runtime-failure-atomicity.test.ts `
  test/game.turn-runtime-pass-failure.test.ts `
  test/cpu.turn-handler.runtime-unavailable.test.ts `
  test/ui.card-runtime-integrity-failure.test.ts `
  test/scripts.worker-runtime-preload.test.ts `
  test/workers.match-worker-card-preload.test.ts `
  test/browser-vite.classic-compat-loader.test.ts
npm run worker:bundle:smoke
npm run test:network:parity
npm run match:card-runtime-delivery-check
```

Use the exact package script established in Step 2. Any instability is a blocking regression in the migration ratchet, not a reason to remove the checker from the canonical check bundle.

### Done when

- incomplete canonical service graph cannot reach mutation;
- every non-pure `MutationEntryManifest` function fails before its recorded first observable effect, and every dependency-sensitive query propagates tagged failure without success-shaped fallback;
- nominal tag production/detection is unique, untagged catch-site behavior is exact, and tagged UI/CPU/pass/headless terminal recovery has no retry、pending loss、alternative action、post-failure publish、or orphaned lock;
- facade/alias/descriptor/evaluation/module-state identity remains exact after cleanup;
- every canonical-required manifest node is migrated and the closure has no ambient runtime discovery;
- the canonical legacy lookup allowlist is zero; only reviewed outer-adapter compatibility entries remain;
- no duplicate rule fallback remains;
- outer adapters are delegation/composition only;
- Worker preload contains only genuinely outer compatibility delivery;
- all negative and parity gates are green.
- transitional non-shipping fixture sources and fixture-only build/package wiring are gone; only actual production-entry gates remain.

### Commit

`refactor: enforce static card runtime boundaries`.

## 12. Step 9 — Synchronize stable contracts and delivery

### Outcome and rationale

Update documentation and generated outputs only after the implemented ownership boundary is real.

### Actions

1. Update `docs/architecture-contracts.md`:
   - canonical card / turn composition owner;
   - static-services vs invocation-context lifetime;
   - outer adapters and supported runtime lanes;
   - required dependency failure atomicity;
   - allowed classic compatibility boundary;
   - §13 debt removal / remaining debt.
2. Update this plan status / execution record with commit hashes and exact verification results.
3. Do not change `01-rulebook.md` or `正本/*.md`; behavior is unchanged.
4. Regenerate in repository order from canonical source. `worker:prepare` owns the current root → TypeScript → browser/Vite → Worker mirror chain, so do not run its nested generators redundantly here:

```powershell
npm run worker:prepare
```

5. Do not run multiple generator writers concurrently in this checkout.
6. Inspect generated diff; confirm every cachebuster/registry/mirror change is explained by task source.

### Verification

```powershell
npm run typecheck
npm run check:window
npm run check:card-runtime-boundary
npm run check:card-runtime-dist-parity
npm run match:card-runtime-delivery-check
npm run worker:prepare
npm run worker:bundle:smoke
npm run checkall
npm run test:network:parity
npm run test:jest
```

Run old/new fixed-seed small selfplay samples from independently reconstructed runtimes and compare action sequence / terminal state / selected PRNG source / call ledger / end state. Do not start a long training job.

Repeat browser proof on:

- `http://127.0.0.1:8000/` default lane;
- explicit classic lane;
- Pixi normal backend;
- representative immediate and pending cards;
- turn handoff and one network-authority scenario if network-facing composition changed.

Record console/page errors and public diagnostics. Confirm port 8000 returns HTTP 200 and belongs to this repository at task end.

### Done when

- stable docs describe actual code, not intended future state;
- all generated / mirrored delivery is script-produced and current;
- focused, structural, network parity, Worker bundle, full Jest, browser, small selfplay evidence is green or an exact blocker is reported;
- no unrelated file is included.

### Commit

`docs: record static card runtime contract`. If final regeneration produces task-owned delivery changes, include them in this same Step 9 commit; never leave stable docs and generated delivery describing different revisions or mix unrelated generated changes.

## 13. Step 10 — Independent final review, corrections, and completion

### Outcome and rationale

Have reviewers challenge the implemented diff rather than relying only on the planning review.

### Review assignments

At minimum request independent reviews for:

1. **Authority / behavior parity** — state、events、PRNG、pending、turn ordering、failure atomicity;
2. **Runtime / delivery parity** — classic、Vite、headless、local、Worker preload/bundle、generated outputs;
3. **Architecture / maintainability** — narrow ports、lifetime ownership、reachable-graph lookup guard、duplicate authority absence.
4. **Regression / failure recovery** — nominal error classification、untagged catch-site fallback/default/propagation parity、UI lock/input settlement、CPU scheduler/pending/no-retry、AUTO/timeout/pass safety、player-visible reload-required behavior.
5. **Public identity / initialization** — facade/object/function aliases、descriptors/symbol/prototype、module evaluation/registration order、module-scoped state、repeated boot/Worker reconstruction.

### Actions

1. Give reviewers the design, plan, commit range, execution evidence, and known warnings.
2. Ask reviewers to identify concrete correctness / contract defects, not style preferences or file-size-only concerns.
3. Reproduce every actionable finding.
4. Correct confirmed findings in focused commits and rerun the smallest affected gate plus any invalidated broader gate.
5. Record rejected findings with evidence.
6. Set `$taskBaselineCommit` to the exact Step 0 baseline commit recorded in the execution evidence, then inspect:

```powershell
git status --short
git diff --check
git diff --stat
git diff --name-status "$taskBaselineCommit..HEAD"
```

7. Inspect every task-owned source and generated diff. Confirm no temporary directory, TODO, debug flag, duplicate lane, stale allowlist, or unexplained generated file remains.
8. Stage only task-owned files and create the final coherent commit if corrections remain.

### Done when

- independent review findings are resolved or evidence-backed rejected;
- final verification remains green after the last correction;
- design / plan status and execution record are current;
- task-owned changes are committed;
- unrelated dirty files, unverified areas, warnings, and residual risks are clearly reported.

## 14. Verification bundle and evidence record template

The executor must replace `not run` with exact result, date, revision, duration, suite/test counts, warnings, and evidence path where applicable.

| Gate | Baseline | After relevant phase | Final |
| --- | --- | --- | --- |
| Fresh clone `npm ci && npm run checkall` | not run | not run | not run |
| `npm run typecheck` | not run | not run | not run |
| `npm run build:ts` | not run | not run | not run |
| `npm run check:window` | not run | not run | not run |
| `npm run check:card-runtime-boundary` | n/a | not run | not run |
| `npm run check:card-runtime-dist-parity` | n/a | not run | not run |
| `npm run match:card-runtime-delivery-check` | n/a | not run | not run |
| preparation-only `match:card-runtime-worker-fixture-check` | n/a | not run | removed after actual production proof |
| API key + kind / constants / semantic probes | not run | not run | not run |
| Facade identity / descriptor / evaluation / module-state manifest | not run | not run | not run |
| Gate B graph / `MutationEntryManifest` / failure mappings / partial-manager / non-shipping-entry proof | not run | not run | not run |
| Card canonical-state / runtime-reference characterization matrix | not run | not run | not run |
| Turn exact characterization matrix | not run | not run | not run |
| Failure-before-mutation matrix | not run | not run | not run |
| Error-classification negative matrix | not run | not run | not run |
| UI/CPU/pass/headless terminal-recovery matrix | not run | not run | not run |
| `npm run test:network:parity` | not run | not run | not run |
| `npm run worker:prepare` | not run | not run | not run |
| `npm run worker:bundle:smoke` | not run | not run | not run |
| `npm run build:browser` / `build:vite` | not run | not run | not run |
| `npm run checkall` | not run | not run | not run |
| `npm run test:jest` | not run | not run | not run |
| Vite/Pixi browser scenario | not run | not run | not run |
| Classic/Pixi browser scenario | not run | not run | not run |
| Fixed-seed small selfplay | not run | not run | not run |
| Final `git diff --check` / status / diff review | not run | n/a | not run |

Do not convert an unrun gate to “not applicable” without design-authority justification. If a gate is blocked, record the exact blocker and affected completion claim.

## 15. Requirement-to-step traceability

| Requirement | Owning steps |
| --- | --- |
| Gate A hermetic implementation baseline | 0 |
| Gate B current runtime/fallback/failure mapping | 1 |
| Facade identity/evaluation/module-state parity | 1–10 |
| Nominal failure classification / untagged catch-site behavior parity | 1–10 |
| UI/CPU/pass/headless terminal recovery | 1、5–10 |
| 289-key function classification and mutator entry/preflight ownership | 1–8 |
| Narrow typed immutable services | 2 |
| Structural boundary ratchet and legacy allowlist elimination | 2–8 |
| Static vs invocation lifetime separation | 2–3 |
| Cycle-free factory / default composer preparation | 3 |
| Worker composer preparation | 4 |
| Vite/classic composer preparation | 5 |
| UI/CPU dependency-query tagged-failure adapter preparation/activation | 5–8 |
| Non-shipping preparation entry then actual production-entry proof | 1、4–6 |
| Card resolution convergence | 6 |
| Turn manifest convergence | 7 |
| Failure-before-mutation | 1、6–8 |
| Reachable-graph ambient lookup removal | 2–8 |
| Public 289-key compatibility | 1–9 |
| State/event/PRNG/pending exact parity | 1–9 |
| Network / Worker / browser delivery parity | 4–9 |
| Production-reachable source / generated delivery same-commit synchronization | 3–9 |
| Stable docs / generated sync | 9 |
| Transitional fixture/source/wiring retirement | 8 |
| Independent implementation review | 10 |

## 16. Final completion checklist

- [ ] Gate A hermetic start gate is satisfied and separately committed if repaired.
- [ ] Gate B graph/failure/partial-runtime characterization is independently reviewed before product source edits.
- [ ] Step 1 inventory covers the reachable card-runtime graph, not only top-level files.
- [ ] `MutationEntryManifest` treats the 289-key facade as a mandatory subset and also classifies every production/public direct resolver/phase/command/module-bridge/global entry; it records complete effect/dependency flags、fully owns every non-pure function's cohort/first observable effect/preflight/failure/runtime/test metadata、owns every dependency-sensitive query's activation preflight/tagged propagation/fallback prohibition、and proves self-preflight or preflighted-outer-only reachability for each direct entry.
- [ ] API key + kind、constants、semantic probes are fixed.
- [ ] `FacadeIdentityManifest` fixes facade/function aliases、all own-key descriptors/symbol/prototype、repeated-load identity、module evaluation/registration trace、module-scoped state/reset/reconstruction owner in every lane.
- [ ] Static service graphs contain no match/room/state/RNG/events/pending instance.
- [ ] Invocation context preserves current RNG source and call order.
- [ ] Headless/local、Worker、Vite、classic all compose the same canonical services.
- [ ] Every commit changing a production-reachable browser/Worker graph runs `worker:prepare` and includes explained generated/mirror output in that same commit, or records machine proof that the change is non-shipping/unreachable.
- [ ] Worker performs no runtime discovery after command mutation begins.
- [ ] Card cohorts and turn phases pass exact old/new comparison from independently reconstructed same-seed runtimes/PRNGs.
- [ ] `applyCardUsage()` signature and stage order are unchanged.
- [ ] Pending payload、refund、usage、events、canonical-state comparator、runtime-reference topology、PRNG ledger、snapshot/hash are exact.
- [ ] Authoritative dependency failure occurs before mutation and stays wire-compatible.
- [ ] Tagged preview / CPU dependency failure reaches the integrity owner, not a generic crash or invented valid result; untagged exceptions retain each catch site's current fallback/default/propagation.
- [ ] Dependency-sensitive UI/CPU queries propagate tagged failure and cannot fall through to `true`、empty success、another query、candidate、or action.
- [ ] Only canonical validator/composer/required assertions create `runtime_unavailable`; message/code spoof、rule exceptions、programming exceptions are not reclassified and retain their characterized catch-site behavior.
- [ ] UI integrity recovery blocks later card/board/pass publish、settles owner locks、cancels only uncommitted preview/selection、preserves canonical pending、and shows reload-required without retry.
- [ ] CPU integrity recovery releases processing、invalidates/cancels scheduler generation/timers、preserves canonical pending、does not enter generic pending-clear/retry handling、and chooses no card/move/pass.
- [ ] Usability/context dependency failure cannot become direct/AUTO/timeout pass or advance the turn.
- [ ] No production shadow execution exists.
- [ ] Gate B manifest canonical-required closure has no ambient runtime discovery and no unclassified/unmigrated node.
- [ ] `check:card-runtime-boundary` is active from Step 2、wired into hermetic `checkall` with negative self-fixtures、ratchets on every cohort、and ends with zero canonical legacy allowlist entries.
- [ ] Non-shipping Worker/Vite/classic preparation entries reuse production-equivalent build settings、remain absent from shipping output、are replaced by actual production-entry proof at cutover、and their source/fixture-only wiring is removed after complete-graph proof.
- [ ] Headless/local、canonical Worker bundle、actual Vite、actual classic、CPU/selfplay production-entry proof passes on the same final revision.
- [ ] Non-Jest dist and actual built Vite/classic parity gates pass.
- [ ] No duplicate rule fallback or permanent old core lane remains.
- [ ] 289-key legacy facade and classic globals remain exact.
- [ ] `01-rulebook.md` and `正本/*.md` are unchanged because behavior is unchanged.
- [ ] Stable architecture docs and generated delivery match implementation.
- [ ] Focused、network parity、Worker bundle、full Jest、browser、small selfplay gates are recorded.
- [ ] Independent reviewers' findings are resolved.
- [ ] Final task-owned diff and `git status --short` are inspected.
- [ ] Task-owned changes are committed without unrelated files.

## 17. Plan self-review and revisions

The plan was reviewed against the design, current source, existing completed refactors, and three independent challenge reviews. The following revisions were made before marking it reviewed:

- A single `createCardRuntime()` cutover was split into characterization、contract shell、runtime adapters、card cohorts、turn phases、fail-closed enforcement、cleanup.
- Hermetic clean-clone verification became Gate A and a separate prerequisite commit; test-only characterization plus graph/failure mapping became Gate B before product source edits.
- The migration boundary became a fixed graph manifest with roots、edge kinds、boundaries、all-node dispositions instead of an ambiguous “migrated reachable graph”.
- A file-level import DAG and a mechanical cycle-free factory extraction were added before composer cutover, preventing `cards.ts -> composer -> cards.ts` cycles.
- The 289-key public API became a legacy facade projection; internal services remain narrow.
- API hash proof was strengthened with key + kind、important constants、semantic probes、built-delivery checks.
- Static runtime and invocation state were separated, with concurrent-game isolation proof.
- Root aggregates were restricted to composer/facade/orchestrator; leaf ports reject whole `CardLogic`、`any` bags、index signatures. Capability wrapper shells are shallow-frozen without deep-freezing imported modules.
- `pending-coordinator` whole-facade cache was included only for narrow-port replacement; pending state-machine redesign remains out of scope.
- Worker preload shrinking moved after actual static bundle proof.
- All runtime composers are prepared before production cutover; each capability cohort then switches in every supported lane from one ownership manifest.
- Each cohort preflight activates before its production consumer and before temporary RNG/action-state writes; Step 8 aggregates/enforces but does not first activate preflight.
- Authoritative apply、UI preview、CPU/legality failure policies were separated with internal tagged `runtime_unavailable`; CPU cannot choose an alternate action.
- PRNG parity uses independently reconstructed same-seed runtimes and instrumented PRNGs, never generic clone or shared mutable PRNG.
- Runtime-only PRNG/function identities use deterministic descriptors and alias-topology proof; canonical state uses a normalized comparator, while failure atomicity keeps same-instance pre/post raw equality.
- Partial cancellation success is preserved only if Gate B proves it is a supported path; an incomplete graph can become activation failure only when it is not a supported/public compatibility success path.
- Named non-Jest dist and actual built Vite/classic parity gates were added, plus explicit `check:card-runtime-boundary` wiring and negative self-fixtures.
- The boundary checker was moved from final cleanup to Step 2 with an owned legacy allowlist that every cohort must monotonically shrink to zero.
- `MutationEntryManifest` now treats the 289-key facade as a mandatory subset and additionally covers direct effect-resolver、turn phase/action、AUTO/timeout command、module-bridge/global entries. Each direct entry needs self-preflight or preflighted-outer-only reachability proof, so neither the facade nor representative apply/turn entries can stand in for unreviewed paths.
- A `FacadeIdentityManifest` now protects observable object/function aliases、descriptors/symbol/prototype、module evaluation/registration order、and module-scoped state lifetime that the existing key-hash test cannot detect.
- Nominal runtime-error production is restricted to validator/composer/required assertions; tag-only catches and negative rule/programming/message-spoof fixtures prevent the refactor from hiding new bugs as missing dependencies.
- UI、CPU scheduler、AUTO/timeout/pass、network、headless terminal recovery is explicit. In particular, tagged CPU failure bypasses the current generic pending-clear/retry handler, cancels retry ownership, preserves canonical pending, and cannot fall through to another action or pass.
- Step 1 failure tests run only in current-characterization mode and record current/target mappings as a pair; dormant target assertions activate in Step 5 and production assertions in Step 6/7, avoiding premature product edits or intentionally red/skipped tests.
- Step 7 reruns pass/turn atomicity together with CPU scheduler、UI latch、error classification、public identity tests so a turn-phase tag cannot escape through an unsafe outer recovery path.
- Pre-cutover Worker/Vite/classic proof now uses dedicated production-equivalent non-shipping fixture entries; cut-over cohorts must prove actual production entries and keep fixture code out of shipping output.
- Worker fixture proof now has a named `worker-bundle-smoke --fixture-entry` command owner; all fixture source/mode/wiring is retired after stronger actual-production proof exists.
- Every production cohort synchronizes explained browser/Worker generated output in the same ownership-switch commit, with no stale-delivery intermediate revision or cross-cohort carryover.
- The same-commit generation rule was broadened beyond ownership switches: Step 3 facade/factory extraction and every Step 4/5 production-reachable preparation must synchronize delivery and re-prove actual current-owner entries; only machine-proven non-shipping preparation may skip it.
- Classic fallback was restricted to boot-time whole-lane selection and removed as duplicate core authority before completion.
- RNG hidden-state cleanup, CPU session refactor, network session/SSE refactor, training schema, Pixi decomposition, and artifact transaction redesign remain separate follow-up candidates.

No product implementation is performed by this plan document. Its next executor must start at Gate A, complete Gate B before product source edits, and may not skip either gate merely because the current developer checkout already contains `dist/`.

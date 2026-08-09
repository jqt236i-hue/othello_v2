# Worker/local room-deck contract convergence implementation plan

- Status: implementation in progress; Steps 0–5 complete, final verification pending
- Date: 2026-08-09
- Design authority: `docs/implementation/worker-local-room-deck-contract-convergence-design.md`
- Scope: characterization-first convergence of normalized room-deck / initial-deck transformations; no player rule, wire schema, saved format, preload repair, or deployment change

## 1. Objective and delivery rule

Implement the reviewed design so that Worker and local match server delegate normalized room-deck mutation, initial-deck option construction, and public projection to one pure `utils/` owner.

Every step must preserve a coherent green state. Do not combine this work with the known Worker preload-order repair, UI work, card behavior, or a broader Worker/local server decomposition. If implementation evidence contradicts a design assumption, revise and self-review both documents before continuing.

## 2. Expected task-owned files

### New canonical source and tests

- `utils/match-room-deck.ts`;
- `test/utils.match-room-deck.test.ts`;
- `test/helpers/match-room-deck-contract-fixtures.ts` or the closest existing helper location;
- `test/network.room-deck-runtime-parity.test.ts`.

### Canonical adapters and types

- `workers/match-worker.ts`;
- `workers/match-worker-types.ts`;
- `scripts/local-match-server.ts`;
- `utils/match-runtime-ports.ts` only if the existing initial-deck option type must import a generic seat-map type; do not move room authority into command runtime.

### Existing focused tests that may be extended

- `test/workers.match-room-deck.test.ts`;
- `test/local-match-server.room-deck.test.ts`;
- controller / publish / spectator tests only where a missing durable contract is found.

### Stable documentation and generated output

- `docs/architecture-contracts.md` after the new owner is implemented;
- script-generated `dist/`, browser/Vite, and `worker-public/` surfaces as owned by existing commands; never hand-edit them.

No `01-rulebook.md`, `正本/*.md`, catalog, UI, card logic, network action schema, or public payload field change is expected.

## 3. Step 0 — Satisfy the implementation start gate

### Outcome and rationale

Begin from a trustworthy green-to-green baseline so a cross-runtime refactor cannot hide behind an existing delivery failure or overlapping task.

### Actions

1. Read the latest design and this plan completely.
2. Run `git status --short` and classify every entry.
3. Confirm `docs/implementation/full-regression-contract-convergence-plan.md` marks its Step 9 and final checklist complete with a commit hash.
4. Confirm the separate `CardMarkers` Worker preload-order repair has landed.
5. Run the baseline commands before editing:

```powershell
npm run typecheck
npx jest --runInBand --runTestsByPath test/workers.match-room-deck.test.ts test/local-match-server.room-deck.test.ts
npm run worker:bundle:smoke
```

6. Record exact suite/test counts and any non-fatal warnings in this plan's execution record.

### Failure handling

- If the working tree has overlapping changes, stop and report the exact files.
- If full-regression Step 9 is incomplete, resume its owner task rather than editing room-deck code.
- If bundle smoke still fails at preload, stop and complete the separate preload repair. Do not patch preload in this diff.
- Do not accept a known-red baseline for this refactor.

### Done when

- status is clean except these two uncommitted planning documents;
- the prior convergence task is complete;
- baseline typecheck, both room-deck suites, and executable Worker bundle smoke pass.

## 4. Step 1 — Add characterization before source movement

### Outcome and rationale

Lock current supported behavior and explicitly expose raw Worker/local differences before sharing code.

### Files

- new `test/helpers/match-room-deck-contract-fixtures.ts`;
- new `test/network.room-deck-runtime-parity.test.ts`;
- `test/workers.match-room-deck.test.ts`;
- `test/local-match-server.room-deck.test.ts`.

### Required fixture matrix

Use the same semantic fixture names and expected public facts for both runtimes:

1. both seats default;
2. all-cards override with ignored incoming deck codes;
3. black custom / white default;
4. black and white distinct custom decks;
5. valid 0-card custom deck spec;
6. deck update while a match is active;
7. reset / rematch after update;
8. timeout turn-start rebuild;
9. `initialDeckCardIdsByPlayer` with `null`, empty, whitespace-only, and non-empty arrays;
10. shared and per-player metadata with snapshot size fallback;
11. partial / malformed metadata values, including a non-empty unknown mode whose Worker normalization and local raw-mode compatibility output are recorded separately;
12. no roomDeck and no snapshot deck size.

For valid public inputs, assert equal Worker/local public `roomDeck`, initial deck sizes, and resulting card inventories. For raw malformed/internal-only fixtures, record each runtime's current result separately; do not rewrite expectations to make them equal.

### Test design constraints

- Exercise create/join/state/deck/reset through existing HTTP or Durable Object paths.
- Reuse local `patchRoomSnapshotForTests` and the Worker test's in-process Durable Object state for internal characterization; do not add a production test-only API.
- Assert no public payload contains `initialDeckSpec`, `initialDeckSpecByPlayer`, seat token from another viewer, or other private state.
- Assert deck update does not mutate the active match's current deck/hand and applies at the next reset.
- Assert state/version behavior already owned by each real path rather than faking a direct helper return.

### Verification

```powershell
npx jest --runInBand --runTestsByPath test/workers.match-room-deck.test.ts test/local-match-server.room-deck.test.ts test/network.room-deck-runtime-parity.test.ts
```

### Done when

- all fixtures pass against the unchanged implementation;
- the test report distinguishes equal supported behavior from intentionally retained raw-boundary differences;
- no production file changed in this step.

### Commit

Commit the reviewed design/plan plus characterization tests as one coherent pre-refactor evidence unit after Step 0 and Step 1 pass. Stage exact paths only.

## 5. Step 2 — Create and verify the pure canonical core

### Outcome and rationale

Establish one deterministic owner that is independent of Worker/local transports before either adapter delegates to it.

### Files

- new `utils/match-room-deck.ts`;
- new `test/utils.match-room-deck.test.ts`;
- `workers/match-worker-types.ts` only for generic type aliases/imports;
- `utils/match-runtime-ports.ts` only if needed to reuse the seat-map type without creating a second one.

### Required API behavior

Implement the design's narrow DTOs and pure operations:

- normalized seat map and room-deck metadata types;
- clone normalized card-id and deck-spec seat maps with fresh containers;
- create all-cards metadata;
- classify all-cards room state from normalized input;
- build initial-deck options from normalized inputs and explicit `boardConfig`;
- calculate, but do not apply, a complete seat-selection patch;
- project public room-deck metadata from normalized metadata and snapshot deck sizes;
- normalize the existing scalar deck-size rule.

### Hard constraints

- No imports from `workers/`, `scripts/`, `ui/`, DOM, timers, storage, network clients, or browser globals.
- No async functions, hidden module lookup, random source, logging, or process state.
- No raw deck-code decode.
- No `stateVersion`, `operationId`, seat-token, or viewer projection logic.
- Validate exported DTO discriminants and required seat-map/scalar fields at the JavaScript boundary; structurally invalid normalized DTOs throw `TypeError`, while declared optional domain absence remains `null`.
- Do not collapse `[]` or a valid empty deck spec into absent state.
- Return a patch instead of mutating the source room.
- Public projection accepts no private deck spec field.

### Unit coverage

- shared / per-player public shapes;
- equal and unequal seat codes/sizes;
- snapshot size fallback;
- all-cards metadata;
- one-seat update, second-seat update, removal, and last-entry pruning;
- cloning / immutability;
- null versus empty arrays;
- valid empty deck spec;
- invalid normalized DTOs throw `TypeError`, while `null` is asserted only for signatures whose domain result explicitly permits absence.

### Verification

```powershell
npx jest --runInBand --runTestsByPath test/utils.match-room-deck.test.ts
npm run typecheck
```

### Done when

- the helper and its types compile without runtime-specific imports;
- unit tests prove every design invariant;
- no adapter delegates yet, so existing runtime characterization remains unchanged.

## 6. Step 3 — Migrate the Worker adapter first

### Outcome and rationale

Use the stricter production authority path as the first adapter while retaining its existing persisted-room normalization and async deck loading.

### Files

- `workers/match-worker.ts`;
- `workers/match-worker-types.ts`;
- focused Worker tests.

### Required implementation

1. Statically import the new `utils/match-room-deck.ts` API.
2. Keep `loadDeckModules()`, async `resolveDeckSelection()`, `resolveAllCardsDeckSelection()`, HTTP, Durable Object storage, save, broadcast, and timer code in Worker.
3. Preserve the current raw persisted-room normalization result exactly. Convert it to the core DTO before delegation.
4. Replace canonical bodies for all-cards metadata, normalized selection patch, initial options, and public projection with core calls.
5. Apply a successful selection patch synchronously and completely before existing `updatedAt`, save, and broadcast actions.
6. Keep existing adapter capability names so join/preferences/publish/state/spectate controllers do not change.
7. Replace Worker-only generic room-deck types with aliases/imports from the shared authority helper; retain externally used Worker type names if removing them would create unrelated churn.
8. Do not add the helper to `WORKER_RUNTIME_GLOBAL_KEYS`; it should be reached through a static adapter import.

### Focused verification

Run build first because Worker tests enter the `.mjs` / built path.

```powershell
npm run build:ts
npx jest --runInBand --runTestsByPath test/utils.match-room-deck.test.ts test/workers.match-room-deck.test.ts test/local-match-server.room-deck.test.ts test/network.room-deck-runtime-parity.test.ts test/match-join-controller.authority.test.ts test/match-room-preferences-controller.authority.test.ts test/match-publish-controller.authority.test.ts test/match-state-controller.authority.test.ts test/match-spectate-controller.authority.test.ts test/workers.match-rematch-publish.test.ts test/workers.match-spectator.test.ts test/workers.match-stream-sse.test.ts
```

### Done when

- Worker valid and characterized raw behavior matches Step 1;
- the unchanged local suite and Worker/local parity suite still pass immediately after the Worker-only migration;
- Worker canonical transforms delegate to the new owner;
- executable source builds with no new runtime-global registration;
- no local source changed yet.

## 7. Step 4 — Migrate the local server adapter and prove parity

### Outcome and rationale

Remove the second canonical implementation while retaining local sync decoding, HTTP server, in-memory room, and scheduler behavior.

### Files

- `scripts/local-match-server.ts`;
- local / parity tests.

### Required implementation

1. Import the same pure helper and types.
2. Keep sync `DeckCodecModule` / `DeckSpecHelpers`, `resolveDeckSelection()`, local HTTP, room `Map`, heartbeat, timeout scheduler, and test hooks local.
3. Convert raw local room values to the normalized DTO without changing Step 1's recorded result.
4. Before DTO construction, preserve a non-empty unsupported `roomDeck.mode` through `projectLegacyUnknownModeRoomDeck()`; supported modes and empty mode must not enter that malformed-only branch.
5. Delegate metadata construction, patch calculation, initial options, and every supported public projection.
6. Apply the patch before the existing save/broadcast sequence.
7. Preserve the all-cards override, current-match non-rewind behavior, reset timing, and error shapes.
8. Delete only duplicate bodies whose authority has moved; do not remove named adapter wrappers required by controller wiring.

### Focused verification

```powershell
npx jest --runInBand --runTestsByPath test/utils.match-room-deck.test.ts test/local-match-server.room-deck.test.ts test/network.room-deck-runtime-parity.test.ts test/match-join-controller.authority.test.ts test/match-room-preferences-controller.authority.test.ts test/match-publish-controller.authority.test.ts test/match-state-controller.authority.test.ts test/match-spectate-controller.authority.test.ts test/local-match-server.publish-contract.test.ts test/local-match-server.spectator.test.ts
```

### Done when

- all valid fixtures are equal across Worker/local;
- every raw difference recorded in Step 1 is preserved or represented by an explicit adapter mapping with unchanged output;
- local no longer contains a parallel canonical transform body;
- custom 0-card behavior passes through create and reset.

## 8. Step 5 — Enforce single ownership and update the stable contract

### Outcome and rationale

Prevent future drift and make the completed architecture discoverable without relying on this plan.

### Files

- a focused structural test, preferably `test/network.room-deck-single-owner.test.ts` or the closest existing boundary suite;
- `docs/architecture-contracts.md`.

### Required structural guard

Use the TypeScript AST or exported-symbol inspection to prove:

- normalized metadata construction, selection patch, initial options, and public projection are declared in `utils/match-room-deck.ts`;
- Worker and local import/delegate to that owner;
- neither adapter re-declares a second canonical body;
- the only local projection exception is `projectLegacyUnknownModeRoomDeck()`, and AST/runtime coverage proves it cannot handle `shared`, `perPlayer`, or empty mode;
- runtime-specific `resolveDeckSelection` remains in each adapter;
- the helper imports no disallowed runtime/UI modules.

Do not assert line numbers, arbitrary source prefixes, or exact function-body text.

### Documentation update

Update `docs/architecture-contracts.md` to state:

- `utils/match-room-deck.ts` owns normalized room-deck mutation, initial deck option projection, and every supported public metadata projection;
- Worker/local adapters own raw validation / normalization, decode, runtime loading, transport, storage, and scheduling;
- local alone owns `projectLegacyUnknownModeRoomDeck()` for a non-empty unsupported raw mode, while Worker keeps its existing normalization; the malformed-only fallback is not part of the normalized projection owner;
- §13 no longer lists normalized room-deck contract logic as duplicated, while other network constants / route / lifecycle debt remains.

Do not update `01-rulebook.md` or `正本/*.md`.

### Verification

```powershell
npx jest --runInBand --runTestsByPath test/network.room-deck-single-owner.test.ts test/utils.match-room-deck.test.ts test/network.room-deck-runtime-parity.test.ts
npm run typecheck
git diff --check
```

### Done when

- a future duplicate canonical implementation fails a stable structural test;
- architecture contracts name the new owner and accurately retain remaining debt.

## 9. Step 6 — Run cross-runtime and delivery verification

### Outcome and rationale

Prove the refactor through real authority, projection, generated mirror, and executable Worker paths after focused tests are green.

### Ordered commands

```powershell
npm run typecheck
npm run build:ts
npm run test:match:parity
npm run test:network:parity
npm run worker:prepare
npm run check:worker-mirror
npm run worker:bundle:smoke
npm run checkall
npm run test:jest
```

### Required inspection

- Explicitly confirm the two room-deck suites and the new parity suite ran, because neither package parity bundle currently guarantees both files.
- Inspect black, white, and spectator room payloads for equal public metadata and absence of private specs/tokens.
- Confirm deck update still changes the next reset only.
- Confirm accepted reset increments version exactly once and replay/idempotency tests remain green.
- Inspect generated changes and prove they came from repository scripts.
- Record initial failures and reruns; do not report only the final pass.

### Browser-operation decision

Do not run a browser playtest by default. Add the smallest deck UI / two-client scenario only if implementation evidence changes a client-visible payload shape, deck update flow, or browser import graph.

### Done when

- every command exits successfully;
- Worker bundle smoke proves both bundled authority scenarios and create/join/authenticated state/leave;
- mirror is current and no generated file was hand-edited;
- full Jest is green with no accepted new baseline.

## 10. Step 7 — Final review, commit, and execution record

### Outcome and rationale

Land only the isolated, verified refactor and leave enough evidence for future maintenance.

### Actions

1. Request an independent read-only review of the final task-owned diff, focused on semantic drift, empty/absent handling, private projection, patch atomicity, and Worker/local parity.
2. Resolve every major/medium actionable finding and rerun the affected focused and broad gates.
3. Update this plan with exact commands, counts, warnings, generated output, and the intended commit units. Do not attempt to record a commit's own hash inside that same commit.
4. Run:

```powershell
git diff --check
git status --short
git diff -- docs/implementation/worker-local-room-deck-contract-convergence-design.md docs/implementation/worker-local-room-deck-contract-convergence-plan.md docs/architecture-contracts.md utils/match-room-deck.ts workers/match-worker.ts workers/match-worker-types.ts scripts/local-match-server.ts test
```

5. Stage exact task-owned files only. Never use `git add -A` while unrelated changes exist.
6. Commit coherent verified units. Recommended units:
   - design/plan + pre-change characterization;
   - pure core + Worker migration;
   - local migration + parity / structural guard + architecture update + generated delivery, if all generated artifacts depend on the complete source set.
7. After each commit, capture `git rev-parse --short HEAD` and rerun `git status --short`. Record hashes for earlier units in a later plan update when convenient; record every final unit hash in the user-facing completion report, because the final commit cannot contain its own hash.
8. Report unrelated remaining changes without amending a completed commit merely to self-record its hash.

### Done when

- independent review has no unresolved major/medium finding;
- all completion checklist items below are checked with evidence;
- task-owned changes are committed and the final status is clean or contains only clearly reported unrelated work.

## 11. Completion checklist

- [x] Start gate: prior regression convergence is complete and baseline bundle smoke passes.
- [x] Design §2: existing real-path coverage plus common fixtures cover the identified valid and raw-difference cases before extraction.
- [x] Design §5.1: `utils/match-room-deck.ts` owns normalized canonical transformations.
- [x] Design §5.2: Worker/local retain only explicit raw/runtime adapters and current controller capability names.
- [x] Design §5.3: absent, `[]`, and valid 0-card spec remain distinct.
- [x] Design §5.4: selection calculation is pure and room patch application is atomic.
- [x] Design §5.5: public projection cannot receive or leak private deck specs.
- [x] Create, join, default, all-cards, one-/two-seat custom, update, reset/rematch, timeout rebuild, state, spectator, publish, and stream scenarios pass in the focused bundle.
- [ ] `stateVersion`, `operationId`, idempotency, save/broadcast order, and privacy are unchanged.
- [x] Runtime-specific sync/async deck decode remains outside the core.
- [x] Single-owner structural guard passes.
- [x] Architecture contract is updated; rulebook and `正本` remain unchanged.
- [ ] Focused tests, both parity bundles, typecheck/build, prepare/mirror, executable bundle smoke, `checkall`, and full Jest pass.
- [ ] Generated output comes only from repository scripts.
- [ ] Final task-owned diff/status is inspected and coherent commits exist.

## 12. Execution record

Design-time evidence only; implementation results must be appended rather than replacing it.

- Initial status: clean at `HEAD 7323b612a` during the final evidence pass.
- Existing room-deck baseline: 2 suites / 9 tests passed in 5.527 seconds.
- Existing preload checker: passed 150 registrations while source inspection showed `CardMarkers` registered after four strict consumers; the separate full-regression record reports the executable bundle smoke failure. This proves Step 0 must require the real smoke, not the preload checker alone.
- Independent document review found and resolved three medium issues: local unknown-mode compatibility is now adapter-only and explicit, Worker-only migration immediately reruns parity, and final commit hashes are recorded in the completion report rather than circularly inside their own commit.
- No browser test, Worker generation, deployment, or product edit was performed during design.
- Step 0 prerequisite: the Worker runtime dependency defect was repaired in `87978034e`, generated delivery was refreshed in `51924c95a`, and `npm run worker:bundle:smoke` passed. The prior full-regression correction was independently reviewed, all proportional gates including 1017 suites / 7617 tests passed, and its documents were closed in `4f81fbacd`.
- Step 1 characterization: existing Worker/local room-deck real-path suites plus the shared raw-projection/0-card/empty-array fixtures passed 3 suites / 11 tests against unchanged room-deck production code. Supported shared/per-player metadata and the valid 0-card deck agree; Worker/local differences for empty metadata, non-empty unknown mode, and raw empty card-ID arrays are explicitly recorded.
- The first characterization invocation did not terminate because the test attempted to construct an empty deck spec with the default 30-card validation before entering its server cleanup block. The fixture was corrected to pass `{ requireFullDeck: false }`, task-created orphan Jest processes were stopped by exact PID, and separate local/Worker plus combined reruns passed.
- Step 2 pure core: `test/utils.match-room-deck.test.ts` passed 8/8 tests, including cloning, empty/absent preservation, valid 0-card specs, immutable selection patches, pruning, shared/per-player projection, and invalid DTO failure. `npm run typecheck` passed.
- Step 3 Worker migration: Worker raw normalization/decode remained in the adapter while normalized construction, options, patching, size rules, and public projection delegated to the core. After `npm run build:ts`, the helper/Worker/local/parity bundle passed 4 suites / 19 tests with local still on its original implementation.
- Step 4 local migration: local synchronous decode and raw normalization remained adapter-owned. `projectLegacyUnknownModeRoomDeck()` alone preserves non-empty unsupported raw modes, including padded supported spellings; supported and empty modes delegate. The same 4-suite / 19-test bundle passed after build.
- Step 5 ownership and stable contract: the AST guard plus unit/runtime parity passed 3 suites / 25 tests. `docs/architecture-contracts.md` §8.4.2 now names the owner and narrows §13 debt. The expanded controller, create/join/update/reset/timeout, spectator, publish, and stream bundle passed 15 suites / 89 tests after typecheck and build.

## 13. Self-review

The first plan would have started by extracting the Worker helpers. It was revised so characterization is a separate pre-source step and commit; otherwise a later passing parity test could merely encode the new implementation rather than prove preserved behavior.

The plan initially treated every same-named function as exactly equivalent. Source comparison disproved that assumption. Runtime decode stays separate, raw metadata/card-list normalization stays in adapters, and only normalized transformations move. Worker migrates first because its persisted-room behavior must remain stable before local delegates.

The test plan was expanded beyond the existing nine valid-path tests to cover valid 0-card decks, empty-versus-absent inputs, partial metadata, viewer privacy, and an AST single-owner guard. It also explicitly runs both room-deck suites because the current package parity lists do not include both.

Finally, `worker:bundle:smoke` is required both before and after implementation. The ordinary preload checker currently misses the known ordering defect, so treating `worker:prepare` or `checkall` alone as executable Worker proof would be a false completion signal.

Independent review also exposed an ambiguity around malformed modes and record ordering. The plan now keeps local's non-empty unknown mode behind one named adapter-only compatibility branch, requires the parity suite immediately after Worker migration, and makes the final completion report—not the final commit itself—the authoritative record of commit hashes.

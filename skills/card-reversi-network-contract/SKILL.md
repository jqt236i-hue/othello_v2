---
name: card-reversi-network-contract
description: Diagnose, review, plan, implement, verify, and deploy Card Reversi network-contract changes while preserving server authority, command idempotency, Worker/local parity, seat and spectator projection, session-epoch safety, canonical intake, SSE/reconnect recovery, pending-selection identity, presentation-journal continuity, strict visual settlement, AUTO and timeout authority, browser/headless parity, privacy, and generated Worker delivery. Use for match commands and publish payloads; stateVersion, operationId, projection hashes, snapshots, SSE, heartbeat, reconnect, room/session lifecycle, seat tokens, spectators, pending selections, network-visible card effects, presentation frames, visual recovery, Worker/local server behavior, preload/mirror preparation, bundle smoke, and network deployment in the card-reversi repository.
---

# Card Reversi Network Contract

Trace every network change from authenticated action to canonical state, projected delivery, ordered presentation, recovery, and final visual settlement.

## Set the operating mode first

1. Classify the request as `diagnose`, `review`, `plan`, `implement`, or `deploy`.
2. Keep diagnose, review, and plan work read-only. Do not generate browser/Worker artifacts, commit, or deploy.
3. Implement only when the user authorized a change. Deploy only when explicitly requested and after the required bundle and smoke gates pass.
4. Run `git status --short`. Preserve unrelated work, identify generated/mirror changes, and stop on overlapping unknown edits.
5. Read root `AGENTS.md` and every closest nested guide. Usually include `workers/AGENTS.md`, `ui/network/AGENTS.md`, and the applicable `utils/`, `shared/`, `scripts/`, `game/card-effects/`, `game/turn/`, `ui/`, and `test/` guides.
6. Read `docs/architecture-contracts.md` selectively: §6.3–6.4 for pending and state lanes, §7.2 for publish/intake, §7.3 for writer/settlement, §8 for authority/projection/delivery, and §11 for root/mirror ownership.
7. Read `01-rulebook.md` and the owning `正本` only when player-visible behavior, timing, card outcomes, projection wording, sounds, or animations change.
8. Confirm current owners through facade wiring, imports, `rg`, closest guidance, and tests. Treat paths below as discovery anchors; never recreate a stale path merely because this Skill names it.

## Inventory the affected contract

Resolve `<this-skill-directory>` from the loaded `SKILL.md` path and run the installed bundled inventory:

```powershell
node "<this-skill-directory>/scripts/inventory-network-contract.mjs" --repo . --surface publish --surface intake --term "<action|field|error|card>"
```

List available surfaces with:

```powershell
node "<this-skill-directory>/scripts/inventory-network-contract.mjs" --list-surfaces
```

Select every affected surface: command, publish, intake/snapshot, session/reconnect, stream/SSE, pending, presentation/journal, visual, timeout, AUTO, projection/privacy, identity, spectator, rating, Worker runtime, and delivery.

Inspect:

- current ownership anchors and any missing anchor that requires rediscovery;
- matched source, tests, generated/mirror files, aliases, and governing `AGENTS.md`;
- actual `package.json` commands rather than remembered command names;
- unreadable canonical candidates and dirty-tree entries.

Before editing, write down the affected transition with actor/viewer, room ID, session epoch, seat identity, `operationId`, base/next `stateVersion`, `pendingEffectId`, PRNG state, `visualSeq`, and projection lane.

## Preserve authority and idempotency

- Let Worker/local authority decide command acceptance, canonical mutation, turn ownership, randomness, version progression, result, and public projection. Never promote client state, preview, animation, timestamps, or arrival order into authority.
- Keep `shared/network-action-schema.ts`, `utils/match-command-runtime.ts`, `utils/match-publish-controller.ts`, `utils/match-auto-command.ts`, and `utils/match-authority/*` as shared/canonical contract owners. Keep Worker and local-server adapters transport-focused.
- Process a replay of an already accepted same-seat `operationId` before treating its old base version as a new stale command. Return the original accepted result/artifacts without mutating state or incrementing the version again.
- Reuse one `operationId` for transport retry of one logical command. Never reuse it for a different action.
- On a newly accepted transition, increment the canonical version exactly once, build viewer-specific post-state artifacts and one presentation frame, persist the accepted operation/frame/state, then deliver the same committed artifacts through response and SSE. Reject without canonical mutation.
- Keep Worker and local server externally equivalent. Do not fix them with parallel rule implementations.
- Use authority PRNG state for canonical randomness. Browser preview may mirror only.
- Treat browser `auto_turn` and `preferredAction` as advisory. Replan from the private canonical snapshot through `utils/match-auto-command.ts` and `game/cpu-network-command-planner.ts`; fail closed when the planner or required action is unavailable. Preserve pending/sub-placement legality and turn-start handoff.
- For timeout, revalidate version, seat, turn owner, and deadline after async work. Discard a stale resolver. If the required presentation frame/save cannot be committed, roll back the timeout transition and fail; do not broadcast a success-shaped gap.

## Preserve projection, pending identity, and privacy

- Treat each projected snapshot as the authoritative view for that viewer. Generate black, white, and spectator snapshot/frame/SSE payloads independently; never substitute a spectator payload for a seat.
- Keep spectators authenticated and read-only. Permit state/stream only; reject publish, seat leave, and seat-owned preference mutations.
- Keep `playerToken`, `recoveryCode`, seat tokens, and private hashes out of room state, public snapshots, SSE, journal responses, diagnostics payloads, ranking records, logs, and final reports. Store/verify only through the existing identity boundary.
- Use projection-safe hashes in transport. Keep stronger canonical hashes server-side.
- Use `handIndex` or another authority selector for hidden opponent cards. Placeholder tokens are presentation values, never identity.
- Bind pending commands to the canonical type/card/stage and opaque `pendingEffectId` when present. Validate target result events too.
- Keep selection publish behind `ui/network/selection-signal-bridge.ts` and `game/card-effects/selection-flow-network-handoff.ts`. With no publisher installed, do not publish; preserve the explicit local preview/pipeline fallback rather than discovering a global client.

## Preserve one canonical intake and session

- Normalize `publish_response`, `stream`, `state_sync`, `presentation_journal`, and `heartbeat_recovery` through `ui/network/intake-envelope.ts`, then submit them through `ui/network/intake-coordinator.ts`.
- Validate room identity, canonical snapshot metadata, frame contract, `snapshotAfter`, frame/snapshot version, and frame room before application.
- Apply an accepted canonical snapshot immediately to the canonical lane. Do not dispatch canonical server playback directly from snapshot intake; ordered server presentation belongs to the presentation timeline.
- Decide precedence with `stateVersion`, tracked `operationId`, source, and projection-safe hash—not arrival time alone. Force reconciliation when an equal-version projected hash differs.
- Guard every async publish response, stream event, state/journal recovery, reconnect, and retry after each `await` with current room ID, session epoch, seat/runtime identity, and owning stream/controller instance.
- On session activation, stored/rated activation, leave, or replacement, advance/reset the session boundary, dispose the old timeline, reset intake/recovery/publish state, and prevent old EventSource events or old Promises from touching new state or UI.
- Treat buffered SSE replay as an optimization. Authenticate the viewer before replay. Use the resume cursor when continuity is provable; use `/api/match/state` as full authoritative recovery when it is not.
- Preserve the current resume distinction: an unknown cursor requires a full snapshot, a known cursor with no missing tail may continue by heartbeat, and viewer-specific persisted replay remains available even when a backpressured writer is closed.
- Keep heartbeat, reconnect recovery, and full-state fallback single-flight. Give a newly opened stream its existing grace path before starting redundant state recovery.

## Preserve presentation continuity and settlement

- Treat a presentation frame as ordered replay metadata identified by `visualSeq` and `stateVersionFrom` → `stateVersionTo`, with viewer-specific `snapshotAfter`.
- Keep two lanes:
  - canonical state advances when an authoritative snapshot is accepted;
  - visual state normally advances only after each contiguous frame settles.
- Allow a no-frame/full-authority exception only through the existing proved atomic rebase: verify snapshot/cursor/version and current session, require an idle or disposed timeline, synchronize timeline base, visual store, settlement tracker, and local cursor together, verify convergence, then request board refresh through the Single Visual Writer. Roll back or escalate on partial failure.
- On continuity gaps or `VISUAL_CURSOR_EXPIRED`, stop guessing. Try bounded journal recovery when valid; otherwise dispose/cancel and fetch `/api/match/state` for exact rebase. Never include a private canonical snapshot in a journal error response.
- Do not replay a partially executed strict frame. Recover by authoritative rebase.
- Preserve ownership:
  - `ui/network/presentation-timeline.ts` owns contiguous frame order and pause/retry/dispose;
  - `ui/network/visual-state-store.ts` owns render-facing state;
  - `ui/network/visual-settlement.ts` owns visual-sequence completion and waiters;
  - `ui/playback-state-manager.ts` owns playback/busy/lock lifecycle;
  - `ui/presentation-handler.ts` and `ui/playback-settlement.ts` own strict settlement handoff;
  - `ui/board-visual/controller.ts` and the active backend own board pixels and committed-frame application.
- Preserve strict order: dispatch frame → receive visual commit → apply the committed frame → mark visual settlement → notify observers → settle the strict handle → advance the cursor.
- Fail explicitly when required authority, frame, committed apply, or settlement dependencies are missing. Do not turn cancellation, watchdog recovery, or controlled Pixi interruption into success, and do not misclassify controlled recovery as a renderer failure.

## Route the affected surface

| Surface | Current discovery anchors | Check together |
| --- | --- | --- |
| Command and mutation | `shared/network-action-schema.ts`, `utils/match-command-runtime.ts`, `utils/match-publish-controller.ts` | Actor/seat auth, schema, base version, idempotency, version increment, rejection, canonical game API. |
| Publish client | `ui/network/publish-flow.ts`, `publish-request.ts`, `publish-tracker.ts`, `command-payload.ts`, `action-bridge.ts` | Operation lifetime, queued publishes, retry/dedupe, response/stream convergence, session guard. |
| Canonical intake | `ui/network/intake-envelope.ts`, `intake-coordinator.ts`, `snapshot-canonical.ts`, `snapshot.ts`, `apply-coordinator.ts` | Every transport source, room/version/hash validation, immediate canonical apply, no direct canonical playback. |
| Session/reconnect | `session-lifecycle.ts`, `session-seat.ts`, `stream-session.ts`, `reconnect-controller.ts`, `transport.ts` | Epoch reset, stale async discard, seat identity, leave/rejoin, single-flight recovery. |
| SSE/heartbeat | `utils/match-stream-preparation-controller.ts`, Worker stream route/session/controller/broadcast modules, local server, client stream modules | Authenticated viewer replay, resume cursor, persisted buffer, backpressure, heartbeat, `/state` fallback. |
| Pending selection | pending registry/coordinator, selection signal/network handoff, `utils/match-authority/pending-selection.ts` | Type/card/stage/target, `pendingEffectId`, CPU/AUTO handoff, hidden-card selector, end-turn ordering. |
| AUTO/turn-start | `ui/network/auto-play.ts`, `utils/match-auto-command.ts`, `game/cpu-network-command-planner.ts`, Worker/local publish paths | Advisory preference, private canonical replanning, sub-placement, pending/card legality, post-action turn-start reconciliation. |
| Projection/privacy | `utils/match-authority/{projection,snapshot-state,hand-projection,trap-visibility,identity}.ts` | Black/white/spectator independence, secret exclusion, hashes, hidden information, error payloads. |
| Journal/frame | `shared/network-presentation-frame.ts`, `utils/match-authority/presentation-journal.ts`, Worker/local adapters | One committed frame, contiguous cursor, retention/base snapshot, viewer `snapshotAfter`, response/SSE parity. |
| Visual/recovery | timeline, visual store/settlement, playback dispatcher/recovery, strict presentation/board writer | Commit/apply/settle order, no partial replay, atomic rebase, pause/retry/dispose exactly once. |
| Timeout | Worker timeout/turn-timer controllers, local timeout path, client timer | Stale resolver guard, one version, required frame, rollback, corrective timer refresh. |
| Worker runtime/delivery | Worker preload registry, generated-surface check, Worker asset preparation, bundle smoke | Static preload ownership, executable bundle authority, mirror generation, deploy path. |

## Trace the lifecycle before implementing

```text
authenticated UI/game action
  -> command schema + operationId + base stateVersion
  -> shared authority validation / canonical mutation
  -> viewer-specific projection + committed presentation frame
  -> persist accepted operation, state, frame
  -> publish response and/or authenticated SSE
  -> session-guarded envelope and intake coordinator
  -> immediate canonical apply
  -> contiguous presentation timeline
  -> visual commit, committed-frame apply, settlement, cursor advance
```

For recovery, trace:

```text
session/room guard
  -> buffered replay or presentation journal
  -> bounded /state fallback
  -> timeline dispose/cancel if needed
  -> atomic visual rebase
  -> board refresh through the active writer
  -> convergence proof or explicit reload-required surface
```

If an edge has no owner, add the smallest boundary API instead of reaching across layers.

## Implement in canonical order

1. Change the shared schema, authority helper, or canonical command runtime first.
2. Update Worker and local-server adapters over the same contract.
3. Build projection/privacy, accepted-operation, journal, persistence, and broadcast artifacts from the same committed transition.
4. Update client publish and the single intake/session path.
5. Update visual timeline/recovery only after canonical delivery semantics are fixed.
6. Add the narrowest durable contract test for each uncovered race or failure mode.
7. Generate browser/Worker outputs only after focused source tests pass.

For diagnosis, review, or planning, stop after evidence-backed findings and do not execute this implementation sequence.

## Verify by affected surface

Read the current commands from `package.json`. Run focused tests explicitly because `test:network:parity` does not include every newer intake, session, timeline, journal, timeout, or controller suite.

| Change | Required evidence |
| --- | --- |
| Command, publish, or AUTO authority | Focus `test/match-publish-controller.authority.test.ts`, `test/match-command-runtime.test.ts`, `test/utils.match-auto-command.test.ts`, `test/game.cpu-network-command-planner.test.ts`, local publish, Worker AUTO, and the affected card/pending tests; run `npm run test:match:parity`; add `npm run test:network:parity` when browser flow changes. |
| Intake, publish race, or session epoch | Focus `test/ui.network-intake-envelope.test.ts`, `test/ui.network-intake-coordinator.test.ts`, `test/ui.network-snapshot-canonical.test.ts`, `test/ui.network-publish-flow.contract.test.ts`, apply coordinator, reconnect sync/controller, stream session, session lifecycle, and leave cleanup. Prove equal-version projected-hash divergence triggers reconciliation instead of being discarded as an ordinary duplicate; then run `npm run test:network:parity`. |
| Journal, timeline, or visual recovery | Focus shared frame, authority/local/Worker journal, timeline, both visual-state-store suites, visual settlement, playback dispatcher/recovery, client presentation retry, strict presentation, strict animation, and board-renderer visual-state tests; then run `npm run test:network:parity`. |
| SSE, heartbeat, reconnect, or timeout | Focus stream preparation, Worker stream controller/session/route, heartbeat, timeout controller, turn timer, local parity, and client stream/reconnect tests. Build first, then run `npm run build:ts` followed by `npm run match:check`; `match:check` itself does not build its `dist` dependency. |
| Projection, identity, or spectator | Focus public snapshot, identity, visibility, local spectator, Worker spectator, seat leave/revocation, and projection tests for black, white, and spectator; include both parity bundles when gameplay projection changes. |
| Pending/network-visible card | Focus pending registry/coordinator/bridge, deferred publish, authority pending ID/target validation, CPU/AUTO pending, projection, and reconnect; invoke `$card-reversi-card-change` for the card layers. |
| Browser behavior or board settlement | Run focused source tests, then `npm run build:browser`; add Pixi playback/fallback/cross-platform or the smallest two-client browser scenario in proportion to risk. |
| Generated network markers | Run `npm run check:generated-network-surface` only for its limited generated marker/SSE-journal surface; do not treat it as preload or executable bundle validation. |
| Worker preload or authority bundle | Run focused tests → `npm run typecheck`/`npm run build:ts` → `npm run worker:prepare` → `npm run check:worker-mirror` → `npm run worker:bundle:smoke`. The prepare step owns preload validation. |
| Deployment explicitly requested | Run `npm run worker:deploy`, which already prepares and bundle-smokes before Wrangler. Verify create/join/authenticated state/stream/publish/recovery/leave for the requested scenario and ensure both seats/room are cleaned up without logging tokens. |

Do not run `worker:prepare` immediately before `worker:dev` or `worker:deploy`; those commands include it. Report every initial failure, even if a retry passes. Never weaken a test to obtain green output.

## Stop conditions

Stop without landing or deploying when:

- Worker and local behavior still differ;
- black/white/spectator projection or secret exclusion is not proved;
- room/session epoch or visual-cursor continuity is ambiguous;
- equal-version projection-hash divergence cannot be forced through authoritative reconciliation;
- strict settlement cannot cancel or settle exactly once;
- canonical replay/idempotency would increment or mutate twice;
- timeout/AUTO would use browser state as authority;
- required focused, parity, mirror, or bundle-smoke verification fails;
- generated/mirror output overlaps another task;
- player-visible specification and intended behavior conflict;
- deployment was not explicitly authorized.

## Finish

1. Run `git status --short` and inspect only task-owned source and generated/mirror diffs.
2. Confirm Worker/local/browser/headless equivalence, or document a deliberate viewer-only projection difference.
3. Confirm old session responses, duplicate operations, journal gaps, and failure paths converge or fail explicitly.
4. For authorized implementation, commit only isolated verified task-owned files according to repository policy. Never commit a read-only investigation.
5. Report authoritative behavior, viewer differences, focused/parity/build/smoke results, mirror status, deployment/cleanup actions, and residual race or compatibility risk.

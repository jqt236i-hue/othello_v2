# Network Playback Root Cause Eradication And Deploy Plan

Date: 2026-05-28

## Status

- In progress
- Root source fix implemented
- Source validation passed
- Worker mirror sync passed
- Public deploy pending

## Role

This document is the active execution plan for eliminating the current network-match playback failure class and taking the fix through deploy.

It does not change gameplay rules. Player-visible rules remain governed by `01-rulebook.md`. Architecture boundaries remain governed by `docs/architecture-contracts.md`. The broader failure-pattern map remains `docs/network-stabilization.md`.

## Problem Statement

Observed network-only symptoms include:

- `狙撃の意志` authoritative result arrives, but the dedicated destroy presentation is missing
- destroy sound and red highlight squares are missing in network matches
- `強風の意志` moves smoothly in local play but appears to teleport in network play
- similar presentation-drop symptoms are expected on other cards that depend on the same playback path

These symptoms must be fixed as one failure class, not as card-by-card UI patches.

## Confirmed Root Cause

Current source-level evidence shows that authoritative playback generation for representative destroy and move cards is already present and covered:

- card logic emits canonical destroy / move presentation events
- Worker publish response, SSE snapshot, and replay parity suites pass
- playback assembly contract suites pass for representative destroy, move, and turn-start effects

The confirmed missing link was the client-side drain path used after authoritative snapshot application:

1. network snapshot applies authoritative state
2. snapshot path emits `PLAYBACK_EVENTS` into presentation queues
3. `ui/presentation-handler.ts` drains those queues through `GamePresentationRuntime.flushPendingPresentationEvents`
4. `game/cpu-turn-handler.ts` runtime value resolution had lost the `globalThis` fallback for `CardLogic` and runtime state
5. when DI was not yet injected or the classic global path was active, the drain returned no live playback events
6. the same runtime also had no fallback timer when `scheduleCpuTurn` was invoked without an injected timer service

That failure class explains:

- missing sniper destroy animation
- missing destroy sound and red highlight fan-out from the same destroy playback
- move playback batches not being consumed at the expected board-updated boundary
- snapshot-authoritative final board showing immediately while presentation is skipped

## Non-Goals

- Do not move gameplay authority into UI code
- Do not add card-specific network-only presentation hacks
- Do not change public API or snapshot schema
- Do not hand-edit `worker-public/` or `dist/`
- Do not revert unrelated dirty worktree changes

## Implementation Plan

### Phase 1: Restore Runtime Playback Consumption

Status: completed

- Restore `globalThis` fallback in `game/cpu-turn-handler.ts` runtime value resolution so `CardLogic`, `cardState`, and `gameState` remain visible on classic/global runtime paths.
- Restore a last-resort `setTimeout` path for `PresentationRuntime.scheduleCpuTurn` so presentation scheduling does not silently no-op when timer DI is absent.
- Keep the authoritative flow unchanged: game decides results, snapshot carries truth, UI only replays.

### Phase 2: Prove Network Playback Contract

Status: completed

- Re-run focused `boardUpdated` / presentation runtime tests.
- Re-run representative network playback contract suites for publish response, SSE snapshot, replay, sound dedupe, snapshot reconciliation, and single-writer behavior.
- Re-run repo-standard `npm run test:network:parity`.

### Phase 3: Mirror And Deploy

Status: in progress

- Regenerate build artifacts from root source with `npm run worker:prepare`.
- Review generated impact without treating generated files as source.
- Run `npm run worker:deploy`.
- If deploy succeeds, record the exact command result and public target.
- If deploy is blocked by external credentials or provider state, record that blocker explicitly.

## Implemented Source Changes

### `game/cpu-turn-handler.ts`

- `resolveRuntimeValue(name)` now falls back to `globalThis[name]` when UI DI does not provide a value.
- `PresentationRuntime.scheduleCpuTurn(...)` now falls back to standard `setTimeout` when no injected timer service exists.

These are compatibility fixes for the authoritative presentation boundary. They do not change gameplay rules or network authority.

## Validation Gates

The following gates must all succeed before this work is considered complete:

1. `npm run typecheck`
2. focused Jest suites for presentation runtime and network playback drains
3. representative Worker / SSE / snapshot / replay parity suites
4. `npm run test:network:parity`
5. `npm run worker:prepare`
6. `npm run worker:deploy`

## Validation Status

Passed on 2026-05-28:

- `npm run typecheck`
- `npm run test:jest -- --runTestsByPath test/presentation.board-updated.serial.test.ts test/game.cpu-turn-handler.presentation-runtime.test.ts`
- `npm run test:jest -- --runTestsByPath test/network.playback-event-assembly.contract.test.ts test/workers.match-stream-sse.test.ts test/workers.match-worker-broadcast-controller.test.ts test/workers.match-worker-stream-route-controller.test.ts test/workers.match-movement-selection.test.ts test/ui.network-client.sound-dedupe.test.ts test/ui.network-client.result-sync.test.ts test/ui.network-snapshot.pending-presentation-reconcile.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts test/presentation.board-updated.serial.test.ts test/game.cpu-turn-handler.presentation-runtime.test.ts`
- `npm run test:network:parity`
- `npm run worker:prepare`

Pending:

- `npm run worker:deploy`

## Completion Definition

This plan is complete only when all of the following are true:

1. representative destroy and move playback contracts remain green in source tests
2. authoritative snapshot playback is consumed correctly on the client boundary
3. root source and `worker-public/` are synchronized through generation, not hand edits
4. `npm run worker:deploy` succeeds, or an external deploy blocker is captured with evidence

## Residual Risk To Watch

- stale browser assets or stale deployed worker bundle can still mimic the old symptom even after source tests pass
- a public deploy should be followed by an actual two-client network check for `狙撃の意志` and `強風の意志`

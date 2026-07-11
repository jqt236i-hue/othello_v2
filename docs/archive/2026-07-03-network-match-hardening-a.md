# Network Match Hardening A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Public network matches must fail closed for debug publish, oversized local request bodies, biased token generation, and timing-sensitive room password checks.

**Architecture:** Keep the change narrow. Worker and local server public match APIs reject debug hand-fill publish, shared helpers own room password and worker token behavior, and local-only identity token generation is hardened in place without refactoring module boundaries.

**Tech Stack:** TypeScript, Jest, Node HTTP local server, Cloudflare Worker mirror generated through `npm run worker:prepare`.

---

## File Map

- Modify: `01-rulebook.md` for player-facing network debug wording.
- Modify: `workers/match-worker.ts` for public Worker create/debug behavior.
- Modify: `scripts/local-match-server.ts` for local create/debug behavior, oversized body destroy, and local token sampling.
- Modify: `utils/match-authority.ts` for shared rejection sampling.
- Modify: `shared/match-room-lobby.ts` for constant-time room password comparison.
- Modify: focused Jest tests under `test/`.
- Regenerate: `worker-public/**` via `npm run worker:prepare`.

## Task 1: Public Debug Publish Fails Closed

- [ ] Update focused tests first:
  - `test/local-match-server.publish-contract.test.ts`: change the existing debug fill test so a create request with `networkDebugEnabled: true` returns `networkDebugEnabled: false` and `debug_fill_hand` publish returns `409` / `NETWORK_DEBUG_DISABLED`.
  - `test/workers.match-publish-sanitize.test.ts`: change the two enabled debug fill tests so `runCommandPublishDebugFillScenario(true, ...)` is rejected and does not mutate either hand.
- [ ] Run focused tests and verify the new expectations fail before code changes:
  - `npx jest test/local-match-server.publish-contract.test.ts -t "network debug" --colors=false`
  - `npx jest test/workers.match-publish-sanitize.test.ts -t "network debug" --colors=false`
- [ ] Implement fail-closed behavior:
  - In `workers/match-worker.ts`, do not persist public `networkDebugEnabled` from create/internal create paths.
  - In `scripts/local-match-server.ts`, do not persist public `networkDebugEnabled` from create/makeRoom paths.
  - Ensure `debug_fill_hand` remains rejected through existing `NETWORK_DEBUG_DISABLED` path.
- [ ] Re-run the focused debug tests and confirm they pass.

## Task 2: Local Oversized Body Destroys Request

- [ ] Add a focused test in `test/local-match-server.publish-contract.test.ts` that sends a request body larger than 5MB and expects the local server to close the request with an error instead of parsing it.
- [ ] Run that focused test and verify it fails before code changes.
- [ ] Update `scripts/local-match-server.ts:parseBody` with a one-shot `payload_too_large` guard that rejects once and calls `req.destroy(error)`.
- [ ] Re-run the focused test and confirm it passes.

## Task 3: Rejection Sampling For Token Helpers

- [ ] Add helper-level tests:
  - `test/utils.match-authority.contract-types.test.ts`: verify `randomFromChars('ABC', 3, fakeCrypto)` rejects bytes outside the unbiased range and consumes later bytes.
  - `test/local-match-server.publish-contract.test.ts` or a smaller existing local-server test: verify local recovery/token generation remains format-valid after the algorithm change.
- [ ] Run the focused tests and verify the branch test fails before code changes.
- [ ] Update `utils/match-authority.ts:randomFromChars` to rejection sampling.
- [ ] Update `scripts/local-match-server.ts:randomFromChars` to the same algorithm using `nodeCrypto.randomBytes`.
- [ ] Re-run focused tests and confirm they pass.

## Task 4: Constant-Time Room Password Compare

- [ ] Update `test/shared.match-room-lobby.test.ts` to include a long same-length mismatch case and keep existing correct / wrong / open-room assertions.
- [ ] Run the focused shared lobby test and confirm it still exercises the helper.
- [ ] Update `shared/match-room-lobby.ts` to compare normalized passwords with a constant-time loop after checking length.
- [ ] Re-run the focused shared lobby test and confirm it passes.

## Task 5: Rulebook And Mirror

- [ ] Update `01-rulebook.md` so network debug is no longer described as a public room capability.
- [ ] Run `npm run worker:prepare` to mirror root source changes into `worker-public/`.
- [ ] Inspect `git diff -- worker-public/` and stage only generated files caused by this task.

## Task 6: Verification And Commit

- [ ] Run focused Jest commands for all touched test paths.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build:ts`.
- [ ] Run `npm run test:jest`.
- [ ] Run `npm run test:network:parity`.
- [ ] Run `npm run match:check`.
- [ ] Run `git diff --check`.
- [ ] Stage only the intentional hardening files, spec, plan, and generated mirror outputs.
- [ ] Commit with a concise message.

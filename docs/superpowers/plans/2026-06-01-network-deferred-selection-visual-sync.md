# Network Deferred Selection Visual Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure that, in network matches, every `previewThenPublishOnly` pending-selection effect shows the resolved board/marker/timer state immediately on the acting client during deferred publish, while preserving intentional seat-specific asymmetry such as hidden traps.

**Architecture:** Keep gameplay authority in the headless turn pipeline and worker snapshot flow. The acting client may preview the already-resolved canonical result locally through the shared `selection-flow-pending-execution.ts` branch, but it must not invent new authority, skip rollback on publish failure, or leak hidden-seat-only information.

**Tech Stack:** TypeScript/CommonJS browser modules, Jest, jsdom-based network-client tests, worker/public snapshot projection tests.

---

## Current State Snapshot

- The main shared-flow fix already exists on the current branch in `game/card-effects/selection-flow-pending-execution.ts`.
- The current branch also already contains initial regression coverage for `GUARD_WILL`, `BLOCKADE_WILL`, `FREEZE_WILL`, `TIME_BOMB`, `EXTEND_LIFE_WILL`, and `METEOR_WILL`.
- Use this plan to finish the fix, not to restart from scratch. If you begin from an older commit, replay the current branch changes before adding more coverage.

## Behavior To Preserve

- `previewThenPublishOnly` cards must update the acting client immediately after `selectTarget` succeeds.
- If deferred publish fails, the acting client must roll back to the pre-selection state and remain actionable.
- `publishOnly` flows such as trap/swap/movement must keep their existing semantics.
- Hidden trap details must remain visible only to the owner seat and hidden from the opposing seat.
- `game/` stays headless. No new UI/DOM/network logic belongs inside card-specific effect code.

## Execution Prerequisites

- Start with `git status --short`.
- Current unrelated dirty paths may include `.codex/config.toml` and `artifacts/`; do not stage or remove them.
- Do not edit `worker-public/`; this fix is root-source/test-only unless a later change proves otherwise.
- Do not change `01-rulebook.md` or `正本/ターン進行正本.md` again unless player-visible timing behavior changes beyond the wording already added.

## File Map

- Modify: `test/game.pending-selection-flow.test.ts`
  - Expand the shared-flow matrix so the remaining `previewThenPublishOnly` continue-turn cards are characterized in one place.
- Modify only if Task 1 finds a failing card: `game/card-effects/selection-flow-pending-execution.ts`
  - Keep all preview/apply/emit/publish/rollback logic inside the shared branch rather than card-specific handlers.
- Verify only:
  - `test/ui.network-client.guard-tempt-deferred-publish.test.ts`
  - `test/ui.network-client.movement-deferred-publish.test.ts`
  - `test/ui.network-client.swap-deferred-publish.test.ts`
  - `test/ui.network-client.trap-deferred-publish.test.ts`
  - `test/workers.match-trap-visibility.test.ts`
  - `test/e2e/network_special_cards.e2e.test.ts`

## Task 1: Finish Shared-Flow Characterization For Remaining Preview Cards

**Files:**
- Modify: `test/game.pending-selection-flow.test.ts`

- [ ] **Step 1: Extend the existing `test.each([...])` matrix with the remaining status/timer cases**

Append these exact cases to the existing `network continue-turn deferred selection previews resolved local state before publish settles for $pendingType` matrix:

```ts
    {
      pendingType: 'SEED_WILL',
      row: 3,
      col: 2,
      actionPayload: { seedTarget: { row: 3, col: 2 } },
      buildNextCardState: (cardState) => ({
        ...cloneJson(cardState),
        pendingEffectByPlayer: { black: null, white: null },
        markers: [{
          id: 'seed_1',
          kind: 'specialStone',
          row: 3,
          col: 2,
          owner: 'black',
          data: { type: 'SEED', remainingOwnerTurns: 5 }
        }]
      }),
      buildNextGameState: (gameState) => cloneJson(gameState),
      assertPreview: ({ cardState }) => {
        expect(cardState.markers).toEqual([
          expect.objectContaining({
            row: 3,
            col: 2,
            owner: 'black',
            data: expect.objectContaining({ type: 'SEED', remainingOwnerTurns: 5 })
          })
        ]);
      }
    },
    {
      pendingType: 'EXTEND_LIFE_GOD',
      row: 2,
      col: 2,
      actionPayload: { extendTarget: { row: 2, col: 2 } },
      initialMarkers: [{
        id: 620,
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'black',
        data: { type: 'GUARD', remainingOwnerTurns: 2 }
      }],
      buildNextCardState: (cardState) => ({
        ...cloneJson(cardState),
        pendingEffectByPlayer: { black: null, white: null },
        markers: [{
          id: 620,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'black',
          data: { type: 'GUARD', remainingOwnerTurns: 8 }
        }]
      }),
      buildNextGameState: (gameState) => cloneJson(gameState),
      assertPreview: ({ cardState }) => {
        expect(cardState.markers).toEqual([
          expect.objectContaining({
            id: 620,
            row: 2,
            col: 2,
            owner: 'black',
            data: expect.objectContaining({ type: 'GUARD', remainingOwnerTurns: 8 })
          })
        ]);
      }
    },
```

- [ ] **Step 2: Extend the same matrix with remaining board-mutation cases**

Append these exact cases after the status/timer entries:

```ts
    {
      pendingType: 'DESTROY_ONE_STONE',
      row: 3,
      col: 4,
      actionPayload: { destroyTarget: { row: 3, col: 4 } },
      initialBoardValue: 1,
      buildNextCardState: (cardState) => ({
        ...cloneJson(cardState),
        pendingEffectByPlayer: { black: null, white: null }
      }),
      buildNextGameState: (gameState) => {
        const nextGameState = cloneJson(gameState);
        nextGameState.board[3][4] = 0;
        return nextGameState;
      },
      assertPreview: ({ gameState }) => {
        expect(gameState.board[3][4]).toBe(0);
      }
    },
    {
      pendingType: 'TELEPORT_WILL',
      row: 4,
      col: 4,
      actionPayload: { teleportTarget: { row: 4, col: 4 } },
      buildNextCardState: (cardState) => ({
        ...cloneJson(cardState),
        pendingEffectByPlayer: { black: null, white: null }
      }),
      buildNextGameState: (gameState) => {
        const nextGameState = cloneJson(gameState);
        nextGameState.board[3][3] = 0;
        nextGameState.board[4][4] = 1;
        return nextGameState;
      },
      assertPreview: ({ gameState }) => {
        expect(gameState.board[3][3]).toBe(0);
        expect(gameState.board[4][4]).toBe(1);
      }
    },
    {
      pendingType: 'BOARD_EXPANSION_WILL',
      row: 3,
      col: 7,
      actionPayload: { expansionTarget: { row: 3, col: 7 } },
      buildNextCardState: (cardState) => ({
        ...cloneJson(cardState),
        pendingEffectByPlayer: { black: null, white: null }
      }),
      buildNextGameState: (gameState) => ({
        ...cloneJson(gameState),
        boardExpansion: {
          active: true,
          usedByPlayer: { black: true, white: false },
          cells: [{ row: 3, col: 8, side: 'right', owner: 0 }]
        }
      }),
      assertPreview: ({ gameState }) => {
        expect(gameState.boardExpansion).toEqual(expect.objectContaining({
          usedByPlayer: expect.objectContaining({ black: true }),
          cells: expect.arrayContaining([
            expect.objectContaining({ row: 3, col: 8, side: 'right', owner: 0 })
          ])
        }));
      }
    },
```

- [ ] **Step 3: Run the focused shared-flow suite**

Run:

```powershell
npm run test:jest -- --runInBand --runTestsByPath test/game.pending-selection-flow.test.ts
```

Expected: PASS. If any case fails, do not add card-specific fixes first; continue to Task 2 and patch the shared branch.

- [ ] **Step 4: Commit only the characterization expansion**

Run:

```powershell
git status --short
git add test/game.pending-selection-flow.test.ts
git commit -m "test: expand deferred preview matrix"
```

Expected: a commit containing only `test/game.pending-selection-flow.test.ts`.

## Task 2: Patch The Shared Preview Branch Only If Task 1 Finds A Failure

**Files:**
- Modify only if needed: `game/card-effects/selection-flow-pending-execution.ts`

- [ ] **Step 1: Replace the `previewThenPublishOnly` branch with the shared preview/apply/rollback block**

Inside the `if (deps.shouldUsePreviewThenPublishOnlyPendingSelection(resolvedPendingType)) { ... }` branch, ensure this block exists verbatim after `preview.applied !== false`:

```ts
            const previousCardStateSnapshot = deps.cloneData(stateRefs.cardState);
            const previousGameStateSnapshot = deps.cloneData(stateRefs.gameState);
            executionResult = preview.result;
            appliedSelection = preview.appliedSelection;
            const appliedState = deps.applySelectionStateResult(executionResult, stateRefs);
            playbackEvents = deps.shouldSuppressLocalPlaybackForDeferredNetworkSelection(resolvedPendingType)
                ? []
                : (Array.isArray(executionResult.playbackEvents) ? executionResult.playbackEvents : []);

            if (opts.emitStateChanges !== false) {
                deps.emitSelectionStateChangeSignals(playbackEvents);
            }

            const publishResult = await Promise.resolve(deps.publishPendingSelectionSnapshot({
                playerKey,
                actionType,
                action: pendingAction,
                playbackEvents: []
            }));
            if (!publishResult || publishResult.ok !== true) {
                deps.applySelectionStateResult({
                    nextCardState: previousCardStateSnapshot,
                    nextGameState: previousGameStateSnapshot
                }, stateRefs);
                if (opts.emitStateChanges !== false) {
                    deps.emitSelectionStateChangeSignals([]);
                }
                markPendingActionFailure('network_publish_failed');
                const ensureFn = deps.resolveRootFunction('ensureCurrentPlayerCanActOrPass');
                if (typeof ensureFn === 'function') {
                    ensureFn({ useBlackDelay: true });
                }
                return {
                    ok: false,
                    reason: 'network_publish_failed',
                    result: publishResult || { ok: false, reason: 'NETWORK_PUBLISH_FAILED' }
                };
            }
```

The point of this step is to keep all continue-turn deferred preview semantics in one shared path. Do not patch `guard.ts`, `freeze.ts`, `seed.ts`, `teleport.ts`, or any other card handler for this issue.

- [ ] **Step 2: Re-run the shared-flow suite**

Run:

```powershell
npm run test:jest -- --runInBand --runTestsByPath test/game.pending-selection-flow.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit the source fix separately**

Run:

```powershell
git status --short
git add game/card-effects/selection-flow-pending-execution.ts
git commit -m "fix: sync deferred preview before publish"
```

Expected: a commit containing only the shared-flow source file.

## Task 3: Prove Non-Target Flows Still Behave Correctly

**Files:**
- Verify only: `test/ui.network-client.guard-tempt-deferred-publish.test.ts`
- Verify only: `test/ui.network-client.movement-deferred-publish.test.ts`
- Verify only: `test/ui.network-client.swap-deferred-publish.test.ts`
- Verify only: `test/ui.network-client.trap-deferred-publish.test.ts`
- Verify only: `test/workers.match-trap-visibility.test.ts`

- [ ] **Step 1: Run the network-client deferred publish suites**

Run:

```powershell
npm run test:jest -- --runInBand --runTestsByPath test/ui.network-client.guard-tempt-deferred-publish.test.ts test/ui.network-client.movement-deferred-publish.test.ts test/ui.network-client.swap-deferred-publish.test.ts test/ui.network-client.trap-deferred-publish.test.ts
```

Expected: PASS. This proves the shared-flow change did not break the `publishOnly` trap/swap/movement paths or the existing guard/tempt/capture network-client behavior.

- [ ] **Step 2: Run the hidden-trap seat-projection suite**

Run:

```powershell
npm run test:jest -- --runInBand --runTestsByPath test/workers.match-trap-visibility.test.ts
```

Expected: PASS. The owner seat still sees hidden trap details, and the opposing seat still does not.

- [ ] **Step 3: Do not commit anything if these suites only verify existing behavior**

Run:

```powershell
git status --short
```

Expected: no new tracked file modifications from verification alone.

## Task 4: Run One End-To-End Guardrail And Close Out

**Files:**
- Verify only: `test/e2e/network_special_cards.e2e.test.ts`

- [ ] **Step 1: Run the representative guard network E2E**

Run:

```powershell
npm run test:jest -- --runInBand --runTestsByPath test/e2e/network_special_cards.e2e.test.ts -t "GUARD_WILL settles and still allows the guarded player to place a normal move"
```

Expected: PASS. This is the final end-to-end guardrail that the network handoff still settles correctly for the original reported card.

- [ ] **Step 2: Review the final diff**

Run:

```powershell
git diff --stat
git diff --check
git status --short
```

Expected: only intentional test/source changes are present; no whitespace errors; unrelated `.codex/config.toml` and `artifacts/` remain unstaged.

- [ ] **Step 3: Commit any final leftover plan-driven changes**

Run only if Task 1 or Task 2 added new tracked changes that are not yet committed:

```powershell
git add <intentional files only>
git commit -m "test: complete deferred preview hardening"
```

Expected: no mixed commit with unrelated files.

## Out Of Scope For This Plan

- Refactoring `selection-flow-pending-execution.ts` into smaller helpers.
- Adding new browser UI rendering logic for marker display.
- Changing worker/public mirror files.
- Changing card rules, card text, or player-visible timing beyond the already-documented deferred preview behavior.

## Plan Self-Review

- Spec coverage: this plan covers the root cause, remaining unverified preview cards, the publish-only exceptions, intentional seat asymmetry, and a representative E2E guardrail.
- Placeholder scan: no `TODO`, `TBD`, or “similar to previous step” instructions remain.
- Type consistency: pending type names, action payload keys, marker types, and test paths match the current repo names already used in `test/game.pending-selection-flow.test.ts`, `test/network.playback-event-assembly.contract.test.ts`, and `test/workers.match-pending-effect-id.test.ts`.

Plan complete and saved to `docs/superpowers/plans/2026-06-01-network-deferred-selection-visual-sync.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

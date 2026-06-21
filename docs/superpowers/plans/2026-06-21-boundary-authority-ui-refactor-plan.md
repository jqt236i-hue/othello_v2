# Boundary Authority UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the known high-priority boundary and duplication debts around turn-manager network access, Worker/local authority parity, and card UI seat/owner resolution without changing player-visible behavior.

**Architecture:** Keep game/headless logic free of browser and network-client discovery. Move shared Worker/local-server constants and room payload wrappers into `utils/match-authority.ts`, then make UI card surfaces consume existing owner/network helpers instead of hand-written seat logic. Each pass is behavior-preserving and independently testable.

**Tech Stack:** TypeScript, CommonJS compatibility wrappers, Jest, existing `npm run check:window`, `npm run test:network:parity`, and generated Worker mirror via `npm run worker:prepare` only when deploy assets need syncing.

---

## Document Role

This is an execution plan, not a gameplay spec. Source-of-truth behavior remains `01-rulebook.md` for visible rules and `docs/architecture-contracts.md` for internal boundaries.

Target debt:

- `game/turn-manager.ts` reads `root.NetworkMatchClient` directly.
- `workers/match-worker.ts` and `scripts/local-match-server.ts` duplicate network constants and authority payload wrapper logic already partly represented in `utils/match-authority.ts`.
- `cards/card-interaction.ts` and `cards/card-renderer.ts` duplicate seat/owner/network resolution that should flow through `utils/owner-helpers.ts` and the existing card interaction network helper.

Non-goals:

- No rule, card, timing, status message, error reason, route, response shape, serialization, persistence, dependency, framework, or runtime-version changes.
- No broad splitting of giant files just because they are large.
- No source edits under `worker-public/`, `dist/`, or `public/module-registry.js`; regenerate mirrors only through existing scripts if a later implementation task requires it.

## Execution Preconditions

- Start each implementation session with `git status --short`.
- If unrelated dirty files are present, either keep the pass to files that are completely isolated from those changes or stop and ask how to proceed.
- Do not create a branch, tag, or worktree unless the user explicitly asks.
- Commit after each verified task using only files intentionally changed for that task.

Baseline commands:

```powershell
git status --short
npm run check:window
rg -n "window\.|document\.|globalThis\.|self\.|NetworkMatchClient" game shared --glob "*.ts"
```

Expected current baseline before this plan is implemented:

- `npm run check:window` passes.
- The focused `rg` search still reports `game/turn-manager.ts` with `root.NetworkMatchClient`.

## File Map

- Modify `game/turn-manager.ts`: remove `NetworkMatchClient` discovery from the game layer and rely on `setUIImpl()` / `replaceUIImpl()` bridge values.
- Modify `test/turn-manager.retry.test.ts` or create `test/turn-manager.network-boundary.test.ts`: characterize the no-root-client behavior.
- Modify `scripts/check-window-usage.ts`: make the static checker reject indirect `NetworkMatchClient` property access inside source-of-truth `game/` files.
- Modify `test/code.window-usage.test.ts`: add a fixture proving `root.NetworkMatchClient` is rejected.
- Modify `utils/match-authority.ts` and `utils/match-authority-types.ts`: expose shared network constants and wrapper helpers that both Worker and local server can consume.
- Modify `workers/match-worker.ts` and `scripts/local-match-server.ts`: consume the shared authority constants/helpers instead of local duplicates, one helper family at a time.
- Modify focused authority tests: `test/utils.match-authority.publish-response.test.ts`, `test/utils.match-authority.contract-types.test.ts`, and existing Worker/local parity tests as needed.
- Modify `cards/card-interaction.ts`, `cards/card-renderer.ts`, and possibly `cards/card-interaction-pending-network.ts`: consolidate card UI network and owner helpers.
- Modify focused UI/card tests: `test/ui.card-surface-layout-contract.test.ts`, `test/ui.card-interaction-overlay-selection.test.ts`, `test/utils.owner-helpers.network-seat.test.ts`, or a new focused test when existing coverage cannot express the contract.

---

### Task 1: Remove `NetworkMatchClient` Discovery From `game/turn-manager.ts`

**Risk:** Medium. This is a boundary fix in `game/`, but the behavior should remain unchanged because `ui/bootstrap.ts` already injects `isNetworkSpectator` and `emitStatus`.

**Files:**

- Modify: `game/turn-manager.ts`
- Test: `test/turn-manager.network-boundary.test.ts`
- Related existing test: `test/ui.bootstrap.cpu-early-registration.test.ts`

- [ ] **Step 1: Add a failing behavioral boundary test**

Create `test/turn-manager.network-boundary.test.ts`:

```ts
describe('turn-manager network boundary', () => {
  beforeEach(() => {
    jest.resetModules();
    (global as any).BLACK = 1;
    (global as any).WHITE = -1;
    (global as any).gameState = { currentPlayer: 1 };
    (global as any).cardState = {
      fateWillControllerByTurnOwner: {},
      pendingEffectByPlayer: { black: null, white: null }
    };
    (global as any).NetworkMatchClient = {
      isSpectator: jest.fn(() => true),
      getSeatKey: jest.fn(() => 'black')
    };
  });

  afterEach(() => {
    delete (global as any).BLACK;
    delete (global as any).WHITE;
    delete (global as any).gameState;
    delete (global as any).cardState;
    delete (global as any).NetworkMatchClient;
  });

  test('does not discover root NetworkMatchClient from the game layer', () => {
    const turnManager = require('../game/turn-manager.js');
    const emitStatus = jest.fn();

    turnManager.setUIImpl({
      getRuntimeRoot: () => global,
      readMatchMode: () => 'network',
      LOCAL_PLAYER_KEY: 'black',
      emitStatus
    });

    expect(turnManager.canLocalUserOperateCurrentTurn()).toBe(true);
    expect((global as any).NetworkMatchClient.isSpectator).not.toHaveBeenCalled();
    expect(emitStatus).not.toHaveBeenCalled();
  });

  test('uses injected isNetworkSpectator bridge for read-only spectator status', () => {
    const turnManager = require('../game/turn-manager.js');
    const emitStatus = jest.fn();

    turnManager.setUIImpl({
      getRuntimeRoot: () => global,
      readMatchMode: () => 'network',
      LOCAL_PLAYER_KEY: 'black',
      isNetworkSpectator: () => true,
      emitStatus
    });

    expect(turnManager.canLocalUserOperateCurrentTurn()).toBe(false);
    expect(emitStatus).toHaveBeenCalledWith('観測中は操作できません', true);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails before implementation**

Run:

```powershell
npm run test:jest -- test/turn-manager.network-boundary.test.ts
```

Expected before implementation: the first test fails because `canLocalUserOperateCurrentTurn()` calls the root `NetworkMatchClient.isSpectator()` fallback and returns `false`.

- [ ] **Step 3: Remove the fallback from `isNetworkSpectatorForTurnManager()`**

Change `game/turn-manager.ts` so this function only consumes injected UI bridge data:

```ts
function isNetworkSpectatorForTurnManager() {
    try {
        const impl = __uiImpl_turn_manager;
        if (impl && typeof impl.isNetworkSpectator === 'function') return impl.isNetworkSpectator() === true;
        if (impl && impl.isNetworkSpectator === true) return true;
    } catch (e) { /* ignore */ }
    return false;
}
```

Do not add any alternate `window`, `globalThis`, `root`, or network-client lookup in `game/turn-manager.ts`.

- [ ] **Step 4: Run focused behavioral verification**

Run:

```powershell
npm run test:jest -- test/turn-manager.network-boundary.test.ts test/ui.bootstrap.cpu-early-registration.test.ts
```

Expected: PASS. The bootstrap test confirms the UI bridge still supplies spectator read-only behavior.

- [ ] **Step 5: Run boundary verification**

Run:

```powershell
npm run check:window
rg -n "window\.|document\.|globalThis\.|self\.|NetworkMatchClient" game shared --glob "*.ts"
```

Expected:

- `npm run check:window` passes.
- The focused `rg` search reports only acceptable `shared/match-entry-payload.ts` `globalThis.structuredClone` usage, and no `game/*.ts` `NetworkMatchClient` usage.

- [ ] **Step 6: Review and commit**

Run:

```powershell
git diff -- game/turn-manager.ts test/turn-manager.network-boundary.test.ts
git diff --check -- game/turn-manager.ts test/turn-manager.network-boundary.test.ts
git status --short
git add game/turn-manager.ts test/turn-manager.network-boundary.test.ts
git commit -m "Remove turn-manager network client fallback"
```

---

### Task 2: Strengthen the Boundary Static Check

**Risk:** Low to medium. This changes a repository guard script and its tests only.

**Files:**

- Modify: `scripts/check-window-usage.ts`
- Modify: `test/code.window-usage.test.ts`

- [ ] **Step 1: Add a failing fixture test for indirect root access**

Add this test to `test/code.window-usage.test.ts` after the existing root `NetworkMatchClient` tests:

```ts
  test('rejects indirect root NetworkMatchClient property access from game source', () => {
    fs.writeFileSync(
      networkClientFixturePath,
      "export function fixture(root) { return root && root.NetworkMatchClient; }\n",
      'utf8'
    );

    const res = runCheckWindowUsage();

    expect(res.status).toBe(2);
    expect(res.stderr).toContain('Forbidden usage found in non-UI files');
    expect(res.stderr).toContain('game/card-effects/__network-client-check-fixture.ts');
    expect(res.stderr).toContain('root NetworkMatchClient');
  });
```

- [ ] **Step 2: Run the focused checker test and verify it fails**

Run:

```powershell
npm run test:jest -- test/code.window-usage.test.ts
```

Expected before implementation: the new test fails because the checker does not reject `root.NetworkMatchClient`.

- [ ] **Step 3: Update the checker to reject `NetworkMatchClient` property names in enforced game files**

In `scripts/check-window-usage.ts`, extend the property access branch so source-of-truth `game/` files reject any property access named `NetworkMatchClient`, not only access through `window` or `globalThis`.

Use this logic inside the existing `propertyBase` branch:

```ts
        if (
            shouldEnforceGlobalThis(f)
            && (ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node))
            && node.name.text === 'NetworkMatchClient'
        ) {
            violations.push({ file: f, line: toLine(sourceFile, node), label: 'root NetworkMatchClient' });
        }
```

Keep the existing explicit `window` / `document` / `globalThis` checks.

- [ ] **Step 4: Run checker tests and the actual checker**

Run:

```powershell
npm run test:jest -- test/code.window-usage.test.ts
npm run check:window
```

Expected: PASS.

- [ ] **Step 5: Review and commit**

Run:

```powershell
git diff -- scripts/check-window-usage.ts test/code.window-usage.test.ts
git diff --check -- scripts/check-window-usage.ts test/code.window-usage.test.ts
git status --short
git add scripts/check-window-usage.ts test/code.window-usage.test.ts
git commit -m "Catch indirect network client access in game checks"
```

---

### Task 3: Move Shared Network Constants to Match Authority

**Risk:** Medium. Worker/local/server values must remain byte-for-byte equivalent where externally visible.

**Files:**

- Modify: `utils/match-authority.ts`
- Modify: `utils/match-authority-types.ts`
- Modify: `workers/match-worker.ts`
- Modify: `scripts/local-match-server.ts`
- Test: `test/utils.match-authority.contract-types.test.ts`

- [ ] **Step 1: Add constants contract coverage**

Add to `test/utils.match-authority.contract-types.test.ts`:

```ts
test('exports shared network room constants used by worker and local server', () => {
  const MatchAuthority = require('../utils/match-authority');

  expect(MatchAuthority.CHAT_MAX_LENGTH).toBe(20);
  expect(MatchAuthority.CHAT_HISTORY_LIMIT).toBe(40);
  expect(MatchAuthority.NETWORK_TURN_LIMIT_SECONDS).toBe(120);
  expect(MatchAuthority.NETWORK_TURN_LIMIT_MS).toBe(120000);
  expect(MatchAuthority.SSE_HEARTBEAT_INTERVAL_MS).toBe(10000);
});
```

- [ ] **Step 2: Run the focused contract test and verify it fails**

Run:

```powershell
npm run test:jest -- test/utils.match-authority.contract-types.test.ts
```

Expected before implementation: FAIL because the constants are not all exported from `utils/match-authority.ts`.

- [ ] **Step 3: Export the constants from `utils/match-authority.ts`**

Near the existing authority constants, add:

```ts
const CHAT_MAX_LENGTH = 20;
const CHAT_HISTORY_LIMIT = 40;
const NETWORK_TURN_LIMIT_SECONDS = 120;
const NETWORK_TURN_LIMIT_MS = NETWORK_TURN_LIMIT_SECONDS * 1000;
const SSE_HEARTBEAT_INTERVAL_MS = 10000;
```

Add these names to the exported object at the bottom:

```ts
    CHAT_MAX_LENGTH,
    CHAT_HISTORY_LIMIT,
    NETWORK_TURN_LIMIT_SECONDS,
    NETWORK_TURN_LIMIT_MS,
    SSE_HEARTBEAT_INTERVAL_MS,
```

Update `utils/match-authority-types.ts` so the exported contract includes numeric properties:

```ts
    CHAT_MAX_LENGTH: number;
    CHAT_HISTORY_LIMIT: number;
    NETWORK_TURN_LIMIT_SECONDS: number;
    NETWORK_TURN_LIMIT_MS: number;
    SSE_HEARTBEAT_INTERVAL_MS: number;
```

- [ ] **Step 4: Replace duplicated constants in Worker and local server**

In `workers/match-worker.ts`, replace local constants:

```ts
const CHAT_MAX_LENGTH = Number(MatchAuthority.CHAT_MAX_LENGTH);
const CHAT_HISTORY_LIMIT = Number(MatchAuthority.CHAT_HISTORY_LIMIT);
const NETWORK_TURN_LIMIT_SECONDS = Number(MatchAuthority.NETWORK_TURN_LIMIT_SECONDS);
const NETWORK_TURN_LIMIT_MS = Number(MatchAuthority.NETWORK_TURN_LIMIT_MS);
const SSE_HEARTBEAT_INTERVAL_MS = Number(MatchAuthority.SSE_HEARTBEAT_INTERVAL_MS);
```

In `scripts/local-match-server.ts`, make the same replacement. Keep `SSE_WRITE_TIMEOUT_MS` local to Worker unless a matching local-server write timeout exists and has identical semantics.

- [ ] **Step 5: Run focused verification**

Run:

```powershell
npm run test:jest -- test/utils.match-authority.contract-types.test.ts test/utils.match-authority.publish-response.test.ts
npm run test:network:parity
```

Expected: PASS. If network parity fails, inspect whether the payload changed; do not update snapshots to hide a behavior change.

- [ ] **Step 6: Review and commit**

Run:

```powershell
git diff -- utils/match-authority.ts utils/match-authority-types.ts workers/match-worker.ts scripts/local-match-server.ts test/utils.match-authority.contract-types.test.ts
git diff --check -- utils/match-authority.ts utils/match-authority-types.ts workers/match-worker.ts scripts/local-match-server.ts test/utils.match-authority.contract-types.test.ts
git status --short
git add utils/match-authority.ts utils/match-authority-types.ts workers/match-worker.ts scripts/local-match-server.ts test/utils.match-authority.contract-types.test.ts
git commit -m "Share network room constants through authority"
```

---

### Task 4: Centralize Spectator and Request ID Factories

**Risk:** Medium. Token formats and rematch request IDs are externally transported, so preserve exact prefixes and sanitization.

**Files:**

- Modify: `utils/match-authority.ts`
- Modify: `utils/match-authority-types.ts`
- Modify: `workers/match-worker.ts`
- Modify: `scripts/local-match-server.ts`
- Test: `test/utils.match-authority.contract-types.test.ts`

- [ ] **Step 1: Add factory behavior tests**

Add to `test/utils.match-authority.contract-types.test.ts`:

```ts
test('shared spectator and rematch id factories preserve transport formats', () => {
  const MatchAuthority = require('../utils/match-authority');
  const makeSeatToken = jest.fn(() => 'abc.DEF-123_extra');
  const now = jest.fn(() => 1234567890);

  expect(MatchAuthority.makeSpectatorToken(makeSeatToken)).toBe('abc.DEF-123_extra');
  expect(MatchAuthority.makeSpectatorId(makeSeatToken)).toBe('spec_abcDEF-123_extra'.slice(0, 'spec_'.length + 16));
  expect(MatchAuthority.makeRematchRequestId(makeSeatToken, now)).toBe('rematch_1234567890_abcDEF-123');
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm run test:jest -- test/utils.match-authority.contract-types.test.ts
```

Expected before implementation: FAIL because these helpers are not exported.

- [ ] **Step 3: Add shared factories**

In `utils/match-authority.ts`, add:

```ts
function makeSpectatorToken(makeSeatTokenFn: (() => string) = makeSeatToken): string {
    return makeSeatTokenFn();
}

function makeSpectatorId(makeSeatTokenFn: (() => string) = makeSeatToken): string {
    return `spec_${makeSeatTokenFn().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16)}`;
}

function makeRematchRequestId(
    makeSeatTokenFn: (() => string) = makeSeatToken,
    nowFn: (() => number) = Date.now
): string {
    return `rematch_${nowFn()}_${makeSeatTokenFn().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12)}`;
}
```

Export the three helpers and add their signatures to `utils/match-authority-types.ts`.

- [ ] **Step 4: Replace Worker/local duplicate helpers**

In `workers/match-worker.ts`:

```ts
function makeSpectatorToken(): string {
    return MatchAuthority.makeSpectatorToken(makeSeatToken);
}

function makeSpectatorId(): string {
    return MatchAuthority.makeSpectatorId(makeSeatToken);
}

function makeRematchRequestId(): string {
    return MatchAuthority.makeRematchRequestId(makeSeatToken, Date.now);
}
```

In `scripts/local-match-server.ts`, use the same wrappers. Keep wrapper functions if local call sites expect local names.

- [ ] **Step 5: Run focused and parity verification**

Run:

```powershell
npm run test:jest -- test/utils.match-authority.contract-types.test.ts test/ui.network-client.reconnect-sync.test.ts
npm run test:network:parity
```

Expected: PASS.

- [ ] **Step 6: Review and commit**

Run:

```powershell
git diff -- utils/match-authority.ts utils/match-authority-types.ts workers/match-worker.ts scripts/local-match-server.ts test/utils.match-authority.contract-types.test.ts
git diff --check -- utils/match-authority.ts utils/match-authority-types.ts workers/match-worker.ts scripts/local-match-server.ts test/utils.match-authority.contract-types.test.ts
git status --short
git add utils/match-authority.ts utils/match-authority-types.ts workers/match-worker.ts scripts/local-match-server.ts test/utils.match-authority.contract-types.test.ts
git commit -m "Share network identity factories"
```

---

### Task 5: Centralize Room Payload Wrapper Delegation

**Risk:** Medium to high. Snapshot, presence, and heartbeat payloads are network-visible. This task must preserve response shapes exactly.

**Files:**

- Modify: `utils/match-authority.ts`
- Modify: `utils/match-authority-types.ts`
- Modify: `workers/match-worker.ts`
- Modify: `scripts/local-match-server.ts`
- Test: `test/utils.match-authority.publish-response.test.ts`
- Test: `test/workers.match-publish-idempotency.test.ts` or closest existing network parity fixture

- [ ] **Step 1: Confirm current shared helpers already preserve room envelope fields**

Run:

```powershell
npm run test:jest -- test/utils.match-authority.publish-response.test.ts
```

Expected: PASS. Existing tests include `buildSnapshotPayloadFromRoom reuses shared room envelope fields` and `buildSnapshotPayloadFromRoom preserves auto pass notice metadata`.

- [ ] **Step 2: Add a wrapper parity test for Worker/local-compatible options**

Add to `test/utils.match-authority.publish-response.test.ts`:

```ts
test('buildPresencePayloadFromRoom and buildHeartbeatPayloadFromRoom preserve viewer-neutral room fields', () => {
  const MatchAuthority = require('../utils/match-authority');
  const room = {
    roomId: 'ABCD',
    stateVersion: 3,
    seats: { black: true, white: false },
    seatNames: { black: '黒', white: '' },
    spectators: {
      spec_a: { token: 'secret', name: '観測者', joinedAt: 1, lastSeenAt: 2 }
    },
    maxSpectators: 4,
    updatedAt: 99
  };

  expect(MatchAuthority.buildPresencePayloadFromRoom(room, {
    type: 'presence',
    seatKey: 'black',
    playerName: '黒'
  })).toEqual(expect.objectContaining({
    ok: true,
    roomId: 'ABCD',
    stateVersion: 3,
    type: 'presence',
    seatKey: 'black',
    playerName: '黒',
    spectatorCount: 1,
    maxSpectators: 4
  }));

  expect(MatchAuthority.buildHeartbeatPayloadFromRoom(room, 123)).toEqual(expect.objectContaining({
    type: 'heartbeat',
    roomId: 'ABCD',
    stateVersion: 3,
    serverTime: 123,
    spectatorCount: 1,
    maxSpectators: 4
  }));
});
```

- [ ] **Step 3: Run the focused test**

Run:

```powershell
npm run test:jest -- test/utils.match-authority.publish-response.test.ts
```

Expected: PASS before production changes if helpers already cover this. If it fails, update `utils/match-authority.ts` first and do not touch Worker/local code until the shared helper behavior is locked down.

- [ ] **Step 4: Replace Worker/local wrapper bodies with direct shared calls**

In `workers/match-worker.ts`, keep `buildSnapshotPayload`, `buildPresencePayload`, and `buildHeartbeatPayload` as thin wrappers over `MatchAuthority` only. Avoid local reconstruction of fields that the shared helper already owns.

In `scripts/local-match-server.ts`, match the same wrapper shape. The wrappers should differ only where runtime I/O requires it, not in payload construction.

- [ ] **Step 5: Run network contract verification**

Run:

```powershell
npm run test:jest -- test/utils.match-authority.publish-response.test.ts test/workers.match-publish-idempotency.test.ts test/ui.network-client.reconnect-sync.test.ts
npm run test:network:parity
```

Expected: PASS. If any response JSON changes, stop and classify whether the shared helper or wrapper options are wrong; do not treat changed payload shape as refactoring.

- [ ] **Step 6: Review and commit**

Run:

```powershell
git diff -- utils/match-authority.ts utils/match-authority-types.ts workers/match-worker.ts scripts/local-match-server.ts test/utils.match-authority.publish-response.test.ts
git diff --check -- utils/match-authority.ts utils/match-authority-types.ts workers/match-worker.ts scripts/local-match-server.ts test/utils.match-authority.publish-response.test.ts
git status --short
git add utils/match-authority.ts utils/match-authority-types.ts workers/match-worker.ts scripts/local-match-server.ts test/utils.match-authority.publish-response.test.ts
git commit -m "Share network room payload wrappers"
```

---

### Task 6: Consolidate Card UI Network Client Resolution

**Risk:** Medium. This touches UI input permissions and spectator read-only behavior. Preserve every status message.

**Files:**

- Modify: `cards/card-interaction-pending-network.ts`
- Modify: `cards/card-interaction.ts`
- Test: `test/ui.card-interaction-overlay-selection.test.ts` or create `test/ui.card-interaction-network-boundary.test.ts`

- [ ] **Step 1: Add a focused card UI helper test**

Create `test/ui.card-interaction-network-boundary.test.ts`:

```ts
describe('card interaction network boundary', () => {
  beforeEach(() => {
    jest.resetModules();
    (global as any).window = global;
    (global as any).NetworkMatchClient = {
      isActive: jest.fn(() => true),
      isSpectator: jest.fn(() => true),
      getSeatKey: jest.fn(() => 'white')
    };
  });

  afterEach(() => {
    delete (global as any).window;
    delete (global as any).NetworkMatchClient;
  });

  test('pending network helper is the only card interaction root client resolver', () => {
    const pendingNetwork = require('../cards/card-interaction-pending-network');

    expect(pendingNetwork.getActiveNetworkMatchClient()).toBe((global as any).NetworkMatchClient);
  });
});
```

This test is intentionally narrow. It should pass before implementation and remain the stable import point while `cards/card-interaction.ts` stops duplicating root scanning.

- [ ] **Step 2: Run focused baseline**

Run:

```powershell
npm run test:jest -- test/ui.card-interaction-network-boundary.test.ts test/ui.card-interaction-overlay-selection.test.ts
```

Expected: PASS before production changes.

- [ ] **Step 3: Move spectator checks into `cards/card-interaction-pending-network.ts`**

Add this exported helper:

```ts
function isNetworkSpectatorActive(): boolean {
    const networkClient = getActiveNetworkMatchClient();
    try {
        return !!(networkClient && typeof networkClient.isSpectator === 'function' && networkClient.isSpectator() === true);
    } catch (e) {
        return false;
    }
}
```

Export it in the module object.

- [ ] **Step 4: Simplify `cards/card-interaction.ts` spectator detection**

Change `_isNetworkSpectatorActiveForCardUi()` to call the helper:

```ts
function _isNetworkSpectatorActiveForCardUi() {
    try {
        if (
            _cardInteractionPendingNetworkModule
            && typeof _cardInteractionPendingNetworkModule.isNetworkSpectatorActive === 'function'
        ) {
            return _cardInteractionPendingNetworkModule.isNetworkSpectatorActive() === true;
        }
    } catch (e) { /* ignore */ }
    return false;
}
```

Do not keep duplicate loops over `window`, `globalThis`, or root references in `cards/card-interaction.ts`.

- [ ] **Step 5: Run UI/card verification**

Run:

```powershell
npm run test:jest -- test/ui.card-interaction-network-boundary.test.ts test/ui.card-interaction-overlay-selection.test.ts test/game.pending-selection-flow.test.ts
```

Expected: PASS.

- [ ] **Step 6: Review and commit**

Run:

```powershell
git diff -- cards/card-interaction-pending-network.ts cards/card-interaction.ts test/ui.card-interaction-network-boundary.test.ts
git diff --check -- cards/card-interaction-pending-network.ts cards/card-interaction.ts test/ui.card-interaction-network-boundary.test.ts
git status --short
git add cards/card-interaction-pending-network.ts cards/card-interaction.ts test/ui.card-interaction-network-boundary.test.ts
git commit -m "Centralize card interaction network lookup"
```

---

### Task 7: Replace Card UI Local Player Resolution Duplicates

**Risk:** Low to medium. This is UI-only but affects network seat perspective.

**Files:**

- Modify: `cards/card-interaction.ts`
- Modify: `cards/card-renderer.ts`
- Test: `test/utils.owner-helpers.network-seat.test.ts`
- Test: `test/ui.card-surface-layout-contract.test.ts`

- [ ] **Step 1: Add or confirm owner helper coverage**

Run:

```powershell
npm run test:jest -- test/utils.owner-helpers.network-seat.test.ts
```

Expected: PASS. Existing tests cover `resolveLocalPlayerKey` priority for `NetworkMatchClient`, direct globals, projected hidden hands, and stale seats.

- [ ] **Step 2: Replace `_getNetworkLocalPlayerKey()` in `cards/card-interaction.ts`**

Keep one local wrapper for call-site readability, but delegate to `OwnerHelpers`:

```ts
function _getNetworkLocalPlayerKey() {
    try {
        if (_ownerHelpersModule && typeof _ownerHelpersModule.resolveLocalPlayerKey === 'function') {
            return _ownerHelpersModule.resolveLocalPlayerKey(typeof window !== 'undefined' ? window : null);
        }
    } catch (e) { /* ignore */ }
    return 'black';
}
```

Remove the duplicate direct `window.NetworkMatchClient.getSeatKey()` and direct-key loop from this function.

- [ ] **Step 3: Replace `_getLocalPlayerKeyForNetwork()` in `cards/card-renderer.ts`**

Use the same delegation pattern:

```ts
function _getLocalPlayerKeyForNetwork() {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.resolveLocalPlayerKey === 'function') {
            return OwnerHelpersModule.resolveLocalPlayerKey(typeof window !== 'undefined' ? window : null);
        }
    }
    catch (e) { /* ignore */ }
    return 'black';
}
```

Remove the duplicate direct `window.NetworkMatchClient.getSeatKey()` and direct-key loop from this function.

- [ ] **Step 4: Run UI/card verification**

Run:

```powershell
npm run test:jest -- test/utils.owner-helpers.network-seat.test.ts test/ui.card-surface-layout-contract.test.ts test/ui.card-detail-effect-tags.test.ts
```

Expected: PASS.

- [ ] **Step 5: Review and commit**

Run:

```powershell
git diff -- cards/card-interaction.ts cards/card-renderer.ts
git diff --check -- cards/card-interaction.ts cards/card-renderer.ts
git status --short
git add cards/card-interaction.ts cards/card-renderer.ts
git commit -m "Use owner helper for card UI local seat"
```

---

### Task 8: Normalize Card UI Owner-Key Checks Through Existing Helpers

**Risk:** Medium. These checks influence hidden hand visibility, observed cards, charge deltas, and selection contexts.

**Files:**

- Modify: `cards/card-interaction.ts`
- Modify: `cards/card-renderer.ts`
- Test: focused card-renderer and card-interaction tests selected by touched functions

- [ ] **Step 1: Identify exact duplicated owner checks**

Run:

```powershell
rg -n "ownerKey === 'white'|ownerKey === 'black'|playerKey === 'white'|playerKey === 'black'" cards/card-interaction.ts cards/card-renderer.ts
```

Expected before implementation: multiple results in both files. Classify each result as either owner normalization or intentional display branching.

- [ ] **Step 2: Add a small local normalizer only if an existing helper cannot be called directly**

In `cards/card-renderer.ts`, prefer `_normalizePlayerKeyForRender()`. For owner-specific functions, use:

```ts
function _normalizeOwnerKeyForRender(ownerKey: any): PlayerOwnerKey | null {
    return _normalizePlayerKeyForRender(ownerKey) as PlayerOwnerKey | null;
}
```

In `cards/card-interaction.ts`, prefer existing `_normalizeOwnerKey()` when fallback-to-black behavior is desired. For nullable checks, add:

```ts
function _normalizeOwnerKeyOptional(ownerKey: any): CardInteractionPlayerKey | null {
    try {
        if (_ownerHelpersModule && typeof _ownerHelpersModule.normalizePlayerKeyOptional === 'function') {
            return _ownerHelpersModule.normalizePlayerKeyOptional(ownerKey);
        }
    } catch (e) { /* ignore */ }
    return ownerKey === 'white' ? 'white' : (ownerKey === 'black' ? 'black' : null);
}
```

Use the nullable helper only where the current behavior returns `false` or `null` for invalid owner values.

- [ ] **Step 3: Replace one cluster at a time**

Start with charge-delta and board-target selection helpers in `cards/card-interaction.ts`:

- `_hasCardUseCostChargeDelta`
- `_doesRunResultEnterBoardTargetSelectionForOwner`
- `_getBoardTargetSelectionEntryContext`

Then replace renderer visibility helpers:

- `_isHandCardRevealedToViewerForRender`
- `_isHandCardObservedForRender`
- `_hasActiveObserverWillRevealForRender`
- `_hasOwnerUsedCardThisActiveTurnForRender`

Preserve invalid-owner behavior exactly: functions that returned `false` still return `false`; functions that returned `null` still return `null`.

- [ ] **Step 4: Run focused tests after each cluster**

Run after the interaction cluster:

```powershell
npm run test:jest -- test/game.pending-selection-flow.test.ts test/ui.card-interaction-overlay-selection.test.ts
```

Run after the renderer cluster:

```powershell
npm run test:jest -- test/ui.card-surface-layout-contract.test.ts test/ui.card-detail-effect-tags.test.ts
```

Expected: PASS. If a test fails because fallback-to-black changed to nullable behavior, revert that specific replacement and document why it remains explicit.

- [ ] **Step 5: Re-run duplicate scan**

Run:

```powershell
rg -n "ownerKey === 'white'|ownerKey === 'black'|playerKey === 'white'|playerKey === 'black'" cards/card-interaction.ts cards/card-renderer.ts
```

Expected: remaining hits are intentional display branches or fallback defaults. Add a short inline comment only where a remaining explicit branch could be mistaken for missed normalization.

- [ ] **Step 6: Review and commit**

Run:

```powershell
git diff -- cards/card-interaction.ts cards/card-renderer.ts
git diff --check -- cards/card-interaction.ts cards/card-renderer.ts
git status --short
git add cards/card-interaction.ts cards/card-renderer.ts
git commit -m "Normalize card UI owner checks through helpers"
```

---

### Task 9: Final Cross-Boundary Verification

**Risk:** Low if Tasks 1-8 are already committed. This task verifies the combined refactor, and should not make production edits unless a focused failure requires a small fix.

**Files:**

- No planned production changes.
- Generated/mirror files only if a prior committed task intentionally changed deploy assets and `npm run worker:prepare` is required.

- [ ] **Step 1: Run boundary and targeted suites**

Run:

```powershell
npm run check:window
npm run test:jest -- test/code.window-usage.test.ts test/turn-manager.network-boundary.test.ts test/ui.bootstrap.cpu-early-registration.test.ts
npm run test:jest -- test/utils.match-authority.contract-types.test.ts test/utils.match-authority.publish-response.test.ts
npm run test:jest -- test/utils.owner-helpers.network-seat.test.ts test/ui.card-surface-layout-contract.test.ts test/ui.card-interaction-overlay-selection.test.ts
npm run test:network:parity
```

Expected: PASS.

- [ ] **Step 2: Run broader type/build checks when time permits**

Run:

```powershell
npm run typecheck
npm run build:ts
```

Expected: PASS. If these fail on pre-existing unrelated work, capture the first relevant errors and identify whether they touch files changed by this plan.

- [ ] **Step 3: Run final source scans**

Run:

```powershell
rg -n "window\.|document\.|globalThis\.|self\.|NetworkMatchClient" game shared --glob "*.ts"
rg -n "const CHAT_MAX_LENGTH|const CHAT_HISTORY_LIMIT|const NETWORK_TURN_LIMIT_SECONDS" workers/match-worker.ts scripts/local-match-server.ts
rg -n "NetworkMatchClient|getSeatKey|ownerKey === 'white'|ownerKey === 'black'" cards/card-interaction.ts cards/card-renderer.ts
```

Expected:

- No `game/*.ts` `NetworkMatchClient` hits.
- Worker/local constants read through `MatchAuthority`.
- Remaining card UI hits are either centralized helper usage or intentionally documented display branches.

- [ ] **Step 4: Review final diff state**

Run:

```powershell
git status --short
git log --oneline -n 8
```

Expected: each task has its own focused commit. Unrelated dirty files, if any, are clearly not part of this refactor.

## Rollback Plan

Rollback one task at a time by reverting its focused commit:

```powershell
git revert <commit-sha>
```

Rollback order should be reverse execution order. If a later task depends on an earlier helper export, revert the dependent task first.

## Stop Conditions

Stop and ask for direction if any of these occur:

- A proposed change modifies network response shape, status/error reason, route behavior, token format, operation id semantics, or serialization.
- A change requires editing `01-rulebook.md`.
- `npm run test:network:parity` fails and the failure is plausibly caused by changed Worker/local behavior.
- Dirty unrelated files overlap the same target files and cannot be separated safely.
- Fixing a failure would require public API/import path changes outside the files listed in this plan.

## Self-Review

- Spec coverage: all three requested refactor targets are covered by Tasks 1-2, Tasks 3-5, and Tasks 6-8.
- Placeholder scan: no unresolved task markers or unspecified test commands are present.
- Type consistency: helper names used later are defined in earlier tasks or already exist in current source.
- Verification coverage: boundary, authority parity, UI/card, typecheck, and build checks are explicitly listed.

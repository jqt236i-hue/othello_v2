# Network Spectator Live Failures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make network spectators fully read-only and reload-resumable in the deployed browser game.

**Architecture:** Keep the Worker/local server as canonical authority and keep spectators as authenticated viewers, never as black/white seats. Add spectator guards at every browser input boundary before local game mutation can happen, persist spectator credentials like seat credentials, and restore the active network session during browser boot before showing local CPU state.

**Tech Stack:** TypeScript browser modules, Jest/jsdom unit tests, Playwright live browser verification, Cloudflare Workers/Wrangler deployment.

---

## Evidence And Scope

Live public check on `https://card.reversi-0.workers.dev/` with Chrome host, Microsoft Edge guest, and a separate Chrome spectator profile found:

- `PASS`: room creation.
- `PASS`: Edge player join.
- `PASS`: spectator join with `NetworkMatchClient.isSpectator() === true`.
- `PASS`: host and guest moves synchronize to the spectator when players make legal moves.
- `FAIL`: spectator board click mutates only the spectator's local `gameState`/`cardState`.
- `FAIL`: spectator sees seat-oriented labels such as `あなたのターン` and `黒（あなた）`.
- `FAIL`: reloading Edge or the spectator page drops back to CPU mode instead of restoring the network room.

Artifacts from the check are in `tmp-live-spectator-check-1781765106750/`, especially:

- `spectator-action-guard.json`
- `refresh-summary.json`
- `04-spectator-click-rejected.png`
- `07-spectator-after-refresh.png`

Existing source-of-truth requirements already cover this behavior:

- `01-rulebook.md:1741-1745`
- `docs/architecture-contracts.md:423-428`

No player-facing rules change is required. This plan fixes implementation drift from those specs.

## File Structure

- Modify `game/turn-manager.ts`
  - Add a headless-safe `isNetworkSpectatorForTurnManager()` runtime helper.
  - Make `canLocalUserOperateCurrentTurn()` return `false` for network spectators before any board move or pending target selection can mutate local state.
- Modify `ui/bootstrap.ts`
  - Pass `isNetworkSpectator` and `emitStatus` into the turn-manager UI bridge.
- Modify `ui/bootstrap/init-events.ts`
  - Wrap card use, hand destruction, and pass button handlers with a spectator read-only guard.
- Modify `ui/game-keyboard-shortcuts.ts`
  - Block keyboard-triggered board actions and pass actions for spectator sessions.
- Modify `ui/status-display.ts`
  - Render spectator turn text as observational text, not `あなたのターン`.
  - Suppress turn-arrival toasts for spectators.
- Modify `ui/handlers/match-mode.ts`
  - Render turn timer labels without `（あなた）` for spectators.
  - Restore stored network sessions on boot and switch the UI into network mode when restoration succeeds.
- Modify `ui/network/session-seat.ts`
  - Extend session persistence to include a last active viewer session with `viewerRole`, seat credentials, or spectator credentials.
  - Clear persisted spectator credentials only on explicit spectator leave or token rejection.
- Modify `ui/network/session-lifecycle.ts`
  - Add `restoreStoredSession()` to reactivate saved seat or spectator sessions, fetch authoritative state, and open the correct SSE stream.
- Modify `ui/network-client.ts`
  - Wire the persistence helpers into controller config.
  - Expose `restoreStoredSession()` on `NetworkMatchClient`.
- Add focused regression tests:
  - `test/turn-manager.retry.test.ts`
  - `test/ui.bootstrap.cpu-early-registration.test.ts`
  - `test/ui.init-events.spectator-readonly.test.ts`
  - `test/ui.game-keyboard-shortcuts.spectator.test.ts`
  - `test/ui.status-display.network-seat.test.ts`
  - `test/ui.match-mode.network-button.test.ts`
  - `test/ui.network-client.spectator.test.ts`
  - `test/ui.network-session-lifecycle.test.ts`

---

### Task 1: Block Spectator Board Clicks Before Local Mutation

**Files:**
- Modify: `game/turn-manager.ts`
- Modify: `ui/bootstrap.ts`
- Test: `test/turn-manager.retry.test.ts`
- Test: `test/ui.bootstrap.cpu-early-registration.test.ts`

- [ ] **Step 1: Write the failing turn-manager test**

Add this test in `test/turn-manager.retry.test.ts` inside `describe('turn-manager scheduling', ...)`:

```ts
test('network spectator board click does not execute a local move', () => {
  const executeMove = jest.fn();
  const emitStatus = jest.fn();
  global.MATCH_MODE = 'network';
  global.gameState = {
    currentPlayer: global.BLACK,
    turnNumber: 0,
    board: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, global.WHITE, global.BLACK, 0, 0, 0],
      [0, 0, 0, global.BLACK, global.WHITE, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ]
  };
  global.cardState = {
    pendingEffectByPlayer: { black: null, white: null },
    presentationEvents: [],
    _presentationEventsPersist: []
  };

  const rm = require('../game/turn-manager.js');
  rm.setUIImpl({
    readMatchMode: () => 'network',
    readHumanVsHumanMode: () => true,
    readNetworkSeatKey: () => 'black',
    isNetworkSpectator: () => true,
    emitStatus,
    executeMove,
    findMoveForCell: () => ({
      row: 2,
      col: 3,
      flips: [{ row: 3, col: 3 }]
    })
  });

  rm.handleCellClick(2, 3);

  expect(executeMove).not.toHaveBeenCalled();
  expect(global.gameState.board[2][3]).toBe(0);
  expect(emitStatus).toHaveBeenCalledWith('観戦中は操作できません', true);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npx jest test/turn-manager.retry.test.ts --runInBand -t "network spectator board click"
```

Expected: FAIL because `executeMove` is called or the status writer is not called.

- [ ] **Step 3: Add the turn-manager spectator helper and gate**

In `game/turn-manager.ts`, add this helper near `isNetworkModeForTurnManager()`:

```ts
function isNetworkSpectatorForTurnManager() {
    try {
        const implFn = readTurnManagerRuntimeFunction('isNetworkSpectator');
        if (typeof implFn === 'function') return implFn() === true;
    } catch (e) { /* ignore */ }
    try {
        const implValue = readTurnManagerRuntimeValue('isNetworkSpectator');
        if (implValue === true) return true;
    } catch (e) { /* ignore */ }
    try {
        const root = getTurnManagerRuntimeRoot();
        const client = root && root.NetworkMatchClient;
        if (client && typeof client.isSpectator === 'function') return client.isSpectator() === true;
    } catch (e) { /* ignore */ }
    return false;
}

function emitSpectatorReadOnlyStatusForTurnManager() {
    try {
        const emitStatus = readTurnManagerRuntimeFunction('emitStatus');
        if (typeof emitStatus === 'function') emitStatus('観戦中は操作できません', true);
    } catch (e) { /* ignore */ }
}
```

Then update `canLocalUserOperateCurrentTurn()`:

```ts
function canLocalUserOperateCurrentTurn() {
    const isNetworkMode = isNetworkModeForTurnManager();
    if (isNetworkMode && isNetworkSpectatorForTurnManager()) {
        emitSpectatorReadOnlyStatusForTurnManager();
        return false;
    }
    const currentPlayerKey = getPlayerKey(gameState.currentPlayer);
    // keep the existing FATE_WILL and seat checks below this point
}
```

Keep the existing FATE_WILL and local seat logic unchanged after this early spectator return.

- [ ] **Step 4: Wire the browser bridge**

In `ui/bootstrap.ts`, inside the `tm.setUIImpl({ ... })` object, add:

```ts
                    isNetworkSpectator: () => {
                        try {
                            if (typeof globalThis === 'undefined' || !(globalThis as any).NetworkMatchClient) return false;
                            const client = (globalThis as any).NetworkMatchClient;
                            return typeof client.isSpectator === 'function' && client.isSpectator() === true;
                        } catch (e: any) {
                            return false;
                        }
                    },
                    emitStatus: (message: any, isError?: any) => {
                        try {
                            const client = typeof globalThis !== 'undefined' ? (globalThis as any).NetworkMatchClient : null;
                            if (client && typeof client.setStatusWriter === 'function') {
                                const writer = (client.getState && client.getState().statusWriter) || null;
                                if (typeof writer === 'function') {
                                    writer(String(message || ''), isError === true);
                                    return true;
                                }
                            }
                        } catch (e: any) { /* ignore */ }
                        try {
                            const root = typeof globalThis !== 'undefined' ? (globalThis as any) : null;
                            if (root && typeof root.writeNetworkStatus === 'function') {
                                root.writeNetworkStatus(String(message || ''), isError === true);
                                return true;
                            }
                        } catch (e: any) { /* ignore */ }
                        return false;
                    },
```

If `writeNetworkStatus` is not currently exported on `window`, add that export in `ui/handlers/match-mode.ts` in the same style as existing `MatchMode` exports.

- [ ] **Step 5: Add bootstrap bridge test**

In `test/ui.bootstrap.cpu-early-registration.test.ts`, extend the existing turn-manager bridge test or add:

```ts
test('installGameDI wires turn-manager spectator status bridge', () => {
  const setUIImpl = jest.fn();
  const statusWriter = jest.fn();
  global.NetworkMatchClient = {
    isSpectator: jest.fn(() => true),
    getState: jest.fn(() => ({ statusWriter }))
  };
  jest.doMock('../game/turn-manager', () => ({ setUIImpl }));
  jest.doMock('../game/cpu-turn-handler', () => ({}));

  const uiBoot = require('../ui/bootstrap.ts');
  uiBoot.installGameDI();

  const impl = setUIImpl.mock.calls.map((args) => args[0]).find((entry) => entry && typeof entry.isNetworkSpectator === 'function');
  expect(impl.isNetworkSpectator()).toBe(true);
  expect(impl.emitStatus('観戦中は操作できません', true)).toBe(true);
  expect(statusWriter).toHaveBeenCalledWith('観戦中は操作できません', true);
});
```

- [ ] **Step 6: Run focused tests**

Run:

```powershell
npx jest test/turn-manager.retry.test.ts test/ui.bootstrap.cpu-early-registration.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add game/turn-manager.ts ui/bootstrap.ts test/turn-manager.retry.test.ts test/ui.bootstrap.cpu-early-registration.test.ts
git commit -m "観戦者の盤面入力を無効化"
```

---

### Task 2: Block Spectator Card, Pass, And Keyboard Entrypoints

**Files:**
- Modify: `ui/bootstrap/init-events.ts`
- Modify: `ui/game-keyboard-shortcuts.ts`
- Test: `test/ui.init-events.spectator-readonly.test.ts`
- Test: `test/ui.game-keyboard-shortcuts.spectator.test.ts`

- [ ] **Step 1: Write init-events failing tests**

Create `test/ui.init-events.spectator-readonly.test.ts`:

```ts
import { JSDOM } from 'jsdom';

describe('init-events spectator read-only guards', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><button id="use"></button><button id="destroy"></button><button id="pass"></button>');
    global.window = dom.window as any;
    global.document = dom.window.document;
    (global as any).NetworkMatchClient = {
      isSpectator: jest.fn(() => true),
      publishSnapshot: jest.fn(),
      getState: jest.fn(() => ({ statusWriter: jest.fn() }))
    };
  });

  afterEach(() => {
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).NetworkMatchClient;
  });

  test('use, destroy, and pass buttons do not call game actions for spectators', () => {
    const useSelectedCard = jest.fn();
    const destroySelectedHandCard = jest.fn();
    const passCurrentTurn = jest.fn();
    (global as any).useSelectedCard = useSelectedCard;
    (global as any).destroySelectedHandCard = destroySelectedHandCard;
    (global as any).passCurrentTurn = passCurrentTurn;

    const { attachInitEventListeners } = require('../ui/bootstrap/init-events.js');
    attachInitEventListeners({
      useBtn: document.getElementById('use'),
      destroyBtn: document.getElementById('destroy'),
      passBtn: document.getElementById('pass')
    });

    document.getElementById('use')!.click();
    document.getElementById('destroy')!.click();
    document.getElementById('pass')!.click();

    expect(useSelectedCard).not.toHaveBeenCalled();
    expect(destroySelectedHandCard).not.toHaveBeenCalled();
    expect(passCurrentTurn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Write keyboard failing test**

Create `test/ui.game-keyboard-shortcuts.spectator.test.ts`:

```ts
import { JSDOM } from 'jsdom';

describe('game keyboard shortcuts spectator guard', () => {
  test('spectator key actions do not call board or pass handlers', () => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    const handleCellClick = jest.fn();
    const passCurrentTurn = jest.fn();
    (dom.window as any).NetworkMatchClient = { isSpectator: () => true };
    (dom.window as any).handleCellClick = handleCellClick;
    (dom.window as any).passCurrentTurn = passCurrentTurn;
    (dom.window as any).gameState = { currentPlayer: 1 };
    (dom.window as any).cardState = { pendingEffectByPlayer: { black: null, white: null } };

    const { setupGameKeyboardShortcuts } = require('../ui/game-keyboard-shortcuts.js');
    setupGameKeyboardShortcuts({ getWindowRef: () => dom.window });

    dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'p', bubbles: true }));

    expect(handleCellClick).not.toHaveBeenCalled();
    expect(passCurrentTurn).not.toHaveBeenCalled();
    dom.window.close();
  });
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```powershell
npx jest test/ui.init-events.spectator-readonly.test.ts test/ui.game-keyboard-shortcuts.spectator.test.ts --runInBand
```

Expected: FAIL because actions are still invoked.

- [ ] **Step 4: Add shared local guards in UI entrypoints**

In `ui/bootstrap/init-events.ts`, add:

```ts
function isNetworkSpectatorSession(root: any): boolean {
  try {
    const client = root && root.NetworkMatchClient;
    return !!(client && typeof client.isSpectator === 'function' && client.isSpectator() === true);
  } catch (e) {
    return false;
  }
}

function emitSpectatorReadOnlyStatus(root: any): void {
  try {
    const client = root && root.NetworkMatchClient;
    const state = client && typeof client.getState === 'function' ? client.getState() : null;
    if (state && typeof state.statusWriter === 'function') {
      state.statusWriter('観戦中は操作できません', true);
    }
  } catch (e) { /* ignore */ }
}

function guardSpectatorAction(root: any, action: () => any): () => any {
  return () => {
    if (isNetworkSpectatorSession(root)) {
      emitSpectatorReadOnlyStatus(root);
      return undefined;
    }
    return action();
  };
}
```

Wrap the three existing listeners:

```ts
refs.destroyBtn.addEventListener('click', guardSpectatorAction(root, () => destroySelectedHandCard()));
refs.useBtn.addEventListener('click', guardSpectatorAction(root, () => useSelectedCard()));
refs.passBtn.addEventListener('click', guardSpectatorAction(root, () => passCurrentTurn()));
```

Apply the same wrapper to `reversiPassButtons`.

In `ui/game-keyboard-shortcuts.ts`, add an equivalent local `isNetworkSpectatorSession(win)` helper and return before calling `handleCellClick` or `passCurrentTurn`.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npx jest test/ui.init-events.spectator-readonly.test.ts test/ui.game-keyboard-shortcuts.spectator.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add ui/bootstrap/init-events.ts ui/game-keyboard-shortcuts.ts test/ui.init-events.spectator-readonly.test.ts test/ui.game-keyboard-shortcuts.spectator.test.ts
git commit -m "観戦者のUI入力を読み取り専用にする"
```

---

### Task 3: Fix Spectator Turn And Timer Labels

**Files:**
- Modify: `ui/status-display.ts`
- Modify: `ui/handlers/match-mode.ts`
- Test: `test/ui.status-display.network-seat.test.ts`
- Test: `test/ui.match-mode.network-button.test.ts`

- [ ] **Step 1: Add status-display failing test**

In `test/ui.status-display.network-seat.test.ts`, add:

```ts
test('spectator battle status does not label the current turn as yours', () => {
  const dom = new JSDOM(
    '<!doctype html><html><body>' +
    '<div id="effect-live-panel" data-battle-status-panel="1">' +
    '<div class="battle-status-round"></div>' +
    '<div class="battle-status-score"></div>' +
    '<div class="battle-status-turn"></div>' +
    '<span class="battle-status-latest-value"></span>' +
    '</div>' +
    '</body></html>',
    { runScripts: 'outside-only', url: 'http://localhost/' }
  );
  const { window } = dom;
  window.OwnerHelpers = require('../utils/owner-helpers');
  window.MatchMode = { isNetworkModeActive: () => true };
  window.NetworkMatchClient = {
    isSpectator: () => true,
    getSeatKey: () => 'black'
  };
  window.gameState = {
    currentPlayer: 1,
    turnNumber: 0,
    board: Array.from({ length: 8 }, () => Array(8).fill(0))
  };

  global.window = window;
  global.document = window.document;
  global.gameState = window.gameState;

  loadStatusDisplayIntoWindow(window);
  window.updateStatus();

  expect(window.document.querySelector('.battle-status-turn')!.textContent).toBe('観戦中');

  delete global.window;
  delete global.document;
  delete global.gameState;
  dom.window.close();
});
```

- [ ] **Step 2: Add timer label failing test**

In `test/ui.match-mode.network-button.test.ts`, add a test that calls `setupMatchModeControls`, switches to network mode, feeds a timer event through the registered `NetworkMatchClient.setTurnTimerListener`, and asserts the label:

```ts
test('観戦中の手番タイマーはあなた表示を出さない', async () => {
  const turnTimerListenerRef: any = { current: null };
  (global as any).NetworkMatchClient = {
    isSpectator: () => true,
    isActive: () => true,
    setTurnTimerListener: (fn: any) => { turnTimerListenerRef.current = fn; },
    setRoomStateListener: jest.fn(),
    setStatusWriter: jest.fn(),
    hasTwoPlayers: () => true,
    listRooms: jest.fn(async () => ({ ok: true, rooms: [] }))
  };

  const MatchMode = require('../ui/handlers/match-mode.js');
  MatchMode.setupMatchModeControls(buildNetworkControlRefs());
  await MatchMode.setMode('network', { silentLog: true });

  turnTimerListenerRef.current({
    active: true,
    turnSeatKey: 'black',
    isOwnTurn: true,
    remainingMs: 76000,
    limitSeconds: 120
  });

  expect(document.getElementById('networkTimerStatus')!.textContent).toBe('手番タイマー: 黒 残り 76 秒');
});
```

Use the local helper that already builds refs in this test file. If no helper exists for `networkTimerStatus`, extend the fixture HTML with `<div id="networkTimerStatus"></div>`.

- [ ] **Step 3: Run tests and verify they fail**

Run:

```powershell
npx jest test/ui.status-display.network-seat.test.ts test/ui.match-mode.network-button.test.ts --runInBand
```

Expected: FAIL because labels include `あなた`.

- [ ] **Step 4: Implement spectator label logic**

In `ui/status-display.ts`, add:

```ts
function isNetworkSpectatorForStatusDisplay(): boolean {
    try {
        const client = typeof window !== 'undefined' ? (window as any).NetworkMatchClient : null;
        return !!(client && typeof client.isSpectator === 'function' && client.isSpectator() === true);
    } catch (e) { /* ignore */ }
    return false;
}
```

Then update:

```ts
function resolveBattleStatusTurnLabel(): string {
    if (isNetworkModeForLabels() && isNetworkSpectatorForStatusDisplay()) return '観戦中';
    const state = getGameStateForStatusDisplay();
    const currentPlayer = normalizePlayerKeyForStatusDisplay(state && state.currentPlayer);
    const localPlayer = getLocalPlayerKeyForBattleStatus();
    return currentPlayer === localPlayer ? 'あなたのターン' : '相手のターン';
}
```

At the start of `resolveTurnArrivalToastState()`, add:

```ts
    if (isNetworkModeForLabels() && isNetworkSpectatorForStatusDisplay()) return null;
```

In `ui/handlers/match-mode.ts`, add:

```ts
    function isNetworkSpectatorActiveForTimerLabel() {
        return currentMode === MODE_NETWORK && isNetworkSpectatorActive();
    }
```

Update `formatNetworkTimerLabel()`:

```ts
        const ownTurnLabel = (!isNetworkSpectatorActiveForTimerLabel() && timer.isOwnTurn === true) ? '（あなた）' : '';
```

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npx jest test/ui.status-display.network-seat.test.ts test/ui.match-mode.network-button.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add ui/status-display.ts ui/handlers/match-mode.ts test/ui.status-display.network-seat.test.ts test/ui.match-mode.network-button.test.ts
git commit -m "観戦者向けの手番表示を修正"
```

---

### Task 4: Persist And Restore Spectator Sessions Across Page Reload

**Files:**
- Modify: `ui/network/session-seat.ts`
- Modify: `ui/network/session-lifecycle.ts`
- Modify: `ui/network-client.ts`
- Modify: `ui/handlers/match-mode.ts`
- Test: `test/ui.network-client.spectator.test.ts`
- Test: `test/ui.network-session-lifecycle.test.ts`
- Test: `test/ui.match-mode.network-button.test.ts`

- [ ] **Step 1: Add persistence failing test for spectator credentials**

In `test/ui.network-client.spectator.test.ts`, extend `spectateRoom opens read-only spectator session`:

```ts
const stored = JSON.parse(localStorage.getItem('network_match_last_session') || '{}');
expect(stored).toEqual(expect.objectContaining({
  viewerRole: 'spectator',
  roomId: 'SPC',
  spectatorId: 'spec_12345678',
  spectatorToken: 'spectator-token',
  spectatorName: '観戦'
}));
```

- [ ] **Step 2: Add restore failing test**

In `test/ui.network-client.spectator.test.ts`, add:

```ts
test('restoreStoredSession reopens spectator stream and syncs authoritative state', async () => {
  localStorage.setItem('network_match_last_session', JSON.stringify({
    viewerRole: 'spectator',
    roomId: 'SPC',
    spectatorId: 'spec_12345678',
    spectatorToken: 'spectator-token',
    spectatorName: '観戦',
    serverUrl: 'http://localhost:8787'
  }));
  global.fetch = jest.fn(async (url) => {
    const parsedUrl = new URL(String(url));
    if (parsedUrl.pathname === '/api/match/state') {
      return jsonResponse(200, {
        ok: true,
        roomId: 'SPC',
        viewerRole: 'spectator',
        spectatorId: 'spec_12345678',
        spectatorName: '観戦',
        stateVersion: 9,
        snapshot: createSnapshot(9)
      });
    }
    return jsonResponse(500, { ok: false, reason: 'UNEXPECTED_REQUEST' });
  });

  require('../ui/network-client.js');
  const client = window.NetworkMatchClient;
  client.setStatusWriter(statusWriter);

  const result = await client.restoreStoredSession();

  expect(result).toEqual(expect.objectContaining({
    ok: true,
    viewerRole: 'spectator',
    roomId: 'SPC'
  }));
  expect(client.isActive()).toBe(true);
  expect(client.isSpectator()).toBe(true);
  expect(eventSources[0].url).toBe(
    'http://localhost:8787/api/match/stream?roomId=SPC&viewerRole=spectator&spectatorId=spec_12345678&spectatorToken=spectator-token'
  );
  expect(statusWriter).toHaveBeenCalledWith('ネット対戦: ルーム「SPC」を観戦中へ復帰', false);
});
```

- [ ] **Step 3: Add lifecycle controller failing test**

In `test/ui.network-session-lifecycle.test.ts`, add:

```ts
test('restoreStoredSession activates spectator credentials and opens stream', async () => {
  mockConfig.readStoredSession = jest.fn(() => ({
    viewerRole: 'spectator',
    roomId: 'SPC',
    spectatorId: 'spec_12345678',
    spectatorToken: 'spectator-token',
    spectatorName: '観戦'
  }));
  mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
    ok: true,
    roomId: 'SPC',
    viewerRole: 'spectator',
    spectatorId: 'spec_12345678',
    spectatorName: '観戦',
    stateVersion: 10,
    snapshot: { stateVersion: 10, _meta: { viewerRole: 'spectator' } }
  }));

  const result = await controller.restoreStoredSession();

  expect(result).toEqual(expect.objectContaining({
    ok: true,
    viewerRole: 'spectator',
    roomId: 'SPC'
  }));
  expect(stateObj.viewerRole).toBe('spectator');
  expect(stateObj.spectatorId).toBe('spec_12345678');
  expect(mockConfig.requestJson).toHaveBeenCalledWith(
    'GET',
    '/api/match/state?roomId=SPC&viewerRole=spectator&spectatorId=spec_12345678&spectatorToken=spectator-token'
  );
  expect(mockConfig.openStream).toHaveBeenCalled();
});
```

- [ ] **Step 4: Run tests and verify they fail**

Run:

```powershell
npx jest test/ui.network-client.spectator.test.ts test/ui.network-session-lifecycle.test.ts --runInBand
```

Expected: FAIL because no stored spectator session or restore API exists.

- [ ] **Step 5: Implement persistent viewer session helpers**

In `ui/network/session-seat.ts`, add:

```ts
  const LAST_SESSION_STORAGE_KEY = 'network_match_last_session';

  function normalizeStoredViewerRole(value: any): 'seat' | 'spectator' {
    return String(value || '').trim().toLowerCase() === 'spectator' ? 'spectator' : 'seat';
  }

  function writeStoredSession(session: any): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const viewerRole = normalizeStoredViewerRole(session && session.viewerRole);
      const roomId = normalizeRoomId(session && session.roomId);
      if (!roomId) return;
      const record: any = {
        roomId,
        viewerRole,
        serverUrl: String(session && session.serverUrl || '').trim(),
        savedAt: Date.now()
      };
      if (viewerRole === 'spectator') {
        record.spectatorId = String(session && session.spectatorId || '').trim();
        record.spectatorToken = String(session && session.spectatorToken || '').trim();
        record.spectatorName = normalizePlayerName(session && session.spectatorName);
        if (!record.spectatorId || !record.spectatorToken) return;
      } else {
        record.seatKey = normalizePlayerKey(session && session.seatKey);
        record.seatToken = String(session && session.seatToken || '').trim();
        if (!record.seatToken) return;
      }
      localStorage.setItem(LAST_SESSION_STORAGE_KEY, JSON.stringify(record));
    } catch (e) { /* ignore */ }
  }

  function readStoredSession(): any {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(LAST_SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      const viewerRole = normalizeStoredViewerRole(parsed.viewerRole);
      const roomId = normalizeRoomId(parsed.roomId);
      if (!roomId) return null;
      if (viewerRole === 'spectator') {
        const spectatorId = String(parsed.spectatorId || '').trim();
        const spectatorToken = String(parsed.spectatorToken || '').trim();
        if (!spectatorId || !spectatorToken) return null;
        return {
          viewerRole,
          roomId,
          spectatorId,
          spectatorToken,
          spectatorName: normalizePlayerName(parsed.spectatorName),
          serverUrl: String(parsed.serverUrl || '').trim()
        };
      }
      const seatToken = String(parsed.seatToken || '').trim();
      if (!seatToken) return null;
      return {
        viewerRole,
        roomId,
        seatKey: normalizePlayerKey(parsed.seatKey),
        seatToken,
        serverUrl: String(parsed.serverUrl || '').trim()
      };
    } catch (e) { /* ignore */ }
    return null;
  }

  function clearStoredSession(roomId?: any): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const current = readStoredSession();
      if (roomId && current && current.roomId !== normalizeRoomId(roomId)) return;
      localStorage.removeItem(LAST_SESSION_STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }
```

Call `writeStoredSession()` at the end of `activateSessionFromResponse()` and `activateSpectatorSessionFromResponse()`:

```ts
    writeStoredSession({
      viewerRole: state.viewerRole,
      roomId: state.roomId,
      seatKey: state.seatKey,
      seatToken: state.seatToken,
      spectatorId: state.spectatorId,
      spectatorToken: state.spectatorToken,
      spectatorName: state.spectatorName,
      serverUrl: state.serverUrl
    });
```

Return the new helpers from the controller factory.

- [ ] **Step 6: Implement restoreStoredSession in lifecycle**

In `ui/network/session-lifecycle.ts`, add:

```ts
  async function restoreStoredSession(): Promise<any> {
    const stored = typeof cfg.readStoredSession === 'function' ? cfg.readStoredSession() : null;
    if (!stored || !stored.roomId) return { ok: false, reason: 'NO_STORED_SESSION' };
    if (stored.serverUrl && typeof cfg.setServerUrl === 'function') {
      cfg.setServerUrl(stored.serverUrl);
    }

    const state = readState();
    state.active = true;
    state.roomId = stored.roomId;
    state.viewerRole = stored.viewerRole === 'spectator' ? 'spectator' : 'seat';
    state.seatKey = stored.seatKey === 'white' ? 'white' : 'black';
    state.seatToken = state.viewerRole === 'seat' ? String(stored.seatToken || '') : '';
    state.spectatorId = state.viewerRole === 'spectator' ? String(stored.spectatorId || '') : '';
    state.spectatorToken = state.viewerRole === 'spectator' ? String(stored.spectatorToken || '') : '';
    state.spectatorName = state.viewerRole === 'spectator' ? cfg.normalizePlayerName(stored.spectatorName || '') : '';

    const synced = await syncLatestState();
    if (!synced || synced.ok !== true) {
      if (typeof cfg.clearStoredSession === 'function') cfg.clearStoredSession(stored.roomId);
      if (typeof cfg.resetSessionState === 'function') cfg.resetSessionState({ emit: true });
      return { ok: false, reason: synced && synced.reason ? synced.reason : 'RESTORE_STATE_FAILED' };
    }

    if (typeof cfg.resetNetworkTelemetry === 'function') cfg.resetNetworkTelemetry();
    openStream({ reconnect: true });

    const restoredState = readState();
    const roomName = String((synced && synced.roomName) || restoredState.roomId || 'ルーム');
    if (typeof cfg.emitStatus === 'function') {
      cfg.emitStatus(
        restoredState.viewerRole === 'spectator'
          ? 'ネット対戦: ルーム「' + roomName + '」を観戦中へ復帰'
          : 'ネット対戦: ルーム「' + roomName + '」へ再接続',
        false
      );
    }
    return {
      ok: true,
      roomId: restoredState.roomId,
      viewerRole: restoredState.viewerRole,
      seatKey: restoredState.seatKey,
      spectatorId: restoredState.spectatorId,
      spectatorName: restoredState.spectatorName
    };
  }
```

Export it from the returned lifecycle controller object.

- [ ] **Step 7: Wire through NetworkMatchClient**

In `ui/network-client.ts`, pass `readStoredSession`, `writeStoredSession`, and `clearStoredSession` from the session-seat controller into the lifecycle config.

Add:

```ts
    function restoreStoredSession() {
        return invokeControllerMethod(
            getNetworkSessionLifecycleController,
            'restoreStoredSession',
            arguments,
            () => Promise.resolve({ ok: false, reason: 'SESSION_LIFECYCLE_UNAVAILABLE' })
        );
    }
```

Add `restoreStoredSession` to `api`.

- [ ] **Step 8: Restore from match-mode boot**

In `ui/handlers/match-mode.ts`, add:

```ts
    async function restoreNetworkSessionIfAvailableOnBoot() {
        try {
            const client = root.NetworkMatchClient;
            if (!client || typeof client.restoreStoredSession !== 'function') return;
            const result = await client.restoreStoredSession();
            if (!result || result.ok !== true) return;
            await setMode(MODE_NETWORK, { silentLog: true, skipReset: true });
            setNetworkOverlayVisible(false);
            writeNetworkStatus(result.viewerRole === 'spectator' ? '観戦中' : 'ネット対戦へ再接続', false);
            refreshNetworkChatVisibility();
            renderNetworkDeckInfo();
            refreshBoardUi();
        } catch (e) { /* ignore restore failure; keep normal CPU boot */ }
    }
```

Extend `setMode()` options to respect `skipReset === true`:

```ts
        if (opts.skipReset !== true) {
            resetGameForReversiModeSwitch(prevMode, currentMode);
        }
```

At the end of `setupMatchModeControls()`, after `setMode(MODE_CPU, { force: true, silentLog: true });`, schedule restore:

```ts
        setTimeout(() => {
            restoreNetworkSessionIfAvailableOnBoot();
        }, 0);
```

- [ ] **Step 9: Run focused tests**

Run:

```powershell
npx jest test/ui.network-client.spectator.test.ts test/ui.network-session-lifecycle.test.ts test/ui.match-mode.network-button.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 10: Commit**

```powershell
git add ui/network/session-seat.ts ui/network/session-lifecycle.ts ui/network-client.ts ui/handlers/match-mode.ts test/ui.network-client.spectator.test.ts test/ui.network-session-lifecycle.test.ts test/ui.match-mode.network-button.test.ts
git commit -m "観戦セッションをリロード復元する"
```

---

### Task 5: End-To-End Verification, Mirror Sync, Deploy, And Live Check

**Files:**
- Generated by command: `public/module-registry.js`
- Generated by command: `worker-public/**`

- [ ] **Step 1: Run focused spectator tests**

Run:

```powershell
npx jest test/turn-manager.retry.test.ts test/ui.bootstrap.cpu-early-registration.test.ts test/ui.init-events.spectator-readonly.test.ts test/ui.game-keyboard-shortcuts.spectator.test.ts test/ui.status-display.network-seat.test.ts test/ui.match-mode.network-button.test.ts test/ui.network-client.spectator.test.ts test/ui.network-session-lifecycle.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run network parity suite**

Run:

```powershell
npm run test:network:parity
```

Expected: PASS.

- [ ] **Step 3: Run typecheck and build**

Run:

```powershell
npm run typecheck
npm run build:ts
```

Expected: both commands exit `0`.

- [ ] **Step 4: Prepare Worker assets**

Run:

```powershell
npm run worker:prepare
```

Expected:

```text
[worker-prepare] mirror-verified files=...
```

- [ ] **Step 5: Commit generated deployment assets**

Inspect generated diffs:

```powershell
git status --short
git diff -- public/module-registry.js worker-public
```

Commit only the generated files produced by `worker:prepare` for this fix:

```powershell
git add public/module-registry.js worker-public
git commit -m "観戦修正のWorker配信資産を同期"
```

- [ ] **Step 6: Wrangler dry-run and deploy**

Run:

```powershell
npx wrangler deploy --dry-run
npx wrangler deploy
```

Expected:

```text
Uploaded card
Deployed card triggers
https://card.reversi-0.workers.dev
```

- [ ] **Step 7: Live browser verification**

Use the `card-reversi-browser-live-network-check` skill.

Required live checks:

1. Chrome creates a public network room.
2. Microsoft Edge joins as white.
3. Separate Chrome profile joins as spectator.
4. Spectator room list/status shows `観戦中`.
5. Spectator click on a legal board cell does not change local board, does not call publish, and shows `観戦中は操作できません`.
6. Spectator card use, destroy, pass, and keyboard shortcuts do not mutate local state.
7. Chrome black move syncs to Edge and spectator.
8. Edge white move syncs to Chrome and spectator.
9. Edge reload restores as white seat with the same server board.
10. Spectator reload restores as spectator with the same server board and `NetworkMatchClient.isSpectator() === true`.
11. Spectator labels show `観戦中` and timer text does not contain `（あなた）`.

Save screenshots and JSON summaries under a new `tmp-live-spectator-check-<timestamp>/` folder.

- [ ] **Step 8: Final commit for any live-check-only correction**

If live verification reveals a small missed UI edge and the fix is applied, repeat Steps 1-7 and commit:

```powershell
git add <only-files-touched-for-the-live-fix>
git commit -m "観戦実機検証の残課題を修正"
```

If live verification passes without extra changes, do not create an empty commit.

---

## Self-Review

**Spec coverage**

- 最大4人観戦: already covered by existing Worker/local-server tests; this plan keeps it intact and validates room list status in live check.
- 観戦者は操作できない: Task 1 blocks board and pending target selection; Task 2 blocks card, destruction, pass, and keyboard entrypoints; existing `NetworkMatchClient` guards continue to reject publish/chat/hand skin.
- 観戦者は非公開情報を見ない: existing projection tests remain in `test:network:parity`; Task 5 runs that suite.
- パスワード付き観戦: existing list/spectate path remains unchanged; Task 4 persists credentials after successful password-authenticated spectate.
- リロード復帰: Task 4 adds persisted viewer credentials and boot restore for both seat and spectator.
- 表示の誤誘導: Task 3 removes `あなた` labels for spectators.

**Placeholder scan**

- No task contains unresolved placeholder markers.
- No step asks the implementer to invent unspecified handling.
- Every code-changing task includes file paths, snippets, commands, and expected results.

**Type consistency**

- `viewerRole` uses only `'seat' | 'spectator'`.
- Stored spectator credentials consistently use `spectatorId`, `spectatorToken`, and `spectatorName`.
- Public API uses `NetworkMatchClient.restoreStoredSession()`.
- Runtime bridge uses `isNetworkSpectator`.

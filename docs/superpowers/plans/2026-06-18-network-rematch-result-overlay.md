# Network Rematch Result Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix network rematch so pressing the result dialog's `再戦` button closes the dialog, resets the visible board to the server-confirmed initial state, and lets the player start another match.

**Architecture:** The server and client already reset canonical state correctly through `reset_game`; the bug is presentation-only. Keep the network snapshot authority path unchanged, and adjust only the stream snapshot presentation option so self-authored rematch snapshots still run result overlay synchronization.

**Tech Stack:** TypeScript, CommonJS browser modules, Jest/ts-jest, Playwright for browser smoke verification.

---

### Task 1: Add Regression Coverage For Self Rematch Stream Snapshot

**Files:**
- Modify: `test/ui.network-stream-snapshot.test.ts`

- [ ] **Step 1: Add the failing unit test**

Append this test inside the existing `describe('NetworkStreamSnapshotController', () => { ... })` block in `test/ui.network-stream-snapshot.test.ts`:

```ts
  test('self reset_game stream snapshot does not skip result overlay sync', () => {
    calls.shouldApplyStreamSnapshotAsShadowPlayback.mockReturnValue(false);

    controller.handleStreamSnapshotPayload({
      ok: true,
      operationId: 'op_rematch',
      actionType: 'reset_game',
      snapshot: {
        stateVersion: 22,
        gameState: {
          currentPlayer: 1,
          turnNumber: 0,
          consecutivePasses: 0
        }
      },
      playbackEvents: []
    });

    expect(calls.applySnapshotThroughCoordinator).toHaveBeenCalledWith(
      expect.objectContaining({ stateVersion: 22 }),
      expect.objectContaining({
        source: 'stream',
        applyOptions: expect.objectContaining({
          force: false,
          skipResultOverlay: false
        })
      })
    );
  });
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\ui.network-stream-snapshot.test.ts
```

Expected before the fix: the new test fails because `skipResultOverlay` is currently `true` for self non-terminal stream snapshots.

---

### Task 2: Allow Result Overlay Sync For Rematch Stream Snapshots

**Files:**
- Modify: `ui/network/stream-snapshot.ts`

- [ ] **Step 1: Add a local action classifier**

In `ui/network/stream-snapshot.ts`, add this helper inside `createNetworkStreamSnapshotController`, near the top after `readState()`:

```ts
  function isRematchResetActionType(value: any): boolean {
    const actionType = String(value || '').trim().toLowerCase();
    return actionType === 'reset_game' || actionType === 'rematch' || actionType === 'restart';
  }
```

- [ ] **Step 2: Compute the overlay skip flag once**

In `handleStreamSnapshotPayload`, after `const isTerminalResultSnapshot = ...`, add:

```ts
    const actionType = payload && payload.actionType ? String(payload.actionType) : '';
    const isRematchResetAction = isRematchResetActionType(actionType);
    const shouldSkipResultOverlay = isSelfOperation && !isTerminalResultSnapshot && !isRematchResetAction;
```

There is already an `actionType` concept in payloads from the Worker/local server, so this keeps the logic at the network boundary and does not add UI authority to game logic.

- [ ] **Step 3: Use the new flag for normal and force-recovery apply paths**

Replace both existing `skipResultOverlay` expressions in `ui/network/stream-snapshot.ts`.

Current code:

```ts
          skipResultOverlay: isSelfOperation && !isTerminalResultSnapshot
```

Replace with:

```ts
          skipResultOverlay: shouldSkipResultOverlay
```

Do this in both places:
- the `applySnapshotThroughCoordinator(...)` call
- the `cfg.applySnapshot(...)` force recovery call

- [ ] **Step 4: Run the focused test and confirm it passes**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\ui.network-stream-snapshot.test.ts
```

Expected after the fix: the full `NetworkStreamSnapshotController` test file passes.

---

### Task 3: Add Client Regression Coverage

**Files:**
- Modify: `test/ui.network-client.reconnect-sync.test.ts`

- [ ] **Step 1: Add a test that models the reported symptom at client level**

Add a test near the existing `requestRematch` and result overlay tests. Use the existing helpers and `MockEventSource`/`eventSources` setup already defined by this file's `beforeEach`.

```ts
  test('requestRematch の self stream snapshot は非終局なら result overlay を閉じる', async () => {
    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          seatToken: 'token_white',
          seats: { black: true, white: true },
          stateVersion: 1,
          snapshot: createSnapshot(1, { currentPlayer: -1, turnNumber: 60, consecutivePasses: 2 })
        });
      }

      if (path === '/api/match/publish') {
        const body = JSON.parse(String(init.body || '{}'));
        publishBodies.push(body);
        const snapshot = createSnapshot(2, { currentPlayer: 1, turnNumber: 0, consecutivePasses: 0 });
        const stream = eventSources[0];
        const snapshotHandler = stream && stream.listeners ? stream.listeners.snapshot : null;
        if (typeof snapshotHandler === 'function') {
          snapshotHandler({
            data: JSON.stringify({
              ok: true,
              operationId: body.operationId,
              actionType: 'reset_game',
              stateVersion: 2,
              snapshot,
              playbackEvents: []
            })
          });
        }
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seats: { black: true, white: true },
          stateVersion: 2,
          snapshot,
          playbackEvents: []
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    document.body.innerHTML = '<button id="resetBtn">再戦</button><div id="result-overlay"><button>再戦中...</button></div>';

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);
    expect(eventSources).toHaveLength(1);
    expect(typeof eventSources[0].listeners.snapshot).toBe('function');

    document.body.innerHTML = '<button id="resetBtn">再戦</button><div id="result-overlay"><button>再戦中...</button></div>';

    const result = await client.requestRematch();
    expect(result && result.ok).toBe(true);

    expect(publishBodies).toHaveLength(1);
    expect(publishBodies[0].actionType).toBe('reset_game');
    expect(document.getElementById('result-overlay')).toBeNull();
    expect(document.getElementById('resetBtn')?.textContent).toBe('リセット');
    expect(global.gameState.currentPlayer).toBe(1);
    expect(global.gameState.consecutivePasses).toBe(0);
  });
```

- [ ] **Step 2: Run the client regression test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\ui.network-client.reconnect-sync.test.ts
```

Expected: the new test passes after Task 2. It should fail on the old implementation with `#result-overlay` still present or `resetBtn` still showing `再戦`.

---

### Task 4: Browser Smoke Verification Of The Reported Flow

**Files:**
- No source file changes.

- [ ] **Step 1: Build browser/runtime output**

Run:

```powershell
npm run build:ts
```

Expected: exit code 0.

- [ ] **Step 2: Run the existing focused network tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\ui.network-stream-snapshot.test.ts test\ui.result-overlay.network-seat.test.ts test\ui.network-client.reconnect-sync.test.ts test\workers.match-rematch-publish.test.ts
```

Expected: all suites pass.

- [ ] **Step 3: Manually reproduce the previous failure with Playwright**

Run this one-off smoke from the repository root:

```powershell
@'
const { chromium } = require('playwright');
const { startStaticServer, startLocalMatchServer, stopStaticServer, stopPlaywrightBrowser } = require('./test/e2e/e2e-runtime-helpers.js');

function waitListen(server) {
  return new Promise((resolve) => {
    if (server.address()) return resolve(server.address().port);
    server.on('listening', () => resolve(server.address().port));
  });
}

(async () => {
  const staticServer = startStaticServer(0);
  const matchServer = startLocalMatchServer(0);
  const staticPort = await waitListen(staticServer);
  const matchPort = await waitListen(matchServer);
  const browser = await chromium.launch();
  const black = await browser.newPage();
  const white = await browser.newPage();

  try {
    const appUrl = `http://127.0.0.1:${staticPort}/`;
    const matchUrl = `http://127.0.0.1:${matchPort}`;

    for (const page of [black, white]) {
      await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForSelector('#board .cell', { timeout: 15000 });
      await page.waitForFunction(() => window.NetworkMatchClient && window.ResultOverlayModule, { timeout: 15000 });
      await page.evaluate((url) => {
        window.MATCH_MODE = 'network';
        window.__MATCH_MODE = 'network';
        window.getCurrentMatchMode = () => 'network';
        window.NetworkMatchClient.setServerUrl(url);
      }, matchUrl);
    }

    const created = await black.evaluate((url) => {
      return window.NetworkMatchClient.createRoom({ serverUrl: url, playerName: 'くろ' });
    }, matchUrl);
    if (!created || created.ok !== true) throw new Error(`createRoom failed: ${JSON.stringify(created)}`);

    const joined = await white.evaluate(({ url, roomId }) => {
      return window.NetworkMatchClient.joinRoom(roomId, { serverUrl: url, playerName: 'しろ' });
    }, { url: matchUrl, roomId: created.roomId });
    if (!joined || joined.ok !== true) throw new Error(`joinRoom failed: ${JSON.stringify(joined)}`);

    await black.waitForFunction(() => window.NetworkMatchClient.getStateVersion() >= 1, { timeout: 10000 });

    await black.evaluate(() => {
      window.__rematchProbe = { requestCalls: 0, resetCalls: 0, requestResults: [] };
      const originalRequest = window.NetworkMatchClient.requestRematch.bind(window.NetworkMatchClient);
      window.NetworkMatchClient.requestRematch = async function () {
        window.__rematchProbe.requestCalls += 1;
        const result = await originalRequest();
        window.__rematchProbe.requestResults.push(result);
        return result;
      };
      const originalReset = window.resetGame;
      window.resetGame = function () {
        window.__rematchProbe.resetCalls += 1;
        return originalReset.apply(this, arguments);
      };
      window.getCurrentMatchMode = () => 'network';
      window.gameState.currentPlayer = -1;
      window.gameState.consecutivePasses = 2;
      window.gameState.__resultShown = false;
      window.ResultOverlayModule.showResultOverlay();
    });

    await black.click('#result-overlay .result-btn-row .premium-btn.primary');
    await black.waitForFunction(() => !document.getElementById('result-overlay'), { timeout: 10000 });

    const finalState = await black.evaluate(() => ({
      requestCalls: window.__rematchProbe.requestCalls,
      resetCalls: window.__rematchProbe.resetCalls,
      requestResultOk: !!(window.__rematchProbe.requestResults[0] && window.__rematchProbe.requestResults[0].ok),
      overlayPresent: !!document.getElementById('result-overlay'),
      currentPlayer: window.gameState && window.gameState.currentPlayer,
      turnNumber: window.gameState && window.gameState.turnNumber,
      consecutivePasses: window.gameState && window.gameState.consecutivePasses,
      resetButtonText: document.getElementById('resetBtn') && document.getElementById('resetBtn').textContent
    }));

    console.log(JSON.stringify(finalState, null, 2));
    if (
      finalState.requestCalls !== 1 ||
      finalState.resetCalls !== 0 ||
      finalState.requestResultOk !== true ||
      finalState.overlayPresent !== false ||
      finalState.currentPlayer !== 1 ||
      finalState.turnNumber !== 0 ||
      finalState.consecutivePasses !== 0 ||
      finalState.resetButtonText !== 'リセット'
    ) {
      throw new Error(`network rematch result overlay smoke failed: ${JSON.stringify(finalState)}`);
    }
  } finally {
    await black.close().catch(() => {});
    await white.close().catch(() => {});
    await stopPlaywrightBrowser(browser, 10000);
    await stopStaticServer(staticServer);
    await stopStaticServer(matchServer);
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
'@ | node -
```

Expected: overlay is gone and the reset button returns to `リセット`. This is the direct regression check for the user-reported symptom.

---

### Task 5: Diff Review And Commit Decision

**Files:**
- Review only.

- [ ] **Step 1: Inspect the exact diff**

Run:

```powershell
git diff -- ui\network\stream-snapshot.ts test\ui.network-stream-snapshot.test.ts test\ui.network-client.reconnect-sync.test.ts
```

Expected:
- `ui/network/stream-snapshot.ts` only changes rematch/reset overlay skip behavior.
- Tests only cover self rematch stream/presentation behavior.
- No generated or mirror files are included.

- [ ] **Step 2: Check working tree**

Run:

```powershell
git status --short
```

Expected: the repository may still contain unrelated pre-existing dirty files. Stage only these task files if committing:

```powershell
git add ui\network\stream-snapshot.ts test\ui.network-stream-snapshot.test.ts test\ui.network-client.reconnect-sync.test.ts
git commit -m "Fix network rematch result overlay"
```

Do not stage unrelated dirty files or generated `worker-public/` output for this fix.

---

## Self-Review

Spec coverage:
- `01-rulebook.md` requires network rematch non-terminal snapshots to close the result overlay. Task 2 enables result presentation sync for self `reset_game` stream snapshots.
- The reported symptom says the dialog remains and the button stays `再戦中...`. Task 3 and Task 4 assert overlay removal and reset-button label restoration.
- The server reset path already has coverage in `test/workers.match-rematch-publish.test.ts`; this plan keeps that path unchanged.

Placeholder scan:
- No task relies on undefined test work or unspecified implementation.
- The client-level test uses the existing `eventSources` test harness instead of introducing a second EventSource mock.
- The Playwright smoke includes a complete one-off script rather than referring back to investigation notes.
- All commands and expected outcomes are explicit.

Type consistency:
- The new helper accepts `any`, matching existing controller style.
- `actionType` uses the same string values already accepted elsewhere: `reset_game`, `rematch`, `restart`.

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

### Task 3: Add End-To-End Client Regression Coverage

**Files:**
- Modify: `test/ui.network-client.reconnect-sync.test.ts`

- [ ] **Step 1: Add a test that models the reported symptom at client level**

Add a test near the existing `requestRematch` and result overlay tests. Use the existing helpers in that file (`jsonResponse`, `createSnapshot`, `publishBodies`, etc.) and shape it like this:

```ts
  test('requestRematch の self stream snapshot は非終局なら result overlay を閉じる', async () => {
    let streamListener: any = null;
    const originalEventSource = global.EventSource;
    global.EventSource = jest.fn(function MockEventSource(this: any) {
      this.addEventListener = jest.fn((type: string, listener: any) => {
        if (type === 'snapshot') streamListener = listener;
      });
      this.close = jest.fn();
    }) as any;

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
        if (streamListener) {
          streamListener({
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

    document.body.innerHTML = '<button id="resetBtn">再戦</button><div id="result-overlay"><button>再戦中...</button></div>';

    const result = await client.requestRematch();
    expect(result && result.ok).toBe(true);

    expect(publishBodies).toHaveLength(1);
    expect(publishBodies[0].actionType).toBe('reset_game');
    expect(document.getElementById('result-overlay')).toBeNull();
    expect(document.getElementById('resetBtn')?.textContent).toBe('リセット');
    expect(global.gameState.currentPlayer).toBe(1);
    expect(global.gameState.consecutivePasses).toBe(0);

    global.EventSource = originalEventSource;
  });
```

If the file already has an EventSource mock pattern, adapt the setup to that local pattern and keep the assertions unchanged.

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

Use the same browser-smoke shape from the investigation:
- start the static server from `test/e2e/e2e-runtime-helpers.js`
- start the local match server from `test/e2e/e2e-runtime-helpers.js`
- open two Chromium pages
- set `window.MATCH_MODE`, `window.__MATCH_MODE`, and `window.getCurrentMatchMode = () => 'network'`
- create a room on black, join on white
- on black, force a terminal-looking local state and show `ResultOverlayModule.showResultOverlay()`
- click `#result-overlay .result-btn-row .premium-btn.primary`

Final assertions:

```js
{
  requestCalls: 1,
  resetCalls: 0,
  requestResultOk: true,
  overlayPresent: false,
  currentPlayer: 1,
  turnNumber: 0,
  consecutivePasses: 0,
  resetButtonText: 'リセット'
}
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
- No task relies on undefined "appropriate tests" or unspecified implementation.
- All commands and expected outcomes are explicit.

Type consistency:
- The new helper accepts `any`, matching existing controller style.
- `actionType` uses the same string values already accepted elsewhere: `reset_game`, `rematch`, `restart`.

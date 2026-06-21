# Network Auto Room Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a darkened room-settings popup for network battle room creation, and allow network rooms created with auto-play permission to use the existing AUTO button for client-side Lv1 CPU control of the local seat.

**Architecture:** Room settings remain room metadata, created by the host and distributed through existing create/list/state/snapshot payloads. Network AUTO is client-owned: each browser that turns AUTO on only publishes actions for its own authenticated seat through `NetworkMatchClient.publishSnapshot`, so Worker authority and seat-token checks stay unchanged. The existing local AUTO loop is extended with a network delegate instead of reusing `processCpuTurn`, because CPU turn handling is intentionally guarded against network mode.

**Tech Stack:** TypeScript browser modules, Cloudflare Worker Durable Object room state, Jest, existing `npm run worker:prepare` mirror build.

---

## File Structure

- Modify `01-rulebook.md`: player-facing room setting and network AUTO behavior specification.
- Modify `index.html`: move room size/debug controls into `networkRoomSettingsPopup`, add `networkEnableAutoCheckbox`, add a settings backdrop element.
- Modify `styles-layout.css`, `styles-responsive.css`: popup/backdrop layout, mobile fit, hover/focus states.
- Modify `ui/bootstrap/init-dom.ts`, `ui/bootstrap/init-events.ts`, `ui/handlers/init.ts`: wire the new checkbox and backdrop ref into match-mode controls.
- Modify `shared/match-entry-payload.ts`: include `networkAutoEnabled` in create payload only when true.
- Modify `utils/match-authority-types.ts`, `utils/match-authority.ts`: carry `networkAutoEnabled` in public room payloads.
- Modify `workers/match-worker-types.ts`, `workers/match-worker.ts`: store and return `networkAutoEnabled` with room state.
- Modify `ui/network/session-seat.ts`, `ui/network/session-lifecycle.ts`, `ui/network-client.ts`: retain room auto metadata and expose `getNetworkAutoEnabled()`.
- Create `ui/network/auto-play.ts`: network-only AUTO delegate that chooses Lv1 legal moves for the local seat and publishes them.
- Modify `ui/handlers/auto.ts`: call the network AUTO delegate before the existing local black-turn auto path.
- Modify `ui/handlers/match-mode.ts`: do not force AUTO off in network rooms that allow it; update AUTO button enabled/disabled state from room metadata; submit the new room option.
- Modify focused tests:
  - `test/ui.match-mode.network-button.test.ts`
  - `test/ui.network-room-list-style.test.ts`
  - `test/ui.network-session-lifecycle.test.ts`
  - `test/ui.network-client.publish-base-version.test.ts`
  - `test/workers.match-room-deck.test.ts`
  - New `test/ui.network-auto-play.test.ts`
  - Existing `test/ui.auto.playback-state.test.ts`

---

## Task 1: Document User-Visible Behavior

**Files:**
- Modify: `01-rulebook.md`

- [ ] **Step 1: Add the network room setting requirements**

Insert these bullets near the existing network room settings bullets:

```markdown
- `ネット対戦` の部屋作成設定は歯車ボタンから開く小型ポップアップにまとめ、ポップアップ表示中はネット対戦パネル内の背面を暗くして設定が前面であることを示す
- `ネット対戦` の部屋作成設定では、盤面サイズ、デバッグモード有効化、オートプレイ許可を作成前だけ変更できる。作成後 / 参加後は部屋で確定した設定を使用する
- `ネット対戦` のオートプレイ許可が有効な room では、各参加者が自分の端末で `AUTO` を押した場合に限り、自席の手番を Lv1 CPU の判断で自動送信してよい。片方だけ `AUTO` を有効にした場合はその席だけ自動化し、両者が有効にした場合は両者のブラウザが交互に自席操作を送信する
- `ネット対戦` のオートプレイ許可が無効な room では、ネット対戦中の `AUTO` ボタンは操作不可とし、通常の人間操作だけを許可する
```

- [ ] **Step 2: Inspect the spec diff**

Run:

```powershell
git diff -- 01-rulebook.md
```

Expected: only network room setting / AUTO behavior text changes for this task.

- [ ] **Step 3: Commit the spec change if isolated**

Run:

```powershell
git add 01-rulebook.md
git commit -m "ネット対戦AUTO設定の仕様を追加"
```

Expected: commit succeeds if `01-rulebook.md` has no unrelated pending edits. If unrelated edits are already present in this file, do not commit and record the exact reason in the implementation report.

---

## Task 2: Add Room Auto Metadata To Shared Payloads

**Files:**
- Modify: `shared/match-entry-payload.ts`
- Modify: `utils/match-authority-types.ts`
- Modify: `utils/match-authority.ts`
- Test: `test/ui.network-session-lifecycle.test.ts`
- Test: `test/utils.match-authority.publish-response.test.ts`

- [ ] **Step 1: Write failing payload tests**

In `test/ui.network-session-lifecycle.test.ts`, add this test in `describe('createRoom - 基本機能', ...)`:

```ts
test('createRoom は networkAutoEnabled を true の時だけ送信する', async () => {
  mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
    ok: true,
    roomId: 'ABC',
    roomName: 'テスト部屋',
    seatKey: 'black',
    seatToken: 'token123',
    networkAutoEnabled: true
  }));

  await controller.createRoom({
    playerName: 'テスト',
    networkAutoEnabled: true
  });

  expect(mockConfig.requestJson).toHaveBeenCalledWith(
    'POST',
    '/api/match/create',
    expect.objectContaining({
      playerName: 'テスト',
      networkAutoEnabled: true
    })
  );

  mockConfig.requestJson.mockClear();
  mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
    ok: true,
    roomId: 'DEF',
    roomName: '通常部屋',
    seatKey: 'black',
    seatToken: 'token456',
    networkAutoEnabled: false
  }));

  await controller.createRoom({
    playerName: 'テスト',
    networkAutoEnabled: false
  });

  expect(mockConfig.requestJson.mock.calls[0][2]).not.toHaveProperty('networkAutoEnabled');
});
```

In `test/utils.match-authority.publish-response.test.ts`, add:

```ts
test('buildRoomPayload preserves network auto metadata', () => {
  const payload = MatchAuthority.buildRoomPayload({
    roomId: 'ABC',
    roomName: '自動部屋',
    seats: {},
    spectators: {},
    roomBoardConfig: { rows: 8, cols: 8 },
    networkDebugEnabled: false,
    networkAutoEnabled: true
  });

  expect(payload.networkAutoEnabled).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npx jest test/ui.network-session-lifecycle.test.ts test/utils.match-authority.publish-response.test.ts --runInBand
```

Expected: at least one assertion fails because `networkAutoEnabled` is not yet carried.

- [ ] **Step 3: Add the shared create option**

In `shared/match-entry-payload.ts`, extend `MatchEntryPayloadOptions`:

```ts
  networkAutoEnabled?: unknown;
```

Then add this directly after the existing `networkDebugEnabled` block in `buildCreateRoomPayload`:

```ts
  if (opts.networkAutoEnabled === true) {
    payload.networkAutoEnabled = true;
  }
```

- [ ] **Step 4: Add authority types**

In `utils/match-authority-types.ts`, add `networkAutoEnabled?: unknown;` beside create/build input types that already contain `networkDebugEnabled?: unknown;`, and add `networkAutoEnabled?: boolean;` beside public room payload types that already contain `networkDebugEnabled?: boolean;`.

Use this exact shape for room payload interfaces:

```ts
    networkDebugEnabled?: boolean;
    networkAutoEnabled?: boolean;
```

- [ ] **Step 5: Carry metadata in authority payload builders**

In `utils/match-authority.ts`, update payload construction blocks that currently set `networkDebugEnabled` from `opts.networkDebugEnabled`:

```ts
        networkDebugEnabled: opts.networkDebugEnabled === true,
        networkAutoEnabled: opts.networkAutoEnabled === true,
```

For optional public payload additions that currently check `Object.prototype.hasOwnProperty.call(opts, 'networkDebugEnabled')`, add:

```ts
    if (Object.prototype.hasOwnProperty.call(opts, 'networkAutoEnabled')) {
        payload.networkAutoEnabled = opts.networkAutoEnabled === true;
    }
```

- [ ] **Step 6: Run tests to verify pass**

Run:

```powershell
npx jest test/ui.network-session-lifecycle.test.ts test/utils.match-authority.publish-response.test.ts --runInBand
```

Expected: both suites pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add shared/match-entry-payload.ts utils/match-authority-types.ts utils/match-authority.ts test/ui.network-session-lifecycle.test.ts test/utils.match-authority.publish-response.test.ts
git commit -m "ネット対戦のAUTO許可メタデータを追加"
```

Expected: commit succeeds if these files contain only this task's changes. If unrelated edits already exist in any file, do not commit and report the exact files.

---

## Task 3: Store And Broadcast Network Auto Metadata In Worker

**Files:**
- Modify: `workers/match-worker-types.ts`
- Modify: `workers/match-worker.ts`
- Test: `test/workers.match-room-deck.test.ts`
- Test: `test/workers.match-stream-sse.test.ts`

- [ ] **Step 1: Write failing Worker tests**

In `test/workers.match-room-deck.test.ts`, add this assertion to the existing room metadata scenario that already checks `networkDebugEnabled`:

```ts
expect(result.createPayload.networkAutoEnabled).toBe(true);
expect(result.joinPayload.networkAutoEnabled).toBe(true);
expect(result.statePayload.networkAutoEnabled).toBe(true);
```

In the scenario setup body for the create request, include:

```js
networkAutoEnabled: true
```

In `test/workers.match-stream-sse.test.ts`, add an assertion next to the existing debug metadata chunk assertion:

```ts
expect(result.firstChunk).toContain('"networkAutoEnabled":true');
```

Ensure the create body for that test includes:

```js
networkAutoEnabled: true
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npx jest test/workers.match-room-deck.test.ts test/workers.match-stream-sse.test.ts --runInBand
```

Expected: tests fail because Worker payloads do not yet include `networkAutoEnabled`.

- [ ] **Step 3: Extend Worker room types**

In `workers/match-worker-types.ts`, add:

```ts
    networkAutoEnabled?: unknown;
```

to create options and room state interfaces beside `networkDebugEnabled`.

- [ ] **Step 4: Add Worker helpers and storage**

In `workers/match-worker.ts`, add helper:

```ts
function toPublicNetworkAutoEnabled(room: unknown): boolean {
    return !!(room && typeof room === 'object' && (room as Record<string, unknown>).networkAutoEnabled === true);
}
```

In `handleCreate`, read the option:

```ts
    const networkAutoEnabled = opts.networkAutoEnabled === true;
```

When sending the internal create request body, include:

```ts
                networkAutoEnabled,
```

In `createRoomState`, read and store:

```ts
        const networkAutoEnabled = opts.networkAutoEnabled === true;
```

and include in the room object:

```ts
            networkAutoEnabled,
```

In Durable Object create handling where `payload.networkDebugEnabled` is read, also read:

```ts
        const networkAutoEnabled = payload.networkAutoEnabled === true;
```

and pass it into `createRoomState`.

- [ ] **Step 5: Add Worker response payload metadata**

In each response payload builder that already includes:

```ts
networkDebugEnabled: toPublicNetworkDebugEnabled(room)
```

add:

```ts
networkAutoEnabled: toPublicNetworkAutoEnabled(room)
```

This includes create, join, state, list/room payloads, heartbeat/snapshot stream payloads, publish responses, chat responses, and timeout responses where room metadata is already returned.

- [ ] **Step 6: Run Worker tests**

Run:

```powershell
npx jest test/workers.match-room-deck.test.ts test/workers.match-stream-sse.test.ts --runInBand
```

Expected: both suites pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add workers/match-worker-types.ts workers/match-worker.ts test/workers.match-room-deck.test.ts test/workers.match-stream-sse.test.ts
git commit -m "Workerでネット対戦AUTO許可を配信"
```

Expected: commit succeeds if isolated.

---

## Task 4: Retain Network Auto Metadata In Browser Client

**Files:**
- Modify: `ui/network/session-seat.ts`
- Modify: `ui/network/session-lifecycle.ts`
- Modify: `ui/network-client.ts`
- Test: `test/ui.network-client.publish-base-version.test.ts`

- [ ] **Step 1: Write failing client metadata test**

In `test/ui.network-client.publish-base-version.test.ts`, add:

```ts
test('createRoom は networkAutoEnabled を送信し room metadata として保持する', async () => {
  require('../ui/network-client.js');
  const client = window.NetworkMatchClient;

  const createBodies: any[] = [];
  global.fetch = jest.fn(async (url: any, init: any) => {
    const path = new URL(String(url), 'http://localhost/').pathname;
    if (path === '/api/match/create') {
      const body = JSON.parse(String(init.body || '{}'));
      createBodies.push(body);
      return jsonResponse(200, {
        ok: true,
        roomId: 'ABC',
        roomName: '自動部屋',
        seatKey: 'black',
        seatToken: 'token_black',
        stateVersion: 0,
        snapshot: createSnapshot(0),
        networkAutoEnabled: true
      });
    }
    if (path === '/api/match/stream') {
      return streamResponse([]);
    }
    return jsonResponse(404, { ok: false });
  });

  const created = await client.createRoom({
    serverUrl: 'http://localhost:8787',
    playerName: 'くろ',
    networkAutoEnabled: true
  });

  expect(created.ok).toBe(true);
  expect(createBodies[0].networkAutoEnabled).toBe(true);
  expect(client.getNetworkAutoEnabled()).toBe(true);
  expect(client.getReadableState().networkAutoEnabled).toBe(true);
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
npx jest test/ui.network-client.publish-base-version.test.ts --runInBand
```

Expected: fails because client state/API does not expose `networkAutoEnabled`.

- [ ] **Step 3: Extend session state**

In `ui/network/session-seat.ts`, add `networkAutoEnabled` beside `networkDebugEnabled` in state normalization:

```ts
function normalizeNetworkAutoEnabled(value: any): boolean {
  return value === true;
}
```

When building readable active state, include:

```ts
        networkAutoEnabled: normalizeNetworkAutoEnabled(state.networkAutoEnabled),
```

When applying payload/session data that checks `networkDebugEnabled`, add:

```ts
    if (Object.prototype.hasOwnProperty.call(payload, 'networkAutoEnabled')) {
      state.networkAutoEnabled = normalizeNetworkAutoEnabled(payload.networkAutoEnabled);
    }
```

When resetting state, set:

```ts
    state.networkAutoEnabled = false;
```

- [ ] **Step 4: Return create result metadata**

In `ui/network/session-lifecycle.ts`, return metadata from `createRoom`, `joinRoom`, and `spectateRoom`:

```ts
            networkAutoEnabled: state.networkAutoEnabled === true
```

Place it beside existing `networkDebugEnabled`.

- [ ] **Step 5: Add public client getter**

In `ui/network-client.ts`, initialize state:

```ts
        networkAutoEnabled: false,
```

Add getter near `getNetworkDebugEnabled` / `getRoomBoardConfig`:

```ts
    function getNetworkAutoEnabled() {
        return state.networkAutoEnabled === true;
    }
```

Add to exported API:

```ts
        getNetworkAutoEnabled,
```

Also ensure `getReadableState()` includes:

```ts
            networkAutoEnabled: state.networkAutoEnabled === true,
```

- [ ] **Step 6: Run focused client tests**

Run:

```powershell
npx jest test/ui.network-client.publish-base-version.test.ts test/ui.network-session-lifecycle.test.ts --runInBand
```

Expected: both suites pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add ui/network/session-seat.ts ui/network/session-lifecycle.ts ui/network-client.ts test/ui.network-client.publish-base-version.test.ts
git commit -m "ブラウザでネット対戦AUTO許可を保持"
```

Expected: commit succeeds if isolated.

---

## Task 5: Build The Room Settings Popup UI

**Files:**
- Modify: `index.html`
- Modify: `styles-layout.css`
- Modify: `styles-responsive.css`
- Modify: `ui/bootstrap/init-dom.ts`
- Modify: `ui/bootstrap/init-events.ts`
- Modify: `ui/handlers/init.ts`
- Modify: `ui/handlers/match-mode.ts`
- Test: `test/ui.match-mode.network-button.test.ts`
- Test: `test/ui.network-room-list-style.test.ts`

- [ ] **Step 1: Write failing UI behavior test**

In `test/ui.match-mode.network-button.test.ts`, update the fixture HTML to include:

```html
<div id="networkRoomSettingsBackdrop" aria-hidden="true"></div>
<label id="networkAutoOptionRow" for="networkEnableAutoCheckbox">
  <input id="networkEnableAutoCheckbox" type="checkbox" />
  オートプレイを許可
</label>
```

Add refs in the test setup:

```ts
networkRoomSettingsBackdrop: document.getElementById('networkRoomSettingsBackdrop'),
networkEnableAutoCheckbox: document.getElementById('networkEnableAutoCheckbox'),
```

Add this test:

```ts
test('部屋設定ポップアップは背景を暗くし作成 payload にAUTO許可を含める', async () => {
  const settingsBtn = document.getElementById('networkRoomSettingsBtn') as HTMLButtonElement;
  const backdrop = document.getElementById('networkRoomSettingsBackdrop') as HTMLElement;
  const popup = document.getElementById('networkRoomSettingsPopup') as HTMLElement;
  const autoCheckbox = document.getElementById('networkEnableAutoCheckbox') as HTMLInputElement;
  const debugCheckbox = document.getElementById('networkEnableDebugCheckbox') as HTMLInputElement;
  const createBtn = document.getElementById('networkCreateBtn') as HTMLButtonElement;

  settingsBtn.click();

  expect(popup.classList.contains('is-open')).toBe(true);
  expect(backdrop.classList.contains('is-open')).toBe(true);
  expect(backdrop.getAttribute('aria-hidden')).toBe('false');

  autoCheckbox.checked = true;
  debugCheckbox.checked = true;
  createBtn.click();
  await Promise.resolve();
  await Promise.resolve();

  expect(createRoom).toHaveBeenCalledWith(expect.objectContaining({
    networkAutoEnabled: true,
    networkDebugEnabled: true
  }));
});
```

- [ ] **Step 2: Write failing style contract test**

In `test/ui.network-room-list-style.test.ts`, add:

```ts
test('部屋設定ポップアップは専用backdropと設定項目を持つ', () => {
  const html = readFileSync('index.html', 'utf8');
  const css = readFileSync('styles-layout.css', 'utf8');

  expect(html).toMatch(/id="networkRoomSettingsBackdrop"[\s\S]*aria-hidden="true"/);
  expect(html).toMatch(/id="networkEnableAutoCheckbox"/);
  expect(css).toMatch(/#networkRoomSettingsBackdrop[\s\S]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.[0-9]+\)/);
  expect(css).toMatch(/#networkRoomSettingsBackdrop\.is-open[\s\S]*opacity:\s*1/);
  expect(css).toMatch(/#networkRoomSettingsPopup[\s\S]*z-index:/);
});
```

- [ ] **Step 3: Run UI tests to verify failure**

Run:

```powershell
npx jest test/ui.match-mode.network-button.test.ts test/ui.network-room-list-style.test.ts --runInBand
```

Expected: fails because backdrop / auto checkbox refs do not exist.

- [ ] **Step 4: Update HTML structure**

In `index.html`, move `#networkBoardSizeRow` and `#networkDebugOptionRow` inside `#networkRoomSettingsPopup`, add the new checkbox, and add backdrop before the popup:

```html
<div id="networkActionRow" aria-label="ネット対戦操作">
    <button id="networkRoomSettingsBtn" class="btn-small" type="button" aria-label="部屋作成設定" aria-controls="networkRoomSettingsPopup" aria-expanded="false">⚙</button>
    <button id="networkCreateBtn" class="btn-small" type="button">部屋作成</button>
    <div id="networkRoomSettingsBackdrop" aria-hidden="true"></div>
    <div id="networkRoomSettingsPopup" role="dialog" aria-modal="true" aria-label="部屋作成設定" aria-hidden="true">
        <div id="networkRoomSettingsPopupHeader">
            <div id="networkRoomSettingsPopupTitle">部屋設定</div>
            <button id="networkRoomSettingsCloseBtn" class="btn-small" type="button" aria-label="部屋作成設定を閉じる">×</button>
        </div>
        <div id="networkBoardSizeRow">...</div>
        <label id="networkDebugOptionRow" for="networkEnableDebugCheckbox">
            <input id="networkEnableDebugCheckbox" type="checkbox" />
            デバッグモードを有効化
        </label>
        <label id="networkAutoOptionRow" for="networkEnableAutoCheckbox">
            <input id="networkEnableAutoCheckbox" type="checkbox" />
            オートプレイを許可
        </label>
    </div>
</div>
```

Keep the existing board size input IDs unchanged.

- [ ] **Step 5: Add styles**

In `styles-layout.css`, add:

```css
#networkRoomSettingsBackdrop {
  position: fixed;
  inset: 0;
  z-index: 1040;
  background: rgba(0, 0, 0, 0.56);
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms ease;
}

#networkRoomSettingsBackdrop.is-open {
  opacity: 1;
  pointer-events: auto;
}

#networkRoomSettingsPopup {
  position: absolute;
  right: calc(220px * var(--network-lobby-scale, 1));
  top: calc(72px * var(--network-lobby-scale, 1));
  z-index: 1050;
  width: min(calc(380px * var(--network-lobby-scale, 1)), calc(100vw - 32px));
  min-height: calc(220px * var(--network-lobby-scale, 1));
  padding: calc(18px * var(--network-lobby-scale, 1));
  display: none;
}

#networkRoomSettingsPopup.is-open {
  display: block;
}

#networkRoomSettingsPopupHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

#networkAutoOptionRow,
#networkDebugOptionRow {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
}
```

In `styles-responsive.css`, add:

```css
html.layout-profile-phone-portrait #networkRoomSettingsPopup {
  position: fixed;
  left: 50%;
  right: auto;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(92vw, 420px);
  max-height: 78vh;
  overflow: auto;
}
```

- [ ] **Step 6: Wire refs**

In `ui/bootstrap/init-dom.ts`, `ui/bootstrap/init-events.ts`, and `ui/handlers/init.ts`, add:

```ts
networkRoomSettingsBackdrop: HTMLElement | null;
networkEnableAutoCheckbox: HTMLInputElement | null;
```

Wire IDs:

```ts
networkRoomSettingsBackdrop: $('networkRoomSettingsBackdrop'),
networkEnableAutoCheckbox: $('networkEnableAutoCheckbox') as HTMLInputElement | null,
```

Pass both refs into `setupMatchModeControls`.

- [ ] **Step 7: Update popup behavior and create payload**

In `ui/handlers/match-mode.ts`, add refs:

```ts
networkRoomSettingsBackdrop: null,
networkEnableAutoCheckbox: null,
```

Update `setNetworkRoomSettingsPopupVisible`:

```ts
        if (uiRefs.networkRoomSettingsBackdrop) {
            uiRefs.networkRoomSettingsBackdrop.classList.toggle('is-open', open);
            uiRefs.networkRoomSettingsBackdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
        }
```

Add click-to-close:

```ts
        if (uiRefs.networkRoomSettingsBackdrop) {
            uiRefs.networkRoomSettingsBackdrop.addEventListener('click', () => {
                setNetworkRoomSettingsPopupVisible(false);
            });
        }
```

Read create option:

```ts
                const requestedNetworkAutoEnabled = !!(
                    uiRefs.networkEnableAutoCheckbox
                    && uiRefs.networkEnableAutoCheckbox.checked
                );
```

Pass create option:

```ts
                        networkAutoEnabled: requestedNetworkAutoEnabled
```

Reset on leave/setup:

```ts
                if (uiRefs.networkEnableAutoCheckbox) {
                    uiRefs.networkEnableAutoCheckbox.checked = false;
                }
```

- [ ] **Step 8: Run UI tests**

Run:

```powershell
npx jest test/ui.match-mode.network-button.test.ts test/ui.network-room-list-style.test.ts --runInBand
```

Expected: both suites pass.

- [ ] **Step 9: Commit**

Run:

```powershell
git add index.html styles-layout.css styles-responsive.css ui/bootstrap/init-dom.ts ui/bootstrap/init-events.ts ui/handlers/init.ts ui/handlers/match-mode.ts test/ui.match-mode.network-button.test.ts test/ui.network-room-list-style.test.ts
git commit -m "ネット対戦の部屋設定ポップアップを拡張"
```

Expected: commit succeeds if isolated.

---

## Task 6: Implement Network AUTO Delegate

**Files:**
- Create: `ui/network/auto-play.ts`
- Modify: `ui/handlers/auto.ts`
- Modify: `ui/handlers/match-mode.ts`
- Test: `test/ui.network-auto-play.test.ts`
- Test: `test/ui.auto.playback-state.test.ts`

- [ ] **Step 1: Write network auto-play tests**

Create `test/ui.network-auto-play.test.ts`:

```ts
const NetworkAutoPlay = require('../ui/network/auto-play');

describe('network auto play', () => {
  function createController(overrides: Record<string, any> = {}) {
    const publishSnapshot = jest.fn(async () => ({ ok: true }));
    const deps = Object.assign({
      isNetworkModeActive: () => true,
      isPlaybackBusy: () => false,
      getNetworkAutoEnabled: () => true,
      isAutoModeActive: () => true,
      getOwnSeatKey: () => 'black',
      getGameState: () => ({
        currentPlayer: 1,
        turnNumber: 3,
        board: [
          [0, 0, 0, 0],
          [0, 1, -1, 0],
          [0, -1, 1, 0],
          [0, 0, 0, 0]
        ]
      }),
      getPlayerValue: (key: string) => key === 'black' ? 1 : -1,
      generateMovesForPlayer: () => [{ row: 0, col: 2, flips: [{ row: 1, col: 2 }] }],
      selectCpuMoveWithPolicy: (moves: any[]) => moves[0],
      publishSnapshot,
      emitStatus: jest.fn()
    }, overrides);
    return {
      controller: NetworkAutoPlay.createNetworkAutoPlayController(deps),
      deps,
      publishSnapshot
    };
  }

  test('自席手番ならLv1 CPUの選択を通常publishで送る', async () => {
    const { controller, publishSnapshot } = createController();

    const result = await controller.tick();

    expect(result).toEqual({ ok: true, acted: true });
    expect(publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      playerKey: 'black',
      actionType: 'place',
      action: expect.objectContaining({
        type: 'place',
        playerKey: 'black',
        row: 0,
        col: 2,
        networkAuto: true,
        cpuLevel: 1
      })
    }));
  });

  test('AUTO許可がない部屋では送信しない', async () => {
    const { controller, publishSnapshot } = createController({
      getNetworkAutoEnabled: () => false
    });

    const result = await controller.tick();

    expect(result).toEqual({ ok: false, acted: false, reason: 'NETWORK_AUTO_DISABLED' });
    expect(publishSnapshot).not.toHaveBeenCalled();
  });

  test('相手手番では送信しない', async () => {
    const { controller, publishSnapshot } = createController({
      getGameState: () => ({ currentPlayer: -1, turnNumber: 3, board: [] })
    });

    const result = await controller.tick();

    expect(result).toEqual({ ok: false, acted: false, reason: 'NOT_OWN_TURN' });
    expect(publishSnapshot).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Extend local AUTO test**

In `test/ui.auto.playback-state.test.ts`, add:

```ts
test('network auto delegate runs before local black auto handler', () => {
  const button = document.getElementById('autoToggleBtn') as HTMLButtonElement;
  const networkTick = jest.fn(async () => ({ ok: true, acted: true }));
  (global.window as any).NetworkAutoPlay = {
    tick: networkTick
  };
  (global.window as any).processAutoBlackTurn = jest.fn();

  AutoHandler.setupAutoToggle(button);
  button.click();

  expect(networkTick).toHaveBeenCalled();
  expect((global.window as any).processAutoBlackTurn).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```powershell
npx jest test/ui.network-auto-play.test.ts test/ui.auto.playback-state.test.ts --runInBand
```

Expected: fails because `ui/network/auto-play.ts` and delegate call do not exist.

- [ ] **Step 4: Create network auto controller**

Create `ui/network/auto-play.ts`:

```ts
'use strict';

function normalizePlayerKey(value: any): string {
  return String(value || '').trim().toLowerCase() === 'white' ? 'white' : 'black';
}

function toTurnPlayerKey(gameState: any): string {
  return Number(gameState && gameState.currentPlayer) === -1 ? 'white' : 'black';
}

function createNetworkAutoPlayController(deps?: any): any {
  const cfg = (deps && typeof deps === 'object') ? deps : {};
  let inFlight = false;
  let lastPublishedTurn: any = null;

  async function tick(): Promise<any> {
    if (inFlight) return { ok: false, acted: false, reason: 'IN_FLIGHT' };
    if (typeof cfg.isNetworkModeActive === 'function' && cfg.isNetworkModeActive() !== true) {
      return { ok: false, acted: false, reason: 'NOT_NETWORK_MODE' };
    }
    if (typeof cfg.isAutoModeActive === 'function' && cfg.isAutoModeActive() !== true) {
      return { ok: false, acted: false, reason: 'AUTO_OFF' };
    }
    if (typeof cfg.getNetworkAutoEnabled === 'function' && cfg.getNetworkAutoEnabled() !== true) {
      return { ok: false, acted: false, reason: 'NETWORK_AUTO_DISABLED' };
    }
    if (typeof cfg.isPlaybackBusy === 'function' && cfg.isPlaybackBusy() === true) {
      return { ok: false, acted: false, reason: 'BUSY' };
    }

    const state = typeof cfg.getGameState === 'function' ? cfg.getGameState() : null;
    const ownSeat = normalizePlayerKey(typeof cfg.getOwnSeatKey === 'function' ? cfg.getOwnSeatKey() : 'black');
    const turnSeat = toTurnPlayerKey(state);
    if (ownSeat !== turnSeat) return { ok: false, acted: false, reason: 'NOT_OWN_TURN' };

    const turnNumber = state && Number.isFinite(Number(state.turnNumber)) ? Math.trunc(Number(state.turnNumber)) : null;
    if (turnNumber !== null && lastPublishedTurn === turnNumber) {
      return { ok: false, acted: false, reason: 'TURN_ALREADY_PUBLISHED' };
    }

    const playerValue = typeof cfg.getPlayerValue === 'function' ? cfg.getPlayerValue(ownSeat) : (ownSeat === 'white' ? -1 : 1);
    const moves = typeof cfg.generateMovesForPlayer === 'function'
      ? cfg.generateMovesForPlayer(state, playerValue)
      : [];
    if (!Array.isArray(moves) || moves.length <= 0) {
      return { ok: false, acted: false, reason: 'NO_LEGAL_MOVES' };
    }

    const selected = typeof cfg.selectCpuMoveWithPolicy === 'function'
      ? cfg.selectCpuMoveWithPolicy(moves, ownSeat, { forceLevel: 1, networkAuto: true })
      : moves[0];
    if (!selected) return { ok: false, acted: false, reason: 'NO_MOVE_SELECTED' };

    inFlight = true;
    try {
      const action = {
        type: 'place',
        playerKey: ownSeat,
        row: selected.row,
        col: selected.col,
        turnIndex: turnNumber,
        networkAuto: true,
        cpuLevel: 1
      };
      const result = await cfg.publishSnapshot({
        playerKey: ownSeat,
        actionType: 'place',
        action
      });
      if (result && result.ok === true && turnNumber !== null) {
        lastPublishedTurn = turnNumber;
      }
      return result && result.ok === true
        ? { ok: true, acted: true }
        : { ok: false, acted: false, reason: (result && result.reason) || 'PUBLISH_FAILED' };
    } finally {
      inFlight = false;
    }
  }

  return { tick };
}

export = { createNetworkAutoPlayController };
```

- [ ] **Step 5: Register runtime singleton**

In `ui/handlers/match-mode.ts` or bootstrap wiring after `NetworkMatchClient` is available, create a browser singleton:

```ts
function installNetworkAutoPlayController() {
    try {
        const mod = require('../network/auto-play');
        if (!mod || typeof mod.createNetworkAutoPlayController !== 'function') return;
        root.NetworkAutoPlay = mod.createNetworkAutoPlayController({
            isNetworkModeActive,
            isAutoModeActive: () => root.AUTO_MODE_ACTIVE === true,
            isPlaybackBusy: () => root.VisualPlaybackActive === true || root.isCardAnimating === true || root.isProcessing === true,
            getNetworkAutoEnabled: () => root.NetworkMatchClient && typeof root.NetworkMatchClient.getNetworkAutoEnabled === 'function'
                ? root.NetworkMatchClient.getNetworkAutoEnabled() === true
                : false,
            getOwnSeatKey: () => root.NetworkMatchClient && typeof root.NetworkMatchClient.getSeatKey === 'function'
                ? root.NetworkMatchClient.getSeatKey()
                : 'black',
            getGameState: () => root.gameState,
            getPlayerValue: (key: string) => key === 'white' ? root.WHITE : root.BLACK,
            generateMovesForPlayer: root.generateMovesForPlayer,
            selectCpuMoveWithPolicy: root.selectCpuMoveWithPolicy,
            publishSnapshot: (meta: any) => root.NetworkMatchClient.publishSnapshot(meta),
            emitStatus: writeNetworkStatus
        });
    } catch (e) { /* ignore */ }
}
```

Call it once during `setupMatchModeControls` after refs are assigned.

- [ ] **Step 6: Delegate from AUTO loop**

In `ui/handlers/auto.ts`, add helper:

```ts
function _runNetworkAutoTickIfAvailable(): boolean {
  try {
    const controller = (typeof window !== 'undefined' && (window as any).NetworkAutoPlay)
      ? (window as any).NetworkAutoPlay
      : ((typeof globalThis !== 'undefined' && (globalThis as any).NetworkAutoPlay) ? (globalThis as any).NetworkAutoPlay : null);
    if (!controller || typeof controller.tick !== 'function') return false;
    controller.tick();
    return true;
  } catch (e) {
    return false;
  }
}
```

At the start of `_uiAutoTick`, after busy checks and before `processAutoBlackTurn`, call:

```ts
    if (_runNetworkAutoTickIfAvailable()) {
      _autoTickCount++;
      _uiAutoTimer = setTimeout(_uiAutoTick, Math.max(_uiAutoIntervalMs, _MIN_AUTO_INTERVAL_MS));
      return;
    }
```

- [ ] **Step 7: Run network auto tests**

Run:

```powershell
npx jest test/ui.network-auto-play.test.ts test/ui.auto.playback-state.test.ts --runInBand
```

Expected: both suites pass.

- [ ] **Step 8: Commit**

Run:

```powershell
git add ui/network/auto-play.ts ui/handlers/auto.ts ui/handlers/match-mode.ts test/ui.network-auto-play.test.ts test/ui.auto.playback-state.test.ts
git commit -m "ネット対戦AUTOのクライアント実行を追加"
```

Expected: commit succeeds if isolated.

---

## Task 7: Gate AUTO Button By Room Permission

**Files:**
- Modify: `ui/handlers/match-mode.ts`
- Modify: `ui/handlers/auto.ts`
- Test: `test/ui.match-mode.network-button.test.ts`

- [ ] **Step 1: Write failing AUTO gate test**

In `test/ui.match-mode.network-button.test.ts`, add:

```ts
test('AUTO許可のないネット対戦部屋ではAUTOボタンを無効化する', async () => {
  const autoBtn = document.getElementById('autoToggleBtn') as HTMLButtonElement;
  window.NetworkMatchClient.getNetworkAutoEnabled = jest.fn(() => false);
  window.NetworkMatchClient.getRoomId = jest.fn(() => 'A1B');

  await window.MatchMode.setMode('network', { silentLog: true });

  expect(autoBtn.disabled).toBe(true);
  expect(autoBtn.getAttribute('aria-disabled')).toBe('true');
  expect(autoBtn.textContent).toBe('AUTO: OFF');
});

test('AUTO許可のあるネット対戦部屋ではAUTOボタンを有効化する', async () => {
  const autoBtn = document.getElementById('autoToggleBtn') as HTMLButtonElement;
  window.NetworkMatchClient.getNetworkAutoEnabled = jest.fn(() => true);
  window.NetworkMatchClient.getRoomId = jest.fn(() => 'A1B');

  await window.MatchMode.setMode('network', { silentLog: true });

  expect(autoBtn.disabled).toBe(false);
  expect(autoBtn.getAttribute('aria-disabled')).toBe('false');
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
npx jest test/ui.match-mode.network-button.test.ts --runInBand
```

Expected: fails because network mode currently disables AUTO unconditionally.

- [ ] **Step 3: Replace unconditional network AUTO disable**

In `ui/handlers/match-mode.ts`, replace:

```ts
    function shouldDisableAutoMode(mode: any) {
        return mode === MODE_NETWORK;
    }
```

with:

```ts
    function isNetworkAutoAllowed() {
        try {
            return !!(
                root.NetworkMatchClient
                && typeof root.NetworkMatchClient.getNetworkAutoEnabled === 'function'
                && root.NetworkMatchClient.getNetworkAutoEnabled() === true
            );
        } catch (e) {
            return false;
        }
    }

    function shouldDisableAutoMode(mode: any) {
        return mode === MODE_NETWORK && !isNetworkAutoAllowed();
    }
```

Add:

```ts
    function refreshAutoButtonForNetworkRoom() {
        if (!uiRefs.autoToggleBtn) return;
        const disable = currentMode === MODE_NETWORK && !isNetworkAutoAllowed();
        (uiRefs.autoToggleBtn as HTMLButtonElement).disabled = disable;
        uiRefs.autoToggleBtn.setAttribute('aria-disabled', disable ? 'true' : 'false');
        if (disable) disableAutoModeForHumanPlay();
    }
```

Call `refreshAutoButtonForNetworkRoom()` after mode changes and inside the room state listener where `networkDebugEnabled` is refreshed.

- [ ] **Step 4: Harden AUTO click handler**

In `ui/handlers/auto.ts`, before toggling ON, block disabled button:

```ts
    if ((autoToggleBtn as HTMLButtonElement).disabled === true || autoToggleBtn.getAttribute('aria-disabled') === 'true') {
      _uiAutoDisable();
      autoToggleBtn.textContent = 'AUTO: OFF';
      return;
    }
```

- [ ] **Step 5: Run gate tests**

Run:

```powershell
npx jest test/ui.match-mode.network-button.test.ts test/ui.auto.playback-state.test.ts --runInBand
```

Expected: both suites pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add ui/handlers/match-mode.ts ui/handlers/auto.ts test/ui.match-mode.network-button.test.ts
git commit -m "ネット対戦AUTOボタンを部屋設定で制御"
```

Expected: commit succeeds if isolated.

---

## Task 8: Build And Mirror Public Runtime

**Files:**
- Generated/modify: `public/module-registry.js`
- Generated/modify: `public/runtime.js`
- Generated/modify: `worker-public/**`

- [ ] **Step 1: Run TypeScript build and Worker asset mirror**

Run:

```powershell
npm run worker:prepare
```

Expected: `tsc -p tsconfig.build.json` succeeds, module registry is rebuilt, worker-public mirror verifies.

- [ ] **Step 2: Confirm generated text includes new metadata**

Run:

```powershell
rg -n "networkAutoEnabled|networkEnableAutoCheckbox|NetworkAutoPlay" public worker-public
```

Expected: generated browser runtime and worker-public mirror contain the new fields and module registration.

- [ ] **Step 3: Run focused regression suites**

Run:

```powershell
npx jest test/ui.match-mode.network-button.test.ts test/ui.network-room-list-style.test.ts test/ui.network-session-lifecycle.test.ts test/ui.network-client.publish-base-version.test.ts test/ui.network-auto-play.test.ts test/ui.auto.playback-state.test.ts test/workers.match-room-deck.test.ts test/workers.match-stream-sse.test.ts --runInBand
```

Expected: all listed suites pass.

- [ ] **Step 4: Run network parity smoke if Worker contracts changed cleanly**

Run:

```powershell
npm run test:network:parity
```

Expected: network parity passes. If it is too slow or fails due existing unrelated dirty state, capture the first failing test and report it before deployment.

- [ ] **Step 5: Commit generated outputs**

Run:

```powershell
git add public/module-registry.js public/runtime.js worker-public
git commit -m "ネット対戦AUTO設定の配信資産を同期"
```

Expected: commit succeeds only if generated outputs are from this feature's source changes. If worker-public already contains unrelated dirty files, do not commit and report the exact files.

---

## Task 9: Manual Browser Verification

**Files:**
- No source edits unless defects are found.

- [ ] **Step 1: Start local preview**

Run:

```powershell
npm run serve
```

Expected: local server starts. If this repo uses a different local server script in the current checkout, use the existing project script that serves `index.html` and `public/module-registry.js`.

- [ ] **Step 2: Verify popup UI**

Open the local URL and confirm:

```text
1. ネット対戦を開く
2. 歯車を押す
3. 背景が暗くなる
4. 部屋設定ポップアップに盤面サイズ、デバッグモード、オートプレイ許可が表示される
5. 背景または閉じるボタンで閉じる
```

Expected: popup is centered/near the create button on PC, fits within viewport on mobile layout, and does not overlap the create button text.

- [ ] **Step 3: Verify one-side AUTO**

Use two browser sessions:

```text
1. Session A creates a room with オートプレイ許可 ON
2. Session B joins
3. Session A presses AUTO
4. Session B leaves AUTO OFF
```

Expected: only Session A's seat auto-publishes on its own turns. Session B remains manual.

- [ ] **Step 4: Verify both-side AUTO**

Continue from the same room:

```text
1. Session B presses AUTO
2. Leave both sessions open
```

Expected: both browsers publish only their own seat turns and the game progresses without either browser sending the opponent's move.

- [ ] **Step 5: Verify disabled room**

Create a second room with オートプレイ許可 OFF.

Expected: network mode keeps `AUTO` disabled, pressing it does not set `AUTO: ON`, and no auto publish request is sent.

---

## Self-Review

- Spec coverage: popup, dark backdrop, board size/debug movement, new auto-play permission, one-side AUTO, both-side AUTO, and disabled-room behavior are covered by Tasks 1, 5, 6, 7, and 9.
- Authority boundary: network AUTO publishes only through `NetworkMatchClient.publishSnapshot`; Worker remains authoritative and does not execute bot turns.
- Type consistency: the new field name is consistently `networkAutoEnabled` across shared payloads, Worker room state, browser client state, UI checkbox, and tests.
- Generated output: Task 8 requires `npm run worker:prepare` and verifies public/worker-public mirrors.

# Network Spectator Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only spectator sessions to network matches, allowing up to four spectators per room without granting player authority or leaking hidden seat-specific information.

**Architecture:** Treat spectators as authenticated viewers, not as black/white seats. Keep canonical match authority in the Worker/local server room state, keep hidden-information projection in `utils/match-authority.ts`, and make browser UI enter a read-only network session when `viewerRole === 'spectator'`.

**Tech Stack:** TypeScript/CommonJS modules, Cloudflare Worker Durable Object room authority, local Node match server, SSE, Jest/jsdom tests, Playwright-on-Jest smoke tests only if UI regressions require them.

---

## Current State Snapshot

- Network room authority is owned by `workers/match-worker.ts` and `scripts/local-match-server.ts`.
- Shared network projection and seat authentication live in `utils/match-authority.ts` and `utils/match-authority-types.ts`.
- SSE currently stores black/white-specific snapshot payloads through `payloadByViewer.black` and `payloadByViewer.white`.
- Browser network session state in `ui/network-client.ts` assumes a joined player seat with `seatKey` and `seatToken`.
- Room list entries from `shared/match-room-lobby.ts` currently hide full two-player rooms, which prevents spectating active full rooms from the list.
- Root files are canonical. `worker-public/` must be updated only through `npm run worker:prepare` after source changes.

## Behavior Contract

- Up to four spectators may join a network room.
- A spectator is not a black/white seat and must not be accepted by `/api/match/publish`, `/api/match/hand-skin`, or player-seat leave paths.
- Spectators may call `/api/match/state` and `/api/match/stream` with spectator credentials.
- Spectators receive authoritative snapshots, heartbeat events, presence events, and chat history/events, but cannot send chat in the first implementation.
- Spectator snapshots must not reveal either player's hidden hand or seat-specific hidden trap state.
- Seat-specific reveals such as `盤理の観測者` remain visible only to the entitled player seat, not to spectators.
- A room with two active player seats may appear in the room list when `spectatorCount < maxSpectators`.
- A spectator disconnecting the SSE stream does not remove the spectator slot. `spectator-leave` removes it, and stale cleanup may remove old spectator entries by `lastSeenAt`.
- `game/` remains headless. No DOM, `window`, network, sound, or timer dependency is added to gameplay logic.

## Execution Prerequisites

- Start each task with `git status --short`.
- If unrelated dirty files exist, do not stage them. Stage only files listed in the current task.
- Read `01-rulebook.md` before changing player-visible behavior.
- Read `docs/architecture-contracts.md` before changing projection/SSE contracts.
- Do not edit `worker-public/` by hand. Run `npm run worker:prepare` when root source changes affect worker-served assets.
- Use focused Jest tests before broad commands.

## File Map

- Modify: `01-rulebook.md`
  - Add the player-visible spectator rules and hidden-information behavior.
- Modify: `docs/architecture-contracts.md`
  - Record spectator viewer projection as a stable network contract.
- Modify: `utils/match-authority-types.ts`
  - Add spectator state, viewer identity, payload, and buffered SSE types.
- Modify: `utils/match-authority.ts`
  - Add spectator normalization/authentication/state helpers and spectator projection support.
- Modify: `shared/match-room-lobby.ts`
  - Add `spectatorCount`, `maxSpectators`, `canJoin`, and `canSpectate` to public room list entries.
- Modify: `workers/match-worker-types.ts`
  - Store `viewer` on SSE stream info instead of only `seatKey`.
- Modify: `workers/match-worker-api.ts`
  - Forward `/api/match/spectate` and `/api/match/spectator-leave` to the room Durable Object.
- Modify: `workers/match-worker.ts`
  - Initialize spectator room state, handle spectator join/leave, authenticate spectator state/stream viewers, broadcast spectator projection.
- Modify: `workers/match-worker-stream-route-controller.ts`
  - Resolve a generic viewer from stream query parameters.
- Modify: `workers/match-worker-broadcast-controller.ts`
  - Buffer and broadcast black/white/spectator snapshot payloads.
- Modify: `scripts/local-match-server.ts`
  - Keep local server API behavior aligned with the Worker.
- Modify: `shared/match-entry-payload.ts`
  - Add a spectator entry payload builder.
- Modify: `ui/network-client.ts`
  - Add spectator session state and read-only guards.
- Modify: `ui/network/session-lifecycle.ts`
  - Add `spectateRoom` lifecycle flow.
- Modify: `ui/network/session-seat.ts`
  - Store viewer role and avoid setting action bridges for spectators.
- Modify: `ui/network/stream-session.ts`
  - Build stream URLs for seat or spectator credentials.
- Modify: `ui/network/snapshot-canonical.ts`
  - Inspect spectator snapshots without requiring local seat projection.
- Modify: `ui/network/room-events.ts`
  - Keep receiving chat/presence in spectator mode while preventing self-seat messages from being misclassified.
- Modify: `ui/handlers/match-mode.ts`
  - Add room-list spectate buttons and read-only UI state.
- Modify: `index.html`
  - Add or expose a modal action for room-code spectating if the existing controls need a direct button outside the list.
- Test: `test/utils.match-authority.spectator.test.ts`
- Test: `test/shared.match-room-lobby.test.ts`
- Test: `test/workers.match-spectator.test.ts`
- Test: `test/local-match-server.spectator.test.ts`
- Test: `test/ui.network-stream-session.test.ts`
- Test: `test/ui.network-session-lifecycle.test.ts`
- Test: `test/ui.network-client.spectator.test.ts`
- Test: `test/ui.match-mode.network-button.test.ts`

## Task 1: Document The Player-Visible Spectator Contract

**Files:**
- Modify: `01-rulebook.md`
- Modify: `docs/architecture-contracts.md`

- [ ] **Step 1: Add the rulebook wording before implementation**

Add this text near the existing network-mode rules in `01-rulebook.md`:

```md
### ネット対戦の観戦

- ネット対戦 room には、黒/白の対局者とは別に最大4人まで観戦者が参加できる。
- 観戦者は盤面、公開済み情報、ターン、残り時間、対局者名、チャット履歴を閲覧できる。
- 観戦者は石配置、カード使用、手札破壊、パス、手スキン同期、対局者チャット送信を行えない。
- 観戦者には黒白どちらの非公開手札も公開しない。`盤理の観測者` など seat 専用の公開効果も、権利を持つ対局者 seat にだけ表示する。
- パスワード付き room を観戦する場合も、参加時と同じ room パスワードを必要とする。
```

- [ ] **Step 2: Add the architecture contract wording**

Add this text to `docs/architecture-contracts.md` under the network projection section:

```md
### 8.8 Spectator projection

Network spectators are authenticated read-only viewers, not player seats.

- A spectator viewer may receive `/api/match/state` and `/api/match/stream`.
- A spectator viewer must not be accepted by publish, hand-skin, or seat-leave authority paths.
- Spectator snapshot projection is authoritative for spectators, but it is not entitled to either seat's hidden information.
- Buffered SSE replay must store or derive a spectator-safe payload separately from black/white payloads.
```

- [ ] **Step 3: Run a docs sanity check**

Run:

```powershell
Select-String -Path 01-rulebook.md,docs/architecture-contracts.md -Pattern "観戦|Spectator projection"
```

Expected: the new rulebook section and architecture section are both found.

- [ ] **Step 4: Commit the docs contract**

Run:

```powershell
git status --short
git add 01-rulebook.md docs/architecture-contracts.md
git commit -m "ネット観戦仕様を明文化"
```

Expected: one commit containing only the two documentation files.

## Task 2: Add Shared Spectator Authority Helpers

**Files:**
- Modify: `utils/match-authority-types.ts`
- Modify: `utils/match-authority.ts`
- Create: `test/utils.match-authority.spectator.test.ts`

- [ ] **Step 1: Write failing shared-helper tests**

Create `test/utils.match-authority.spectator.test.ts`:

```ts
const MatchAuthority = require('../utils/match-authority');

function createRoom(overrides = {}) {
  return {
    roomId: 'SP1',
    stateVersion: 3,
    updatedAt: 1000,
    seats: { black: true, white: true },
    seatNames: { black: '黒主', white: '白主' },
    seatTokens: { black: 'black-token', white: 'white-token' },
    spectators: {},
    snapshot: {
      stateVersion: 3,
      gameState: { board: [[0]], currentPlayer: 1 },
      cardState: {
        hands: {
          black: ['meteor_will'],
          white: ['guard_will']
        },
        markers: []
      }
    },
    ...overrides
  };
}

describe('match authority spectator helpers', () => {
  test('adds up to four spectators and rejects the fifth', () => {
    const room = createRoom();
    const added = [];
    for (let index = 0; index < 4; index += 1) {
      const result = MatchAuthority.addSpectatorToRoom(room, {
        spectatorName: `観戦${index + 1}`,
        makeSpectatorToken: () => `token-${index + 1}`,
        makeSpectatorId: () => `spec_test000${index + 1}`,
        now: 1000 + index
      });
      expect(result.ok).toBe(true);
      added.push(result.spectatorId);
    }

    expect(Object.keys(room.spectators)).toEqual(added);
    const full = MatchAuthority.addSpectatorToRoom(room, {
      spectatorName: '満員後',
      makeSpectatorToken: () => 'token-5',
      makeSpectatorId: () => 'spec_test0005',
      now: 2000
    });
    expect(full).toEqual({ ok: false, reason: 'SPECTATOR_FULL' });
  });

  test('authenticates seat viewers and spectator viewers separately', () => {
    const room = createRoom({
      spectators: {
        spec_test0001: { token: 'spec-token', name: '観戦1', joinedAt: 1000, lastSeenAt: 1000 }
      }
    });

    expect(MatchAuthority.resolveAuthenticatedViewer(room, {
      seatKey: 'black',
      seatToken: 'black-token'
    })).toEqual({ role: 'seat', seatKey: 'black' });

    expect(MatchAuthority.resolveAuthenticatedViewer(room, {
      viewerRole: 'spectator',
      spectatorId: 'spec_test0001',
      spectatorToken: 'spec-token',
      now: 1500
    })).toEqual({ role: 'spectator', spectatorId: 'spec_test0001' });

    expect(room.spectators.spec_test0001.lastSeenAt).toBe(1500);
  });

  test('spectator projection hides both hands', () => {
    const room = createRoom();
    const shot = MatchAuthority.buildPublicSnapshotForViewer(room, { role: 'spectator', spectatorId: 'spec_test0001' });
    expect(shot._meta).toEqual(expect.objectContaining({
      authority: 'server',
      projectedForSeat: null,
      viewerRole: 'spectator'
    }));
    expect(shot.cardState.hands.black).toEqual(['__hidden_hand__:black:0']);
    expect(shot.cardState.hands.white).toEqual(['__hidden_hand__:white:0']);
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```powershell
npx jest test/utils.match-authority.spectator.test.ts --runInBand
```

Expected: FAIL because `addSpectatorToRoom`, `resolveAuthenticatedViewer`, and `buildPublicSnapshotForViewer` do not exist.

- [ ] **Step 3: Add shared types**

Add these exports to `utils/match-authority-types.ts`:

```ts
export type MatchAuthorityViewerRole = 'seat' | 'spectator';

export interface MatchAuthoritySpectatorState {
    token: string;
    name: string;
    joinedAt: number;
    lastSeenAt: number;
}

export interface MatchAuthoritySpectators {
    [spectatorId: string]: MatchAuthoritySpectatorState;
}

export interface MatchAuthoritySeatViewer {
    role: 'seat';
    seatKey: MatchAuthoritySeatKey;
}

export interface MatchAuthoritySpectatorViewer {
    role: 'spectator';
    spectatorId: string;
}

export type MatchAuthorityViewer = MatchAuthoritySeatViewer | MatchAuthoritySpectatorViewer;

export interface MatchAuthoritySpectatorJoinOptions {
    spectatorName?: unknown;
    makeSpectatorToken?: (() => string) | null;
    makeSpectatorId?: (() => string) | null;
    now?: unknown;
}

export type MatchAuthoritySpectatorJoinResult =
    | { ok: true; spectatorId: string; spectatorToken: string; spectatorName: string; spectatorCount: number; maxSpectators: number }
    | { ok: false; reason: 'SPECTATOR_FULL' | 'SPECTATOR_ID_COLLISION' };
```

Extend `MatchAuthorityRoomState`:

```ts
    spectators?: MatchAuthoritySpectators | null;
```

Extend `MatchAuthorityRoomPayloadOptions` and `MatchAuthorityRoomPayload`:

```ts
    viewerRole?: unknown;
    spectatorId?: unknown;
    spectatorToken?: unknown;
    spectatorName?: unknown;
    spectatorCount?: unknown;
    maxSpectators?: unknown;
```

Extend `MatchAuthorityBufferedSsePayloadByViewer`:

```ts
    spectator?: unknown;
```

- [ ] **Step 4: Add shared helper implementation**

Add these constants and helper exports in `utils/match-authority.ts`:

```ts
const MAX_SPECTATORS = 4;
const SPECTATOR_ID_RE = /^spec_[A-Za-z0-9_-]{8,40}$/;
const NETWORK_SPECTATOR_NAME_MAX = NETWORK_PLAYER_NAME_MAX;

function normalizeSpectatorName(value: unknown): string {
    return Array.from(String(value || '').replace(/\s+/g, ' ').trim()).slice(0, NETWORK_SPECTATOR_NAME_MAX).join('');
}

function normalizeSpectatorId(value: unknown): string {
    const raw = String(value || '').trim();
    return SPECTATOR_ID_RE.test(raw) ? raw : '';
}

function ensureSpectators(roomValue: MatchAuthorityRoomState | null | undefined): MatchAuthoritySpectators {
    const room = (roomValue && typeof roomValue === 'object') ? roomValue : {};
    const source = room.spectators && typeof room.spectators === 'object' ? room.spectators : {};
    room.spectators = source as MatchAuthoritySpectators;
    return room.spectators;
}

function getActiveSpectatorEntries(roomValue: MatchAuthorityRoomState | null | undefined): Array<[string, MatchAuthoritySpectatorState]> {
    const spectators = ensureSpectators(roomValue);
    return Object.keys(spectators)
        .map((id) => [id, spectators[id]] as [string, MatchAuthoritySpectatorState])
        .filter(([, entry]) => !!(entry && typeof entry === 'object' && String(entry.token || '').trim()));
}
```

Add the public join/auth helpers:

```ts
function addSpectatorToRoom(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: MatchAuthoritySpectatorJoinOptions | null
): MatchAuthoritySpectatorJoinResult {
    const room = (roomValue && typeof roomValue === 'object') ? roomValue : null;
    const opts = (options && typeof options === 'object') ? options : {};
    if (!room) return { ok: false, reason: 'SPECTATOR_FULL' };
    const spectators = ensureSpectators(room);
    const activeCount = getActiveSpectatorEntries(room).length;
    if (activeCount >= MAX_SPECTATORS) return { ok: false, reason: 'SPECTATOR_FULL' };

    const makeId = typeof opts.makeSpectatorId === 'function'
        ? opts.makeSpectatorId
        : () => `spec_${Math.random().toString(36).slice(2, 14)}`;
    const makeToken = typeof opts.makeSpectatorToken === 'function'
        ? opts.makeSpectatorToken
        : () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const nowMs = Number.isFinite(Number(opts.now)) ? Math.trunc(Number(opts.now)) : Date.now();

    let spectatorId = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
        spectatorId = normalizeSpectatorId(makeId());
        if (spectatorId && !spectators[spectatorId]) break;
        spectatorId = '';
    }
    if (!spectatorId) return { ok: false, reason: 'SPECTATOR_ID_COLLISION' };

    const spectatorName = normalizeSpectatorName(opts.spectatorName) || '観戦者';
    const spectatorToken = String(makeToken() || '').trim();
    spectators[spectatorId] = {
        token: spectatorToken,
        name: spectatorName,
        joinedAt: nowMs,
        lastSeenAt: nowMs
    };
    room.updatedAt = nowMs;

    return {
        ok: true,
        spectatorId,
        spectatorToken,
        spectatorName,
        spectatorCount: activeCount + 1,
        maxSpectators: MAX_SPECTATORS
    };
}
```

Add viewer authentication:

```ts
function resolveAuthenticatedViewer(
    roomValue: MatchAuthorityRoomState | null | undefined,
    options?: Record<string, unknown> | null
): MatchAuthorityViewer | null {
    const room = (roomValue && typeof roomValue === 'object') ? roomValue : null;
    const opts = (options && typeof options === 'object') ? options : {};
    if (!room) return null;

    if (String(opts.viewerRole || '').trim().toLowerCase() === 'spectator') {
        const spectatorId = normalizeSpectatorId(opts.spectatorId);
        const spectatorToken = String(opts.spectatorToken || '').trim();
        const spectators = ensureSpectators(room);
        const entry = spectatorId ? spectators[spectatorId] : null;
        if (!entry || !spectatorToken || entry.token !== spectatorToken) return null;
        entry.lastSeenAt = Number.isFinite(Number(opts.now)) ? Math.trunc(Number(opts.now)) : Date.now();
        return { role: 'spectator', spectatorId };
    }

    const seatKey = resolveAuthenticatedSeatKey(room, opts.seatKey, opts.seatToken);
    return seatKey ? { role: 'seat', seatKey } : null;
}
```

Add `buildPublicSnapshotForViewer(room, viewer)` as the new internal projection entry and keep `buildPublicSnapshot(room, viewerSeatKey)` as a compatibility wrapper:

```ts
function buildPublicSnapshotForViewer(
    room: MatchAuthorityRoomState | null | undefined,
    viewerValue: unknown
): MatchAuthorityPublicSnapshot {
    const viewer = normalizeViewerIdentity(viewerValue);
    const viewerSeatKey = viewer && viewer.role === 'seat' ? viewer.seatKey : null;
    const shot = projectSnapshotForViewer(room && room.snapshot ? room.snapshot : {}, viewerSeatKey, {
        stateVersion: room ? room.stateVersion : 0,
        updatedAt: room ? room.updatedAt : Date.now(),
        projectedForSeat: viewerSeatKey,
        viewerRole: viewer ? viewer.role : 'spectator',
        turnStartReconciled: true
    });
    stripTransientPresentationState(shot);
    const projectedSnapshotHash = computeProjectedSnapshotHash(shot);
    if (!shot._meta || typeof shot._meta !== 'object') shot._meta = {};
    asRecord(shot._meta).projectedSnapshotHash = projectedSnapshotHash;
    return shot;
}

function buildPublicSnapshot(room: MatchAuthorityRoomState | null | undefined, viewerSeatKey: PlayerKey | null | undefined): MatchAuthorityPublicSnapshot {
    const seatKey = parseSeatKeyOptional(viewerSeatKey);
    return buildPublicSnapshotForViewer(room, seatKey ? { role: 'seat', seatKey } : { role: 'spectator', spectatorId: '' });
}
```

Export the new helpers from the `MatchAuthority` object.

- [ ] **Step 5: Run the shared-helper tests**

Run:

```powershell
npx jest test/utils.match-authority.spectator.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Run nearby projection tests**

Run:

```powershell
npx jest test/utils.match-authority.public-snapshot.test.ts test/workers.match-reveal-hand-visibility.test.ts --runInBand
```

Expected: PASS. Existing black/white projection behavior is unchanged.

- [ ] **Step 7: Commit shared spectator helpers**

Run:

```powershell
git status --short
git add utils/match-authority-types.ts utils/match-authority.ts test/utils.match-authority.spectator.test.ts
git commit -m "観戦者の共有認証と投影を追加"
```

Expected: one commit containing only shared authority code and its test.

## Task 3: Expose Spectator Metadata In Room Lists

**Files:**
- Modify: `shared/match-room-lobby.ts`
- Modify: `test/shared.match-room-lobby.test.ts`

- [ ] **Step 1: Add failing room-list tests**

Append these tests to `test/shared.match-room-lobby.test.ts`:

```ts
test('public room list exposes spectator availability for full rooms', () => {
  const entry = MatchRoomLobby.toPublicRoomListEntry({
    roomId: 'FUL',
    roomName: '満員部屋',
    seats: { black: true, white: true },
    seatNames: { black: '黒', white: '白' },
    spectators: {
      spec_a: { token: 'a', name: '観戦A', joinedAt: 1, lastSeenAt: 1 }
    },
    maxSpectators: 4,
    stateVersion: 8,
    createdAt: 100,
    updatedAt: 200
  });

  expect(entry).toEqual(expect.objectContaining({
    roomId: 'FUL',
    seatCount: 2,
    maxSeats: 2,
    spectatorCount: 1,
    maxSpectators: 4,
    canJoin: false,
    canSpectate: true
  }));
});

test('public room list hides full rooms when spectator slots are full', () => {
  const entry = MatchRoomLobby.toPublicRoomListEntry({
    roomId: 'SFL',
    seats: { black: true, white: true },
    spectators: {
      spec_a: { token: 'a' },
      spec_b: { token: 'b' },
      spec_c: { token: 'c' },
      spec_d: { token: 'd' }
    },
    maxSpectators: 4,
    stateVersion: 8,
    createdAt: 100,
    updatedAt: 200
  });

  expect(entry).toBeNull();
});
```

- [ ] **Step 2: Run the failing lobby tests**

Run:

```powershell
npx jest test/shared.match-room-lobby.test.ts --runInBand
```

Expected: FAIL because `spectatorCount`, `maxSpectators`, `canJoin`, and `canSpectate` are absent and full rooms are filtered out.

- [ ] **Step 3: Implement room-list spectator fields**

Update the `RoomListEntry` type:

```ts
  spectatorCount: number;
  maxSpectators: number;
  canJoin: boolean;
  canSpectate: boolean;
```

Add helpers:

```ts
function getActiveSpectatorCount(roomValue: unknown): number {
  const room = asRecord(roomValue);
  const spectators = asRecord(room.spectators);
  return Object.keys(spectators)
    .filter((id) => !!(asRecord(spectators[id]).token))
    .length;
}

function getMaxSpectators(roomValue: unknown): number {
  const room = asRecord(roomValue);
  return Math.max(0, toFiniteInteger(room.maxSpectators, 4));
}
```

Update `toPublicRoomListEntry` filtering:

```ts
  const spectatorCount = getActiveSpectatorCount(room);
  const maxSpectators = getMaxSpectators(room);
  const canJoin = seatCount > 0 && seatCount < maxSeats;
  const canSpectate = seatCount > 0 && spectatorCount < maxSpectators;
  if (!canJoin && !canSpectate) return null;
```

Include the fields in the returned object:

```ts
    spectatorCount,
    maxSpectators,
    canJoin,
    canSpectate,
```

- [ ] **Step 4: Run lobby tests**

Run:

```powershell
npx jest test/shared.match-room-lobby.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit lobby metadata**

Run:

```powershell
git status --short
git add shared/match-room-lobby.ts test/shared.match-room-lobby.test.ts
git commit -m "観戦可能なルーム一覧情報を追加"
```

Expected: one commit containing lobby metadata only.

## Task 4: Add Worker Spectator Join And Leave API

**Files:**
- Modify: `workers/match-worker-api.ts`
- Modify: `workers/match-worker.ts`
- Modify: `workers/match-worker-types.ts`
- Create: `test/workers.match-spectator.test.ts`

- [ ] **Step 1: Write failing Worker API tests**

Create `test/workers.match-spectator.test.ts`:

```ts
const path = require('path');
const { pathToFileURL } = require('url');

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

async function loadWorkerModule() {
  return import(workerModulePath);
}

describe('match worker spectator API', () => {
  test('spectate admits four spectators and rejects the fifth', async () => {
    const mod = await loadWorkerModule();
    const room = new mod.MatchRoomDurableObject({
      storage: {
        value: null,
        get() { return this.value; },
        put(_key, value) { this.value = value; },
        delete() { this.value = null; }
      }
    }, {});

    const createResponse = await room.handleInternalCreate(new URL('https://room/internal/create'), {
      roomId: 'SPC',
      playerName: '黒',
      snapshot: {
        gameState: { board: [[0]], currentPlayer: 1 },
        cardState: { hands: { black: [], white: [] } }
      }
    });
    expect(createResponse.status).toBe(200);

    for (let index = 0; index < 4; index += 1) {
      const response = await room.handleSpectate({
        roomId: 'SPC',
        spectatorName: `観戦${index + 1}`
      });
      const payload = await response.json();
      expect(response.status).toBe(200);
      expect(payload).toEqual(expect.objectContaining({
        ok: true,
        viewerRole: 'spectator',
        spectatorId: expect.stringMatching(/^spec_/),
        spectatorToken: expect.any(String),
        spectatorCount: index + 1,
        maxSpectators: 4,
        snapshot: expect.any(Object)
      }));
    }

    const fullResponse = await room.handleSpectate({ roomId: 'SPC', spectatorName: '満員後' });
    expect(fullResponse.status).toBe(409);
    await expect(fullResponse.json()).resolves.toEqual(expect.objectContaining({
      ok: false,
      reason: 'SPECTATOR_FULL'
    }));
  });

  test('spectator token cannot publish', async () => {
    const mod = await loadWorkerModule();
    const room = new mod.MatchRoomDurableObject({
      storage: {
        value: null,
        get() { return this.value; },
        put(_key, value) { this.value = value; },
        delete() { this.value = null; }
      }
    }, {});

    await room.handleInternalCreate(new URL('https://room/internal/create'), {
      roomId: 'SPP',
      playerName: '黒',
      snapshot: {
        gameState: { board: [[0]], currentPlayer: 1 },
        cardState: { hands: { black: [], white: [] } }
      }
    });
    const spectatePayload = await (await room.handleSpectate({ roomId: 'SPP', spectatorName: '観戦' })).json();

    const publishResponse = await room.handlePublish({
      roomId: 'SPP',
      viewerRole: 'spectator',
      spectatorId: spectatePayload.spectatorId,
      spectatorToken: spectatePayload.spectatorToken,
      action: { type: 'place', row: 0, col: 0 }
    });
    expect(publishResponse.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run the failing Worker spectator test**

Run:

```powershell
npx jest test/workers.match-spectator.test.ts --runInBand
```

Expected: FAIL because `handleSpectate` does not exist.

- [ ] **Step 3: Initialize spectator state in rooms**

In `workers/match-worker.ts`, add to `createRoomState`:

```ts
            spectators: {},
            maxSpectators: MatchAuthority.MAX_SPECTATORS || 4,
```

Add token/id generators near `makeSeatToken`:

```ts
function makeSpectatorToken(): string {
    return makeSeatToken();
}

function makeSpectatorId(): string {
    return `spec_${makeSeatToken().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16)}`;
}
```

- [ ] **Step 4: Add Worker room handlers**

Add methods to the `MatchRoomDurableObject` class:

```ts
    async handleSpectate(body: Record<string, unknown>): Promise<Response> {
        await this.loadRoom();
        const room = this.room;
        if (!room) return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        if (await this.expireWaitingRoomIfNeeded(Date.now())) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }
        if (!MatchRoomLobby.isJoinPasswordAccepted(room, body.roomPassword)) {
            return jsonResponse(403, { ok: false, reason: 'ROOM_PASSWORD_INVALID' });
        }

        const result = MatchAuthority.addSpectatorToRoom(room, {
            spectatorName: body.spectatorName || body.playerName,
            makeSpectatorToken,
            makeSpectatorId,
            now: Date.now()
        });
        if (!result.ok) {
            return jsonResponse(result.reason === 'SPECTATOR_FULL' ? 409 : 500, { ok: false, reason: result.reason });
        }

        await this.saveRoom();
        await this.broadcastPresence({
            type: 'spectator_join',
            spectatorId: result.spectatorId,
            spectatorName: result.spectatorName,
            rejoined: false
        });

        const viewer = { role: 'spectator', spectatorId: result.spectatorId };
        const serverTime = Date.now();
        return jsonResponse(200, MatchAuthority.buildRoomPayloadFromRoom(room, {
            ok: true,
            viewerRole: 'spectator',
            spectatorId: result.spectatorId,
            spectatorToken: result.spectatorToken,
            spectatorName: result.spectatorName,
            spectatorCount: result.spectatorCount,
            maxSpectators: result.maxSpectators,
            stateVersion: room.stateVersion,
            snapshot: toPublicSnapshotForViewer(room, viewer),
            roomDeck: toPublicRoomDeck(room),
            roomBoardConfig: toPublicRoomBoardConfig(room),
            networkDebugEnabled: toPublicNetworkDebugEnabled(room),
            turnTimer: toPublicTurnTimer(room, serverTime),
            serverTime
        }));
    }
```

Add leave:

```ts
    async handleSpectatorLeave(body: Record<string, unknown>): Promise<Response> {
        await this.loadRoom();
        const room = this.room;
        if (!room) return jsonResponse(200, { ok: true });
        const result = MatchAuthority.removeSpectatorFromRoom(room, {
            spectatorId: body.spectatorId,
            spectatorToken: body.spectatorToken,
            now: Date.now()
        });
        if (!result.ok) return jsonResponse(403, { ok: false, reason: result.reason });
        await this.broadcastPresence({
            type: 'spectator_leave',
            spectatorId: result.spectatorId,
            spectatorName: result.spectatorName,
            rejoined: false
        });
        await this.saveRoom();
        return jsonResponse(200, MatchAuthority.buildRoomPayloadFromRoom(room, {
            ok: true,
            viewerRole: 'spectator',
            spectatorCount: result.spectatorCount,
            maxSpectators: result.maxSpectators,
            serverTime: Date.now()
        }));
    }
```

Add `removeSpectatorFromRoom` to shared authority in the same style as `addSpectatorToRoom`:

```ts
function removeSpectatorFromRoom(roomValue: MatchAuthorityRoomState | null | undefined, options?: Record<string, unknown> | null) {
    const room = (roomValue && typeof roomValue === 'object') ? roomValue : null;
    const opts = (options && typeof options === 'object') ? options : {};
    if (!room) return { ok: true, spectatorCount: 0, maxSpectators: MAX_SPECTATORS };
    const spectatorId = normalizeSpectatorId(opts.spectatorId);
    const spectatorToken = String(opts.spectatorToken || '').trim();
    const spectators = ensureSpectators(room);
    const entry = spectatorId ? spectators[spectatorId] : null;
    if (!entry || !spectatorToken || entry.token !== spectatorToken) {
        return { ok: false, reason: spectatorToken ? 'SPECTATOR_TOKEN_MISMATCH' : 'SPECTATOR_TOKEN_REQUIRED' };
    }
    const spectatorName = normalizeSpectatorName(entry.name);
    delete spectators[spectatorId];
    room.updatedAt = Number.isFinite(Number(opts.now)) ? Math.trunc(Number(opts.now)) : Date.now();
    return {
        ok: true,
        spectatorId,
        spectatorName,
        spectatorCount: getActiveSpectatorEntries(room).length,
        maxSpectators: MAX_SPECTATORS
    };
}
```

- [ ] **Step 5: Route Worker API paths**

In `workers/match-worker-api.ts`, include spectator endpoints in the room-forwarding POST group:

```ts
pathname === '/api/match/spectate'
|| pathname === '/api/match/spectator-leave'
```

In `workers/match-worker.ts` `fetch`, route:

```ts
if (request.method === 'POST' && pathname === '/api/match/spectate') {
    const parsed = parseJsonBody(await request.text());
    if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
    return this.handleSpectate(parsed || {});
}

if (request.method === 'POST' && pathname === '/api/match/spectator-leave') {
    const parsed = parseJsonBody(await request.text());
    if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
    return this.handleSpectatorLeave(parsed || {});
}
```

- [ ] **Step 6: Run Worker spectator tests**

Run:

```powershell
npx jest test/workers.match-spectator.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Run focused Worker API tests**

Run:

```powershell
npx jest test/workers.match-worker-api.test.ts test/workers.match-lobby.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit Worker spectator API**

Run:

```powershell
git status --short
git add workers/match-worker-api.ts workers/match-worker.ts workers/match-worker-types.ts utils/match-authority.ts utils/match-authority-types.ts test/workers.match-spectator.test.ts
git commit -m "Workerに観戦参加APIを追加"
```

Expected: one commit containing Worker spectator API and any shared helper additions needed by that API.

## Task 5: Align Local Match Server Spectator API

**Files:**
- Modify: `scripts/local-match-server.ts`
- Create: `test/local-match-server.spectator.test.ts`

- [ ] **Step 1: Write failing local-server tests**

Create `test/local-match-server.spectator.test.ts` with the same externally visible checks as the Worker:

```ts
const http = require('http');
const { createLocalMatchServer } = require('../scripts/local-match-server');

function requestJson(server, method, path, body) {
  const address = server.address();
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}
    }, (res) => {
      let text = '';
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, data: text ? JSON.parse(text) : null }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('local match server spectator API', () => {
  let server;

  beforeEach((done) => {
    server = createLocalMatchServer();
    server.listen(0, '127.0.0.1', done);
  });

  afterEach((done) => server.close(done));

  test('spectate returns spectator credentials and spectator-safe snapshot', async () => {
    const create = await requestJson(server, 'POST', '/api/match/create', {
      playerName: '黒',
      snapshot: {
        gameState: { board: [[0]], currentPlayer: 1 },
        cardState: { hands: { black: ['meteor_will'], white: ['guard_will'] } }
      }
    });
    expect(create.status).toBe(200);
    const roomId = create.data.roomId;

    const spectate = await requestJson(server, 'POST', '/api/match/spectate', {
      roomId,
      spectatorName: '観戦'
    });

    expect(spectate.status).toBe(200);
    expect(spectate.data).toEqual(expect.objectContaining({
      ok: true,
      viewerRole: 'spectator',
      spectatorId: expect.stringMatching(/^spec_/),
      spectatorToken: expect.any(String)
    }));
    expect(spectate.data.snapshot.cardState.hands.black).toEqual(['__hidden_hand__:black:0']);
    expect(spectate.data.snapshot.cardState.hands.white).toEqual(['__hidden_hand__:white:0']);
  });
});
```

- [ ] **Step 2: Run the failing local-server tests**

Run:

```powershell
npx jest test/local-match-server.spectator.test.ts --runInBand
```

Expected: FAIL because `/api/match/spectate` does not exist locally.

- [ ] **Step 3: Add local room initialization**

In `scripts/local-match-server.ts`, add to the local room object:

```ts
        spectators: {},
        maxSpectators: MatchAuthority.MAX_SPECTATORS || 4,
```

- [ ] **Step 4: Add local spectator handlers**

Add `handleSpectate` and `handleSpectatorLeave` using the same payload contract as Worker:

```ts
async function handleSpectate(req: any, res: any) {
    const body = await parseJsonRequest(req);
    const roomId = String(body.roomId || '').trim().toUpperCase();
    const room = rooms.get(roomId);
    if (!room) return writeJson(res, 404, { ok: false, reason: 'ROOM_NOT_FOUND' });
    if (!MatchRoomLobby.isJoinPasswordAccepted(room, body.roomPassword)) {
        return writeJson(res, 403, { ok: false, reason: 'ROOM_PASSWORD_INVALID' });
    }
    const result = MatchAuthority.addSpectatorToRoom(room, {
        spectatorName: body.spectatorName || body.playerName,
        makeSpectatorToken,
        makeSpectatorId,
        now: Date.now()
    });
    if (!result.ok) return writeJson(res, result.reason === 'SPECTATOR_FULL' ? 409 : 500, { ok: false, reason: result.reason });
    broadcastPresence(room, {
        type: 'spectator_join',
        spectatorId: result.spectatorId,
        spectatorName: result.spectatorName,
        rejoined: false
    });
    const serverTime = Date.now();
    return writeJson(res, 200, MatchAuthority.buildRoomPayloadFromRoom(room, {
        ok: true,
        viewerRole: 'spectator',
        spectatorId: result.spectatorId,
        spectatorToken: result.spectatorToken,
        spectatorName: result.spectatorName,
        spectatorCount: result.spectatorCount,
        maxSpectators: result.maxSpectators,
        stateVersion: room.stateVersion,
        snapshot: toPublicSnapshotForViewer(room, { role: 'spectator', spectatorId: result.spectatorId }),
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    }));
}
```

Add routes:

```ts
if (req.method === 'POST' && pathname === '/api/match/spectate') {
    await handleSpectate(req, res);
    return;
}

if (req.method === 'POST' && pathname === '/api/match/spectator-leave') {
    await handleSpectatorLeave(req, res);
    return;
}
```

- [ ] **Step 5: Run local-server spectator tests**

Run:

```powershell
npx jest test/local-match-server.spectator.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Run local/Worker parity checks**

Run:

```powershell
npx jest test/local-match-server.publish-contract.test.ts test/workers.match-network-parity-missing-types.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit local server spectator API**

Run:

```powershell
git status --short
git add scripts/local-match-server.ts test/local-match-server.spectator.test.ts
git commit -m "ローカル対戦サーバーに観戦APIを追加"
```

Expected: one commit containing local server spectator behavior only.

## Task 6: Convert State And Stream Delivery To Generic Viewers

**Files:**
- Modify: `workers/match-worker-types.ts`
- Modify: `workers/match-worker-stream-route-controller.ts`
- Modify: `workers/match-worker-broadcast-controller.ts`
- Modify: `workers/match-worker.ts`
- Modify: `scripts/local-match-server.ts`
- Modify: `utils/match-authority.ts`
- Modify: `utils/match-authority-types.ts`
- Modify: `test/workers.match-worker-stream-route-controller.test.ts`
- Modify: `test/workers.match-worker-broadcast-controller.test.ts`
- Modify: `test/workers.match-stream-sse.test.ts`

- [ ] **Step 1: Add failing stream/broadcast tests**

In `test/workers.match-worker-broadcast-controller.test.ts`, add:

```ts
test('snapshot broadcasts use spectator-safe payload for spectator streams', async () => {
  const sends = [];
  const streams = new Map([
    ['seat-black', { writer: {}, viewer: { role: 'seat', seatKey: 'black' } }],
    ['spec-one', { writer: {}, viewer: { role: 'spectator', spectatorId: 'spec_test0001' } }]
  ]);
  const controller = createMatchWorkerBroadcastController({
    getRoom: () => ({ roomId: 'SPC' }),
    getStreams: () => streams,
    nextSseEventId: () => 'evt_1',
    rememberBufferedSseEvent: jest.fn(),
    saveRoom: jest.fn(),
    sendSse: async (streamId, eventName, payload) => sends.push({ streamId, eventName, payload }),
    buildSnapshotPayload: (_room, _meta, viewer) => ({ viewer }),
    buildPresencePayload: () => ({ ok: true })
  });

  const prepared = controller.prepareSnapshotBroadcast({ playbackEvents: [] });
  expect(prepared.record.payloadByViewer).toEqual(expect.objectContaining({
    black: { viewer: { role: 'seat', seatKey: 'black' } },
    white: { viewer: { role: 'seat', seatKey: 'white' } },
    spectator: { viewer: { role: 'spectator' } }
  }));

  await controller.broadcastPreparedSnapshot(prepared);
  expect(sends).toContainEqual(expect.objectContaining({
    streamId: 'spec-one',
    eventName: 'snapshot',
    payload: { viewer: { role: 'spectator' } }
  }));
});
```

In `test/workers.match-worker-stream-route-controller.test.ts`, add a test that query parameters `viewerRole=spectator&spectatorId=spec_test0001&spectatorToken=token` are passed to `resolveAuthenticatedViewer` and accepted.

- [ ] **Step 2: Run failing stream/broadcast tests**

Run:

```powershell
npx jest test/workers.match-worker-broadcast-controller.test.ts test/workers.match-worker-stream-route-controller.test.ts --runInBand
```

Expected: FAIL because streams only store `seatKey`.

- [ ] **Step 3: Update stream info types**

In `workers/match-worker-types.ts`, replace:

```ts
export interface MatchWorkerSseStreamInfo {
    writer: WritableStreamDefaultWriter<Uint8Array>;
    seatKey: MatchAuthoritySeatKey;
}
```

with:

```ts
export interface MatchWorkerSseStreamInfo {
    writer: WritableStreamDefaultWriter<Uint8Array>;
    viewer: MatchAuthorityViewer;
}
```

Update prepared snapshot payload types to allow `spectator`:

```ts
export interface MatchWorkerPreparedSnapshotBroadcast {
    eventId: string;
    record: MatchAuthorityBufferedSseEventRecordInput;
    payloadByViewer: Partial<Record<MatchAuthoritySeatKey | 'spectator', unknown>>;
    fallbackPayload: unknown;
}
```

- [ ] **Step 4: Update stream route authentication**

In `workers/match-worker-stream-route-controller.ts`, replace `resolveAuthenticatedSeatKey` config with:

```ts
    resolveAuthenticatedViewer: (
        room: MatchWorkerRoomState,
        options: Record<string, unknown>
    ) => MatchAuthorityViewer | null;
```

Build auth options:

```ts
const viewer = cfg.resolveAuthenticatedViewer(room, {
    viewerRole: urlObj.searchParams.get('viewerRole') || '',
    seatKey,
    seatToken,
    spectatorId: urlObj.searchParams.get('spectatorId') || '',
    spectatorToken: urlObj.searchParams.get('spectatorToken') || '',
    now: now()
});
if (!viewer) {
    return cfg.jsonResponse(403, { ok: false, reason: cfg.classifyViewerTokenRejectionReason(urlObj.searchParams) });
}
cfg.getStreams().set(streamId, { writer, viewer });
```

Use `viewer` for replay and initial payload:

```ts
const replayEvents = cfg.getBufferedSseReplayEvents(replayBuffer, lastEventId, viewer);
const initialPayload = cfg.buildSnapshotPayload(room, { playbackEvents: [] }, viewer);
```

- [ ] **Step 5: Update broadcast payload selection**

In `workers/match-worker-broadcast-controller.ts`, build three payloads:

```ts
const payloadByViewer = {
    black: cfg.buildSnapshotPayload(room, meta, { role: 'seat', seatKey: 'black' }),
    white: cfg.buildSnapshotPayload(room, meta, { role: 'seat', seatKey: 'white' }),
    spectator: cfg.buildSnapshotPayload(room, meta, { role: 'spectator' })
};
```

Choose payload:

```ts
const viewer = streamInfo && streamInfo.viewer ? streamInfo.viewer : null;
const payloadKey = viewer && viewer.role === 'seat' ? viewer.seatKey : 'spectator';
const payload = preparedSnapshot.payloadByViewer[payloadKey] || preparedSnapshot.fallbackPayload;
```

- [ ] **Step 6: Update shared SSE replay helpers**

In `utils/match-authority.ts`, change replay lookup to accept `MatchAuthorityViewer` as well as old seat keys:

```ts
function getPayloadKeyForViewer(viewerValue: unknown): 'black' | 'white' | 'spectator' {
    const viewer = normalizeViewerIdentity(viewerValue);
    if (viewer && viewer.role === 'seat') return viewer.seatKey;
    return 'spectator';
}
```

Use this helper in `getBufferedSseReplayEvents` and `getBufferedSnapshotPayloadForStateVersion`.

- [ ] **Step 7: Update Worker state route**

In `workers/match-worker.ts` `handleState`, resolve generic viewer:

```ts
const viewer = resolveAuthenticatedViewer(room, {
    viewerRole: urlObj.searchParams.get('viewerRole') || '',
    seatKey,
    seatToken,
    spectatorId: urlObj.searchParams.get('spectatorId') || '',
    spectatorToken: urlObj.searchParams.get('spectatorToken') || '',
    now: Date.now()
});
if (!viewer) {
    return jsonResponse(403, { ok: false, reason: classifyViewerTokenRejectionReason(urlObj.searchParams) });
}
```

Use:

```ts
const recoveredPayload = MatchAuthority.getBufferedSnapshotPayloadForStateVersion(room.sseEventBuffer, room.stateVersion, viewer);
snapshot: toPublicSnapshotForViewer(room, viewer),
viewerRole: viewer.role,
```

- [ ] **Step 8: Update local stream/state route the same way**

In `scripts/local-match-server.ts`, mirror the Worker changes exactly:

```ts
const viewer = resolveAuthenticatedViewer(room, {
    viewerRole: urlObj.searchParams.get('viewerRole') || '',
    seatKey,
    seatToken,
    spectatorId: urlObj.searchParams.get('spectatorId') || '',
    spectatorToken: urlObj.searchParams.get('spectatorToken') || '',
    now: Date.now()
});
```

Store streams as `{ res, viewer }` and use `getPayloadKeyForViewer`.

- [ ] **Step 9: Run stream and SSE tests**

Run:

```powershell
npx jest test/workers.match-worker-broadcast-controller.test.ts test/workers.match-worker-stream-route-controller.test.ts test/workers.match-stream-sse.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 10: Run network parity**

Run:

```powershell
npm run test:network:parity
```

Expected: PASS.

- [ ] **Step 11: Commit generic viewer stream support**

Run:

```powershell
git status --short
git add workers/match-worker-types.ts workers/match-worker-stream-route-controller.ts workers/match-worker-broadcast-controller.ts workers/match-worker.ts scripts/local-match-server.ts utils/match-authority.ts utils/match-authority-types.ts test/workers.match-worker-stream-route-controller.test.ts test/workers.match-worker-broadcast-controller.test.ts test/workers.match-stream-sse.test.ts
git commit -m "観戦者向けSSE投影を追加"
```

Expected: one commit containing generic viewer state/stream support.

## Task 7: Add Browser Spectator Session Lifecycle

**Files:**
- Modify: `shared/match-entry-payload.ts`
- Modify: `ui/network-client.ts`
- Modify: `ui/network/session-lifecycle.ts`
- Modify: `ui/network/session-seat.ts`
- Modify: `ui/network/stream-session.ts`
- Modify: `ui/network/snapshot-canonical.ts`
- Modify: `test/shared.match-entry-payload.test.ts`
- Modify: `test/ui.network-stream-session.test.ts`
- Modify: `test/ui.network-session-lifecycle.test.ts`
- Create: `test/ui.network-client.spectator.test.ts`

- [ ] **Step 1: Add failing entry payload tests**

Append to `test/shared.match-entry-payload.test.ts`:

```ts
test('buildSpectateRoomPayload builds spectator entry payload', () => {
  const result = MatchEntryPayload.buildSpectateRoomPayload('abc', {
    playerName: ' 観戦者 ',
    roomPassword: ' pass '
  }, {
    normalizePlayerName: (value) => String(value || '').trim(),
    normalizeRoomId: (value) => String(value || '').trim().toUpperCase()
  });

  expect(result).toEqual(expect.objectContaining({
    ok: true,
    roomId: 'ABC',
    playerName: '観戦者'
  }));
  expect(result.payload).toEqual({
    roomId: 'ABC',
    spectatorName: '観戦者',
    roomPassword: 'pass'
  });
});
```

- [ ] **Step 2: Implement spectator payload builder**

In `shared/match-entry-payload.ts`, add:

```ts
function buildSpectateRoomPayload(
  roomId: unknown,
  options?: MatchEntryPayloadOptions,
  helpers?: MatchEntryPayloadHelpers
): MatchEntryPayloadResult {
  const opts = (options && typeof options === 'object') ? options : {};
  const h = resolveHelpers(helpers);
  const playerName = normalizePlayerName(opts.playerName, h);
  if (!playerName) return { ok: false, reason: 'PLAYER_NAME_REQUIRED' };
  const normalizedRoomId = normalizeRoomId(roomId, h);
  if (!normalizedRoomId) return { ok: false, reason: 'ROOM_ID_REQUIRED', playerName };
  if (!testRoomIdPattern(getRoomIdPattern(h), normalizedRoomId)) {
    return { ok: false, reason: 'ROOM_ID_INVALID', roomId: normalizedRoomId, playerName };
  }
  const payload: Record<string, unknown> = {
    roomId: normalizedRoomId,
    spectatorName: playerName
  };
  const roomPassword = normalizeRoomPassword(opts.roomPassword);
  if (roomPassword) payload.roomPassword = roomPassword;
  return { ok: true, payload, roomId: normalizedRoomId, playerName };
}
```

Export it from `MatchEntryPayload`.

- [ ] **Step 3: Add failing stream URL tests**

In `test/ui.network-stream-session.test.ts`, add:

```ts
test('buildStreamUrl uses spectator credentials for spectator sessions', () => {
  const state = {
    active: true,
    serverUrl: 'https://example.test',
    roomId: 'SPC',
    viewerRole: 'spectator',
    spectatorId: 'spec_12345678',
    spectatorToken: 'spec-token',
    seatKey: 'black',
    seatToken: ''
  };
  const controller = NetworkStreamSession.createNetworkStreamSessionController({
    getState: () => state
  });

  expect(controller.buildStreamUrl()).toBe(
    'https://example.test/api/match/stream?roomId=SPC&viewerRole=spectator&spectatorId=spec_12345678&spectatorToken=spec-token'
  );
});
```

- [ ] **Step 4: Update stream URL builder**

In `ui/network/stream-session.ts`, update `buildStreamUrl`:

```ts
if (String(state.viewerRole || '') === 'spectator') {
  return withTrailingSlashRemoved(state.serverUrl)
    + '/api/match/stream?roomId=' + encodeURIComponent(state.roomId)
    + '&viewerRole=spectator'
    + '&spectatorId=' + encodeURIComponent(state.spectatorId || '')
    + '&spectatorToken=' + encodeURIComponent(state.spectatorToken || '')
    + resumeQuery;
}
```

Keep the existing seat URL path unchanged.

- [ ] **Step 5: Add failing lifecycle tests**

In `test/ui.network-session-lifecycle.test.ts`, add:

```ts
test('spectateRoom activates read-only spectator session and opens stream', async () => {
  const requests = [];
  const state = { active: false, roomId: '', serverUrl: 'https://server.test' };
  const controller = createNetworkSessionLifecycleController({
    getState: () => state,
    normalizePlayerName: (value) => String(value || '').trim(),
    normalizeRoomId: (value) => String(value || '').trim().toUpperCase(),
    requestJson: async (method, path, payload) => {
      requests.push({ method, path, payload });
      return {
        ok: true,
        data: {
          ok: true,
          roomId: 'SPC',
          viewerRole: 'spectator',
          spectatorId: 'spec_12345678',
          spectatorToken: 'token',
          spectatorName: payload.spectatorName,
          stateVersion: 2,
          snapshot: { _meta: { authority: 'server', viewerRole: 'spectator' } }
        }
      };
    },
    activateSpectatorSessionFromResponse: (payload) => Object.assign(state, {
      active: true,
      roomId: payload.roomId,
      viewerRole: payload.viewerRole,
      spectatorId: payload.spectatorId,
      spectatorToken: payload.spectatorToken
    }),
    openStream: jest.fn(),
    emitStatus: jest.fn()
  });

  await expect(controller.spectateRoom('spc', { playerName: '観戦' })).resolves.toEqual(expect.objectContaining({
    ok: true,
    roomId: 'SPC',
    viewerRole: 'spectator'
  }));
  expect(requests).toEqual([{
    method: 'POST',
    path: '/api/match/spectate',
    payload: { roomId: 'SPC', spectatorName: '観戦' }
  }]);
});
```

- [ ] **Step 6: Implement lifecycle spectator flow**

In `ui/network/session-lifecycle.ts`, add `spectateRoom`:

```ts
async function spectateRoom(roomId: any, options?: any): Promise<any> {
  const opts = (options && typeof options === 'object') ? options : {};
  if (opts.serverUrl && typeof cfg.setServerUrl === 'function') cfg.setServerUrl(opts.serverUrl);
  const entryPayload = MatchEntryPayload.buildSpectateRoomPayload(roomId, opts, createEntryPayloadHelpers());
  if (!entryPayload.ok) return emitEntryPayloadFailure(entryPayload.reason);

  const res = await cfg.requestJson('POST', '/api/match/spectate', entryPayload.payload);
  if (!res.ok || !res.data || res.data.ok !== true) {
    return handleRoomEntryFailure(res, {
      fallbackReason: 'SPECTATE_FAILED',
      fallbackMessage: '観戦参加に失敗しました'
    });
  }

  if (typeof cfg.activateSpectatorSessionFromResponse === 'function') {
    cfg.activateSpectatorSessionFromResponse(Object.assign({}, res.data, { playerName: entryPayload.playerName }), entryPayload.roomId);
  }
  if (typeof cfg.resetNetworkTelemetry === 'function') cfg.resetNetworkTelemetry();
  openStream();
  if (typeof cfg.emitStatus === 'function') cfg.emitStatus('ネット対戦: 観戦を開始しました');
  return {
    ok: true,
    roomId: res.data.roomId || entryPayload.roomId,
    viewerRole: 'spectator',
    spectatorId: res.data.spectatorId,
    spectatorName: entryPayload.playerName
  };
}
```

Return it from the controller.

- [ ] **Step 7: Add spectator state activation**

In `ui/network-client.ts`, add initial state fields:

```ts
        viewerRole: 'seat',
        spectatorId: '',
        spectatorToken: '',
        spectatorName: '',
```

In `ui/network/session-seat.ts`, add `activateSpectatorSessionFromResponse`:

```ts
function activateSpectatorSessionFromResponse(data: any, fallbackRoomId: any): void {
  const payload = data || {};
  const state = resolveState();
  if (typeof cfg.prepareSessionActivation === 'function') cfg.prepareSessionActivation(payload);
  state.active = true;
  state.viewerRole = 'spectator';
  state.roomId = String(payload.roomId || fallbackRoomId || '').trim().toUpperCase();
  state.spectatorId = String(payload.spectatorId || '').trim();
  state.spectatorToken = String(payload.spectatorToken || '').trim();
  state.spectatorName = normalizePlayerName(payload.spectatorName || payload.playerName);
  state.seatKey = 'black';
  state.seatToken = '';
  state.stateVersion = Number.isFinite(Number(payload.stateVersion)) ? Number(payload.stateVersion) : null;
  resetResultPresentationState(state);
  state.chatHistory = [];
  updateRoomSeatsFromPayload(payload);
  if (typeof cfg.updateTurnTimerFromPayload === 'function') cfg.updateTurnTimerFromPayload(payload);
  setSeatGlobals('black');
  if (payload.snapshot && typeof cfg.applySnapshot === 'function') {
    cfg.applySnapshot(payload.snapshot, { force: true, viewerRole: 'spectator' });
  }
  emitRoomStateChanged();
}
```

Do not call `ensureActionBridge()` and do not write a seat claim for spectators.

- [ ] **Step 8: Add read-only network client guards**

In `ui/network-client.ts`, add:

```ts
function isSpectator() {
    return state.viewerRole === 'spectator';
}
```

Before publish:

```ts
if (isSpectator()) {
    emitStatus('観戦中は操作できません', true);
    return Promise.resolve({ ok: false, reason: 'SPECTATOR_READ_ONLY' });
}
```

Before chat send:

```ts
if (isSpectator()) {
    emitStatus('観戦中はチャット送信できません', true);
    return { ok: false, reason: 'SPECTATOR_READ_ONLY' };
}
```

Before hand-skin update:

```ts
if (isSpectator()) {
    return { ok: false, reason: 'SPECTATOR_READ_ONLY' };
}
```

Export `isSpectator` and `spectateRoom` from the API object.

- [ ] **Step 9: Update state sync path**

In `ui/network/session-lifecycle.ts` `syncLatestState`, choose query params:

```ts
const path = state.viewerRole === 'spectator'
  ? '/api/match/state?roomId=' + encodeURIComponent(state.roomId)
    + '&viewerRole=spectator'
    + '&spectatorId=' + encodeURIComponent(state.spectatorId || '')
    + '&spectatorToken=' + encodeURIComponent(state.spectatorToken || '')
  : '/api/match/state?roomId=' + encodeURIComponent(state.roomId)
    + '&seatKey=' + encodeURIComponent(state.seatKey)
    + '&seatToken=' + encodeURIComponent(state.seatToken || '');
```

- [ ] **Step 10: Update snapshot inspection for spectators**

In `ui/network/snapshot-canonical.ts`, read `viewerRole` from `_meta`:

```ts
viewerRole: String(meta.viewerRole || '').trim() === 'spectator' ? 'spectator' : 'seat',
```

In `inspectAuthoritativeSnapshot`, skip `projection_mismatch` and `own_hand_hidden` checks when `opts.viewerRole === 'spectator'`.

- [ ] **Step 11: Run browser network tests**

Run:

```powershell
npx jest test/shared.match-entry-payload.test.ts test/ui.network-stream-session.test.ts test/ui.network-session-lifecycle.test.ts test/ui.network-client.spectator.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 12: Commit browser spectator lifecycle**

Run:

```powershell
git status --short
git add shared/match-entry-payload.ts ui/network-client.ts ui/network/session-lifecycle.ts ui/network/session-seat.ts ui/network/stream-session.ts ui/network/snapshot-canonical.ts test/shared.match-entry-payload.test.ts test/ui.network-stream-session.test.ts test/ui.network-session-lifecycle.test.ts test/ui.network-client.spectator.test.ts
git commit -m "ブラウザに観戦セッションを追加"
```

Expected: one commit containing browser lifecycle support.

## Task 8: Add Spectator Controls To Network UI

**Files:**
- Modify: `index.html`
- Modify: `ui/handlers/match-mode.ts`
- Modify: `test/ui.match-mode.network-button.test.ts`

- [ ] **Step 1: Add failing UI test for room-list spectate action**

In `test/ui.match-mode.network-button.test.ts`, add a test that renders a room entry with `canSpectate: true`, clicks `観戦`, and expects `NetworkMatchClient.spectateRoom(roomId, options)` to be called.

Use this room payload:

```ts
const rooms = [{
  roomId: 'SPC',
  roomName: '観戦部屋',
  hostName: '黒',
  seatCount: 2,
  maxSeats: 2,
  spectatorCount: 1,
  maxSpectators: 4,
  canJoin: false,
  canSpectate: true,
  hasPassword: false,
  boardLabel: '8x8'
}];
```

Expected button text:

```ts
expect(screen.getByRole('button', { name: /観戦部屋を観戦/ })).toBeTruthy();
```

- [ ] **Step 2: Run the failing UI test**

Run:

```powershell
npx jest test/ui.match-mode.network-button.test.ts --runInBand
```

Expected: FAIL because no spectate button exists.

- [ ] **Step 3: Render spectator metadata in room list**

In `ui/handlers/match-mode.ts`, add spectator count to room metadata:

```ts
const spectatorCount = Number.isFinite(Number(entry.spectatorCount)) ? Number(entry.spectatorCount) : 0;
const maxSpectators = Number.isFinite(Number(entry.maxSpectators)) ? Number(entry.maxSpectators) : 4;
const spectatorEl = document.createElement('span');
spectatorEl.textContent = `観戦 ${spectatorCount}/${maxSpectators}`;
meta.appendChild(spectatorEl);
```

Disable join when `entry.canJoin === false`:

```ts
joinButton.disabled = entry.canJoin === false;
```

Add a spectate button:

```ts
const spectateButton = document.createElement('button');
spectateButton.type = 'button';
spectateButton.className = 'btn-small network-room-entry-spectate';
spectateButton.textContent = '観戦';
spectateButton.disabled = entry.canSpectate === false;
spectateButton.setAttribute(
    'aria-label',
    `${roomName}を観戦。観戦 ${spectatorCount}/${maxSpectators}${entry.hasPassword === true ? '、パスワードあり' : ''}`
);
spectateButton.addEventListener('click', () => {
    spectateRoomFromList(roomId, roomName, entry.hasPassword === true);
});
item.appendChild(spectateButton);
```

- [ ] **Step 4: Add spectate action handler**

In `ui/handlers/match-mode.ts`, add:

```ts
async function spectateRoomFromList(roomId: string, roomName: string, hasPassword: boolean) {
    selectedNetworkRoomId = roomId;
    if (uiRefs.networkRoomInput) uiRefs.networkRoomInput.value = roomName || '無名部屋';
    if (hasPassword && !readNetworkRoomPassword()) {
        writeNetworkStatus('パスワードを入力してください', true);
        if (uiRefs.networkRoomPasswordInput && typeof uiRefs.networkRoomPasswordInput.focus === 'function') {
            uiRefs.networkRoomPasswordInput.focus();
        }
        return;
    }
    if (!root.NetworkMatchClient || typeof root.NetworkMatchClient.spectateRoom !== 'function') {
        writeNetworkStatus('観戦機能を利用できません', true);
        return;
    }
    const roomPassword = readNetworkRoomPassword();
    const result = await root.NetworkMatchClient.spectateRoom(roomId, {
        playerName: readNetworkPlayerName(),
        roomPassword,
        serverUrl: uiRefs.networkServerInput ? uiRefs.networkServerInput.value.trim() : ''
    });
    if (result && result.ok) {
        setNetworkOverlayVisible(false);
        writeNetworkStatus('観戦中', false);
    }
}
```

- [ ] **Step 5: Add read-only UI state**

In the room state listener, read `isSpectator`:

```ts
const spectatorActive = root.NetworkMatchClient
    && typeof root.NetworkMatchClient.isSpectator === 'function'
    && root.NetworkMatchClient.isSpectator();
```

Use `spectatorActive` to:

```ts
if (uiRefs.networkStatus) {
    writeNetworkStatus(spectatorActive ? '観戦中' : '', false);
}
```

Disable network-only action buttons that this handler owns. Do not add a second board writer and do not alter gameplay state.

- [ ] **Step 6: Add direct spectate button if needed**

If the modal has a direct room-code join button but no list selection for full rooms, add a direct `観戦` button in `index.html` next to the existing join/create actions:

```html
<button id="networkSpectateBtn" class="btn-small" type="button">観戦</button>
```

Wire it in `ui/handlers/match-mode.ts` to call `spectateRoomFromList(selectedNetworkRoomId || readNetworkRoomCode(), readNetworkRoomName(), !!readNetworkRoomPassword())`.

- [ ] **Step 7: Run UI tests**

Run:

```powershell
npx jest test/ui.match-mode.network-button.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit UI spectator controls**

Run:

```powershell
git status --short
git add index.html ui/handlers/match-mode.ts test/ui.match-mode.network-button.test.ts
git commit -m "ネット対戦UIに観戦操作を追加"
```

Expected: one commit containing UI controls only.

## Task 9: Harden Hidden Information And Read-Only Authority

**Files:**
- Modify: `test/workers.match-condemn-visibility.test.ts`
- Modify: `test/workers.match-reveal-hand-visibility.test.ts`
- Modify: `test/workers.match-trap-visibility.test.ts`
- Modify if tests fail: `utils/match-authority.ts`
- Modify if tests fail: `workers/match-worker-publish-controller.ts`
- Modify if tests fail: `scripts/local-match-server.ts`

- [ ] **Step 1: Add spectator hidden-information assertions**

For each existing visibility suite, add a spectator projection assertion with this pattern:

```ts
const spectatorSnapshot = MatchAuthority.buildPublicSnapshotForViewer(room, {
  role: 'spectator',
  spectatorId: 'spec_visibility'
});
expect(spectatorSnapshot.cardState.hands.black.every((cardId) => String(cardId).startsWith('__hidden_hand__:black:'))).toBe(true);
expect(spectatorSnapshot.cardState.hands.white.every((cardId) => String(cardId).startsWith('__hidden_hand__:white:'))).toBe(true);
```

For trap visibility, assert spectator projection does not expose owner-only trap details already hidden from the opposing seat.

- [ ] **Step 2: Add spectator publish rejection assertion**

In `test/workers.match-spectator.test.ts`, add:

```ts
expect(await publishAsSpectator()).toEqual(expect.objectContaining({
  status: 403,
  reason: expect.stringMatching(/TOKEN|READ_ONLY|SEAT/)
}));
```

Use the actual helper style from the file after Task 4.

- [ ] **Step 3: Run hidden-information tests**

Run:

```powershell
npx jest test/workers.match-condemn-visibility.test.ts test/workers.match-reveal-hand-visibility.test.ts test/workers.match-trap-visibility.test.ts test/workers.match-spectator.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 4: Commit hardening tests**

Run:

```powershell
git status --short
git add test/workers.match-condemn-visibility.test.ts test/workers.match-reveal-hand-visibility.test.ts test/workers.match-trap-visibility.test.ts test/workers.match-spectator.test.ts utils/match-authority.ts workers/match-worker-publish-controller.ts scripts/local-match-server.ts
git commit -m "観戦者への非公開情報漏えいを防止"
```

Expected: one commit. If only tests changed, commit only tests.

## Task 10: Full Verification And Worker Mirror Sync

**Files:**
- Generated by command: `worker-public/*`
- Generated by command if module registry changes: `public/module-registry.js`

- [ ] **Step 1: Run focused network tests**

Run:

```powershell
npx jest test/utils.match-authority.spectator.test.ts test/shared.match-room-lobby.test.ts test/workers.match-spectator.test.ts test/local-match-server.spectator.test.ts test/ui.network-client.spectator.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run network parity**

Run:

```powershell
npm run test:network:parity
```

Expected: PASS.

- [ ] **Step 3: Run type/build checks**

Run:

```powershell
npm run typecheck
npm run build:ts
```

Expected: both commands exit 0.

- [ ] **Step 4: Prepare worker assets**

Run:

```powershell
npm run worker:prepare
```

Expected: command exits 0 and updates only generated mirror/build assets expected from source changes.

- [ ] **Step 5: Run final broad check**

Run:

```powershell
npm run checkall
```

Expected: PASS.

- [ ] **Step 6: Inspect final diff**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only intended source, tests, docs, generated registry, and worker-public mirror files are dirty.

- [ ] **Step 7: Commit generated sync and final verification**

Run:

```powershell
git add worker-public public/module-registry.js
git commit -m "観戦機能のWorker配信資産を同期"
```

Expected: commit succeeds if generated files changed. If no generated files changed, skip this commit and record that `npm run worker:prepare` produced no diff.

## Self-Review

- Spec coverage:
  - Maximum four spectators: Task 2, Task 4, Task 5.
  - Spectator-safe hidden-information projection: Task 2, Task 6, Task 9.
  - Worker/local parity: Task 5, Task 6, Task 10.
  - Browser read-only session: Task 7, Task 8.
  - Room-list discoverability for full rooms: Task 3, Task 8.
  - Source-of-truth docs before implementation: Task 1.
- Placeholder scan:
  - The plan contains no unresolved placeholder sections.
  - Every code-changing task has concrete file paths, snippets, commands, and expected outcomes.
- Type consistency:
  - `viewerRole`, `spectatorId`, `spectatorToken`, `spectatorName`, `spectatorCount`, and `maxSpectators` are used consistently across API payloads, browser session state, and tests.
  - `MatchAuthorityViewer` is the shared identity used by state, stream, replay, and projection.

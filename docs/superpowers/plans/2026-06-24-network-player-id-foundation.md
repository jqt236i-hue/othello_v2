# Network Player ID Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every browser user a stable local `playerId` and carry that identifier through network room create/join/state payloads so future rating and auto-matchmaking can identify black/white participants without adding login.

**Architecture:** Add a pure shared `playerId` contract, extract the existing leaderboard local identity code into a UI identity module, and inject that identity into network room entry payloads. Store normalized black/white IDs in the Worker and local match server room authority state, then project them through explicit public payload fields without making `playerId` an authentication secret.

**Tech Stack:** TypeScript, CommonJS compatibility wrappers, Jest, existing `ui/network/session-lifecycle.ts`, `shared/match-entry-payload.ts`, `utils/match-authority.ts`, `workers/match-worker.ts`, `scripts/local-match-server.ts`, generated `public/module-registry.js`, and `worker-public/` mirror via existing scripts.

---

## Document Role

This is an implementation plan, design note, and execution runbook for the first `playerId` foundation pass.

Source-of-truth documents and files:

- Gameplay and visible network behavior: `01-rulebook.md`
- Internal architecture and authority contracts: `docs/architecture-contracts.md`
- Network entry payload source: `shared/match-entry-payload.ts`
- Browser network lifecycle source: `ui/network/session-lifecycle.ts`
- Server-authoritative room source: `workers/match-worker.ts`
- Local parity server source: `scripts/local-match-server.ts`
- Generated or mirrored surfaces: `public/module-registry.js`, `dist/`, and `worker-public/`

Non-goals:

- No login, OAuth, email verification, account linking, password, or token-auth change.
- No rating calculation, Elo/Glicko store, season table, match history, or matchmaking queue.
- No gameplay rule, card, deck, board, turn timer, spectator, chat, or playback behavior change.
- No use of `playerId` as seat authentication. `seatToken` remains the room authority credential.
- No source edits in `dist/`, `public/module-registry.js`, or `worker-public/` before root sources are changed and generation scripts are run.

## Current Evidence

- `ui/leaderboard-client.ts` already has local identity behavior:
  - `PLAYER_ID_STORAGE_KEY = 'shared_leaderboard_player_id_v1'`
  - `PLAYER_ID_RE = /^[A-Za-z0-9_-]{8,80}$/`
  - `getPlayerId()` generates and persists a browser-local ID.
- `workers/match-worker-leaderboard.ts` already validates leaderboard `playerId` with `LEADERBOARD_PLAYER_ID_RE = /^[A-Za-z0-9_-]{8,80}$/`.
- `ui/network/session-lifecycle.ts` builds create/join payloads through `shared/match-entry-payload.ts`, so adding one helper field there covers room create and join without spreading localStorage reads through network code.
- `workers/match-worker.ts` and `scripts/local-match-server.ts` both own create/join room authority paths; they must stay aligned.
- `utils/match-authority.ts` does not automatically project unknown payload fields, so `playerId` and `seatPlayerIds` must be explicit payload fields.

## Behavior Contract

- A browser has one stable local `playerId`.
- `playerId` uses the existing leaderboard storage key `shared_leaderboard_player_id_v1` to avoid splitting identity between leaderboard and network play.
- Valid `playerId` format is `^[A-Za-z0-9_-]{8,80}$`.
- Room create and join send `playerId` when browser storage or fallback generation can provide one.
- Missing `playerId` from older clients remains accepted and is stored as an empty string.
- Non-empty invalid `playerId` is rejected by Worker and local server with `PLAYER_ID_INVALID`.
- `seatToken` continues to decide whether a seat is authenticated. `playerId` is metadata.
- On authenticated rejoin:
  - if the room already has a stored ID for that seat, keep the stored ID;
  - if the room has no stored ID for that seat and the request has a valid ID, store it;
  - return the stored seat ID in response payloads.
- Public payloads may include:

```ts
{
  playerId: string | null;
  seatPlayerIds: {
    black: string;
    white: string;
  };
}
```

- Lobby room list must not add `playerId`; list rows remain display-oriented.
- Spectators do not get a `playerId` assignment in this pass.

## File Structure

Create:

- `shared/player-id.ts`: Pure browser/worker/headless-safe `playerId` regex and normalization helpers.
- `shared/player-id.js`: CommonJS compatibility wrapper.
- `ui/player-identity.ts`: Browser localStorage identity module shared by leaderboard and network lifecycle.
- `ui/player-identity.js`: CommonJS compatibility wrapper.
- `test/shared.player-id.test.ts`: Focused shared contract tests.
- `test/ui.player-identity.test.ts`: Focused browser-local identity tests.
- `test/workers.match-player-id.test.ts`: Worker public API create/join/state playerId tests.

Modify:

- `ui/leaderboard-client.ts`: Replace duplicate local identity functions with `ui/player-identity.ts` while preserving public `LeaderboardClient.getPlayerId()`, `getPlayerName()`, and `setPlayerName()`.
- `test/ui.leaderboard-client.test.ts`: Verify existing storage key and submit payload behavior still use the same ID.
- `shared/match-entry-payload.ts`: Add `readPlayerId` helper and carry `playerId` through create/join/retry payloads.
- `test/shared.match-entry-payload.test.ts`: Pin create/join/retry payload shape with `playerId`.
- `ui/network-client.ts`: Resolve `ui/player-identity` and inject `readPlayerId` into the session lifecycle controller. Add readable state getters for `playerId` and `seatPlayerIds`.
- `ui/network/session-lifecycle.ts`: Add `readPlayerId` to entry payload helper config.
- `ui/network/session-seat.ts`: Store `playerId` / `seatPlayerIds` from payload into client state.
- `test/ui.network-session-lifecycle.test.ts`: Verify create/join requests include `playerId`.
- `utils/match-authority-types.ts`: Add `MatchAuthoritySeatPlayerIds`, room state, room payload option, and room payload fields.
- `utils/match-authority.ts`: Normalize/project `playerId` and `seatPlayerIds` explicitly.
- `test/utils.match-authority.publish-response.test.ts` or a new focused `test/utils.match-authority.player-id.test.ts`: Verify payload builder projection.
- `workers/match-worker-types.ts`: Add `seatPlayerIds` typing to room state if not inherited clearly enough.
- `workers/match-worker.ts`: Store and project black/white player IDs.
- `scripts/local-match-server.ts`: Mirror Worker create/join/state behavior.
- `test/local-match-server.publish-contract.test.ts` or new `test/local-match-server.player-id.test.ts`: Verify local server parity.
- Generated after root changes: `public/module-registry.js`
- Generated after root changes and mirror preparation: `worker-public/**`

## Task 0: Preflight And Dirty Tree Isolation

**Files:**

- Read: `AGENTS.md`
- Read: `docs/AGENTS.md`
- Read: `shared/AGENTS.md`
- Read: `ui/AGENTS.md`
- Read: `ui/network/AGENTS.md`
- Read: `workers/AGENTS.md`
- Read: `test/AGENTS.md`

- [ ] **Step 1: Inspect working tree**

Run:

```powershell
git status --short
```

Expected: existing unrelated dirty files may be present. Do not stage, commit, revert, delete, or overwrite them.

- [ ] **Step 2: Confirm current source/mirror status before editing**

Run:

```powershell
git status --short shared ui utils workers scripts test public worker-public
```

Expected: identify any pre-existing changes in target files. If a target file already has unrelated dirty changes, inspect it with:

```powershell
git diff -- <path>
```

Continue only when the new changes can be separated by exact paths and hunks. If separation is not clear, report the conflicting paths and stop.

- [ ] **Step 3: Keep implementation commits isolated**

Commit after each task using exact file paths only. Never use:

```powershell
git add -A
```

## Task 1: Add Shared Player ID Contract

**Files:**

- Create: `shared/player-id.ts`
- Create: `shared/player-id.js`
- Test: `test/shared.player-id.test.ts`

- [ ] **Step 1: Write failing shared contract tests**

Create `test/shared.player-id.test.ts`:

```ts
describe('shared player-id contract', () => {
  let PlayerId: any;

  beforeEach(() => {
    jest.resetModules();
    PlayerId = require('../shared/player-id');
  });

  test('normalizes valid player IDs and rejects invalid values', () => {
    expect(PlayerId.normalizePlayerId(' player_alpha_0001 ')).toBe('player_alpha_0001');
    expect(PlayerId.normalizePlayerId('ABCdef_123-xyz')).toBe('ABCdef_123-xyz');
    expect(PlayerId.normalizePlayerId('short')).toBeNull();
    expect(PlayerId.normalizePlayerId('bad id with spaces')).toBeNull();
    expect(PlayerId.normalizePlayerId('日本語ID0001')).toBeNull();
  });

  test('normalizes seat player ID maps for black and white only', () => {
    expect(PlayerId.normalizeSeatPlayerIds({
      black: ' player_black_0001 ',
      white: 'player_white_0002',
      extra: 'ignored_extra_0003'
    })).toEqual({
      black: 'player_black_0001',
      white: 'player_white_0002'
    });
  });

  test('empty and invalid seat IDs become empty strings', () => {
    expect(PlayerId.normalizeSeatPlayerIds({
      black: '',
      white: 'bad space'
    })).toEqual({
      black: '',
      white: ''
    });
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/shared.player-id.test.ts
```

Expected: FAIL because `../shared/player-id` does not exist.

- [ ] **Step 3: Add pure shared implementation**

Create `shared/player-id.ts`:

```ts
'use strict';

export type SeatPlayerIds = {
  black: string;
  white: string;
};

const PLAYER_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;

function normalizePlayerId(value: unknown): string | null {
  const normalized = String(value || '').trim();
  if (!PLAYER_ID_RE.test(normalized)) return null;
  return normalized;
}

function normalizeSeatPlayerIds(value: unknown): SeatPlayerIds {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    black: normalizePlayerId(source.black) || '',
    white: normalizePlayerId(source.white) || ''
  };
}

function isValidPlayerId(value: unknown): boolean {
  return normalizePlayerId(value) !== null;
}

const PlayerIdContract = {
  PLAYER_ID_RE,
  normalizePlayerId,
  normalizeSeatPlayerIds,
  isValidPlayerId
};

export = PlayerIdContract;
```

Create `shared/player-id.js`:

```js
'use strict';

module.exports = process.env.JEST_WORKER_ID
  ? require('./player-id.ts')
  : require('../dist/shared/player-id');
```

- [ ] **Step 4: Verify shared contract**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/shared.player-id.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit shared contract**

Run:

```powershell
git diff -- shared/player-id.ts shared/player-id.js test/shared.player-id.test.ts
git diff --check -- shared/player-id.ts shared/player-id.js test/shared.player-id.test.ts
git add -- shared/player-id.ts shared/player-id.js test/shared.player-id.test.ts
git commit -m "Add shared player id contract"
```

## Task 2: Extract Browser Local Identity Module

**Files:**

- Create: `ui/player-identity.ts`
- Create: `ui/player-identity.js`
- Modify: `ui/leaderboard-client.ts`
- Test: `test/ui.player-identity.test.ts`
- Test: `test/ui.leaderboard-client.test.ts`

- [ ] **Step 1: Write failing browser identity tests**

Create `test/ui.player-identity.test.ts`:

```ts
describe('PlayerIdentity', () => {
  let storage: Map<string, string>;
  let PlayerIdentity: any;

  beforeEach(() => {
    jest.resetModules();
    storage = new Map();
    Object.defineProperty(global, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn((key: string) => storage.has(key) ? storage.get(key) || null : null),
        setItem: jest.fn((key: string, value: string) => {
          storage.set(key, String(value));
        })
      }
    });
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: {
        getRandomValues: (array: Uint8Array) => {
          for (let index = 0; index < array.length; index += 1) array[index] = index + 1;
          return array;
        }
      }
    });
    PlayerIdentity = require('../ui/player-identity');
  });

  afterEach(() => {
    delete (global as any).localStorage;
    delete (global as any).crypto;
  });

  test('uses the existing leaderboard storage key for playerId', () => {
    storage.set('shared_leaderboard_player_id_v1', 'player_alpha_0001');

    expect(PlayerIdentity.getPlayerId()).toBe('player_alpha_0001');
  });

  test('creates and persists a valid playerId when none exists', () => {
    const created = PlayerIdentity.getPlayerId();

    expect(created).toMatch(/^[A-Za-z0-9_-]{8,80}$/);
    expect(storage.get('shared_leaderboard_player_id_v1')).toBe(created);
  });

  test('normalizes and persists player name with existing storage key', () => {
    expect(PlayerIdentity.setPlayerName('  長い名前123456789  ')).toBe('長い名前1234');
    expect(storage.get('shared_leaderboard_player_name_v1')).toBe('長い名前1234');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.player-identity.test.ts
```

Expected: FAIL because `../ui/player-identity` does not exist.

- [ ] **Step 3: Add UI identity implementation**

Create `ui/player-identity.ts`:

```ts
'use strict';

const PlayerIdContract = require('../shared/player-id');

const PLAYER_NAME_STORAGE_KEY = 'shared_leaderboard_player_name_v1';
const PLAYER_ID_STORAGE_KEY = 'shared_leaderboard_player_id_v1';
const PLAYER_NAME_MAX = 7;
const DEFAULT_PLAYER_NAME = 'ななし';

function canUseStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && !!localStorage;
  } catch (e) {
    return false;
  }
}

function normalizePlayerName(value: unknown): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  const clipped = Array.from(normalized).slice(0, PLAYER_NAME_MAX).join('');
  return clipped || DEFAULT_PLAYER_NAME;
}

function makePlayerId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes).map((one) => one.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) { /* ignore */ }

  const fallback = `p_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  return fallback.replace(/[^0-9a-zA-Z_-]/g, '');
}

function getPlayerName(): string {
  if (!canUseStorage()) return DEFAULT_PLAYER_NAME;
  try {
    const raw = localStorage.getItem(PLAYER_NAME_STORAGE_KEY);
    return normalizePlayerName(raw || DEFAULT_PLAYER_NAME);
  } catch (e) {
    return DEFAULT_PLAYER_NAME;
  }
}

function setPlayerName(value: unknown): string {
  const name = normalizePlayerName(value);
  if (!canUseStorage()) return name;
  try {
    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
  } catch (e) { /* ignore */ }
  return name;
}

function getPlayerId(): string {
  if (canUseStorage()) {
    try {
      const stored = PlayerIdContract.normalizePlayerId(localStorage.getItem(PLAYER_ID_STORAGE_KEY));
      if (stored) return stored;
    } catch (e) { /* ignore */ }
  }

  const created =
    PlayerIdContract.normalizePlayerId(makePlayerId())
    || PlayerIdContract.normalizePlayerId(`player_${Date.now()}_${Math.floor(Math.random() * 100000)}`)
    || 'player_fallback';

  if (canUseStorage()) {
    try {
      localStorage.setItem(PLAYER_ID_STORAGE_KEY, created);
    } catch (e) { /* ignore */ }
  }
  return created;
}

const PlayerIdentity = {
  PLAYER_NAME_STORAGE_KEY,
  PLAYER_ID_STORAGE_KEY,
  PLAYER_NAME_MAX,
  DEFAULT_PLAYER_NAME,
  normalizePlayerName,
  getPlayerName,
  setPlayerName,
  getPlayerId
};

try {
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).PlayerIdentity = PlayerIdentity;
  }
} catch (e) { /* ignore */ }

export = PlayerIdentity;
```

Create `ui/player-identity.js`:

```js
'use strict';

module.exports = process.env.JEST_WORKER_ID
  ? require('./player-identity.ts')
  : require('../dist/ui/player-identity');
```

- [ ] **Step 4: Refactor leaderboard client to consume PlayerIdentity**

In `ui/leaderboard-client.ts`, remove the local constants/functions for:

```ts
const PLAYER_NAME_STORAGE_KEY = 'shared_leaderboard_player_name_v1';
const PLAYER_ID_STORAGE_KEY = 'shared_leaderboard_player_id_v1';
const PLAYER_NAME_MAX = 7;
const DEFAULT_PLAYER_NAME = 'ななし';
const PLAYER_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;
function canUseStorage()
function normalizePlayerName()
function normalizePlayerId()
function makePlayerId()
function getPlayerName()
function setPlayerName()
function getPlayerId()
```

Add near the top:

```ts
const PlayerIdentity = require('./player-identity');
const PlayerIdContract = require('../shared/player-id');
const PLAYER_NAME_MAX = PlayerIdentity.PLAYER_NAME_MAX || 7;
const getPlayerName = PlayerIdentity.getPlayerName;
const setPlayerName = PlayerIdentity.setPlayerName;
const getPlayerId = PlayerIdentity.getPlayerId;
const normalizePlayerName = PlayerIdentity.normalizePlayerName;
const normalizePlayerId = PlayerIdContract.normalizePlayerId;
```

Keep the existing `LeaderboardClient` export shape:

```ts
const LeaderboardClient = {
  getPlayerName,
  setPlayerName,
  getPlayerId,
  fetchLeaderboard,
  submitScore,
  submitTimeAttack,
  submitTimeDefense,
  submitShortestTurns,
  resolveServerBaseUrl
};
```

- [ ] **Step 5: Verify identity and leaderboard tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.player-identity.test.ts test/ui.leaderboard-client.test.ts
```

Expected: PASS. Existing leaderboard tests must still see `shared_leaderboard_player_id_v1`.

- [ ] **Step 6: Commit identity extraction**

Run:

```powershell
git diff -- ui/player-identity.ts ui/player-identity.js ui/leaderboard-client.ts test/ui.player-identity.test.ts test/ui.leaderboard-client.test.ts
git diff --check -- ui/player-identity.ts ui/player-identity.js ui/leaderboard-client.ts test/ui.player-identity.test.ts test/ui.leaderboard-client.test.ts
git add -- ui/player-identity.ts ui/player-identity.js ui/leaderboard-client.ts test/ui.player-identity.test.ts test/ui.leaderboard-client.test.ts
git commit -m "Share browser player identity"
```

## Task 3: Carry Player ID Through Network Entry Payloads

**Files:**

- Modify: `shared/match-entry-payload.ts`
- Modify: `ui/network/session-lifecycle.ts`
- Modify: `ui/network-client.ts`
- Test: `test/shared.match-entry-payload.test.ts`
- Test: `test/ui.network-session-lifecycle.test.ts`

- [ ] **Step 1: Add failing entry payload expectations**

In `test/shared.match-entry-payload.test.ts`, update create payload expectations to include `playerId` when provided by helpers:

```ts
const result = MatchEntryPayload.buildCreateRoomPayload(
  {
    playerName: '  テスト  ',
    deckCode: 'BROKEN_DECK',
    roomBoardConfig: boardConfig,
    networkDebugEnabled: true
  },
  {
    normalizePlayerName: (value: any) => String(value || '').trim(),
    sanitizeDeckCode: () => ({ value: '', invalid: true }),
    cloneData,
    readSelectedHandSkinId: () => 'blue',
    readPlayerId: () => 'player_alpha_0001'
  }
);

expect(result.playerId).toBe('player_alpha_0001');
expect(result.payload).toEqual({
  playerName: 'テスト',
  playerId: 'player_alpha_0001',
  roomName: '無名部屋',
  networkDebugEnabled: true,
  roomBoardConfig: boardConfig,
  selectedHandSkinId: 'blue'
});
```

Update the join payload test to include `playerId`:

```ts
const result = MatchEntryPayload.buildJoinRoomPayload(
  'abc',
  { playerName: 'テスト', deckCode: ' D1C1:TEST ' },
  {
    normalizeRoomId: (value: any) => String(value || '').trim().toUpperCase(),
    sanitizeDeckCode: (value: any) => ({ value: String(value || '').trim(), invalid: false }),
    readSeatClaim: () => ({ seatKey: 'black', seatToken: 'stored_token' }),
    readPlayerId: () => 'player_alpha_0001'
  }
);

expect(result.payload).toEqual({
  roomId: 'ABC',
  playerName: 'テスト',
  playerId: 'player_alpha_0001',
  selectedHandSkinId: 'default',
  deckCode: 'D1C1:TEST',
  seatKey: 'black',
  seatToken: 'stored_token'
});
```

Update the retry payload test to keep `playerId`:

```ts
expect(MatchEntryPayload.buildJoinRetryPayload(join)).toEqual({
  roomId: 'ABC',
  playerName: 'テスト',
  playerId: 'player_alpha_0001',
  selectedHandSkinId: 'red',
  deckCode: 'D1C1:TEST'
});
```

- [ ] **Step 2: Add failing network lifecycle expectations**

In `test/ui.network-session-lifecycle.test.ts`, add `readPlayerId` to `mockConfig`:

```ts
readPlayerId: jest.fn(() => 'player_alpha_0001'),
```

Add to create request expectation:

```ts
expect(mockConfig.requestJson).toHaveBeenCalledWith(
  'POST',
  '/api/match/create',
  expect.objectContaining({
    playerName: 'テスト',
    playerId: 'player_alpha_0001'
  })
);
```

Add to join request expectation:

```ts
expect(mockConfig.requestJson).toHaveBeenCalledWith(
  'POST',
  '/api/match/join',
  expect.objectContaining({
    roomId: 'ABC',
    playerName: 'テスト',
    playerId: 'player_alpha_0001'
  })
);
```

- [ ] **Step 3: Run failing focused tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/shared.match-entry-payload.test.ts test/ui.network-session-lifecycle.test.ts
```

Expected: FAIL because `playerId` is not yet included.

- [ ] **Step 4: Extend match entry payload builder**

In `shared/match-entry-payload.ts`, extend interfaces:

```ts
interface MatchEntryPayloadHelpers {
  normalizePlayerName?: (value: unknown) => string;
  normalizeRoomId?: (value: unknown) => string;
  createRandomPlayerName?: () => string;
  sanitizeDeckCode?: (value: unknown) => unknown;
  cloneData?: (value: unknown) => unknown;
  readSelectedHandSkinId?: () => unknown;
  readPlayerId?: () => unknown;
  readSeatClaim?: (roomId: string) => unknown;
  roomIdPattern?: RegExp;
  defaultSelectedHandSkinId?: unknown;
}

interface MatchEntryPayloadResult {
  ok: boolean;
  reason?: string;
  payload?: Record<string, unknown>;
  playerName?: string;
  playerId?: string;
  roomId?: string;
  deckCode?: string;
  invalidDeckCode?: boolean;
  usedStoredClaim?: boolean;
}
```

Add helper:

```ts
const PlayerIdContract = require('./player-id');

function appendOptionalPlayerId(payload: Record<string, unknown>, helpers?: MatchEntryPayloadHelpers): string {
  const h = resolveHelpers(helpers);
  if (typeof h.readPlayerId !== 'function') return '';
  const playerId = PlayerIdContract.normalizePlayerId(h.readPlayerId()) || '';
  if (playerId) {
    payload.playerId = playerId;
  }
  return playerId;
}
```

Call it in `buildCreateRoomPayload()` immediately after `payload` is created:

```ts
const playerId = appendOptionalPlayerId(payload, h);
```

Return:

```ts
return {
  ok: true,
  payload,
  playerName,
  playerId,
  deckCode: deckCode.value,
  invalidDeckCode: deckCode.invalid
};
```

Call it in `buildJoinRoomPayload()` immediately after `payload` is created:

```ts
const playerId = appendOptionalPlayerId(payload, h);
```

Return:

```ts
return {
  ok: true,
  payload,
  roomId: normalizedRoomId,
  playerName,
  playerId,
  deckCode: deckCode.value,
  invalidDeckCode: deckCode.invalid,
  usedStoredClaim
};
```

Update `buildJoinRetryPayload(entry)` to keep `playerId`:

```ts
if (entry.playerId) {
  payload.playerId = entry.playerId;
}
```

- [ ] **Step 5: Inject player identity into network lifecycle**

In `ui/network/session-lifecycle.ts`, add `readPlayerId` to `createEntryPayloadHelpers()`:

```ts
function createEntryPayloadHelpers(): any {
  return {
    normalizePlayerName: cfg.normalizePlayerName,
    normalizeRoomId: cfg.normalizeRoomId,
    createRandomPlayerName: cfg.createRandomPlayerName,
    sanitizeDeckCode: cfg.sanitizeDeckCode,
    cloneData: cfg.cloneData,
    readSelectedHandSkinId: cfg.readSelectedHandSkinId,
    readPlayerId: cfg.readPlayerId,
    readSeatClaim: cfg.readSeatClaim,
    roomIdPattern: roomIdPattern,
    defaultSelectedHandSkinId: 'default'
  };
}
```

In `ui/network-client.ts`, resolve the identity module near other module constants:

```ts
const PlayerIdentityModule = resolveNetworkClientModule('./player-identity', root.PlayerIdentity || null);
```

Add helper:

```ts
function readPlayerId(): string {
  try {
    if (PlayerIdentityModule && typeof PlayerIdentityModule.getPlayerId === 'function') {
      return String(PlayerIdentityModule.getPlayerId() || '').trim();
    }
  } catch (e: any) { /* ignore */ }
  return '';
}
```

Pass it into `createNetworkSessionLifecycleController` config:

```ts
readPlayerId,
```

Expose it from `NetworkMatchClient`:

```ts
getPlayerId: readPlayerId,
```

- [ ] **Step 6: Verify payload path**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/shared.match-entry-payload.test.ts test/ui.network-session-lifecycle.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit entry payload propagation**

Run:

```powershell
git diff -- shared/match-entry-payload.ts ui/network/session-lifecycle.ts ui/network-client.ts test/shared.match-entry-payload.test.ts test/ui.network-session-lifecycle.test.ts
git diff --check -- shared/match-entry-payload.ts ui/network/session-lifecycle.ts ui/network-client.ts test/shared.match-entry-payload.test.ts test/ui.network-session-lifecycle.test.ts
git add -- shared/match-entry-payload.ts ui/network/session-lifecycle.ts ui/network-client.ts test/shared.match-entry-payload.test.ts test/ui.network-session-lifecycle.test.ts
git commit -m "Send player id with network entry"
```

## Task 4: Add Authority Payload Projection

**Files:**

- Modify: `utils/match-authority-types.ts`
- Modify: `utils/match-authority.ts`
- Test: `test/utils.match-authority.player-id.test.ts`

- [ ] **Step 1: Write failing authority projection tests**

Create `test/utils.match-authority.player-id.test.ts`:

```ts
describe('match authority playerId projection', () => {
  let MatchAuthority: any;

  beforeEach(() => {
    jest.resetModules();
    MatchAuthority = require('../utils/match-authority');
  });

  test('room payload projects own playerId and seatPlayerIds explicitly', () => {
    const payload = MatchAuthority.buildRoomPayloadFromRoom(
      {
        roomId: 'ABC',
        seats: { black: true, white: true },
        seatNames: { black: 'くろ', white: 'しろ' },
        seatPlayerIds: { black: 'player_black_0001', white: 'player_white_0002' }
      },
      {
        ok: true,
        seatKey: 'black',
        playerId: 'player_black_0001',
        seatPlayerIds: { black: 'player_black_0001', white: 'player_white_0002' }
      }
    );

    expect(payload.playerId).toBe('player_black_0001');
    expect(payload.seatPlayerIds).toEqual({
      black: 'player_black_0001',
      white: 'player_white_0002'
    });
  });

  test('invalid projected IDs become null or empty strings', () => {
    const payload = MatchAuthority.buildRoomPayload({
      ok: true,
      roomId: 'ABC',
      playerId: 'bad space',
      seatPlayerIds: { black: 'bad space', white: 'player_white_0002' }
    });

    expect(payload.playerId).toBeNull();
    expect(payload.seatPlayerIds).toEqual({
      black: '',
      white: 'player_white_0002'
    });
  });
});
```

- [ ] **Step 2: Run failing authority tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/utils.match-authority.player-id.test.ts
```

Expected: FAIL because payload fields are not projected.

- [ ] **Step 3: Extend authority types**

In `utils/match-authority-types.ts`, add:

```ts
export interface MatchAuthoritySeatPlayerIds {
    black: string;
    white: string;
}
```

Extend `MatchAuthorityRoomState`:

```ts
seatPlayerIds?: Partial<MatchAuthoritySeatPlayerIds> | null;
```

Extend `MatchAuthorityRoomPayloadOptions`:

```ts
playerId?: unknown;
seatPlayerIds?: unknown;
```

Extend `MatchAuthorityRoomPayload`:

```ts
playerId?: string | null;
seatPlayerIds?: MatchAuthoritySeatPlayerIds;
```

- [ ] **Step 4: Extend authority payload builder**

In `utils/match-authority.ts`, add a shared contract import near other module loads:

```ts
const PlayerIdContract = loadOptionalCommonJsModule<{
    normalizePlayerId?: (value: unknown) => string | null;
    normalizeSeatPlayerIds?: (value: unknown) => { black: string; white: string };
}>('../shared/player-id');
```

Add helpers:

```ts
function normalizePlayerId(value: unknown): string | null {
    if (PlayerIdContract && typeof PlayerIdContract.normalizePlayerId === 'function') {
        return PlayerIdContract.normalizePlayerId(value);
    }
    const normalized = String(value || '').trim();
    return /^[A-Za-z0-9_-]{8,80}$/.test(normalized) ? normalized : null;
}

function normalizeSeatPlayerIds(value: unknown): { black: string; white: string } {
    if (PlayerIdContract && typeof PlayerIdContract.normalizeSeatPlayerIds === 'function') {
        return PlayerIdContract.normalizeSeatPlayerIds(value);
    }
    const source = asRecord(value);
    return {
        black: normalizePlayerId(source.black) || '',
        white: normalizePlayerId(source.white) || ''
    };
}
```

In `buildRoomPayload(options)`, add explicit projection after `playerName` or before `seatToken`:

```ts
if (Object.prototype.hasOwnProperty.call(opts, 'playerId')) {
    payload.playerId = normalizePlayerId(opts.playerId);
}
if (Object.prototype.hasOwnProperty.call(opts, 'seatPlayerIds')) {
    payload.seatPlayerIds = normalizeSeatPlayerIds(opts.seatPlayerIds);
}
```

In `buildRoomPayloadFromRoom(roomValue, options)`, copy room IDs into the source when available:

```ts
if (!Object.prototype.hasOwnProperty.call(source, 'seatPlayerIds') && room.seatPlayerIds && typeof room.seatPlayerIds === 'object') {
    source.seatPlayerIds = room.seatPlayerIds;
}
```

- [ ] **Step 5: Verify authority projection**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/utils.match-authority.player-id.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit authority projection**

Run:

```powershell
git diff -- utils/match-authority-types.ts utils/match-authority.ts test/utils.match-authority.player-id.test.ts
git diff --check -- utils/match-authority-types.ts utils/match-authority.ts test/utils.match-authority.player-id.test.ts
git add -- utils/match-authority-types.ts utils/match-authority.ts test/utils.match-authority.player-id.test.ts
git commit -m "Project network player ids"
```

## Task 5: Store Player IDs In Worker And Local Server Rooms

**Files:**

- Modify: `workers/match-worker-types.ts`
- Modify: `workers/match-worker.ts`
- Modify: `scripts/local-match-server.ts`
- Test: `test/workers.match-player-id.test.ts`
- Test: `test/local-match-server.player-id.test.ts`

- [ ] **Step 1: Write failing Worker API tests**

Create `test/workers.match-player-id.test.ts` using the same Worker test harness pattern as `test/workers.match-lobby.test.ts`. The core assertion body must create and join a room:

```ts
test('create/join/state preserve black and white player IDs', async () => {
  const result = await runWorkerScenario(`
    const createResponse = await worker.fetch(new Request('https://worker/api/match/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'くろ', playerId: 'player_black_0001' })
    }));
    const createPayload = await createResponse.json();

    const joinResponse = await worker.fetch(new Request('https://worker/api/match/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: createPayload.roomId,
        playerName: 'しろ',
        playerId: 'player_white_0002'
      })
    }));
    const joinPayload = await joinResponse.json();

    const stateResponse = await worker.fetch(new Request(
      'https://worker/api/match/state?roomId=' + encodeURIComponent(createPayload.roomId)
      + '&seatKey=black&seatToken=' + encodeURIComponent(createPayload.seatToken),
      { method: 'GET' }
    ));
    const statePayload = await stateResponse.json();

    process.stdout.write(JSON.stringify({
      createStatus: createResponse.status,
      createPayload,
      joinStatus: joinResponse.status,
      joinPayload,
      stateStatus: stateResponse.status,
      statePayload
    }));
  `);

  expect(result.createStatus).toBe(200);
  expect(result.joinStatus).toBe(200);
  expect(result.stateStatus).toBe(200);
  expect(result.createPayload.playerId).toBe('player_black_0001');
  expect(result.createPayload.seatPlayerIds).toEqual({
    black: 'player_black_0001',
    white: ''
  });
  expect(result.joinPayload.playerId).toBe('player_white_0002');
  expect(result.joinPayload.seatPlayerIds).toEqual({
    black: 'player_black_0001',
    white: 'player_white_0002'
  });
  expect(result.statePayload.seatPlayerIds).toEqual({
    black: 'player_black_0001',
    white: 'player_white_0002'
  });
});
```

Add invalid input test:

```ts
test('non-empty invalid playerId is rejected', async () => {
  const result = await runWorkerScenario(`
    const response = await worker.fetch(new Request('https://worker/api/match/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: 'くろ', playerId: 'bad space' })
    }));
    const payload = await response.json();
    process.stdout.write(JSON.stringify({ status: response.status, payload }));
  `);

  expect(result.status).toBe(400);
  expect(result.payload).toEqual({ ok: false, reason: 'PLAYER_ID_INVALID' });
});
```

- [ ] **Step 2: Write failing local server parity tests**

Create `test/local-match-server.player-id.test.ts` using the request helper pattern from `test/local-match-server.publish-contract.test.ts`:

```ts
test('local match server mirrors playerId create/join/state payloads', async () => {
  const created = await requestJson(port, 'POST', '/api/match/create', {
    playerName: 'くろ',
    playerId: 'player_black_0001'
  });
  const joined = await requestJson(port, 'POST', '/api/match/join', {
    roomId: created.data.roomId,
    playerName: 'しろ',
    playerId: 'player_white_0002'
  });
  const state = await requestJson(
    port,
    'GET',
    `/api/match/state?roomId=${encodeURIComponent(created.data.roomId)}&seatKey=black&seatToken=${encodeURIComponent(created.data.seatToken)}`
  );

  expect(created.status).toBe(200);
  expect(joined.status).toBe(200);
  expect(state.status).toBe(200);
  expect(created.data.seatPlayerIds).toEqual({
    black: 'player_black_0001',
    white: ''
  });
  expect(joined.data.seatPlayerIds).toEqual({
    black: 'player_black_0001',
    white: 'player_white_0002'
  });
  expect(state.data.seatPlayerIds).toEqual({
    black: 'player_black_0001',
    white: 'player_white_0002'
  });
});
```

- [ ] **Step 3: Run failing server tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/workers.match-player-id.test.ts test/local-match-server.player-id.test.ts
```

Expected: FAIL because server rooms do not store or project `playerId`.

- [ ] **Step 4: Add shared server helpers**

In both `workers/match-worker.ts` and `scripts/local-match-server.ts`, add:

```ts
const PlayerIdContract = require('../shared/player-id');

function normalizeNetworkPlayerId(value: unknown): string {
    return PlayerIdContract.normalizePlayerId(value) || '';
}

function readOptionalNetworkPlayerId(value: unknown): { ok: true; playerId: string } | { ok: false; reason: 'PLAYER_ID_INVALID' } {
    const raw = String(value || '').trim();
    if (!raw) return { ok: true, playerId: '' };
    const playerId = normalizeNetworkPlayerId(raw);
    if (!playerId) return { ok: false, reason: 'PLAYER_ID_INVALID' };
    return { ok: true, playerId };
}

function ensureSeatPlayerIds(room: any): { black: string; white: string } {
    room.seatPlayerIds = PlayerIdContract.normalizeSeatPlayerIds(room && room.seatPlayerIds);
    return room.seatPlayerIds;
}

function assignSeatPlayerId(room: any, seatKey: unknown, playerId: unknown, options?: { preserveExisting?: boolean }): string {
    const normalizedSeatKey = normalizePlayerKey(seatKey);
    const ids = ensureSeatPlayerIds(room);
    const existing = ids[normalizedSeatKey] || '';
    if (existing && options && options.preserveExisting === true) return existing;
    const normalizedPlayerId = normalizeNetworkPlayerId(playerId);
    if (normalizedPlayerId) ids[normalizedSeatKey] = normalizedPlayerId;
    return ids[normalizedSeatKey] || '';
}

function toPublicSeatPlayerIds(room: any): { black: string; white: string } {
    return PlayerIdContract.normalizeSeatPlayerIds(room && room.seatPlayerIds);
}
```

Use the correct relative path in `workers/match-worker.ts`:

```ts
const PlayerIdContract = require('../shared/player-id');
```

Use the same relative path in `scripts/local-match-server.ts`:

```ts
const PlayerIdContract = require('../shared/player-id');
```

- [ ] **Step 5: Store IDs during room creation**

In `createRoomState()` for both Worker and local server, initialize:

```ts
seatPlayerIds: { black: '', white: '' },
```

In create handler, validate request:

```ts
const playerIdResult = readOptionalNetworkPlayerId(payload.playerId);
if (!playerIdResult.ok) {
    return jsonResponse(400, { ok: false, reason: playerIdResult.reason });
}
```

After black seat is activated:

```ts
const ownPlayerId = assignSeatPlayerId(room, 'black', playerIdResult.playerId);
```

Include in create response options:

```ts
playerId: ownPlayerId || null,
seatPlayerIds: toPublicSeatPlayerIds(room),
```

- [ ] **Step 6: Store IDs during join**

In join handler, validate:

```ts
const playerIdResult = readOptionalNetworkPlayerId(body.playerId);
if (!playerIdResult.ok) {
    return jsonResponse(400, { ok: false, reason: playerIdResult.reason });
}
```

After seat is resolved and before response payload:

```ts
const ownPlayerId = assignSeatPlayerId(room, seatKey, playerIdResult.playerId, {
    preserveExisting: !!rejoined
});
```

Include in join response options:

```ts
playerId: ownPlayerId || null,
seatPlayerIds: toPublicSeatPlayerIds(room),
```

- [ ] **Step 7: Project IDs from state, publish, presence-adjacent room payloads**

For response builders that call `MatchAuthority.buildRoomPayloadFromRoom(...)`, include:

```ts
seatPlayerIds: toPublicSeatPlayerIds(room),
```

For seat-specific create/join/state responses, include:

```ts
playerId: toPublicSeatPlayerIds(room)[seatKey] || null,
```

For publish responses built by `buildPublishPayload(...)`, include only:

```ts
seatPlayerIds: toPublicSeatPlayerIds(room),
```

Do not add `playerId` to spectator responses.

- [ ] **Step 8: Verify server storage and projection**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/workers.match-player-id.test.ts test/local-match-server.player-id.test.ts test/utils.match-authority.player-id.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit server authority storage**

Run:

```powershell
git diff -- workers/match-worker-types.ts workers/match-worker.ts scripts/local-match-server.ts test/workers.match-player-id.test.ts test/local-match-server.player-id.test.ts
git diff --check -- workers/match-worker-types.ts workers/match-worker.ts scripts/local-match-server.ts test/workers.match-player-id.test.ts test/local-match-server.player-id.test.ts
git add -- workers/match-worker-types.ts workers/match-worker.ts scripts/local-match-server.ts test/workers.match-player-id.test.ts test/local-match-server.player-id.test.ts
git commit -m "Store player ids in network rooms"
```

## Task 6: Store Player IDs In Client Session State

**Files:**

- Modify: `ui/network-client.ts`
- Modify: `ui/network/session-seat.ts`
- Test: `test/ui.network-session-lifecycle.test.ts`
- Test: `test/ui.network-client.seat-normalization.test.ts`

- [ ] **Step 1: Add failing client state expectations**

In `test/ui.network-session-lifecycle.test.ts`, update `activateSessionFromResponse` mock to capture:

```ts
stateObj.playerId = data.playerId || null;
stateObj.seatPlayerIds = data.seatPlayerIds || null;
```

Assert after create:

```ts
mockConfig.requestJson.mockResolvedValue(jsonResponse(200, {
  ok: true,
  roomId: 'ABC',
  seatKey: 'black',
  seatToken: 'token123',
  playerId: 'player_alpha_0001',
  seatPlayerIds: { black: 'player_alpha_0001', white: '' }
}));

const result = await controller.createRoom({ playerName: 'テスト' });

expect(result.ok).toBe(true);
expect(stateObj.playerId).toBe('player_alpha_0001');
expect(stateObj.seatPlayerIds).toEqual({ black: 'player_alpha_0001', white: '' });
```

- [ ] **Step 2: Run failing client state tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.network-session-lifecycle.test.ts test/ui.network-client.seat-normalization.test.ts
```

Expected: FAIL where state does not retain player IDs.

- [ ] **Step 3: Add client normalization helpers**

In `ui/network/session-seat.ts`, add:

```ts
const PlayerIdContract = require('../../shared/player-id');

function normalizePlayerId(value: any): string | null {
  return PlayerIdContract.normalizePlayerId(value);
}

function normalizeSeatPlayerIds(value: any): { black: string; white: string } {
  return PlayerIdContract.normalizeSeatPlayerIds(value);
}
```

In `activateSessionFromResponse(data, fallbackRoomId)`, after `state.seatHandSkins`:

```ts
state.playerId = normalizePlayerId(payload.playerId);
state.seatPlayerIds = normalizeSeatPlayerIds(payload.seatPlayerIds);
```

In `activateSpectatorSessionFromResponse`, set:

```ts
state.playerId = null;
state.seatPlayerIds = normalizeSeatPlayerIds(payload.seatPlayerIds);
```

In `resetSessionState`, reset:

```ts
state.playerId = null;
state.seatPlayerIds = { black: '', white: '' };
```

Export helpers if tests need them:

```ts
normalizePlayerId,
normalizeSeatPlayerIds,
```

- [ ] **Step 4: Add network facade state fields**

In `ui/network-client.ts` initial `state`, add:

```ts
playerId: null as any,
seatPlayerIds: { black: '', white: '' },
```

In readable state builder, include:

```ts
playerId: state.playerId || null,
seatPlayerIds: cloneReadableNetworkStateValue(state.seatPlayerIds || { black: '', white: '' }, { black: '', white: '' }),
```

Add public getters:

```ts
function getPlayerId() {
    return state.playerId || readPlayerId() || null;
}

function getSeatPlayerIds() {
    return Object.assign({ black: '', white: '' }, state.seatPlayerIds || {});
}
```

Expose through `NetworkMatchClient`:

```ts
getPlayerId,
getSeatPlayerIds,
```

- [ ] **Step 5: Verify client state**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.network-session-lifecycle.test.ts test/ui.network-client.seat-normalization.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit client state**

Run:

```powershell
git diff -- ui/network-client.ts ui/network/session-seat.ts test/ui.network-session-lifecycle.test.ts test/ui.network-client.seat-normalization.test.ts
git diff --check -- ui/network-client.ts ui/network/session-seat.ts test/ui.network-session-lifecycle.test.ts test/ui.network-client.seat-normalization.test.ts
git add -- ui/network-client.ts ui/network/session-seat.ts test/ui.network-session-lifecycle.test.ts test/ui.network-client.seat-normalization.test.ts
git commit -m "Track player ids in network client state"
```

## Task 7: Generated Browser And Worker Surfaces

**Files:**

- Generated: `public/module-registry.js`
- Generated mirror: `worker-public/**`

- [ ] **Step 1: Run focused source tests before generation**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/shared.player-id.test.ts test/ui.player-identity.test.ts test/shared.match-entry-payload.test.ts test/ui.leaderboard-client.test.ts test/ui.network-session-lifecycle.test.ts test/utils.match-authority.player-id.test.ts test/workers.match-player-id.test.ts test/local-match-server.player-id.test.ts
```

Expected: PASS.

- [ ] **Step 2: Typecheck and build TypeScript outputs**

Run:

```powershell
npm run typecheck
npm run build:ts
```

Expected: both commands exit 0.

- [ ] **Step 3: Regenerate browser module registry**

Run:

```powershell
npm run build:browser
```

Expected: exit 0. `public/module-registry.js` includes `shared/player-id` and `ui/player-identity`.

Verify:

```powershell
rg -n "shared/player-id|ui/player-identity" public/module-registry.js
```

Expected: both module IDs are present.

- [ ] **Step 4: Prepare worker mirror**

Run:

```powershell
npm run worker:prepare
```

Expected: exit 0. `worker-public/shared/player-id.js` exists if the mirror script copies shared runtime files, and `worker-public/public/module-registry.js` is aligned if browser registry is mirrored.

Verify:

```powershell
Test-Path worker-public\shared\player-id.js
rg -n "shared/player-id|ui/player-identity" worker-public\public\module-registry.js
```

Expected: `Test-Path` prints `True`; registry search finds both module IDs when `worker-public/public/module-registry.js` is present.

- [ ] **Step 5: Run network parity bundle**

Run:

```powershell
npm run test:network:parity
```

Expected: PASS.

- [ ] **Step 6: Inspect generated diffs before staging**

Run:

```powershell
git status --short public worker-public dist
git diff -- public/module-registry.js worker-public
```

Expected: generated diffs reflect only source changes from this plan. Do not stage `dist/`.

- [ ] **Step 7: Commit generated surfaces**

Run:

```powershell
git add -- public/module-registry.js worker-public
git commit -m "Regenerate player id network assets"
```

If `worker-public/**` or `public/module-registry.js` had pre-existing unrelated dirty changes before this task, do not stage those files. Report the exact paths and keep the generated commit unmade.

## Task 8: Final Verification And Documentation Check

**Files:**

- Read: `01-rulebook.md`
- Read: `docs/architecture-contracts.md`
- No planned source-of-truth rule update unless implementation changes user-visible behavior beyond network payload metadata.

- [ ] **Step 1: Confirm no rulebook change is required**

Run:

```powershell
rg -n "playerId|レート|オートマッチ|ネット対戦" 01-rulebook.md docs/architecture-contracts.md
```

Expected: existing docs may mention network play, but this pass only adds metadata. No gameplay rule is changed.

- [ ] **Step 2: Run final focused verification bundle**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/shared.player-id.test.ts test/ui.player-identity.test.ts test/shared.match-entry-payload.test.ts test/ui.leaderboard-client.test.ts test/ui.network-session-lifecycle.test.ts test/utils.match-authority.player-id.test.ts test/workers.match-player-id.test.ts test/local-match-server.player-id.test.ts
npm run typecheck
npm run build:browser
npm run test:network:parity
```

Expected: all commands exit 0.

- [ ] **Step 3: Inspect final working tree**

Run:

```powershell
git status --short
```

Expected: only unrelated pre-existing dirty files remain. If this plan's files remain modified, either commit the isolated diff or report the exact blocker.

- [ ] **Step 4: Final report content**

Report:

- playerId is generated with the existing leaderboard storage key.
- network create/join payloads send playerId.
- Worker and local server store black/white seatPlayerIds.
- state/create/join responses project playerId metadata.
- `seatToken` remains the only room seat credential.
- Commands run and results.
- Any unrelated dirty files that were left untouched.

## Self-Review

Spec coverage:

- Stable local browser ID: Task 2.
- Reuse existing leaderboard ID: Task 2.
- Send ID during network create/join: Task 3.
- Store black/white IDs server-side: Task 5.
- Keep Worker/local parity: Task 5 and Task 7.
- Public projection for future rating/matchmaking: Task 4, Task 5, Task 6.
- No login/rating/matchmaking implementation: Non-goals and task scope.

Placeholder scan:

- No undecided placeholder markers.
- No open-ended task markers.
- No unscoped "add tests for this" steps.
- Every code-changing task includes concrete snippets and focused commands.

Type consistency:

- `playerId` is a single string or `null` in public payloads.
- `seatPlayerIds` is consistently `{ black: string; white: string }`.
- Invalid stored seat IDs normalize to `''`; invalid own `playerId` projection normalizes to `null`.
- Request validation rejects non-empty invalid IDs with `PLAYER_ID_INVALID`.

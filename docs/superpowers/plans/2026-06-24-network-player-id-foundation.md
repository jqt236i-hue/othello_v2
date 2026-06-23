# Network Player ID Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a login-free, server-issued anonymous player identity made of public `playerId`, private `playerToken`, and user-held `recoveryCode`; use it for leaderboard identity, network room identity, and short ID display beside ranking player names.

**Architecture:** A special Worker Durable Object room owns anonymous identity records and issues all IDs/secrets. Browser code stores credentials locally and can recover the same `playerId` with a recovery code; Worker/local server code verifies `playerId + playerToken` before accepting identity-bound leaderboard or network metadata. The current ranking UI keeps its existing columns and appends a compact short ID suffix inside the player-name label.

**Tech Stack:** TypeScript, CommonJS compatibility wrappers, Cloudflare Worker Durable Objects, local match server parity, Jest, existing `ui/leaderboard-client.ts`, `ui/network/session-lifecycle.ts`, `shared/match-entry-payload.ts`, `workers/match-worker.ts`, `workers/match-worker-api.ts`, `scripts/local-match-server.ts`, generated `public/module-registry.js`, and `worker-public/` mirror via existing scripts.

---

## Document Role

This is an implementation plan, design note, and execution runbook for replacing browser-generated `playerId` with server-issued anonymous identity.

Source-of-truth documents and files:

- Gameplay and visible network behavior: `01-rulebook.md`
- Internal architecture and authority contracts: `docs/architecture-contracts.md`
- Browser identity and leaderboard source: `ui/player-identity.ts`, `ui/leaderboard-client.ts`
- Network entry payload source: `shared/match-entry-payload.ts`
- Server-authoritative room source: `workers/match-worker.ts`
- Public Worker API routing source: `workers/match-worker-api.ts`
- Local parity server source: `scripts/local-match-server.ts`
- Generated or mirrored surfaces: `public/module-registry.js`, `dist/`, and `worker-public/`

Non-goals:

- No OAuth, email, password, external account, or mandatory login.
- No Elo/Glicko calculation, season table, automatic matchmaking queue, or match history in this pass.
- No gameplay rule, card, deck, board, turn timer, spectator, chat, or playback behavior change.
- No use of `playerId` alone as proof of identity.
- No source edits in `dist/`, `public/module-registry.js`, or `worker-public/` before root sources are changed and generation scripts are run.

## Behavior Contract

- The server issues every new identity. The browser never invents a canonical `playerId`.
- Public `playerId` format is `p_` plus 26 URL-safe random characters: `^p_[A-Za-z0-9_-]{26}$`.
- Private `playerToken` format is `pt_` plus 43 URL-safe random characters: `^pt_[A-Za-z0-9_-]{43}$`.
- User-held `recoveryCode` format is `CR-` plus five groups of 5 uppercase base32 characters, for example `CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23`.
- The Worker stores only hashes for `playerToken` and `recoveryCode`, never the raw secret strings.
- The browser stores `playerId`, `playerToken`, and the latest `recoveryCode` in localStorage so it can show/copy the code while site data remains. If localStorage is cleared, recovery requires the user to have copied the recovery code elsewhere.
- `/api/player/identity/create` creates a new identity.
- `/api/player/identity/verify` verifies a stored `playerId + playerToken`.
- `/api/player/identity/recover` verifies a `recoveryCode`, rotates `playerToken`, rotates `recoveryCode`, and returns the same `playerId` with new secrets.
- Network room create/join sends `playerId + playerToken` after the browser identity module has ensured a valid identity.
- Worker/local server room state stores public `seatPlayerIds` only. It must not store raw `playerToken` or `recoveryCode`.
- Missing identity from older clients remains accepted for casual play and stores empty seat IDs. Invalid non-empty identity is rejected with `PLAYER_ID_TOKEN_INVALID`.
- Leaderboard submit sends `playerId + playerToken`. Verified entries keep the public `playerId`; rejected identity submissions return `PLAYER_ID_TOKEN_INVALID`.
- Ranking rows and podium cards show a short suffix beside the player name when `playerId` is valid. Example: `p_ABCDEFGHJKLMNPQRSTUV0001` displays as `#0001`.

## File Structure

Create:

- `shared/player-identity-contract.ts`: Pure format checks, normalization helpers, short-display formatter, and public credential shape.
- `shared/player-identity-contract.js`: CommonJS compatibility wrapper.
- `ui/player-identity.ts`: Browser identity client that creates, verifies, stores, and recovers anonymous identity.
- `ui/player-identity.js`: CommonJS compatibility wrapper.
- `workers/match-worker-player-identity.ts`: Durable Object controller for identity storage, hashing, create, verify, and recover.
- `test/shared.player-identity-contract.test.ts`: Focused contract tests.
- `test/ui.player-identity.test.ts`: Browser identity client tests.
- `test/workers.match-player-identity.test.ts`: Worker identity API tests.
- `test/workers.match-player-id.test.ts`: Worker room create/join/state playerId tests.
- `test/local-match-server.player-identity.test.ts`: Local server identity parity tests.
- `test/utils.match-authority.player-id.test.ts`: Authority payload playerId projection tests.

Modify:

- `workers/match-worker-api.ts`: Route `/api/player/identity/*` to a special identity Durable Object.
- `workers/match-worker.ts`: Register identity controller in the existing special-room Durable Object class, verify player credentials for room create/join metadata, and project public `seatPlayerIds`.
- `workers/match-worker-types.ts`: Add identity payload/store types and public `seatPlayerIds` type if not inherited clearly enough.
- `scripts/local-match-server.ts`: Mirror identity create/verify/recover and network room playerId behavior with an in-memory identity store.
- `shared/match-entry-payload.ts`: Carry `playerId` and `playerToken` through create/join/retry payloads.
- `ui/leaderboard-client.ts`: Use `ui/player-identity.ts`, submit `playerId + playerToken`, and preserve public `getPlayerId()`.
- `ui/network-client.ts`: Expose identity helpers and provide async `ensurePlayerIdentity` to network lifecycle.
- `ui/network/session-lifecycle.ts`: Ensure identity before room create/join and pass credentials to the payload builder.
- `ui/network/session-seat.ts`: Store public `playerId` and `seatPlayerIds` from room payloads.
- `utils/match-authority-types.ts`: Add `MatchAuthoritySeatPlayerIds`, `playerId`, and `seatPlayerIds` payload fields.
- `utils/match-authority.ts`: Normalize/project public `playerId` and `seatPlayerIds`.
- `ui/handlers/match-mode/leaderboard-controller.ts`: Render short `playerId` suffix beside player names.
- `styles-leaderboard.css`: Style short ID suffix as compact secondary text.
- Tests under `test/ui.leaderboard-client.test.ts`, `test/ui.network-session-lifecycle.test.ts`, `test/shared.match-entry-payload.test.ts`, and `test/ui.match-mode.leaderboard-limit.test.ts`.
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

- [ ] **Step 2: Confirm target file status before editing**

Run:

```powershell
git status --short shared ui utils workers scripts test public worker-public styles-leaderboard.css
```

Expected: identify pre-existing target-file changes. If a target file already has unrelated dirty changes, inspect it with:

```powershell
git diff -- <path>
```

Continue only when the new changes can be separated by exact paths and hunks.

- [ ] **Step 3: Keep commits isolated**

Use exact file paths in every commit. Never use:

```powershell
git add -A
```

## Task 1: Shared Identity Contract

**Files:**

- Create: `shared/player-identity-contract.ts`
- Create: `shared/player-identity-contract.js`
- Test: `test/shared.player-identity-contract.test.ts`

- [ ] **Step 1: Write failing contract tests**

Create `test/shared.player-identity-contract.test.ts`:

```ts
describe('player identity contract', () => {
  let Contract: any;

  beforeEach(() => {
    jest.resetModules();
    Contract = require('../shared/player-identity-contract');
  });

  test('normalizes public player IDs, private tokens, and recovery codes', () => {
    expect(Contract.normalizePlayerId(' p_ABCDEFGHIJKLMNOPQRSTUVWXYZ ')).toBe('p_ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(Contract.normalizePlayerToken('pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12')).toBe('pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12');
    expect(Contract.normalizeRecoveryCode(' cr-abcde-fghjk-mnpqr-stuvw-xyz23 ')).toBe('CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23');
  });

  test('rejects invalid identity fields', () => {
    expect(Contract.normalizePlayerId('player_alpha_0001')).toBeNull();
    expect(Contract.normalizePlayerToken('pt_short')).toBeNull();
    expect(Contract.normalizeRecoveryCode('CR-BAD')).toBeNull();
  });

  test('formats short display IDs from the public playerId', () => {
    expect(Contract.formatShortPlayerId('p_ABCDEFGHIJKLMNOPQRSTUV0001')).toBe('#0001');
    expect(Contract.formatShortPlayerId('bad')).toBe('');
  });

  test('normalizes seat player IDs without accepting secrets', () => {
    expect(Contract.normalizeSeatPlayerIds({
      black: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
      white: 'p_ABCDEFGHIJKLMNOPQRSTUV0002',
      token: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12'
    })).toEqual({
      black: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
      white: 'p_ABCDEFGHIJKLMNOPQRSTUV0002'
    });
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/shared.player-identity-contract.test.ts
```

Expected: FAIL because `../shared/player-identity-contract` does not exist.

- [ ] **Step 3: Add pure contract implementation**

Create `shared/player-identity-contract.ts`:

```ts
'use strict';

const PLAYER_ID_RE = /^p_[A-Za-z0-9_-]{26}$/;
const PLAYER_TOKEN_RE = /^pt_[A-Za-z0-9_-]{43}$/;
const RECOVERY_CODE_RE = /^CR-[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}$/;

type SeatPlayerIds = {
  black: string;
  white: string;
};

function normalizePlayerId(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return PLAYER_ID_RE.test(normalized) ? normalized : null;
}

function normalizePlayerToken(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return PLAYER_TOKEN_RE.test(normalized) ? normalized : null;
}

function normalizeRecoveryCode(value: unknown): string | null {
  const normalized = String(value || '').trim().toUpperCase();
  return RECOVERY_CODE_RE.test(normalized) ? normalized : null;
}

function normalizeSeatPlayerIds(value: unknown): SeatPlayerIds {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    black: normalizePlayerId(source.black) || '',
    white: normalizePlayerId(source.white) || ''
  };
}

function formatShortPlayerId(value: unknown): string {
  const playerId = normalizePlayerId(value);
  return playerId ? `#${playerId.slice(-4)}` : '';
}

export = {
  PLAYER_ID_RE,
  PLAYER_TOKEN_RE,
  RECOVERY_CODE_RE,
  normalizePlayerId,
  normalizePlayerToken,
  normalizeRecoveryCode,
  normalizeSeatPlayerIds,
  formatShortPlayerId
};
```

Create `shared/player-identity-contract.js`:

```js
'use strict';

module.exports = process.env.JEST_WORKER_ID
  ? require('./player-identity-contract.ts')
  : require('../dist/shared/player-identity-contract');
```

- [ ] **Step 4: Verify shared contract**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/shared.player-identity-contract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit shared contract**

Run:

```powershell
git diff -- shared/player-identity-contract.ts shared/player-identity-contract.js test/shared.player-identity-contract.test.ts
git diff --check -- shared/player-identity-contract.ts shared/player-identity-contract.js test/shared.player-identity-contract.test.ts
git add -- shared/player-identity-contract.ts shared/player-identity-contract.js test/shared.player-identity-contract.test.ts
git commit -m "Add anonymous player identity contract"
```

## Task 2: Worker And Local Identity Service

**Files:**

- Create: `workers/match-worker-player-identity.ts`
- Modify: `workers/match-worker-api.ts`
- Modify: `workers/match-worker.ts`
- Modify: `workers/match-worker-types.ts`
- Modify: `scripts/local-match-server.ts`
- Test: `test/workers.match-player-identity.test.ts`
- Test: `test/local-match-server.player-identity.test.ts`

- [ ] **Step 1: Write failing Worker identity API tests**

Create `test/workers.match-player-identity.test.ts` following the Worker harness pattern used by nearby `test/workers.match-leaderboard.test.ts`:

```ts
test('identity create, verify, and recover keep the same public playerId', async () => {
  const result = await runWorkerScenario(`
    const createResponse = await worker.fetch(new Request('https://worker/api/player/identity/create', { method: 'POST' }));
    const created = await createResponse.json();

    const verifyResponse = await worker.fetch(new Request('https://worker/api/player/identity/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: created.playerId, playerToken: created.playerToken })
    }));
    const verified = await verifyResponse.json();

    const recoverResponse = await worker.fetch(new Request('https://worker/api/player/identity/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recoveryCode: created.recoveryCode })
    }));
    const recovered = await recoverResponse.json();

    const oldVerifyResponse = await worker.fetch(new Request('https://worker/api/player/identity/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: created.playerId, playerToken: created.playerToken })
    }));
    const oldVerified = await oldVerifyResponse.json();

    process.stdout.write(JSON.stringify({
      createStatus: createResponse.status,
      created,
      verifyStatus: verifyResponse.status,
      verified,
      recoverStatus: recoverResponse.status,
      recovered,
      oldVerifyStatus: oldVerifyResponse.status,
      oldVerified
    }));
  `);

  expect(result.createStatus).toBe(200);
  expect(result.created.playerId).toMatch(/^p_[A-Za-z0-9_-]{26}$/);
  expect(result.created.playerToken).toMatch(/^pt_[A-Za-z0-9_-]{43}$/);
  expect(result.created.recoveryCode).toMatch(/^CR-[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}$/);
  expect(result.verifyStatus).toBe(200);
  expect(result.verified).toMatchObject({ ok: true, playerId: result.created.playerId });
  expect(result.recoverStatus).toBe(200);
  expect(result.recovered.playerId).toBe(result.created.playerId);
  expect(result.recovered.playerToken).not.toBe(result.created.playerToken);
  expect(result.oldVerifyStatus).toBe(403);
  expect(result.oldVerified.reason).toBe('PLAYER_ID_TOKEN_INVALID');
});
```

- [ ] **Step 2: Write failing local identity parity tests**

Create `test/local-match-server.player-identity.test.ts` with the local server request helper pattern:

```ts
test('local server identity create verify and recover mirrors Worker contract', async () => {
  const created = await requestJson(port, 'POST', '/api/player/identity/create', {});
  const verified = await requestJson(port, 'POST', '/api/player/identity/verify', {
    playerId: created.data.playerId,
    playerToken: created.data.playerToken
  });
  const recovered = await requestJson(port, 'POST', '/api/player/identity/recover', {
    recoveryCode: created.data.recoveryCode
  });

  expect(created.status).toBe(200);
  expect(verified.status).toBe(200);
  expect(recovered.status).toBe(200);
  expect(recovered.data.playerId).toBe(created.data.playerId);
  expect(recovered.data.playerToken).not.toBe(created.data.playerToken);
});
```

- [ ] **Step 3: Run failing identity API tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/workers.match-player-identity.test.ts test/local-match-server.player-identity.test.ts
```

Expected: FAIL because identity endpoints do not exist.

- [ ] **Step 4: Add identity controller**

Create `workers/match-worker-player-identity.ts` with exported controller factory:

```ts
import type { DurableObjectStateLike } from './match-worker-types';

const Contract = require('../shared/player-identity-contract');

type IdentityRecord = {
  playerId: string;
  tokenHash: string;
  recoveryHash: string;
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number;
};

type IdentityStore = {
  version: 1;
  records: Record<string, IdentityRecord>;
};

type IdentityControllerConfig = {
  storage: DurableObjectStateLike['storage'];
  storageKey: string;
  jsonResponse: (statusCode: number, payload: unknown) => Response;
  now?: () => number;
  crypto?: Crypto;
};

const TOKEN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const RECOVERY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ234567';

function randomFromChars(chars: string, length: number, cryptoLike: Crypto): string {
  const bytes = new Uint8Array(length);
  cryptoLike.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => chars[byte % chars.length]).join('');
}

async function sha256Hex(value: string, cryptoLike: Crypto): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await cryptoLike.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function makePlayerId(cryptoLike: Crypto): string {
  return `p_${randomFromChars(TOKEN_CHARS, 26, cryptoLike)}`;
}

function makePlayerToken(cryptoLike: Crypto): string {
  return `pt_${randomFromChars(TOKEN_CHARS, 43, cryptoLike)}`;
}

function makeRecoveryCode(cryptoLike: Crypto): string {
  const raw = randomFromChars(RECOVERY_CHARS, 25, cryptoLike);
  return `CR-${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}-${raw.slice(15, 20)}-${raw.slice(20, 25)}`;
}

export function createMatchWorkerPlayerIdentityController(config: IdentityControllerConfig) {
  const cfg = config;
  const now = typeof cfg.now === 'function' ? cfg.now : () => Date.now();
  const cryptoLike = cfg.crypto || globalThis.crypto;

  async function loadStore(): Promise<IdentityStore> {
    const raw = await cfg.storage.get(cfg.storageKey);
    const source = raw && typeof raw === 'object' ? raw as Partial<IdentityStore> : {};
    return {
      version: 1,
      records: source.records && typeof source.records === 'object' ? source.records : {}
    };
  }

  async function saveStore(store: IdentityStore): Promise<void> {
    await cfg.storage.put(cfg.storageKey, store);
  }

  async function handleCreate(): Promise<Response> {
    const store = await loadStore();
    let playerId = makePlayerId(cryptoLike);
    while (store.records[playerId]) playerId = makePlayerId(cryptoLike);
    const playerToken = makePlayerToken(cryptoLike);
    const recoveryCode = makeRecoveryCode(cryptoLike);
    const timestamp = now();
    store.records[playerId] = {
      playerId,
      tokenHash: await sha256Hex(playerToken, cryptoLike),
      recoveryHash: await sha256Hex(recoveryCode, cryptoLike),
      createdAt: timestamp,
      updatedAt: timestamp,
      lastSeenAt: timestamp
    };
    await saveStore(store);
    return cfg.jsonResponse(200, { ok: true, playerId, playerToken, recoveryCode, serverTime: timestamp });
  }

  async function handleVerify(body: Record<string, unknown>): Promise<Response> {
    const playerId = Contract.normalizePlayerId(body.playerId);
    const playerToken = Contract.normalizePlayerToken(body.playerToken);
    if (!playerId || !playerToken) return cfg.jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
    const store = await loadStore();
    const record = store.records[playerId];
    if (!record || record.tokenHash !== await sha256Hex(playerToken, cryptoLike)) {
      return cfg.jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
    }
    record.lastSeenAt = now();
    record.updatedAt = record.lastSeenAt;
    await saveStore(store);
    return cfg.jsonResponse(200, { ok: true, playerId, serverTime: record.lastSeenAt });
  }

  async function handleRecover(body: Record<string, unknown>): Promise<Response> {
    const recoveryCode = Contract.normalizeRecoveryCode(body.recoveryCode);
    if (!recoveryCode) return cfg.jsonResponse(403, { ok: false, reason: 'RECOVERY_CODE_INVALID' });
    const recoveryHash = await sha256Hex(recoveryCode, cryptoLike);
    const store = await loadStore();
    const record = Object.values(store.records).find((entry) => entry.recoveryHash === recoveryHash);
    if (!record) return cfg.jsonResponse(403, { ok: false, reason: 'RECOVERY_CODE_INVALID' });
    const playerToken = makePlayerToken(cryptoLike);
    const nextRecoveryCode = makeRecoveryCode(cryptoLike);
    record.tokenHash = await sha256Hex(playerToken, cryptoLike);
    record.recoveryHash = await sha256Hex(nextRecoveryCode, cryptoLike);
    record.updatedAt = now();
    record.lastSeenAt = record.updatedAt;
    await saveStore(store);
    return cfg.jsonResponse(200, { ok: true, playerId: record.playerId, playerToken, recoveryCode: nextRecoveryCode, serverTime: record.updatedAt });
  }

  return {
    handleCreate,
    handleVerify,
    handleRecover
  };
}
```

- [ ] **Step 5: Route Worker identity endpoints**

In `workers/match-worker.ts`, add:

```ts
import { createMatchWorkerPlayerIdentityController } from './match-worker-player-identity';

const PLAYER_IDENTITY_ROOM_ID = '__player_identity__';
const PLAYER_IDENTITY_STORAGE_KEY = 'player_identity_store_v1';
```

Add a lazy controller on the Durable Object class:

```ts
playerIdentityController: ReturnType<typeof createMatchWorkerPlayerIdentityController> | null;

getPlayerIdentityController() {
    if (!this.playerIdentityController) {
        this.playerIdentityController = createMatchWorkerPlayerIdentityController({
            storage: this.state.storage,
            storageKey: PLAYER_IDENTITY_STORAGE_KEY,
            jsonResponse
        });
    }
    return this.playerIdentityController;
}
```

In the Durable Object `fetch()` route:

```ts
if (request.method === 'POST' && pathname === '/api/player/identity/create') {
    return this.getPlayerIdentityController().handleCreate();
}
if (request.method === 'POST' && pathname === '/api/player/identity/verify') {
    const parsed = parseJsonBody(await request.text());
    if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
    return this.getPlayerIdentityController().handleVerify(parsed || {});
}
if (request.method === 'POST' && pathname === '/api/player/identity/recover') {
    const parsed = parseJsonBody(await request.text());
    if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
    return this.getPlayerIdentityController().handleRecover(parsed || {});
}
```

In `workers/match-worker-api.ts`, add `playerIdentityRoomId` to the config and route these public paths to that special room:

```ts
if (request.method === 'POST' && (
    pathname === '/api/player/identity/create'
    || pathname === '/api/player/identity/verify'
    || pathname === '/api/player/identity/recover'
)) {
    const parsed = await parsePostBody(request);
    if (!parsed.ok) return parsed.response;
    return forwardJsonToRoom(env, cfg.playerIdentityRoomId, pathname, parsed.body || {});
}
```

- [ ] **Step 6: Add local server parity**

In `scripts/local-match-server.ts`, add an in-memory identity store and route:

```ts
const playerIdentityRecords = new Map<string, any>();
```

Add local equivalents for `makePlayerId`, `makePlayerToken`, `makeRecoveryCode`, and SHA-256 using Node `crypto.createHash('sha256')`. Add routes in `createLocalMatchServer()`:

```ts
if (req.method === 'POST' && pathname === '/api/player/identity/create') {
    await handlePlayerIdentityCreate(req, res);
    return;
}
if (req.method === 'POST' && pathname === '/api/player/identity/verify') {
    await handlePlayerIdentityVerify(req, res);
    return;
}
if (req.method === 'POST' && pathname === '/api/player/identity/recover') {
    await handlePlayerIdentityRecover(req, res);
    return;
}
```

- [ ] **Step 7: Verify identity services**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/workers.match-player-identity.test.ts test/local-match-server.player-identity.test.ts test/shared.player-identity-contract.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit identity service**

Run:

```powershell
git diff -- workers/match-worker-player-identity.ts workers/match-worker-api.ts workers/match-worker.ts workers/match-worker-types.ts scripts/local-match-server.ts test/workers.match-player-identity.test.ts test/local-match-server.player-identity.test.ts
git diff --check -- workers/match-worker-player-identity.ts workers/match-worker-api.ts workers/match-worker.ts workers/match-worker-types.ts scripts/local-match-server.ts test/workers.match-player-identity.test.ts test/local-match-server.player-identity.test.ts
git add -- workers/match-worker-player-identity.ts workers/match-worker-api.ts workers/match-worker.ts workers/match-worker-types.ts scripts/local-match-server.ts test/workers.match-player-identity.test.ts test/local-match-server.player-identity.test.ts
git commit -m "Add anonymous player identity service"
```

## Task 3: Browser Identity Client And Leaderboard Submit

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
  let fetchMock: jest.Mock;
  let PlayerIdentity: any;

  beforeEach(() => {
    jest.resetModules();
    storage = new Map();
    fetchMock = jest.fn();
    Object.defineProperty(global, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn((key: string) => storage.get(key) || null),
        setItem: jest.fn((key: string, value: string) => storage.set(key, String(value))),
        removeItem: jest.fn((key: string) => storage.delete(key))
      }
    });
    Object.defineProperty(global, 'fetch', { configurable: true, value: fetchMock });
    PlayerIdentity = require('../ui/player-identity');
  });

  afterEach(() => {
    delete (global as any).localStorage;
    delete (global as any).fetch;
  });

  test('creates and stores server-issued identity when none exists', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
        playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
        recoveryCode: 'CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23'
      })
    });

    const identity = await PlayerIdentity.ensurePlayerIdentity();

    expect(fetchMock).toHaveBeenCalledWith('/api/player/identity/create', expect.objectContaining({ method: 'POST' }));
    expect(identity.playerId).toBe('p_ABCDEFGHIJKLMNOPQRSTUV0001');
    expect(storage.get('shared_leaderboard_player_id_v1')).toBe('p_ABCDEFGHIJKLMNOPQRSTUV0001');
    expect(storage.get('shared_player_token_v1')).toBe('pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12');
    expect(storage.get('shared_player_recovery_code_v1')).toBe('CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23');
  });

  test('verifies stored identity before returning it', async () => {
    storage.set('shared_leaderboard_player_id_v1', 'p_ABCDEFGHIJKLMNOPQRSTUV0001');
    storage.set('shared_player_token_v1', 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12');
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001' }) });

    const identity = await PlayerIdentity.ensurePlayerIdentity();

    expect(fetchMock).toHaveBeenCalledWith('/api/player/identity/verify', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
        playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12'
      })
    }));
    expect(identity.playerId).toBe('p_ABCDEFGHIJKLMNOPQRSTUV0001');
  });

  test('recovers identity and stores rotated secrets', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
        playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno99',
        recoveryCode: 'CR-ZYXWV-UTSRQ-PNMKJ-HGFED-CBA76'
      })
    });

    const identity = await PlayerIdentity.recoverPlayerIdentity('cr-zyxwv-utsrq-pnmkj-hgfed-cba76');

    expect(fetchMock).toHaveBeenCalledWith('/api/player/identity/recover', expect.objectContaining({ method: 'POST' }));
    expect(identity.playerToken).toBe('pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno99');
    expect(storage.get('shared_player_recovery_code_v1')).toBe('CR-ZYXWV-UTSRQ-PNMKJ-HGFED-CBA76');
  });
});
```

- [ ] **Step 2: Run failing browser identity test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.player-identity.test.ts
```

Expected: FAIL because `../ui/player-identity` does not exist.

- [ ] **Step 3: Add browser identity client**

Create `ui/player-identity.ts`:

```ts
'use strict';

const Contract = require('../shared/player-identity-contract');

const PLAYER_NAME_STORAGE_KEY = 'shared_leaderboard_player_name_v1';
const PLAYER_ID_STORAGE_KEY = 'shared_leaderboard_player_id_v1';
const PLAYER_TOKEN_STORAGE_KEY = 'shared_player_token_v1';
const RECOVERY_CODE_STORAGE_KEY = 'shared_player_recovery_code_v1';
const PLAYER_NAME_MAX = 7;
const DEFAULT_PLAYER_NAME = 'ななし';

function canUseStorage(): boolean {
  try { return typeof localStorage !== 'undefined' && !!localStorage; } catch (e) { return false; }
}

function normalizePlayerName(value: unknown): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return Array.from(normalized).slice(0, PLAYER_NAME_MAX).join('') || DEFAULT_PLAYER_NAME;
}

function readStoredIdentity(): any {
  if (!canUseStorage()) return null;
  const playerId = Contract.normalizePlayerId(localStorage.getItem(PLAYER_ID_STORAGE_KEY));
  const playerToken = Contract.normalizePlayerToken(localStorage.getItem(PLAYER_TOKEN_STORAGE_KEY));
  const recoveryCode = Contract.normalizeRecoveryCode(localStorage.getItem(RECOVERY_CODE_STORAGE_KEY));
  return playerId && playerToken ? { playerId, playerToken, recoveryCode } : null;
}

function writeStoredIdentity(identity: any): any {
  const playerId = Contract.normalizePlayerId(identity && identity.playerId);
  const playerToken = Contract.normalizePlayerToken(identity && identity.playerToken);
  const recoveryCode = Contract.normalizeRecoveryCode(identity && identity.recoveryCode);
  if (!playerId || !playerToken) return null;
  if (canUseStorage()) {
    localStorage.setItem(PLAYER_ID_STORAGE_KEY, playerId);
    localStorage.setItem(PLAYER_TOKEN_STORAGE_KEY, playerToken);
    if (recoveryCode) localStorage.setItem(RECOVERY_CODE_STORAGE_KEY, recoveryCode);
  }
  return { playerId, playerToken, recoveryCode };
}

async function requestIdentity(path: string, payload?: any): Promise<any> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.ok !== true) {
    return { ok: false, reason: (data && data.reason) || `HTTP_${response.status}` };
  }
  return data;
}

async function ensurePlayerIdentity(): Promise<any> {
  const stored = readStoredIdentity();
  if (stored) {
    const verified = await requestIdentity('/api/player/identity/verify', {
      playerId: stored.playerId,
      playerToken: stored.playerToken
    });
    if (verified && verified.ok === true) return stored;
  }
  const created = await requestIdentity('/api/player/identity/create');
  const identity = writeStoredIdentity(created);
  return identity || { playerId: null, playerToken: null, recoveryCode: null };
}

async function recoverPlayerIdentity(recoveryCodeValue: unknown): Promise<any> {
  const recoveryCode = Contract.normalizeRecoveryCode(recoveryCodeValue);
  if (!recoveryCode) return { ok: false, reason: 'RECOVERY_CODE_INVALID' };
  const recovered = await requestIdentity('/api/player/identity/recover', { recoveryCode });
  const identity = writeStoredIdentity(recovered);
  return identity || { ok: false, reason: 'RECOVERY_FAILED' };
}

function getPlayerName(): string {
  if (!canUseStorage()) return DEFAULT_PLAYER_NAME;
  return normalizePlayerName(localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || DEFAULT_PLAYER_NAME);
}

function setPlayerName(value: unknown): string {
  const name = normalizePlayerName(value);
  if (canUseStorage()) localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
  return name;
}

function getPlayerId(): string | null {
  const stored = readStoredIdentity();
  return stored ? stored.playerId : null;
}

function getPlayerToken(): string | null {
  const stored = readStoredIdentity();
  return stored ? stored.playerToken : null;
}

function getRecoveryCode(): string | null {
  const stored = readStoredIdentity();
  return stored ? stored.recoveryCode : null;
}

const PlayerIdentity = {
  PLAYER_NAME_STORAGE_KEY,
  PLAYER_ID_STORAGE_KEY,
  PLAYER_TOKEN_STORAGE_KEY,
  RECOVERY_CODE_STORAGE_KEY,
  normalizePlayerName,
  getPlayerName,
  setPlayerName,
  getPlayerId,
  getPlayerToken,
  getRecoveryCode,
  ensurePlayerIdentity,
  recoverPlayerIdentity
};

try {
  if (typeof globalThis !== 'undefined') (globalThis as any).PlayerIdentity = PlayerIdentity;
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

- [ ] **Step 4: Refactor leaderboard client to submit verified identity**

In `ui/leaderboard-client.ts`, replace local ID/name storage code with:

```ts
const PlayerIdentity = require('./player-identity');
const Contract = require('../shared/player-identity-contract');

const getPlayerName = PlayerIdentity.getPlayerName;
const setPlayerName = PlayerIdentity.setPlayerName;
const getPlayerId = PlayerIdentity.getPlayerId;
const normalizePlayerName = PlayerIdentity.normalizePlayerName;
const normalizePlayerId = Contract.normalizePlayerId;
```

Before every leaderboard submit payload, ensure identity:

```ts
const identity = await PlayerIdentity.ensurePlayerIdentity();
```

Then include:

```ts
playerId: identity.playerId,
playerToken: identity.playerToken,
playerName: getPlayerName(),
```

- [ ] **Step 5: Verify browser identity and leaderboard submit**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.player-identity.test.ts test/ui.leaderboard-client.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit browser identity client**

Run:

```powershell
git diff -- ui/player-identity.ts ui/player-identity.js ui/leaderboard-client.ts test/ui.player-identity.test.ts test/ui.leaderboard-client.test.ts
git diff --check -- ui/player-identity.ts ui/player-identity.js ui/leaderboard-client.ts test/ui.player-identity.test.ts test/ui.leaderboard-client.test.ts
git add -- ui/player-identity.ts ui/player-identity.js ui/leaderboard-client.ts test/ui.player-identity.test.ts test/ui.leaderboard-client.test.ts
git commit -m "Use server issued player identity in browser"
```

## Task 4: Network Entry Payload Credentials

**Files:**

- Modify: `shared/match-entry-payload.ts`
- Modify: `ui/network/session-lifecycle.ts`
- Modify: `ui/network-client.ts`
- Test: `test/shared.match-entry-payload.test.ts`
- Test: `test/ui.network-session-lifecycle.test.ts`

- [ ] **Step 1: Write failing payload tests**

In `test/shared.match-entry-payload.test.ts`, assert create/join/retry payloads include both fields:

```ts
const result = MatchEntryPayload.buildCreateRoomPayload(
  { playerName: 'テスト' },
  {
    readPlayerIdentity: () => ({
      playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
      playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12'
    }),
    readSelectedHandSkinId: () => 'default'
  }
);

expect(result.payload).toEqual(expect.objectContaining({
  playerName: 'テスト',
  playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
  playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12'
}));
```

- [ ] **Step 2: Write failing network lifecycle tests**

In `test/ui.network-session-lifecycle.test.ts`, add:

```ts
ensurePlayerIdentity: jest.fn(async () => ({
  playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
  playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12'
})),
```

Assert create/join requests contain those credentials.

- [ ] **Step 3: Run failing payload tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/shared.match-entry-payload.test.ts test/ui.network-session-lifecycle.test.ts
```

Expected: FAIL because payloads do not yet carry `playerToken`.

- [ ] **Step 4: Extend payload builder**

In `shared/match-entry-payload.ts`, add `readPlayerIdentity` to helpers:

```ts
readPlayerIdentity?: () => { playerId?: unknown; playerToken?: unknown } | null;
```

Add:

```ts
const IdentityContract = require('./player-identity-contract');

function appendOptionalPlayerIdentity(payload: Record<string, unknown>, helpers?: MatchEntryPayloadHelpers): void {
  const h = resolveHelpers(helpers);
  const identity = typeof h.readPlayerIdentity === 'function' ? h.readPlayerIdentity() : null;
  const playerId = IdentityContract.normalizePlayerId(identity && identity.playerId);
  const playerToken = IdentityContract.normalizePlayerToken(identity && identity.playerToken);
  if (playerId && playerToken) {
    payload.playerId = playerId;
    payload.playerToken = playerToken;
  }
}
```

Call this in `buildCreateRoomPayload()` and `buildJoinRoomPayload()` after `payload` is created. Keep `playerToken` in `buildJoinRetryPayload()` when present.

- [ ] **Step 5: Ensure identity before network create/join**

In `ui/network/session-lifecycle.ts`, before calling `MatchEntryPayload.buildCreateRoomPayload()` and `buildJoinRoomPayload()`, add:

```ts
const playerIdentity = typeof cfg.ensurePlayerIdentity === 'function'
  ? await cfg.ensurePlayerIdentity()
  : null;
```

Pass it through helper config:

```ts
readPlayerIdentity: () => playerIdentity,
```

In `ui/network-client.ts`, resolve `PlayerIdentity` and pass:

```ts
ensurePlayerIdentity: () => PlayerIdentityModule.ensurePlayerIdentity(),
```

- [ ] **Step 6: Verify payload propagation**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/shared.match-entry-payload.test.ts test/ui.network-session-lifecycle.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit network payload credentials**

Run:

```powershell
git diff -- shared/match-entry-payload.ts ui/network/session-lifecycle.ts ui/network-client.ts test/shared.match-entry-payload.test.ts test/ui.network-session-lifecycle.test.ts
git diff --check -- shared/match-entry-payload.ts ui/network/session-lifecycle.ts ui/network-client.ts test/shared.match-entry-payload.test.ts test/ui.network-session-lifecycle.test.ts
git add -- shared/match-entry-payload.ts ui/network/session-lifecycle.ts ui/network-client.ts test/shared.match-entry-payload.test.ts test/ui.network-session-lifecycle.test.ts
git commit -m "Send verified player identity with network entry"
```

## Task 5: Room Authority Stores Verified Public IDs

**Files:**

- Modify: `utils/match-authority-types.ts`
- Modify: `utils/match-authority.ts`
- Modify: `workers/match-worker.ts`
- Modify: `scripts/local-match-server.ts`
- Create: `test/utils.match-authority.player-id.test.ts`
- Test: `test/workers.match-player-id.test.ts`
- Test: `test/local-match-server.player-identity.test.ts`

- [ ] **Step 1: Write failing room authority tests**

Create or update tests so Worker/local room create and join use valid identity credentials from `/api/player/identity/create` and assert:

```ts
expect(createPayload.seatPlayerIds).toEqual({
  black: createdBlack.playerId,
  white: ''
});
expect(joinPayload.seatPlayerIds).toEqual({
  black: createdBlack.playerId,
  white: createdWhite.playerId
});
expect(joinPayload).not.toHaveProperty('playerToken');
expect(statePayload).not.toHaveProperty('playerToken');
```

Add invalid token case:

```ts
expect(invalidJoinStatus).toBe(403);
expect(invalidJoinPayload.reason).toBe('PLAYER_ID_TOKEN_INVALID');
```

- [ ] **Step 2: Run failing authority tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/utils.match-authority.player-id.test.ts test/workers.match-player-id.test.ts test/local-match-server.player-identity.test.ts
```

Expected: FAIL because rooms do not verify and store public IDs yet.

- [ ] **Step 3: Add authority public projection**

In `utils/match-authority-types.ts`, add:

```ts
export interface MatchAuthoritySeatPlayerIds {
    black: string;
    white: string;
}
```

Extend room state and payload option interfaces with:

```ts
seatPlayerIds?: Partial<MatchAuthoritySeatPlayerIds> | null;
playerId?: unknown;
seatPlayerIds?: unknown;
```

In `utils/match-authority.ts`, import the contract and project only public fields:

```ts
const PlayerIdentityContract = loadOptionalCommonJsModule<{
    normalizePlayerId?: (value: unknown) => string | null;
    normalizeSeatPlayerIds?: (value: unknown) => { black: string; white: string };
}>('../shared/player-identity-contract');
```

Add `playerId` and `seatPlayerIds` support to `buildRoomPayload()`.

- [ ] **Step 4: Verify credentials before storing public IDs**

In Worker and local server create/join paths:

```ts
const verifiedIdentity = await verifyPlayerIdentityFromBody(body);
if (verifiedIdentity.rejected) {
    return jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
}
```

Store:

```ts
room.seatPlayerIds = normalizeSeatPlayerIds(room.seatPlayerIds);
if (verifiedIdentity.playerId) {
    room.seatPlayerIds[seatKey] = verifiedIdentity.playerId;
}
```

Never store:

```ts
body.playerToken
body.recoveryCode
```

- [ ] **Step 5: Verify authority storage**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/utils.match-authority.player-id.test.ts test/workers.match-player-id.test.ts test/local-match-server.player-identity.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit room authority storage**

Run:

```powershell
git diff -- utils/match-authority-types.ts utils/match-authority.ts workers/match-worker.ts scripts/local-match-server.ts test/utils.match-authority.player-id.test.ts test/workers.match-player-id.test.ts test/local-match-server.player-identity.test.ts
git diff --check -- utils/match-authority-types.ts utils/match-authority.ts workers/match-worker.ts scripts/local-match-server.ts test/utils.match-authority.player-id.test.ts test/workers.match-player-id.test.ts test/local-match-server.player-identity.test.ts
git add -- utils/match-authority-types.ts utils/match-authority.ts workers/match-worker.ts scripts/local-match-server.ts test/utils.match-authority.player-id.test.ts test/workers.match-player-id.test.ts test/local-match-server.player-identity.test.ts
git commit -m "Store verified player ids in network rooms"
```

## Task 6: Client Session State And Ranking ID Display

**Files:**

- Modify: `ui/network/session-seat.ts`
- Modify: `ui/network-client.ts`
- Modify: `ui/handlers/match-mode/leaderboard-controller.ts`
- Modify: `styles-leaderboard.css`
- Test: `test/ui.network-session-lifecycle.test.ts`
- Test: `test/ui.match-mode.leaderboard-limit.test.ts`

- [ ] **Step 1: Write failing client state and ranking display tests**

In `test/ui.network-session-lifecycle.test.ts`, assert activation stores:

```ts
stateObj.playerId = data.playerId || null;
stateObj.seatPlayerIds = data.seatPlayerIds || null;
```

In `test/ui.match-mode.leaderboard-limit.test.ts`, assert:

```ts
const list = document.getElementById('leaderboardList');
const podium = document.getElementById('leaderboardPodium');

expect(list?.textContent).toContain('#0001');
expect(podium?.textContent).toContain('#0002');
expect(list?.querySelector('.leaderboard-name-id')?.getAttribute('title')).toContain('p_');
```

- [ ] **Step 2: Run failing client tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.network-session-lifecycle.test.ts test/ui.match-mode.leaderboard-limit.test.ts
```

Expected: FAIL because client state and ranking suffix are not implemented.

- [ ] **Step 3: Store public IDs in client session**

In `ui/network/session-seat.ts`, normalize and store:

```ts
const IdentityContract = require('../../shared/player-identity-contract');

state.playerId = IdentityContract.normalizePlayerId(payload.playerId);
state.seatPlayerIds = IdentityContract.normalizeSeatPlayerIds(payload.seatPlayerIds);
```

Reset to:

```ts
state.playerId = null;
state.seatPlayerIds = { black: '', white: '' };
```

Expose getters from `ui/network-client.ts`:

```ts
function getPlayerId() {
    return state.playerId || (PlayerIdentityModule && PlayerIdentityModule.getPlayerId ? PlayerIdentityModule.getPlayerId() : null);
}

function getSeatPlayerIds() {
    return Object.assign({ black: '', white: '' }, state.seatPlayerIds || {});
}
```

- [ ] **Step 4: Render short ID suffix beside ranking names**

In `ui/handlers/match-mode/leaderboard-controller.ts`, require the contract:

```ts
const PlayerIdentityContract = require('../../shared/player-identity-contract');
```

Replace `createLeaderboardNameLabel()` with:

```ts
    function createLeaderboardNameLabel(entry: any, duplicateNames: any) {
        const name = document.createElement('span');
        name.className = 'leaderboard-name';

        const text = document.createElement('span');
        text.className = 'leaderboard-name-text';
        text.textContent = normalizePlayerName(entry.playerName) || DEFAULT_PLAYER_NAME;
        name.appendChild(text);

        const playerId = PlayerIdentityContract.normalizePlayerId(entry && entry.playerId);
        const suffixText = PlayerIdentityContract.formatShortPlayerId(playerId);
        if (suffixText) {
            const id = document.createElement('span');
            id.className = 'leaderboard-name-id';
            id.textContent = suffixText;
            id.title = `playerId: ${playerId}`;
            id.setAttribute('aria-label', `playerId ${playerId}`);
            name.appendChild(id);
        }

        return name;
    }
```

Do not add a new leaderboard table column.

- [ ] **Step 5: Add compact suffix CSS**

In `styles-leaderboard.css`, merge these declarations into existing `.leaderboard-name` rules:

```css
.leaderboard-name {
    display: inline-flex;
    align-items: baseline;
    gap: calc(8px * var(--layout-stage-scale));
    min-width: 0;
}

.leaderboard-name-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.leaderboard-name-id {
    flex: 0 0 auto;
    color: rgba(125, 247, 255, 0.62);
    font-family: var(--selected-app-font-readable-family);
    font-size: calc(14px * var(--layout-stage-scale));
    font-weight: 700;
    letter-spacing: 0;
    line-height: 1;
}

.leaderboard-podium-name .leaderboard-name-id {
    font-size: calc(13px * var(--layout-stage-scale));
    color: rgba(240, 198, 107, 0.72);
}
```

- [ ] **Step 6: Verify client state and display**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.network-session-lifecycle.test.ts test/ui.match-mode.leaderboard-limit.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit client state and display**

Run:

```powershell
git diff -- ui/network/session-seat.ts ui/network-client.ts ui/handlers/match-mode/leaderboard-controller.ts styles-leaderboard.css test/ui.network-session-lifecycle.test.ts test/ui.match-mode.leaderboard-limit.test.ts
git diff --check -- ui/network/session-seat.ts ui/network-client.ts ui/handlers/match-mode/leaderboard-controller.ts styles-leaderboard.css test/ui.network-session-lifecycle.test.ts test/ui.match-mode.leaderboard-limit.test.ts
git add -- ui/network/session-seat.ts ui/network-client.ts ui/handlers/match-mode/leaderboard-controller.ts styles-leaderboard.css test/ui.network-session-lifecycle.test.ts test/ui.match-mode.leaderboard-limit.test.ts
git commit -m "Show server issued player ids in ranking"
```

## Task 7: Generated Browser And Worker Surfaces

**Files:**

- Generated: `public/module-registry.js`
- Generated mirror: `worker-public/**`

- [ ] **Step 1: Run focused source tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/shared.player-identity-contract.test.ts test/ui.player-identity.test.ts test/ui.leaderboard-client.test.ts test/shared.match-entry-payload.test.ts test/ui.network-session-lifecycle.test.ts test/utils.match-authority.player-id.test.ts test/workers.match-player-identity.test.ts test/workers.match-player-id.test.ts test/local-match-server.player-identity.test.ts test/ui.match-mode.leaderboard-limit.test.ts
```

Expected: PASS.

- [ ] **Step 2: Typecheck and build**

Run:

```powershell
npm run typecheck
npm run build:ts
```

Expected: both commands exit 0.

- [ ] **Step 3: Regenerate browser registry**

Run:

```powershell
npm run build:browser
```

Expected: exit 0. Verify:

```powershell
rg -n "shared/player-identity-contract|ui/player-identity" public/module-registry.js
```

Expected: browser-facing modules are present. Worker-only controller does not need to appear in the browser registry.

- [ ] **Step 4: Prepare worker mirror**

Run:

```powershell
npm run worker:prepare
```

Expected: exit 0. Verify:

```powershell
Test-Path worker-public\shared\player-identity-contract.js
rg -n "shared/player-identity-contract|ui/player-identity" worker-public\public\module-registry.js
```

Expected: `Test-Path` prints `True`; registry search finds browser-facing module IDs.

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
git commit -m "Regenerate anonymous identity assets"
```

If `worker-public/**` or `public/module-registry.js` had pre-existing unrelated dirty changes before this task, do not stage those files. Report the exact paths and keep the generated commit unmade.

## Task 8: Final Verification And Documentation Check

**Files:**

- Read: `01-rulebook.md`
- Read: `docs/architecture-contracts.md`
- No planned rulebook change unless implementation adds user-visible recovery UI copy beyond existing ranking/network flows.

- [ ] **Step 1: Confirm docs scope**

Run:

```powershell
rg -n "playerId|playerToken|復元|レート|オートマッチ|ネット対戦" 01-rulebook.md docs/architecture-contracts.md
```

Expected: identify whether the new recovery behavior needs a user-visible note in `01-rulebook.md`. If recovery UI text is added, update `01-rulebook.md`; if only API/storage behavior is added, document in final report that no gameplay rule changed.

- [ ] **Step 2: Run final verification**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/shared.player-identity-contract.test.ts test/ui.player-identity.test.ts test/ui.leaderboard-client.test.ts test/shared.match-entry-payload.test.ts test/ui.network-session-lifecycle.test.ts test/utils.match-authority.player-id.test.ts test/workers.match-player-identity.test.ts test/workers.match-player-id.test.ts test/local-match-server.player-identity.test.ts test/ui.match-mode.leaderboard-limit.test.ts
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

- Server issues `playerId`, `playerToken`, and `recoveryCode`.
- Worker/local server store only hashes for secrets.
- Browser stores credentials locally and can recover with a copied recovery code.
- Network rooms store public `seatPlayerIds` only.
- Leaderboard submit includes `playerToken` for identity verification.
- Ranking UI shows short public ID suffixes beside names.
- `playerId` is public metadata; `playerToken` and `recoveryCode` are secrets.
- Commands run and results.
- Any unrelated dirty files left untouched.

## Self-Review

Spec coverage:

- Server-issued anonymous identity: Task 2.
- Secret token verification: Task 2, Task 3, Task 4, Task 5.
- Recovery code and token rotation: Task 2, Task 3.
- Leaderboard identity submit: Task 3.
- Network create/join identity: Task 4, Task 5.
- Room public `seatPlayerIds`: Task 5, Task 6.
- Ranking name right-side short ID display: Task 6.
- Generated browser/Worker surfaces: Task 7.
- No login/rating/matchmaking implementation: Non-goals and task scope.

Placeholder scan:

- No undecided placeholder markers.
- No open-ended task markers.
- Each code-changing task has exact file paths, concrete snippets, and focused verification commands.

Type consistency:

- Public `playerId` is `string | null` in payloads.
- Private `playerToken` is sent only in request payloads and never projected in public room/state responses.
- `recoveryCode` is returned only from identity create/recover endpoints.
- `seatPlayerIds` is always `{ black: string; white: string }`.
- Invalid credential pairs reject with `PLAYER_ID_TOKEN_INVALID`.

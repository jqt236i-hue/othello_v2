# Player Profile Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a left-menu Profile button and modal where the player can edit local profile data, choose an icon from existing special-stone visuals, view their anonymous playerId, copy/reissue their recovery code, and restore an identity from a recovery code.

**Architecture:** Profile text/avatar data stays local-first in `localStorage` for this milestone; only anonymous identity and recovery-code operations use the existing server-issued player identity system. Recovery-code "作成" is implemented as authenticated reissue by `playerId + playerToken`, not by consuming the current recovery code. The UI is a focused controller wired through the existing bootstrap DOM/event pattern and does not affect gameplay authority.

**Tech Stack:** TypeScript, classic browser bootstrap, DOM controller modules, localStorage, Cloudflare Worker Durable Object identity API, Jest/jsdom, `npm run build:browser`, `npm run worker:prepare`.

---

## Product Decisions

- Add a new left rail button labeled `プロフィール` between `ランキング` and `スキン`.
- The modal has two tabs:
  - `プロフィール`: display name, avatar special-stone image, self introduction.
  - `ID・復元`: current playerId, current recovery code display/copy, recovery-code reissue, recovery-code import.
- Display name remains the shared name used by ranking/network inputs. Saving the profile also writes the name through `LeaderboardClient.setPlayerName()` when available and mirrors it into the network name input if that input is empty.
- Avatar and bio are local-only. They are not sent to ranking, network rooms, snapshots, or SSE in this milestone.
- Recovery-code display is explicit. The code is hidden until the user presses a button.
- Recovery-code reissue requires current `playerId + playerToken`. It creates a new recovery code and invalidates the previous recovery code without changing the public `playerId`.
- Recovery-code import uses the existing recovery endpoint. It rotates both `playerToken` and `recoveryCode`, preserving `playerId`.
- No profile image upload is added. Avatar choices are generated from existing special-stone visual assets.

## File Structure

- Modify `01-rulebook.md`
  - Add player-visible profile modal and recovery-code semantics.
- Modify `index.html`
  - Add the left rail profile button.
  - Add `profileOverlay` / `profileModal` DOM scaffold.
  - Add `styles-profile.css` stylesheet link.
- Create `styles-profile.css`
  - Profile modal layout, tabs, avatar grid, ID/recovery controls.
- Create `ui/player-profile.ts`
  - Local profile storage, normalization, save/load/update, shared-name sync helpers.
- Create `ui/player-profile.js`
  - Runtime wrapper for TS/Jest and dist.
- Create `ui/player-profile-avatar-options.ts`
  - Build avatar choices from `shared/special-stone-registry` and `ui/visual-effects-map`.
- Create `ui/player-profile-avatar-options.js`
  - Runtime wrapper.
- Create `ui/player-profile-panel.ts`
  - DOM controller for opening/closing modal, tabs, profile save, avatar selection, ID/recovery buttons.
- Create `ui/player-profile-panel.js`
  - Runtime wrapper.
- Modify `ui/player-identity.ts`
  - Add authenticated recovery-code reissue helper.
  - Export `getRecoveryCode()` and `regenerateRecoveryCode()`.
- Modify `workers/match-worker-player-identity.ts`
  - Add `handleRegenerateRecovery()` using `playerId + playerToken`.
- Modify `workers/match-worker.ts`
  - Add internal DO route for `/api/player/identity/recovery/regenerate`.
- Modify `workers/match-worker-api.ts`
  - Forward public `/api/player/identity/recovery/regenerate` to the identity room.
- Modify `scripts/local-match-server.ts`
  - Add local dev equivalent of `/api/player/identity/recovery/regenerate`.
- Modify `ui/bootstrap/init-dom.ts`
  - Add profile DOM refs.
- Modify `ui/bootstrap/init-events.ts`
  - Wire `setupPlayerProfilePanel()`.
- Modify `ui/handlers/init.ts`
  - Keep the init type surface aligned.
- Add tests:
  - `test/ui.player-profile.test.ts`
  - `test/ui.player-profile-avatar-options.test.ts`
  - `test/ui.player-profile-panel.test.ts`
  - Extend `test/ui.player-identity.test.ts`
  - Extend `test/workers.match-player-identity.test.ts`
  - Extend `test/local-match-server.player-identity.test.ts`
- Generated/mirror outputs:
  - `public/module-registry.js`
  - `public/module-registry.optional.js`
  - `worker-public/**` files produced by `npm run worker:prepare`

---

### Task 1: Document Profile and Recovery Semantics

**Files:**
- Modify: `01-rulebook.md`

- [ ] **Step 1: Add player-facing spec text**

Add a short section near the ranking/network identity description:

```markdown
### プロフィール

- 左メニューの「プロフィール」から、表示名、プロフィール画像、自己紹介を編集できる。
- 表示名はランキングとネット対戦の名前入力にも使われる。プロフィール画像と自己紹介はこの端末に保存され、対戦相手やランキングには送信されない。
- プロフィール画像は既存の特殊石画像から選ぶ。

### プレイヤーIDと復元コード

- プレイヤーIDはサーバーが発行する匿名IDで、ランキングや将来の対戦機能の本人識別に使う。
- 復元コードは別端末やブラウザデータ消去後に同じプレイヤーIDを取り戻すための秘密コード。
- 復元コードを再発行すると、古い復元コードは無効になり、新しい復元コードだけが有効になる。
- 復元コードを読み込むと同じプレイヤーIDを復元し、本人確認用 token と復元コードを新しく発行する。
```

- [ ] **Step 2: Inspect docs diff**

Run:

```powershell
git diff -- 01-rulebook.md
```

Expected: only the new profile/recovery section is changed.

- [ ] **Step 3: Commit docs**

Run:

```powershell
git add -- 01-rulebook.md
git commit -m "Document profile and recovery UI"
```

Expected: one docs-only commit.

---

### Task 2: Add Recovery-Code Reissue API

**Files:**
- Modify: `workers/match-worker-player-identity.ts`
- Modify: `workers/match-worker.ts`
- Modify: `workers/match-worker-api.ts`
- Modify: `scripts/local-match-server.ts`
- Test: `test/workers.match-player-identity.test.ts`
- Test: `test/local-match-server.player-identity.test.ts`

- [ ] **Step 1: Write Worker test for authenticated reissue**

Add this test to `test/workers.match-player-identity.test.ts`:

```ts
test('recovery code can be reissued with current player token without changing playerId', () => {
  const result = runWorkerScenario(`
  const createResponse = await worker.fetch(new Request('https://worker/api/player/identity/create', { method: 'POST' }), env);
  const created = await createResponse.json();

  const reissueResponse = await worker.fetch(new Request('https://worker/api/player/identity/recovery/regenerate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: created.playerId, playerToken: created.playerToken })
  }), env);
  const reissued = await reissueResponse.json();

  const oldRecoverResponse = await worker.fetch(new Request('https://worker/api/player/identity/recover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recoveryCode: created.recoveryCode })
  }), env);
  const oldRecover = await oldRecoverResponse.json();

  const newRecoverResponse = await worker.fetch(new Request('https://worker/api/player/identity/recover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recoveryCode: reissued.recoveryCode })
  }), env);
  const newRecover = await newRecoverResponse.json();

  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({
    created,
    reissueStatus: reissueResponse.status,
    reissued,
    oldRecoverStatus: oldRecoverResponse.status,
    oldRecover,
    newRecoverStatus: newRecoverResponse.status,
    newRecover
  }));
`);

  expect(result.reissueStatus).toBe(200);
  expect(result.reissued.playerId).toBe(result.created.playerId);
  expect(result.reissued.recoveryCode).toMatch(/^CR-[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}$/);
  expect(result.reissued.recoveryCode).not.toBe(result.created.recoveryCode);
  expect(result.oldRecoverStatus).toBe(403);
  expect(result.oldRecover.reason).toBe('RECOVERY_CODE_INVALID');
  expect(result.newRecoverStatus).toBe(200);
  expect(result.newRecover.playerId).toBe(result.created.playerId);
});
```

- [ ] **Step 2: Run Worker test and verify failure**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/workers.match-player-identity.test.ts
```

Expected: FAIL because `/api/player/identity/recovery/regenerate` is not implemented.

- [ ] **Step 3: Add Worker controller method**

In `workers/match-worker-player-identity.ts`, add:

```ts
async function handleRegenerateRecovery(body: Record<string, unknown>): Promise<Response> {
    const playerId = Contract.normalizePlayerId(body.playerId);
    const playerToken = Contract.normalizePlayerToken(body.playerToken);
    if (!playerId || !playerToken) {
        return cfg.jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
    }

    const record = await loadRecord(playerId);
    const tokenHash = await sha256Hex(playerToken, cryptoLike);
    if (!record || !equalHex(record.tokenHash, tokenHash)) {
        return cfg.jsonResponse(403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
    }

    const previousRecoveryHash = record.recoveryHash;
    const recoveryCode = makeRecoveryCode(cryptoLike);
    record.recoveryHash = await sha256Hex(recoveryCode, cryptoLike);
    record.updatedAt = now();
    record.lastSeenAt = record.updatedAt;
    await saveRecord(record);
    await deleteRecoveryIndex(previousRecoveryHash);
    await saveRecoveryIndex(record.recoveryHash, playerId);
    return cfg.jsonResponse(200, {
        ok: true,
        playerId,
        recoveryCode,
        serverTime: record.updatedAt
    });
}
```

Add it to the returned object:

```ts
return {
    handleCreate,
    handleVerify,
    handleRecover,
    handleRegenerateRecovery
};
```

- [ ] **Step 4: Add Worker routes**

In `workers/match-worker.ts`, add the internal route beside the other identity routes:

```ts
if (request.method === 'POST' && pathname === '/api/player/identity/recovery/regenerate') {
    const parsed = parseJsonBody(await request.text());
    if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
    return this.getPlayerIdentityController().handleRegenerateRecovery(parsed || {});
}
```

In `workers/match-worker-api.ts`, include the public path in the identity forwarding group:

```ts
pathname === '/api/player/identity/create'
|| pathname === '/api/player/identity/verify'
|| pathname === '/api/player/identity/recover'
|| pathname === '/api/player/identity/recovery/regenerate'
```

- [ ] **Step 5: Add local server equivalent**

In `scripts/local-match-server.ts`, add:

```ts
async function handlePlayerIdentityRegenerateRecovery(req: any, res: any) {
    const body = await parseBody(req);
    const playerId = PlayerIdentityContract.normalizePlayerId(body.playerId);
    const playerToken = PlayerIdentityContract.normalizePlayerToken(body.playerToken);
    if (!playerId || !playerToken) {
        writeJson(res, 403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
        return;
    }
    const record = playerIdentityRecords.get(playerId);
    const tokenHash = sha256HexLocal(playerToken);
    if (!record || !equalHexLocal(String(record.tokenHash || ''), tokenHash)) {
        writeJson(res, 403, { ok: false, reason: 'PLAYER_ID_TOKEN_INVALID' });
        return;
    }
    const recoveryCode = makeLocalRecoveryCode();
    const nowMs = Date.now();
    record.recoveryHash = sha256HexLocal(recoveryCode);
    record.updatedAt = nowMs;
    record.lastSeenAt = nowMs;
    writeJson(res, 200, { ok: true, playerId, recoveryCode, serverTime: nowMs });
}
```

Wire it in the HTTP route table:

```ts
if (req.method === 'POST' && pathname === '/api/player/identity/recovery/regenerate') {
    await handlePlayerIdentityRegenerateRecovery(req, res);
    return;
}
```

- [ ] **Step 6: Add local server test**

Add an equivalent scenario to `test/local-match-server.player-identity.test.ts`:

```ts
test('local server regenerates recovery code with current player token', async () => {
  const created = await postJson('/api/player/identity/create', {});
  const reissued = await postJson('/api/player/identity/recovery/regenerate', {
    playerId: created.data.playerId,
    playerToken: created.data.playerToken
  });
  const oldRecover = await postJson('/api/player/identity/recover', {
    recoveryCode: created.data.recoveryCode
  });
  const newRecover = await postJson('/api/player/identity/recover', {
    recoveryCode: reissued.data.recoveryCode
  });

  expect(reissued.status).toBe(200);
  expect(reissued.data.playerId).toBe(created.data.playerId);
  expect(reissued.data.recoveryCode).not.toBe(created.data.recoveryCode);
  expect(oldRecover.status).toBe(403);
  expect(newRecover.status).toBe(200);
  expect(newRecover.data.playerId).toBe(created.data.playerId);
});
```

- [ ] **Step 7: Run identity backend tests**

Run:

```powershell
npm run build:ts
npx jest --runInBand --runTestsByPath test/workers.match-player-identity.test.ts test/local-match-server.player-identity.test.ts
```

Expected: both suites PASS.

- [ ] **Step 8: Commit backend identity API**

Run:

```powershell
git add -- workers/match-worker-player-identity.ts workers/match-worker.ts workers/match-worker-api.ts scripts/local-match-server.ts test/workers.match-player-identity.test.ts test/local-match-server.player-identity.test.ts
git commit -m "Add recovery code reissue API"
```

Expected: one backend/API commit.

---

### Task 3: Extend Browser Identity Client

**Files:**
- Modify: `ui/player-identity.ts`
- Test: `test/ui.player-identity.test.ts`

- [ ] **Step 1: Write failing client tests**

Add tests to `test/ui.player-identity.test.ts`:

```ts
test('getRecoveryCode reads the stored recovery code without exposing playerToken', () => {
  storage.set('card_reversi_player_identity_v1', JSON.stringify({
    playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
    playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
    recoveryCode: 'CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23'
  }));

  const client = require('../ui/player-identity.js');

  expect(client.getRecoveryCode()).toBe('CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23');
});

test('regenerateRecoveryCode verifies stored identity and stores the new recovery code', async () => {
  storage.set('card_reversi_player_identity_v1', JSON.stringify({
    playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
    playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
    recoveryCode: 'CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23'
  }));
  fetchMock
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001' })
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
        recoveryCode: 'CR-ZYXWV-UTSRQ-PNMKJ-HGFED-CBA32'
      })
    });

  const client = require('../ui/player-identity.js');
  const identity = await client.regenerateRecoveryCode();

  expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://card.example/api/player/identity/recovery/regenerate', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({
      playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
      playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12'
    })
  }));
  expect(identity).toEqual({
    playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
    playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
    recoveryCode: 'CR-ZYXWV-UTSRQ-PNMKJ-HGFED-CBA32'
  });
  expect(JSON.parse(storage.get('card_reversi_player_identity_v1') || '{}').recoveryCode).toBe('CR-ZYXWV-UTSRQ-PNMKJ-HGFED-CBA32');
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.player-identity.test.ts
```

Expected: FAIL because `getRecoveryCode` and `regenerateRecoveryCode` are missing.

- [ ] **Step 3: Implement browser helpers**

In `ui/player-identity.ts`, add:

```ts
function getRecoveryCode(): string | null {
  const identity = readStoredIdentity();
  return identity ? identity.recoveryCode : null;
}

async function regenerateRecoveryCode(options?: any): Promise<StoredPlayerIdentity> {
  const stored = await ensurePlayerIdentity(options);
  const res = await requestJson('POST', '/api/player/identity/recovery/regenerate', {
    playerId: stored.playerId,
    playerToken: stored.playerToken
  }, options);
  const recoveryCode = res.ok ? Contract.normalizeRecoveryCode(res.data && res.data.recoveryCode) : null;
  if (!recoveryCode) {
    throw new Error(String(res.reason || 'PLAYER_IDENTITY_RECOVERY_REGENERATE_FAILED'));
  }
  const nextIdentity = {
    playerId: stored.playerId,
    playerToken: stored.playerToken,
    recoveryCode
  };
  const written = writeStoredIdentity(nextIdentity);
  if (!written) throw new Error('PLAYER_IDENTITY_RECOVERY_STORE_FAILED');
  return written;
}
```

Export them:

```ts
const PlayerIdentity = {
  PLAYER_IDENTITY_STORAGE_KEY,
  getPlayerIdentity,
  getPlayerId,
  getRecoveryCode,
  ensurePlayerIdentity,
  createPlayerIdentity,
  recoverPlayerIdentity,
  regenerateRecoveryCode,
  clearStoredIdentity,
  resolveServerBaseUrl
};
```

- [ ] **Step 4: Run client test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.player-identity.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit client identity helpers**

Run:

```powershell
git add -- ui/player-identity.ts test/ui.player-identity.test.ts
git commit -m "Add browser recovery code reissue helper"
```

Expected: one browser identity commit.

---

### Task 4: Add Local Profile Model

**Files:**
- Create: `ui/player-profile.ts`
- Create: `ui/player-profile.js`
- Test: `test/ui.player-profile.test.ts`

- [ ] **Step 1: Write profile model tests**

Create `test/ui.player-profile.test.ts`:

```ts
describe('browser player profile model', () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    jest.resetModules();
    storage = new Map();
    (global as any).localStorage = {
      getItem: jest.fn((key: string) => storage.get(key) || null),
      setItem: jest.fn((key: string, value: string) => void storage.set(key, value)),
      removeItem: jest.fn((key: string) => void storage.delete(key))
    };
  });

  afterEach(() => {
    delete (global as any).localStorage;
  });

  test('normalizes and stores a local profile', () => {
    const profile = require('../ui/player-profile.js');
    const saved = profile.savePlayerProfile({
      displayName: '  abcdefghijk  ',
      avatarStoneType: 'regen',
      bio: 'x'.repeat(140)
    });

    expect(saved.displayName).toBe('abcdefg');
    expect(saved.avatarStoneType).toBe('REGEN');
    expect(saved.bio).toHaveLength(120);
    expect(profile.readPlayerProfile()).toMatchObject(saved);
  });

  test('falls back to default profile when storage is empty', () => {
    const profile = require('../ui/player-profile.js');
    expect(profile.readPlayerProfile()).toMatchObject({
      displayName: '',
      avatarStoneType: 'REGEN',
      bio: ''
    });
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.player-profile.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Create profile model**

Create `ui/player-profile.ts`:

```ts
'use strict';

const PLAYER_PROFILE_STORAGE_KEY = 'card_reversi_player_profile_v1';
const PROFILE_NAME_MAX = 7;
const PROFILE_BIO_MAX = 120;
const DEFAULT_AVATAR_STONE_TYPE = 'REGEN';

type PlayerProfile = {
  displayName: string;
  avatarStoneType: string;
  bio: string;
  updatedAt: number;
};

function canUseStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && !!localStorage;
  } catch (e) {
    return false;
  }
}

function clipByCodePoint(value: unknown, maxLength: number): string {
  return Array.from(String(value || '').replace(/\s+/g, ' ').trim()).slice(0, maxLength).join('');
}

function normalizeDisplayName(value: unknown): string {
  return clipByCodePoint(value, PROFILE_NAME_MAX);
}

function normalizeBio(value: unknown): string {
  return clipByCodePoint(value, PROFILE_BIO_MAX);
}

function normalizeAvatarStoneType(value: unknown): string {
  const normalized = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9_]+$/.test(normalized) ? normalized : DEFAULT_AVATAR_STONE_TYPE;
}

function normalizePlayerProfile(value: unknown): PlayerProfile {
  const source = value && typeof value === 'object' ? value as Partial<PlayerProfile> : {};
  const updatedAt = Number.isFinite(Number(source.updatedAt)) ? Math.max(0, Math.trunc(Number(source.updatedAt))) : 0;
  return {
    displayName: normalizeDisplayName(source.displayName),
    avatarStoneType: normalizeAvatarStoneType(source.avatarStoneType),
    bio: normalizeBio(source.bio),
    updatedAt
  };
}

function readPlayerProfile(): PlayerProfile {
  if (!canUseStorage()) return normalizePlayerProfile(null);
  try {
    const raw = localStorage.getItem(PLAYER_PROFILE_STORAGE_KEY);
    if (!raw) return normalizePlayerProfile(null);
    return normalizePlayerProfile(JSON.parse(raw));
  } catch (e) {
    return normalizePlayerProfile(null);
  }
}

function savePlayerProfile(value: unknown): PlayerProfile {
  const normalized = normalizePlayerProfile(Object.assign({}, value || {}, { updatedAt: Date.now() }));
  if (canUseStorage()) {
    try {
      localStorage.setItem(PLAYER_PROFILE_STORAGE_KEY, JSON.stringify(normalized));
    } catch (e) { /* ignore */ }
  }
  return normalized;
}

function updatePlayerProfile(patch: unknown): PlayerProfile {
  return savePlayerProfile(Object.assign({}, readPlayerProfile(), patch || {}));
}

const PlayerProfile = {
  PLAYER_PROFILE_STORAGE_KEY,
  PROFILE_NAME_MAX,
  PROFILE_BIO_MAX,
  DEFAULT_AVATAR_STONE_TYPE,
  normalizeDisplayName,
  normalizeBio,
  normalizeAvatarStoneType,
  normalizePlayerProfile,
  readPlayerProfile,
  savePlayerProfile,
  updatePlayerProfile
};

try {
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).PlayerProfile = PlayerProfile;
  }
} catch (e) { /* ignore */ }

export = PlayerProfile;
```

Create `ui/player-profile.js`:

```js
'use strict';

module.exports = process.env.JEST_WORKER_ID
  ? require('./player-profile.ts')
  : require('../dist/ui/player-profile');
```

- [ ] **Step 4: Run profile model test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.player-profile.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit profile model**

Run:

```powershell
git add -- ui/player-profile.ts ui/player-profile.js test/ui.player-profile.test.ts
git commit -m "Add local player profile model"
```

Expected: one profile model commit.

---

### Task 5: Add Avatar Options from Special-Stone Visuals

**Files:**
- Create: `ui/player-profile-avatar-options.ts`
- Create: `ui/player-profile-avatar-options.js`
- Test: `test/ui.player-profile-avatar-options.test.ts`

- [ ] **Step 1: Write avatar option tests**

Create `test/ui.player-profile-avatar-options.test.ts`:

```ts
describe('player profile avatar options', () => {
  test('builds avatar options from existing special stone visuals', () => {
    jest.resetModules();
    const optionsModule = require('../ui/player-profile-avatar-options.js');
    const options = optionsModule.getProfileAvatarOptions();

    expect(options.length).toBeGreaterThan(6);
    expect(options[0]).toMatchObject({
      id: expect.any(String),
      stoneType: expect.any(String),
      label: expect.any(String),
      imagePath: expect.stringContaining('assets/images/')
    });
    expect(options.some((option: any) => option.stoneType === 'REGEN')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.player-profile-avatar-options.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Create avatar options module**

Create `ui/player-profile-avatar-options.ts`:

```ts
'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const SpecialStoneRegistry = _require('../shared/special-stone-registry');
const VisualEffectsMap = _require('./visual-effects-map');

const PROFILE_AVATAR_STONE_TYPES = Object.freeze([
  'REGEN',
  'SNIPER',
  'DRAGON',
  'BREEDING',
  'DESTROY_DRAGON',
  'ULTIMATE_DESTROY_GOD',
  'HYPERACTIVE',
  'GLUTTONOUS',
  'TIME_BOMB',
  'TRAP',
  'STONE_SALVATION_GOD',
  'THEORY_INCARNATION',
  'BOARD_EXECUTOR',
  'OBSERVER_WILL',
  'AFTERIMAGE_WILL',
  'WILL_HUNTER_KING'
]);

type ProfileAvatarOption = {
  id: string;
  stoneType: string;
  label: string;
  effectKey: string;
  imagePath: string;
};

function resolveEffectKey(stoneType: string): string {
  if (VisualEffectsMap && typeof VisualEffectsMap.getEffectKeyForSpecialType === 'function') {
    return String(VisualEffectsMap.getEffectKeyForSpecialType(stoneType) || '').trim();
  }
  return '';
}

function resolveImagePath(effectKey: string): string {
  if (!effectKey || !VisualEffectsMap || typeof VisualEffectsMap.getStoneVisualPathsForEffectKey !== 'function') return '';
  const paths = VisualEffectsMap.getStoneVisualPathsForEffectKey(effectKey);
  return Array.isArray(paths) ? String(paths[0] || '').trim() : '';
}

function resolveLabel(stoneType: string): string {
  if (SpecialStoneRegistry && typeof SpecialStoneRegistry.getSpecialStoneDisplayName === 'function') {
    return String(SpecialStoneRegistry.getSpecialStoneDisplayName(stoneType, stoneType) || stoneType);
  }
  return stoneType;
}

function getProfileAvatarOptions(): ProfileAvatarOption[] {
  return PROFILE_AVATAR_STONE_TYPES
    .map((stoneType) => {
      const effectKey = resolveEffectKey(stoneType);
      const imagePath = resolveImagePath(effectKey);
      return {
        id: `stone:${stoneType}`,
        stoneType,
        label: resolveLabel(stoneType),
        effectKey,
        imagePath
      };
    })
    .filter((option) => !!option.effectKey && !!option.imagePath);
}

const PlayerProfileAvatarOptions = {
  PROFILE_AVATAR_STONE_TYPES,
  getProfileAvatarOptions
};

try {
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).PlayerProfileAvatarOptions = PlayerProfileAvatarOptions;
  }
} catch (e) { /* ignore */ }

export = PlayerProfileAvatarOptions;
```

Create `ui/player-profile-avatar-options.js`:

```js
'use strict';

module.exports = process.env.JEST_WORKER_ID
  ? require('./player-profile-avatar-options.ts')
  : require('../dist/ui/player-profile-avatar-options');
```

- [ ] **Step 4: Run avatar options test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.player-profile-avatar-options.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit avatar options**

Run:

```powershell
git add -- ui/player-profile-avatar-options.ts ui/player-profile-avatar-options.js test/ui.player-profile-avatar-options.test.ts
git commit -m "Add profile avatar options"
```

Expected: one avatar options commit.

---

### Task 6: Add Profile Modal DOM and Styling

**Files:**
- Modify: `index.html`
- Create: `styles-profile.css`

- [ ] **Step 1: Add stylesheet link**

In `index.html`, add the stylesheet with the other CSS links:

```html
<link rel="stylesheet" href="styles-profile.css">
```

- [ ] **Step 2: Add left rail button**

Insert this button after `leaderboardOpenBtn`:

```html
<button id="profileOpenBtn" class="btn-small left-action-btn" type="button" aria-controls="profileOverlay" aria-expanded="false">
    <span class="left-action-icon left-action-icon-profile" aria-hidden="true"></span>
    <span class="left-action-label">プロフィール</span>
</button>
```

- [ ] **Step 3: Add profile modal scaffold**

Insert this modal after `leaderboardOverlay`:

```html
<div id="profileOverlay" aria-hidden="true">
    <div id="profileModal" role="dialog" aria-modal="true" aria-label="プロフィール">
        <div id="profileModalHeader">
            <div class="profile-title">プロフィール</div>
            <button id="profileCloseBtn" class="btn-small" type="button" aria-label="プロフィールを閉じる">×</button>
        </div>
        <div id="profileModalBody">
            <div id="profileTabs" role="tablist" aria-label="プロフィール設定">
                <button id="profileTabProfile" class="profile-tab is-active" type="button" role="tab" aria-selected="true" aria-controls="profileEditSection">プロフィール</button>
                <button id="profileTabIdentity" class="profile-tab" type="button" role="tab" aria-selected="false" aria-controls="profileIdentitySection">ID・復元</button>
            </div>
            <section id="profileEditSection" class="profile-section is-active" role="tabpanel" aria-labelledby="profileTabProfile">
                <div class="profile-preview">
                    <div id="profileAvatarPreview" class="profile-avatar-preview" aria-hidden="true"></div>
                    <div>
                        <label for="profileNameInput">名前</label>
                        <input id="profileNameInput" type="text" maxlength="7" autocomplete="off" spellcheck="false">
                    </div>
                </div>
                <div>
                    <div class="profile-field-label">プロフィール画像</div>
                    <div id="profileAvatarOptions" class="profile-avatar-options" role="radiogroup" aria-label="プロフィール画像"></div>
                </div>
                <div>
                    <label for="profileBioInput">自己紹介</label>
                    <textarea id="profileBioInput" maxlength="120" rows="4" spellcheck="false"></textarea>
                </div>
                <div class="profile-actions">
                    <button id="profileSaveBtn" class="btn-small" type="button">保存</button>
                </div>
            </section>
            <section id="profileIdentitySection" class="profile-section" role="tabpanel" aria-labelledby="profileTabIdentity" hidden>
                <div class="profile-identity-row">
                    <span>プレイヤーID</span>
                    <code id="profilePlayerIdText">未作成</code>
                    <button id="profileEnsureIdentityBtn" class="btn-small" type="button">ID確認</button>
                </div>
                <div class="profile-identity-row">
                    <label for="profileRecoveryCodeOutput">復元コード</label>
                    <input id="profileRecoveryCodeOutput" type="text" readonly value="" aria-label="復元コード 未表示">
                    <button id="profileRevealRecoveryBtn" class="btn-small" type="button">表示</button>
                    <button id="profileCopyRecoveryBtn" class="btn-small" type="button">コピー</button>
                    <button id="profileRegenerateRecoveryBtn" class="btn-small" type="button">再発行</button>
                </div>
                <div class="profile-identity-row">
                    <label for="profileRecoveryCodeInput">復元コード読み込み</label>
                    <input id="profileRecoveryCodeInput" type="text" autocomplete="off" spellcheck="false" aria-label="復元コード入力 例 CR-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX">
                    <button id="profileRecoverIdentityBtn" class="btn-small" type="button">読み込み</button>
                </div>
                <div id="profileIdentityStatus" aria-live="polite"></div>
            </section>
        </div>
    </div>
</div>
```

- [ ] **Step 4: Create profile CSS**

Create `styles-profile.css`:

```css
#profileOverlay {
  position: fixed;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.62);
  z-index: 2100;
}

#profileOverlay.is-open {
  display: flex;
}

#profileModal {
  width: min(760px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow: hidden;
  border: 1px solid rgba(214, 169, 77, 0.72);
  background: rgba(5, 20, 18, 0.96);
  color: #f5e6bc;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55);
}

#profileModalHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(214, 169, 77, 0.42);
}

.profile-title {
  font-size: 20px;
  font-weight: 700;
}

#profileModalBody {
  padding: 16px;
  overflow: auto;
  max-height: calc(100vh - 104px);
}

#profileTabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 14px;
}

.profile-tab {
  min-height: 36px;
  border: 1px solid rgba(214, 169, 77, 0.46);
  background: rgba(7, 26, 24, 0.92);
  color: #f5e6bc;
}

.profile-tab.is-active {
  border-color: rgba(87, 255, 236, 0.85);
  box-shadow: inset 0 0 16px rgba(87, 255, 236, 0.22);
}

.profile-section {
  display: none;
}

.profile-section.is-active {
  display: grid;
  gap: 14px;
}

.profile-preview {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
}

.profile-avatar-preview,
.profile-avatar-option-thumb {
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.36);
  border: 1px solid rgba(214, 169, 77, 0.46);
  background-size: 76%;
  background-position: center;
  background-repeat: no-repeat;
}

.profile-avatar-preview {
  width: 64px;
  height: 64px;
}

#profileNameInput,
#profileBioInput,
#profileRecoveryCodeOutput,
#profileRecoveryCodeInput {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(214, 169, 77, 0.42);
  background: rgba(0, 0, 0, 0.28);
  color: #f8edcf;
}

#profileNameInput,
#profileRecoveryCodeOutput,
#profileRecoveryCodeInput {
  min-height: 36px;
  padding: 7px 10px;
}

#profileBioInput {
  resize: vertical;
  min-height: 88px;
  padding: 9px 10px;
}

.profile-avatar-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(74px, 1fr));
  gap: 8px;
}

.profile-avatar-option {
  display: grid;
  gap: 6px;
  justify-items: center;
  min-height: 82px;
  padding: 8px 6px;
  border: 1px solid rgba(214, 169, 77, 0.34);
  background: rgba(5, 17, 16, 0.85);
  color: #f5e6bc;
}

.profile-avatar-option.is-active {
  border-color: rgba(87, 255, 236, 0.86);
  box-shadow: inset 0 0 16px rgba(87, 255, 236, 0.2);
}

.profile-avatar-option-thumb {
  width: 38px;
  height: 38px;
}

.profile-avatar-option-label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.profile-actions,
.profile-identity-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.profile-identity-row code {
  padding: 6px 8px;
  border: 1px solid rgba(214, 169, 77, 0.34);
  background: rgba(0, 0, 0, 0.28);
  color: #f8edcf;
}

#profileIdentityStatus {
  min-height: 20px;
  color: #d8f3dc;
}

.left-action-icon-profile::before {
  content: "●";
  font-size: 18px;
}
```

- [ ] **Step 5: Inspect visual diff by source**

Run:

```powershell
git diff -- index.html styles-profile.css
```

Expected: profile button, modal scaffold, and stylesheet only.

- [ ] **Step 6: Commit DOM and CSS**

Run:

```powershell
git add -- index.html styles-profile.css
git commit -m "Add profile panel shell"
```

Expected: one UI shell commit.

---

### Task 7: Implement Profile Panel Controller

**Files:**
- Create: `ui/player-profile-panel.ts`
- Create: `ui/player-profile-panel.js`
- Modify: `ui/bootstrap/init-dom.ts`
- Modify: `ui/bootstrap/init-events.ts`
- Modify: `ui/handlers/init.ts`
- Test: `test/ui.player-profile-panel.test.ts`

- [ ] **Step 1: Write controller test**

Create `test/ui.player-profile-panel.test.ts`:

```ts
describe('player profile panel controller', () => {
  let profileStore: any;
  let identityStore: any;

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <button id="profileOpenBtn"></button>
      <div id="profileOverlay" aria-hidden="true">
        <div id="profileModal">
          <button id="profileCloseBtn"></button>
          <button id="profileTabProfile"></button>
          <button id="profileTabIdentity"></button>
          <section id="profileEditSection"></section>
          <section id="profileIdentitySection" hidden></section>
          <div id="profileAvatarPreview"></div>
          <input id="profileNameInput">
          <div id="profileAvatarOptions"></div>
          <textarea id="profileBioInput"></textarea>
          <button id="profileSaveBtn"></button>
          <code id="profilePlayerIdText"></code>
          <button id="profileEnsureIdentityBtn"></button>
          <input id="profileRecoveryCodeOutput">
          <button id="profileRevealRecoveryBtn"></button>
          <button id="profileCopyRecoveryBtn"></button>
          <button id="profileRegenerateRecoveryBtn"></button>
          <input id="profileRecoveryCodeInput">
          <button id="profileRecoverIdentityBtn"></button>
          <div id="profileIdentityStatus"></div>
          <input id="networkPlayerNameInput">
          <input id="leaderboardNameInput">
        </div>
      </div>
    `;
    profileStore = {
      displayName: '',
      avatarStoneType: 'REGEN',
      bio: '',
      updatedAt: 0
    };
    identityStore = {
      playerId: 'p_ABCDEFGHIJKLMNOPQRSTUV0001',
      playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno12',
      recoveryCode: 'CR-ABCDE-FGHJK-MNPQR-STUVW-XYZ23'
    };
    jest.doMock('../ui/player-profile', () => ({
      readPlayerProfile: jest.fn(() => profileStore),
      savePlayerProfile: jest.fn((next: any) => {
        profileStore = Object.assign({}, profileStore, next);
        return profileStore;
      }),
      normalizeDisplayName: jest.fn((value: any) => String(value || '').trim().slice(0, 7)),
      normalizeBio: jest.fn((value: any) => String(value || '').trim().slice(0, 120))
    }));
    jest.doMock('../ui/player-profile-avatar-options', () => ({
      getProfileAvatarOptions: jest.fn(() => [
        { id: 'stone:REGEN', stoneType: 'REGEN', label: '復活石', imagePath: 'assets/images/special-stones/regen_stone-black.png' },
        { id: 'stone:SNIPER', stoneType: 'SNIPER', label: '狙撃石', imagePath: 'assets/images/special-stones/sna-black.png' }
      ])
    }));
    jest.doMock('../ui/player-identity', () => ({
      getPlayerId: jest.fn(() => identityStore.playerId),
      getRecoveryCode: jest.fn(() => identityStore.recoveryCode),
      ensurePlayerIdentity: jest.fn(async () => identityStore),
      regenerateRecoveryCode: jest.fn(async () => {
        identityStore = Object.assign({}, identityStore, { recoveryCode: 'CR-ZYXWV-UTSRQ-PNMKJ-HGFED-CBA32' });
        return identityStore;
      }),
      recoverPlayerIdentity: jest.fn(async () => {
        identityStore = Object.assign({}, identityStore, { recoveryCode: 'CR-HHHHH-JJJJJ-KKKKK-MMMMM-NNNNN' });
        return identityStore;
      })
    }));
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn(async () => undefined) }
    });
  });

  test('opens, saves profile fields, and updates identity controls', async () => {
    const panel = require('../ui/player-profile-panel.js');
    panel.setupPlayerProfilePanel({ root: window });

    document.getElementById('profileOpenBtn')!.click();
    expect(document.getElementById('profileOverlay')!.classList.contains('is-open')).toBe(true);

    (document.getElementById('profileNameInput') as HTMLInputElement).value = 'さかな';
    (document.getElementById('profileBioInput') as HTMLTextAreaElement).value = 'よろしく';
    (document.querySelector('[data-avatar-stone-type="SNIPER"]') as HTMLButtonElement).click();
    document.getElementById('profileSaveBtn')!.click();

    expect(profileStore).toMatchObject({ displayName: 'さかな', avatarStoneType: 'SNIPER', bio: 'よろしく' });

    await (document.getElementById('profileEnsureIdentityBtn') as HTMLButtonElement).click();
    expect(document.getElementById('profilePlayerIdText')!.textContent).toBe('p_ABCDEFGHIJKLMNOPQRSTUV0001');
  });
});
```

- [ ] **Step 2: Run controller test and verify failure**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.player-profile-panel.test.ts
```

Expected: FAIL because the panel module does not exist.

- [ ] **Step 3: Create panel controller**

Create `ui/player-profile-panel.ts` with these exported boundaries:

```ts
'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const PlayerProfile = _require('./player-profile');
const AvatarOptions = _require('./player-profile-avatar-options');
const PlayerIdentity = _require('./player-identity');

function text(value: unknown): string {
  return String(value || '');
}

function setStatus(el: HTMLElement | null, message: string, isError = false): void {
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? '#ffb4b4' : '#d8f3dc';
}

function setupPlayerProfilePanel(opts?: any): any {
  const root = opts && opts.root ? opts.root : (typeof window !== 'undefined' ? window : null);
  const doc = root && root.document ? root.document : (typeof document !== 'undefined' ? document : null);
  if (!doc) return { ok: false, reason: 'DOCUMENT_UNAVAILABLE' };

  const refs = {
    openBtn: doc.getElementById('profileOpenBtn') as HTMLElement | null,
    overlay: doc.getElementById('profileOverlay') as HTMLElement | null,
    closeBtn: doc.getElementById('profileCloseBtn') as HTMLElement | null,
    tabProfile: doc.getElementById('profileTabProfile') as HTMLElement | null,
    tabIdentity: doc.getElementById('profileTabIdentity') as HTMLElement | null,
    editSection: doc.getElementById('profileEditSection') as HTMLElement | null,
    identitySection: doc.getElementById('profileIdentitySection') as HTMLElement | null,
    avatarPreview: doc.getElementById('profileAvatarPreview') as HTMLElement | null,
    nameInput: doc.getElementById('profileNameInput') as HTMLInputElement | null,
    avatarOptions: doc.getElementById('profileAvatarOptions') as HTMLElement | null,
    bioInput: doc.getElementById('profileBioInput') as HTMLTextAreaElement | null,
    saveBtn: doc.getElementById('profileSaveBtn') as HTMLElement | null,
    playerIdText: doc.getElementById('profilePlayerIdText') as HTMLElement | null,
    ensureIdentityBtn: doc.getElementById('profileEnsureIdentityBtn') as HTMLElement | null,
    recoveryOutput: doc.getElementById('profileRecoveryCodeOutput') as HTMLInputElement | null,
    revealRecoveryBtn: doc.getElementById('profileRevealRecoveryBtn') as HTMLElement | null,
    copyRecoveryBtn: doc.getElementById('profileCopyRecoveryBtn') as HTMLElement | null,
    regenerateRecoveryBtn: doc.getElementById('profileRegenerateRecoveryBtn') as HTMLElement | null,
    recoveryInput: doc.getElementById('profileRecoveryCodeInput') as HTMLInputElement | null,
    recoverIdentityBtn: doc.getElementById('profileRecoverIdentityBtn') as HTMLElement | null,
    status: doc.getElementById('profileIdentityStatus') as HTMLElement | null,
    leaderboardNameInput: doc.getElementById('leaderboardNameInput') as HTMLInputElement | null,
    networkPlayerNameInput: doc.getElementById('networkPlayerNameInput') as HTMLInputElement | null
  };

  let activeAvatarStoneType = 'REGEN';

  function setOpen(open: boolean): void {
    if (!refs.overlay) return;
    refs.overlay.classList.toggle('is-open', open);
    refs.overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (refs.openBtn) refs.openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) syncFromProfile();
  }

  function setActiveTab(tab: 'profile' | 'identity'): void {
    const identity = tab === 'identity';
    refs.tabProfile && refs.tabProfile.classList.toggle('is-active', !identity);
    refs.tabIdentity && refs.tabIdentity.classList.toggle('is-active', identity);
    refs.tabProfile && refs.tabProfile.setAttribute('aria-selected', identity ? 'false' : 'true');
    refs.tabIdentity && refs.tabIdentity.setAttribute('aria-selected', identity ? 'true' : 'false');
    refs.editSection && refs.editSection.classList.toggle('is-active', !identity);
    refs.identitySection && refs.identitySection.classList.toggle('is-active', identity);
    if (refs.editSection) refs.editSection.hidden = identity;
    if (refs.identitySection) refs.identitySection.hidden = !identity;
  }

  function applyAvatarPreview(stoneType: string): void {
    activeAvatarStoneType = String(stoneType || 'REGEN').toUpperCase();
    const option = AvatarOptions.getProfileAvatarOptions().find((item: any) => item.stoneType === activeAvatarStoneType);
    if (refs.avatarPreview) {
      refs.avatarPreview.style.backgroundImage = option && option.imagePath ? `url("${option.imagePath}")` : '';
    }
    if (refs.avatarOptions) {
      Array.from(refs.avatarOptions.querySelectorAll('.profile-avatar-option')).forEach((button: any) => {
        const active = button.dataset && button.dataset.avatarStoneType === activeAvatarStoneType;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-checked', active ? 'true' : 'false');
      });
    }
  }

  function renderAvatarOptions(): void {
    if (!refs.avatarOptions) return;
    refs.avatarOptions.innerHTML = '';
    AvatarOptions.getProfileAvatarOptions().forEach((option: any) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'profile-avatar-option';
      button.dataset.avatarStoneType = option.stoneType;
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-label', option.label);
      const thumb = doc.createElement('span');
      thumb.className = 'profile-avatar-option-thumb';
      thumb.style.backgroundImage = option.imagePath ? `url("${option.imagePath}")` : '';
      const label = doc.createElement('span');
      label.className = 'profile-avatar-option-label';
      label.textContent = option.label;
      button.appendChild(thumb);
      button.appendChild(label);
      button.addEventListener('click', () => applyAvatarPreview(option.stoneType));
      refs.avatarOptions!.appendChild(button);
    });
  }

  function syncFromProfile(): void {
    renderAvatarOptions();
    const profile = PlayerProfile.readPlayerProfile();
    if (refs.nameInput) refs.nameInput.value = text(profile.displayName);
    if (refs.bioInput) refs.bioInput.value = text(profile.bio);
    applyAvatarPreview(profile.avatarStoneType);
    syncIdentityDisplay(false);
  }

  function saveProfile(): void {
    const saved = PlayerProfile.savePlayerProfile({
      displayName: refs.nameInput ? refs.nameInput.value : '',
      avatarStoneType: activeAvatarStoneType,
      bio: refs.bioInput ? refs.bioInput.value : ''
    });
    if (refs.nameInput) refs.nameInput.value = saved.displayName;
    if (refs.bioInput) refs.bioInput.value = saved.bio;
    if (refs.leaderboardNameInput) refs.leaderboardNameInput.value = saved.displayName;
    if (refs.networkPlayerNameInput && !refs.networkPlayerNameInput.value.trim()) refs.networkPlayerNameInput.value = saved.displayName;
    try {
      if (root && root.LeaderboardClient && typeof root.LeaderboardClient.setPlayerName === 'function') {
        root.LeaderboardClient.setPlayerName(saved.displayName);
      }
    } catch (e) { /* ignore */ }
    setStatus(refs.status, 'プロフィールを保存しました');
  }

  function syncIdentityDisplay(showRecovery: boolean): void {
    const playerId = PlayerIdentity.getPlayerId ? PlayerIdentity.getPlayerId() : null;
    if (refs.playerIdText) refs.playerIdText.textContent = playerId || '未作成';
    if (refs.recoveryOutput) refs.recoveryOutput.value = showRecovery && PlayerIdentity.getRecoveryCode ? (PlayerIdentity.getRecoveryCode() || '') : '';
  }

  async function ensureIdentity(): Promise<void> {
    try {
      await PlayerIdentity.ensurePlayerIdentity();
      syncIdentityDisplay(false);
      setStatus(refs.status, 'プレイヤーIDを確認しました');
    } catch (e) {
      setStatus(refs.status, 'プレイヤーIDを確認できませんでした', true);
    }
  }

  async function revealRecovery(): Promise<void> {
    try {
      await PlayerIdentity.ensurePlayerIdentity();
      syncIdentityDisplay(true);
      setStatus(refs.status, '復元コードを表示しました');
    } catch (e) {
      setStatus(refs.status, '復元コードを表示できませんでした', true);
    }
  }

  async function copyRecovery(): Promise<void> {
    const value = refs.recoveryOutput ? refs.recoveryOutput.value.trim() : '';
    if (!value) {
      setStatus(refs.status, '先に復元コードを表示してください', true);
      return;
    }
    try {
      await root.navigator.clipboard.writeText(value);
      setStatus(refs.status, '復元コードをコピーしました');
    } catch (e) {
      setStatus(refs.status, 'コピーできませんでした', true);
    }
  }

  async function regenerateRecovery(): Promise<void> {
    try {
      await PlayerIdentity.regenerateRecoveryCode();
      syncIdentityDisplay(true);
      setStatus(refs.status, '復元コードを再発行しました。古いコードは無効です');
    } catch (e) {
      setStatus(refs.status, '復元コードを再発行できませんでした', true);
    }
  }

  async function recoverIdentity(): Promise<void> {
    const code = refs.recoveryInput ? refs.recoveryInput.value : '';
    try {
      await PlayerIdentity.recoverPlayerIdentity(code);
      if (refs.recoveryInput) refs.recoveryInput.value = '';
      syncIdentityDisplay(true);
      setStatus(refs.status, 'プレイヤーIDを復元しました');
    } catch (e) {
      setStatus(refs.status, '復元コードを読み込めませんでした', true);
    }
  }

  refs.openBtn && refs.openBtn.addEventListener('click', () => setOpen(true));
  refs.closeBtn && refs.closeBtn.addEventListener('click', () => setOpen(false));
  refs.overlay && refs.overlay.addEventListener('click', (event: any) => {
    if (event && event.target === refs.overlay) setOpen(false);
  });
  refs.tabProfile && refs.tabProfile.addEventListener('click', () => setActiveTab('profile'));
  refs.tabIdentity && refs.tabIdentity.addEventListener('click', () => setActiveTab('identity'));
  refs.saveBtn && refs.saveBtn.addEventListener('click', saveProfile);
  refs.ensureIdentityBtn && refs.ensureIdentityBtn.addEventListener('click', () => void ensureIdentity());
  refs.revealRecoveryBtn && refs.revealRecoveryBtn.addEventListener('click', () => void revealRecovery());
  refs.copyRecoveryBtn && refs.copyRecoveryBtn.addEventListener('click', () => void copyRecovery());
  refs.regenerateRecoveryBtn && refs.regenerateRecoveryBtn.addEventListener('click', () => void regenerateRecovery());
  refs.recoverIdentityBtn && refs.recoverIdentityBtn.addEventListener('click', () => void recoverIdentity());

  syncFromProfile();
  setOpen(false);
  return { ok: true, setOpen, syncFromProfile };
}

const PlayerProfilePanel = { setupPlayerProfilePanel };

try {
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).setupPlayerProfilePanel = setupPlayerProfilePanel;
    (globalThis as any).PlayerProfilePanel = PlayerProfilePanel;
  }
} catch (e) { /* ignore */ }

export = PlayerProfilePanel;
```

Create `ui/player-profile-panel.js`:

```js
'use strict';

module.exports = process.env.JEST_WORKER_ID
  ? require('./player-profile-panel.ts')
  : require('../dist/ui/player-profile-panel');
```

- [ ] **Step 4: Wire bootstrap refs and setup**

In `ui/bootstrap/init-dom.ts`, `ui/bootstrap/init-events.ts`, and `ui/handlers/init.ts`, add refs:

```ts
profileOpenBtn: HTMLElement | null;
profileOverlay: HTMLElement | null;
profileCloseBtn: HTMLElement | null;
profileModal: HTMLElement | null;
```

Add DOM lookup in `getInitDomElements()`:

```ts
profileOpenBtn: $('profileOpenBtn'),
profileOverlay: $('profileOverlay'),
profileCloseBtn: $('profileCloseBtn'),
profileModal: $('profileModal'),
```

In `ui/bootstrap/init-events.ts`, add declaration:

```ts
declare const setupPlayerProfilePanel: ((opts: Record<string, unknown>) => unknown) | undefined;
```

Resolve module fallback near the other setup calls:

```ts
let setupPlayerProfilePanelResolved = (typeof setupPlayerProfilePanel === 'function') ? setupPlayerProfilePanel : null;
if (!setupPlayerProfilePanelResolved && typeof _require === 'function') {
  try {
    const profilePanel = _require('../player-profile-panel');
    if (profilePanel && typeof profilePanel.setupPlayerProfilePanel === 'function') {
      setupPlayerProfilePanelResolved = profilePanel.setupPlayerProfilePanel;
    }
  } catch (e) { /* ignore */ }
}
if (typeof setupPlayerProfilePanelResolved === 'function') {
  setupPlayerProfilePanelResolved({ root });
}
```

- [ ] **Step 5: Run controller test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.player-profile-panel.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit controller**

Run:

```powershell
git add -- ui/player-profile-panel.ts ui/player-profile-panel.js ui/bootstrap/init-dom.ts ui/bootstrap/init-events.ts ui/handlers/init.ts test/ui.player-profile-panel.test.ts
git commit -m "Wire profile panel controller"
```

Expected: one controller commit.

---

### Task 8: Focused Integration Verification

**Files:**
- No source edits unless tests expose a defect.

- [ ] **Step 1: Run focused profile and identity tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.player-profile.test.ts test/ui.player-profile-avatar-options.test.ts test/ui.player-profile-panel.test.ts test/ui.player-identity.test.ts test/workers.match-player-identity.test.ts test/local-match-server.player-identity.test.ts
```

Expected: all listed suites PASS.

- [ ] **Step 2: Run bootstrap-adjacent tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.match-mode.leaderboard-limit.test.ts test/ui.leaderboard-client.test.ts
```

Expected: both suites PASS, confirming shared name and leaderboard still work.

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit fixes if needed**

If any focused verification required a source correction, commit only those files:

```powershell
git add -- <exact-files-that-were-fixed>
git commit -m "Fix profile panel verification issues"
```

Expected: skip this step when Step 1 through Step 3 pass without further edits.

---

### Task 9: Build, Mirror, and Final Checks

**Files:**
- Generated: `public/module-registry.js`
- Generated: `public/module-registry.optional.js`
- Generated/mirror: `worker-public/**`

- [ ] **Step 1: Build browser registry**

Run:

```powershell
npm run build:browser
```

Expected: PASS and module registry reports 799 or updated module count including the new profile modules.

- [ ] **Step 2: Prepare worker assets**

Run:

```powershell
npm run worker:prepare
```

Expected: PASS, asset casing check passes, worker mirror verifies.

- [ ] **Step 3: Run generated-surface check**

Run:

```powershell
npm run match:check
```

Expected: PASS. If this script is unavailable or unrelated in this checkout, run `npm run checkall` instead and record the result.

- [ ] **Step 4: Inspect generated diff**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only intended source, tests, CSS, docs, registry, and worker-public mirror files are changed.

- [ ] **Step 5: Commit generated assets**

Run:

```powershell
git add -- index.html styles-profile.css public/module-registry.js public/module-registry.optional.js worker-public
git commit -m "Regenerate profile panel assets"
```

Expected: generated/mirror commit only. Do not use `git add -A`.

- [ ] **Step 6: Final clean check**

Run:

```powershell
git diff --check HEAD~1..HEAD
git status --short
```

Expected: `git diff --check` has no output and `git status --short` is empty.

---

## Final Verification Set

Run this before reporting completion:

```powershell
npx jest --runInBand --runTestsByPath test/ui.player-profile.test.ts test/ui.player-profile-avatar-options.test.ts test/ui.player-profile-panel.test.ts test/ui.player-identity.test.ts test/workers.match-player-identity.test.ts test/local-match-server.player-identity.test.ts test/ui.leaderboard-client.test.ts test/ui.match-mode.leaderboard-limit.test.ts
npm run typecheck
npm run build:browser
npm run worker:prepare
git diff --check HEAD~1..HEAD
git status --short
```

Expected:
- Jest focused suites PASS.
- Typecheck PASS.
- Browser build PASS.
- Worker prepare PASS.
- `git diff --check` no output.
- `git status --short` clean.

## Self-Review

- Spec coverage: left rail button, profile modal, local name/avatar/bio, playerId display, recovery code display/copy/reissue/import, tests, docs, and generated assets are all covered by tasks.
- Undefined-work scan: no task depends on unspecified files or unspecified behavior. Recovery-code creation is explicitly implemented as token-authenticated reissue.
- Type consistency: `PlayerProfile`, `PlayerProfileAvatarOptions`, `PlayerProfilePanel`, and `PlayerIdentity` function names match across tests, implementation steps, bootstrap wiring, and final verification.
- Scope check: server-published profile cards are intentionally outside this implementation. The local profile schema is versioned and can be sent to a future profile API without changing the modal surface.

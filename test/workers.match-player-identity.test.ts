import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;
const RESULT_MARKER = '__WORKER_PLAYER_IDENTITY_RESULT__';

function runWorkerScenario(scenarioSource: string): any {
  const runner = `
(async () => {
  const modulePath = process.argv[1];
  const workerModule = await import(modulePath);
  const worker = workerModule.default;
  const { MatchRoomDurableObject } = workerModule;

  function createStateStore() {
    const storage = new Map();
    let alarm = null;
    return {
      __storage: storage,
      storage: {
        get: async (key) => storage.get(key),
        put: async (key, value) => storage.set(key, globalThis.structuredClone ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value))),
        delete: async (key) => storage.delete(key),
        getAlarm: async () => alarm,
        setAlarm: async (value) => { alarm = value; },
        deleteAlarm: async () => { alarm = null; }
      }
    };
  }

  const rooms = new Map();
  const roomStates = new Map();
  const env = {
    MATCH_ROOM: {
      idFromName: (roomId) => String(roomId || ''),
      get: (roomId) => {
        if (!rooms.has(roomId)) {
          const state = createStateStore();
          roomStates.set(roomId, state);
          rooms.set(roomId, new MatchRoomDurableObject(state, env));
        }
        return { fetch: (request) => rooms.get(roomId).fetch(request) };
      }
    }
  };

${scenarioSource}
})().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
`;
  const result = spawnSync(process.execPath, ['-e', runner, workerModulePath], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'worker identity runner failed');
  }
  const stdout = String(result.stdout || '');
  const markerIndex = stdout.lastIndexOf(RESULT_MARKER);
  if (markerIndex < 0) {
    throw new Error(`worker identity runner produced no marker: ${stdout}`);
  }
  return JSON.parse(stdout.slice(markerIndex + RESULT_MARKER.length));
}

describe('match worker anonymous player identity', () => {
  test('identity create verify and recover keep the same public playerId', () => {
    const result = runWorkerScenario(`
  const createResponse = await worker.fetch(new Request('https://worker/api/player/identity/create', { method: 'POST' }), env);
  const created = await createResponse.json();

  const verifyResponse = await worker.fetch(new Request('https://worker/api/player/identity/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: created.playerId, playerToken: created.playerToken })
  }), env);
  const verified = await verifyResponse.json();

  const recoverResponse = await worker.fetch(new Request('https://worker/api/player/identity/recover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recoveryCode: created.recoveryCode })
  }), env);
  const recovered = await recoverResponse.json();

  const oldVerifyResponse = await worker.fetch(new Request('https://worker/api/player/identity/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: created.playerId, playerToken: created.playerToken })
  }), env);
  const oldVerified = await oldVerifyResponse.json();

  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({
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

  test('identity records use per-player keys and recovery index keys', () => {
    const result = runWorkerScenario(`
  const firstResponse = await worker.fetch(new Request('https://worker/api/player/identity/create', { method: 'POST' }), env);
  const first = await firstResponse.json();
  const secondResponse = await worker.fetch(new Request('https://worker/api/player/identity/create', { method: 'POST' }), env);
  const second = await secondResponse.json();

  const identityState = roomStates.get('__player_identity__');
  const storageKeys = Array.from(identityState.__storage.keys()).sort();

  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({
    first,
    second,
    storageKeys
  }));
`);

    expect(result.first.playerId).toMatch(/^p_[A-Za-z0-9_-]{26}$/);
    expect(result.second.playerId).toMatch(/^p_[A-Za-z0-9_-]{26}$/);
    expect(result.storageKeys).not.toContain('player_identity_store_v1');
    expect(result.storageKeys.filter((key: string) => key.startsWith('player_identity_store_v1:identity:'))).toHaveLength(2);
    expect(result.storageKeys.filter((key: string) => key.startsWith('player_identity_store_v1:recovery:'))).toHaveLength(2);
  });

  test('recover resolves through the recovery index and rotates that index', () => {
    const result = runWorkerScenario(`
  const createResponse = await worker.fetch(new Request('https://worker/api/player/identity/create', { method: 'POST' }), env);
  const created = await createResponse.json();
  const beforeKeys = Array.from(roomStates.get('__player_identity__').__storage.keys()).sort();

  const recoverResponse = await worker.fetch(new Request('https://worker/api/player/identity/recover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recoveryCode: created.recoveryCode })
  }), env);
  const recovered = await recoverResponse.json();
  const afterEntries = Array.from(roomStates.get('__player_identity__').__storage.entries()).sort(([left], [right]) => String(left).localeCompare(String(right)));

  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({
    created,
    recovered,
    beforeKeys,
    afterEntries
  }));
`);

    const beforeRecoveryKeys = result.beforeKeys.filter((key: string) => key.startsWith('player_identity_store_v1:recovery:'));
    const afterRecoveryEntries = result.afterEntries.filter(([key]: [string, unknown]) => key.startsWith('player_identity_store_v1:recovery:'));
    expect(beforeRecoveryKeys).toHaveLength(1);
    expect(afterRecoveryEntries).toHaveLength(1);
    expect(afterRecoveryEntries[0][0]).not.toBe(beforeRecoveryKeys[0]);
    expect(afterRecoveryEntries[0][1]).toBe(result.created.playerId);
    expect(result.recovered.playerId).toBe(result.created.playerId);
  });

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

  test('leaderboard submit rejects unverifiable CPU results after verifying playerToken', () => {
    const result = runWorkerScenario(`
  const createResponse = await worker.fetch(new Request('https://worker/api/player/identity/create', { method: 'POST' }), env);
  const created = await createResponse.json();

  const okSubmitResponse = await worker.fetch(new Request('https://worker/api/leaderboard/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: created.playerId,
      playerToken: created.playerToken,
      playerName: 'さかな',
      score: 9412,
      mode: 'cpu',
      cpuLevel: 1
    })
  }), env);
  const okSubmit = await okSubmitResponse.json();

  const invalidSubmitResponse = await worker.fetch(new Request('https://worker/api/leaderboard/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerId: created.playerId,
      playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno99',
      playerName: 'さかな',
      score: 9999,
      mode: 'cpu',
      cpuLevel: 1
    })
  }), env);
  const invalidSubmit = await invalidSubmitResponse.json();

  const listResponse = await worker.fetch(new Request('https://worker/api/leaderboard/list?limit=10'), env);
  const list = await listResponse.json();

  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({
    okSubmitStatus: okSubmitResponse.status,
    okSubmit,
    invalidSubmitStatus: invalidSubmitResponse.status,
    invalidSubmit,
    list
  }));
`);

    expect(result.okSubmitStatus).toBe(403);
    expect(result.okSubmit.reason).toBe('LEADERBOARD_RESULT_PROOF_REQUIRED');
    expect(result.invalidSubmitStatus).toBe(403);
    expect(result.invalidSubmit.reason).toBe('PLAYER_ID_TOKEN_INVALID');
    expect(result.list.entries).toHaveLength(0);
  });
});

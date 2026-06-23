import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;
const RESULT_MARKER = '__WORKER_MATCH_PLAYER_ID_RESULT__';

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
  const env = {
    MATCH_ROOM: {
      idFromName: (roomId) => String(roomId || ''),
      get: (roomId) => {
        if (!rooms.has(roomId)) rooms.set(roomId, new MatchRoomDurableObject(createStateStore(), env));
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
    throw new Error(result.stderr || result.stdout || 'worker match player id runner failed');
  }
  const stdout = String(result.stdout || '');
  const markerIndex = stdout.lastIndexOf(RESULT_MARKER);
  if (markerIndex < 0) {
    throw new Error(`worker match player id runner produced no marker: ${stdout}`);
  }
  return JSON.parse(stdout.slice(markerIndex + RESULT_MARKER.length));
}

describe('match worker room player ids', () => {
  test('create and join store public seatPlayerIds without projecting secrets', () => {
    const result = runWorkerScenario(`
  async function createIdentity() {
    const response = await worker.fetch(new Request('https://worker/api/player/identity/create', { method: 'POST' }), env);
    return response.json();
  }

  const black = await createIdentity();
  const white = await createIdentity();

  const createResponse = await worker.fetch(new Request('https://worker/api/match/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerName: 'くろ',
      playerId: black.playerId,
      playerToken: black.playerToken
    })
  }), env);
  const created = await createResponse.json();

  const invalidJoinResponse = await worker.fetch(new Request('https://worker/api/match/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: created.roomId,
      playerName: 'しろ',
      playerId: white.playerId,
      playerToken: 'pt_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmno99'
    })
  }), env);
  const invalidJoin = await invalidJoinResponse.json();

  const joinResponse = await worker.fetch(new Request('https://worker/api/match/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: created.roomId,
      playerName: 'しろ',
      playerId: white.playerId,
      playerToken: white.playerToken
    })
  }), env);
  const joined = await joinResponse.json();

  const stateResponse = await worker.fetch(new Request('https://worker/api/match/state?roomId='
    + encodeURIComponent(created.roomId)
    + '&seatKey=white&seatToken='
    + encodeURIComponent(joined.seatToken)), env);
  const state = await stateResponse.json();

  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({
    black,
    white,
    createStatus: createResponse.status,
    created,
    invalidJoinStatus: invalidJoinResponse.status,
    invalidJoin,
    joinStatus: joinResponse.status,
    joined,
    stateStatus: stateResponse.status,
    state,
    publicPayloadText: JSON.stringify({ created, joined, state })
  }));
`);

    expect(result.createStatus).toBe(200);
    expect(result.created.seatPlayerIds).toEqual({
      black: result.black.playerId,
      white: ''
    });
    expect(result.invalidJoinStatus).toBe(403);
    expect(result.invalidJoin.reason).toBe('PLAYER_ID_TOKEN_INVALID');
    expect(result.joinStatus).toBe(200);
    expect(result.joined.seatPlayerIds).toEqual({
      black: result.black.playerId,
      white: result.white.playerId
    });
    expect(result.stateStatus).toBe(200);
    expect(result.state.seatPlayerIds).toEqual({
      black: result.black.playerId,
      white: result.white.playerId
    });
    expect(result.publicPayloadText).not.toContain('playerToken');
    expect(result.publicPayloadText).not.toContain('recoveryCode');
  });
});

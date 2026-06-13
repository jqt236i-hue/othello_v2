import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;
const RESULT_MARKER = '__WORKER_MATCH_LOBBY_RESULT__';

function runWorkerLobbyScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const workerModule = await import(modulePath);",
    "  const worker = workerModule.default;",
    "  const { MatchRoomDurableObject } = workerModule;",
    "",
    "  function createStateStore() {",
    "    const storage = new Map();",
    "    let alarm = null;",
    "    return {",
    "      storage: {",
    "        get: async (key) => storage.get(key),",
    "        put: async (key, value) => storage.set(key, globalThis.structuredClone ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value))),",
    "        delete: async (key) => storage.delete(key),",
    "        getAlarm: async () => alarm,",
    "        setAlarm: async (value) => { alarm = value; },",
    "        deleteAlarm: async () => { alarm = null; }",
    "      }",
    "    };",
    "  }",
    "",
    "  const rooms = new Map();",
    "  const env = {",
    "    MATCH_ROOM: {",
    "      idFromName: (roomId) => String(roomId || ''),",
    "      get: (roomId) => {",
    "        if (!rooms.has(roomId)) {",
    "          rooms.set(roomId, new MatchRoomDurableObject(createStateStore()));",
    "        }",
    "        return { fetch: (request) => rooms.get(roomId).fetch(request) };",
    "      }",
    "    }",
    "  };",
    "",
    "  const createResponse = await worker.fetch(new Request('https://worker/api/match/create', {",
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({ playerName: '', roomName: '', roomPassword: 'swordfish' })",
    "  }), env);",
    "  const createPayload = await createResponse.json();",
    "",
    "  const listResponse = await worker.fetch(new Request('https://worker/api/match/list'), env);",
    "  const listPayload = await listResponse.json();",
    "",
    "  const wrongJoinResponse = await worker.fetch(new Request('https://worker/api/match/join', {",
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({ roomId: createPayload.roomId, playerName: 'しろ', roomPassword: 'wrong' })",
    "  }), env);",
    "  const wrongJoinPayload = await wrongJoinResponse.json();",
    "",
    "  const joinResponse = await worker.fetch(new Request('https://worker/api/match/join', {",
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({ roomId: createPayload.roomId, playerName: 'しろ', roomPassword: 'swordfish' })",
    "  }), env);",
    "  const joinPayload = await joinResponse.json();",
    "",
    "  const listAfterJoinResponse = await worker.fetch(new Request('https://worker/api/match/list'), env);",
    "  const listAfterJoinPayload = await listAfterJoinResponse.json();",
    "",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({`,
    "    createStatus: createResponse.status,",
    "    createPayload,",
    "    listStatus: listResponse.status,",
    "    listPayload,",
    "    wrongJoinStatus: wrongJoinResponse.status,",
    "    wrongJoinPayload,",
    "    joinStatus: joinResponse.status,",
    "    joinPayload,",
    "    listAfterJoinStatus: listAfterJoinResponse.status,",
    "    listAfterJoinPayload",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  const result = spawnSync(process.execPath, ['-e', runner, workerModulePath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'worker lobby runner failed');
  }

  const output = String(result.stdout || '');
  const markerIndex = output.lastIndexOf(RESULT_MARKER);
  if (markerIndex < 0) {
    throw new Error(output || 'worker lobby runner did not emit result marker');
  }
  return JSON.parse(output.slice(markerIndex + RESULT_MARKER.length));
}

function runWorkerLobbyExpiryScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const workerModule = await import(modulePath);",
    "  const worker = workerModule.default;",
    "  const { MatchRoomDurableObject } = workerModule;",
    "  let nowMs = 1700000000000;",
    "  Date.now = () => nowMs;",
    "",
    "  function createStateStore() {",
    "    const storage = new Map();",
    "    let alarm = null;",
    "    return {",
    "      storage: {",
    "        get: async (key) => storage.get(key),",
    "        put: async (key, value) => storage.set(key, globalThis.structuredClone ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value))),",
    "        delete: async (key) => storage.delete(key),",
    "        getAlarm: async () => alarm,",
    "        setAlarm: async (value) => { alarm = value; },",
    "        deleteAlarm: async () => { alarm = null; }",
    "      }",
    "    };",
    "  }",
    "",
    "  const rooms = new Map();",
    "  const env = {",
    "    MATCH_ROOM: {",
    "      idFromName: (roomId) => String(roomId || ''),",
    "      get: (roomId) => {",
    "        if (!rooms.has(roomId)) {",
    "          rooms.set(roomId, new MatchRoomDurableObject(createStateStore()));",
    "        }",
    "        return { fetch: (request) => rooms.get(roomId).fetch(request) };",
    "      }",
    "    }",
    "  };",
    "",
    "  const createResponse = await worker.fetch(new Request('https://worker/api/match/create', {",
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({ playerName: 'くろ' })",
    "  }), env);",
    "  const createPayload = await createResponse.json();",
    "",
    "  nowMs += 10 * 60 * 1000 + 1;",
    "",
    "  const listResponse = await worker.fetch(new Request('https://worker/api/match/list'), env);",
    "  const listPayload = await listResponse.json();",
    "",
    "  const joinResponse = await worker.fetch(new Request('https://worker/api/match/join', {",
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({ roomId: createPayload.roomId, playerName: 'しろ' })",
    "  }), env);",
    "  const joinPayload = await joinResponse.json();",
    "",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({`,
    "    createStatus: createResponse.status,",
    "    createPayload,",
    "    listStatus: listResponse.status,",
    "    listPayload,",
    "    joinStatus: joinResponse.status,",
    "    joinPayload",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  const result = spawnSync(process.execPath, ['-e', runner, workerModulePath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'worker lobby expiry runner failed');
  }

  const output = String(result.stdout || '');
  const markerIndex = output.lastIndexOf(RESULT_MARKER);
  if (markerIndex < 0) {
    throw new Error(output || 'worker lobby expiry runner did not emit result marker');
  }
  return JSON.parse(output.slice(markerIndex + RESULT_MARKER.length));
}

describe('worker match lobby', () => {
  test('作成したパスワード付きルームを一覧に出し、満室になったら消す', () => {
    const result = runWorkerLobbyScenario();

    expect(result.createStatus).toBe(200);
    expect(result.createPayload.ok).toBe(true);
    expect(result.createPayload.playerName).toMatch(/^ゲスト[A-Z0-9]{3}$/);
    expect(result.createPayload.roomName).toBe('無名部屋');
    expect(result.listStatus).toBe(200);
    expect(result.listPayload.rooms).toEqual([
      expect.objectContaining({
        roomId: result.createPayload.roomId,
        roomName: '無名部屋',
        hostName: result.createPayload.playerName,
        seatCount: 1,
        maxSeats: 2,
        hasPassword: true
      })
    ]);
    expect(JSON.stringify(result.listPayload)).not.toContain('swordfish');

    expect(result.wrongJoinStatus).toBe(403);
    expect(result.wrongJoinPayload.reason).toBe('ROOM_PASSWORD_INVALID');
    expect(result.joinStatus).toBe(200);
    expect(result.joinPayload.ok).toBe(true);
    expect(result.listAfterJoinStatus).toBe(200);
    expect(result.listAfterJoinPayload.rooms).toEqual([]);
  });

  test('10分以上参加されない部屋は一覧から消え参加できない', () => {
    const result = runWorkerLobbyExpiryScenario();

    expect(result.createStatus).toBe(200);
    expect(result.createPayload.ok).toBe(true);
    expect(result.listStatus).toBe(200);
    expect(result.listPayload.rooms).toEqual([]);
    expect(result.joinStatus).toBe(404);
    expect(result.joinPayload.reason).toBe('ROOM_NOT_FOUND');
  });
});

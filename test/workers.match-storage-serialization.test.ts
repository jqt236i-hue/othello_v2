import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;
const RESULT_MARKER = '__WORKER_STORAGE_SERIALIZATION__';

function runStructuredCloneJoinScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const workerModule = await import(modulePath);",
    "  const worker = workerModule.default;",
    "  const { MatchRoomDurableObject } = workerModule;",
    "",
    "  function createStructuredCloneStateStore() {",
    "    const storage = new Map();",
    "    return {",
    "      storage: {",
    "        get: async (key) => storage.get(key),",
    "        put: async (key, value) => {",
    "          storage.set(key, globalThis.structuredClone(value));",
    "        },",
    "        delete: async (key) => storage.delete(key)",
    "      }",
    "    };",
    "  }",
    "",
    "  const rooms = new Map();",
    "  const env = {",
    "    MATCH_ROOM: {",
    "      idFromName: (roomId) => roomId,",
    "      get: (roomId) => {",
    "        if (!rooms.has(roomId)) {",
    "          rooms.set(roomId, new MatchRoomDurableObject(createStructuredCloneStateStore()));",
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
    "  const joinResponse = await worker.fetch(new Request('https://worker/api/match/join', {",
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({ roomId: createPayload.roomId, playerName: 'しろ' })",
    "  }), env);",
    "  const joinPayload = await joinResponse.json();",
    "",
    "  const room = rooms.get(createPayload.roomId);",
    "  await room.loadRoom();",
    "",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({`,
    "    createStatus: createResponse.status,",
    "    createPayload,",
    "    joinStatus: joinResponse.status,",
    "    joinPayload,",
    "    seatNames: room.room && room.room.seatNames ? room.room.seatNames : null,",
    "    stateVersion: room.room ? room.room.stateVersion : null,",
    "    hasSerializableCardState: !!(room.room && room.room.snapshot && room.room.snapshot.cardState)",
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
    throw new Error(result.stderr || result.stdout || 'structured clone join runner failed');
  }

  const output = String(result.stdout || '');
  const markerIndex = output.lastIndexOf(RESULT_MARKER);
  if (markerIndex < 0) {
    throw new Error(output || 'structured clone join runner did not emit result marker');
  }

  return JSON.parse(output.slice(markerIndex + RESULT_MARKER.length));
}

describe('match worker storage serialization', () => {
  test('2人目参加時の snapshot rebase は structuredClone storage でも永続化できる', () => {
    const result = runStructuredCloneJoinScenario();

    expect(result.createStatus).toBe(200);
    expect(result.joinStatus).toBe(200);
    expect(result.joinPayload).toEqual(expect.objectContaining({
      ok: true,
      seatKey: 'white'
    }));
    expect(result.seatNames).toEqual({
      black: 'くろ',
      white: 'しろ'
    });
    expect(result.stateVersion).toBe(1);
    expect(result.hasSerializableCardState).toBe(true);
  });
});

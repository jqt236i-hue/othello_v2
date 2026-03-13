const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function runScenario(runnerSource) {
  const result = spawnSync(process.execPath, ['-e', runnerSource, workerModulePath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'publish idempotency runner failed');
  }

  return JSON.parse(String(result.stdout || '{}'));
}

function runPublishIdempotencyScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const storage = new Map();",
    "  const state = {",
    "    storage: {",
    "      get: async (key) => storage.get(key),",
    "      put: async (key, value) => storage.set(key, value),",
    "      delete: async (key) => storage.delete(key)",
    "    }",
    "  };",
    "  const durableObject = new MatchRoomDurableObject(state);",
    "",
    "  const board = Array.from({ length: 8 }, () => Array(8).fill(0));",
    "  board[3][3] = -1;",
    "  board[3][4] = 1;",
    "  board[4][3] = 1;",
    "  board[4][4] = -1;",
    "",
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'IDP1',",
    "    playerName: 'くろ',",
    "    seed: 1,",
    "    snapshot: {",
    "      gameState: {",
    "        board,",
    "        currentPlayer: 1,",
    "        consecutivePasses: 0,",
    "        turnNumber: 0",
    "      },",
    "      cardState: {}",
    "    }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "",
    "  const operationId = 'op_retry_fixed_1';",
    "  const publishBody = {",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: createPayload.seatToken,",
    "    baseVersion: createPayload.stateVersion,",
    "    operationId,",
    "    actionType: 'place',",
    "    playbackEvents: [],",
    "    snapshot: {",
    "      gameState: {",
    "        board,",
    "        currentPlayer: -1,",
    "        consecutivePasses: 0,",
    "        turnNumber: 1",
    "      },",
    "      cardState: {}",
    "    }",
    "  };",
    "",
    "  const firstResponse = await durableObject.handlePublish(publishBody);",
    "  const firstPayload = await firstResponse.json();",
    "",
    "  const secondResponse = await durableObject.handlePublish(publishBody);",
    "  const secondPayload = await secondResponse.json();",
    "",
    "  await durableObject.loadRoom();",
    "",
    "  process.stdout.write(JSON.stringify({",
    "    first: { status: firstResponse.status, payload: firstPayload },",
    "    second: { status: secondResponse.status, payload: secondPayload },",
    "    finalStateVersion: durableObject.room ? durableObject.room.stateVersion : null",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

describe('match worker publish idempotency', () => {
  test('同一operationIdの再送は重複適用せず成功応答する', () => {
    const result = runPublishIdempotencyScenario();

    expect(result.first.status).toBe(200);
    expect(result.first.payload && result.first.payload.ok).toBe(true);
    expect(result.first.payload.stateVersion).toBe(1);

    expect(result.second.status).toBe(200);
    expect(result.second.payload && result.second.payload.ok).toBe(true);
    expect(result.second.payload.stateVersion).toBe(1);
    expect(result.second.payload.idempotentReplay).toBe(true);

    expect(result.finalStateVersion).toBe(1);
  });
});

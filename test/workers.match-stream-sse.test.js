const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;

function runScenario(runnerSource) {
  const result = spawnSync(process.execPath, ['-e', runnerSource, workerModulePath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'stream runner failed');
  }

  return JSON.parse(String(result.stdout || '{}'));
}

function runStreamScenario() {
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
    "    roomId: 'SSE1',",
    "    playerName: 'くろ',",
    "    seed: 1,",
    "    networkDebugEnabled: true,",
    "    roomDeck: { mode: 'shared', deckCode: 'D1C1:test_card*3', deckSize: 30, source: 'room' },",
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
    "  const streamRequest = new Request(`https://room/api/match/stream?seatKey=black&seatToken=${createPayload.seatToken}`);",
    "  const streamResponse = await durableObject.handleStream(streamRequest);",
    "",
    "  const reader = streamResponse.body.getReader();",
    "  const readResult = await Promise.race([",
    "    reader.read(),",
    "    new Promise((_, reject) => setTimeout(() => reject(new Error('STREAM_READ_TIMEOUT')), 1000))",
    "  ]);",
    "  const firstChunk = Buffer.from(readResult && readResult.value ? readResult.value : []).toString('utf8');",
    "",
    "  try { await reader.cancel(); } catch (e) { /* ignore */ }",
    "",
    "  process.stdout.write(JSON.stringify({",
    "    status: streamResponse.status,",
    "    createRoomDeck: createPayload.roomDeck,",
    "    firstChunk",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

describe('match worker stream SSE', () => {
  test('初回snapshotイベントにSSE event idを付与する', () => {
    const result = runStreamScenario();

    expect(result.status).toBe(200);
    expect(result.createRoomDeck).toEqual(expect.objectContaining({ mode: 'shared', deckCode: 'D1C1:test_card*3', deckSize: 30 }));
    expect(typeof result.firstChunk).toBe('string');
    expect(result.firstChunk).toContain('event: snapshot');
    expect(result.firstChunk).toContain('id: ');
    expect(result.firstChunk).toContain('data: ');
    expect(result.firstChunk).toContain('"networkDebugEnabled":true');
    expect(result.firstChunk).toContain('"roomDeck":{"mode":"shared"');
  });
});

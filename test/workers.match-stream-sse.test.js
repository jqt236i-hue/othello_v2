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

function runResumeScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const state = {",
    "    storage: {",
    "      get: async () => null,",
    "      put: async () => {},",
    "      delete: async () => {}",
    "    }",
    "  };",
    "  const durableObject = new MatchRoomDurableObject(state);",
    "  durableObject.roomLoaded = true;",
    "  durableObject.room = {",
    "    roomId: 'SSE1',",
    "    seed: 1,",
    "    stateVersion: 2,",
    "    snapshot: {",
    "      stateVersion: 2,",
    "      gameState: { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: -1, turnNumber: 2, consecutivePasses: 0 },",
    "      cardState: { hands: { black: ['b1'], white: ['w1'] }, charge: { black: 0, white: 0 }, pendingEffectByPlayer: { black: null, white: null }, hasUsedCardThisTurnByPlayer: { black: false, white: false }, lastUsedCardByPlayer: { black: null, white: null }, markers: [], discard: [], turnIndex: 2 }",
    "    },",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    seatNames: { black: 'black', white: 'white' },",
    "    roomDeck: null,",
    "    networkDebugEnabled: false,",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'white', turnStartedAt: null, turnDeadlineAt: null },",
    "    lastAcceptedOperationBySeat: { black: null, white: null },",
    "    eventSeq: 2,",
    "    chatMessages: [],",
    "    chatSeq: 0",
    "  };",
    "  durableObject.sseEventBuffer = [",
    "    { id: 'SSE1_1_1', event: 'heartbeat', payload: { ok: true, roomId: 'SSE1', stateVersion: 1 } },",
    "    { id: 'SSE1_2_2', event: 'snapshot', payloadByViewer: {",
    "      black: { ok: true, roomId: 'SSE1', stateVersion: 2, playbackEvents: [{ type: 'observer_bubble', phase: 2, targets: [{ player: 'black', text: 'resume' }] }], effectLogs: ['白がカードを使用: 交換'], snapshot: { stateVersion: 2, gameState: { currentPlayer: -1, turnNumber: 2, consecutivePasses: 0 }, cardState: { hands: { black: ['b1'], white: ['__hidden_hand__:white:0'] }, charge: { black: 0, white: 0 }, pendingEffectByPlayer: { black: null, white: null }, hasUsedCardThisTurnByPlayer: { black: false, white: false }, lastUsedCardByPlayer: { black: null, white: null }, markers: [], discard: [], turnIndex: 2 } } },",
    "      white: { ok: true, roomId: 'SSE1', stateVersion: 2, playbackEvents: [], effectLogs: ['白がカードを使用: 交換'], snapshot: { stateVersion: 2, gameState: { currentPlayer: -1, turnNumber: 2, consecutivePasses: 0 }, cardState: { hands: { black: ['__hidden_hand__:black:0'], white: ['w1'] }, charge: { black: 0, white: 0 }, pendingEffectByPlayer: { black: null, white: null }, hasUsedCardThisTurnByPlayer: { black: false, white: false }, lastUsedCardByPlayer: { black: null, white: null }, markers: [], discard: [], turnIndex: 2 } } }",
    "    } }",
    "  ];",
    "  const streamRequest = new Request('https://room/api/match/stream?seatKey=black&seatToken=token_black', { headers: { 'Last-Event-ID': 'SSE1_1_1' } });",
    "  const streamResponse = await durableObject.handleStream(streamRequest);",
    "  const reader = streamResponse.body.getReader();",
    "  const readResult = await Promise.race([",
    "    reader.read(),",
    "    new Promise((_, reject) => setTimeout(() => reject(new Error('STREAM_READ_TIMEOUT')), 1000))",
    "  ]);",
    "  const firstChunk = Buffer.from(readResult && readResult.value ? readResult.value : []).toString('utf8');",
    "  try { await reader.cancel(); } catch (e) { /* ignore */ }",
    "  process.stdout.write(JSON.stringify({ status: streamResponse.status, firstChunk }));",
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
    expect(result.firstChunk).toContain('"effectLogs":[]');
  });

  test('Last-Event-ID 付き再接続では buffered snapshot を replay する', () => {
    const result = runResumeScenario();

    expect(result.status).toBe(200);
    expect(typeof result.firstChunk).toBe('string');
    expect(result.firstChunk).toContain('event: snapshot');
    expect(result.firstChunk).toContain('id: SSE1_2_2');
    expect(result.firstChunk).toContain('"observer_bubble"');
    expect(result.firstChunk).toContain('"effectLogs":["白がカードを使用: 交換"]');
    expect(result.firstChunk).toContain('"__hidden_hand__:white:0"');
    expect(result.firstChunk).not.toContain('"type":"history"');
  });
});

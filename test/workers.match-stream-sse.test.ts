import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

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
    "    selectedHandSkinId: 'gacha__n__hand-swap',",
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

function runResumeScenarioWithQueryParam() {
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
    "  const streamRequest = new Request('https://room/api/match/stream?seatKey=black&seatToken=token_black&lastEventId=SSE1_1_1');",
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

function runResumeAfterReloadScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const storage = new Map();",
    "  storage.set('match_room_state_v1', {",
    "    roomId: 'SSE2',",
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
    "    sseEventBuffer: [",
    "      { id: 'SSE2_1_1', event: 'heartbeat', payload: { ok: true, roomId: 'SSE2', stateVersion: 1 } },",
    "      { id: 'SSE2_2_2', event: 'snapshot', payloadByViewer: {",
    "        black: { ok: true, roomId: 'SSE2', stateVersion: 2, playbackEvents: [], effectLogs: ['resume'], snapshot: { stateVersion: 2, gameState: { currentPlayer: -1, turnNumber: 2, consecutivePasses: 0 }, cardState: { hands: { black: ['b1'], white: ['__hidden_hand__:white:0'] }, charge: { black: 0, white: 0 }, pendingEffectByPlayer: { black: null, white: null }, hasUsedCardThisTurnByPlayer: { black: false, white: false }, lastUsedCardByPlayer: { black: null, white: null }, markers: [], discard: [], turnIndex: 2 } } },",
    "        white: { ok: true, roomId: 'SSE2', stateVersion: 2, playbackEvents: [], effectLogs: ['resume'], snapshot: { stateVersion: 2, gameState: { currentPlayer: -1, turnNumber: 2, consecutivePasses: 0 }, cardState: { hands: { black: ['__hidden_hand__:black:0'], white: ['w1'] }, charge: { black: 0, white: 0 }, pendingEffectByPlayer: { black: null, white: null }, hasUsedCardThisTurnByPlayer: { black: false, white: false }, lastUsedCardByPlayer: { black: null, white: null }, markers: [], discard: [], turnIndex: 2 } } }",
    "      } }",
    "    ],",
    "    authorityLog: [],",
    "    chatMessages: [],",
    "    chatSeq: 0",
    "  });",
    "  const state = {",
    "    storage: {",
    "      get: async (key) => storage.get(key),",
    "      put: async (key, value) => storage.set(key, value),",
    "      delete: async (key) => storage.delete(key)",
    "    }",
    "  };",
    "  const durableObject = new MatchRoomDurableObject(state);",
    "  const streamRequest = new Request('https://room/api/match/stream?seatKey=black&seatToken=token_black', { headers: { 'Last-Event-ID': 'SSE2_1_1' } });",
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

function runStatePlaybackRecoveryScenario() {
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
    "  const room = {",
    "    roomId: 'SSE3',",
    "    seed: 1,",
    "    stateVersion: 2,",
    "    snapshot: {",
    "      stateVersion: 2,",
    "      _meta: { version: 2, authority: 'server', projectedForSeat: 'black', turnStartReconciled: true },",
    "      gameState: { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: -1, turnNumber: 2, consecutivePasses: 0 },",
    "      cardState: { hands: { black: ['b1'], white: ['w1'] }, charge: { black: 0, white: 0 }, pendingEffectByPlayer: { black: null, white: null }, hasUsedCardThisTurnByPlayer: { black: false, white: false }, lastUsedCardByPlayer: { black: null, white: null }, markers: [], discard: [], turnIndex: 2 }",
    "    },",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    seatNames: { black: 'black', white: 'white' },",
    "    seatHandSkins: { black: '', white: '' },",
    "    roomDeck: null,",
    "    networkDebugEnabled: false,",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'white', turnStartedAt: null, turnDeadlineAt: null },",
    "    lastAcceptedOperationBySeat: { black: null, white: null },",
    "    eventSeq: 2,",
    "    chatMessages: [],",
    "    chatSeq: 0",
    "  };",
    "  room.sseEventBuffer = [{",
    "    id: 'SSE3_2_2',",
    "    event: 'snapshot',",
    "    payloadByViewer: {",
    "      black: { ok: true, roomId: 'SSE3', stateVersion: 2, operationId: 'op_state_recovery', playbackEvents: [{ type: 'move', phase: 1, targets: [{ from: { r: 3, col: 3 }, to: { r: 4, col: 3 }, reason: 'hyperactive_move' }] }], effectLogs: ['黒: 多動石が移動'], snapshot: room.snapshot },",
    "      white: { ok: true, roomId: 'SSE3', stateVersion: 2, playbackEvents: [], effectLogs: ['黒: 多動石が移動'], snapshot: room.snapshot }",
    "    }",
    "  }];",
    "  durableObject.room = room;",
    "  durableObject.sseEventBuffer = room.sseEventBuffer.slice();",
    "  const stateResponse = await durableObject.handleState(new URL('https://room/api/match/state?seatKey=black&seatToken=token_black'));",
    "  const statePayload = await stateResponse.json();",
    "  process.stdout.write(JSON.stringify({ status: stateResponse.status, statePayload }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runCreateApiSeatHandSkinScenario() {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const workerModule = await import(modulePath);",
    "  const worker = workerModule.default;",
    "  const MatchRoomDurableObject = workerModule.MatchRoomDurableObject;",
    "  const roomStorages = new Map();",
    "  const env = {",
    "    MATCH_ROOM: {",
    "      idFromName: (name) => String(name || ''),",
    "      get: (id) => ({",
    "        fetch: async (request) => {",
    "          const roomId = String(id || '');",
    "          let storage = roomStorages.get(roomId);",
    "          if (!storage) {",
    "            storage = new Map();",
    "            roomStorages.set(roomId, storage);",
    "          }",
    "          const state = {",
    "            storage: {",
    "              get: async (key) => storage.get(key),",
    "              put: async (key, value) => storage.set(key, value),",
    "              delete: async (key) => storage.delete(key)",
    "            }",
    "          };",
    "          const durableObject = new MatchRoomDurableObject(state);",
    "          return durableObject.fetch(request);",
    "        }",
    "      })",
    "    }",
    "  };",
    "  const createResponse = await worker.fetch(new Request('https://example.com/api/match/create', {",
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json' },",
    "    body: JSON.stringify({ playerName: 'くろ', selectedHandSkinId: 'gacha__n__hand-swap' })",
    "  }), env);",
    "  const createPayload = await createResponse.json();",
    "  const stateResponse = await worker.fetch(new Request(`https://example.com/api/match/state?roomId=${createPayload.roomId}&seatKey=black&seatToken=${createPayload.seatToken}`), env);",
    "  const statePayload = await stateResponse.json();",
    "  process.stdout.write(JSON.stringify({",
    "    createStatus: createResponse.status,",
    "    createPayload,",
    "    stateStatus: stateResponse.status,",
    "    statePayload",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runScenario(runner);
}

function runRejectedStreamScenario(streamPath) {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const pathName = process.argv[2];",
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
    "  const createResponse = await durableObject.handleInternalCreate(new URL('https://room/internal/create'), {",
    "    roomId: 'SSE1',",
    "    playerName: 'くろ',",
    "    seed: 1,",
    "    networkDebugEnabled: false,",
    "    snapshot: {",
    "      gameState: { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: 1, consecutivePasses: 0, turnNumber: 0 },",
    "      cardState: {}",
    "    }",
    "  });",
    "  const createPayload = await createResponse.json();",
    "  const streamResponse = await durableObject.handleStream(new Request(`https://room${pathName}`));",
    "  const payload = await streamResponse.json();",
    "  process.stdout.write(JSON.stringify({",
    "    status: streamResponse.status,",
    "    createPayload,",
    "    payload",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  const result = spawnSync(process.execPath, ['-e', runner, workerModulePath, streamPath], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'stream reject runner failed');
  }
  return JSON.parse(String(result.stdout || '{}'));
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
    expect(result.firstChunk).toContain('"seatHandSkins":{"black":"gacha__n__陽気な手","white":""}');
    expect(result.firstChunk).toContain('"effectLogs":[]');
  });

  test('Last-Event-ID 付き再接続では buffered snapshot を replay する', () => {
    const result = runResumeScenario();

    expect(result.status).toBe(200);
    expect(typeof result.firstChunk).toBe('string');
    expect(result.firstChunk).toContain('event: snapshot');
    expect(result.firstChunk).toContain('id: SSE1_2_2');
    expect(result.firstChunk).toContain('"observer_bubble"');
    expect(result.firstChunk).toContain('"sseReplay":{"replayed":true,"index":1,"count":1,"remaining":0');
    expect(result.firstChunk).toContain('"effectLogs":["白がカードを使用: 交換"]');
    expect(result.firstChunk).toContain('"__hidden_hand__:white:0"');
    expect(result.firstChunk).not.toContain('"type":"history"');
  });

  test('lastEventId query 付き再接続では buffered snapshot を replay する', () => {
    const result = runResumeScenarioWithQueryParam();

    expect(result.status).toBe(200);
    expect(typeof result.firstChunk).toBe('string');
    expect(result.firstChunk).toContain('event: snapshot');
    expect(result.firstChunk).toContain('id: SSE1_2_2');
    expect(result.firstChunk).toContain('"observer_bubble"');
    expect(result.firstChunk).toContain('"effectLogs":["白がカードを使用: 交換"]');
    expect(result.firstChunk).toContain('"__hidden_hand__:white:0"');
    expect(result.firstChunk).not.toContain('"type":"history"');
  });

  test('Durable Object 再構築後も room 保存済み buffer から replay できる', () => {
    const result = runResumeAfterReloadScenario();

    expect(result.status).toBe(200);
    expect(result.firstChunk).toContain('event: snapshot');
    expect(result.firstChunk).toContain('id: SSE2_2_2');
    expect(result.firstChunk).toContain('"effectLogs":["resume"]');
    expect(result.firstChunk).toContain('"__hidden_hand__:white:0"');
  });

  test('state response recovers buffered playback for current state version', () => {
    const result = runStatePlaybackRecoveryScenario();

    expect(result.status).toBe(200);
    expect(result.statePayload.stateVersion).toBe(2);
    expect(result.statePayload.operationId).toBe('op_state_recovery');
    expect(result.statePayload.playbackEvents).toEqual([
      expect.objectContaining({ type: 'move' })
    ]);
    expect(result.statePayload.effectLogs).toEqual(['黒: 多動石が移動']);
  });

  test('top-level create と state が seatHandSkins を維持する', () => {
    const result = runCreateApiSeatHandSkinScenario();

    expect(result.createStatus).toBe(200);
    expect(result.createPayload.seatHandSkins).toEqual({
      black: 'gacha__n__陽気な手',
      white: ''
    });
    expect(result.stateStatus).toBe(200);
    expect(result.statePayload.seatHandSkins).toEqual({
      black: 'gacha__n__陽気な手',
      white: ''
    });
  });

  test('seatToken なしの stream は SEAT_TOKEN_REQUIRED で拒否する', () => {
    const result = runRejectedStreamScenario('/api/match/stream?seatKey=black');

    expect(result.status).toBe(403);
    expect(result.payload).toEqual(expect.objectContaining({
      ok: false,
      reason: 'SEAT_TOKEN_REQUIRED'
    }));
    expect(result.createPayload.ok).toBe(true);
  });

  test('不正な seatToken の stream は SEAT_TOKEN_MISMATCH で拒否する', () => {
    const result = runRejectedStreamScenario('/api/match/stream?seatKey=black&seatToken=stale-token');

    expect(result.status).toBe(403);
    expect(result.payload).toEqual(expect.objectContaining({
      ok: false,
      reason: 'SEAT_TOKEN_MISMATCH'
    }));
    expect(result.createPayload.ok).toBe(true);
  });
});

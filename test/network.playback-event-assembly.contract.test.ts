import * as http from 'http';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';
import * as helpers from '../shared/playback-event-helpers.js';
import * as adapter from '../game/turn/pipeline_ui_adapter.js';
import * as Core from '../game/logic/core.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as MatchAuthority from '../utils/match-authority.js';
import { createLocalMatchServer, resetRoomsForTests } from '../scripts/local-match-server.js';

const WORKER_RESULT_MARKER = '__WORKER_PLAYBACK_CONTRACT__';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePlayerKey(value) {
  return MatchAuthority.normalizePlayerKey(value, 'black');
}

function createBoard(rows = 8, cols = 8) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function requestJson(port, method, path, payload) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode || 0,
            data: raw ? JSON.parse(raw) : {}
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    if (payload !== undefined) {
      req.write(JSON.stringify(payload));
    }
    req.end();
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  return server.address().port;
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(() => resolve()));
}

async function openSseStream(port, path, options = {}) {
  const controller = new AbortController();
  const headers = { Accept: 'text/event-stream', ...(options && options.headers ? options.headers : {}) };
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    headers,
    signal: controller.signal
  });
  if (!response.ok || !response.body) {
    throw new Error(`SSE_OPEN_FAILED:${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const queue = [];
  let buffer = '';
  let pendingResolve = null;
  let pendingReject = null;

  function pushEvent(event) {
    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      pendingReject = null;
      resolve(event);
      return;
    }
    queue.push(event);
  }

  function parseBlock(block) {
    const lines = block.split(/\r?\n/);
    let eventName = 'message';
    let eventId = '';
    const dataLines = [];
    for (const line of lines) {
      if (!line) continue;
      if (line.startsWith('id:')) {
        eventId = line.slice(3).trim();
        continue;
      }
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
        continue;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }
    const rawData = dataLines.join('\n');
    return {
      id: eventId,
      event: eventName,
      data: rawData ? JSON.parse(rawData) : null
    };
  }

  const readLoop = (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        while (true) {
          const separatorIndex = buffer.search(/\r?\n\r?\n/);
          if (separatorIndex < 0) break;
          const separatorLength = buffer[separatorIndex] === '\r' ? 4 : 2;
          const block = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + separatorLength);
          if (!block.trim()) continue;
          pushEvent(parseBlock(block));
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      if (pendingReject) {
        const reject = pendingReject;
        pendingResolve = null;
        pendingReject = null;
        reject(error);
      }
    }
  })();

  return {
    async nextRawEvent(expectedEventName, timeoutMs = 5000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        while (queue.length > 0) {
          const event = queue.shift();
          if (event && event.event === expectedEventName) return event;
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        const event = await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            if (pendingResolve === resolve) {
              pendingResolve = null;
              pendingReject = null;
            }
            reject(new Error(`SSE_TIMEOUT:${expectedEventName}`));
          }, remaining);
          pendingResolve = (value) => {
            clearTimeout(timeoutId);
            resolve(value);
          };
          pendingReject = (error) => {
            clearTimeout(timeoutId);
            reject(error);
          };
        });
        if (event && event.event === expectedEventName) return event;
        queue.push(event);
      }
      throw new Error(`SSE_TIMEOUT:${expectedEventName}`);
    },
    async nextEvent(expectedEventName, timeoutMs = 5000) {
      const event = await this.nextRawEvent(expectedEventName, timeoutMs);
      return event ? event.data : null;
    },
    async close() {
      controller.abort();
      try {
        await readLoop;
      } catch (error) {
        if (!controller.signal.aborted) throw error;
      }
    }
  };
}

function runWorkerCommandPlace(snapshot, action, stateVersion) {
  const modulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const snapshot = JSON.parse(process.argv[2]);",
    "  const action = JSON.parse(process.argv[3]);",
    "  const stateVersion = Number(process.argv[4]);",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const room = {",
    "    roomId: 'ROOMC',",
    "    seed: 7,",
    "    stateVersion,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    seatNames: { black: 'black', white: 'white' },",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },",
    "    lastAcceptedOperationBySeat: { black: null, white: null },",
    "    roomBoardConfig: (snapshot && snapshot.gameState && snapshot.gameState.boardConfig) ? snapshot.gameState.boardConfig : null,",
    "    snapshot",
    "  };",
    "  const storage = new Map();",
    "  storage.set('match_room_state_v1', room);",
    "  const state = {",
    "    storage: {",
    "      get: async (key) => storage.get(key),",
    "      put: async (key, value) => storage.set(key, value),",
    "      delete: async (key) => storage.delete(key)",
    "    }",
    "  };",
    "  const durableObject = new MatchRoomDurableObject(state);",
    "  let broadcastMeta = null;",
    "  durableObject.broadcastSnapshot = async (meta) => { broadcastMeta = meta; };",
    "  const response = await durableObject.handlePublish({",
    "    roomId: room.roomId,",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: 'token_black',",
    "    baseVersion: stateVersion,",
    "    operationId: 'op_contract_place_1',",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: action.row, col: action.col },",
    "    turnIndex: action.turnIndex,",
    "    action",
    "  });",
    "  const payload = await response.json();",
    `  process.stdout.write('${WORKER_RESULT_MARKER}' + JSON.stringify({ status: response.status, payload, broadcastMeta }));`,
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  const result = spawnSync(process.execPath, [
    '-e',
    runner,
    modulePath,
    JSON.stringify(snapshot),
    JSON.stringify(action),
    String(stateVersion)
  ], {
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'worker playback contract runner failed');
  }
  const output = String(result.stdout || '');
  const markerIndex = output.lastIndexOf(WORKER_RESULT_MARKER);
  if (markerIndex < 0) {
    throw new Error(output || 'worker playback contract runner did not emit result marker');
  }
  return JSON.parse(output.slice(markerIndex + WORKER_RESULT_MARKER.length));
}

function buildCommandAction(turnIndex, overrides = {}) {
  return {
    type: 'place',
    playerKey: 'black',
    row: 2,
    col: 3,
    turnIndex,
    ...overrides
  };
}

function buildFirstLegalAction(snapshot) {
  const gameState = clone(snapshot && snapshot.gameState);
  const currentPlayer = Number(gameState && gameState.currentPlayer);
  const legalMoves = Core.getLegalMoves(gameState, currentPlayer);
  if (!Array.isArray(legalMoves) || legalMoves.length <= 0) {
    throw new Error('NO_LEGAL_MOVES_FOR_SNAPSHOT');
  }
  return buildCommandAction(
    Number(snapshot && snapshot.cardState && snapshot.cardState.turnIndex) || 1,
    {
      playerKey: currentPlayer === -1 ? 'white' : 'black',
      row: Number(legalMoves[0].row),
      col: Number(legalMoves[0].col)
    }
  );
}

function buildExpectedAssembly(snapshot, action) {
  const cardState = clone(snapshot.cardState);
  const gameState = clone(snapshot.gameState);
  const actingPlayerKey = normalizePlayerKey(action && action.playerKey) || 'black';
  const result = TurnPipeline.applyTurnSafe(cardState, gameState, actingPlayerKey, action);
  if (!result || result.ok !== true) {
    throw new Error(`TURN_PIPELINE_FAILED:${result && result.rejectedReason ? result.rejectedReason : 'unknown'}`);
  }
  return helpers.assemblePlaybackEvents({
    rawEvents: result.events,
    presentationEvents: result.presentationEvents || (result.cardState && result.cardState.presentationEvents) || [],
    snapshot: {
      cardState: result.cardState,
      gameState: result.gameState
    },
    fallbackPlayerKey: actingPlayerKey,
    adapter,
    normalizePlayerKey
  });
}

function expectPrefix(actualEvents, expectedEvents) {
  expect(Array.isArray(actualEvents)).toBe(true);
  expect(actualEvents.slice(0, expectedEvents.length)).toEqual(expectedEvents);
}

function collectFlipEvents(events) {
  return (Array.isArray(events) ? events : [])
    .filter((event) => event && event.type === 'flip')
    .map((event) => ({
      phase: Number(event.phase),
      targets: (Array.isArray(event.targets) ? event.targets : []).map((target) => ({
        r: target.r,
        col: target.col,
        ownerBefore: target.ownerBefore,
        ownerAfter: target.ownerAfter
      }))
    }));
}

async function createJoinedLocalRoom(options = {}) {
  const roomBoardConfig = options && options.roomBoardConfig
    ? clone(options.roomBoardConfig)
    : null;
  const server = createLocalMatchServer();
  const port = await listen(server);
  const createPayload = { playerName: 'black' };
  if (roomBoardConfig) createPayload.roomBoardConfig = roomBoardConfig;
  const createResponse = await requestJson(port, 'POST', '/api/match/create', createPayload);
  const roomId = createResponse.data.roomId;
  const blackToken = createResponse.data.seatToken;
  const joinResponse = await requestJson(port, 'POST', '/api/match/join', {
    roomId,
    playerName: 'white'
  });
  const whiteToken = joinResponse.data.seatToken;
  const stateResponse = await requestJson(
    port,
    'GET',
    `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(blackToken)}`
  );
  return {
    server,
    port,
    roomId,
    blackToken,
    whiteToken,
    stateResponse
  };
}

describe('network playback event assembly contract', () => {
  afterEach(() => {
    resetRoomsForTests();
  });

  test('assemblePlaybackEvents builds final playback with diagnostics', () => {
    const result = helpers.assemblePlaybackEvents({
      rawEvents: [
        { type: 'place', row: 2, col: 3, player: 'white', actionId: 'place-1', turnIndex: 9 }
      ],
      presentationEvents: [
        { type: 'DRAW_CARD', player: 'white', cardId: 'draw-1', count: 1, turnIndex: 9 }
      ],
      snapshot: {
        cardState: { turnIndex: 9 },
        gameState: { board: Array.from({ length: 8 }, () => Array(8).fill(0)) }
      },
      fallbackPlayerKey: 'white',
      adapter: {
        mapToPlaybackEvents: jest.fn(() => [{ type: 'hand_add', phase: 1, targets: [{ player: 'white', cardId: 'draw-1' }] }]),
        appendSoundEffectPlaybackEvents: jest.fn((playbackEvents) => playbackEvents.concat([
          { type: 'sound_effect', phase: 1, targets: [{ soundKey: 'draw_card' }] }
        ]))
      },
      normalizePlayerKey
    });

    expect(result.playbackEvents).toEqual([
      {
        type: 'place_hand_animation',
        phase: 0,
        rawType: 'place',
        actionId: 'place-1',
        turnIndex: 9,
        targets: [{ r: 2, col: 3, player: 'white', owner: 'white' }]
      },
      { type: 'hand_add', phase: 1, targets: [{ player: 'white', cardId: 'draw-1' }] },
      { type: 'sound_effect', phase: 1, targets: [{ soundKey: 'draw_card' }] }
    ]);
    expect(result.diagnostics).toMatchObject({
      rawPlaceCount: 1,
      placeHandAnimationCount: 1,
      warnings: []
    });
  });

test('assemblePlaybackEvents reports mismatch warnings when final playback loses place hand events', () => {
    const result = helpers.assemblePlaybackEvents({
      rawEvents: [
        { type: 'place', row: 2, col: 3, player: 'black', actionId: 'place-1', turnIndex: 1 }
      ],
      presentationEvents: [],
      snapshot: {
        cardState: { turnIndex: 1 },
        gameState: { board: Array.from({ length: 8 }, () => Array(8).fill(0)) }
      },
      fallbackPlayerKey: 'black',
      adapter: {
        normalizePlaybackEvents: jest.fn(() => [])
      },
      normalizePlayerKey
    });

    expect(result.playbackEvents).toEqual([]);
    expect(result.diagnostics.rawPlaceCount).toBe(1);
    expect(result.diagnostics.placeHandAnimationCount).toBe(0);
    expect(result.diagnostics.warnings).toEqual([
      expect.stringContaining('raw place count')
    ]);
  });

  test('assemblePlaybackEvents keeps edge place events on a 7x9 custom board snapshot', () => {
    const result = helpers.assemblePlaybackEvents({
      rawEvents: [
        { type: 'place', row: 6, col: 8, player: 'white', actionId: 'place-edge-1', turnIndex: 9 }
      ],
      presentationEvents: [],
      snapshot: {
        cardState: { turnIndex: 9 },
        gameState: {
          board: createBoard(7, 9),
          boardConfig: { rows: 7, cols: 9, standard8x8: false }
        }
      },
      fallbackPlayerKey: 'white',
      adapter: {
        normalizePlaybackEvents: jest.fn((events) => events)
      },
      normalizePlayerKey
    });

    expect(result.playbackEvents).toEqual([
      {
        type: 'place_hand_animation',
        phase: 0,
        rawType: 'place',
        actionId: 'place-edge-1',
        turnIndex: 9,
        targets: [{ r: 6, col: 8, player: 'white', owner: 'white' }]
      }
    ]);
    expect(result.diagnostics.warnings).toEqual([]);
  });

  test('shared helper contract stays aligned across UI adapter, worker, and local match server', async () => {
    let room = null;
    let stream = null;
    try {
      room = await createJoinedLocalRoom();
      expect(room.stateResponse.status).toBe(200);
      expect(room.stateResponse.data.ok).toBe(true);

      const snapshot = room.stateResponse.data.snapshot;
      const stateVersion = room.stateResponse.data.stateVersion;
      const turnIndex = Number(snapshot && snapshot.cardState && snapshot.cardState.turnIndex) || 1;
      const action = buildCommandAction(turnIndex);
      const expected = buildExpectedAssembly(snapshot, action);

      const uiResult = adapter.runTurnWithAdapter(
        clone(snapshot.cardState),
        clone(snapshot.gameState),
        'black',
        action,
        TurnPipeline
      );
      expect(uiResult.ok).toBe(true);
      expect(uiResult.playbackEvents).toEqual(expected.playbackEvents);

      const workerResult = runWorkerCommandPlace(snapshot, action, stateVersion);
      expect(workerResult.status).toBe(200);
      expect(workerResult.payload.ok).toBe(true);
      expectPrefix(workerResult.broadcastMeta && workerResult.broadcastMeta.playbackEvents, expected.playbackEvents);
      expect(collectFlipEvents(workerResult.broadcastMeta && workerResult.broadcastMeta.playbackEvents))
        .toEqual(collectFlipEvents(expected.playbackEvents));

      stream = await openSseStream(
        room.port,
        `/api/match/stream?roomId=${encodeURIComponent(room.roomId)}&seatKey=black&seatToken=${encodeURIComponent(room.blackToken)}`
      );
      const initialSnapshot = await stream.nextEvent('snapshot');
      expect(initialSnapshot).toMatchObject({
        ok: true,
        roomId: room.roomId,
        playbackEvents: []
      });

      const publishResponse = await requestJson(room.port, 'POST', '/api/match/publish', {
        roomId: room.roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken: room.blackToken,
        baseVersion: stateVersion,
        operationId: 'op_contract_place_1',
        actionType: 'place',
        actor: 'black',
        params: { row: action.row, col: action.col },
        turnIndex: action.turnIndex,
        action
      });
      expect(publishResponse.status).toBe(200);
      expect(publishResponse.data.ok).toBe(true);

      const publishedSnapshot = await stream.nextEvent('snapshot');
      expect(publishedSnapshot).toMatchObject({
        ok: true,
        roomId: room.roomId
      });
      expectPrefix(publishedSnapshot.playbackEvents, expected.playbackEvents);
      expect(collectFlipEvents(publishedSnapshot.playbackEvents))
        .toEqual(collectFlipEvents(expected.playbackEvents));
    } finally {
      if (stream) {
        await stream.close();
      }
      if (room && room.server) {
        await closeServer(room.server);
      }
    }
  }, 20000);

  test('shared helper contract stays aligned across UI adapter, worker, and local match server on 7x9 room', async () => {
    let room = null;
    let stream = null;
    try {
      const roomBoardConfig = { rows: 7, cols: 9, standard8x8: false };
      room = await createJoinedLocalRoom({ roomBoardConfig });
      expect(room.stateResponse.status).toBe(200);
      expect(room.stateResponse.data.ok).toBe(true);
      expect(room.stateResponse.data.roomBoardConfig).toMatchObject(roomBoardConfig);

      const snapshot = room.stateResponse.data.snapshot;
      expect(snapshot.gameState.board).toHaveLength(7);
      expect(snapshot.gameState.board[0]).toHaveLength(9);
      const stateVersion = room.stateResponse.data.stateVersion;
      const action = buildFirstLegalAction(snapshot);
      const expected = buildExpectedAssembly(snapshot, action);

      const uiResult = adapter.runTurnWithAdapter(
        clone(snapshot.cardState),
        clone(snapshot.gameState),
        action.playerKey,
        action,
        TurnPipeline
      );
      expect(uiResult.ok).toBe(true);
      expect(uiResult.playbackEvents).toEqual(expected.playbackEvents);

      const workerResult = runWorkerCommandPlace(snapshot, action, stateVersion);
      expect(workerResult.status).toBe(200);
      expect(workerResult.payload.ok).toBe(true);
      expect(workerResult.payload.roomBoardConfig).toMatchObject(roomBoardConfig);
      expect(workerResult.payload.snapshot.gameState.board).toHaveLength(7);
      expect(workerResult.payload.snapshot.gameState.board[0]).toHaveLength(9);
      expectPrefix(workerResult.broadcastMeta && workerResult.broadcastMeta.playbackEvents, expected.playbackEvents);
      expect(collectFlipEvents(workerResult.broadcastMeta && workerResult.broadcastMeta.playbackEvents))
        .toEqual(collectFlipEvents(expected.playbackEvents));

      stream = await openSseStream(
        room.port,
        `/api/match/stream?roomId=${encodeURIComponent(room.roomId)}&seatKey=black&seatToken=${encodeURIComponent(room.blackToken)}`
      );
      const initialSnapshot = await stream.nextEvent('snapshot');
      expect(initialSnapshot).toMatchObject({
        ok: true,
        roomId: room.roomId,
        roomBoardConfig
      });
      expect(initialSnapshot.snapshot.gameState.board).toHaveLength(7);
      expect(initialSnapshot.snapshot.gameState.board[0]).toHaveLength(9);

      const publishResponse = await requestJson(room.port, 'POST', '/api/match/publish', {
        roomId: room.roomId,
        seatKey: action.playerKey,
        playerKey: action.playerKey,
        seatToken: action.playerKey === 'white' ? room.whiteToken : room.blackToken,
        baseVersion: stateVersion,
        operationId: 'op_contract_custom_board_place_1',
        actionType: 'place',
        actor: action.playerKey,
        params: { row: action.row, col: action.col },
        turnIndex: action.turnIndex,
        action
      });
      expect(publishResponse.status).toBe(200);
      expect(publishResponse.data.ok).toBe(true);
      expect(publishResponse.data.roomBoardConfig).toMatchObject(roomBoardConfig);
      expect(publishResponse.data.snapshot.gameState.board).toHaveLength(7);
      expect(publishResponse.data.snapshot.gameState.board[0]).toHaveLength(9);

      const publishedSnapshot = await stream.nextEvent('snapshot');
      expect(publishedSnapshot).toMatchObject({
        ok: true,
        roomId: room.roomId,
        roomBoardConfig
      });
      expectPrefix(publishedSnapshot.playbackEvents, expected.playbackEvents);
      expect(collectFlipEvents(publishedSnapshot.playbackEvents))
        .toEqual(collectFlipEvents(expected.playbackEvents));
      expect(publishedSnapshot.snapshot.gameState.board).toHaveLength(7);
      expect(publishedSnapshot.snapshot.gameState.board[0]).toHaveLength(9);
    } finally {
      if (stream) {
        await stream.close();
      }
      if (room && room.server) {
        await closeServer(room.server);
      }
    }
  }, 20000);

  test('local match stream replays missed snapshot events after Last-Event-ID reconnect', async () => {
    let room = null;
    let firstStream = null;
    let resumedStream = null;
    try {
      room = await createJoinedLocalRoom();
      expect(room.stateResponse.status).toBe(200);
      expect(room.stateResponse.data.ok).toBe(true);

      const initialSnapshot = room.stateResponse.data.snapshot;
      const initialTurnIndex = Number(initialSnapshot && initialSnapshot.cardState && initialSnapshot.cardState.turnIndex) || 1;

      firstStream = await openSseStream(
        room.port,
        `/api/match/stream?roomId=${encodeURIComponent(room.roomId)}&seatKey=black&seatToken=${encodeURIComponent(room.blackToken)}`
      );
      await firstStream.nextEvent('snapshot');

      const blackPublish = await requestJson(room.port, 'POST', '/api/match/publish', {
        roomId: room.roomId,
        seatKey: 'black',
        playerKey: 'black',
        seatToken: room.blackToken,
        baseVersion: room.stateResponse.data.stateVersion,
        operationId: 'op_resume_black_1',
        actionType: 'place',
        actor: 'black',
        params: { row: 2, col: 3 },
        turnIndex: initialTurnIndex,
        action: {
          type: 'place',
          playerKey: 'black',
          row: 2,
          col: 3,
          turnIndex: initialTurnIndex
        }
      });
      expect(blackPublish.status).toBe(200);
      expect(blackPublish.data.ok).toBe(true);
      expect(blackPublish.data.snapshot._meta).toEqual(expect.objectContaining({
        authority: 'server',
        version: blackPublish.data.stateVersion,
        projectedForSeat: 'black',
        turnStartReconciled: true
      }));

      const broadcastedSnapshot = await firstStream.nextRawEvent('snapshot');
      const lastEventId = broadcastedSnapshot.id;
      expect(lastEventId).toBeTruthy();

      await firstStream.close();
      firstStream = null;

      const afterBlackSnapshot = blackPublish.data.snapshot;
      const whiteTurnIndex = Number(afterBlackSnapshot && afterBlackSnapshot.cardState && afterBlackSnapshot.cardState.turnIndex) || 2;
      const whitePublish = await requestJson(room.port, 'POST', '/api/match/publish', {
        roomId: room.roomId,
        seatKey: 'white',
        playerKey: 'white',
        seatToken: room.whiteToken,
        baseVersion: blackPublish.data.stateVersion,
        operationId: 'op_resume_white_1',
        actionType: 'place',
        actor: 'white',
        params: { row: 2, col: 2 },
        turnIndex: whiteTurnIndex,
        action: {
          type: 'place',
          playerKey: 'white',
          row: 2,
          col: 2,
          turnIndex: whiteTurnIndex
        }
      });
      expect(whitePublish.status).toBe(200);
      expect(whitePublish.data.ok).toBe(true);
      expect(whitePublish.data.snapshot._meta).toEqual(expect.objectContaining({
        authority: 'server',
        version: whitePublish.data.stateVersion,
        projectedForSeat: 'white',
        turnStartReconciled: true
      }));

      resumedStream = await openSseStream(
        room.port,
        `/api/match/stream?roomId=${encodeURIComponent(room.roomId)}&seatKey=black&seatToken=${encodeURIComponent(room.blackToken)}`,
        { headers: { 'Last-Event-ID': lastEventId } }
      );
      const resumedSnapshot = await resumedStream.nextRawEvent('snapshot');
      expect(resumedSnapshot.id).toBeTruthy();
      expect(resumedSnapshot.id).not.toBe(lastEventId);
      expect(resumedSnapshot.data).toMatchObject({
        ok: true,
        roomId: room.roomId,
        stateVersion: whitePublish.data.stateVersion,
        snapshot: expect.objectContaining({
          stateVersion: whitePublish.data.snapshot.stateVersion,
          _meta: expect.objectContaining({
            authority: 'server',
            version: whitePublish.data.stateVersion,
            projectedForSeat: 'black',
            turnStartReconciled: true
          })
        })
      });
    } finally {
      if (firstStream) {
        await firstStream.close();
      }
      if (resumedStream) {
        await resumedStream.close();
      }
      if (room && room.server) {
        await closeServer(room.server);
      }
    }
  }, 20000);
});

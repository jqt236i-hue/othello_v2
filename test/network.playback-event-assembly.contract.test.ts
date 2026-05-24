import * as http from 'http';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';
import * as helpers from '../shared/playback-event-helpers.js';
import * as adapter from '../game/turn/pipeline_ui_adapter.js';
import * as Core from '../game/logic/core.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as MatchAuthority from '../utils/match-authority.js';
import * as SeededPRNG from '../game/schema/prng.js';
import { createLocalMatchServer, resetRoomsForTests, patchRoomSnapshotForTests } from '../scripts/local-match-server.js';

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

function runWorkerCommandPlace(snapshot, action, stateVersion, options = {}) {
  const playerKey = normalizePlayerKey((options && options.playerKey) || (action && action.playerKey)) || 'black';
  const seatToken = playerKey === 'white' ? 'token_white' : 'token_black';
  const operationId = (options && options.operationId) || `op_contract_${playerKey}_${stateVersion}`;
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
    "  const playerKey = JSON.parse(process.argv[5]);",
    "  const seatToken = playerKey === 'white' ? 'token_white' : 'token_black';",
    "  const operationId = JSON.parse(process.argv[6]);",
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
    "    seatKey: playerKey,",
    "    playerKey,",
    "    seatToken,",
    "    baseVersion: stateVersion,",
    "    operationId,",
    "    actionType: 'place',",
    "    actor: playerKey,",
    "    params: Object.assign({ row: action.row, col: action.col }, action.meteorTarget ? { meteorTarget: action.meteorTarget } : {}, action.shrinkTarget ? { shrinkTarget: action.shrinkTarget } : {}, action.superBuoyancyTarget ? { superBuoyancyTarget: action.superBuoyancyTarget } : {}),",
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
    String(stateVersion),
    JSON.stringify(playerKey),
    JSON.stringify(operationId)
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

function buildExpectedAssembly(snapshot, action, label = '') {
  const cardState = clone(snapshot.cardState);
  const gameState = clone(snapshot.gameState);
  const actingPlayerKey = normalizePlayerKey(action && action.playerKey) || 'black';
  const stateVersion = Number.isFinite(Number(action && action.turnIndex)) ? Number(action.turnIndex) : 0;
  const prngSeed = MatchAuthority.createTurnStartSeed({ seed: 7 }, snapshot, actingPlayerKey);
  const result = TurnPipeline.applyTurnSafe(
    cardState,
    gameState,
    actingPlayerKey,
    action,
    createFixturePrng(prngSeed),
    { currentStateVersion: stateVersion }
  );
  if (!result || result.ok !== true) {
    throw new Error(`TURN_PIPELINE_FAILED:${label}:${result && result.rejectedReason ? result.rejectedReason : 'unknown'}:${result && result.errorMessage ? result.errorMessage : ''}`);
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

function createFixturePrng(seed = 7) {
  return SeededPRNG.createPRNG(seed);
}

function createBaseSnapshot(options = {}) {
  const currentPlayerKey = normalizePlayerKey((options && options.currentPlayer) || 'white') || 'white';
  const currentPlayer = currentPlayerKey === 'white' ? Core.WHITE : Core.BLACK;
  const gameState = Core.createGameState();
  gameState.currentPlayer = currentPlayer;
  gameState.turnNumber = Number.isFinite(Number(options && options.turnNumber)) ? Number(options.turnNumber) : 2;
  gameState.stateVersion = Number.isFinite(Number(options && options.turnIndex)) ? Number(options.turnIndex) : 2;

  const cardState = CardLogic.createCardState(createFixturePrng(7), {});
  cardState.debugNoDraw = true;
  cardState.turnIndex = Number.isFinite(Number(options && options.turnIndex)) ? Number(options.turnIndex) : 2;
  cardState.presentationEvents = [];
  cardState._presentationEventsPersist = [];
  delete cardState.prngState;
  return {
    stateVersion: gameState.stateVersion,
    gameState,
    cardState
  };
}

function setStone(snapshot, row, col, ownerKey) {
  snapshot.gameState.board[row][col] = ownerKey === 'white' ? Core.WHITE : Core.BLACK;
}

function addSpecialMarker(snapshot, row, col, owner, type, data = {}) {
  if (!Array.isArray(snapshot.cardState.markers)) snapshot.cardState.markers = [];
  snapshot.cardState.markers.push({
    id: snapshot.cardState.markers.length + 1,
    kind: 'specialStone',
    row,
    col,
    owner,
    data: {
      type,
      remainingOwnerTurns: 5,
      ...data
    }
  });
}

function addSalvationGod(snapshot, row = 7, col = 0, owner = 'black') {
  setStone(snapshot, row, col, owner);
  addSpecialMarker(snapshot, row, col, owner, 'STONE_SALVATION_GOD', { remainingOwnerTurns: 10 });
}

function buildTurnStartDestroyFixture(kind) {
  const snapshot = createBaseSnapshot({ currentPlayer: 'white', turnIndex: 2 });
  snapshot.cardState.pendingEffectByPlayer.white = { type: 'FREE_PLACEMENT', stage: 'awaitPlace' };
  addSalvationGod(snapshot, 7, 0, 'black');
  setStone(snapshot, 1, 1, 'black');
  setStone(snapshot, 2, 2, 'white');

  if (kind === 'SNIPER') {
    setStone(snapshot, 7, 7, 'white');
    addSpecialMarker(snapshot, 7, 7, 'white', 'SNIPER', { remainingOwnerTurns: 3 });
  } else if (kind === 'DESTROY_DRAGON') {
    addSpecialMarker(snapshot, 2, 2, 'white', 'DESTROY_DRAGON', { remainingOwnerTurns: 3 });
  } else if (kind === 'LIGHTNING') {
    setStone(snapshot, 6, 6, 'white');
    addSpecialMarker(snapshot, 6, 6, 'white', 'LIGHTNING', { remainingOwnerTurns: 3 });
  } else if (kind === 'GLUTTONOUS') {
    setStone(snapshot, 1, 2, 'white');
    addSpecialMarker(snapshot, 1, 2, 'white', 'GLUTTONOUS', { remainingOwnerTurns: 3 });
  } else if (kind === 'WILL_HUNTER_KING') {
    setStone(snapshot, 1, 2, 'white');
    addSpecialMarker(snapshot, 1, 2, 'white', 'WILL_HUNTER_KING', { remainingOwnerTurns: 5 });
    addSpecialMarker(snapshot, 1, 1, 'black', 'OBSERVER', { remainingOwnerTurns: 3 });
  } else if (kind === 'ULTIMATE_DESTROY_GOD') {
    setStone(snapshot, 1, 2, 'black');
    setStone(snapshot, 2, 1, 'black');
    setStone(snapshot, 6, 6, 'white');
    setStone(snapshot, 5, 6, 'black');
    setStone(snapshot, 6, 5, 'black');
    addSpecialMarker(snapshot, 2, 2, 'white', 'ULTIMATE_DESTROY_GOD', { remainingOwnerTurns: 5 });
    addSpecialMarker(snapshot, 6, 6, 'white', 'ULTIMATE_DESTROY_GOD', { remainingOwnerTurns: 5 });
  }

  return {
    name: kind,
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'white',
      row: 0,
      col: 1,
      actionId: `fixture_${String(kind).toLowerCase()}_place`,
      __skipTurnStart: false
    })
  };
}

function buildMeteorFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  addSalvationGod(snapshot, 7, 0, 'black');
  setStone(snapshot, 1, 1, 'black');
  snapshot.cardState.pendingEffectByPlayer.black = { type: 'METEOR_WILL', stage: 'selectTarget', cardId: 'meteor_01' };
  return {
    name: 'METEOR_WILL',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: 'fixture_meteor_place',
      __skipTurnStart: false,
      meteorTarget: { row: 1, col: 1 }
    })
  };
}

function buildMeteorOpponentSalvationFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  addSalvationGod(snapshot, 7, 0, 'black');
  setStone(snapshot, 1, 1, 'white');
  snapshot.cardState.pendingEffectByPlayer.black = { type: 'METEOR_WILL', stage: 'selectTarget', cardId: 'meteor_01' };
  return {
    name: 'METEOR_WILL_OPPONENT_SALVATION',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: 'fixture_meteor_opponent_salvation_place',
      __skipTurnStart: false,
      meteorTarget: { row: 1, col: 1 }
    })
  };
}

function buildBoardShrinkFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  addSalvationGod(snapshot, 7, 0, 'black');
  setStone(snapshot, 0, 0, 'black');
  snapshot.cardState.pendingEffectByPlayer.black = {
    type: 'BOARD_SHRINK_WILL',
    stage: 'selectTarget',
    cardId: 'board_shrink_01',
    selectedCount: 0,
    maxSelections: 3,
    selectedTargets: []
  };
  return {
    name: 'BOARD_SHRINK_WILL',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: 'fixture_board_shrink_place',
      __skipTurnStart: false,
      shrinkTarget: { row: 0, col: 0 }
    })
  };
}

function buildSuperBuoyancyFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  setStone(snapshot, 6, 4, 'black');
  snapshot.cardState.pendingEffectByPlayer.black = {
    type: 'SUPER_BUOYANCY_WILL',
    stage: 'selectTarget',
    cardId: 'super_buoyancy_01'
  };
  return {
    name: 'SUPER_BUOYANCY_WILL',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: 'fixture_super_buoyancy_place',
      __skipTurnStart: false,
      superBuoyancyTarget: { row: 6, col: 4 }
    })
  };
}

function buildPlaybackParityFixtures() {
  return [
    buildTurnStartDestroyFixture('SNIPER'),
    buildTurnStartDestroyFixture('DESTROY_DRAGON'),
    buildTurnStartDestroyFixture('LIGHTNING'),
    buildTurnStartDestroyFixture('GLUTTONOUS'),
    buildTurnStartDestroyFixture('WILL_HUNTER_KING'),
    buildTurnStartDestroyFixture('ULTIMATE_DESTROY_GOD'),
    buildMeteorFixture(),
    buildMeteorOpponentSalvationFixture(),
    buildBoardShrinkFixture(),
    buildSuperBuoyancyFixture()
  ];
}

function normalizePlaybackEventForParity(event) {
  if (!event || typeof event !== 'object') return event;
  const meta = event.meta && typeof event.meta === 'object' ? event.meta : {};
  const normalized = {
    type: event.type || null,
    phase: Number.isFinite(Number(event.phase)) ? Number(event.phase) : null,
    rawType: event.rawType || null,
    cause: event.cause || meta.cause || null,
    reason: event.reason || meta.reason || null,
    actionId: event.actionId || meta.actionId || null,
    effectBlockId: event.effectBlockId || meta.effectBlockId || null,
    effectKind: event.effectKind || meta.effectKind || null,
    soundKey: event.soundKey || meta.soundKey || null,
    spawnIntent: event.spawnIntent || meta.spawnIntent || null,
    moveIntent: event.moveIntent || meta.moveIntent || null,
    targets: Array.isArray(event.targets)
      ? event.targets.map((target) => normalizePlaybackTargetForParity(target))
      : []
  };
  return normalized;
}

function normalizePlaybackTargetForParity(target) {
  if (!target || typeof target !== 'object') return target;
  const meta = target.meta && typeof target.meta === 'object' ? target.meta : {};
  return {
    r: Number.isInteger(target.r) ? target.r : (Number.isInteger(target.row) ? target.row : null),
    row: Number.isInteger(target.row) ? target.row : (Number.isInteger(target.r) ? target.r : null),
    col: Number.isInteger(target.col) ? target.col : null,
    prevRow: Number.isInteger(target.prevRow) ? target.prevRow : null,
    prevCol: Number.isInteger(target.prevCol) ? target.prevCol : null,
    owner: target.owner || null,
    player: target.player || null,
    ownerBefore: target.ownerBefore || null,
    ownerAfter: target.ownerAfter || null,
    cause: target.cause || meta.cause || null,
    reason: target.reason || meta.reason || null,
    soundKey: target.soundKey || meta.soundKey || null,
    spawnIntent: target.spawnIntent || meta.spawnIntent || null,
    sourceRow: Number.isInteger(target.sourceRow) ? target.sourceRow : (Number.isInteger(meta.sourceRow) ? meta.sourceRow : null),
    sourceCol: Number.isInteger(target.sourceCol) ? target.sourceCol : (Number.isInteger(meta.sourceCol) ? meta.sourceCol : null),
    from: target.from && typeof target.from === 'object'
      ? {
        r: Number.isInteger(target.from.r) ? target.from.r : (Number.isInteger(target.from.row) ? target.from.row : null),
        col: Number.isInteger(target.from.col) ? target.from.col : null
      }
      : null,
    to: target.to && typeof target.to === 'object'
      ? {
        r: Number.isInteger(target.to.r) ? target.to.r : (Number.isInteger(target.to.row) ? target.to.row : null),
        col: Number.isInteger(target.to.col) ? target.to.col : null
      }
      : null,
    moveIntent: target.moveIntent || meta.moveIntent || null,
    special: target.special || meta.special || null
  };
}

function normalizePlaybackForParity(events) {
  return (Array.isArray(events) ? events : []).map((event) => normalizePlaybackEventForParity(event));
}

function collectParityEffectGroups(events) {
  const groups = [];
  for (const event of Array.isArray(events) ? events : []) {
    const group = event && (event.effectBlockId || (event.meta && event.meta.effectBlockId));
    if (!group) continue;
    groups.push({
      group: String(group).replace(/effect_\d+_\d+_[a-z0-9_]+/g, 'effect'),
      type: event.type || null,
      phase: Number.isFinite(Number(event.phase)) ? Number(event.phase) : null
    });
  }
  return groups;
}

function expectPlaybackParity(actualEvents, expectedEvents) {
  expect(normalizePlaybackForParity(actualEvents)).toEqual(normalizePlaybackForParity(expectedEvents));
  expect(collectParityEffectGroups(actualEvents)).toEqual(collectParityEffectGroups(expectedEvents));
}

function expectPlaybackParityPrefix(actualEvents, expectedEvents) {
  const actualPrefix = Array.isArray(actualEvents) ? actualEvents.slice(0, expectedEvents.length) : actualEvents;
  expectPlaybackParity(actualPrefix, expectedEvents);
}

async function publishFixtureThroughLocalServer(fixture, stateVersion) {
  let room = null;
  let stream = null;
  try {
    room = await createJoinedLocalRoom();
    const patched = patchRoomSnapshotForTests(room.roomId, (serverRoom) => {
      serverRoom.snapshot = clone(fixture.snapshot);
      serverRoom.snapshot.stateVersion = stateVersion;
      serverRoom.stateVersion = stateVersion;
      serverRoom.seed = 7;
      serverRoom.updatedAt = Date.now();
      serverRoom.roomBoardConfig = fixture.snapshot && fixture.snapshot.gameState
        ? fixture.snapshot.gameState.boardConfig || null
        : null;
    });
    expect(patched).toBe(true);

    const playerKey = normalizePlayerKey(fixture.action && fixture.action.playerKey) || 'black';
    const seatToken = playerKey === 'white' ? room.whiteToken : room.blackToken;
    stream = await openSseStream(
      room.port,
      `/api/match/stream?roomId=${encodeURIComponent(room.roomId)}&seatKey=${encodeURIComponent(playerKey)}&seatToken=${encodeURIComponent(seatToken)}`
    );
    await stream.nextEvent('snapshot');

    const publishResponse = await requestJson(room.port, 'POST', '/api/match/publish', {
      roomId: room.roomId,
      seatKey: playerKey,
      playerKey,
      seatToken,
      baseVersion: stateVersion,
      operationId: `op_contract_${fixture.name.toLowerCase()}_1`,
      actionType: 'place',
      actor: playerKey,
      params: {
        row: fixture.action.row,
        col: fixture.action.col,
        ...(fixture.action.meteorTarget ? { meteorTarget: fixture.action.meteorTarget } : {}),
        ...(fixture.action.shrinkTarget ? { shrinkTarget: fixture.action.shrinkTarget } : {}),
        ...(fixture.action.superBuoyancyTarget ? { superBuoyancyTarget: fixture.action.superBuoyancyTarget } : {})
      },
      turnIndex: fixture.action.turnIndex,
      action: fixture.action
    });
    expect(publishResponse.status).toBe(200);
    expect(publishResponse.data.ok).toBe(true);

    const publishedSnapshot = await stream.nextEvent('snapshot');
    expect(publishedSnapshot).toMatchObject({ ok: true, roomId: room.roomId });
    return {
      responsePlaybackEvents: publishResponse.data.playbackEvents || [],
      streamPlaybackEvents: publishedSnapshot.playbackEvents || []
    };
  } finally {
    if (stream) await stream.close();
    if (room && room.server) await closeServer(room.server);
  }
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

function collectStoneSalvationGodReviveTargets(events) {
  return (Array.isArray(events) ? events : [])
    .flatMap((event) => Array.isArray(event && event.targets) ? event.targets : [])
    .filter((target) => target && (
      target.cause === 'STONE_SALVATION_GOD' ||
      (target.meta && target.meta.cause === 'STONE_SALVATION_GOD') ||
      target.reason === 'stone_salvation_god_revive' ||
      (target.meta && target.meta.reason === 'stone_salvation_god_revive')
    ))
    .map((target) => ({
      ownerAfter: target.ownerAfter || null,
      destroyedOwner: target.destroyedOwner || (target.meta && target.meta.destroyedOwner) || null,
      revivedOwner: target.revivedOwner || (target.meta && target.meta.revivedOwner) || null
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

  test('assemblePlaybackEvents preserves PLAYBACK_EVENTS wrappers from presentation queues', () => {
    const result = helpers.assemblePlaybackEvents({
      rawEvents: [],
      presentationEvents: [{
        type: 'PLAYBACK_EVENTS',
        events: [
          { type: 'flip', phase: 2, targets: [{ r: 3, col: 4, ownerBefore: 'white', ownerAfter: 'black' }] }
        ],
        meta: { source: 'turn_start' }
      }],
      snapshot: {
        cardState: { turnIndex: 11 },
        gameState: { board: createBoard(8, 8), currentPlayer: 1 }
      },
      fallbackPlayerKey: 'black',
      adapter,
      normalizePlayerKey
    });

    expect(result.playbackEvents).toEqual([
      { type: 'flip', phase: 2, targets: [{ r: 3, col: 4, ownerBefore: 'white', ownerAfter: 'black' }] }
    ]);
    expect(result.diagnostics.warnings).toEqual([]);
  });

  test('playback assembly does not mutate authoritative snapshot state', () => {
    const snapshot = {
      cardState: {
        turnIndex: 3,
        hands: { black: ['meteor_01'], white: ['guard_01'] },
        pendingEffectByPlayer: { black: null, white: null }
      },
      gameState: {
        board: createBoard(8, 8),
        currentPlayer: 1
      }
    };
    const before = clone(snapshot);

    helpers.assemblePlaybackEvents({
      rawEvents: [
        { type: 'place', row: 2, col: 3, player: 'black', actionId: 'place-immutability', turnIndex: 3 }
      ],
      presentationEvents: [
        { type: 'DESTROY', row: 3, col: 3, owner: 'white', turnIndex: 3 }
      ],
      snapshot,
      fallbackPlayerKey: 'black',
      adapter,
      normalizePlayerKey
    });

    expect(snapshot).toEqual(before);
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

  test('card effect playback parity stays aligned across UI adapter, worker, and local match server', async () => {
    const fixtures = buildPlaybackParityFixtures();
    expect(fixtures.length).toBeGreaterThan(0);

    for (const fixture of fixtures) {
      const stateVersion = Number(fixture.action && fixture.action.turnIndex) || 2;
      const expected = buildExpectedAssembly(fixture.snapshot, fixture.action, fixture.name);
      expect(expected.diagnostics && expected.diagnostics.warnings).toEqual([]);
      if (fixture.name === 'METEOR_WILL_OPPONENT_SALVATION') {
        expect(collectStoneSalvationGodReviveTargets(expected.playbackEvents)).toEqual([
          expect.objectContaining({
            ownerAfter: 'black',
            destroyedOwner: 'white',
            revivedOwner: 'black'
          })
        ]);
      }

      adapter.setPipelineUIAdapterRuntime({
        getGamePrng: () => createFixturePrng(MatchAuthority.createTurnStartSeed({ seed: 7 }, fixture.snapshot, fixture.action.playerKey))
      });
      let uiResult;
      try {
        uiResult = adapter.runTurnWithAdapter(
          clone(fixture.snapshot.cardState),
          clone(fixture.snapshot.gameState),
          fixture.action.playerKey,
          fixture.action,
          TurnPipeline
        );
      } finally {
        adapter.setPipelineUIAdapterRuntime(null);
      }
      expect(uiResult.ok).toBe(true);
      expectPlaybackParity(uiResult.playbackEvents, expected.playbackEvents);

      const workerResult = runWorkerCommandPlace(
        fixture.snapshot,
        fixture.action,
        stateVersion,
        {
          playerKey: fixture.action.playerKey,
          operationId: `op_worker_${fixture.name.toLowerCase()}_1`
        }
      );
      expect({ name: fixture.name, status: workerResult.status, payload: workerResult.payload }).toEqual(expect.objectContaining({ status: 200 }));
      expect(workerResult.payload.ok).toBe(true);
      expectPlaybackParityPrefix(workerResult.broadcastMeta && workerResult.broadcastMeta.playbackEvents, expected.playbackEvents);
      if (fixture.name === 'METEOR_WILL_OPPONENT_SALVATION') {
        expect(collectStoneSalvationGodReviveTargets(workerResult.broadcastMeta && workerResult.broadcastMeta.playbackEvents)).toEqual([
          expect.objectContaining({
            ownerAfter: 'black',
            destroyedOwner: 'white',
            revivedOwner: 'black'
          })
        ]);
      }

      const localResult = await publishFixtureThroughLocalServer(fixture, stateVersion);
      expectPlaybackParityPrefix(localResult.responsePlaybackEvents, expected.playbackEvents);
      expectPlaybackParityPrefix(localResult.streamPlaybackEvents, expected.playbackEvents);
      if (fixture.name === 'METEOR_WILL_OPPONENT_SALVATION') {
        expect(collectStoneSalvationGodReviveTargets(localResult.responsePlaybackEvents)).toEqual([
          expect.objectContaining({
            ownerAfter: 'black',
            destroyedOwner: 'white',
            revivedOwner: 'black'
          })
        ]);
        expect(collectStoneSalvationGodReviveTargets(localResult.streamPlaybackEvents)).toEqual([
          expect.objectContaining({
            ownerAfter: 'black',
            destroyedOwner: 'white',
            revivedOwner: 'black'
          })
        ]);
      }
    }
  }, 90000);

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

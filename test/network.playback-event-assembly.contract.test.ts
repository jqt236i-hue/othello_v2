import * as http from 'http';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';
import { JSDOM } from 'jsdom';
import * as helpers from '../shared/playback-event-helpers.js';
import * as adapter from '../game/turn/pipeline_ui_adapter.js';
import * as Core from '../game/logic/core.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as PendingSelectionRegistry from '../game/logic/cards-internal/pending-selection-registry.js';
import * as MatchAuthority from '../utils/match-authority.js';
import * as SeededPRNG from '../game/schema/prng.js';
import AnimationConstants = require('../ui/animation-constants.js');
import { createLocalMatchServer, resetRoomsForTests, patchRoomSnapshotForTests } from '../scripts/local-match-server.js';
import { installAnimationEngineDomBackendMock } from './helpers/animation-engine-dom-backend';

installAnimationEngineDomBackendMock();

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

function createPlaybackDomFromSnapshot(snapshot) {
  const board = snapshot && snapshot.gameState && Array.isArray(snapshot.gameState.board)
    ? snapshot.gameState.board
    : createBoard();
  const html = [
    '<!doctype html><html><body><div id="board">',
    ...board.flatMap((row, r) => row.map((value, col) => {
      const ownerClass = value === Core.BLACK ? 'black' : (value === Core.WHITE ? 'white' : '');
      const disc = ownerClass ? `<div class="disc ${ownerClass}"></div>` : '';
      return `<div class="cell${disc ? ' has-disc' : ''}" data-row="${r}" data-col="${col}">${disc}</div>`;
    })),
    '</div></body></html>'
  ].join('');
  const dom = new JSDOM(html, { pretendToBeVisual: true });
  const markers = snapshot && snapshot.cardState && Array.isArray(snapshot.cardState.markers)
    ? snapshot.cardState.markers
    : [];
  for (const marker of markers) {
    if (!marker || marker.kind !== 'specialStone') continue;
    const type = String(marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
    if (type !== 'FREEZE') continue;
    const cell = dom.window.document.querySelector(`.cell[data-row="${marker.row}"][data-col="${marker.col}"]`);
    const disc = cell ? cell.querySelector('.disc') : null;
    if (!cell || !disc) continue;
    cell.classList.add('frozen-cell');
    const freezeMark = dom.window.document.createElement('div');
    freezeMark.className = 'freeze-mark';
    disc.appendChild(freezeMark);
  }
  return dom;
}

function installPlaybackDomGlobals(dom) {
  global.window = dom.window;
  global.document = dom.window.document;
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  global.window.requestAnimationFrame = global.requestAnimationFrame;
  global.window.DISABLE_ANIMATIONS = true;
  global.window.MATCH_MODE = 'network';
  global.window.getEffectKeyForSpecialType = jest.fn((special) => String(special || '').toLowerCase());
  global.window.setDiscStoneImage = jest.fn();
  global.window.clearStoneVisualEffectState = jest.fn();
  global.window.applyStoneVisualEffect = jest.fn();
  global.window.playHandAnimation = jest.fn((_player, _row, _col, done) => {
    if (typeof done === 'function') done();
  });
  global.window.playCardUseHandAnimation = jest.fn(() => Promise.resolve());
  global.window.playCaptureToHandAnimation = jest.fn(() => Promise.resolve());
  global.window.playDrawCardHandAnimation = jest.fn(() => Promise.resolve());
  global.window.playDirectHandAddAnimation = jest.fn(() => Promise.resolve());
  global.window.playClearHandAnimation = jest.fn(() => Promise.resolve());
  global.window.showRoundBonusDisplay = jest.fn();
  global.window.addLog = jest.fn();
  global.emitBoardUpdate = jest.fn();
  global.SoundEngine = {
    init: jest.fn(),
    playEffectByKey: jest.fn()
  };
}

function clearPlaybackDomGlobals(dom) {
  delete global.SoundEngine;
  delete global.emitBoardUpdate;
  delete global.requestAnimationFrame;
  delete global.window;
  delete global.document;
  if (dom) dom.window.close();
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
    "    params: Object.assign({ row: action.row, col: action.col }, action.heavenBlessingCardId ? { heavenBlessingCardId: action.heavenBlessingCardId } : {}, action.condemnTargetIndex != null ? { condemnTargetIndex: action.condemnTargetIndex } : {}, action.observerWillTargetIndex != null ? { observerWillTargetIndex: action.observerWillTargetIndex } : {}, action.destroyTarget ? { destroyTarget: action.destroyTarget } : {}, action.reverseWillTarget ? { reverseWillTarget: action.reverseWillTarget } : {}, action.temptTarget ? { temptTarget: action.temptTarget } : {}, action.swapTarget ? { swapTarget: action.swapTarget } : {}, action.trapTarget ? { trapTarget: action.trapTarget } : {}, action.expansionTarget ? { expansionTarget: action.expansionTarget } : {}, action.meteorTarget ? { meteorTarget: action.meteorTarget } : {}, action.causalReplayTarget ? { causalReplayTarget: action.causalReplayTarget } : {}, action.shrinkTarget ? { shrinkTarget: action.shrinkTarget } : {}, action.positionSwapTarget ? { positionSwapTarget: action.positionSwapTarget } : {}, action.teleportTarget ? { teleportTarget: action.teleportTarget } : {}, action.strongWindTarget ? { strongWindTarget: action.strongWindTarget } : {}, action.buoyancyTarget ? { buoyancyTarget: action.buoyancyTarget } : {}, action.superBuoyancyTarget ? { superBuoyancyTarget: action.superBuoyancyTarget } : {}, action.gravityTarget ? { gravityTarget: action.gravityTarget } : {}, action.superGravityTarget ? { superGravityTarget: action.superGravityTarget } : {}, action.superAttractionTarget ? { superAttractionTarget: action.superAttractionTarget } : {}, action.cloneTarget ? { cloneTarget: action.cloneTarget } : {}, action.guardTarget ? { guardTarget: action.guardTarget } : {}, action.freezeTarget ? { freezeTarget: action.freezeTarget } : {}, action.blockadeTarget ? { blockadeTarget: action.blockadeTarget } : {}, action.poisonTarget ? { poisonTarget: action.poisonTarget } : {}, action.seedTarget ? { seedTarget: action.seedTarget } : {}, action.bombTarget ? { bombTarget: action.bombTarget } : {}, action.livingWillTarget ? { livingWillTarget: action.livingWillTarget } : {}, action.reincarnationTarget ? { reincarnationTarget: action.reincarnationTarget } : {}, action.extendTarget ? { extendTarget: action.extendTarget } : {}, action.corrosionTarget ? { corrosionTarget: action.corrosionTarget } : {}, action.captureTarget ? { captureTarget: action.captureTarget } : {}),",
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
  const expectedPresentationEvents = (
    Array.isArray(result.presentationEvents) && result.presentationEvents.length > 0
      ? result.presentationEvents
      : (
          Array.isArray(result.cardState && result.cardState.presentationEvents) && result.cardState.presentationEvents.length > 0
            ? result.cardState.presentationEvents
            : (
                Array.isArray(result.cardState && result.cardState._presentationEventsPersist)
                  ? result.cardState._presentationEventsPersist
                  : []
              )
        )
  );
  return helpers.assemblePlaybackEvents({
    rawEvents: result.events,
    presentationEvents: expectedPresentationEvents,
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
  addSpecialMarker(snapshot, row, col, owner, 'STONE_SALVATION_GOD', { remainingOwnerTurns: 12 });
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
    addSpecialMarker(snapshot, 1, 1, 'black', 'LIGHTNING', { remainingOwnerTurns: 3 });
  } else if (kind === 'ULTIMATE_DESTROY_GOD') {
    setStone(snapshot, 1, 2, 'black');
    setStone(snapshot, 2, 1, 'black');
    setStone(snapshot, 6, 6, 'white');
    setStone(snapshot, 5, 6, 'black');
    setStone(snapshot, 6, 5, 'black');
    addSpecialMarker(snapshot, 2, 2, 'white', 'ULTIMATE_DESTROY_GOD', { remainingOwnerTurns: 6 });
    addSpecialMarker(snapshot, 6, 6, 'white', 'ULTIMATE_DESTROY_GOD', { remainingOwnerTurns: 6 });
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

function buildBreedingTurnStartSpawnFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  snapshot.cardState.pendingEffectByPlayer.black = { type: 'FREE_PLACEMENT', stage: 'awaitPlace' };
  setStone(snapshot, 3, 3, 'black');
  addSpecialMarker(snapshot, 3, 3, 'black', 'BREEDING', { remainingOwnerTurns: 5 });
  return {
    name: 'BREEDING_TURN_START_SPAWN',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 0,
      col: 1,
      actionId: 'fixture_breeding_turn_start_place',
      __skipTurnStart: false
    })
  };
}

function buildEscapeTurnStartMoveFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  snapshot.cardState.pendingEffectByPlayer.black = { type: 'FREE_PLACEMENT', stage: 'awaitPlace' };
  setStone(snapshot, 3, 3, 'black');
  setStone(snapshot, 3, 4, 'white');
  addSpecialMarker(snapshot, 3, 3, 'black', 'ESCAPE_HYPERACTIVE', {
    remainingOwnerTurns: 5,
    flipEvadeRemaining: 1
  });
  return {
    name: 'ESCAPE_HYPERACTIVE_TURN_START_MOVE',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 0,
      col: 1,
      actionId: 'fixture_escape_turn_start_move_place',
      __skipTurnStart: false
    })
  };
}

function buildEscapeTurnStartExplosionFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  snapshot.cardState.pendingEffectByPlayer.black = { type: 'FREE_PLACEMENT', stage: 'awaitPlace' };
  setStone(snapshot, 3, 3, 'black');
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      setStone(snapshot, 3 + dr, 3 + dc, 'white');
    }
  }
  addSpecialMarker(snapshot, 3, 3, 'black', 'ESCAPE_HYPERACTIVE', {
    remainingOwnerTurns: 5,
    flipEvadeRemaining: 1
  });
  return {
    name: 'ESCAPE_HYPERACTIVE_TURN_START_EXPLOSION',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 0,
      col: 1,
      actionId: 'fixture_escape_turn_start_explosion_place',
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

function buildBoardShrinkGodFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  for (let col = 0; col < 8; col += 1) setStone(snapshot, 0, col, col % 2 === 0 ? 'black' : 'white');
  snapshot.cardState.pendingEffectByPlayer.black = {
    type: 'BOARD_SHRINK_GOD',
    stage: 'selectTarget',
    cardId: 'board_shrink_god_01',
    firstTarget: { row: 0, col: 0 }
  };
  return {
    name: 'BOARD_SHRINK_GOD',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: 'fixture_board_shrink_god_place',
      __skipTurnStart: false,
      shrinkTarget: { row: 0, col: 1 }
    })
  };
}

function buildBoardExpansionFixture(kind) {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  snapshot.cardState.pendingEffectByPlayer.black = {
    type: kind,
    stage: 'selectTarget',
    cardId: kind === 'BOARD_EXPANSION_GOD' ? 'board_expand_god_01' : 'board_expand_01',
    ...(kind === 'BOARD_EXPANSION_GOD' ? {
      selectedCount: 1,
      maxSelections: 2,
      selectedTargets: [{ row: 0, col: 0 }]
    } : {})
  };
  return {
    name: kind,
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: `fixture_${String(kind).toLowerCase()}_place`,
      __skipTurnStart: false,
      expansionTarget: kind === 'BOARD_EXPANSION_GOD' ? { row: 7, col: 7 } : { row: 3, col: 7 }
    })
  };
}

function buildPositionSwapFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  setStone(snapshot, 3, 4, 'black');
  setStone(snapshot, 3, 3, 'white');
  snapshot.cardState.pendingEffectByPlayer.black = {
    type: 'POSITION_SWAP_WILL',
    stage: 'selectTarget',
    cardId: 'position_swap_01',
    firstTarget: { row: 3, col: 4 }
  };
  return {
    name: 'POSITION_SWAP_WILL',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: 'fixture_position_swap_place',
      __skipTurnStart: false,
      positionSwapTarget: { row: 3, col: 3 }
    })
  };
}

function buildTeleportFixture(kind) {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  setStone(snapshot, 3, 4, 'black');
  snapshot.cardState.pendingEffectByPlayer.black = {
    type: kind,
    stage: 'selectTarget',
    cardId: kind === 'CELL_TELEPORT_WILL' ? 'cell_teleport_01' : 'teleport_01'
  };
  return {
    name: kind,
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: `fixture_${String(kind).toLowerCase()}_place`,
      __skipTurnStart: false,
      teleportTarget: { row: 3, col: 4 }
    })
  };
}

function buildMovementSelectionFixture(config) {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  setStone(snapshot, config.source.row, config.source.col, 'black');
  if (config.blocker) setStone(snapshot, config.blocker.row, config.blocker.col, 'white');
  snapshot.cardState.pendingEffectByPlayer.black = {
    type: config.pendingType,
    stage: 'selectTarget',
    cardId: config.cardId,
    ...(config.pendingExtra || {})
  };
  return {
    name: config.pendingType,
    expectedMoveFrom: { row: config.source.row, col: config.source.col },
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: `fixture_${String(config.pendingType).toLowerCase()}_place`,
      __skipTurnStart: false,
      [config.actionKey]: config.actionTarget || config.source
    })
  };
}

function buildSuperBuoyancyFixture() {
  return buildMovementSelectionFixture({
    cardId: 'super_buoyancy_01',
    pendingType: 'SUPER_BUOYANCY_WILL',
    actionKey: 'superBuoyancyTarget',
    source: { row: 6, col: 4 }
  });
}

function buildCloneWillFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  setStone(snapshot, 3, 3, 'black');
  snapshot.cardState.pendingEffectByPlayer.black = {
    type: 'CLONE_WILL',
    stage: 'selectTarget',
    cardId: 'clone_01'
  };
  return {
    name: 'CLONE_WILL',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: 'fixture_clone_will_place',
      __skipTurnStart: false,
      cloneTarget: { row: 3, col: 3 }
    })
  };
}

function buildGuardWillFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  setStone(snapshot, 3, 3, 'black');
  snapshot.cardState.pendingEffectByPlayer.black = {
    type: 'GUARD_WILL',
    stage: 'selectTarget',
    cardId: 'guard_01'
  };
  return {
    name: 'GUARD_WILL',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: 'fixture_guard_will_place',
      __skipTurnStart: false,
      guardTarget: { row: 3, col: 3 }
    })
  };
}

function buildStatusCellSelectionFixture(config) {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  snapshot.cardState.pendingEffectByPlayer.black = {
    type: config.pendingType,
    stage: 'selectTarget',
    cardId: config.cardId
  };
  return {
    name: config.pendingType,
    expectedStatusApplied: {
      row: 2,
      col: 3,
      special: config.special
    },
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: `fixture_${String(config.pendingType).toLowerCase()}_place`,
      __skipTurnStart: false,
      [config.actionKey]: { row: 2, col: 3 }
    })
  };
}

function buildSimplePendingSelectionFixture(config) {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  if (Array.isArray(config.stones)) {
    for (const stone of config.stones) setStone(snapshot, stone.row, stone.col, stone.owner);
  }
  if (Array.isArray(config.markers)) {
    snapshot.cardState.markers = config.markers.map((marker) => clone(marker));
  }
  snapshot.cardState.pendingEffectByPlayer.black = {
    type: config.pendingType,
    stage: 'selectTarget',
    cardId: config.cardId,
    ...(config.pendingExtra || {})
  };
  return {
    name: config.pendingType,
    expectedStatusApplied: config.expectedStatusApplied || null,
    expectedDestroy: config.expectedDestroy || null,
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: `fixture_${String(config.pendingType).toLowerCase()}_place`,
      __skipTurnStart: false,
      [config.actionKey]: config.target
    })
  };
}

function buildHandOverlaySelectionFixture(config) {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  snapshot.cardState.hands.black = Array.isArray(config.blackHand) ? config.blackHand.slice() : [];
  snapshot.cardState.hands.white = Array.isArray(config.whiteHand) ? config.whiteHand.slice() : [];
  snapshot.cardState.pendingEffectByPlayer.black = {
    type: config.pendingType,
    stage: 'selectTarget',
    cardId: config.cardId,
    ...(config.pendingExtra || {})
  };
  return {
    name: config.pendingType,
    expectedHandAdd: config.expectedHandAdd || null,
    expectedHandRemove: config.expectedHandRemove || null,
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: `fixture_${String(config.pendingType).toLowerCase()}_place`,
      __skipTurnStart: false,
      ...config.actionPayload
    })
  };
}

function buildBoardPendingStatusFixture(config) {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  setStone(snapshot, 3, 4, 'black');
  if (Array.isArray(config.extraBoard)) {
    for (const cell of config.extraBoard) {
      snapshot.gameState.board[cell.row][cell.col] = cell.value;
    }
  }
  if (Array.isArray(config.markers)) {
    snapshot.cardState.markers = config.markers.map((marker) => clone(marker));
  }
  snapshot.cardState.pendingEffectByPlayer.black = {
    type: config.pendingType,
    stage: 'selectTarget',
    cardId: config.cardId,
    ...(config.pendingExtra || {})
  };
  return {
    name: config.pendingType,
    expectedStatusApplied: config.expectedStatusApplied || null,
    expectedStatusTick: config.expectedStatusTick || null,
    unexpectedStatusTickSpecial: config.unexpectedStatusTickSpecial || null,
    expectedHandAdd: config.expectedHandAdd || null,
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: `fixture_${String(config.pendingType).toLowerCase()}_place`,
      __skipTurnStart: false,
      [config.actionKey]: config.target
    })
  };
}

function buildWorkIncomeFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  setStone(snapshot, 3, 4, 'black');
  addSpecialMarker(snapshot, 3, 4, 'black', 'WORK', {
    ownerColor: 'black',
    workStage: 2,
    remainingOwnerTurns: 3
  });
  snapshot.cardState.workAnchorPosByPlayer = {
    black: { row: 3, col: 4 },
    white: null
  };
  return {
    name: 'WORK_INCOME',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: 'fixture_work_income_place',
      __skipTurnStart: false
    })
  };
}

function buildObserverAnchorLostFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  addSpecialMarker(snapshot, 1, 1, 'black', 'LIGHTNING', {
    remainingOwnerTurns: 3
  });
  return {
    name: 'LIGHTNING_ANCHOR_LOST',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: 'fixture_observer_anchor_lost_place',
      __skipTurnStart: false
    })
  };
}

function buildTimeStopTriggeredFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  setStone(snapshot, 3, 4, 'black');
  addSpecialMarker(snapshot, 3, 4, 'black', 'TIME_STOP', {
    remainingOwnerTurns: 1
  });
  return {
    name: 'TIME_STOP_TRIGGERED',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: 'fixture_time_stop_triggered_place',
      __skipTurnStart: false
    })
  };
}

function buildTimeStopDeityTriggeredFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  setStone(snapshot, 3, 4, 'black');
  addSpecialMarker(snapshot, 3, 4, 'black', 'TIME_STOP_DEITY', {
    remainingOwnerTurns: 1
  });
  return {
    name: 'TIME_STOP_DEITY_TRIGGERED',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: 'fixture_time_stop_deity_triggered_place',
      __skipTurnStart: false
    })
  };
}

function buildFreezeDurationEndFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  setStone(snapshot, 3, 4, 'black');
  addSpecialMarker(snapshot, 3, 4, 'black', 'FREEZE', {
    remainingOwnerTurns: 1
  });
  return {
    name: 'FREEZE_DURATION_END',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: 'fixture_freeze_duration_end_place',
      __skipTurnStart: false
    })
  };
}

function buildBlockadeDurationEndFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  addSpecialMarker(snapshot, 1, 1, 'black', 'BLOCKADE', {
    remainingOwnerTurns: 1
  });
  return {
    name: 'BLOCKADE_DURATION_END',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: 'fixture_blockade_duration_end_place',
      __skipTurnStart: false
    })
  };
}

function buildSeedDurationEndFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  addSpecialMarker(snapshot, 1, 1, 'black', 'SEED', {
    remainingOwnerTurns: 1
  });
  return {
    name: 'SEED_DURATION_END',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: 'fixture_seed_duration_end_place',
      __skipTurnStart: false
    })
  };
}

function buildStoneSalvationGodDurationEndFixture() {
  const snapshot = createBaseSnapshot({ currentPlayer: 'black', turnIndex: 2 });
  addSalvationGod(snapshot, 7, 0, 'black');
  const marker = snapshot.cardState.markers.find((item) => item && item.data && item.data.type === 'STONE_SALVATION_GOD');
  marker.data.remainingOwnerTurns = 1;
  return {
    name: 'STONE_SALVATION_GOD_DURATION_END',
    snapshot,
    action: buildCommandAction(2, {
      playerKey: 'black',
      row: 2,
      col: 3,
      actionId: 'fixture_stone_salvation_god_duration_end_place',
      __skipTurnStart: false
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
    buildBreedingTurnStartSpawnFixture(),
    buildEscapeTurnStartMoveFixture(),
    buildEscapeTurnStartExplosionFixture(),
    buildSimplePendingSelectionFixture({
      cardId: 'destroy_01',
      pendingType: 'DESTROY_ONE_STONE',
      actionKey: 'destroyTarget',
      target: { row: 3, col: 4 },
      stones: [{ row: 3, col: 4, owner: 'black' }],
      expectedDestroy: { row: 3, col: 4, cause: 'DESTROY_ONE_STONE' }
    }),
    buildSimplePendingSelectionFixture({
      cardId: 'tempt_01',
      pendingType: 'TEMPT_WILL',
      actionKey: 'temptTarget',
      target: { row: 2, col: 2 },
      stones: [{ row: 2, col: 2, owner: 'white' }],
      markers: [{
        id: 52,
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'white',
        data: { type: 'FREEZE', sourceType: 'FREEZE_WILL', sourceCardId: 'freeze_01', remainingOwnerTurns: 2 }
      }]
    }),
    buildSimplePendingSelectionFixture({
      cardId: 'swap_01',
      pendingType: 'SWAP_WITH_ENEMY',
      actionKey: 'swapTarget',
      target: { row: 3, col: 3 }
    }),
    buildSimplePendingSelectionFixture({
      cardId: 'trap_01',
      pendingType: 'TRAP_WILL',
      actionKey: 'trapTarget',
      target: { row: 3, col: 4 },
      stones: [{ row: 3, col: 4, owner: 'black' }]
    }),
    buildSimplePendingSelectionFixture({
      cardId: 'reverse_will_01',
      pendingType: 'REVERSE_WILL',
      actionKey: 'reverseWillTarget',
      target: { row: 2, col: 2 },
      stones: [
        { row: 2, col: 2, owner: 'black' },
        { row: 2, col: 3, owner: 'white' },
        { row: 2, col: 4, owner: 'black' }
      ]
    }),
    buildSimplePendingSelectionFixture({
      cardId: 'causal_replay_01',
      pendingType: 'CAUSAL_REPLAY_WILL',
      actionKey: 'causalReplayTarget',
      target: { row: 2, col: 2 },
      markers: [{
        id: 72,
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'black',
        data: { type: 'METEOR_HOLE', sourceType: 'METEOR_WILL', sourceCardId: 'meteor_01' }
      }]
    }),
    buildSimplePendingSelectionFixture({
      cardId: 'reincarnation_will_01',
      pendingType: 'REINCARNATION_WILL',
      actionKey: 'reincarnationTarget',
      target: { row: 3, col: 4 },
      stones: [{ row: 3, col: 4, owner: 'black' }],
      markers: [{
        id: 73,
        kind: 'specialStone',
        row: 3,
        col: 4,
        owner: 'black',
        data: { type: 'GHOST', remainingOwnerTurns: 2 }
      }]
    }),
    buildHandOverlaySelectionFixture({
      cardId: 'heaven_01',
      pendingType: 'HEAVEN_BLESSING',
      pendingExtra: { offers: ['meteor_01', 'gold_stone'] },
      blackHand: [],
      actionPayload: { heavenBlessingCardId: 'gold_stone' }
    }),
    buildHandOverlaySelectionFixture({
      cardId: 'condemn_01',
      pendingType: 'CONDEMN_WILL',
      pendingExtra: { offers: [{ handIndex: 0, cardId: 'meteor_01' }, { handIndex: 1, cardId: 'guard_01' }] },
      whiteHand: ['meteor_01', 'guard_01'],
      actionPayload: { condemnTargetIndex: 1 },
      expectedHandRemove: { player: 'white', cardId: 'guard_01', reason: 'condemn_will' }
    }),
    buildHandOverlaySelectionFixture({
      cardId: 'observer_will_01',
      pendingType: 'OBSERVER_WILL',
      pendingExtra: { offers: [{ handIndex: 0, cardId: 'hard_01' }, { handIndex: 1, cardId: 'silver_stone' }] },
      whiteHand: ['hard_01', 'silver_stone'],
      actionPayload: { observerWillTargetIndex: 0 },
      expectedHandRemove: { player: 'white', cardId: 'hard_01', reason: 'observer_will' }
    }),
    buildMeteorFixture(),
    buildMeteorOpponentSalvationFixture(),
    buildBoardExpansionFixture('BOARD_EXPANSION_WILL'),
    buildBoardExpansionFixture('BOARD_EXPANSION_GOD'),
    buildBoardShrinkFixture(),
    buildBoardShrinkGodFixture(),
    buildPositionSwapFixture(),
    buildTeleportFixture('TELEPORT_WILL'),
    buildTeleportFixture('CELL_TELEPORT_WILL'),
    buildMovementSelectionFixture({
      cardId: 'strong_wind_01',
      pendingType: 'STRONG_WIND_WILL',
      actionKey: 'strongWindTarget',
      source: { row: 3, col: 3 }
    }),
    buildMovementSelectionFixture({
      cardId: 'buoyancy_01',
      pendingType: 'BUOYANCY_WILL',
      actionKey: 'buoyancyTarget',
      source: { row: 5, col: 2 }
    }),
    buildSuperBuoyancyFixture(),
    buildMovementSelectionFixture({
      cardId: 'gravity_01',
      pendingType: 'GRAVITY_WILL',
      actionKey: 'gravityTarget',
      source: { row: 2, col: 5 }
    }),
    buildMovementSelectionFixture({
      cardId: 'super_gravity_01',
      pendingType: 'SUPER_GRAVITY_WILL',
      actionKey: 'superGravityTarget',
      source: { row: 1, col: 4 }
    }),
    buildMovementSelectionFixture({
      cardId: 'super_attraction_01',
      pendingType: 'SUPER_ATTRACTION_WILL',
      actionKey: 'superAttractionTarget',
      source: { row: 2, col: 2 },
      actionTarget: { row: 5, col: 5 },
      blocker: { row: 4, col: 4 },
      pendingExtra: { firstTarget: { row: 2, col: 2 } }
    }),
    buildCloneWillFixture(),
    buildGuardWillFixture(),
    buildBoardPendingStatusFixture({
      cardId: 'guardian_god_01',
      pendingType: 'GUARDIAN_GOD',
      actionKey: 'guardTarget',
      target: { row: 3, col: 4 }
    }),
    buildStatusCellSelectionFixture({
      cardId: 'freeze_01',
      pendingType: 'FREEZE_WILL',
      actionKey: 'freezeTarget',
      special: 'FREEZE'
    }),
    buildStatusCellSelectionFixture({
      cardId: 'blockade_01',
      pendingType: 'BLOCKADE_WILL',
      actionKey: 'blockadeTarget',
      special: 'BLOCKADE'
    }),
    buildStatusCellSelectionFixture({
      cardId: 'poison_will_01',
      pendingType: 'POISON_WILL',
      actionKey: 'poisonTarget',
      special: 'POISON_CELL'
    }),
    buildStatusCellSelectionFixture({
      cardId: 'seed_01',
      pendingType: 'SEED_WILL',
      actionKey: 'seedTarget',
      special: 'SEED'
    }),
    buildBoardPendingStatusFixture({
      cardId: 'bomb_01',
      pendingType: 'TIME_BOMB',
      actionKey: 'bombTarget',
      target: { row: 3, col: 4 },
      expectedStatusApplied: { row: 3, col: 4, special: 'TIME_BOMB' }
    }),
    buildBoardPendingStatusFixture({
      cardId: 'living_will_01',
      pendingType: 'LIVING_WILL',
      actionKey: 'livingWillTarget',
      target: { row: 3, col: 4 },
      expectedStatusApplied: { row: 3, col: 4, special: 'LIVING_WILL' }
    }),
    buildBoardPendingStatusFixture({
      cardId: 'extend_life_01',
      pendingType: 'EXTEND_LIFE_WILL',
      actionKey: 'extendTarget',
      target: { row: 2, col: 2 },
      extraBoard: [{ row: 2, col: 2, value: 1 }],
      markers: [
        {
          id: 22,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'black',
          data: { type: 'LIGHTNING', remainingOwnerTurns: 2 }
        },
        {
          id: 23,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'black',
          data: { type: 'GUARD', remainingOwnerTurns: 3 }
        }
      ],
      expectedStatusTick: {
        row: 2,
        col: 2,
        special: 'LIGHTNING',
        reason: 'extend_life_applied',
        highlightTone: 'positive'
      },
      unexpectedStatusTickSpecial: 'GUARD'
    }),
    buildBoardPendingStatusFixture({
      cardId: 'corrosion_01',
      pendingType: 'CORROSION_WILL',
      actionKey: 'corrosionTarget',
      target: { row: 2, col: 2 },
      markers: [{
        id: 32,
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'white',
        data: { type: 'WORK', remainingOwnerTurns: 2 }
      }],
      expectedStatusTick: {
        row: 2,
        col: 2,
        special: 'WORK',
        reason: 'corrosion_applied',
        highlightTone: 'negative'
      }
    }),
    buildBoardPendingStatusFixture({
      cardId: 'extend_life_god_01',
      pendingType: 'EXTEND_LIFE_GOD',
      actionKey: 'extendTarget',
      target: { row: 2, col: 2 },
      extraBoard: [{ row: 2, col: 2, value: 1 }],
      markers: [
        {
          id: 62,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'black',
          data: { type: 'LIGHTNING', remainingOwnerTurns: 2 }
        },
        {
          id: 63,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'black',
          data: { type: 'GUARD', remainingOwnerTurns: 2 }
        }
      ],
      expectedStatusTick: {
        row: 2,
        col: 2,
        special: 'LIGHTNING',
        reason: 'extend_life_applied',
        highlightTone: 'positive'
      },
      unexpectedStatusTickSpecial: 'GUARD'
    }),
    buildBoardPendingStatusFixture({
      cardId: 'capture_01',
      pendingType: 'CAPTURE_WILL',
      actionKey: 'captureTarget',
      target: { row: 2, col: 2 },
      extraBoard: [{ row: 2, col: 2, value: -1 }],
      markers: [{
        id: 42,
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'white',
        data: {
          type: 'DRAGON',
          sourceType: 'ULTIMATE_REVERSE_DRAGON',
          sourceCardId: 'ultimate_reverse_dragon_01',
          remainingOwnerTurns: 4
        }
      }],
      expectedHandAdd: { player: 'black', cardId: 'ultimate_reverse_dragon_01', reason: 'capture_will' }
    }),
    buildWorkIncomeFixture(),
    buildObserverAnchorLostFixture(),
    buildTimeStopTriggeredFixture(),
    buildFreezeDurationEndFixture(),
    buildBlockadeDurationEndFixture(),
    buildSeedDurationEndFixture(),
    buildStoneSalvationGodDurationEndFixture()
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
    special: event.special || meta.special || null,
    remainingOwnerTurns: Number.isFinite(Number(event.remainingOwnerTurns))
      ? Number(event.remainingOwnerTurns)
      : (Number.isFinite(Number(meta.remainingOwnerTurns)) ? Number(meta.remainingOwnerTurns) : null),
    sourceType: event.sourceType || meta.sourceType || null,
    sourceCardId: event.sourceCardId || meta.sourceCardId || null,
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
    special: target.special || meta.special || null,
    before: normalizePlaybackVisualStateForParity(target.before),
    after: normalizePlaybackVisualStateForParity(target.after)
  };
}

function normalizePlaybackVisualStateForParity(state) {
  if (!state || typeof state !== 'object') return null;
  return {
    color: Number.isFinite(Number(state.color)) ? Number(state.color) : null,
    owner: state.owner || null,
    special: state.special || null,
    timer: Number.isFinite(Number(state.timer)) ? Number(state.timer) : null,
    flipEvadeRemaining: Number.isFinite(Number(state.flipEvadeRemaining)) ? Number(state.flipEvadeRemaining) : null,
    destroyEvadeRemaining: Number.isFinite(Number(state.destroyEvadeRemaining)) ? Number(state.destroyEvadeRemaining) : null,
    livingWillAura: state.livingWillAura === true
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

function expectNoTransientPresentationQueues(label, payload) {
  const snapshot = payload && payload.snapshot ? payload.snapshot : payload;
  const cardState = snapshot && snapshot.cardState ? snapshot.cardState : {};
  expect({ label, queue: cardState.presentationEvents || [] }).toEqual({ label, queue: [] });
  expect({ label, queue: cardState._presentationEventsPersist || [] }).toEqual({ label, queue: [] });
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
        ...(fixture.action.heavenBlessingCardId ? { heavenBlessingCardId: fixture.action.heavenBlessingCardId } : {}),
        ...(fixture.action.condemnTargetIndex != null ? { condemnTargetIndex: fixture.action.condemnTargetIndex } : {}),
        ...(fixture.action.observerWillTargetIndex != null ? { observerWillTargetIndex: fixture.action.observerWillTargetIndex } : {}),
        ...(fixture.action.expansionTarget ? { expansionTarget: fixture.action.expansionTarget } : {}),
        ...(fixture.action.meteorTarget ? { meteorTarget: fixture.action.meteorTarget } : {}),
        ...(fixture.action.causalReplayTarget ? { causalReplayTarget: fixture.action.causalReplayTarget } : {}),
        ...(fixture.action.shrinkTarget ? { shrinkTarget: fixture.action.shrinkTarget } : {}),
        ...(fixture.action.positionSwapTarget ? { positionSwapTarget: fixture.action.positionSwapTarget } : {}),
        ...(fixture.action.teleportTarget ? { teleportTarget: fixture.action.teleportTarget } : {}),
        ...(fixture.action.destroyTarget ? { destroyTarget: fixture.action.destroyTarget } : {}),
        ...(fixture.action.reverseWillTarget ? { reverseWillTarget: fixture.action.reverseWillTarget } : {}),
        ...(fixture.action.temptTarget ? { temptTarget: fixture.action.temptTarget } : {}),
        ...(fixture.action.swapTarget ? { swapTarget: fixture.action.swapTarget } : {}),
        ...(fixture.action.trapTarget ? { trapTarget: fixture.action.trapTarget } : {}),
        ...(fixture.action.strongWindTarget ? { strongWindTarget: fixture.action.strongWindTarget } : {}),
        ...(fixture.action.buoyancyTarget ? { buoyancyTarget: fixture.action.buoyancyTarget } : {}),
        ...(fixture.action.superBuoyancyTarget ? { superBuoyancyTarget: fixture.action.superBuoyancyTarget } : {}),
        ...(fixture.action.gravityTarget ? { gravityTarget: fixture.action.gravityTarget } : {}),
        ...(fixture.action.superGravityTarget ? { superGravityTarget: fixture.action.superGravityTarget } : {}),
        ...(fixture.action.superAttractionTarget ? { superAttractionTarget: fixture.action.superAttractionTarget } : {}),
        ...(fixture.action.cloneTarget ? { cloneTarget: fixture.action.cloneTarget } : {}),
        ...(fixture.action.guardTarget ? { guardTarget: fixture.action.guardTarget } : {}),
        ...(fixture.action.freezeTarget ? { freezeTarget: fixture.action.freezeTarget } : {}),
        ...(fixture.action.blockadeTarget ? { blockadeTarget: fixture.action.blockadeTarget } : {}),
        ...(fixture.action.poisonTarget ? { poisonTarget: fixture.action.poisonTarget } : {}),
        ...(fixture.action.seedTarget ? { seedTarget: fixture.action.seedTarget } : {}),
        ...(fixture.action.bombTarget ? { bombTarget: fixture.action.bombTarget } : {}),
        ...(fixture.action.livingWillTarget ? { livingWillTarget: fixture.action.livingWillTarget } : {}),
        ...(fixture.action.reincarnationTarget ? { reincarnationTarget: fixture.action.reincarnationTarget } : {}),
        ...(fixture.action.extendTarget ? { extendTarget: fixture.action.extendTarget } : {}),
        ...(fixture.action.corrosionTarget ? { corrosionTarget: fixture.action.corrosionTarget } : {}),
        ...(fixture.action.captureTarget ? { captureTarget: fixture.action.captureTarget } : {})
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
      streamPlaybackEvents: publishedSnapshot.playbackEvents || [],
      responsePayload: publishResponse.data,
      streamPayload: publishedSnapshot
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
  let canonicalSnapshot = null;
  expect(patchRoomSnapshotForTests(roomId, (serverRoom) => {
    canonicalSnapshot = clone(serverRoom.snapshot);
  })).toBe(true);
  return {
    server,
    port,
    roomId,
    blackToken,
    whiteToken,
    stateResponse,
    canonicalSnapshot
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

  test('assemblePlaybackEvents reports mismatch warnings when final playback loses raw board visuals', () => {
    const result = helpers.assemblePlaybackEvents({
      rawEvents: [
        { type: 'DESTROY', row: 3, col: 4, owner: 'white', turnIndex: 1 }
      ],
      presentationEvents: [],
      snapshot: {
        cardState: { turnIndex: 1 },
        gameState: { board: Array.from({ length: 8 }, () => Array(8).fill(0)) }
      },
      fallbackPlayerKey: 'black',
      adapter: {
        mapToPlaybackEvents: jest.fn(() => []),
        normalizePlaybackEvents: jest.fn((events) => events)
      },
      normalizePlayerKey
    });

    expect(result.diagnostics.rawBoardVisualCount).toBe(1);
    expect(result.diagnostics.boardVisualPlaybackCount).toBe(0);
    expect(result.diagnostics.warnings).toEqual([
      expect.stringContaining('raw board visual count')
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
      {
        type: 'flip',
        phase: 2,
        targets: [{ r: 3, col: 4, ownerBefore: 'white', ownerAfter: 'black', owner: 'black', player: 'black' }]
      }
    ]);
    expect(result.diagnostics.warnings).toEqual([]);
  });

  test('mapServerPresentationToPlaybackEvents uses the same assembly contract', () => {
    const result = helpers.mapServerPresentationToPlaybackEvents({
      rawEvents: [
        { type: 'place', row: 2, col: 3, player: 'black', actionId: 'place-map', turnIndex: 4 }
      ],
      presentationEvents: [{
        type: 'PLAYBACK_EVENTS',
        events: [
          { type: 'flip', phase: 2, targets: [{ r: 2, col: 4, ownerAfter: 'black' }] }
        ]
      }],
      snapshot: {
        cardState: { turnIndex: 4 },
        gameState: { board: createBoard(8, 8), currentPlayer: 1 }
      },
      fallbackPlayerKey: 'black',
      adapter,
      normalizePlayerKey
    });

    expect(result.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'place_hand_animation', actionId: 'place-map' }),
      expect.objectContaining({ type: 'flip' })
    ]));
    expect(result.diagnostics.warnings).toEqual([]);
  });

  test('collectServerPlaybackEvents consumes transient queues through the shared assembly path', () => {
    const snapshot = {
      cardState: {
        turnIndex: 12,
        presentationEvents: [{
          type: 'PLAYBACK_EVENTS',
          events: [
            { type: 'destroy', phase: 2, targets: [{ r: 3, col: 4, ownerBefore: 'white' }] }
          ]
        }],
        _presentationEventsPersist: [{ type: 'STALE_EVENT' }],
        _currentActionMeta: { actionId: 'action-1' }
      },
      gameState: {
        board: createBoard(8, 8),
        currentPlayer: 1
      }
    };

    const result = helpers.collectServerPlaybackEvents({
      rawEvents: [
        { type: 'place', row: 2, col: 3, player: 'black', actionId: 'place-12', turnIndex: 12 }
      ],
      snapshot,
      playerKey: 'black',
      fallbackPlayerKey: 'black',
      adapter,
      normalizePlayerKey
    });

    expect(result.presentationEvents).toHaveLength(1);
    expect(result.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'place_hand_animation', actionId: 'place-12' }),
      expect.objectContaining({ type: 'destroy' })
    ]));
    expect(result.diagnostics.warnings).toEqual([]);
    expect(snapshot.cardState.presentationEvents).toEqual([]);
    expect(snapshot.cardState._presentationEventsPersist).toEqual([]);
    expect(snapshot.cardState._currentActionMeta).toBeUndefined();
  });

  test('assemblePlaybackEvents reconstructs sniper destroy playback when transient destroy presentation is missing', () => {
    const result = helpers.assemblePlaybackEvents({
      rawEvents: [
        { type: 'place', row: 2, col: 2, player: 'black', actionId: 'place-sniper-1', turnIndex: 7 },
        {
          type: 'sniper_destroyed_immediate',
          details: [{
            row: 2,
            col: 3,
            sourceRow: 2,
            sourceCol: 2,
            ownerBefore: 'white',
            projectileOwner: 'black',
            projectileStone: 'SNIPER'
          }]
        }
      ],
      presentationEvents: [
        {
          type: 'SPAWN',
          row: 2,
          col: 2,
          stoneId: 's-sniper-1',
          ownerAfter: 'black',
          cause: 'SNIPER_WILL',
          reason: 'sniper_spawn',
          meta: {
            owner: 'black',
            special: 'SNIPER',
            timer: 5
          }
        }
      ],
      snapshot: {
        cardState: { turnIndex: 7 },
        gameState: { board: createBoard(8, 8), currentPlayer: -1 }
      },
      fallbackPlayerKey: 'black',
      adapter,
      normalizePlayerKey
    });

    expect(result.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'place_hand_animation', actionId: 'place-sniper-1' }),
      expect.objectContaining({ type: 'spawn' }),
      expect.objectContaining({
        type: 'destroy',
        targets: expect.arrayContaining([
          expect.objectContaining({
            r: 2,
            col: 3,
            cause: 'SNIPER_WILL',
            reason: 'sniper_shot',
            ownerBefore: 'white',
            before: expect.objectContaining({
              color: -1,
              owner: 'white'
            })
          })
        ])
      }),
      expect.objectContaining({
        type: 'sound_effect',
        meta: expect.objectContaining({
          sourceType: 'sniper_shot'
        }),
        targets: expect.arrayContaining([
          expect.objectContaining({
            soundKey: 'stone_destroy'
          })
        ])
      })
    ]));
    expect(result.diagnostics.warnings).toEqual([]);
  });

  test('assemblePlaybackEvents preserves card-specific move reasons when raw selection fallback is needed', () => {
    const snapshot = {
      cardState: { turnIndex: 9 },
      gameState: {
        board: createBoard(8, 8),
        currentPlayer: 1
      }
    };
    snapshot.gameState.board[3][0] = Core.WHITE;

    const result = helpers.assemblePlaybackEvents({
      rawEvents: [{
        type: 'super_attraction_selected',
        applied: true,
        completed: true,
        from: { row: 3, col: 3 },
        to: { row: 3, col: 0 },
        selectedPathVariant: 'single_segment',
        pathCells: [{ row: 3, col: 2 }, { row: 3, col: 1 }, { row: 3, col: 0 }]
      }],
      presentationEvents: [],
      snapshot,
      fallbackPlayerKey: 'black',
      adapter,
      normalizePlayerKey
    });

    expect(result.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'move',
        rawType: 'super_attraction_selected',
        targets: [expect.objectContaining({
          cause: 'SUPER_ATTRACTION_WILL',
          reason: 'super_attraction_move',
          meta: expect.objectContaining({ moveIntent: 'crush_move' }),
          before: expect.objectContaining({ color: -1, owner: 'white' }),
          after: expect.objectContaining({ color: -1, owner: 'white' })
        })]
      })
    ]));
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

      const snapshot = room.canonicalSnapshot;
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

      const snapshot = room.canonicalSnapshot;
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
      if (fixture.name === 'LIGHTNING_ANCHOR_LOST') {
        expect(expected.playbackEvents).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'observer_bubble',
            rawType: 'SPECIAL_STONE_BUBBLE',
            targets: expect.arrayContaining([
              expect.objectContaining({ r: 1, col: 1, owner: 'black', special: 'LIGHTNING' })
            ])
          })
        ]));
      }
      if (fixture.name === 'TIME_STOP_TRIGGERED') {
        expect(expected.playbackEvents).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'status_removed',
            rawType: 'STATUS_REMOVED',
            meta: expect.objectContaining({ special: 'TIME_STOP', reason: 'duration_end' })
          }),
          expect.objectContaining({
            type: 'observer_bubble',
            rawType: 'SPECIAL_STONE_BUBBLE',
            targets: expect.arrayContaining([
              expect.objectContaining({ r: 3, col: 4, owner: 'black', special: 'TIME_STOP' })
            ])
          })
        ]));
      }
      if (fixture.name === 'TIME_STOP_DEITY_TRIGGERED') {
        expect(expected.playbackEvents).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'status_removed',
            rawType: 'STATUS_REMOVED',
            meta: expect.objectContaining({ special: 'TIME_STOP_DEITY', reason: 'duration_end' })
          }),
          expect.objectContaining({
            type: 'observer_bubble',
            rawType: 'SPECIAL_STONE_BUBBLE',
            targets: expect.arrayContaining([
              expect.objectContaining({ r: 3, col: 4, owner: 'black', special: 'TIME_STOP_DEITY' })
            ])
          })
        ]));
      }
      if (fixture.name === 'FREEZE_DURATION_END') {
        expect(expected.playbackEvents).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'status_removed',
            rawType: 'STATUS_REMOVED',
            meta: expect.objectContaining({ special: 'FREEZE', reason: 'duration_end' })
          })
        ]));
      }
      if (fixture.name === 'BLOCKADE_DURATION_END') {
        expect(expected.playbackEvents).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'status_removed',
            rawType: 'STATUS_REMOVED',
            meta: expect.objectContaining({ special: 'BLOCKADE', reason: 'duration_end' })
          })
        ]));
      }
      if (fixture.name === 'SEED_DURATION_END') {
        expect(expected.playbackEvents).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'status_removed',
            rawType: 'STATUS_REMOVED',
            meta: expect.objectContaining({ special: 'SEED', reason: 'duration_end' })
          }),
          expect.objectContaining({
            type: 'spawn',
            rawType: 'SPAWN',
            targets: expect.arrayContaining([
              expect.objectContaining({
                r: 1,
                col: 1,
                ownerAfter: 'black',
                cause: 'SEED_WILL',
                reason: 'seed_sprout'
              })
            ])
          })
        ]));
      }
      if (fixture.name === 'STONE_SALVATION_GOD_DURATION_END') {
        expect(expected.playbackEvents).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'status_removed',
            rawType: 'STATUS_REMOVED',
            meta: expect.objectContaining({ special: 'STONE_SALVATION_GOD', reason: 'duration_end' })
          })
        ]));
      }
      if (fixture.name === 'POSITION_SWAP_WILL') {
        expect(expected.playbackEvents).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'move',
            targets: expect.arrayContaining([
              expect.objectContaining({
                from: { r: 3, col: 4 },
                to: { r: 3, col: 3 },
                cause: 'POSITION_SWAP_WILL'
              })
            ])
          })
        ]));
      }
      if (fixture.name === 'BREEDING_TURN_START_SPAWN') {
        const breedingSpawn = expected.playbackEvents.find((event) => (
          event &&
          event.type === 'spawn' &&
          Array.isArray(event.targets) &&
          event.targets.some((target) => target && target.cause === 'BREEDING' && String(target.reason || '').indexOf('breeding_spawn') === 0)
        ));
        const spawnTarget = breedingSpawn && breedingSpawn.targets.find((target) => target && target.cause === 'BREEDING');
        expect({
          spawnTarget,
          sound: expected.playbackEvents.find((event) => (
            event &&
            event.type === 'sound_effect' &&
            Array.isArray(event.targets) &&
            event.targets.some((target) => target && target.soundKey === 'breeding_spawn')
          ))
        }).toEqual({
          spawnTarget: expect.objectContaining({
            before: expect.objectContaining({ color: 0, special: null }),
            after: expect.objectContaining({ color: 1, owner: 'black' })
          }),
          sound: expect.objectContaining({ type: 'sound_effect' })
        });
      }
      if (fixture.name === 'ESCAPE_HYPERACTIVE_TURN_START_MOVE') {
        const moveEvent = expected.playbackEvents.find((event) => (
          event &&
          event.type === 'move' &&
          Array.isArray(event.targets) &&
          event.targets.some((target) => target && target.cause === 'ESCAPE_HYPERACTIVE')
        ));
        const moveTarget = moveEvent && moveEvent.targets.find((target) => target && target.cause === 'ESCAPE_HYPERACTIVE');
        expect({
          moveTarget,
          sound: expected.playbackEvents.find((event) => (
            event &&
            event.type === 'sound_effect' &&
            Array.isArray(event.targets) &&
            event.targets.some((target) => target && target.soundKey === 'hyperactive_move')
          ))
        }).toEqual({
          moveTarget: expect.objectContaining({
            from: { r: 3, col: 3 },
            to: { r: 2, col: 2 },
            reason: 'escape_hyperactive_move',
            before: expect.objectContaining({
              color: 1,
              owner: 'black',
              special: 'ESCAPE_HYPERACTIVE',
              flipEvadeRemaining: 1
            }),
            after: expect.objectContaining({
              color: 1,
              owner: 'black',
              special: 'ESCAPE_HYPERACTIVE',
              flipEvadeRemaining: 1
            })
          }),
          sound: expect.objectContaining({ type: 'sound_effect' })
        });
      }
      if (fixture.name === 'ESCAPE_HYPERACTIVE_TURN_START_EXPLOSION') {
        const escapeDestroys = expected.playbackEvents
          .filter((event) => event && event.type === 'destroy')
          .flatMap((event) => Array.isArray(event.targets)
            ? event.targets.map((target) => ({ event, target }))
            : [])
          .filter(({ target }) => target && target.cause === 'ESCAPE_HYPERACTIVE' && target.reason === 'escape_no_candidates_explosion');
        expect(escapeDestroys).toHaveLength(9);
        expect(new Set(escapeDestroys.map(({ event }) => event.phase)).size).toBe(1);
        expect(escapeDestroys).toEqual(expect.arrayContaining([
          expect.objectContaining({
            target: expect.objectContaining({
              r: 3,
              col: 3,
              before: expect.objectContaining({
                color: 1,
                owner: 'black',
                special: 'ESCAPE_HYPERACTIVE'
              }),
              after: expect.objectContaining({ color: 0, special: null })
            })
          })
        ]));
        expect(expected.playbackEvents).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'sound_effect',
            targets: expect.arrayContaining([
              expect.objectContaining({ soundKey: 'bomb_explode' })
            ])
          })
        ]));
        expect(expected.playbackEvents).toEqual(expect.not.arrayContaining([
          expect.objectContaining({
            type: 'sound_effect',
            targets: expect.arrayContaining([
              expect.objectContaining({ soundKey: 'stone_destroy' })
            ])
          })
        ]));
      }
      if (fixture.expectedDestroy) {
        expect(expected.playbackEvents).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'destroy',
            targets: expect.arrayContaining([
              expect.objectContaining({
                r: fixture.expectedDestroy.row,
                col: fixture.expectedDestroy.col,
                cause: fixture.expectedDestroy.cause
              })
            ])
          })
        ]));
      }
      if (fixture.name === 'TELEPORT_WILL' || fixture.name === 'CELL_TELEPORT_WILL') {
        expect(expected.playbackEvents).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'move',
            targets: expect.arrayContaining([
              expect.objectContaining({
                from: { r: 3, col: 4 },
                cause: fixture.name,
                reason: 'teleport_move'
              })
            ])
          })
        ]));
      }
      if (fixture.name === 'CELL_TELEPORT_WILL') {
        expect(expected.playbackEvents).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'status_applied',
            rawType: 'STATUS_APPLIED',
            targets: expect.arrayContaining([
              expect.objectContaining({ r: 3, col: 4 })
            ]),
            meta: expect.objectContaining({
              special: 'METEOR_HOLE',
              cellRemovalCause: 'CELL_TELEPORT_WILL',
              cellRemovalReason: 'cell_teleport_source_cell_remove'
            })
          })
        ]));
      }
      if ([
        'STRONG_WIND_WILL',
        'BUOYANCY_WILL',
        'SUPER_BUOYANCY_WILL',
        'GRAVITY_WILL',
        'SUPER_GRAVITY_WILL',
        'SUPER_ATTRACTION_WILL'
      ].includes(fixture.name)) {
        expect(expected.playbackEvents).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'move',
            targets: expect.arrayContaining([
              expect.objectContaining({
                cause: fixture.name,
                from: expect.objectContaining({
                  r: fixture.expectedMoveFrom.row,
                  col: fixture.expectedMoveFrom.col
                })
              })
            ])
          })
        ]));
        const moveEvent = expected.playbackEvents.find((event) => (
          event &&
          event.type === 'move' &&
          Array.isArray(event.targets) &&
          event.targets.some((target) => target && target.cause === fixture.name)
        ));
        const moveTarget = moveEvent && moveEvent.targets.find((target) => target && target.cause === fixture.name);
        expect({
          name: fixture.name,
          before: moveTarget && moveTarget.before,
          after: moveTarget && moveTarget.after
        }).toEqual({
          name: fixture.name,
          before: expect.objectContaining({
            color: expect.any(Number),
            owner: expect.any(String)
          }),
          after: expect.objectContaining({
            color: expect.any(Number),
            owner: expect.any(String)
          })
        });
        expect([1, -1]).toContain(moveTarget.before.color);
        expect([1, -1]).toContain(moveTarget.after.color);
      }
      if (fixture.expectedStatusApplied) {
        expect(expected.playbackEvents).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'status_applied',
            rawType: 'STATUS_APPLIED',
            targets: expect.arrayContaining([
              expect.objectContaining({
                r: fixture.expectedStatusApplied.row,
                col: fixture.expectedStatusApplied.col
              })
            ]),
            meta: expect.objectContaining({
              special: fixture.expectedStatusApplied.special
            })
          })
        ]));
      }
      if (fixture.expectedStatusTick) {
        expect(expected.playbackEvents).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'status_applied',
            rawType: 'STATUS_TICK',
            targets: expect.arrayContaining([
              expect.objectContaining({
                r: fixture.expectedStatusTick.row,
                col: fixture.expectedStatusTick.col
              })
            ]),
            meta: expect.objectContaining({
              special: fixture.expectedStatusTick.special,
              reason: fixture.expectedStatusTick.reason,
              highlightTone: fixture.expectedStatusTick.highlightTone
            })
          })
        ]));
      }
      if (fixture.unexpectedStatusTickSpecial) {
        expect(expected.playbackEvents).not.toEqual(expect.arrayContaining([
          expect.objectContaining({
            rawType: 'STATUS_TICK',
            meta: expect.objectContaining({
              special: fixture.unexpectedStatusTickSpecial,
              reason: 'extend_life_applied'
            })
          })
        ]));
      }
      if (fixture.expectedHandAdd) {
        expect(expected.playbackEvents).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'capture_to_hand_animation',
            rawType: 'HAND_ADD',
            targets: expect.arrayContaining([
              expect.objectContaining({
                player: fixture.expectedHandAdd.player,
                cardId: fixture.expectedHandAdd.cardId,
                reason: fixture.expectedHandAdd.reason
              })
            ])
          })
        ]));
      }
      if (fixture.expectedHandRemove) {
        expect(expected.playbackEvents).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'hand_remove',
            rawType: 'HAND_REMOVE',
            targets: expect.arrayContaining([
              expect.objectContaining({
                player: fixture.expectedHandRemove.player,
                cardId: fixture.expectedHandRemove.cardId,
                reason: fixture.expectedHandRemove.reason
              })
            ])
          })
        ]));
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
      expectNoTransientPresentationQueues(`${fixture.name}:worker-response`, workerResult.payload);
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
      expectNoTransientPresentationQueues(`${fixture.name}:local-response`, localResult.responsePayload);
      expectNoTransientPresentationQueues(`${fixture.name}:local-stream`, localResult.streamPayload);
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

  test('deferred pending selection registry entries stay covered by playback parity fixtures', () => {
    const registry = PendingSelectionRegistry.PENDING_SELECTION_REGISTRY || {};
    const requiredTypes = Object.keys(registry)
      .filter((type) => registry[type] && registry[type].deferNetworkPublish === true && registry[type].needsTargetSelection === true)
      .sort();
    const coveredTypes = Array.from(new Set(
      buildPlaybackParityFixtures()
        .map((fixture) => fixture && fixture.name)
        .filter(Boolean)
    )).sort();

    expect(coveredTypes).toEqual(expect.arrayContaining(requiredTypes));
  });

  test('card effect playback parity fixtures only emit animation-engine supported event types', () => {
    const supportedTypes = new Set(Object.values(AnimationConstants.EVENT_TYPES || {}));
    const unsupported = [];
    for (const fixture of buildPlaybackParityFixtures()) {
      const expected = buildExpectedAssembly(fixture.snapshot, fixture.action, fixture.name);
      for (const event of expected.playbackEvents || []) {
        if (!event || supportedTypes.has(event.type)) continue;
        unsupported.push({ fixture: fixture.name, type: event.type, rawType: event.rawType || null });
      }
    }

    expect(unsupported).toEqual([]);
  });

  test('card effect playback parity fixtures are executable by the UI animation engine', async () => {
    const previousNoAnim = process.env.NOANIM;
    process.env.NOANIM = '1';
    let engine = null;
    const failures = [];

    try {
      for (const fixture of buildPlaybackParityFixtures()) {
        const expected = buildExpectedAssembly(fixture.snapshot, fixture.action, fixture.name);
        const dom = createPlaybackDomFromSnapshot(fixture.snapshot);
        installPlaybackDomGlobals(dom);
        try {
          if (!engine) engine = require('../ui/animation-engine.js');
          engine.boardEl = document.getElementById('board');
          await engine.play(expected.playbackEvents || []);
        } catch (error) {
          failures.push({
            fixture: fixture.name,
            message: error && error.message ? error.message : String(error)
          });
        } finally {
          clearPlaybackDomGlobals(dom);
        }
      }
    } finally {
      if (typeof previousNoAnim === 'undefined') delete process.env.NOANIM;
      else process.env.NOANIM = previousNoAnim;
    }

    expect(failures).toEqual([]);
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

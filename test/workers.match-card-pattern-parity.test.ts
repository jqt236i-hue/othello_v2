import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';
import * as Core from '../game/logic/core.js';
import * as MatchAuthority from '../utils/match-authority.js';
import * as LocalMatchRuntime from '../scripts/local-match-runtime';
import * as DebugActions from '../game/debug/debug-actions';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;
const WORKER_RESULT_MARKER = '__WORKER_CARD_PATTERN_PARITY__';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePublicSnapshotForParity(snapshot) {
  const shot = clone(snapshot);
  delete shot.updatedAt;
  delete shot.stateVersion;
  if (shot._meta) delete shot._meta.projectedSnapshotHash;
  return shot;
}

function normalizePlaybackSummary(events) {
  return (Array.isArray(events) ? events : []).map((event) => ({
    type: event && event.type ? event.type : null,
    phase: Number.isFinite(Number(event && event.phase)) ? Number(event.phase) : null,
    rawType: event && event.rawType ? event.rawType : null,
    targets: Array.isArray(event && event.targets)
      ? event.targets.map((target) => ({
        row: Number.isInteger(target.row) ? target.row : (Number.isInteger(target.r) ? target.r : null),
        col: Number.isInteger(target.col) ? target.col : null,
        player: target.player || null,
        owner: target.owner || null,
        ownerBefore: target.ownerBefore || null,
        ownerAfter: target.ownerAfter || null,
        special: target.special || (target.meta && target.meta.special) || null
      }))
      : []
  }));
}

function collectPlaybackEventsByType(events, type) {
  return (Array.isArray(events) ? events : []).filter((event) => event && event.type === type);
}

function pickFirstLegalMove(snapshot, seatKey = 'black') {
  const currentPlayer = seatKey === 'white' ? Core.WHITE : Core.BLACK;
  const legalMoves = Core.getLegalMoves(snapshot && snapshot.gameState, currentPlayer);
  if (!Array.isArray(legalMoves) || legalMoves.length <= 0) {
    throw new Error(`NO_LEGAL_MOVE_FOR_${seatKey.toUpperCase()}`);
  }
  return {
    row: Number(legalMoves[0].row),
    col: Number(legalMoves[0].col)
  };
}

const EXPECTED_PENDING_TYPE_BY_CARD_ID = Object.freeze({
  destroy_01: 'DESTROY_ONE_STONE',
  swap_01: 'SWAP_WITH_ENEMY',
  position_swap_01: 'POSITION_SWAP_WILL',
  capture_01: 'CAPTURE_WILL',
  living_will_01: 'LIVING_WILL',
  bomb_01: 'TIME_BOMB',
  strong_wind_01: 'STRONG_WIND_WILL',
  super_buoyancy_01: 'SUPER_BUOYANCY_WILL',
  buoyancy_01: 'BUOYANCY_WILL',
  super_gravity_01: 'SUPER_GRAVITY_WILL',
  gravity_01: 'GRAVITY_WILL',
  super_attraction_01: 'SUPER_ATTRACTION_WILL',
  clone_01: 'CLONE_WILL',
  teleport_01: 'TELEPORT_WILL',
  cell_teleport_01: 'CELL_TELEPORT_WILL',
  board_expand_01: 'BOARD_EXPANSION_WILL',
  board_expand_god_01: 'BOARD_EXPANSION_GOD',
  board_shrink_01: 'BOARD_SHRINK_WILL',
  meteor_01: 'METEOR_WILL',
  board_shrink_god_01: 'BOARD_SHRINK_GOD'
});

function createCardUseRuntime(cardId, seed = 71) {
  const runtime = LocalMatchRuntime.createRuntime({ seed });
  const snapshot = runtime.getRoom().snapshot;
  snapshot.cardState.hands.black = [cardId];
  snapshot.cardState.hands.white = ['meteor_01', 'guard_01'];
  snapshot.cardState.deck.black = [];
  snapshot.cardState.deck.white = [];
  snapshot.cardState.discard = [];
  snapshot.cardState.charge.black = 99;
  snapshot.cardState.charge.white = 99;
  snapshot.cardState.debugNoDraw = true;
  snapshot.cardState.selectedCardId = cardId;
  snapshot.cardState.selectedCardOwnerKey = 'black';
  snapshot.gameState.currentPlayer = Core.BLACK;
  runtime.getRoom().stateVersion = 0;
  snapshot.stateVersion = 0;
  runtime.getRoom().authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(snapshot);
  return runtime;
}

function buildUseCardBody(runtime, cardId, operationId) {
  const snapshot = runtime.getSnapshot();
  const turnIndex = Number(snapshot.cardState && snapshot.cardState.turnIndex) || 0;
  return {
    seatKey: 'black',
    playerKey: 'black',
    baseVersion: runtime.getRoom().stateVersion,
    operationId,
    actionType: 'use_card',
    actor: 'black',
    params: {
      useCardId: cardId,
      useCardOwnerKey: 'black'
    },
    turnIndex,
    action: {
      type: 'use_card',
      playerKey: 'black',
      useCardId: cardId,
      useCardOwnerKey: 'black',
      turnIndex
    }
  };
}

function runWorkerPublish(initialSnapshot, stateVersion, body, seed = 71) {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    "  const snapshot = JSON.parse(process.argv[2]);",
    "  const stateVersion = Number(process.argv[3]);",
    "  const body = JSON.parse(process.argv[4]);",
    "  const seed = Number(process.argv[5]);",
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const room = {",
    "    roomId: 'WPAR', seed, stateVersion, updatedAt: Date.now(),",
    "    seats: { black: true, white: true }, seatTokens: { black: 'token_black', white: 'token_white' },",
    "    seatNames: { black: 'black', white: 'white' }, seatHandSkins: { black: '', white: '' },",
    "    roomDeck: null, roomBoardConfig: snapshot && snapshot.gameState ? snapshot.gameState.boardConfig || null : null, networkDebugEnabled: !!(snapshot && snapshot.cardState && snapshot.cardState.debugHandFilled),",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },",
    "    lastAcceptedOperationBySeat: { black: null, white: null }, acceptedOperationHistoryBySeat: { black: [], white: [] },",
    "    eventSeq: 0, sseEventBuffer: [], authorityLog: [], chatMessages: [], chatSeq: 0, snapshot",
    "  };",
    "  const storage = new Map(); storage.set('match_room_state_v1', room);",
    "  const durableObject = new MatchRoomDurableObject({ storage: { get: async (key) => storage.get(key), put: async (key, value) => storage.set(key, value), delete: async (key) => storage.delete(key), setAlarm: async () => {}, deleteAlarm: async () => {} } });",
    "  durableObject.broadcastSnapshot = async () => {};",
    "  const response = await durableObject.handlePublish(Object.assign({}, body, { roomId: 'WPAR', seatToken: body.seatKey === 'white' ? 'token_white' : 'token_black' }));",
    "  const payload = await response.json();",
    `  process.stdout.write('${WORKER_RESULT_MARKER}' + JSON.stringify({ status: response.status, payload }));`,
    "})().catch((error) => { console.error(error && error.stack ? error.stack : String(error)); process.exit(1); });"
  ].join('\n');

  const result = spawnSync(process.execPath, [
    '-e',
    runner,
    workerModulePath,
    JSON.stringify(initialSnapshot),
    String(stateVersion),
    JSON.stringify(body),
    String(seed)
  ], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'worker card pattern parity runner failed');
  }
  const output = String(result.stdout || '');
  const markerIndex = output.lastIndexOf(WORKER_RESULT_MARKER);
  if (markerIndex < 0) throw new Error(output || 'worker card pattern parity runner did not emit result marker');
  return JSON.parse(output.slice(markerIndex + WORKER_RESULT_MARKER.length));
}

function runWorkerPendingSelectionPlaceParityScenario(config) {
  const cardId = config.cardId;
  const seed = Number.isFinite(Number(config.seed)) ? Number(config.seed) : 71;
  const runtime = createCardUseRuntime(cardId, seed);
  if (typeof config.setupRuntime === 'function') {
    config.setupRuntime(runtime);
    runtime.getRoom().authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(runtime.getSnapshot());
  }
  const initialSnapshot = clone(runtime.getSnapshot());
  const initialVersion = runtime.getRoom().stateVersion;
  const useBody = buildUseCardBody(runtime, cardId, `op_worker_pattern_${cardId}_use`);
  const localUse = runtime.applyCommand(clone(useBody));
  expect(localUse.ok).toBe(true);

  const localSnapshotAfterUse = runtime.getSnapshot();
  const localPlaceTurnIndex = Number(localSnapshotAfterUse && localSnapshotAfterUse.cardState && localSnapshotAfterUse.cardState.turnIndex) || 0;
  const localMove = pickFirstLegalMove(localSnapshotAfterUse, 'black');
  const localTargets = (typeof config.selectTargets === 'function')
    ? config.selectTargets(localSnapshotAfterUse, localMove)
    : {};
  const localPlaceBody = {
    seatKey: 'black',
    playerKey: 'black',
    baseVersion: runtime.getRoom().stateVersion,
    operationId: `op_worker_pattern_${cardId}_place`,
    actionType: 'place',
    actor: 'black',
    params: {
      row: localMove.row,
      col: localMove.col,
      ...localTargets
    },
    turnIndex: localPlaceTurnIndex,
    action: {
      type: 'place',
      playerKey: 'black',
      row: localMove.row,
      col: localMove.col,
      turnIndex: localPlaceTurnIndex,
      ...localTargets
    }
  };
  const localPlace = runtime.applyCommand(clone(localPlaceBody));
  expect(localPlace.ok).toBe(true);

  const workerUse = runWorkerPublish(initialSnapshot, initialVersion, clone(useBody), seed);
  expect(workerUse.status).toBe(200);
  expect(workerUse.payload && workerUse.payload.ok).toBe(true);

  const workerSnapshotAfterUse = clone(workerUse.payload.snapshot);
  const workerPlaceTurnIndex = Number(workerSnapshotAfterUse && workerSnapshotAfterUse.cardState && workerSnapshotAfterUse.cardState.turnIndex) || 0;
  const workerMove = pickFirstLegalMove(workerSnapshotAfterUse, 'black');
  const workerTargets = (typeof config.selectTargets === 'function')
    ? config.selectTargets(workerSnapshotAfterUse, workerMove)
    : {};
  const workerPlaceBody = {
    seatKey: 'black',
    playerKey: 'black',
    baseVersion: Number(workerUse.payload.stateVersion),
    operationId: `op_worker_pattern_${cardId}_place`,
    actionType: 'place',
    actor: 'black',
    params: {
      row: workerMove.row,
      col: workerMove.col,
      ...workerTargets
    },
    turnIndex: workerPlaceTurnIndex,
    action: {
      type: 'place',
      playerKey: 'black',
      row: workerMove.row,
      col: workerMove.col,
      turnIndex: workerPlaceTurnIndex,
      ...workerTargets
    }
  };
  const workerPlace = runWorkerPublish(workerSnapshotAfterUse, Number(workerUse.payload.stateVersion), workerPlaceBody, seed);
  expect(workerPlace.status).toBe(200);
  expect(workerPlace.payload && workerPlace.payload.ok).toBe(true);

  const localPublic = MatchAuthority.buildPublicSnapshot(runtime.getRoom(), 'black');
  expect(normalizePublicSnapshotForParity(workerPlace.payload.snapshot))
    .toEqual(normalizePublicSnapshotForParity(localPublic));
  expect(normalizePlaybackSummary(workerPlace.payload.playbackEvents))
    .toEqual(normalizePlaybackSummary(localPlace.playbackEvents));
  expect(workerPlace.payload.effectLogs || []).toEqual(localPlace.effectLogs || []);

  return {
    localUse,
    localPlace,
    workerUse,
    workerPlace
  };
}

describe('worker card pattern parity', () => {
  test.each([
    ['pending selection destroy', 'destroy_01'],
    ['pending selection swap', 'swap_01'],
    ['pending selection position swap', 'position_swap_01'],
    ['pending selection capture', 'capture_01'],
    ['pending selection living will', 'living_will_01'],
    ['pending selection time bomb', 'bomb_01'],
    ['pending selection strong wind', 'strong_wind_01'],
    ['pending selection super buoyancy', 'super_buoyancy_01'],
    ['pending selection buoyancy', 'buoyancy_01'],
    ['pending selection super gravity', 'super_gravity_01'],
    ['pending selection gravity', 'gravity_01'],
    ['pending selection super attraction', 'super_attraction_01'],
    ['pending selection clone', 'clone_01'],
    ['pending selection teleport', 'teleport_01'],
    ['pending selection cell teleport', 'cell_teleport_01'],
    ['pending selection board expansion', 'board_expand_01'],
    ['pending selection board expansion god', 'board_expand_god_01'],
    ['pending selection board shrink', 'board_shrink_01'],
    ['cell removal meteor', 'meteor_01'],
    ['cell removal board shrink god', 'board_shrink_god_01'],
    ['turn-start/random gluttonous', 'gluttonous_will_01'],
    ['random destroy dragon', 'destroy_dragon_01'],
    ['random lightning', 'lightning_01'],
    ['hidden reveal hand', 'reveal_hand_01'],
    ['hidden condemn', 'condemn_01'],
    ['projection trap', 'trap_01']
  ])('%s card-use command matches headless authority result', (_label, cardId) => {
    const runtime = createCardUseRuntime(cardId);
    const initialSnapshot = clone(runtime.getSnapshot());
    const initialVersion = runtime.getRoom().stateVersion;
    const body = buildUseCardBody(runtime, cardId, `op_worker_pattern_${cardId}`);
    const localResult = runtime.applyCommand(body);
    const workerResult = runWorkerPublish(initialSnapshot, initialVersion, body);

    const workerOk = workerResult.status === 200 && workerResult.payload && workerResult.payload.ok === true;
    expect(workerOk).toBe(localResult.ok === true);
    if (!workerOk) {
      expect(workerResult.payload.rejectedReason).toBe(localResult.rejectedReason);
      return;
    }

    const localPublic = MatchAuthority.buildPublicSnapshot(runtime.getRoom(), 'black');
    expect(workerResult.payload.stateVersion).toBe(localResult.stateVersion);
    expect(normalizePublicSnapshotForParity(workerResult.payload.snapshot))
      .toEqual(normalizePublicSnapshotForParity(localPublic));
    if (EXPECTED_PENDING_TYPE_BY_CARD_ID[cardId]) {
      expect(workerResult.payload.snapshot.cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
        type: EXPECTED_PENDING_TYPE_BY_CARD_ID[cardId],
        stage: 'selectTarget'
      }));
    }
    expect(normalizePlaybackSummary(workerResult.payload.playbackEvents))
      .toEqual(normalizePlaybackSummary(localResult.playbackEvents));
    expect(workerResult.payload.effectLogs || []).toEqual(localResult.effectLogs || []);
  }, 90000);

  test('gluttonous card-use hand clear matches headless authority result', () => {
    const cardId = 'gluttonous_will_01';
    const runtime = createCardUseRuntime(cardId, 73);
    const runtimeSnapshot = runtime.getSnapshot();
    runtimeSnapshot.cardState.hands.black = [cardId, 'guard_01', 'meteor_01'];
    runtimeSnapshot.cardState._handCopyIdsByPlayer.black = [];
    runtimeSnapshot.cardState.selectedCardId = cardId;
    runtimeSnapshot.cardState.selectedCardOwnerKey = 'black';
    runtime.getRoom().authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(runtimeSnapshot);

    const initialSnapshot = clone(runtimeSnapshot);
    const initialVersion = runtime.getRoom().stateVersion;
    const body = buildUseCardBody(runtime, cardId, 'op_worker_pattern_gluttonous_hand_clear');
    const localResult = runtime.applyCommand(body);
    const workerResult = runWorkerPublish(initialSnapshot, initialVersion, body, 73);

    expect(workerResult.status).toBe(200);
    expect(workerResult.payload.ok).toBe(true);
    expect(localResult.ok).toBe(true);

    const localPublic = MatchAuthority.buildPublicSnapshot(runtime.getRoom(), 'black');
    expect(normalizePublicSnapshotForParity(workerResult.payload.snapshot))
      .toEqual(normalizePublicSnapshotForParity(localPublic));
    expect(normalizePlaybackSummary(workerResult.payload.playbackEvents))
      .toEqual(normalizePlaybackSummary(localResult.playbackEvents));

    const workerHandRemove = collectPlaybackEventsByType(workerResult.payload.playbackEvents, 'hand_remove');
    const localHandRemove = collectPlaybackEventsByType(localResult.playbackEvents, 'hand_remove');
    expect(workerHandRemove).toEqual(localHandRemove);
    expect(workerHandRemove).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'hand_remove',
        targets: expect.arrayContaining([
          expect.objectContaining({ player: 'black', count: 2 })
        ])
      })
    ]));
  }, 90000);

  test('supply card-use draw playback matches headless authority result', () => {
    const cardId = 'supply_01';
    const runtime = createCardUseRuntime(cardId, 79);
    const runtimeSnapshot = runtime.getSnapshot();
    runtimeSnapshot.cardState.hands.black = [cardId];
    runtimeSnapshot.cardState.deck.black = ['gold_stone', 'guard_01'];
    runtimeSnapshot.cardState.decks.black = ['gold_stone', 'guard_01'];
    runtimeSnapshot.cardState._handCopyIdsByPlayer.black = [];
    runtimeSnapshot.cardState._deckCopyIdsByPlayer.black = ['gold-copy', 'guard-copy'];
    runtimeSnapshot.cardState.selectedCardId = cardId;
    runtimeSnapshot.cardState.selectedCardOwnerKey = 'black';
    runtime.getRoom().authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(runtimeSnapshot);

    const initialSnapshot = clone(runtimeSnapshot);
    const initialVersion = runtime.getRoom().stateVersion;
    const body = buildUseCardBody(runtime, cardId, 'op_worker_pattern_supply_draw');
    const localResult = runtime.applyCommand(body);
    const workerResult = runWorkerPublish(initialSnapshot, initialVersion, body, 79);

    expect(workerResult.status).toBe(200);
    expect(workerResult.payload.ok).toBe(true);
    expect(localResult.ok).toBe(true);

    const localPublic = MatchAuthority.buildPublicSnapshot(runtime.getRoom(), 'black');
    expect(normalizePublicSnapshotForParity(workerResult.payload.snapshot))
      .toEqual(normalizePublicSnapshotForParity(localPublic));
    expect(normalizePlaybackSummary(workerResult.payload.playbackEvents))
      .toEqual(normalizePlaybackSummary(localResult.playbackEvents));

    const workerHandAdd = collectPlaybackEventsByType(workerResult.payload.playbackEvents, 'hand_add');
    const localHandAdd = collectPlaybackEventsByType(localResult.playbackEvents, 'hand_add');
    expect(workerHandAdd).toEqual(localHandAdd);
    expect(workerHandAdd).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'hand_add',
        targets: expect.arrayContaining([
          expect.objectContaining({ player: 'black', cardId: 'gold_stone' })
        ])
      }),
      expect.objectContaining({
        type: 'hand_add',
        targets: expect.arrayContaining([
          expect.objectContaining({ player: 'black', cardId: 'guard_01' })
        ])
      })
    ]));
    expect(workerResult.payload.snapshot.cardState.hands.black).toEqual(expect.arrayContaining(['gold_stone', 'guard_01']));
    expect(workerResult.payload.snapshot.cardState.decks.black).toEqual([]);
  }, 90000);

  test.each([
    ['cross bomb follow-up place', 'cross_bomb_01'],
    ['x bomb follow-up place', 'x_bomb_01']
  ])('%s keeps destroy/sound playback parity with headless authority result', (_label, cardId) => {
    const result = runWorkerPendingSelectionPlaceParityScenario({
      cardId,
      seed: cardId === 'cross_bomb_01' ? 91 : 97,
      selectTargets: () => ({ bombTarget: { row: 3, col: 3 } })
    });

    const localDestroyEvents = collectPlaybackEventsByType(result.localPlace.playbackEvents, 'destroy');
    const localSoundEvents = collectPlaybackEventsByType(result.localPlace.playbackEvents, 'sound_effect');
    const localSoundKeys = localSoundEvents
      .map((event) => Array.isArray(event && event.targets) && event.targets[0] ? event.targets[0].soundKey : null)
      .filter(Boolean);

    expect(localDestroyEvents.length).toBeGreaterThan(0);
    expect(localSoundKeys).toContain('bomb_explode');
    expect(result.localPlace.effectLogs || []).toEqual(expect.arrayContaining([
      expect.stringContaining('爆破')
    ]));

    const workerDestroyEvents = collectPlaybackEventsByType(result.workerPlace.payload.playbackEvents, 'destroy');
    const workerSoundKeys = collectPlaybackEventsByType(result.workerPlace.payload.playbackEvents, 'sound_effect')
      .map((event) => Array.isArray(event && event.targets) && event.targets[0] ? event.targets[0].soundKey : null)
      .filter(Boolean);
    expect(workerDestroyEvents.length).toBe(localDestroyEvents.length);
    expect(workerSoundKeys).toContain('bomb_explode');
  }, 90000);

  test('network debug fill can use position swap will with debug no-consume options', () => {
    const cardId = 'position_swap_01';
    const runtime = LocalMatchRuntime.createRuntime({ seed: 71, networkDebugEnabled: true });
    const runtimeSnapshot = runtime.getSnapshot();
    DebugActions.fillDebugHand(runtimeSnapshot.cardState, {
      playerKey: 'black',
      replaceExisting: true,
      charge: 99
    });
    runtimeSnapshot.cardState.deck.black = [];
    runtimeSnapshot.cardState.deck.white = [];
    runtimeSnapshot.cardState.discard = [];
    runtimeSnapshot.cardState.selectedCardId = cardId;
    runtimeSnapshot.cardState.selectedCardOwnerKey = 'black';
    runtimeSnapshot.gameState.currentPlayer = Core.BLACK;
    runtime.getRoom().stateVersion = 0;
    runtimeSnapshot.stateVersion = 0;
    runtime.getRoom().networkDebugEnabled = true;
    runtime.getRoom().authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(runtimeSnapshot);

    const initialSnapshot = clone(runtimeSnapshot);
    const initialVersion = runtime.getRoom().stateVersion;
    const body = buildUseCardBody(runtime, cardId, 'op_worker_pattern_debug_position_swap_use');
    body.params.debugOptions = { ignoreCost: true, noConsume: true };
    body.action.debugOptions = { ignoreCost: true, noConsume: true };

    const workerResult = runWorkerPublish(initialSnapshot, initialVersion, body);

    expect(workerResult.status).toBe(200);
    expect(workerResult.payload.ok).toBe(true);
    expect(workerResult.payload.snapshot.cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      type: 'POSITION_SWAP_WILL',
      stage: 'selectTarget'
    }));
  }, 90000);

  test('network debug fill then move still allows next player to use position swap will', () => {
    const cardId = 'position_swap_01';
    const runtime = LocalMatchRuntime.createRuntime({ seed: 71, networkDebugEnabled: true });
    const runtimeSnapshot = runtime.getSnapshot();
    DebugActions.fillDebugHand(runtimeSnapshot.cardState, {
      playerKey: 'white',
      replaceExisting: true,
      charge: 99
    });
    runtimeSnapshot.cardState.deck.black = [];
    runtimeSnapshot.cardState.deck.white = [];
    runtimeSnapshot.cardState.discard = [];
    runtimeSnapshot.gameState.currentPlayer = Core.BLACK;
    runtime.getRoom().stateVersion = 0;
    runtimeSnapshot.stateVersion = 0;
    runtime.getRoom().networkDebugEnabled = true;
    runtime.getRoom().authoritativeStateHash = MatchAuthority.computeAuthoritativeStateHash(runtimeSnapshot);

    const move = pickFirstLegalMove(runtimeSnapshot, 'black');
    const moveTurnIndex = Number(runtimeSnapshot.cardState && runtimeSnapshot.cardState.turnIndex) || 0;
    const moveBody = {
      seatKey: 'black',
      playerKey: 'black',
      baseVersion: 0,
      operationId: 'op_worker_pattern_debug_position_swap_move',
      actionType: 'place',
      actor: 'black',
      params: {
        row: move.row,
        col: move.col
      },
      turnIndex: moveTurnIndex,
      action: {
        type: 'place',
        playerKey: 'black',
        row: move.row,
        col: move.col,
        turnIndex: moveTurnIndex
      }
    };
    const moveResult = runWorkerPublish(clone(runtimeSnapshot), 0, moveBody);
    expect(moveResult.status).toBe(200);
    expect(moveResult.payload.ok).toBe(true);

    const afterMoveSnapshot = clone(moveResult.payload.snapshot);
    const useTurnIndex = Number(afterMoveSnapshot.cardState && afterMoveSnapshot.cardState.turnIndex) || 0;
    const useBody = {
      seatKey: 'white',
      playerKey: 'white',
      baseVersion: moveResult.payload.stateVersion,
      operationId: 'op_worker_pattern_debug_position_swap_after_move_use',
      actionType: 'use_card',
      actor: 'white',
      params: {
        useCardId: cardId,
        useCardOwnerKey: 'white',
        debugOptions: { ignoreCost: true, noConsume: true }
      },
      turnIndex: useTurnIndex,
      action: {
        type: 'use_card',
        playerKey: 'white',
        useCardId: cardId,
        useCardOwnerKey: 'white',
        debugOptions: { ignoreCost: true, noConsume: true },
        turnIndex: useTurnIndex
      }
    };
    const useResult = runWorkerPublish(afterMoveSnapshot, moveResult.payload.stateVersion, useBody);

    expect(useResult.status).toBe(200);
    expect(useResult.payload.ok).toBe(true);
    expect(useResult.payload.snapshot.cardState.pendingEffectByPlayer.white).toEqual(expect.objectContaining({
      type: 'POSITION_SWAP_WILL',
      stage: 'selectTarget'
    }));
  }, 90000);
});


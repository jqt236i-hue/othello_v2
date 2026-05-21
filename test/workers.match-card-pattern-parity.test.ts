import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';
import * as Core from '../game/logic/core.js';
import * as MatchAuthority from '../utils/match-authority.js';
import * as LocalMatchRuntime from '../game/local-match-runtime';

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
    "    roomDeck: null, roomBoardConfig: snapshot && snapshot.gameState ? snapshot.gameState.boardConfig || null : null, networkDebugEnabled: false,",
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

describe('worker card pattern parity', () => {
  test.each([
    ['pending selection destroy', 'destroy_01'],
    ['pending selection swap', 'swap_01'],
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
    expect(normalizePlaybackSummary(workerResult.payload.playbackEvents))
      .toEqual(normalizePlaybackSummary(localResult.playbackEvents));
    expect(workerResult.payload.effectLogs || []).toEqual(localResult.effectLogs || []);
  }, 90000);
});


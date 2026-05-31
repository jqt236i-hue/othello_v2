import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const workerModulePath = pathToFileURL(path.resolve(__dirname, '../workers/match-worker.mjs')).href;
const RESULT_MARKER = '__NETWORK_PARITY_MISSING_TYPES__';

type PendingSmokeResult = {
  pendingType: string;
  status: number;
  ok: boolean;
  rejectedReason: string | null;
  playbackCount: number;
};

function runPublishScenario(runner: string): PendingSmokeResult {
  const result = spawnSync(process.execPath, ['-e', runner, workerModulePath], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'network parity runner failed');
  }

  const output = String(result.stdout || '');
  const markerIndex = output.lastIndexOf(RESULT_MARKER);
  if (markerIndex < 0) {
    throw new Error(output || 'network parity runner did not emit result marker');
  }

  return JSON.parse(output.slice(markerIndex + RESULT_MARKER.length));
}

function runCommandPublishPendingPlaceScenario(pendingType: string): PendingSmokeResult {
  const runner = [
    "(async () => {",
    "  const modulePath = process.argv[1];",
    `  const pendingType = ${JSON.stringify(pendingType)};`,
    "  const { MatchRoomDurableObject } = await import(modulePath);",
    "  const path = require('path');",
    "  const fromRoot = (relativePath) => require(path.resolve(process.cwd(), relativePath));",
    "  const Core = fromRoot('game/logic/core.js');",
    "  const CardLogic = fromRoot('game/logic/cards.js');",
    "  const TurnPipelinePhases = fromRoot('game/turn/turn_pipeline_phases.js');",
    "  const SeededPRNG = fromRoot('game/schema/prng.js');",
    "  const gameState = Core.createGameState();",
    "  const prng = SeededPRNG.createPRNG(7);",
    "  const cardState = CardLogic.createCardState(prng);",
    "  TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', [], prng);",
    "  cardState.charge = { black: 99, white: 99 };",
    "  cardState.pendingEffectByPlayer.black = { type: pendingType, stage: null };",
    "  cardState.hasUsedCardThisTurnByPlayer.black = true;",
    "  const turnIndex = typeof cardState.turnIndex === 'number' ? cardState.turnIndex : 1;",
    "  const room = {",
    "    roomId: 'ROOMP2',",
    "    seed: 7,",
    "    stateVersion: 0,",
    "    updatedAt: Date.now(),",
    "    seats: { black: true, white: true },",
    "    seatTokens: { black: 'token_black', white: 'token_white' },",
    "    seatNames: { black: 'black', white: 'white' },",
    "    turnTimer: { limitSeconds: 120, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null },",
    "    lastAcceptedOperationBySeat: { black: null, white: null },",
    "    snapshot: { gameState, cardState, stateVersion: 0, updatedAt: Date.now() }",
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
    "    roomId: 'ROOMP2',",
    "    seatKey: 'black',",
    "    playerKey: 'black',",
    "    seatToken: 'token_black',",
    "    baseVersion: 0,",
    "    operationId: `op_${String(pendingType).toLowerCase()}_missing_parity`,",
    "    actionType: 'place',",
    "    actor: 'black',",
    "    params: { row: 2, col: 3 },",
    "    turnIndex,",
    "    action: { type: 'place', playerKey: 'black', row: 2, col: 3, turnIndex }",
    "  });",
    "  const payload = await response.json();",
    `  process.stdout.write('${RESULT_MARKER}' + JSON.stringify({`,
    "    pendingType,",
    "    status: response.status,",
    "    ok: !!payload.ok,",
    "    rejectedReason: payload && payload.rejectedReason ? payload.rejectedReason : null,",
    "    playbackCount: Array.isArray(broadcastMeta && broadcastMeta.playbackEvents) ? broadcastMeta.playbackEvents.length : -1",
    "  }));",
    "})().catch((error) => {",
    "  console.error(error && error.stack ? error.stack : String(error));",
    "  process.exit(1);",
    "});"
  ].join('\n');

  return runPublishScenario(runner);
}

const TARGETED_PENDING_PLACE_TYPES = [
  'TREASURE_BOX',
  'LAST_RESORT',
  'PROTECTED_NEXT_STONE',
  'GHOST_WILL',
  'AFTERIMAGE_WILL',
  'PERMA_PROTECT_NEXT_STONE',
  'DOUBLE_CHAIN_WILL',
  'TRIPLE_CHAIN_WILL',
  'QUAD_CHAIN_WILL',
  'INFINITE_CHAIN_WILL',
  'TABOO_REVERSE_WILL',
  'REGEN_WILL',
  'TIME_STOP_GOD',
  'PROLIFERATION_WILL',
  'CROSS_BOMB',
  'X_BOMB',
  'HYPERACTIVE_WILL',
  'ESCAPE_WILL',
  'ROBOT_VACUUM_WILL',
  'INSTANT_HYPERACTIVE_WILL',
  'REBUILD_WILL',
  'SUPPLY_WILL',
  'CORNER_TRIBUTE',
  'WORK_WILL',
  'RIBO_WILL',
  'LOSS_WILL',
  'DOUBLE_PLACE',
  'TRIPLE_PLACE',
  'QUAD_PLACE',
  'INFINITE_PLACE',
  'REVEAL_HAND_WILL',
  'EXECUTION_WILL',
  'GOLD_STONE',
  'SILVER_STONE',
  'CRYSTAL_STONE',
  'THEORY_INCARNATION',
  'OBSERVER_WILL',
  'SALVATION_WILL',
  'REINFORCEMENT_WILL',
  'SUPPORT_TROOPS_WILL',
  'EQUALITY_WILL',
  'FATE_WILL'
] as const;

describe('workers pending place parity smoke for previously uncovered card types', () => {
  test.each(TARGETED_PENDING_PLACE_TYPES)('%s returns authoritative publish with playback', (pendingType) => {
    const result = runCommandPublishPendingPlaceScenario(pendingType);

    expect(result.pendingType).toBe(pendingType);
    expect(result.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(result.rejectedReason).toBeNull();
    expect(result.playbackCount).toBeGreaterThan(0);
  });
});

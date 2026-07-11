const Shared = require('../../shared-constants.js');
const Core = require('../../game/logic/core.js');
const CardLogic = require('../../game/logic/cards.js');
const TurnPipelinePhases = require('../../game/turn/turn_pipeline_phases.js');
const TurnPipelineUIAdapter = require('../../game/turn/pipeline_ui_adapter.js');
const SeededPRNG = require('../../game/schema/prng.js');
const StateHash = require('../../shared/state-hash.js');
const PlaybackEventHelpers = require('../../shared/playback-event-helpers.js');
const MatchAuthority = require('../../utils/match-authority.js');
const deepClone = require('../../utils/deepClone.js');

export type NetworkSpecialStoneFixtureId = 'baseline-light' | 'late-dense' | 'late-special-20';

export type NetworkSpecialStonePerformanceFixture = {
  id: NetworkSpecialStoneFixtureId;
  seed: number;
  summary: {
    rows: number;
    cols: number;
    occupied: number;
    markerCount: number;
  };
  snapshot: any;
};

const DEFAULT_SEEDS: Record<NetworkSpecialStoneFixtureId, number> = {
  'baseline-light': 101,
  'late-dense': 202,
  'late-special-20': 303
};

const TIMESTAMP_KEYS = new Set(['createdAt', 'updatedAt', 'serverTime']);

const DENSE_EMPTY_CELLS = new Set([
  '0,0', '0,7', '1,1', '1,6', '2,2', '2,5',
  '5,2', '5,5', '6,1', '6,6', '7,0', '7,7'
]);

function playerKeyForValue(value: number): 'black' | 'white' {
  return value === Shared.WHITE ? 'white' : 'black';
}

function fillDenseBoard(board: number[][]): void {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      board[row][col] = DENSE_EMPTY_CELLS.has(`${row},${col}`)
        ? Shared.EMPTY
        : ((row + col) % 2 === 0 ? Shared.BLACK : Shared.WHITE);
    }
  }
}

function addStoneMarker(cardState: any, gameState: any, row: number, col: number, data: any): any {
  const value = gameState.board[row][col];
  if (value !== Shared.BLACK && value !== Shared.WHITE) {
    throw new Error(`fixture marker requires occupied cell at ${row},${col}`);
  }
  return CardLogic.addMarker(
    cardState,
    'specialStone',
    row,
    col,
    playerKeyForValue(value),
    data
  );
}

function clearSetupPresentation(cardState: any): void {
  cardState.presentationEvents = [];
  cardState._presentationEventsPersist = [];
}

function addBaselineMarkers(cardState: any, gameState: any): void {
  addStoneMarker(cardState, gameState, 3, 3, { type: 'PROTECTED', remainingOwnerTurns: 2 });
  addStoneMarker(cardState, gameState, 4, 4, { type: 'PERMA_PROTECTED' });
}

function addLateDenseMarkers(cardState: any, gameState: any): void {
  addStoneMarker(cardState, gameState, 0, 1, { type: 'HYPERACTIVE', remainingOwnerTurns: 5, flipEvadeRemaining: 1 });
  addStoneMarker(cardState, gameState, 2, 4, { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 });
  addStoneMarker(cardState, gameState, 3, 1, { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2, placedTurn: 40 });
  addStoneMarker(cardState, gameState, 4, 2, { type: 'PROTECTED', remainingOwnerTurns: 2 });
}

function addLateSpecialMarkers(cardState: any, gameState: any): void {
  const mobile = [[0, 1], [0, 6], [1, 0], [1, 7]];
  const destroy = [[2, 3], [2, 4], [5, 3], [5, 4]];
  const bombs = [[3, 1], [3, 6], [4, 1], [4, 6]];
  const protectedCells = [[3, 2], [3, 5], [4, 2], [4, 5]];
  const ghosts = [[6, 0], [6, 7]];
  const living = [[7, 1], [7, 6]];

  mobile.forEach(([row, col]) => addStoneMarker(cardState, gameState, row, col, {
    type: 'HYPERACTIVE',
    remainingOwnerTurns: 5,
    flipEvadeRemaining: 1
  }));
  destroy.forEach(([row, col]) => addStoneMarker(cardState, gameState, row, col, {
    type: 'DESTROY_DRAGON',
    remainingOwnerTurns: 3
  }));
  bombs.forEach(([row, col]) => addStoneMarker(cardState, gameState, row, col, {
    type: 'TIME_BOMB',
    category: 'bomb',
    remainingTurns: 1,
    placedTurn: 40
  }));
  protectedCells.forEach(([row, col]) => addStoneMarker(cardState, gameState, row, col, {
    type: 'PROTECTED',
    remainingOwnerTurns: 2
  }));
  ghosts.forEach(([row, col]) => addStoneMarker(cardState, gameState, row, col, {
    type: 'GHOST',
    remainingOwnerTurns: 1
  }));
  living.forEach(([row, col]) => {
    const owner = playerKeyForValue(gameState.board[row][col]);
    addStoneMarker(cardState, gameState, row, col, {
      type: 'LIVING_WILL',
      remainingOwnerTurns: 3,
      baseline: { owner, value: gameState.board[row][col], markers: [] }
    });
  });
}

function countOccupied(board: number[][]): number {
  return board.reduce((total, row) => total + row.filter((value) => value === Shared.BLACK || value === Shared.WHITE).length, 0);
}

export function createNetworkSpecialStonePerformanceFixture(
  id: NetworkSpecialStoneFixtureId,
  seedValue?: number
): NetworkSpecialStonePerformanceFixture {
  const seed = Number.isFinite(Number(seedValue)) ? Math.trunc(Number(seedValue)) : DEFAULT_SEEDS[id];
  if (!Number.isFinite(seed)) throw new Error(`unknown performance fixture: ${String(id)}`);

  const prng = SeededPRNG.createPRNG(seed);
  const gameState = Core.createGameState({ rows: 8, cols: 8 });
  const cardState = CardLogic.createCardState(prng, { boardConfig: { rows: 8, cols: 8 } });

  if (id === 'baseline-light') {
    addBaselineMarkers(cardState, gameState);
    gameState.turnNumber = 3;
    cardState.turnIndex = 2;
  } else {
    fillDenseBoard(gameState.board);
    gameState.turnNumber = 47;
    cardState.turnIndex = 46;
    if (id === 'late-dense') addLateDenseMarkers(cardState, gameState);
    if (id === 'late-special-20') addLateSpecialMarkers(cardState, gameState);
  }

  gameState.currentPlayer = Shared.BLACK;
  gameState.consecutivePasses = 0;
  cardState.lastTurnStartedFor = 'white';
  clearSetupPresentation(cardState);
  cardState.prngState = prng.getState();

  const snapshot = deepClone({
    gameState,
    cardState,
    stateVersion: 46,
    updatedAt: 1_700_000_000_000
  });

  return {
    id,
    seed,
    summary: {
      rows: gameState.board.length,
      cols: gameState.board[0].length,
      occupied: countOccupied(gameState.board),
      markerCount: cardState.markers.length
    },
    snapshot
  };
}

export function createAllNetworkSpecialStonePerformanceFixtures(): NetworkSpecialStonePerformanceFixture[] {
  return (Object.keys(DEFAULT_SEEDS) as NetworkSpecialStoneFixtureId[])
    .map((id) => createNetworkSpecialStonePerformanceFixture(id));
}

export function createAuthorityRoomFromFixture(fixture: NetworkSpecialStonePerformanceFixture): any {
  const snapshot = deepClone(fixture.snapshot);
  return {
    roomId: `PERF-${fixture.id.toUpperCase()}`,
    seed: fixture.seed,
    snapshot,
    stateVersion: snapshot.stateVersion,
    seats: { black: true, white: true },
    seatNames: { black: 'black', white: 'white' },
    roomDeck: null,
    roomBoardConfig: MatchAuthority.normalizeRoomBoardConfig({ rows: 8, cols: 8 }),
    networkDebugEnabled: false,
    turnTimer: null,
    visualSeq: 0,
    presentationJournal: [],
    sseEventBuffer: [],
    authoritativeStateHash: MatchAuthority.computeAuthoritativeStateHash(snapshot),
    updatedAt: snapshot.updatedAt
  };
}

function stripComparisonTimestamps(value: any): any {
  if (Array.isArray(value)) return value.map(stripComparisonTimestamps);
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, any> = {};
  for (const key of Object.keys(value)) {
    if (TIMESTAMP_KEYS.has(key)) continue;
    result[key] = stripComparisonTimestamps(value[key]);
  }
  return result;
}

export function serializePerformanceComparison(value: any): string {
  return StateHash.stableStringify(stripComparisonTimestamps(value));
}

export function runHeadlessFixtureTurnStart(fixture: NetworkSpecialStonePerformanceFixture): any {
  const snapshot = deepClone(fixture.snapshot);
  const prng = SeededPRNG.fromState(snapshot.cardState.prngState);
  const events: any[] = [];

  TurnPipelinePhases.applyTurnStartPhase(
    CardLogic,
    Core,
    snapshot.cardState,
    snapshot.gameState,
    'black',
    events,
    prng
  );
  snapshot.cardState.prngState = prng.getState();

  const playbackAssembly = PlaybackEventHelpers.collectServerPlaybackEvents({
    rawEvents: events,
    snapshot,
    playerKey: 'black',
    fallbackPlayerKey: 'black',
    adapter: TurnPipelineUIAdapter,
    normalizePlayerKey: (value: any) => String(value || '').toLowerCase() === 'white' ? 'white' : 'black'
  });
  const playbackEvents = Array.isArray(playbackAssembly && playbackAssembly.playbackEvents)
    ? playbackAssembly.playbackEvents
    : [];
  const canonical = stripComparisonTimestamps(snapshot);

  return {
    snapshot,
    events,
    playbackEvents,
    prngState: snapshot.cardState.prngState,
    comparison: {
      canonicalHash: StateHash.computeStableHash(canonical),
      eventDigest: StateHash.computeStableHash(events),
      playbackDigest: StateHash.computeStableHash(playbackEvents),
      serialized: serializePerformanceComparison({ snapshot, events, playbackEvents })
    }
  };
}

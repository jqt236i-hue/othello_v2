import * as Shared from '../shared-constants.js';

const CardLogic = require('../game/logic/cards.js');
const BoardOps = require('../game/logic/board_ops.js');
const Core = require('../game/logic/core.js');
const TurnPipelinePhases = require('../game/turn/turn_pipeline_phases.js');

function makePrng(randomValue = 0) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

function createResolveState(markerData) {
  const prng = makePrng();
  const cardState = CardLogic.createCardState(prng);
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };

  gameState.board[3][2] = Shared.BLACK;
  gameState.board[3][3] = Shared.WHITE;
  gameState.board[3][4] = Shared.BLACK;
  for (const [row, col] of [
    [2, 2], [2, 3], [2, 4],
    [4, 2], [4, 3], [4, 4]
  ]) {
    gameState.board[row][col] = Shared.BLACK;
  }

  cardState.markers.push({
    id: 9901,
    kind: 'specialStone',
    row: 3,
    col: 3,
    owner: 'white',
    data: Object.assign({}, markerData)
  });

  return { cardState, gameState, prng };
}

function createActionPhaseState(markerData) {
  const prng = makePrng();
  const cardState = CardLogic.createCardState(prng);
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };

  gameState.board[3][3] = Shared.WHITE;
  gameState.board[3][4] = Shared.BLACK;
  for (const [row, col] of [
    [2, 2], [2, 3], [2, 4],
    [4, 2], [4, 3], [4, 4]
  ]) {
    gameState.board[row][col] = Shared.BLACK;
  }

  cardState.markers.push({
    id: 9902,
    kind: 'specialStone',
    row: 3,
    col: 3,
    owner: 'white',
    data: Object.assign({}, markerData)
  });

  return { cardState, gameState, prng };
}

const FLIP_EVADE_CASES = Object.freeze([
  {
    type: 'HYPERACTIVE',
    markerData: { type: 'HYPERACTIVE', flipEvadeRemaining: 1 }
  },
  {
    type: 'ESCAPE_HYPERACTIVE',
    markerData: { type: 'ESCAPE_HYPERACTIVE', remainingOwnerTurns: 5, flipEvadeRemaining: 1 }
  },
  {
    type: 'INHERITED_HYPERACTIVE',
    markerData: {
      type: 'INHERITED_HYPERACTIVE',
      remainingOwnerTurns: 10,
      flipEvadeRemaining: 1,
      destroyEvadeRemaining: 1,
      hyperactiveSeq: 1
    }
  },
  {
    type: 'EXTREME_HYPERACTIVE',
    markerData: { type: 'EXTREME_HYPERACTIVE', flipEvadeRemaining: 3, destroyEvadeRemaining: 1 }
  },
  {
    type: 'ULTIMATE_HYPERACTIVE',
    markerData: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 10, flipEvadeRemaining: 3, destroyEvadeRemaining: 1 }
  },
  {
    type: 'AFTERIMAGE_WILL',
    markerData: { type: 'AFTERIMAGE_WILL', flipEvadeRemaining: 3, destroyEvadeRemaining: 3 }
  },
  {
    type: 'WILL_HUNTER_KING',
    markerData: { type: 'WILL_HUNTER_KING', remainingOwnerTurns: 8, flipEvadeRemaining: 2, destroyEvadeRemaining: 2 }
  }
]);

describe('flip evasion fallback to normal flip', () => {
  test.each(FLIP_EVADE_CASES)('%s は退避先が無いと通常反転へ残る', ({ markerData }) => {
    const { cardState, gameState, prng } = createResolveState(markerData);

    const markerBefore = cardState.markers.find((entry) => entry && entry.id === 9901);
    expect(markerBefore).toBeTruthy();
    const flipEvadeRemainingBefore = markerBefore.data.flipEvadeRemaining;
    const destroyEvadeRemainingBefore = markerBefore.data.destroyEvadeRemaining;

    const out = CardLogic.resolveHyperactiveFlipEvasion(
      cardState,
      gameState,
      [[3, 3]],
      'black',
      prng
    );

    expect(out.remainingFlips).toEqual([[3, 3]]);
    expect(out.moved).toEqual([]);
    expect(out.destroyed).toEqual([]);
    expect(out.evaded).toEqual([]);
    expect(gameState.board[3][3]).toBe(Shared.WHITE);

    const markerAfter = cardState.markers.find((entry) => entry && entry.id === 9901);
    expect(markerAfter).toBeTruthy();
    expect(markerAfter.row).toBe(3);
    expect(markerAfter.col).toBe(3);
    expect(markerAfter.data.flipEvadeRemaining).toBe(flipEvadeRemainingBefore);
    expect(markerAfter.data.destroyEvadeRemaining).toBe(destroyEvadeRemainingBefore);
  });

  test.each(FLIP_EVADE_CASES)('%s は配置反転で退避先が無いと通常どおり反転される', ({ markerData }) => {
    const { cardState, gameState, prng } = createActionPhaseState(markerData);
    const events = [];

    TurnPipelinePhases.applyActionPhase(
      CardLogic,
      Core,
      cardState,
      gameState,
      'black',
      { type: 'place', row: 3, col: 2 },
      events,
      prng,
      BoardOps
    );

    expect(gameState.board[3][2]).toBe(Shared.BLACK);
    expect(gameState.board[3][3]).toBe(Shared.BLACK);
    expect(cardState.markers.find((entry) => entry && entry.id === 9902)).toBeUndefined();
    expect(events.some((event) => (
      event &&
      typeof event.type === 'string' &&
      (event.type.endsWith('moved_immediate') || event.type.endsWith('destroyed_immediate'))
    ))).toBe(false);

    const placeEvent = events.find((event) => event && event.type === 'place');
    expect(placeEvent).toBeTruthy();
    expect(placeEvent.flips).toEqual([[3, 3]]);
  });
});

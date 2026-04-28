import * as CardLogic from '../game/logic/cards.js';
import * as Shared from '../shared-constants.js';

function makeState(fillValue = Shared.EMPTY) {
  const prng = { shuffle: (arr) => arr, random: () => 0 };
  return {
    cardState: CardLogic.createCardState(prng),
    gameState: {
      board: Array.from({ length: 8 }, () => Array(8).fill(fillValue)),
      currentPlayer: Shared.BLACK
    }
  };
}

describe('duration-end special stone reverts', () => {
  test('DRAGON anchor reverts to a same-color normal stone on expiry', () => {
    const { cardState, gameState } = makeState(Shared.BLACK);
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'DRAGON', remainingOwnerTurns: 1 }
    });

    const out = CardLogic.processDragonEffectsAtTurnStartAnchor(cardState, gameState, 'black', 3, 3);

    expect((out.destroyed || [])).toEqual([expect.objectContaining({ row: 3, col: 3, reason: 'anchor_expired' })]);
    expect(gameState.board[3][3]).toBe(Shared.BLACK);
    expect((cardState.markers || []).find((entry) => entry && entry.data && entry.data.type === 'DRAGON')).toBeUndefined();
  });

  test('BREEDING anchor reverts to a same-color normal stone on expiry', () => {
    const { cardState, gameState } = makeState(Shared.BLACK);
    cardState.markers.push({
      id: 2,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'BREEDING', remainingOwnerTurns: 1 }
    });

    const out = CardLogic.processBreedingEffectsAtTurnStartAnchor(cardState, gameState, 'black', 4, 4, { random: () => 0 });

    expect((out.destroyed || [])).toEqual([expect.objectContaining({ row: 4, col: 4, reason: 'anchor_expired' })]);
    expect(gameState.board[4][4]).toBe(Shared.BLACK);
    expect((cardState.markers || []).find((entry) => entry && entry.data && entry.data.type === 'BREEDING')).toBeUndefined();
  });

  test('ULTIMATE_HYPERACTIVE reverts to a same-color normal stone when duration ends', () => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = Shared.BLACK;
    cardState.markers.push({
      id: 3,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 1 }
    });

    const out = CardLogic.processUltimateHyperactiveMoveAtAnchor(
      cardState,
      gameState,
      'black',
      3,
      3,
      { random: () => 0 },
      { currentTurnPlayerKey: 'black' }
    );

    const reverted = (out.destroyed || []).find((detail) => detail && detail.reason === 'duration_end');
    expect(reverted).toEqual(expect.objectContaining({
      specialType: 'ULTIMATE_HYPERACTIVE',
      reason: 'duration_end',
      reverted: true
    }));
    expect(gameState.board[reverted.row][reverted.col]).toBe(Shared.BLACK);
    expect(gameState.board.flat().filter((value) => value === Shared.BLACK)).toHaveLength(1);
    expect((cardState.markers || []).find((entry) => entry && entry.data && entry.data.type === 'ULTIMATE_HYPERACTIVE')).toBeUndefined();
  });

  test('WILL_HUNTER_KING anchor reverts to a same-color normal stone on expiry', () => {
    const { cardState, gameState } = makeState();
    gameState.board[2][2] = Shared.BLACK;
    cardState.markers.push({
      id: 4,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: {
        type: 'WILL_HUNTER_KING',
        remainingOwnerTurns: 1,
        flipEvadeRemaining: 2,
        destroyEvadeRemaining: 2
      }
    });

    const out = CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(cardState, gameState, 'black', 2, 2, { random: () => 0 });

    expect((out.expired || [])).toEqual([expect.objectContaining({ row: 2, col: 2, reason: 'anchor_expired' })]);
    expect(gameState.board[2][2]).toBe(Shared.BLACK);
    expect((cardState.markers || []).find((entry) => entry && entry.data && entry.data.type === 'WILL_HUNTER_KING')).toBeUndefined();
  });
});

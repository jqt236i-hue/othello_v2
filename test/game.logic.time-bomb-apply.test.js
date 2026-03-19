const CardTimeBomb = require('../game/logic/cards/time_bomb');

describe('CardTimeBomb.applyTimeBombWill', () => {
  test('rejects when selection is not pending', () => {
    const cardState = { pendingEffectByPlayer: { black: null } };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };

    const result = CardTimeBomb.applyTimeBombWill(cardState, gameState, 'black', 2, 2, {
      getTimeBombTargets: () => [{ row: 2, col: 2 }]
    });

    expect(result).toEqual({ applied: false, reason: 'not_pending' });
  });

  test('places a bomb, clears pending, and removes special-stone marker on valid target', () => {
    const removed = [];
    const added = [];
    const cardState = {
      turnIndex: 4,
      pendingEffectByPlayer: {
        black: { type: 'TIME_BOMB', stage: 'selectTarget', cardId: 'bomb_01' }
      },
      markers: []
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };

    const result = CardTimeBomb.applyTimeBombWill(cardState, gameState, 'black', 2, 3, {
      getTimeBombTargets: () => [{ row: 2, col: 3 }],
      removeMarkersAt: (...args) => removed.push(args),
      addMarker: (...args) => {
        added.push(args);
        cardState.markers.push({ kind: args[1], row: args[2], col: args[3], owner: args[4], data: args[5] });
        return { placed: true };
      },
      specialStoneKind: 'specialStone'
    });

    expect(result).toEqual({ applied: true, row: 2, col: 3 });
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(removed).toEqual([[cardState, 2, 3, { kind: 'specialStone' }]]);
    expect(added).toHaveLength(1);
    expect(cardState.markers[0]).toMatchObject({
      kind: 'specialStone',
      row: 2,
      col: 3,
      owner: 'black',
      data: expect.objectContaining({ type: 'TIME_BOMB', category: 'bomb' })
    });
  });

  test('returns exists when a bomb marker is already present', () => {
    const cardState = {
      turnIndex: 8,
      pendingEffectByPlayer: {
        white: { type: 'TIME_BOMB', stage: 'selectTarget', cardId: 'bomb_02' }
      },
      markers: [{ kind: 'specialStone', row: 1, col: 1, owner: 'white', data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 } }]
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };

    const result = CardTimeBomb.applyTimeBombWill(cardState, gameState, 'white', 1, 1, {
      getTimeBombTargets: () => [{ row: 1, col: 1 }],
      removeMarkersAt: jest.fn()
    });

    expect(result).toEqual({ applied: false, reason: 'exists' });
    expect(cardState.pendingEffectByPlayer.white).toEqual({ type: 'TIME_BOMB', stage: 'selectTarget', cardId: 'bomb_02' });
  });

  test('uses canonical marker allocation when addMarker is not injected', () => {
    const cardState = {
      turnIndex: 1,
      pendingEffectByPlayer: {
        black: { type: 'TIME_BOMB', stage: 'selectTarget', cardId: 'bomb_03' }
      },
      markers: []
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };

    const first = CardTimeBomb.applyTimeBombWill(cardState, gameState, 'black', 2, 3, {
      getTimeBombTargets: () => [{ row: 2, col: 3 }],
      removeMarkersAt: jest.fn()
    });
    cardState.pendingEffectByPlayer.black = { type: 'TIME_BOMB', stage: 'selectTarget', cardId: 'bomb_04' };
    const second = CardTimeBomb.applyTimeBombWill(cardState, gameState, 'black', 2, 4, {
      getTimeBombTargets: () => [{ row: 2, col: 4 }],
      removeMarkersAt: jest.fn()
    });

    expect(first).toEqual({ applied: true, row: 2, col: 3 });
    expect(second).toEqual({ applied: true, row: 2, col: 4 });
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 1, createdSeq: 1, kind: 'specialStone', row: 2, col: 3, data: expect.objectContaining({ type: 'TIME_BOMB', category: 'bomb' }) }),
      expect.objectContaining({ id: 2, createdSeq: 2, kind: 'specialStone', row: 2, col: 4, data: expect.objectContaining({ type: 'TIME_BOMB', category: 'bomb' }) })
    ]));
  });
});

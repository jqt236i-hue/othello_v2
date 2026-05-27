const ObserverWill = require('../game/logic/cards/observer_will');

function createDeps(overrides = {}) {
  return {
    defaultPrng: { random: () => 0.9 },
    blackValue: 1,
    whiteValue: -1,
    markerKinds: { SPECIAL_STONE: 'specialStone' },
    resolveDeterministicRandomSource: (_randomLike, fallbackLike) => fallbackLike,
    getSpecialMarkers: (cardState) => cardState.markers || [],
    removeMarkersAt: (cardState, row, col, options) => {
      cardState.markers = (cardState.markers || []).filter((marker) => {
        if (!marker || marker.row !== row || marker.col !== col) return true;
        if (options && options.kind && marker.kind !== options.kind) return true;
        if (options && options.type && marker.data && marker.data.type !== options.type) return true;
        if (options && options.owner && marker.owner !== options.owner) return true;
        return false;
      });
    },
    addChargeWithTotal: (cardState, playerKey, amount) => {
      if (!cardState.charge) cardState.charge = { black: 0, white: 0 };
      const before = cardState.charge[playerKey] || 0;
      cardState.charge[playerKey] = before + amount;
      return amount;
    },
    revertSpecialStoneWithPresentation: jest.fn(() => ({ reverted: true })),
    ...overrides
  };
}

describe('observer will card module', () => {
  test('triggers charge gain and decrements duration', () => {
    const cardState = {
      charge: { black: 0, white: 0 },
      markers: [{ kind: 'specialStone', row: 2, col: 2, owner: 'black', data: { type: 'OBSERVER', remainingOwnerTurns: 5 } }]
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
    gameState.board[2][2] = 1;
    const prng = { random: jest.fn().mockReturnValueOnce(0.1).mockReturnValueOnce(0.4) };

    const result = ObserverWill.processObserverWillEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      2,
      2,
      prng,
      createDeps()
    );

    expect(result).toMatchObject({ activated: true, triggered: true, gained: 3, remainingOwnerTurns: 4 });
    expect(cardState.charge.black).toBe(3);
    expect(cardState.markers[0].data.remainingOwnerTurns).toBe(4);
  });

  test('removes observer marker when anchor is lost', () => {
    const cardState = {
      markers: [{ kind: 'specialStone', row: 4, col: 4, owner: 'black', data: { type: 'OBSERVER', remainingOwnerTurns: 5 } }]
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
    gameState.board[4][4] = -1;

    const result = ObserverWill.processObserverWillEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      4,
      4,
      { random: () => 0.9 },
      createDeps()
    );

    expect(result.expired).toEqual([{ row: 4, col: 4, owner: 'black', reason: 'anchor_lost' }]);
    expect(cardState.markers).toEqual([]);
  });

  test('expires through revert when duration reaches zero', () => {
    const cardState = {
      markers: [{ kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'OBSERVER', remainingOwnerTurns: 1 } }]
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
    gameState.board[1][1] = 1;
    const revert = jest.fn(() => ({ reverted: true }));

    const result = ObserverWill.processObserverWillEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      1,
      1,
      { random: () => 0.9 },
      createDeps({ revertSpecialStoneWithPresentation: revert })
    );

    expect(revert).toHaveBeenCalledWith(
      cardState,
      gameState,
      1,
      1,
      'OBSERVER',
      'black',
      'OBSERVER_WILL',
      'duration_end',
      { owner: 'black', timer: 0 }
    );
    expect(result.expired).toEqual([{ row: 1, col: 1, owner: 'black', reason: 'duration_end' }]);
  });
});

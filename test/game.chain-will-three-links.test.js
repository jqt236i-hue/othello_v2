const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');
const { makeState, placeStones } = require('./helpers/chain-test-helpers');

describe('QUAD_CHAIN_WILL three-link chaining', () => {
  test('chains up to 3 times and stops even if a 4th chain is available', () => {
    const { cardState, gameState } = makeState(CardLogic, Shared);
    cardState.pendingEffectByPlayer.black = { type: 'QUAD_CHAIN_WILL', cardId: 'quad_chain_01', stage: null };

    placeStones(gameState, [
      [0, 1, Shared.WHITE],
      [0, 2, Shared.BLACK],
      [1, 1, Shared.WHITE],
      [2, 1, Shared.BLACK],
      [1, 2, Shared.WHITE],
      [1, 3, Shared.BLACK],
      [2, 2, Shared.WHITE],
      [3, 2, Shared.BLACK],
      [2, 3, Shared.WHITE],
      [2, 4, Shared.BLACK]
    ]);

    const prng = { random: () => 0, shuffle: (arr) => arr };
    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 0, col: 0 }, prng);

    expect(res.gameState.board[0][1]).toBe(Shared.BLACK);
    expect(res.gameState.board[1][1]).toBe(Shared.BLACK);
    expect(res.gameState.board[1][2]).toBe(Shared.BLACK);
    expect(res.gameState.board[2][2]).toBe(Shared.BLACK);
    expect(res.gameState.board[2][3]).toBe(Shared.WHITE);

    const chainEvent = res.events.find((e) => e && e.type === 'chain_flipped');
    expect(chainEvent).toBeTruthy();
    expect(chainEvent.details).toEqual(expect.arrayContaining([
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 2, col: 2 }
    ]));
    expect(chainEvent.details).toHaveLength(3);
  });
});

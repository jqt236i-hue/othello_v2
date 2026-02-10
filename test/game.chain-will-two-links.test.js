const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');
const { makeState, placeStones } = require('./helpers/chain-test-helpers');

describe('CHAIN_WILL two-link chaining', () => {
  test('chains up to 2 times and stops even if a 3rd chain is available', () => {
    const { cardState, gameState } = makeState(CardLogic, Shared);
    cardState.pendingEffectByPlayer.black = { type: 'CHAIN_WILL', cardId: 'chain_01', stage: null };

    placeStones(gameState, [
      // Primary flip for placement at (0,0): only (0,1) flips to black.
      [0, 1, Shared.WHITE],
      [0, 2, Shared.BLACK],
      // 1st chain candidate from (0,1): down flips (1,1) because (2,1) is black.
      [1, 1, Shared.WHITE],
      [2, 1, Shared.BLACK],
      // 2nd chain candidate from (1,1): right flips (1,2) because (1,3) is black.
      [1, 2, Shared.WHITE],
      [1, 3, Shared.BLACK],
      // 3rd chain would be possible from (1,2) if unlimited: down flips (2,2) with (3,2) black.
      // The new spec requires stopping before this.
      [2, 2, Shared.WHITE],
      [3, 2, Shared.BLACK]
    ]);

    const prng = { random: () => 0, shuffle: (arr) => arr };
    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 0, col: 0 }, prng);

    expect(res.gameState.board[0][1]).toBe(Shared.BLACK);
    expect(res.gameState.board[1][1]).toBe(Shared.BLACK); // chain 1
    expect(res.gameState.board[1][2]).toBe(Shared.BLACK); // chain 2
    expect(res.gameState.board[2][2]).toBe(Shared.WHITE); // chain 3 must not execute

    const chainEvent = res.events.find((e) => e && e.type === 'chain_flipped');
    expect(chainEvent).toBeTruthy();
    expect(chainEvent.details).toEqual(expect.arrayContaining([{ row: 1, col: 1 }, { row: 1, col: 2 }]));
    expect(chainEvent.details).toHaveLength(2);
  });
});

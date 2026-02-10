const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');
const { makeState, placeStones } = require('./helpers/chain-test-helpers');

describe('CHAIN_WILL single-direction selection per link', () => {
  test('when multiple chain directions are available, only one direction is applied for the link', () => {
    const { cardState, gameState } = makeState(CardLogic, Shared);
    cardState.pendingEffectByPlayer.black = { type: 'CHAIN_WILL', cardId: 'chain_01', stage: null };

    placeStones(gameState, [
      // Place at (2,2) to create one primary flip at (3,3).
      [3, 3, Shared.WHITE],
      [4, 4, Shared.BLACK],
      // From (3,3), two chain directions are available:
      // right -> (3,4) (with terminator at (3,5))
      // down  -> (4,3) (with terminator at (5,3))
      [3, 4, Shared.WHITE],
      [3, 5, Shared.BLACK],
      [4, 3, Shared.WHITE],
      [5, 3, Shared.BLACK]
    ]);

    // Deterministic tie-break
    const prng = { random: () => 0, shuffle: (arr) => arr };
    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 2 }, prng);

    // Primary flip applied
    expect(res.gameState.board[3][3]).toBe(Shared.BLACK);

    // Exactly one of the two directional candidates must be flipped by chain.
    const c1 = res.gameState.board[3][4] === Shared.BLACK;
    const c2 = res.gameState.board[4][3] === Shared.BLACK;
    expect((c1 ? 1 : 0) + (c2 ? 1 : 0)).toBe(1);

    const chainEvent = res.events.find((e) => e && e.type === 'chain_flipped');
    expect(chainEvent).toBeTruthy();
    expect(Array.isArray(chainEvent.details)).toBe(true);
    expect(chainEvent.details.length).toBe(1);
  });
});

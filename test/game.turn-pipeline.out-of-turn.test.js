const TurnPipeline = require('../game/turn/turn_pipeline');

describe('turn_pipeline applyTurnSafe out-of-turn guard', () => {
  test('rejects action when playerKey is not currentPlayer', () => {
    const cardState = {
      turnIndex: 0,
      pendingEffectByPlayer: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      charge: { black: 0, white: 0 }
    };
    const gameState = {
      currentPlayer: 'white',
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };

    const res = TurnPipeline.applyTurnSafe(cardState, gameState, 'black', { type: 'pass' });
    expect(res.ok).toBe(false);
    expect(res.rejectedReason).toBe('OUT_OF_TURN');
    expect(Array.isArray(res.events)).toBe(true);
    expect(res.events[0].reason).toBe('OUT_OF_TURN');
  });
});


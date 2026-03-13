const TurnPipelinePhases = require('../game/turn/turn_pipeline_phases');
const CardLogic = require('../game/logic/cards');
const Core = require('../game/logic/core');
const BoardOps = require('../game/logic/board_ops');

describe('FREE_PLACEMENT spawn cause mapping', () => {
  test('applyActionPhase emits FREE_PLACEMENT cause/reason on standard spawn', () => {
    const prng = { shuffle: (arr) => arr, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY)),
      currentPlayer: Core.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };

    cardState.pendingEffectByPlayer.black = {
      type: 'FREE_PLACEMENT',
      stage: 'awaitPlace',
      cardId: 'free_placement_01'
    };

    const events = [];
    const spawnSpy = jest.spyOn(BoardOps, 'spawnAt');

    try {
      TurnPipelinePhases.applyActionPhase(
        CardLogic,
        Core,
        cardState,
        gameState,
        'black',
        { type: 'place', row: 0, col: 0 },
        events,
        prng,
        BoardOps
      );

      expect(spawnSpy).toHaveBeenCalled();
      const first = spawnSpy.mock.calls[0];
      expect(first[5]).toBe('FREE_PLACEMENT');
      expect(first[6]).toBe('free_placement_place');
    } finally {
      spawnSpy.mockRestore();
    }
  });
});

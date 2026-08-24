import * as TurnPipeline from '../game/turn/turn_pipeline.js';

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

  test('applyTurn normalizes whitespace and case variants before delegating to phases', () => {
    jest.resetModules();

    const phaseMocks = {
      applyTurnStartPhase: jest.fn(),
      applyCardUsagePhase: jest.fn(),
      applyActionPhase: jest.fn()
    };

    jest.isolateModules(() => {
      jest.doMock('../game/logic/cards', () => ({
        flushPresentationEvents: jest.fn(() => []),
        getCardContext: jest.fn(() => ({})),
        hasUsableCard: jest.fn(() => false),
        applyCardUsage: jest.fn(() => false)
      }));
      jest.doMock('../game/logic/core', () => ({
        BLACK: 1,
        WHITE: -1,
        getLegalMoves: jest.fn(() => [])
      }));
      jest.doMock('../game/turn/turn_pipeline_phases', () => phaseMocks);
      jest.doMock('../game/logic/board_ops', () => ({
        setActionContext: jest.fn(),
        clearActionContext: jest.fn()
      }));

      const isolatedTurnPipeline = require('../game/turn/turn_pipeline.js');
      isolatedTurnPipeline.applyTurn(
        { turnIndex: 0, presentationEvents: [], pendingEffectByPlayer: { black: null, white: null } },
        { currentPlayer: -1, board: Array.from({ length: 8 }, () => Array(8).fill(0)) },
        ' WHITE ',
        { type: 'pass' }
      );
    });

    expect(phaseMocks.applyTurnStartPhase).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.any(Object),
      expect.any(Object),
      'white',
      expect.any(Array),
      undefined,
      expect.any(Object)
    );
    expect(phaseMocks.applyCardUsagePhase).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.any(Object),
      'white',
      expect.any(Object),
      expect.any(Array),
      undefined
    );
    expect(phaseMocks.applyActionPhase).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.any(Object),
      expect.any(Object),
      'white',
      expect.any(Object),
      expect.any(Array),
      undefined,
      expect.any(Object)
    );
  });
});

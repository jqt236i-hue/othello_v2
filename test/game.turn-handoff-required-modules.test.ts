import deepClone from '../utils/deepClone.js';

describe('turn handoff required modules', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('../game/turn/round-state');
  });

  test('a missing round-state module rejects the turn as runtime-unavailable with the original state', () => {
    jest.resetModules();
    jest.doMock('../game/turn/round-state', () => ({}));
    const CardLogic = require('../game/logic/cards.js');
    const Core = require('../game/logic/core.js');
    const TurnPipeline = require('../game/turn/turn_pipeline.js');
    const cardState = CardLogic.createCardState({ shuffle: (items: any[]) => items });
    const gameState: any = Core.createGameState();
    cardState.turnIndex = 0;
    const cardBefore = deepClone(cardState);
    const gameBefore = deepClone(gameState);

    const result: any = TurnPipeline.applyTurnSafe(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3, turnIndex: 0 },
      { random: () => 0.5, getState: () => ({ seed: 1, calls: 0 }) },
      { currentStateVersion: 0, skipTurnStart: true }
    );

    expect(result).toMatchObject({ ok: false, rejectedReason: 'RUNTIME_UNAVAILABLE', nextStateVersion: 0, events: [] });
    expect(result.gameState).toBe(gameState);
    expect(result.cardState).toBe(cardState);
    expect(gameState).toEqual(gameBefore);
    expect(deepClone(cardState)).toEqual(cardBefore);
  });

  test('with the modules present the same placement completes and hands the turn over once', () => {
    jest.resetModules();
    const CardLogic = require('../game/logic/cards.js');
    const Core = require('../game/logic/core.js');
    const TurnPipeline = require('../game/turn/turn_pipeline.js');
    const cardState = CardLogic.createCardState({ shuffle: (items: any[]) => items });
    const gameState: any = Core.createGameState();
    cardState.turnIndex = 0;

    const result: any = TurnPipeline.applyTurnSafe(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3, turnIndex: 0 },
      { random: () => 0.5, getState: () => ({ seed: 1, calls: 0 }) },
      { currentStateVersion: 0, skipTurnStart: true }
    );

    expect(result.ok).toBe(true);
    expect(result.gameState.currentPlayer).toBe(Core.WHITE);
    expect(result.gameState.turnNumber).toBe(1);
    expect(result.gameState.roundCompletionByPlayer).toEqual({ black: true, white: false });
  });
});

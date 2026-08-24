import deepClone from '../utils/deepClone.js';
import { createCardRuntimeUnavailableError, isCardRuntimeUnavailableError } from '../game/logic/card-runtime-errors';

const Shared = require('../shared-constants.js');
const CardLogic = require('../game/logic/cards.js');
const TurnPipeline = require('../game/turn/turn_pipeline.js');

describe('turn runtime pass dependency failure', () => {
  test('rejects AUTO pass before state, pending, event, version, or PRNG mutation', () => {
    const cardState = CardLogic.createCardState({ shuffle: (items: any[]) => items });
    const gameState: any = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Shared.BLACK)),
      currentPlayer: Shared.BLACK,
      turnNumber: 7,
      consecutivePasses: 0
    };
    gameState.board[0][0] = Shared.EMPTY;
    cardState.turnIndex = 12;
    const cardBefore = deepClone(cardState);
    const gameBefore = deepClone(gameState);
    const prng = { random: jest.fn(() => 0.5), getState: jest.fn(() => ({ seed: 1, calls: 0 })) };
    const original = (CardLogic as any).hasUsableCard;
    const unavailable = createCardRuntimeUnavailableError('state.availability', 'state');
    (CardLogic as any).hasUsableCard = () => { throw unavailable; };

    try {
      const result: any = TurnPipeline.applyTurnSafe(
        cardState,
        gameState,
        'black',
        { type: 'pass', autoNoActionPass: true, turnIndex: 12 },
        prng,
        { currentStateVersion: 12, skipTurnStart: true }
      );
      expect(result).toMatchObject({
        ok: false,
        rejectedReason: 'RUNTIME_UNAVAILABLE',
        nextStateVersion: 12,
        events: []
      });
      expect(isCardRuntimeUnavailableError(result.runtimeError)).toBe(true);
      expect(Object.keys(result)).not.toContain('runtimeError');
      expect(result.cardState).toBe(cardState);
      expect(result.gameState).toBe(gameState);
      expect(deepClone(cardState)).toEqual(cardBefore);
      expect(gameState).toEqual(gameBefore);
      expect(prng.random).not.toHaveBeenCalled();
      expect(prng.getState).not.toHaveBeenCalled();
    } finally {
      (CardLogic as any).hasUsableCard = original;
    }
  });

  test.each([
    ['direct', { type: 'pass', turnIndex: 12 }],
    ['timeout', { type: 'pass', turnIndex: 12, forcePass: true, timeoutPass: true, reason: 'timeout' }]
  ])('rejects %s pass when protection context is unavailable before any observable effect', (_lane, action) => {
    const cardState = CardLogic.createCardState({ shuffle: (items: any[]) => items });
    const gameState: any = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Shared.BLACK)),
      currentPlayer: Shared.BLACK,
      turnNumber: 7,
      consecutivePasses: 0
    };
    gameState.board[0][0] = Shared.EMPTY;
    cardState.turnIndex = 12;
    const cardBefore = deepClone(cardState);
    const gameBefore = deepClone(gameState);
    const prng = { random: jest.fn(() => 0.5), getState: jest.fn(() => ({ seed: 1, calls: 0 })) };
    const original = (CardLogic as any).getCardContext;
    const unavailable = createCardRuntimeUnavailableError('marker.protectionContext', 'marker');
    (CardLogic as any).getCardContext = () => { throw unavailable; };

    try {
      const result: any = TurnPipeline.applyTurnSafe(
        cardState,
        gameState,
        'black',
        action,
        prng,
        { currentStateVersion: 12, skipTurnStart: true }
      );
      expect(result).toMatchObject({
        ok: false,
        rejectedReason: 'RUNTIME_UNAVAILABLE',
        nextStateVersion: 12,
        events: []
      });
      expect(isCardRuntimeUnavailableError(result.runtimeError)).toBe(true);
      expect(result.cardState).toBe(cardState);
      expect(result.gameState).toBe(gameState);
      expect(deepClone(cardState)).toEqual(cardBefore);
      expect(gameState).toEqual(gameBefore);
      expect(prng.random).not.toHaveBeenCalled();
      expect(prng.getState).not.toHaveBeenCalled();
    } finally {
      (CardLogic as any).getCardContext = original;
    }
  });
});

import * as Core from '../game/logic/core.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import deepClone from '../utils/deepClone.js';

const PRNG = { shuffle: (items: any[]) => items, random: () => 0.5 };

describe('TurnPipeline card-use turn guard', () => {
  test('rejects a direct second use_card without mutating canonical state', () => {
    const gameState = Core.createGameState();
    const cardState = CardLogic.createCardState(PRNG);
    cardState.debugNoDraw = true;
    cardState.lastTurnStartedFor = 'black';
    cardState._activeTurnPlayer = 'black';
    cardState.hands.black = [];
    cardState._handCopyIdsByPlayer.black = [];
    CardLogic.addCardToHand(cardState, 'black', 'work_01');
    cardState.charge.black = 99;
    cardState.hasUsedCardThisTurnByPlayer.black = true;
    cardState.lastUsedCardByPlayer.black = 'hard_01';

    const gameBefore = deepClone(gameState);
    const cardBefore = deepClone(cardState);
    const result = TurnPipeline.applyTurnSafe(
      cardState,
      gameState,
      'black',
      {
        type: 'use_card',
        playerKey: 'black',
        useCardId: 'work_01',
        useCardOwnerKey: 'black',
        useCardHandIndex: 0
      },
      PRNG
    );

    expect(result.ok).toBe(false);
    expect(result.rejectedReason).toBe('CARD_USE_FAILED');
    expect(result.gameState).toEqual(gameBefore);
    expect(result.cardState).toEqual(cardBefore);
    expect(gameState).toEqual(gameBefore);
    expect(deepClone(cardState)).toEqual(cardBefore);
  });
});

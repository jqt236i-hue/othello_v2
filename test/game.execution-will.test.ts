const Shared = require('../shared-constants.js');
const CardLogic = require('../game/logic/cards.js');
const TurnPipeline = require('../game/turn/turn_pipeline.js');

function createPrng(sequence = [0]) {
  let index = 0;
  return {
    shuffle: (arr: any[]) => arr,
    random: () => {
      const safeIndex = Math.min(index, sequence.length - 1);
      index += 1;
      return sequence[safeIndex];
    }
  };
}

function createGameState() {
  return {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
}

function getExecutionDef() {
  return (Shared.CARD_DEFS || []).find((card: any) => card && card.type === 'EXECUTION_WILL');
}

describe('EXECUTION_WILL（執行の意志）', () => {
  const executionDef = getExecutionDef();

  test('catalog entry exists with correct id, type, and cost', () => {
    expect(executionDef).toBeTruthy();
    expect(executionDef.id).toBe('execution_01');
    expect(executionDef.type).toBe('EXECUTION_WILL');
    expect(Number(executionDef.cost)).toBe(2);
  });

  test('getExecutionWillTargetCount counts only destroyed own stones from the prior opponent turn', () => {
    const cardState = CardLogic.createCardState(createPrng([0]));
    cardState.prevOpponentTurnDestroyedStonesByPlayer = {
      black: [
        { row: 1, col: 1, owner: 'black', wasSpecial: false },
        { row: 2, col: 2, owner: 'white', wasSpecial: true },
        { row: 3, col: 3, owner: 'black', wasSpecial: true }
      ],
      white: [
        { row: 4, col: 4, owner: 'white', wasSpecial: false }
      ]
    };

    expect(CardLogic.getExecutionWillTargetCount(cardState, 'black')).toBe(2);
    expect(CardLogic.getExecutionWillTargetCount(cardState, 'white')).toBe(1);
  });

  test('getUsableCardIds requires prior destroyed own stones and opponent hand', () => {
    const prng = createPrng([0]);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createGameState();
    cardState.hands.black = [executionDef.id];
    cardState.charge.black = 99;
    cardState.hands.white = ['w1', 'w2'];

    cardState.prevOpponentTurnDestroyedStonesByPlayer = {
      black: [{ row: 1, col: 1, owner: 'white', wasSpecial: false }],
      white: []
    };
    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toEqual([]);

    cardState.prevOpponentTurnDestroyedStonesByPlayer = {
      black: [{ row: 1, col: 1, owner: 'black', wasSpecial: false }],
      white: []
    };
    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toContain(executionDef.id);

    cardState.hands.white = [];
    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toEqual([]);
  });

  test('applyExecutionWill destroys up to 3 random opponent hand cards deterministically', () => {
    const prng = createPrng([0.2, 0.5, 0.9]);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createGameState();
    cardState.debugNoDraw = true;
    cardState.hands.black = [executionDef.id];
    cardState.hands.white = ['w1', 'w2', 'w3', 'w4'];
    cardState.charge.black = 99;
    cardState.prevOpponentTurnDestroyedStonesByPlayer = {
      black: [{ row: 2, col: 2, owner: 'black', wasSpecial: false }],
      white: []
    };

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', executionDef.id)).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toMatchObject({ type: 'EXECUTION_WILL', stage: null });

    const result = CardLogic.applyExecutionWill(cardState, 'black', prng);
    expect(result).toMatchObject({
      applied: true,
      opponentKey: 'white',
      requestedCount: 3,
      destroyedCount: 3,
      destroyedCardIds: ['w1', 'w3', 'w4']
    });
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(cardState.hands.white).toEqual(['w2']);
    expect(cardState.discard).toEqual(expect.arrayContaining([executionDef.id, 'w1', 'w3', 'w4']));
  });

  test('turn pipeline resolves execution will immediately and emits HAND_REMOVE for the victim hand', () => {
    const prng = createPrng([0.2, 0.5, 0.9]);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createGameState();
    cardState.debugNoDraw = true;
    cardState.hands.black = [executionDef.id];
    cardState.hands.white = ['w1', 'w2', 'w3', 'w4'];
    cardState.charge.black = 99;
    cardState.prevOpponentTurnDestroyedStonesByPlayer = {
      black: [{ row: 3, col: 3, owner: 'black', wasSpecial: false }],
      white: []
    };

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: executionDef.id, useCardOwnerKey: 'black' },
      prng,
      { skipTurnStart: true }
    );

    expect(result.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'execution_will_resolved',
        player: 'black',
        opponent: 'white',
        destroyedCount: 3,
        destroyedCardIds: ['w1', 'w3', 'w4']
      })
    ]));
    expect(result.presentationEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'HAND_REMOVE',
        player: 'white',
        count: 3,
        reason: 'execution_will',
        cardIds: ['w1', 'w3', 'w4']
      })
    ]));
    expect(result.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(result.cardState.hands.white).toEqual(['w2']);
    expect(result.gameState.currentPlayer).toBe(Shared.BLACK);
  });

  test('destroys only the available number of opponent hand cards when fewer than 3 exist', () => {
    const prng = createPrng([0.8, 0.1]);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createGameState();
    cardState.debugNoDraw = true;
    cardState.hands.black = [executionDef.id];
    cardState.hands.white = ['w1', 'w2'];
    cardState.charge.black = 99;
    cardState.prevOpponentTurnDestroyedStonesByPlayer = {
      black: [{ row: 4, col: 4, owner: 'black', wasSpecial: true }],
      white: []
    };

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: executionDef.id, useCardOwnerKey: 'black' },
      prng,
      { skipTurnStart: true }
    );

    const resolved = result.events.find((event: any) => event && event.type === 'execution_will_resolved');
    expect(resolved).toMatchObject({ requestedCount: 2, destroyedCount: 2 });
    expect(result.cardState.hands.white).toEqual([]);
  });
});

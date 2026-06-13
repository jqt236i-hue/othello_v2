import * as SharedConstants from '../shared-constants.js';
const Core = require('../game/logic/core.js');
const CardLogic = require('../game/logic/cards.js');
const BoardOps = require('../game/logic/board_ops.js');
const TurnPipeline = require('../game/turn/turn_pipeline.js');
const TurnPipelinePhases = require('../game/turn/turn_pipeline_phases.js');
const CORE_API = { BLACK: SharedConstants.BLACK, WHITE: SharedConstants.WHITE };

function createPrng(randomValue = 0) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

function createEmptyGameState() {
  const gameState = Core.createGameState();
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
  gameState.currentPlayer = Core.BLACK;
  gameState.turnNumber = 1;
  gameState.consecutivePasses = 0;
  return gameState;
}

function getCardDef(type) {
  return (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === type);
}

function getSpecialStoneBubbles(presentationEvents) {
  return (presentationEvents || []).filter((event) => event && event.type === 'SPECIAL_STONE_BUBBLE');
}

describe('special stone speech rollout', () => {
  test('ghost placement emits a generic place speech bubble', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    const def = getCardDef('GHOST_WILL');

    cardState.debugNoDraw = true;
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    gameState.board[2][4] = Core.WHITE;
    gameState.board[2][5] = Core.BLACK;
    gameState.board[2][6] = Core.WHITE;

    TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: def.id, useCardOwnerKey: 'black' },
      prng,
      { skipTurnStart: true }
    );

    const placeRes = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3 },
      prng,
      { skipTurnStart: true }
    );

    expect(getSpecialStoneBubbles(placeRes.presentationEvents)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        special: 'GHOST',
        scenario: 'place',
        row: 2,
        col: 3
      })
    ]));
  });

  test('ghost-protected flip emits a ghost_protected speech bubble', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    gameState.currentPlayer = Core.WHITE;

    gameState.board[2][3] = Core.BLACK;
    gameState.board[2][4] = Core.BLACK;
    gameState.board[2][5] = Core.BLACK;
    gameState.board[2][6] = Core.WHITE;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 2,
      col: 3,
      owner: 'black',
      data: { type: 'GHOST', remainingOwnerTurns: 5 }
    });

    const res = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'white',
      { type: 'place', row: 2, col: 2 },
      prng,
      { skipTurnStart: true }
    );

    expect(getSpecialStoneBubbles(res.presentationEvents)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        special: 'GHOST',
        scenario: 'ghost_protected',
        row: 2,
        col: 3
      })
    ]));
  });

  test('time stop activation emits a time_stop_triggered speech bubble', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    const events = [];

    cardState.debugNoDraw = true;
    gameState.board[3][3] = Core.BLACK;
    cardState.markers.push({
      id: 9101,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'TIME_STOP', remainingOwnerTurns: 1 }
    });

    TurnPipelinePhases.applyTurnStartPhase(CardLogic, CORE_API, cardState, gameState, 'black', events, prng);

    expect(getSpecialStoneBubbles(CardLogic.flushPresentationEvents(cardState))).toEqual(expect.arrayContaining([
      expect.objectContaining({
        special: 'TIME_STOP',
        scenario: 'time_stop_triggered',
        row: 3,
        col: 3
      })
    ]));
  });

  test('regen revival emits regen_triggered without an extra destroy bubble', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    gameState.currentPlayer = Core.WHITE;

    gameState.board[2][3] = Core.BLACK;
    gameState.board[2][4] = Core.BLACK;
    gameState.board[2][5] = Core.BLACK;
    gameState.board[2][6] = Core.WHITE;
    cardState.markers.push({
      id: 41,
      kind: 'specialStone',
      row: 2,
      col: 3,
      owner: 'black',
      data: { type: 'REGEN', remainingOwnerTurns: 3, regenRemaining: 1 }
    });

    const res = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'white',
      { type: 'place', row: 2, col: 2 },
      prng,
      { skipTurnStart: true }
    );

    const regenBubbles = getSpecialStoneBubbles(res.presentationEvents).filter((event) => (
      event.special === 'REGEN' &&
      event.row === 2 &&
      event.col === 3
    ));

    expect(regenBubbles).toEqual(expect.arrayContaining([
      expect.objectContaining({
        special: 'REGEN',
        scenario: 'regen_triggered',
        row: 2,
        col: 3
      })
    ]));
    expect(regenBubbles.some((event) => event.scenario === 'destroy' || event.scenario === 'duration_end')).toBe(false);
  });

  test.each([
    ['STONE_SALVATION_GOD', 'STONE_SALVATION_GOD'],
    ['METEOR_GOD', 'METEOR_GOD'],
    ['AFTERIMAGE_WILL', 'AFTERIMAGE_WILL'],
    ['PERMA_PROTECT_NEXT_STONE', 'PERMA_PROTECTED']
  ])('%s placement emits a generic place speech bubble', (cardType, specialType) => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    const def = getCardDef(cardType);

    cardState.debugNoDraw = true;
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    gameState.board[2][4] = Core.WHITE;
    gameState.board[2][5] = Core.BLACK;
    gameState.board[2][6] = Core.WHITE;

    TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: def.id, useCardOwnerKey: 'black' },
      prng,
      { skipTurnStart: true }
    );

    const placeRes = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3 },
      prng,
      { skipTurnStart: true }
    );

    expect(getSpecialStoneBubbles(placeRes.presentationEvents)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        special: specialType,
        scenario: 'place',
        row: 2,
        col: 3
      })
    ]));
  });
});


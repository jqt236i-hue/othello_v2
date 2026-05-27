import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as SubPlacementContinuation from '../game/turn/sub-placement-continuation.js';

const PRNG = { shuffle: (arr) => arr, random: () => 0.5 };

function makeInitialState() {
  const cardState = CardLogic.createCardState(PRNG);
  cardState.debugNoDraw = true;
  const gameState = {
    board: Array(8).fill(null).map(() => Array(8).fill(0)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  gameState.board[3][3] = Shared.WHITE;
  gameState.board[3][4] = Shared.BLACK;
  gameState.board[4][3] = Shared.BLACK;
  gameState.board[4][4] = Shared.WHITE;
  return { cardState, gameState };
}

function makeChainBoardState(rowCount) {
  const cardState = CardLogic.createCardState(PRNG);
  cardState.debugNoDraw = true;
  const gameState = {
    board: Array(8).fill(null).map(() => Array(8).fill(0)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  for (let row = 1; row <= rowCount; row += 1) {
    gameState.board[row][0] = Shared.BLACK;
    for (let col = 1; col <= 5; col += 1) {
      gameState.board[row][col] = Shared.WHITE;
    }
  }
  return { cardState, gameState };
}

describe('throw-chain turn transition in TurnPipeline', () => {
  test('sub-placement helper detects pending and active throw-chain turns', () => {
    const { cardState } = makeInitialState();
    expect(SubPlacementContinuation.isSubPlacementContinuationActive(cardState, 'black')).toBe(false);
    expect(SubPlacementContinuation.isSubPlacementTurnActive(cardState, 'black')).toBe(false);

    cardState.pendingEffectByPlayer.black = { type: 'DOUBLE_PLACE', stage: 'awaitPlace' };
    expect(SubPlacementContinuation.isSubPlacementContinuationActive(cardState, 'black')).toBe(false);
    expect(SubPlacementContinuation.isSubPlacementTurnActive(cardState, 'black')).toBe(true);

    cardState.extraPlaceRemainingByPlayer.black = 1;
    expect(SubPlacementContinuation.isSubPlacementContinuationActive(cardState, 'black')).toBe(true);
    expect(SubPlacementContinuation.isSubPlacementTurnActive(cardState, 'black')).toBe(true);
  });

  test('using DOUBLE_PLACE immediately adds TRIPLE_PLACE to hand and emits HAND_ADD', () => {
    const { cardState } = makeInitialState();
    cardState.charge.black = 30;
    cardState.hands.black = ['double_01'];

    const used = CardLogic.applyCardUsage(cardState, 'black', 'double_01');
    expect(used).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toMatchObject({ type: 'DOUBLE_PLACE' });
    expect(cardState.hands.black).toEqual(['triple_01']);

    const pres = CardLogic.flushPresentationEvents(cardState);
    expect(pres.map((ev) => ev.type)).toEqual(['CARD_USED', 'HAND_ADD']);
    expect(pres[1]).toMatchObject({
      type: 'HAND_ADD',
      player: 'black',
      cardId: 'triple_01',
      reason: 'generated_throw_chain'
    });
  });

  test('DOUBLE_PLACE keeps turn for the second placement then passes turn', () => {
    const { cardState, gameState } = makeChainBoardState(2);
    cardState.pendingEffectByPlayer.black = { type: 'DOUBLE_PLACE', stage: 'awaitPlace' };

    const res1 = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 1, col: 6 },
      PRNG,
      { skipTurnStart: true }
    );
    expect(res1.cardState.extraPlaceRemainingByPlayer.black).toBe(1);
    expect(res1.cardState.multiPlaceSourceTypeByPlayer.black).toBe('DOUBLE_PLACE');
    expect(res1.gameState.currentPlayer).toBe(Shared.BLACK);
    expect(res1.gameState.turnNumber).toBe(1);

    const res2 = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 6 },
      PRNG,
      { skipTurnStart: true }
    );
    expect(res2.cardState.extraPlaceRemainingByPlayer.black).toBe(0);
    expect(res2.cardState.multiPlaceSourceTypeByPlayer.black).toBeNull();
    expect(res2.gameState.currentPlayer).toBe(Shared.WHITE);
    expect(res2.gameState.turnNumber).toBe(2);
  });

  test('DOUBLE_PLACE sub-placements do not rerun turn start or reset card use when caller omits skipTurnStart', () => {
    const { cardState, gameState } = makeChainBoardState(2);
    cardState.debugNoDraw = false;
    cardState.turnIndex = 9;
    cardState.turnCountByPlayer.black = 4;
    cardState.pendingEffectByPlayer.black = { type: 'DOUBLE_PLACE', stage: 'awaitPlace' };
    cardState.hasUsedCardThisTurnByPlayer.black = true;
    cardState.hands.black = ['perma_01'];
    cardState.decks.black = ['draw_should_not_happen'];
    cardState.charge.black = 99;

    const res1 = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 1, col: 6 },
      PRNG
    );

    expect(res1.cardState.turnIndex).toBe(9);
    expect(res1.cardState.turnCountByPlayer.black).toBe(4);
    expect(res1.cardState.hands.black).toEqual(['perma_01']);
    expect(res1.cardState.decks.black).toEqual(['draw_should_not_happen']);
    expect(res1.cardState.hasUsedCardThisTurnByPlayer.black).toBe(true);
    expect(res1.cardState.extraPlaceRemainingByPlayer.black).toBe(1);
    expect(res1.gameState.currentPlayer).toBe(Shared.BLACK);

    const rejectedCardUse = TurnPipeline.applyTurnSafe(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: 'perma_01', useCardOwnerKey: 'black' },
      PRNG
    );
    expect(rejectedCardUse.ok).toBe(false);
    expect(rejectedCardUse.rejectedReason).toBe('CARD_USE_FAILED');

    const res2 = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 6 },
      PRNG
    );

    expect(res2.cardState.turnIndex).toBe(9);
    expect(res2.cardState.turnCountByPlayer.black).toBe(4);
    expect(res2.cardState.hands.black).toEqual(['perma_01']);
    expect(res2.cardState.decks.black).toEqual(['draw_should_not_happen']);
    expect(res2.cardState.extraPlaceRemainingByPlayer.black).toBe(0);
    expect(res2.gameState.currentPlayer).toBe(Shared.WHITE);
  });

  test('TRIPLE_PLACE keeps turn until the third placement then passes turn', () => {
    const { cardState, gameState } = makeChainBoardState(3);
    cardState.pendingEffectByPlayer.black = { type: 'TRIPLE_PLACE', stage: 'awaitPlace' };

    const res1 = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 1, col: 6 },
      PRNG,
      { skipTurnStart: true }
    );
    expect(res1.cardState.extraPlaceRemainingByPlayer.black).toBe(2);
    expect(res1.gameState.currentPlayer).toBe(Shared.BLACK);
    expect(res1.gameState.turnNumber).toBe(1);

    const res2 = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 6 },
      PRNG,
      { skipTurnStart: true }
    );
    expect(res2.cardState.extraPlaceRemainingByPlayer.black).toBe(1);
    expect(res2.gameState.currentPlayer).toBe(Shared.BLACK);
    expect(res2.gameState.turnNumber).toBe(1);
    expect(res2.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'extra_place_consumed', sourceType: 'TRIPLE_PLACE', remaining: 1 })
    ]));

    const res3 = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 3, col: 6 },
      PRNG,
      { skipTurnStart: true }
    );
    expect(res3.cardState.extraPlaceRemainingByPlayer.black).toBe(0);
    expect(res3.cardState.multiPlaceSourceTypeByPlayer.black).toBeNull();
    expect(res3.gameState.currentPlayer).toBe(Shared.WHITE);
    expect(res3.gameState.turnNumber).toBe(2);
  });

  test('INFINITE_PLACE ends immediately when no follow-up legal move remains', () => {
    const cardState = CardLogic.createCardState(PRNG);
    cardState.debugNoDraw = true;
    const gameState = {
      board: Array(8).fill(null).map(() => Array(8).fill(Shared.BLACK)),
      currentPlayer: Shared.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };
    gameState.board[3][3] = Shared.WHITE;
    gameState.board[3][4] = Shared.EMPTY;

    cardState.pendingEffectByPlayer.black = { type: 'INFINITE_PLACE', stage: 'awaitPlace' };

    cardState.debugNoDraw = false;
    cardState.turnIndex = 5;
    cardState.turnCountByPlayer.black = 2;
    cardState.decks.black = ['draw_should_not_happen'];

    const res = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 3, col: 4 },
      PRNG
    );

    expect(res.cardState.turnIndex).toBe(5);
    expect(res.cardState.turnCountByPlayer.black).toBe(2);
    expect(res.cardState.decks.black).toEqual(['draw_should_not_happen']);
    expect(res.cardState.infinitePlaceActiveByPlayer.black).toBe(false);
    expect(res.cardState.multiPlaceSourceTypeByPlayer.black).toBeNull();
    expect(res.gameState.currentPlayer).toBe(Shared.WHITE);
    expect(res.gameState.turnNumber).toBe(2);
  });
});

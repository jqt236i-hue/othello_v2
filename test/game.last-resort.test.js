const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');

function createPrng() {
  return {
    shuffle: (arr) => arr,
    random: () => 0.5
  };
}

function createInitialGameState() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY));
  board[3][3] = Shared.WHITE;
  board[3][4] = Shared.BLACK;
  board[4][3] = Shared.BLACK;
  board[4][4] = Shared.WHITE;
  return {
    board,
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
}

function createSparseNoLegalMoveGameState(blackPositions, whitePositions) {
  const board = Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY));
  for (const [row, col] of blackPositions || []) board[row][col] = Shared.BLACK;
  for (const [row, col] of whitePositions || []) board[row][col] = Shared.WHITE;
  return {
    board,
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
}

function createBehindNoLegalMoveGameState() {
  return createSparseNoLegalMoveGameState(
    [[7, 7]],
    [[0, 0], [0, 1], [1, 0], [1, 1]]
  );
}

function createTieNoLegalMoveGameState() {
  return createSparseNoLegalMoveGameState(
    [[7, 4], [7, 5], [7, 6], [7, 7]],
    [[0, 0], [0, 1], [0, 2], [0, 3]]
  );
}

function createAheadNoLegalMoveGameState() {
  return createSparseNoLegalMoveGameState(
    [[7, 4], [7, 5], [7, 6], [7, 7]],
    [[0, 0]]
  );
}

describe('LAST_RESORT（最後の切り札）', () => {
  test('通常合法手があると getUsableCardIds に出ない', () => {
    const def = (Shared.CARD_DEFS || []).find((card) => card && card.type === 'LAST_RESORT');
    expect(def).toBeTruthy();

    const prng = createPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = createInitialGameState();

    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    const usable = CardLogic.getUsableCardIds(cardState, gameState, 'black');
    expect(usable).toEqual([]);
  });

  test('合法手0でも石数が互角以上なら getUsableCardIds に出ない', () => {
    const def = (Shared.CARD_DEFS || []).find((card) => card && card.type === 'LAST_RESORT');
    expect(def).toBeTruthy();

    const prng = createPrng();
    const cardState = CardLogic.createCardState(prng);
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    expect(CardLogic.getUsableCardIds(cardState, createTieNoLegalMoveGameState(), 'black')).toEqual([]);
    expect(CardLogic.getUsableCardIds(cardState, createAheadNoLegalMoveGameState(), 'black')).toEqual([]);
  });

  test('applyCardUsage は通常合法手がある時と石数が互角以上の時は失敗し、石数劣勢かつ合法手0で成功する', () => {
    const def = (Shared.CARD_DEFS || []).find((card) => card && card.type === 'LAST_RESORT');
    expect(def).toBeTruthy();

    const prngA = createPrng();
    const cardStateA = CardLogic.createCardState(prngA);
    const gameStateA = createInitialGameState();
    cardStateA.hands.black = [def.id];
    cardStateA.charge.black = def.cost;

    const fail = CardLogic.applyCardUsage(cardStateA, gameStateA, 'black', def.id);
    expect(fail).toBe(false);

    const prngB = createPrng();
    const cardStateB = CardLogic.createCardState(prngB);
    const gameStateB = createTieNoLegalMoveGameState();
    cardStateB.hands.black = [def.id];
    cardStateB.charge.black = def.cost;

    const tieFail = CardLogic.applyCardUsage(cardStateB, gameStateB, 'black', def.id);
    expect(tieFail).toBe(false);

    const prngC = createPrng();
    const cardStateC = CardLogic.createCardState(prngC);
    const gameStateC = createAheadNoLegalMoveGameState();
    cardStateC.hands.black = [def.id];
    cardStateC.charge.black = def.cost;

    const aheadFail = CardLogic.applyCardUsage(cardStateC, gameStateC, 'black', def.id);
    expect(aheadFail).toBe(false);

    const prngD = createPrng();
    const cardStateD = CardLogic.createCardState(prngD);
    const gameStateD = createBehindNoLegalMoveGameState();
    cardStateD.hands.black = [def.id];
    cardStateD.charge.black = def.cost;

    const ok = CardLogic.applyCardUsage(cardStateD, gameStateD, 'black', def.id);
    expect(ok).toBe(true);
    expect(cardStateD.pendingEffectByPlayer.black).toBeTruthy();
    expect(cardStateD.pendingEffectByPlayer.black.type).toBe('LAST_RESORT');
    expect(cardStateD.pendingEffectByPlayer.black.placementsRemaining).toBe(3);
  });

  test('use後は自由配置を3回だけ行い、3回目後に手番が交代する', () => {
    const def = (Shared.CARD_DEFS || []).find((card) => card && card.type === 'LAST_RESORT');
    expect(def).toBeTruthy();

    const prng = createPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = createBehindNoLegalMoveGameState();

    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    const usable = CardLogic.getUsableCardIds(cardState, gameState, 'black');
    expect(usable).toEqual([def.id]);

    const useRes = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: def.id },
      prng
    );

    expect(useRes.cardState.pendingEffectByPlayer.black).toBeTruthy();
    expect(useRes.cardState.pendingEffectByPlayer.black.type).toBe('LAST_RESORT');
    expect(useRes.cardState.pendingEffectByPlayer.black.placementsRemaining).toBe(3);

    const firstPlaceRes = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 3, col: 3 },
      prng
    );

    expect(firstPlaceRes.gameState.currentPlayer).toBe(Shared.BLACK);
    expect(firstPlaceRes.gameState.turnNumber).toBe(1);
    expect(firstPlaceRes.cardState.pendingEffectByPlayer.black).toBeTruthy();
    expect(firstPlaceRes.cardState.pendingEffectByPlayer.black.type).toBe('LAST_RESORT');
    expect(firstPlaceRes.cardState.pendingEffectByPlayer.black.placementsRemaining).toBe(2);
    expect(firstPlaceRes.cardState.extraPlaceRemainingByPlayer.black).toBe(1);
    expect(firstPlaceRes.gameState.board[3][3]).toBe(Shared.BLACK);

    const secondPlaceRes = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 3, col: 4 },
      prng
    );

    expect(secondPlaceRes.gameState.currentPlayer).toBe(Shared.BLACK);
    expect(secondPlaceRes.gameState.turnNumber).toBe(1);
    expect(secondPlaceRes.cardState.pendingEffectByPlayer.black).toBeTruthy();
    expect(secondPlaceRes.cardState.pendingEffectByPlayer.black.type).toBe('LAST_RESORT');
    expect(secondPlaceRes.cardState.pendingEffectByPlayer.black.placementsRemaining).toBe(1);
    expect(secondPlaceRes.cardState.extraPlaceRemainingByPlayer.black).toBe(1);
    expect(secondPlaceRes.gameState.board[3][4]).toBe(Shared.BLACK);

    const thirdPlaceRes = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 3, col: 5 },
      prng
    );

    expect(thirdPlaceRes.gameState.currentPlayer).toBe(Shared.WHITE);
    expect(thirdPlaceRes.gameState.turnNumber).toBe(2);
    expect(thirdPlaceRes.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(thirdPlaceRes.cardState.extraPlaceRemainingByPlayer.black).toBe(0);
    expect(thirdPlaceRes.gameState.board[3][5]).toBe(Shared.BLACK);
  });
});

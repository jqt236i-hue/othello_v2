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

function createNoLegalMoveGameState() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(Shared.WHITE));
  board[0][0] = Shared.EMPTY;
  board[0][1] = Shared.EMPTY;
  return {
    board,
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
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

  test('applyCardUsage は通常合法手があると失敗し、合法手0なら成功する', () => {
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
    const gameStateB = createNoLegalMoveGameState();
    cardStateB.hands.black = [def.id];
    cardStateB.charge.black = def.cost;

    const ok = CardLogic.applyCardUsage(cardStateB, gameStateB, 'black', def.id);
    expect(ok).toBe(true);
    expect(cardStateB.pendingEffectByPlayer.black).toBeTruthy();
    expect(cardStateB.pendingEffectByPlayer.black.type).toBe('LAST_RESORT');
    expect(cardStateB.pendingEffectByPlayer.black.placementsRemaining).toBe(2);
  });

  test('use後は自由配置を2回だけ行い、2回目後に手番が交代する', () => {
    const def = (Shared.CARD_DEFS || []).find((card) => card && card.type === 'LAST_RESORT');
    expect(def).toBeTruthy();

    const prng = createPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = createNoLegalMoveGameState();

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
    expect(useRes.cardState.pendingEffectByPlayer.black.placementsRemaining).toBe(2);

    const firstPlaceRes = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 0, col: 0 },
      prng
    );

    expect(firstPlaceRes.gameState.currentPlayer).toBe(Shared.BLACK);
    expect(firstPlaceRes.gameState.turnNumber).toBe(1);
    expect(firstPlaceRes.cardState.pendingEffectByPlayer.black).toBeTruthy();
    expect(firstPlaceRes.cardState.pendingEffectByPlayer.black.type).toBe('LAST_RESORT');
    expect(firstPlaceRes.cardState.pendingEffectByPlayer.black.placementsRemaining).toBe(1);
    expect(firstPlaceRes.cardState.extraPlaceRemainingByPlayer.black).toBe(1);
    expect(firstPlaceRes.gameState.board[0][0]).toBe(Shared.BLACK);

    const secondPlaceRes = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 0, col: 1 },
      prng
    );

    expect(secondPlaceRes.gameState.currentPlayer).toBe(Shared.WHITE);
    expect(secondPlaceRes.gameState.turnNumber).toBe(2);
    expect(secondPlaceRes.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(secondPlaceRes.cardState.extraPlaceRemainingByPlayer.black).toBe(0);
    expect(secondPlaceRes.gameState.board[0][1]).toBe(Shared.BLACK);
  });
});

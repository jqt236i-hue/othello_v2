import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import * as SharedConstants from '../shared-constants.js';

function createPrng(randomValue = 0.5) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

describe('BLOCKADE_WILL（封鎖の意志）', () => {
  test('カード使用で空きマスを3ターン封鎖し、合法手・自由配置から除外する', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'BLOCKADE_WILL');
    expect(def).toBeTruthy();

    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.currentPlayer = Core.BLACK;
    gameState.board[3][1] = Core.WHITE;
    gameState.board[3][2] = Core.BLACK;

    cardState.charge.black = 30;
    cardState.hands.black = [def.id];

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(used).toBe(true);
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('BLOCKADE_WILL');

    const selected = CardLogic.applyBlockadeWill(cardState, gameState, 'black', 3, 0);
    expect(selected && selected.applied).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(CardLogic.isBlockedCell(cardState, 3, 0, gameState)).toBe(true);

    const context = CardLogic.getCardContext(cardState);
    const legalMoves = Core.getLegalMoves(gameState, Core.BLACK, context);
    expect(legalMoves.some((m) => m.row === 3 && m.col === 0)).toBe(false);

    const freeBlack = Core.getFreePlacementMoves(gameState, Core.BLACK, context);
    const freeWhite = Core.getFreePlacementMoves(gameState, Core.WHITE, context);
    expect(freeBlack.some((m) => m.row === 3 && m.col === 0)).toBe(false);
    expect(freeWhite.some((m) => m.row === 3 && m.col === 0)).toBe(false);
  });

  test('封鎖マスは所有者のターン開始時のみ減算され、3回目の自ターン開始で解除される', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    cardState.pendingEffectByPlayer.black = {
      type: 'BLOCKADE_WILL',
      stage: 'selectTarget',
      cardId: 'blockade_01'
    };

    const selected = CardLogic.applyBlockadeWill(cardState, gameState, 'black', 0, 0);
    expect(selected && selected.applied).toBe(true);

    const getMarker = () => (cardState.markers || []).find((m) => m && m.data && m.data.type === 'BLOCKADE' && m.row === 0 && m.col === 0);

    expect(getMarker()).toBeTruthy();
    expect(getMarker().data.remainingOwnerTurns).toBe(3);

    CardLogic.onTurnStart(cardState, 'black', gameState, createPrng());
    expect(getMarker()).toBeTruthy();
    expect(getMarker().data.remainingOwnerTurns).toBe(2);

    CardLogic.onTurnStart(cardState, 'white', gameState, createPrng());
    expect(getMarker()).toBeTruthy();
    expect(getMarker().data.remainingOwnerTurns).toBe(2);

    CardLogic.onTurnStart(cardState, 'black', gameState, createPrng());
    expect(getMarker()).toBeTruthy();
    expect(getMarker().data.remainingOwnerTurns).toBe(1);

    CardLogic.onTurnStart(cardState, 'black', gameState, createPrng());
    expect(getMarker()).toBeFalsy();
  });

  test('強風は封鎖マスへ移動できない', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1
    };

    gameState.board[3][3] = 1;
    gameState.board[2][3] = -1;
    gameState.board[4][3] = -1;
    gameState.board[3][2] = -1;
    gameState.board[3][6] = -1;

    cardState.pendingEffectByPlayer.black = { type: 'STRONG_WIND_WILL', stage: 'selectTarget', cardId: 'strong_wind_01' };
    cardState.markers.push({
      id: 'bk1',
      kind: 'specialStone',
      row: 3,
      col: 5,
      owner: 'black',
      data: { type: 'BLOCKADE', remainingOwnerTurns: 3 }
    });

    const res = CardLogic.applyStrongWindWill(cardState, gameState, 'black', 3, 3, { random: () => 0.5 });
    expect(res && res.applied).toBe(true);
    expect(res.to).toEqual({ row: 3, col: 4 });
  });

  test('多動石は封鎖マスへ移動できない', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1
    };

    gameState.board[4][4] = 1;
    gameState.board[3][3] = -1;
    gameState.board[3][4] = -1;
    gameState.board[3][5] = -1;
    gameState.board[4][3] = -1;
    gameState.board[5][3] = -1;
    gameState.board[5][4] = -1;

    cardState.markers.push({
      id: 'ha1',
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'HYPERACTIVE', remainingOwnerTurns: 5 }
    });
    cardState.markers.push({
      id: 'bk2',
      kind: 'specialStone',
      row: 4,
      col: 5,
      owner: 'black',
      data: { type: 'BLOCKADE', remainingOwnerTurns: 3 }
    });

    const res = CardLogic.processHyperactiveMoveAtAnchor(cardState, gameState, 'black', 4, 4, { random: () => 0 });
    expect(res && res.moved && res.moved.length).toBe(1);
    expect(res.moved[0].to).toEqual({ row: 5, col: 5 });
    expect(gameState.board[4][5]).toBe(0);
    expect(gameState.board[5][5]).toBe(1);
  });
});

import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import * as BoardOps from '../game/logic/board_ops.js';
import * as SharedConstants from '../shared-constants.js';

function createPrng(randomValue = 0.5) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

describe('FREEZE_WILL（凍結の意志）', () => {
  test('カード使用で占有マスを凍結し、その石は反転も破壊もされない', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'FREEZE_WILL');
    expect(def).toBeTruthy();

    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.currentPlayer = Core.BLACK;
    gameState.board[3][2] = Core.BLACK;
    gameState.board[3][3] = Core.WHITE;

    cardState.charge.black = 99;
    cardState.hands.black = [def.id];

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(used).toBe(true);
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('FREEZE_WILL');

    const res = CardLogic.applyFreezeWill(cardState, gameState, 'black', 3, 3);
    expect(res && res.applied).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    const freezeMarker = (cardState.markers || []).find((m) => (
      m &&
      m.kind === 'specialStone' &&
      m.row === 3 &&
      m.col === 3 &&
      m.data &&
      m.data.type === 'FREEZE'
    ));
    expect(freezeMarker).toBeTruthy();
    expect(freezeMarker.data.remainingOwnerTurns).toBe(5);

    const context = CardLogic.getCardContext(cardState);
    const flips = Core.getFlipsWithContext(gameState, 3, 4, Core.BLACK, context);
    expect(flips).toEqual([]);

    const destroyed = BoardOps.destroyAt(cardState, gameState, 3, 3, 'SYSTEM', 'test_freeze');
    expect(destroyed).toEqual({ destroyed: false, reason: 'frozen_protected' });
    expect(gameState.board[3][3]).toBe(Core.WHITE);
  });

  test('ignoreFrozen 指定時だけ凍結マスの石を破壊できる', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.board[3][3] = Core.WHITE;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'white',
      data: { type: 'FREEZE', remainingOwnerTurns: 5 }
    });

    expect(BoardOps.destroyAt(cardState, gameState, 3, 3, 'SYSTEM', 'test_freeze')).toEqual({
      destroyed: false,
      reason: 'frozen_protected'
    });

    const forced = BoardOps.destroyAt(cardState, gameState, 3, 3, 'SYSTEM', 'test_freeze_ignore', { ignoreFrozen: true });
    expect(forced).toMatchObject({ destroyed: true });
    expect(gameState.board[3][3]).toBe(Core.EMPTY);
  });

  test('凍結した空きマスは合法手と自由配置から除外される', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.currentPlayer = Core.BLACK;
    gameState.board[3][1] = Core.WHITE;
    gameState.board[3][2] = Core.BLACK;

    cardState.pendingEffectByPlayer.black = {
      type: 'FREEZE_WILL',
      stage: 'selectTarget',
      cardId: 'freeze_01'
    };

    const selected = CardLogic.applyFreezeWill(cardState, gameState, 'black', 3, 0);
    expect(selected && selected.applied).toBe(true);

    const context = CardLogic.getCardContext(cardState);
    const legalMoves = Core.getLegalMoves(gameState, Core.BLACK, context);
    const freeBlack = Core.getFreePlacementMoves(gameState, Core.BLACK, context);
    const freeWhite = Core.getFreePlacementMoves(gameState, Core.WHITE, context);

    expect(legalMoves.some((m) => m.row === 3 && m.col === 0)).toBe(false);
    expect(freeBlack.some((m) => m.row === 3 && m.col === 0)).toBe(false);
    expect(freeWhite.some((m) => m.row === 3 && m.col === 0)).toBe(false);
  });

  test('凍結した自分石は反転の支点に使えず合法手にもならない', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.currentPlayer = Core.BLACK;
    gameState.board[3][1] = Core.WHITE;
    gameState.board[3][2] = Core.BLACK;

    cardState.pendingEffectByPlayer.black = {
      type: 'FREEZE_WILL',
      stage: 'selectTarget',
      cardId: 'freeze_01'
    };

    const selected = CardLogic.applyFreezeWill(cardState, gameState, 'black', 3, 2);
    expect(selected && selected.applied).toBe(true);

    const context = CardLogic.getCardContext(cardState);
    const flips = Core.getFlipsWithContext(gameState, 3, 0, Core.BLACK, context);
    const legalMoves = Core.getLegalMoves(gameState, Core.BLACK, context);

    expect(flips).toEqual([]);
    expect(legalMoves.some((m) => m.row === 3 && m.col === 0)).toBe(false);
  });

  test('凍結中の持続ターン付き特殊石は減らず、解凍後に再び減る', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.board[2][2] = Core.BLACK;
    cardState.charge.black = 0;
    cardState.workAnchorPosByPlayer.black = { row: 2, col: 2 };
    cardState.markers.push(
      {
        id: 'work_1',
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'black',
        data: { type: 'WORK', workStage: 0, remainingOwnerTurns: 3, ownerColor: 'black' }
      },
      {
        id: 'freeze_1',
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'black',
        data: { type: 'FREEZE', remainingOwnerTurns: 1 }
      }
    );

    CardLogic.onTurnStart(cardState, 'black', gameState, createPrng());

    let workMarker = cardState.markers.find((m) => m && m.id === 'work_1');
    let freezeMarker = cardState.markers.find((m) => m && m.id === 'freeze_1');
    expect(workMarker).toBeTruthy();
    expect(workMarker.data.remainingOwnerTurns).toBe(3);
    expect(cardState.charge.black).toBe(0);
    expect(freezeMarker).toBeUndefined();

    CardLogic.onTurnStart(cardState, 'black', gameState, createPrng());

    workMarker = cardState.markers.find((m) => m && m.id === 'work_1');
    expect(workMarker).toBeTruthy();
    expect(workMarker.data.remainingOwnerTurns).toBe(2);
    expect(cardState.charge.black).toBe(1);
  });
});

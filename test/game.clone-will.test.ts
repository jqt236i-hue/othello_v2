import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import * as SharedConstants from '../shared-constants.js';

function createPrng(randomValue = 0.5) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

describe('CLONE_WILL（複製の意志）', () => {
  test('カード定義が存在し、コスト16である', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'CLONE_WILL');
    expect(def).toBeTruthy();
    expect(def.cost).toBe(16);
  });

  test('周囲に空きがない石は対象外になる', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.WHITE));

    gameState.board[3][3] = Core.BLACK;
    gameState.board[6][6] = Core.BLACK;
    gameState.board[5][5] = Core.EMPTY;

    const targets = CardLogic.getCloneTargets(cardState, gameState, 'black');
    expect(targets).toEqual([{ row: 6, col: 6 }]);
  });

  test('選択石の周囲空きからランダム1マスへ複製し、生成だけでは反転しない。特殊石は持続値を引き継ぐ', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));

    gameState.board[3][3] = Core.BLACK;
    gameState.board[3][5] = Core.WHITE;
    gameState.board[3][6] = Core.BLACK;

    cardState.markers.push({
      id: 999,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'DRAGON', remainingOwnerTurns: 2 }
    });

    cardState.pendingEffectByPlayer.black = {
      type: 'CLONE_WILL',
      stage: 'selectTarget',
      cardId: 'clone_01'
    };

    const res = CardLogic.applyCloneWill(cardState, gameState, 'black', 3, 3, createPrng(0.5));
    expect(res && res.applied).toBe(true);
    expect(Array.isArray(res.spawned)).toBe(true);
    expect(res.spawned.length).toBe(1);

    expect(res.spawned[0]).toEqual({ row: 3, col: 4 });

    for (const pos of res.spawned) {
      expect(gameState.board[pos.row][pos.col]).toBe(Core.BLACK);
      const copied = (cardState.markers || []).find((m) =>
        m &&
        m.kind === 'specialStone' &&
        m.row === pos.row &&
        m.col === pos.col &&
        m.data &&
        m.data.type === 'DRAGON'
      );
      expect(copied).toBeTruthy();
      expect(copied.data.remainingOwnerTurns).toBe(2);
    }

    expect(gameState.board[3][5]).toBe(Core.WHITE);
    expect(gameState.board[2][2]).toBe(Core.EMPTY);
    expect(gameState.board[2][3]).toBe(Core.EMPTY);
    expect(gameState.board[2][4]).toBe(Core.EMPTY);
    expect(gameState.board[3][2]).toBe(Core.EMPTY);
    expect(gameState.board[4][2]).toBe(Core.EMPTY);
    expect(gameState.board[4][3]).toBe(Core.EMPTY);
    expect(gameState.board[4][4]).toBe(Core.EMPTY);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('expansion stone can be cloned into an adjacent main-board cell', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.WHITE));
    gameState.board[3][0] = Core.EMPTY;
    gameState.boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: Core.EMPTY,
      usedByPlayer: { black: false, white: false },
      cells: [{ side: 'left', row: 3, col: -1, owner: Core.BLACK }]
    };

    cardState.markers.push({
      id: 1001,
      kind: 'specialStone',
      row: 3,
      col: -1,
      owner: 'black',
      data: { type: 'DRAGON', remainingOwnerTurns: 2 }
    });
    cardState.pendingEffectByPlayer.black = {
      type: 'CLONE_WILL',
      stage: 'selectTarget',
      cardId: 'clone_expansion_01'
    };

    const targets = CardLogic.getCloneTargets(cardState, gameState, 'black');
    expect(targets).toEqual(expect.arrayContaining([{ row: 3, col: -1 }]));

    const res = CardLogic.applyCloneWill(cardState, gameState, 'black', 3, -1, createPrng(0));

    expect(res && res.applied).toBe(true);
    expect(res.spawned).toEqual([{ row: 3, col: 0 }]);
    expect(gameState.board[3][0]).toBe(Core.BLACK);
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 3, col: 0, owner: 'black', data: expect.objectContaining({ type: 'DRAGON', remainingOwnerTurns: 2 }) })
    ]));
  });
});

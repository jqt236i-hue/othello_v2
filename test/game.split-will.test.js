const CardLogic = require('../game/logic/cards');
const Core = require('../game/logic/core');
const SharedConstants = require('../shared-constants');

function createPrng(randomValue = 0.5) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

describe('SPLIT_WILL（分裂の意志）', () => {
  test('カード定義が存在し、コスト12である', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'SPLIT_WILL');
    expect(def).toBeTruthy();
    expect(def.cost).toBe(12);
  });

  test('周囲に空きがない石は対象外になる', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.WHITE));

    gameState.board[3][3] = Core.BLACK;
    gameState.board[6][6] = Core.BLACK;
    gameState.board[5][5] = Core.EMPTY;

    const targets = CardLogic.getSplitTargets(cardState, gameState, 'black');
    expect(targets).toEqual([{ row: 6, col: 6 }]);
  });

  test('分裂時に元石と生成石の持続ターンを半減し、生成だけでは反転しない', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));

    gameState.board[3][3] = Core.BLACK;
    gameState.board[3][5] = Core.WHITE;
    gameState.board[3][6] = Core.BLACK;

    cardState.markers.push({
      id: 1999,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'DRAGON', remainingOwnerTurns: 5 }
    });
    cardState.markers.push({
      id: 2000,
      kind: 'bomb',
      row: 3,
      col: 3,
      owner: 'black',
      data: { remainingTurns: 3 }
    });

    cardState.pendingEffectByPlayer.black = {
      type: 'SPLIT_WILL',
      stage: 'selectTarget',
      cardId: 'split_01'
    };

    const res = CardLogic.applySplitWill(cardState, gameState, 'black', 3, 3, createPrng(0.5));
    expect(res && res.applied).toBe(true);
    expect(Array.isArray(res.spawned)).toBe(true);
    expect(res.spawned.length).toBe(1);
    expect(res.spawned[0]).toEqual({ row: 3, col: 4 });

    expect(gameState.board[3][4]).toBe(Core.BLACK);
    expect(gameState.board[3][5]).toBe(Core.WHITE);

    const sourceDragon = (cardState.markers || []).find((marker) => (
      marker &&
      marker.kind === 'specialStone' &&
      marker.row === 3 &&
      marker.col === 3 &&
      marker.data &&
      marker.data.type === 'DRAGON'
    ));
    expect(sourceDragon).toBeTruthy();
    expect(sourceDragon.data.remainingOwnerTurns).toBe(2);

    const spawnedDragon = (cardState.markers || []).find((marker) => (
      marker &&
      marker.kind === 'specialStone' &&
      marker.row === 3 &&
      marker.col === 4 &&
      marker.data &&
      marker.data.type === 'DRAGON'
    ));
    expect(spawnedDragon).toBeTruthy();
    expect(spawnedDragon.data.remainingOwnerTurns).toBe(2);

    const sourceBomb = (cardState.markers || []).find((marker) => (
      marker &&
      marker.kind === 'bomb' &&
      marker.row === 3 &&
      marker.col === 3
    ));
    expect(sourceBomb).toBeTruthy();
    expect(sourceBomb.data.remainingTurns).toBe(1);

    const spawnedBomb = (cardState.markers || []).find((marker) => (
      marker &&
      marker.kind === 'bomb' &&
      marker.row === 3 &&
      marker.col === 4
    ));
    expect(spawnedBomb).toBeTruthy();
    expect(spawnedBomb.data.remainingTurns).toBe(1);

    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('expansion stone can split into an adjacent main-board cell', () => {
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
      id: 2999,
      kind: 'specialStone',
      row: 3,
      col: -1,
      owner: 'black',
      data: { type: 'DRAGON', remainingOwnerTurns: 5 }
    });
    cardState.markers.push({
      id: 3000,
      kind: 'bomb',
      row: 3,
      col: -1,
      owner: 'black',
      data: { remainingTurns: 3 }
    });

    cardState.pendingEffectByPlayer.black = {
      type: 'SPLIT_WILL',
      stage: 'selectTarget',
      cardId: 'split_expansion_01'
    };

    const targets = CardLogic.getSplitTargets(cardState, gameState, 'black');
    expect(targets).toEqual(expect.arrayContaining([{ row: 3, col: -1 }]));

    const res = CardLogic.applySplitWill(cardState, gameState, 'black', 3, -1, createPrng(0));

    expect(res && res.applied).toBe(true);
    expect(res.spawned).toEqual([{ row: 3, col: 0 }]);
    expect(gameState.board[3][0]).toBe(Core.BLACK);

    const sourceDragon = cardState.markers.find((marker) => marker && marker.kind === 'specialStone' && marker.row === 3 && marker.col === -1 && marker.data && marker.data.type === 'DRAGON');
    const spawnedDragon = cardState.markers.find((marker) => marker && marker.kind === 'specialStone' && marker.row === 3 && marker.col === 0 && marker.data && marker.data.type === 'DRAGON');
    const sourceBomb = cardState.markers.find((marker) => marker && marker.kind === 'bomb' && marker.row === 3 && marker.col === -1);
    const spawnedBomb = cardState.markers.find((marker) => marker && marker.kind === 'bomb' && marker.row === 3 && marker.col === 0);

    expect(sourceDragon.data.remainingOwnerTurns).toBe(2);
    expect(spawnedDragon.data.remainingOwnerTurns).toBe(2);
    expect(sourceBomb.data.remainingTurns).toBe(1);
    expect(spawnedBomb.data.remainingTurns).toBe(1);
  });
});
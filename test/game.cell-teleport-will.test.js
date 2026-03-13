const CardLogic = require('../game/logic/cards');
const Core = require('../game/logic/core');
const SharedConstants = require('../shared-constants');

function createPrng(randomValue = 0.5) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

function getAllOuterExpansionCells(owner = Core.EMPTY) {
  const cells = [];
  const seen = new Set();
  const push = (row, col) => {
    const key = `${row},${col}`;
    if (seen.has(key)) return;
    seen.add(key);
    let side = null;
    if (col === -1) side = 'left';
    else if (col === 8) side = 'right';
    else if (row === -1) side = 'top';
    else if (row === 8) side = 'bottom';
    cells.push({ row, col, side, owner });
  };

  for (let row = 0; row < 8; row++) {
    push(row, -1);
    push(row, 8);
  }
  [
    [-1, 0], [-1, -1], [-1, 7], [-1, 8],
    [8, 0], [8, -1], [8, 8], [8, 7]
  ].forEach(([row, col]) => push(row, col));

  return cells;
}

describe('CELL_TELEPORT_WILL（マステレポート）', () => {
  test('カード定義が存在し、コスト23である', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'CELL_TELEPORT_WILL');
    expect(def).toBeTruthy();
    expect(def.cost).toBe(23);
  });

  test('対象は盤面上の石があるマスで、外側候補が無いと対象がない', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.board[1][1] = Core.BLACK;
    gameState.boardExpansion = {
      active: true,
      side: 'left',
      row: 3,
      owner: Core.WHITE,
      usedByPlayer: { black: false, white: false },
      cells: [
        { side: 'left', row: 3, col: -1, owner: Core.WHITE },
        { side: 'right', row: 4, col: 8, owner: Core.EMPTY }
      ]
    };

    const targets = CardLogic.getCellTeleportTargets(cardState, gameState);
    expect(targets).toEqual(expect.arrayContaining([
      { row: 1, col: 1 },
      { row: 3, col: -1 }
    ]));
    expect(targets).not.toEqual(expect.arrayContaining([{ row: 4, col: 8 }]));

    gameState.boardExpansion.cells = getAllOuterExpansionCells(Core.BLACK);
    const noTargets = CardLogic.getCellTeleportTargets(cardState, gameState);
    expect(noTargets).toEqual([]);
  });

  test('選んだ石を未生成の外側マスへ移動し、元マスを穴にする', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.board[4][4] = Core.BLACK;
    cardState.markers.push({
      id: 'bomb_1',
      kind: 'bomb',
      row: 4,
      col: 4,
      owner: 'black',
      data: { remainingTurns: 2 }
    });
    cardState.stoneIdMap[4][4] = 'ctp1';
    cardState.pendingEffectByPlayer.black = {
      type: 'CELL_TELEPORT_WILL',
      stage: 'selectTarget',
      cardId: 'cell_teleport_01'
    };

    const res = CardLogic.applyCellTeleportWill(cardState, gameState, 'black', 4, 4, createPrng(0.67));

    expect(res && res.applied).toBe(true);
    expect(res.from).toEqual({ row: 4, col: 4 });
    expect(res.to).toEqual({ row: -1, col: 0 });
    expect(res.createdDestination).toBe(true);

    expect(gameState.board[4][4]).toBe(Core.EMPTY);
    expect(CardLogic.isBlockedCell(cardState, 4, 4, gameState)).toBe(true);
    const markersAtSource = (cardState.markers || []).filter((marker) => marker && marker.row === 4 && marker.col === 4);
    expect(markersAtSource.some((marker) => marker.data && marker.data.type === 'METEOR_HOLE')).toBe(true);

    const addedCell = (gameState.boardExpansion && Array.isArray(gameState.boardExpansion.cells))
      ? gameState.boardExpansion.cells.find((cell) => cell && cell.row === -1 && cell.col === 0)
      : null;
    expect(addedCell).toBeTruthy();
    expect(addedCell.owner).toBe(Core.BLACK);
    expect(cardState.expansionStoneIdByCell['-1,0']).toBe('ctp1');
    expect(cardState.stoneIdMap[4][4]).toBeNull();

    const movedBomb = cardState.markers.find((marker) => marker && marker.id === 'bomb_1');
    expect(movedBomb).toBeTruthy();
    expect(movedBomb.row).toBe(-1);
    expect(movedBomb.col).toBe(0);

    const moveEvents = (cardState._presentationEventsPersist || []).filter((ev) => ev && ev.type === 'MOVE');
    expect(moveEvents.length).toBeGreaterThanOrEqual(1);
    expect(moveEvents[0].cause).toBe('CELL_TELEPORT_WILL');
    expect(moveEvents[0].reason).toBe('teleport_move');

    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('既存の拡張セル上の石も対象にでき、外側空き拡張セルへ移動できる', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.boardExpansion = {
      active: true,
      side: 'mixed',
      row: null,
      owner: Core.EMPTY,
      usedByPlayer: { black: false, white: false },
      cells: getAllOuterExpansionCells(Core.BLACK).map((cell) => ({ ...cell }))
    };
    const sourceCell = gameState.boardExpansion.cells.find((cell) => cell.row === 2 && cell.col === -1);
    const destinationCell = gameState.boardExpansion.cells.find((cell) => cell.row === 5 && cell.col === 8);
    sourceCell.owner = Core.WHITE;
    destinationCell.owner = Core.EMPTY;

    cardState.expansionStoneIdByCell['2,-1'] = 'ctp-exp';
    cardState.pendingEffectByPlayer.black = {
      type: 'CELL_TELEPORT_WILL',
      stage: 'selectTarget',
      cardId: 'cell_teleport_01'
    };

    const res = CardLogic.applyCellTeleportWill(cardState, gameState, 'black', 2, -1, createPrng(0));

    expect(res && res.applied).toBe(true);
    expect(res.to).toEqual({ row: 5, col: 8 });
    expect(gameState.boardExpansion.cells.find((cell) => cell.row === 5 && cell.col === 8).owner).toBe(Core.WHITE);
    expect(cardState.expansionStoneIdByCell['5,8']).toBe('ctp-exp');
    expect(cardState.expansionStoneIdByCell['2,-1']).toBeUndefined();
    expect(CardLogic.isBlockedCell(cardState, 2, -1, gameState)).toBe(true);
  });
});
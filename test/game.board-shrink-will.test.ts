import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';

function createPrng(randomValue = 0.5) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

function getMarkersAt(cardState, row, col) {
  return (cardState.markers || []).filter((marker) => marker && marker.row === row && marker.col === col);
}

describe('盤面縮小 / 盤面縮小神', () => {
  test('盤面縮小は連続外周3マスを選択し、絶対保護だけ残して外周を穴化する', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.board[0][0] = Core.BLACK;
    gameState.board[0][1] = Core.WHITE;
    gameState.board[1][0] = Core.WHITE;
    cardState.markers.push({
      id: 'abs_1',
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'ABSOLUTE_PROTECTED', remainingOwnerTurns: 5 }
    });
    cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_SHRINK_WILL',
      stage: 'selectTarget',
      cardId: 'board_shrink_01',
      selectedCount: 0,
      maxSelections: 3,
      selectedTargets: []
    };

    const firstTargets = CardLogic.getBoardShrinkTargets(cardState, gameState, 'black');
    expect(firstTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 0, col: 0 }),
      expect.objectContaining({ row: 0, col: 1 }),
      expect.objectContaining({ row: 1, col: 0 })
    ]));

    const firstRes = CardLogic.applyBoardShrinkWill(cardState, gameState, 'black', 0, 0);
    expect(firstRes).toEqual(expect.objectContaining({
      applied: true,
      completed: false,
      selectedCount: 1,
      maxSelections: 3,
      remainingSelections: 2
    }));
    expect(CardLogic.getBoardShrinkTargets(cardState, gameState, 'black').some((target) => target.row === 0 && target.col === 0)).toBe(false);
    expect(CardLogic.getBoardShrinkTargets(cardState, gameState, 'black')).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 0, col: 1, direction: { row: 0, col: 1 } }),
      expect.objectContaining({ row: 1, col: 0, direction: { row: 1, col: 0 } })
    ]));

    const secondRes = CardLogic.applyBoardShrinkWill(cardState, gameState, 'black', 0, 1);
    expect(secondRes).toEqual(expect.objectContaining({
      applied: true,
      completed: false,
      selectedCount: 2,
      remainingSelections: 1
    }));
    expect(CardLogic.getBoardShrinkTargets(cardState, gameState, 'black')).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 1, col: 0, direction: { row: 1, col: 0 } })
    ]));

    const finalRes = CardLogic.applyBoardShrinkWill(cardState, gameState, 'black', 1, 0);
    expect(finalRes).toEqual(expect.objectContaining({
      applied: true,
      completed: true
    }));
    expect(finalRes.changedTargets).toEqual(expect.arrayContaining([
      { row: 0, col: 1 },
      { row: 1, col: 0 }
    ]));
    expect(finalRes.skippedTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 0, col: 0, reason: 'absolute_protected' })
    ]));
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    expect(getMarkersAt(cardState, 0, 0).some((marker) => marker.data && marker.data.type === 'METEOR_HOLE')).toBe(false);
    expect(getMarkersAt(cardState, 0, 1).some((marker) => marker.data && marker.data.type === 'METEOR_HOLE' && marker.data.visualVariant === 'BOARD_FRAME')).toBe(true);
    expect(getMarkersAt(cardState, 1, 0).some((marker) => marker.data && marker.data.type === 'METEOR_HOLE' && marker.data.visualVariant === 'BOARD_FRAME')).toBe(true);
  });

  test('盤面縮小は凍結・封鎖・種を盤面枠穴へ上書きする', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.board[0][1] = Core.WHITE;
    cardState.markers.push(
      {
        id: 'blockade_1',
        kind: 'specialStone',
        row: 0,
        col: 0,
        owner: 'black',
        data: { type: 'BLOCKADE', remainingOwnerTurns: 5 }
      },
      {
        id: 'freeze_1',
        kind: 'specialStone',
        row: 0,
        col: 1,
        owner: 'white',
        data: { type: 'FREEZE', remainingOwnerTurns: 5 }
      },
      {
        id: 'seed_1',
        kind: 'specialStone',
        row: 0,
        col: 2,
        owner: 'black',
        data: { type: 'SEED', remainingOwnerTurns: 5 }
      }
    );
    cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_SHRINK_WILL',
      stage: 'selectTarget',
      cardId: 'board_shrink_01',
      selectedCount: 0,
      maxSelections: 3,
      selectedTargets: []
    };

    expect(CardLogic.getBoardShrinkTargets(cardState, gameState, 'black')).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 0, col: 1 })
    ]));

    cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_SHRINK_WILL',
      stage: 'selectTarget',
      cardId: 'board_shrink_01',
      selectedCount: 2,
      maxSelections: 3,
      selectedTargets: [{ row: 0, col: 0 }, { row: 0, col: 1 }]
    };
    const finalRes = CardLogic.applyBoardShrinkWill(cardState, gameState, 'black', 0, 2);

    expect(finalRes).toEqual(expect.objectContaining({
      applied: true,
      completed: true
    }));
    expect(finalRes.changedTargets).toEqual(expect.arrayContaining([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 }
    ]));
    expect(finalRes.skippedTargets).toEqual([]);
    expect(gameState.board[0][1]).toBe(Core.EMPTY);
    for (const [row, col, statusType] of [
      [0, 0, 'BLOCKADE'],
      [0, 1, 'FREEZE'],
      [0, 2, 'SEED']
    ]) {
      const markers = getMarkersAt(cardState, row, col);
      expect(markers.some((marker) => marker.data && marker.data.type === statusType)).toBe(false);
      expect(markers.some((marker) => marker.data && marker.data.type === 'METEOR_HOLE' && marker.data.visualVariant === 'BOARD_FRAME')).toBe(true);
    }
  });

  test('盤面縮小は1マス離れた外周マスを次候補にしない', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_SHRINK_WILL',
      stage: 'selectTarget',
      cardId: 'board_shrink_01',
      selectedCount: 1,
      maxSelections: 3,
      selectedTargets: [{ row: 0, col: 0 }]
    };

    const targets = CardLogic.getBoardShrinkTargets(cardState, gameState, 'black');
    expect(targets.some((target) => target.row === 0 && target.col === 7)).toBe(false);
    expect(CardLogic.applyBoardShrinkWill(cardState, gameState, 'black', 0, 7)).toEqual({
      applied: false,
      reason: 'invalid_target'
    });
  });

  test('盤面縮小は盤面拡張マスも対象にできる', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.boardExpansion = {
      active: true,
      side: 'left',
      row: 3,
      owner: Core.EMPTY,
      usedByPlayer: { black: false, white: false },
      cells: [
        { side: 'left', row: 3, col: -1, owner: Core.EMPTY }
      ]
    };
    cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_SHRINK_WILL',
      stage: 'selectTarget',
      cardId: 'board_shrink_01',
      selectedCount: 2,
      maxSelections: 3,
      selectedTargets: [{ row: 3, col: 0 }, { row: 2, col: 0 }]
    };

    const targets = CardLogic.getBoardShrinkTargets(cardState, gameState, 'black');
    expect(targets).toEqual(expect.arrayContaining([expect.objectContaining({ row: 3, col: -1 })]));

    const finalRes = CardLogic.applyBoardShrinkWill(cardState, gameState, 'black', 3, -1);
    expect(finalRes).toEqual(expect.objectContaining({
      applied: true,
      completed: true
    }));
    expect(getMarkersAt(cardState, 3, -1).some((marker) => marker.data && marker.data.type === 'METEOR_HOLE' && marker.data.visualVariant === 'BOARD_FRAME')).toBe(true);
    expect(CardLogic.isBlockedCell(cardState, 3, -1, gameState)).toBe(true);
  });

  test('盤面縮小で復活の意志付きの石を選ぶと復活せず穴になる', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.board[0][0] = Core.BLACK;

    expect(CardLogic.applyRegenWill(cardState, 'black', 0, 0)).toEqual({ applied: true });

    cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_SHRINK_WILL',
      stage: 'selectTarget',
      cardId: 'board_shrink_01',
      selectedCount: 2,
      maxSelections: 3,
      selectedTargets: [{ row: 0, col: 1 }, { row: 0, col: 2 }]
    };

    const finalRes = CardLogic.applyBoardShrinkWill(cardState, gameState, 'black', 0, 0);
    expect(finalRes).toEqual(expect.objectContaining({
      applied: true,
      completed: true
    }));
    expect(gameState.board[0][0]).toBe(Core.EMPTY);
    expect(getMarkersAt(cardState, 0, 0).some((marker) => marker.data && marker.data.type === 'REGEN')).toBe(false);
    expect(getMarkersAt(cardState, 0, 0).some((marker) => marker.data && marker.data.type === 'METEOR_HOLE' && marker.data.visualVariant === 'BOARD_FRAME')).toBe(true);
    expect(CardLogic.isBlockedCell(cardState, 0, 0, gameState)).toBe(true);
  });

  test('盤面縮小神は角から辺方向を選び、絶対保護だけ残して既存マス状態を穴化する', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    for (let col = 0; col < 8; col++) {
      gameState.board[0][col] = Core.WHITE;
    }
    cardState.markers.push(
      {
        id: 'freeze_top',
        kind: 'specialStone',
        row: 0,
        col: 1,
        owner: 'white',
        data: { type: 'FREEZE', remainingOwnerTurns: 5 }
      },
      {
        id: 'seed_top',
        kind: 'specialStone',
        row: 0,
        col: 2,
        owner: 'black',
        data: { type: 'SEED', remainingOwnerTurns: 5 }
      },
      {
        id: 'abs_top',
        kind: 'specialStone',
        row: 0,
        col: 3,
        owner: 'white',
        data: { type: 'ABSOLUTE_PROTECTED', remainingOwnerTurns: 5 }
      },
      {
        id: 'blockade_top',
        kind: 'specialStone',
        row: 0,
        col: 4,
        owner: 'black',
        data: { type: 'BLOCKADE', remainingOwnerTurns: 5 }
      }
    );
    cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_SHRINK_GOD',
      stage: 'selectTarget',
      cardId: 'board_shrink_god_01'
    };

    const firstTargets = CardLogic.getBoardShrinkGodTargets(cardState, gameState, 'black');
    expect(firstTargets.some((target) => target.row === 0 && target.col === 0)).toBe(true);

    const firstRes = CardLogic.applyBoardShrinkGod(cardState, gameState, 'black', 0, 0);
    expect(firstRes).toEqual(expect.objectContaining({
      applied: true,
      completed: false,
      firstTarget: { row: 0, col: 0 }
    }));
    expect(cardState.pendingEffectByPlayer.black.firstTarget).toEqual({ row: 0, col: 0 });

    const directionTargets = CardLogic.getBoardShrinkGodTargets(cardState, gameState, 'black');
    expect(directionTargets.some((target) => target.row === 0 && target.col === 1)).toBe(true);

    const finalRes = CardLogic.applyBoardShrinkGod(cardState, gameState, 'black', 0, 1);
    expect(finalRes).toEqual(expect.objectContaining({
      applied: true,
      completed: true,
      firstTarget: { row: 0, col: 0 }
    }));
    expect(finalRes.lineTargets).toHaveLength(8);
    expect(finalRes.skippedTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 0, col: 3, reason: 'absolute_protected' })
    ]));
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    for (let col = 0; col < 8; col++) {
      const hasHole = getMarkersAt(cardState, 0, col).some((marker) => marker.data && marker.data.type === 'METEOR_HOLE');
      if (col === 3) {
        expect(hasHole).toBe(false);
      } else {
        expect(hasHole).toBe(true);
      }
    }
    for (const [row, col, statusType] of [
      [0, 1, 'FREEZE'],
      [0, 2, 'SEED'],
      [0, 4, 'BLOCKADE']
    ]) {
      const markers = getMarkersAt(cardState, row, col);
      expect(markers.some((marker) => marker.data && marker.data.type === statusType)).toBe(false);
      expect(markers.some((marker) => marker.data && marker.data.type === 'METEOR_HOLE' && marker.data.visualVariant === 'BOARD_FRAME')).toBe(true);
    }
    expect(getMarkersAt(cardState, 0, 0).some((marker) => marker.data && marker.data.type === 'METEOR_HOLE' && marker.data.visualVariant === 'BOARD_FRAME')).toBe(true);
  });

  test('盤面拡張神でできたL字拡張では、盤面縮小神の1手目は真の外角だけを角候補にする', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.boardExpansion = {
      active: true,
      side: 'right',
      row: 7,
      owner: Core.EMPTY,
      usedByPlayer: { black: true, white: false },
      cells: [
        { side: 'right', row: 7, col: 8, owner: Core.EMPTY },
        { side: 'bottom', row: 8, col: 8, owner: Core.EMPTY },
        { side: 'bottom', row: 8, col: 7, owner: Core.EMPTY }
      ]
    };
    cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_SHRINK_GOD',
      stage: 'selectTarget',
      cardId: 'board_shrink_god_01'
    };

    const firstTargets = CardLogic.getBoardShrinkGodTargets(cardState, gameState, 'black');
    expect(firstTargets.some((target) => target.row === 8 && target.col === 8)).toBe(true);
    expect(firstTargets.some((target) => target.row === 7 && target.col === 8)).toBe(false);
    expect(firstTargets.some((target) => target.row === 8 && target.col === 7)).toBe(false);

    const firstRes = CardLogic.applyBoardShrinkGod(cardState, gameState, 'black', 8, 8);
    expect(firstRes).toEqual(expect.objectContaining({
      applied: true,
      completed: false,
      firstTarget: { row: 8, col: 8 }
    }));

    const directionTargets = CardLogic.getBoardShrinkGodTargets(cardState, gameState, 'black');
    expect(directionTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 7, col: 8 }),
      expect.objectContaining({ row: 8, col: 7 })
    ]));
  });
});

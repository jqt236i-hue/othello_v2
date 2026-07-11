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
  test('盤面縮小は連続外周3マスを選択し、不可侵の顕現石だけ残して外周を穴化する', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.board[0][0] = Core.BLACK;
    gameState.board[0][1] = Core.WHITE;
    gameState.board[1][0] = Core.WHITE;
    cardState.markers.push({
      id: 'manifest_1',
      kind: 'manifestStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'THEORY_INCARNATION', remainingOwnerTurns: 4, inviolable: true }
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
      expect.objectContaining({ row: 0, col: 0, reason: 'inviolable' })
    ]));
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    expect(getMarkersAt(cardState, 0, 0).some((marker) => marker.data && marker.data.type === 'METEOR_HOLE')).toBe(false);
    expect(getMarkersAt(cardState, 0, 1).some((marker) => marker.data && marker.data.type === 'METEOR_HOLE' && marker.data.visualVariant === 'BOARD_FRAME')).toBe(true);
    expect(getMarkersAt(cardState, 1, 0).some((marker) => marker.data && marker.data.type === 'METEOR_HOLE' && marker.data.visualVariant === 'BOARD_FRAME')).toBe(true);
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

  test('盤面縮小は初期外周を越えて連鎖拡張したマスも対象にできる', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;
    gameState.boardExpansion = {
      active: true,
      side: 'top',
      row: -2,
      col: 1,
      owner: Core.EMPTY,
      usedByPlayer: { black: true, white: false },
      cells: [
        { side: 'top', row: -1, col: 1, owner: Core.EMPTY },
        { side: 'top', row: -2, col: 1, owner: Core.EMPTY }
      ]
    };
    cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_SHRINK_WILL',
      stage: 'selectTarget',
      cardId: 'board_shrink_01',
      selectedCount: 2,
      maxSelections: 3,
      selectedTargets: [{ row: 0, col: 1 }, { row: -1, col: 1 }]
    };

    const targets = CardLogic.getBoardShrinkTargets(cardState, gameState, 'black');
    expect(targets).toEqual(expect.arrayContaining([expect.objectContaining({ row: -2, col: 1 })]));

    const result = CardLogic.applyBoardShrinkWill(cardState, gameState, 'black', -2, 1);
    expect(result).toEqual(expect.objectContaining({ applied: true, completed: true }));
    expect(CardLogic.isBlockedCell(cardState, -2, 1, gameState)).toBe(true);
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

  test('盤面縮小でも生きる意志はセル消滅から復活しない', () => {
    const rng = createPrng(0);
    const cardState = CardLogic.createCardState(rng);
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.WHITE));
    gameState.currentPlayer = Core.BLACK;
    gameState.board[0][0] = Core.BLACK;
    gameState.board[5][5] = Core.EMPTY;

    cardState.pendingEffectByPlayer.black = {
      type: 'LIVING_WILL',
      stage: 'selectTarget',
      cardId: 'living_will_01'
    };
    expect(CardLogic.applyLivingWill(cardState, gameState, 'black', 0, 0)).toMatchObject({ applied: true });

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
    expect(gameState.board[5][5]).toBe(Core.EMPTY);
    expect(getMarkersAt(cardState, 0, 0).some((marker) => marker.data && marker.data.type === 'METEOR_HOLE' && marker.data.visualVariant === 'BOARD_FRAME')).toBe(true);

    const visualEvents = (cardState.presentationEvents || []).filter((event) => (
      event &&
      (
        (event.type === 'DESTROY' && event.cause === 'BOARD_SHRINK_WILL' && event.row === 0 && event.col === 0) ||
        (event.type === 'STATUS_APPLIED' && event.row === 0 && event.col === 0 && event.meta && event.meta.special === 'METEOR_HOLE')
      )
    ));
    expect(visualEvents.map((event) => event.type)).toEqual(['DESTROY', 'STATUS_APPLIED']);
    expect(visualEvents[1].meta.visualVariant).toBe('BOARD_FRAME');
    expect((cardState.presentationEvents || []).some((event) => (
      event &&
      event.cause === 'LIVING_WILL' &&
      (event.type === 'STATUS_REMOVED' || event.type === 'SPAWN' || event.type === 'CHANGE')
    ))).toBe(false);
  });

  test('盤面縮小神は角から辺方向を選び、不可侵の顕現石を残して1列を穴化する', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    for (let col = 0; col < 8; col++) {
      gameState.board[0][col] = Core.WHITE;
    }
    cardState.markers.push({
      id: 'manifest_top',
      kind: 'manifestStone',
      row: 0,
      col: 3,
      owner: 'white',
      data: { type: 'BOARD_EXECUTOR', remainingOwnerTurns: 4, inviolable: true }
    });
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
      expect.objectContaining({ row: 0, col: 3, reason: 'inviolable' })
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
    expect(getMarkersAt(cardState, 0, 0).some((marker) => marker.data && marker.data.type === 'METEOR_HOLE' && marker.data.visualVariant === 'BOARD_FRAME')).toBe(true);
  });

  test('盤面縮小神でも生きる意志はセル消滅から復活しない', () => {
    const rng = createPrng(0);
    const cardState = CardLogic.createCardState(rng);
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.WHITE));
    gameState.currentPlayer = Core.BLACK;
    gameState.board[0][0] = Core.BLACK;
    gameState.board[5][5] = Core.EMPTY;

    cardState.pendingEffectByPlayer.black = {
      type: 'LIVING_WILL',
      stage: 'selectTarget',
      cardId: 'living_will_01'
    };
    expect(CardLogic.applyLivingWill(cardState, gameState, 'black', 0, 0)).toMatchObject({ applied: true });

    cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_SHRINK_GOD',
      stage: 'selectTarget',
      cardId: 'board_shrink_god_01'
    };

    expect(CardLogic.applyBoardShrinkGod(cardState, gameState, 'black', 0, 0)).toEqual(expect.objectContaining({
      applied: true,
      completed: false
    }));
    const finalRes = CardLogic.applyBoardShrinkGod(cardState, gameState, 'black', 0, 1);
    expect(finalRes).toEqual(expect.objectContaining({
      applied: true,
      completed: true
    }));
    expect(gameState.board[0][0]).toBe(Core.EMPTY);
    expect(gameState.board[5][5]).toBe(Core.EMPTY);
    expect(getMarkersAt(cardState, 0, 0).some((marker) => marker.data && marker.data.type === 'METEOR_HOLE' && marker.data.visualVariant === 'BOARD_FRAME')).toBe(true);

    const visualEvents = (cardState.presentationEvents || []).filter((event) => (
      event &&
      (
        (event.type === 'DESTROY' && event.cause === 'BOARD_SHRINK_GOD' && event.row === 0 && event.col === 0) ||
        (event.type === 'STATUS_APPLIED' && event.row === 0 && event.col === 0 && event.meta && event.meta.special === 'METEOR_HOLE')
      )
    ));
    expect(visualEvents.map((event) => event.type)).toEqual(['DESTROY', 'STATUS_APPLIED']);
    expect(visualEvents[1].meta.visualVariant).toBe('BOARD_FRAME');
    expect((cardState.presentationEvents || []).some((event) => (
      event &&
      event.cause === 'LIVING_WILL' &&
      (event.type === 'STATUS_REMOVED' || event.type === 'SPAWN' || event.type === 'CHANGE')
    ))).toBe(false);
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

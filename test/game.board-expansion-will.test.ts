import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import * as BoardOps from '../game/logic/board_ops.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as SharedConstants from '../shared-constants.js';

function createPrng() {
  return {
    shuffle: (arr) => arr,
    random: () => 0.5
  };
}

describe('BOARD_EXPANSION_WILL（盤面拡張）', () => {
  test('カード使用で選択待ちになり、対象選択で拡張状態が確定する', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'BOARD_EXPANSION_WILL');
    expect(def).toBeTruthy();

    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.charge.black = 30;
    cardState.hands.black = [def.id];

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(used).toBe(true);
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('BOARD_EXPANSION_WILL');

    const selected = CardLogic.applyBoardExpansionWill(cardState, gameState, 'black', 2, 0);
    expect(selected && selected.applied).toBe(true);
    expect(gameState.boardExpansion).toMatchObject({
      active: true,
      side: 'left',
      row: 2,
      owner: Core.EMPTY
    });
    expect(gameState.boardExpansion.usedByPlayer.black).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    const targetsAfterUse = CardLogic.getBoardExpansionTargets(cardState, gameState, 'black');
    expect(targetsAfterUse.length).toBeGreaterThan(0);
    expect(targetsAfterUse.some((t) => t.row === 2 && t.col === 0)).toBe(false);
    expect(targetsAfterUse.some((t) => t.row === 2 && t.col === 7)).toBe(true);
    expect(targetsAfterUse).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, col: -1, directionKey: 'left' })
    ]));
  });

  test('同一プレイヤーでも盤面拡張を複数回使える', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();

    cardState.pendingEffectByPlayer.black = { type: 'BOARD_EXPANSION_WILL', stage: 'selectTarget' };
    const first = CardLogic.applyBoardExpansionWill(cardState, gameState, 'black', 2, 0);
    expect(first && first.applied).toBe(true);

    const whiteTargets = CardLogic.getBoardExpansionTargets(cardState, gameState, 'white');
    expect(whiteTargets.length).toBeGreaterThan(0);
    expect(whiteTargets.some((t) => t.row === 2 && t.col === 0)).toBe(false);
    expect(whiteTargets.some((t) => t.row === 5 && t.col === 7)).toBe(true);

    cardState.pendingEffectByPlayer.white = { type: 'BOARD_EXPANSION_WILL', stage: 'selectTarget' };
    const second = CardLogic.applyBoardExpansionWill(cardState, gameState, 'white', 5, 7);
    expect(second && second.applied).toBe(true);

    expect(gameState.boardExpansion.usedByPlayer).toMatchObject({ black: true, white: true });
    expect(Array.isArray(gameState.boardExpansion.cells)).toBe(true);
    expect(gameState.boardExpansion.cells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ side: 'left', row: 2, owner: Core.EMPTY }),
        expect.objectContaining({ side: 'right', row: 5, owner: Core.EMPTY })
      ])
    );

    const blackTargetsAfterTwo = CardLogic.getBoardExpansionTargets(cardState, gameState, 'black');
    const whiteTargetsAfterTwo = CardLogic.getBoardExpansionTargets(cardState, gameState, 'white');
    expect(blackTargetsAfterTwo.length).toBeGreaterThan(0);
    expect(whiteTargetsAfterTwo.length).toBeGreaterThan(0);
    expect(blackTargetsAfterTwo.some((t) => t.row === 2 && t.col === 0)).toBe(false);
    expect(blackTargetsAfterTwo.some((t) => t.row === 5 && t.col === 7)).toBe(false);

    cardState.pendingEffectByPlayer.black = { type: 'BOARD_EXPANSION_WILL', stage: 'selectTarget' };
    const third = CardLogic.applyBoardExpansionWill(cardState, gameState, 'black', 4, 0);
    expect(third && third.applied).toBe(true);

    const blackTargetsAfterThree = CardLogic.getBoardExpansionTargets(cardState, gameState, 'black');
    expect(blackTargetsAfterThree.length).toBeGreaterThan(0);
    expect(blackTargetsAfterThree.some((t) => t.row === 4 && t.col === 0)).toBe(false);
  });

  test('10x10の右端選択でも盤面拡張が現在盤面の外側へ追加される', () => {
    const cardState = CardLogic.createCardState(createPrng(), { boardConfig: { rows: 10, cols: 10 } });
    const gameState = Core.createGameState({ rows: 10, cols: 10 });

    cardState.pendingEffectByPlayer.black = { type: 'BOARD_EXPANSION_WILL', stage: 'selectTarget' };
    const selected = CardLogic.applyBoardExpansionWill(cardState, gameState, 'black', 3, 9);

    expect(selected).toEqual(expect.objectContaining({
      applied: true,
      side: 'right',
      row: 3,
      col: 10
    }));
    expect(gameState.boardExpansion.cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ side: 'right', row: 3, col: 10, owner: Core.EMPTY })
    ]));
    expect(gameState.boardExpansion.usedByPlayer.black).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('10x10の下側行でも盤面拡張は8行固定で弾かれない', () => {
    const cardState = CardLogic.createCardState(createPrng(), { boardConfig: { rows: 10, cols: 10 } });
    const gameState = Core.createGameState({ rows: 10, cols: 10 });

    cardState.pendingEffectByPlayer.black = { type: 'BOARD_EXPANSION_WILL', stage: 'selectTarget' };
    const selected = CardLogic.applyBoardExpansionWill(cardState, gameState, 'black', 9, 0);

    expect(selected).toEqual(expect.objectContaining({
      applied: true,
      side: 'left',
      row: 9,
      col: -1
    }));
    expect(gameState.boardExpansion.cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ side: 'left', row: 9, col: -1, owner: Core.EMPTY })
    ]));
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('拡張セルは合法手として扱われ、通常反転に参加する', () => {
    const gameState = Core.createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.currentPlayer = Core.BLACK;
    gameState.board[3][0] = Core.WHITE;
    gameState.board[3][1] = Core.BLACK;
    gameState.boardExpansion = {
      active: true,
      side: 'left',
      row: 3,
      owner: Core.EMPTY,
      usedByPlayer: { black: true, white: false }
    };

    const legalMoves = Core.getLegalMoves(gameState, Core.BLACK, {});
    const expansionMove = legalMoves.find((move) => move.row === 3 && move.col === -1);
    expect(expansionMove).toBeTruthy();
    expect(expansionMove.flips).toEqual([[3, 0]]);

    const nextState = Core.applyMove(gameState, expansionMove);
    expect(nextState.boardExpansion.owner).toBe(Core.BLACK);
    expect(nextState.board[3][0]).toBe(Core.BLACK);
  });

  test('複数拡張セルが同時に合法手へ参加する', () => {
    const gameState = Core.createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.currentPlayer = Core.BLACK;
    gameState.board[2][0] = Core.WHITE;
    gameState.board[2][1] = Core.BLACK;
    gameState.board[5][7] = Core.WHITE;
    gameState.board[5][6] = Core.BLACK;
    gameState.boardExpansion = {
      active: true,
      side: 'right',
      row: 5,
      owner: Core.EMPTY,
      usedByPlayer: { black: true, white: true },
      cells: [
        { side: 'left', row: 2, owner: Core.EMPTY },
        { side: 'right', row: 5, owner: Core.EMPTY }
      ]
    };

    const legalMoves = Core.getLegalMoves(gameState, Core.BLACK, {});
    const leftMove = legalMoves.find((move) => move.row === 2 && move.col === -1);
    const rightMove = legalMoves.find((move) => move.row === 5 && move.col === 8);

    expect(leftMove).toBeTruthy();
    expect(rightMove).toBeTruthy();
    expect(leftMove.flips).toEqual([[2, 0]]);
    expect(rightMove.flips).toEqual([[5, 7]]);
  });

  test('BoardOpsが拡張セルの石IDを管理できる', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    gameState.boardExpansion = {
      active: true,
      side: 'left',
      row: 5,
      owner: Core.EMPTY,
      usedByPlayer: { black: true, white: false }
    };

    const spawned = BoardOps.spawnAt(cardState, gameState, 5, -1, 'black', 'SYSTEM', 'test_spawn');
    expect(spawned.spawned).toBe(true);
    expect(gameState.boardExpansion.owner).toBe(Core.BLACK);
    expect(cardState.expansionStoneIdByCell['5,-1']).toBe(spawned.stoneId);

    const destroyed = BoardOps.destroyAt(cardState, gameState, 5, -1, 'SYSTEM', 'test_destroy');
    expect(destroyed.destroyed).toBe(true);
    expect(gameState.boardExpansion.owner).toBe(Core.EMPTY);
    expect(cardState.expansionStoneIdByCell['5,-1']).toBeUndefined();
  });

  test('BoardOps.moveAt は main から expansion へ stoneId を保ったまま移動できる', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.boardExpansion = {
      active: true,
      side: 'top',
      row: -1,
      owner: Core.EMPTY,
      usedByPlayer: { black: true, white: false },
      cells: [{ side: 'top', row: -1, col: 0, owner: Core.EMPTY }]
    };

    const spawned = BoardOps.spawnAt(cardState, gameState, 0, 0, 'black', 'SYSTEM', 'test_spawn_main');
    expect(spawned.spawned).toBe(true);
    expect(cardState.stoneIdMap[0][0]).toBe(spawned.stoneId);

    const moved = BoardOps.moveAt(cardState, gameState, 0, 0, -1, 0, 'SYSTEM', 'test_move_to_expansion');
    expect(moved.moved).toBe(true);
    expect(gameState.board[0][0]).toBe(Core.EMPTY);
    expect(gameState.boardExpansion.cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: -1, col: 0, owner: Core.BLACK })
    ]));
    expect(cardState.stoneIdMap[0][0]).toBeNull();
    expect(cardState.expansionStoneIdByCell['-1,0']).toBe(spawned.stoneId);
  });

  test('DESTROY_ONE_STONEは拡張マス上の復活石を対象にでき、破壊ではなく復活消費になる', () => {
    const destroyDef = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'DESTROY_ONE_STONE');
    expect(destroyDef).toBeTruthy();

    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    gameState.boardExpansion = {
      active: true,
      side: 'left',
      row: 5,
      owner: Core.WHITE,
      usedByPlayer: { black: true, white: false },
      cells: [
        { side: 'left', row: 5, col: -1, owner: Core.WHITE }
      ]
    };
    cardState.pendingEffectByPlayer.black = {
      type: 'DESTROY_ONE_STONE',
      cardId: destroyDef.id,
      stage: 'selectTarget'
    };
    cardState.markers.push({
      id: 'regen-expansion',
      row: 5,
      col: -1,
      kind: 'specialStone',
      owner: 'white',
      createdSeq: 1,
      data: { type: 'REGEN', regenRemaining: 3, ownerColor: Core.WHITE }
    });

    const targets = CardLogic.getSelectableTargets(cardState, gameState, 'black');
    expect(targets).toEqual(expect.arrayContaining([{ row: 5, col: -1 }]));

    const destroyed = CardLogic.applyDestroyEffect(cardState, gameState, 'black', 5, -1);
    expect(destroyed).toBe(true);
    expect(gameState.boardExpansion.cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 5, col: -1, owner: Core.WHITE })
    ]));
    expect(cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 5,
        col: -1,
        data: expect.objectContaining({ type: 'REGEN', regenRemaining: 2 })
      })
    ]));
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('BOARD_EXPANSION_GODは2つの角を選び、外側6マスを同時追加する', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'BOARD_EXPANSION_GOD');
    expect(def).toBeTruthy();

    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.charge.black = 40;
    cardState.hands.black = [def.id];

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(used).toBe(true);
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('BOARD_EXPANSION_GOD');

    const targetsBefore = CardLogic.getBoardExpansionGodTargets(cardState, gameState, 'black');
    expect(targetsBefore).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 0, col: 0, directionKey: 'up-left' }),
      expect.objectContaining({ row: 0, col: 7, directionKey: 'up-right' }),
      expect.objectContaining({ row: 7, col: 0, directionKey: 'down-left' }),
      expect.objectContaining({ row: 7, col: 7, directionKey: 'down-right' })
    ]));

    const firstSelected = CardLogic.applyBoardExpansionGod(cardState, gameState, 'black', 0, 0);
    expect(firstSelected && firstSelected.applied).toBe(true);
    expect(firstSelected && firstSelected.completed).toBe(false);
    expect(firstSelected && firstSelected.selectedCount).toBe(1);
    expect(firstSelected && firstSelected.maxSelections).toBe(2);
    expect(cardState.pendingEffectByPlayer.black.selectedTargets).toEqual([
      { row: 0, col: 0, directionKey: 'up-left' }
    ]);

    const targetsAfterFirst = CardLogic.getBoardExpansionGodTargets(cardState, gameState, 'black');
    expect(targetsAfterFirst).toHaveLength(3);
    expect(targetsAfterFirst.some((t) => t.row === 0 && t.col === 0)).toBe(false);

    const applied = CardLogic.applyBoardExpansionGod(cardState, gameState, 'black', 7, 7);
    expect(applied && applied.applied).toBe(true);
    expect(applied && applied.completed).toBe(true);
    expect(Array.isArray(applied.added)).toBe(true);
    expect(applied.added).toEqual(expect.arrayContaining([
      { row: -1, col: 0 },
      { row: -1, col: -1 },
      { row: 0, col: -1 },
      { row: 7, col: 8 },
      { row: 8, col: 8 },
      { row: 8, col: 7 }
    ]));
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    expect(Array.isArray(gameState.boardExpansion.cells)).toBe(true);
    expect(gameState.boardExpansion.cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: -1, col: 0, owner: Core.EMPTY }),
      expect.objectContaining({ row: -1, col: -1, owner: Core.EMPTY }),
      expect.objectContaining({ row: 0, col: -1, owner: Core.EMPTY }),
      expect.objectContaining({ row: 7, col: 8, owner: Core.EMPTY }),
      expect.objectContaining({ row: 8, col: 8, owner: Core.EMPTY }),
      expect.objectContaining({ row: 8, col: 7, owner: Core.EMPTY })
    ]));
    expect(gameState.boardExpansion.usedByPlayer.black).toBe(true);

    const targetsAfter = CardLogic.getBoardExpansionGodTargets(cardState, gameState, 'black');
    expect(targetsAfter.length).toBeGreaterThan(0);
    expect(targetsAfter.some((t) => t.row === 0 && t.col === 0)).toBe(false);
    expect(targetsAfter.some((t) => t.row === 7 && t.col === 7)).toBe(false);
    expect(targetsAfter.some((t) => t.row < 0 || t.row > 7 || t.col < 0 || t.col > 7)).toBe(true);
  });

  test('BOARD_EXPANSION_GODは1角目を再送して3マス拡張を確定できる', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'BOARD_EXPANSION_GOD');
    expect(def).toBeTruthy();

    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.charge.black = 40;
    cardState.hands.black = [def.id];

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', def.id)).toBe(true);
    const first = CardLogic.applyBoardExpansionGod(cardState, gameState, 'black', 0, 0, 'up-left');
    expect(first).toEqual(expect.objectContaining({
      applied: true,
      completed: false,
      selectedTargets: [{ row: 0, col: 0, directionKey: 'up-left' }]
    }));

    const confirmed = CardLogic.applyBoardExpansionGod(cardState, gameState, 'black', 0, 0, 'up-left');

    expect(confirmed).toEqual(expect.objectContaining({
      applied: true,
      completed: true,
      sources: [{ row: 0, col: 0, directionKey: 'up-left' }]
    }));
    expect(confirmed.added).toEqual(expect.arrayContaining([
      { row: -1, col: 0 },
      { row: -1, col: -1 },
      { row: 0, col: -1 }
    ]));
    expect(confirmed.added).toHaveLength(3);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(gameState.boardExpansion.cells).toHaveLength(3);
  });

  test('BOARD_EXPANSION_GODは追加予定セルが重複するsocketの組み合わせをauthorityで拒否する', () => {
    const BoardExpansionApply = require('../game/logic/card-resolution/board-expansion-apply.ts');
    const pending = {
      type: 'BOARD_EXPANSION_GOD',
      stage: 'selectTarget',
      selectedTargets: [{ row: 0, col: 0, directionKey: 'up-left' }]
    };
    const sockets = [
      {
        row: 0,
        col: 0,
        directionKey: 'up-left',
        additions: [{ row: -1, col: 0 }, { row: 0, col: -1 }, { row: -1, col: -1 }]
      },
      {
        row: 0,
        col: 0,
        directionKey: 'up-right',
        additions: [{ row: -1, col: 0 }, { row: 0, col: 1 }, { row: -1, col: 1 }]
      }
    ];
    const result = BoardExpansionApply.applyBoardExpansionGod(
      { pendingEffectByPlayer: { black: pending } },
      { boardExpansion: { cells: [], usedByPlayer: { black: false, white: false } } },
      'black',
      0,
      0,
      'up-right',
      {
        readCardPendingEffect: () => pending,
        getBoardExpansionGodTargets: () => [sockets[1]],
        getBoardExpansionGodRequiredSelectionCount: () => 2,
        getBoardExpansionGodPendingSelectionsForCard: () => pending.selectedTargets,
        ensureMutableBoardExpansionForCard: (state) => state.boardExpansion,
        getExpansionDescriptorsForCard: () => [],
        getBoardExpansionGodSocketTargets: () => sockets,
        resolveExpansionSideForCard: () => 'mixed',
        normalizeExpansionOwnerForCard: (owner) => owner,
        syncLegacyExpansionFieldsForCard: jest.fn(),
        clearCardPendingEffect: jest.fn()
      }
    );

    expect(result).toEqual({ applied: false, reason: 'already_expanded' });
  });

  test('BOARD_EXPANSION_GODは1回目の選択後に陳腐化したsocketを確定時に拒否する', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_EXPANSION_GOD',
      stage: 'selectTarget',
      selectedCount: 0,
      maxSelections: 2,
      selectedTargets: []
    };

    expect(CardLogic.applyBoardExpansionGod(cardState, gameState, 'black', 0, 0, 'up-left')).toEqual(
      expect.objectContaining({ applied: true, completed: false })
    );
    gameState.boardExpansion = {
      active: true,
      side: 'top',
      row: -1,
      owner: Core.EMPTY,
      usedByPlayer: { black: false, white: false },
      cells: [{ side: 'top', row: -1, col: 0, owner: Core.EMPTY }]
    };

    expect(CardLogic.applyBoardExpansionGod(cardState, gameState, 'black', 7, 7, 'down-right')).toEqual({
      applied: false,
      reason: 'invalid_target'
    });
    expect(cardState.pendingEffectByPlayer.black).not.toBeNull();
  });

  test('BOARD_EXPANSION_GODは旧外周の一部が埋まっても現在の盤面境界から2角を選べる', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'BOARD_EXPANSION_GOD');
    expect(def).toBeTruthy();

    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.charge.black = 40;
    cardState.hands.black = [def.id];
    gameState.boardExpansion = {
      active: true,
      side: 'mixed',
      row: null,
      owner: Core.EMPTY,
      usedByPlayer: { black: false, white: false },
      cells: [
        { side: 'top', row: -1, col: 0, owner: Core.EMPTY },
        { side: 'top', row: -1, col: 7, owner: Core.EMPTY },
        { side: 'bottom', row: 8, col: 0, owner: Core.EMPTY }
      ]
    };

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(used).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      type: 'BOARD_EXPANSION_GOD',
      stage: 'selectTarget',
      selectedCount: 0,
      maxSelections: 2,
      selectedTargets: []
    }));

    const targets = CardLogic.getBoardExpansionGodTargets(cardState, gameState, 'black');
    expect(targets.length).toBeGreaterThan(1);
    expect(targets.some((target) => target.row < 0 || target.row > 7 || target.col < 0 || target.col > 7)).toBe(true);
  });

  test('追加済み拡張マスを起点にcurrent shapeの外側へ連鎖拡張できる', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();

    cardState.pendingEffectByPlayer.black = { type: 'BOARD_EXPANSION_WILL', stage: 'selectTarget' };
    const first = CardLogic.applyBoardExpansionWill(cardState, gameState, 'black', 0, 1, 'up');
    expect(first).toEqual(expect.objectContaining({
      applied: true,
      directionKey: 'up',
      row: -1,
      col: 1
    }));

    cardState.pendingEffectByPlayer.black = { type: 'BOARD_EXPANSION_WILL', stage: 'selectTarget' };
    const second = CardLogic.applyBoardExpansionWill(cardState, gameState, 'black', -1, 1, 'up');
    expect(second).toEqual(expect.objectContaining({
      applied: true,
      directionKey: 'up',
      row: -2,
      col: 1
    }));
    expect(gameState.boardExpansion.cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: -1, col: 1 }),
      expect.objectContaining({ row: -2, col: 1 })
    ]));
  });

  test('存在しない方向のsocketはauthority再検証で拒否する', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.pendingEffectByPlayer.black = { type: 'BOARD_EXPANSION_WILL', stage: 'selectTarget' };

    expect(CardLogic.applyBoardExpansionWill(cardState, gameState, 'black', 0, 0, 'down')).toEqual({
      applied: false,
      reason: 'invalid_target'
    });
    expect(gameState.boardExpansion.cells || []).toHaveLength(0);
  });

  test('BOARD_EXPANSION_GODはpending.maxSelectionsが1なら候補が複数でも1角で確定する', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'BOARD_EXPANSION_GOD');
    expect(def).toBeTruthy();

    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.charge.black = 40;
    cardState.hands.black = [def.id];

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(used).toBe(true);
    expect(CardLogic.getBoardExpansionGodTargets(cardState, gameState, 'black')).toHaveLength(4);

    cardState.pendingEffectByPlayer.black.maxSelections = 1;

    const applied = CardLogic.applyBoardExpansionGod(cardState, gameState, 'black', 7, 7);

    expect(applied && applied.applied).toBe(true);
    expect(applied && applied.completed).toBe(true);
    expect(applied && applied.sources).toEqual([{ row: 7, col: 7, directionKey: 'down-right' }]);
    expect(applied && applied.added).toEqual(expect.arrayContaining([
      { row: 7, col: 8 },
      { row: 8, col: 8 },
      { row: 8, col: 7 }
    ]));
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('BOARD_EXPANSION_GODは旧外周4角が埋まっても現在の盤面境界から使用できる', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'BOARD_EXPANSION_GOD');
    expect(def).toBeTruthy();

    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.charge.black = 40;
    cardState.hands.black = [def.id];
    gameState.boardExpansion = {
      active: true,
      side: 'mixed',
      row: null,
      owner: Core.EMPTY,
      usedByPlayer: { black: false, white: false },
      cells: [
        { side: 'top', row: -1, col: 0, owner: Core.EMPTY },
        { side: 'top', row: -1, col: 7, owner: Core.EMPTY },
        { side: 'bottom', row: 8, col: 0, owner: Core.EMPTY },
        { side: 'bottom', row: 8, col: 7, owner: Core.EMPTY }
      ]
    };

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(used).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      type: 'BOARD_EXPANSION_GOD',
      stage: 'selectTarget',
      maxSelections: 2
    }));
    expect(CardLogic.getBoardExpansionGodTargets(cardState, gameState, 'black').length).toBeGreaterThan(0);
  });

  test('BOARD_EXPANSION_GODは10x10の角から現在盤面外側の6マスを追加する', () => {
    const cardState = CardLogic.createCardState(createPrng(), { boardConfig: { rows: 10, cols: 10 } });
    const gameState = Core.createGameState({ rows: 10, cols: 10 });
    cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_EXPANSION_GOD',
      stage: 'selectTarget',
      selectedCount: 0,
      maxSelections: 2,
      selectedTargets: []
    };

    const firstSelected = CardLogic.applyBoardExpansionGod(cardState, gameState, 'black', 0, 0);
    expect(firstSelected && firstSelected.applied).toBe(true);
    expect(firstSelected && firstSelected.completed).toBe(false);

    const applied = CardLogic.applyBoardExpansionGod(cardState, gameState, 'black', 9, 9);

    expect(applied && applied.applied).toBe(true);
    expect(applied && applied.completed).toBe(true);
    expect(applied && applied.added).toEqual(expect.arrayContaining([
      { row: -1, col: 0 },
      { row: -1, col: -1 },
      { row: 0, col: -1 },
      { row: 9, col: 10 },
      { row: 10, col: 10 },
      { row: 10, col: 9 }
    ]));
    expect(gameState.boardExpansion.cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: -1, col: 0, owner: Core.EMPTY }),
      expect.objectContaining({ row: -1, col: -1, owner: Core.EMPTY }),
      expect.objectContaining({ row: 0, col: -1, owner: Core.EMPTY }),
      expect.objectContaining({ row: 9, col: 10, owner: Core.EMPTY }),
      expect.objectContaining({ row: 10, col: 10, owner: Core.EMPTY }),
      expect.objectContaining({ row: 10, col: 9, owner: Core.EMPTY })
    ]));
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('BOARD_EXPANSION_WILL適用時に既存の神拡張セルを保持する', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();

    cardState.pendingEffectByPlayer.black = { type: 'BOARD_EXPANSION_GOD', stage: 'selectTarget' };
    const godFirst = CardLogic.applyBoardExpansionGod(cardState, gameState, 'black', 0, 0);
    expect(godFirst && godFirst.applied).toBe(true);
    expect(godFirst && godFirst.completed).toBe(false);

    const god = CardLogic.applyBoardExpansionGod(cardState, gameState, 'black', 7, 7);
    expect(god && god.applied).toBe(true);
    expect(god && god.completed).toBe(true);

    cardState.pendingEffectByPlayer.white = { type: 'BOARD_EXPANSION_WILL', stage: 'selectTarget' };
    const will = CardLogic.applyBoardExpansionWill(cardState, gameState, 'white', 3, 7);
    expect(will && will.applied).toBe(true);

    expect(gameState.boardExpansion.cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: -1, col: 0 }),
      expect.objectContaining({ row: -1, col: -1 }),
      expect.objectContaining({ row: 0, col: -1 }),
      expect.objectContaining({ row: 7, col: 8 }),
      expect.objectContaining({ row: 8, col: 8 }),
      expect.objectContaining({ row: 8, col: 7 }),
      expect.objectContaining({ row: 3, col: 8 })
    ]));
  });

  test('BOARD_EXPANSION_GODはターンパイプライン上でも2段階選択で確定する', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_EXPANSION_GOD',
      stage: 'selectTarget',
      selectedCount: 0,
      maxSelections: 2,
      selectedTargets: []
    };

    const first = TurnPipeline.applyTurn(cardState, gameState, 'black', {
      type: 'place',
      expansionTarget: { row: 0, col: 0 }
    });
    expect(first.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'board_expansion_first_selected',
        applied: true,
        selectedCount: 1,
        maxSelections: 2
      })
    ]));
    expect(first.cardState.pendingEffectByPlayer.black.selectedTargets).toEqual([
      { row: 0, col: 0, directionKey: 'up-left' }
    ]);

    const second = TurnPipeline.applyTurn(first.cardState, first.gameState, 'black', {
      type: 'place',
      expansionTarget: { row: 7, col: 7 }
    });
    expect(second.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'board_expansion_selected',
        applied: true,
        completed: true
      })
    ]));
    expect(second.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(second.gameState.boardExpansion.cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: -1, col: 0 }),
      expect.objectContaining({ row: 8, col: 8 })
    ]));
  });

  test('BOARD_EXPANSION_GODは候補が1角だけならターンパイプライン上でも1回選択で確定する', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    gameState.boardExpansion = {
      active: true,
      side: 'mixed',
      row: null,
      owner: Core.EMPTY,
      usedByPlayer: { black: false, white: false },
      cells: [
        { side: 'top', row: -1, col: 0, owner: Core.EMPTY },
        { side: 'top', row: -1, col: 7, owner: Core.EMPTY },
        { side: 'bottom', row: 8, col: 0, owner: Core.EMPTY }
      ]
    };
    cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_EXPANSION_GOD',
      stage: 'selectTarget',
      selectedCount: 0,
      maxSelections: 1,
      selectedTargets: []
    };

    const turn = TurnPipeline.applyTurn(cardState, gameState, 'black', {
      type: 'place',
      expansionTarget: { row: 7, col: 7 }
    });

    expect(turn.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'board_expansion_selected',
        applied: true,
        completed: true
      })
    ]));
    expect(turn.events.some((event) => event && event.type === 'board_expansion_first_selected')).toBe(false);
    expect(turn.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(turn.gameState.boardExpansion.cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 7, col: 8 }),
      expect.objectContaining({ row: 8, col: 8 }),
      expect.objectContaining({ row: 8, col: 7 })
    ]));
  });

  test('上辺拡張セルも合法手として扱われる', () => {
    const gameState = Core.createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.currentPlayer = Core.BLACK;
    gameState.board[0][0] = Core.WHITE;
    gameState.board[1][0] = Core.BLACK;
    gameState.boardExpansion = {
      active: true,
      side: 'top',
      row: -1,
      owner: Core.EMPTY,
      usedByPlayer: { black: true, white: false },
      cells: [
        { side: 'top', row: -1, col: 0, owner: Core.EMPTY }
      ]
    };

    const legalMoves = Core.getLegalMoves(gameState, Core.BLACK, {});
    const topMove = legalMoves.find((move) => move.row === -1 && move.col === 0);
    expect(topMove).toBeTruthy();
    expect(topMove.flips).toEqual([[0, 0]]);

    const nextState = Core.applyMove(gameState, topMove);
    const topCell = Array.isArray(nextState.boardExpansion.cells)
      ? nextState.boardExpansion.cells.find((cell) => cell && cell.row === -1 && cell.col === 0)
      : null;
    expect(topCell && topCell.owner).toBe(Core.BLACK);
    expect(nextState.board[0][0]).toBe(Core.BLACK);
  });
});

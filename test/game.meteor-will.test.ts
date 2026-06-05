import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import * as SharedConstants from '../shared-constants.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';
import * as BoardOps from '../game/logic/board_ops.js';

function createPrng(randomValue = 0.5) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

describe('METEOR_WILL（因果抹消）', () => {
  test('守護中の石を貫通破壊し、穴を永続生成して再ターゲット不可にする', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'METEOR_WILL');
    expect(def).toBeTruthy();

    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.currentPlayer = Core.BLACK;
    gameState.board[3][3] = Core.BLACK;
    cardState.markers.push({
      id: 'guard_1',
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'GUARD', remainingOwnerTurns: 3 }
    });

    cardState.charge.black = 99;
    cardState.hands.black = [def.id];

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(used).toBe(true);
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('METEOR_WILL');

    const res = CardLogic.applyMeteorWill(cardState, gameState, 'black', 3, 3);
    expect(res && res.applied).toBe(true);
    expect(res && res.destroyed).toBe(true);
    expect(gameState.board[3][3]).toBe(Core.EMPTY);

    const markersAtCell = (cardState.markers || []).filter((m) => m && m.row === 3 && m.col === 3);
    expect(markersAtCell.some((m) => m.data && m.data.type === 'GUARD')).toBe(false);
    expect(markersAtCell.some((m) => m.data && m.data.type === 'METEOR_HOLE')).toBe(true);
    expect(CardLogic.isBlockedCell(cardState, 3, 3, gameState)).toBe(true);

    const context = CardLogic.getCardContext(cardState);
    const freeMoves = Core.getFreePlacementMoves(gameState, Core.BLACK, context);
    expect(freeMoves.some((m) => m.row === 3 && m.col === 3)).toBe(false);

    const meteorTargets = CardLogic.getMeteorTargets(cardState, gameState, 'black');
    expect(meteorTargets.some((t) => t.row === 3 && t.col === 3)).toBe(false);
  });

  test('盤面拡張セルも対象にでき、穴化後は配置不能になる', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.boardExpansion = {
      active: true,
      side: 'left',
      row: 5,
      owner: Core.EMPTY,
      usedByPlayer: { black: false, white: false },
      cells: [
        { side: 'left', row: 5, col: -1, owner: Core.EMPTY }
      ]
    };

    cardState.pendingEffectByPlayer.black = {
      type: 'METEOR_WILL',
      stage: 'selectTarget',
      cardId: 'meteor_01'
    };

    const res = CardLogic.applyMeteorWill(cardState, gameState, 'black', 5, -1);
    expect(res && res.applied).toBe(true);
    expect(CardLogic.isBlockedCell(cardState, 5, -1, gameState)).toBe(true);

    const context = CardLogic.getCardContext(cardState);
    const freeMoves = Core.getFreePlacementMoves(gameState, Core.BLACK, context);
    expect(freeMoves.some((m) => m.row === 5 && m.col === -1)).toBe(false);

    const meteorTargets = CardLogic.getMeteorTargets(cardState, gameState, 'black');
    expect(meteorTargets.some((t) => t.row === 5 && t.col === -1)).toBe(false);
  });

  test('絶対保護マスは因果抹消の候補に出ず、直接指定してもpendingは残る', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.board[3][3] = Core.BLACK;
    cardState.markers.push({
      id: 'abs_1',
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ABSOLUTE_PROTECTED', remainingOwnerTurns: 5 }
    });
    cardState.pendingEffectByPlayer.black = {
      type: 'METEOR_WILL',
      stage: 'selectTarget',
      cardId: 'meteor_01'
    };

    const targetsBefore = CardLogic.getMeteorTargets(cardState, gameState, 'black');
    expect(targetsBefore.some((t) => t.row === 3 && t.col === 3)).toBe(false);

    const res = CardLogic.applyMeteorWill(cardState, gameState, 'black', 3, 3);
    expect(res).toEqual({ applied: false, reason: 'invalid_target' });
    expect(cardState.pendingEffectByPlayer.black).toMatchObject({ type: 'METEOR_WILL' });
    expect(gameState.board[3][3]).toBe(Core.BLACK);
    expect((cardState.markers || []).some((m) => m && m.row === 3 && m.col === 3 && m.data && m.data.type === 'METEOR_HOLE')).toBe(false);
  });

  test('封鎖済みセルにも因果抹消を使える（封鎖を消去して穴化）', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    cardState.markers.push({
      id: 'blockade_1',
      kind: 'specialStone',
      row: 1,
      col: 1,
      owner: 'black',
      data: { type: 'BLOCKADE', remainingOwnerTurns: 3 }
    });
    cardState.pendingEffectByPlayer.black = {
      type: 'METEOR_WILL',
      stage: 'selectTarget',
      cardId: 'meteor_01'
    };

    const targetsBefore = CardLogic.getMeteorTargets(cardState, gameState, 'black');
    expect(targetsBefore.some((t) => t.row === 1 && t.col === 1)).toBe(true);

    const res = CardLogic.applyMeteorWill(cardState, gameState, 'black', 1, 1);
    expect(res && res.applied).toBe(true);

    const markersAtCell = (cardState.markers || []).filter((m) => m && m.row === 1 && m.col === 1);
    expect(markersAtCell.some((m) => m.data && m.data.type === 'BLOCKADE')).toBe(false);
    expect(markersAtCell.some((m) => m.data && m.data.type === 'METEOR_HOLE')).toBe(true);
  });

  test('凍結マスや種マスにも因果抹消を使え、既存マス状態を消去して穴化する', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.board[2][2] = Core.BLACK;
    cardState.markers.push(
      {
        id: 'freeze_1',
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'white',
        data: { type: 'FREEZE', remainingOwnerTurns: 5 }
      },
      {
        id: 'seed_1',
        kind: 'specialStone',
        row: 2,
        col: 3,
        owner: 'black',
        data: { type: 'SEED', remainingOwnerTurns: 5 }
      }
    );
    cardState.pendingEffectByPlayer.black = {
      type: 'METEOR_WILL',
      stage: 'selectTarget',
      cardId: 'meteor_01'
    };

    const targetsBefore = CardLogic.getMeteorTargets(cardState, gameState, 'black');
    expect(targetsBefore).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, col: 2 }),
      expect.objectContaining({ row: 2, col: 3 })
    ]));

    const frozenRes = CardLogic.applyMeteorWill(cardState, gameState, 'black', 2, 2);
    expect(frozenRes).toMatchObject({ applied: true, row: 2, col: 2, destroyed: true });
    expect(gameState.board[2][2]).toBe(Core.EMPTY);
    let markersAtCell = (cardState.markers || []).filter((m) => m && m.row === 2 && m.col === 2);
    expect(markersAtCell.some((m) => m.data && m.data.type === 'FREEZE')).toBe(false);
    expect(markersAtCell.some((m) => m.data && m.data.type === 'METEOR_HOLE')).toBe(true);

    cardState.pendingEffectByPlayer.black = {
      type: 'METEOR_WILL',
      stage: 'selectTarget',
      cardId: 'meteor_01'
    };
    const seedRes = CardLogic.applyMeteorWill(cardState, gameState, 'black', 2, 3);
    expect(seedRes).toMatchObject({ applied: true, row: 2, col: 3, destroyed: false });
    markersAtCell = (cardState.markers || []).filter((m) => m && m.row === 2 && m.col === 3);
    expect(markersAtCell.some((m) => m.data && m.data.type === 'SEED')).toBe(false);
    expect(markersAtCell.some((m) => m.data && m.data.type === 'METEOR_HOLE')).toBe(true);
  });

  test('復活の意志付きの石に因果抹消を使うと復活せず元マスは穴になる', () => {
    const rng = createPrng(0);
    const cardState = CardLogic.createCardState(rng);
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.currentPlayer = Core.BLACK;
    gameState.board[2][2] = Core.BLACK;

    expect(CardLogic.applyRegenWill(cardState, 'black', 2, 2)).toEqual({ applied: true });

    cardState.pendingEffectByPlayer.black = {
      type: 'METEOR_WILL',
      stage: 'selectTarget',
      cardId: 'meteor_01'
    };

    const res = CardLogic.applyMeteorWill(cardState, gameState, 'black', 2, 2, rng);
    expect(res).toMatchObject({ applied: true, row: 2, col: 2, destroyed: true });
    expect(gameState.board[2][2]).toBe(Core.EMPTY);

    const markersAtCell = (cardState.markers || []).filter((m) => m && m.row === 2 && m.col === 2);
    expect(markersAtCell.some((m) => m.data && m.data.type === 'REGEN')).toBe(false);
    expect(markersAtCell.some((m) => m.data && m.data.type === 'METEOR_HOLE')).toBe(true);
    expect(CardLogic.isBlockedCell(cardState, 2, 2, gameState)).toBe(true);
  });

  test('生きる意志付きの石に因果抹消を使うと復活せず元マスだけが穴になる', () => {
    const rng = createPrng(0);
    const cardState = CardLogic.createCardState(rng);
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.WHITE));
    gameState.currentPlayer = Core.BLACK;
    gameState.board[2][2] = Core.BLACK;
    gameState.board[5][5] = Core.EMPTY;

    cardState.pendingEffectByPlayer.black = {
      type: 'LIVING_WILL',
      stage: 'selectTarget',
      cardId: 'living_will_01'
    };
    expect(CardLogic.applyLivingWill(cardState, gameState, 'black', 2, 2)).toMatchObject({ applied: true });

    cardState.pendingEffectByPlayer.black = {
      type: 'METEOR_WILL',
      stage: 'selectTarget',
      cardId: 'meteor_01'
    };

    const res = CardLogic.applyMeteorWill(cardState, gameState, 'black', 2, 2, rng);
    expect(res).toMatchObject({ applied: true, row: 2, col: 2, destroyed: true });
    expect(gameState.board[2][2]).toBe(Core.EMPTY);
    expect(gameState.board[5][5]).toBe(Core.EMPTY);

    const originMarkers = (cardState.markers || []).filter((m) => m && m.row === 2 && m.col === 2);
    expect(originMarkers.some((m) => m.data && m.data.type === 'METEOR_HOLE')).toBe(true);
    expect(originMarkers.some((m) => m.data && m.data.type === 'LIVING_WILL')).toBe(false);
    expect((cardState.markers || []).some((m) => m && m.row === 5 && m.col === 5 && m.data && m.data.type === 'LIVING_WILL')).toBe(false);

    expect((cardState.presentationEvents || []).some((event) => (
      event &&
      event.cause === 'LIVING_WILL' &&
      (event.type === 'STATUS_REMOVED' || event.type === 'SPAWN' || event.type === 'CHANGE')
    ))).toBe(false);
  });

  test('ターン進行経由でも生きる意志付きの石へ因果抹消を使える', () => {
    const rng = createPrng(0);
    const cardState = CardLogic.createCardState(rng);
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.WHITE));
    gameState.currentPlayer = Core.BLACK;
    gameState.board[2][2] = Core.BLACK;
    gameState.board[5][5] = Core.EMPTY;

    cardState.pendingEffectByPlayer.black = {
      type: 'LIVING_WILL',
      stage: 'selectTarget',
      cardId: 'living_will_01'
    };
    expect(CardLogic.applyLivingWill(cardState, gameState, 'black', 2, 2)).toMatchObject({ applied: true });

    cardState.pendingEffectByPlayer.black = {
      type: 'METEOR_WILL',
      stage: 'selectTarget',
      cardId: 'meteor_01'
    };

    const events = [];
    TurnPipelinePhases.applyActionPhase(
      CardLogic,
      Core,
      cardState,
      gameState,
      'black',
      { type: 'place', meteorTarget: { row: 2, col: 2 } },
      events,
      rng,
      BoardOps
    );

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'meteor_selected',
        applied: true,
        destroyed: true,
        target: { row: 2, col: 2 }
      })
    ]));
    expect(gameState.board[2][2]).toBe(Core.EMPTY);
    expect(gameState.board[5][5]).toBe(Core.EMPTY);
  });
});

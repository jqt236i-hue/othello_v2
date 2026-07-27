import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';
import * as Core from '../game/logic/core.js';
import * as BoardOps from '../game/logic/board_ops.js';

function createPrng(randomValue = 0) {
  return {
    shuffle: (items: any[]) => items,
    random: () => randomValue
  };
}

function createStates(randomValue = 0) {
  const cardState = CardLogic.createCardState(createPrng(randomValue));
  const gameState = Core.createGameState();
  gameState.turnNumber = 1;
  return { cardState, gameState };
}

function marker(cardState: any, type: string, row?: number, col?: number) {
  return (cardState.markers || []).find((item: any) => (
    item &&
    item.data &&
    item.data.type === type &&
    (row === undefined || item.row === row) &&
    (col === undefined || item.col === col)
  ));
}

describe('FIRE_WILL（火の意志）', () => {
  test('カード定義・表示画像・持続定数が正しい', () => {
    const def = (Shared.CARD_DEFS || []).find((card: any) => card && card.type === 'FIRE_WILL');
    expect(def).toMatchObject({
      id: 'fire_will_01',
      cost: 21,
      card_face_art_path: 'assets/images/special-cards/backgrounds/fire_will_background.png'
    });
    expect(CardLogic.FIRE_WILL_TURNS).toBe(6);
    expect(CardLogic.SCORCHED_CELL_TURNS).toBe(10);
    expect(CardLogic.SCORCHED_STONE_TURNS).toBe(3);
  });

  test('配置時に火石を作り、同じ手番では持続を減らさず灼熱マスを1つ作る', () => {
    const prng = createPrng(0);
    const { cardState, gameState } = createStates(0);
    gameState.board[2][4] = Shared.WHITE;
    gameState.board[2][5] = Shared.BLACK;
    cardState.pendingEffectByPlayer.black = {
      type: 'FIRE_WILL',
      stage: null,
      cardId: 'fire_will_01'
    };
    const events: any[] = [];

    TurnPipelinePhases.applyActionPhase(
      CardLogic,
      Core,
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3 },
      events,
      prng,
      BoardOps
    );

    expect(marker(cardState, 'FIRE', 2, 3)).toEqual(expect.objectContaining({
      owner: 'black',
      data: expect.objectContaining({ remainingOwnerTurns: 6 })
    }));
    expect(marker(cardState, 'SCORCHED_CELL')).toEqual(expect.objectContaining({
      row: 0,
      col: 0,
      data: expect.objectContaining({ remainingTurns: 10 })
    }));
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'fire_scorched_immediate' })
    ]));
  });

  test('6回目の所有者ターン開始でも灼熱化してから火石が通常石へ戻る', () => {
    const { cardState, gameState } = createStates(0.25);
    gameState.board[4][4] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 4, 4, 'black', {
      type: 'FIRE',
      remainingOwnerTurns: 1
    });

    const result = CardLogic.processFireWillEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      4,
      4,
      createPrng(0.25)
    );

    expect(result.scorched).toHaveLength(1);
    expect(result.expired).toEqual([
      expect.objectContaining({ row: 4, col: 4, reason: 'anchor_expired' })
    ]);
    expect(marker(cardState, 'FIRE', 4, 4)).toBeFalsy();
    expect(gameState.board[4][4]).toBe(Shared.BLACK);
  });

  test('灼熱マスは毒マスを完全上書きし、既に石へ付いた毒状態は残す', () => {
    const { cardState, gameState } = createStates(0);
    gameState.board[3][3] = Shared.WHITE;
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', {
      type: 'POISON_CELL',
      remainingTurns: 7,
      appliedTurnNumber: 0
    });
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'white', {
      type: 'POISONED',
      remainingTurns: 4,
      appliedTurnNumber: 0
    });

    const result = CardLogic.applyScorchedCell(cardState, gameState, 'black', 3, 3);

    expect(result).toMatchObject({ applied: true, removedTypes: ['POISON_CELL'] });
    expect(marker(cardState, 'POISON_CELL', 3, 3)).toBeFalsy();
    expect(marker(cardState, 'POISONED', 3, 3)?.data.remainingTurns).toBe(4);
    expect(marker(cardState, 'SCORCHED_CELL', 3, 3)?.data.remainingTurns).toBe(10);
    expect(marker(cardState, 'SCORCHED', 3, 3)?.data.remainingTurns).toBe(3);
  });

  test('付与手番は減らさず、その後3手番居座った石を通常破壊する', () => {
    const { cardState, gameState } = createStates(4);
    gameState.turnNumber = 4;
    gameState.board[3][3] = Shared.WHITE;
    CardLogic.applyScorchedCell(cardState, gameState, 'black', 3, 3);

    CardLogic.processStatusCellTurnEnd(cardState, gameState, 4);
    expect(marker(cardState, 'SCORCHED', 3, 3)?.data.remainingTurns).toBe(3);
    CardLogic.processStatusCellTurnEnd(cardState, gameState, 5);
    CardLogic.processStatusCellTurnEnd(cardState, gameState, 6);
    expect(marker(cardState, 'SCORCHED', 3, 3)?.data.remainingTurns).toBe(1);
    CardLogic.processStatusCellTurnEnd(cardState, gameState, 7);
    expect(gameState.board[3][3]).toBe(Shared.EMPTY);
    expect(marker(cardState, 'SCORCHED', 3, 3)).toBeFalsy();
    expect(marker(cardState, 'SCORCHED_CELL', 3, 3)).toBeTruthy();
  });

  test('石が灼熱マスを離れるとカウントを失い、戻ると3から数え直す', () => {
    const { cardState, gameState } = createStates(1);
    gameState.board[3][3] = Shared.BLACK;
    CardLogic.applyScorchedCell(cardState, gameState, 'black', 3, 3);
    marker(cardState, 'SCORCHED', 3, 3).data.remainingTurns = 1;

    expect(BoardOps.moveAt(cardState, gameState, 3, 3, 3, 2, 'TEST', 'leave_scorch').moved).toBe(true);
    CardLogic.syncHazardContacts(cardState, gameState, 2);
    expect(marker(cardState, 'SCORCHED')).toBeFalsy();
    expect(marker(cardState, 'SCORCHED_CELL', 3, 3)).toBeTruthy();

    expect(BoardOps.moveAt(cardState, gameState, 3, 2, 3, 3, 'TEST', 'return_scorch').moved).toBe(true);
    CardLogic.syncHazardContacts(cardState, gameState, 3);
    expect(marker(cardState, 'SCORCHED', 3, 3)?.data.remainingTurns).toBe(3);
  });

  test('同じマスで反転しても灼熱カウントを維持し、マス再灼熱化でもリセットしない', () => {
    const { cardState, gameState } = createStates(1);
    gameState.board[3][3] = Shared.BLACK;
    CardLogic.applyScorchedCell(cardState, gameState, 'black', 3, 3);
    marker(cardState, 'SCORCHED', 3, 3).data.remainingTurns = 2;

    gameState.board[3][3] = Shared.WHITE;
    CardLogic.syncHazardContacts(cardState, gameState, 2);
    CardLogic.applyScorchedCell(cardState, gameState, 'white', 3, 3);

    expect(marker(cardState, 'SCORCHED', 3, 3)?.data.remainingTurns).toBe(2);
    expect(marker(cardState, 'SCORCHED_CELL', 3, 3)?.data.remainingTurns).toBe(10);
  });

  test('灼熱マス期限切れは接触中の灼熱状態も同じ解決ブロックで解除する', () => {
    const { cardState, gameState } = createStates(1);
    gameState.board[3][3] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', {
      type: 'SCORCHED_CELL',
      remainingTurns: 1,
      appliedTurnNumber: 0
    });
    CardLogic.syncHazardContacts(cardState, gameState, 0);

    CardLogic.processStatusCellTurnEnd(cardState, gameState, 1);

    expect(marker(cardState, 'SCORCHED_CELL', 3, 3)).toBeFalsy();
    expect(marker(cardState, 'SCORCHED', 3, 3)).toBeFalsy();
    expect(gameState.board[3][3]).toBe(Shared.BLACK);
  });

  test('火石は反転保護され、灼熱致死は既存の破壊回避を通る', () => {
    const { cardState, gameState } = createStates(1);
    gameState.board[1][1] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 1, 1, 'black', {
      type: 'FIRE',
      remainingOwnerTurns: 6
    });
    const context = CardLogic.getCardContext(cardState);
    expect(context.permaProtectedStones).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 1, col: 1, owner: Shared.BLACK })
    ]));

    gameState.board[3][3] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', {
      type: 'SCORCHED_CELL',
      remainingTurns: 10,
      appliedTurnNumber: 0
    });
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', {
      type: 'SCORCHED',
      remainingTurns: 1,
      appliedTurnNumber: 0,
      contactRow: 3,
      contactCol: 3
    });
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', {
      type: 'AFTERIMAGE_WILL',
      flipEvadeRemaining: 2,
      destroyEvadeRemaining: 1
    });
    const blackBefore = gameState.board.flat().filter((value: number) => value === Shared.BLACK).length;

    CardLogic.processStatusCellTurnEnd(cardState, gameState, 1);

    const blackAfter = gameState.board.flat().filter((value: number) => value === Shared.BLACK).length;
    expect(blackAfter).toBe(blackBefore);
    expect(marker(cardState, 'AFTERIMAGE_WILL')?.data.destroyEvadeRemaining).toBe(0);
    expect(marker(cardState, 'SCORCHED')).toBeFalsy();
    expect(marker(cardState, 'SCORCHED_CELL', 3, 3)).toBeTruthy();
  });
});

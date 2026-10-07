import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';
import * as Core from '../game/logic/core.js';
import * as BoardOps from '../game/logic/board_ops.js';

function createPrng(randomValue = 0) {
  return {
    shuffle: (items: any[]) => items,
    random: jest.fn(() => randomValue)
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

describe('WATER_WILL（水の意志）', () => {
  test('カード定義・背景・持続定数が正しい', () => {
    const def = (Shared.CARD_DEFS || []).find((card: any) => card && card.type === 'WATER_WILL');
    expect(def).toMatchObject({
      id: 'water_will_01',
      name: '水の意志',
      cost: 15,
      display_type_ja: '守護',
      card_face_art_path: 'assets/images/special-cards/backgrounds/water_will_background.png'
    });
    expect(CardLogic.WATER_WILL_TURNS).toBe(6);
    expect(CardLogic.HEALING_CELL_TURNS).toBe(8);
    expect(CardLogic.HEALING_CELL_DURATION_BONUS).toBe(3);
  });

  test('配置時に水石を作り、寿命を減らさず治癒マスを1つ作る', () => {
    const prng = createPrng(0);
    const { cardState, gameState } = createStates(0);
    gameState.board[2][4] = Shared.WHITE;
    gameState.board[2][5] = Shared.BLACK;
    cardState.pendingEffectByPlayer.black = {
      type: 'WATER_WILL',
      stage: null,
      cardId: 'water_will_01'
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

    expect(marker(cardState, 'WATER', 2, 3)).toEqual(expect.objectContaining({
      owner: 'black',
      data: expect.objectContaining({ remainingOwnerTurns: 6 })
    }));
    expect(marker(cardState, 'HEALING_CELL', 0, 0)).toEqual(expect.objectContaining({
      owner: null,
      data: expect.objectContaining({
        remainingTurns: 8,
        sourcePlayer: 'black'
      })
    }));
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'water_healing_cell_immediate' })
    ]));
    expect(cardState._presentationEventsPersist).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'STATUS_APPLIED',
        row: 0,
        col: 0,
        meta: expect.objectContaining({
          special: 'HEALING_CELL',
          owner: null,
          sourcePlayer: 'black',
          timer: 8,
          cause: 'WATER_WILL',
          reason: 'healing_cell_applied',
          sourceRow: 2,
          sourceCol: 3,
          sourceTrajectoryProfile: 'waterWillHealingBeam',
          subjectKind: 'cell_marker',
          stoneMutation: 'preserve'
        })
      })
    ]));
    expect(prng.random).toHaveBeenCalledTimes(1);
  });

  test('治癒マスは他の一時マスを上書きし、石状態は残す', () => {
    const { cardState, gameState } = createStates(0);
    gameState.board[3][3] = Shared.WHITE;
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, null, {
      type: 'SCORCHED_CELL',
      remainingTurns: 7,
      appliedTurnNumber: 0
    });
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'white', {
      type: 'POISONED',
      remainingTurns: 4,
      appliedTurnNumber: 0
    });
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'white', {
      type: 'SCORCHED',
      remainingTurns: 3,
      appliedTurnNumber: 0,
      contactRow: 3,
      contactCol: 3
    });

    const result = CardLogic.applyHealingCell(cardState, gameState, 'black', 3, 3, 5, 5);

    expect(result).toMatchObject({ applied: true, removedTypes: ['SCORCHED_CELL'] });
    expect(marker(cardState, 'SCORCHED_CELL', 3, 3)).toBeFalsy();
    expect(marker(cardState, 'POISONED', 3, 3)?.data.remainingTurns).toBe(4);
    expect(marker(cardState, 'SCORCHED', 3, 3)?.data.remainingTurns).toBe(3);
    expect(marker(cardState, 'HEALING_CELL', 3, 3)?.data.remainingTurns).toBe(8);

    CardLogic.processStatusCellTurnEnd(cardState, gameState, 1);

    expect(marker(cardState, 'SCORCHED', 3, 3)?.data.remainingTurns).toBe(2);
    expect(marker(cardState, 'HEALING_CELL', 3, 3)?.data.remainingTurns).toBe(8);
  });

  test('持続ターンは延命系と同じ特殊石本体だけに純粋に3加算する', () => {
    const { cardState } = createStates(0);
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, null, {
      type: 'HEALING_CELL',
      remainingTurns: 8,
      appliedTurnNumber: 0
    });
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', {
      type: 'FIRE',
      remainingOwnerTurns: 2
    });
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', {
      type: 'GUARD',
      remainingOwnerTurns: 4
    });
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', {
      type: 'POISONED',
      remainingTurns: 4,
      appliedTurnNumber: 0
    });
    CardLogic.addMarker(cardState, 'specialStone', 3, 3, 'black', {
      type: 'TIME_BOMB',
      category: 'bomb',
      remainingTurns: 3
    });
    CardLogic.addMarker(cardState, 'manifestStone', 3, 3, 'black', {
      type: 'THEORY_INCARNATION',
      remainingOwnerTurns: 3
    });

    const result = CardLogic.processHealingCellDurationBoosts(cardState, 'black');

    expect(result).toMatchObject({
      affectedCount: 1,
      details: [
        expect.objectContaining({
          special: 'FIRE',
          previousRemainingOwnerTurns: 2,
          newRemainingOwnerTurns: 5,
          addedTurns: 3
        })
      ]
    });
    expect(marker(cardState, 'FIRE')?.data.remainingOwnerTurns).toBe(5);
    expect(marker(cardState, 'GUARD')?.data.remainingOwnerTurns).toBe(4);
    expect(marker(cardState, 'POISONED')?.data.remainingTurns).toBe(4);
    expect(marker(cardState, 'TIME_BOMB')?.data.remainingTurns).toBe(3);
    expect(marker(cardState, 'THEORY_INCARNATION')?.data.remainingOwnerTurns).toBe(3);
    expect(marker(cardState, 'HEALING_CELL')?.data.remainingTurns).toBe(8);
  });

  test('ターン開始時は既存治癒を先に加算し、新規治癒は同じ開始処理へ遡らない', () => {
    const prng = createPrng(0);
    const { cardState, gameState } = createStates(0);
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY));
    gameState.board[4][4] = Shared.BLACK;
    gameState.board[0][0] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 4, 4, null, {
      type: 'HEALING_CELL',
      remainingTurns: 8,
      appliedTurnNumber: 0
    });
    CardLogic.addMarker(cardState, 'specialStone', 4, 4, 'black', {
      type: 'WATER',
      remainingOwnerTurns: 1
    });
    CardLogic.addMarker(cardState, 'specialStone', 0, 0, 'black', {
      type: 'SNIPER',
      remainingOwnerTurns: 6
    });
    const events: any[] = [];

    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', events, prng);

    expect(marker(cardState, 'WATER', 4, 4)?.data.remainingOwnerTurns).toBe(3);
    expect(marker(cardState, 'SNIPER', 0, 0)?.data.remainingOwnerTurns).toBe(5);
    expect(marker(cardState, 'HEALING_CELL', 0, 0)).toBeTruthy();
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'water_duration_added_start' }),
      expect.objectContaining({ type: 'water_healing_cell_start' })
    ]));
  });

  describe('治癒マスの対象は自分の特殊石を優先する', () => {
    function createWaterBoard(randomValue: number) {
      const prng = createPrng(randomValue);
      const { cardState, gameState } = createStates(randomValue);
      gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY));
      gameState.board[4][4] = Shared.BLACK;
      CardLogic.addMarker(cardState, 'specialStone', 4, 4, 'black', {
        type: 'WATER',
        remainingOwnerTurns: 6
      });
      return { prng, cardState, gameState };
    }

    function healingCells(cardState: any) {
      return (cardState.markers || [])
        .filter((item: any) => item && item.data && item.data.type === 'HEALING_CELL')
        .map((item: any) => ({ row: item.row, col: item.col }));
    }

    test('自分の特殊石があれば、その位置に治癒マスを出す', () => {
      const { prng, cardState, gameState } = createWaterBoard(0);
      gameState.board[6][5] = Shared.BLACK;
      CardLogic.addMarker(cardState, 'specialStone', 6, 5, 'black', {
        type: 'SNIPER',
        remainingOwnerTurns: 6
      });

      CardLogic.processWaterWillEffectsAtAnchor(cardState, gameState, 'black', 4, 4, prng);

      expect(healingCells(cardState)).toEqual([{ row: 6, col: 5 }]);
      expect(prng.random).toHaveBeenCalledTimes(1);
    });

    test('自分の特殊石が複数あれば、その中からランダムに選ぶ', () => {
      const setup = (randomValue: number) => {
        const states = createWaterBoard(randomValue);
        for (const [row, col, type] of [[1, 6, 'FIRE'], [6, 2, 'GRASS']] as Array<[number, number, string]>) {
          states.gameState.board[row][col] = Shared.BLACK;
          CardLogic.addMarker(states.cardState, 'specialStone', row, col, 'black', {
            type,
            remainingOwnerTurns: 6
          });
        }
        CardLogic.processWaterWillEffectsAtAnchor(states.cardState, states.gameState, 'black', 4, 4, states.prng);
        return healingCells(states.cardState);
      };

      expect(setup(0)).toEqual([{ row: 1, col: 6 }]);
      expect(setup(0.99)).toEqual([{ row: 6, col: 2 }]);
    });

    test('発動元の水石自身・相手の特殊石・石状態は優先対象にせず、従来どおり全マスからランダムに選ぶ', () => {
      const { prng, cardState, gameState } = createWaterBoard(0);
      gameState.board[6][6] = Shared.WHITE;
      CardLogic.addMarker(cardState, 'specialStone', 6, 6, 'white', {
        type: 'SNIPER',
        remainingOwnerTurns: 6
      });
      gameState.board[2][2] = Shared.BLACK;
      CardLogic.addMarker(cardState, 'specialStone', 2, 2, 'black', {
        type: 'GUARD',
        remainingOwnerTurns: 4
      });

      CardLogic.processWaterWillEffectsAtAnchor(cardState, gameState, 'black', 4, 4, prng);

      expect(healingCells(cardState)).toEqual([{ row: 0, col: 0 }]);
    });

    test('自分の所有でも相手色に変わっているマスの特殊石は優先対象にしない', () => {
      const { prng, cardState, gameState } = createWaterBoard(0);
      gameState.board[5][5] = Shared.WHITE;
      CardLogic.addMarker(cardState, 'specialStone', 5, 5, 'black', {
        type: 'SNIPER',
        remainingOwnerTurns: 6
      });

      CardLogic.processWaterWillEffectsAtAnchor(cardState, gameState, 'black', 4, 4, prng);

      expect(healingCells(cardState)).toEqual([{ row: 0, col: 0 }]);
    });

    test('別の自分の水石は優先対象になる', () => {
      const { prng, cardState, gameState } = createWaterBoard(0);
      gameState.board[7][7] = Shared.BLACK;
      CardLogic.addMarker(cardState, 'specialStone', 7, 7, 'black', {
        type: 'WATER',
        remainingOwnerTurns: 6
      });

      CardLogic.processWaterWillEffectsAtAnchor(cardState, gameState, 'black', 4, 4, prng);

      expect(healingCells(cardState)).toEqual([{ row: 7, col: 7 }]);
    });
  });

  test('治癒マスは成立手番を減らさず、以後の完了手番で減って0で消える', () => {
    const { cardState, gameState } = createStates(0);
    gameState.turnNumber = 4;
    CardLogic.applyHealingCell(cardState, gameState, 'black', 3, 3);

    CardLogic.processStatusCellTurnEnd(cardState, gameState, 4);
    expect(marker(cardState, 'HEALING_CELL', 3, 3)?.data.remainingTurns).toBe(8);
    CardLogic.processStatusCellTurnEnd(cardState, gameState, 5);
    expect(marker(cardState, 'HEALING_CELL', 3, 3)?.data.remainingTurns).toBe(7);

    marker(cardState, 'HEALING_CELL', 3, 3).data.remainingTurns = 1;
    const result = CardLogic.processStatusCellTurnEnd(cardState, gameState, 6);

    expect(result.expiredHealingCellCount).toBe(1);
    expect(marker(cardState, 'HEALING_CELL', 3, 3)).toBeFalsy();
  });

  test('水石は反転無効されるが通常の破壊対象になる', () => {
    const { cardState, gameState } = createStates(0);
    gameState.board[1][1] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 1, 1, 'black', {
      type: 'WATER',
      remainingOwnerTurns: 6
    });

    const context = CardLogic.getCardContext(cardState);
    expect(context.permaProtectedStones).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 1, col: 1, owner: Shared.BLACK })
    ]));

    const destroyed = BoardOps.destroyAt(cardState, gameState, 1, 1, 'TEST', 'water_destroyed');
    expect(destroyed.destroyed).toBe(true);
    expect(gameState.board[1][1]).toBe(Shared.EMPTY);
    expect(marker(cardState, 'WATER', 1, 1)).toBeFalsy();
  });
});

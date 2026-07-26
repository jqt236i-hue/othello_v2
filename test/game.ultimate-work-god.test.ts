import * as CardLogic from '../game/logic/cards.js';
import * as BoardOps from '../game/logic/board_ops.js';
import * as UltimateWorkGod from '../game/logic/cards/ultimate_work_god';
import * as TurnStartSpecialStonePhase from '../game/turn/turn-start/special-stone-phase';

describe('ULTIMATE_WORK_GOD（究極労働神）', () => {
  function makeState(chance = 0) {
    const prng = { shuffle: (items: any[]) => items, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1,
      turnNumber: 1,
      consecutivePasses: 0
    };
    gameState.board[2][2] = 1;
    cardState.markers.push({
      id: 100,
      createdSeq: 100,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: {
        type: 'ULTIMATE_WORK_GOD',
        ownerColor: 'black',
        selfDestructChancePercent: chance
      }
    });
    return { cardState, gameState };
  }

  test('初回は0%から1%へ上げて抽選し、外れなら布石を5得る', () => {
    const { cardState, gameState } = makeState(0);
    const random = jest.fn(() => 0.5);

    const result = UltimateWorkGod.processUltimateWorkGodAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      2,
      2,
      {
        BoardOps,
        addChargeWithTotal: (state: any, player: string, amount: number) => {
          state.charge[player] += amount;
          return amount;
        },
        randomSource: { random }
      }
    );

    expect(random).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      processed: true,
      chancePercent: 1,
      selfDestructTriggered: false,
      gained: 5
    });
    expect(cardState.charge.black).toBe(5);
    expect(cardState.markers[0].data.selfDestructChancePercent).toBe(1);
    expect(cardState.presentationEvents).toContainEqual(expect.objectContaining({
      type: 'ULTIMATE_WORK_GOD_INCOME',
      player: 'black',
      row: 2,
      col: 2,
      gained: 5
    }));
  });

  test('自壊抽選に当たると通常破壊を呼び、破壊が防がれても収入しない', () => {
    const { cardState, gameState } = makeState(41);
    const destroyAt = jest.fn(() => ({ kind: 'regenerated', destroyed: false, regenerated: true }));
    const addChargeWithTotal = jest.fn();

    const result = UltimateWorkGod.processUltimateWorkGodAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      2,
      2,
      {
        BoardOps: {
          getCellValue: BoardOps.getCellValue,
          destroyAt,
          emitPresentationEvent: BoardOps.emitPresentationEvent
        },
        addChargeWithTotal,
        randomSource: { random: () => 0 }
      }
    );

    expect(result).toMatchObject({
      chancePercent: 42,
      selfDestructTriggered: true,
      selfDestructed: false,
      gained: 0
    });
    expect(addChargeWithTotal).not.toHaveBeenCalled();
    expect(destroyAt).toHaveBeenCalledWith(
      cardState,
      gameState,
      2,
      2,
      'ULTIMATE_WORK_GOD',
      'ultimate_work_god_self_destruct',
      expect.objectContaining({
        selfDestruct: true,
        selfDestructChancePercent: 42
      })
    );
  });

  test('通常破壊が成立した時だけ自壊済みとなる', () => {
    const { cardState, gameState } = makeState(0);

    const result = CardLogic.processUltimateWorkGodAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      2,
      2,
      { random: () => 0 }
    );

    expect(result).toMatchObject({
      chancePercent: 1,
      selfDestructTriggered: true,
      selfDestructed: true,
      gained: 0
    });
    expect(gameState.board[2][2]).toBe(0);
    expect(cardState.markers.some((marker: any) => marker.data?.type === 'ULTIMATE_WORK_GOD')).toBe(false);
    expect(cardState.presentationEvents).toContainEqual(expect.objectContaining({
      type: 'DESTROY',
      row: 2,
      col: 2,
      cause: 'ULTIMATE_WORK_GOD',
      reason: 'ultimate_work_god_self_destruct',
      meta: expect.objectContaining({
        special: 'ULTIMATE_WORK_GOD',
        selfDestruct: true
      })
    }));
  });

  test('生きる意志で復活した場合は自壊確率を0%へ戻す', () => {
    const { cardState, gameState } = makeState(37);
    cardState.pendingEffectByPlayer.black = { type: 'LIVING_WILL', stage: 'selectTarget' };
    expect(CardLogic.applyLivingWill(cardState, gameState, 'black', 2, 2)).toMatchObject({ applied: true });

    const result = CardLogic.processUltimateWorkGodAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      2,
      2,
      { random: () => 0 }
    );

    expect(result.destroyResult).toMatchObject({
      kind: 'living_will_restored',
      livingWillRevived: true
    });
    const restored = cardState.markers.find((marker: any) => marker.data?.type === 'ULTIMATE_WORK_GOD');
    expect(restored).toBeTruthy();
    expect(restored.data.selfDestructChancePercent).toBe(0);
  });

  test('複数個体は登場順にそれぞれ確率を上げて独立抽選する', () => {
    const { cardState, gameState } = makeState(4);
    gameState.board[4][4] = 1;
    cardState.markers.push({
      id: 101,
      createdSeq: 101,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: {
        type: 'ULTIMATE_WORK_GOD',
        ownerColor: 'black',
        selfDestructChancePercent: 8
      }
    });
    const random = jest.fn()
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.99);

    const first = CardLogic.processUltimateWorkGodAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      2,
      2,
      { random }
    );
    const second = CardLogic.processUltimateWorkGodAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      4,
      4,
      { random }
    );

    expect(random).toHaveBeenCalledTimes(2);
    expect(first).toMatchObject({ chancePercent: 5, selfDestructTriggered: false, gained: 5 });
    expect(second).toMatchObject({ chancePercent: 9, selfDestructTriggered: false, gained: 5 });
    expect(cardState.charge.black).toBe(10);
    expect(cardState.presentationEvents.filter((event: any) => event.type === 'ULTIMATE_WORK_GOD_INCOME')).toEqual([
      expect.objectContaining({ row: 2, col: 2, selfDestructChancePercent: 5 }),
      expect.objectContaining({ row: 4, col: 4, selfDestructChancePercent: 9 })
    ]);
  });

  test('アンカー座標が隕石穴なら下層の石を参照せず処理しない', () => {
    const { cardState, gameState } = makeState(12);
    cardState.markers.push({
      id: 200,
      createdSeq: 200,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'METEOR_HOLE' }
    });
    const random = jest.fn(() => 0);

    const result = CardLogic.processUltimateWorkGodAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      2,
      2,
      { random }
    );

    expect(result).toMatchObject({ processed: false, reason: 'anchor_lost', row: 2, col: 2 });
    expect(random).not.toHaveBeenCalled();
    expect(cardState.charge.black).toBe(0);
    expect(cardState.markers[0].data.selfDestructChancePercent).toBe(12);
    expect(gameState.board[2][2]).toBe(1);
  });

  test('凍結中はターン開始アンカー処理も乱数消費も行わない', () => {
    const { cardState, gameState } = makeState(12);
    const processUltimateWorkGodAtTurnStartAnchor = jest.fn();
    const events: any[] = [];

    TurnStartSpecialStonePhase.processTurnStartSpecialStone({
      cardState,
      gameState,
      playerKey: 'black',
      markerAnchor: { marker: cardState.markers[0], createdSeq: 100 },
      prng: { random: jest.fn() },
      CardLogic: { processUltimateWorkGodAtTurnStartAnchor },
      events,
      isFrozenCell: () => true
    } as any);

    expect(processUltimateWorkGodAtTurnStartAnchor).not.toHaveBeenCalled();
    expect(events).toEqual([]);
    expect(cardState.markers[0].data.selfDestructChancePercent).toBe(12);
  });
});

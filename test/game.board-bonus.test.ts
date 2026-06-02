import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as CardExpansion from '../game/logic/cards/expansion.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';
import * as TurnPipelineUIAdapter from '../game/turn/pipeline_ui_adapter.js';

function createInitialGameState() {
  const gameState = {
    board: Array(8).fill(null).map(() => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  gameState.board[3][3] = Shared.WHITE;
  gameState.board[3][4] = Shared.BLACK;
  gameState.board[4][3] = Shared.BLACK;
  gameState.board[4][4] = Shared.WHITE;
  return gameState;
}

function createDeterministicPrng() {
  return {
    shuffle: (arr) => arr,
    random: () => 0.1
  };
}

const centralOpeningZoneKeys = ['2,2', '2,3', '2,4', '2,5', '3,2', '3,3', '3,4', '3,5', '4,2', '4,3', '4,4', '4,5', '5,2', '5,3', '5,4', '5,5'];

function createHighBonusPressurePrng() {
  const centralOpeningZone = new Set(centralOpeningZoneKeys);
  return {
    shuffle: (arr) => {
      if (!Array.isArray(arr)) return arr;
      if (arr.every((value) => typeof value === 'number')) {
        arr.sort((a, b) => b - a);
        return arr;
      }
      if (arr.every((value) => value && typeof value === 'object' && Number.isInteger(value.row) && Number.isInteger(value.col))) {
        arr.sort((a, b) => {
          const aInZone = centralOpeningZone.has(`${a.row},${a.col}`) ? 0 : 1;
          const bInZone = centralOpeningZone.has(`${b.row},${b.col}`) ? 0 : 1;
          if (aInZone !== bInZone) return aInZone - bInZone;
          if (a.row !== b.row) return a.row - b.row;
          return a.col - b.col;
        });
        return arr;
      }
      return arr;
    },
    random: () => 0.1
  };
}

describe('数字マス（初期配置・配置報酬）', () => {
  test('初期配置で40マスが所定内訳で割り当てられる', () => {
    const cardState = CardLogic.createCardState(createDeterministicPrng());
    const bonus = cardState.boardBonusByCell || {};
    const entries = Object.entries(bonus);
    const excluded = new Set([
      '3,3', '3,4', '4,3', '4,4',
      '2,3', '2,4', '5,3', '5,4',
      '3,2', '4,2', '3,5', '4,5'
    ]);

    expect(entries).toHaveLength(40);

    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
    for (const [key, value] of entries) {
      expect(excluded.has(key)).toBe(false);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(10);
      counts[value] += 1;
    }

    expect(counts[1]).toBe(9);
    expect(counts[2]).toBe(8);
    expect(counts[3]).toBe(6);
    expect(counts[4]).toBe(5);
    expect(counts[5]).toBe(4);
    expect(counts[6]).toBe(3);
    expect(counts[7]).toBe(2);
    expect(counts[8]).toBe(1);
    expect(counts[9]).toBe(1);
    expect(counts[10]).toBe(1);
    expect(Object.keys(cardState.boardBonusConsumedByCell || {})).toHaveLength(0);
  });

  test('数字マスは配置時に1回だけ加算され、空きに戻っても復活しない', () => {
    const prng = createDeterministicPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = createInitialGameState();

    const targetKey = '0,0';
    const targetBonus = Number(cardState.boardBonusByCell[targetKey] || 0);
    expect(targetBonus).toBeGreaterThan(0);

    cardState.pendingEffectByPlayer.black = { type: 'FREE_PLACEMENT', stage: 'awaitPlace' };
    const blackChargeBefore = Number(cardState.charge.black || 0);

    const first = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 0, col: 0 },
      prng
    );
    const firstBubble = (first.presentationEvents || []).find((ev) => ev && ev.type === 'CHARGE_BUBBLE' && ev.meta && ev.meta.sourceType === 'number_cell_gain');

    const blackChargeAfter = Number(cardState.charge.black || 0);
    expect(blackChargeAfter - blackChargeBefore).toBe(targetBonus);
    expect(cardState.boardBonusConsumedByCell[targetKey]).toBe(true);
    expect(firstBubble).toMatchObject({ row: 0, col: 0, gained: targetBonus });

    gameState.board[0][0] = Shared.EMPTY;
    gameState.currentPlayer = Shared.WHITE;
    cardState.pendingEffectByPlayer.white = { type: 'FREE_PLACEMENT', stage: 'awaitPlace' };

    const second = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'white',
      { type: 'place', row: 0, col: 0 },
      prng
    );

    const secondBonusEvent = second.events.find((ev) => ev && ev.type === 'board_bonus_gain');
    expect(secondBonusEvent).toBeFalsy();
    expect(cardState.boardBonusConsumedByCell[targetKey]).toBe(true);
  });

  test('開始直後の合法4マスには数字マスが配置されない', () => {
    const cardState = CardLogic.createCardState(createDeterministicPrng());
    const bonus = cardState.boardBonusByCell || {};
    const openingMoves = ['2,3', '3,2', '4,5', '5,4'];

    for (const key of openingMoves) {
      expect(Number(bonus[key] || 0)).toBe(0);
    }
  });

  test('8x8以上では初期石まわりの中央4x4に6以上の数字マスを配置しない', () => {
    const cardState = CardLogic.createCardState(createHighBonusPressurePrng(), { boardConfig: { rows: 8, cols: 8 } });
    const bonus = cardState.boardBonusByCell || {};

    expect(Object.keys(bonus)).toHaveLength(40);
    for (const key of centralOpeningZoneKeys) {
      expect(Number(bonus[key] || 0)).toBeLessThanOrEqual(5);
    }
    expect(Object.entries(bonus).some(([key, value]) => !centralOpeningZoneKeys.includes(key) && Number(value) >= 6)).toBe(true);
  });

  test('片側が8未満の盤面では中央4x4の高数字制限を適用しない', () => {
    const bonus = CardExpansion.buildInitialBoardBonusMap(createHighBonusPressurePrng(), { rows: 7, cols: 9 });
    const centralHighBonus = centralOpeningZoneKeys
      .map((key) => Number(bonus[key] || 0))
      .filter((value) => value >= 6);

    expect(centralHighBonus.length).toBeGreaterThan(0);
  });

  test('リバーシモードの初期状態では数字マスを生成しない', () => {
    const cardState = CardLogic.createCardState(createDeterministicPrng(), { plainReversi: true });

    expect(cardState.decks.black).toEqual([]);
    expect(cardState.decks.white).toEqual([]);
    expect(cardState.boardBonusByCell).toEqual({});
    expect(cardState.boardBonusConsumedByCell).toEqual({});
  });

  test('リバーシモードでは残存した数字マス情報があっても加算しない', () => {
    const prng = createDeterministicPrng();
    const cardState = CardLogic.createCardState(prng, { plainReversi: true });
    const gameState = createInitialGameState();
    cardState.boardBonusByCell = { '2,3': 7 };

    TurnPipelinePhases.setTurnPipelinePhasesRuntime({ MATCH_MODE: 'reversi' });
    try {
      const result = TurnPipeline.applyTurn(
        cardState,
        gameState,
        'black',
        { type: 'place', row: 2, col: 3 },
        prng,
        { skipTurnStart: true }
      );

      expect(result.events.find((ev) => ev && ev.type === 'board_bonus_gain')).toBeFalsy();
      expect(cardState.boardBonusConsumedByCell['2,3']).toBeUndefined();
      expect(cardState.charge.black).toBe(0);
      expect(result.presentationEvents.filter((ev) => ev && ev.type === 'CHARGE_BUBBLE')).toHaveLength(0);
    } finally {
      TurnPipelinePhases.setTurnPipelinePhasesRuntime(null);
    }
  });

  test('CRYSTAL_STONE は次の数字マス布石だけを2倍にし、配置石は通常石のまま残る', () => {
    const prng = createDeterministicPrng();
    const cardState = CardLogic.createCardState(prng);
    const targetKey = Object.keys(cardState.boardBonusByCell || {}).find((key) => {
      const parts = String(key).split(',').map(Number);
      return parts.length === 2 && Number.isInteger(parts[0]) && Number.isInteger(parts[1]) && parts[1] <= 5;
    });

    expect(targetKey).toBeTruthy();
    const [row, col] = String(targetKey).split(',').map(Number);
    const targetBonus = Number(cardState.boardBonusByCell[targetKey] || 0);
    expect(targetBonus).toBeGreaterThan(0);

    const gameState = {
      board: Array(8).fill(null).map(() => Array(8).fill(Shared.EMPTY)),
      currentPlayer: Shared.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };
    gameState.board[row][col + 1] = Shared.WHITE;
    gameState.board[row][col + 2] = Shared.BLACK;

    cardState.pendingEffectByPlayer.black = { type: 'CRYSTAL_STONE', stage: 'awaitPlace' };
    const blackChargeBefore = Number(cardState.charge.black || 0);

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row, col },
      prng
    );

    const placementEffects = result.events.find((ev) => ev && ev.type === 'placement_effects');
    const bonusEvent = result.events.find((ev) => ev && ev.type === 'board_bonus_gain');
    const chargeBubbles = (result.presentationEvents || []).filter((ev) => ev && ev.type === 'CHARGE_BUBBLE');
    const combinedBubble = chargeBubbles[0] || null;

    expect(Number(cardState.charge.black || 0) - blackChargeBefore).toBe(1 + (targetBonus * 2));
    expect(bonusEvent).toMatchObject({ bonus: targetBonus, gained: targetBonus * 2, multiplier: 2, boostedBy: 'CRYSTAL_STONE' });
    expect(placementEffects && placementEffects.effects).toMatchObject({ crystalStoneUsed: true, crystalStoneGain: targetBonus * 2, chargeGained: 1 });
    expect(chargeBubbles).toHaveLength(1);
    expect(combinedBubble).toMatchObject({ row, col, gained: targetBonus * 2 + 1 });
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(gameState.board[row][col]).toBe(Shared.BLACK);
  });

});

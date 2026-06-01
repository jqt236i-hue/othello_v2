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

  test('THEORY_INCARNATION は配置後、所有者の数字マス布石を2倍にする', () => {
    const prng = createDeterministicPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array(8).fill(null).map(() => Array(8).fill(Shared.EMPTY)),
      currentPlayer: Shared.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };
    gameState.board[2][4] = Shared.WHITE;
    gameState.board[2][5] = Shared.BLACK;

    cardState.pendingEffectByPlayer.black = { type: 'THEORY_INCARNATION', stage: 'awaitPlace' };
    TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 }, prng);

    const marker = cardState.markers.find((entry) => entry && entry.kind === 'specialStone' && entry.data && entry.data.type === 'THEORY_INCARNATION');
    expect(marker).toMatchObject({ row: 2, col: 3, owner: 'black', data: { remainingOwnerTurns: 10 } });

    const targetKey = '0,0';
    const targetBonus = Number(cardState.boardBonusByCell[targetKey] || 0);
    expect(targetBonus).toBeGreaterThan(0);
    gameState.board[0][1] = Shared.WHITE;
    gameState.board[0][2] = Shared.BLACK;
    gameState.currentPlayer = Shared.BLACK;
    const before = Number(cardState.charge.black || 0);

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 0, col: 0 },
      prng,
      { skipTurnStart: true }
    );

    const bonusEvent = result.events.find((ev) => ev && ev.type === 'board_bonus_gain');
    const placementEffects = result.events.find((ev) => ev && ev.type === 'placement_effects');
    const theoryTicks = (result.presentationEvents || []).filter((ev) => (
      ev &&
      ev.type === 'STATUS_TICK' &&
      ev.meta &&
      ev.meta.reason === 'theory_incarnation_number_bonus'
    ));
    const playback = TurnPipelineUIAdapter.mapToPlaybackEvents(
      result.presentationEvents || [],
      result.cardState,
      result.gameState
    );

    expect(Number(cardState.charge.black || 0) - before).toBe(1 + (targetBonus * 2));
    expect(bonusEvent).toMatchObject({ bonus: targetBonus, gained: targetBonus * 2, multiplier: 2, boostedBy: 'THEORY_INCARNATION' });
    expect(placementEffects.effects).toMatchObject({ theoryIncarnationUsed: true, theoryIncarnationGain: targetBonus * 2, chargeGained: 1 });
    expect(theoryTicks).toEqual([
      expect.objectContaining({
        type: 'STATUS_TICK',
        row: 2,
        col: 3,
        meta: expect.objectContaining({
          special: 'THEORY_INCARNATION',
          timer: 10,
          owner: 'black',
          reason: 'theory_incarnation_number_bonus',
          highlightTone: 'positive'
        })
      })
    ]);
    expect(playback).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'status_applied',
        rawType: 'STATUS_TICK',
        meta: expect.objectContaining({
          special: 'THEORY_INCARNATION',
          timer: 10,
          owner: 'black',
          reason: 'theory_incarnation_number_bonus',
          highlightTone: 'positive'
        }),
        targets: [expect.objectContaining({ r: 2, col: 3 })]
      })
    ]));
  });

  test('THEORY_INCARNATION が複数ある時は同所有者アンカー全てを紫ハイライトし、倍率は2倍のまま', () => {
    const prng = createDeterministicPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array(8).fill(null).map(() => Array(8).fill(Shared.EMPTY)),
      currentPlayer: Shared.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };

    gameState.board[2][2] = Shared.BLACK;
    gameState.board[5][5] = Shared.BLACK;
    gameState.board[6][6] = Shared.WHITE;
    CardLogic.addMarker(cardState, 'specialStone', 2, 2, 'black', { type: 'THEORY_INCARNATION', remainingOwnerTurns: 10 });
    CardLogic.addMarker(cardState, 'specialStone', 5, 5, 'black', { type: 'THEORY_INCARNATION', remainingOwnerTurns: 7 });
    CardLogic.addMarker(cardState, 'specialStone', 6, 6, 'white', { type: 'THEORY_INCARNATION', remainingOwnerTurns: 9 });

    const targetKey = '0,0';
    const targetBonus = Number(cardState.boardBonusByCell[targetKey] || 0);
    expect(targetBonus).toBeGreaterThan(0);
    cardState.pendingEffectByPlayer.black = { type: 'FREE_PLACEMENT', stage: 'awaitPlace' };
    const before = Number(cardState.charge.black || 0);

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 0, col: 0 },
      prng,
      { skipTurnStart: true }
    );

    const bonusEvent = result.events.find((ev) => ev && ev.type === 'board_bonus_gain');
    const theoryTicks = (result.presentationEvents || []).filter((ev) => (
      ev &&
      ev.type === 'STATUS_TICK' &&
      ev.meta &&
      ev.meta.reason === 'theory_incarnation_number_bonus'
    ));

    expect(Number(cardState.charge.black || 0) - before).toBe(targetBonus * 2);
    expect(bonusEvent).toMatchObject({ bonus: targetBonus, gained: targetBonus * 2, multiplier: 2, boostedBy: 'THEORY_INCARNATION' });
    expect(theoryTicks).toHaveLength(2);
    expect(theoryTicks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 2,
        col: 2,
        meta: expect.objectContaining({ timer: 10, owner: 'black', special: 'THEORY_INCARNATION' })
      }),
      expect.objectContaining({
        row: 5,
        col: 5,
        meta: expect.objectContaining({ timer: 7, owner: 'black', special: 'THEORY_INCARNATION' })
      })
    ]));
    expect(theoryTicks.some((ev) => ev && ev.row === 6 && ev.col === 6)).toBe(false);
  });

  test('THEORY_INCARNATION は数字マス以外の配置では発動ハイライトを出さない', () => {
    const prng = createDeterministicPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array(8).fill(null).map(() => Array(8).fill(Shared.EMPTY)),
      currentPlayer: Shared.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };

    gameState.board[0][0] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 0, 0, 'black', { type: 'THEORY_INCARNATION', remainingOwnerTurns: 10 });
    cardState.pendingEffectByPlayer.black = { type: 'FREE_PLACEMENT', stage: 'awaitPlace' };

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3 },
      prng,
      { skipTurnStart: true }
    );

    expect(result.events.find((ev) => ev && ev.type === 'board_bonus_gain')).toBeFalsy();
    expect((result.presentationEvents || []).some((ev) => (
      ev &&
      ev.type === 'STATUS_TICK' &&
      ev.meta &&
      ev.meta.reason === 'theory_incarnation_number_bonus'
    ))).toBe(false);
  });

  test('THEORY_INCARNATION は消費済み数字マスへの再配置では発動ハイライトを出さない', () => {
    const prng = createDeterministicPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array(8).fill(null).map(() => Array(8).fill(Shared.EMPTY)),
      currentPlayer: Shared.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };

    gameState.board[2][2] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 2, 2, 'black', { type: 'THEORY_INCARNATION', remainingOwnerTurns: 10 });
    cardState.pendingEffectByPlayer.black = { type: 'FREE_PLACEMENT', stage: 'awaitPlace' };

    TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 0, col: 0 },
      prng,
      { skipTurnStart: true }
    );

    gameState.board[0][0] = Shared.EMPTY;
    gameState.currentPlayer = Shared.BLACK;
    cardState.pendingEffectByPlayer.black = { type: 'FREE_PLACEMENT', stage: 'awaitPlace' };

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 0, col: 0 },
      prng,
      { skipTurnStart: true }
    );

    expect(result.events.find((ev) => ev && ev.type === 'board_bonus_gain')).toBeFalsy();
    expect((result.presentationEvents || []).some((ev) => (
      ev &&
      ev.type === 'STATUS_TICK' &&
      ev.meta &&
      ev.meta.reason === 'theory_incarnation_number_bonus'
    ))).toBe(false);
  });

  test('THEORY_INCARNATION は布石上限で実獲得が0なら発動ハイライトを出さない', () => {
    const prng = createDeterministicPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array(8).fill(null).map(() => Array(8).fill(Shared.EMPTY)),
      currentPlayer: Shared.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };

    gameState.board[2][2] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 2, 2, 'black', { type: 'THEORY_INCARNATION', remainingOwnerTurns: 10 });
    cardState.charge.black = 99;
    cardState.pendingEffectByPlayer.black = { type: 'FREE_PLACEMENT', stage: 'awaitPlace' };

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 0, col: 0 },
      prng,
      { skipTurnStart: true }
    );

    const bonusEvent = result.events.find((ev) => ev && ev.type === 'board_bonus_gain');

    expect(cardState.charge.black).toBe(99);
    expect(bonusEvent).toMatchObject({
      row: 0,
      col: 0,
      multiplier: 2,
      boostedBy: 'THEORY_INCARNATION',
      gained: 0
    });
    expect((result.presentationEvents || []).some((ev) => (
      ev &&
      ev.type === 'STATUS_TICK' &&
      ev.meta &&
      ev.meta.reason === 'theory_incarnation_number_bonus'
    ))).toBe(false);
  });

  test('THEORY_INCARNATION は通常反転で特殊石状態を失い、倍率も終了する', () => {
    const prng = createDeterministicPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array(8).fill(null).map(() => Array(8).fill(Shared.EMPTY)),
      currentPlayer: Shared.WHITE,
      turnNumber: 1,
      consecutivePasses: 0
    };
    gameState.board[0][0] = Shared.WHITE;
    gameState.board[0][1] = Shared.BLACK;
    gameState.board[0][2] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 0, 2, 'black', { type: 'THEORY_INCARNATION', remainingOwnerTurns: 10 });

    TurnPipeline.applyTurn(cardState, gameState, 'white', { type: 'place', row: 0, col: 3 }, prng, { skipTurnStart: true });

    expect(gameState.board[0][2]).toBe(Shared.WHITE);
    expect(cardState.markers.some((entry) => entry && entry.data && entry.data.type === 'THEORY_INCARNATION')).toBe(false);

    const targetKey = '1,0';
    const targetBonus = Number(cardState.boardBonusByCell[targetKey] || 0);
    expect(targetBonus).toBeGreaterThan(0);
    gameState.board[1][1] = Shared.WHITE;
    gameState.board[1][2] = Shared.BLACK;
    gameState.currentPlayer = Shared.BLACK;
    const before = Number(cardState.charge.black || 0);
    const result = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 1, col: 0 }, prng, { skipTurnStart: true });
    const bonusEvent = result.events.find((ev) => ev && ev.type === 'board_bonus_gain');

    expect(Number(cardState.charge.black || 0) - before).toBe(1 + targetBonus);
    expect(bonusEvent).toMatchObject({ bonus: targetBonus, gained: targetBonus, multiplier: 1, boostedBy: null });
  });

  test('THEORY_INCARNATION は誘惑で所有者が変わると倍率対象も移る', () => {
    const prng = createDeterministicPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array(8).fill(null).map(() => Array(8).fill(Shared.EMPTY)),
      currentPlayer: Shared.WHITE,
      turnNumber: 1,
      consecutivePasses: 0
    };
    gameState.board[2][2] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 2, 2, 'black', { type: 'THEORY_INCARNATION', remainingOwnerTurns: 10 });
    cardState.pendingEffectByPlayer.white = { type: 'TEMPT_WILL', stage: 'selectTarget' };

    expect(CardLogic.applyTemptWill(cardState, gameState, 'white', 2, 2)).toMatchObject({ applied: true });
    const marker = cardState.markers.find((entry) => entry && entry.data && entry.data.type === 'THEORY_INCARNATION');
    expect(marker).toMatchObject({ owner: 'white' });

    const targetKey = '0,0';
    const targetBonus = Number(cardState.boardBonusByCell[targetKey] || 0);
    expect(targetBonus).toBeGreaterThan(0);
    gameState.board[0][1] = Shared.BLACK;
    gameState.board[0][2] = Shared.WHITE;
    gameState.currentPlayer = Shared.WHITE;
    const before = Number(cardState.charge.white || 0);
    const result = TurnPipeline.applyTurn(cardState, gameState, 'white', { type: 'place', row: 0, col: 0 }, prng, { skipTurnStart: true });
    const bonusEvent = result.events.find((ev) => ev && ev.type === 'board_bonus_gain');

    expect(Number(cardState.charge.white || 0) - before).toBe(1 + (targetBonus * 2));
    expect(bonusEvent).toMatchObject({ bonus: targetBonus, gained: targetBonus * 2, multiplier: 2, boostedBy: 'THEORY_INCARNATION' });
  });

  test('THEORY_INCARNATION は所有者ターン開始で減算され、0で通常石に戻る', () => {
    const prng = createDeterministicPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = createInitialGameState();
    gameState.board[0][0] = Shared.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 0, 0, 'black', { type: 'THEORY_INCARNATION', remainingOwnerTurns: 1 });

    CardLogic.onTurnStart(cardState, 'black', gameState, prng);

    expect(gameState.board[0][0]).toBe(Shared.BLACK);
    expect(cardState.markers.some((entry) => entry && entry.data && entry.data.type === 'THEORY_INCARNATION')).toBe(false);
    expect(cardState.presentationEvents.some((event) => event && event.type === 'STATUS_REMOVED' && event.reason === 'duration_end' && event.meta && event.meta.special === 'THEORY_INCARNATION')).toBe(true);
  });
});

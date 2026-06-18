import * as Shared from '../shared-constants.js';
import * as Core from '../game/logic/core.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';

function createPrng(randomValue = 0) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

function createEmptyGameState() {
  const gameState = Core.createGameState();
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
  gameState.currentPlayer = Core.BLACK;
  gameState.turnNumber = 1;
  gameState.consecutivePasses = 0;
  return gameState;
}

function getTimeStopGodDef() {
  return (Shared.CARD_DEFS || []).find((card) => card && card.type === 'TIME_STOP_GOD');
}

function createProtectedAnchorMarker(id, row, col) {
  return {
    id,
    kind: 'specialStone',
    row,
    col,
    owner: 'black',
    data: {
      type: 'WILL_HUNTER_KING',
      remainingOwnerTurns: 8,
      flipEvadeRemaining: 0,
      destroyEvadeRemaining: 1
    }
  };
}

function createPlacementState() {
  const prng = createPrng(0);
  const cardState = CardLogic.createCardState(prng);
  const gameState = createEmptyGameState();
  const def = getTimeStopGodDef();

  cardState.debugNoDraw = true;
  cardState.hands.black = [def.id];
  cardState.charge.black = def.cost;

  gameState.board[0][0] = Core.BLACK;
  gameState.board[0][1] = Core.BLACK;
  gameState.board[0][2] = Core.BLACK;
  gameState.board[0][3] = Core.BLACK;
  gameState.board[0][4] = Core.BLACK;
  gameState.board[2][4] = Core.WHITE;
  gameState.board[2][5] = Core.BLACK;
  for (let row = 5; row <= 6; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if (row === 6 && col >= 7) break;
      gameState.board[row][col] = Core.BLACK;
    }
  }

  cardState.markers.push(createProtectedAnchorMarker(9001, 2, 5));
  return { def, prng, cardState, gameState };
}

function createChainBoardState() {
  const prng = createPrng(0.5);
  const cardState = CardLogic.createCardState(prng);
  const gameState = createEmptyGameState();
  cardState.debugNoDraw = true;

  for (let row = 1; row <= 3; row += 1) {
    gameState.board[row][0] = Core.BLACK;
    for (let col = 1; col <= 5; col += 1) {
      gameState.board[row][col] = Core.WHITE;
    }
  }

  return { prng, cardState, gameState };
}

describe('TIME_STOP_GOD（時間停石）', () => {
  test('3個未満しか自石を破壊できない盤面では使用できない', () => {
    const prng = createPrng(0.25);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    const def = getTimeStopGodDef();

    cardState.debugNoDraw = true;
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    gameState.board[3][3] = Core.WHITE;
    gameState.board[3][4] = Core.BLACK;
    gameState.board[4][3] = Core.BLACK;
    gameState.board[4][4] = Core.WHITE;

    expect(CardLogic.getTimeStopGodDestroyableCount(cardState, gameState, 'black')).toBe(2);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', def.id)).toBe(false);
    expect(cardState.hands.black).toEqual([def.id]);
    expect(cardState.discard).toEqual([]);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('時間停石コストは絶対保護・不可侵の自石を破壊候補に数えない', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    for (let col = 0; col < Shared.TIME_STOP_GOD_SELF_DESTROY_COUNT; col += 1) {
      gameState.board[0][col] = Core.BLACK;
    }
    CardLogic.addMarker(cardState, 'specialStone', 0, 0, 'black', { type: 'ABSOLUTE_PROTECTED', remainingOwnerTurns: 5 });
    CardLogic.addMarker(cardState, 'manifestStone', 0, 1, 'black', { type: 'THEORY_INCARNATION', remainingOwnerTurns: 4, absoluteProtected: true });
    CardLogic.addMarker(cardState, 'manifestStone', 0, 2, 'black', { type: 'BOARD_EXECUTOR', remainingOwnerTurns: 4, absoluteProtected: true });

    expect(CardLogic.getTimeStopGodDestroyableCount(cardState, gameState, 'black')).toBe(0);
  });

  test('時間停石コストは同一セルの後続マーカーにある破壊回避も候補に数えない', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    for (let col = 0; col < Shared.TIME_STOP_GOD_SELF_DESTROY_COUNT; col += 1) {
      gameState.board[0][col] = Core.BLACK;
      CardLogic.addMarker(cardState, 'specialStone', 0, col, 'black', { type: 'PROTECTED', remainingOwnerTurns: 2 });
      CardLogic.addMarker(cardState, 'specialStone', 0, col, 'black', { type: 'AFTERIMAGE_WILL', destroyEvadeRemaining: 1 });
    }

    expect(CardLogic.getTimeStopGodDestroyableCount(cardState, gameState, 'black')).toBe(0);
  });

  test('自石が21個未満でも破壊可能自石が3個あれば使用できる', () => {
    const prng = createPrng(0.4);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    const def = getTimeStopGodDef();

    cardState.debugNoDraw = true;
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    let placed = 0;
    for (let row = 0; row < 8 && placed < 20; row += 1) {
      for (let col = 0; col < 8 && placed < 20; col += 1) {
        gameState.board[row][col] = Core.BLACK;
        placed += 1;
      }
    }

    expect(CardLogic.getTimeStopGodDestroyableCount(cardState, gameState, 'black')).toBeGreaterThanOrEqual(Shared.TIME_STOP_GOD_SELF_DESTROY_COUNT);
    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toContain(def.id);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', def.id)).toBe(true);
    expect(cardState.hands.black).toEqual([]);
    expect(cardState.discard).toEqual([def.id]);
    expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({ type: 'TIME_STOP_GOD' }));
  });

  test('使用後の次配置で3個の自石を破壊し、時間停石を配置する', () => {
    const { def, prng, cardState, gameState } = createPlacementState();

    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toContain(def.id);
    expect(CardLogic.getTimeStopGodDestroyableCount(cardState, gameState, 'black')).toBeGreaterThan(Shared.TIME_STOP_GOD_SELF_DESTROY_COUNT);
    const useRes = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: def.id, useCardOwnerKey: 'black' },
      prng,
      { skipTurnStart: true }
    );

    const costResolved = useRes.events.find((event) => event && event.type === 'time_stop_god_cost_resolved');
    expect(costResolved).toBeTruthy();
    expect(costResolved.destroyedCount).toBe(Shared.TIME_STOP_GOD_SELF_DESTROY_COUNT);
    expect(costResolved.destroyed).toEqual(expect.arrayContaining([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 }
    ]));
    expect(costResolved.destroyed).toHaveLength(Shared.TIME_STOP_GOD_SELF_DESTROY_COUNT);
    expect(gameState.board[0][0]).toBe(Core.EMPTY);
    expect(gameState.board[0][1]).toBe(Core.EMPTY);
    expect(gameState.board[0][2]).toBe(Core.EMPTY);
    expect(gameState.board[0][3]).toBe(Core.BLACK);
    expect(gameState.board[0][4]).toBe(Core.BLACK);
    expect(useRes.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'card_used', player: 'black', cardId: def.id })
    ]));
    expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({ type: 'TIME_STOP_GOD' }));

    const res = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3 },
      prng,
      { skipTurnStart: true }
    );

    expect(gameState.board[2][3]).toBe(Core.BLACK);
    expect(gameState.board[2][4]).toBe(Core.BLACK);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(res.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'placement_effects',
        player: 'black',
        effects: expect.objectContaining({ timeStopPlaced: true, chargeGained: 1 })
      })
    ]));

    const marker = (cardState.markers || []).find((entry) => (
      entry
      && entry.kind === 'specialStone'
      && entry.row === 2
      && entry.col === 3
      && entry.owner === 'black'
      && entry.data
      && entry.data.type === 'TIME_STOP'
    ));
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(Shared.TIME_STOP_GOD_TURNS);
    expect(gameState.currentPlayer).toBe(Core.WHITE);
    expect(gameState.turnNumber).toBe(2);
  });

  test('所有者ターンでのみ減算し、5回目の所有者ターン開始で発動する', () => {
    const prng = createPrng(0.2);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();

    cardState.debugNoDraw = true;
    gameState.board[3][3] = Core.BLACK;
    cardState.markers.push({
      id: 9101,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'TIME_STOP', remainingOwnerTurns: Shared.TIME_STOP_GOD_TURNS }
    });

    const whiteEvents = [];
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'white', whiteEvents, prng);
    expect(whiteEvents.some((event) => event && String(event.type).indexOf('time_stop') >= 0)).toBe(false);
    expect(cardState.markers[0].data.remainingOwnerTurns).toBe(5);

    const blackEvents1 = [];
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', blackEvents1, prng);
    expect(cardState.markers[0].data.remainingOwnerTurns).toBe(4);
    expect(blackEvents1.some((event) => event && event.type === 'time_stop_triggered')).toBe(false);

    const whiteEvents2 = [];
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'white', whiteEvents2, prng);
    expect(cardState.markers[0].data.remainingOwnerTurns).toBe(4);

    const blackEvents2 = [];
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', blackEvents2, prng);
    expect(cardState.markers[0].data.remainingOwnerTurns).toBe(3);
    expect(blackEvents2.some((event) => event && event.type === 'time_stop_triggered')).toBe(false);

    const whiteEvents3 = [];
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'white', whiteEvents3, prng);
    expect(cardState.markers[0].data.remainingOwnerTurns).toBe(3);

    const blackEvents3 = [];
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', blackEvents3, prng);
    expect(cardState.markers[0].data.remainingOwnerTurns).toBe(2);
    expect(blackEvents3.some((event) => event && event.type === 'time_stop_triggered')).toBe(false);

    const whiteEvents4 = [];
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'white', whiteEvents4, prng);
    expect(cardState.markers[0].data.remainingOwnerTurns).toBe(2);

    const blackEvents4 = [];
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', blackEvents4, prng);
    expect(cardState.markers[0].data.remainingOwnerTurns).toBe(1);
    expect(blackEvents4.some((event) => event && event.type === 'time_stop_triggered')).toBe(false);

    const whiteEvents5 = [];
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'white', whiteEvents5, prng);
    expect(cardState.markers[0].data.remainingOwnerTurns).toBe(1);

    const blackEvents5 = [];
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', blackEvents5, prng);

    expect(blackEvents5).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'time_stop_triggered',
        player: 'black',
        row: 3,
        col: 3,
        remainingBonusTurns: Shared.TIME_STOP_GOD_CONSECUTIVE_TURNS
      })
    ]));
    expect(gameState.board[3][3]).toBe(Core.BLACK);
    expect((cardState.markers || []).some((entry) => entry && entry.id === 9101)).toBe(false);
    expect(cardState.timeStopConsecutiveTurnsRemainingByPlayer.black).toBe(Shared.TIME_STOP_GOD_CONSECUTIVE_TURNS);
  });

  test('時間停石の元石が失われていたら不発になる', () => {
    const prng = createPrng(0.3);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();

    cardState.debugNoDraw = true;
    gameState.board[4][4] = Core.WHITE;
    cardState.markers.push({
      id: 9201,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'TIME_STOP', remainingOwnerTurns: 1 }
    });

    const events = [];
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', events, prng);

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'time_stop_fizzled',
        player: 'black',
        row: 4,
        col: 4,
        reason: 'anchor_lost'
      })
    ]));
    expect((cardState.markers || []).some((entry) => entry && entry.id === 9201)).toBe(false);
    expect(cardState.timeStopConsecutiveTurnsRemainingByPlayer.black).toBe(0);
  });

  test('発動後は2回の完了ターンぶん同じプレイヤーに手番が残る', () => {
    const { prng, cardState, gameState } = createChainBoardState();
    cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 2, white: 0 };

    const first = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 1, col: 6 },
      prng,
      { skipTurnStart: true }
    );

    expect(first.gameState.currentPlayer).toBe(Core.BLACK);
    expect(first.gameState.turnNumber).toBe(2);
    expect(cardState.timeStopConsecutiveTurnsRemainingByPlayer.black).toBe(1);

    const second = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 6 },
      prng,
      { skipTurnStart: true }
    );

    expect(second.gameState.currentPlayer).toBe(Core.WHITE);
    expect(second.gameState.turnNumber).toBe(3);
    expect(cardState.timeStopConsecutiveTurnsRemainingByPlayer.black).toBe(0);
  });
});

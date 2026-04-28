import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';
import * as Core from '../game/logic/core.js';
import * as BoardOps from '../game/logic/board_ops.js';

function createPrng(randomValue = 0.5) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

function createStates(randomValue = 0.5) {
  const cardState = CardLogic.createCardState(createPrng(randomValue));
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  return { cardState, gameState };
}

describe('SNIPER_WILL（狙撃の意志）', () => {
  test('配置時に自由配置でき、狙撃石マーカーが付く', () => {
    const prng = createPrng(0.1);
    const { cardState, gameState } = createStates(0.1);

    cardState.pendingEffectByPlayer.black = {
      type: 'SNIPER_WILL',
      stage: null,
      cardId: 'sniper_01'
    };

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 0, col: 0 }, prng);

    expect(gameState.board[0][0]).toBe(Shared.BLACK);
    const placement = (res.events || []).find((e) => e && e.type === 'placement_effects');
    expect(placement && placement.effects && placement.effects.sniperPlaced).toBe(true);
    expect(placement && placement.effects && placement.effects.freePlacementUsed).toBe(true);

    const sniper = (cardState.markers || []).find((m) =>
      m &&
      m.kind === 'specialStone' &&
      m.row === 0 &&
      m.col === 0 &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'SNIPER'
    );
    expect(sniper).toBeTruthy();
    expect(sniper.data.remainingOwnerTurns).toBe(5);
  });

  test('配置ターンに最寄り敵石を1つ即時破壊し、残りターンを減らさない', () => {
    const prng = createPrng(0.2);
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY)),
      currentPlayer: Core.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };

    gameState.board[3][3] = Core.WHITE;
    gameState.board[2][4] = Core.WHITE;
    gameState.board[6][6] = Core.WHITE;

    cardState.pendingEffectByPlayer.black = {
      type: 'SNIPER_WILL',
      stage: null,
      cardId: 'sniper_01'
    };

    const events = [];
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

    expect(gameState.board[2][3]).toBe(Core.BLACK);
    expect(gameState.board[2][4]).toBe(Core.EMPTY);
    expect(gameState.board[6][6]).toBe(Core.WHITE);
    expect(events.some((ev) => ev && ev.type === 'sniper_destroyed_immediate')).toBe(true);

    const sniper = (cardState.markers || []).find((m) =>
      m &&
      m.kind === 'specialStone' &&
      m.row === 2 &&
      m.col === 3 &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'SNIPER'
    );
    expect(sniper).toBeTruthy();
    expect(sniper.data.remainingOwnerTurns).toBe(5);
  });

  test('自ターン開始時に最寄り敵石を1つ破壊して残りターンを減らす', () => {
    const { cardState, gameState } = createStates(0.2);

    gameState.board[3][3] = Shared.BLACK;
    gameState.board[3][5] = Shared.WHITE;
    gameState.board[0][0] = Shared.WHITE;

    cardState.markers.push({
      id: 7001,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'SNIPER', remainingOwnerTurns: 5 }
    });

    const out = CardLogic.processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, 'black', 3, 3, createPrng(0.2));

    expect((out.destroyed || [])).toHaveLength(1);
    expect(out.destroyed[0]).toMatchObject({ row: 3, col: 5, sourceRow: 3, sourceCol: 3 });
    expect(gameState.board[3][5]).toBe(Shared.EMPTY);

    const marker = cardState.markers.find((m) => m && m.id === 7001);
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(4);
  });

  test('自ターン開始時に上側拡張セルの敵石も破壊対象に含める', () => {
    const { cardState, gameState } = createStates(0.2);

    gameState.board[0][0] = Shared.BLACK;
    gameState.boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: Shared.EMPTY,
      usedByPlayer: { black: true, white: false },
      cells: [{ side: 'top', row: -1, col: 0, owner: Shared.WHITE }]
    };

    cardState.markers.push({
      id: 7003,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'SNIPER', remainingOwnerTurns: 5 }
    });

    const out = CardLogic.processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, 'black', 0, 0, createPrng(0.2));

    expect((out.destroyed || [])).toEqual([expect.objectContaining({ row: -1, col: 0, sourceRow: 0, sourceCol: 0 })]);
    expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === -1 && cell.col === 0).owner).toBe(Shared.EMPTY);
  });

  test('同距離の敵石は乱数で1つを選んで破壊する', () => {
    const { cardState, gameState } = createStates(0.75);

    gameState.board[3][3] = Shared.BLACK;
    gameState.board[3][5] = Shared.WHITE;
    gameState.board[5][3] = Shared.WHITE;

    cardState.markers.push({
      id: 7002,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'SNIPER', remainingOwnerTurns: 5 }
    });

    const out = CardLogic.processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, 'black', 3, 3, createPrng(0.75));

    expect((out.destroyed || [])).toHaveLength(1);
    expect(out.destroyed[0]).toMatchObject({ row: 5, col: 3 });
    expect(gameState.board[5][3]).toBe(Shared.EMPTY);
    expect(gameState.board[3][5]).toBe(Shared.WHITE);
  });

  test('狙撃石が複数ある場合は各狙撃石ごとに1つ破壊する', () => {
    const { cardState, gameState } = createStates(0.1);

    gameState.board[1][1] = Shared.BLACK;
    gameState.board[6][6] = Shared.BLACK;
    gameState.board[1][3] = Shared.WHITE;
    gameState.board[6][4] = Shared.WHITE;

    cardState.markers.push(
      {
        id: 7101,
        kind: 'specialStone',
        row: 1,
        col: 1,
        owner: 'black',
        data: { type: 'SNIPER', remainingOwnerTurns: 5 }
      },
      {
        id: 7102,
        kind: 'specialStone',
        row: 6,
        col: 6,
        owner: 'black',
        data: { type: 'SNIPER', remainingOwnerTurns: 5 }
      }
    );

    const out = CardLogic.processSniperWillEffects(cardState, gameState, 'black', createPrng(0.1));

    expect((out.destroyed || [])).toHaveLength(2);
    expect(gameState.board[1][3]).toBe(Shared.EMPTY);
    expect(gameState.board[6][4]).toBe(Shared.EMPTY);

    const s1 = cardState.markers.find((m) => m && m.id === 7101);
    const s2 = cardState.markers.find((m) => m && m.id === 7102);
    expect(s1 && s1.data && s1.data.remainingOwnerTurns).toBe(4);
    expect(s2 && s2.data && s2.data.remainingOwnerTurns).toBe(4);
  });

  test('5回目の所有者ターン開始で狙撃石アンカーは通常石に戻る', () => {
    const { cardState, gameState } = createStates(0.3);

    gameState.board[4][4] = Shared.BLACK;
    cardState.markers.push({
      id: 7201,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'SNIPER', remainingOwnerTurns: 5 }
    });

    for (let i = 0; i < 4; i++) {
      const out = CardLogic.processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, 'black', 4, 4, createPrng(0.3));
      expect((out.expired || [])).toHaveLength(0);
      const marker = cardState.markers.find((m) => m && m.id === 7201);
      expect(marker).toBeTruthy();
      expect(marker.data.remainingOwnerTurns).toBe(4 - i);
      expect(gameState.board[4][4]).toBe(Shared.BLACK);
    }

    const last = CardLogic.processSniperWillEffectsAtTurnStartAnchor(cardState, gameState, 'black', 4, 4, createPrng(0.3));
    expect((last.expired || [])).toEqual([expect.objectContaining({ row: 4, col: 4, reason: 'anchor_expired' })]);
    expect(gameState.board[4][4]).toBe(Shared.BLACK);
    expect(cardState.markers.find((m) => m && m.id === 7201)).toBeUndefined();
  });
});

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

describe('LIGHTNING_WILL（落雷）', () => {
  test('カード定義と持続定数が正しい', () => {
    const def = (Shared.CARD_DEFS || []).find((card) => card && card.type === 'LIGHTNING_WILL');
    expect(def).toBeTruthy();
    expect(Number(def.cost)).toBe(26);
    expect(CardLogic.LIGHTNING_WILL_TURNS).toBe(5);
  });

  test('配置時に合法手へ置けて、落雷石マーカーが付く', () => {
    const prng = createPrng(0.1);
    const { cardState, gameState } = createStates(0.1);

    gameState.board[2][4] = Shared.WHITE;
    gameState.board[2][5] = Shared.BLACK;

    cardState.pendingEffectByPlayer.black = {
      type: 'LIGHTNING_WILL',
      stage: null,
      cardId: 'lightning_01'
    };

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 }, prng);

    expect(gameState.board[2][3]).toBe(Shared.BLACK);
    expect(gameState.board[2][4]).toBe(Shared.BLACK);
    const placement = (res.events || []).find((e) => e && e.type === 'placement_effects');
    expect(placement && placement.effects && placement.effects.lightningPlaced).toBe(true);
    expect(placement && placement.effects && placement.effects.freePlacementUsed).not.toBe(true);

    const marker = (cardState.markers || []).find((m) => (
      m &&
      m.kind === 'specialStone' &&
      m.row === 2 &&
      m.col === 3 &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'LIGHTNING'
    ));
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(5);
  });

  test('反転できない空きマスには配置できない', () => {
    const prng = createPrng(0.2);
    const { cardState, gameState } = createStates(0.2);

    cardState.pendingEffectByPlayer.black = {
      type: 'LIGHTNING_WILL',
      stage: null,
      cardId: 'lightning_01'
    };

    expect(() => {
      TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 0, col: 0 }, prng);
    }).toThrow(/Illegal move/);
  });

  test('配置ターンに盤面上の敵石をランダム1個だけ即時破壊する', () => {
    const prng = createPrng(0.0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY)),
      currentPlayer: Core.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };

    gameState.board[2][4] = Core.WHITE;
    gameState.board[2][5] = Core.BLACK;
    gameState.board[6][6] = Core.WHITE;

    cardState.pendingEffectByPlayer.black = {
      type: 'LIGHTNING_WILL',
      stage: null,
      cardId: 'lightning_01'
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
  expect(gameState.board[2][4]).toBe(Core.BLACK);
  expect(gameState.board[6][6]).toBe(Core.EMPTY);
    expect(events.some((ev) => ev && ev.type === 'lightning_destroyed_immediate')).toBe(true);

    const marker = (cardState.markers || []).find((m) => (
      m &&
      m.kind === 'specialStone' &&
      m.row === 2 &&
      m.col === 3 &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'LIGHTNING'
    ));
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(5);
  });

  test('自ターン開始時に敵石を1つ破壊して残りターンを減らす', () => {
    const { cardState, gameState } = createStates(0.75);

    gameState.board[3][3] = Shared.BLACK;
    gameState.board[1][1] = Shared.WHITE;
    gameState.board[4][4] = Shared.WHITE;

    cardState.markers.push({
      id: 9101,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'LIGHTNING', remainingOwnerTurns: 5 }
    });

    const out = CardLogic.processLightningWillEffectsAtTurnStartAnchor(cardState, gameState, 'black', 3, 3, createPrng(0.75));

    expect((out.destroyed || [])).toHaveLength(1);
    expect(gameState.board[1][1] === Shared.EMPTY || gameState.board[4][4] === Shared.EMPTY).toBe(true);

    const marker = cardState.markers.find((m) => m && m.id === 9101);
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(4);
  });

  test('自ターン開始時に下側拡張セルの敵石も破壊対象に含める', () => {
    const { cardState, gameState } = createStates(0.0);

    gameState.board[7][7] = Shared.BLACK;
    gameState.boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: Shared.EMPTY,
      usedByPlayer: { black: true, white: false },
      cells: [{ side: 'bottom', row: 8, col: 7, owner: Shared.WHITE }]
    };

    cardState.markers.push({
      id: 9105,
      kind: 'specialStone',
      row: 7,
      col: 7,
      owner: 'black',
      data: { type: 'LIGHTNING', remainingOwnerTurns: 5 }
    });

    const out = CardLogic.processLightningWillEffectsAtTurnStartAnchor(cardState, gameState, 'black', 7, 7, createPrng(0.0));

    expect((out.destroyed || [])).toEqual([expect.objectContaining({ row: 8, col: 7, sourceRow: 7, sourceCol: 7 })]);
    expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 8 && cell.col === 7).owner).toBe(Shared.EMPTY);
  });

  test('5回目の所有者ターン開始で落雷石アンカーは通常石に戻る', () => {
    const { cardState, gameState } = createStates(0.3);

    gameState.board[4][4] = Shared.BLACK;
    cardState.markers.push({
      id: 9102,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'LIGHTNING', remainingOwnerTurns: 5 }
    });

    for (let i = 0; i < 4; i++) {
      const out = CardLogic.processLightningWillEffectsAtTurnStartAnchor(cardState, gameState, 'black', 4, 4, createPrng(0.3));
      expect((out.expired || [])).toHaveLength(0);
      const marker = cardState.markers.find((m) => m && m.id === 9102);
      expect(marker).toBeTruthy();
      expect(marker.data.remainingOwnerTurns).toBe(4 - i);
      expect(gameState.board[4][4]).toBe(Shared.BLACK);
    }

    const last = CardLogic.processLightningWillEffectsAtTurnStartAnchor(cardState, gameState, 'black', 4, 4, createPrng(0.3));
    expect((last.expired || [])).toEqual([expect.objectContaining({ row: 4, col: 4, reason: 'anchor_expired' })]);
    expect(gameState.board[4][4]).toBe(Shared.BLACK);
    expect(cardState.markers.find((m) => m && m.id === 9102)).toBeUndefined();
  });

  test('ターン開始フェーズで破壊と期限切れイベントを発行する', () => {
    const { cardState, gameState } = createStates(0.0);

    gameState.board[4][4] = Shared.BLACK;
    gameState.board[4][5] = Shared.WHITE;
    cardState.markers.push({
      id: 9103,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'LIGHTNING', remainingOwnerTurns: 1 }
    });

    const events = [];
    TurnPipelinePhases.applyTurnStartPhase(
      CardLogic,
      { BLACK: Shared.BLACK, WHITE: Shared.WHITE },
      cardState,
      gameState,
      'black',
      events,
      createPrng(0.0)
    );

    const eventTypes = new Set(events.map((e) => e && e.type));
    expect(eventTypes.has('lightning_destroyed_start')).toBe(true);
    expect(eventTypes.has('lightning_expired_start')).toBe(true);
    expect(gameState.board[4][5]).toBe(Shared.EMPTY);
    expect(gameState.board[4][4]).toBe(Shared.BLACK);
  });

  test('落雷石は反転保護リストに含まれる', () => {
    const { cardState, gameState } = createStates(0.3);

    gameState.board[1][1] = Shared.BLACK;
    cardState.markers.push({
      id: 9104,
      kind: 'specialStone',
      row: 1,
      col: 1,
      owner: 'black',
      data: { type: 'LIGHTNING', remainingOwnerTurns: 5 }
    });

    const context = CardLogic.getCardContext(cardState);
    expect(Array.isArray(context.permaProtectedStones)).toBe(true);
    expect(context.permaProtectedStones.some((s) => s.row === 1 && s.col === 1 && s.owner === Shared.BLACK)).toBe(true);
  });

  test('落雷石は究極反転龍の即時反転対象にならない', () => {
    const { cardState, gameState } = createStates(0.3);

    gameState.board[3][3] = Shared.BLACK;
    gameState.board[3][4] = Shared.WHITE;
    cardState.markers.push(
      {
        id: 9105,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'DRAGON', remainingOwnerTurns: 5 }
      },
      {
        id: 9106,
        kind: 'specialStone',
        row: 3,
        col: 4,
        owner: 'white',
        data: { type: 'LIGHTNING', remainingOwnerTurns: 5 }
      }
    );

    const out = CardLogic.processDragonEffectsAtAnchor(cardState, gameState, 'black', 3, 3);

    expect(gameState.board[3][4]).toBe(Shared.WHITE);
    expect(Array.isArray(out.converted)).toBe(true);
    expect(out.converted).toHaveLength(0);
  });

  test('落雷石は究極反転龍のターン開始反転対象にならない', () => {
    const { cardState, gameState } = createStates(0.3);

    gameState.board[4][4] = Shared.BLACK;
    gameState.board[4][5] = Shared.WHITE;
    cardState.markers.push(
      {
        id: 9107,
        kind: 'specialStone',
        row: 4,
        col: 4,
        owner: 'black',
        data: { type: 'DRAGON', remainingOwnerTurns: 5 }
      },
      {
        id: 9108,
        kind: 'specialStone',
        row: 4,
        col: 5,
        owner: 'white',
        data: { type: 'LIGHTNING', remainingOwnerTurns: 5 }
      }
    );

    const out = CardLogic.processDragonEffectsAtTurnStartAnchor(cardState, gameState, 'black', 4, 4);

    expect(gameState.board[4][5]).toBe(Shared.WHITE);
    expect(Array.isArray(out.converted)).toBe(true);
    expect(out.converted).toHaveLength(0);
  });
});

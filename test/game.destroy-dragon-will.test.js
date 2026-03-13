const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const TurnPipelinePhases = require('../game/turn/turn_pipeline_phases');
const Core = require('../game/logic/core');
const BoardOps = require('../game/logic/board_ops');

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

describe('DESTROY_DRAGON_WILL（破壊龍）', () => {
  test('カード定義と持続定数が正しい', () => {
    const def = (Shared.CARD_DEFS || []).find((card) => card && card.type === 'DESTROY_DRAGON_WILL');
    expect(def).toBeTruthy();
    expect(Number(def.cost)).toBe(15);
    expect(CardLogic.DESTROY_DRAGON_TURNS).toBe(3);
  });

  test('配置時に破壊龍マーカーが付与される', () => {
    const { cardState, gameState } = createStates(0.3);

    gameState.board[3][3] = Shared.BLACK;
    gameState.board[3][4] = Shared.WHITE;
    cardState.pendingEffectByPlayer.black = {
      type: 'DESTROY_DRAGON_WILL',
      stage: null,
      cardId: 'destroy_dragon_01'
    };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 0);
    expect(effects && effects.destroyDragonPlaced).toBe(true);

    const marker = (cardState.markers || []).find((m) => (
      m &&
      m.kind === 'specialStone' &&
      m.row === 3 &&
      m.col === 3 &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'DESTROY_DRAGON'
    ));
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(3);
  });

  test('配置ターンに隣接敵石をランダム1個だけ即時破壊する', () => {
    const prng = createPrng(0.2);
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY)),
      currentPlayer: Core.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };

    gameState.board[3][3] = Core.WHITE;
    gameState.board[3][4] = Core.BLACK;
    gameState.board[4][3] = Core.BLACK;
    gameState.board[4][4] = Core.WHITE;
    gameState.board[2][4] = Core.WHITE;

    cardState.pendingEffectByPlayer.black = {
      type: 'DESTROY_DRAGON_WILL',
      stage: null,
      cardId: 'destroy_dragon_01'
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

    expect(gameState.board[2][4]).toBe(Core.EMPTY);
    expect(events.some((ev) => ev && ev.type === 'destroy_dragon_destroyed_immediate')).toBe(true);

    const marker = (cardState.markers || []).find((m) => (
      m &&
      m.kind === 'specialStone' &&
      m.row === 2 &&
      m.col === 3 &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'DESTROY_DRAGON'
    ));
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(3);
  });

  test('自ターン開始時に隣接敵石をランダム1個だけ破壊し、残りターンを減らす', () => {
    const { cardState, gameState } = createStates(0.75);

    gameState.board[4][4] = Shared.BLACK;
    gameState.board[3][3] = Shared.WHITE;
    gameState.board[3][4] = Shared.WHITE;
    gameState.board[6][6] = Shared.WHITE;

    cardState.markers.push({
      id: 8301,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
    });

    const out = CardLogic.processDestroyDragonEffectsAtTurnStartAnchor(cardState, gameState, 'black', 4, 4, createPrng(0.75));

    expect((out.destroyed || [])).toHaveLength(1);
    expect(out.destroyed[0]).toMatchObject({ row: 3, col: 4, sourceRow: 4, sourceCol: 4 });
    expect(gameState.board[3][4]).toBe(Shared.EMPTY);
    expect(gameState.board[3][3]).toBe(Shared.WHITE);
    expect(gameState.board[6][6]).toBe(Shared.WHITE);

    const marker = cardState.markers.find((m) => m && m.id === 8301);
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(2);
  });

  test('3回目の所有者ターン開始でアンカーが消滅する', () => {
    const { cardState, gameState } = createStates(0.1);

    gameState.board[2][2] = Shared.BLACK;
    cardState.markers.push({
      id: 8302,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
    });

    const first = CardLogic.processDestroyDragonEffectsAtTurnStartAnchor(cardState, gameState, 'black', 2, 2, createPrng(0.1));
    expect((first.expired || [])).toHaveLength(0);
    expect(gameState.board[2][2]).toBe(Shared.BLACK);

    const second = CardLogic.processDestroyDragonEffectsAtTurnStartAnchor(cardState, gameState, 'black', 2, 2, createPrng(0.1));
    expect((second.expired || [])).toHaveLength(0);
    expect(gameState.board[2][2]).toBe(Shared.BLACK);

    const third = CardLogic.processDestroyDragonEffectsAtTurnStartAnchor(cardState, gameState, 'black', 2, 2, createPrng(0.1));
    expect((third.expired || [])).toEqual([{ row: 2, col: 2 }]);
    expect(gameState.board[2][2]).toBe(Shared.EMPTY);
    expect(cardState.markers.find((m) => m && m.id === 8302)).toBeUndefined();
  });

  test('拡張セルの隣接敵石も破壊対象になる', () => {
    const { cardState, gameState } = createStates(0.2);

    gameState.board[3][0] = Shared.BLACK;
    gameState.boardExpansion = {
      active: true,
      side: 'left',
      row: 3,
      owner: Shared.WHITE,
      usedByPlayer: { black: true, white: false }
    };

    cardState.markers.push({
      id: 8303,
      kind: 'specialStone',
      row: 3,
      col: 0,
      owner: 'black',
      data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
    });

    const out = CardLogic.processDestroyDragonEffectsAtTurnStartAnchor(cardState, gameState, 'black', 3, 0, createPrng(0.2));
    expect((out.destroyed || []).some((p) => p.row === 3 && p.col === -1)).toBe(true);
    expect(gameState.boardExpansion.owner).toBe(Shared.EMPTY);
  });

  test('上側拡張セルの隣接敵石も破壊対象になる', () => {
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
      id: 8306,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
    });

    const out = CardLogic.processDestroyDragonEffectsAtTurnStartAnchor(cardState, gameState, 'black', 0, 0, createPrng(0.2));
    expect((out.destroyed || []).some((p) => p.row === -1 && p.col === 0)).toBe(true);
    expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === -1 && cell.col === 0).owner).toBe(Shared.EMPTY);
  });

  test('ターン開始フェーズで破壊と期限切れイベントを発行する', () => {
    const { cardState, gameState } = createStates(0.2);

    gameState.board[4][4] = Shared.BLACK;
    gameState.board[4][5] = Shared.WHITE;
    cardState.markers.push({
      id: 8305,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 1 }
    });

    const events = [];
    TurnPipelinePhases.applyTurnStartPhase(
      CardLogic,
      { BLACK: Shared.BLACK, WHITE: Shared.WHITE },
      cardState,
      gameState,
      'black',
      events,
      createPrng(0.2)
    );

    const eventTypes = new Set(events.map((e) => e && e.type));
    expect(eventTypes.has('destroy_dragon_destroyed_start')).toBe(true);
    expect(eventTypes.has('destroy_dragon_expired_start')).toBe(true);
    expect(gameState.board[4][5]).toBe(Shared.EMPTY);
    expect(gameState.board[4][4]).toBe(Shared.EMPTY);
  });

  test('破壊龍は反転保護リストに含まれる', () => {
    const { cardState, gameState } = createStates(0.3);

    gameState.board[1][1] = Shared.BLACK;
    cardState.markers.push({
      id: 8304,
      kind: 'specialStone',
      row: 1,
      col: 1,
      owner: 'black',
      data: { type: 'DESTROY_DRAGON', remainingOwnerTurns: 3 }
    });

    const context = CardLogic.getCardContext(cardState);
    expect(Array.isArray(context.permaProtectedStones)).toBe(true);
    expect(context.permaProtectedStones.some((s) => s.row === 1 && s.col === 1 && s.owner === Shared.BLACK)).toBe(true);
  });
});

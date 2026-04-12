const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const BoardOps = require('../game/logic/board_ops');
const TurnPipeline = require('../game/turn/turn_pipeline');

function createPrng(randomValue = 0) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

function createState(randomValue = 0, rows = 8, cols = rows) {
  const prng = createPrng(randomValue);
  const cardState = CardLogic.createCardState(prng);
  const gameState = {
    board: Array.from({ length: rows }, () => Array(cols).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  return { cardState, gameState, prng };
}

describe('WILL_HUNTER_KING（意志狩りの王）', () => {
  test('配置時に意志狩りの王マーカーと回避回数が付く', () => {
    const { cardState, gameState } = createState();

    gameState.board[3][3] = Shared.BLACK;
    cardState.pendingEffectByPlayer.black = {
      type: 'WILL_HUNTER_KING',
      stage: null,
      cardId: 'will_hunter_king_01'
    };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 0);
    expect(effects && effects.willHunterKingPlaced).toBe(true);

    const marker = (cardState.markers || []).find((m) => (
      m &&
      m.kind === 'specialStone' &&
      m.row === 3 &&
      m.col === 3 &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'WILL_HUNTER_KING'
    ));

    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(8);
    expect(marker.data.flipEvadeRemaining).toBe(2);
    expect(marker.data.destroyEvadeRemaining).toBe(2);
  });

  test('自ターン開始時に特殊石を優先して破壊し、そのマスへ移動する', () => {
    const { cardState, gameState } = createState(0);

    gameState.board[3][3] = Shared.BLACK;
    gameState.board[3][5] = Shared.WHITE;
    gameState.board[5][3] = Shared.WHITE;

    cardState.markers.push(
      {
        id: 8101,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: {
          type: 'WILL_HUNTER_KING',
          remainingOwnerTurns: 8,
          flipEvadeRemaining: 2,
          destroyEvadeRemaining: 2
        }
      },
      {
        id: 8102,
        kind: 'specialStone',
        row: 5,
        col: 3,
        owner: 'white',
        data: { type: 'OBSERVER', remainingOwnerTurns: 5 }
      }
    );

    const out = CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      3,
      3,
      createPrng(0)
    );

    expect(out.destroyed).toHaveLength(1);
    expect(out.destroyed[0]).toMatchObject({ row: 5, col: 3, sourceRow: 3, sourceCol: 3 });
    expect(out.moved).toHaveLength(1);
    expect(out.moved[0]).toMatchObject({
      from: { row: 3, col: 3 },
      to: { row: 5, col: 3 },
      specialType: 'WILL_HUNTER_KING'
    });
    expect(gameState.board[3][3]).toBe(Shared.EMPTY);
    expect(gameState.board[5][3]).toBe(Shared.BLACK);
    expect(gameState.board[3][5]).toBe(Shared.WHITE);

    const marker = cardState.markers.find((m) => m && m.id === 8101);
    expect(marker).toBeTruthy();
    expect(marker.row).toBe(5);
    expect(marker.col).toBe(3);
    expect(marker.data.remainingOwnerTurns).toBe(7);
  });

  test('特殊石優先は見た目基準で行い、継承多動も優先対象に含める', () => {
    const { cardState, gameState } = createState(0);

    gameState.board[3][3] = Shared.BLACK;
    gameState.board[3][5] = Shared.WHITE;
    gameState.board[5][3] = Shared.WHITE;

    cardState.markers.push(
      {
        id: 8111,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: {
          type: 'WILL_HUNTER_KING',
          remainingOwnerTurns: 8,
          flipEvadeRemaining: 2,
          destroyEvadeRemaining: 2
        }
      },
      {
        id: 8112,
        kind: 'specialStone',
        row: 5,
        col: 3,
        owner: 'white',
        data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 4, flipEvadeRemaining: 1 }
      }
    );

    const out = CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      3,
      3,
      createPrng(0)
    );

    expect(out.destroyed).toHaveLength(1);
    expect(out.destroyed[0]).toMatchObject({ row: 5, col: 3 });
    expect(out.moved).toHaveLength(1);
    expect(out.moved[0]).toMatchObject({ to: { row: 5, col: 3 } });
    expect(gameState.board[5][3]).toBe(Shared.BLACK);
    expect(gameState.board[3][5]).toBe(Shared.WHITE);
  });

  test('特殊石優先は visual-effects-map 未登録でも盤上特殊石なら優先する', () => {
    const { cardState, gameState } = createState(0);

    gameState.board[3][3] = Shared.BLACK;
    gameState.board[3][5] = Shared.WHITE;
    gameState.board[5][3] = Shared.WHITE;

    cardState.markers.push(
      {
        id: 8115,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: {
          type: 'WILL_HUNTER_KING',
          remainingOwnerTurns: 8,
          flipEvadeRemaining: 2,
          destroyEvadeRemaining: 2
        }
      },
      {
        id: 8116,
        kind: 'specialStone',
        row: 5,
        col: 3,
        owner: 'white',
        data: { type: 'GUARD', remainingOwnerTurns: 3 }
      }
    );

    const out = CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      3,
      3,
      createPrng(0)
    );

    expect(out.destroyed).toHaveLength(0);
    expect(out.moved).toHaveLength(0);
    expect(gameState.board[5][3]).toBe(Shared.WHITE);
    expect(gameState.board[3][5]).toBe(Shared.WHITE);
  });

  test('上側拡張セルの敵石も破壊してそのマスへ移動できる', () => {
    const { cardState, gameState } = createState(0);

    gameState.board[0][0] = Shared.BLACK;
    gameState.boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: Shared.EMPTY,
      usedByPlayer: { black: true, white: false },
      cells: [{ side: 'top', row: -1, col: 0, owner: Shared.WHITE }]
    };

    cardState.markers.push(
      {
        id: 8117,
        kind: 'specialStone',
        row: 0,
        col: 0,
        owner: 'black',
        data: {
          type: 'WILL_HUNTER_KING',
          remainingOwnerTurns: 8,
          flipEvadeRemaining: 2,
          destroyEvadeRemaining: 2
        }
      },
      {
        id: 8118,
        kind: 'specialStone',
        row: -1,
        col: 0,
        owner: 'white',
        data: { type: 'OBSERVER', remainingOwnerTurns: 5 }
      }
    );

    const out = CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      0,
      0,
      createPrng(0)
    );

    expect(out.destroyed).toHaveLength(1);
    expect(out.destroyed[0]).toMatchObject({ row: -1, col: 0, sourceRow: 0, sourceCol: 0 });
    expect(out.moved).toHaveLength(1);
    expect(out.moved[0]).toMatchObject({ from: { row: 0, col: 0 }, to: { row: -1, col: 0 } });
    expect(gameState.board[0][0]).toBe(Shared.EMPTY);
    expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === -1 && cell.col === 0).owner).toBe(Shared.BLACK);

    const marker = cardState.markers.find((m) => m && m.id === 8117);
    expect(marker).toBeTruthy();
    expect(marker.row).toBe(-1);
    expect(marker.col).toBe(0);
  });

  test('10x10 の右側拡張セルの敵石も破壊してそのマスへ移動できる', () => {
    const { cardState, gameState } = createState(0, 10, 10);

    gameState.board[0][9] = Shared.BLACK;
    gameState.boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: Shared.EMPTY,
      usedByPlayer: { black: true, white: false },
      cells: [{ side: 'right', row: 0, col: 10, owner: Shared.WHITE }]
    };

    cardState.markers.push(
      {
        id: 8121,
        kind: 'specialStone',
        row: 0,
        col: 9,
        owner: 'black',
        data: {
          type: 'WILL_HUNTER_KING',
          remainingOwnerTurns: 8,
          flipEvadeRemaining: 2,
          destroyEvadeRemaining: 2
        }
      },
      {
        id: 8122,
        kind: 'specialStone',
        row: 0,
        col: 10,
        owner: 'white',
        data: { type: 'OBSERVER', remainingOwnerTurns: 5 }
      }
    );

    const out = CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      0,
      9,
      createPrng(0)
    );

    expect(out.destroyed).toHaveLength(1);
    expect(out.destroyed[0]).toMatchObject({ row: 0, col: 10, sourceRow: 0, sourceCol: 9 });
    expect(out.moved).toHaveLength(1);
    expect(out.moved[0]).toMatchObject({ from: { row: 0, col: 9 }, to: { row: 0, col: 10 } });
    expect(gameState.board[0][9]).toBe(Shared.EMPTY);
    expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === 0 && cell.col === 10).owner).toBe(Shared.BLACK);

    const marker = cardState.markers.find((m) => m && m.id === 8121);
    expect(marker).toBeTruthy();
    expect(marker.row).toBe(0);
    expect(marker.col).toBe(10);
  });

  test('盤面で通常見た目の隠し罠石は特殊石優先の対象にしない', () => {
    const { cardState, gameState } = createState(0);

    gameState.board[3][3] = Shared.BLACK;
    gameState.board[3][5] = Shared.WHITE;
    gameState.board[5][3] = Shared.WHITE;

    cardState.markers.push(
      {
        id: 8113,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: {
          type: 'WILL_HUNTER_KING',
          remainingOwnerTurns: 8,
          flipEvadeRemaining: 2,
          destroyEvadeRemaining: 2
        }
      },
      {
        id: 8114,
        kind: 'specialStone',
        row: 5,
        col: 3,
        owner: 'white',
        data: { type: 'TRAP', remainingOwnerTurns: 1 }
      }
    );

    const out = CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      3,
      3,
      createPrng(0)
    );

    expect(out.destroyed).toHaveLength(1);
    expect(out.destroyed[0]).toMatchObject({ row: 3, col: 5 });
    expect(out.moved).toHaveLength(1);
    expect(out.moved[0]).toMatchObject({ to: { row: 3, col: 5 } });
    expect(gameState.board[5][3]).toBe(Shared.WHITE);
  });

  test('反転回避で隣接空きマスへ移動し、回数を1消費する', () => {
    const { cardState, gameState } = createState(0);

    gameState.board[3][3] = Shared.BLACK;

    cardState.markers.push({
      id: 8151,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: {
        type: 'WILL_HUNTER_KING',
        remainingOwnerTurns: 8,
        flipEvadeRemaining: 2,
        destroyEvadeRemaining: 2
      }
    });

    const out = CardLogic.resolveHyperactiveFlipEvasion(
      cardState,
      gameState,
      [[3, 3]],
      'white',
      createPrng(0)
    );

    expect(out.remainingFlips).toHaveLength(0);
    expect(out.moved).toHaveLength(1);
    expect(gameState.board[3][3]).toBe(Shared.EMPTY);

    const marker = cardState.markers.find((m) => m && m.id === 8151);
    expect(marker).toBeTruthy();
    expect(marker.row === 3 && marker.col === 3).toBe(false);
    expect(gameState.board[marker.row][marker.col]).toBe(Shared.BLACK);
    expect(marker.data.flipEvadeRemaining).toBe(1);
  });

  test('破壊対象が破壊回避した場合でも、意志狩りの王は空いた元マスへ移動する', () => {
    const { cardState, gameState } = createState(0);

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        gameState.board[row][col] = Shared.BLACK;
      }
    }
    gameState.board[3][3] = Shared.BLACK;
    gameState.board[3][5] = Shared.WHITE;
    gameState.board[7][7] = Shared.EMPTY;

    cardState.markers.push(
      {
        id: 8201,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: {
          type: 'WILL_HUNTER_KING',
          remainingOwnerTurns: 8,
          flipEvadeRemaining: 2,
          destroyEvadeRemaining: 2
        }
      },
      {
        id: 8202,
        kind: 'specialStone',
        row: 3,
        col: 5,
        owner: 'white',
        data: {
          type: 'WILL_HUNTER_KING',
          remainingOwnerTurns: 8,
          flipEvadeRemaining: 2,
          destroyEvadeRemaining: 1
        }
      }
    );

    const out = CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      3,
      3,
      createPrng(0)
    );

    expect(out.destroyed).toHaveLength(0);
    expect(out.moved).toHaveLength(1);
    expect(out.moved[0]).toMatchObject({
      from: { row: 3, col: 3 },
      to: { row: 3, col: 5 }
    });
    expect(gameState.board[3][3]).toBe(Shared.EMPTY);
    expect(gameState.board[3][5]).toBe(Shared.BLACK);
    expect(gameState.board[7][7]).toBe(Shared.WHITE);

    const enemyMarker = cardState.markers.find((m) => m && m.id === 8202);
    expect(enemyMarker).toBeTruthy();
    expect(enemyMarker.row).toBe(7);
    expect(enemyMarker.col).toBe(7);
    expect(enemyMarker.data.destroyEvadeRemaining).toBe(0);
  });

  test('増殖石を斬ると移動せず、元の位置に残したまま増殖だけ発生する', () => {
    const { cardState, gameState } = createState(0);

    gameState.board[3][3] = Shared.BLACK;
    gameState.board[3][5] = Shared.WHITE;
    gameState.board[2][4] = Shared.EMPTY;

    cardState.markers.push(
      {
        id: 8211,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: {
          type: 'WILL_HUNTER_KING',
          remainingOwnerTurns: 8,
          flipEvadeRemaining: 2,
          destroyEvadeRemaining: 2
        }
      },
      {
        id: 8212,
        kind: 'specialStone',
        row: 3,
        col: 5,
        owner: 'white',
        data: { type: 'PROLIFERATION' }
      }
    );

    const out = CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(
      cardState,
      gameState,
      'black',
      3,
      3,
      createPrng(0)
    );

    expect(out.destroyed).toHaveLength(0);
    expect(out.moved).toHaveLength(0);
    expect(out.proliferated).toHaveLength(1);
    expect(out.proliferated[0]).toMatchObject({ row: 3, col: 5, sourceRow: 3, sourceCol: 3 });
    expect(gameState.board[3][3]).toBe(Shared.BLACK);
    expect(gameState.board[3][5]).toBe(Shared.WHITE);
    expect(gameState.board[2][4]).toBe(Shared.WHITE);

    const marker = cardState.markers.find((m) => m && m.id === 8211);
    expect(marker).toBeTruthy();
    expect(marker.row).toBe(3);
    expect(marker.col).toBe(3);
  });

  test('破壊回避は隣接空きがなくても遠距離の空きマスへ移動する', () => {
    const { cardState, gameState } = createState();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        gameState.board[row][col] = Shared.BLACK;
      }
    }
    gameState.board[4][4] = Shared.BLACK;
    gameState.board[7][7] = Shared.EMPTY;

    cardState.markers.push({
      id: 8301,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: {
        type: 'WILL_HUNTER_KING',
        remainingOwnerTurns: 8,
        flipEvadeRemaining: 2,
        destroyEvadeRemaining: 2
      }
    });

    const out = BoardOps.destroyAt(cardState, gameState, 4, 4, 'SYSTEM', 'test_destroy');

    expect(out).toMatchObject({
      destroyed: false,
      evaded: true,
      reason: 'destroy_evaded',
      from: { row: 4, col: 4 },
      to: { row: 7, col: 7 }
    });
    expect(gameState.board[4][4]).toBe(Shared.EMPTY);
    expect(gameState.board[7][7]).toBe(Shared.BLACK);

    const marker = cardState.markers.find((m) => m && m.id === 8301);
    expect(marker).toBeTruthy();
    expect(marker.row).toBe(7);
    expect(marker.col).toBe(7);
    expect(marker.data.destroyEvadeRemaining).toBe(1);
  });

  test('空きマスが1つもない場合、破壊回避は発動せずそのまま破壊される', () => {
    const { cardState, gameState } = createState();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        gameState.board[row][col] = Shared.BLACK;
      }
    }

    cardState.markers.push({
      id: 8401,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: {
        type: 'WILL_HUNTER_KING',
        remainingOwnerTurns: 8,
        flipEvadeRemaining: 2,
        destroyEvadeRemaining: 2
      }
    });

    const out = BoardOps.destroyAt(cardState, gameState, 4, 4, 'SYSTEM', 'test_destroy');

    expect(out && out.destroyed).toBe(true);
    expect(out && out.evaded).toBe(false);
    expect(gameState.board[4][4]).toBe(Shared.EMPTY);
    expect(cardState.markers.find((m) => m && m.id === 8401)).toBeUndefined();
  });

  test('破壊神で選択されても破壊回避なら退避し、カード効果は解決扱いになる', () => {
    const { cardState, gameState } = createState();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        gameState.board[row][col] = Shared.BLACK;
      }
    }
    gameState.board[4][4] = Shared.WHITE;
    gameState.board[7][7] = Shared.EMPTY;
    cardState.pendingEffectByPlayer.black = {
      type: 'DESTROY_ONE_STONE',
      stage: 'selectTarget',
      cardId: 'destroy_01'
    };
    cardState.markers.push({
      id: 8451,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'white',
      data: {
        type: 'WILL_HUNTER_KING',
        remainingOwnerTurns: 8,
        flipEvadeRemaining: 2,
        destroyEvadeRemaining: 1
      }
    });

    const applied = CardLogic.applyDestroyEffect(cardState, gameState, 'black', 4, 4);

    expect(applied).toBe(true);
    expect(gameState.board[4][4]).toBe(Shared.EMPTY);
    expect(gameState.board[7][7]).toBe(Shared.WHITE);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    const marker = cardState.markers.find((m) => m && m.id === 8451);
    expect(marker).toBeTruthy();
    expect(marker.row).toBe(7);
    expect(marker.col).toBe(7);
    expect(marker.data.destroyEvadeRemaining).toBe(0);
  });

  test('配置したターンも即時に石狩りして移動する', () => {
    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
      currentPlayer: Shared.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };

    gameState.board[3][3] = Shared.WHITE;
    gameState.board[3][4] = Shared.BLACK;
    gameState.board[4][3] = Shared.BLACK;
    gameState.board[4][4] = Shared.WHITE;
    gameState.board[2][5] = Shared.WHITE;

    cardState.markers.push({
      id: 8501,
      kind: 'specialStone',
      row: 2,
      col: 5,
      owner: 'white',
      data: { type: 'OBSERVER', remainingOwnerTurns: 5 }
    });
    cardState.pendingEffectByPlayer.black = {
      type: 'WILL_HUNTER_KING',
      stage: null,
      cardId: 'will_hunter_king_01'
    };

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', {
      type: 'place',
      row: 2,
      col: 3,
      actionId: 'whk-place-1'
    }, prng);

    const destroyEvent = (res.events || []).find((ev) => ev && ev.type === 'will_hunter_king_destroyed_immediate');
    expect(destroyEvent).toBeTruthy();
    expect(destroyEvent.details).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 2,
        col: 5,
        sourceRow: 2,
        sourceCol: 3,
        destroyedSpecial: true
      })
    ]));
    expect(res.events.some((ev) => ev && ev.type === 'will_hunter_king_moved_immediate')).toBe(true);
    expect(res.gameState.board[2][3]).toBe(Shared.EMPTY);
    expect(res.gameState.board[2][5]).toBe(Shared.BLACK);

    const marker = (res.cardState.markers || []).find((m) => (
      m &&
      m.kind === 'specialStone' &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'WILL_HUNTER_KING'
    ));
    expect(marker).toBeTruthy();
    expect(marker.row).toBe(2);
    expect(marker.col).toBe(5);
    expect(marker.data.remainingOwnerTurns).toBe(8);

    const bubbleIndex = (res.presentationEvents || []).findIndex((event) => (
      event &&
      event.type === 'SPECIAL_STONE_BUBBLE' &&
      event.special === 'WILL_HUNTER_KING' &&
      event.scenario === 'place' &&
      event.row === 2 &&
      event.col === 3
    ));
    const moveIndex = (res.presentationEvents || []).findIndex((event) => (
      event &&
      event.type === 'MOVE' &&
      event.prevRow === 2 &&
      event.prevCol === 3 &&
      event.row === 2 &&
      event.col === 5
    ));

    expect(bubbleIndex).toBeGreaterThanOrEqual(0);
    expect(moveIndex).toBeGreaterThanOrEqual(0);
    expect(bubbleIndex).toBeLessThan(moveIndex);

    const specialDestroyBubbleIndex = (res.presentationEvents || []).findIndex((event) => (
      event &&
      event.type === 'SPECIAL_STONE_BUBBLE' &&
      event.special === 'WILL_HUNTER_KING' &&
      event.scenario === 'special_destroy_triggered' &&
      event.row === 2 &&
      event.col === 5
    ));

    expect(specialDestroyBubbleIndex).toBeGreaterThanOrEqual(0);
    expect(specialDestroyBubbleIndex).toBeGreaterThan(moveIndex);
  });
});

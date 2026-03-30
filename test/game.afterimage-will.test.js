const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const BoardOps = require('../game/logic/board_ops');

function createPrng(randomValue = 0) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

function createState(randomValue = 0) {
  const prng = createPrng(randomValue);
  const cardState = CardLogic.createCardState(prng);
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  return { cardState, gameState, prng };
}

describe('AFTERIMAGE_WILL（残像の意志）', () => {
  test('配置時に残像石マーカーと3/3回避回数が付く', () => {
    const { cardState, gameState } = createState();

    gameState.board[3][3] = Shared.BLACK;
    cardState.pendingEffectByPlayer.black = {
      type: 'AFTERIMAGE_WILL',
      stage: null,
      cardId: 'afterimage_will_01'
    };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 0);
    expect(effects && effects.afterimagePlaced).toBe(true);

    const marker = (cardState.markers || []).find((m) => (
      m &&
      m.kind === 'specialStone' &&
      m.row === 3 &&
      m.col === 3 &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'AFTERIMAGE_WILL'
    ));

    expect(marker).toBeTruthy();
    expect(marker.data.flipEvadeRemaining).toBe(3);
    expect(marker.data.destroyEvadeRemaining).toBe(3);
    expect(marker.data.remainingOwnerTurns).toBeUndefined();
  });

  test('反転回避成功でflipだけ減る', () => {
    const { cardState, gameState } = createState(0);

    gameState.board[3][3] = Shared.BLACK;
    cardState.markers.push({
      id: 9101,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: {
        type: 'AFTERIMAGE_WILL',
        flipEvadeRemaining: 3,
        destroyEvadeRemaining: 3
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

    const marker = cardState.markers.find((m) => m && m.id === 9101);
    expect(marker).toBeTruthy();
    expect(gameState.board[marker.row][marker.col]).toBe(Shared.BLACK);
    expect(marker.data.flipEvadeRemaining).toBe(2);
    expect(marker.data.destroyEvadeRemaining).toBe(3);
  });

  test('破壊回避成功でdestroyだけ減る', () => {
    const { cardState, gameState } = createState();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        gameState.board[row][col] = Shared.BLACK;
      }
    }
    gameState.board[4][4] = Shared.BLACK;
    gameState.board[7][7] = Shared.EMPTY;

    cardState.markers.push({
      id: 9201,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: {
        type: 'AFTERIMAGE_WILL',
        flipEvadeRemaining: 3,
        destroyEvadeRemaining: 3
      }
    });

    const out = BoardOps.destroyAt(cardState, gameState, 4, 4, 'SYSTEM', 'test_destroy');

    expect(out).toMatchObject({
      kind: 'evaded_move',
      destroyed: false,
      evaded: true,
      reason: 'destroy_evaded',
      from: { row: 4, col: 4 },
      to: { row: 7, col: 7 }
    });

    const marker = cardState.markers.find((m) => m && m.id === 9201);
    expect(marker).toBeTruthy();
    expect(marker.row).toBe(7);
    expect(marker.col).toBe(7);
    expect(marker.data.flipEvadeRemaining).toBe(3);
    expect(marker.data.destroyEvadeRemaining).toBe(2);
  });

  test('片側0では残り、0/0で通常石へ戻る', () => {
    const { cardState, gameState } = createState(0);

    gameState.board[3][3] = Shared.BLACK;
    cardState.markers.push({
      id: 9301,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: {
        type: 'AFTERIMAGE_WILL',
        flipEvadeRemaining: 1,
        destroyEvadeRemaining: 1
      }
    });

    const flipOut = CardLogic.resolveHyperactiveFlipEvasion(
      cardState,
      gameState,
      [[3, 3]],
      'white',
      createPrng(0)
    );

    expect(flipOut.moved).toHaveLength(1);
    let marker = cardState.markers.find((m) => m && m.id === 9301);
    expect(marker).toBeTruthy();
    expect(marker.data.flipEvadeRemaining).toBe(0);
    expect(marker.data.destroyEvadeRemaining).toBe(1);

    const fromRow = marker.row;
    const fromCol = marker.col;
    const destination = (fromRow === 7 && fromCol === 7) ? { row: 0, col: 0 } : { row: 7, col: 7 };
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        gameState.board[row][col] = Shared.BLACK;
      }
    }
    gameState.board[fromRow][fromCol] = Shared.BLACK;
    gameState.board[destination.row][destination.col] = Shared.EMPTY;

    const destroyOut = BoardOps.destroyAt(cardState, gameState, fromRow, fromCol, 'SYSTEM', 'afterimage_cleanup');
    expect(destroyOut.evaded).toBe(true);
    expect(destroyOut.to).toEqual(destination);
    expect(cardState.markers.find((m) => m && m.id === 9301)).toBeUndefined();
    expect(gameState.board[destination.row][destination.col]).toBe(Shared.BLACK);
  });

  test('反転回避に移動先が無い時は不成立で消滅する', () => {
    const { cardState, gameState } = createState(0);

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        gameState.board[row][col] = Shared.BLACK;
      }
    }
    cardState.markers.push({
      id: 9401,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: {
        type: 'AFTERIMAGE_WILL',
        flipEvadeRemaining: 3,
        destroyEvadeRemaining: 3
      }
    });

    const out = CardLogic.resolveHyperactiveFlipEvasion(
      cardState,
      gameState,
      [[4, 4]],
      'white',
      createPrng(0)
    );

    expect(out.remainingFlips).toHaveLength(0);
    expect(out.destroyed).toContainEqual(expect.objectContaining({
      row: 4,
      col: 4,
      specialType: 'AFTERIMAGE_WILL'
    }));
    expect(gameState.board[4][4]).toBe(Shared.EMPTY);
    expect(cardState.markers.find((m) => m && m.id === 9401)).toBeUndefined();
  });

  test('空きマスが無い時は破壊回避せずそのまま破壊される', () => {
    const { cardState, gameState } = createState();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        gameState.board[row][col] = Shared.BLACK;
      }
    }
    cardState.markers.push({
      id: 9501,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: {
        type: 'AFTERIMAGE_WILL',
        flipEvadeRemaining: 3,
        destroyEvadeRemaining: 3
      }
    });

    const out = BoardOps.destroyAt(cardState, gameState, 4, 4, 'SYSTEM', 'test_destroy');

    expect(out.destroyed).toBe(true);
    expect(out.evaded).toBe(false);
    expect(gameState.board[4][4]).toBe(Shared.EMPTY);
    expect(cardState.markers.find((m) => m && m.id === 9501)).toBeUndefined();
  });

  test('反転回避0で通常反転された時は destroy 回数が残っていても通常石へ戻る', () => {
    const { cardState, gameState } = createState();

    gameState.board[4][4] = Shared.BLACK;
    cardState.markers.push({
      id: 9601,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: {
        type: 'AFTERIMAGE_WILL',
        flipEvadeRemaining: 0,
        destroyEvadeRemaining: 2
      }
    });

    const out = BoardOps.changeAt(cardState, gameState, 4, 4, 'white', 'SYSTEM', 'standard_flip');

    expect(out.changed).toBe(true);
    expect(gameState.board[4][4]).toBe(Shared.WHITE);
    expect(cardState.markers.find((m) => m && m.id === 9601)).toBeUndefined();

    const changeEvent = (cardState._presentationEventsPersist || []).find((ev) => ev && ev.type === 'CHANGE' && ev.row === 4 && ev.col === 4);
    expect(changeEvent).toBeTruthy();
    expect(changeEvent.meta && changeEvent.meta.special).toBeUndefined();
    expect(changeEvent.meta && changeEvent.meta.flipEvadeRemaining).toBeUndefined();
    expect(changeEvent.meta && changeEvent.meta.destroyEvadeRemaining).toBeUndefined();
  });
});

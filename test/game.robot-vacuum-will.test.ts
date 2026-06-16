import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';
import * as Shared from '../shared-constants.js';

function createPrng(randomValue = 0) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

function createState(randomValue = 0, options = {}) {
  const rows = Number.isInteger(options.rows) ? options.rows : 8;
  const cols = Number.isInteger(options.cols) ? options.cols : rows;
  const prng = createPrng(randomValue);
  const cardState = CardLogic.createCardState(prng, { boardConfig: { rows, cols } });
  const gameState = {
    board: Array.from({ length: rows }, () => Array(cols).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK
  };
  return { cardState, gameState, prng };
}

function countStones(board) {
  let count = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === Shared.BLACK || cell === Shared.WHITE) count++;
    }
  }
  return count;
}

describe('ROBOT_VACUUM_WILL（ロボット掃除機）', () => {
  test('applyPlacementEffects でロボット掃除機石マーカーを付与する', () => {
    const { cardState, gameState } = createState(0.1);

    gameState.board[3][3] = Shared.BLACK;
    cardState.pendingEffectByPlayer.black = {
      type: 'ROBOT_VACUUM_WILL',
      stage: null,
      cardId: 'robot_vacuum_01'
    };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 0);
    expect(effects && effects.robotVacuumPlaced).toBe(true);

    const marker = (cardState.markers || []).find((m) => (
      m &&
      m.kind === 'specialStone' &&
      m.row === 3 &&
      m.col === 3 &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'ROBOT_VACUUM'
    ));

    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(5);
  });

  test('ターン開始時の移動は敵石に近づく候補を優先する', () => {
    const { cardState, gameState } = createState(0.99);

    gameState.board[3][3] = Shared.BLACK;
    gameState.board[2][5] = Shared.WHITE;
    gameState.board[4][5] = Shared.WHITE;
    gameState.board[6][6] = Shared.WHITE;

    cardState.markers.push({
      id: 1501,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ROBOT_VACUUM', remainingOwnerTurns: 5 }
    });

    const events = [];
    TurnPipelinePhases.applyTurnStartPhase(
      CardLogic,
      { BLACK: Shared.BLACK, WHITE: Shared.WHITE },
      cardState,
      gameState,
      'black',
      events,
      createPrng(0.99)
    );

    const movedEvent = events.find((ev) => ev && ev.type === 'robot_vacuum_moved_start');
    expect(Array.isArray(movedEvent && movedEvent.details)).toBe(true);
    expect((movedEvent && movedEvent.details) || []).toHaveLength(1);

    const moveDetail = movedEvent.details[0];
    expect(moveDetail.to).toEqual({ row: 3, col: 4 });
  });

  test('10x10 でも 8x8 外の敵石を検知して近づく', () => {
    const { cardState, gameState } = createState(0.99, { rows: 10, cols: 10 });

    gameState.board[8][8] = Shared.BLACK;
    gameState.board[7][6] = Shared.WHITE;
    gameState.board[9][6] = Shared.WHITE;

    cardState.markers.push({
      id: 1502,
      kind: 'specialStone',
      row: 8,
      col: 8,
      owner: 'black',
      data: { type: 'ROBOT_VACUUM', remainingOwnerTurns: 5 }
    });

    const events = [];
    TurnPipelinePhases.applyTurnStartPhase(
      CardLogic,
      { BLACK: Shared.BLACK, WHITE: Shared.WHITE },
      cardState,
      gameState,
      'black',
      events,
      createPrng(0.99)
    );

    const movedEvent = events.find((ev) => ev && ev.type === 'robot_vacuum_moved_start');
    expect(Array.isArray(movedEvent && movedEvent.details)).toBe(true);
    expect((movedEvent && movedEvent.details) || []).toHaveLength(1);
    expect(movedEvent.details[0].to).toEqual({ row: 8, col: 7 });
  });

  test('ターン開始で移動→吸い込み破壊し、移動先で挟めても反転せず、1回で最大1個だけ吸い込む（吸い込みで持続+1）', () => {
    const { cardState, gameState } = createState(0);
    cardState.charge.black = 0;

    gameState.board[3][3] = Shared.BLACK;
    for (const [r, c] of [[2, 2], [2, 3], [2, 4], [3, 2], [4, 2], [4, 3], [4, 4]]) {
      gameState.board[r][c] = Shared.BLACK;
    }

    gameState.board[3][5] = Shared.WHITE;
    gameState.board[4][5] = Shared.WHITE;
    gameState.board[3][6] = Shared.BLACK;
    gameState.board[2][5] = Shared.WHITE;

    cardState.markers.push(
      {
        id: 1001,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'ROBOT_VACUUM', remainingOwnerTurns: 5 }
      },
      {
        id: 1002,
        kind: 'specialStone',
        row: 2,
        col: 5,
        owner: 'white',
        data: { type: 'GUARD', remainingOwnerTurns: 3 }
      }
    );

    const events = [];
    TurnPipelinePhases.applyTurnStartPhase(
      CardLogic,
      { BLACK: Shared.BLACK, WHITE: Shared.WHITE },
      cardState,
      gameState,
      'black',
      events,
      createPrng(0)
    );

    const types = new Set(events.map((ev) => ev && ev.type));
    expect(types.has('robot_vacuum_moved_start')).toBe(true);
    expect(types.has('robot_vacuum_destroyed_start')).toBe(true);
    expect(types.has('robot_vacuum_sucked_start')).toBe(true);
    expect(types.has('robot_vacuum_flipped_start')).toBe(false);

    const suckedEvent = events.find((ev) => ev && ev.type === 'robot_vacuum_sucked_start');
    expect(Array.isArray(suckedEvent && suckedEvent.details)).toBe(true);
    expect((suckedEvent && suckedEvent.details) || []).toHaveLength(1);

    const suctionCandidates = [[3, 5], [4, 5]];
    const emptiedCount = suctionCandidates.filter(([r, c]) => gameState.board[r][c] === Shared.EMPTY).length;
    const survivedCount = suctionCandidates.filter(([r, c]) => gameState.board[r][c] === Shared.WHITE).length;
    expect(emptiedCount).toBe(1);
    expect(survivedCount).toBe(1);
    expect(gameState.board[2][5]).toBe(Shared.WHITE);

    expect(cardState.charge.black).toBe(0);

    const marker = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'ROBOT_VACUUM');
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(5);
  });

  test('救済神があるターン開始吸い込み破壊でも phase PRNG だけで復活できる', () => {
    const { cardState, gameState } = createState(0);
    delete cardState._defaultRandomSource;

    gameState.board[0][0] = Shared.WHITE;
    gameState.board[3][3] = Shared.BLACK;
    gameState.board[3][5] = Shared.WHITE;

    cardState.markers.push(
      {
        id: 3101,
        kind: 'specialStone',
        row: 0,
        col: 0,
        owner: 'white',
        data: { type: 'STONE_SALVATION_GOD', remainingOwnerTurns: 12 }
      },
      {
        id: 3102,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'ROBOT_VACUUM', remainingOwnerTurns: 5 }
      }
    );

    const events = [];
    expect(() => {
      TurnPipelinePhases.applyTurnStartPhase(
        CardLogic,
        { BLACK: Shared.BLACK, WHITE: Shared.WHITE },
        cardState,
        gameState,
        'black',
        events,
        createPrng(0)
      );
    }).not.toThrow();

    expect(events.some((ev) => ev && ev.type === 'robot_vacuum_sucked_start')).toBe(true);
    expect((cardState.presentationEvents || []).some((ev) => (
      ev && ev.type === 'SPAWN' && ev.reason === 'stone_salvation_god_revive'
    ))).toBe(true);
  });

  test('持続ターンは所有者ターン開始時のみ減少し、0で同色の通常石に戻る', () => {
    const { cardState, gameState } = createState(0.2);

    gameState.board[3][3] = Shared.BLACK;
    cardState.markers.push({
      id: 2001,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ROBOT_VACUUM', remainingOwnerTurns: 2 }
    });

    const runTurnStart = (playerKey, randomValue) => {
      const events = [];
      TurnPipelinePhases.applyTurnStartPhase(
        CardLogic,
        { BLACK: Shared.BLACK, WHITE: Shared.WHITE },
        cardState,
        gameState,
        playerKey,
        events,
        createPrng(randomValue)
      );
      return events;
    };

    runTurnStart('white', 0.1);
    let marker = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'ROBOT_VACUUM');
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(2);

    runTurnStart('black', 0.2);
    marker = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'ROBOT_VACUUM');
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(1);

    runTurnStart('white', 0.3);
    marker = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'ROBOT_VACUUM');
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(1);

    const lastEvents = runTurnStart('black', 0.4);
    marker = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'ROBOT_VACUUM');
    expect(marker).toBeUndefined();
    expect(countStones(gameState.board)).toBe(1);
    expect(gameState.board.flat().filter((cell) => cell === Shared.BLACK).length).toBe(1);

    const expiredEvent = lastEvents.find((ev) => (
      ev && ev.type === 'robot_vacuum_expired_start' && Array.isArray(ev.details) && ev.details.length > 0
    ));
    expect(expiredEvent).toBeTruthy();
    const reverted = expiredEvent.details[0];
    expect(gameState.board[reverted.row][reverted.col]).toBe(Shared.BLACK);
  });

  test('周囲空きが無い場合は消滅せず同色の通常石に戻る', () => {
    const { cardState, gameState } = createState(0);
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        gameState.board[row][col] = Shared.WHITE;
      }
    }
    gameState.board[3][3] = Shared.BLACK;
    cardState.markers.push({
      id: 3001,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ROBOT_VACUUM', remainingOwnerTurns: 5 }
    });

    const events = [];
    TurnPipelinePhases.applyTurnStartPhase(
      CardLogic,
      { BLACK: Shared.BLACK, WHITE: Shared.WHITE },
      cardState,
      gameState,
      'black',
      events,
      createPrng(0)
    );

    expect(gameState.board[3][3]).toBe(Shared.BLACK);
    const marker = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'ROBOT_VACUUM');
    expect(marker).toBeUndefined();
    expect(events.some((ev) => ev && ev.type === 'robot_vacuum_destroyed_start')).toBe(false);
    const expiredEvent = events.find((ev) => ev && ev.type === 'robot_vacuum_expired_start');
    expect(expiredEvent && expiredEvent.details).toEqual([
      expect.objectContaining({ row: 3, col: 3, specialType: 'ROBOT_VACUUM', reason: 'no_candidates_revert', reverted: true })
    ]);
  });
});

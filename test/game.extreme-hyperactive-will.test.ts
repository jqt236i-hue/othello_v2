import * as CardLogic from '../game/logic/cards.js';
import * as BoardOps from '../game/logic/board_ops.js';
import * as Core from '../game/logic/core.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';

describe('EXTREME_HYPERACTIVE_WILL（極悪多動魔）', () => {
  function makePrng() {
    return {
      shuffle: (arr) => arr,
      random: () => 0
    };
  }

  test('applyPlacementEffects で極悪多動魔マーカーを付与する', () => {
    const prng = makePrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: 1 };

    gameState.board[3][3] = 1;
    cardState.pendingEffectByPlayer.black = {
      type: 'EXTREME_HYPERACTIVE_WILL',
      stage: null,
      cardId: 'extreme_hyperactive_01'
    };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 0);
    expect(effects && effects.hyperactivePlaced).toBe(true);
    expect(effects && effects.extremeHyperactivePlaced).toBe(true);

    const marker = (cardState.markers || []).find((m) => (
      m &&
      m.kind === 'specialStone' &&
      m.row === 3 &&
      m.col === 3 &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'EXTREME_HYPERACTIVE'
    ));
    expect(marker).toBeTruthy();
    expect(marker.data.flipEvadeRemaining).toBe(5);
    expect(marker.data.destroyEvadeRemaining).toBe(5);
  });

  test('ターン開始時に移動後、周囲8マスの石を1マス遠ざける', () => {
    const prng = makePrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(1)),
      currentPlayer: 1
    };

    gameState.board[3][3] = 1;
    gameState.board[3][4] = 0;
    gameState.board[1][4] = 0;
    gameState.board[3][6] = 0;
    gameState.board[5][4] = 0;
    gameState.board[2][4] = -1;
    gameState.board[3][5] = 1;
    gameState.board[4][4] = -1;

    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'EXTREME_HYPERACTIVE', flipEvadeRemaining: 5, destroyEvadeRemaining: 5 }
    });

    const events = [];
    TurnPipelinePhases.applyTurnStartPhase(
      CardLogic,
      { BLACK: 1, WHITE: -1 },
      cardState,
      gameState,
      'black',
      events,
      { random: () => 0 }
    );

    const repelled = events.find((ev) => ev && ev.type === 'extreme_hyperactive_repelled_start');
    expect(repelled).toBeTruthy();
    expect(Array.isArray(repelled.details)).toBe(true);
    expect(repelled.details.length).toBe(3);

    for (const one of repelled.details) {
      const fromDist = Math.max(Math.abs(one.from.row - 3), Math.abs(one.from.col - 4));
      const toDist = Math.max(Math.abs(one.to.row - 3), Math.abs(one.to.col - 4));
      expect(fromDist).toBe(1);
      expect(toDist).toBeGreaterThan(fromDist);
    }

    const marker = cardState.markers.find((m) => m && m.kind === 'specialStone' && m.data && m.data.type === 'EXTREME_HYPERACTIVE');
    expect(marker).toBeTruthy();
    expect(marker.row).toBe(3);
    expect(marker.col).toBe(4);
  });

  test('真後ろが埋まっていても、遠ざかる空き先があれば1マス移動する', () => {
    const prng = makePrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(1)),
      currentPlayer: 1
    };

    gameState.board[3][3] = 1;
    gameState.board[3][4] = 0;

    gameState.board[2][2] = 1;
    gameState.board[2][3] = 1;
    gameState.board[2][4] = -1;
    gameState.board[3][2] = 1;
    gameState.board[4][2] = 1;
    gameState.board[4][3] = 1;
    gameState.board[4][4] = 1;

    gameState.board[1][4] = 1;
    gameState.board[1][3] = 0;
    gameState.board[1][5] = 0;

    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'EXTREME_HYPERACTIVE', flipEvadeRemaining: 5, destroyEvadeRemaining: 5 }
    });

    const events = [];
    TurnPipelinePhases.applyTurnStartPhase(
      CardLogic,
      { BLACK: 1, WHITE: -1 },
      cardState,
      gameState,
      'black',
      events,
      { random: () => 0 }
    );

    const repelled = events.find((ev) => ev && ev.type === 'extreme_hyperactive_repelled_start');
    expect(repelled).toBeTruthy();
    expect(Array.isArray(repelled.details)).toBe(true);

    const movedTarget = repelled.details.find((d) => d && d.from && d.from.row === 2 && d.from.col === 4);
    expect(movedTarget).toBeTruthy();
    expect(movedTarget.to.row).toBe(1);
    expect([3, 5]).toContain(movedTarget.to.col);
    expect(movedTarget.to).not.toEqual({ row: 1, col: 4 });
  });

  test('反転回避は5回まで発動する', () => {
    const prng = makePrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(1)),
      currentPlayer: 1
    };

    gameState.board[3][3] = 1;
    gameState.board[3][4] = 0;
    gameState.board[3][5] = 0;

    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'EXTREME_HYPERACTIVE', flipEvadeRemaining: 5 }
    });

    let currentCell = [3, 3];
    for (const remaining of [4, 3, 2, 1, 0]) {
      const res = CardLogic.resolveHyperactiveFlipEvasion(
        cardState,
        gameState,
        [currentCell],
        'white',
        { random: () => 0 }
      );

      expect(res && res.moved && res.moved.length).toBe(1);
      expect(res && res.remainingFlips && res.remainingFlips.length).toBe(0);

      const marker = cardState.markers.find((m) => m && m.kind === 'specialStone' && m.data && m.data.type === 'EXTREME_HYPERACTIVE');
      expect(marker).toBeTruthy();
      expect(marker.data.flipEvadeRemaining).toBe(remaining);
      currentCell = [marker.row, marker.col];
    }

    const exhausted = CardLogic.resolveHyperactiveFlipEvasion(
      cardState,
      gameState,
      [currentCell],
      'white',
      { random: () => 0 }
    );

    expect(exhausted && exhausted.moved && exhausted.moved.length).toBe(0);
    expect(exhausted && exhausted.remainingFlips).toEqual([currentCell]);

    const markerAfterExhausted = cardState.markers.find((m) => m && m.kind === 'specialStone' && m.data && m.data.type === 'EXTREME_HYPERACTIVE');
    expect(markerAfterExhausted).toBeTruthy();
    expect(markerAfterExhausted.row).toBe(currentCell[0]);
    expect(markerAfterExhausted.col).toBe(currentCell[1]);
    expect(markerAfterExhausted.data.flipEvadeRemaining).toBe(0);
  });

  test('破壊回避は5回まで発動する', () => {
    const prng = makePrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY)),
      currentPlayer: Core.BLACK
    };

    gameState.board[4][4] = Core.BLACK;
    cardState.markers.push({
      id: 412,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: {
        type: 'EXTREME_HYPERACTIVE',
        flipEvadeRemaining: 5,
        destroyEvadeRemaining: 5
      }
    });

    let marker = (cardState.markers || []).find((m) => m && m.id === 412);
    for (const remaining of [4, 3, 2, 1, 0]) {
      const beforeRow = marker.row;
      const beforeCol = marker.col;
      const result = BoardOps.destroyAt(cardState, gameState, beforeRow, beforeCol, 'SYSTEM', 'test_destroy');
      expect(result).toMatchObject({
        destroyed: false,
        evaded: true,
        reason: 'destroy_evaded',
        from: { row: beforeRow, col: beforeCol }
      });

      marker = (cardState.markers || []).find((m) => m && m.id === 412);
      expect(marker).toBeTruthy();
      expect(marker.data.flipEvadeRemaining).toBe(5);
      expect(marker.data.destroyEvadeRemaining).toBe(remaining);
    }

    const finalRow = marker.row;
    const finalCol = marker.col;
    const exhausted = BoardOps.destroyAt(cardState, gameState, finalRow, finalCol, 'SYSTEM', 'test_destroy_exhausted');
    expect(exhausted && exhausted.destroyed).toBe(true);
    expect(exhausted && exhausted.evaded).toBe(false);
    expect(gameState.board[finalRow][finalCol]).toBe(Core.EMPTY);

    marker = (cardState.markers || []).find((m) => m && m.id === 412);
    expect(marker).toBeUndefined();
  });

  test('移動先が占有マスでも石を退避させて進入する', () => {
    const prng = makePrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(1)),
      currentPlayer: 1
    };

    gameState.board[3][3] = 1;
    gameState.board[2][2] = -1;
    gameState.board[1][1] = 0;

    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'EXTREME_HYPERACTIVE', flipEvadeRemaining: 5, destroyEvadeRemaining: 5 }
    });

    const events = [];
    TurnPipelinePhases.applyTurnStartPhase(
      CardLogic,
      { BLACK: 1, WHITE: -1 },
      cardState,
      gameState,
      'black',
      events,
      { random: () => 0 }
    );

    expect(gameState.board[3][3]).toBe(0);
    expect(gameState.board[2][2]).toBe(1);
    expect(gameState.board[1][1]).not.toBe(0);

    const marker = cardState.markers.find((m) => m && m.kind === 'specialStone' && m.data && m.data.type === 'EXTREME_HYPERACTIVE');
    expect(marker).toBeTruthy();
    expect(marker.row).toBe(2);
    expect(marker.col).toBe(2);

    const repelled = events.find((ev) => ev && ev.type === 'extreme_hyperactive_repelled_start');
    expect(repelled).toBeTruthy();
    expect(Array.isArray(repelled.details)).toBe(true);
    expect(repelled.details.some((d) => d && d.from && d.to && d.from.row === 2 && d.from.col === 2 && d.to.row === 1 && d.to.col === 1)).toBe(true);
  });

  test('押し出し先が無い占有マスへは位置交換して進入する', () => {
    const prng = makePrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(1)),
      currentPlayer: 1
    };

    gameState.board[3][3] = 1;
    gameState.board[2][2] = -1;
    for (const [row, col] of [[4, 4], [5, 5], [6, 6], [7, 7]]) {
      gameState.board[row][col] = -1;
    }

    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'EXTREME_HYPERACTIVE', flipEvadeRemaining: 5, destroyEvadeRemaining: 5 }
    });

    const events = [];
    TurnPipelinePhases.applyTurnStartPhase(
      CardLogic,
      { BLACK: 1, WHITE: -1 },
      cardState,
      gameState,
      'black',
      events,
      { random: () => 0 }
    );

    expect(gameState.board[2][2]).toBe(1);
    expect(gameState.board[3][3]).toBe(-1);

    const marker = cardState.markers.find((m) => m && m.kind === 'specialStone' && m.data && m.data.type === 'EXTREME_HYPERACTIVE');
    expect(marker).toBeTruthy();
    expect(marker.row).toBe(2);
    expect(marker.col).toBe(2);

    const repelled = events.find((ev) => ev && ev.type === 'extreme_hyperactive_repelled_start');
    expect(repelled).toBeTruthy();
    expect(Array.isArray(repelled.details)).toBe(true);
    expect(repelled.details).toEqual(expect.arrayContaining([
      expect.objectContaining({
        from: { row: 2, col: 2 },
        to: { row: 3, col: 3 },
        forcedSwap: true
      })
    ]));

    const moveEvents = (cardState._presentationEventsPersist || []).filter((ev) => (
      ev &&
      ev.type === 'MOVE' &&
      ev.cause === 'EXTREME_HYPERACTIVE_WILL' &&
      ev.reason === 'extreme_hyperactive_forced_swap'
    ));
    expect(moveEvents).toHaveLength(2);
    expect(moveEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        prevRow: 3,
        prevCol: 3,
        row: 2,
        col: 2,
        ownerBefore: 'black',
        ownerAfter: 'black',
        meta: expect.objectContaining({
          special: 'EXTREME_HYPERACTIVE',
          owner: 'black',
          flipEvadeRemaining: 5,
          destroyEvadeRemaining: 5
        })
      }),
      expect.objectContaining({
        prevRow: 2,
        prevCol: 2,
        row: 3,
        col: 3,
        ownerBefore: 'white',
        ownerAfter: 'white'
      })
    ]));
  });

  test('全候補が占有かつ交換不可なら不正上書きせず通常石に戻る', () => {
    const prng = makePrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(1)),
      currentPlayer: 1
    };

    gameState.board[3][3] = 1;
    for (let row = 2; row <= 4; row += 1) {
      for (let col = 2; col <= 4; col += 1) {
        if (row === 3 && col === 3) continue;
        gameState.board[row][col] = -1;
      }
    }

    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'EXTREME_HYPERACTIVE', flipEvadeRemaining: 5, destroyEvadeRemaining: 5 }
    });

    let markerId = 2;
    for (let row = 2; row <= 4; row += 1) {
      for (let col = 2; col <= 4; col += 1) {
        if (row === 3 && col === 3) continue;
        cardState.markers.push({
          id: markerId++,
          kind: 'specialStone',
          row,
          col,
          owner: 'white',
          data: { type: 'ABSOLUTE_PROTECTED' }
        });
      }
    }

    const events = [];
    TurnPipelinePhases.applyTurnStartPhase(
      CardLogic,
      { BLACK: 1, WHITE: -1 },
      cardState,
      gameState,
      'black',
      events,
      { random: () => 0 }
    );

    expect(gameState.board[3][3]).toBe(1);
    expect(gameState.board[2][2]).toBe(-1);
    expect(gameState.board[2][3]).toBe(-1);
    expect(gameState.board[2][4]).toBe(-1);

    const marker = cardState.markers.find((m) => m && m.kind === 'specialStone' && m.data && m.data.type === 'EXTREME_HYPERACTIVE');
    expect(marker).toBeUndefined();

    const destroyedEvent = events.find((ev) => ev && ev.type === 'hyperactive_destroyed_start');
    expect(destroyedEvent).toBeTruthy();
    expect(Array.isArray(destroyedEvent.details)).toBe(true);
    expect(destroyedEvent.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 3, col: 3, specialType: 'EXTREME_HYPERACTIVE', reason: 'no_candidates_revert', reverted: true })
    ]));

    const moveEvents = (cardState._presentationEventsPersist || []).filter((ev) => (
      ev &&
      ev.type === 'MOVE' &&
      ev.cause === 'EXTREME_HYPERACTIVE_WILL'
    ));
    expect(moveEvents).toHaveLength(0);
  });
});

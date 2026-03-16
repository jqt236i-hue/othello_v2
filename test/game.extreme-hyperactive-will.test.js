const CardLogic = require('../game/logic/cards');
const TurnPipelinePhases = require('../game/turn/turn_pipeline_phases');

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
      m.data.type === 'EXTREME_HYPERACTIVE' &&
      m.data.flipEvadeRemaining === 3
    ));
    expect(marker).toBeTruthy();
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
      data: { type: 'EXTREME_HYPERACTIVE', flipEvadeRemaining: 3 }
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
      data: { type: 'EXTREME_HYPERACTIVE', flipEvadeRemaining: 3 }
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

  test('反転回避は3回まで発動する', () => {
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
      data: { type: 'EXTREME_HYPERACTIVE', flipEvadeRemaining: 3 }
    });

    let currentCell = [3, 3];
    for (const remaining of [2, 1, 0]) {
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
      data: { type: 'EXTREME_HYPERACTIVE', flipEvadeRemaining: 3 }
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
});
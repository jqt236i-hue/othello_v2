import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import * as BoardOps from '../game/logic/board_ops.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';

describe('ULTIMATE_HYPERACTIVE_GOD', () => {
  function makeState() {
    const prng = { shuffle: (arr) => arr, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1
    };
    return { cardState, gameState };
  }

  test('applyPlacementEffects places ultimate hyperactive marker', () => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = 1;
    cardState.pendingEffectByPlayer.black = {
      type: 'ULTIMATE_HYPERACTIVE_GOD',
      stage: null,
      cardId: 'ultimate_hyperactive_01'
    };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 0);
    expect(effects && effects.ultimateHyperactivePlaced).toBe(true);

    const marker = (cardState.markers || []).find(m =>
      m &&
      m.kind === 'specialStone' &&
      m.row === 3 &&
      m.col === 3 &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'ULTIMATE_HYPERACTIVE'
    );
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(12);
    expect(marker.data.flipEvadeRemaining).toBe(5);
    expect(marker.data.destroyEvadeRemaining).toBe(2);
  });

  test('owner turn only decrements duration, and on 12th owner turn it reverts to a normal stone', () => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = 1;
    cardState.markers.push({
      id: 101,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 12 }
    });

    // Non-owner turn: moves may occur, but duration should not decrement.
    let marker = cardState.markers.find(m => m.kind === 'specialStone' && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
    CardLogic.processUltimateHyperactiveMoveAtAnchor(cardState, gameState, 'black', marker.row, marker.col, { random: () => 0.1 }, {
      currentTurnPlayerKey: 'white'
    });
    marker = cardState.markers.find(m => m.kind === 'specialStone' && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(12);

    // Owner turns: decrement each time, expire on the 12th owner turn.
    for (let i = 0; i < 11; i++) {
      marker = cardState.markers.find(m => m.kind === 'specialStone' && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
      expect(marker).toBeTruthy();
      CardLogic.processUltimateHyperactiveMoveAtAnchor(cardState, gameState, 'black', marker.row, marker.col, { random: () => 0.1 }, {
        currentTurnPlayerKey: 'black'
      });
      const after = cardState.markers.find(m => m.kind === 'specialStone' && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
      expect(after).toBeTruthy();
      expect(after.data.remainingOwnerTurns).toBe(11 - i);
    }

    marker = cardState.markers.find(m => m.kind === 'specialStone' && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
    expect(marker).toBeTruthy();
    const last = CardLogic.processUltimateHyperactiveMoveAtAnchor(cardState, gameState, 'black', marker.row, marker.col, { random: () => 0.1 }, {
      currentTurnPlayerKey: 'black'
    });
    expect(last.destroyed || []).toEqual([expect.objectContaining({ reverted: true, reason: 'duration_end' })]);
    const after = cardState.markers.find(m => m.kind === 'specialStone' && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
    expect(after).toBeUndefined();
    expect(gameState.board.flat().filter((cell) => cell === 1).length).toBe(1);
  });

  test('moves two times with straight-line jumps and can jump over occupied stones', () => {
    const { cardState, gameState } = makeState();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        gameState.board[r][c] = 1;
      }
    }
    gameState.board[3][3] = 1;
    gameState.board[3][6] = 0;

    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ULTIMATE_HYPERACTIVE' }
    });

    const res = CardLogic.processUltimateHyperactiveMoveAtAnchor(cardState, gameState, 'black', 3, 3, { random: () => 0.1 });

    expect(res.destroyed).toEqual([]);
    expect(res.moved.length).toBe(2);
    expect(res.moved[0].from).toEqual({ row: 3, col: 3 });
    expect(res.moved[0].to).toEqual({ row: 3, col: 6 });
    expect(res.moved[1].from).toEqual({ row: 3, col: 6 });
    expect(res.moved[1].to).toEqual({ row: 3, col: 3 });
    expect(Math.max(Math.abs(res.moved[0].to.row - res.moved[0].from.row), Math.abs(res.moved[0].to.col - res.moved[0].from.col))).toBe(3);
    expect(Math.max(Math.abs(res.moved[1].to.row - res.moved[1].from.row), Math.abs(res.moved[1].to.col - res.moved[1].from.col))).toBe(3);
    expect(gameState.board[3][4]).toBe(1);
    expect(gameState.board[3][5]).toBe(1);

    const marker = cardState.markers.find(m => m.kind === 'specialStone' && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
    expect(marker.row).toBe(3);
    expect(marker.col).toBe(3);
    expect(gameState.board[3][3]).toBe(1);
  });

  test('reverts to a normal stone when no reachable empty cell exists in straight 1-5 range', () => {
    const { cardState, gameState } = makeState();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        gameState.board[r][c] = 1;
      }
    }
    gameState.board[3][3] = 1;
    cardState.markers.push({
      id: 2,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ULTIMATE_HYPERACTIVE' }
    });

    const res = CardLogic.processUltimateHyperactiveMoveAtAnchor(cardState, gameState, 'black', 3, 3, { random: () => 0.1 });
    expect(res.moved).toEqual([]);
    expect(res.destroyed).toEqual([expect.objectContaining({ row: 3, col: 3, reason: 'no_candidates_revert', specialType: 'ULTIMATE_HYPERACTIVE', reverted: true })]);
    expect(gameState.board[3][3]).toBe(1);
    const marker = cardState.markers.find(m => m.kind === 'specialStone' && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
    expect(marker).toBeUndefined();
  });

  test('flips capturable stones after landing (same rule as hyperactive)', () => {
    const { cardState, gameState } = makeState();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        gameState.board[r][c] = 1;
      }
    }
    gameState.board[3][3] = 1;
    gameState.board[3][6] = 0;
    gameState.board[3][5] = -1;

    cardState.markers.push({
      id: 3,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ULTIMATE_HYPERACTIVE' }
    });

    const res = CardLogic.processUltimateHyperactiveMoveAtAnchor(cardState, gameState, 'black', 3, 3, { random: () => 0.1 });
    const flippedSet = new Set((res.flipped || []).map(p => `${p.row},${p.col}`));
    expect(flippedSet.has('3,5')).toBe(true);
    expect(gameState.board[3][5]).toBe(1);
  });

  test('when surrounded with no move destination, only itself reverts', () => {
    const { cardState, gameState } = makeState();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        gameState.board[r][c] = -1;
      }
    }
    gameState.board[3][3] = 1;
    cardState.markers.push({
      id: 4,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ULTIMATE_HYPERACTIVE' }
    });

    const around = [
      [2, 2], [2, 3], [2, 4],
      [3, 2],         [3, 4],
      [4, 2], [4, 3], [4, 4]
    ];
    for (const [r, c] of around) gameState.board[r][c] = -1;

    const res = CardLogic.processUltimateHyperactiveMoveAtAnchor(cardState, gameState, 'black', 3, 3, { random: () => 0.1 });
    const destroyedSet = new Set((res.destroyed || []).map(p => `${p.row},${p.col}`));

    for (const [r, c] of around) {
      expect(gameState.board[r][c]).toBe(-1);
      expect(destroyedSet.has(`${r},${c}`)).toBe(false);
    }
    expect(gameState.board[3][3]).toBe(1);
    expect(destroyedSet.has('3,3')).toBe(true);
    expect(res.destroyed).toEqual([
      expect.objectContaining({ row: 3, col: 3, specialType: 'ULTIMATE_HYPERACTIVE', reason: 'no_candidates_revert', reverted: true })
    ]);
  });

  test('active ultimate hyperactive is no longer treated as flip-protected context stone', () => {
    const { cardState } = makeState();
    cardState.markers.push({
      id: 40,
      kind: 'specialStone',
      row: 2,
      col: 2,
      owner: 'black',
      data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 12 }
    });

    const context = CardLogic.getCardContext(cardState);
    expect(Array.isArray(context.permaProtectedStones)).toBe(true);
    expect(context.permaProtectedStones.some((s) => s.row === 2 && s.col === 2)).toBe(false);
  });

  test('ultimate hyperactive can evade flips repeatedly during duration', () => {
    const prng = { shuffle: (arr) => arr, random: () => 0 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY)),
      currentPlayer: Core.WHITE
    };

    gameState.board[3][3] = Core.WHITE;
    gameState.board[3][4] = Core.WHITE;
    gameState.board[3][5] = Core.BLACK;
    gameState.board[2][3] = Core.BLACK;
    gameState.board[2][4] = Core.BLACK;
    gameState.board[4][2] = Core.BLACK;
    gameState.board[4][3] = Core.BLACK;
    gameState.board[4][4] = Core.BLACK;

    cardState.markers.push({
      id: 41,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'white',
      data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 12 }
    });

    const events1 = [];
    TurnPipelinePhases.applyActionPhase(
      CardLogic,
      Core,
      cardState,
      gameState,
      'black',
      { type: 'place', row: 3, col: 2 },
      events1,
      prng,
      BoardOps
    );

    let marker = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
    expect(marker).toBeTruthy();
    expect(marker.row).toBe(2);
    expect(marker.col).toBe(2);
    expect(gameState.board[3][4]).toBe(Core.BLACK);
    expect(events1.some((ev) => ev && ev.type === 'ultimate_hyperactive_moved_immediate')).toBe(true);

    gameState.board[1][2] = Core.BLACK;
    gameState.board[1][3] = Core.BLACK;
    gameState.board[3][1] = Core.BLACK;
    gameState.board[3][3] = Core.BLACK;

    const events2 = [];
    TurnPipelinePhases.applyActionPhase(
      CardLogic,
      Core,
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 1 },
      events2,
      prng,
      BoardOps
    );

    marker = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
    expect(marker).toBeTruthy();
    expect(marker.row).toBe(1);
    expect(marker.col).toBe(1);
    expect(events2.some((ev) => ev && ev.type === 'ultimate_hyperactive_moved_immediate')).toBe(true);
  });

  test('ultimate hyperactive flip evasion is capped at 5 uses', () => {
    const prng = { shuffle: (arr) => arr, random: () => 0 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY)),
      currentPlayer: Core.BLACK
    };

    gameState.board[4][4] = Core.WHITE;
    cardState.markers.push({
      id: 411,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'white',
      data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 12 }
    });

    for (let i = 0; i < 5; i++) {
      const markerBefore = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
      expect(markerBefore).toBeTruthy();

      const res = CardLogic.resolveHyperactiveFlipEvasion(
        cardState,
        gameState,
        [[markerBefore.row, markerBefore.col]],
        'black',
        prng
      );

      expect(Array.isArray(res.remainingFlips)).toBe(true);
      expect(res.remainingFlips).toHaveLength(0);
      expect(Array.isArray(res.moved)).toBe(true);
      expect(res.moved).toHaveLength(1);

      const markerAfter = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
      expect(markerAfter).toBeTruthy();
      expect(markerAfter.data.flipEvadeRemaining).toBe(4 - i);
      expect(gameState.board[markerAfter.row][markerAfter.col]).toBe(Core.WHITE);
    }

    const markerAtCap = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
    expect(markerAtCap).toBeTruthy();
    expect(markerAtCap.data.flipEvadeRemaining).toBe(0);

    const resAtCap = CardLogic.resolveHyperactiveFlipEvasion(
      cardState,
      gameState,
      [[markerAtCap.row, markerAtCap.col]],
      'black',
      prng
    );

    expect(Array.isArray(resAtCap.moved)).toBe(true);
    expect(resAtCap.moved).toHaveLength(0);
    expect(resAtCap.remainingFlips).toEqual([[markerAtCap.row, markerAtCap.col]]);

    const markerAfterCap = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
    expect(markerAfterCap).toBeTruthy();
    expect(markerAfterCap.row).toBe(markerAtCap.row);
    expect(markerAfterCap.col).toBe(markerAtCap.col);
    expect(markerAfterCap.data.flipEvadeRemaining).toBe(0);
  });

  test('ultimate hyperactive can evade destroy twice and the third destroy removes it', () => {
    const { cardState, gameState } = makeState();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        gameState.board[row][col] = Core.BLACK;
      }
    }
    gameState.board[4][4] = Core.BLACK;
    gameState.board[7][7] = Core.EMPTY;

    cardState.markers.push({
      id: 412,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: {
        type: 'ULTIMATE_HYPERACTIVE',
        remainingOwnerTurns: 12,
        flipEvadeRemaining: 5,
        destroyEvadeRemaining: 2
      }
    });

    const first = BoardOps.destroyAt(cardState, gameState, 4, 4, 'SYSTEM', 'test_destroy');

    expect(first).toMatchObject({
      destroyed: false,
      evaded: true,
      reason: 'destroy_evaded',
      from: { row: 4, col: 4 },
      to: { row: 7, col: 7 }
    });
    expect(gameState.board[4][4]).toBe(Core.EMPTY);
    expect(gameState.board[7][7]).toBe(Core.BLACK);

    let marker = (cardState.markers || []).find((m) => m && m.id === 412);
    expect(marker).toBeTruthy();
    expect(marker.row).toBe(7);
    expect(marker.col).toBe(7);
    expect(marker.data.destroyEvadeRemaining).toBe(1);

    const second = BoardOps.destroyAt(cardState, gameState, 7, 7, 'SYSTEM', 'test_destroy_again');

    expect(second).toMatchObject({
      destroyed: false,
      evaded: true,
      reason: 'destroy_evaded',
      from: { row: 7, col: 7 },
      to: { row: 4, col: 4 }
    });
    expect(gameState.board[7][7]).toBe(Core.EMPTY);
    expect(gameState.board[4][4]).toBe(Core.BLACK);
    marker = (cardState.markers || []).find((m) => m && m.id === 412);
    expect(marker).toBeTruthy();
    expect(marker.row).toBe(4);
    expect(marker.col).toBe(4);
    expect(marker.data.destroyEvadeRemaining).toBe(0);

    const third = BoardOps.destroyAt(cardState, gameState, 4, 4, 'SYSTEM', 'test_destroy_third');

    expect(third && third.destroyed).toBe(true);
    expect(third && third.evaded).toBe(false);
    expect(gameState.board[4][4]).toBe(Core.EMPTY);
    marker = (cardState.markers || []).find((m) => m && m.id === 412);
    expect(marker).toBeUndefined();
  });

  test('tempted hyperactive move still lets target ultimate hyperactive evade', () => {
    const prng = { shuffle: (arr) => arr, random: () => 0 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Core.BLACK)),
      currentPlayer: Core.BLACK
    };

    gameState.board[3][3] = Core.WHITE;
    gameState.board[3][4] = Core.EMPTY;
    gameState.board[3][5] = Core.WHITE;
    gameState.board[2][6] = Core.EMPTY;

    cardState.markers.push(
      {
        id: 500,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'white',
        data: { type: 'HYPERACTIVE', flipEvadeRemaining: 1 }
      },
      {
        id: 501,
        kind: 'specialStone',
        row: 3,
        col: 5,
        owner: 'white',
        data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 12, flipEvadeRemaining: 5 }
      }
    );
    cardState.pendingEffectByPlayer.black = {
      type: 'TEMPT_WILL',
      stage: 'selectTarget',
      cardId: 'tempt_will_01'
    };

    const temptResult = CardLogic.applyTemptWill(cardState, gameState, 'black', 3, 3);
    expect(temptResult && temptResult.applied).toBe(true);

    const res = CardLogic.processHyperactiveMoveAtAnchor(
      cardState,
      gameState,
      'black',
      3,
      3,
      prng,
      { currentTurnPlayerKey: 'black' }
    );

    expect(res.moved).toEqual(expect.arrayContaining([
      expect.objectContaining({
        from: { row: 3, col: 3 },
        to: { row: 3, col: 4 },
        specialType: 'HYPERACTIVE'
      }),
      expect.objectContaining({
        from: { row: 3, col: 5 },
        to: { row: 2, col: 6 },
        specialType: 'ULTIMATE_HYPERACTIVE'
      })
    ]));
    expect(res.flipped).toEqual([]);

    const hyperactiveMarker = (cardState.markers || []).find((m) => (
      m &&
      m.kind === 'specialStone' &&
      m.owner === 'black' &&
      m.row === 3 &&
      m.col === 4 &&
      m.data &&
      m.data.type === 'HYPERACTIVE'
    ));
    const ultimateMarker = (cardState.markers || []).find((m) => (
      m &&
      m.kind === 'specialStone' &&
      m.owner === 'white' &&
      m.row === 2 &&
      m.col === 6 &&
      m.data &&
      m.data.type === 'ULTIMATE_HYPERACTIVE'
    ));

    expect(hyperactiveMarker).toBeTruthy();
    expect(ultimateMarker).toBeTruthy();
    expect(ultimateMarker.data.flipEvadeRemaining).toBe(4);
    expect(gameState.board[3][4]).toBe(Core.BLACK);
    expect(gameState.board[3][5]).toBe(Core.EMPTY);
    expect(gameState.board[2][6]).toBe(Core.WHITE);
  });

  test('ultimate hyperactive move lets target ultimate hyperactive evade before flipping', () => {
    const prng = { shuffle: (arr) => arr, random: () => 0 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(Core.BLACK)),
      currentPlayer: Core.BLACK
    };

    gameState.board[3][4] = Core.EMPTY;
    gameState.board[3][5] = Core.WHITE;
    gameState.board[2][6] = Core.EMPTY;

    cardState.markers.push(
      {
        id: 600,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 12, flipEvadeRemaining: 5 }
      },
      {
        id: 601,
        kind: 'specialStone',
        row: 3,
        col: 5,
        owner: 'white',
        data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 12, flipEvadeRemaining: 5 }
      }
    );

    const res = CardLogic.processUltimateHyperactiveMoveAtAnchor(
      cardState,
      gameState,
      'black',
      3,
      3,
      prng,
      { currentTurnPlayerKey: 'black' }
    );

    expect(res.moved).toEqual(expect.arrayContaining([
      expect.objectContaining({
        from: { row: 3, col: 3 },
        to: { row: 3, col: 4 },
        step: 1
      }),
      expect.objectContaining({
        from: { row: 3, col: 5 },
        to: { row: 2, col: 6 },
        specialType: 'ULTIMATE_HYPERACTIVE'
      })
    ]));
    expect(res.flipped).toEqual([]);

    const blackUltimate = (cardState.markers || []).find((m) => (
      m &&
      m.kind === 'specialStone' &&
      m.owner === 'black' &&
      m.row === 3 &&
      m.col === 3 &&
      m.data &&
      m.data.type === 'ULTIMATE_HYPERACTIVE'
    ));
    const whiteUltimate = (cardState.markers || []).find((m) => (
      m &&
      m.kind === 'specialStone' &&
      m.owner === 'white' &&
      m.row === 2 &&
      m.col === 6 &&
      m.data &&
      m.data.type === 'ULTIMATE_HYPERACTIVE'
    ));

    expect(blackUltimate).toBeTruthy();
    expect(blackUltimate.data.remainingOwnerTurns).toBe(11);
    expect(whiteUltimate).toBeTruthy();
    expect(whiteUltimate.data.flipEvadeRemaining).toBe(4);
    expect(gameState.board[3][3]).toBe(Core.BLACK);
    expect(gameState.board[3][5]).toBe(Core.EMPTY);
    expect(gameState.board[2][6]).toBe(Core.WHITE);
  });

  test('expired ultimate hyperactive can be swapped', () => {
    const { cardState, gameState } = makeState();
    gameState.board[3][3] = 1;
    cardState.markers.push({
      id: 5,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 0 }
    });
    cardState.pendingEffectByPlayer.white = { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget' };

    const targets = CardLogic.getSelectableTargets(cardState, gameState, 'white');
    expect(targets.some(t => t.row === 3 && t.col === 3)).toBe(true);

    const ok = CardLogic.applySwapEffect(cardState, gameState, 'white', 3, 3);
    expect(ok).toBe(true);
    expect(gameState.board[3][3]).toBe(-1);
    expect(cardState.markers.find(m => m.kind === 'specialStone' && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE')).toBeUndefined();
  });
});

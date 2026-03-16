const SharedConstants = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const Core = require('../game/logic/core');
const BoardOps = require('../game/logic/board_ops');
const TurnPipelinePhases = require('../game/turn/turn_pipeline_phases');

function createStates() {
  const prng = { shuffle: (arr) => arr, random: () => 0.5 };
  const cardState = CardLogic.createCardState(prng);
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(0)),
    currentPlayer: 1,
    turnNumber: 0,
    consecutivePasses: 0
  };
  return { cardState, gameState };
}

function countBoardValue(board, value) {
  let total = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === value) total += 1;
    }
  }
  return total;
}

function runTurnStartPhase(cardState, gameState, playerKey, randomValue = 0) {
  const events = [];
  TurnPipelinePhases.applyTurnStartPhase(
    CardLogic,
    { BLACK: SharedConstants.BLACK, WHITE: SharedConstants.WHITE },
    cardState,
    gameState,
    playerKey,
    events,
    { random: () => randomValue, shuffle: (arr) => arr }
  );
  return events;
}

describe('HYPERACTIVE_INHERIT_WILL (多動の継承)', () => {
  test('card use requires own stone target and can select both normal/special own stones', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((d) => d && d.type === 'HYPERACTIVE_INHERIT_WILL');
    expect(def).toBeTruthy();

    const { cardState, gameState } = createStates();
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    const failNoTarget = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(failNoTarget).toBe(false);

    gameState.board[2][2] = 1;
    gameState.board[3][3] = 1;
    cardState.markers.push({
      id: 1001,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'GUARD', remainingOwnerTurns: 2 }
    });

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(used).toBe(true);
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('HYPERACTIVE_INHERIT_WILL');
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.stage).toBe('selectTarget');

    const targets = CardLogic.getSelectableTargets(cardState, gameState, 'black');
    expect(targets.some((t) => t.row === 2 && t.col === 2)).toBe(true);
    expect(targets.some((t) => t.row === 3 && t.col === 3)).toBe(true);
  });

  test('can inherit on guarded own stone and coexist with guard', () => {
    const { cardState, gameState } = createStates();
    gameState.board[4][4] = 1;
    cardState.markers.push({
      id: 1002,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'GUARD', remainingOwnerTurns: 3 }
    });
    cardState.pendingEffectByPlayer.black = {
      type: 'HYPERACTIVE_INHERIT_WILL',
      stage: 'selectTarget',
      cardId: 'hyperactive_inherit_01'
    };

    const applied = CardLogic.applyHyperactiveInheritWill(cardState, gameState, 'black', 4, 4);
    expect(applied && applied.applied).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    const guard = (cardState.markers || []).find((m) => (
      m && m.row === 4 && m.col === 4 && m.owner === 'black' && m.data && m.data.type === 'GUARD'
    ));
    const inherited = (cardState.markers || []).find((m) => (
      m && m.row === 4 && m.col === 4 && m.owner === 'black' && m.data && m.data.type === 'INHERITED_HYPERACTIVE'
    ));

    expect(guard).toBeTruthy();
    expect(inherited).toBeTruthy();
    expect(inherited.data.remainingOwnerTurns).toBe(10);
  });

  test('inherited hyperactive does not decrement on opponent turn', () => {
    const { cardState, gameState } = createStates();
    gameState.board[4][4] = 1;
    cardState.markers.push({
      id: 1003,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 10, hyperactiveSeq: 1 },
      createdSeq: 1
    });

    const res = CardLogic.processHyperactiveMoveAtAnchor(
      cardState,
      gameState,
      'black',
      4,
      4,
      { random: () => 0 },
      { currentTurnPlayerKey: 'white' }
    );

    expect(res && Array.isArray(res.moved)).toBe(true);
    const inherited = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'INHERITED_HYPERACTIVE');
    expect(inherited).toBeTruthy();
    expect(inherited.data.remainingOwnerTurns).toBe(10);
  });

  test('inherited hyperactive decrements on owner turn and expires at zero', () => {
    const { cardState, gameState } = createStates();
    gameState.board[4][4] = 1;
    cardState.markers.push({
      id: 1004,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 1, hyperactiveSeq: 1 },
      createdSeq: 1
    });

    const res = CardLogic.processHyperactiveMoveAtAnchor(
      cardState,
      gameState,
      'black',
      4,
      4,
      { random: () => 0 },
      { currentTurnPlayerKey: 'black' }
    );

    expect(res && Array.isArray(res.destroyed)).toBe(true);
    const inherited = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'INHERITED_HYPERACTIVE');
    expect(inherited).toBeUndefined();
    expect(countBoardValue(gameState.board, 1)).toBe(0);
  });

  test('inherited move keeps coexisting special marker on moved stone', () => {
    const { cardState, gameState } = createStates();
    gameState.board[4][4] = 1;

    // Make only one empty adjacent destination at (4,5)
    const neighbors = [
      [3, 3], [3, 4], [3, 5],
      [4, 3],         [4, 5],
      [5, 3], [5, 4], [5, 5]
    ];
    for (const [r, c] of neighbors) {
      if (r === 4 && c === 5) continue;
      gameState.board[r][c] = -1;
    }

    cardState.markers.push({
      id: 2001,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'GUARD', remainingOwnerTurns: 3 }
    });
    cardState.markers.push({
      id: 2002,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 10, hyperactiveSeq: 1 },
      createdSeq: 1
    });

    const res = CardLogic.processHyperactiveMoveAtAnchor(
      cardState,
      gameState,
      'black',
      4,
      4,
      { random: () => 0 },
      { currentTurnPlayerKey: 'black' }
    );

    expect(res && Array.isArray(res.moved)).toBe(true);
    expect(res.moved.length).toBe(1);
    expect(res.moved[0].from).toEqual({ row: 4, col: 4 });
    expect(res.moved[0].to).toEqual({ row: 4, col: 5 });
    expect(gameState.board[4][4]).toBe(0);
    expect(gameState.board[4][5]).toBe(1);

    const guardAtTarget = (cardState.markers || []).find((m) => (
      m && m.row === 4 && m.col === 5 && m.owner === 'black' && m.data && m.data.type === 'GUARD'
    ));
    const inheritedAtTarget = (cardState.markers || []).find((m) => (
      m && m.row === 4 && m.col === 5 && m.owner === 'black' && m.data && m.data.type === 'INHERITED_HYPERACTIVE'
    ));

    expect(guardAtTarget).toBeTruthy();
    expect(inheritedAtTarget).toBeTruthy();
    expect(inheritedAtTarget.data.remainingOwnerTurns).toBe(9);
  });

  test('inherited hyperactive evades flip once, then flips normally after evade is consumed', () => {
    const { cardState, gameState } = createStates();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        gameState.board[r][c] = 0;
      }
    }

    gameState.board[3][3] = Core.BLACK;
    gameState.board[3][4] = Core.BLACK;
    gameState.board[3][5] = Core.WHITE;
    gameState.board[2][3] = Core.WHITE;
    gameState.board[2][4] = Core.WHITE;
    gameState.board[4][2] = Core.WHITE;
    gameState.board[4][3] = Core.WHITE;
    gameState.board[4][4] = Core.WHITE;

    cardState.markers.push({
      id: 2101,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 10, flipEvadeRemaining: 1, hyperactiveSeq: 1 },
      createdSeq: 1
    });

    const events1 = [];
    TurnPipelinePhases.applyActionPhase(
      CardLogic,
      Core,
      cardState,
      gameState,
      'white',
      { type: 'place', row: 3, col: 2 },
      events1,
      { random: () => 0, shuffle: (arr) => arr },
      BoardOps
    );

    let inherited = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'INHERITED_HYPERACTIVE');
    expect(inherited).toBeTruthy();
    expect(inherited.row).toBe(2);
    expect(inherited.col).toBe(2);
    expect(inherited.data.flipEvadeRemaining).toBe(0);
    expect(gameState.board[3][4]).toBe(Core.WHITE);

    gameState.board[1][2] = Core.WHITE;
    gameState.board[1][3] = Core.WHITE;
    gameState.board[3][1] = Core.WHITE;
    gameState.board[3][3] = Core.WHITE;

    const events2 = [];
    TurnPipelinePhases.applyActionPhase(
      CardLogic,
      Core,
      cardState,
      gameState,
      'white',
      { type: 'place', row: 2, col: 1 },
      events2,
      { random: () => 0, shuffle: (arr) => arr },
      BoardOps
    );

    inherited = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'INHERITED_HYPERACTIVE');
    expect(inherited).toBeUndefined();
    expect(gameState.board[2][2]).toBe(Core.WHITE);
  });

  test('究極多動神と継承多動が共存する場合、反転回避回数は 3+1 で合計4回になる', () => {
    const { cardState, gameState } = createStates();
    const prng = { random: () => 0, shuffle: (arr) => arr };

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        gameState.board[r][c] = Core.EMPTY;
      }
    }
    gameState.board[4][4] = Core.WHITE;

    cardState.markers.push(
      {
        id: 2201,
        kind: 'specialStone',
        row: 4,
        col: 4,
        owner: 'white',
        data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 10 },
        createdSeq: 1
      },
      {
        id: 2202,
        kind: 'specialStone',
        row: 4,
        col: 4,
        owner: 'white',
        data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 10, flipEvadeRemaining: 1, hyperactiveSeq: 1 },
        createdSeq: 2
      }
    );

    const getTotalFlipEvadeRemaining = () => {
      const ultimateMarker = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
      const inheritedMarker = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'INHERITED_HYPERACTIVE');
      const ultimateRemaining = ultimateMarker
        ? (
          Number.isFinite(Number(ultimateMarker.data && ultimateMarker.data.flipEvadeRemaining))
            ? Math.max(0, Math.trunc(Number(ultimateMarker.data.flipEvadeRemaining)))
            : 3
        )
        : 0;
      const inheritedRemaining = inheritedMarker
        ? (
          Number.isFinite(Number(inheritedMarker.data && inheritedMarker.data.flipEvadeRemaining))
            ? Math.max(0, Math.trunc(Number(inheritedMarker.data.flipEvadeRemaining)))
            : 1
        )
        : 0;
      return ultimateRemaining + inheritedRemaining;
    };

    expect(getTotalFlipEvadeRemaining()).toBe(4);

    for (let i = 0; i < 4; i++) {
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
      expect(getTotalFlipEvadeRemaining()).toBe(3 - i);
    }

    const markerAtCap = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
    expect(markerAtCap).toBeTruthy();
    expect(getTotalFlipEvadeRemaining()).toBe(0);

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
  });

  test('多動石へ付与時は 多動移動 → 継承追加1マス移動 の順で発動する', () => {
    const { cardState, gameState } = createStates();
    gameState.board[4][4] = 1;

    for (const [r, c] of [
      [3, 3], [3, 4], [3, 5],
      [4, 3], [4, 6],
      [5, 3], [5, 4], [5, 5], [5, 6], [3, 6]
    ]) {
      gameState.board[r][c] = -1;
    }

    cardState.markers.push(
      {
        id: 3001,
        kind: 'specialStone',
        row: 4,
        col: 4,
        owner: 'black',
        data: { type: 'HYPERACTIVE', hyperactiveSeq: 1 },
        createdSeq: 1
      },
      {
        id: 3002,
        kind: 'specialStone',
        row: 4,
        col: 4,
        owner: 'black',
        data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 10, hyperactiveSeq: 2 },
        createdSeq: 2
      }
    );

    const events = runTurnStartPhase(cardState, gameState, 'black', 0);
    const movedDetails = events
      .filter((ev) => ev && ev.type === 'hyperactive_moved_start')
      .flatMap((ev) => Array.isArray(ev.details) ? ev.details : []);

    expect(movedDetails).toHaveLength(2);
    expect(movedDetails[0].from).toEqual({ row: 4, col: 4 });
    expect(movedDetails[0].to).toEqual({ row: 4, col: 5 });
    expect(movedDetails[1].from).toEqual({ row: 4, col: 5 });
    expect(movedDetails[1].to).toEqual({ row: 4, col: 4 });

    const baseMarker = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'HYPERACTIVE');
    const inheritedMarker = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'INHERITED_HYPERACTIVE');
    expect(baseMarker).toBeTruthy();
    expect(inheritedMarker).toBeTruthy();
    expect(baseMarker.row).toBe(4);
    expect(baseMarker.col).toBe(4);
    expect(inheritedMarker.row).toBe(4);
    expect(inheritedMarker.col).toBe(4);
    expect(inheritedMarker.data.remainingOwnerTurns).toBe(9);
  });

  test('ロボット掃除機へ付与時は 掃除機移動の後に 継承追加1マス移動 する', () => {
    const { cardState, gameState } = createStates();
    gameState.board[3][3] = 1;

    for (const [r, c] of [
      [2, 2], [2, 3], [2, 4],
      [3, 2],
      [4, 2], [4, 3], [4, 4],
      [2, 5], [3, 5], [4, 5]
    ]) {
      gameState.board[r][c] = 1;
    }

    cardState.markers.push(
      {
        id: 4001,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'ROBOT_VACUUM', remainingOwnerTurns: 5, hyperactiveSeq: 1 },
        createdSeq: 1
      },
      {
        id: 4002,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 10, hyperactiveSeq: 2 },
        createdSeq: 2
      }
    );

    const events = runTurnStartPhase(cardState, gameState, 'black', 0);
    const robotEventIndex = events.findIndex((ev) => ev && ev.type === 'robot_vacuum_moved_start');
    const inheritedEventIndex = events.findIndex((ev) => ev && ev.type === 'hyperactive_moved_start');

    expect(robotEventIndex).toBeGreaterThanOrEqual(0);
    expect(inheritedEventIndex).toBeGreaterThan(robotEventIndex);

    const robotMoved = events[robotEventIndex].details[0];
    const inheritedMoved = events[inheritedEventIndex].details[0];
    expect(robotMoved.from).toEqual({ row: 3, col: 3 });
    expect(robotMoved.to).toEqual({ row: 3, col: 4 });
    expect(inheritedMoved.from).toEqual({ row: 3, col: 4 });
    expect(inheritedMoved.to).toEqual({ row: 3, col: 3 });

    const robotMarker = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'ROBOT_VACUUM');
    const inheritedMarker = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'INHERITED_HYPERACTIVE');
    expect(robotMarker).toBeTruthy();
    expect(inheritedMarker).toBeTruthy();
    expect(robotMarker.row).toBe(3);
    expect(robotMarker.col).toBe(3);
    expect(inheritedMarker.row).toBe(3);
    expect(inheritedMarker.col).toBe(3);
  });

  test('究極多動神へ付与時は 2段移動の後に 継承追加1マス移動 する', () => {
    const { cardState, gameState } = createStates();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        gameState.board[r][c] = 1;
      }
    }
    gameState.board[3][3] = 1;
    gameState.board[3][4] = 0;
    gameState.board[3][5] = 0;

    cardState.markers.push(
      {
        id: 5001,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 10 },
        createdSeq: 1
      },
      {
        id: 5002,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'INHERITED_HYPERACTIVE', remainingOwnerTurns: 10, hyperactiveSeq: 3 },
        createdSeq: 2
      },
      {
        id: 5003,
        kind: 'specialStone',
        row: 3,
        col: 3,
        owner: 'black',
        data: { type: 'BLOCKADE', remainingOwnerTurns: 3 },
        createdSeq: 3
      }
    );

    const events = runTurnStartPhase(cardState, gameState, 'black', 0);
    const ultimateEventIndex = events.findIndex((ev) => ev && ev.type === 'ultimate_hyperactive_moved_start');
    const inheritedEventIndex = events.findIndex((ev) => ev && ev.type === 'hyperactive_moved_start');

    expect(ultimateEventIndex).toBeGreaterThanOrEqual(0);
    expect(inheritedEventIndex).toBeGreaterThan(ultimateEventIndex);

    const ultimateMoved = events[ultimateEventIndex].details;
    expect(Array.isArray(ultimateMoved)).toBe(true);
    expect(ultimateMoved).toHaveLength(2);
    expect(ultimateMoved[0].from).toEqual({ row: 3, col: 3 });
    expect(ultimateMoved[0].to).toEqual({ row: 3, col: 4 });
    expect(ultimateMoved[1].from).toEqual({ row: 3, col: 4 });
    expect(ultimateMoved[1].to).toEqual({ row: 3, col: 5 });

    const inheritedMoved = events[inheritedEventIndex].details[0];
    expect(inheritedMoved.from).toEqual({ row: 3, col: 5 });
    expect(inheritedMoved.to).toEqual({ row: 3, col: 4 });

    const ultimateMarker = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
    const inheritedMarker = (cardState.markers || []).find((m) => m && m.data && m.data.type === 'INHERITED_HYPERACTIVE');
    expect(ultimateMarker).toBeTruthy();
    expect(inheritedMarker).toBeTruthy();
    expect(ultimateMarker.row).toBe(3);
    expect(ultimateMarker.col).toBe(4);
    expect(inheritedMarker.row).toBe(3);
    expect(inheritedMarker.col).toBe(4);
    expect(ultimateMarker.data.remainingOwnerTurns).toBe(9);
    expect(inheritedMarker.data.remainingOwnerTurns).toBe(9);
  });
});

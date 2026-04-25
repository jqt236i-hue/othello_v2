const CardLogic = require('../game/logic/cards');

describe('ULTIMATE_DESTROY_GOD duration', () => {
  function makeStates() {
    const prng = { shuffle: (arr) => arr, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1
    };
    return { cardState, gameState };
  }

  test('constant is 5 turns', () => {
    expect(CardLogic.ULTIMATE_DESTROY_GOD_TURNS).toBe(5);
  });

  test('placement applies UDG marker with 5 remaining turns', () => {
    const { cardState, gameState } = makeStates();
    gameState.board[3][3] = 1;
    cardState.pendingEffectByPlayer.black = {
      type: 'ULTIMATE_DESTROY_GOD',
      stage: null,
      cardId: 'udg_01'
    };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 0);
    expect(effects && effects.ultimateDestroyGodPlaced).toBe(true);

    const marker = (cardState.markers || []).find((m) =>
      m &&
      m.kind === 'specialStone' &&
      m.row === 3 &&
      m.col === 3 &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'ULTIMATE_DESTROY_GOD'
    );
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(5);
  });

  test('turn-start processing expires after 5 owner turns', () => {
    const { cardState, gameState } = makeStates();
    gameState.board[4][4] = 1;
    cardState.markers.push({
      id: 9001,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 5 }
    });

    for (let i = 0; i < 4; i++) {
      const res = CardLogic.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, 'black', 4, 4);
      expect(Array.isArray(res.expired) ? res.expired.length : 0).toBe(0);
      const marker = cardState.markers.find((m) => m && m.id === 9001);
      expect(marker).toBeTruthy();
      expect(marker.data.remainingOwnerTurns).toBe(4 - i);
      expect(gameState.board[4][4]).toBe(1);
    }

    const last = CardLogic.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, 'black', 4, 4);
    expect((last.expired || [])).toEqual([expect.objectContaining({ row: 4, col: 4, reason: 'anchor_expired' })]);
    expect(gameState.board[4][4]).toBe(1);
    const marker = cardState.markers.find((m) => m && m.id === 9001);
    expect(marker).toBeUndefined();
  });

  test('owner turn start moves to a random empty cell before destroying around the new anchor', () => {
    const { cardState, gameState } = makeStates();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        gameState.board[row][col] = -1;
      }
    }
    gameState.board[4][4] = 1;
    gameState.board[0][0] = 0;
    cardState.markers.push({
      id: 9401,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 5 }
    });

    try {
      const res = CardLogic.processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState, gameState, 'black', 4, 4, {
        randomSource: { random: () => 0 }
      });

      expect(res.moved).toEqual([
        {
          from: { row: 4, col: 4 },
          to: { row: 0, col: 0 }
        }
      ]);
      expect((res.destroyed || []).map((item) => `${item.row},${item.col}`).sort()).toEqual(['0,1', '1,0', '1,1']);
      expect(gameState.board[4][4]).toBe(0);
      expect(gameState.board[0][0]).toBe(1);
      expect(gameState.board[0][1]).toBe(0);
      expect(gameState.board[1][0]).toBe(0);
      expect(gameState.board[1][1]).toBe(0);
      expect(gameState.board[4][5]).toBe(-1);
      const marker = cardState.markers.find((m) => m && m.id === 9401);
      expect(marker).toBeTruthy();
      expect(marker.row).toBe(0);
      expect(marker.col).toBe(0);
      expect(marker.data.remainingOwnerTurns).toBe(4);

      const presentationEvents = CardLogic.flushPresentationEvents(cardState) || [];
      const moveEvent = presentationEvents.find((ev) => (
        ev &&
        ev.type === 'MOVE' &&
        ev.prevRow === 4 &&
        ev.prevCol === 4 &&
        ev.row === 0 &&
        ev.col === 0 &&
        ev.cause === 'ULTIMATE_DESTROY_GOD' &&
        ev.reason === 'ultimate_destroy_god_move'
      ));
      expect(moveEvent).toBeTruthy();
      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('CardUdG turn-start anchor processor not available'));
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('destroys adjacent enemy stone on expansion cell', () => {
    const { cardState, gameState } = makeStates();
    gameState.board[3][0] = 1;
    gameState.boardExpansion = {
      active: true,
      side: 'left',
      row: 3,
      owner: -1,
      usedByPlayer: { black: true, white: false }
    };

    cardState.markers.push({
      id: 9101,
      kind: 'specialStone',
      row: 3,
      col: 0,
      owner: 'black',
      data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 5 }
    });

    const res = CardLogic.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, 'black', 3, 0, {
      decrementRemainingOwnerTurns: false
    });

    expect((res.destroyed || []).some((p) => p.row === 3 && p.col === -1)).toBe(true);
    expect(gameState.boardExpansion.owner).toBe(0);
  });

  test('destroys adjacent enemy stone on corner expansion cell', () => {
    const { cardState, gameState } = makeStates();
    gameState.board[0][0] = 1;
    gameState.boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: 0,
      usedByPlayer: { black: true, white: false },
      cells: [{ row: -1, col: -1, owner: -1 }]
    };

    cardState.markers.push({
      id: 9102,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 5 }
    });

    const res = CardLogic.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, 'black', 0, 0, {
      decrementRemainingOwnerTurns: false
    });

    expect((res.destroyed || []).some((p) => p.row === -1 && p.col === -1)).toBe(true);
    expect(gameState.boardExpansion.cells.find((cell) => cell && cell.row === -1 && cell.col === -1).owner).toBe(0);
  });

  test('udg destroy presentation event includes source metadata for lightning', () => {
    const { cardState, gameState } = makeStates();
    gameState.board[4][4] = 1;
    gameState.board[4][5] = -1;
    cardState.markers.push({
      id: 9201,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 5 }
    });

    CardLogic.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, 'black', 4, 4, {
      decrementRemainingOwnerTurns: false
    });

    const presentationEvents = CardLogic.flushPresentationEvents(cardState) || [];
    const destroyEvent = presentationEvents.find((ev) => (
      ev &&
      ev.type === 'DESTROY' &&
      ev.row === 4 &&
      ev.col === 5 &&
      ev.cause === 'ULTIMATE_DESTROY_GOD' &&
      ev.reason === 'udg_destroyed'
    ));

    expect(destroyEvent).toBeTruthy();
    expect(destroyEvent.meta).toMatchObject({
      sourceRow: 4,
      sourceCol: 4,
      projectileOwner: 'black',
      projectileStone: 'udg_lightning'
    });
  });

  test('udg destruction respects destroy evade and leaves the target stone alive elsewhere', () => {
    const { cardState, gameState } = makeStates();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        gameState.board[row][col] = 1;
      }
    }
    gameState.board[4][4] = 1;
    gameState.board[4][5] = -1;
    gameState.board[7][7] = 0;
    cardState.markers.push(
      {
        id: 9301,
        kind: 'specialStone',
        row: 4,
        col: 4,
        owner: 'black',
        data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 5 }
      },
      {
        id: 9302,
        kind: 'specialStone',
        row: 4,
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

    const res = CardLogic.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, 'black', 4, 4, {
      decrementRemainingOwnerTurns: false
    });

    expect(res.destroyed).toEqual([]);
    expect(gameState.board[4][5]).toBe(0);
    expect(gameState.board[7][7]).toBe(-1);
    const movedMarker = cardState.markers.find((m) => m && m.id === 9302);
    expect(movedMarker).toBeTruthy();
    expect(movedMarker.row).toBe(7);
    expect(movedMarker.col).toBe(7);
    expect(movedMarker.data.destroyEvadeRemaining).toBe(0);
  });

  test('udg makes destroy evade skip all cells targeted by the same destroy wave', () => {
    const { cardState, gameState } = makeStates();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        gameState.board[row][col] = 1;
      }
    }
    gameState.board[4][4] = 1;
    gameState.board[4][5] = -1;
    gameState.board[5][5] = 0;
    gameState.board[7][7] = 0;
    cardState.markers.push(
      {
        id: 9401,
        kind: 'specialStone',
        row: 4,
        col: 4,
        owner: 'black',
        data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 5 }
      },
      {
        id: 9402,
        kind: 'specialStone',
        row: 4,
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

    const res = CardLogic.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, 'black', 4, 4, {
      decrementRemainingOwnerTurns: false
    });

    expect(res.destroyed).toEqual([]);
    expect(gameState.board[4][5]).toBe(0);
    expect(gameState.board[5][5]).toBe(0);
    expect(gameState.board[7][7]).toBe(-1);
    const movedMarker = cardState.markers.find((m) => m && m.id === 9402);
    expect(movedMarker).toBeTruthy();
    expect(movedMarker.row).toBe(7);
    expect(movedMarker.col).toBe(7);
    expect(movedMarker.data.destroyEvadeRemaining).toBe(0);
  });
});

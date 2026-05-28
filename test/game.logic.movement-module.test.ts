import * as CardMovement from '../game/logic/cards/movement.js';
import * as Core from '../game/logic/core.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';

describe('CardMovement module', () => {
  test.each([
    ['BUOYANCY_WILL', 'buoyancy_01'],
    ['GRAVITY_WILL', 'gravity_01']
  ])('use_card for %s creates selectable pending effect', (cardType, cardId) => {
    const gameState = Core.createGameState();
    const cardState = CardLogic.createCardState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
    gameState.board[3][3] = Core.BLACK;
    cardState.hands.black = [cardId];
    cardState.charge.black = 99;
    cardState.hasUsedCardThisTurnByPlayer.black = false;

    const result = TurnPipeline.applyTurn(cardState, gameState, 'black', {
      type: 'use_card',
      useCardId: cardId,
      useCardOwnerKey: 'black'
    });

    expect(result.ok).not.toBe(false);
    expect(result.cardState.pendingEffectByPlayer.black).toMatchObject({
      type: cardType,
      stage: 'selectTarget',
      cardId
    });
  });

  test('applyStrongWindWill moves to the farthest option and clears pending', () => {
    const cardState = {
      pendingEffectByPlayer: { black: { type: 'STRONG_WIND_WILL', stage: 'selectTarget', cardId: 'wind_01' } },
      markers: [{ id: 'm1', row: 3, col: 3, kind: 'specialStone', owner: 'black', data: { type: 'WORK' } }]
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };

    const result = CardMovement.applyStrongWindWill(cardState, gameState, 'black', 3, 3, { random: () => 0.5 }, {
      getCellValueForCard: (state, row, col) => {
        if (row === 3 && col === 3) return 1;
        if (row === 3 && (col === 4 || col === 5)) return 0;
        return null;
      },
      hasBoardShapeCellForCard: (cs, gs, row, col) => row === 3 && (col === 4 || col === 5),
      isBlockedCell: () => false,
      setCellValueForCard: jest.fn(() => true),
      moveAt: jest.fn(() => ({ moved: true })),
      getMarkers: (state) => state.markers
    });

    expect(result).toMatchObject({
      applied: true,
      from: { row: 3, col: 3 },
      to: { row: 3, col: 5 },
      movedDistance: 2,
      chargeGained: 0
    });
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(cardState.markers[0]).toMatchObject({ row: 3, col: 5 });
  });

  test('applySuperBuoyancyWill destroys collisions, moves the stone, and clears pending', () => {
    const destroyed = [];
    const moved = [];
    const cardState = {
      pendingEffectByPlayer: { white: { type: 'SUPER_BUOYANCY_WILL', stage: 'selectTarget', cardId: 'buoyancy_01' } },
      markers: []
    };
    const occupied = new Set(['4,2', '3,2']);

    const result = CardMovement.applySuperBuoyancyWill(cardState, {}, 'white', 4, 2, {
      getSuperBuoyancyTargets: () => [{ row: 4, col: 2 }],
      getCellValueForCard: (state, row, col) => (occupied.has(`${row},${col}`) ? -1 : 0),
      hasBoardShapeCellForCard: (cs, gs, row, col) => Number.isInteger(row) && row >= 1 && row <= 3 && col === 2,
      isBlockedCell: () => false,
      findSpecialMarkerAt: () => null,
      destroyAt: (cs, gs, row, col) => {
        destroyed.push({ row, col });
        occupied.delete(`${row},${col}`);
        return { destroyed: true };
      },
      isDestroyResolved: (resultValue) => !!(resultValue && resultValue.destroyed),
      moveAt: (cs, gs, fromRow, fromCol, toRow, toCol) => {
        moved.push({ fromRow, fromCol, toRow, toCol });
        occupied.delete(`${fromRow},${fromCol}`);
        occupied.add(`${toRow},${toCol}`);
        return { moved: true };
      },
      getMarkers: () => []
    });

    expect(result).toMatchObject({
      applied: true,
      to: { row: 1, col: 2 },
      destroyedCount: 1,
      movedDistance: 3
    });
    expect(destroyed).toEqual([{ row: 3, col: 2 }]);
    expect(moved).toEqual([{ fromRow: 4, fromCol: 2, toRow: 1, toCol: 2 }]);
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('applyBuoyancyWill stops before occupied cells without destroying them', () => {
    const moved = [];
    const cardState = {
      pendingEffectByPlayer: { white: { type: 'BUOYANCY_WILL', stage: 'selectTarget', cardId: 'buoyancy_01' } },
      markers: []
    };
    const occupied = new Set(['5,2', '2,2']);

    const result = CardMovement.applyBuoyancyWill(cardState, {}, 'white', 5, 2, {
      getBuoyancyTargets: () => [{ row: 5, col: 2 }],
      getCellValueForCard: (state, row, col) => (occupied.has(`${row},${col}`) ? -1 : 0),
      hasBoardShapeCellForCard: (cs, gs, row, col) => Number.isInteger(row) && row >= 1 && row <= 4 && col === 2,
      isBlockedCell: () => false,
      moveAt: (cs, gs, fromRow, fromCol, toRow, toCol) => {
        moved.push({ fromRow, fromCol, toRow, toCol });
        occupied.delete(`${fromRow},${fromCol}`);
        occupied.add(`${toRow},${toCol}`);
        return { moved: true };
      },
      getMarkers: () => []
    });

    expect(result).toMatchObject({
      applied: true,
      to: { row: 3, col: 2 },
      destroyedCount: 0,
      movedDistance: 2
    });
    expect(occupied.has('2,2')).toBe(true);
    expect(moved).toEqual([{ fromRow: 5, fromCol: 2, toRow: 3, toCol: 2 }]);
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('applyGravityWill fails when adjacent downward cell is occupied', () => {
    const cardState = {
      pendingEffectByPlayer: { black: { type: 'GRAVITY_WILL', stage: 'selectTarget', cardId: 'gravity_01' } },
      markers: []
    };
    const occupied = new Set(['2,4', '3,4']);

    const result = CardMovement.applyGravityWill(cardState, {}, 'black', 2, 4, {
      getGravityTargets: () => [{ row: 2, col: 4 }],
      getCellValueForCard: (state, row, col) => (occupied.has(`${row},${col}`) ? 1 : 0),
      hasBoardShapeCellForCard: (cs, gs, row, col) => Number.isInteger(row) && row >= 3 && row <= 6 && col === 4,
      isBlockedCell: () => false,
      moveAt: jest.fn(() => ({ moved: true })),
      getMarkers: () => []
    });

    expect(result).toMatchObject({ applied: false, reason: 'no_move_options' });
    expect(cardState.pendingEffectByPlayer.black).toBeTruthy();
  });

  test('applySuperAttractionWill stores first target, then destroys line occupants and moves to destination', () => {
    const destroyed = [];
    const moved = [];
    const cardState = {
      pendingEffectByPlayer: { black: { type: 'SUPER_ATTRACTION_WILL', stage: 'selectTarget', cardId: 'super_attraction_01' } },
      markers: []
    };
    const occupied = new Set(['2,2', '3,3', '4,4']);

    const deps = {
      getSuperAttractionTargets: (cs, gs, playerKey, pending) => {
        if (pending && pending.firstTarget) return [{ row: 4, col: 4 }];
        return [{ row: 2, col: 2 }];
      },
      getCellValueForCard: (state, row, col) => (occupied.has(`${row},${col}`) ? 1 : 0),
      hasBoardShapeCellForCard: (cs, gs, row, col) => Number.isInteger(row) && row >= 0 && row < 8 && Number.isInteger(col) && col >= 0 && col < 8,
      isBlockedCell: () => false,
      findSpecialMarkerAt: () => null,
      destroyAt: (cs, gs, row, col) => {
        destroyed.push({ row, col });
        occupied.delete(`${row},${col}`);
        return { destroyed: true };
      },
      isDestroyResolved: (resultValue) => !!(resultValue && resultValue.destroyed),
      moveAt: (cs, gs, fromRow, fromCol, toRow, toCol) => {
        moved.push({ fromRow, fromCol, toRow, toCol });
        occupied.delete(`${fromRow},${fromCol}`);
        occupied.add(`${toRow},${toCol}`);
        return { moved: true };
      },
      getMarkers: () => []
    };

    const first = CardMovement.applySuperAttractionWill(cardState, {}, 'black', 2, 2, undefined, deps);
    expect(first).toMatchObject({
      applied: true,
      completed: false,
      firstTarget: { row: 2, col: 2 }
    });
    expect(cardState.pendingEffectByPlayer.black.firstTarget).toEqual({ row: 2, col: 2 });

    const second = CardMovement.applySuperAttractionWill(cardState, {}, 'black', 4, 4, undefined, deps);
    expect(second).toMatchObject({
      applied: true,
      completed: true,
      from: { row: 2, col: 2 },
      to: { row: 4, col: 4 },
      destroyedCount: 2,
      movedDistance: 2,
      selectedPathVariant: 'single_segment',
      pathCells: [{ row: 3, col: 3 }, { row: 4, col: 4 }],
      waypoints: [{ row: 4, col: 4 }]
    });
    expect(destroyed).toEqual([{ row: 3, col: 3 }, { row: 4, col: 4 }]);
    expect(moved).toEqual([{ fromRow: 2, fromCol: 2, toRow: 4, toCol: 4 }]);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('getSuperAttractionTargets includes non-line arbitrary destinations when a shortest path exists', () => {
    const gameState = Core.createGameState();
    const cardState = CardLogic.createCardState();

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
    gameState.board[2][2] = Core.BLACK;
    cardState.pendingEffectByPlayer.black = {
      type: 'SUPER_ATTRACTION_WILL',
      stage: 'selectTarget',
      cardId: 'super_attraction_01',
      firstTarget: { row: 2, col: 2 }
    };

    const targets = CardLogic.getSuperAttractionTargets(cardState, gameState, 'black', cardState.pendingEffectByPlayer.black);
    expect(targets).toEqual(expect.arrayContaining([{ row: 5, col: 4 }]));
  });

  test('getSuperAttractionTargets excludes destination ghosts', () => {
    const gameState = Core.createGameState();
    const cardState = CardLogic.createCardState();

    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
    gameState.board[2][2] = Core.BLACK;
    gameState.board[5][4] = Core.WHITE;
    cardState.markers.push({
      id: 'ghost-destination',
      kind: 'specialStone',
      row: 5,
      col: 4,
      owner: 'white',
      data: { type: 'GHOST', remainingOwnerTurns: 5 }
    });
    cardState.pendingEffectByPlayer.black = {
      type: 'SUPER_ATTRACTION_WILL',
      stage: 'selectTarget',
      cardId: 'super_attraction_01',
      firstTarget: { row: 2, col: 2 }
    };

    const targets = CardLogic.getSuperAttractionTargets(cardState, gameState, 'black', cardState.pendingEffectByPlayer.black);
    expect(targets).not.toEqual(expect.arrayContaining([{ row: 5, col: 4 }]));
  });

  test('applySuperAttractionWill chooses a shortest two-segment path by PRNG and keeps moving through ghost collisions', () => {
    const destroyed = [];
    const moved = [];
    const cardState = {
      pendingEffectByPlayer: {
        black: {
          type: 'SUPER_ATTRACTION_WILL',
          stage: 'selectTarget',
          cardId: 'super_attraction_01',
          firstTarget: { row: 2, col: 2 }
        }
      },
      markers: []
    };
    const occupied = new Set(['2,2', '4,4', '5,4']);

    const result = CardMovement.applySuperAttractionWill(cardState, {}, 'black', 5, 4, { random: () => 0 }, {
      getSuperAttractionTargets: () => [{ row: 5, col: 4 }],
      getCellValueForCard: (state, row, col) => (occupied.has(`${row},${col}`) ? 1 : 0),
      hasBoardShapeCellForCard: (cs, gs, row, col) => Number.isInteger(row) && row >= 0 && row < 8 && Number.isInteger(col) && col >= 0 && col < 8,
      isBlockedCell: () => false,
      findSpecialMarkerAt: (cs, row, col, type) => {
        if (type === 'GHOST' && row === 4 && col === 4) return { data: { type: 'GHOST' } };
        return null;
      },
      destroyAt: (cs, gs, row, col) => {
        destroyed.push({ row, col });
        if (!(row === 4 && col === 4)) occupied.delete(`${row},${col}`);
        return row === 4 && col === 4 ? { blockedByGhost: true } : { destroyed: true };
      },
      isDestroyResolved: (resultValue) => !!(resultValue && (resultValue.destroyed || resultValue.blockedByGhost)),
      moveAt: (cs, gs, fromRow, fromCol, toRow, toCol, cause, reason, meta) => {
        moved.push({ fromRow, fromCol, toRow, toCol, meta });
        occupied.delete(`${fromRow},${fromCol}`);
        occupied.add(`${toRow},${toCol}`);
        return { moved: true };
      },
      getMarkers: () => []
    });

    expect(result).toMatchObject({
      applied: true,
      completed: true,
      from: { row: 2, col: 2 },
      to: { row: 5, col: 4 },
      destroyedCount: 2,
      movedDistance: 3,
      selectedPathVariant: 'diagonal_first',
      pathCells: [{ row: 3, col: 3 }, { row: 4, col: 4 }, { row: 5, col: 4 }],
      waypoints: [{ row: 4, col: 4 }, { row: 5, col: 4 }]
    });
    expect(destroyed).toEqual([{ row: 4, col: 4 }, { row: 5, col: 4 }]);
    expect(moved).toEqual([{
      fromRow: 2,
      fromCol: 2,
      toRow: 5,
      toCol: 4,
      meta: expect.objectContaining({
        selectedPathVariant: 'diagonal_first',
        travelDistance: 3,
        waypoints: [{ row: 4, col: 4 }, { row: 5, col: 4 }]
      })
    }]);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(occupied.has('4,4')).toBe(true);
  });

  test('applySuperAttractionWill discards blocked shortest-path candidates before PRNG selection', () => {
    const destroyed = [];
    const cardState = {
      pendingEffectByPlayer: {
        black: {
          type: 'SUPER_ATTRACTION_WILL',
          stage: 'selectTarget',
          cardId: 'super_attraction_01',
          firstTarget: { row: 2, col: 2 }
        }
      },
      markers: []
    };
    const occupied = new Set(['2,2', '3,2', '5,4']);

    const result = CardMovement.applySuperAttractionWill(cardState, {}, 'black', 5, 4, { random: () => 0.99 }, {
      getSuperAttractionTargets: () => [{ row: 5, col: 4 }],
      getCellValueForCard: (state, row, col) => (occupied.has(`${row},${col}`) ? 1 : 0),
      hasBoardShapeCellForCard: (cs, gs, row, col) => Number.isInteger(row) && row >= 0 && row < 8 && Number.isInteger(col) && col >= 0 && col < 8,
      isBlockedCell: () => false,
      findSpecialMarkerAt: (cs, row, col, type) => {
        if (type === 'GUARD' && row === 3 && col === 2) return { data: { type: 'GUARD' } };
        return null;
      },
      destroyAt: (cs, gs, row, col) => {
        destroyed.push({ row, col });
        occupied.delete(`${row},${col}`);
        return { destroyed: true };
      },
      isDestroyResolved: (resultValue) => !!(resultValue && resultValue.destroyed),
      moveAt: () => ({ moved: true }),
      getMarkers: () => []
    });

    expect(result).toMatchObject({
      applied: true,
      selectedPathVariant: 'diagonal_first',
      pathCells: [{ row: 3, col: 3 }, { row: 4, col: 4 }, { row: 5, col: 4 }]
    });
    expect(destroyed).toEqual([{ row: 5, col: 4 }]);
  });
});

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
});

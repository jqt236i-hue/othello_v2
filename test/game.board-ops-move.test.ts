import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import * as BoardOps from '../game/logic/board_ops.js';

function createPrng() {
  return {
    shuffle: (arr) => arr,
    random: () => 0
  };
}

function createEmptyState() {
  const cardState = CardLogic.createCardState(createPrng());
  const gameState = Core.createGameState();
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
  cardState.debugNoDraw = true;
  return { cardState, gameState };
}

let nextMarkerId = 1;

function marker(type, row = 2, col = 2, extra = {}) {
  return {
    id: nextMarkerId++,
    kind: 'specialStone',
    row,
    col,
    owner: 'black',
    data: Object.assign({ type }, extra)
  };
}

describe('BoardOps moveAt marker ownership', () => {
  test('moves stone-attached markers and leaves cell-fixed markers behind', () => {
    const { cardState, gameState } = createEmptyState();
    gameState.board[2][2] = Core.BLACK;
    cardState.markers.push(
      marker('TRAP'),
      marker('GUARD'),
      marker('HYPERACTIVE'),
      marker('BLOCKADE'),
      marker('METEOR_HOLE'),
      marker('SEED')
    );

    const result = BoardOps.moveAt(cardState, gameState, 2, 2, 2, 5, 'STRONG_WIND_WILL', 'strong_wind_move');

    expect(result.moved).toBe(true);
    expect(gameState.board[2][2]).toBe(Core.EMPTY);
    expect(gameState.board[2][5]).toBe(Core.BLACK);
    const byType = new Map(cardState.markers.map((m) => [m.data.type, m]));
    for (const type of ['TRAP', 'GUARD', 'HYPERACTIVE']) {
      expect(byType.get(type)).toMatchObject({ row: 2, col: 5 });
    }
    for (const type of ['BLOCKADE', 'METEOR_HOLE', 'SEED']) {
      expect(byType.get(type)).toMatchObject({ row: 2, col: 2 });
    }
    const moveEvent = cardState.presentationEvents.find((event) => event && event.type === 'MOVE');
    expect(moveEvent).toMatchObject({
      prevRow: 2,
      prevCol: 2,
      row: 2,
      col: 5,
      meta: expect.objectContaining({ moveIntent: 'wind_move' })
    });
  });

  test('does not mutate board, markers, or events when moveAt fails', () => {
    const { cardState, gameState } = createEmptyState();
    gameState.board[2][2] = Core.BLACK;
    gameState.board[2][5] = Core.WHITE;
    cardState.markers.push(marker('HYPERACTIVE'));

    const result = BoardOps.moveAt(cardState, gameState, 2, 2, 2, 5, 'STRONG_WIND_WILL', 'strong_wind_move');

    expect(result.moved).toBe(false);
    expect(result.reason).toBe('dest_not_empty');
    expect(gameState.board[2][2]).toBe(Core.BLACK);
    expect(gameState.board[2][5]).toBe(Core.WHITE);
    expect(cardState.markers[0]).toMatchObject({ row: 2, col: 2 });
    expect((cardState.presentationEvents || []).filter((event) => event && event.type === 'MOVE')).toHaveLength(0);
  });

  test('keeps frozen source unchanged when movement is blocked by FREEZE', () => {
    const { cardState, gameState } = createEmptyState();
    gameState.board[2][2] = Core.BLACK;
    cardState.markers.push(marker('FREEZE'));

    const result = BoardOps.moveAt(cardState, gameState, 2, 2, 2, 5, 'TELEPORT_WILL', 'teleport_move');

    expect(result.moved).toBe(false);
    expect(result.reason).toBe('frozen_source');
    expect(gameState.board[2][2]).toBe(Core.BLACK);
    expect(gameState.board[2][5]).toBe(Core.EMPTY);
    expect(cardState.markers[0]).toMatchObject({ row: 2, col: 2 });
    expect((cardState.presentationEvents || []).filter((event) => event && event.type === 'MOVE')).toHaveLength(0);
  });

  test('swapOccupiedCells swaps stone-attached markers only and emits paired move events', () => {
    const { cardState, gameState } = createEmptyState();
    gameState.board[1][1] = Core.BLACK;
    gameState.board[2][2] = Core.WHITE;
    cardState.markers.push(
      marker('HYPERACTIVE', 1, 1),
      marker('TRAP', 2, 2),
      marker('METEOR_HOLE', 1, 1),
      marker('SEED', 2, 2)
    );

    const result = BoardOps.swapOccupiedCells(
      cardState,
      gameState,
      { row: 1, col: 1 },
      { row: 2, col: 2 },
      { cause: 'POSITION_SWAP_WILL', reason: 'position_swap', actionId: 'swap-1' }
    );

    expect(result.swapped).toBe(true);
    expect(gameState.board[1][1]).toBe(Core.WHITE);
    expect(gameState.board[2][2]).toBe(Core.BLACK);
    const byType = new Map(cardState.markers.map((m) => [m.data.type, m]));
    expect(byType.get('HYPERACTIVE')).toMatchObject({ row: 2, col: 2 });
    expect(byType.get('TRAP')).toMatchObject({ row: 1, col: 1 });
    expect(byType.get('METEOR_HOLE')).toMatchObject({ row: 1, col: 1 });
    expect(byType.get('SEED')).toMatchObject({ row: 2, col: 2 });
    const moveEvents = cardState.presentationEvents.filter((event) => event && event.type === 'MOVE');
    expect(moveEvents).toHaveLength(2);
    expect(moveEvents.every((event) => event.actionId === 'swap-1')).toBe(true);
    expect(moveEvents.every((event) => event.meta && event.meta.moveIntent === 'position_swap')).toBe(true);
  });
});

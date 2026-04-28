import * as SelectorOrchestrator from '../game/logic/cards-internal/selector-orchestrator.js';

function createBoard(rows = 10, cols = rows) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function createExpansionCells(cells) {
  return Array.isArray(cells) ? cells.map((cell) => ({ ...cell })) : [];
}

function createContext(overrides = {}) {
  return {
    cardState: { markers: [] },
    gameState: {
      board: createBoard(),
      boardExpansion: { active: false, side: null, row: null, owner: 0, cells: [] }
    },
    pending: null,
    playerKey: 'black',
    constants: { EMPTY: 0, BLACK: 1, WHITE: -1 },
    helpers: {
      getExpansionDescriptorsForCard(gameState) {
        return createExpansionCells(gameState && gameState.boardExpansion && gameState.boardExpansion.cells);
      }
    },
    ...overrides
  };
}

describe('selector-orchestrator fallback on custom boards', () => {
  test('DESTROY_ONE_STONE fallback scans full 10x10 main board and right expansion cells', () => {
    const context = createContext({
      pending: { type: 'DESTROY_ONE_STONE', stage: 'selectTarget' }
    });
    context.gameState.board[9][9] = -1;
    context.gameState.boardExpansion.cells = createExpansionCells([
      { side: 'right', row: 0, col: 10, owner: -1 }
    ]);

    const targets = SelectorOrchestrator.getSelectableTargetsForPending(context);
    const set = new Set(targets.map((target) => `${target.row},${target.col}`));

    expect(set.has('9,9')).toBe(true);
    expect(set.has('0,10')).toBe(true);
  });

  test('SWAP_WITH_ENEMY fallback scans full 10x10 main board and right expansion cells', () => {
    const context = createContext({
      pending: { type: 'SWAP_WITH_ENEMY', stage: 'selectTarget' }
    });
    context.gameState.board[9][9] = -1;
    context.gameState.boardExpansion.cells = createExpansionCells([
      { side: 'right', row: 0, col: 10, owner: -1 }
    ]);

    const targets = SelectorOrchestrator.getSelectableTargetsForPending(context);
    const set = new Set(targets.map((target) => `${target.row},${target.col}`));

    expect(set.has('9,9')).toBe(true);
    expect(set.has('0,10')).toBe(true);
  });

  test('POSITION_SWAP_WILL fallback scans full 10x10 main board and expansion cells while skipping first target', () => {
    const context = createContext({
      pending: {
        type: 'POSITION_SWAP_WILL',
        stage: 'selectTarget',
        firstTarget: { row: 9, col: 9 }
      },
      helpers: {
        getExpansionDescriptorsForCard(gameState) {
          return createExpansionCells(gameState && gameState.boardExpansion && gameState.boardExpansion.cells);
        },
        isPositionSwapProtectedCell: () => false
      }
    });
    context.gameState.board[9][9] = -1;
    context.gameState.board[8][8] = 1;
    context.gameState.boardExpansion.cells = createExpansionCells([
      { side: 'bottom', row: 10, col: 9, owner: -1 }
    ]);

    const targets = SelectorOrchestrator.getSelectableTargetsForPending(context);
    const set = new Set(targets.map((target) => `${target.row},${target.col}`));

    expect(set.has('9,9')).toBe(false);
    expect(set.has('8,8')).toBe(true);
    expect(set.has('10,9')).toBe(true);
  });
});

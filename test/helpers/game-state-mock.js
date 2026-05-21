'use strict';

/**
 * Create an empty board matrix filled with EMPTY values.
 *
 * @param {object} Shared - shared-constants module (for Shared.EMPTY)
 * @param {number} [rows=8] - number of rows
 * @param {number} [cols=8] - number of columns
 * @returns {number[][]} board matrix
 */
function createBoard(Shared, rows, cols) {
  rows = rows || 8;
  cols = cols || 8;
  return Array.from({ length: rows }, () => Array(cols).fill(Shared.EMPTY));
}

/**
 * Create a realistic GameState with the standard Reversi opening position
 * placed on the board by default.
 *
 * The returned state includes board, currentPlayer, turnNumber,
 * consecutivePasses, roundNumber, boardConfig, and boardExpansion.
 * Pass an overrides object to replace any field.
 *
 * @param {object} Shared - shared-constants module (for EMPTY / BLACK / WHITE)
 * @param {object|number[][]} [overrides] - Optional overrides object, or a
 *   board array to use instead of the default opening. Fields in the overrides
 *   object are merged into the default state.
 * @returns {object} GameState
 */
function createGameState(Shared, overrides) {
  var board = createBoard(Shared);

  // Place the standard 4-stone Reversi opening
  board[3][3] = Shared.BLACK;
  board[3][4] = Shared.WHITE;
  board[4][3] = Shared.WHITE;
  board[4][4] = Shared.BLACK;

  var state = {
    board: board,
    boardConfig: createDefaultBoardConfig(),
    currentPlayer: Shared.BLACK,
    consecutivePasses: 0,
    turnNumber: 1,
    roundNumber: 1,
    roundCompletionByPlayer: { black: false, white: false },
    pendingRoundBonus: null,
    boardExpansion: null
  };

  if (Array.isArray(overrides)) {
    // overrides is a board array — replace board only
    state.board = overrides;
    return state;
  }

  if (overrides && typeof overrides === 'object') {
    return assign(state, overrides);
  }

  return state;
}

/**
 * Create a default board configuration for an 8x8 standard board.
 *
 * @returns {object} boardConfig
 */
function createDefaultBoardConfig() {
  return {
    rows: 8,
    cols: 8,
    standard8x8: true,
    baseBounds: { minRow: 0, maxRow: 7, minCol: 0, maxCol: 7 },
    outerBounds: { minRow: -1, maxRow: 8, minCol: -1, maxCol: 8 }
  };
}

/**
 * Place stones on the board using [row, col, value] entries.
 * Mutates gameState.board in place.
 *
 * @param {object} gameState
 * @param {Array<[number, number, number]>} entries - e.g. [[0, 0, 1], [0, 1, -1]]
 */
function placeStones(gameState, entries) {
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    gameState.board[entry[0]][entry[1]] = entry[2];
  }
}

/**
 * Set up the standard 4-stone Reversi opening on the given game state.
 * Mutates gameState.board in place.
 *
 * @param {object} Shared - shared-constants module
 * @param {object} gameState
 */
function setupStandardOpening(Shared, gameState) {
  gameState.board[3][3] = Shared.BLACK;
  gameState.board[3][4] = Shared.WHITE;
  gameState.board[4][3] = Shared.WHITE;
  gameState.board[4][4] = Shared.BLACK;
}

/**
 * Clone a game state with a deep-copied board.
 * Other fields are shallow-copied.
 *
 * @param {object} gameState
 * @returns {object} cloned game state
 */
function cloneGameState(gameState) {
  var cloned = {};
  for (var key in gameState) {
    if (Object.prototype.hasOwnProperty.call(gameState, key)) {
      cloned[key] = gameState[key];
    }
  }
  cloned.board = gameState.board.map(function (row) {
    return row.slice();
  });
  return cloned;
}

/**
 * Shallow-assign properties from source to target.
 * Returns a new object when target is null/undefined.
 *
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
function assign(target, source) {
  if (!target || typeof target !== 'object') target = {};
  if (!source || typeof source !== 'object') return target;
  for (var key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      target[key] = source[key];
    }
  }
  return target;
}

module.exports = {
  createBoard: createBoard,
  createGameState: createGameState,
  createDefaultBoardConfig: createDefaultBoardConfig,
  placeStones: placeStones,
  setupStandardOpening: setupStandardOpening,
  cloneGameState: cloneGameState
};

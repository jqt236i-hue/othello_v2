/**
 * Shared type definitions for JSDoc / TypeScript migration groundwork.
 *
 * @fileoverview Central place for cross-module type aliases used by
 *   shared/*, game/*, ui/* and cpu/* code.
 */

/**
 * Human-readable player identifier.
 * @typedef {'black' | 'white'} PlayerKey
 */

/**
 * Numeric board representation: 1 = black, -1 = white.
 * @typedef {1 | -1} PlayerValue
 */

/**
 * 2-D array representing the Othello board.
 * @typedef {number[][]} Board
 */

/**
 * A single board cell coordinate.
 * @typedef {Object} CellCoord
 * @property {number} row
 * @property {number} col
 */

/**
 * Core mutable game state snapshot.
 * @typedef {Object} GameState
 * @property {Board} board
 * @property {PlayerValue} currentPlayer
 * @property {number} turnNumber
 */

/**
 * Card-related state attached to a running game.
 * @typedef {Object} CardState
 * @property {Object.<PlayerKey, string[]>} hands  - card IDs per player
 * @property {Object.<PlayerKey, number>} charge   - charge counters per player
 * @property {Marker[]} markers                     - active board markers
 */

/**
 * A marker placed on the board by a card effect.
 * @typedef {Object} Marker
 * @property {string} kind
 * @property {number} row
 * @property {number} col
 * @property {Object} [data]
 */

/**
 * Result of a board-config normalisation.
 * @typedef {Object} BoardConfig
 * @property {number} rows
 * @property {number} cols
 * @property {boolean} standard8x8
 * @property {Bounds} baseBounds
 * @property {Bounds} outerBounds
 */

/**
 * Axis-aligned bounding box for board geometry.
 * @typedef {Object} Bounds
 * @property {number} minRow
 * @property {number} maxRow
 * @property {number} minCol
 * @property {number} maxCol
 */

/**
 * A legal move together with the cells it would flip.
 * @typedef {Object} LegalMove
 * @property {number} row
 * @property {number} col
 * @property {CellCoord[]} flips
 */

/**
 * Disc-count summary.
 * @typedef {Object} DiscCounts
 * @property {number} black
 * @property {number} white
 */

/**
 * Advantage evaluation returned by commentary helpers.
 * @typedef {Object} AdvantageEvaluation
 * @property {'opening'|'middle'|'endgame'} phase
 * @property {number} score
 * @property {number} threshold
 * @property {boolean} usesBoardHeuristics
 * @property {number} discDiff
 * @property {number} mobilityDiff
 * @property {number} cornerDiff
 * @property {number} edgeDiff
 * @property {number} xRiskDiff
 * @property {number} cRiskDiff
 */

/**
 * Normalised network action payload.
 * @typedef {Object} NetworkAction
 * @property {string} actionType
 * @property {PlayerKey} actor
 * @property {string} [actionId]
 * @property {number} [turnIndex]
 * @property {Object} params
 */

/**
 * Commentary context built from game state.
 * @typedef {Object} CommentaryContext
 * @property {string} eventType
 * @property {PlayerKey} playerKey
 * @property {number|null} turnNumber
 * @property {'opening'|'middle'|'endgame'} phase
 * @property {'ahead'|'behind'|'even'} advantage
 * @property {DiscCounts} counts
 * @property {number} occupiedCells
 * @property {Board} [board]
 * @property {string} [cardId]
 */

// Export nothing – this file is purely for JSDoc @typedef declarations.

/**
 * Shared type definitions for the Card Reversi game.
 * Re-exports from src/types for backward compatibility.
 */

export * from '../src/types';

// Legacy JSDoc type aliases (kept for backward compatibility during migration)
export type CellCoord = import('../src/types').CellPosition;
export type DiscCounts = import('../src/types').DiscCount;

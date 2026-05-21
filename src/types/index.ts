/**
 * Central type exports for the Card Reversi game
 */

export * from './player';
export * from './board';
export * from './card';
export * from './game';
export * from './events';

// Re-export commonly used types for convenience
export type { PlayerKey, PlayerValue, Player } from './player';
export type { Board, BoardValue, CellPosition, BoardConfig, StonePlacement, Direction, DiscCount } from './board';
export type { CardDef, CardType, CardState, PendingEffect, Marker, CardEffectResult } from './card';
export type { GameState, FullGameState, GamePhase, GameConfig } from './game';
export type { PresentationEvent, PresentationEventType, GameEvent, GameEventType, EventCallback } from './events';
/**
 * Event and presentation type definitions
 */
import { PlayerKey } from './player';
export type PresentationEventType = 'PLACE' | 'FLIP' | 'DESTROY' | 'STATUS_ADDED' | 'STATUS_REMOVED' | 'HAND_ADD' | 'HAND_REMOVE' | 'CHARGE_CHANGE' | 'WORK_REMOVED' | 'BOARD_EXPAND' | 'TELEPORT' | 'SWAP' | 'ANIMATION_START' | 'ANIMATION_END';
export interface PresentationEvent {
    type: PresentationEventType;
    row?: number;
    col?: number;
    player?: PlayerKey;
    ownerBefore?: PlayerKey;
    ownerAfter?: PlayerKey;
    cardId?: string;
    count?: number;
    cause?: string;
    reason?: string;
    meta?: Record<string, unknown>;
}
export type GameEventType = 'TURN_START' | 'TURN_END' | 'CARD_USED' | 'CARD_DISCARDED' | 'STONE_PLACED' | 'STONES_FLIPPED' | 'STONE_DESTROYED' | 'SPECIAL_EFFECT_TRIGGERED' | 'GAME_OVER';
export interface GameEvent {
    type: GameEventType;
    turn: number;
    player: PlayerKey;
    payload?: Record<string, unknown>;
    timestamp: number;
}
export type EventCallback = (event: PresentationEvent | GameEvent) => void;
//# sourceMappingURL=events.d.ts.map
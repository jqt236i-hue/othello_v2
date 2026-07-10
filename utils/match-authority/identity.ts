import type { GameState, PlayerKey } from '../../src/types';
import type { MatchAuthoritySeatKey } from '../match-authority-types';
import * as NetworkContract from '../../shared/network-contract';
import * as PlayerSeatContract from '../../shared/player-seat-contract';

export const OPERATION_ID_MAX_LENGTH = 128;

export function parseSeatKeyOptional(value: unknown): MatchAuthoritySeatKey | null {
    return PlayerSeatContract.parsePlayerSeatKey(value);
}

export function normalizePlayerKey(value: unknown, fallback?: unknown): MatchAuthoritySeatKey {
    return PlayerSeatContract.normalizePlayerSeatKey(value, fallback);
}

export function getCurrentPlayerKey(gameState: Partial<GameState> | null | undefined): PlayerKey {
    if (!gameState) return 'black';
    return normalizePlayerKey(gameState.currentPlayer);
}

export function getOpponentKey(playerKey: PlayerKey | null | undefined): PlayerKey {
    return PlayerSeatContract.normalizePlayerSeatKey(playerKey) === 'white' ? 'black' : 'white';
}

export function normalizeOperationId(value: unknown): string {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return Array.from(normalized).slice(0, OPERATION_ID_MAX_LENGTH).join('');
}

export function normalizeNetworkPlayerName(value: unknown): string {
    return NetworkContract.normalizeNetworkPlayerName(value);
}

export function normalizeNetworkRoomId(value: unknown): string {
    return NetworkContract.normalizeNetworkRoomId(value);
}

export function isValidNetworkRoomId(value: unknown): boolean {
    return NetworkContract.isValidNetworkRoomId(value);
}

export function parseNetworkChatMessage(value: unknown): NetworkContract.NetworkChatValidationResult {
    return NetworkContract.validateNetworkChatMessage(value);
}

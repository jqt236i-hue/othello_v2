import type { CardState, GameState, PlayerKey } from '../../src/types';

export interface CardUsageApi {
    (cardState: CardState, playerKey: PlayerKey, cardId: string, handOwnerKey?: PlayerKey, options?: unknown): boolean;
    (cardState: CardState, gameState: GameState, playerKey: PlayerKey, cardId: string, handOwnerKey?: PlayerKey, options?: unknown): boolean;
}

/** Typed entry contracts over the existing extensible compatibility surface. */
export interface CardLogicApi extends Record<string, unknown> {
    applyCardUsage: CardUsageApi;
    getCardCost(cardId: string): number;
    getCardType(cardId: string): string | undefined;
}

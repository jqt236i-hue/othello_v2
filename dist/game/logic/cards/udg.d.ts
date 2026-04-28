/**
 * @file udg.ts
 * @description Ultimate Destroy God (UDG) effect helpers
 */
import type { CardState, GameState, PlayerKey } from '../../../src/types';
interface UDGDeps {
    selectRandomEmptyBoardShapeDestination?: (cardState: CardState, gameState: GameState, fromRow: number, fromCol: number, randomSource?: any) => {
        row: number;
        col: number;
    } | null;
    randomSource?: any;
    moveCoexistingSpecialMarkers?: (cardState: CardState, anchorEntry: any, fromRow: number, fromCol: number, toRow: number, toCol: number) => void;
    destroyAt?: (cardState: CardState, gameState: GameState, row: number, col: number) => boolean;
    BoardOps?: any;
    decrementRemainingOwnerTurns?: boolean;
}
declare function processUltimateDestroyGodEffects(cardState: CardState, gameState: GameState, playerKey: PlayerKey, deps?: UDGDeps): {
    moved: Array<{
        from: {
            row: number;
            col: number;
        };
        to: {
            row: number;
            col: number;
        };
    }>;
    destroyed: Array<{
        row: number;
        col: number;
    }>;
    anchors: Array<{
        row: number;
        col: number;
        remainingNow: number;
    }>;
    expired: Array<{
        row: number;
        col: number;
        owner: PlayerKey;
        reason: string;
    }>;
};
declare function processUltimateDestroyGodEffectsAtAnchor(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps?: UDGDeps): {
    destroyed: Array<{
        row: number;
        col: number;
    }>;
    expired?: Array<{
        row: number;
        col: number;
        owner: PlayerKey;
        reason: string;
    }>;
};
declare function processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps?: UDGDeps): {
    moved: Array<{
        from: {
            row: number;
            col: number;
        };
        to: {
            row: number;
            col: number;
        };
    }>;
    destroyed: Array<{
        row: number;
        col: number;
    }>;
    anchors: Array<{
        row: number;
        col: number;
        remainingNow: number;
    }>;
    expired: Array<{
        row: number;
        col: number;
        owner: PlayerKey;
        reason: string;
    }>;
};
declare const _default: {
    processUltimateDestroyGodEffects: typeof processUltimateDestroyGodEffects;
    processUltimateDestroyGodEffectsAtAnchor: typeof processUltimateDestroyGodEffectsAtAnchor;
    processUltimateDestroyGodEffectsAtTurnStartAnchor: typeof processUltimateDestroyGodEffectsAtTurnStartAnchor;
};
export = _default;
//# sourceMappingURL=udg.d.ts.map
/**
 * @file teleport.ts
 * @description Teleport helpers (Shared between Browser and Headless)
 */
import { CardState, GameState } from '../../../src/types';
interface TeleportDeps {
    getCellValueForCard?(gameState: GameState, row: number, col: number): number | null;
    setCellValueForCard?(gameState: GameState, row: number, col: number, value: number): boolean;
    getTeleportTargets?(cardState: CardState, gameState: GameState): Array<{
        row: number;
        col: number;
    }>;
    getTeleportDestinations?(cardState: CardState, gameState: GameState): Array<{
        row: number;
        col: number;
    }>;
    moveAt?(cardState: CardState, gameState: GameState, fromRow: number, fromCol: number, toRow: number, toCol: number, source: string, tag: string): any;
    getMarkers?(cardState: CardState): any[];
    clearStoneIdAtForCard?(cardState: CardState, gameState: GameState, row: number, col: number): void;
    removeMarkersAt?(cardState: CardState, row: number, col: number): void;
    addMarker?(cardState: CardState, kind: string, row: number, col: number, playerKey: string, data: any): boolean;
    getCellTeleportTargets?(cardState: CardState, gameState: GameState): Array<{
        row: number;
        col: number;
    }>;
    getCellTeleportDestinations?(cardState: CardState, gameState: GameState): Array<{
        row: number;
        col: number;
        active?: boolean;
    }>;
    ensureExpansionCellForCard?(gameState: GameState, row: number, col: number, value: number): boolean;
    getStoneIdAtForCard?(cardState: CardState, gameState: GameState, row: number, col: number): string | null;
    setStoneIdAtForCard?(cardState: CardState, gameState: GameState, row: number, col: number, id: string | null): boolean;
}
interface TeleportResult {
    applied: boolean;
    reason?: string;
    from?: {
        row: number;
        col: number;
    };
    to?: {
        row: number;
        col: number;
    };
    createdDestination?: boolean;
}
declare function applyTeleportWill(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, prng?: {
    random(): number;
}, deps?: TeleportDeps): TeleportResult;
declare function applyCellTeleportWill(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, prng?: {
    random(): number;
}, deps?: TeleportDeps): TeleportResult;
declare const _default: {
    applyTeleportWill: typeof applyTeleportWill;
    applyCellTeleportWill: typeof applyCellTeleportWill;
};
export = _default;
//# sourceMappingURL=teleport.d.ts.map
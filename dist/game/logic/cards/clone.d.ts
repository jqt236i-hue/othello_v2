import { CardState, GameState } from '../../../src/types';
interface CloneDeps {
    getCloneTargets?(cardState: CardState, gameState: GameState, playerKey: string): Array<{
        row: number;
        col: number;
    }>;
    getSplitTargets?(cardState: CardState, gameState: GameState, playerKey: string): Array<{
        row: number;
        col: number;
    }>;
    getCellValueForCard?(gameState: GameState, row: number, col: number): number | null;
    getSpecialMarkers?(cardState: CardState): any[];
    getBombMarkers?(cardState: CardState): any[];
    collectEmptyNeighborCellsForCard?(cardState: CardState, gameState: GameState, row: number, col: number): Array<{
        row: number;
        col: number;
    }>;
    spawnAt?(cardState: CardState, gameState: GameState, row: number, col: number, playerKey: string, cause: string, reason: string, meta: any): any;
    setCellValueForCard?(gameState: GameState, row: number, col: number, value: number): boolean;
    addMarker?(cardState: CardState, kind: string, row: number, col: number, playerKey: string, data: any): boolean;
}
interface CloneResult {
    applied: boolean;
    reason?: string;
    source?: {
        row: number;
        col: number;
    };
    spawned?: Array<{
        row: number;
        col: number;
    }>;
    durationChanges?: Array<any>;
}
declare function applyCloneWill(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, prng: any, deps?: CloneDeps): CloneResult;
declare function applySplitWill(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, prng: any, deps?: CloneDeps): CloneResult;
declare const _default: {
    applyCloneWill: typeof applyCloneWill;
    applySplitWill: typeof applySplitWill;
};
export = _default;
//# sourceMappingURL=clone.d.ts.map
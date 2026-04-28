/**
 * @file meteor.ts
 * @description Meteor helpers (Shared between Browser and Headless)
 */
import { CardState, GameState } from '../../../src/types';
interface MeteorDeps {
    getMeteorTargets?(cardState: CardState, gameState: GameState, playerKey: string): Array<{
        row: number;
        col: number;
    }>;
    getCellValueForCard?(gameState: GameState, row: number, col: number): number | null;
    destroyAt?(cardState: CardState, gameState: GameState, row: number, col: number, source: string, tag: string, options: any): any;
    isDestroyResolved?(result: any): boolean;
    clearStoneIdAtForCard?(cardState: CardState, gameState: GameState, row: number, col: number): void;
    setCellValueForCard?(gameState: GameState, row: number, col: number, value: number): boolean;
    removeMarkersAt?(cardState: CardState, row: number, col: number): void;
    addMarker?(cardState: CardState, kind: string, row: number, col: number, playerKey: string, data: any): boolean;
    random?: {
        random(): number;
    };
}
interface MeteorResult {
    applied: boolean;
    reason?: string;
    row?: number;
    col?: number;
    destroyed?: boolean;
}
declare function applyMeteorWill(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, deps?: MeteorDeps): MeteorResult;
declare const _default: {
    applyMeteorWill: typeof applyMeteorWill;
};
export = _default;
//# sourceMappingURL=meteor.d.ts.map
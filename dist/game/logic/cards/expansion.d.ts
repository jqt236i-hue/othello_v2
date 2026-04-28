/**
 * @file expansion.ts
 * @description Board Expansion helpers (Shared between Browser and Headless)
 */
import type { GameState } from '../../../src/types';
declare function isMainBoardCellForCard(row: number, col: number, boardOrConfig: any): boolean;
declare function resolveExpansionSideForCard(side: any, row: number, col: number, boardOrConfig: any): string | null;
declare function normalizeExpansionOwnerForCard(owner: any): number;
declare function isExpansionCoordinateForCard(row: number, col: number, boardOrConfig: any): boolean;
declare function getExpansionDescriptorsForCard(gameState: GameState): any[];
declare function syncLegacyExpansionFieldsForCard(expansion: any, boardOrConfig: any): void;
declare function ensureMutableBoardExpansionForCard(gameState: GameState): any;
declare function writeExpansionDescriptorsForCard(gameState: GameState, cells: any[]): any;
declare function getCellValueForCard(gameState: GameState, row: number, col: number): any;
declare function setCellValueForCard(gameState: GameState, row: number, col: number, value: any): boolean;
interface CornerDescriptor {
    row: number;
    col: number;
    cells: Array<{
        row: number;
        col: number;
    }>;
}
declare function getBoardExpansionGodCornerDescriptorsForCard(boardOrConfig: any): CornerDescriptor[];
declare function getBoardExpansionGodPendingSelectionsForCard(pending: any): Array<{
    row: number;
    col: number;
}>;
declare function getBoardExpansionGodAdditionsForCard(row: number, col: number, boardOrConfig: any): Array<{
    row: number;
    col: number;
}> | null;
declare function getBoardExpansionWillCellDescriptorsForCard(boardOrConfig: any): Array<{
    row: number;
    col: number;
    side: string;
}>;
declare function ensureExpansionCellForCard(gameState: GameState, row: number, col: number, owner: any): boolean;
declare function buildInitialBoardBonusMap(prng: any, boardOrConfig: any): Record<string, number>;
declare const _default: {
    isMainBoardCellForCard: typeof isMainBoardCellForCard;
    resolveExpansionSideForCard: typeof resolveExpansionSideForCard;
    normalizeExpansionOwnerForCard: typeof normalizeExpansionOwnerForCard;
    isExpansionCoordinateForCard: typeof isExpansionCoordinateForCard;
    getExpansionDescriptorsForCard: typeof getExpansionDescriptorsForCard;
    syncLegacyExpansionFieldsForCard: typeof syncLegacyExpansionFieldsForCard;
    ensureMutableBoardExpansionForCard: typeof ensureMutableBoardExpansionForCard;
    writeExpansionDescriptorsForCard: typeof writeExpansionDescriptorsForCard;
    getCellValueForCard: typeof getCellValueForCard;
    setCellValueForCard: typeof setCellValueForCard;
    getBoardExpansionGodCornerDescriptorsForCard: typeof getBoardExpansionGodCornerDescriptorsForCard;
    getBoardExpansionGodPendingSelectionsForCard: typeof getBoardExpansionGodPendingSelectionsForCard;
    getBoardExpansionGodAdditionsForCard: typeof getBoardExpansionGodAdditionsForCard;
    getBoardExpansionWillCellDescriptorsForCard: typeof getBoardExpansionWillCellDescriptorsForCard;
    ensureExpansionCellForCard: typeof ensureExpansionCellForCard;
    buildInitialBoardBonusMap: typeof buildInitialBoardBonusMap;
};
export = _default;
//# sourceMappingURL=expansion.d.ts.map
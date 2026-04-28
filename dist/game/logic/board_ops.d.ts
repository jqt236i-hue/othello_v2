import type { PlayerKey } from '../../src/types';
declare function allocateStoneId(cardState: any): string;
declare function isMainBoardCell(row: number, col: number, boardOrState: any): boolean;
declare function getExpansionDescriptors(gameState: any): Array<{
    side: string | null;
    row: number;
    col: number;
    owner: number;
}>;
declare function isExpansionCell(gameState: any, row: number, col: number): boolean;
declare function getCellValue(gameState: any, row: number, col: number): number | null;
declare function setCellValue(gameState: any, row: number, col: number, value: number): boolean;
declare function emitPresentationEvent(cardState: any, ev: any): void;
declare function spawnAt(cardState: any, gameState: any, row: number, col: number, ownerKey: PlayerKey, cause: string | null, reason: string | null, meta?: any): any;
declare function destroyAt(cardState: any, gameState: any, row: number, col: number, cause: string | null, reason: string | null, meta?: any): any;
declare function changeAt(cardState: any, gameState: any, row: number, col: number, ownerAfterKey: PlayerKey, cause: string | null, reason: string | null, meta?: any): any;
declare function revertSpecialStoneAt(cardState: any, gameState: any, row: number, col: number, specialType: string, ownerKey: string | null, cause: string | null, reason: string | null, meta?: any): any;
declare function moveAt(cardState: any, gameState: any, fromRow: number, fromCol: number, toRow: number, toCol: number, cause: string | null, reason: string | null, meta?: any): any;
declare function setActionContext(cardState: any, meta: any): void;
declare function clearActionContext(cardState: any): void;
declare const _default: {
    spawnAt: typeof spawnAt;
    destroyAt: typeof destroyAt;
    changeAt: typeof changeAt;
    revertSpecialStoneAt: typeof revertSpecialStoneAt;
    moveAt: typeof moveAt;
    getExpansionDescriptors: typeof getExpansionDescriptors;
    getCellValue: typeof getCellValue;
    setCellValue: typeof setCellValue;
    isExpansionCell: typeof isExpansionCell;
    isMainBoardCell: typeof isMainBoardCell;
    allocateStoneId: typeof allocateStoneId;
    emitPresentationEvent: typeof emitPresentationEvent;
    setActionContext: typeof setActionContext;
    clearActionContext: typeof clearActionContext;
};
export = _default;
//# sourceMappingURL=board_ops.d.ts.map
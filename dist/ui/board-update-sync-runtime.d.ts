/**
 * @file board-update-sync-runtime.ts
 * @description Runtime context for board update synchronization
 */
interface BoardUpdateContext {
    allowBoardUpdateDuringPlayback?: boolean;
    source?: string;
    reason?: string;
}
declare function armBoardUpdateSyncContext(context: BoardUpdateContext | null | undefined): BoardUpdateContext | null;
declare function peekBoardUpdateSyncContext(): BoardUpdateContext | null;
declare function clearBoardUpdateSyncContext(): boolean;
declare function consumeBoardUpdateSyncContext(): BoardUpdateContext | null;
declare const _default: {
    armBoardUpdateSyncContext: typeof armBoardUpdateSyncContext;
    peekBoardUpdateSyncContext: typeof peekBoardUpdateSyncContext;
    consumeBoardUpdateSyncContext: typeof consumeBoardUpdateSyncContext;
    clearBoardUpdateSyncContext: typeof clearBoardUpdateSyncContext;
};
export = _default;
//# sourceMappingURL=board-update-sync-runtime.d.ts.map
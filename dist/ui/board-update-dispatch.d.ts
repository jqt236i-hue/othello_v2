/**
 * @file board-update-dispatch.ts
 * @description Board update dispatch utilities
 */
interface BoardUpdateOptions {
    emitBoardUpdate?: ((payload: {
        source: string;
        reason: string;
    }) => boolean) | null;
    renderBoard?: (() => void) | null;
    source?: string;
    reason?: string;
}
declare function requestBoardUpdate(options: BoardUpdateOptions): boolean;
declare const _default: {
    requestBoardUpdate: typeof requestBoardUpdate;
};
export = _default;
//# sourceMappingURL=board-update-dispatch.d.ts.map
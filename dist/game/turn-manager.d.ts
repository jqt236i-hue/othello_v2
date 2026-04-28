declare function setUIImpl(obj: any): void;
declare function setTurnManagerTimerService(service: any): void;
declare function handleCellClick(row: any, col: any): void;
declare function isAnimationInProgress(): any;
declare function canLocalUserOperateCurrentTurn(): boolean;
declare function requestUIRender(): void;
declare function resetGame(): void;
/**
 * ターン開始処理
 * Turn Start Logic coordination
 * @param {number} player - BLACK (1) or WHITE (-1)
 */
declare function onTurnStart(player: any): Promise<{
    playbackEvents: any[];
}>;
declare function watchdogPing(nowMs: any): void;
declare function startActionSaveInterval(): void;
declare function stopActionSaveInterval(): void;
declare const _default: {
    resetGame: typeof resetGame;
    onTurnStart: typeof onTurnStart;
    handleCellClick: typeof handleCellClick;
    isAnimationInProgress: typeof isAnimationInProgress;
    setUIImpl: typeof setUIImpl;
    startActionSaveInterval: typeof startActionSaveInterval;
    stopActionSaveInterval: typeof stopActionSaveInterval;
    watchdogPing: typeof watchdogPing;
    canLocalUserOperateCurrentTurn: typeof canLocalUserOperateCurrentTurn;
    setTurnManagerTimerService: typeof setTurnManagerTimerService;
    requestUIRender: typeof requestUIRender;
};
export = _default;
//# sourceMappingURL=turn-manager.d.ts.map
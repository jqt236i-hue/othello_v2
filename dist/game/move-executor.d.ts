declare function setUIImpl(obj: any): void;
declare function setMoveExecutorTimerService(service: any): void;
declare function executeMove(move: any): Promise<void>;
declare function executeMoveViaPipeline(move: any, hadSelection: any, playerKey: any, adapter: any, pipeline: any): Promise<void>;
declare const _default: {
    executeMove: typeof executeMove;
    executeMoveViaPipeline: typeof executeMoveViaPipeline;
    setUIImpl: typeof setUIImpl;
    setMoveExecutorTimerService: typeof setMoveExecutorTimerService;
};
export = _default;
//# sourceMappingURL=move-executor.d.ts.map
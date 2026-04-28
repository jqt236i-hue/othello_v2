declare function emitGameEvent(eventType: string | null, fallbackHandlers?: Function[], data?: any): boolean;
declare function emitBoardUpdate(options?: any): boolean;
declare function emitGameStateChange(): boolean;
declare function emitCardStateChange(options?: any): boolean;
declare function emitGameReset(data?: any): boolean;
declare function emitLogAdded(message: any, kind?: string): void;
declare function emitEffectLog(message: any): void;
declare function emitNormalLog(message: any): void;
declare const ControllerEvents: {
    emitGameEvent: typeof emitGameEvent;
    emitBoardUpdate: typeof emitBoardUpdate;
    emitGameStateChange: typeof emitGameStateChange;
    emitCardStateChange: typeof emitCardStateChange;
    emitGameReset: typeof emitGameReset;
    emitLogAdded: typeof emitLogAdded;
    emitEffectLog: typeof emitEffectLog;
    emitNormalLog: typeof emitNormalLog;
};
export = ControllerEvents;
//# sourceMappingURL=controller-events.d.ts.map
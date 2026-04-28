declare function setNetworkDebugModeAccess(options: any): void;
declare function setDebugModeEnabled(debugEnabled: boolean): boolean;
declare function setupDebugControls(debugModeBtn: any, humanVsHumanBtn: any, visualTestBtn: any): void;
declare const DebugModule: {
    setupDebugControls: typeof setupDebugControls;
    setNetworkDebugModeAccess: typeof setNetworkDebugModeAccess;
    setDebugModeEnabled: typeof setDebugModeEnabled;
};
export = DebugModule;
//# sourceMappingURL=debug.d.ts.map
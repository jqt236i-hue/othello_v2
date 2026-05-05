declare function preloadSpecialStoneVisuals(): {
    attempted: boolean;
    reason: string;
    effectKeys: never[];
    started: never[];
    skipped: never[];
    error?: undefined;
} | {
    attempted: boolean;
    effectKeys: any[];
    started: any;
    skipped: any;
    reason?: undefined;
    error?: undefined;
} | {
    attempted: boolean;
    reason: string;
    error: string;
    effectKeys: any[];
    started: never[];
    skipped: never[];
};
declare function ensureStoneBaseImagesReady(opts?: {}): any;
declare function debugLog(message: any, level: any, meta: any): boolean;
declare function addLog(text: any): void;
declare function updateBgmButtons(): void;
declare function updateStatus(): void;
declare function installGameDI(): any;
declare function registerUIGlobals(obj: any): any;
declare function getRegisteredUIGlobals(): any;
declare function isGameDIInstalled(): boolean;
declare function setLoadedAssetManifest(manifest: any, options?: any): any;
declare function getLoadedAssetManifest(): any;
declare function refreshLoadedAssetManifest(opts?: any): Promise<{
    status: string;
    reason: string;
    code?: undefined;
    manifest?: undefined;
} | {
    status: string;
    reason: string;
    code: number | null;
    manifest?: undefined;
} | {
    status: string;
    manifest: any;
    reason?: undefined;
    code?: undefined;
}>;
declare function preloadAssets(manifest: any, opts: any): any;
declare function applyAssetManifest(manifest: any, policy?: any, opts?: any): Promise<{
    status: string;
    details: any;
}>;
declare function handleGameInit(payload: any, opts?: any): Promise<{
    status: string;
    result?: undefined;
} | {
    status: string;
    result: {
        status: string;
        details: any;
    };
}>;
declare const UIBootstrap: {
    addLog: typeof addLog;
    debugLog: typeof debugLog;
    updateBgmButtons: typeof updateBgmButtons;
    updateStatus: typeof updateStatus;
    installGameDI: typeof installGameDI;
    isGameDIInstalled: typeof isGameDIInstalled;
    registerUIGlobals: typeof registerUIGlobals;
    getRegisteredUIGlobals: typeof getRegisteredUIGlobals;
    preloadAssets: typeof preloadAssets;
    preloadSpecialStoneVisuals: typeof preloadSpecialStoneVisuals;
    applyAssetManifest: typeof applyAssetManifest;
    handleGameInit: typeof handleGameInit;
    ensureStoneBaseImagesReady: typeof ensureStoneBaseImagesReady;
    setLoadedAssetManifest: typeof setLoadedAssetManifest;
    getLoadedAssetManifest: typeof getLoadedAssetManifest;
    refreshLoadedAssetManifest: typeof refreshLoadedAssetManifest;
    ASSET_MANIFEST_UPDATED_EVENT: string;
};
export = UIBootstrap;
//# sourceMappingURL=bootstrap.d.ts.map
declare function getCurrentMode(): string;
declare function isLocalOrNetworkMode(): boolean;
declare function isNetworkModeActive(): boolean;
declare function setMode(mode: any, options: any): Promise<void>;
declare function setupMatchModeControls(options: any): void;
declare const _default: {
    setupMatchModeControls: typeof setupMatchModeControls;
    setMode: typeof setMode;
    getCurrentMode: typeof getCurrentMode;
    isLocalOrNetworkMode: typeof isLocalOrNetworkMode;
    isNetworkModeActive: typeof isNetworkModeActive;
};
export = _default;
//# sourceMappingURL=match-mode.d.ts.map
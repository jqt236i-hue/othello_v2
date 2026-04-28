/**
 * @file init.ts
 * @description UI event handler initialization
 */
declare function setUiInitializedFlag(value: boolean): void;
declare function initializeUI(): Promise<void>;
declare const _default: {
    initializeUI: typeof initializeUI;
    setupSmartSelects: (sb: HTMLSelectElement | null, sw: HTMLSelectElement | null) => void;
    setupSoundControls: (muteBtn: HTMLElement | null, seType: HTMLSelectElement | null, seVol: HTMLInputElement | null) => void;
    setupBgmControls: (playBtn: HTMLElement | null, pauseBtn: HTMLElement | null, trackSel: HTMLSelectElement | null, volSlider: HTMLInputElement | null) => void;
    loadCpuPolicy: () => void;
    setUiInitializedFlag: typeof setUiInitializedFlag;
};
export = _default;
//# sourceMappingURL=init.d.ts.map
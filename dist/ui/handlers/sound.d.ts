declare function previewStonePlacementSound(rootRef: any, seTypeSelect: HTMLSelectElement | null, soundId: string): boolean;
declare function syncStonePreviewOptions(rootRef: any, seTypeSelect: HTMLSelectElement | null): void;
declare function setupSoundControls(muteBtn: HTMLElement | null, seTypeSelect: HTMLSelectElement | null, seVolSlider: HTMLInputElement | null): void;
declare function setupBgmControls(bgmPlayBtn: HTMLElement | null, bgmPauseBtn: HTMLElement | null, bgmTrackSelect: HTMLSelectElement | null, bgmVolSlider: HTMLInputElement | null): void;
declare const SoundHandler: {
    STONE_PLACE_PREVIEW_KEY: string;
    DEFAULT_PLACEMENT_SOUND_ID: string;
    previewStonePlacementSound: typeof previewStonePlacementSound;
    setupSoundControls: typeof setupSoundControls;
    setupBgmControls: typeof setupBgmControls;
    syncStonePreviewOptions: typeof syncStonePreviewOptions;
};
export = SoundHandler;
//# sourceMappingURL=sound.d.ts.map
declare function normalizePlacementSoundId(value: any): string;
declare function getDefaultPlacementSoundDefinition(): any;
declare function readStoredPlacementSoundId(rootRef: any): string;
declare function writeStoredPlacementSoundId(rootRef: any, soundId: string): string;
declare function listSelectablePlacementSounds(options?: any): any[];
declare function isPlacementSoundOwned(soundId: string, options?: any): boolean;
declare function getSelectedPlacementSoundId(options?: any): string;
declare function setSelectedPlacementSoundId(soundId: string, options?: any): string;
declare function getSelectedPlacementSoundDefinition(options?: any): any;
declare function resolveSelectedPlacementSoundFilePath(options?: any): string;
declare const PlacementSoundSelection: {
    PLACEMENT_SOUND_STORAGE_KEY: string;
    DEFAULT_PLACEMENT_SOUND_ID: string;
    DEFAULT_PLACEMENT_SOUND_DEFINITION: Readonly<{
        id: "default";
        label: "既定配置音";
        kind: "placement_sound";
        assetPath: "assets/audio/sound-effect-skin/default.mp3";
        soundPath: "assets/audio/sound-effect-skin/default.mp3";
        previewImagePath: "";
        note: "既定の石置き音";
    }>;
    normalizePlacementSoundId: typeof normalizePlacementSoundId;
    getDefaultPlacementSoundDefinition: typeof getDefaultPlacementSoundDefinition;
    listSelectablePlacementSounds: typeof listSelectablePlacementSounds;
    isPlacementSoundOwned: typeof isPlacementSoundOwned;
    readStoredPlacementSoundId: typeof readStoredPlacementSoundId;
    writeStoredPlacementSoundId: typeof writeStoredPlacementSoundId;
    getSelectedPlacementSoundId: typeof getSelectedPlacementSoundId;
    setSelectedPlacementSoundId: typeof setSelectedPlacementSoundId;
    getSelectedPlacementSoundDefinition: typeof getSelectedPlacementSoundDefinition;
    resolveSelectedPlacementSoundFilePath: typeof resolveSelectedPlacementSoundFilePath;
};
export = PlacementSoundSelection;
//# sourceMappingURL=placement-sound-selection.d.ts.map
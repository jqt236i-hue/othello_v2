/**
 * @file deck-presets.ts
 * @description Deck preset storage management
 */
interface Preset {
    id: string;
    name: string;
    deckCode: string;
    updatedAt: number;
}
interface DeckPresetState {
    version: number;
    activePresetId: string;
    presets: Preset[];
}
declare function createDefaultState(): DeckPresetState;
declare function normalizeState(rawState: unknown): DeckPresetState;
declare function loadState(): DeckPresetState;
declare function saveState(nextState: unknown): DeckPresetState;
declare const _default: {
    STORAGE_KEY: string;
    STATE_VERSION: number;
    PRESET_LIMIT: number;
    PRESET_IDS: readonly string[];
    createDefaultState: typeof createDefaultState;
    normalizeState: typeof normalizeState;
    loadState: typeof loadState;
    saveState: typeof saveState;
};
export = _default;
//# sourceMappingURL=deck-presets.d.ts.map
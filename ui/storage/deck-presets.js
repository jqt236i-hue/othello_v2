(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.DeckPresetStorage = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const STORAGE_KEY = 'deck_builder_presets_v1';
    const STATE_VERSION = 1;
    const PRESET_LIMIT = 3;
    const PRESET_IDS = Object.freeze(['preset_1', 'preset_2', 'preset_3']);

    function normalizePresetName(value) {
        const raw = String(value || '').replace(/\s+/g, ' ').trim();
        return Array.from(raw).slice(0, 24).join('');
    }

    function createEmptyPreset(index) {
        return {
            id: PRESET_IDS[index],
            name: '',
            deckCode: '',
            updatedAt: 0
        };
    }

    function createDefaultState() {
        return {
            version: STATE_VERSION,
            activePresetId: '',
            presets: PRESET_IDS.map((_, index) => createEmptyPreset(index))
        };
    }

    function normalizeState(rawState) {
        const source = (rawState && typeof rawState === 'object') ? rawState : {};
        const presetsSource = Array.isArray(source.presets) ? source.presets : [];
        const presets = PRESET_IDS.map((presetId, index) => {
            const candidate = presetsSource.find((entry) => entry && String(entry.id || '') === presetId) || {};
            return {
                id: presetId,
                name: normalizePresetName(candidate.name),
                deckCode: String(candidate.deckCode || '').trim(),
                updatedAt: Number.isFinite(Number(candidate.updatedAt))
                    ? Math.max(0, Math.trunc(Number(candidate.updatedAt)))
                    : 0
            };
        });

        const activePresetId = PRESET_IDS.includes(String(source.activePresetId || ''))
            ? String(source.activePresetId)
            : '';

        return {
            version: STATE_VERSION,
            activePresetId,
            presets
        };
    }

    function loadState() {
        try {
            if (typeof localStorage === 'undefined') {
                return createDefaultState();
            }
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return createDefaultState();
            }
            return normalizeState(JSON.parse(raw));
        } catch (e) {
            return createDefaultState();
        }
    }

    function saveState(nextState) {
        const normalized = normalizeState(nextState);
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
            }
        } catch (e) { /* ignore */ }
        return normalized;
    }

    return {
        STORAGE_KEY,
        STATE_VERSION,
        PRESET_LIMIT,
        PRESET_IDS,
        createDefaultState,
        normalizeState,
        loadState,
        saveState
    };
}));
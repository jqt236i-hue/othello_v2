(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        const api = factory();
        root.SoundHandlerModule = api;
        root.setupSoundControls = api.setupSoundControls;
        root.setupBgmControls = api.setupBgmControls;
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const STONE_PLACE_PREVIEW_KEY = 'stone_place';
    const DEFAULT_PLACEMENT_SOUND_ID = 'default';

    function resolveSoundEngine() {
        if (typeof SoundEngine !== 'undefined' && SoundEngine) return SoundEngine;
        if (typeof globalThis !== 'undefined' && globalThis.SoundEngine) return globalThis.SoundEngine;
        return null;
    }

    function resolvePlacementSoundSelectionModule(rootRef) {
        const ctx = rootRef || (typeof globalThis !== 'undefined' ? globalThis : null);
        if (ctx && ctx.PlacementSoundSelectionModule) return ctx.PlacementSoundSelectionModule;
        try {
            if (typeof globalThis !== 'undefined' && globalThis.PlacementSoundSelectionModule) {
                return globalThis.PlacementSoundSelectionModule;
            }
        } catch (e) { /* ignore */ }
        if (typeof require === 'function') {
            try {
                return require('../placement-sound-selection.js');
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    function resolveRootRef(seTypeSelect) {
        const docRef = seTypeSelect && seTypeSelect.ownerDocument ? seTypeSelect.ownerDocument : null;
        if (docRef && docRef.defaultView) return docRef.defaultView;
        if (typeof window !== 'undefined') return window;
        if (typeof globalThis !== 'undefined') return globalThis;
        return null;
    }

    function resolveGachaEventsModule(rootRef) {
        if (typeof require === 'function') {
            try {
                return require('../gacha/gacha-events.js');
            } catch (e) { /* ignore */ }
        }
        const ctx = rootRef || (typeof globalThis !== 'undefined' ? globalThis : null);
        if (ctx && ctx.GachaEventsModule) return ctx.GachaEventsModule;
        return null;
    }

    function getSelectablePlacementSounds(rootRef, engine) {
        const selectionModule = resolvePlacementSoundSelectionModule(rootRef);
        if (selectionModule && typeof selectionModule.listSelectablePlacementSounds === 'function') {
            const definitions = selectionModule.listSelectablePlacementSounds({ root: rootRef });
            if (Array.isArray(definitions) && definitions.length) {
                return definitions;
            }
        }
        if (engine && typeof engine.listSelectablePlacementSounds === 'function') {
            const definitions = engine.listSelectablePlacementSounds({ root: rootRef });
            if (Array.isArray(definitions) && definitions.length) {
                return definitions;
            }
        }
        return [{
            id: DEFAULT_PLACEMENT_SOUND_ID,
            label: '既定配置音'
        }];
    }

    function getSelectedPlacementSoundId(rootRef, engine) {
        const selectionModule = resolvePlacementSoundSelectionModule(rootRef);
        if (selectionModule && typeof selectionModule.getSelectedPlacementSoundId === 'function') {
            return selectionModule.getSelectedPlacementSoundId({ root: rootRef });
        }
        if (engine && typeof engine.getSelectedPlacementSoundId === 'function') {
            return engine.getSelectedPlacementSoundId({ root: rootRef });
        }
        return DEFAULT_PLACEMENT_SOUND_ID;
    }

    function setSelectedPlacementSoundId(rootRef, soundId, engine) {
        const selectionModule = resolvePlacementSoundSelectionModule(rootRef);
        if (selectionModule && typeof selectionModule.setSelectedPlacementSoundId === 'function') {
            return selectionModule.setSelectedPlacementSoundId(soundId, { root: rootRef });
        }
        if (engine && typeof engine.setSelectedPlacementSoundId === 'function') {
            return engine.setSelectedPlacementSoundId(soundId, { root: rootRef });
        }
        return DEFAULT_PLACEMENT_SOUND_ID;
    }

    function previewStonePlacementSound(rootRef, seTypeSelect, soundId) {
        const engine = resolveSoundEngine();
        if (!engine) return false;
        if (soundId) {
            setSelectedPlacementSoundId(rootRef, soundId, engine);
        }
        engine.init();
        const played = engine.playEffectByKey(STONE_PLACE_PREVIEW_KEY, { root: rootRef });
        if (seTypeSelect) {
            try {
                seTypeSelect.value = getSelectedPlacementSoundId(rootRef, engine);
            } catch (e) { /* ignore */ }
        }
        return played;
    }

    function syncStonePreviewOptions(rootRef, seTypeSelect) {
        if (!seTypeSelect) return;
        const doc = seTypeSelect.ownerDocument || (typeof document !== 'undefined' ? document : null);
        if (!doc) return;
        const engine = resolveSoundEngine();
        const selectedId = getSelectedPlacementSoundId(rootRef, engine);
        const soundDefinitions = getSelectablePlacementSounds(rootRef, engine);
        seTypeSelect.textContent = '';
        soundDefinitions.forEach((definition) => {
            const el = doc.createElement('option');
            el.value = String(definition && definition.id || DEFAULT_PLACEMENT_SOUND_ID);
            el.textContent = String(definition && definition.label || '配置音');
            seTypeSelect.appendChild(el);
        });
        try {
            seTypeSelect.value = selectedId;
        } catch (e) {
            seTypeSelect.value = DEFAULT_PLACEMENT_SOUND_ID;
        }
    }

    function bindPlacementSoundInventoryRefresh(rootRef, seTypeSelect) {
        if (!rootRef || !seTypeSelect || seTypeSelect.dataset.soundInventoryBound === '1') return;
        const eventsModule = resolveGachaEventsModule(rootRef);
        if (eventsModule && typeof eventsModule.addGachaInventoryUpdatedListener === 'function') {
            eventsModule.addGachaInventoryUpdatedListener(rootRef, () => {
                syncStonePreviewOptions(rootRef, seTypeSelect);
            });
            seTypeSelect.dataset.soundInventoryBound = '1';
            return;
        }
        if (typeof rootRef.addEventListener === 'function') {
            rootRef.addEventListener('gacha:inventory-updated', () => {
                syncStonePreviewOptions(rootRef, seTypeSelect);
            });
            seTypeSelect.dataset.soundInventoryBound = '1';
        }
    }

    /**
     * SE コントロールの設定
     * Setup sound effect controls
     */
    function setupSoundControls(muteBtn, seTypeSelect, seVolSlider) {
        const engine = resolveSoundEngine();
        if (!engine) return;
        const rootRef = resolveRootRef(seTypeSelect);

        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                const muted = engine.toggleMute();
                muteBtn.textContent = muted ? '🔇 OFF' : '🔊 ON';
                muteBtn.style.opacity = muted ? '0.7' : '1';
            });
        }

        if (seTypeSelect) {
            syncStonePreviewOptions(rootRef, seTypeSelect);
            bindPlacementSoundInventoryRefresh(rootRef, seTypeSelect);
            if (seTypeSelect.dataset.soundPreviewBound !== '1') {
                seTypeSelect.addEventListener('change', () => {
                    const selectedId = String(seTypeSelect.value || '').trim();
                    if (!selectedId) return;
                    previewStonePlacementSound(rootRef, seTypeSelect, selectedId);
                });
                seTypeSelect.dataset.soundPreviewBound = '1';
            }
        }

        if (seVolSlider) {
            seVolSlider.value = engine.volume;
            seVolSlider.addEventListener('input', (e) => {
                engine.setVolume(e.target.value);
                engine.init();
            });
        }
    }

    /**
     * BGM コントロールの設定
     * Setup BGM controls
     */
    function setupBgmControls(bgmPlayBtn, bgmPauseBtn, bgmTrackSelect, bgmVolSlider) {
        const engine = resolveSoundEngine();
        if (!engine) return;

        if (bgmTrackSelect) {
            const doc = bgmTrackSelect.ownerDocument || (typeof document !== 'undefined' ? document : null);
            engine.playlist.forEach((track, idx) => {
                const el = doc.createElement('option');
                el.value = idx;
                el.textContent = track.name;
                bgmTrackSelect.appendChild(el);
            });

            try { bgmTrackSelect.value = String(engine.currentTrackIndex); } catch (e) { /* ignore */ }

            bgmTrackSelect.addEventListener('change', (e) => {
                engine.setBgmTrack(e.target.value);
            });
        }

        if (bgmPlayBtn) {
            bgmPlayBtn.addEventListener('click', () => {
                engine.init();
                engine.playBgm();
            });
        }

        if (bgmPauseBtn) {
            bgmPauseBtn.addEventListener('click', () => {
                engine.pauseBgm();
            });
        }

        if (bgmVolSlider) {
            bgmVolSlider.value = engine.bgmVolume;
            bgmVolSlider.addEventListener('input', (e) => {
                engine.setBgmVolume(e.target.value);
            });
        }
    }

    return {
        STONE_PLACE_PREVIEW_KEY,
        DEFAULT_PLACEMENT_SOUND_ID,
        previewStonePlacementSound,
        setupSoundControls,
        setupBgmControls,
        syncStonePreviewOptions
    };
}));

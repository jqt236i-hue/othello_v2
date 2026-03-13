(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        const api = factory();
        root.StoryBattleUiModule = api;
        root.setupStoryBattleUi = api.setupStoryBattleUi;
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const instanceCache = typeof WeakMap === 'function' ? new WeakMap() : null;

    const TEMPLATE = [
        '<div id="storyBattleHud" aria-hidden="true">',
        '  <button id="storyBattleSettingsBtn" class="story-battle-settings-btn" type="button" aria-controls="storyBattleSettingsPanel" aria-expanded="false" aria-label="MENU">',
        '    <span class="story-battle-settings-icon" aria-hidden="true">⚙</span>',
        '    <span class="story-battle-settings-text">MENU</span>',
        '  </button>',
        '  <div id="storyBattleSettingsPanel" class="story-battle-settings-panel" hidden>',
        '    <div class="story-battle-settings-title">story settings</div>',
        '    <div class="story-battle-settings-row">',
        '      <span class="story-battle-settings-label">SE</span>',
        '      <button id="storyBattleSeToggleBtn" class="btn-small story-battle-audio-toggle" type="button">SE ON</button>',
        '      <input id="storyBattleSeVolume" class="story-battle-slider" type="range" min="0" max="1" step="0.05" aria-label="SE音量">',
        '    </div>',
        '    <div class="story-battle-settings-row">',
        '      <span class="story-battle-settings-label">BGM</span>',
        '      <button id="storyBattleBgmToggleBtn" class="btn-small story-battle-audio-toggle" type="button">BGM ON</button>',
        '      <input id="storyBattleBgmVolume" class="story-battle-slider" type="range" min="0" max="0.5" step="0.01" aria-label="BGM音量">',
        '    </div>',
        '  </div>',
        '</div>'
    ].join('');

    function resolveSoundEngine(rootRef) {
        return (rootRef && rootRef.SoundEngine)
            || (typeof SoundEngine !== 'undefined' ? SoundEngine : null)
            || (typeof globalThis !== 'undefined' ? globalThis.SoundEngine : null);
    }

    function ensureHud(documentRef) {
        if (!documentRef || !documentRef.body) return null;
        let rootEl = documentRef.getElementById('storyBattleHud');
        if (rootEl) return rootEl;
        const mount = documentRef.createElement('div');
        mount.innerHTML = TEMPLATE;
        rootEl = mount.firstElementChild;
        documentRef.body.appendChild(rootEl);
        return rootEl;
    }

    function createStoryBattleUi(options) {
        const opts = options && typeof options === 'object' ? options : {};
        const rootRef = opts.root || (typeof window !== 'undefined' ? window : globalThis);
        const documentRef = rootRef && rootRef.document;
        const stateApi = opts.stateApi || (rootRef && rootRef.Story && rootRef.Story.State);
        if (!documentRef || !stateApi || typeof stateApi.getState !== 'function') {
            return null;
        }

        const hudRoot = ensureHud(documentRef);
        if (!hudRoot) return null;
        if (instanceCache && instanceCache.has(hudRoot)) {
            return instanceCache.get(hudRoot);
        }

        const refs = {
            root: hudRoot,
            settingsButton: documentRef.getElementById('storyBattleSettingsBtn'),
            settingsPanel: documentRef.getElementById('storyBattleSettingsPanel'),
            seToggleButton: documentRef.getElementById('storyBattleSeToggleBtn'),
            seVolume: documentRef.getElementById('storyBattleSeVolume'),
            bgmToggleButton: documentRef.getElementById('storyBattleBgmToggleBtn'),
            bgmVolume: documentRef.getElementById('storyBattleBgmVolume')
        };

        const soundRefs = opts.soundRefs && typeof opts.soundRefs === 'object'
            ? opts.soundRefs
            : {};
        const overlayApi = (function resolveOverlayApi() {
            const overlayRoot = documentRef.getElementById('tutorialOverlay');
            const overlayModule =
                (rootRef && rootRef.TutorialOverlayModule)
                || (typeof TutorialOverlayModule !== 'undefined' ? TutorialOverlayModule : null)
                || (typeof globalThis !== 'undefined' ? globalThis.TutorialOverlayModule : null);
            if (!overlayRoot || !overlayModule || typeof overlayModule.createTutorialOverlay !== 'function') {
                return null;
            }
            try {
                return overlayModule.createTutorialOverlay({ overlay: overlayRoot });
            } catch (e) {
                return null;
            }
        }());

        let isPanelOpen = false;
        const pointerDownListener = function (event) {
            onDocumentPointerDown(event);
        };

        function syncPrimarySoundControls(engine) {
            if (!engine) return;
            if (soundRefs.muteBtn) {
                soundRefs.muteBtn.textContent = engine.isMuted ? '🔇 OFF' : '🔊 ON';
                soundRefs.muteBtn.style.opacity = engine.isMuted ? '0.7' : '1';
            }
            if (soundRefs.seVolSlider) {
                soundRefs.seVolSlider.value = String(engine.volume);
            }
            if (soundRefs.bgmVolSlider) {
                soundRefs.bgmVolSlider.value = String(engine.bgmVolume);
            }
            if (soundRefs.bgmTrackSelect) {
                soundRefs.bgmTrackSelect.value = String(engine.currentTrackIndex);
            }
            try {
                if (typeof rootRef.updateBgmButtons === 'function') {
                    rootRef.updateBgmButtons();
                } else if (typeof updateBgmButtons === 'function') {
                    updateBgmButtons();
                }
            } catch (e) { /* ignore */ }
        }

        function syncFromSoundEngine() {
            const engine = resolveSoundEngine(rootRef);
            if (!engine) return;
            if (refs.seToggleButton) {
                refs.seToggleButton.textContent = engine.isMuted ? 'SE OFF' : 'SE ON';
            }
            if (refs.seVolume) {
                refs.seVolume.value = String(engine.volume);
            }
            if (refs.bgmToggleButton) {
                const bgmOn = engine.allowBgmPlay === true && !!engine.bgm && engine.bgm.paused !== true;
                refs.bgmToggleButton.textContent = bgmOn ? 'BGM ON' : 'BGM OFF';
            }
            if (refs.bgmVolume) {
                refs.bgmVolume.value = String(engine.bgmVolume);
            }
            syncPrimarySoundControls(engine);
        }

        function setPanelOpen(open) {
            isPanelOpen = open === true;
            if (refs.settingsPanel) {
                refs.settingsPanel.hidden = !isPanelOpen;
                refs.settingsPanel.classList.toggle('is-open', isPanelOpen);
            }
            if (refs.settingsButton) {
                refs.settingsButton.setAttribute('aria-expanded', isPanelOpen ? 'true' : 'false');
            }
        }

        function applyState(state) {
            const nextState = state && typeof state === 'object'
                ? state
                : stateApi.getState();
            const encounter = nextState && nextState.encounter && typeof nextState.encounter === 'object'
                ? nextState.encounter
                : null;
            const isStoryActive = !!(nextState && nextState.active === true);
            const isEncounterActive = !!(encounter && encounter.active === true);
            hudRoot.classList.toggle('is-visible', isStoryActive);
            hudRoot.setAttribute('aria-hidden', isStoryActive ? 'false' : 'true');
            if (documentRef.body) {
                documentRef.body.classList.toggle('story-mode-active', isStoryActive);
                documentRef.body.classList.toggle('story-battle-active', isEncounterActive);
            }
            if (overlayApi && typeof overlayApi.setExitOnlyMode === 'function') {
                overlayApi.setExitOnlyMode(isEncounterActive);
                if (isEncounterActive && typeof overlayApi.setPassthrough === 'function') {
                    overlayApi.setPassthrough(true);
                }
            }
            if (!isStoryActive) {
                setPanelOpen(false);
            }
            syncFromSoundEngine();
        }

        function onDocumentPointerDown(event) {
            if (!isPanelOpen || !event || !hudRoot) return;
            const target = event.target;
            if (target && hudRoot.contains(target)) return;
            setPanelOpen(false);
        }

        function onSettingsClick() {
            setPanelOpen(!isPanelOpen);
            syncFromSoundEngine();
        }

        function onSeToggleClick() {
            const engine = resolveSoundEngine(rootRef);
            if (!engine || typeof engine.toggleMute !== 'function') return;
            try {
                if (typeof engine.init === 'function') engine.init();
            } catch (e) { /* ignore */ }
            engine.toggleMute();
            syncFromSoundEngine();
        }

        function onSeVolumeInput(event) {
            const engine = resolveSoundEngine(rootRef);
            if (!engine || typeof engine.setVolume !== 'function') return;
            engine.setVolume(event && event.target ? event.target.value : 0);
            try {
                if (typeof engine.init === 'function') engine.init();
            } catch (e) { /* ignore */ }
            syncFromSoundEngine();
        }

        function onBgmToggleClick() {
            const engine = resolveSoundEngine(rootRef);
            if (!engine) return;
            try {
                if (typeof engine.init === 'function') engine.init();
            } catch (e) { /* ignore */ }
            const bgmOn = engine.allowBgmPlay === true && !!engine.bgm && engine.bgm.paused !== true;
            if (bgmOn) {
                if (typeof engine.pauseBgm === 'function') engine.pauseBgm();
            } else if (typeof engine.playBgm === 'function') {
                engine.playBgm();
            }
            syncFromSoundEngine();
        }

        function onBgmVolumeInput(event) {
            const engine = resolveSoundEngine(rootRef);
            if (!engine || typeof engine.setBgmVolume !== 'function') return;
            engine.setBgmVolume(event && event.target ? event.target.value : 0);
            syncFromSoundEngine();
        }

        if (refs.settingsButton && refs.settingsButton.dataset.storyBattleBound !== '1') {
            refs.settingsButton.addEventListener('click', onSettingsClick);
            refs.settingsButton.dataset.storyBattleBound = '1';
        }
        if (refs.seToggleButton && refs.seToggleButton.dataset.storyBattleBound !== '1') {
            refs.seToggleButton.addEventListener('click', onSeToggleClick);
            refs.seToggleButton.dataset.storyBattleBound = '1';
        }
        if (refs.seVolume && refs.seVolume.dataset.storyBattleBound !== '1') {
            refs.seVolume.addEventListener('input', onSeVolumeInput);
            refs.seVolume.dataset.storyBattleBound = '1';
        }
        if (refs.bgmToggleButton && refs.bgmToggleButton.dataset.storyBattleBound !== '1') {
            refs.bgmToggleButton.addEventListener('click', onBgmToggleClick);
            refs.bgmToggleButton.dataset.storyBattleBound = '1';
        }
        if (refs.bgmVolume && refs.bgmVolume.dataset.storyBattleBound !== '1') {
            refs.bgmVolume.addEventListener('input', onBgmVolumeInput);
            refs.bgmVolume.dataset.storyBattleBound = '1';
        }
        if (documentRef) {
            documentRef.addEventListener('pointerdown', pointerDownListener);
        }

        const unsubscribe = typeof stateApi.subscribe === 'function'
            ? stateApi.subscribe(applyState)
            : function noop() {};

        applyState(stateApi.getState());

        const controller = {
            refs,
            sync: function () {
                applyState(stateApi.getState());
            },
            destroy: function () {
                setPanelOpen(false);
                unsubscribe();
                if (documentRef) {
                    documentRef.removeEventListener('pointerdown', pointerDownListener);
                }
                if (documentRef.body) {
                    documentRef.body.classList.remove('story-mode-active');
                    documentRef.body.classList.remove('story-battle-active');
                }
                if (overlayApi && typeof overlayApi.setExitOnlyMode === 'function') {
                    overlayApi.setExitOnlyMode(false);
                }
                hudRoot.remove();
            }
        };

        if (instanceCache) {
            instanceCache.set(hudRoot, controller);
        }

        return controller;
    }

    function setupStoryBattleUi(options) {
        return createStoryBattleUi(options);
    }

    return {
        createStoryBattleUi,
        setupStoryBattleUi
    };
}));

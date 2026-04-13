(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.GachaRevealAudioModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const GACHA_PULL_AUDIO_PATH = 'assets/audio/other/gacha.mp3';
    function resolveSoundEngineAccessModule(rootRef) {
        if (typeof require === 'function') {
            try {
                return require('../sound-engine-access.js');
            } catch (e) { /* ignore */ }
        }
        try {
            if (rootRef && rootRef.SoundEngineAccessModule) return rootRef.SoundEngineAccessModule;
        } catch (e) { /* ignore */ }
        try {
            if (typeof SoundEngineAccessModule !== 'undefined' && SoundEngineAccessModule) return SoundEngineAccessModule;
        } catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.SoundEngineAccessModule) return globalThis.SoundEngineAccessModule;
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveSoundEngine(rootRef) {
        const accessModule = resolveSoundEngineAccessModule(rootRef);
        if (accessModule && typeof accessModule.resolveSoundEngine === 'function') {
            return accessModule.resolveSoundEngine(rootRef);
        }
        if (rootRef && rootRef.SoundEngine) return rootRef.SoundEngine;
        try {
            if (typeof SoundEngine !== 'undefined' && SoundEngine) return SoundEngine;
        } catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.SoundEngine) return globalThis.SoundEngine;
        } catch (e) { /* ignore */ }
        return null;
    }

    function isBgmPlaying(engine, rootRef) {
        const accessModule = resolveSoundEngineAccessModule(rootRef);
        if (accessModule && typeof accessModule.isBgmPlaying === 'function') {
            return accessModule.isBgmPlaying(engine);
        }
        return !!(engine && engine.allowBgmPlay === true && engine.bgm && engine.bgm.paused !== true);
    }

    function createPullAudioInstance(rootRef, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (typeof opts.createAudio === 'function') {
            try {
                return opts.createAudio(GACHA_PULL_AUDIO_PATH) || null;
            } catch (e) {
                return null;
            }
        }

        const AudioCtor = (rootRef && rootRef.Audio) || (typeof Audio !== 'undefined' ? Audio : null);
        if (typeof AudioCtor !== 'function') return null;
        try {
            return new AudioCtor(GACHA_PULL_AUDIO_PATH);
        } catch (e) {
            return null;
        }
    }

    function createGachaRevealAudioSession(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const rootRef = opts.root || (typeof window !== 'undefined' ? window : null);
        let activePullAudio = null;
        let activePullAudioCleanup = null;
        let shouldResumeBgmAfterAudio = false;

        function clearPullAudioBindings(audioRef) {
            if (!audioRef || typeof activePullAudioCleanup !== 'function') {
                activePullAudioCleanup = null;
                return;
            }
            try { activePullAudioCleanup(audioRef); } catch (e) { /* ignore */ }
            activePullAudioCleanup = null;
        }

        function resumeBgmIfNeeded() {
            const engine = resolveSoundEngine(rootRef);
            if (!shouldResumeBgmAfterAudio || !engine || typeof engine.playBgm !== 'function') {
                shouldResumeBgmAfterAudio = false;
                return false;
            }
            shouldResumeBgmAfterAudio = false;
            try {
                engine.playBgm();
                return true;
            } catch (e) {
                return false;
            }
        }

        function releaseActivePullAudio(audioRef) {
            const target = audioRef || activePullAudio;
            clearPullAudioBindings(target);
            if (activePullAudio === target) {
                activePullAudio = null;
            }
        }

        function pauseBgmForPullAudio() {
            const engine = resolveSoundEngine(rootRef);
            if (!engine || typeof engine.pauseBgm !== 'function' || typeof engine.playBgm !== 'function') {
                shouldResumeBgmAfterAudio = false;
                return false;
            }
            if (shouldResumeBgmAfterAudio) {
                return true;
            }
            const bgmIsPlaying = isBgmPlaying(engine, rootRef);
            if (!bgmIsPlaying) {
                shouldResumeBgmAfterAudio = false;
                return false;
            }
            shouldResumeBgmAfterAudio = true;
            try {
                engine.pauseBgm();
                return true;
            } catch (e) {
                shouldResumeBgmAfterAudio = false;
                return false;
            }
        }

        function bindPullAudioLifecycle(audio) {
            if (!audio) return;
            const handleAudioFinished = function () {
                releaseActivePullAudio(audio);
            };
            if (typeof audio.addEventListener === 'function') {
                try { audio.addEventListener('ended', handleAudioFinished); } catch (e) { /* ignore */ }
                try { audio.addEventListener('error', handleAudioFinished); } catch (e) { /* ignore */ }
                activePullAudioCleanup = function (audioRef) {
                    if (!audioRef || typeof audioRef.removeEventListener !== 'function') return;
                    try { audioRef.removeEventListener('ended', handleAudioFinished); } catch (e) { /* ignore */ }
                    try { audioRef.removeEventListener('error', handleAudioFinished); } catch (e) { /* ignore */ }
                };
                return;
            }
            activePullAudioCleanup = null;
        }

        function play() {
            const engine = resolveSoundEngine(rootRef);
            const audio = createPullAudioInstance(rootRef, { createAudio: opts.createAudio });
            if (!audio || typeof audio.play !== 'function') return false;

            if (activePullAudio && activePullAudio !== audio) {
                try {
                    if (typeof activePullAudio.pause === 'function') activePullAudio.pause();
                } catch (e) { /* ignore */ }
                releaseActivePullAudio(activePullAudio);
            }

            pauseBgmForPullAudio();
            activePullAudio = audio;
            bindPullAudioLifecycle(audio);

            if (engine && Number.isFinite(Number(engine.volume))) {
                try { audio.volume = Math.max(0, Math.min(1, Number(engine.volume))); } catch (e) { /* ignore */ }
            }

            try {
                const playPromise = audio.play();
                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(function () {
                        releaseActivePullAudio(audio);
                        resumeBgmIfNeeded();
                    });
                }
                return true;
            } catch (e) {
                releaseActivePullAudio(audio);
                resumeBgmIfNeeded();
                return false;
            }
        }

        function destroy() {
            const audioRef = activePullAudio;
            if (audioRef && typeof audioRef.pause === 'function') {
                try { audioRef.pause(); } catch (e) { /* ignore */ }
            }
            releaseActivePullAudio(audioRef);
            resumeBgmIfNeeded();
        }

        return {
            play,
            destroy,
            hasActiveAudio: function () {
                return !!activePullAudio;
            }
        };
    }

    return {
        GACHA_PULL_AUDIO_PATH,
        createPullAudioInstance,
        createGachaRevealAudioSession
    };
}));

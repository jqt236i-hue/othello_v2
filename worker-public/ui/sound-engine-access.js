(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.SoundEngineAccessModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function resolveSoundEngine(rootRef) {
        return (rootRef && rootRef.SoundEngine)
            || (typeof SoundEngine !== 'undefined' ? SoundEngine : null)
            || (typeof globalThis !== 'undefined' ? globalThis.SoundEngine : null)
            || null;
    }

    function isBgmPlaying(engine) {
        return !!(engine && engine.allowBgmPlay === true && engine.bgm && engine.bgm.paused !== true);
    }

    return {
        resolveSoundEngine,
        isBgmPlaying
    };
}));

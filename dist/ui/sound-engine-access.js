"use strict";
/**
 * @file sound-engine-access.ts
 * @description Safe accessor for SoundEngine
 */
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function resolveSoundEngine(rootRef) {
    return (rootRef && rootRef.SoundEngine)
        || (typeof globalThis !== 'undefined' ? globalThis.SoundEngine : null)
        || null;
}
function isBgmPlaying(engine) {
    return !!(engine && engine.allowBgmPlay === true && engine.bgm && engine.bgm.paused !== true);
}
module.exports = {
    resolveSoundEngine,
    isBgmPlaying
};
//# sourceMappingURL=sound-engine-access.js.map
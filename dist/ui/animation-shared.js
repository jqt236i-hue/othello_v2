"use strict";
/**
 * ui/animation-shared.ts
 * 共通アニメーションユーティリティ（UI専用）
 * 目的: _isNoAnim / Timer / Flip トリガー等の重複を集約する
 */
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function isNoAnim() {
    try {
        if (typeof window !== 'undefined' && window.DISABLE_ANIMATIONS === true)
            return true;
        if (typeof location !== 'undefined' && /[?&]noanim=1/.test(location.search))
            return true;
        if (typeof process !== 'undefined' && (process.env.NOANIM === '1' || process.env.NOANIM === 'true' || process.env.DISABLE_ANIMATIONS === '1'))
            return true;
    }
    catch (e) { /* ignore */ }
    return false;
}
function getTimer() {
    if (typeof TimerRegistry !== 'undefined') {
        return TimerRegistry;
    }
    return {
        setTimeout: (fn, ms) => window.setTimeout(fn, ms),
        clearTimeout: (id) => window.clearTimeout(id),
        clearAll: () => { },
        pendingCount: () => 0,
        newScope: () => null,
        clearScope: () => { }
    };
}
function triggerFlip(disc) {
    if (!disc)
        return;
    try {
        disc.classList.remove('flip');
        disc.offsetHeight;
        disc.classList.add('flip');
    }
    catch (e) { /* ignore */ }
}
function removeFlip(disc) {
    if (!disc)
        return;
    try {
        disc.classList.remove('flip');
    }
    catch (e) { /* ignore */ }
}
module.exports = {
    isNoAnim,
    getTimer,
    triggerFlip,
    removeFlip
};
//# sourceMappingURL=animation-shared.js.map
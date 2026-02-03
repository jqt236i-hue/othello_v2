/**
 * ui/animation-shared.js
 * 共通アニメーションユーティリティ（UI専用）
 * 目的: _isNoAnim / Timer / Flip トリガー等の重複を集約する
 */
(function(root, factory){
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.AnimationShared = factory();
}(typeof self !== 'undefined' ? self : this, function(){
    function isNoAnim() {
        try {
            if (typeof window !== 'undefined' && window.DISABLE_ANIMATIONS === true) return true;
            if (typeof location !== 'undefined' && /[?&]noanim=1/.test(location.search)) return true;
            if (typeof process !== 'undefined' && (process.env.NOANIM === '1' || process.env.NOANIM === 'true' || process.env.DISABLE_ANIMATIONS === '1')) return true;
        } catch (e) { }
        return false;
    }

    function getTimer() {
        if (typeof TimerRegistry !== 'undefined') return TimerRegistry;
        return {
            setTimeout: (fn, ms) => setTimeout(fn, ms),
            clearTimeout: (id) => clearTimeout(id),
            clearAll: () => {},
            pendingCount: () => 0,
            newScope: () => null,
            clearScope: () => {}
        };
    }

    function triggerFlip(disc) {
        if (!disc) return;
        try { disc.classList.remove('flip'); disc.offsetHeight; disc.classList.add('flip'); } catch (e) { /* ignore */ }
    }

    function removeFlip(disc) {
        if (!disc) return;
        try { disc.classList.remove('flip'); } catch (e) { /* ignore */ }
    }

    // Export
    return {
        isNoAnim,
        getTimer,
        triggerFlip,
        removeFlip
    };
}));
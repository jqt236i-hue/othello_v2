// Lightweight resolver to safely provide AnimationHelpers and related helpers
(function () {
    function getAnimationShared() {
        if (typeof require === 'function') {
            try { return require('./animation-helpers'); } catch (e) { /* ignore */ }
        }
        try { if (typeof globalThis !== 'undefined' && globalThis.AnimationHelpers) return globalThis.AnimationHelpers; } catch (e) { }
        try { if (typeof globalThis !== 'undefined' && globalThis.AnimationShared) return globalThis.AnimationShared; } catch (e) { }
        return null;
    }

    function isNoAnim() {
        const s = getAnimationShared();
        return (s && typeof s.isNoAnim === 'function') ? s.isNoAnim : function () { return false; };
    }

    function getTimer() {
        const s = getAnimationShared();
        try { if (s && typeof s.getTimer === 'function') return s.getTimer(); } catch (e) {}
        // Minimal timer shim compatible with TimerRegistry-style API
        return {
            setTimeout: (fn, ms) => setTimeout(fn, ms),
            clearTimeout: (id) => clearTimeout(id),
            clearAll: () => {},
            pendingCount: () => 0,
            newScope: () => null,
            clearScope: () => {}
        };
    }

    if (typeof module !== 'undefined' && module.exports) module.exports = { getAnimationShared, isNoAnim, getTimer };
    try { if (typeof globalThis !== 'undefined') globalThis.AnimationResolver = { getAnimationShared, isNoAnim, getTimer }; } catch (e) { }
})();
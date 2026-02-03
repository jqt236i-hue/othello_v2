(function(root, factory){
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.AnimationHelpers = factory();
}(typeof self !== 'undefined' ? self : this, function(){
    // Wrapper around ui/animation-shared that provides normalized, safe fallbacks
    var Shared = null;
    try { Shared = (typeof require === 'function') ? require('./animation-shared') : (typeof window !== 'undefined' ? window.AnimationShared : null); } catch (e) { Shared = (typeof window !== 'undefined' ? window.AnimationShared : null); }

    function isNoAnim() {
        try {
            if (Shared && typeof Shared.isNoAnim === 'function') return Shared.isNoAnim();
            // Fallbacks matching previous behavior
            if (typeof window !== 'undefined' && window.DISABLE_ANIMATIONS === true) return true;
            if (typeof location !== 'undefined' && /[?&]noanim=1/.test(location.search)) return true;
            if (typeof process !== 'undefined' && (process.env.NOANIM === '1' || process.env.NOANIM === 'true' || process.env.DISABLE_ANIMATIONS === '1')) return true;
        } catch (e) { }
        return false;
    }

    function getTimer() {
        try { if (Shared && typeof Shared.getTimer === 'function') return Shared.getTimer(); } catch (e) {}
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
        try { if (Shared && typeof Shared.triggerFlip === 'function') return Shared.triggerFlip(disc); } catch (e) {}
        if (!disc) return;
        try { disc.classList.remove('flip'); disc.offsetHeight; disc.classList.add('flip'); } catch (e) { }
    }

    function removeFlip(disc) {
        try { if (Shared && typeof Shared.removeFlip === 'function') return Shared.removeFlip(disc); } catch (e) {}
        if (!disc) return;
        try { disc.classList.remove('flip'); } catch (e) { }
    }

    return { isNoAnim, getTimer, triggerFlip, removeFlip };
}));
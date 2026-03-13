(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root);
    } else {
        root.PlaybackStateManager = factory(root);
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
    'use strict';

    function getRoot() {
        const base = root || (typeof globalThis !== 'undefined' ? globalThis : {});
        if (base && base.window && typeof base.window === 'object') return base.window;
        try {
            if (typeof window !== 'undefined' && window) return window;
        } catch (e) { /* ignore */ }
        return base;
    }

    function getPlaybackActive() {
        return getRoot().VisualPlaybackActive === true;
    }

    function setPlaybackActive(active) {
        const target = getRoot();
        const next = active === true;
        target.VisualPlaybackActive = next;
        if (next) {
            if (!Number.isFinite(Number(target.__playbackActiveSince))) {
                target.__playbackActiveSince = Date.now();
            }
        } else {
            target.__playbackActiveSince = null;
        }
        return next;
    }

    function getCardAnimating() {
        const target = getRoot();
        return target.isCardAnimating === true || getPlaybackActive();
    }

    function setCardAnimating(active) {
        const target = getRoot();
        target.isCardAnimating = active === true;
        return target.isCardAnimating === true;
    }

    function setInteractionLock(locked) {
        setCardAnimating(locked);
        setPlaybackActive(locked);
        return locked === true;
    }

    function getPlaybackStartedAt() {
        const value = Number(getRoot().__playbackActiveSince);
        return Number.isFinite(value) ? value : null;
    }

    function getSuppressNextDiffFlip() {
        return getRoot().__suppressNextDiffFlip === true;
    }

    function setSuppressNextDiffFlip(active) {
        const target = getRoot();
        target.__suppressNextDiffFlip = active === true;
        return target.__suppressNextDiffFlip === true;
    }

    function consumeSuppressNextDiffFlip() {
        const active = getSuppressNextDiffFlip();
        if (active) setSuppressNextDiffFlip(false);
        return active;
    }

    function clearPlaybackLock() {
        setCardAnimating(false);
        setPlaybackActive(false);
        return true;
    }

    return {
        getPlaybackActive,
        setPlaybackActive,
        getCardAnimating,
        setCardAnimating,
        setInteractionLock,
        getPlaybackStartedAt,
        getSuppressNextDiffFlip,
        setSuppressNextDiffFlip,
        consumeSuppressNextDiffFlip,
        clearPlaybackLock
    };
}));
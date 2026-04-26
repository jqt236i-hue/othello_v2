(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CardRandomSource = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
    'use strict';

    function normalizeLabel(label) {
        const text = String(label || 'CardLogic').trim();
        return text || 'CardLogic';
    }

    function toRandomSource(randomLike) {
        if (randomLike && typeof randomLike.random === 'function') return randomLike;
        if (typeof randomLike === 'function') {
            return { random: randomLike };
        }
        return null;
    }

    function resolveRandomSource(randomLike, fallbackLike, label) {
        const resolved = toRandomSource(randomLike) || toRandomSource(fallbackLike);
        if (resolved) return resolved;
        throw new Error(normalizeLabel(label) + ' requires an injected deterministic PRNG.');
    }

    function readRandomUnit(randomLike, fallbackLike, label) {
        const randomSource = resolveRandomSource(randomLike, fallbackLike, label);
        const raw = Number(randomSource.random());
        if (!Number.isFinite(raw)) {
            throw new Error(normalizeLabel(label) + ' received a PRNG that returned a non-finite value.');
        }
        return Math.max(0, Math.min(0.999999, raw));
    }

    function resolveRandomIndex(length, randomLike, fallbackLike, label) {
        if (!Number.isInteger(length) || length <= 0) return 0;
        return Math.floor(readRandomUnit(randomLike, fallbackLike, label) * length);
    }

    return {
        resolveRandomSource,
        readRandomUnit,
        resolveRandomIndex
    };
}));
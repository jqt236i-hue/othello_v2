(function (root) {
    'use strict';

    // Minimal Owner Helpers stub for browser and headless
    function getOwnerDisplayName(owner) {
        if (owner === 1 || owner === '1' || owner === 'black') return 'black';
        if (owner === -1 || owner === '-1' || owner === 'white') return 'white';
        return null;
    }

    function parseSeatKeyOptional(value) {
        if (value === 1 || value === '1') return 'black';
        if (value === -1 || value === '-1') return 'white';

        const normalized = (value === null || typeof value === 'undefined')
            ? ''
            : String(value).trim().toLowerCase();

        if (normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
        if (normalized === 'white' || normalized === '-1') return 'white';
        return null;
    }

    function normalizePlayerKey(value, fallbackKey) {
        const parsed = parseSeatKeyOptional(value);
        if (parsed) return parsed;
        const fallback = parseSeatKeyOptional(fallbackKey);
        return fallback || 'black';
    }

    function normalizePlayerKeyOptional(value) {
        return parseSeatKeyOptional(value);
    }

    function resolveLocalPlayerKey(rootRef) {
        const ctx = rootRef || root || (typeof globalThis !== 'undefined' ? globalThis : {});
        try {
            if (ctx && ctx.NetworkMatchClient && typeof ctx.NetworkMatchClient.getSeatKey === 'function') {
                const seat = parseSeatKeyOptional(ctx.NetworkMatchClient.getSeatKey());
                if (seat) return seat;
            }
        } catch (e) { /* ignore */ }

        const candidates = [
            ctx ? ctx.LOCAL_PLAYER_KEY : null,
            ctx ? ctx.__LOCAL_PLAYER_KEY : null,
            ctx ? ctx.BOARD_VIEWER_KEY : null
        ];
        for (const candidate of candidates) {
            const parsed = parseSeatKeyOptional(candidate);
            if (parsed) return parsed;
        }
        return 'black';
    }

    function getCurrentMatchMode(rootRef) {
        const ctx = rootRef || root || (typeof globalThis !== 'undefined' ? globalThis : {});
        try {
            if (ctx && typeof ctx.getCurrentMatchMode === 'function') {
                return String(ctx.getCurrentMatchMode() || 'cpu');
            }
        } catch (e) { /* ignore */ }
        try {
            if (ctx && ctx.MATCH_MODE) return String(ctx.MATCH_MODE);
        } catch (e) { /* ignore */ }
        return 'cpu';
    }

    function isNetworkMode(rootRef) {
        return getCurrentMatchMode(rootRef) === 'network';
    }

    function isValidOwner(owner) {
        return owner === 1 || owner === -1 || owner === '1' || owner === '-1' || owner === 'black' || owner === 'white';
    }

    var OwnerHelpers = {
        getOwnerDisplayName: getOwnerDisplayName,
        isValidOwner: isValidOwner,
        parseSeatKeyOptional: parseSeatKeyOptional,
        normalizePlayerKey: normalizePlayerKey,
        normalizePlayerKeyOptional: normalizePlayerKeyOptional,
        resolveLocalPlayerKey: resolveLocalPlayerKey,
        getCurrentMatchMode: getCurrentMatchMode,
        isNetworkMode: isNetworkMode
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = OwnerHelpers;
    }
    try { if (typeof window !== 'undefined') window.OwnerHelpers = OwnerHelpers; } catch (e) {}
})(typeof self !== 'undefined' ? self : this);

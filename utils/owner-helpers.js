(function (root) {
    'use strict';

    const HIDDEN_HAND_TOKEN_RE = /^__hidden_hand__:(black|white):(\d+)$/;

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

    function isHiddenHandToken(value) {
        return typeof value === 'string' && HIDDEN_HAND_TOKEN_RE.test(value);
    }

    function resolveProjectedCardState(ctx) {
        if (ctx && ctx.cardState && typeof ctx.cardState === 'object') return ctx.cardState;
        try {
            if (typeof globalThis !== 'undefined' && globalThis.cardState && typeof globalThis.cardState === 'object') {
                return globalThis.cardState;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function inferSeatFromProjectedHands(cardState) {
        const hands = (cardState && cardState.hands && typeof cardState.hands === 'object') ? cardState.hands : null;
        if (!hands) return null;

        const summarizeHand = (ownerKey) => {
            const hand = Array.isArray(hands[ownerKey]) ? hands[ownerKey] : [];
            let hiddenCount = 0;
            for (const cardId of hand) {
                if (isHiddenHandToken(cardId)) hiddenCount += 1;
            }
            return {
                hiddenCount,
                totalCount: hand.length
            };
        };

        const black = summarizeHand('black');
        const white = summarizeHand('white');

        if (black.hiddenCount > 0 && white.hiddenCount === 0) return 'white';
        if (white.hiddenCount > 0 && black.hiddenCount === 0) return 'black';
        return null;
    }

    function inferSeatFromPendingEffects(cardState) {
        const pendingByPlayer = (cardState && cardState.pendingEffectByPlayer && typeof cardState.pendingEffectByPlayer === 'object')
            ? cardState.pendingEffectByPlayer
            : null;
        if (!pendingByPlayer) return null;

        for (const ownerKey of ['black', 'white']) {
            const pending = pendingByPlayer[ownerKey];
            if (!pending || pending.type !== 'CONDEMN_WILL' || !Array.isArray(pending.offers)) continue;
            const hasVisibleOffer = pending.offers.some((offer) => {
                const cardId = offer && typeof offer === 'object' ? offer.cardId : offer;
                return typeof cardId === 'string' && !isHiddenHandToken(cardId);
            });
            if (hasVisibleOffer) return ownerKey;
        }

        return null;
    }

    function inferSeatFromProjectedState(ctx) {
        const cardState = resolveProjectedCardState(ctx);
        if (!cardState) return null;

        const inferredFromHands = inferSeatFromProjectedHands(cardState);
        if (inferredFromHands) return inferredFromHands;

        return inferSeatFromPendingEffects(cardState);
    }

    function hasAuthoritativeNetworkSeat(ctx, explicitSeat) {
        if (!ctx || !explicitSeat) return false;
        try {
            if (ctx.NetworkMatchClient && typeof ctx.NetworkMatchClient.isActive === 'function' && ctx.NetworkMatchClient.isActive() === true) {
                const activeSeat = parseSeatKeyOptional(
                    typeof ctx.NetworkMatchClient.getSeatKey === 'function'
                        ? ctx.NetworkMatchClient.getSeatKey()
                        : null
                );
                return !!(activeSeat && activeSeat === explicitSeat);
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    function resolveLocalPlayerKey(rootRef) {
        const ctx = rootRef || root || (typeof globalThis !== 'undefined' ? globalThis : {});
        let explicitSeat = null;
        try {
            if (ctx && ctx.NetworkMatchClient && typeof ctx.NetworkMatchClient.getSeatKey === 'function') {
                const seat = parseSeatKeyOptional(ctx.NetworkMatchClient.getSeatKey());
                if (seat) explicitSeat = seat;
            }
        } catch (e) { /* ignore */ }

        const candidates = [
            ctx ? ctx.LOCAL_PLAYER_KEY : null,
            ctx ? ctx.__LOCAL_PLAYER_KEY : null,
            ctx ? ctx.BOARD_VIEWER_KEY : null
        ];
        for (const candidate of candidates) {
            const parsed = parseSeatKeyOptional(candidate);
            if (parsed) {
                explicitSeat = explicitSeat || parsed;
                break;
            }
        }

        if (hasAuthoritativeNetworkSeat(ctx, explicitSeat)) {
            return explicitSeat;
        }

        const inferredSeat = inferSeatFromProjectedState(ctx);
        if (inferredSeat && explicitSeat && inferredSeat !== explicitSeat) {
            return inferredSeat;
        }
        return explicitSeat || inferredSeat || 'black';
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
        isHiddenHandToken: isHiddenHandToken,
        resolveLocalPlayerKey: resolveLocalPlayerKey,
        getCurrentMatchMode: getCurrentMatchMode,
        isNetworkMode: isNetworkMode
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = OwnerHelpers;
    }
    try { if (typeof window !== 'undefined') window.OwnerHelpers = OwnerHelpers; } catch (e) {}
})(typeof self !== 'undefined' ? self : this);

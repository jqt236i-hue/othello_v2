// @ts-nocheck
(function (root) {
    'use strict';

    const HIDDEN_HAND_TOKEN_RE = /^__hidden_hand__:(black|white):(\d+)$/;

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

    function getOpposingPlayerKey(playerKey) {
        const ownerKey = normalizePlayerKeyOptional(playerKey);
        if (!ownerKey) return null;
        return ownerKey === 'black' ? 'white' : 'black';
    }

    function resolveVisibleOwnerLayout(layout) {
        const config = (layout && typeof layout === 'object') ? layout : {};
        const fallbackBottomOwnerKey = normalizePlayerKey(
            config.defaultBottomOwnerKey,
            'black'
        );
        const fallbackTopOwnerKey = normalizePlayerKey(
            config.defaultTopOwnerKey,
            getOpposingPlayerKey(fallbackBottomOwnerKey) || 'white'
        );
        const rawBottomOwnerKey = Object.prototype.hasOwnProperty.call(config, 'bottomOwnerKey')
            ? config.bottomOwnerKey
            : config.bottomSlotOwnerKey;
        const rawTopOwnerKey = Object.prototype.hasOwnProperty.call(config, 'topOwnerKey')
            ? config.topOwnerKey
            : config.topSlotOwnerKey;
        const bottomOwnerKey = normalizePlayerKey(rawBottomOwnerKey, fallbackBottomOwnerKey);
        let topOwnerKey = normalizePlayerKey(rawTopOwnerKey, fallbackTopOwnerKey);
        if (topOwnerKey === bottomOwnerKey) {
            topOwnerKey = getOpposingPlayerKey(bottomOwnerKey) || fallbackTopOwnerKey;
        }
        return {
            bottomOwnerKey,
            topOwnerKey
        };
    }

    function getElementOwnerKey(element) {
        if (!element || typeof element !== 'object') return null;
        const datasetOwnerKey = element.dataset && Object.prototype.hasOwnProperty.call(element.dataset, 'ownerKey')
            ? element.dataset.ownerKey
            : null;
        if (datasetOwnerKey !== null && typeof datasetOwnerKey !== 'undefined' && datasetOwnerKey !== '') {
            return normalizePlayerKeyOptional(datasetOwnerKey);
        }
        try {
            if (typeof element.getAttribute === 'function') {
                return normalizePlayerKeyOptional(element.getAttribute('data-owner-key'));
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function filterOwnerMatchedElements(elements, ownerKey) {
        const targetOwnerKey = normalizePlayerKey(ownerKey, 'black');
        const candidates = Array.isArray(elements) ? elements : [];
        return candidates.filter((element) => getElementOwnerKey(element) === targetOwnerKey);
    }

    function resolveOwnerMatchedElement(elements, ownerKey, fallbackElement) {
        const matched = filterOwnerMatchedElements(elements, ownerKey);
        if (matched.length > 0) return matched[0];
        return fallbackElement || null;
    }

    function resolveVisibleOwnerLayoutFromElements(bottomElement, topElement, layout) {
        const config = (layout && typeof layout === 'object') ? layout : {};
        return resolveVisibleOwnerLayout({
            bottomOwnerKey: getElementOwnerKey(bottomElement),
            topOwnerKey: getElementOwnerKey(topElement),
            defaultBottomOwnerKey: config.defaultBottomOwnerKey || config.bottomOwnerKey || config.bottomSlotOwnerKey || 'black',
            defaultTopOwnerKey: config.defaultTopOwnerKey || config.topOwnerKey || config.topSlotOwnerKey || 'white'
        });
    }

    function isOwnerOnBottomSlot(ownerKey, bottomElement, topElement, layout) {
        const normalizedOwnerKey = normalizePlayerKey(ownerKey, 'black');
        const visibleOwners = resolveVisibleOwnerLayoutFromElements(bottomElement, topElement, layout);
        if (visibleOwners.bottomOwnerKey === normalizedOwnerKey) return true;
        if (visibleOwners.topOwnerKey === normalizedOwnerKey) return false;
        return normalizedOwnerKey === 'black';
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

    function getFateWillControllerForTurnOwner(cardState, turnOwnerKey) {
        const ownerKey = normalizePlayerKeyOptional(turnOwnerKey);
        if (!ownerKey || !cardState || typeof cardState !== 'object') return null;
        const controllerMap = (cardState.fateWillControllerByTurnOwner && typeof cardState.fateWillControllerByTurnOwner === 'object')
            ? cardState.fateWillControllerByTurnOwner
            : null;
        if (!controllerMap) return null;
        return normalizePlayerKeyOptional(controllerMap[ownerKey]);
    }

    function getFateWillControlledTurnOwnerForPlayer(cardState, gameState, playerKey) {
        const ownerKey = normalizePlayerKeyOptional(gameState && gameState.currentPlayer);
        const candidatePlayerKey = normalizePlayerKeyOptional(playerKey);
        if (!ownerKey || !candidatePlayerKey) return null;
        return getFateWillControllerForTurnOwner(cardState, ownerKey) === candidatePlayerKey
            ? ownerKey
            : null;
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

    function isOthelloMode(rootRef) {
        return getCurrentMatchMode(rootRef) === 'othello';
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
        getOpposingPlayerKey: getOpposingPlayerKey,
        resolveVisibleOwnerLayout: resolveVisibleOwnerLayout,
        getElementOwnerKey: getElementOwnerKey,
        filterOwnerMatchedElements: filterOwnerMatchedElements,
        resolveOwnerMatchedElement: resolveOwnerMatchedElement,
        resolveVisibleOwnerLayoutFromElements: resolveVisibleOwnerLayoutFromElements,
        isOwnerOnBottomSlot: isOwnerOnBottomSlot,
        isHiddenHandToken: isHiddenHandToken,
        resolveLocalPlayerKey: resolveLocalPlayerKey,
        getFateWillControllerForTurnOwner: getFateWillControllerForTurnOwner,
        getFateWillControlledTurnOwnerForPlayer: getFateWillControlledTurnOwnerForPlayer,
        getCurrentMatchMode: getCurrentMatchMode,
        isNetworkMode: isNetworkMode,
        isOthelloMode: isOthelloMode
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = OwnerHelpers;
    }
    try { if (typeof window !== 'undefined') window.OwnerHelpers = OwnerHelpers; } catch (e) {}
})(typeof self !== 'undefined' ? self : this);

type OwnerSeatKey = 'black' | 'white';
type OwnerMatchMode = 'cpu' | 'network' | 'reversi';

interface OwnerElementLike {
    dataset?: {
        ownerKey?: unknown;
        [key: string]: unknown;
    } | null;
    getAttribute?: (name: string) => string | null;
}

interface OwnerNetworkClientLike {
    isActive?: () => boolean;
    getSeatKey?: () => unknown;
}

interface OwnerHelpersRoot extends Record<string, unknown> {
    cardState?: unknown;
    gameState?: unknown;
    NetworkMatchClient?: OwnerNetworkClientLike | null;
    LOCAL_PLAYER_KEY?: unknown;
    __LOCAL_PLAYER_KEY?: unknown;
    BOARD_VIEWER_KEY?: unknown;
    MATCH_MODE?: unknown;
    DEBUG_HUMAN_VS_HUMAN?: unknown;
    getCurrentMatchMode?: () => unknown;
}

interface OwnerVisibleLayoutInput extends Record<string, unknown> {
    bottomOwnerKey?: unknown;
    topOwnerKey?: unknown;
    bottomSlotOwnerKey?: unknown;
    topSlotOwnerKey?: unknown;
    defaultBottomOwnerKey?: unknown;
    defaultTopOwnerKey?: unknown;
}

interface OwnerVisibleLayout {
    bottomOwnerKey: OwnerSeatKey;
    topOwnerKey: OwnerSeatKey;
}

interface OwnerCardStateRecord extends Record<string, unknown> {
    hands?: Record<string, unknown>;
    pendingEffectByPlayer?: Record<string, unknown>;
    fateWillControllerByTurnOwner?: Record<string, unknown>;
}

interface OwnerNetworkInputPermissionOptions extends Record<string, unknown> {
    rootRef?: unknown;
    cardState?: unknown;
    gameState?: unknown;
    currentPlayer?: unknown;
    localPlayerKey?: unknown;
    matchMode?: unknown;
    debugHumanVsHuman?: unknown;
}

interface OwnerNetworkInputPermissions {
    matchMode: OwnerMatchMode;
    isNetworkMode: boolean;
    isDebugHumanVsHuman: boolean;
    localPlayerKey: OwnerSeatKey;
    turnOwnerKey: OwnerSeatKey;
    inputPlayerKey: OwnerSeatKey;
    actionOwnerKey: OwnerSeatKey;
    fateWillControllerKey: OwnerSeatKey | null;
    controlledTurnOwnerKey: OwnerSeatKey | null;
    canOperateBoard: boolean;
    canUseOwnHand: boolean;
    canInspectOwnHand: boolean;
    canInspectOpponentHand: boolean;
    canPass: boolean;
}

interface OwnerHelpersApi {
    getOwnerDisplayName(owner: unknown): OwnerSeatKey | null;
    isValidOwner(owner: unknown): boolean;
    parseSeatKeyOptional(value: unknown): OwnerSeatKey | null;
    normalizePlayerKey(value: unknown, fallbackKey?: unknown): OwnerSeatKey;
    normalizePlayerKeyOptional(value: unknown): OwnerSeatKey | null;
    getOpposingPlayerKey(playerKey: unknown): OwnerSeatKey | null;
    resolveVisibleOwnerLayout(layout?: OwnerVisibleLayoutInput | null): OwnerVisibleLayout;
    getElementOwnerKey(element: OwnerElementLike | null | undefined): OwnerSeatKey | null;
    filterOwnerMatchedElements<T extends OwnerElementLike>(elements: T[] | null | undefined, ownerKey: unknown): T[];
    resolveOwnerMatchedElement<T extends OwnerElementLike>(elements: T[] | null | undefined, ownerKey: unknown, fallbackElement?: T | null): T | null;
    resolveVisibleOwnerLayoutFromElements(bottomElement?: OwnerElementLike | null, topElement?: OwnerElementLike | null, layout?: OwnerVisibleLayoutInput | null): OwnerVisibleLayout;
    isOwnerOnBottomSlot(ownerKey: unknown, bottomElement?: OwnerElementLike | null, topElement?: OwnerElementLike | null, layout?: OwnerVisibleLayoutInput | null): boolean;
    isHiddenHandToken(value: unknown): boolean;
    resolveLocalPlayerKey(rootRef?: unknown): OwnerSeatKey;
    getFateWillControllerForTurnOwner(cardState: unknown, turnOwnerKey: unknown): OwnerSeatKey | null;
    getFateWillControlledTurnOwnerForPlayer(cardState: unknown, gameState: unknown, playerKey: unknown): OwnerSeatKey | null;
    getCurrentMatchMode(rootRef?: unknown): OwnerMatchMode;
    normalizeMatchMode(value: unknown): OwnerMatchMode;
    isNetworkMode(rootRef?: unknown): boolean;
    isReversiMode(rootRef?: unknown): boolean;
    isOthelloMode(rootRef?: unknown): boolean;
    resolveNetworkInputPermissions(options?: OwnerNetworkInputPermissionOptions | null): OwnerNetworkInputPermissions;
}

(function (root: OwnerHelpersRoot | undefined) {
    'use strict';

    const HIDDEN_HAND_TOKEN_RE = /^__hidden_hand__:(black|white):(\d+)$/;

    function asRecord(value: unknown): Record<string, unknown> {
        return value && typeof value === 'object' ? value as Record<string, unknown> : {};
    }

    function asRoot(value: unknown): OwnerHelpersRoot {
        return value && typeof value === 'object' ? value as OwnerHelpersRoot : {};
    }

    function getOwnerDisplayName(owner: unknown): OwnerSeatKey | null {
        if (owner === 1 || owner === '1' || owner === 'black') return 'black';
        if (owner === -1 || owner === '-1' || owner === 'white') return 'white';
        return null;
    }

    function parseSeatKeyOptional(value: unknown): OwnerSeatKey | null {
        if (value === 1 || value === '1') return 'black';
        if (value === -1 || value === '-1') return 'white';

        const normalized = (value === null || typeof value === 'undefined')
            ? ''
            : String(value).trim().toLowerCase();

        if (normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
        if (normalized === 'white' || normalized === '-1') return 'white';
        return null;
    }

    function normalizePlayerKey(value: unknown, fallbackKey?: unknown): OwnerSeatKey {
        const parsed = parseSeatKeyOptional(value);
        if (parsed) return parsed;
        const fallback = parseSeatKeyOptional(fallbackKey);
        return fallback || 'black';
    }

    function normalizePlayerKeyOptional(value: unknown): OwnerSeatKey | null {
        return parseSeatKeyOptional(value);
    }

    function getOpposingPlayerKey(playerKey: unknown): OwnerSeatKey | null {
        const ownerKey = normalizePlayerKeyOptional(playerKey);
        if (!ownerKey) return null;
        return ownerKey === 'black' ? 'white' : 'black';
    }

    function resolveVisibleOwnerLayout(layout?: OwnerVisibleLayoutInput | null): OwnerVisibleLayout {
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

    function getElementOwnerKey(element: OwnerElementLike | null | undefined): OwnerSeatKey | null {
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

    function filterOwnerMatchedElements<T extends OwnerElementLike>(elements: T[] | null | undefined, ownerKey: unknown): T[] {
        const targetOwnerKey = normalizePlayerKey(ownerKey, 'black');
        const candidates = Array.isArray(elements) ? elements : [];
        return candidates.filter((element) => getElementOwnerKey(element) === targetOwnerKey);
    }

    function resolveOwnerMatchedElement<T extends OwnerElementLike>(elements: T[] | null | undefined, ownerKey: unknown, fallbackElement?: T | null): T | null {
        const matched = filterOwnerMatchedElements(elements, ownerKey);
        if (matched.length > 0) return matched[0];
        return fallbackElement || null;
    }

    function resolveVisibleOwnerLayoutFromElements(
        bottomElement?: OwnerElementLike | null,
        topElement?: OwnerElementLike | null,
        layout?: OwnerVisibleLayoutInput | null
    ): OwnerVisibleLayout {
        const config = (layout && typeof layout === 'object') ? layout : {};
        return resolveVisibleOwnerLayout({
            bottomOwnerKey: getElementOwnerKey(bottomElement),
            topOwnerKey: getElementOwnerKey(topElement),
            defaultBottomOwnerKey: config.defaultBottomOwnerKey || config.bottomOwnerKey || config.bottomSlotOwnerKey || 'black',
            defaultTopOwnerKey: config.defaultTopOwnerKey || config.topOwnerKey || config.topSlotOwnerKey || 'white'
        });
    }

    function isOwnerOnBottomSlot(
        ownerKey: unknown,
        bottomElement?: OwnerElementLike | null,
        topElement?: OwnerElementLike | null,
        layout?: OwnerVisibleLayoutInput | null
    ): boolean {
        const normalizedOwnerKey = normalizePlayerKey(ownerKey, 'black');
        const visibleOwners = resolveVisibleOwnerLayoutFromElements(bottomElement, topElement, layout);
        if (visibleOwners.bottomOwnerKey === normalizedOwnerKey) return true;
        if (visibleOwners.topOwnerKey === normalizedOwnerKey) return false;
        return normalizedOwnerKey === 'black';
    }

    function isHiddenHandToken(value: unknown): boolean {
        return typeof value === 'string' && HIDDEN_HAND_TOKEN_RE.test(value);
    }

    function resolveProjectedCardState(ctx: OwnerHelpersRoot | null | undefined): OwnerCardStateRecord | null {
        if (ctx && ctx.cardState && typeof ctx.cardState === 'object') return ctx.cardState as OwnerCardStateRecord;
        try {
            const globalRoot = typeof globalThis !== 'undefined' ? globalThis as OwnerHelpersRoot : null;
            if (globalRoot && globalRoot.cardState && typeof globalRoot.cardState === 'object') {
                return globalRoot.cardState as OwnerCardStateRecord;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function inferSeatFromProjectedHands(cardState: OwnerCardStateRecord | null): OwnerSeatKey | null {
        const hands = (cardState && cardState.hands && typeof cardState.hands === 'object') ? cardState.hands : null;
        if (!hands) return null;

        const summarizeHand = (ownerKey: OwnerSeatKey) => {
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

    function inferSeatFromPendingEffects(cardState: OwnerCardStateRecord | null): OwnerSeatKey | null {
        const pendingByPlayer = (cardState && cardState.pendingEffectByPlayer && typeof cardState.pendingEffectByPlayer === 'object')
            ? cardState.pendingEffectByPlayer
            : null;
        if (!pendingByPlayer) return null;

        for (const ownerKey of ['black', 'white'] as const) {
            const pending = asRecord(pendingByPlayer[ownerKey]);
            if (!pending || pending.type !== 'CONDEMN_WILL' || !Array.isArray(pending.offers)) continue;
            const hasVisibleOffer = pending.offers.some((offer) => {
                const cardId = offer && typeof offer === 'object' ? offer.cardId : offer;
                return typeof cardId === 'string' && !isHiddenHandToken(cardId);
            });
            if (hasVisibleOffer) return ownerKey;
        }

        return null;
    }

    function inferSeatFromProjectedState(ctx: OwnerHelpersRoot | null | undefined): OwnerSeatKey | null {
        const cardState = resolveProjectedCardState(ctx);
        if (!cardState) return null;

        const inferredFromHands = inferSeatFromProjectedHands(cardState);
        if (inferredFromHands) return inferredFromHands;

        return inferSeatFromPendingEffects(cardState);
    }

    function hasAuthoritativeNetworkSeat(ctx: OwnerHelpersRoot | null | undefined, explicitSeat: OwnerSeatKey | null): boolean {
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

    function resolveLocalPlayerKey(rootRef?: unknown): OwnerSeatKey {
        const ctx = asRoot(rootRef || root || (typeof globalThis !== 'undefined' ? globalThis : {}));
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
            return explicitSeat || 'black';
        }

        const inferredSeat = inferSeatFromProjectedState(ctx);
        if (inferredSeat && explicitSeat && inferredSeat !== explicitSeat) {
            return inferredSeat;
        }
        return explicitSeat || inferredSeat || 'black';
    }

    function getFateWillControllerForTurnOwner(cardState: unknown, turnOwnerKey: unknown): OwnerSeatKey | null {
        const ownerKey = normalizePlayerKeyOptional(turnOwnerKey);
        if (!ownerKey || !cardState || typeof cardState !== 'object') return null;
        const record = cardState as OwnerCardStateRecord;
        const controllerMap = (record.fateWillControllerByTurnOwner && typeof record.fateWillControllerByTurnOwner === 'object')
            ? record.fateWillControllerByTurnOwner
            : null;
        if (!controllerMap) return null;
        return normalizePlayerKeyOptional(controllerMap[ownerKey]);
    }

    function getFateWillControlledTurnOwnerForPlayer(cardState: unknown, gameState: unknown, playerKey: unknown): OwnerSeatKey | null {
        const ownerKey = normalizePlayerKeyOptional(asRecord(gameState).currentPlayer);
        const candidatePlayerKey = normalizePlayerKeyOptional(playerKey);
        if (!ownerKey || !candidatePlayerKey) return null;
        return getFateWillControllerForTurnOwner(cardState, ownerKey) === candidatePlayerKey
            ? ownerKey
            : null;
    }

    function normalizeMatchMode(value: unknown): OwnerMatchMode {
        const mode = String(value || 'cpu').trim().toLowerCase();
        if (mode === 'reversi' || mode === 'othello') return 'reversi';
        if (mode === 'network') return 'network';
        return 'cpu';
    }

    function getCurrentMatchMode(rootRef?: unknown): OwnerMatchMode {
        const ctx = asRoot(rootRef || root || (typeof globalThis !== 'undefined' ? globalThis : {}));
        try {
            if (ctx && typeof ctx.getCurrentMatchMode === 'function') {
                return normalizeMatchMode(ctx.getCurrentMatchMode());
            }
        } catch (e) { /* ignore */ }
        try {
            if (ctx && ctx.MATCH_MODE) return normalizeMatchMode(ctx.MATCH_MODE);
        } catch (e) { /* ignore */ }
        return 'cpu';
    }

    function isNetworkMode(rootRef?: unknown): boolean {
        return getCurrentMatchMode(rootRef) === 'network';
    }

    function isReversiMode(rootRef?: unknown): boolean {
        return getCurrentMatchMode(rootRef) === 'reversi';
    }

    function isOthelloMode(rootRef?: unknown): boolean {
        return isReversiMode(rootRef);
    }

    function hasOwn(value: Record<string, unknown>, key: string): boolean {
        return Object.prototype.hasOwnProperty.call(value, key);
    }

    function resolveNetworkInputPermissions(options?: OwnerNetworkInputPermissionOptions | null): OwnerNetworkInputPermissions {
        const opts = (options && typeof options === 'object') ? options : {};
        const ctx = asRoot(opts.rootRef || root || (typeof globalThis !== 'undefined' ? globalThis : {}));
        const explicitGameState = opts.gameState && typeof opts.gameState === 'object'
            ? opts.gameState
            : (ctx.gameState && typeof ctx.gameState === 'object' ? ctx.gameState : {});
        const explicitCardState = opts.cardState && typeof opts.cardState === 'object'
            ? opts.cardState
            : (ctx.cardState && typeof ctx.cardState === 'object' ? ctx.cardState : {});
        const matchMode = hasOwn(opts, 'matchMode')
            ? normalizeMatchMode(opts.matchMode)
            : getCurrentMatchMode(ctx);
        const isNetwork = matchMode === 'network';
        const rawDebugHumanVsHuman = hasOwn(opts, 'debugHumanVsHuman')
            ? opts.debugHumanVsHuman === true
            : ctx.DEBUG_HUMAN_VS_HUMAN === true;
        const isDebugHumanVsHuman = isNetwork ? false : rawDebugHumanVsHuman;
        const turnOwnerKey = normalizePlayerKey(
            hasOwn(opts, 'currentPlayer') ? opts.currentPlayer : asRecord(explicitGameState).currentPlayer,
            'black'
        );
        const localPlayerKey = isNetwork
            ? normalizePlayerKey(opts.localPlayerKey, resolveLocalPlayerKey(ctx))
            : (isDebugHumanVsHuman
                ? turnOwnerKey
                : normalizePlayerKey(opts.localPlayerKey, 'black'));
        const fateWillControllerKey = getFateWillControllerForTurnOwner(explicitCardState, turnOwnerKey);
        const inputPlayerKey = isNetwork
            ? localPlayerKey
            : (isDebugHumanVsHuman
                ? (fateWillControllerKey || turnOwnerKey)
                : localPlayerKey);
        const controlledTurnOwnerKey = fateWillControllerKey === inputPlayerKey ? turnOwnerKey : null;
        const actionOwnerKey = controlledTurnOwnerKey || inputPlayerKey;
        let canActCurrentTurn = false;

        if (fateWillControllerKey && (isNetwork || !isDebugHumanVsHuman)) {
            canActCurrentTurn = fateWillControllerKey === inputPlayerKey;
        } else if (isNetwork) {
            canActCurrentTurn = turnOwnerKey === inputPlayerKey;
        } else if (isDebugHumanVsHuman) {
            canActCurrentTurn = true;
        } else {
            canActCurrentTurn = turnOwnerKey === inputPlayerKey;
        }

        return {
            matchMode,
            isNetworkMode: isNetwork,
            isDebugHumanVsHuman,
            localPlayerKey,
            turnOwnerKey,
            inputPlayerKey,
            actionOwnerKey,
            fateWillControllerKey,
            controlledTurnOwnerKey,
            canOperateBoard: canActCurrentTurn,
            canUseOwnHand: canActCurrentTurn,
            canInspectOwnHand: true,
            canInspectOpponentHand: !isNetwork && isDebugHumanVsHuman,
            canPass: canActCurrentTurn
        };
    }

    function isValidOwner(owner: unknown): boolean {
        return owner === 1 || owner === -1 || owner === '1' || owner === '-1' || owner === 'black' || owner === 'white';
    }

    const OwnerHelpers: OwnerHelpersApi = {
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
        normalizeMatchMode: normalizeMatchMode,
        isNetworkMode: isNetworkMode,
        isReversiMode: isReversiMode,
        isOthelloMode: isOthelloMode,
        resolveNetworkInputPermissions: resolveNetworkInputPermissions
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = OwnerHelpers;
    }
})(typeof self !== 'undefined' ? self as unknown as OwnerHelpersRoot : globalThis as OwnerHelpersRoot);

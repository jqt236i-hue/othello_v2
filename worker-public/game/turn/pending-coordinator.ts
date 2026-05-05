declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const pendingCoordinatorModule = (function (root: any) {
    'use strict';

    var cachedPendingStateManager: any = null;
    var cachedOwnerHelpers: any = null;
    var cachedCardLogic: any = null;
    var pendingSelectionActionByPlayer: Record<string, any> = {
        black: null,
        white: null
    };

    function resolveCachedModule(cacheRef: any, requirePath: string, globalKey: string): any {
        if (cacheRef && typeof cacheRef === 'object') {
            return cacheRef;
        }
        var resolvedModule = cacheRef;
        if (typeof require === 'function') {
            try { resolvedModule = _require(requirePath); } catch (e) { /* ignore */ }
        }
        if (!resolvedModule && root && root[globalKey]) {
            resolvedModule = root[globalKey];
        }
        return resolvedModule;
    }

    function getPendingStateManager() {
        cachedPendingStateManager = resolveCachedModule(
            cachedPendingStateManager,
            '../logic/cards-internal/pending-state-manager',
            'CardPendingStateManager'
        );
        return cachedPendingStateManager;
    }

    function getOwnerHelpers() {
        cachedOwnerHelpers = resolveCachedModule(
            cachedOwnerHelpers,
            '../../utils/owner-helpers',
            'OwnerHelpers'
        );
        return cachedOwnerHelpers;
    }

    function getCardLogic() {
        cachedCardLogic = resolveCachedModule(
            cachedCardLogic,
            '../logic/cards',
            'CardLogic'
        );
        return cachedCardLogic;
    }

    function callPendingStateManager(methodName: string, args: any[], fallbackValue: any): any {
        var pendingStateManager = getPendingStateManager();
        if (!pendingStateManager || typeof pendingStateManager[methodName] !== 'function') {
            return fallbackValue;
        }
        return pendingStateManager[methodName].apply(pendingStateManager, args || []);
    }

    function normalizePlayerKey(playerKey: any): string {
        var ownerHelpers = getOwnerHelpers();
        if (ownerHelpers && typeof ownerHelpers.normalizePlayerKey === 'function') {
            return ownerHelpers.normalizePlayerKey(playerKey, 'black');
        }
        return String(playerKey || '').trim().toLowerCase() === 'white' ? 'white' : 'black';
    }

    function normalizePendingType(cardType: any): string {
        return String(cardType || '').trim().toUpperCase();
    }

    function cloneData(value: any): any {
        try {
            if (root && typeof root.structuredClone === 'function') {
                return root.structuredClone(value);
            }
        } catch (e) { /* ignore */ }
        return JSON.parse(JSON.stringify(value));
    }

    function clonePendingSelectionAction(action: any): any {
        if (!action || typeof action !== 'object') return null;
        try {
            return cloneData(action);
        } catch (e) {
            return Object.assign({}, action);
        }
    }

    function ensurePendingStateByPlayer(cardState: any): any {
        if (!cardState || typeof cardState !== 'object') return null;
        if (!cardState.pendingEffectByPlayer || typeof cardState.pendingEffectByPlayer !== 'object') {
            cardState.pendingEffectByPlayer = { black: null, white: null };
        }
        if (!Object.prototype.hasOwnProperty.call(cardState.pendingEffectByPlayer, 'black')) {
            cardState.pendingEffectByPlayer.black = null;
        }
        if (!Object.prototype.hasOwnProperty.call(cardState.pendingEffectByPlayer, 'white')) {
            cardState.pendingEffectByPlayer.white = null;
        }
        return cardState.pendingEffectByPlayer;
    }

    function resolvePendingSelectionContract(cardType: any): any {
        return callPendingStateManager('resolvePendingSelectionContract', [cardType], null);
    }

    function resolvePendingSelectionDispatchKey(cardType: any): any {
        return callPendingStateManager('resolvePendingSelectionDispatchKey', [cardType], null);
    }

    function isSelectionOnlyEndTurnPendingType(cardType: any): any {
        return callPendingStateManager('isSelectionOnlyEndTurnPendingType', [cardType], false);
    }

    function shouldDeferNetworkPublishForPendingType(cardType: any): any {
        return callPendingStateManager('shouldDeferNetworkPublishForPendingType', [cardType], false);
    }

    function shouldWaitForPlaybackIdleForPendingType(cardType: any): any {
        return callPendingStateManager('shouldWaitForPlaybackIdleForPendingType', [cardType], false);
    }

    function storePendingSelectionAction(playerKey: any, action: any, pendingType: any): any {
        var normalizedPlayerKey = normalizePlayerKey(playerKey);
        if (!action || typeof action !== 'object') {
            pendingSelectionActionByPlayer[normalizedPlayerKey] = null;
            return null;
        }
        pendingSelectionActionByPlayer[normalizedPlayerKey] = {
            action: clonePendingSelectionAction(action),
            pendingType: normalizePendingType(pendingType)
        };
        return readPendingSelectionAction(normalizedPlayerKey);
    }

    function readPendingSelectionAction(playerKey: any): any {
        var normalizedPlayerKey = normalizePlayerKey(playerKey);
        var storedEntry = pendingSelectionActionByPlayer[normalizedPlayerKey];
        var action = storedEntry && typeof storedEntry === 'object' && storedEntry.action && typeof storedEntry.action === 'object'
            ? storedEntry.action
            : storedEntry;
        if (!action || typeof action !== 'object') return null;
        return clonePendingSelectionAction(action);
    }

    function clearPendingSelectionAction(playerKey: any): boolean {
        pendingSelectionActionByPlayer[normalizePlayerKey(playerKey)] = null;
        return true;
    }

    function clearPendingSelectionActionCache() {
        pendingSelectionActionByPlayer.black = null;
        pendingSelectionActionByPlayer.white = null;
        return true;
    }

    function readPendingEffect(cardState: any, playerKey: any): any {
        var pendingByPlayer = ensurePendingStateByPlayer(cardState);
        if (!pendingByPlayer) return null;
        return pendingByPlayer[normalizePlayerKey(playerKey)] || null;
    }

    function getPendingEffectType(cardState: any, playerKey: any): any {
        var pending = readPendingEffect(cardState, playerKey);
        return pending && pending.type ? pending.type : null;
    }

    function allocatePendingEffectId(cardState: any): string {
        var baseTurnIndex = cardState && Number.isFinite(Number(cardState.turnIndex))
            ? Math.max(0, Math.trunc(Number(cardState.turnIndex)))
            : 0;
        var previousSeq = cardState && Number.isFinite(Number(cardState.pendingEffectSeq))
            ? Math.max(0, Math.trunc(Number(cardState.pendingEffectSeq)))
            : 0;
        var nextSeq = previousSeq + 1;
        if (cardState && typeof cardState === 'object') {
            cardState.pendingEffectSeq = nextSeq;
        }
        return 'pending_' + String(baseTurnIndex) + '_' + String(nextSeq);
    }

    function writePendingEffect(cardState: any, playerKey: any, pendingEffect: any, options: any): any {
        var pendingByPlayer = ensurePendingStateByPlayer(cardState);
        if (!pendingByPlayer) {
            return { ok: false, reason: 'invalid_card_state' };
        }
        var normalizedPlayerKey = normalizePlayerKey(playerKey);
        if (pendingEffect === null || typeof pendingEffect === 'undefined') {
            clearPendingEffect(cardState, normalizedPlayerKey, options);
            return {
                ok: true,
                playerKey: normalizedPlayerKey,
                pendingEffect: null
            };
        }
        if (pendingEffect && typeof pendingEffect === 'object' && !pendingEffect.pendingEffectId) {
            pendingEffect.pendingEffectId = allocatePendingEffectId(cardState);
        }
        pendingByPlayer[normalizedPlayerKey] = pendingEffect;
        var opts = (options && typeof options === 'object') ? options : {};
        if (opts.clearSelectionAction === true) {
            clearPendingSelectionAction(normalizedPlayerKey);
        }
        return {
            ok: true,
            playerKey: normalizedPlayerKey,
            pendingEffect: pendingByPlayer[normalizedPlayerKey]
        };
    }

    function clearPendingEffect(cardState: any, playerKey: any, options: any): any {
        var pendingByPlayer = ensurePendingStateByPlayer(cardState);
        if (!pendingByPlayer) {
            return { ok: false, reason: 'invalid_card_state' };
        }
        var normalizedPlayerKey = normalizePlayerKey(playerKey);
        pendingByPlayer[normalizedPlayerKey] = null;
        var opts = (options && typeof options === 'object') ? options : {};
        if (opts.clearSelectionAction !== false) {
            clearPendingSelectionAction(normalizedPlayerKey);
        }
        return {
            ok: true,
            playerKey: normalizedPlayerKey
        };
    }

    function resolvePendingSyncContext(value: any): any {
        if (!value || typeof value !== 'object') {
            return {
                pendingByPlayer: null,
                turnIndex: null
            };
        }
        if (value.pendingEffectByPlayer && typeof value.pendingEffectByPlayer === 'object') {
            return {
                pendingByPlayer: value.pendingEffectByPlayer,
                turnIndex: Number.isFinite(Number(value.turnIndex)) ? Math.trunc(Number(value.turnIndex)) : null
            };
        }
        return {
            pendingByPlayer: value,
            turnIndex: null
        };
    }

    function syncPendingSelectionActionCache(pendingState: any, options: any): any {
        var syncContext = resolvePendingSyncContext(pendingState);
        var pendingByPlayer = syncContext.pendingByPlayer;
        var expectedTurnIndex = syncContext.turnIndex;
        var opts = (options && typeof options === 'object') ? options : {};
        var preservePlayerKeys = Array.isArray(opts.preservePlayerKeys)
            ? opts.preservePlayerKeys.map(function (value: any) {
                return normalizePlayerKey(value);
            })
            : [];
        var summary: { cleared: string[]; retained: string[] } = {
            cleared: [],
            retained: []
        };
        var playerKeys = ['black', 'white'];
        for (var index = 0; index < playerKeys.length; index += 1) {
            var playerKey = playerKeys[index];
            var storedEntry = pendingSelectionActionByPlayer[playerKey];
            if (!storedEntry || typeof storedEntry !== 'object') continue;
            if (preservePlayerKeys.indexOf(playerKey) !== -1) {
                summary.retained.push(playerKey);
                continue;
            }

            var pending = pendingByPlayer ? pendingByPlayer[playerKey] : null;
            var expectedType = normalizePendingType(pending && pending.type);
            var storedType = normalizePendingType(storedEntry.pendingType);
            var storedAction = storedEntry.action && typeof storedEntry.action === 'object' ? storedEntry.action : null;
            var storedTurnIndex = storedAction && Number.isFinite(Number(storedAction.turnIndex))
                ? Math.trunc(Number(storedAction.turnIndex))
                : null;
            if (!expectedType || !storedType || storedType !== expectedType) {
                pendingSelectionActionByPlayer[playerKey] = null;
                summary.cleared.push(playerKey);
                continue;
            }
            if (
                expectedTurnIndex !== null
                && storedTurnIndex !== null
                && storedTurnIndex !== expectedTurnIndex
            ) {
                pendingSelectionActionByPlayer[playerKey] = null;
                summary.cleared.push(playerKey);
                continue;
            }
            summary.retained.push(playerKey);
        }
        return summary;
    }

    function shouldRetainPendingSelectionAction(cardStateValue: any, playerKey: any, pendingType: any): boolean {
        var normalizedPlayerKey = normalizePlayerKey(playerKey);
        var pendingByPlayer = cardStateValue && cardStateValue.pendingEffectByPlayer;
        var pending = pendingByPlayer && pendingByPlayer[normalizedPlayerKey];
        if (!pending || !pending.type) return false;
        if (!pendingType) return true;
        return normalizePendingType(pending.type) === normalizePendingType(pendingType);
    }

    function clonePendingSelectionTransportTarget(target: any): any {
        if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return null;
        return { row: target.row, col: target.col };
    }

    function applyPendingSelectionCardContext(target: any, playerKey: any, pendingLike: any, options: any): any {
        var payload = (target && typeof target === 'object') ? target : {};
        return payload;
    }

    function buildPendingSelectionTransportState(pendingType: any, pending: any): any {
        var normalizedPendingType = normalizePendingType(pendingType || (pending && pending.type));
        if (!normalizedPendingType || !pending || normalizePendingType(pending.type) !== normalizedPendingType) {
            return null;
        }

        var transportState: Record<string, any> = {
            type: normalizedPendingType,
            stage: typeof pending.stage === 'string' && pending.stage ? pending.stage : 'selectTarget'
        };
        if (typeof pending.cardId === 'string' && pending.cardId) {
            transportState.cardId = pending.cardId;
        }
        if (Number.isInteger(pending.sourceHandIndex)) {
            transportState.sourceHandIndex = pending.sourceHandIndex;
        }
        if (typeof pending.pendingEffectId === 'string' && pending.pendingEffectId) {
            transportState.pendingEffectId = pending.pendingEffectId;
        }

        var contract = resolvePendingSelectionContract(normalizedPendingType);
        if (!contract || contract.kind !== 'multi_stage') {
            return transportState;
        }

        if (normalizedPendingType === 'POSITION_SWAP_WILL' || normalizedPendingType === 'BOARD_SHRINK_GOD') {
            var firstTarget = clonePendingSelectionTransportTarget(pending.firstTarget);
            if (firstTarget) {
                transportState.firstTarget = firstTarget;
            }
        }

        if (normalizedPendingType === 'BOARD_EXPANSION_GOD' || normalizedPendingType === 'BOARD_SHRINK_WILL') {
            var selectedTargets = Array.isArray(pending.selectedTargets)
                    ? pending.selectedTargets.map(function (target: any) {
                    return clonePendingSelectionTransportTarget(target);
                }).filter(function (target: any) {
                    return !!target;
                })
                : [];
            if (selectedTargets.length > 0) {
                transportState.selectedTargets = selectedTargets;
            }
            if (Number.isFinite(Number(pending.selectedCount))) {
                transportState.selectedCount = Math.max(0, Math.trunc(Number(pending.selectedCount)));
            }
            if (Number.isFinite(Number(pending.maxSelections))) {
                transportState.maxSelections = Math.max(0, Math.trunc(Number(pending.maxSelections)));
            }
        }

        return transportState;
    }

    function createPendingSelectionAction(playerKey: any, pendingType: any, actionPayload: any, options: any): any {
        var opts = (options && typeof options === 'object') ? options : {};
        var normalizedPayload = Object.assign({}, actionPayload || {});
        var normalizedPlayerKey = normalizePlayerKey(playerKey);
        var cardStateRef = opts.cardState || null;
        if (shouldDeferNetworkPublishForPendingType(pendingType)) {
            normalizedPayload.deferNetworkPublish = true;
        }

        var pendingByPlayer = cardStateRef && cardStateRef.pendingEffectByPlayer;
        var currentPending = pendingByPlayer ? pendingByPlayer[normalizedPlayerKey] : null;
        var transportState = buildPendingSelectionTransportState(pendingType, currentPending);
        if (transportState) {
            normalizedPayload.pendingSelectionState = transportState;
        }

        var actionType = typeof opts.actionType === 'string' && opts.actionType ? opts.actionType : 'place';
        var createAction = (typeof opts.createAction === 'function')
            ? opts.createAction
            : (
                root
                && root.ActionManager
                && root.ActionManager.ActionManager
                && typeof root.ActionManager.ActionManager.createAction === 'function'
                    ? function (type: any, ownerKey: any, payload: any) {
                        return root.ActionManager.ActionManager.createAction(type, ownerKey, payload);
                    }
                    : null
            );
        var action = createAction
            ? createAction(actionType, normalizedPlayerKey, normalizedPayload)
            : Object.assign({ type: actionType }, normalizedPayload);

        if (action && cardStateRef && typeof cardStateRef.turnIndex === 'number') {
            action.turnIndex = cardStateRef.turnIndex;
        }

        storePendingSelectionAction(normalizedPlayerKey, action, pendingType);
        return action;
    }

    function clearPendingSelectionFailureState(cardState: any, playerKey: any, options: any): any {
        var normalizedPlayerKey = normalizePlayerKey(playerKey);
        var opts = (options && typeof options === 'object') ? options : {};
        var shouldClearPendingEffect = opts.clearPendingEffect === true;

        if (shouldClearPendingEffect && cardState && typeof cardState === 'object') {
            var clearedPending = clearPendingEffect(cardState, normalizedPlayerKey, {
                clearSelectionAction: true
            });
            return Object.assign({}, clearedPending, {
                clearedPendingEffect: true
            });
        }

        clearPendingSelectionAction(normalizedPlayerKey);
        return {
            ok: true,
            playerKey: normalizedPlayerKey,
            clearedPendingEffect: false
        };
    }

    function requiresPendingTarget(cardType: any): boolean {
        var pendingStateManager = getPendingStateManager();
        return !!(
            pendingStateManager
            && typeof pendingStateManager.requiresTargetSelection === 'function'
            && pendingStateManager.requiresTargetSelection(cardType)
        );
    }

    function getPendingSelectionContract(cardType: any): any {
        return resolvePendingSelectionContract(cardType);
    }

    return {
        readPendingEffect: readPendingEffect,
        getPendingEffectType: getPendingEffectType,
        writePendingEffect: writePendingEffect,
        clearPendingEffect: clearPendingEffect,
        requiresPendingTarget: requiresPendingTarget,
        getPendingSelectionContract: getPendingSelectionContract,
        isSelectionOnlyEndTurnPendingType: isSelectionOnlyEndTurnPendingType,
        shouldDeferNetworkPublishForPendingType: shouldDeferNetworkPublishForPendingType,
        shouldWaitForPlaybackIdleForPendingType: shouldWaitForPlaybackIdleForPendingType,
        resolvePendingSelectionDispatchKey: resolvePendingSelectionDispatchKey,
        applyPendingSelectionCardContext: applyPendingSelectionCardContext,
        storePendingSelectionAction: storePendingSelectionAction,
        readPendingSelectionAction: readPendingSelectionAction,
        clearPendingSelectionAction: clearPendingSelectionAction,
        clearPendingSelectionActionCache: clearPendingSelectionActionCache,
        syncPendingSelectionActionCache: syncPendingSelectionActionCache,
        shouldRetainPendingSelectionAction: shouldRetainPendingSelectionAction,
        createPendingSelectionAction: createPendingSelectionAction,
        clearPendingSelectionFailureState: clearPendingSelectionFailureState
    };
})(null /* @compat - bootstrap DI fallback */);

export = pendingCoordinatorModule;

(function (root, factory) {
    var resolvedRoot = root || (typeof globalThis !== 'undefined' ? globalThis : this);
    var pendingCoordinatorModule = factory(resolvedRoot);
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = pendingCoordinatorModule;
    } else {
        resolvedRoot.PendingCoordinator = pendingCoordinatorModule;
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    var cachedPendingStateManager = null;
    var cachedOwnerHelpers = null;
    var pendingSelectionActionByPlayer = {
        black: null,
        white: null
    };

    function getPendingStateManager() {
        if (cachedPendingStateManager && typeof cachedPendingStateManager === 'object') {
            return cachedPendingStateManager;
        }
        if (typeof require === 'function') {
            try { cachedPendingStateManager = require('../logic/cards-internal/pending-state-manager'); } catch (e) { /* ignore */ }
        }
        if (!cachedPendingStateManager && root && root.CardPendingStateManager) {
            cachedPendingStateManager = root.CardPendingStateManager;
        }
        return cachedPendingStateManager;
    }

    function getOwnerHelpers() {
        if (cachedOwnerHelpers && typeof cachedOwnerHelpers === 'object') {
            return cachedOwnerHelpers;
        }
        if (typeof require === 'function') {
            try { cachedOwnerHelpers = require('../../utils/owner-helpers'); } catch (e) { /* ignore */ }
        }
        if (!cachedOwnerHelpers && root && root.OwnerHelpers) {
            cachedOwnerHelpers = root.OwnerHelpers;
        }
        return cachedOwnerHelpers;
    }

    function normalizePlayerKey(playerKey) {
        var ownerHelpers = getOwnerHelpers();
        if (ownerHelpers && typeof ownerHelpers.normalizePlayerKey === 'function') {
            return ownerHelpers.normalizePlayerKey(playerKey, 'black');
        }
        return String(playerKey || '').trim().toLowerCase() === 'white' ? 'white' : 'black';
    }

    function normalizePendingType(cardType) {
        return String(cardType || '').trim().toUpperCase();
    }

    function cloneData(value) {
        try {
            if (root && typeof root.structuredClone === 'function') {
                return root.structuredClone(value);
            }
        } catch (e) { /* ignore */ }
        return JSON.parse(JSON.stringify(value));
    }

    function clonePendingSelectionAction(action) {
        if (!action || typeof action !== 'object') return null;
        try {
            return cloneData(action);
        } catch (e) {
            return Object.assign({}, action);
        }
    }

    function ensurePendingStateByPlayer(cardState) {
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

    function resolvePendingSelectionContract(cardType) {
        var pendingStateManager = getPendingStateManager();
        if (!pendingStateManager || typeof pendingStateManager.resolvePendingSelectionContract !== 'function') {
            return null;
        }
        return pendingStateManager.resolvePendingSelectionContract(cardType);
    }

    function resolvePendingSelectionDispatchKey(cardType) {
        var pendingStateManager = getPendingStateManager();
        if (!pendingStateManager || typeof pendingStateManager.resolvePendingSelectionDispatchKey !== 'function') {
            return null;
        }
        return pendingStateManager.resolvePendingSelectionDispatchKey(cardType);
    }

    function storePendingSelectionAction(playerKey, action, pendingType) {
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

    function readPendingSelectionAction(playerKey) {
        var normalizedPlayerKey = normalizePlayerKey(playerKey);
        var storedEntry = pendingSelectionActionByPlayer[normalizedPlayerKey];
        var action = storedEntry && typeof storedEntry === 'object' && storedEntry.action && typeof storedEntry.action === 'object'
            ? storedEntry.action
            : storedEntry;
        if (!action || typeof action !== 'object') return null;
        return clonePendingSelectionAction(action);
    }

    function clearPendingSelectionAction(playerKey) {
        pendingSelectionActionByPlayer[normalizePlayerKey(playerKey)] = null;
        return true;
    }

    function clearPendingSelectionActionCache() {
        pendingSelectionActionByPlayer.black = null;
        pendingSelectionActionByPlayer.white = null;
        return true;
    }

    function readPendingEffect(cardState, playerKey) {
        var pendingByPlayer = ensurePendingStateByPlayer(cardState);
        if (!pendingByPlayer) return null;
        return pendingByPlayer[normalizePlayerKey(playerKey)] || null;
    }

    function getPendingEffectType(cardState, playerKey) {
        var pending = readPendingEffect(cardState, playerKey);
        return pending && pending.type ? pending.type : null;
    }

    function writePendingEffect(cardState, playerKey, pendingEffect, options) {
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

    function clearPendingEffect(cardState, playerKey, options) {
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

    function resolvePendingSyncContext(value) {
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

    function syncPendingSelectionActionCache(pendingState) {
        var syncContext = resolvePendingSyncContext(pendingState);
        var pendingByPlayer = syncContext.pendingByPlayer;
        var expectedTurnIndex = syncContext.turnIndex;
        var summary = {
            cleared: [],
            retained: []
        };
        var playerKeys = ['black', 'white'];
        for (var index = 0; index < playerKeys.length; index += 1) {
            var playerKey = playerKeys[index];
            var storedEntry = pendingSelectionActionByPlayer[playerKey];
            if (!storedEntry || typeof storedEntry !== 'object') continue;

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

    function shouldRetainPendingSelectionAction(cardStateValue, playerKey, pendingType) {
        var normalizedPlayerKey = normalizePlayerKey(playerKey);
        var pendingByPlayer = cardStateValue && cardStateValue.pendingEffectByPlayer;
        var pending = pendingByPlayer && pendingByPlayer[normalizedPlayerKey];
        if (!pending || !pending.type) return false;
        if (!pendingType) return true;
        return normalizePendingType(pending.type) === normalizePendingType(pendingType);
    }

    function clonePendingSelectionTransportTarget(target) {
        if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return null;
        return { row: target.row, col: target.col };
    }

    function buildPendingSelectionTransportState(pendingType, pending) {
        var normalizedPendingType = normalizePendingType(pendingType || (pending && pending.type));
        if (!normalizedPendingType || !pending || normalizePendingType(pending.type) !== normalizedPendingType) {
            return null;
        }

        var transportState = {
            type: normalizedPendingType,
            stage: typeof pending.stage === 'string' && pending.stage ? pending.stage : 'selectTarget'
        };
        var contract = resolvePendingSelectionContract(normalizedPendingType);
        if (!contract || contract.kind !== 'multi_stage') {
            return null;
        }

        if (normalizedPendingType === 'POSITION_SWAP_WILL' || normalizedPendingType === 'BOARD_SHRINK_GOD') {
            var firstTarget = clonePendingSelectionTransportTarget(pending.firstTarget);
            if (firstTarget) {
                transportState.firstTarget = firstTarget;
            }
        }

        if (normalizedPendingType === 'BOARD_EXPANSION_GOD' || normalizedPendingType === 'BOARD_SHRINK_WILL') {
            var selectedTargets = Array.isArray(pending.selectedTargets)
                ? pending.selectedTargets.map(function (target) {
                    return clonePendingSelectionTransportTarget(target);
                }).filter(function (target) {
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

        return Object.keys(transportState).length > 2 ? transportState : null;
    }

    function createPendingSelectionAction(playerKey, pendingType, actionPayload, options) {
        var pendingStateManager = getPendingStateManager();
        var opts = (options && typeof options === 'object') ? options : {};
        var normalizedPayload = Object.assign({}, actionPayload || {});
        var normalizedPlayerKey = normalizePlayerKey(playerKey);
        var cardStateRef = opts.cardState || null;
        if (
            pendingStateManager
            && typeof pendingStateManager.shouldDeferNetworkPublishForPendingType === 'function'
            && pendingStateManager.shouldDeferNetworkPublishForPendingType(pendingType)
        ) {
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
                    ? function (type, ownerKey, payload) {
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

    function setPendingHintLocally(cardState, playerKey, cardType, options) {
        var pendingStateManager = getPendingStateManager();
        if (!pendingStateManager || typeof pendingStateManager.createPendingEffectState !== 'function') {
            return { ok: false, reason: 'pending_state_manager_unavailable' };
        }
        var pendingByPlayer = ensurePendingStateByPlayer(cardState);
        if (!pendingByPlayer) {
            return { ok: false, reason: 'invalid_card_state' };
        }

        var normalizedPlayerKey = normalizePlayerKey(playerKey);
        var opts = (options && typeof options === 'object') ? options : {};
        var pending = pendingStateManager.createPendingEffectState({
            cardType: cardType,
            cardId: opts.cardId,
            sourceHandIndex: opts.sourceHandIndex,
            needsSelection: opts.needsSelection,
            offers: opts.offers
        });
        if (!pending || typeof pending !== 'object') {
            return { ok: false, reason: 'pending_hint_unavailable' };
        }

        pending.__networkLocalHint = true;
        pending.__networkLocalHintSetAt = Date.now();
        pendingByPlayer[normalizedPlayerKey] = pending;
        return {
            ok: true,
            playerKey: normalizedPlayerKey,
            pending: pending
        };
    }

    function clearPendingHint(cardState, playerKey) {
        var pendingByPlayer = ensurePendingStateByPlayer(cardState);
        if (!pendingByPlayer) {
            return { ok: false, reason: 'invalid_card_state' };
        }
        var normalizedPlayerKey = normalizePlayerKey(playerKey);
        pendingByPlayer[normalizedPlayerKey] = null;
        return {
            ok: true,
            playerKey: normalizedPlayerKey
        };
    }

    function requiresPendingTarget(cardType) {
        var pendingStateManager = getPendingStateManager();
        return !!(
            pendingStateManager
            && typeof pendingStateManager.requiresTargetSelection === 'function'
            && pendingStateManager.requiresTargetSelection(cardType)
        );
    }

    function getPendingSelectionContract(cardType) {
        return resolvePendingSelectionContract(cardType);
    }

    return {
        setPendingHintLocally: setPendingHintLocally,
        clearPendingHint: clearPendingHint,
        readPendingEffect: readPendingEffect,
        getPendingEffectType: getPendingEffectType,
        writePendingEffect: writePendingEffect,
        clearPendingEffect: clearPendingEffect,
        requiresPendingTarget: requiresPendingTarget,
        getPendingSelectionContract: getPendingSelectionContract,
        resolvePendingSelectionDispatchKey: resolvePendingSelectionDispatchKey,
        storePendingSelectionAction: storePendingSelectionAction,
        readPendingSelectionAction: readPendingSelectionAction,
        clearPendingSelectionAction: clearPendingSelectionAction,
        clearPendingSelectionActionCache: clearPendingSelectionActionCache,
        syncPendingSelectionActionCache: syncPendingSelectionActionCache,
        shouldRetainPendingSelectionAction: shouldRetainPendingSelectionAction,
        createPendingSelectionAction: createPendingSelectionAction
    };
}));

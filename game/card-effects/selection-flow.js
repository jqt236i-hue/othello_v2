(function (root, factory) {
    var resolvedRoot = root || (typeof globalThis !== 'undefined' ? globalThis : this);
    var pendingSelectionFlowModule = factory(resolvedRoot);
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = pendingSelectionFlowModule;
    } else {
        try {
            Object.defineProperty(resolvedRoot, 'PendingSelectionFlow', {
                configurable: true,
                enumerable: true,
                get: function () { return pendingSelectionFlowModule; },
                set: function () { return pendingSelectionFlowModule; }
            });
        } catch (e) {
            resolvedRoot.PendingSelectionFlow = pendingSelectionFlowModule;
        }
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    let cachedNetworkTurnHandoff = null;
    let cachedPlaybackStateManager = null;
    const pendingSelectionActionByPlayer = {
        black: null,
        white: null
    };

    const PENDING_SELECTION_CONTRACTS = Object.freeze({
        DESTROY_ONE_STONE: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        STRONG_WIND_WILL: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        SUPER_BUOYANCY_WILL: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        SUPER_GRAVITY_WILL: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        TELEPORT_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        CELL_TELEPORT_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        TEMPT_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        TRAP_WILL: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        GUARD_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        GUARDIAN_GOD: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        HYPERACTIVE_INHERIT_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        EXTEND_LIFE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        EXTEND_LIFE_GOD: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        CORROSION_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        CLONE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        SPLIT_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        BLOCKADE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        BOARD_EXPANSION_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        BOARD_EXPANSION_GOD: { kind: 'multi_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        FREEZE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        POSITION_SWAP_WILL: { kind: 'multi_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        METEOR_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        TIME_BOMB: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        SWAP_WITH_ENEMY: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        SELL_CARD_WILL: { kind: 'hand_overlay', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        HEAVEN_BLESSING: { kind: 'hand_overlay', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        CONDEMN_WILL: { kind: 'hand_overlay', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true }
    });

    function normalizePendingType(pendingType) {
        return String(pendingType || '').trim().toUpperCase();
    }

    function getNetworkTurnHandoff() {
        if (cachedNetworkTurnHandoff && typeof cachedNetworkTurnHandoff === 'object') {
            return cachedNetworkTurnHandoff;
        }
        if (typeof require === 'function') {
            try { cachedNetworkTurnHandoff = require('../network-turn-handoff'); } catch (e) { /* ignore */ }
        }
        if (!cachedNetworkTurnHandoff && root && root.NetworkTurnHandoff) {
            cachedNetworkTurnHandoff = root.NetworkTurnHandoff;
        }
        return cachedNetworkTurnHandoff;
    }

    function getPlaybackStateManager() {
        if (cachedPlaybackStateManager && typeof cachedPlaybackStateManager === 'object') {
            return cachedPlaybackStateManager;
        }
        if (!cachedPlaybackStateManager && root && root.PlaybackStateManager) {
            cachedPlaybackStateManager = root.PlaybackStateManager;
        }
        if (typeof require === 'function') {
            try { cachedPlaybackStateManager = require('../../ui/playback-state-manager'); } catch (e) { /* ignore */ }
        }
        return cachedPlaybackStateManager;
    }

    function resolvePendingSelectionContract(pendingType) {
        const normalized = normalizePendingType(pendingType);
        return normalized && PENDING_SELECTION_CONTRACTS[normalized]
            ? PENDING_SELECTION_CONTRACTS[normalized]
            : null;
    }

    function isSelectionOnlyEndTurnPendingType(pendingType) {
        const contract = resolvePendingSelectionContract(pendingType);
        return !!(contract && contract.turnOutcome === 'end_turn');
    }

    function shouldDeferNetworkPublishForPendingType(pendingType) {
        const contract = resolvePendingSelectionContract(pendingType);
        return !!(contract && contract.deferNetworkPublish === true);
    }

    function shouldWaitForPlaybackIdleForPendingType(pendingType) {
        const contract = resolvePendingSelectionContract(pendingType);
        return !!(contract && contract.waitForPlaybackIdle === true);
    }

    function cloneData(value) {
        try {
            if (root && typeof root.structuredClone === 'function') {
                return root.structuredClone(value);
            }
        } catch (e) { /* ignore */ }
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeSelectionPlayerKey(playerKey) {
        return String(playerKey || '').trim().toLowerCase() === 'white' ? 'white' : 'black';
    }

    function clonePendingSelectionAction(action) {
        if (!action || typeof action !== 'object') return null;
        try {
            return cloneData(action);
        } catch (e) {
            return Object.assign({}, action);
        }
    }

    function storePendingSelectionAction(playerKey, action, pendingType) {
        const normalizedPlayerKey = normalizeSelectionPlayerKey(playerKey);
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
        const normalizedPlayerKey = normalizeSelectionPlayerKey(playerKey);
        const storedEntry = pendingSelectionActionByPlayer[normalizedPlayerKey];
        const action = storedEntry && typeof storedEntry === 'object' && storedEntry.action && typeof storedEntry.action === 'object'
            ? storedEntry.action
            : storedEntry;
        if (!action || typeof action !== 'object') return null;
        return clonePendingSelectionAction(action);
    }

    function clearPendingSelectionAction(playerKey) {
        pendingSelectionActionByPlayer[normalizeSelectionPlayerKey(playerKey)] = null;
    }

    function syncPendingSelectionActionCache(pendingEffectByPlayer) {
        const pendingByPlayer = pendingEffectByPlayer && typeof pendingEffectByPlayer === 'object'
            ? pendingEffectByPlayer
            : null;
        const summary = {
            cleared: [],
            retained: []
        };
        const playerKeys = ['black', 'white'];
        for (let index = 0; index < playerKeys.length; index += 1) {
            const playerKey = playerKeys[index];
            const storedEntry = pendingSelectionActionByPlayer[playerKey];
            if (!storedEntry || typeof storedEntry !== 'object') continue;

            const pending = pendingByPlayer ? pendingByPlayer[playerKey] : null;
            const expectedType = normalizePendingType(pending && pending.type);
            const storedType = normalizePendingType(storedEntry.pendingType);
            if (!expectedType || !storedType || storedType !== expectedType) {
                pendingSelectionActionByPlayer[playerKey] = null;
                summary.cleared.push(playerKey);
                continue;
            }
            summary.retained.push(playerKey);
        }
        return summary;
    }

    function shouldRetainPendingSelectionAction(cardStateValue, playerKey, pendingType) {
        const normalizedPlayerKey = normalizeSelectionPlayerKey(playerKey);
        const pendingByPlayer = cardStateValue && cardStateValue.pendingEffectByPlayer;
        const pending = pendingByPlayer && pendingByPlayer[normalizedPlayerKey];
        if (!pending || !pending.type) return false;
        if (!pendingType) return true;
        return normalizePendingType(pending.type) === normalizePendingType(pendingType);
    }

    function capturePendingSelectionSnapshot(gameStateValue, cardStateValue) {
        const networkTurnHandoff = getNetworkTurnHandoff();
        if (networkTurnHandoff && typeof networkTurnHandoff.captureNetworkPublishSnapshot === 'function') {
            return networkTurnHandoff.captureNetworkPublishSnapshot(gameStateValue, cardStateValue);
        }
        if (!gameStateValue || !cardStateValue) return null;
        try {
            return {
                gameState: cloneData(gameStateValue),
                cardState: cloneData(cardStateValue)
            };
        } catch (e) {
            return null;
        }
    }

    function publishPendingSelectionSnapshot(meta) {
        const payload = (meta && typeof meta === 'object') ? meta : {};
        const networkTurnHandoff = getNetworkTurnHandoff();
        if (networkTurnHandoff && typeof networkTurnHandoff.publishNetworkSnapshot === 'function') {
            return networkTurnHandoff.publishNetworkSnapshot(payload);
        }
        try {
            if (!root || !root.NetworkMatchClient) return undefined;
            if (typeof root.NetworkMatchClient.publishSnapshot !== 'function') return undefined;
            if (typeof root.NetworkMatchClient.isActive === 'function' && !root.NetworkMatchClient.isActive()) return undefined;
            return root.NetworkMatchClient.publishSnapshot(payload);
        } catch (e) { /* ignore */ }
        return undefined;
    }

    function setRootFlag(name, nextValue) {
        const normalized = !!nextValue;
        try {
            if (root) root[name] = normalized;
        } catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis && globalThis !== root) {
                globalThis[name] = normalized;
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof window !== 'undefined' && window && window !== root && window !== globalThis) {
                window[name] = normalized;
            }
        } catch (e) { /* ignore */ }
    }

    function setSelectionProcessing(nextValue) {
        setRootFlag('isProcessing', nextValue);
    }

    function setSelectionCardAnimating(nextValue) {
        setRootFlag('isCardAnimating', nextValue);
    }

    function setSelectionBusy(nextValue) {
        setSelectionProcessing(nextValue);
        setSelectionCardAnimating(nextValue);
    }

    function readMatchMode() {
        try {
            if (root && typeof root.getCurrentMatchMode === 'function') {
                return root.getCurrentMatchMode();
            }
        } catch (e) { /* ignore */ }
        try {
            return root ? root.MATCH_MODE : null;
        } catch (e) { /* ignore */ }
        return null;
    }

    function hasActiveNetworkPublishClient() {
        try {
            if (!root || !root.NetworkMatchClient) return false;
            if (typeof root.NetworkMatchClient.publishSnapshot !== 'function') return false;
            if (typeof root.NetworkMatchClient.isActive === 'function' && root.NetworkMatchClient.isActive() !== true) return false;
            return true;
        } catch (e) {
            return false;
        }
    }

    function shouldUseNetworkPublishOnlyPendingSelection(pendingType) {
        if (readMatchMode() !== 'network') return false;
        if (!shouldDeferNetworkPublishForPendingType(pendingType)) return false;
        if (!isSelectionOnlyEndTurnPendingType(pendingType)) return false;
        return hasActiveNetworkPublishClient();
    }

    function shouldSuppressLocalPlaybackForDeferredNetworkSelection(pendingType) {
        if (readMatchMode() !== 'network') return false;
        if (!shouldDeferNetworkPublishForPendingType(pendingType)) return false;
        if (isSelectionOnlyEndTurnPendingType(pendingType)) return false;
        return hasActiveNetworkPublishClient();
    }

    function isHumanVsHumanModeEnabled() {
        return !!(root && (root.DEBUG_HUMAN_VS_HUMAN === true || readMatchMode() === 'network'));
    }

    function scheduleWhiteCpuTurn(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const safeDelay = Number.isFinite(Number(opts.delayMs)) ? Math.max(0, Math.trunc(Number(opts.delayMs))) : 0;
        const expectedTurnNumber = Number.isFinite(Number(opts.expectedTurnNumber)) ? Number(opts.expectedTurnNumber) : null;
        const tid = setTimeout(() => {
            try {
                const gameStateRef = root && root.gameState ? root.gameState : null;
                const currentPlayer = gameStateRef ? gameStateRef.currentPlayer : null;
                const currentTurnNumber = (gameStateRef && Number.isFinite(Number(gameStateRef.turnNumber))) ? Number(gameStateRef.turnNumber) : null;
                const isWhiteTurn = currentPlayer === 'white' || currentPlayer === -1 || currentPlayer === '-1'
                    || (typeof root.WHITE !== 'undefined' && currentPlayer === root.WHITE);
                if (!isWhiteTurn) return;
                if (expectedTurnNumber !== null && currentTurnNumber !== null && expectedTurnNumber !== currentTurnNumber) return;
                if (root && typeof root.processCpuTurn === 'function') {
                    root.processCpuTurn();
                }
            } catch (e) { /* ignore */ }
        }, safeDelay);
        if (tid && typeof tid.unref === 'function') tid.unref();
    }

    async function waitForSelectionPlaybackIdle(playbackEvents) {
        if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return;

        const networkTurnHandoff = getNetworkTurnHandoff();
        if (networkTurnHandoff && typeof networkTurnHandoff.waitForPlaybackIdleIfNeeded === 'function') {
            return networkTurnHandoff.waitForPlaybackIdleIfNeeded(playbackEvents);
        }

        const waitForPlaybackFn = (root && typeof root.waitForPlaybackIdle === 'function')
            ? root.waitForPlaybackIdle
            : null;
        if (typeof waitForPlaybackFn !== 'function') return;

        try {
            await waitForPlaybackFn();
        } catch (e) { /* ignore */ }
    }

    function createPendingSelectionAction(playerKey, pendingType, actionPayload, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const normalizedPayload = Object.assign({}, actionPayload || {});
        if (shouldDeferNetworkPublishForPendingType(pendingType)) {
            normalizedPayload.deferNetworkPublish = true;
        }

        const actionType = typeof opts.actionType === 'string' && opts.actionType ? opts.actionType : 'place';
        const action = (root && root.ActionManager && root.ActionManager.ActionManager && typeof root.ActionManager.ActionManager.createAction === 'function')
            ? root.ActionManager.ActionManager.createAction(actionType, playerKey, normalizedPayload)
            : Object.assign({ type: actionType }, normalizedPayload);

        const cardStateRef = opts.cardState || (root ? root.cardState : null);
        if (action && cardStateRef && typeof cardStateRef.turnIndex === 'number') {
            action.turnIndex = cardStateRef.turnIndex;
        }
        storePendingSelectionAction(playerKey, action, pendingType);
        return action;
    }

    async function finalizePendingSelectionFlow(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const pendingType = normalizePendingType(opts.pendingType);
        const contract = resolvePendingSelectionContract(pendingType);
        const playerKey = opts.playerKey || 'black';
        const actionType = opts.actionType || 'place';
        const playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents.slice() : [];
        const cardStateValue = opts.cardStateValue || (root ? root.cardState : null);
        const pendingAction = (opts.action && typeof opts.action === 'object')
            ? storePendingSelectionAction(playerKey, opts.action, pendingType)
            : readPendingSelectionAction(playerKey);
        const ensureFn = typeof opts.ensureCurrentPlayerCanActOrPass === 'function'
            ? opts.ensureCurrentPlayerCanActOrPass
            : null;

        if (contract && contract.turnOutcome === 'end_turn') {
            const networkTurnHandoff = getNetworkTurnHandoff();
            if (!networkTurnHandoff || typeof networkTurnHandoff.finalizeNetworkTurnHandoff !== 'function') {
                setSelectionProcessing(false);
                setSelectionCardAnimating(false);
                if (ensureFn) {
                    try { ensureFn({ useBlackDelay: opts.useBlackDelay !== false }); } catch (e) { /* ignore */ }
                }
                return false;
            }

            await networkTurnHandoff.finalizeNetworkTurnHandoff({
                playerKey,
                actionType,
                action: pendingAction,
                playbackEvents,
                humanMode: isHumanVsHumanModeEnabled(),
                setProcessing: setSelectionProcessing,
                publishSnapshot: ({ playerKey: publishPlayerKey, action: publishAction, playbackEvents: publishPlaybackEvents }) => {
                    const publishMeta = {
                        playerKey: publishPlayerKey,
                        actionType,
                        action: publishAction || pendingAction,
                        playbackEvents: publishPlaybackEvents
                    };
                    publishPendingSelectionSnapshot(publishMeta);
                },
                scheduleCpuTurn: scheduleWhiteCpuTurn,
                onHumanTurnReady: opts.onHumanTurnReady
            });
            if (!shouldRetainPendingSelectionAction(cardStateValue, playerKey, pendingType)) {
                clearPendingSelectionAction(playerKey);
            }
            setSelectionCardAnimating(false);
            return true;
        }

        if (contract && contract.waitForPlaybackIdle) {
            await waitForSelectionPlaybackIdle(playbackEvents);
        }

        if (contract && contract.deferNetworkPublish) {
            const publishMeta = {
                playerKey,
                actionType,
                action: pendingAction,
                playbackEvents
            };
            publishPendingSelectionSnapshot(publishMeta);
        }

        if (!shouldRetainPendingSelectionAction(cardStateValue, playerKey, pendingType)) {
            clearPendingSelectionAction(playerKey);
        }

        setSelectionProcessing(false);
        setSelectionCardAnimating(false);

        if (typeof opts.onSettled === 'function') {
            try { await opts.onSettled(); } catch (e) { /* ignore */ }
        }

        if (ensureFn) {
            try { ensureFn({ useBlackDelay: opts.useBlackDelay !== false }); } catch (e) { /* ignore */ }
        }

        return true;
    }

    function resolvePresentationHelper() {
        if (typeof require === 'function') {
            try { return require('../logic/presentation'); } catch (e) { /* ignore */ }
        }
        return (root && root.PresentationHelper && typeof root.PresentationHelper === 'object')
            ? root.PresentationHelper
            : null;
    }

    function resolveTurnPipelineUIAdapter() {
        if (root && root.TurnPipelineUIAdapter && typeof root.TurnPipelineUIAdapter === 'object') {
            return root.TurnPipelineUIAdapter;
        }
        if (typeof require === 'function') {
            try { return require('../turn/pipeline_ui_adapter'); } catch (e) { /* ignore */ }
        }
        return null;
    }

    function resolveTurnPipeline() {
        if (root && root.TurnPipeline && typeof root.TurnPipeline === 'object') {
            return root.TurnPipeline;
        }
        if (typeof require === 'function') {
            try { return require('../turn/turn_pipeline'); } catch (e) { /* ignore */ }
        }
        return null;
    }

    function resolveRootFunction(name) {
        if (!root || typeof name !== 'string') return null;
        return typeof root[name] === 'function' ? root[name] : null;
    }

    function resolveSelectionMessage(message, context) {
        const value = (typeof message === 'function')
            ? message(context || {})
            : message;
        return String(value || '').trim();
    }

    function emitSelectionMessage(message, context) {
        const text = resolveSelectionMessage(message, context);
        if (!text) return false;
        const emitLogAdded = resolveRootFunction('emitLogAdded');
        if (typeof emitLogAdded !== 'function') return false;
        try {
            emitLogAdded(text);
            return true;
        } catch (e) {
            return false;
        }
    }

    function applyStateSnapshotInPlace(stateKey, nextValue) {
        if (!root || !nextValue || typeof nextValue !== 'object') return nextValue || null;

        const currentValue = root[stateKey];
        if (currentValue && typeof currentValue === 'object' && currentValue !== nextValue) {
            const keys = Object.keys(currentValue);
            for (let index = 0; index < keys.length; index += 1) {
                delete currentValue[keys[index]];
            }
            Object.assign(currentValue, nextValue);
            root[stateKey] = currentValue;
            return currentValue;
        }

        root[stateKey] = nextValue;
        return nextValue;
    }

    function applySelectionStateResult(result) {
        if (result && result.nextCardState) {
            applyStateSnapshotInPlace('cardState', result.nextCardState);
        }
        if (result && result.nextGameState) {
            applyStateSnapshotInPlace('gameState', result.nextGameState);
        }
        return {
            cardState: root ? root.cardState : null,
            gameState: root ? root.gameState : null
        };
    }

    function emitSelectionPlaybackEvents(playbackEvents, meta, cardStateValue) {
        if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return false;
        const presentationHelper = resolvePresentationHelper();
        if (!presentationHelper || typeof presentationHelper.emitPresentationEvent !== 'function') return false;
        try {
            return presentationHelper.emitPresentationEvent(cardStateValue || (root ? root.cardState : null), {
                type: 'PLAYBACK_EVENTS',
                events: playbackEvents,
                meta: (meta && typeof meta === 'object') ? meta : {}
            }) === true;
        } catch (e) {
            return false;
        }
    }

    function shouldSuppressBoardExpansionRevealSound(playbackEvents) {
        if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return false;
        return playbackEvents.some((event) => {
            if (!event || event.type !== 'move' || !Array.isArray(event.targets)) return false;
            return event.targets.some((target) => normalizePendingType(target && target.cause) === 'CELL_TELEPORT_WILL');
        });
    }

    function armSelectionBoardUpdateContext(playbackEvents) {
        if (!shouldSuppressBoardExpansionRevealSound(playbackEvents)) return false;

        const context = {
            source: 'selection-flow',
            reason: 'pre_playback_state_sync',
            suppressBoardExpansionRevealSound: true
        };

        const playbackState = getPlaybackStateManager();
        if (playbackState && typeof playbackState.armBoardUpdateContext === 'function') {
            try {
                playbackState.armBoardUpdateContext(context);
                return true;
            } catch (e) { /* ignore */ }
        }

        setRootFlag('__suppressNextBoardExpansionRevealSound', true);
        return true;
    }

    function emitSelectionStateChangeSignals(playbackEvents) {
        armSelectionBoardUpdateContext(playbackEvents);
        const signalNames = ['emitCardStateChange', 'emitBoardUpdate', 'emitGameStateChange'];
        for (let index = 0; index < signalNames.length; index += 1) {
            const signalFn = resolveRootFunction(signalNames[index]);
            if (typeof signalFn !== 'function') continue;
            try { signalFn(); } catch (e) { /* ignore */ }
        }
    }

    function buildPendingTypeAllowList(options, fallbackPendingType) {
        const opts = (options && typeof options === 'object') ? options : {};
        const list = Array.isArray(opts.pendingTypes)
            ? opts.pendingTypes.slice()
            : (typeof opts.pendingType === 'string' && opts.pendingType ? [opts.pendingType] : []);
        if (typeof fallbackPendingType === 'string' && fallbackPendingType) {
            list.push(fallbackPendingType);
        }
        return Array.from(new Set(list.map(normalizePendingType).filter((value) => !!value)));
    }

    function getSelectionPending(playerKey, options) {
        const normalizedPlayerKey = normalizeSelectionPlayerKey(playerKey);
        const opts = (options && typeof options === 'object') ? options : {};
        const pendingByPlayer = root && root.cardState && root.cardState.pendingEffectByPlayer;
        const pending = pendingByPlayer && pendingByPlayer[normalizedPlayerKey];
        if (!pending || typeof pending !== 'object') {
            return { pending: null, pendingType: null };
        }
        const pendingType = normalizePendingType(pending.type);
        const allowList = buildPendingTypeAllowList(opts, pendingType);
        const requiredStage = typeof opts.stage === 'string' && opts.stage
            ? opts.stage
            : 'selectTarget';
        if (requiredStage && pending.stage !== requiredStage) {
            return { pending: null, pendingType };
        }
        if (allowList.length > 0 && allowList.indexOf(pendingType) === -1) {
            return { pending: null, pendingType };
        }
        return { pending, pendingType };
    }

    function defaultSelectionHandoffRender() {
        const emitBoardUpdate = resolveRootFunction('emitBoardUpdate');
        if (typeof emitBoardUpdate !== 'function') return;
        try { emitBoardUpdate(); } catch (e) { /* ignore */ }
    }

    async function executePendingSelection(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const row = Number(opts.row);
        const col = Number(opts.col);
        const playerKey = normalizeSelectionPlayerKey(opts.playerKey);
        const actionType = typeof opts.actionType === 'string' && opts.actionType
            ? opts.actionType
            : 'place';

        if ((root && root.isProcessing === true) || (root && root.isCardAnimating === true)) {
            return { ok: false, reason: 'busy' };
        }

        setSelectionBusy(true);

        let shouldFinalize = false;
        let resolvedPendingType = null;
        let pendingAction = null;
        let playbackEvents = [];
        let executionResult = null;
        let appliedSelection = null;

        try {
            const pendingInfo = getSelectionPending(playerKey, opts);
            const pending = pendingInfo.pending;
            resolvedPendingType = pendingInfo.pendingType;
            if (!pending || !resolvedPendingType) {
                return { ok: false, reason: 'pending_unavailable' };
            }

            const baseContext = {
                row,
                col,
                playerKey,
                pending,
                pendingType: resolvedPendingType,
                cardState: root ? root.cardState : null,
                gameState: root ? root.gameState : null
            };

            if (typeof opts.beforeRun === 'function') {
                const beforeRunResult = await opts.beforeRun(baseContext);
                if (beforeRunResult === false) {
                    return { ok: false, reason: 'before_run_rejected' };
                }
            }

            const actionPayload = (typeof opts.buildActionPayload === 'function')
                ? (await opts.buildActionPayload(baseContext))
                : Object.assign({}, opts.actionPayload || {});
            const normalizedActionPayload = (actionPayload && typeof actionPayload === 'object')
                ? actionPayload
                : {};

            pendingAction = createPendingSelectionAction(playerKey, resolvedPendingType, normalizedActionPayload, {
                cardState: root ? root.cardState : null,
                actionType
            });

            if (shouldUseNetworkPublishOnlyPendingSelection(resolvedPendingType)) {
                const publishResult = await Promise.resolve(publishPendingSelectionSnapshot({
                    playerKey,
                    actionType,
                    action: pendingAction,
                    playbackEvents: []
                }));
                if (!publishResult || publishResult.ok !== true) {
                    return {
                        ok: false,
                        reason: 'network_publish_failed',
                        result: publishResult || { ok: false, reason: 'NETWORK_PUBLISH_FAILED' }
                    };
                }
                return {
                    ok: true,
                    pendingType: resolvedPendingType,
                    action: pendingAction,
                    result: publishResult,
                    appliedSelection: true,
                    playbackEvents: [],
                    publishedByNetwork: true
                };
            }

            const adapter = resolveTurnPipelineUIAdapter();
            const pipeline = resolveTurnPipeline();
            executionResult = (adapter && pipeline && typeof adapter.runTurnWithAdapter === 'function')
                ? adapter.runTurnWithAdapter(root ? root.cardState : null, root ? root.gameState : null, playerKey, pendingAction, pipeline)
                : null;

            if (!executionResult || executionResult.ok === false) {
                emitSelectionMessage(opts.invalidMessage, Object.assign({}, baseContext, {
                    action: pendingAction,
                    result: executionResult
                }));
                return {
                    ok: false,
                    reason: 'selection_rejected',
                    result: executionResult
                };
            }

            appliedSelection = (typeof opts.validateResult === 'function')
                ? (await opts.validateResult(Object.assign({}, baseContext, {
                    action: pendingAction,
                    result: executionResult
                })))
                : true;

            if (!appliedSelection) {
                emitSelectionMessage(opts.invalidMessage, Object.assign({}, baseContext, {
                    action: pendingAction,
                    result: executionResult
                }));
                return {
                    ok: false,
                    reason: 'selection_not_applied',
                    result: executionResult
                };
            }

            const appliedState = applySelectionStateResult(executionResult);
            playbackEvents = Array.isArray(executionResult.playbackEvents)
                ? executionResult.playbackEvents
                : [];
            const suppressLocalPlayback = shouldSuppressLocalPlaybackForDeferredNetworkSelection(resolvedPendingType);
            if (suppressLocalPlayback) {
                playbackEvents = [];
            }

            const liveContext = Object.assign({}, baseContext, {
                action: pendingAction,
                result: executionResult,
                appliedSelection,
                cardState: appliedState.cardState,
                gameState: appliedState.gameState,
                playbackEvents
            });

            if (!suppressLocalPlayback) {
                const playbackMeta = (typeof opts.buildPlaybackMeta === 'function')
                    ? opts.buildPlaybackMeta(liveContext)
                    : { cause: resolvedPendingType, target: { row, col } };
                emitSelectionPlaybackEvents(playbackEvents, playbackMeta, appliedState.cardState);
            }

            if (opts.emitStateChanges !== false) {
                emitSelectionStateChangeSignals(playbackEvents);
            }

            if (typeof opts.afterStateChange === 'function') {
                await opts.afterStateChange(liveContext);
            }

            shouldFinalize = true;
            return {
                ok: true,
                pendingType: resolvedPendingType,
                action: pendingAction,
                result: executionResult,
                appliedSelection,
                playbackEvents
            };
        } finally {
            if (shouldFinalize) {
                try {
                    const finalizeOptions = Object.assign({
                        playerKey,
                        pendingType: resolvedPendingType,
                        actionType,
                        action: pendingAction,
                        playbackEvents,
                        gameStateValue: root ? root.gameState : null,
                        cardStateValue: root ? root.cardState : null,
                        onHumanTurnReady: defaultSelectionHandoffRender,
                        ensureCurrentPlayerCanActOrPass: resolveRootFunction('ensureCurrentPlayerCanActOrPass')
                    }, (opts.finalizeOptions && typeof opts.finalizeOptions === 'object') ? opts.finalizeOptions : {});
                    await finalizePendingSelectionFlow(finalizeOptions);
                } catch (e) {
                    setSelectionBusy(false);
                    const ensureFn = resolveRootFunction('ensureCurrentPlayerCanActOrPass');
                    if (typeof ensureFn === 'function') {
                        try { ensureFn({ useBlackDelay: true }); } catch (ignore) { /* ignore */ }
                    }
                }
            } else {
                setSelectionBusy(false);
            }
        }
    }

    return {
        PENDING_SELECTION_CONTRACTS,
        resolvePendingSelectionContract,
        isSelectionOnlyEndTurnPendingType,
        shouldDeferNetworkPublishForPendingType,
        shouldWaitForPlaybackIdleForPendingType,
        setSelectionProcessing,
        setSelectionCardAnimating,
        setSelectionBusy,
        createPendingSelectionAction,
        readPendingSelectionAction,
        syncPendingSelectionActionCache,
        waitForSelectionPlaybackIdle,
        finalizePendingSelectionFlow,
        applySelectionStateResult,
        emitSelectionPlaybackEvents,
        executePendingSelection,
        capturePendingSelectionSnapshot,
        publishPendingSelectionSnapshot
    };
}));

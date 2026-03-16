(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(root || globalThis);
    } else {
        root.NetworkTurnHandoff = factory(root);
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    let networkActionSchema = null;

    function cloneData(value) {
        try {
            if (root && typeof root.structuredClone === 'function') {
                return root.structuredClone(value);
            }
        } catch (e) { /* ignore */ }
        return JSON.parse(JSON.stringify(value));
    }

    function resolveNetworkActionSchema() {
        if (networkActionSchema && typeof networkActionSchema === 'object') {
            return networkActionSchema;
        }

        if (typeof require === 'function') {
            try { networkActionSchema = require('../shared/network-action-schema'); } catch (e) { /* ignore */ }
        }
        if (!networkActionSchema && root && root.NetworkActionSchema) {
            networkActionSchema = root.NetworkActionSchema;
        }
        return networkActionSchema;
    }

    function normalizeActionType(value, fallback) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized) return normalized;
        return String(fallback || '').trim().toLowerCase();
    }

    function shouldUseCommandPublish(meta) {
        const payload = (meta && typeof meta === 'object') ? meta : {};
        const action = (payload.action && typeof payload.action === 'object') ? payload.action : null;
        const actionType = normalizeActionType(payload.actionType || (action && (action.type || action.actionType)), '');

        if (action) {
            const schema = resolveNetworkActionSchema();
            if (schema && typeof schema.shouldUseCommandPayload === 'function') {
                try {
                    return !!schema.shouldUseCommandPayload(action);
                } catch (e) { /* ignore */ }
            }
            return !!actionType && actionType !== 'action';
        }

        return actionType === 'reset_game' || actionType === 'rematch' || actionType === 'restart';
    }

    function buildPublishMeta(meta) {
        const payload = (meta && typeof meta === 'object') ? Object.assign({}, meta) : {};
        const action = (payload.action && typeof payload.action === 'object') ? payload.action : null;
        const actionType = normalizeActionType(payload.actionType || (action && (action.type || action.actionType)), '');

        if (actionType) {
            payload.actionType = actionType;
        }
        if (shouldUseCommandPublish(payload)) {
            delete payload.snapshot;
        }
        return payload;
    }

    function captureNetworkPublishSnapshot(gameStateValue, cardStateValue) {
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

    function publishNetworkSnapshot(meta) {
        try {
            if (!root || !root.NetworkMatchClient) return;
            if (typeof root.NetworkMatchClient.publishSnapshot !== 'function') return;
            if (typeof root.NetworkMatchClient.isActive === 'function' && !root.NetworkMatchClient.isActive()) return;
            return root.NetworkMatchClient.publishSnapshot(buildPublishMeta(meta));
        } catch (e) { /* ignore */ }
        return undefined;
    }

    function resolvePlayerKeyFromTurnValue(value) {
        const normalized = (value === null || typeof value === 'undefined')
            ? ''
            : String(value).trim().toLowerCase();
        if (normalized === 'white' || normalized === '-1') return 'white';
        if (normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
        if (value === -1) return 'white';
        if (value === 1) return 'black';
        return 'black';
    }

    async function waitForPlaybackIdleIfNeeded(playbackEvents) {
        if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return;

        const waitForPlaybackFn = (typeof root.waitForPlaybackIdle === 'function')
            ? root.waitForPlaybackIdle
            : null;

        if (typeof waitForPlaybackFn !== 'function') return;

        try {
            await waitForPlaybackFn();
        } catch (e) { /* ignore */ }
    }

    function readCurrentGameState() {
        return (root && root.gameState && typeof root.gameState === 'object') ? root.gameState : null;
    }

    function readCurrentTurnNumber() {
        const gameStateRef = readCurrentGameState();
        return (gameStateRef && Number.isFinite(Number(gameStateRef.turnNumber)))
            ? Number(gameStateRef.turnNumber)
            : null;
    }

    function isGameOverNow(customIsGameOver) {
        const gameStateRef = readCurrentGameState();
        const isGameOverFn = (typeof customIsGameOver === 'function')
            ? customIsGameOver
            : ((root && typeof root.isGameOver === 'function') ? root.isGameOver : null);
        if (!gameStateRef || typeof isGameOverFn !== 'function') return false;
        try {
            return !!isGameOverFn(gameStateRef);
        } catch (e) {
            return false;
        }
    }

    function showResultIfAvailable(customShowResult) {
        const showResultFn = (typeof customShowResult === 'function')
            ? customShowResult
            : ((root && typeof root.showResult === 'function') ? root.showResult : null);
        if (typeof showResultFn !== 'function') return;
        try {
            showResultFn();
        } catch (e) { /* ignore */ }
    }

    async function finalizeNetworkTurnHandoff(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const basePlaybackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents.slice() : [];
        const publishSnapshotFn = (typeof opts.publishSnapshot === 'function') ? opts.publishSnapshot : publishNetworkSnapshot;
        const setProcessing = (typeof opts.setProcessing === 'function') ? opts.setProcessing : null;
        const actionType = opts.actionType || 'place';
        const action = (opts.action && typeof opts.action === 'object') ? opts.action : null;
        const playerKey = opts.playerKey || 'black';
        const snapshotOverride = opts.snapshot || null;
        const resultOrder = opts.resultOrder === 'beforePublish' ? 'beforePublish' : 'afterPublish';
        const turnStartFn = (typeof opts.onTurnStart === 'function')
            ? opts.onTurnStart
            : ((root && typeof root.onTurnStart === 'function') ? root.onTurnStart : null);
        const resolveCurrentPlayerKey = (typeof opts.resolveCurrentPlayerKey === 'function')
            ? opts.resolveCurrentPlayerKey
            : function defaultResolveCurrentPlayerKey() {
                const gameStateRef = readCurrentGameState();
                return resolvePlayerKeyFromTurnValue(gameStateRef ? gameStateRef.currentPlayer : null);
            };
        const onHumanTurnReady = (typeof opts.onHumanTurnReady === 'function') ? opts.onHumanTurnReady : null;
        const scheduleCpuTurn = (typeof opts.scheduleCpuTurn === 'function') ? opts.scheduleCpuTurn : null;
        const cpuDelayMs = Number.isFinite(Number(opts.cpuDelayMs))
            ? Math.max(0, Math.trunc(Number(opts.cpuDelayMs)))
            : ((root && Number.isFinite(Number(root.CPU_TURN_DELAY_MS))) ? Math.max(0, Math.trunc(Number(root.CPU_TURN_DELAY_MS))) : 600);

        if (isGameOverNow(opts.isGameOver)) {
            if (resultOrder === 'beforePublish') showResultIfAvailable(opts.showResult);
            publishSnapshotFn(buildPublishMeta({
                playerKey,
                actionType,
                action,
                playbackEvents: basePlaybackEvents,
                snapshot: snapshotOverride
            }));
            if (resultOrder !== 'beforePublish') showResultIfAvailable(opts.showResult);
            if (setProcessing) setProcessing(false);
            return {
                ok: true,
                gameOver: true,
                scheduledCpu: false,
                nextPlayerKey: resolveCurrentPlayerKey(),
                playbackEvents: basePlaybackEvents,
                turnStartPlaybackEvents: []
            };
        }

        // Single Writer: network モードではローカル playback がないため wait 不要
        if (!opts.skipLocalPlaybackWait) {
            await waitForPlaybackIdleIfNeeded(basePlaybackEvents);
        }

        let turnStartPlaybackEvents = [];
        if (typeof turnStartFn === 'function') {
            const gameStateRef = readCurrentGameState();
            const turnStartResult = await turnStartFn(gameStateRef ? gameStateRef.currentPlayer : null);
            if (turnStartResult && Array.isArray(turnStartResult.playbackEvents)) {
                turnStartPlaybackEvents = turnStartResult.playbackEvents.slice();
            }
        }

        const combinedPlaybackEvents = basePlaybackEvents.slice();
        if (turnStartPlaybackEvents.length > 0) {
            combinedPlaybackEvents.push(...turnStartPlaybackEvents);
        }

        if (typeof opts.afterTurnStart === 'function') {
            await opts.afterTurnStart({
                playbackEvents: combinedPlaybackEvents.slice(),
                turnStartPlaybackEvents: turnStartPlaybackEvents.slice(),
                snapshot: snapshotOverride
            });
        }

        publishSnapshotFn(buildPublishMeta({
            playerKey,
            actionType,
            action,
            playbackEvents: combinedPlaybackEvents,
            snapshot: snapshotOverride
        }));

        if (opts.checkGameOverAfterTurnStart !== false && isGameOverNow(opts.isGameOver)) {
            showResultIfAvailable(opts.showResult);
            if (setProcessing) setProcessing(false);
            return {
                ok: true,
                gameOver: true,
                scheduledCpu: false,
                nextPlayerKey: resolveCurrentPlayerKey(),
                playbackEvents: combinedPlaybackEvents,
                turnStartPlaybackEvents
            };
        }

        const nextPlayerKey = resolveCurrentPlayerKey();
        const humanMode = !!opts.humanMode;
        if (nextPlayerKey === 'white' && !humanMode && scheduleCpuTurn) {
            if (setProcessing) setProcessing(true);
            scheduleCpuTurn({
                delayMs: cpuDelayMs,
                expectedTurnNumber: readCurrentTurnNumber(),
                nextPlayerKey
            });
            return {
                ok: true,
                gameOver: false,
                scheduledCpu: true,
                nextPlayerKey,
                playbackEvents: combinedPlaybackEvents,
                turnStartPlaybackEvents
            };
        }

        if (setProcessing) setProcessing(false);
        if (onHumanTurnReady) {
            onHumanTurnReady({ nextPlayerKey, scheduledCpu: false });
        }

        return {
            ok: true,
            gameOver: false,
            scheduledCpu: false,
            nextPlayerKey,
            playbackEvents: combinedPlaybackEvents,
            turnStartPlaybackEvents
        };
    }

    return {
        captureNetworkPublishSnapshot,
        publishNetworkSnapshot,
        waitForPlaybackIdleIfNeeded,
        finalizeNetworkTurnHandoff,
        resolvePlayerKeyFromTurnValue
    };
}));
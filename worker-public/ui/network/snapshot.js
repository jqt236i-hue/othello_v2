(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.NetworkSnapshotModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function createNetworkSnapshotController(config) {
        const cfg = (config && typeof config === 'object') ? config : {};
        const rootRef = cfg.root || (typeof globalThis !== 'undefined' ? globalThis : null);
        const snapshotRuntimeModule = (() => {
            try {
                if (rootRef && rootRef.NetworkSnapshotRuntimeModule) {
                    return rootRef.NetworkSnapshotRuntimeModule;
                }
            } catch (e) { /* ignore */ }

            try {
                if (typeof globalThis !== 'undefined' && globalThis.NetworkSnapshotRuntimeModule) {
                    return globalThis.NetworkSnapshotRuntimeModule;
                }
            } catch (e) { /* ignore */ }

            try {
                if (typeof require === 'function') {
                    return require('./snapshot-runtime');
                }
            } catch (e) { /* ignore */ }

            return null;
        })();
        const runtime = (
            snapshotRuntimeModule
            && typeof snapshotRuntimeModule.createNetworkSnapshotRuntime === 'function'
        )
            ? snapshotRuntimeModule.createNetworkSnapshotRuntime(cfg)
            : null;

        function resolveState() {
            if (runtime && typeof runtime.resolveState === 'function') {
                return runtime.resolveState();
            }
            return (typeof cfg.getState === 'function' && cfg.getState()) || {};
        }

        function resolveGlobalObject(name) {
            if (runtime && typeof runtime.resolveObject === 'function') {
                return runtime.resolveObject(name);
            }
            return null;
        }

        function resolveGlobalFunction(name, injected) {
            if (runtime && typeof runtime.resolveFunction === 'function') {
                return runtime.resolveFunction(name, injected);
            }
            if (typeof injected === 'function') return injected;
            return null;
        }

        function setGlobalFlag(name, value) {
            if (runtime && typeof runtime.setGlobalFlag === 'function') {
                runtime.setGlobalFlag(name, value);
            }
        }

        function setGlobalValue(name, value) {
            if (runtime && typeof runtime.setGlobalValue === 'function') {
                runtime.setGlobalValue(name, value);
            }
        }

        function resolvePlaybackStateModule() {
            if (runtime && typeof runtime.resolvePlaybackStateModule === 'function') {
                return runtime.resolvePlaybackStateModule();
            }
            return null;
        }

        function resolveBoardUpdateDispatch() {
            if (runtime && typeof runtime.resolveBoardUpdateDispatch === 'function') {
                return runtime.resolveBoardUpdateDispatch();
            }
            return null;
        }

        function resolveBoardUpdateSyncRuntime() {
            if (runtime && typeof runtime.resolveBoardUpdateSyncRuntime === 'function') {
                return runtime.resolveBoardUpdateSyncRuntime();
            }
            return null;
        }

        function resolveSharedBoardUtils() {
            if (runtime && typeof runtime.resolveSharedBoardUtils === 'function') {
                return runtime.resolveSharedBoardUtils();
            }
            return null;
        }

        function setBusyState(active) {
            if (runtime && typeof runtime.setBusyState === 'function') {
                return runtime.setBusyState(active);
            }
            return false;
        }

        function clearBusyStateAndPlaybackLock() {
            if (runtime && typeof runtime.clearBusyStateAndPlaybackLock === 'function') {
                runtime.clearBusyStateAndPlaybackLock();
            }

            try {
                if (typeof document !== 'undefined') {
                    const board = document.getElementById('board');
                    if (board && board.classList && typeof board.classList.remove === 'function') {
                        board.classList.remove('playback-locked');
                    }
                }
            } catch (e) { /* ignore */ }
            return true;
        }

        function cloneData(value) {
            try {
                if (typeof globalThis !== 'undefined' && typeof globalThis.structuredClone === 'function') {
                    return globalThis.structuredClone(value);
                }
            } catch (e) { /* ignore */ }
            return JSON.parse(JSON.stringify(value));
        }

        function normalizeSeatKey(value) {
            const normalized = String(value || '').trim().toLowerCase();
            if (normalized === 'black' || normalized === 'white') return normalized;
            return null;
        }

        function getSnapshotMeta(snapshot) {
            if (!snapshot || typeof snapshot !== 'object' || !snapshot._meta || typeof snapshot._meta !== 'object') {
                return null;
            }
            const meta = snapshot._meta;
            const rawVersion = meta.version;
            return {
                authority: String(meta.authority || '').trim().toLowerCase(),
                version: (rawVersion === null || typeof rawVersion === 'undefined' || (typeof rawVersion === 'string' && rawVersion.trim() === ''))
                    ? null
                    : (Number.isFinite(Number(rawVersion)) ? Number(rawVersion) : null),
                projectedForSeat: normalizeSeatKey(meta.projectedForSeat),
                turnStartReconciled: meta.turnStartReconciled !== false
            };
        }

        function getSnapshotVersion(snapshot) {
            const meta = getSnapshotMeta(snapshot);
            if (meta && meta.version !== null) return meta.version;
            return Number.isFinite(Number(snapshot && snapshot.stateVersion))
                ? Number(snapshot.stateVersion)
                : null;
        }

        function shouldRejectSnapshotByAuthority(snapshot, state, opts) {
            const meta = getSnapshotMeta(snapshot);
            if (!meta) {
                emitTelemetry('snapshot_authority_metadata_missing', {
                    force: opts && opts.force === true
                });
                return true;
            }
            if (meta.authority !== 'server') {
                emitTelemetry('snapshot_authority_rejected', {
                    authority: meta.authority || null
                });
                return true;
            }
            const localSeatKey = normalizeSeatKey(state && state.seatKey);
            if (meta.projectedForSeat && localSeatKey && meta.projectedForSeat !== localSeatKey) {
                emitTelemetry('snapshot_projection_mismatch_rejected', {
                    projectedForSeat: meta.projectedForSeat,
                    localSeatKey
                });
                return true;
            }
            return false;
        }

        function normalizeChargeValue(value) {
            return Number.isFinite(Number(value))
                ? Math.trunc(Number(value))
                : 0;
        }

        function normalizeChargePlayerKey(value) {
            return (value === 'white' || value === -1 || value === '-1')
                ? 'white'
                : 'black';
        }

        function normalizeChargeState(charge) {
            const nextCharge = (charge && typeof charge === 'object')
                ? Object.assign({}, charge)
                : {};
            nextCharge.black = normalizeChargeValue(nextCharge.black);
            nextCharge.white = normalizeChargeValue(nextCharge.white);
            return nextCharge;
        }

        function normalizeChargeDeltaEvent(event, fallbackSeq) {
            if (!event || typeof event !== 'object') return null;
            const nextEvent = Object.assign({}, event);
            nextEvent.seq = Number.isFinite(Number(nextEvent.seq))
                ? Math.trunc(Number(nextEvent.seq))
                : fallbackSeq;
            nextEvent.player = normalizeChargePlayerKey(nextEvent.player);
            nextEvent.before = normalizeChargeValue(nextEvent.before);
            nextEvent.after = normalizeChargeValue(nextEvent.after);
            nextEvent.delta = Number.isFinite(Number(nextEvent.delta))
                ? normalizeChargeValue(nextEvent.delta)
                : (nextEvent.after - nextEvent.before);
            const popupKind = String(nextEvent.popupKind || '').trim().toLowerCase();
            const sourceType = (typeof nextEvent.sourceType === 'string') ? nextEvent.sourceType.trim() : '';
            if (popupKind === 'board') {
                const anchorRow = Number(nextEvent.anchorRow);
                const anchorCol = Number(nextEvent.anchorCol);
                if (Number.isFinite(anchorRow) && Number.isFinite(anchorCol)) {
                    nextEvent.popupKind = 'board';
                    nextEvent.anchorRow = Math.trunc(anchorRow);
                    nextEvent.anchorCol = Math.trunc(anchorCol);
                    if (sourceType) nextEvent.sourceType = sourceType;
                    else delete nextEvent.sourceType;
                } else {
                    delete nextEvent.popupKind;
                    delete nextEvent.anchorRow;
                    delete nextEvent.anchorCol;
                    delete nextEvent.sourceType;
                }
            } else {
                delete nextEvent.popupKind;
                delete nextEvent.anchorRow;
                delete nextEvent.anchorCol;
                delete nextEvent.sourceType;
            }
            return nextEvent;
        }

        function normalizeChargeDeltaEventList(events) {
            if (!Array.isArray(events)) return [];
            const normalizedEvents = [];
            for (let index = 0; index < events.length; index += 1) {
                const normalizedEvent = normalizeChargeDeltaEvent(events[index], index + 1);
                if (normalizedEvent) normalizedEvents.push(normalizedEvent);
            }
            return normalizedEvents;
        }

        function normalizeChargeDataForSnapshot(cardState) {
            if (!cardState || typeof cardState !== 'object') return cardState;
            cardState.charge = normalizeChargeState(cardState.charge);
            cardState.chargeDeltaEvents = normalizeChargeDeltaEventList(cardState.chargeDeltaEvents);
            return cardState;
        }

        function buildMissingChargeDeltaEvents(previousCardState, nextCardState, options) {
            const opts = (options && typeof options === 'object') ? options : {};
            if (opts.force === true) return [];
            if (!nextCardState || typeof nextCardState !== 'object') return [];
            if (Array.isArray(nextCardState.chargeDeltaEvents) && nextCardState.chargeDeltaEvents.length > 0) return [];

            const previousCharge = (previousCardState && previousCardState.charge && typeof previousCardState.charge === 'object')
                ? previousCardState.charge
                : null;
            const nextCharge = (nextCardState.charge && typeof nextCardState.charge === 'object')
                ? nextCardState.charge
                : null;
            if (!previousCharge || !nextCharge) return [];

            const events = [];
            let seq = 1;
            const playerKeys = ['black', 'white'];
            for (let index = 0; index < playerKeys.length; index += 1) {
                const playerKey = playerKeys[index];
                const before = normalizeChargeValue(previousCharge[playerKey]);
                const after = normalizeChargeValue(nextCharge[playerKey]);
                const delta = after - before;
                if (delta === 0) continue;
                events.push({
                    seq,
                    player: playerKey,
                    before,
                    after,
                    delta,
                    reason: 'network_snapshot_charge_sync'
                });
                seq += 1;
            }
            return events;
        }

        function setTransientChargeDeltaEvents(events) {
            const nextEvents = normalizeChargeDeltaEventList(Array.isArray(events)
                ? cloneData(events)
                : []);
            setGlobalValue('__networkTransientChargeDeltaEvents', nextEvents);
        }

        function emitTelemetry(type, details) {
            if (typeof cfg.onTelemetry !== 'function') return;
            try {
                cfg.onTelemetry(type, details || {});
            } catch (e) { /* ignore */ }
        }

        function readBoardGeometry(value) {
            const boardUtils = resolveSharedBoardUtils();
            if (boardUtils && typeof boardUtils.readBoardGeometry === 'function') {
                try {
                    return boardUtils.readBoardGeometry(value);
                } catch (e) { /* ignore */ }
            }
            return null;
        }

        function compareBoardGeometry(previousValue, nextValue) {
            const boardUtils = resolveSharedBoardUtils();
            if (boardUtils && typeof boardUtils.compareBoardGeometry === 'function') {
                try {
                    return boardUtils.compareBoardGeometry(previousValue, nextValue);
                } catch (e) { /* ignore */ }
            }
            const previous = readBoardGeometry(previousValue);
            const next = readBoardGeometry(nextValue);
            return {
                previous,
                next,
                changed: !!(
                    previous
                    && next
                    && (previous.rows !== next.rows || previous.cols !== next.cols)
                )
            };
        }

        function sanitizeIncomingSnapshot(snapshot) {
            if (!snapshot || typeof snapshot !== 'object') {
                return { ok: false, reason: 'invalid_snapshot' };
            }
            if (!snapshot.gameState || typeof snapshot.gameState !== 'object') {
                return { ok: false, reason: 'invalid_game_state' };
            }
            if (!snapshot.cardState || typeof snapshot.cardState !== 'object') {
                return { ok: false, reason: 'invalid_card_state' };
            }

            const gameState = snapshot.gameState;
            const cardState = snapshot.cardState;
            const liveQueueCount = Array.isArray(cardState.presentationEvents) ? cardState.presentationEvents.length : 0;
            const persistentQueueCount = Array.isArray(cardState._presentationEventsPersist) ? cardState._presentationEventsPersist.length : 0;
            const hadCurrentActionMeta = Object.prototype.hasOwnProperty.call(cardState, '_currentActionMeta');
            const hadResultShown = Object.prototype.hasOwnProperty.call(gameState, '__resultShown');

            if (liveQueueCount > 0 || persistentQueueCount > 0 || hadCurrentActionMeta || hadResultShown) {
                emitTelemetry('snapshot_transient_state_stripped', {
                    liveQueueCount,
                    persistentQueueCount,
                    hadCurrentActionMeta,
                    hadResultShown
                });
            }

            cardState.presentationEvents = [];
            cardState._presentationEventsPersist = [];
            delete cardState._currentActionMeta;
            delete gameState.__resultShown;
            normalizeChargeDataForSnapshot(cardState);

            return { ok: true, snapshot };
        }

        function replaceObjectState(targetName, nextValue) {
            const source = cloneData(nextValue || {});
            const current = resolveGlobalObject(targetName);
            if (current && typeof current === 'object') {
                for (const key in current) {
                    delete current[key];
                }
                Object.assign(current, source);
                return;
            }
            setGlobalValue(targetName, source);
        }

        function emitPlaybackEvents(playbackEvents, options) {
            if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return;
            const opts = (options && typeof options === 'object') ? options : {};
            const boardOps = resolveGlobalObject('BoardOps') || {};
            const cardStateRef = resolveGlobalObject('cardState');
            try {
                if (boardOps && typeof boardOps.emitPresentationEvent === 'function') {
                    boardOps.emitPresentationEvent(cardStateRef, {
                        type: 'PLAYBACK_EVENTS',
                        events: playbackEvents,
                        meta: {
                            source: opts.source || 'network_snapshot',
                            suppressPlayback: opts.suppressPlayback === true
                        }
                    });
                }
            } catch (e) { /* ignore */ }
        }

        function clearTransientPresentationQueues(cardStateRef) {
            if (!cardStateRef || typeof cardStateRef !== 'object') return;
            if (!Array.isArray(cardStateRef.presentationEvents)) cardStateRef.presentationEvents = [];
            else cardStateRef.presentationEvents.length = 0;
            if (!Array.isArray(cardStateRef._presentationEventsPersist)) cardStateRef._presentationEventsPersist = [];
            else cardStateRef._presentationEventsPersist.length = 0;
        }

        function captureTransientPresentationQueues(cardStateRef) {
            if (!cardStateRef || typeof cardStateRef !== 'object') {
                return {
                    presentationEvents: [],
                    persistentEvents: [],
                    hasPending: false
                };
            }

            const presentationEvents = Array.isArray(cardStateRef.presentationEvents)
                ? cloneData(cardStateRef.presentationEvents)
                : [];
            const persistentEvents = Array.isArray(cardStateRef._presentationEventsPersist)
                ? cloneData(cardStateRef._presentationEventsPersist)
                : [];

            return {
                presentationEvents,
                persistentEvents,
                hasPending: presentationEvents.length > 0 || persistentEvents.length > 0
            };
        }

        function restoreTransientPresentationQueues(cardStateRef, queues) {
            if (!cardStateRef || typeof cardStateRef !== 'object') return;
            const source = queues && typeof queues === 'object' ? queues : {};
            cardStateRef.presentationEvents = Array.isArray(source.presentationEvents)
                ? source.presentationEvents.slice()
                : [];
            cardStateRef._presentationEventsPersist = Array.isArray(source.persistentEvents)
                ? source.persistentEvents.slice()
                : [];
        }

        function getTransientPresentationQueueSignature(source) {
            const ref = (source && typeof source === 'object') ? source : {};
            const presentationEvents = Array.isArray(ref.presentationEvents)
                ? ref.presentationEvents
                : [];
            const persistentEvents = Array.isArray(ref.persistentEvents)
                ? ref.persistentEvents
                : (Array.isArray(ref._presentationEventsPersist) ? ref._presentationEventsPersist : []);

            try {
                return JSON.stringify({
                    presentationEvents,
                    persistentEvents
                });
            } catch (e) {
                return null;
            }
        }

        function isVisualPlaybackActive() {
            const playbackState = resolvePlaybackStateModule();
            try {
                if (playbackState && typeof playbackState.getPlaybackActive === 'function') {
                    return playbackState.getPlaybackActive() === true;
                }
            } catch (e) { /* ignore */ }
            return false;
        }

        function hasPendingPresentationEvents(source) {
            const playbackState = resolvePlaybackStateModule();
            if (playbackState && typeof playbackState.hasPendingPresentationEvents === 'function') {
                return playbackState.hasPendingPresentationEvents(source);
            }
            const ref = (source && typeof source === 'object') ? source : {};
            const pendingPersist = Array.isArray(ref._presentationEventsPersist) ? ref._presentationEventsPersist.length > 0 : false;
            const pendingLive = Array.isArray(ref.presentationEvents) ? ref.presentationEvents.length > 0 : false;
            return pendingPersist || pendingLive;
        }

        function readBusyStateSnapshot() {
            const playbackState = resolvePlaybackStateModule();
            let processing = false;
            let cardAnimating = false;

            try {
                if (playbackState && typeof playbackState.getProcessing === 'function') {
                    processing = playbackState.getProcessing() === true;
                }
            } catch (e) { /* ignore */ }

            try {
                if (playbackState && typeof playbackState.getCardAnimating === 'function') {
                    cardAnimating = playbackState.getCardAnimating() === true;
                }
            } catch (e) { /* ignore */ }

            return {
                processing,
                cardAnimating,
                playbackActive: isVisualPlaybackActive()
            };
        }

        function getPlaybackStartedAt() {
            if (runtime && typeof runtime.getPlaybackStartedAt === 'function') {
                return runtime.getPlaybackStartedAt();
            }
            return null;
        }

        function isPlaybackEngineRunning() {
            if (runtime && typeof runtime.isPlaybackEngineRunning === 'function') {
                return runtime.isPlaybackEngineRunning();
            }
            return null;
        }

        function getStalePlaybackTimeoutMs() {
            if (runtime && typeof runtime.getStalePlaybackTimeoutMs === 'function') {
                return runtime.getStalePlaybackTimeoutMs();
            }
            return 3500;
        }

        function reconcilePresentationQueues(cardStateRef, options) {
            const opts = (options && typeof options === 'object') ? options : {};
            const preservedQueues = opts.preservedQueues || {
                presentationEvents: [],
                persistentEvents: [],
                hasPending: false
            };
            const playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [];
            const shadowPlaybackEvents = Array.isArray(opts.shadowPlaybackEvents) ? opts.shadowPlaybackEvents : [];
            const dropPreservedQueues = opts.dropPreservedQueues === true;
            const hasPendingPreservedQueues = preservedQueues.hasPending === true;
            const hasPlaybackEvents = playbackEvents.length > 0;
            const shouldEmitShadowPlayback = !hasPlaybackEvents
                && (!hasPendingPreservedQueues || dropPreservedQueues)
                && shadowPlaybackEvents.length > 0;
            const restoredPreservedQueues = !hasPlaybackEvents
                && !shouldEmitShadowPlayback
                && hasPendingPreservedQueues
                && !dropPreservedQueues;

            if (hasPlaybackEvents || shouldEmitShadowPlayback || dropPreservedQueues) {
                clearTransientPresentationQueues(cardStateRef);
            } else if (restoredPreservedQueues) {
                restoreTransientPresentationQueues(cardStateRef, preservedQueues);
            } else {
                clearTransientPresentationQueues(cardStateRef);
            }

            return {
                hasPlaybackEvents,
                shouldEmitShadowPlayback,
                // Shadow playback with suppressPlayback=true returns immediately
                // without running AnimationEngine, so it should not keep busy.
                shouldKeepBusy: hasPlaybackEvents || (hasPendingPreservedQueues && !dropPreservedQueues),
                restoredPreservedQueues,
                restoredQueueSignature: restoredPreservedQueues
                    ? getTransientPresentationQueueSignature(preservedQueues)
                    : null
            };
        }

        function shouldReleaseRestoredQueueBusyState(cardStateRef, presentationState, busyStateBeforeSnapshot) {
            if (!presentationState || presentationState.restoredPreservedQueues !== true) return false;
            const hadBusyBeforeSnapshot = !!(
                busyStateBeforeSnapshot
                && (
                    busyStateBeforeSnapshot.processing === true
                    || busyStateBeforeSnapshot.cardAnimating === true
                    || busyStateBeforeSnapshot.playbackActive === true
                )
            );
            // If the system was already busy before this snapshot, only skip
            // the release when the animation engine is actively playing or
            // its state is unknown.  When the engine is provably idle, the
            // pre-existing busy flags are stale — fall through to the
            // signature / queue-consumption checks instead of bailing out
            // unconditionally.
            if (hadBusyBeforeSnapshot) {
                const enginePlaying = isPlaybackEngineRunning();
                if (enginePlaying !== false) return false;
                // enginePlaying === false: engine is definitely idle.
                // The pre-snapshot busy flags are stale; continue to the
                // queue-consumption checks below to decide release.
            }
            if (isVisualPlaybackActive()) return false;

            const currentQueues = captureTransientPresentationQueues(cardStateRef);
            if (!currentQueues.hasPending) return true;

            const currentSignature = getTransientPresentationQueueSignature(currentQueues);
            return !!presentationState.restoredQueueSignature
                && currentSignature === presentationState.restoredQueueSignature;
        }

        function shouldReleaseStalePlaybackLockAfterSnapshot(cardStateRef, presentationState) {
            if (!presentationState || presentationState.shouldKeepBusy === true) return false;
            if (isVisualPlaybackActive() !== true) return false;

            const currentQueues = captureTransientPresentationQueues(cardStateRef);
            if (currentQueues.hasPending) return false;

            const playbackRunning = isPlaybackEngineRunning();
            if (playbackRunning === false) return true;
            if (playbackRunning === true) return false;

            const startedAt = getPlaybackStartedAt();
            if (startedAt === null) return false;
            return (Date.now() - startedAt) > getStalePlaybackTimeoutMs();
        }

        function shouldReleaseUnclaimedPlaybackBusyState(cardStateRef, playbackEvents) {
            if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return false;
            if (isVisualPlaybackActive() === true) return false;

            const currentQueues = captureTransientPresentationQueues(cardStateRef);
            if (currentQueues.hasPending) return false;

            return isPlaybackEngineRunning() !== true;
        }

        function shouldClearUndrainedPlaybackQueues(cardStateRef, playbackEvents, options) {
            const opts = (options && typeof options === 'object') ? options : {};
            if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return false;
            // Force-applied same-version recovery intentionally keeps the batch
            // queued so later stream playback recovery can consume it once.
            if (opts.force === true) return false;
            if (isVisualPlaybackActive() === true) return false;
            if (isPlaybackEngineRunning() === true) return false;

            const currentQueues = captureTransientPresentationQueues(cardStateRef);
            if (!currentQueues.hasPending) return false;

            const queueEntries = []
                .concat(Array.isArray(currentQueues.presentationEvents) ? currentQueues.presentationEvents : [])
                .concat(Array.isArray(currentQueues.persistentEvents) ? currentQueues.persistentEvents : []);
            if (queueEntries.length === 0) return false;
            return queueEntries.every((entry) => entry && entry.type === 'PLAYBACK_EVENTS');
        }

        function hasPendingPlaybackOrPresentation() {
            const cardStateRef = resolveGlobalObject('cardState');
            try {
                const visualPlayback = isVisualPlaybackActive();
                return visualPlayback || hasPendingPresentationEvents(cardStateRef);
            } catch (e) {
                return isVisualPlaybackActive();
            }
        }

        function armBoardUpdateDuringPlayback(source, reason) {
            const runtime = resolveBoardUpdateSyncRuntime();
            if (!runtime || typeof runtime.armBoardUpdateSyncContext !== 'function') return false;
            try {
                return !!runtime.armBoardUpdateSyncContext({
                    allowBoardUpdateDuringPlayback: true,
                    source: source || 'network_snapshot',
                    reason: reason || 'snapshot_playback_board_sync'
                });
            } catch (e) {
                return false;
            }
        }

        function renderCardUiAfterPlaybackIfNeeded() {
            const pending = hasPendingPlaybackOrPresentation();
            const renderCardUI = resolveGlobalFunction('renderCardUI', cfg.renderCardUI);
            const requestCardUiSync = resolveGlobalFunction('requestCardUiSync', cfg.requestCardUiSync);

            try {
                if (requestCardUiSync) {
                    requestCardUiSync('network-snapshot:refresh');
                    return;
                }
                if (!renderCardUI) return;
                if (!pending) {
                    renderCardUI();
                    return;
                }

                const waitForPlaybackFn = (
                    runtime
                    && typeof runtime.resolveWaitForPlaybackIdle === 'function'
                )
                    ? runtime.resolveWaitForPlaybackIdle()
                    : null;
                if (typeof waitForPlaybackFn === 'function') {
                    Promise.resolve(waitForPlaybackFn()).then(() => {
                        try { if (renderCardUI) renderCardUI(); } catch (e) { /* ignore */ }
                    }).catch(() => {
                        try { if (renderCardUI) renderCardUI(); } catch (e) { /* ignore */ }
                    });
                    return;
                }
            } catch (e) { /* ignore */ }

            if (pending) return;
            try { if (renderCardUI) renderCardUI(); } catch (e) { /* ignore */ }
        }

        function refreshUi() {
            let cardStateChangeRequested = false;
            let boardUpdateRequested = false;
            try {
                const emitCardStateChange = resolveGlobalFunction('emitCardStateChange', cfg.emitCardStateChange);
                if (emitCardStateChange) cardStateChangeRequested = emitCardStateChange() === true;
            } catch (e) { /* ignore */ }
            try {
                const emitGameStateChange = resolveGlobalFunction('emitGameStateChange', cfg.emitGameStateChange);
                if (emitGameStateChange) emitGameStateChange();
            } catch (e) { /* ignore */ }
            try {
                const boardUpdateDispatch = resolveBoardUpdateDispatch();
                if (boardUpdateDispatch && typeof boardUpdateDispatch.requestBoardUpdate === 'function') {
                    boardUpdateRequested = boardUpdateDispatch.requestBoardUpdate({
                        emitBoardUpdate: cfg.emitBoardUpdate,
                        renderBoard: cfg.renderBoard
                    }) === true;
                } else {
                    const emitBoardUpdate = resolveGlobalFunction('emitBoardUpdate', cfg.emitBoardUpdate);
                    const renderBoard = resolveGlobalFunction('renderBoard', cfg.renderBoard);
                    if (emitBoardUpdate) boardUpdateRequested = emitBoardUpdate() === true;
                    else if (renderBoard) {
                        renderBoard();
                        boardUpdateRequested = true;
                    }
                }
            } catch (e) { /* ignore */ }
            if (!cardStateChangeRequested) {
                renderCardUiAfterPlaybackIfNeeded();
            }
            return {
                cardStateChangeRequested,
                boardUpdateRequested
            };
        }

        function resolveResultPresentationSync() {
            if (runtime && typeof runtime.resolveResultPresentationSync === 'function') {
                return runtime.resolveResultPresentationSync();
            }
            return null;
        }

        function maybeShowResultFromSnapshot(nextVersion, options) {
            const opts = options || {};
            const syncResultPresentation = resolveResultPresentationSync();
            if (typeof syncResultPresentation !== 'function') return false;
            return syncResultPresentation({
                resultState: resolveState(),
                stateVersion: nextVersion,
                skipResultOverlay: opts.skipResultOverlay === true,
                gameStateRef: resolveGlobalObject('gameState'),
                isGameOver: resolveGlobalFunction('isGameOver', cfg.isGameOver),
                showResult: resolveGlobalFunction('showResult', cfg.showResult),
                showResultOverlay: resolveGlobalFunction('showResultOverlay', cfg.showResultOverlay)
            });
        }

        function finalizeSnapshotPresentation(nextVersion, options, context) {
            const opts = options || {};
            const details = (context && typeof context === 'object') ? context : {};
            const presentationState = details.presentationState || {};
            const playbackEvents = Array.isArray(details.playbackEvents) ? details.playbackEvents : [];
            const shadowPlaybackEvents = Array.isArray(details.shadowPlaybackEvents) ? details.shadowPlaybackEvents : [];
            const cardStateRef = details.cardStateRef || null;
            const busyStateBeforeSnapshot = details.busyStateBeforeSnapshot || null;
            const shouldEmitShadowPlayback = presentationState.shouldEmitShadowPlayback === true;

            setBusyState(presentationState.shouldKeepBusy === true);
            if (playbackEvents.length > 0) {
                emitPlaybackEvents(playbackEvents, { source: 'network_snapshot' });
            } else if (shouldEmitShadowPlayback) {
                emitPlaybackEvents(shadowPlaybackEvents, {
                    source: opts.shadowPlaybackSource || 'self_snapshot_sync',
                    suppressPlayback: true
                });
                // suppressPlayback causes playPlaybackEvents to return immediately
                // without running AnimationEngine, so busy flags are never released.
                setBusyState(false);
            }

            maybeShowResultFromSnapshot(nextVersion, opts);
            if (playbackEvents.length > 0 || shouldEmitShadowPlayback) {
                armBoardUpdateDuringPlayback(
                    shouldEmitShadowPlayback ? (opts.shadowPlaybackSource || 'self_snapshot_sync') : 'network_snapshot',
                    shouldEmitShadowPlayback ? 'snapshot_shadow_playback_board_sync' : 'snapshot_playback_board_sync'
                );
            }
            const refreshState = refreshUi();

            // After refreshUi consumed the suppressed shadow events for
            // diff-renderer's move-source detection, clear them so
            // _hasPendingPlaybackEventsForBoardRenderer() does not
            // permanently block future renderBoard() calls.
            if (shouldEmitShadowPlayback) {
                clearTransientPresentationQueues(cardStateRef);
            } else if (refreshState && refreshState.boardUpdateRequested === true && shouldClearUndrainedPlaybackQueues(cardStateRef, playbackEvents, opts)) {
                clearTransientPresentationQueues(cardStateRef);
                setBusyState(false);
            } else if (shouldReleaseUnclaimedPlaybackBusyState(cardStateRef, playbackEvents)) {
                setBusyState(false);
            } else if (shouldReleaseRestoredQueueBusyState(cardStateRef, presentationState, busyStateBeforeSnapshot)) {
                clearTransientPresentationQueues(cardStateRef);
                setBusyState(false);
            }
            if (shouldReleaseStalePlaybackLockAfterSnapshot(cardStateRef, presentationState)) {
                clearBusyStateAndPlaybackLock();
            }
        }

        function applyAuthoritativeSnapshotState(snapshot, options, nextVersion, snapshotMeta) {
            const opts = options || {};
            const state = resolveState();
            const shadowPlaybackEvents = Array.isArray(opts.shadowPlaybackEvents) ? opts.shadowPlaybackEvents : [];
            const previousGameState = cloneData(resolveGlobalObject('gameState'));
            const previousCardState = cloneData(resolveGlobalObject('cardState'));
            const preservedQueues = captureTransientPresentationQueues(resolveGlobalObject('cardState'));
            const busyStateBeforeSnapshot = readBusyStateSnapshot();
            const playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [];

            replaceObjectState('gameState', snapshot.gameState);
            replaceObjectState('cardState', snapshot.cardState);
            try {
                const ensureLegacyMarkers = resolveGlobalFunction('ensureLegacyMarkers', cfg.ensureLegacyMarkers);
                const nextCardState = resolveGlobalObject('cardState');
                if (ensureLegacyMarkers && nextCardState) ensureLegacyMarkers(nextCardState);
            } catch (e) { /* ignore */ }

            const cardStateRef = resolveGlobalObject('cardState');
            const synthesizedChargeDeltaEvents = buildMissingChargeDeltaEvents(previousCardState, cardStateRef, opts);
            setTransientChargeDeltaEvents(synthesizedChargeDeltaEvents);
            const syncPendingSelectionActionCache = resolveGlobalFunction('syncPendingSelectionActionCache', cfg.syncPendingSelectionActionCache);
            if (syncPendingSelectionActionCache && cardStateRef) {
                try {
                    syncPendingSelectionActionCache(cardStateRef);
                } catch (e) { /* ignore */ }
            }

            const boardGeometry = compareBoardGeometry(previousGameState, resolveGlobalObject('gameState'));
            if (boardGeometry.changed) {
                emitTelemetry('snapshot_board_geometry_changed', {
                    previousRows: boardGeometry.previous.rows,
                    previousCols: boardGeometry.previous.cols,
                    nextRows: boardGeometry.next.rows,
                    nextCols: boardGeometry.next.cols
                });
            }

            const presentationState = reconcilePresentationQueues(cardStateRef, {
                preservedQueues,
                playbackEvents,
                shadowPlaybackEvents,
                dropPreservedQueues: boardGeometry.changed
            });

            if (nextVersion !== null) {
                state.stateVersion = nextVersion;
                state.appliedStateVersion = nextVersion;
            }
            if (state && state.authoritativeMatchState && typeof state.authoritativeMatchState === 'object') {
                state.authoritativeMatchState.stateVersion = nextVersion;
                state.authoritativeMatchState.gameState = cloneData(snapshot.gameState);
                state.authoritativeMatchState.cardState = cloneData(snapshot.cardState);
                state.authoritativeMatchState.authority = snapshotMeta ? snapshotMeta.authority : null;
                state.authoritativeMatchState.projectedForSeat = snapshotMeta ? snapshotMeta.projectedForSeat : null;
                state.authoritativeMatchState.turnStartReconciled = snapshotMeta ? snapshotMeta.turnStartReconciled : false;
                state.authoritativeMatchState.projectedSnapshotHash = snapshotMeta ? (snapshotMeta.projectedSnapshotHash || null) : null;
                state.authoritativeMatchState.lastAppliedProjectedSnapshotHash = snapshotMeta ? (snapshotMeta.projectedSnapshotHash || null) : null;
            }

            return {
                presentationState,
                playbackEvents,
                shadowPlaybackEvents,
                cardStateRef,
                busyStateBeforeSnapshot
            };
        }

        function applySnapshot(snapshot, options) {
            const opts = options || {};
            const state = resolveState();
            const shadowPlaybackEvents = Array.isArray(opts.shadowPlaybackEvents) ? opts.shadowPlaybackEvents : [];

            if (!snapshot || typeof snapshot !== 'object') {
                emitTelemetry('snapshot_invalid_shape_rejected', { reason: 'invalid_snapshot' });
                return false;
            }

            if (shouldRejectSnapshotByAuthority(snapshot, state, opts)) {
                return false;
            }

            const snapshotMeta = getSnapshotMeta(snapshot);
            const nextVersion = getSnapshotVersion(snapshot);
            const currentAppliedVersion = Number.isFinite(Number(state && state.appliedStateVersion))
                ? Number(state.appliedStateVersion)
                : (Number.isFinite(Number(state && state.stateVersion)) ? Number(state.stateVersion) : null);

            if (!opts.force && nextVersion === null) {
                emitTelemetry('snapshot_missing_state_version_rejected', {
                    force: false
                });
                return false;
            }

            if (!opts.force && nextVersion !== null && currentAppliedVersion !== null && nextVersion <= currentAppliedVersion) {
                if (opts.allowStaleShadowPlayback === true && shadowPlaybackEvents.length > 0) {
                    emitTelemetry('snapshot_shadow_playback_emitted', {
                        nextVersion,
                        currentVersion: currentAppliedVersion,
                        shadowPlaybackCount: shadowPlaybackEvents.length
                    });
                    emitPlaybackEvents(shadowPlaybackEvents, {
                        source: opts.shadowPlaybackSource || 'self_snapshot_sync',
                        suppressPlayback: true
                    });
                    setBusyState(true);
                    armBoardUpdateDuringPlayback(
                        opts.shadowPlaybackSource || 'self_snapshot_sync',
                        'stale_shadow_playback_board_sync'
                    );
                    refreshUi();
                    setBusyState(false);
                    return true;
                }
                emitTelemetry('snapshot_stale_rejected', {
                    nextVersion,
                    currentVersion: currentAppliedVersion,
                    force: false
                });
                return false;
            }

            const sanitizedSnapshot = sanitizeIncomingSnapshot(snapshot);
            if (!sanitizedSnapshot.ok) {
                emitTelemetry('snapshot_invalid_shape_rejected', {
                    reason: sanitizedSnapshot.reason || 'invalid_snapshot'
                });
                return false;
            }

            const applyContext = applyAuthoritativeSnapshotState(snapshot, opts, nextVersion, snapshotMeta);
            finalizeSnapshotPresentation(nextVersion, opts, applyContext);
            return true;
        }

        function getCurrentSnapshotForPublish(info) {
            const meta = info || {};
            const snapshotOverride = (meta && meta.snapshot && typeof meta.snapshot === 'object')
                ? meta.snapshot
                : null;

            if (snapshotOverride && snapshotOverride.gameState && snapshotOverride.cardState) {
                try {
                    return {
                        gameState: cloneData(snapshotOverride.gameState),
                        cardState: cloneData(snapshotOverride.cardState)
                    };
                } catch (e) { /* ignore */ }
            }

            try {
                const gameStateRef = resolveGlobalObject('gameState');
                const cardStateRef = resolveGlobalObject('cardState');
                return {
                    gameState: cloneData(gameStateRef),
                    cardState: cloneData(cardStateRef)
                };
            } catch (e) {
                return null;
            }
        }

        return {
            applySnapshot,
            getCurrentSnapshotForPublish
        };
    }

    return {
        createNetworkSnapshotController
    };
}));

"use strict";
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
'use strict';
function createNetworkSnapshotController(config) {
    const cfg = (config && typeof config === 'object') ? config : {};
    const rootRef = cfg.root || (typeof globalThis !== 'undefined' ? globalThis : null);
    const snapshotRuntimeModule = (() => {
        try {
            if (rootRef && rootRef.NetworkSnapshotRuntimeModule) {
                return rootRef.NetworkSnapshotRuntimeModule;
            }
        }
        catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.NetworkSnapshotRuntimeModule) {
                return globalThis.NetworkSnapshotRuntimeModule;
            }
        }
        catch (e) { /* ignore */ }
        try {
            if (typeof _require === 'function') {
                return _require('./snapshot-runtime');
            }
        }
        catch (e) { /* ignore */ }
        return null;
    })();
    const runtime = (snapshotRuntimeModule
        && typeof snapshotRuntimeModule.createNetworkSnapshotRuntime === 'function')
        ? snapshotRuntimeModule.createNetworkSnapshotRuntime(cfg)
        : null;
    const snapshotCanonicalModule = (() => {
        try {
            if (rootRef && rootRef.NetworkSnapshotCanonicalModule) {
                return rootRef.NetworkSnapshotCanonicalModule;
            }
        }
        catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.NetworkSnapshotCanonicalModule) {
                return globalThis.NetworkSnapshotCanonicalModule;
            }
        }
        catch (e) { /* ignore */ }
        try {
            if (typeof _require === 'function') {
                return _require('./snapshot-canonical');
            }
        }
        catch (e) { /* ignore */ }
        return null;
    })();
    const snapshotPresentationModule = (() => {
        try {
            if (rootRef && rootRef.NetworkSnapshotPresentationModule) {
                return rootRef.NetworkSnapshotPresentationModule;
            }
        }
        catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.NetworkSnapshotPresentationModule) {
                return globalThis.NetworkSnapshotPresentationModule;
            }
        }
        catch (e) { /* ignore */ }
        try {
            if (typeof _require === 'function') {
                return _require('./snapshot-presentation');
            }
        }
        catch (e) { /* ignore */ }
        return null;
    })();
    if (!snapshotCanonicalModule || typeof snapshotCanonicalModule.inspectAuthoritativeSnapshot !== 'function') {
        throw new Error('NetworkSnapshotCanonicalModule is required before ui/network/snapshot.js');
    }
    if (!snapshotPresentationModule || typeof snapshotPresentationModule.reconcilePresentationQueues !== 'function') {
        throw new Error('NetworkSnapshotPresentationModule is required before ui/network/snapshot.js');
    }
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
        if (typeof injected === 'function')
            return injected;
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
            if (active === true) {
                return runtime.setBusyState({
                    processing: true,
                    cardAnimating: true,
                    playbackActive: true
                });
            }
            return runtime.setBusyState(false);
        }
        return false;
    }
    function armPlaybackLockForIncomingPlayback() {
        const playbackState = resolvePlaybackStateModule();
        if (playbackState && typeof playbackState.setBusyState === 'function') {
            playbackState.setBusyState({
                processing: true,
                cardAnimating: true,
                playbackActive: true
            });
            if (typeof playbackState.setPlaybackStartedAt === 'function') {
                playbackState.setPlaybackStartedAt(null);
            }
            else {
                setGlobalValue('__playbackActiveSince', null);
            }
            return true;
        }
        setGlobalFlag('isProcessing', true);
        setGlobalFlag('isCardAnimating', true);
        setGlobalFlag('VisualPlaybackActive', true);
        setGlobalValue('__playbackActiveSince', null);
        return true;
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
        }
        catch (e) { /* ignore */ }
        return true;
    }
    function cloneData(value) {
        try {
            if (typeof globalThis !== 'undefined' && typeof globalThis.structuredClone === 'function') {
                return globalThis.structuredClone(value);
            }
        }
        catch (e) { /* ignore */ }
        return JSON.parse(JSON.stringify(value));
    }
    function normalizeSeatKey(value) {
        return snapshotCanonicalModule.normalizeSeatKey(value);
    }
    function getSnapshotMeta(snapshot) {
        return snapshotCanonicalModule.getSnapshotMeta(snapshot);
    }
    function getSnapshotVersion(snapshot) {
        return snapshotCanonicalModule.getSnapshotVersion(snapshot);
    }
    function shouldRejectSnapshotByAuthority(snapshot, state, opts) {
        const inspection = snapshotCanonicalModule.inspectAuthoritativeSnapshot(snapshot, {
            force: opts && opts.force === true,
            localSeatKey: state && state.seatKey,
            skipVersionChecks: true
        });
        if (inspection && inspection.ok === true)
            return false;
        if (inspection && inspection.telemetryType) {
            emitTelemetry(inspection.telemetryType, inspection.telemetryDetails || {});
        }
        return true;
    }
    function normalizeChargeDeltaEventList(events) {
        return snapshotCanonicalModule.normalizeChargeDeltaEventList(events);
    }
    function buildMissingChargeDeltaEvents(previousCardState, nextCardState, options) {
        return snapshotCanonicalModule.buildMissingChargeDeltaEvents(previousCardState, nextCardState, options);
    }
    function setTransientChargeDeltaEvents(events) {
        const nextEvents = normalizeChargeDeltaEventList(Array.isArray(events)
            ? cloneData(events)
            : []);
        setGlobalValue('__networkTransientChargeDeltaEvents', nextEvents);
    }
    function emitTelemetry(type, details) {
        if (typeof cfg.onTelemetry !== 'function')
            return;
        try {
            cfg.onTelemetry(type, details || {});
        }
        catch (e) { /* ignore */ }
    }
    function readBoardGeometry(value) {
        const boardUtils = resolveSharedBoardUtils();
        if (boardUtils && typeof boardUtils.readBoardGeometry === 'function') {
            try {
                return boardUtils.readBoardGeometry(value);
            }
            catch (e) { /* ignore */ }
        }
        return null;
    }
    function compareBoardGeometry(previousValue, nextValue) {
        const boardUtils = resolveSharedBoardUtils();
        if (boardUtils && typeof boardUtils.compareBoardGeometry === 'function') {
            try {
                return boardUtils.compareBoardGeometry(previousValue, nextValue);
            }
            catch (e) { /* ignore */ }
        }
        const previous = readBoardGeometry(previousValue);
        const next = readBoardGeometry(nextValue);
        return {
            previous,
            next,
            changed: !!(previous
                && next
                && (previous.rows !== next.rows || previous.cols !== next.cols))
        };
    }
    function sanitizeIncomingSnapshot(snapshot) {
        const result = snapshotCanonicalModule.sanitizeIncomingSnapshot(snapshot, { cloneData });
        if (result && result.transientStateStripped) {
            emitTelemetry('snapshot_transient_state_stripped', result.transientStateStripped);
        }
        return result;
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
        if (!Array.isArray(playbackEvents) || playbackEvents.length === 0)
            return;
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
        }
        catch (e) { /* ignore */ }
    }
    function clearTransientPresentationQueues(cardStateRef) {
        snapshotPresentationModule.clearTransientPresentationQueues(cardStateRef);
    }
    function captureTransientPresentationQueues(cardStateRef) {
        return snapshotPresentationModule.captureTransientPresentationQueues(cardStateRef, cloneData);
    }
    function isVisualPlaybackActive() {
        const playbackState = resolvePlaybackStateModule();
        try {
            if (playbackState && typeof playbackState.getPlaybackActive === 'function') {
                return playbackState.getPlaybackActive() === true;
            }
        }
        catch (e) { /* ignore */ }
        return false;
    }
    function hasPendingPresentationEvents(source) {
        const playbackState = resolvePlaybackStateModule();
        if (playbackState && typeof playbackState.hasPendingPresentationEvents === 'function') {
            return playbackState.hasPendingPresentationEvents(source);
        }
        return snapshotPresentationModule.hasPendingPresentationEvents(source);
    }
    function readBusyStateSnapshot() {
        const playbackState = resolvePlaybackStateModule();
        let processing = false;
        let cardAnimating = false;
        try {
            if (playbackState && typeof playbackState.getProcessing === 'function') {
                processing = playbackState.getProcessing() === true;
            }
        }
        catch (e) { /* ignore */ }
        try {
            if (playbackState && typeof playbackState.getCardAnimating === 'function') {
                cardAnimating = playbackState.getCardAnimating() === true;
            }
        }
        catch (e) { /* ignore */ }
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
        return snapshotPresentationModule.reconcilePresentationQueues(cardStateRef, options);
    }
    function shouldReleaseRestoredQueueBusyState(cardStateRef, presentationState, busyStateBeforeSnapshot) {
        return snapshotPresentationModule.shouldReleaseRestoredQueueBusyState({
            cardStateRef,
            presentationState,
            busyStateBeforeSnapshot,
            isPlaybackEngineRunning,
            isVisualPlaybackActive,
            cloneData
        });
    }
    function shouldReleaseStalePlaybackLockAfterSnapshot(cardStateRef, presentationState) {
        return snapshotPresentationModule.shouldReleaseStalePlaybackLockAfterSnapshot({
            cardStateRef,
            presentationState,
            isVisualPlaybackActive,
            isPlaybackEngineRunning,
            getPlaybackStartedAt,
            stalePlaybackTimeoutMs: getStalePlaybackTimeoutMs(),
            cloneData
        });
    }
    function shouldReleaseUnclaimedPlaybackBusyState(cardStateRef, playbackEvents) {
        return snapshotPresentationModule.shouldReleaseUnclaimedPlaybackBusyState({
            cardStateRef,
            playbackEvents,
            isVisualPlaybackActive,
            isPlaybackEngineRunning,
            getPlaybackStartedAt,
            cloneData
        });
    }
    function shouldClearUndrainedPlaybackQueues(cardStateRef, playbackEvents, options) {
        return snapshotPresentationModule.shouldClearUndrainedPlaybackQueues({
            cardStateRef,
            playbackEvents,
            force: options && options.force === true,
            isVisualPlaybackActive,
            isPlaybackEngineRunning,
            getPlaybackStartedAt,
            cloneData
        });
    }
    function hasPendingPlaybackOrPresentation() {
        const cardStateRef = resolveGlobalObject('cardState');
        try {
            const visualPlayback = isVisualPlaybackActive();
            return visualPlayback || hasPendingPresentationEvents(cardStateRef);
        }
        catch (e) {
            return isVisualPlaybackActive();
        }
    }
    function armBoardUpdateDuringPlayback(source, reason) {
        const runtimeRef = resolveBoardUpdateSyncRuntime();
        if (!runtimeRef || typeof runtimeRef.armBoardUpdateSyncContext !== 'function')
            return false;
        try {
            return !!runtimeRef.armBoardUpdateSyncContext({
                allowBoardUpdateDuringPlayback: true,
                source: source || 'network_snapshot',
                reason: reason || 'snapshot_playback_board_sync'
            });
        }
        catch (e) {
            return false;
        }
    }
    function armSuppressFallbackFlipDuringSnapshotPlayback(source, reason) {
        if (!runtime || typeof runtime.armBoardUpdateContext !== 'function')
            return false;
        try {
            return !!runtime.armBoardUpdateContext({
                suppressFallbackFlip: true,
                source: source || 'network_snapshot',
                reason: reason || 'snapshot_playback_suppress_fallback_flip'
            });
        }
        catch (e) {
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
            if (!renderCardUI)
                return;
            if (!pending) {
                renderCardUI();
                return;
            }
            const waitForPlaybackFn = (runtime
                && typeof runtime.resolveWaitForPlaybackIdle === 'function')
                ? runtime.resolveWaitForPlaybackIdle()
                : null;
            if (typeof waitForPlaybackFn === 'function') {
                Promise.resolve(waitForPlaybackFn()).then(() => {
                    try {
                        if (renderCardUI)
                            renderCardUI();
                    }
                    catch (e) { /* ignore */ }
                }).catch(() => {
                    try {
                        if (renderCardUI)
                            renderCardUI();
                    }
                    catch (e) { /* ignore */ }
                });
                return;
            }
        }
        catch (e) { /* ignore */ }
        if (pending)
            return;
        try {
            if (renderCardUI)
                renderCardUI();
        }
        catch (e) { /* ignore */ }
    }
    function refreshUi() {
        let cardStateChangeRequested = false;
        let boardUpdateRequested = false;
        try {
            const emitCardStateChange = resolveGlobalFunction('emitCardStateChange', cfg.emitCardStateChange);
            if (emitCardStateChange)
                cardStateChangeRequested = emitCardStateChange() === true;
        }
        catch (e) { /* ignore */ }
        try {
            const emitGameStateChange = resolveGlobalFunction('emitGameStateChange', cfg.emitGameStateChange);
            if (emitGameStateChange)
                emitGameStateChange();
        }
        catch (e) { /* ignore */ }
        try {
            const injectedEmitBoardUpdate = (typeof cfg.emitBoardUpdate === 'function')
                ? cfg.emitBoardUpdate
                : null;
            const injectedRenderBoard = (typeof cfg.renderBoard === 'function')
                ? cfg.renderBoard
                : null;
            if (injectedEmitBoardUpdate) {
                injectedEmitBoardUpdate({
                    source: 'network_snapshot',
                    reason: 'snapshot_refresh'
                });
                boardUpdateRequested = true;
            }
            else if (injectedRenderBoard) {
                injectedRenderBoard();
                boardUpdateRequested = true;
            }
            else {
                const boardUpdateDispatch = resolveBoardUpdateDispatch();
                if (boardUpdateDispatch && typeof boardUpdateDispatch.requestBoardUpdate === 'function') {
                    boardUpdateRequested = boardUpdateDispatch.requestBoardUpdate({
                        emitBoardUpdate: cfg.emitBoardUpdate,
                        renderBoard: cfg.renderBoard,
                        source: 'network_snapshot',
                        reason: 'snapshot_refresh'
                    }) === true;
                }
                else {
                    const emitBoardUpdate = resolveGlobalFunction('emitBoardUpdate', cfg.emitBoardUpdate);
                    const renderBoard = resolveGlobalFunction('renderBoard', cfg.renderBoard);
                    if (emitBoardUpdate)
                        boardUpdateRequested = emitBoardUpdate() === true;
                    else if (renderBoard) {
                        renderBoard();
                        boardUpdateRequested = true;
                    }
                }
            }
        }
        catch (e) { /* ignore */ }
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
        if (typeof syncResultPresentation !== 'function')
            return false;
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
            armBoardUpdateDuringPlayback('network_snapshot', 'snapshot_playback_event_emit_board_sync');
            armPlaybackLockForIncomingPlayback();
            emitPlaybackEvents(playbackEvents, { source: 'network_snapshot' });
        }
        else if (shouldEmitShadowPlayback) {
            armBoardUpdateDuringPlayback(opts.shadowPlaybackSource || 'self_snapshot_sync', 'snapshot_shadow_playback_event_emit_board_sync');
            emitPlaybackEvents(shadowPlaybackEvents, {
                source: opts.shadowPlaybackSource || 'self_snapshot_sync',
                suppressPlayback: true
            });
            setBusyState(false);
        }
        maybeShowResultFromSnapshot(nextVersion, opts);
        if (playbackEvents.length > 0 || shouldEmitShadowPlayback) {
            armSuppressFallbackFlipDuringSnapshotPlayback(shouldEmitShadowPlayback ? (opts.shadowPlaybackSource || 'self_snapshot_sync') : 'network_snapshot', shouldEmitShadowPlayback ? 'snapshot_shadow_playback_suppress_fallback_flip' : 'snapshot_playback_suppress_fallback_flip');
            armBoardUpdateDuringPlayback(shouldEmitShadowPlayback ? (opts.shadowPlaybackSource || 'self_snapshot_sync') : 'network_snapshot', shouldEmitShadowPlayback ? 'snapshot_shadow_playback_board_sync' : 'snapshot_playback_board_sync');
        }
        const refreshState = refreshUi();
        if (shouldEmitShadowPlayback) {
            clearTransientPresentationQueues(cardStateRef);
        }
        else if (refreshState && refreshState.boardUpdateRequested === true && shouldClearUndrainedPlaybackQueues(cardStateRef, playbackEvents, opts)) {
            clearTransientPresentationQueues(cardStateRef);
            clearBusyStateAndPlaybackLock();
        }
        else if (shouldReleaseUnclaimedPlaybackBusyState(cardStateRef, playbackEvents)) {
            clearBusyStateAndPlaybackLock();
        }
        else if (shouldReleaseRestoredQueueBusyState(cardStateRef, presentationState, busyStateBeforeSnapshot)) {
            clearTransientPresentationQueues(cardStateRef);
            clearBusyStateAndPlaybackLock();
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
            if (ensureLegacyMarkers && nextCardState)
                ensureLegacyMarkers(nextCardState);
        }
        catch (e) { /* ignore */ }
        const cardStateRef = resolveGlobalObject('cardState');
        const synthesizedChargeDeltaEvents = buildMissingChargeDeltaEvents(previousCardState, cardStateRef, opts);
        setTransientChargeDeltaEvents(synthesizedChargeDeltaEvents);
        const syncPendingSelectionActionCache = resolveGlobalFunction('syncPendingSelectionActionCache', cfg.syncPendingSelectionActionCache);
        if (syncPendingSelectionActionCache && cardStateRef) {
            try {
                syncPendingSelectionActionCache(cardStateRef);
            }
            catch (e) { /* ignore */ }
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
                armBoardUpdateDuringPlayback(opts.shadowPlaybackSource || 'self_snapshot_sync', 'stale_shadow_playback_board_sync');
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
        const applyContext = applyAuthoritativeSnapshotState(sanitizedSnapshot.snapshot, opts, nextVersion, snapshotMeta);
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
            }
            catch (e) { /* ignore */ }
        }
        try {
            const gameStateRef = resolveGlobalObject('gameState');
            const cardStateRef = resolveGlobalObject('cardState');
            return {
                gameState: cloneData(gameStateRef),
                cardState: cloneData(cardStateRef)
            };
        }
        catch (e) {
            return null;
        }
    }
    return {
        applySnapshot,
        getCurrentSnapshotForPublish
    };
}
const NetworkSnapshotModule = {
    createNetworkSnapshotController
};
module.exports = NetworkSnapshotModule;
//# sourceMappingURL=snapshot.js.map
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../../src/types';

'use strict';

function createNetworkSnapshotController(config: any): any {
    const cfg = (config && typeof config === 'object') ? config : {};
    const rootRef = cfg.root || (typeof globalThis !== 'undefined' ? globalThis : null);
    function resolveNetworkSnapshotModuleOrNull(modulePath: string, globalName: string): any {
        try {
            if (rootRef && rootRef[globalName]) {
                return rootRef[globalName];
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && (globalThis as any)[globalName]) {
                return (globalThis as any)[globalName];
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof _require === 'function') {
                return _require(modulePath);
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    const snapshotRuntimeModule = resolveNetworkSnapshotModuleOrNull('./snapshot-runtime', 'NetworkSnapshotRuntimeModule');
    const runtime = (
        snapshotRuntimeModule
        && typeof snapshotRuntimeModule.createNetworkSnapshotRuntime === 'function'
    )
        ? snapshotRuntimeModule.createNetworkSnapshotRuntime(cfg)
        : null;
    const snapshotCanonicalModule = resolveNetworkSnapshotModuleOrNull('./snapshot-canonical', 'NetworkSnapshotCanonicalModule');
    const snapshotPresentationModule = resolveNetworkSnapshotModuleOrNull('./snapshot-presentation', 'NetworkSnapshotPresentationModule');
    const snapshotPlaybackModule = resolveNetworkSnapshotModuleOrNull('./snapshot-playback', 'NetworkSnapshotPlaybackModule');
    const playbackStateManagerModule = resolveNetworkSnapshotModuleOrNull('../playback-state-manager', 'PlaybackStateManager');

    if (!snapshotCanonicalModule || typeof snapshotCanonicalModule.inspectAuthoritativeSnapshot !== 'function') {
        throw new Error('NetworkSnapshotCanonicalModule is required before ui/network/snapshot.js');
    }
    if (!snapshotPresentationModule || typeof snapshotPresentationModule.reconcilePresentationQueues !== 'function') {
        throw new Error('NetworkSnapshotPresentationModule is required before ui/network/snapshot.js');
    }
    if (!snapshotPlaybackModule || typeof snapshotPlaybackModule.createNetworkSnapshotPlaybackController !== 'function') {
        throw new Error('NetworkSnapshotPlaybackModule is required before ui/network/snapshot.js');
    }

    function resolveState(): any {
        if (runtime && typeof runtime.resolveState === 'function') {
            return runtime.resolveState();
        }
        return (typeof cfg.getState === 'function' && cfg.getState()) || {};
    }

    function resolveGlobalObject(name: string): any {
        if (runtime && typeof runtime.resolveObject === 'function') {
            return runtime.resolveObject(name);
        }
        return null;
    }

    function resolveGlobalFunction(name: string, injected: any): any {
        if (runtime && typeof runtime.resolveFunction === 'function') {
            return runtime.resolveFunction(name, injected);
        }
        if (typeof injected === 'function') return injected;
        return null;
    }

    function setGlobalFlag(name: string, value: any): void {
        if (runtime && typeof runtime.setGlobalFlag === 'function') {
            runtime.setGlobalFlag(name, value);
        }
    }

    function setGlobalValue(name: string, value: any): void {
        if (runtime && typeof runtime.setGlobalValue === 'function') {
            runtime.setGlobalValue(name, value);
        }
    }

    function resolvePlaybackStateModule(): any {
        if (runtime && typeof runtime.resolvePlaybackStateModule === 'function') {
            return runtime.resolvePlaybackStateModule();
        }
        return null;
    }

    function resolveBoardUpdateDispatch(): any {
        if (runtime && typeof runtime.resolveBoardUpdateDispatch === 'function') {
            return runtime.resolveBoardUpdateDispatch();
        }
        return null;
    }

    function resolveRenderScheduler(): any {
        const scheduler = resolveGlobalObject('RenderScheduler');
        if (scheduler && typeof scheduler.requestBoardRender === 'function') {
            return scheduler;
        }
        return null;
    }

    function resolveBoardUpdateSyncRuntime(): any {
        if (runtime && typeof runtime.resolveBoardUpdateSyncRuntime === 'function') {
            return runtime.resolveBoardUpdateSyncRuntime();
        }
        return null;
    }

    function resolveSharedBoardUtils(): any {
        if (runtime && typeof runtime.resolveSharedBoardUtils === 'function') {
            return runtime.resolveSharedBoardUtils();
        }
        return null;
    }

    function setBusyState(active: boolean): boolean {
        if (runtime && typeof runtime.setBusyState === 'function') {
            return runtime.setBusyState(active === true);
        }
        return false;
    }

    function armPlaybackLockForIncomingPlayback(): boolean {
        return snapshotPlayback.armPlaybackLockForIncomingPlayback();
    }

    function clearBusyStateAndPlaybackLock(): boolean {
        return snapshotPlayback.clearBusyStateAndPlaybackLock();
    }

    function cloneData(value: any): any {
        try {
            if (typeof globalThis !== 'undefined' && typeof (globalThis as any).structuredClone === 'function') {
                return (globalThis as any).structuredClone(value);
            }
        } catch (e) { /* ignore */ }
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeSeatKey(value: any): string {
        return snapshotCanonicalModule.normalizeSeatKey(value);
    }

    function getSnapshotMeta(snapshot: any): any {
        return snapshotCanonicalModule.getSnapshotMeta(snapshot);
    }

    function getSnapshotVersion(snapshot: any): any {
        return snapshotCanonicalModule.getSnapshotVersion(snapshot);
    }

    function shouldRejectSnapshotByAuthority(snapshot: any, state: any, opts: any): boolean {
        const inspection = snapshotCanonicalModule.inspectAuthoritativeSnapshot(snapshot, {
            force: opts && opts.force === true,
            localSeatKey: state && state.seatKey,
            viewerRole: state && state.viewerRole,
            skipVersionChecks: true
        });
        if (inspection && inspection.ok === true) return false;
        if (inspection && inspection.telemetryType) {
            emitTelemetry(inspection.telemetryType, inspection.telemetryDetails || {});
        }
        return true;
    }

    function normalizeChargeDeltaEventList(events: any[]): any[] {
        return snapshotCanonicalModule.normalizeChargeDeltaEventList(events);
    }

    function buildMissingChargeDeltaEvents(previousCardState: any, nextCardState: any, options: any): any[] {
        return snapshotCanonicalModule.buildMissingChargeDeltaEvents(previousCardState, nextCardState, options);
    }

    function setTransientChargeDeltaEvents(events: any[]): void {
        const nextEvents = normalizeChargeDeltaEventList(Array.isArray(events)
            ? cloneData(events)
            : []);
        setGlobalValue('__networkTransientChargeDeltaEvents', nextEvents);
    }

    function emitTelemetry(type: string, details: any): void {
        if (typeof cfg.onTelemetry !== 'function') return;
        try {
            cfg.onTelemetry(type, details || {});
        } catch (e) { /* ignore */ }
    }

    const snapshotPlayback = snapshotPlaybackModule.createNetworkSnapshotPlaybackController({
        cfg,
        rootRef,
        runtime,
        playbackStateManagerModule,
        snapshotPresentationModule,
        emitTelemetry,
        resolveGlobalObject,
        resolveGlobalFunction,
        resolvePlaybackStateModule,
        setGlobalFlag,
        setGlobalValue,
        setBusyState,
        refreshUi
    });

    function playbackRequestStarted(request: any): boolean {
        return snapshotPlayback.playbackRequestStarted(request);
    }

    function requestNetworkPlaybackDrain(batchInfo: any, source: string): any {
        return snapshotPlayback.requestNetworkPlaybackDrain(batchInfo, source);
    }

    function requestNetworkPlaybackDirectDispatch(batchInfo: any, source: string): any {
        return snapshotPlayback.requestNetworkPlaybackDirectDispatch(batchInfo, source);
    }

    function readBoardGeometry(value: any): any {
        const boardUtils = resolveSharedBoardUtils();
        if (boardUtils && typeof boardUtils.readBoardGeometry === 'function') {
            try {
                return boardUtils.readBoardGeometry(value);
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    function compareBoardGeometry(previousValue: any, nextValue: any): any {
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

    function sanitizeIncomingSnapshot(snapshot: any): any {
        const result = snapshotCanonicalModule.sanitizeIncomingSnapshot(snapshot, { cloneData });
        if (result && result.transientStateStripped) {
            emitTelemetry('snapshot_transient_state_stripped', result.transientStateStripped);
        }
        return result;
    }

    function replaceObjectState(targetName: string, nextValue: any): void {
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

    function emitPlaybackEvents(playbackEvents: any[], options: any): any {
        return snapshotPlayback.emitPlaybackEvents(playbackEvents, options);
    }

    function clearTransientPresentationQueues(cardStateRef: any): void {
        snapshotPresentationModule.clearTransientPresentationQueues(cardStateRef);
    }

    function captureTransientPresentationQueues(cardStateRef: any): any {
        return snapshotPresentationModule.captureTransientPresentationQueues(cardStateRef, cloneData);
    }

    function readBusyStateSnapshot(): any {
        return snapshotPlayback.readBusyStateSnapshot();
    }

    function reconcilePresentationQueues(cardStateRef: any, options: any): any {
        return snapshotPresentationModule.reconcilePresentationQueues(cardStateRef, options);
    }

    function resolveSnapshotPlaybackSettlement(cardStateRef: any, details: any, refreshState: any, opts: any): any {
        return snapshotPlayback.resolveSnapshotPlaybackSettlement(cardStateRef, details, refreshState, opts);
    }

    function hasPendingPlaybackOrPresentation(): boolean {
        return snapshotPlayback.hasPendingPlaybackOrPresentation();
    }

    function armBoardUpdateDuringPlayback(source: string, reason: string): boolean {
        const runtimeRef = resolveBoardUpdateSyncRuntime();
        if (!runtimeRef || typeof runtimeRef.armBoardUpdateSyncContext !== 'function') return false;
        try {
            return !!runtimeRef.armBoardUpdateSyncContext({
                source: source || 'network_snapshot',
                reason: reason || 'snapshot_playback_board_sync'
            });
        } catch (e) {
            return false;
        }
    }

    function armSuppressFallbackFlipDuringSnapshotPlayback(source: string, reason: string): boolean {
        if (!runtime || typeof runtime.armBoardUpdateContext !== 'function') return false;
        try {
            return !!runtime.armBoardUpdateContext({
                suppressFallbackFlip: true,
                source: source || 'network_snapshot',
                reason: reason || 'snapshot_playback_suppress_fallback_flip'
            });
        } catch (e) {
            return false;
        }
    }

    function renderCardUiAfterPlaybackIfNeeded(options?: any): void {
        const opts = (options && typeof options === 'object') ? options : {};
        const pending = opts.deferUntilPlaybackIdle === true || hasPendingPlaybackOrPresentation();
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

    function syncCardDetailPanelDirect(): boolean {
        const updateCardDetailPanel = resolveGlobalFunction('updateCardDetailPanel', cfg.updateCardDetailPanel);
        if (typeof updateCardDetailPanel !== 'function') return false;
        try {
            updateCardDetailPanel();
            return true;
        } catch (e) { /* ignore */ }
        return false;
    }

    function requestDeferredBoardRefreshAfterPlayback(request: any, source: string): boolean {
        return snapshotPlayback.requestDeferredBoardRefreshAfterPlayback(request, source);
    }

    function refreshUi(options?: any): any {
        const opts = (options && typeof options === 'object') ? options : {};
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
        if (opts.skipBoardUpdate !== true) {
            try {
                const injectedEmitBoardUpdate = (typeof cfg.emitBoardUpdate === 'function')
                    ? cfg.emitBoardUpdate
                    : null;
                if (injectedEmitBoardUpdate) {
                    injectedEmitBoardUpdate({
                        source: 'network_snapshot',
                        reason: 'snapshot_refresh'
                    });
                    boardUpdateRequested = true;
                } else {
                    const boardUpdateDispatch = resolveBoardUpdateDispatch();
                    if (boardUpdateDispatch
                        && typeof boardUpdateDispatch.requestBoardUpdate === 'function'
                        && resolveRenderScheduler()) {
                        boardUpdateRequested = boardUpdateDispatch.requestBoardUpdate({
                            emitBoardUpdate: cfg.emitBoardUpdate,
                            source: 'network_snapshot',
                            reason: 'snapshot_refresh'
                        }) === true;
                    } else {
                        const emitBoardUpdate = resolveGlobalFunction('emitBoardUpdate', cfg.emitBoardUpdate);
                        if (emitBoardUpdate) boardUpdateRequested = emitBoardUpdate() === true;
                    }
                }
            } catch (e) { /* ignore */ }
        }
        if (!cardStateChangeRequested) {
            renderCardUiAfterPlaybackIfNeeded({
                deferUntilPlaybackIdle: opts.deferCardUiUntilPlaybackIdle === true
            });
        } else if (opts.deferCardUiUntilPlaybackIdle !== true) {
            syncCardDetailPanelDirect();
        }
        return {
            cardStateChangeRequested,
            boardUpdateRequested
        };
    }

    function resolveResultPresentationSync(): any {
        if (runtime && typeof runtime.resolveResultPresentationSync === 'function') {
            return runtime.resolveResultPresentationSync();
        }
        return null;
    }

    function maybeShowResultFromSnapshot(nextVersion: any, options: any): boolean {
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

    function isCurrentSnapshotTerminal(): boolean {
        const gameStateRef = resolveGlobalObject('gameState');
        const isGameOver = resolveGlobalFunction('isGameOver', cfg.isGameOver);
        if (!gameStateRef || typeof isGameOver !== 'function') return false;
        try {
            return isGameOver(gameStateRef) === true;
        } catch (e) {
            return false;
        }
    }

    function isSnapshotVersionCurrent(nextVersion: any): boolean {
        const normalizedNextVersion = Number.isFinite(Number(nextVersion))
            ? Math.trunc(Number(nextVersion))
            : null;
        if (normalizedNextVersion === null) return true;
        const state = resolveState();
        const currentVersion = Number.isFinite(Number(state && state.appliedStateVersion))
            ? Math.trunc(Number(state.appliedStateVersion))
            : (Number.isFinite(Number(state && state.stateVersion))
                ? Math.trunc(Number(state.stateVersion))
                : null);
        return currentVersion === null || currentVersion === normalizedNextVersion;
    }

    function isDeferredResultContextCurrent(nextVersion: any, options: any): boolean {
        if (!isSnapshotVersionCurrent(nextVersion)) return false;
        const opts = options && typeof options === 'object' ? options : {};
        const state = resolveState();
        const expectedRoomId = String(opts.networkRoomId || '').trim().toUpperCase();
        const currentRoomId = String(state && state.roomId || '').trim().toUpperCase();
        if (expectedRoomId && expectedRoomId !== currentRoomId) return false;
        const expectedEpoch = Number(opts.networkSessionEpoch);
        if (Number.isFinite(expectedEpoch) && typeof cfg.getSessionEpoch === 'function') {
            const currentEpoch = Number(cfg.getSessionEpoch());
            if (!Number.isFinite(currentEpoch) || Math.trunc(currentEpoch) !== Math.trunc(expectedEpoch)) {
                return false;
            }
        }
        return true;
    }

    function requestDeferredResultPresentationAfterVisualSeq(nextVersion: any, options: any): boolean {
        const opts = options && typeof options === 'object' ? options : {};
        const visualSeq = Number(opts.deferResultUntilVisualSeq);
        if (!Number.isSafeInteger(visualSeq) || visualSeq <= 0 || !isCurrentSnapshotTerminal()) return false;
        const waitForNetworkVisualSeq = runtime && typeof runtime.resolveWaitForNetworkVisualSeq === 'function'
            ? runtime.resolveWaitForNetworkVisualSeq()
            : null;
        if (typeof waitForNetworkVisualSeq !== 'function') {
            emitTelemetry('snapshot_terminal_result_visual_wait_failed', {
                stateVersion: nextVersion,
                visualSeq,
                reason: 'visual_settlement_wait_unavailable'
            });
            return true;
        }

        let settlement: any = null;
        try {
            settlement = waitForNetworkVisualSeq(visualSeq, {
                operationId: opts.networkOperationId || null
            });
        } catch (error: any) {
            emitTelemetry('snapshot_terminal_result_visual_wait_failed', {
                stateVersion: nextVersion,
                visualSeq,
                reason: error && error.message ? String(error.message) : 'visual_settlement_wait_threw'
            });
            return true;
        }

        Promise.resolve(settlement).then((result: any) => {
            if (!result || result.ok !== true) {
                emitTelemetry('snapshot_terminal_result_visual_wait_failed', {
                    stateVersion: nextVersion,
                    visualSeq,
                    reason: result && result.reason ? String(result.reason) : 'visual_settlement_failed'
                });
                return;
            }
            if (!isDeferredResultContextCurrent(nextVersion, opts)) {
                emitTelemetry('snapshot_terminal_result_visual_wait_stale', {
                    stateVersion: nextVersion,
                    visualSeq
                });
                return;
            }
            maybeShowResultFromSnapshot(nextVersion, opts);
        }, (error: any) => {
            emitTelemetry('snapshot_terminal_result_visual_wait_failed', {
                stateVersion: nextVersion,
                visualSeq,
                reason: error && error.message ? String(error.message) : 'visual_settlement_rejected'
            });
        });
        emitTelemetry('snapshot_terminal_result_visual_deferred', {
            stateVersion: nextVersion,
            visualSeq
        });
        return true;
    }

    function requestDeferredResultPresentationAfterPlayback(request: any, nextVersion: any, options: any): boolean {
        if (!playbackRequestStarted(request) || !isCurrentSnapshotTerminal()) return false;
        let settlement: any = request && request.result;
        if (!settlement || typeof settlement.then !== 'function') {
            const waitForPlaybackIdle = runtime && typeof runtime.resolveWaitForPlaybackIdle === 'function'
                ? runtime.resolveWaitForPlaybackIdle()
                : null;
            if (typeof waitForPlaybackIdle !== 'function') return false;
            try {
                settlement = waitForPlaybackIdle();
            } catch (e) {
                settlement = null;
            }
        }
        if (!settlement || typeof settlement.then !== 'function') return false;

        const showSettledResult = () => {
            if (!isDeferredResultContextCurrent(nextVersion, options)) return;
            maybeShowResultFromSnapshot(nextVersion, options);
        };
        Promise.resolve(settlement).then(showSettledResult, (error: any) => {
            emitTelemetry('snapshot_terminal_result_playback_wait_failed', {
                stateVersion: nextVersion,
                reason: error && error.message ? String(error.message) : 'playback_settlement_rejected'
            });
        });
        emitTelemetry('snapshot_terminal_result_deferred', {
            stateVersion: nextVersion,
            networkPlaybackBatchId: request.networkPlaybackBatchId || '',
            playbackEventCount: request.playbackEventCount || 0
        });
        return true;
    }

    function enqueuePresentationFramesFromOptions(options: any): number {
        const opts = (options && typeof options === 'object') ? options : {};
        const frames = Array.isArray(opts.presentationFrames) ? opts.presentationFrames : [];
        if (frames.length <= 0 || typeof cfg.enqueuePresentationFrames !== 'function') return 0;
        try {
            return cfg.enqueuePresentationFrames(frames, {
                source: opts.presentationFrameSource || opts.source || 'network_snapshot'
            });
        } catch (e) {
            emitTelemetry('snapshot_presentation_frame_enqueue_failed', {
                source: opts.presentationFrameSource || opts.source || 'network_snapshot',
                presentationFrameCount: frames.length,
                error: e && (e as any).message ? String((e as any).message) : String(e || '')
            });
        }
        return 0;
    }

    function resolveVisualStateStore(): any {
        return cfg.visualStateStore && typeof cfg.visualStateStore === 'object'
            ? cfg.visualStateStore
            : null;
    }

    function readFirstPresentationFrame(options: any): any {
        const frames = Array.isArray(options && options.presentationFrames) ? options.presentationFrames : [];
        if (frames.length <= 0) return null;
        return frames
            .slice()
            .sort((a: any, b: any) => Number(a && a.visualSeq) - Number(b && b.visualSeq))[0] || null;
    }

    function buildSnapshotEnvelope(snapshot: any, stateVersion: any): any {
        const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
        const envelope = Object.assign({}, source);
        if (Number.isFinite(Number(stateVersion))) {
            envelope.stateVersion = Math.trunc(Number(stateVersion));
        }
        return envelope;
    }

    function setBaseVisualSnapshotBeforeStrictPlayback(previousGameState: any, previousCardState: any, options: any, state: any): void {
        const store = resolveVisualStateStore();
        if (!store || typeof store.setBaseVisualSnapshot !== 'function') return;
        const firstFrame = readFirstPresentationFrame(options);
        if (!firstFrame) return;
        const stateVersionFrom = Number.isFinite(Number(firstFrame.stateVersionFrom))
            ? Math.trunc(Number(firstFrame.stateVersionFrom))
            : (Number.isFinite(Number(state && state.lastVisualVersion))
                ? Math.trunc(Number(state.lastVisualVersion))
                : (Number.isFinite(Number(state && state.appliedStateVersion))
                    ? Math.trunc(Number(state.appliedStateVersion))
                    : null));
        const visualSeqBefore = Number.isFinite(Number(state && state.lastVisualSeq))
            ? Math.max(0, Math.trunc(Number(state.lastVisualSeq)))
            : Math.max(0, Math.trunc(Number(firstFrame.visualSeq || 1)) - 1);
        try {
            store.setBaseVisualSnapshot({
                stateVersion: stateVersionFrom,
                gameState: previousGameState,
                cardState: previousCardState
            }, {
                visualSeq: visualSeqBefore,
                visualVersion: stateVersionFrom,
                preserveExisting: true,
                source: 'network_snapshot_base'
            });
        } catch (e) {
            emitTelemetry('snapshot_visual_base_store_failed', {
                visualSeq: firstFrame.visualSeq,
                stateVersionFrom,
                error: e && (e as any).message ? String((e as any).message) : String(e || '')
            });
        }
    }

    function setCanonicalVisualSnapshot(snapshot: any, nextVersion: any): void {
        const store = resolveVisualStateStore();
        if (!store || typeof store.setCanonicalSnapshot !== 'function') return;
        try {
            store.setCanonicalSnapshot(buildSnapshotEnvelope(snapshot, nextVersion), {
                stateVersion: nextVersion
            });
        } catch (e) {
            emitTelemetry('snapshot_visual_canonical_store_failed', {
                stateVersion: nextVersion,
                error: e && (e as any).message ? String((e as any).message) : String(e || '')
            });
        }
    }

    function finalizeSnapshotPresentation(nextVersion: any, options: any, context: any): void {
        const opts = options || {};
        const details = (context && typeof context === 'object') ? context : {};
        const presentationState = details.presentationState || {};
        const playbackEvents = Array.isArray(details.playbackEvents) ? details.playbackEvents : [];
        const shadowPlaybackEvents = Array.isArray(details.shadowPlaybackEvents) ? details.shadowPlaybackEvents : [];
        const cardStateRef = details.cardStateRef || null;
        const busyStateBeforeSnapshot = details.busyStateBeforeSnapshot || null;
        const shouldEmitShadowPlayback = presentationState.shouldEmitShadowPlayback === true;
        let networkPlaybackRequest: any = null;

        setBusyState(presentationState.shouldKeepBusy === true);
        if (playbackEvents.length > 0) {
            let queuedPlaybackBatch: any = null;
            armPlaybackLockForIncomingPlayback();
            queuedPlaybackBatch = emitPlaybackEvents(playbackEvents, { source: 'network_snapshot' });
            networkPlaybackRequest = requestNetworkPlaybackDirectDispatch(queuedPlaybackBatch, 'network_snapshot');
            if (!playbackRequestStarted(networkPlaybackRequest)) {
                networkPlaybackRequest = requestNetworkPlaybackDrain(queuedPlaybackBatch, 'network_snapshot');
            }
        } else if (shouldEmitShadowPlayback) {
            let queuedShadowPlaybackBatch: any = null;
            armBoardUpdateDuringPlayback(
                opts.shadowPlaybackSource || 'self_snapshot_sync',
                'snapshot_shadow_playback_event_emit_board_sync'
            );
            queuedShadowPlaybackBatch = emitPlaybackEvents(shadowPlaybackEvents, {
                source: opts.shadowPlaybackSource || 'self_snapshot_sync',
                suppressPlayback: true
            });
            const shadowPlaybackRequest = requestNetworkPlaybackDirectDispatch(queuedShadowPlaybackBatch, opts.shadowPlaybackSource || 'self_snapshot_sync');
            if (!playbackRequestStarted(shadowPlaybackRequest)) {
                requestNetworkPlaybackDrain(queuedShadowPlaybackBatch, opts.shadowPlaybackSource || 'self_snapshot_sync');
            }
            setBusyState(false);
        }

        const deferImmediateBoardRefreshForPlayback =
            playbackEvents.length > 0 && playbackRequestStarted(networkPlaybackRequest);
        const deferredByVisualSeq = requestDeferredResultPresentationAfterVisualSeq(nextVersion, opts);
        const deferredResultPresentation = deferredByVisualSeq || (
            playbackEvents.length > 0
            && requestDeferredResultPresentationAfterPlayback(networkPlaybackRequest, nextVersion, opts)
        );
        if (!deferredResultPresentation) {
            maybeShowResultFromSnapshot(nextVersion, opts);
        }
        if (playbackEvents.length > 0 || shouldEmitShadowPlayback) {
            armSuppressFallbackFlipDuringSnapshotPlayback(
                shouldEmitShadowPlayback ? (opts.shadowPlaybackSource || 'self_snapshot_sync') : 'network_snapshot',
                shouldEmitShadowPlayback ? 'snapshot_shadow_playback_suppress_fallback_flip' : 'snapshot_playback_suppress_fallback_flip'
            );
            if (!deferImmediateBoardRefreshForPlayback) {
                armBoardUpdateDuringPlayback(
                    shouldEmitShadowPlayback ? (opts.shadowPlaybackSource || 'self_snapshot_sync') : 'network_snapshot',
                    shouldEmitShadowPlayback ? 'snapshot_shadow_playback_board_sync' : 'snapshot_playback_board_sync'
                );
            }
        }
        if (deferImmediateBoardRefreshForPlayback) {
            requestDeferredBoardRefreshAfterPlayback(networkPlaybackRequest, 'network_snapshot');
        }
        const refreshState = refreshUi({
            deferCardUiUntilPlaybackIdle: playbackEvents.length > 0 || shouldEmitShadowPlayback,
            skipBoardUpdate: deferImmediateBoardRefreshForPlayback
        });

        if (shouldEmitShadowPlayback) {
            clearTransientPresentationQueues(cardStateRef);
        } else {
            const settlement = resolveSnapshotPlaybackSettlement(cardStateRef, details, refreshState, opts);
            if (settlement.clearTransientPresentationQueues === true) {
                clearTransientPresentationQueues(cardStateRef);
            }
            if (settlement.clearPlaybackLock === true) {
                clearBusyStateAndPlaybackLock();
            } else if (settlement.setBusyFalse === true) {
                setBusyState(false);
            }
        }
    }

    function applyAuthoritativeSnapshotState(snapshot: any, options: any, nextVersion: any, snapshotMeta: any): any {
        const opts = options || {};
        const state = resolveState();
        const shadowPlaybackEvents = Array.isArray(opts.shadowPlaybackEvents) ? opts.shadowPlaybackEvents : [];
        const previousGameState = cloneData(resolveGlobalObject('gameState'));
        const previousCardState = cloneData(resolveGlobalObject('cardState'));
        const preservedQueues = captureTransientPresentationQueues(resolveGlobalObject('cardState'));
        const busyStateBeforeSnapshot = readBusyStateSnapshot();
        const playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [];

        setBaseVisualSnapshotBeforeStrictPlayback(previousGameState, previousCardState, opts, state);
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
        setCanonicalVisualSnapshot(snapshot, nextVersion);

        return {
            presentationState,
            playbackEvents,
            shadowPlaybackEvents,
            cardStateRef,
            busyStateBeforeSnapshot
        };
    }

    function applySnapshot(snapshot: any, options: any): boolean {
        const opts = options || {};
        const state = resolveState();
        const shadowPlaybackEvents = Array.isArray(opts.shadowPlaybackEvents) ? opts.shadowPlaybackEvents : [];
        const presentationFrames = Array.isArray(opts.presentationFrames) ? opts.presentationFrames : [];
        const effectiveOptions = presentationFrames.length > 0
            ? Object.assign({}, opts, { playbackEvents: [] })
            : opts;

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
                refreshUi({
                    deferCardUiUntilPlaybackIdle: true
                });
                setBusyState(false);
                return false;
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

        const applyContext = applyAuthoritativeSnapshotState(sanitizedSnapshot.snapshot, effectiveOptions, nextVersion, snapshotMeta);
        finalizeSnapshotPresentation(nextVersion, effectiveOptions, applyContext);
        if (presentationFrames.length > 0) {
            enqueuePresentationFramesFromOptions(opts);
        }
        return true;
    }

    function getCurrentSnapshotForPublish(info: any): any {
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

const NetworkSnapshotModule = {
    createNetworkSnapshotController
};

export = NetworkSnapshotModule;

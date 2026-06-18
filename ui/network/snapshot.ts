declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../../src/types';

'use strict';

function createNetworkSnapshotController(config: any): any {
    const cfg = (config && typeof config === 'object') ? config : {};
    const rootRef = cfg.root || (typeof globalThis !== 'undefined' ? globalThis : null);
    let networkPlaybackBatchSeq = 0;
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

    if (!snapshotCanonicalModule || typeof snapshotCanonicalModule.inspectAuthoritativeSnapshot !== 'function') {
        throw new Error('NetworkSnapshotCanonicalModule is required before ui/network/snapshot.js');
    }
    if (!snapshotPresentationModule || typeof snapshotPresentationModule.reconcilePresentationQueues !== 'function') {
        throw new Error('NetworkSnapshotPresentationModule is required before ui/network/snapshot.js');
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
        const playbackState = resolvePlaybackStateModule();
        if (playbackState && typeof playbackState.setBusyState === 'function') {
            playbackState.setBusyState({
                processing: true,
                cardAnimating: true,
                playbackActive: true
            });
            if (typeof playbackState.setPlaybackStartedAt === 'function') {
                playbackState.setPlaybackStartedAt(null);
            } else {
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

    function clearBusyStateAndPlaybackLock(): boolean {
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

    function readPresentationQueueLengths(cardStateRef: any): any {
        return {
            presentationQueueLength: Array.isArray(cardStateRef && cardStateRef.presentationEvents)
                ? cardStateRef.presentationEvents.length
                : 0,
            persistentQueueLength: Array.isArray(cardStateRef && cardStateRef._presentationEventsPersist)
                ? cardStateRef._presentationEventsPersist.length
                : 0
        };
    }

    function appendPlaybackPresentationEventDirect(cardStateRef: any, ev: any): boolean {
        if (!cardStateRef || typeof cardStateRef !== 'object' || !ev) return false;
        if (!Array.isArray(cardStateRef.presentationEvents)) cardStateRef.presentationEvents = [];
        if (!Array.isArray(cardStateRef._presentationEventsPersist)) cardStateRef._presentationEventsPersist = [];
        cardStateRef.presentationEvents.push(ev);
        cardStateRef._presentationEventsPersist.push(ev);
        return true;
    }

    function removeNetworkPlaybackBatchFromQueue(cardStateRef: any, networkPlaybackBatchId: string): any {
        const batchId = String(networkPlaybackBatchId || '').trim();
        if (!batchId || !cardStateRef || typeof cardStateRef !== 'object') {
            return {
                removedPresentationEvents: 0,
                removedPersistentEvents: 0
            };
        }
        function removeFromQueue(queue: any): any {
            if (!Array.isArray(queue)) return 0;
            const before = queue.length;
            for (let index = queue.length - 1; index >= 0; index -= 1) {
                const entry = queue[index];
                const meta = entry && entry.meta && typeof entry.meta === 'object' ? entry.meta : null;
                if (meta && String(meta.networkPlaybackBatchId || '') === batchId) {
                    queue.splice(index, 1);
                }
            }
            return before - queue.length;
        }
        return {
            removedPresentationEvents: removeFromQueue(cardStateRef.presentationEvents),
            removedPersistentEvents: removeFromQueue(cardStateRef._presentationEventsPersist)
        };
    }

    function getPlaybackEventTypes(playbackEvents: any[]): string[] {
        if (!Array.isArray(playbackEvents)) return [];
        return playbackEvents
            .map((event) => String(event && event.type || '').trim())
            .filter((value) => !!value);
    }

    function resolveNetworkPlaybackDirectHandler(): any {
        const injected = resolveGlobalFunction('handlePresentationEvent', cfg.handlePresentationEvent);
        if (typeof injected === 'function') return injected;
        try {
            if (rootRef && rootRef.PresentationHandler && typeof rootRef.PresentationHandler.handlePresentationEvent === 'function') {
                return rootRef.PresentationHandler.handlePresentationEvent.bind(rootRef.PresentationHandler);
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined'
                && (globalThis as any).PresentationHandler
                && typeof (globalThis as any).PresentationHandler.handlePresentationEvent === 'function') {
                return (globalThis as any).PresentationHandler.handlePresentationEvent.bind((globalThis as any).PresentationHandler);
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveNetworkPlaybackDrain(): any {
        const injected = resolveGlobalFunction('onBoardUpdated', cfg.onBoardUpdated);
        if (typeof injected === 'function') return injected;
        try {
            if (rootRef && rootRef.PresentationHandler && typeof rootRef.PresentationHandler.onBoardUpdated === 'function') {
                return rootRef.PresentationHandler.onBoardUpdated.bind(rootRef.PresentationHandler);
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined'
                && (globalThis as any).PresentationHandler
                && typeof (globalThis as any).PresentationHandler.onBoardUpdated === 'function') {
                return (globalThis as any).PresentationHandler.onBoardUpdated.bind((globalThis as any).PresentationHandler);
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function createPlaybackRequest(started: boolean, result?: any, batchInfo?: any): any {
        return {
            started: started === true,
            result,
            networkPlaybackBatchId: batchInfo && batchInfo.networkPlaybackBatchId ? batchInfo.networkPlaybackBatchId : '',
            playbackEventCount: batchInfo && batchInfo.playbackEventCount ? batchInfo.playbackEventCount : 0
        };
    }

    function playbackRequestStarted(request: any): boolean {
        return !!(request && request.started === true);
    }

    function requestNetworkPlaybackDrain(batchInfo: any, source: string): any {
        if (!batchInfo || batchInfo.queued !== true) return createPlaybackRequest(false, null, batchInfo);
        const drain = resolveNetworkPlaybackDrain();
        if (typeof drain !== 'function') {
            emitTelemetry('snapshot_playback_drain_unavailable', {
                source,
                networkPlaybackBatchId: batchInfo.networkPlaybackBatchId || '',
                playbackEventCount: batchInfo.playbackEventCount || 0
            });
            return createPlaybackRequest(false, null, batchInfo);
        }
        try {
            const result = drain({
                source,
                reason: 'network_snapshot_playback_ready',
                networkPlaybackBatchId: batchInfo.networkPlaybackBatchId || ''
            });
            emitTelemetry('snapshot_playback_drain_requested', {
                source,
                networkPlaybackBatchId: batchInfo.networkPlaybackBatchId || '',
                playbackEventCount: batchInfo.playbackEventCount || 0
            });
            return createPlaybackRequest(true, result, batchInfo);
        } catch (e) {
            emitTelemetry('snapshot_playback_drain_failed', {
                source,
                networkPlaybackBatchId: batchInfo.networkPlaybackBatchId || '',
                playbackEventCount: batchInfo.playbackEventCount || 0,
                error: e && (e as any).message ? String((e as any).message) : String(e || '')
            });
            return createPlaybackRequest(false, null, batchInfo);
        }
    }

    function requestNetworkPlaybackDirectDispatch(batchInfo: any, source: string): any {
        if (!batchInfo || batchInfo.queued !== true || !batchInfo.presentationEvent) {
            return createPlaybackRequest(false, null, batchInfo);
        }
        const handler = resolveNetworkPlaybackDirectHandler();
        const event = batchInfo.presentationEvent;
        const playbackEventCount = batchInfo.playbackEventCount || 0;
        const networkPlaybackBatchId = batchInfo.networkPlaybackBatchId || '';
        if (typeof handler !== 'function') {
            emitTelemetry('snapshot_playback_direct_dispatch_unavailable', {
                source,
                networkPlaybackBatchId,
                playbackEventCount,
                playbackEventTypes: getPlaybackEventTypes(event.events)
            });
            return createPlaybackRequest(false, null, batchInfo);
        }
        try {
            const result = handler(event);
            const removed = removeNetworkPlaybackBatchFromQueue(
                resolveGlobalObject('cardState'),
                networkPlaybackBatchId
            );
            emitTelemetry('snapshot_playback_direct_dispatch_requested', Object.assign({
                source,
                networkPlaybackBatchId,
                playbackEventCount,
                playbackEventTypes: getPlaybackEventTypes(event.events)
            }, removed, readPresentationQueueLengths(resolveGlobalObject('cardState'))));
            if (result && typeof result.catch === 'function') {
                result.catch((error: any) => {
                    emitTelemetry('snapshot_playback_direct_dispatch_failed', {
                        source,
                        networkPlaybackBatchId,
                        playbackEventCount,
                        playbackEventTypes: getPlaybackEventTypes(event.events),
                        error: error && error.message ? String(error.message) : String(error || '')
                    });
                });
            }
            return createPlaybackRequest(true, result, batchInfo);
        } catch (e) {
            emitTelemetry('snapshot_playback_direct_dispatch_failed', {
                source,
                networkPlaybackBatchId,
                playbackEventCount,
                playbackEventTypes: getPlaybackEventTypes(event.events),
                error: e && (e as any).message ? String((e as any).message) : String(e || '')
            });
            return createPlaybackRequest(false, null, batchInfo);
        }
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
        if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return null;
        const opts = (options && typeof options === 'object') ? options : {};
        const boardOps = resolveGlobalObject('BoardOps') || {};
        const cardStateRef = resolveGlobalObject('cardState');
        const source = opts.source || 'network_snapshot';
        const networkPlaybackBatchId = source + '_' + String(++networkPlaybackBatchSeq);
        const ev = {
            type: 'PLAYBACK_EVENTS',
            events: playbackEvents,
            meta: {
                source,
                suppressPlayback: opts.suppressPlayback === true,
                networkPlaybackBatchId
            }
        };
        try {
            let queued = false;
            let queueMethod = 'none';
            if (boardOps && typeof boardOps.emitPresentationEvent === 'function') {
                try {
                    boardOps.emitPresentationEvent(cardStateRef, ev);
                    queued = true;
                    queueMethod = 'board_ops';
                } catch (e) {
                    emitTelemetry('snapshot_playback_events_board_ops_enqueue_failed', {
                        source,
                        suppressPlayback: opts.suppressPlayback === true,
                        playbackEventCount: playbackEvents.length,
                        networkPlaybackBatchId,
                        error: e && (e as any).message ? String((e as any).message) : String(e || '')
                    });
                    queued = appendPlaybackPresentationEventDirect(cardStateRef, ev);
                    queueMethod = queued ? 'direct_card_state_queue_after_board_ops_failure' : 'none';
                }
            } else {
                queued = appendPlaybackPresentationEventDirect(cardStateRef, ev);
                queueMethod = queued ? 'direct_card_state_queue' : 'none';
            }
            const queueLengths = readPresentationQueueLengths(cardStateRef);
            emitTelemetry('snapshot_playback_events_enqueued', Object.assign({
                source,
                suppressPlayback: opts.suppressPlayback === true,
                playbackEventCount: playbackEvents.length,
                queued,
                queueMethod,
                networkPlaybackBatchId
            }, queueLengths));
            if (!queued) {
                emitTelemetry('snapshot_playback_events_enqueue_failed', {
                    source,
                    suppressPlayback: opts.suppressPlayback === true,
                    playbackEventCount: playbackEvents.length,
                    networkPlaybackBatchId,
                    reason: 'presentation_queue_unavailable'
                });
            }
            return {
                queued,
                queueMethod,
                networkPlaybackBatchId,
                playbackEventCount: playbackEvents.length,
                presentationEvent: ev
            };
        } catch (e) {
            emitTelemetry('snapshot_playback_events_enqueue_failed', {
                source,
                suppressPlayback: opts.suppressPlayback === true,
                playbackEventCount: playbackEvents.length,
                networkPlaybackBatchId,
                error: e && (e as any).message ? String((e as any).message) : String(e || '')
            });
            return {
                queued: false,
                queueMethod: 'none',
                networkPlaybackBatchId,
                playbackEventCount: playbackEvents.length,
                presentationEvent: ev
            };
        }
    }

    function clearTransientPresentationQueues(cardStateRef: any): void {
        snapshotPresentationModule.clearTransientPresentationQueues(cardStateRef);
    }

    function captureTransientPresentationQueues(cardStateRef: any): any {
        return snapshotPresentationModule.captureTransientPresentationQueues(cardStateRef, cloneData);
    }

    function isVisualPlaybackActive(): boolean {
        const playbackState = resolvePlaybackStateModule();
        try {
            if (playbackState && typeof playbackState.getPlaybackActive === 'function') {
                return playbackState.getPlaybackActive() === true;
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    function hasPendingPresentationEvents(source: any): boolean {
        const playbackState = resolvePlaybackStateModule();
        if (playbackState && typeof playbackState.hasPendingPresentationEvents === 'function') {
            return playbackState.hasPendingPresentationEvents(source);
        }
        return snapshotPresentationModule.hasPendingPresentationEvents(source);
    }

    function readBusyStateSnapshot(): any {
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

    function getPlaybackStartedAt(): any {
        if (runtime && typeof runtime.getPlaybackStartedAt === 'function') {
            return runtime.getPlaybackStartedAt();
        }
        return null;
    }

    function isPlaybackEngineRunning(): any {
        if (runtime && typeof runtime.isPlaybackEngineRunning === 'function') {
            return runtime.isPlaybackEngineRunning();
        }
        return null;
    }

    function getStalePlaybackTimeoutMs(): number {
        if (runtime && typeof runtime.getStalePlaybackTimeoutMs === 'function') {
            return runtime.getStalePlaybackTimeoutMs();
        }
        return 3500;
    }

    function reconcilePresentationQueues(cardStateRef: any, options: any): any {
        return snapshotPresentationModule.reconcilePresentationQueues(cardStateRef, options);
    }

    function shouldReleaseRestoredQueueBusyState(cardStateRef: any, presentationState: any, busyStateBeforeSnapshot: any): boolean {
        return snapshotPresentationModule.shouldReleaseRestoredQueueBusyState({
            cardStateRef,
            presentationState,
            busyStateBeforeSnapshot,
            isPlaybackEngineRunning,
            isVisualPlaybackActive,
            cloneData
        });
    }

    function shouldReleaseStalePlaybackLockAfterSnapshot(cardStateRef: any, presentationState: any): boolean {
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

    function shouldReleaseUnclaimedPlaybackBusyState(cardStateRef: any, playbackEvents: any[]): boolean {
        return snapshotPresentationModule.shouldReleaseUnclaimedPlaybackBusyState({
            cardStateRef,
            playbackEvents,
            isVisualPlaybackActive,
            isPlaybackEngineRunning,
            getPlaybackStartedAt,
            cloneData
        });
    }

    function shouldClearUndrainedPlaybackQueues(cardStateRef: any, playbackEvents: any[], options: any): boolean {
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

    function hasPendingPlaybackOrPresentation(): boolean {
        const cardStateRef = resolveGlobalObject('cardState');
        try {
            const visualPlayback = isVisualPlaybackActive();
            return visualPlayback || hasPendingPresentationEvents(cardStateRef);
        } catch (e) {
            return isVisualPlaybackActive();
        }
    }

    function armBoardUpdateDuringPlayback(source: string, reason: string): boolean {
        const runtimeRef = resolveBoardUpdateSyncRuntime();
        if (!runtimeRef || typeof runtimeRef.armBoardUpdateSyncContext !== 'function') return false;
        try {
            return !!runtimeRef.armBoardUpdateSyncContext({
                allowBoardUpdateDuringPlayback: true,
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
        if (!playbackRequestStarted(request)) return false;
        const networkPlaybackBatchId = request.networkPlaybackBatchId || '';
        const playbackEventCount = request.playbackEventCount || 0;
        const runRefresh = () => {
            emitTelemetry('snapshot_playback_post_playback_refresh_requested', {
                source,
                networkPlaybackBatchId,
                playbackEventCount
            });
            refreshUi({
                deferCardUiUntilPlaybackIdle: false
            });
        };
        emitTelemetry('snapshot_playback_board_refresh_deferred', {
            source,
            networkPlaybackBatchId,
            playbackEventCount
        });
        const result = request.result;
        if (result && typeof result.finally === 'function') {
            Promise.resolve(result)
                .finally(runRefresh)
                .catch(() => { /* direct/drain telemetry already records playback failures */ });
            return true;
        }
        setTimeout(runRefresh, 0);
        return true;
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
                const injectedRenderBoard = (typeof cfg.renderBoard === 'function')
                    ? cfg.renderBoard
                    : null;
                if (injectedEmitBoardUpdate) {
                    injectedEmitBoardUpdate({
                        source: 'network_snapshot',
                        reason: 'snapshot_refresh'
                    });
                    boardUpdateRequested = true;
                } else if (injectedRenderBoard) {
                    injectedRenderBoard();
                    boardUpdateRequested = true;
                } else {
                    const boardUpdateDispatch = resolveBoardUpdateDispatch();
                    if (boardUpdateDispatch && typeof boardUpdateDispatch.requestBoardUpdate === 'function') {
                        boardUpdateRequested = boardUpdateDispatch.requestBoardUpdate({
                            emitBoardUpdate: cfg.emitBoardUpdate,
                            renderBoard: cfg.renderBoard,
                            source: 'network_snapshot',
                            reason: 'snapshot_refresh'
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

        maybeShowResultFromSnapshot(nextVersion, opts);
        const deferImmediateBoardRefreshForPlayback =
            playbackEvents.length > 0 && playbackRequestStarted(networkPlaybackRequest);
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
        } else if (opts.clearUndrainedPlayback === true && refreshState && refreshState.boardUpdateRequested === true && shouldClearUndrainedPlaybackQueues(cardStateRef, playbackEvents, opts)) {
            clearTransientPresentationQueues(cardStateRef);
            clearBusyStateAndPlaybackLock();
        } else if (opts.releaseUnclaimedPlayback === true && shouldReleaseUnclaimedPlaybackBusyState(cardStateRef, playbackEvents)) {
            clearBusyStateAndPlaybackLock();
        } else if (shouldReleaseRestoredQueueBusyState(cardStateRef, presentationState, busyStateBeforeSnapshot)) {
            clearTransientPresentationQueues(cardStateRef);
            setBusyState(false);
        }
        if (shouldReleaseStalePlaybackLockAfterSnapshot(cardStateRef, presentationState)) {
            clearBusyStateAndPlaybackLock();
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

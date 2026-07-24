'use strict';

function createNetworkSnapshotPlaybackController(deps: any): any {
    const cfg = deps && deps.cfg && typeof deps.cfg === 'object' ? deps.cfg : {};
    const rootRef = deps && deps.rootRef ? deps.rootRef : (typeof globalThis !== 'undefined' ? globalThis : null);
    let networkPlaybackBatchSeq = 0;

    function emitTelemetry(type: string, details: any): void {
        if (!deps || typeof deps.emitTelemetry !== 'function') return;
        deps.emitTelemetry(type, details || {});
    }

    function resolveGlobalObject(name: string): any {
        return deps && typeof deps.resolveGlobalObject === 'function'
            ? deps.resolveGlobalObject(name)
            : null;
    }

    function resolveGlobalFunction(name: string, injected: any): any {
        return deps && typeof deps.resolveGlobalFunction === 'function'
            ? deps.resolveGlobalFunction(name, injected)
            : (typeof injected === 'function' ? injected : null);
    }

    function resolvePlaybackStateModule(): any {
        return deps && typeof deps.resolvePlaybackStateModule === 'function'
            ? deps.resolvePlaybackStateModule()
            : null;
    }

    function setGlobalFlag(name: string, value: any): void {
        if (deps && typeof deps.setGlobalFlag === 'function') {
            deps.setGlobalFlag(name, value);
        }
    }

    function setGlobalValue(name: string, value: any): void {
        if (deps && typeof deps.setGlobalValue === 'function') {
            deps.setGlobalValue(name, value);
        }
    }

    function setBusyState(active: boolean): boolean {
        return deps && typeof deps.setBusyState === 'function'
            ? deps.setBusyState(active === true)
            : false;
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

    function emitPlaybackEvents(playbackEvents: any[], options: any): any {
        if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return null;
        const opts = (options && typeof options === 'object') ? options : {};
        const boardOps = resolveGlobalObject('BoardOps') || {};
        const cardStateRef = resolveGlobalObject('cardState');
        const source = opts.source || 'network_snapshot';
        const strictNetworkPlayback = opts.strictNetworkPlayback === true
            && Number.isInteger(Number(opts.visualSeq))
            && Number(opts.visualSeq) >= 0;
        const networkPlaybackBatchId = source + '_' + String(++networkPlaybackBatchSeq);
        const ev = {
            type: 'PLAYBACK_EVENTS',
            events: playbackEvents,
            meta: {
                source,
                suppressPlayback: opts.suppressPlayback === true,
                strictNetworkPlayback,
                visualSeq: strictNetworkPlayback ? Math.trunc(Number(opts.visualSeq)) : null,
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
        const snapshotPresentationModule = deps && deps.snapshotPresentationModule;
        return snapshotPresentationModule && typeof snapshotPresentationModule.hasPendingPresentationEvents === 'function'
            ? snapshotPresentationModule.hasPendingPresentationEvents(source)
            : false;
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
        const runtime = deps && deps.runtime;
        if (runtime && typeof runtime.getPlaybackStartedAt === 'function') {
            return runtime.getPlaybackStartedAt();
        }
        return null;
    }

    function isPlaybackEngineRunning(): any {
        const runtime = deps && deps.runtime;
        if (runtime && typeof runtime.isPlaybackEngineRunning === 'function') {
            return runtime.isPlaybackEngineRunning();
        }
        return null;
    }

    function getStalePlaybackTimeoutMs(): number {
        const runtime = deps && deps.runtime;
        if (runtime && typeof runtime.getStalePlaybackTimeoutMs === 'function') {
            return runtime.getStalePlaybackTimeoutMs();
        }
        return 3500;
    }

    function clearBusyStateAndPlaybackLock(): boolean {
        const runtime = deps && deps.runtime;
        const playbackState = resolvePlaybackStateModule();
        let preservedBoardUpdateContext: any = null;
        try {
            if (playbackState && typeof playbackState.getBoardUpdateContext === 'function') {
                preservedBoardUpdateContext = playbackState.getBoardUpdateContext();
            }
        } catch (e) { /* ignore */ }

        if (runtime && typeof runtime.clearBusyStateAndPlaybackLock === 'function') {
            runtime.clearBusyStateAndPlaybackLock();
        }

        try {
            if (
                preservedBoardUpdateContext
                && playbackState
                && typeof playbackState.armBoardUpdateContext === 'function'
            ) {
                playbackState.armBoardUpdateContext(preservedBoardUpdateContext);
            }
        } catch (e) { /* ignore */ }

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

    function armPlaybackLockForIncomingPlayback(): boolean {
        const playbackState = resolvePlaybackStateModule();
        const startedAt = Date.now();
        if (playbackState && typeof playbackState.setBusyState === 'function') {
            playbackState.setBusyState({
                processing: true,
                cardAnimating: true,
                playbackActive: true
            });
            if (typeof playbackState.setPlaybackStartedAt === 'function') {
                playbackState.setPlaybackStartedAt(startedAt);
            } else {
                setGlobalValue('__playbackActiveSince', startedAt);
            }
            return true;
        }
        setGlobalFlag('isProcessing', true);
        setGlobalFlag('isCardAnimating', true);
        setGlobalFlag('VisualPlaybackActive', true);
        setGlobalValue('__playbackActiveSince', startedAt);
        return true;
    }

    function createDefaultSnapshotPlaybackSettlement(): any {
        return {
            clearPlaybackLock: false,
            clearTransientPresentationQueues: false,
            setBusyFalse: false,
            keepBusy: false,
            reason: null
        };
    }

    function resolveSnapshotPlaybackSettlement(cardStateRef: any, details: any, refreshState: any, opts: any): any {
        const playbackState = resolvePlaybackStateModule();
        const playbackStateManagerModule = deps && deps.playbackStateManagerModule;
        const settlementOwner = (
            playbackState
            && typeof playbackState.resolveSnapshotPlaybackSettlement === 'function'
        )
            ? playbackState
            : (
                playbackStateManagerModule
                && typeof playbackStateManagerModule.resolveSnapshotPlaybackSettlement === 'function'
                    ? playbackStateManagerModule
                    : null
            );
        if (!settlementOwner) return createDefaultSnapshotPlaybackSettlement();
        try {
            return settlementOwner.resolveSnapshotPlaybackSettlement({
                cardState: cardStateRef,
                playbackEvents: Array.isArray(details && details.playbackEvents) ? details.playbackEvents : [],
                presentationState: details && details.presentationState ? details.presentationState : {},
                busyStateBeforeSnapshot: details && details.busyStateBeforeSnapshot ? details.busyStateBeforeSnapshot : null,
                releaseUnclaimedPlayback: opts && opts.releaseUnclaimedPlayback === true,
                clearUndrainedPlayback: opts && opts.clearUndrainedPlayback === true,
                boardUpdateRequested: refreshState && refreshState.boardUpdateRequested === true,
                force: opts && opts.force === true,
                playbackActive: isVisualPlaybackActive(),
                playbackStartedAt: getPlaybackStartedAt(),
                playbackRunning: isPlaybackEngineRunning(),
                stalePlaybackTimeoutMs: getStalePlaybackTimeoutMs()
            }) || createDefaultSnapshotPlaybackSettlement();
        } catch (e) {
            emitTelemetry('snapshot_playback_settlement_failed', {
                error: e && (e as any).message ? String((e as any).message) : String(e || '')
            });
            return createDefaultSnapshotPlaybackSettlement();
        }
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

    function requestDeferredBoardRefreshAfterPlayback(request: any, source: string): boolean {
        if (!playbackRequestStarted(request)) return false;
        const networkPlaybackBatchId = request.networkPlaybackBatchId || '';
        const playbackEventCount = request.playbackEventCount || 0;
        const releaseSettledPlaybackLock = () => {
            const cardStateRef = resolveGlobalObject('cardState');
            const busyState = readBusyStateSnapshot();
            const playbackRunning = isPlaybackEngineRunning();
            const hasPendingEvents = hasPendingPresentationEvents(cardStateRef);
            if (playbackRunning === true || hasPendingEvents === true) return false;
            if (
                busyState.processing !== true
                && busyState.cardAnimating !== true
                && busyState.playbackActive !== true
            ) {
                return false;
            }
            clearBusyStateAndPlaybackLock();
            emitTelemetry('snapshot_playback_lock_released_after_settle', {
                source,
                networkPlaybackBatchId,
                playbackEventCount,
                playbackRunning,
                hadProcessing: busyState.processing === true,
                hadCardAnimating: busyState.cardAnimating === true,
                hadPlaybackActive: busyState.playbackActive === true
            });
            return true;
        };
        const runRefresh = () => {
            emitTelemetry('snapshot_playback_post_playback_refresh_requested', {
                source,
                networkPlaybackBatchId,
                playbackEventCount
            });
            releaseSettledPlaybackLock();
            if (deps && typeof deps.refreshUi === 'function') {
                deps.refreshUi({
                    deferCardUiUntilPlaybackIdle: false
                });
            }
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

    return {
        armPlaybackLockForIncomingPlayback,
        clearBusyStateAndPlaybackLock,
        emitPlaybackEvents,
        getPlaybackStartedAt,
        getStalePlaybackTimeoutMs,
        hasPendingPresentationEvents,
        hasPendingPlaybackOrPresentation,
        isPlaybackEngineRunning,
        isVisualPlaybackActive,
        playbackRequestStarted,
        readBusyStateSnapshot,
        requestDeferredBoardRefreshAfterPlayback,
        requestNetworkPlaybackDirectDispatch,
        requestNetworkPlaybackDrain,
        resolveSnapshotPlaybackSettlement
    };
}

const NetworkSnapshotPlaybackModule = {
    createNetworkSnapshotPlaybackController
};

export = NetworkSnapshotPlaybackModule;

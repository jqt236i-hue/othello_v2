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

        function resolveState() {
            return (typeof cfg.getState === 'function' && cfg.getState()) || {};
        }

        function resolveGlobalObject(name) {
            try {
                if (typeof globalThis !== 'undefined' && globalThis[name] && typeof globalThis[name] === 'object') {
                    return globalThis[name];
                }
            } catch (e) { /* ignore */ }

            try {
                if (rootRef && rootRef[name] && typeof rootRef[name] === 'object') {
                    return rootRef[name];
                }
            } catch (e) { /* ignore */ }

            return null;
        }

        function resolveGlobalFunction(name, injected) {
            if (typeof injected === 'function') return injected;

            try {
                if (rootRef && typeof rootRef[name] === 'function') {
                    return rootRef[name].bind(rootRef);
                }
            } catch (e) { /* ignore */ }

            try {
                if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') {
                    return globalThis[name].bind(globalThis);
                }
            } catch (e) { /* ignore */ }

            return null;
        }

        function setGlobalFlag(name, value) {
            try {
                if (typeof globalThis !== 'undefined') {
                    globalThis[name] = value;
                }
            } catch (e) { /* ignore */ }

            try {
                if (rootRef) {
                    rootRef[name] = value;
                }
            } catch (e) { /* ignore */ }
        }

        function resolvePlaybackStateModule() {
            if (cfg.playbackState && typeof cfg.playbackState === 'object') {
                return cfg.playbackState;
            }

            try {
                if (rootRef && rootRef.PlaybackStateManager && typeof rootRef.PlaybackStateManager === 'object') {
                    return rootRef.PlaybackStateManager;
                }
            } catch (e) { /* ignore */ }

            try {
                if (typeof globalThis !== 'undefined' && globalThis.PlaybackStateManager && typeof globalThis.PlaybackStateManager === 'object') {
                    return globalThis.PlaybackStateManager;
                }
            } catch (e) { /* ignore */ }

            try {
                if (typeof require === 'function') {
                    return require('../playback-state-manager');
                }
            } catch (e) { /* ignore */ }

            return null;
        }

        function setBusyState(active) {
            const playbackState = resolvePlaybackStateModule();
            if (playbackState && typeof playbackState.setBusyState === 'function') {
                playbackState.setBusyState({
                    processing: active === true,
                    cardAnimating: active === true
                });
                return;
            }

            if (playbackState && typeof playbackState.setProcessing === 'function') {
                playbackState.setProcessing(active === true);
            } else {
                setGlobalFlag('isProcessing', active === true);
            }

            if (playbackState && typeof playbackState.setCardAnimating === 'function') {
                playbackState.setCardAnimating(active === true);
            } else {
                setGlobalFlag('isCardAnimating', active === true);
            }
        }

        function cloneData(value) {
            try {
                if (typeof globalThis !== 'undefined' && typeof globalThis.structuredClone === 'function') {
                    return globalThis.structuredClone(value);
                }
            } catch (e) { /* ignore */ }
            return JSON.parse(JSON.stringify(value));
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

            try {
                if (typeof globalThis !== 'undefined') {
                    globalThis[targetName] = source;
                    return;
                }
            } catch (e) { /* ignore */ }

            try {
                if (rootRef) {
                    rootRef[targetName] = source;
                }
            } catch (e) { /* ignore */ }
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

        function reconcilePresentationQueues(cardStateRef, options) {
            const opts = (options && typeof options === 'object') ? options : {};
            const preservedQueues = opts.preservedQueues || {
                presentationEvents: [],
                persistentEvents: [],
                hasPending: false
            };
            const playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [];
            const shadowPlaybackEvents = Array.isArray(opts.shadowPlaybackEvents) ? opts.shadowPlaybackEvents : [];
            const hasPlaybackEvents = playbackEvents.length > 0;
            const shouldEmitShadowPlayback = !hasPlaybackEvents && !preservedQueues.hasPending && shadowPlaybackEvents.length > 0;

            if (hasPlaybackEvents || shouldEmitShadowPlayback) {
                clearTransientPresentationQueues(cardStateRef);
            } else if (preservedQueues.hasPending) {
                restoreTransientPresentationQueues(cardStateRef, preservedQueues);
            } else {
                clearTransientPresentationQueues(cardStateRef);
            }

            return {
                hasPlaybackEvents,
                shouldEmitShadowPlayback,
                // Shadow playback with suppressPlayback=true returns immediately
                // without running AnimationEngine, so it should not keep busy.
                shouldKeepBusy: hasPlaybackEvents || preservedQueues.hasPending
            };
        }

        function hasPendingPlaybackOrPresentation() {
            const cardStateRef = resolveGlobalObject('cardState');
            try {
                const visualPlayback = !!(rootRef && rootRef.VisualPlaybackActive === true);
                const pendingPersist = !!(cardStateRef && Array.isArray(cardStateRef._presentationEventsPersist) && cardStateRef._presentationEventsPersist.length > 0);
                const pendingLive = !!(cardStateRef && Array.isArray(cardStateRef.presentationEvents) && cardStateRef.presentationEvents.length > 0);
                return visualPlayback || pendingPersist || pendingLive;
            } catch (e) {
                return !!(rootRef && rootRef.VisualPlaybackActive === true);
            }
        }

        function renderCardUiAfterPlaybackIfNeeded() {
            const pending = hasPendingPlaybackOrPresentation();
            const renderCardUI = resolveGlobalFunction('renderCardUI', cfg.renderCardUI);

            try {
                if (!renderCardUI) return;
                if (!pending) {
                    renderCardUI();
                    return;
                }

                const waitForPlaybackFn = (rootRef && typeof rootRef.waitForPlaybackIdle === 'function')
                    ? rootRef.waitForPlaybackIdle
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
            try {
                const emitCardStateChange = resolveGlobalFunction('emitCardStateChange', cfg.emitCardStateChange);
                if (emitCardStateChange) emitCardStateChange();
            } catch (e) { /* ignore */ }
            try {
                const emitGameStateChange = resolveGlobalFunction('emitGameStateChange', cfg.emitGameStateChange);
                if (emitGameStateChange) emitGameStateChange();
            } catch (e) { /* ignore */ }
            try {
                const emitBoardUpdate = resolveGlobalFunction('emitBoardUpdate', cfg.emitBoardUpdate);
                const renderBoard = resolveGlobalFunction('renderBoard', cfg.renderBoard);
                if (emitBoardUpdate) emitBoardUpdate();
                else if (renderBoard) renderBoard();
            } catch (e) { /* ignore */ }
            renderCardUiAfterPlaybackIfNeeded();
        }

        function dismissResultOverlayIfPresent() {
            try {
                const doc = (rootRef && rootRef.document) || (typeof document !== 'undefined' ? document : null);
                if (!doc) return;
                const overlay = doc.getElementById('result-overlay');
                if (overlay && overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            } catch (e) { /* ignore */ }
        }

        function maybeShowResultFromSnapshot(nextVersion, options) {
            const opts = options || {};
            const state = resolveState();
            if (opts.skipResultOverlay) return;

            let terminal = false;
            try {
                const isGameOver = resolveGlobalFunction('isGameOver', cfg.isGameOver);
                const gameStateRef = resolveGlobalObject('gameState');
                terminal = !!(isGameOver && gameStateRef && isGameOver(gameStateRef));
            } catch (e) {
                terminal = false;
            }

            if (!terminal) {
                state.resultShownForUnversioned = false;
                dismissResultOverlayIfPresent();
                return;
            }

            if (nextVersion !== null) {
                if (state.lastResultVersionShown === nextVersion) return;
                state.lastResultVersionShown = nextVersion;
            } else {
                if (state.resultShownForUnversioned) return;
                state.resultShownForUnversioned = true;
            }

            try {
                const gameStateRef = resolveGlobalObject('gameState');
                if (gameStateRef && typeof gameStateRef === 'object') {
                    gameStateRef.__resultShown = false;
                }
            } catch (e) { /* ignore */ }

            try {
                const showResult = resolveGlobalFunction('showResult', cfg.showResult);
                if (showResult) {
                    showResult();
                    return;
                }
            } catch (e) { /* ignore */ }

            try {
                const showResultOverlay = resolveGlobalFunction('showResultOverlay', cfg.showResultOverlay);
                if (showResultOverlay) showResultOverlay();
            } catch (e) { /* ignore */ }
        }

        function applySnapshot(snapshot, options) {
            const opts = options || {};
            const state = resolveState();
            const shadowPlaybackEvents = Array.isArray(opts.shadowPlaybackEvents) ? opts.shadowPlaybackEvents : [];

            if (!snapshot || typeof snapshot !== 'object') return false;

            const nextVersion = Number.isFinite(Number(snapshot.stateVersion))
                ? Number(snapshot.stateVersion)
                : null;

            if (!opts.force && nextVersion !== null && state.stateVersion !== null && nextVersion <= state.stateVersion) {
                if (opts.allowStaleShadowPlayback === true && shadowPlaybackEvents.length > 0) {
                    emitPlaybackEvents(shadowPlaybackEvents, {
                        source: opts.shadowPlaybackSource || 'self_snapshot_sync',
                        suppressPlayback: true
                    });
                    setBusyState(true);
                    refreshUi();
                    return true;
                }
                return false;
            }

            if (!snapshot.gameState || !snapshot.cardState) return false;

            const preservedQueues = captureTransientPresentationQueues(resolveGlobalObject('cardState'));
            const playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [];

            replaceObjectState('gameState', snapshot.gameState);
            replaceObjectState('cardState', snapshot.cardState);
            try {
                const ensureLegacyMarkers = resolveGlobalFunction('ensureLegacyMarkers', cfg.ensureLegacyMarkers);
                const cardStateRef = resolveGlobalObject('cardState');
                if (ensureLegacyMarkers && cardStateRef) ensureLegacyMarkers(cardStateRef);
            } catch (e) { /* ignore */ }

            const cardStateRef = resolveGlobalObject('cardState');
            const syncPendingSelectionActionCache = resolveGlobalFunction('syncPendingSelectionActionCache', cfg.syncPendingSelectionActionCache);
            if (syncPendingSelectionActionCache && cardStateRef) {
                try {
                    syncPendingSelectionActionCache(cardStateRef.pendingEffectByPlayer || null);
                } catch (e) { /* ignore */ }
            }

            const presentationState = reconcilePresentationQueues(cardStateRef, {
                preservedQueues,
                playbackEvents,
                shadowPlaybackEvents
            });
            const shouldEmitShadowPlayback = presentationState.shouldEmitShadowPlayback;

            if (nextVersion !== null) {
                state.stateVersion = nextVersion;
            }

            setBusyState(presentationState.shouldKeepBusy);
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
            refreshUi();

            // After refreshUi consumed the suppressed shadow events for
            // diff-renderer's move-source detection, clear them so
            // _hasPendingPlaybackEventsForBoardRenderer() does not
            // permanently block future renderBoard() calls.
            if (shouldEmitShadowPlayback) {
                clearTransientPresentationQueues(cardStateRef);
            }
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

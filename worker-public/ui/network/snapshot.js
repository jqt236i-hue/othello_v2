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

        function setGlobalValue(name, value) {
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
            if (!playbackState || typeof playbackState !== 'object') return false;
            if (typeof playbackState.setBusyState === 'function') {
                playbackState.setBusyState({
                    processing: active === true,
                    cardAnimating: active === true
                });
                return true;
            }

            if (typeof playbackState.setProcessing === 'function') {
                playbackState.setProcessing(active === true);
            }
            if (typeof playbackState.setCardAnimating === 'function') {
                playbackState.setCardAnimating(active === true);
            }
            return true;
        }

        function clearBusyStateAndPlaybackLock() {
            const playbackState = resolvePlaybackStateModule();
            if (playbackState && typeof playbackState.clearPlaybackLock === 'function') {
                playbackState.clearPlaybackLock();
                return true;
            }

            setBusyState(false);
            setGlobalFlag('isProcessing', false);
            setGlobalFlag('isCardAnimating', false);
            setGlobalFlag('VisualPlaybackActive', false);
            setGlobalValue('__playbackActiveSince', null);

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
            return {
                authority: String(meta.authority || '').trim().toLowerCase(),
                version: Number.isFinite(Number(meta.version)) ? Number(meta.version) : null,
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
                return false;
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
            const playbackState = resolvePlaybackStateModule();
            try {
                if (playbackState && typeof playbackState.getPlaybackStartedAt === 'function') {
                    const startedAt = Number(playbackState.getPlaybackStartedAt());
                    return Number.isFinite(startedAt) ? startedAt : null;
                }
            } catch (e) { /* ignore */ }

            const startedAt = Number(rootRef && rootRef.__playbackActiveSince);
            return Number.isFinite(startedAt) ? startedAt : null;
        }

        function isPlaybackEngineRunning() {
            try {
                if (
                    rootRef
                    && rootRef.AnimationEngine
                    && typeof rootRef.AnimationEngine.isPlaying === 'boolean'
                ) {
                    return rootRef.AnimationEngine.isPlaying === true;
                }
            } catch (e) { /* ignore */ }
            return null;
        }

        function getStalePlaybackTimeoutMs() {
            const timeoutMs = Number(rootRef && rootRef.PASS_STALE_PLAYBACK_MS);
            if (Number.isFinite(timeoutMs) && timeoutMs > 0) return timeoutMs;
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
            const hasPlaybackEvents = playbackEvents.length > 0;
            const shouldEmitShadowPlayback = !hasPlaybackEvents && !preservedQueues.hasPending && shadowPlaybackEvents.length > 0;
            const restoredPreservedQueues = !hasPlaybackEvents && !shouldEmitShadowPlayback && preservedQueues.hasPending;

            if (hasPlaybackEvents || shouldEmitShadowPlayback) {
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
                shouldKeepBusy: hasPlaybackEvents || preservedQueues.hasPending,
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
            if (hadBusyBeforeSnapshot) return false;
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

        function hasPendingPlaybackOrPresentation() {
            const cardStateRef = resolveGlobalObject('cardState');
            try {
                const visualPlayback = isVisualPlaybackActive();
                const pendingPersist = !!(cardStateRef && Array.isArray(cardStateRef._presentationEventsPersist) && cardStateRef._presentationEventsPersist.length > 0);
                const pendingLive = !!(cardStateRef && Array.isArray(cardStateRef.presentationEvents) && cardStateRef.presentationEvents.length > 0);
                return visualPlayback || pendingPersist || pendingLive;
            } catch (e) {
                return isVisualPlaybackActive();
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

            if (!snapshot || typeof snapshot !== 'object') {
                emitTelemetry('snapshot_invalid_shape_rejected', { reason: 'invalid_snapshot' });
                return false;
            }

            if (shouldRejectSnapshotByAuthority(snapshot, state, opts)) {
                return false;
            }

            const snapshotMeta = getSnapshotMeta(snapshot);
            const nextVersion = getSnapshotVersion(snapshot);

            if (!opts.force && nextVersion === null) {
                emitTelemetry('snapshot_missing_state_version_rejected', {
                    force: false
                });
                return false;
            }

            if (!opts.force && nextVersion !== null && state.stateVersion !== null && nextVersion <= state.stateVersion) {
                if (opts.allowStaleShadowPlayback === true && shadowPlaybackEvents.length > 0) {
                    emitTelemetry('snapshot_shadow_playback_emitted', {
                        nextVersion,
                        currentVersion: state.stateVersion,
                        shadowPlaybackCount: shadowPlaybackEvents.length
                    });
                    emitPlaybackEvents(shadowPlaybackEvents, {
                        source: opts.shadowPlaybackSource || 'self_snapshot_sync',
                        suppressPlayback: true
                    });
                    setBusyState(true);
                    refreshUi();
                    return true;
                }
                emitTelemetry('snapshot_stale_rejected', {
                    nextVersion,
                    currentVersion: state.stateVersion,
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

            const previousCardState = cloneData(resolveGlobalObject('cardState'));
            const preservedQueues = captureTransientPresentationQueues(resolveGlobalObject('cardState'));
            const busyStateBeforeSnapshot = readBusyStateSnapshot();
            const playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [];

            replaceObjectState('gameState', snapshot.gameState);
            replaceObjectState('cardState', snapshot.cardState);
            try {
                const ensureLegacyMarkers = resolveGlobalFunction('ensureLegacyMarkers', cfg.ensureLegacyMarkers);
                const cardStateRef = resolveGlobalObject('cardState');
                if (ensureLegacyMarkers && cardStateRef) ensureLegacyMarkers(cardStateRef);
            } catch (e) { /* ignore */ }

            const cardStateRef = resolveGlobalObject('cardState');
            const synthesizedChargeDeltaEvents = buildMissingChargeDeltaEvents(previousCardState, cardStateRef, opts);
            setTransientChargeDeltaEvents(synthesizedChargeDeltaEvents);
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
            if (state && state.authoritativeMatchState && typeof state.authoritativeMatchState === 'object') {
                state.authoritativeMatchState.stateVersion = nextVersion;
                state.authoritativeMatchState.authority = snapshotMeta ? snapshotMeta.authority : null;
                state.authoritativeMatchState.projectedForSeat = snapshotMeta ? snapshotMeta.projectedForSeat : null;
                state.authoritativeMatchState.turnStartReconciled = snapshotMeta ? snapshotMeta.turnStartReconciled : false;
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
            } else if (shouldReleaseRestoredQueueBusyState(cardStateRef, presentationState, busyStateBeforeSnapshot)) {
                clearTransientPresentationQueues(cardStateRef);
                setBusyState(false);
            }
            if (shouldReleaseStalePlaybackLockAfterSnapshot(cardStateRef, presentationState)) {
                clearBusyStateAndPlaybackLock();
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

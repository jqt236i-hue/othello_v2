(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.NetworkSnapshotPresentationModule = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function cloneData(value, cloneFn) {
        if (typeof cloneFn === 'function') {
            return cloneFn(value);
        }
        try {
            if (typeof globalThis !== 'undefined' && typeof globalThis.structuredClone === 'function') {
                return globalThis.structuredClone(value);
            }
        } catch (e) { /* ignore */ }
        return JSON.parse(JSON.stringify(value));
    }

    function clearTransientPresentationQueues(cardStateRef) {
        if (!cardStateRef || typeof cardStateRef !== 'object') return;
        if (!Array.isArray(cardStateRef.presentationEvents)) cardStateRef.presentationEvents = [];
        else cardStateRef.presentationEvents.length = 0;
        if (!Array.isArray(cardStateRef._presentationEventsPersist)) cardStateRef._presentationEventsPersist = [];
        else cardStateRef._presentationEventsPersist.length = 0;
    }

    function captureTransientPresentationQueues(cardStateRef, cloneFn) {
        if (!cardStateRef || typeof cardStateRef !== 'object') {
            return {
                presentationEvents: [],
                persistentEvents: [],
                hasPending: false
            };
        }

        const presentationEvents = Array.isArray(cardStateRef.presentationEvents)
            ? cloneData(cardStateRef.presentationEvents, cloneFn)
            : [];
        const persistentEvents = Array.isArray(cardStateRef._presentationEventsPersist)
            ? cloneData(cardStateRef._presentationEventsPersist, cloneFn)
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

    function hasPendingPresentationEvents(source) {
        const ref = (source && typeof source === 'object') ? source : {};
        const pendingPersist = Array.isArray(ref._presentationEventsPersist) ? ref._presentationEventsPersist.length > 0 : false;
        const pendingLive = Array.isArray(ref.presentationEvents) ? ref.presentationEvents.length > 0 : false;
        return pendingPersist || pendingLive;
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
            shouldKeepBusy: hasPlaybackEvents || (hasPendingPreservedQueues && !dropPreservedQueues),
            restoredPreservedQueues,
            restoredQueueSignature: restoredPreservedQueues
                ? getTransientPresentationQueueSignature(preservedQueues)
                : null
        };
    }

    function shouldReleaseRestoredQueueBusyState(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const presentationState = opts.presentationState || {};
        if (presentationState.restoredPreservedQueues !== true) return false;
        const busyStateBeforeSnapshot = opts.busyStateBeforeSnapshot || null;
        const hadBusyBeforeSnapshot = !!(
            busyStateBeforeSnapshot
            && (
                busyStateBeforeSnapshot.processing === true
                || busyStateBeforeSnapshot.cardAnimating === true
                || busyStateBeforeSnapshot.playbackActive === true
            )
        );
        const playbackEngineRunning = typeof opts.isPlaybackEngineRunning === 'function'
            ? opts.isPlaybackEngineRunning()
            : null;
        if (hadBusyBeforeSnapshot && playbackEngineRunning !== false) {
            return false;
        }
        if (typeof opts.isVisualPlaybackActive === 'function' && opts.isVisualPlaybackActive() === true) {
            return false;
        }

        const currentQueues = captureTransientPresentationQueues(opts.cardStateRef, opts.cloneData);
        if (!currentQueues.hasPending) return true;

        const currentSignature = getTransientPresentationQueueSignature(currentQueues);
        return !!presentationState.restoredQueueSignature
            && currentSignature === presentationState.restoredQueueSignature;
    }

    function shouldReleaseStalePlaybackLockAfterSnapshot(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const presentationState = opts.presentationState || {};
        if (presentationState.shouldKeepBusy === true) return false;
        if (typeof opts.isVisualPlaybackActive !== 'function' || opts.isVisualPlaybackActive() !== true) return false;

        const currentQueues = captureTransientPresentationQueues(opts.cardStateRef, opts.cloneData);
        if (currentQueues.hasPending) return false;

        const playbackRunning = typeof opts.isPlaybackEngineRunning === 'function'
            ? opts.isPlaybackEngineRunning()
            : null;
        if (playbackRunning === false) return true;
        if (playbackRunning === true) return false;

        const startedAt = typeof opts.getPlaybackStartedAt === 'function'
            ? opts.getPlaybackStartedAt()
            : null;
        if (!Number.isFinite(Number(startedAt))) return false;

        const nowMs = Number.isFinite(Number(opts.nowMs)) ? Number(opts.nowMs) : Date.now();
        const staleMs = Number.isFinite(Number(opts.stalePlaybackTimeoutMs))
            ? Math.max(1, Math.trunc(Number(opts.stalePlaybackTimeoutMs)))
            : 3500;
        return (nowMs - Number(startedAt)) > staleMs;
    }

    function shouldReleaseUnclaimedPlaybackBusyState(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [];
        if (playbackEvents.length === 0) return false;
        const playbackRunning = typeof opts.isPlaybackEngineRunning === 'function'
            ? opts.isPlaybackEngineRunning()
            : null;
        const startedAt = typeof opts.getPlaybackStartedAt === 'function'
            ? opts.getPlaybackStartedAt()
            : null;
        if (
            typeof opts.isVisualPlaybackActive === 'function'
            && opts.isVisualPlaybackActive() === true
            && playbackRunning === true
            && Number.isFinite(Number(startedAt))
        ) {
            return false;
        }

        const currentQueues = captureTransientPresentationQueues(opts.cardStateRef, opts.cloneData);
        if (currentQueues.hasPending) return false;

        return playbackRunning !== true;
    }

    function shouldClearUndrainedPlaybackQueues(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [];
        if (playbackEvents.length === 0) return false;
        if (opts.force === true) return false;
        const playbackRunning = typeof opts.isPlaybackEngineRunning === 'function'
            ? opts.isPlaybackEngineRunning()
            : null;
        const startedAt = typeof opts.getPlaybackStartedAt === 'function'
            ? opts.getPlaybackStartedAt()
            : null;
        if (
            typeof opts.isVisualPlaybackActive === 'function'
            && opts.isVisualPlaybackActive() === true
            && playbackRunning === true
            && Number.isFinite(Number(startedAt))
        ) {
            return false;
        }
        if (playbackRunning === true) return false;

        const currentQueues = captureTransientPresentationQueues(opts.cardStateRef, opts.cloneData);
        if (!currentQueues.hasPending) return false;

        const queueEntries = []
            .concat(Array.isArray(currentQueues.presentationEvents) ? currentQueues.presentationEvents : [])
            .concat(Array.isArray(currentQueues.persistentEvents) ? currentQueues.persistentEvents : []);
        if (queueEntries.length === 0) return false;
        return queueEntries.every((entry) => entry && entry.type === 'PLAYBACK_EVENTS');
    }

    return {
        clearTransientPresentationQueues,
        captureTransientPresentationQueues,
        restoreTransientPresentationQueues,
        getTransientPresentationQueueSignature,
        hasPendingPresentationEvents,
        reconcilePresentationQueues,
        shouldReleaseRestoredQueueBusyState,
        shouldReleaseStalePlaybackLockAfterSnapshot,
        shouldReleaseUnclaimedPlaybackBusyState,
        shouldClearUndrainedPlaybackQueues
    };
}));

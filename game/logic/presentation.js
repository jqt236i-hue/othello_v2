(function (root, factory) {
    const presentationModule = factory(root || (typeof globalThis !== 'undefined' ? globalThis : this));

    function registerPresentationHelper(target) {
        try {
            if (target && !target.PresentationHelper) {
                target.PresentationHelper = presentationModule;
            }
        } catch (e) { /* ignore */ }
    }

    function resolveRealmGlobal() {
        try {
            return Function('return this')();
        } catch (e) { /* ignore */ }
        return null;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = presentationModule;
    }

    registerPresentationHelper(root);
    registerPresentationHelper(typeof globalThis !== 'undefined' ? globalThis : null);
    registerPresentationHelper(typeof global !== 'undefined' ? global : null);
    registerPresentationHelper(root && root.global ? root.global : null);
    registerPresentationHelper(resolveRealmGlobal());
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    let warnedNoBoardOps = false;

    function emitPresentationEvent(cardState, ev) {
        try {
            if (root && root.BoardOps && typeof root.BoardOps.emitPresentationEvent === 'function') {
                root.BoardOps.emitPresentationEvent(cardState, ev);
                return true;
            }
        } catch (e) { /* ignore */ }

        try {
            if (!warnedNoBoardOps) {
                console.warn('[presentation] BoardOps.emitPresentationEvent not available (events will be persisted)');
                warnedNoBoardOps = true;
            }
        } catch (e) { /* ignore */ }

        try {
            if (cardState && Array.isArray(cardState._presentationEventsPersist)) {
                cardState._presentationEventsPersist.push(ev);
            } else if (cardState) {
                cardState._presentationEventsPersist = [ev];
            }
        } catch (e) { /* ignore persistence failures */ }

        return false;
    }

    function flushPersistedEvents() {
        try {
            if (!(root && root.BoardOps && typeof root.BoardOps.emitPresentationEvent === 'function')) return false;
            let flushedCount = 0;
            const cardStateRef = root && root.cardState ? root.cardState : null;

            if (typeof CardLogic !== 'undefined' && typeof CardLogic.flushPresentationEvents === 'function') {
                try {
                    const events = CardLogic.flushPresentationEvents(cardStateRef) || [];
                    for (const ev of events) {
                        try { root.BoardOps.emitPresentationEvent(cardStateRef, ev); } catch (e) { /* ignore */ }
                    }
                    flushedCount += events.length;
                } catch (e) { /* ignore and continue */ }
            }

            if (cardStateRef && Array.isArray(cardStateRef._presentationEventsPersist) && cardStateRef._presentationEventsPersist.length) {
                const persisted = cardStateRef._presentationEventsPersist.slice();
                cardStateRef._presentationEventsPersist.length = 0;
                for (const ev of persisted) {
                    try { root.BoardOps.emitPresentationEvent(cardStateRef, ev); } catch (e) { /* ignore */ }
                }
                flushedCount += persisted.length;
            }

            return flushedCount > 0;
        } catch (e) { /* ignore */ }
        return false;
    }

    return {
        emitPresentationEvent,
        flushPersistedEvents
    };
}));

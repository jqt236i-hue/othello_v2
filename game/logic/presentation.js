// Helper for emitting presentation events via BoardOps
let BoardOpsModule = null;
let __presentation_warned_no_boardops = false; // one-time warning flag
// Only forward to a UI-provided BoardOps (global). Do NOT assume internal board_ops counts as UI.
if (typeof globalThis !== 'undefined' && globalThis.BoardOps) {
    BoardOpsModule = globalThis.BoardOps;
} else {
    BoardOpsModule = null;
}
// Ensure a PresentationHelper is available on globalThis and Node `global` early so consumers can rely on it synchronously.
try {
    if (typeof globalThis !== 'undefined' && !globalThis.PresentationHelper) {
        globalThis.PresentationHelper = { emitPresentationEvent };
    }
} catch (e) { /* ignore */ }
// Fallback bridge: register a lightweight global PresentationHelper that delegates to the local emitter so
// Node tests see `global.PresentationHelper` synchronously even when `module.exports` wiring isn't complete.
try {
    if (typeof global !== 'undefined' && !global.PresentationHelper) {
        global.PresentationHelper = {
            emitPresentationEvent: function () {
                try {
                    // Prefer to call the local emitPresentationEvent function directly (hoisted function decl),
                    // this guarantees a synchronous, deterministic global in Node test environments.
                    return emitPresentationEvent.apply(null, arguments);
                } catch (e) { /* ignore */ }
                return false;
            }
        };
    }
} catch (e) { /* ignore */ }

// Force synchronous registration on both global surfaces to satisfy Node/Jest test expectations
try {
    if (typeof global !== 'undefined' && !global.PresentationHelper) {
        global.PresentationHelper = { emitPresentationEvent };
    }
} catch (e) { /* ignore */ }
try {
    if (typeof globalThis !== 'undefined' && !globalThis.PresentationHelper) {
        globalThis.PresentationHelper = { emitPresentationEvent };
    }
} catch (e) { /* ignore */ }

function emitPresentationEvent(cardState, ev) {
    // Always forward only to an explicitly provided global BoardOps (UI injectable). Do not forward to internal modules.
    try {
        if (typeof globalThis !== 'undefined' && globalThis.BoardOps && typeof globalThis.BoardOps.emitPresentationEvent === 'function') {
            globalThis.BoardOps.emitPresentationEvent(cardState, ev);
            return true;
        }
    } catch (e) { /* ignore */ }
    // Warn only once to avoid log noise during boot ordering races
    try {
        if (!__presentation_warned_no_boardops) {
            console.warn('[presentation] BoardOps.emitPresentationEvent not available (events will be persisted)');
            __presentation_warned_no_boardops = true;
        }
    } catch (e) { /* ignore */ }

    // Persist events so UI handlers which initialize later can still consume them via CardLogic.flushPresentationEvents
    try {
        if (cardState && Array.isArray(cardState._presentationEventsPersist)) {
            cardState._presentationEventsPersist.push(ev);
        } else if (cardState) {
            cardState._presentationEventsPersist = [ev];
        }
    } catch (e) { /* ignore persistence failures */ }

    // Ensure a PresentationHelper is registered synchronously for Node/Jest environments where
    // module-level registration may not land on the test runner's `global` surface.
    try { if (typeof global !== 'undefined' && !global.PresentationHelper) { global.PresentationHelper = { emitPresentationEvent }; } } catch (e) { }
    try { if (typeof globalThis !== 'undefined' && !globalThis.PresentationHelper) { globalThis.PresentationHelper = { emitPresentationEvent }; } } catch (e) { }
    return false;
}

// Attempt to flush persisted events if BoardOps becomes available. This can be invoked by UI bootstrap
// or tests to ensure persisted events are delivered once UI registers its BoardOps implementation.
function flushPersistedEvents() {
    try {
        if (!(typeof globalThis !== 'undefined' && globalThis.BoardOps && typeof globalThis.BoardOps.emitPresentationEvent === 'function')) return false;
        if (typeof CardLogic !== 'undefined' && typeof CardLogic.flushPresentationEvents === 'function') {
            try {
                const events = CardLogic.flushPresentationEvents(cardState) || [];
                for (const ev of events) {
                    try { globalThis.BoardOps.emitPresentationEvent(cardState, ev); } catch (e) { /* best-effort */ }
                }
                return events.length > 0;
            } catch (e) { return false; }
        }
        // As a fallback, if cardState._presentationEventsPersist exists, drain it
        if (cardState && Array.isArray(cardState._presentationEventsPersist) && cardState._presentationEventsPersist.length) {
            const persist = cardState._presentationEventsPersist.slice();
            cardState._presentationEventsPersist.length = 0;
            for (const ev of persist) {
                try { globalThis.BoardOps.emitPresentationEvent(cardState, ev); } catch (e) { /* ignore */ }
            }
            return true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

// Expose a canonical PresentationHelper on `globalThis` and Node `global` if not present so game modules
// and UI can rely on a single well-known entrypoint instead of re-declaring local shims.
try {
    if (typeof globalThis !== 'undefined') {
        if (!globalThis.PresentationHelper) {
            globalThis.PresentationHelper = { emitPresentationEvent };
        }
    }
} catch (e) { /* ignore global attach failures in some test envs */ }
try {
    if (typeof global !== 'undefined' && !global.PresentationHelper) {
        global.PresentationHelper = { emitPresentationEvent };
    }
} catch (e) { /* ignore */ }

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { emitPresentationEvent, flushPersistedEvents };
    try { if (typeof global !== 'undefined' && !global.PresentationHelper) { global.PresentationHelper = module.exports; console.log('[presentation] registered global.PresentationHelper'); } } catch (e) { }
    try { if (typeof globalThis !== 'undefined' && !globalThis.PresentationHelper) { globalThis.PresentationHelper = module.exports; console.log('[presentation] registered globalThis.PresentationHelper'); } } catch (e) { }
}

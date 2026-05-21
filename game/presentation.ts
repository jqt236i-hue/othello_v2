declare const __non_webpack_require__: NodeRequire | undefined;
declare var CardLogic: any;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

"use strict";
let warnedNoBoardOps = false;

function shouldWarnNoBoardOps(): boolean {
    return !(typeof process !== 'undefined' && !!process.env && !!process.env.JEST_WORKER_ID);
}

function emitPresentationEvent(cardState: any, ev: any): boolean {
    try {
        const root: any = (typeof globalThis !== 'undefined' ? globalThis : undefined); // globalThis — bootstrap DI
        if (root && root.BoardOps && typeof root.BoardOps.emitPresentationEvent === 'function') {
            root.BoardOps.emitPresentationEvent(cardState, ev);
            return true;
        }
    }
    catch (_e: any) { /* ignore */ }
    try {
        if (!warnedNoBoardOps && shouldWarnNoBoardOps()) {
            console.warn('[presentation] BoardOps.emitPresentationEvent not available (events will be persisted)');
            warnedNoBoardOps = true;
        }
    }
    catch (_e: any) { /* ignore */ }
    try {
        if (cardState && Array.isArray(cardState._presentationEventsPersist)) {
            cardState._presentationEventsPersist.push(ev);
        }
        else if (cardState) {
            cardState._presentationEventsPersist = [ev];
        }
    }
    catch (_e: any) { /* ignore persistence failures */ }
    return false;
}
function flushPersistedEvents(): boolean {
    try {
        const root: any = (typeof globalThis !== 'undefined' ? globalThis : undefined); // globalThis — bootstrap DI
        if (!(root && root.BoardOps && typeof root.BoardOps.emitPresentationEvent === 'function'))
            return false;
        let flushedCount = 0;
        const cardStateRef: any = root && root.cardState ? root.cardState : null;
        try {
            const CardLogic = _require('./logic/cards');
            if (CardLogic && typeof CardLogic.flushPresentationEvents === 'function') {
                const events = CardLogic.flushPresentationEvents(cardStateRef) || [];
                for (const ev of events) {
                    try {
                        root.BoardOps.emitPresentationEvent(cardStateRef, ev);
                    }
                    catch (_e: any) { /* ignore */ }
                }
                flushedCount += events.length;
            }
        }
        catch (_e: any) { /* ignore and continue */ }
        if (cardStateRef && Array.isArray(cardStateRef._presentationEventsPersist) && cardStateRef._presentationEventsPersist.length) {
            const persisted = cardStateRef._presentationEventsPersist.slice();
            cardStateRef._presentationEventsPersist.length = 0;
            for (const ev of persisted) {
                try {
                    root.BoardOps.emitPresentationEvent(cardStateRef, ev);
                }
                catch (_e: any) { /* ignore */ }
            }
            flushedCount += persisted.length;
        }
        return flushedCount > 0;
    }
    catch (_e: any) { /* ignore */ }
    return false;
}
module.exports = {
    emitPresentationEvent,
    flushPersistedEvents
};

export {};

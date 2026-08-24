import PresentationQueue = require('../../shared/presentation-queue');
import { isCardRuntimeUnavailableError } from './card-runtime-errors';

interface PresentationEvent {
    type: string;
    [key: string]: any;
}

interface CardState {
    _presentationEventsPersist?: PresentationEvent[];
    [key: string]: any;
}

interface PresentationRuntime {
    emitPresentationEvent?: (cardState: CardState | null, ev: PresentationEvent) => any;
    getCardState?: () => CardState | null;
    flushPresentationEvents?: (cardState: CardState | null) => PresentationEvent[];
}

let warnedNoBoardOps = false;
let presentationRuntime: PresentationRuntime | null = null;

function setPresentationRuntime(runtime: PresentationRuntime | null): PresentationRuntime | null {
    presentationRuntime = (runtime && typeof runtime === 'object') ? runtime : null;
    return presentationRuntime;
}

function shouldWarnNoBoardOps(): boolean {
    return !(typeof process !== 'undefined' && !!process.env && !!process.env.JEST_WORKER_ID);
}

function emitPresentationEvent(cardState: CardState | null, ev: PresentationEvent): boolean {
    try {
        if (presentationRuntime && typeof presentationRuntime.emitPresentationEvent === 'function') {
            const delivered = presentationRuntime.emitPresentationEvent(cardState, ev);
            if (delivered !== false) return true;
        }
    } catch (_e) { /* ignore */ }

    try {
        if (!warnedNoBoardOps && shouldWarnNoBoardOps()) {
            console.warn('[presentation] BoardOps.emitPresentationEvent not available (events will be persisted)');
            warnedNoBoardOps = true;
        }
    } catch (_e) { /* ignore */ }

    try {
        if (PresentationQueue && typeof PresentationQueue.appendPersistedPresentationEvent === 'function') {
            PresentationQueue.appendPersistedPresentationEvent(cardState, ev);
        } else if (cardState && Array.isArray(cardState._presentationEventsPersist)) {
            cardState._presentationEventsPersist.push(ev);
        } else if (cardState) {
            cardState._presentationEventsPersist = [ev];
        }
    } catch (_e) { /* ignore persistence failures */ }

    return false;
}

function flushPersistedEvents(): boolean {
    try {
        if (!presentationRuntime || typeof presentationRuntime.emitPresentationEvent !== 'function') return false;
        let flushedCount = 0;
        const cardStateRef = typeof presentationRuntime.getCardState === 'function'
            ? presentationRuntime.getCardState()
            : null;

        try {
            const events = typeof presentationRuntime.flushPresentationEvents === 'function'
                ? presentationRuntime.flushPresentationEvents(cardStateRef) || []
                : PresentationQueue.drainLivePresentationEvents(cardStateRef);
            for (const ev of events) {
                try { presentationRuntime.emitPresentationEvent(cardStateRef, ev); } catch (_e) { /* ignore */ }
            }
            flushedCount += events.length;
        } catch (error) {
            if (isCardRuntimeUnavailableError(error)) throw error;
            /* preserve the existing best-effort presentation fallback */
        }

        if (cardStateRef && Array.isArray(cardStateRef._presentationEventsPersist) && cardStateRef._presentationEventsPersist.length) {
            const persisted = cardStateRef._presentationEventsPersist.slice();
            cardStateRef._presentationEventsPersist.length = 0;
            for (const ev of persisted) {
                try { presentationRuntime.emitPresentationEvent(cardStateRef, ev); } catch (_e) { /* ignore */ }
            }
            flushedCount += persisted.length;
        }

        return flushedCount > 0;
    } catch (error) {
        if (isCardRuntimeUnavailableError(error)) throw error;
        /* preserve the existing best-effort presentation fallback */
    }
    return false;
}

const PresentationHelper = {
    setPresentationRuntime,
    emitPresentationEvent,
    flushPersistedEvents
};

export = PresentationHelper;

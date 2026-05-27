type FinalizePhasePresentationOptions = {
    CardLogic: any;
    cardState: any;
    playerKey: any;
    events: any[];
    prng: any;
    eventStartIndex: any;
    presentationStartIndex: any;
    observerMarkersBeforePhase: any;
    workMarkersBeforePhase: any;
    specialStoneSpeechBeforePhase: any;
    removalReason: any;
    emitObserverLostBubbleFromSnapshots: (CardLogic: any, cardState: any, beforeSnapshot: any, reason: any) => void;
    emitWorkRemovedPresentationFromSnapshots: (CardLogic: any, cardState: any, beforeSnapshot: any, options: any) => void;
    emitSpecialStoneBubblesFromPhase: (CardLogic: any, cardState: any, options: any) => void;
};

function finalizePhasePresentation(options: FinalizePhasePresentationOptions): void {
    const opts = (options && typeof options === 'object') ? options : ({} as FinalizePhasePresentationOptions);
    opts.emitObserverLostBubbleFromSnapshots(opts.CardLogic, opts.cardState, opts.observerMarkersBeforePhase, opts.removalReason);
    opts.emitWorkRemovedPresentationFromSnapshots(opts.CardLogic, opts.cardState, opts.workMarkersBeforePhase, {
        presentationStartIndex: opts.presentationStartIndex
    });
    opts.emitSpecialStoneBubblesFromPhase(opts.CardLogic, opts.cardState, {
        events: Array.isArray(opts.events) ? opts.events.slice(Number(opts.eventStartIndex) || 0) : [],
        presentationEvents: Array.isArray(opts.cardState && opts.cardState.presentationEvents)
            ? opts.cardState.presentationEvents.slice(Number(opts.presentationStartIndex) || 0)
            : [],
        beforeSnapshot: opts.specialStoneSpeechBeforePhase,
        presentationStartIndex: opts.presentationStartIndex,
        prng: opts.prng,
        fallbackPlayer: opts.playerKey,
        removalReason: opts.removalReason
    });
}

const PhasePresentationFinalizerModule = {
    finalizePhasePresentation
};

export = PhasePresentationFinalizerModule;

type PlaybackPlannerDeps = {
    createPlaybackPhaseState: () => any;
    orderDeferredSpawnsForPlayback?: (presentationEvents: any[]) => any[];
    createPlaybackEventBase: (event: any, finalCardState: any) => any;
    createPlaybackEvent: (playbackBase: any, type: any, phase: any, targets: any[]) => any;
    mapPassivePresentationEvent?: (ctx: any) => boolean;
    mapBoardPresentationEvent: (ctx: any) => any;
    isDeferredSpawnPresentationEvent?: (event: any) => boolean;
    populatePlaybackEventAfterState?: (playbackEvent: any, event: any, finalCardState: any, finalGameState: any) => void;
    postProcessPlaybackEvents?: (playbackEvents: any[]) => any[];
};

function toPresentationEventArray(presentationEvents: any): any[] {
    return Array.isArray(presentationEvents) ? presentationEvents : [];
}

function planPlaybackEvents(presentationEventsInput: any, finalCardState: any, finalGameState: any, deps: PlaybackPlannerDeps): any[] {
    if (!deps || typeof deps.createPlaybackPhaseState !== 'function') {
        throw new Error('PlaybackPlanner requires createPlaybackPhaseState');
    }
    if (typeof deps.createPlaybackEventBase !== 'function') {
        throw new Error('PlaybackPlanner requires createPlaybackEventBase');
    }
    if (typeof deps.createPlaybackEvent !== 'function') {
        throw new Error('PlaybackPlanner requires createPlaybackEvent');
    }
    if (typeof deps.mapBoardPresentationEvent !== 'function') {
        throw new Error('PlaybackPlanner requires mapBoardPresentationEvent');
    }

    const playbackEvents: any[] = [];
    const phaseState = deps.createPlaybackPhaseState();
    const orderedPresentationEvents = typeof deps.orderDeferredSpawnsForPlayback === 'function'
        ? deps.orderDeferredSpawnsForPlayback(toPresentationEventArray(presentationEventsInput))
        : toPresentationEventArray(presentationEventsInput);
    const presentationEvents = toPresentationEventArray(orderedPresentationEvents);
    const consumedPresentationIndexes = new Set<number>();

    for (let presIndex = 0; presIndex < presentationEvents.length; presIndex += 1) {
        if (consumedPresentationIndexes.has(presIndex)) continue;
        const ev = presentationEvents[presIndex];
        const followsProliferationDestroy = phaseState.prevWasProliferationDestroy;
        phaseState.prevWasProliferationDestroy = false;
        const trailingPlaybackEvents: any[] = [];
        const playbackBase = deps.createPlaybackEventBase(ev, finalCardState);
        const pEvent = deps.createPlaybackEvent(playbackBase, null, phaseState.currentPhase, []);

        const ctx = {
            ev,
            phaseState,
            pEvent,
            playbackBase,
            playbackEvents,
            presentationEvents,
            presIndex,
            trailingPlaybackEvents,
            consumedPresentationIndexes,
            followsProliferationDestroy
        };

        const passiveMapped = typeof deps.mapPassivePresentationEvent === 'function'
            ? deps.mapPassivePresentationEvent(ctx) === true
            : false;
        if (!passiveMapped) {
            const boardEventResult = deps.mapBoardPresentationEvent(ctx);
            if (boardEventResult && boardEventResult.skip) {
                continue;
            }
        }

        const isDeferredSpawn = typeof deps.isDeferredSpawnPresentationEvent === 'function'
            ? deps.isDeferredSpawnPresentationEvent(ev) === true
            : false;
        if (ev && ev.type !== 'DESTROY' && ev.type !== 'MOVE' && !isDeferredSpawn) {
            phaseState.superCrushPhase = null;
            phaseState.superCrushActionId = null;
        }

        if (typeof deps.populatePlaybackEventAfterState === 'function') {
            deps.populatePlaybackEventAfterState(pEvent, ev, finalCardState, finalGameState);
        }

        if (pEvent.type) playbackEvents.push(pEvent);
        if (trailingPlaybackEvents.length) playbackEvents.push(...trailingPlaybackEvents);
    }

    return typeof deps.postProcessPlaybackEvents === 'function'
        ? deps.postProcessPlaybackEvents(playbackEvents)
        : playbackEvents;
}

const PlaybackPlannerModule = {
    planPlaybackEvents
};

export = PlaybackPlannerModule;

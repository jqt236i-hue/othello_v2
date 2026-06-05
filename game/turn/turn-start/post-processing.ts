type FinalizeTurnStartMarkerProcessingOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    events: any[];
    prng: any;
    processedTurnStartMarkers: any;
    workMarkersBeforeStart: any;
    specialStoneSpeechBeforeStart: any;
    eventStartIndex: any;
    presentationStartIndex: any;
    applyPostFlipRevives: (CardLogic: any, cardState: any, gameState: any, flips: any, ownerKey: any) => any;
    awardBoardChargeGain: (CardLogic: any, cardState: any, playerKey: any, amount: any, payload: any) => void;
    pushTrapEvents: (events: any[], trapRes: any) => void;
    emitTrapHandRemoveEvents: (CardLogic: any, cardState: any, trapRes: any) => void;
    normalizePlayerKey: (value: any) => any;
    isWorkDurationEndPresentationEvent: (event: any) => boolean;
    emitWorkRemovedPresentationFromSnapshots: (CardLogic: any, cardState: any, beforeSnapshot: any, options: any) => void;
    emitSpecialStoneBubblesFromPhase: (CardLogic: any, cardState: any, options: any) => void;
};

function createEmptyProcessedTurnStartMarkers(): any {
    return {
        hyperAggregated: {
            moved: [],
            destroyed: [],
            flipped: [],
            flippedByOwner: {
                black: [],
                white: []
            }
        }
    };
}

function finalizeTurnStartMarkerProcessing(options: FinalizeTurnStartMarkerProcessingOptions): any {
    const opts = (options && typeof options === 'object') ? options : ({} as FinalizeTurnStartMarkerProcessingOptions);
    const processed = opts.processedTurnStartMarkers || createEmptyProcessedTurnStartMarkers();
    const hyperAggregated = processed.hyperAggregated || createEmptyProcessedTurnStartMarkers().hyperAggregated;

    const hyperByOwner = hyperAggregated.flippedByOwner || {};
    const regenTriggered: any[] = [];
    const regenCaptureFlips: any[] = [];
    const livingWillTriggered: any[] = [];
    const regenCaptureByOwner: Record<string, any[]> = { black: [], white: [] };

    for (const ownerKey of ['black', 'white']) {
        const flips = hyperByOwner[ownerKey] || [];
        if (!flips.length) continue;
        const reviveRes = opts.applyPostFlipRevives(opts.CardLogic, opts.cardState, opts.gameState, flips, ownerKey);
        const regenRes = reviveRes && reviveRes.regenRes;
        const livingWillRes = reviveRes && reviveRes.livingWillRes;
        if (regenRes && regenRes.regened && regenRes.regened.length) regenTriggered.push(...regenRes.regened);
        if (regenRes && regenRes.captureFlips && regenRes.captureFlips.length) {
            regenCaptureFlips.push(...regenRes.captureFlips);
            regenCaptureByOwner[ownerKey] = regenCaptureByOwner[ownerKey] || [];
            regenCaptureByOwner[ownerKey].push(...regenRes.captureFlips);
        }
        if (livingWillRes && livingWillRes.restored && livingWillRes.restored.length) {
            livingWillTriggered.push(...livingWillRes.restored);
        }
    }

    if (regenCaptureFlips.length && typeof opts.CardLogic.clearHyperactiveAtPositions === 'function') {
        opts.CardLogic.clearHyperactiveAtPositions(opts.cardState, regenCaptureFlips);
    }
    if (regenTriggered.length) {
        opts.events.push({ type: 'regen_triggered_start', details: regenTriggered });
    }
    if (livingWillTriggered.length) {
        opts.events.push({ type: 'living_will_triggered_start', details: livingWillTriggered });
    }
    if (regenCaptureFlips.length) {
        for (const ownerKey of ['black', 'white']) {
            const captures = regenCaptureByOwner[ownerKey] || [];
            if (!captures.length) continue;
            const firstCapture = captures[0] || {};
            opts.awardBoardChargeGain(opts.CardLogic, opts.cardState, ownerKey, captures.length, {
                anchorRow: firstCapture.row,
                anchorCol: firstCapture.col,
                sourceType: 'regen_capture_turn_start'
            });
        }
        opts.events.push({ type: 'regen_capture_flipped_start', details: regenCaptureFlips });
    }

    if (typeof opts.CardLogic.processTrapEffects === 'function') {
        const trapRes = opts.CardLogic.processTrapEffects(opts.cardState, opts.gameState, opts.playerKey, { expireOnOwnerTurnStart: true });
        opts.pushTrapEvents(opts.events, trapRes);
        opts.emitTrapHandRemoveEvents(opts.CardLogic, opts.cardState, trapRes);
    }
    const newPresentationEvents = Array.isArray(opts.cardState.presentationEvents)
        ? opts.cardState.presentationEvents.slice(Number(opts.presentationStartIndex) || 0)
        : [];
    const workDurationEndSet = new Set(
        newPresentationEvents
            .filter((event: any) => opts.isWorkDurationEndPresentationEvent(event))
            .map((event: any) => {
                const row = Number(event && event.row);
                const col = Number(event && event.col);
                if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
                const owner = opts.normalizePlayerKey((event && event.player) || (event && event.owner) || (event && event.meta && event.meta.owner));
                return `${row},${col}:${owner || ''}`;
            })
            .filter((key: any) => !!key)
    );

    opts.emitWorkRemovedPresentationFromSnapshots(opts.CardLogic, opts.cardState, opts.workMarkersBeforeStart, {
        durationEndSet: workDurationEndSet,
        presentationStartIndex: opts.presentationStartIndex
    });

    opts.emitSpecialStoneBubblesFromPhase(opts.CardLogic, opts.cardState, {
        events: Array.isArray(opts.events) ? opts.events.slice(Number(opts.eventStartIndex) || 0) : [],
        presentationEvents: newPresentationEvents,
        beforeSnapshot: opts.specialStoneSpeechBeforeStart,
        presentationStartIndex: opts.presentationStartIndex,
        prng: opts.prng,
        fallbackPlayer: opts.playerKey,
        removalReason: 'removed_at_turn_start'
    });

    return {
        hyperAggregated,
        newPresentationEvents
    };
}

const TurnStartPostProcessingModule = {
    finalizeTurnStartMarkerProcessing
};

export = TurnStartPostProcessingModule;

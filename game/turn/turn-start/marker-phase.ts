declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;

function readRuntimeModuleGlobal(globalKey: string): any {
    if (!globalKey) return null;
    try {
        if (typeof self !== 'undefined' && (self as any)[globalKey]) {
            return (self as any)[globalKey];
        }
        if (typeof globalThis !== 'undefined' && (globalThis as any)[globalKey]) {
            return (globalThis as any)[globalKey];
        }
    } catch (e) { /* ignore */ }
    return null;
}

function requireTurnStartModule(id: string, globalKey: string): any {
    try {
        return _require(id);
    } catch (e) {
        return readRuntimeModuleGlobal(globalKey);
    }
}

const TurnStartBombPhaseModule = requireTurnStartModule('./bomb-phase', 'TurnStartBombPhase');
const TurnStartSpecialStonePhaseModule = requireTurnStartModule('./special-stone-phase', 'TurnStartSpecialStonePhase');

type TurnStartMarkerAnchor = {
    isBomb: boolean;
    marker: any;
    createdSeq: number;
};

type CollectTurnStartMarkerAnchorsOptions = {
    getMarkers?: (cardState: any) => any[];
    isBombCategoryMarker: (marker: any) => boolean;
};

type ProcessTurnStartMarkersOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    events: any[];
    prng: any;
    markers: TurnStartMarkerAnchor[];
    isFrozenCell: (cardState: any, row: any, col: any) => boolean;
    awardBoardChargeGain: (CardLogic: any, cardState: any, playerKey: any, amount: any, payload: any) => void;
    debugLog?: (...args: any[]) => void;
};

function collectTurnStartMarkerAnchors(cardState: any, options: CollectTurnStartMarkerAnchorsOptions): TurnStartMarkerAnchor[] {
    const opts = (options && typeof options === 'object') ? options : ({} as CollectTurnStartMarkerAnchorsOptions);
    const getMarkers = typeof opts.getMarkers === 'function'
        ? opts.getMarkers
        : ((state: any) => (state && Array.isArray(state.markers)) ? state.markers : []);
    const isBombCategoryMarker = opts.isBombCategoryMarker;
    const sourceMarkers = getMarkers(cardState) || [];
    return sourceMarkers
        .map((marker: any) => ({
            isBomb: typeof isBombCategoryMarker === 'function' && isBombCategoryMarker(marker),
            marker,
            createdSeq: (marker && marker.createdSeq) || 0
        }))
        .sort((a: any, b: any) => (a.createdSeq || 0) - (b.createdSeq || 0));
}

function processTurnStartMarkers(options: ProcessTurnStartMarkersOptions): { hyperAggregated: any; observerStartSummary: any } {
    const opts = (options && typeof options === 'object') ? options : ({} as ProcessTurnStartMarkersOptions);
    const processingState = TurnStartSpecialStonePhaseModule.createTurnStartSpecialStoneProcessingState();
    const markers = Array.isArray(opts.markers) ? opts.markers : [];

    for (let index = 0; index < markers.length; index += 1) {
        const markerAnchor = markers[index];
        if (!markerAnchor) continue;
        if (markerAnchor.isBomb) {
            TurnStartBombPhaseModule.processTurnStartBombMarker({
                CardLogic: opts.CardLogic,
                cardState: opts.cardState,
                gameState: opts.gameState,
                playerKey: opts.playerKey,
                events: opts.events,
                markerAnchor,
                isFrozenCell: opts.isFrozenCell
            });
            continue;
        }
        TurnStartSpecialStonePhaseModule.processTurnStartSpecialStone({
            CardLogic: opts.CardLogic,
            cardState: opts.cardState,
            gameState: opts.gameState,
            playerKey: opts.playerKey,
            events: opts.events,
            prng: opts.prng,
            markerAnchor,
            isFrozenCell: opts.isFrozenCell,
            awardBoardChargeGain: opts.awardBoardChargeGain,
            debugLog: opts.debugLog,
            processingState
        });
    }

    return processingState;
}

const TurnStartMarkerPhaseModule = {
    collectTurnStartMarkerAnchors,
    processTurnStartMarkers
};

export = TurnStartMarkerPhaseModule;

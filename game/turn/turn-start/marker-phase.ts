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
    markerId: string | null;
    createdSeq: number | null;
    sourceIndex: number;
    startKind: string | null;
    startType: string | null;
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

function getMarkerIdentity(marker: any): string | null {
    if (!marker || typeof marker !== 'object') return null;
    const direct = marker.markerId ?? marker.id;
    if (direct === undefined || direct === null || direct === '') return null;
    return String(direct);
}

function normalizeCreatedSeq(value: any): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function compareTurnStartAnchors(a: TurnStartMarkerAnchor, b: TurnStartMarkerAnchor): number {
    const seqDiff = normalizeCreatedSeq(a && a.createdSeq) - normalizeCreatedSeq(b && b.createdSeq);
    if (seqDiff !== 0) return seqDiff;
    const sourceDiff = Number(a && a.sourceIndex || 0) - Number(b && b.sourceIndex || 0);
    if (sourceDiff !== 0) return sourceDiff;
    const aId = a && a.markerId !== null && a.markerId !== undefined ? String(a.markerId) : '';
    const bId = b && b.markerId !== null && b.markerId !== undefined ? String(b.markerId) : '';
    if (aId < bId) return -1;
    if (aId > bId) return 1;
    return 0;
}

function getCurrentMarkers(cardState: any): any[] {
    return (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
}

function resolveSameCanonicalMarker(anchor: TurnStartMarkerAnchor, cardState: any): any | null {
    if (!anchor) return null;
    const currentMarkers = getCurrentMarkers(cardState);
    if (anchor.markerId) {
        return currentMarkers.find((marker: any) => getMarkerIdentity(marker) === anchor.markerId) || null;
    }
    return currentMarkers.includes(anchor.marker) ? anchor.marker : null;
}

function collectTurnStartMarkerAnchors(cardState: any, options: CollectTurnStartMarkerAnchorsOptions): TurnStartMarkerAnchor[] {
    const opts = (options && typeof options === 'object') ? options : ({} as CollectTurnStartMarkerAnchorsOptions);
    const getMarkers = typeof opts.getMarkers === 'function'
        ? opts.getMarkers
        : ((state: any) => (state && Array.isArray(state.markers)) ? state.markers : []);
    const isBombCategoryMarker = opts.isBombCategoryMarker;
    const sourceMarkers = getMarkers(cardState) || [];
    return sourceMarkers
        .map((marker: any, sourceIndex: number) => ({
            isBomb: typeof isBombCategoryMarker === 'function' && isBombCategoryMarker(marker),
            marker,
            markerId: getMarkerIdentity(marker),
            createdSeq: marker && marker.createdSeq !== undefined && marker.createdSeq !== null ? Number(marker.createdSeq) : null,
            sourceIndex,
            startKind: marker && marker.kind ? String(marker.kind) : null,
            startType: marker && marker.data && marker.data.type ? String(marker.data.type) : null
        }))
        .sort(compareTurnStartAnchors);
}

function processTurnStartMarkers(options: ProcessTurnStartMarkersOptions): any {
    const opts = (options && typeof options === 'object') ? options : ({} as ProcessTurnStartMarkersOptions);
    const processingState = TurnStartSpecialStonePhaseModule.createTurnStartSpecialStoneProcessingState();
    const markers = Array.isArray(opts.markers) ? opts.markers : [];

    for (let index = 0; index < markers.length; index += 1) {
        const markerAnchor = markers[index];
        if (!markerAnchor) continue;
        const currentMarker = resolveSameCanonicalMarker(markerAnchor, opts.cardState);
        if (!currentMarker) continue;
        const currentMarkerAnchor = Object.assign({}, markerAnchor, { marker: currentMarker });
        if (markerAnchor.isBomb) {
            TurnStartBombPhaseModule.processTurnStartBombMarker({
                CardLogic: opts.CardLogic,
                cardState: opts.cardState,
                gameState: opts.gameState,
                playerKey: opts.playerKey,
                events: opts.events,
                markerAnchor: currentMarkerAnchor,
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
            markerAnchor: currentMarkerAnchor,
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

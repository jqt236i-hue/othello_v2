type TurnStartTimerPhaseMarkerSourceOptions = {
    getMarkers?: (cardState: any) => any[];
    isBombCategoryMarker: (marker: any) => boolean;
    resolveSpecialStatusTimer: (markerData: any) => any;
    specialStoneKind?: any;
};

type EmitTurnStartTimerStatusTicksOptions = TurnStartTimerPhaseMarkerSourceOptions & {
    CardLogic: any;
    cardState: any;
    timerSnapshot: Map<string, any>;
    emittedTimerTickKeys?: Set<string>;
};

type EmitTurnStartTimerStatusTickForMarkerOptions = EmitTurnStartTimerStatusTicksOptions & {
    marker: any;
};

function buildTurnStartTimerMarkerKey(marker: any): string {
    const markerId = marker && (marker.markerId ?? marker.id);
    return (markerId !== undefined && markerId !== null)
        ? `${marker.kind}:${markerId}`
        : `${marker && marker.kind}:${marker && marker.row},${marker && marker.col}:${marker && marker.owner}:${(marker && marker.createdSeq) || 0}`;
}

function readTurnStartTimerPhaseMarkers(cardState: any, options: TurnStartTimerPhaseMarkerSourceOptions): any[] {
    const opts = (options && typeof options === 'object') ? options : ({} as TurnStartTimerPhaseMarkerSourceOptions);
    const getMarkers = typeof opts.getMarkers === 'function'
        ? opts.getMarkers
        : ((state: any) => (state && Array.isArray(state.markers)) ? state.markers : []);
    const markers = getMarkers(cardState);
    return Array.isArray(markers) ? markers : [];
}

function readTurnStartTimerEntry(marker: any, options: TurnStartTimerPhaseMarkerSourceOptions): any | null {
    const opts = (options && typeof options === 'object') ? options : ({} as TurnStartTimerPhaseMarkerSourceOptions);
    if (!marker || !marker.data) return null;
    if (typeof opts.isBombCategoryMarker === 'function' && opts.isBombCategoryMarker(marker)) {
        if (typeof marker.data.remainingTurns !== 'number') return null;
        return {
            timer: marker.data.remainingTurns,
            special: 'TIME_BOMB',
            owner: marker.owner,
            row: marker.row,
            col: marker.col,
            kind: marker.kind
        };
    }
    const specialStoneKind = opts.specialStoneKind || 'specialStone';
    if (marker.kind !== specialStoneKind) return null;
    if (typeof opts.resolveSpecialStatusTimer !== 'function') return null;
    const timerValue = opts.resolveSpecialStatusTimer(marker.data);
    if (timerValue === undefined) return null;
    return {
        timer: timerValue,
        special: marker.data.type || null,
        owner: marker.owner,
        row: marker.row,
        col: marker.col,
        kind: marker.kind
    };
}

function snapshotTurnStartTimers(cardState: any, options: TurnStartTimerPhaseMarkerSourceOptions): Map<string, any> {
    const opts = (options && typeof options === 'object') ? options : ({} as TurnStartTimerPhaseMarkerSourceOptions);
    const timerSnapshot = new Map();
    try {
        const sourceMarkers = readTurnStartTimerPhaseMarkers(cardState, opts);
        for (let index = 0; index < sourceMarkers.length; index += 1) {
            const marker = sourceMarkers[index];
            const timerEntry = readTurnStartTimerEntry(marker, opts);
            if (!timerEntry) continue;
            const key = buildTurnStartTimerMarkerKey(marker);
            timerSnapshot.set(key, timerEntry);
        }
    } catch (e) { /* ignore snapshot failures */ }
    return timerSnapshot;
}

function emitTurnStartTimerStatusTickForMarker(options: EmitTurnStartTimerStatusTickForMarkerOptions): void {
    const opts = (options && typeof options === 'object') ? options : ({} as EmitTurnStartTimerStatusTickForMarkerOptions);
    if (!opts.CardLogic || typeof opts.CardLogic.emitPresentationEvent !== 'function') return;
    try {
        const marker = opts.marker;
        const key = buildTurnStartTimerMarkerKey(marker);
        if (opts.emittedTimerTickKeys && opts.emittedTimerTickKeys.has(key)) return;
        const timerEntry = readTurnStartTimerEntry(marker, opts);
        if (!timerEntry) return;
        const before = opts.timerSnapshot.get(key);
        if (!before || before.timer !== timerEntry.timer) {
            opts.CardLogic.emitPresentationEvent(opts.cardState, {
                type: 'STATUS_TICK',
                row: timerEntry.row,
                col: timerEntry.col,
                meta: { special: timerEntry.special, timer: timerEntry.timer, owner: timerEntry.owner }
            });
            if (opts.emittedTimerTickKeys) {
                opts.emittedTimerTickKeys.add(key);
            }
        }
    } catch (e) { /* ignore */ }
}

function emitTurnStartTimerStatusTicks(options: EmitTurnStartTimerStatusTicksOptions): void {
    const opts = (options && typeof options === 'object') ? options : ({} as EmitTurnStartTimerStatusTicksOptions);
    if (!opts.CardLogic || typeof opts.CardLogic.emitPresentationEvent !== 'function') return;
    try {
        const afterMarkers = readTurnStartTimerPhaseMarkers(opts.cardState, opts);
        for (let index = 0; index < afterMarkers.length; index += 1) {
            const marker = afterMarkers[index];
            emitTurnStartTimerStatusTickForMarker(Object.assign({}, opts, { marker }));
        }
    } catch (e) { /* ignore */ }
}

const TurnStartTimerPhaseModule = {
    snapshotTurnStartTimers,
    emitTurnStartTimerStatusTickForMarker,
    emitTurnStartTimerStatusTicks
};

export = TurnStartTimerPhaseModule;

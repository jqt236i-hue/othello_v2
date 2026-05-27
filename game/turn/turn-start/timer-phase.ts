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
};

function buildTurnStartTimerMarkerKey(marker: any): string {
    return (marker && marker.id !== undefined && marker.id !== null)
        ? `${marker.kind}:${marker.id}`
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

function snapshotTurnStartTimers(cardState: any, options: TurnStartTimerPhaseMarkerSourceOptions): Map<string, any> {
    const opts = (options && typeof options === 'object') ? options : ({} as TurnStartTimerPhaseMarkerSourceOptions);
    const timerSnapshot = new Map();
    const specialStoneKind = opts.specialStoneKind || 'specialStone';
    try {
        const sourceMarkers = readTurnStartTimerPhaseMarkers(cardState, opts);
        for (let index = 0; index < sourceMarkers.length; index += 1) {
            const marker = sourceMarkers[index];
            if (!marker || !marker.data) continue;
            const key = buildTurnStartTimerMarkerKey(marker);
            if (opts.isBombCategoryMarker(marker)) {
                if (typeof marker.data.remainingTurns === 'number') {
                    timerSnapshot.set(key, {
                        timer: marker.data.remainingTurns,
                        special: 'TIME_BOMB',
                        owner: marker.owner,
                        row: marker.row,
                        col: marker.col,
                        kind: marker.kind
                    });
                }
                continue;
            }
            if (marker.kind !== specialStoneKind) continue;
            const timerValue = opts.resolveSpecialStatusTimer(marker.data);
            if (timerValue === undefined) continue;
            timerSnapshot.set(key, {
                timer: timerValue,
                special: marker.data.type || null,
                owner: marker.owner,
                row: marker.row,
                col: marker.col,
                kind: marker.kind
            });
        }
    } catch (e) { /* ignore snapshot failures */ }
    return timerSnapshot;
}

function emitTurnStartTimerStatusTicks(options: EmitTurnStartTimerStatusTicksOptions): void {
    const opts = (options && typeof options === 'object') ? options : ({} as EmitTurnStartTimerStatusTicksOptions);
    const specialStoneKind = opts.specialStoneKind || 'specialStone';
    if (!opts.CardLogic || typeof opts.CardLogic.emitPresentationEvent !== 'function') return;
    try {
        const afterMarkers = readTurnStartTimerPhaseMarkers(opts.cardState, opts);
        for (let index = 0; index < afterMarkers.length; index += 1) {
            const marker = afterMarkers[index];
            if (!marker || !marker.data) continue;
            const key = buildTurnStartTimerMarkerKey(marker);
            const before = opts.timerSnapshot.get(key);
            if (opts.isBombCategoryMarker(marker)) {
                if (typeof marker.data.remainingTurns !== 'number') continue;
                if (!before || before.timer !== marker.data.remainingTurns) {
                    opts.CardLogic.emitPresentationEvent(opts.cardState, {
                        type: 'STATUS_TICK',
                        row: marker.row,
                        col: marker.col,
                        meta: { special: 'TIME_BOMB', timer: marker.data.remainingTurns, owner: marker.owner }
                    });
                }
                continue;
            }
            if (marker.kind !== specialStoneKind) continue;
            const timerValue = opts.resolveSpecialStatusTimer(marker.data);
            if (timerValue === undefined) continue;
            if (!before || before.timer !== timerValue) {
                opts.CardLogic.emitPresentationEvent(opts.cardState, {
                    type: 'STATUS_TICK',
                    row: marker.row,
                    col: marker.col,
                    meta: { special: marker.data.type || null, timer: timerValue, owner: marker.owner }
                });
            }
        }
    } catch (e) { /* ignore */ }
}

const TurnStartTimerPhaseModule = {
    snapshotTurnStartTimers,
    emitTurnStartTimerStatusTicks
};

export = TurnStartTimerPhaseModule;

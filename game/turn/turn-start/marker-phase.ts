import TurnStartBombPhaseImport = require('./bomb-phase');
import TurnStartSpecialStonePhaseImport = require('./special-stone-phase');

const TurnStartBombPhaseModule: any = TurnStartBombPhaseImport;
const TurnStartSpecialStonePhaseModule: any = TurnStartSpecialStonePhaseImport;

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
    BoardOps?: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    events: any[];
    prng: any;
    markers: TurnStartMarkerAnchor[];
    isBombCategoryMarker?: (marker: any) => boolean;
    isFrozenCell: (cardState: any, row: any, col: any) => boolean;
    awardBoardChargeGain: (CardLogic: any, cardState: any, playerKey: any, amount: any, payload: any) => void;
    flushPostFlipRevivesForAnchor?: (flippedByOwner: Record<string, any[]>) => void;
    emitTimerStatusTickForAnchor?: (marker: any) => void;
    applyGeneratedSpawnFlipResultsForAnchor?: (results: any[]) => void;
    resolveShinraBanshoGodFusions?: () => void;
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

function buildTurnStartActionId(turnIndex: any, queueIndex: number, anchor: TurnStartMarkerAnchor): string {
    const normalizedTurnIndex = Number.isFinite(Number(turnIndex)) ? Math.trunc(Number(turnIndex)) : 0;
    const idPart = anchor && anchor.markerId ? String(anchor.markerId) : `source-${anchor && Number.isFinite(Number(anchor.sourceIndex)) ? Math.trunc(Number(anchor.sourceIndex)) : queueIndex}`;
    return `turn-start:${normalizedTurnIndex}:anchor:${queueIndex}:${idPart}`;
}

function buildTurnStartEffectBlockId(actionId: string, kind: string): string {
    const normalizedKind = String(kind || 'effect').trim().toLowerCase() || 'effect';
    return `${actionId}:effect:${normalizedKind}`;
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

function snapshotFlippedByOwnerCounts(processingState: any): Record<string, number> {
    const byOwner = processingState && processingState.hyperAggregated && processingState.hyperAggregated.flippedByOwner;
    return {
        black: Array.isArray(byOwner && byOwner.black) ? byOwner.black.length : 0,
        white: Array.isArray(byOwner && byOwner.white) ? byOwner.white.length : 0
    };
}

function collectFlippedByOwnerDelta(processingState: any, beforeCounts: Record<string, number>): Record<string, any[]> {
    const byOwner = processingState && processingState.hyperAggregated && processingState.hyperAggregated.flippedByOwner;
    const delta: Record<string, any[]> = { black: [], white: [] };
    for (const ownerKey of ['black', 'white']) {
        const current = Array.isArray(byOwner && byOwner[ownerKey]) ? byOwner[ownerKey] : [];
        const before = Math.max(0, Number(beforeCounts && beforeCounts[ownerKey]) || 0);
        if (current.length > before) {
            delta[ownerKey] = current.slice(before);
        }
    }
    return delta;
}

function hasFlippedByOwnerDelta(delta: Record<string, any[]>): boolean {
    return !!(delta && ((Array.isArray(delta.black) && delta.black.length) || (Array.isArray(delta.white) && delta.white.length)));
}

function removeFlippedByOwnerDeltaFromAggregate(processingState: any, beforeCounts: Record<string, number>): void {
    const byOwner = processingState && processingState.hyperAggregated && processingState.hyperAggregated.flippedByOwner;
    if (!byOwner || typeof byOwner !== 'object') return;
    for (const ownerKey of ['black', 'white']) {
        if (!Array.isArray(byOwner[ownerKey])) continue;
        const before = Math.max(0, Number(beforeCounts && beforeCounts[ownerKey]) || 0);
        if (byOwner[ownerKey].length > before) {
            byOwner[ownerKey].splice(before);
        }
    }
}

function readCurrentActionMeta(cardState: any): { hasValue: boolean; value: any } {
    if (!cardState || typeof cardState !== 'object') return { hasValue: false, value: undefined };
    return {
        hasValue: Object.prototype.hasOwnProperty.call(cardState, '_currentActionMeta'),
        value: cardState._currentActionMeta
    };
}

function setActionContextForAnchor(options: ProcessTurnStartMarkersOptions, actionMeta: any): void {
    if (options.BoardOps && typeof options.BoardOps.setActionContext === 'function') {
        options.BoardOps.setActionContext(options.cardState, actionMeta);
        return;
    }
    if (options.cardState && typeof options.cardState === 'object') {
        options.cardState._currentActionMeta = actionMeta;
    }
}

function restoreActionContextForAnchor(options: ProcessTurnStartMarkersOptions, previous: { hasValue: boolean; value: any }): void {
    if (previous && previous.hasValue) {
        if (options.BoardOps && typeof options.BoardOps.setActionContext === 'function') {
            options.BoardOps.setActionContext(options.cardState, previous.value);
            return;
        }
        if (options.cardState && typeof options.cardState === 'object') {
            options.cardState._currentActionMeta = previous.value;
        }
        return;
    }
    if (options.BoardOps && typeof options.BoardOps.clearActionContext === 'function') {
        options.BoardOps.clearActionContext(options.cardState);
        return;
    }
    if (options.cardState && typeof options.cardState === 'object') {
        delete options.cardState._currentActionMeta;
    }
}

function emitTimerStatusTickForCurrentAnchor(options: ProcessTurnStartMarkersOptions, anchor: TurnStartMarkerAnchor): void {
    if (!options || typeof options.emitTimerStatusTickForAnchor !== 'function') return;
    const markerAfterAnchor = resolveSameCanonicalMarker(anchor, options.cardState);
    if (!markerAfterAnchor) return;
    options.emitTimerStatusTickForAnchor(markerAfterAnchor);
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

    if (typeof opts.CardLogic.processHealingCellDurationBoosts === 'function') {
        const turnIndex = opts.cardState && Number.isFinite(Number(opts.cardState.turnIndex))
            ? Math.trunc(Number(opts.cardState.turnIndex))
            : (opts.gameState && Number.isFinite(Number(opts.gameState.turnNumber)) ? Math.trunc(Number(opts.gameState.turnNumber)) : 0);
        const actionId = `turn-start:${turnIndex}:healing-cells`;
        const previousActionMeta = readCurrentActionMeta(opts.cardState);
        setActionContextForAnchor(opts, {
            actionId,
            effectBlockId: buildTurnStartEffectBlockId(actionId, 'healing-cell'),
            turnIndex,
            plyIndex: 0,
            randomSource: opts.prng || null
        });
        try {
            const healing = opts.CardLogic.processHealingCellDurationBoosts(opts.cardState, opts.playerKey);
            if (healing && Array.isArray(healing.details) && healing.details.length) {
                opts.events.push({ type: 'water_duration_added_start', details: healing.details });
            }
        } finally {
            restoreActionContextForAnchor(opts, previousActionMeta);
        }
    }

    for (let index = 0; index < markers.length; index += 1) {
        const markerAnchor = markers[index];
        if (!markerAnchor) continue;
        const currentMarker = resolveSameCanonicalMarker(markerAnchor, opts.cardState);
        if (!currentMarker) continue;
        if (typeof opts.isBombCategoryMarker === 'function') {
            const currentIsBomb = opts.isBombCategoryMarker(currentMarker);
            if (markerAnchor.isBomb !== currentIsBomb) continue;
        }
        const currentMarkerAnchor = Object.assign({}, markerAnchor, { marker: currentMarker });
        const turnIndex = opts.cardState && Number.isFinite(Number(opts.cardState.turnIndex))
            ? Math.trunc(Number(opts.cardState.turnIndex))
            : (opts.gameState && Number.isFinite(Number(opts.gameState.turnNumber)) ? Math.trunc(Number(opts.gameState.turnNumber)) : 0);
        const actionId = buildTurnStartActionId(turnIndex, index, currentMarkerAnchor);
        const effectKind = markerAnchor.isBomb ? 'bomb' : (currentMarkerAnchor.startType || 'special');
        const previousActionMeta = readCurrentActionMeta(opts.cardState);
        setActionContextForAnchor(opts, {
            actionId,
            effectBlockId: buildTurnStartEffectBlockId(actionId, effectKind),
            turnIndex,
            plyIndex: 0,
            randomSource: opts.prng || null
        });
        try {
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
                emitTimerStatusTickForCurrentAnchor(opts, currentMarkerAnchor);
                if (typeof opts.resolveShinraBanshoGodFusions === 'function') {
                    opts.resolveShinraBanshoGodFusions();
                }
                continue;
            }
            const flippedCountsBeforeAnchor = snapshotFlippedByOwnerCounts(processingState);
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
                applyGeneratedSpawnFlipResultsForAnchor: opts.applyGeneratedSpawnFlipResultsForAnchor,
                debugLog: opts.debugLog,
                processingState
            });
            if (typeof opts.flushPostFlipRevivesForAnchor === 'function') {
                const flippedByOwnerDelta = collectFlippedByOwnerDelta(processingState, flippedCountsBeforeAnchor);
                if (hasFlippedByOwnerDelta(flippedByOwnerDelta)) {
                    opts.flushPostFlipRevivesForAnchor(flippedByOwnerDelta);
                    removeFlippedByOwnerDeltaFromAggregate(processingState, flippedCountsBeforeAnchor);
                }
            }
            emitTimerStatusTickForCurrentAnchor(opts, currentMarkerAnchor);
            if (typeof opts.resolveShinraBanshoGodFusions === 'function') {
                opts.resolveShinraBanshoGodFusions();
            }
        } finally {
            restoreActionContextForAnchor(opts, previousActionMeta);
        }
    }

    return processingState;
}

const TurnStartMarkerPhaseModule = {
    collectTurnStartMarkerAnchors,
    processTurnStartMarkers,
    buildTurnStartActionId,
    buildTurnStartEffectBlockId
};

export = TurnStartMarkerPhaseModule;

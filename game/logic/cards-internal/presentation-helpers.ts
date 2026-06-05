'use strict';

interface PresentationContext {
    constants?: { BLACK?: number; EMPTY?: number };
    BoardOpsModule?: any;
    StoneStatusSnapshot?: any;
    [key: string]: any;
}

interface PresentationEvent {
    type: string;
    [key: string]: any;
}

interface Position { row: number; col: number }

function getConstants(context: PresentationContext) {
    const constants = (context && context.constants && typeof context.constants === 'object') ? context.constants : {};
    return {
        BLACK: Number.isFinite(Number(constants.BLACK)) ? Number(constants.BLACK) : 1,
        EMPTY: Number.isFinite(Number(constants.EMPTY)) ? Number(constants.EMPTY) : 0
    };
}

function requireContextFunction(context: PresentationContext, name: string) {
    const value = context && context[name];
    if (typeof value !== 'function') {
        throw new Error('[presentation-helpers] ' + name + ' not available');
    }
    return value;
}

function getBoardOpsModule(context: PresentationContext) {
    return context && context.BoardOpsModule ? context.BoardOpsModule : null;
}

function getStoneStatusSnapshot(context: PresentationContext) {
    return context && context.StoneStatusSnapshot ? context.StoneStatusSnapshot : null;
}

function compactPresentationMeta(meta: any): any {
    if (!meta || typeof meta !== 'object')
        return undefined;
    const out: any = {};
    for (const [key, value] of Object.entries(meta)) {
        if (value !== null && value !== undefined)
            out[key] = value;
    }
    return Object.keys(out).length ? out : undefined;
}

function getCellVisualPresentationMeta(cardState: any, row: number, col: number, context: PresentationContext) {
    const StoneStatusSnapshot = getStoneStatusSnapshot(context);
    const getSpecialMarkers = requireContextFunction(context, 'getSpecialMarkers');
    const findBombMarkerAt = requireContextFunction(context, 'findBombMarkerAt');
    const isOverlayOnlySpecialStoneType = requireContextFunction(context, 'isOverlayOnlySpecialStoneType');
    const markersAtCell = getSpecialMarkers(cardState).filter((marker: any) => (marker &&
        marker.row === row &&
        marker.col === col));
    const bombMarker = findBombMarkerAt(cardState, row, col);
    if (StoneStatusSnapshot && typeof StoneStatusSnapshot.resolveStoneVisualStatusFromMarkers === 'function') {
        return compactPresentationMeta(StoneStatusSnapshot.resolveStoneVisualStatusFromMarkers(markersAtCell, {
            bombMarker,
            mode: 'raw'
        }));
    }
    const toCounterOrNull = (value: any) => {
        if (value === null || value === undefined || value === '')
            return null;
        const n = Number(value);
        if (!Number.isFinite(n))
            return null;
        return Math.max(0, Math.trunc(n));
    };
    const meta: any = {
        special: null,
        timer: null,
        owner: null,
        flipEvadeRemaining: null,
        destroyEvadeRemaining: null
    };
    const destroyValues = markersAtCell
        .map((marker: any) => toCounterOrNull(marker && marker.data && marker.data.destroyEvadeRemaining))
        .filter((value: any) => value !== null);
    if (destroyValues.length) {
        meta.destroyEvadeRemaining = destroyValues.reduce((sum: number, value: number) => sum + value, 0);
    }
    const visualSpecial = markersAtCell.find((marker: any) => {
        const type = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
        if (!type)
            return false;
        return !isOverlayOnlySpecialStoneType(type);
    });
    if (visualSpecial) {
        meta.special = (visualSpecial.data && visualSpecial.data.type) || null;
        meta.timer = Number.isFinite(Number(visualSpecial.data && visualSpecial.data.remainingOwnerTurns))
            ? Math.max(0, Math.trunc(Number(visualSpecial.data.remainingOwnerTurns)))
            : null;
        meta.owner = (visualSpecial.owner !== undefined && visualSpecial.owner !== null) ? visualSpecial.owner : null;
        meta.flipEvadeRemaining = toCounterOrNull(visualSpecial.data && visualSpecial.data.flipEvadeRemaining);
    }
    else if (bombMarker) {
        meta.special = (bombMarker.data && bombMarker.data.type) || 'TIME_BOMB';
        meta.timer = Number.isFinite(Number(bombMarker.data && bombMarker.data.remainingTurns))
            ? Math.max(0, Math.trunc(Number(bombMarker.data.remainingTurns)))
            : null;
        meta.owner = (bombMarker.owner !== undefined && bombMarker.owner !== null) ? bombMarker.owner : null;
    }
    return compactPresentationMeta(meta);
}

function allocateStoneId(cardState: any): string | null {
    if (!cardState)
        return null;
    if (cardState._nextStoneId === undefined || cardState._nextStoneId === null)
        cardState._nextStoneId = 1;
    return 's' + String(cardState._nextStoneId++);
}

function emitPresentationEvent(cardState: any, ev: PresentationEvent, context: PresentationContext) {
    if (!cardState || !ev)
        return;
    const BoardOpsModule = getBoardOpsModule(context);
    if (BoardOpsModule && typeof BoardOpsModule.emitPresentationEvent === 'function') {
        BoardOpsModule.emitPresentationEvent(cardState, ev);
        return;
    }
    if (!Array.isArray(cardState.presentationEvents)) {
        cardState.presentationEvents = [];
    }
    cardState.presentationEvents.push(ev);
}

function flushPresentationEvents(cardState: any, context: PresentationContext): PresentationEvent[] {
    if (!cardState || !Array.isArray(cardState.presentationEvents))
        return [];
    const out = cardState.presentationEvents.slice();
    const BoardOpsModule = getBoardOpsModule(context);
    if (!(BoardOpsModule && typeof BoardOpsModule.emitPresentationEvent === 'function')) {
        if (!Array.isArray(cardState._presentationEventsPersist))
            cardState._presentationEventsPersist = [];
        cardState._presentationEventsPersist.push(...out);
    }
    cardState.presentationEvents.length = 0;
    return out;
}

function swapOccupiedCellsWithPresentation(cardState: any, gameState: any, posA: Position, posB: Position, options: any, context: PresentationContext) {
    const opts = (options && typeof options === 'object') ? options : {};
    const BoardOpsModule = getBoardOpsModule(context);
    if (BoardOpsModule && typeof BoardOpsModule.swapOccupiedCells === 'function') {
        return BoardOpsModule.swapOccupiedCells(cardState, gameState, posA, posB, opts);
    }
    const constants = getConstants(context);
    const getCellValueForCard = requireContextFunction(context, 'getCellValueForCard');
    const setCellValueForCard = requireContextFunction(context, 'setCellValueForCard');
    const swapCellCoordinates = requireContextFunction(context, 'swapCellCoordinates');
    const getStoneIdAtForCard = requireContextFunction(context, 'getStoneIdAtForCard');
    if (!cardState || !gameState || !posA || !posB)
        return { swapped: false, reason: 'invalid_args' };
    const aRow = Number(posA.row);
    const aCol = Number(posA.col);
    const bRow = Number(posB.row);
    const bCol = Number(posB.col);
    if (!Number.isInteger(aRow) || !Number.isInteger(aCol) || !Number.isInteger(bRow) || !Number.isInteger(bCol)) {
        return { swapped: false, reason: 'invalid_args' };
    }
    const valueA = getCellValueForCard(gameState, aRow, aCol);
    const valueB = getCellValueForCard(gameState, bRow, bCol);
    if (valueA === null || valueB === null)
        return { swapped: false, reason: 'out_of_board' };
    if (valueA === constants.EMPTY || valueB === constants.EMPTY)
        return { swapped: false, reason: 'empty' };
    const stoneIdA = getStoneIdAtForCard(cardState, gameState, aRow, aCol);
    const stoneIdB = getStoneIdAtForCard(cardState, gameState, bRow, bCol);
    const ownerBeforeA = valueA === constants.BLACK ? 'black' : 'white';
    const ownerBeforeB = valueB === constants.BLACK ? 'black' : 'white';
    setCellValueForCard(gameState, aRow, aCol, valueB);
    setCellValueForCard(gameState, bRow, bCol, valueA);
    swapCellCoordinates(cardState, gameState, { row: aRow, col: aCol }, { row: bRow, col: bCol });
    const firstEvent: PresentationEvent = {
        type: 'MOVE',
        stoneId: stoneIdA,
        row: bRow,
        col: bCol,
        prevRow: aRow,
        prevCol: aCol,
        ownerBefore: ownerBeforeA,
        ownerAfter: ownerBeforeA,
        cause: opts.firstCause || opts.cause || null,
        reason: opts.firstReason || opts.reason || null
    };
    const firstMeta = getCellVisualPresentationMeta(cardState, bRow, bCol, context);
    if (firstMeta)
        firstEvent.meta = firstMeta;
    emitPresentationEvent(cardState, firstEvent, context);
    const secondEvent: PresentationEvent = {
        type: 'MOVE',
        stoneId: stoneIdB,
        row: aRow,
        col: aCol,
        prevRow: bRow,
        prevCol: bCol,
        ownerBefore: ownerBeforeB,
        ownerAfter: ownerBeforeB,
        cause: opts.secondCause || opts.cause || null,
        reason: opts.secondReason || opts.reason || null
    };
    const secondMeta = getCellVisualPresentationMeta(cardState, aRow, aCol, context);
    if (secondMeta)
        secondEvent.meta = secondMeta;
    emitPresentationEvent(cardState, secondEvent, context);
    return {
        swapped: true,
        first: { row: aRow, col: aCol },
        second: { row: bRow, col: bCol }
    };
}

export = {
    compactPresentationMeta,
    getCellVisualPresentationMeta,
    swapOccupiedCellsWithPresentation,
    allocateStoneId,
    emitPresentationEvent,
    flushPresentationEvents
};

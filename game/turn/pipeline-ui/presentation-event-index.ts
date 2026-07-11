type PresentationEventIndexOptions = {
    perfCounters?: Record<string, number>;
    onEventVisited?: (event: any, index: number) => void;
};

type PresentationEventLookup = {
    type?: any;
    row?: any;
    col?: any;
    actionId?: any;
    includeSourceCell?: boolean;
    predicate?: (event: any) => boolean;
};

const EMPTY_EVENTS: readonly any[] = Object.freeze([]);

function normalizeCellKey(row: any, col: any): string | null {
    const normalizedRow = Number(row);
    const normalizedCol = Number(col);
    if (!Number.isInteger(normalizedRow) || !Number.isInteger(normalizedCol)) return null;
    return `${normalizedRow},${normalizedCol}`;
}

function normalizeLookupKey(value: any): string | null {
    if (value === null || typeof value === 'undefined') return null;
    const key = String(value);
    return key ? key : null;
}

function appendToBucket(index: Map<string, any[]>, key: string | null, event: any): void {
    if (key === null) return;
    const bucket = index.get(key);
    if (bucket) {
        bucket.push(event);
        return;
    }
    index.set(key, [event]);
}

function freezeBuckets(index: Map<string, any[]>): void {
    for (const bucket of index.values()) Object.freeze(bucket);
}

function createPresentationEventIndex(eventsInput: any, options?: PresentationEventIndexOptions) {
    const events = Array.isArray(eventsInput) ? eventsInput : [];
    const opts = options && typeof options === 'object' ? options : {};
    const perfCounters = opts.perfCounters && typeof opts.perfCounters === 'object'
        ? opts.perfCounters
        : null;
    if (perfCounters) {
        perfCounters.presentationEventIndexBuilds = Number(perfCounters.presentationEventIndexBuilds || 0) + 1;
    }

    const byType = new Map<string, any[]>();
    const byCell = new Map<string, any[]>();
    const byRelatedCell = new Map<string, any[]>();
    const byAction = new Map<string, any[]>();

    for (let index = 0; index < events.length; index += 1) {
        const event = events[index];
        if (perfCounters) {
            perfCounters.presentationEventIndexVisits = Number(perfCounters.presentationEventIndexVisits || 0) + 1;
        }
        if (typeof opts.onEventVisited === 'function') opts.onEventVisited(event, index);
        if (!event || typeof event !== 'object') continue;

        appendToBucket(byType, normalizeLookupKey(event.type), event);
        appendToBucket(byAction, normalizeLookupKey(event.actionId ?? (event.meta && event.meta.actionId)), event);

        const directCellKey = normalizeCellKey(event.row, event.col);
        appendToBucket(byCell, directCellKey, event);
        appendToBucket(byRelatedCell, directCellKey, event);

        const meta = event.meta && typeof event.meta === 'object' ? event.meta : null;
        const sourceCellKey = normalizeCellKey(
            meta ? meta.revivedFromRow : undefined,
            meta ? meta.revivedFromCol : undefined
        );
        if (sourceCellKey !== directCellKey) appendToBucket(byRelatedCell, sourceCellKey, event);
    }

    freezeBuckets(byType);
    freezeBuckets(byCell);
    freezeBuckets(byRelatedCell);
    freezeBuckets(byAction);

    function eventsOfType(type: any): readonly any[] {
        const key = normalizeLookupKey(type);
        return key === null ? EMPTY_EVENTS : (byType.get(key) || EMPTY_EVENTS);
    }

    function eventsAtCell(row: any, col: any, includeSourceCell?: boolean): readonly any[] {
        const key = normalizeCellKey(row, col);
        if (key === null) return EMPTY_EVENTS;
        const source = includeSourceCell === true ? byRelatedCell : byCell;
        return source.get(key) || EMPTY_EVENTS;
    }

    function eventsForAction(actionId: any): readonly any[] {
        const key = normalizeLookupKey(actionId);
        return key === null ? EMPTY_EVENTS : (byAction.get(key) || EMPTY_EVENTS);
    }

    function getCandidateEvents(lookup: PresentationEventLookup): readonly any[] {
        const hasCell = normalizeCellKey(lookup.row, lookup.col) !== null;
        const typeEvents = typeof lookup.type === 'undefined' ? null : eventsOfType(lookup.type);
        const cellEvents = hasCell ? eventsAtCell(lookup.row, lookup.col, lookup.includeSourceCell) : null;
        const actionEvents = typeof lookup.actionId === 'undefined' ? null : eventsForAction(lookup.actionId);
        const candidates = [typeEvents, cellEvents, actionEvents].filter((bucket): bucket is readonly any[] => bucket !== null);
        if (candidates.length === 0) return events;
        return candidates.reduce((smallest, bucket) => bucket.length < smallest.length ? bucket : smallest);
    }

    function matchesLookup(event: any, lookup: PresentationEventLookup): boolean {
        if (!event || typeof event !== 'object') return false;
        if (typeof lookup.type !== 'undefined' && normalizeLookupKey(event.type) !== normalizeLookupKey(lookup.type)) return false;
        if (typeof lookup.actionId !== 'undefined') {
            const eventActionId = event.actionId ?? (event.meta && event.meta.actionId);
            if (normalizeLookupKey(eventActionId) !== normalizeLookupKey(lookup.actionId)) return false;
        }
        const requestedCell = normalizeCellKey(lookup.row, lookup.col);
        if (requestedCell !== null) {
            const directCell = normalizeCellKey(event.row, event.col);
            const meta = event.meta && typeof event.meta === 'object' ? event.meta : null;
            const sourceCell = lookup.includeSourceCell === true
                ? normalizeCellKey(
                    meta ? meta.revivedFromRow : undefined,
                    meta ? meta.revivedFromCol : undefined
                )
                : null;
            if (directCell !== requestedCell && sourceCell !== requestedCell) return false;
        }
        return typeof lookup.predicate !== 'function' || lookup.predicate(event) === true;
    }

    function findFirst(lookupInput?: PresentationEventLookup): any {
        const lookup = lookupInput && typeof lookupInput === 'object' ? lookupInput : {};
        const candidates = getCandidateEvents(lookup);
        for (let index = 0; index < candidates.length; index += 1) {
            if (matchesLookup(candidates[index], lookup)) return candidates[index];
        }
        return null;
    }

    function findLast(lookupInput?: PresentationEventLookup): any {
        const lookup = lookupInput && typeof lookupInput === 'object' ? lookupInput : {};
        const candidates = getCandidateEvents(lookup);
        for (let index = candidates.length - 1; index >= 0; index -= 1) {
            if (matchesLookup(candidates[index], lookup)) return candidates[index];
        }
        return null;
    }

    return Object.freeze({
        events,
        eventsOfType,
        eventsAtCell,
        eventsForAction,
        findFirst,
        findLast
    });
}

export = {
    createPresentationEventIndex
};

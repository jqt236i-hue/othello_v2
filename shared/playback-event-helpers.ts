(function (root: any, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        let OwnerHelpers = null;
        try {
            OwnerHelpers = require('../utils/owner-helpers');
        } catch (e) { /* ignore */ }
        module.exports = factory(OwnerHelpers);
    } else {
        root.PlaybackEventHelpers = factory(root.OwnerHelpers || null);
    }
}(typeof self !== 'undefined' ? self : this as unknown as Record<string, unknown>, function (OwnerHelpers: unknown) {
    'use strict';

    interface PlaceEvent {
        type: string;
        row: number;
        col: number;
        owner?: string;
        player?: string;
        actionId?: string;
        turnIndex?: number;
    }

    interface PlaybackEvent {
        type: string;
        phase: number;
        rawType: string;
        actionId: string | null;
        turnIndex: number;
        targets: Array<{ r: number; col: number; player: string; owner: string }>;
    }

    interface CardVisualDescriptor {
        cardId?: string;
        name?: string;
        cost?: number;
        costTier?: string;
    }

    interface AssemblyOptions {
        rawEvents?: unknown[];
        presentationEvents?: unknown[];
        snapshot?: { cardState?: { turnIndex?: number }; gameState?: unknown };
        adapter?: PlaybackAdapter | null;
        fallbackPlayerKey?: string | null;
        normalizePlayerKey?: (v: unknown) => string | null;
    }

    interface PlaybackAdapter {
        mapToPlaybackEvents?: (events: unknown[], cardState: unknown, gameState: unknown) => unknown[];
        normalizePlaybackEvents?: (playbackEvents: unknown[], rawEvents: unknown[], presentationEvents: unknown[], snapshot: unknown) => unknown[];
        appendSoundEffectPlaybackEvents?: (playbackEvents: unknown[], rawEvents: unknown[], presentationEvents: unknown[]) => unknown[];
    }

    interface AssemblyResult {
        playbackEvents: unknown[];
        diagnostics: AssemblyDiagnostics;
    }

    interface AssemblyDiagnostics {
        rawPlaceCount: number;
        placeHandAnimationCount: number;
        rawBoardVisualCount: number;
        boardVisualPlaybackCount: number;
        warnings: string[];
    }

    interface ServerPlaybackCollectionOptions extends AssemblyOptions {
        playerKey?: unknown;
    }

    interface ServerPlaybackCollectionResult {
        playbackEvents: unknown[];
        diagnostics: AssemblyDiagnostics | null;
        presentationEvents: unknown[];
        playerKey: unknown;
    }

    interface ActionPlaybackCollectionOptions extends AssemblyOptions {
        result?: unknown;
        playerKey?: unknown;
    }

    interface ActionPlaybackCollectionResult extends ServerPlaybackCollectionResult {
        playbackPresentationEvents: unknown[];
    }

    interface TurnStartHandState {
        playerKey?: unknown;
        hand?: unknown[];
    }

    interface TurnStartDrawOptions {
        playbackAssembly?: unknown;
        snapshot?: { cardState?: { hands?: Record<string, unknown> }; gameState?: unknown };
        handState?: TurnStartHandState | null;
        adapter?: PlaybackAdapter | null;
        normalizePlayerKey?: (v: unknown) => string | null;
    }

    function parseSeatKeyOptional(value: unknown): string | null {
        try {
            if (
                OwnerHelpers &&
                typeof (OwnerHelpers as { normalizePlayerKeyOptional?: (v: unknown) => string | null }).normalizePlayerKeyOptional === 'function'
            ) {
                const normalized = (OwnerHelpers as { normalizePlayerKeyOptional: (v: unknown) => string | null }).normalizePlayerKeyOptional(value);
                if (normalized) return normalized;
            }
        } catch (e) { /* ignore */ }

        if (value === 'black' || value === 1 || value === '1' || value === '+1') return 'black';
        if (value === 'white' || value === -1 || value === '-1') return 'white';

        const normalized = (value === null || typeof value === 'undefined')
            ? ''
            : String(value).trim().toLowerCase();
        if (normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
        if (normalized === 'white' || normalized === '-1') return 'white';
        return null;
    }

    function resolvePlayerKey(value: unknown, fallbackPlayerKey: unknown, normalizePlayerKey: unknown): string {
        const normalize = typeof normalizePlayerKey === 'function' ? normalizePlayerKey as (v: unknown) => string | null : null;
        if (normalize) {
            try {
                const direct = normalize(value);
                if (direct) return direct;
            } catch (e) { /* ignore */ }
            try {
                const fallback = normalize(fallbackPlayerKey);
                if (fallback) return fallback;
            } catch (e) { /* ignore */ }
        }
        return parseSeatKeyOptional(value) || parseSeatKeyOptional(fallbackPlayerKey) || 'black';
    }

    function getCardCostTier(cost: unknown): string | null {
        const safeCost = Number.isFinite(Number(cost)) ? Number(cost) : null;
        if (safeCost === null) return null;
        if (safeCost === 0) return 'white';
        if (safeCost >= 31) return 'special';
        if (safeCost >= 21) return 'gold';
        if (safeCost >= 16) return 'purple';
        if (safeCost >= 11) return 'blue';
        if (safeCost >= 6) return 'red';
        return 'gray';
    }

    function normalizeCardVisualDescriptor(value: unknown): CardVisualDescriptor | null {
        if (!value || typeof value !== 'object') return null;

        const descriptor: CardVisualDescriptor = {};
        const obj = value as Record<string, unknown>;
        if (obj.cardId) {
            descriptor.cardId = String(obj.cardId);
        }
        if (obj.name) {
            descriptor.name = String(obj.name);
        }
        if (Number.isFinite(Number(obj.cost))) {
            descriptor.cost = Number(obj.cost);
        }

        const costTier = obj.costTier || getCardCostTier(descriptor.cost);
        if (costTier) {
            descriptor.costTier = String(costTier);
        }

        return Object.keys(descriptor).length > 0 ? descriptor : null;
    }

    function createCardVisualDescriptor(cardId: unknown, meta: unknown): CardVisualDescriptor | null {
        const metaObj = meta && typeof meta === 'object' ? meta as Record<string, unknown> : {};
        const descriptor = normalizeCardVisualDescriptor({
            cardId,
            name: metaObj.name || null,
            cost: metaObj.cost && Number.isFinite(Number(metaObj.cost)) ? Number(metaObj.cost) : null,
            costTier: metaObj.costTier || null
        });
        return descriptor ? cloneJsonSafe(descriptor) : null;
    }

    function mapRawPlaceEventsToPlayback(rawEvents: unknown[], options: unknown): PlaybackEvent[] {
        const events = Array.isArray(rawEvents) ? rawEvents : [];
        if (events.length === 0) return [];

        const opts = (options && typeof options === 'object') ? options as Record<string, unknown> : {};
        const fallbackTurnIndex = Number.isFinite(Number(opts.fallbackTurnIndex))
            ? Math.trunc(Number(opts.fallbackTurnIndex))
            : 0;
        const playbackEvents: PlaybackEvent[] = [];
        for (const ev of events) {
            if (!ev || (ev as PlaceEvent).type !== 'place') continue;
            if (!Number.isInteger((ev as PlaceEvent).row) || !Number.isInteger((ev as PlaceEvent).col)) continue;
            const ownerKey = resolvePlayerKey((ev as PlaceEvent).owner || (ev as PlaceEvent).player, opts.fallbackPlayerKey, opts.normalizePlayerKey);
            playbackEvents.push({
                type: 'place_hand_animation',
                phase: 0,
                rawType: (ev as PlaceEvent).type,
                actionId: (ev as PlaceEvent).actionId || null,
                turnIndex: Number.isFinite(Number((ev as PlaceEvent).turnIndex)) ? Math.trunc(Number((ev as PlaceEvent).turnIndex)) : fallbackTurnIndex,
                targets: [{ r: (ev as PlaceEvent).row, col: (ev as PlaceEvent).col, player: ownerKey, owner: ownerKey }]
            });
        }
        return playbackEvents;
    }

    function countRawPlaceEvents(rawEvents: unknown[]): number {
        const events = Array.isArray(rawEvents) ? rawEvents : [];
        let count = 0;
        for (const event of events) {
            if (!event || (event as PlaceEvent).type !== 'place') continue;
            if (!Number.isInteger((event as PlaceEvent).row) || !Number.isInteger((event as PlaceEvent).col)) continue;
            count += 1;
        }
        return count;
    }

    function countPlaceHandAnimationEvents(playbackEvents: unknown[]): number {
        const events = Array.isArray(playbackEvents) ? playbackEvents : [];
        let count = 0;
        for (const event of events) {
            if (!event || (event as PlaybackEvent).type !== 'place_hand_animation') continue;
            count += 1;
        }
        return count;
    }

    function countRawBoardVisualEvents(rawEvents: unknown[]): number {
        const events = Array.isArray(rawEvents) ? rawEvents : [];
        let count = 0;
        for (const event of events) {
            if (isRawBoardVisualEvent(event)) count += 1;
        }
        return count;
    }

    function countBoardVisualPlaybackEvents(playbackEvents: unknown[]): number {
        const events = Array.isArray(playbackEvents) ? playbackEvents : [];
        let count = 0;
        for (const event of events) {
            if (isBoardVisualPlaybackEvent(event)) count += 1;
        }
        return count;
    }

    function isRawBoardVisualEvent(event: unknown): boolean {
        const type = String(event && typeof event === 'object' ? (event as Record<string, unknown>).type || '' : '').trim().toUpperCase();
        return type === 'SPAWN' || type === 'CHANGE' || type === 'DESTROY' || type === 'MOVE';
    }

    function isBoardVisualPlaybackEvent(event: unknown): boolean {
        const type = String(event && typeof event === 'object' ? (event as Record<string, unknown>).type || '' : '').trim().toLowerCase();
        return type === 'spawn' || type === 'flip' || type === 'destroy' || type === 'move';
    }

    function playbackEventKey(event: unknown): string {
        try {
            return JSON.stringify(event);
        } catch (e) {
            return String(event || '');
        }
    }

    function createAssemblyDiagnostics(rawEvents: unknown[], playbackEvents: unknown[]): AssemblyDiagnostics {
        const rawPlaceCount = countRawPlaceEvents(rawEvents);
        const placeHandAnimationCount = countPlaceHandAnimationEvents(playbackEvents);
        const rawBoardVisualCount = countRawBoardVisualEvents(rawEvents);
        const boardVisualPlaybackCount = countBoardVisualPlaybackEvents(playbackEvents);
        const warnings: string[] = [];
        if (rawPlaceCount !== placeHandAnimationCount) {
            warnings.push(`raw place count ${rawPlaceCount} does not match place_hand_animation count ${placeHandAnimationCount}`);
        }
        if (rawBoardVisualCount > boardVisualPlaybackCount) {
            warnings.push(`raw board visual count ${rawBoardVisualCount} exceeds board playback count ${boardVisualPlaybackCount}`);
        }
        return {
            rawPlaceCount,
            placeHandAnimationCount,
            rawBoardVisualCount,
            boardVisualPlaybackCount,
            warnings
        };
    }

    function resolvePlaybackAdapter(adapterValue: unknown): PlaybackAdapter | null {
        return (adapterValue && typeof adapterValue === 'object') ? adapterValue as PlaybackAdapter : null;
    }

    function assemblePlaybackEvents(options: unknown): AssemblyResult {
        const opts = (options && typeof options === 'object') ? options as AssemblyOptions : {};
        const rawEvents = Array.isArray(opts.rawEvents) ? opts.rawEvents : [];
        const presentationEvents = Array.isArray(opts.presentationEvents) ? opts.presentationEvents : [];
        const snapshot = (opts.snapshot && typeof opts.snapshot === 'object') ? opts.snapshot : {};
        const adapter = resolvePlaybackAdapter(opts.adapter);
        const normalizePlayerKey = typeof opts.normalizePlayerKey === 'function' ? opts.normalizePlayerKey : null;

        const rawPlacePlaybackEvents = mapRawPlaceEventsToPlayback(rawEvents, {
            fallbackPlayerKey: opts.fallbackPlayerKey || null,
            fallbackTurnIndex: (snapshot && (snapshot as { cardState?: { turnIndex?: number } }).cardState && typeof (snapshot as { cardState?: { turnIndex?: number } }).cardState?.turnIndex === 'number')
                ? (snapshot as { cardState: { turnIndex: number } }).cardState.turnIndex
                : 0,
            normalizePlayerKey
        });

        let playbackEvents: unknown[] = rawPlacePlaybackEvents.slice();
        if (presentationEvents.length > 0) {
            if (adapter && typeof adapter.mapToPlaybackEvents === 'function') {
                const mappedPlaybackEvents = adapter.mapToPlaybackEvents(
                    presentationEvents,
                    snapshot && (snapshot as { cardState?: unknown }).cardState,
                    snapshot && (snapshot as { gameState?: unknown }).gameState
                );
                if (!Array.isArray(mappedPlaybackEvents)) {
                    throw new Error('PlaybackEventHelpers.assemblePlaybackEvents expected adapter.mapToPlaybackEvents to return an array');
                }
                playbackEvents = rawPlacePlaybackEvents.concat(mappedPlaybackEvents as PlaybackEvent[]);
            } else {
                playbackEvents = rawPlacePlaybackEvents.concat(presentationEvents as PlaybackEvent[]);
            }
        }

        if (adapter && typeof adapter.normalizePlaybackEvents === 'function') {
            const normalizedPlaybackEvents = adapter.normalizePlaybackEvents(
                playbackEvents,
                rawEvents,
                presentationEvents,
                snapshot
            );
            if (!Array.isArray(normalizedPlaybackEvents)) {
                throw new Error('PlaybackEventHelpers.assemblePlaybackEvents expected adapter.normalizePlaybackEvents to return an array');
            }
            playbackEvents = normalizedPlaybackEvents;
        }

        if (adapter && typeof adapter.appendSoundEffectPlaybackEvents === 'function') {
            const playbackWithSound = adapter.appendSoundEffectPlaybackEvents(
                playbackEvents,
                rawEvents,
                presentationEvents
            );
            if (!Array.isArray(playbackWithSound)) {
                throw new Error('PlaybackEventHelpers.assemblePlaybackEvents expected adapter.appendSoundEffectPlaybackEvents to return an array');
            }
            playbackEvents = playbackWithSound;
        }

        if (adapter && typeof adapter.mapToPlaybackEvents === 'function') {
            const rawBoardEvents = rawEvents.filter(isRawBoardVisualEvent);
            if (rawBoardEvents.length > 0) {
                const rawBoardPlaybackEvents = adapter.mapToPlaybackEvents(
                    rawBoardEvents,
                    snapshot && (snapshot as { cardState?: unknown }).cardState,
                    snapshot && (snapshot as { gameState?: unknown }).gameState
                );
                if (!Array.isArray(rawBoardPlaybackEvents)) {
                    throw new Error('PlaybackEventHelpers.assemblePlaybackEvents expected adapter.mapToPlaybackEvents for raw board events to return an array');
                }
                const existingKeys = new Set(playbackEvents.map(playbackEventKey));
                const missingBoardPlaybackEvents = rawBoardPlaybackEvents
                    .filter(isBoardVisualPlaybackEvent)
                    .filter((event) => !existingKeys.has(playbackEventKey(event)));
                if (missingBoardPlaybackEvents.length > 0) {
                    playbackEvents = (rawPlacePlaybackEvents as unknown[])
                        .concat(missingBoardPlaybackEvents as unknown[])
                        .concat(playbackEvents.filter((event) => !rawPlacePlaybackEvents.some((placeEvent) => playbackEventKey(placeEvent) === playbackEventKey(event))));
                }
            }
        }

        if (rawPlacePlaybackEvents.length > 0 && playbackEvents.length > 0) {
            const hasRawPrefix = rawPlacePlaybackEvents.every((event, index) => {
                try {
                    return JSON.stringify(playbackEvents[index]) === JSON.stringify(event);
                } catch (e) {
                    return false;
                }
            });
            if (!hasRawPrefix) {
                playbackEvents = (rawPlacePlaybackEvents as unknown[]).concat(playbackEvents);
            }
        }

        const diagnostics = createAssemblyDiagnostics(rawEvents, playbackEvents);
        return {
            playbackEvents: cloneJsonSafe(playbackEvents),
            diagnostics: cloneJsonSafe(diagnostics)
        };
    }

    function mapServerPresentationToPlaybackEvents(options: unknown): AssemblyResult {
        const opts = (options && typeof options === 'object') ? options as AssemblyOptions : {};
        return assemblePlaybackEvents({
            rawEvents: opts.rawEvents,
            presentationEvents: opts.presentationEvents,
            snapshot: opts.snapshot,
            fallbackPlayerKey: opts.fallbackPlayerKey || null,
            adapter: opts.adapter,
            normalizePlayerKey: opts.normalizePlayerKey
        });
    }

    function collectServerPlaybackEvents(options: unknown): ServerPlaybackCollectionResult {
        const opts = (options && typeof options === 'object') ? options as ServerPlaybackCollectionOptions : {};
        const snapshot = (opts.snapshot && typeof opts.snapshot === 'object')
            ? opts.snapshot as { cardState?: Record<string, unknown>; gameState?: unknown }
            : {};
        const cardState = (snapshot.cardState && typeof snapshot.cardState === 'object')
            ? snapshot.cardState
            : null;
        const playerKey = opts.playerKey || opts.fallbackPlayerKey || null;
        if (!cardState) {
            return {
                playbackEvents: [],
                diagnostics: null,
                presentationEvents: [],
                playerKey
            };
        }

        let presentationEvents: unknown[] = [];
        if (Array.isArray(cardState.presentationEvents) && cardState.presentationEvents.length > 0) {
            presentationEvents = cloneJsonSafe(cardState.presentationEvents);
            if (Array.isArray(cardState._presentationEventsPersist)) {
                cardState._presentationEventsPersist.length = 0;
            }
        } else if (Array.isArray(cardState._presentationEventsPersist) && cardState._presentationEventsPersist.length > 0) {
            presentationEvents = cloneJsonSafe(cardState._presentationEventsPersist);
        }

        cardState.presentationEvents = [];
        cardState._presentationEventsPersist = [];
        delete cardState._currentActionMeta;

        const assembly = mapServerPresentationToPlaybackEvents({
            rawEvents: opts.rawEvents,
            presentationEvents,
            snapshot,
            fallbackPlayerKey: playerKey as string | null,
            adapter: opts.adapter,
            normalizePlayerKey: opts.normalizePlayerKey
        });

        return {
            playbackEvents: Array.isArray(assembly.playbackEvents) ? assembly.playbackEvents : [],
            diagnostics: assembly.diagnostics || createAssemblyDiagnostics([], []),
            presentationEvents,
            playerKey
        };
    }

    function collectActionPlaybackEvents(options: unknown): ActionPlaybackCollectionResult {
        const opts = (options && typeof options === 'object') ? options as ActionPlaybackCollectionOptions : {};
        const result = (opts.result && typeof opts.result === 'object') ? opts.result as Record<string, unknown> : {};
        const resultCardState = (result.cardState && typeof result.cardState === 'object')
            ? result.cardState as Record<string, unknown>
            : {};
        const rawEvents = Array.isArray(opts.rawEvents)
            ? opts.rawEvents
            : (Array.isArray(result.events) ? result.events : []);
        const presentationEvents = Array.isArray(result.presentationEvents)
            ? result.presentationEvents
            : (Array.isArray(resultCardState.presentationEvents) ? resultCardState.presentationEvents : []);
        const playbackPresentationEvents = presentationEvents.length > 0 ? presentationEvents : rawEvents;
        const playerKey = opts.playerKey || opts.fallbackPlayerKey || null;
        const assembly = mapServerPresentationToPlaybackEvents({
            rawEvents,
            presentationEvents: playbackPresentationEvents,
            snapshot: opts.snapshot,
            fallbackPlayerKey: playerKey as string | null,
            adapter: opts.adapter,
            normalizePlayerKey: opts.normalizePlayerKey
        });

        return {
            playbackEvents: Array.isArray(assembly.playbackEvents) ? assembly.playbackEvents : [],
            diagnostics: assembly.diagnostics || createAssemblyDiagnostics([], []),
            presentationEvents,
            playbackPresentationEvents,
            playerKey
        };
    }

    function appendTurnStartDrawPlaybackEvents(options: unknown): unknown {
        const opts = (options && typeof options === 'object') ? options as TurnStartDrawOptions : {};
        const playbackAssembly = opts.playbackAssembly;
        const assembly = (playbackAssembly && typeof playbackAssembly === 'object')
            ? playbackAssembly as Record<string, unknown>
            : { playbackEvents: Array.isArray(playbackAssembly) ? playbackAssembly : [], diagnostics: null };
        const baseEvents = Array.isArray(assembly.playbackEvents) ? assembly.playbackEvents.slice() : [];
        const handState = (opts.handState && typeof opts.handState === 'object') ? opts.handState : {};
        const normalizePlayerKey = typeof opts.normalizePlayerKey === 'function' ? opts.normalizePlayerKey : parseSeatKeyOptional;
        const playerKey = normalizePlayerKey(handState.playerKey);
        if (!playerKey) return assembly;

        const adapter = resolvePlaybackAdapter(opts.adapter);
        if (!adapter || typeof adapter.mapToPlaybackEvents !== 'function') return assembly;

        const snapshot = (opts.snapshot && typeof opts.snapshot === 'object') ? opts.snapshot : {};
        const cardState = (snapshot.cardState && typeof snapshot.cardState === 'object') ? snapshot.cardState : {};
        const hands = (cardState.hands && typeof cardState.hands === 'object') ? cardState.hands : {};
        const beforeHand = Array.isArray(handState.hand) ? handState.hand : [];
        const afterHand = Array.isArray(hands[playerKey]) ? hands[playerKey] as unknown[] : [];
        if (afterHand.length <= beforeHand.length) return assembly;

        const drawPresentationEvents = afterHand
            .slice(beforeHand.length)
            .filter((cardId) => cardId !== null && typeof cardId !== 'undefined')
            .map((cardId) => ({
                type: 'DRAW_CARD',
                player: playerKey,
                cardId,
                count: 1
            }));
        if (drawPresentationEvents.length === 0) return assembly;

        const drawPlaybackEvents = adapter.mapToPlaybackEvents(
            drawPresentationEvents,
            snapshot.cardState,
            snapshot.gameState
        ) || [];
        if (!Array.isArray(drawPlaybackEvents) || drawPlaybackEvents.length === 0) return assembly;

        return Object.assign({}, assembly, {
            playbackEvents: appendPlaybackEventsAfter(baseEvents, drawPlaybackEvents),
            diagnostics: assembly.diagnostics
        });
    }

    function cloneJsonSafe<T>(value: T): T {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (e) {
            return Array.isArray(value) ? (value as unknown[]).slice() as unknown as T : value;
        }
    }

    function getMaxPlaybackPhase(events: unknown[]): number {
        const list = Array.isArray(events) ? events : [];
        let maxPhase = 0;
        for (const event of list) {
            const phase = Number(event && typeof event === 'object' ? (event as Record<string, unknown>).phase : undefined);
            if (Number.isFinite(phase) && phase > maxPhase) {
                maxPhase = phase;
            }
        }
        return maxPhase;
    }

    function appendPlaybackEventsAfter(baseEvents: unknown[], appendedEvents: unknown[]): unknown[] {
        const base = Array.isArray(baseEvents) ? cloneJsonSafe(baseEvents) : [];
        const appended = Array.isArray(appendedEvents) ? cloneJsonSafe(appendedEvents) : [];
        if (base.length === 0) return appended;
        if (appended.length === 0) return base;

        let minPhase = Infinity;
        for (const event of appended) {
            const phase = Number(event && typeof event === 'object' ? (event as Record<string, unknown>).phase : undefined);
            const normalized = Number.isFinite(phase) ? phase : 0;
            if (normalized < minPhase) minPhase = normalized;
        }
        if (!Number.isFinite(minPhase)) minPhase = 0;

        const baseMaxPhase = getMaxPlaybackPhase(base);
        const phaseOffset = (baseMaxPhase + 1) - minPhase;
        const shifted = appended.map((event) => {
            const cloned = (event && typeof event === 'object') ? event as Record<string, unknown> : {};
            const srcPhase = Number(cloned.phase);
            cloned.phase = Number.isFinite(srcPhase) ? (srcPhase + phaseOffset) : (baseMaxPhase + 1);
            return cloned;
        });

        return base.concat(shifted);
    }

    return {
        assemblePlaybackEvents,
        createCardVisualDescriptor,
        countRawPlaceEvents,
        countPlaceHandAnimationEvents,
        createAssemblyDiagnostics,
        countRawBoardVisualEvents,
        countBoardVisualPlaybackEvents,
        getCardCostTier,
        collectActionPlaybackEvents,
        collectServerPlaybackEvents,
        mapServerPresentationToPlaybackEvents,
        appendTurnStartDrawPlaybackEvents,
        mapRawPlaceEventsToPlayback,
        normalizeCardVisualDescriptor,
        appendPlaybackEventsAfter
    };
}));

export {};

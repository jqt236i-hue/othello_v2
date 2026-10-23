import type { MatchAuthoritySeatKey } from '../match-authority-types';

interface MatchAuthorityPlaybackVisibilityDeps {
    makeHiddenHandToken: (ownerKey: unknown, handIndex: unknown) => string;
    isHiddenHandTokenLike: (value: unknown) => boolean;
    parseSeatKeyOptional: (value: unknown) => MatchAuthoritySeatKey | null;
}

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' ? value as Record<string, any> : {};
}

export function createMatchAuthorityPlaybackVisibilityApi(deps: MatchAuthorityPlaybackVisibilityDeps) {
    function isCardRevealedToViewer(projectedHands: Record<string, any>, ownerKey: string, cardId: unknown): boolean {
        const hand = Array.isArray(projectedHands[ownerKey]) ? projectedHands[ownerKey] : [];
        return hand.some((entry: unknown) => entry === cardId && !deps.isHiddenHandTokenLike(entry));
    }

    function maskHandAddTarget(
        target: Record<string, any>,
        index: number,
        viewerSeat: MatchAuthoritySeatKey,
        projectedHands: Record<string, any>
    ): Record<string, any> {
        const ownerKey = deps.parseSeatKeyOptional(target.player);
        if (!ownerKey || ownerKey === viewerSeat) return target;
        if (target.cardId === null || typeof target.cardId === 'undefined') return target;
        if (deps.isHiddenHandTokenLike(target.cardId)) return target;
        // Cards the viewer may inspect (observation / reveal effects) stay visible.
        if (isCardRevealedToViewer(projectedHands, ownerKey, target.cardId)) return target;
        const hand = Array.isArray(projectedHands[ownerKey]) ? projectedHands[ownerKey] : [];
        const count = Number.isFinite(Number(target.count)) ? Math.max(1, Math.trunc(Number(target.count))) : 1;
        const handIndex = Math.max(0, hand.length - count + index);
        const masked: Record<string, any> = { ...target, cardId: deps.makeHiddenHandToken(ownerKey, handIndex) };
        if ('visualDescriptor' in masked) masked.visualDescriptor = null;
        for (const key of ['generatedName', 'sourceCardId', 'sourceName']) {
            if (key in masked) masked[key] = null;
        }
        return masked;
    }

    /**
     * Seat viewers must not learn which card entered the opponent's hand. The event and its count
     * stay so the opponent-draw animation still plays; the card identity becomes a hand token.
     * Spectators inspect both hands by contract, so only seat viewers are masked.
     */
    function maskPlaybackEventsForSeat(
        eventsValue: unknown,
        viewerSeatValue: unknown,
        projectedSnapshot: unknown
    ): unknown[] {
        const events = Array.isArray(eventsValue) ? eventsValue : [];
        const viewerSeat = deps.parseSeatKeyOptional(viewerSeatValue);
        if (!viewerSeat) return events;
        const projectedHands = asRecord(asRecord(asRecord(projectedSnapshot).cardState).hands);
        let changed = false;
        const result = events.map((event: unknown) => {
            const record = asRecord(event);
            if (record.type !== 'hand_add' || !Array.isArray(record.targets)) return event;
            let targetsChanged = false;
            const targets = record.targets.map((targetValue: unknown, index: number) => {
                const target = asRecord(targetValue);
                const masked = maskHandAddTarget(target, index, viewerSeat, projectedHands);
                if (masked !== target) targetsChanged = true;
                return masked;
            });
            if (!targetsChanged) return event;
            changed = true;
            return { ...record, targets };
        });
        return changed ? result : events;
    }

    return { maskPlaybackEventsForSeat };
}
